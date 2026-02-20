# ================================================================
# TenderZen â€” Planning Router
# Backend/app/routers/planning_router.py
# Datum: 2026-02-11 (v3.5 â€” RLS-compatible met user JWT)
# ================================================================
#
# WIJZIGINGEN v3.5:
# - ALLE endpoints: db = get_supabase() â†’ db: Client = Depends(get_user_db)
#   â†’ auth.uid() werkt nu correct in RLS policies
#   â†’ Geen service_role bypass nodig
# - team-members: is_active NULL wordt als actief behandeld
# - team-members: drie kolom-fallbacks (tenderbureau_id/company_id/bureau_id)
# - BackplanningService ontvangt nu user-scoped DB client
#
# WIJZIGINGEN v3.4:
# - Alle current_user.get('tenderbureau_id') vervangen door resolve_bureau_id()
# - Super-admin krijgt NOOIT automatisch een bureau
# - Centraal bureau resolution via app/core/bureau_context.py
#
# FastAPI endpoints voor:
# - POST /planning/generate-backplanning
# - GET  /team/workload
# - GET  /team-members
# - GET  /planning/agenda
# - GET  /planning-counts
# - GET/POST/PUT/DELETE /planning-templates
#
# Registratie in main.py:
#   from app.routers.planning_router import router as planning_router
#   app.include_router(planning_router, prefix="/api/v1")
# ================================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import date
from supabase import Client
import logging

from app.core.database import get_supabase
from app.core.dependencies import get_current_user, get_user_db
from app.core.bureau_context import resolve_bureau_id
from app.services.backplanning_service import BackplanningService
from app.models.planning_models import (
    BackplanningRequest,
    BackplanningResponse,
    WorkloadResponse,
    TemplateCreateRequest,
    TemplateUpdateRequest,
    TemplateTakenBulkRequest,
    TemplateResponse,
    TemplateListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Planning"])


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# DEPENDENCY: BackplanningService (nu met user DB)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

def get_backplanning_service(
    db: Client = Depends(get_user_db)
) -> BackplanningService:
    """Dependency injection voor BackplanningService met user-scoped DB."""
    return BackplanningService(db)


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 1. TEAM MEMBERS â€” Teamleden ophalen per bureau
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# âš ï¸ BEVEILIGINGSKRITISCH: Altijd filteren op bureau.
# NOOIT team_members ophalen zonder bureau-filter.
# team_members tabel is de bron voor tender_team_assignments.
#
# FIXES v3.5:
# - RLS: auth.uid() werkt nu via get_user_db
# - is_active: NULL wordt als actief behandeld (.neq False)
# - Kolom: drie fallbacks (tenderbureau_id/company_id/bureau_id)
# - Fallback: retry zonder is_active als eerste query 0 retourneert

from pydantic import BaseModel
from typing import List, Optional, Any

class TeamMemberOut(BaseModel):
    user_id: str
    naam: str
    email: Optional[str]
    bureau_rol: Optional[str]
    initialen: Optional[str]
    avatar_kleur: Optional[str]
    tenderbureau_id: Optional[str]
    # Voeg hier andere relevante velden toe indien gewenst

class TeamMembersResponse(BaseModel):
    success: bool
    data: List[TeamMemberOut]
    count: int

@router.get(
    "/team-members",
    summary="Team Members voor Bureau",
    description="Retourneert alle actieve teamleden uit de v_bureau_team view voor het huidige bureau.",
    response_model=TeamMembersResponse
)
async def get_team_members(
    tenderbureau_id: Optional[str] = Query(None, description="Override bureau ID"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Bron: v_bureau_team view (combineert user_bureau_access + users).
    """
    try:
        bureau_id = await resolve_bureau_id(
            current_user, explicit_bureau_id=tenderbureau_id, db=db
        )
        logger.info(f"🔎 Team members ophalen voor bureau: {bureau_id}")
        # Direct query - view filtert al op is_active
        result = db.table('v_bureau_team') \
            .select('*') \
            .eq('tenderbureau_id', bureau_id) \
            .order('naam') \
            .execute()
        members = result.data or []
        logger.info(f"📋 {len(members)} team members opgehaald via v_bureau_team")
        # Converteer dicts naar TeamMemberOut instanties voor OpenAPI compatibiliteit
        try:
            members_out = [TeamMemberOut(**m) for m in members]
        except Exception as e:
            logger.error(f"❌ Fout bij converteren teamleden naar TeamMemberOut: {e}")
            # Fallback: retourneer originele dicts (voor backward compatibility)
            members_out = members
        return {
            "success": True,
            "data": members_out,
            "count": len(members_out)
        }
    except Exception as e:
        logger.error(f"❌ Fout bij ophalen team members: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Er ging iets mis bij het ophalen van teamleden"
        )


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 2. AGENDA â€” Cross-tender overzicht (AgendaView)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get(
    "/planning/agenda",
    summary="Agenda data voor alle tenders",
    description=(
        "Retourneert planning taken en checklist items over alle tenders "
        "voor een bepaalde periode. Gebruikt door de AgendaView."
    )
)
async def get_agenda_data(
    start_date: str = Query(..., description="Start datum ISO format: 2026-02-03"),
    end_date: str = Query(..., description="Eind datum ISO format: 2026-02-09"),
    team_member_id: Optional[str] = Query(None, description="Filter op teamlid UUID"),
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter (verplicht voor super-admin)"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Haal agenda data op: alle taken over alle tenders voor het bureau."""
    try:
        # 1. Planning taken in de periode
        planning_query = db.table('planning_taken') \
            .select('*') \
            .gte('start_datum', start_date) \
            .lte('start_datum', end_date)

        if team_member_id:
            planning_query = planning_query.contains(
                'toegewezen_aan', [team_member_id]
            )

        planning_result = planning_query.execute()
        planning_taken = planning_result.data or []

        # 2. Checklist items in de periode
        checklist_query = db.table('checklist_items') \
            .select('*') \
            .gte('deadline', start_date) \
            .lte('deadline', end_date)

        checklist_result = checklist_query.execute()
        checklist_items = checklist_result.data or []

        # 3. Combineer en markeer type
        taken = []
        for t in planning_taken:
            t['item_type'] = 'planning'
            taken.append(t)
        for c in checklist_items:
            c['item_type'] = 'checklist'
            c['start_datum'] = c.get('deadline')
            taken.append(c)

        # 4. Verzamel unieke tender_ids
        tender_ids = list(set(
            t.get('tender_id') for t in taken if t.get('tender_id')
        ))

        # 5. Haal tender info op
        tenders = {}
        if tender_ids:
            tender_result = db.table('tenders') \
                .select('id, naam, opdrachtgever, fase, fase_status, deadline_indiening, tenderbureau_id') \
                .in_('id', tender_ids) \
                .execute()
            for t in (tender_result.data or []):
                tenders[t['id']] = t

        # 6. Haal team members op
        team_members = []
        resolved_bureau = await resolve_bureau_id(
            current_user, explicit_bureau_id=tenderbureau_id, db=db, required=False
        )
        if resolved_bureau:
            team_result = db.table('v_bureau_team') \
                .select('user_id, naam, email, initialen, avatar_kleur, bureau_rol') \
                .eq('tenderbureau_id', resolved_bureau) \
                .order('naam') \
                .execute()
            team_members = team_result.data or []

        return {
            "success": True,
            "data": {
                "taken": taken,
                "tenders": tenders,
                "team_members": team_members
            }
        }

    except Exception as e:
        logger.error(f"Fout bij ophalen agenda data: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Fout bij ophalen agenda data"
        )


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 3. BACK-PLANNING GENERATIE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.post(
    "/planning/generate-backplanning",
    response_model=BackplanningResponse,
    summary="Genereer back-planning",
    description=(
        "Genereert een complete back-planning op basis van deadline, "
        "template en team-toewijzingen. Berekent werkdagen terug vanaf "
        "de deadline, slaat weekenden en feestdagen over."
    )
)
async def generate_backplanning(
    request: BackplanningRequest,
    service: BackplanningService = Depends(get_backplanning_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Genereer een back-planning.

    - **deadline**: Indiendatum (T-0)
    - **template_id**: UUID van het planning template
    - **team_assignments**: Mapping van rol â†’ user_id
    - **tenderbureau_id**: UUID van het bureau
    - **tender_id**: Optioneel, voor workload-check
    """
    try:
        result = await service.generate_backplanning(
            deadline=request.deadline,
            template_id=str(request.template_id),
            team_assignments=request.team_assignments,
            tenderbureau_id=str(request.tenderbureau_id),
            tender_id=str(request.tender_id) if request.tender_id else None,
            include_checklist=request.include_checklist
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Fout bij genereren backplanning: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Er ging iets mis bij het genereren van de back-planning"
        )


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 4. WORKLOAD QUERY
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get(
    "/team/workload",
    response_model=WorkloadResponse,
    summary="Haal workload op voor teamleden",
    description=(
        "Toont het aantal taken per week per teamlid in een periode. "
        "Gebruikt voor workload-indicatoren in de TeamStep."
    )
)
async def get_workload(
    user_ids: str = Query(
        ...,
        description="Komma-gescheiden lijst van user UUIDs"
    ),
    start: date = Query(
        ...,
        description="Startdatum (YYYY-MM-DD)"
    ),
    end: date = Query(
        ...,
        description="Einddatum (YYYY-MM-DD)"
    ),
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter"),
    service: BackplanningService = Depends(get_backplanning_service),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Haal workload data op voor teamleden in een periode."""
    if start > end:
        raise HTTPException(
            status_code=400,
            detail="Startdatum mag niet na einddatum liggen"
        )

    ids = [uid.strip() for uid in user_ids.split(',') if uid.strip()]
    if not ids:
        raise HTTPException(
            status_code=400,
            detail="Minimaal 1 user_id vereist"
        )

    resolved_bureau = await resolve_bureau_id(
        current_user, explicit_bureau_id=tenderbureau_id, db=db
    )

    try:
        result = await service.get_workload(
            user_ids=ids,
            start_date=start,
            end_date=end,
            tenderbureau_id=resolved_bureau
        )
        return {"workload": result}

    except Exception as e:
        logger.error(f"Fout bij ophalen workload: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Er ging iets mis bij het ophalen van de workload"
        )


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 5. PLANNING & CHECKLIST COUNTS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get(
    "/planning-counts",
    summary="Tellingen planning taken & checklist items per tender",
    description=(
        "Retourneert per tender_id het aantal afgeronde en totale "
        "planning taken en checklist items. Gebruikt voor de tellers "
        "op de TenderCards."
    )
)
async def get_all_planning_counts(
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Haal planning & checklist tellingen op voor alle tenders van het bureau."""
    resolved_bureau = await resolve_bureau_id(
        current_user, explicit_bureau_id=tenderbureau_id, db=db
    )

    try:
        counts = {}

        planning = db.table('planning_taken') \
            .select('tender_id, status') \
            .execute()

        for item in (planning.data or []):
            tid = item.get('tender_id')
            if not tid:
                continue
            if tid not in counts:
                counts[tid] = {
                    'planning_done': 0, 'planning_total': 0,
                    'checklist_done': 0, 'checklist_total': 0
                }
            counts[tid]['planning_total'] += 1
            if item.get('status') == 'done':
                counts[tid]['planning_done'] += 1

        checklist = db.table('checklist_items') \
            .select('tender_id, status') \
            .execute()

        for item in (checklist.data or []):
            tid = item.get('tender_id')
            if not tid:
                continue
            if tid not in counts:
                counts[tid] = {
                    'planning_done': 0, 'planning_total': 0,
                    'checklist_done': 0, 'checklist_total': 0
                }
            counts[tid]['checklist_total'] += 1
            if item.get('status') == 'completed':
                counts[tid]['checklist_done'] += 1

        return {"success": True, "data": counts}

    except Exception as e:
        logger.error(f"Fout bij ophalen planning counts: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Fout bij ophalen tellingen"
        )


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 6. TEMPLATE CRUD
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.get(
    "/planning-templates",
    response_model=TemplateListResponse,
    summary="Lijst van templates voor het bureau"
)
async def list_templates(
    type: Optional[str] = Query(
        None,
        pattern='^(planning|checklist)$',
        description="Filter op type"
    ),
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Haal alle templates op voor het huidige bureau."""
    resolved_bureau = await resolve_bureau_id(
        current_user, explicit_bureau_id=tenderbureau_id, db=db
    )

    try:
        query = db.table('planning_templates') \
            .select('*, planning_template_taken(*)') \
            .eq('tenderbureau_id', resolved_bureau) \
            .eq('is_actief', True) \
            .order('naam')

        if type:
            query = query.eq('type', type)

        result = query.execute()
        templates = result.data or []

        response_data = []
        for tmpl in templates:
            taken = tmpl.pop('planning_template_taken', [])
            response_data.append({
                **tmpl,
                'taken': sorted(taken, key=lambda t: t.get('volgorde', 0))
            })

        return {
            "data": response_data,
            "total": len(response_data)
        }

    except Exception as e:
        logger.error(f"Fout bij ophalen templates: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fout bij ophalen templates")


@router.get(
    "/planning-templates/{template_id}",
    response_model=TemplateResponse,
    summary="EÃ©n template met taken ophalen"
)
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Haal een specifiek template op inclusief alle taken."""
    try:
        result = db.table('planning_templates') \
            .select('*, planning_template_taken(*)') \
            .eq('id', template_id) \
            .single() \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        tmpl = result.data
        taken = tmpl.pop('planning_template_taken', [])

        return {
            **tmpl,
            'taken': sorted(taken, key=lambda t: t.get('volgorde', 0))
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij ophalen template {template_id}: {e}")
        raise HTTPException(status_code=500, detail="Fout bij ophalen template")


@router.post(
    "/planning-templates",
    response_model=TemplateResponse,
    status_code=201,
    summary="Nieuw template aanmaken"
)
async def create_template(
    request: TemplateCreateRequest,
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Maak een nieuw planning- of checklist-template aan."""
    resolved_bureau = await resolve_bureau_id(
        current_user, explicit_bureau_id=tenderbureau_id, db=db
    )
    user_id = current_user.get('id')

    try:
        if request.is_standaard:
            db.table('planning_templates') \
                .update({'is_standaard': False}) \
                .eq('tenderbureau_id', resolved_bureau) \
                .eq('type', request.type) \
                .execute()

        result = db.table('planning_templates').insert({
            'tenderbureau_id': resolved_bureau,
            'naam': request.naam,
            'beschrijving': request.beschrijving,
            'type': request.type,
            'is_standaard': request.is_standaard,
            'created_by': user_id
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Template aanmaken mislukt")

        return {**result.data[0], 'taken': []}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij aanmaken template: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fout bij aanmaken template")


@router.put(
    "/planning-templates/{template_id}",
    response_model=TemplateResponse,
    summary="Template updaten"
)
async def update_template(
    template_id: str,
    request: TemplateUpdateRequest,
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Update een bestaand template."""
    resolved_bureau = await resolve_bureau_id(
        current_user, explicit_bureau_id=tenderbureau_id, db=db
    )

    try:
        update_data = {
            k: v for k, v in request.model_dump().items()
            if v is not None
        }

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="Geen velden om te updaten"
            )

        if update_data.get('is_standaard'):
            current = db.table('planning_templates') \
                .select('type') \
                .eq('id', template_id) \
                .single() \
                .execute()

            if current.data:
                db.table('planning_templates') \
                    .update({'is_standaard': False}) \
                    .eq('tenderbureau_id', resolved_bureau) \
                    .eq('type', current.data['type']) \
                    .neq('id', template_id) \
                    .execute()

        result = db.table('planning_templates') \
            .update(update_data) \
            .eq('id', template_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        taken_result = db.table('planning_template_taken') \
            .select('*') \
            .eq('template_id', template_id) \
            .order('volgorde') \
            .execute()

        return {
            **result.data[0],
            'taken': taken_result.data or []
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij updaten template {template_id}: {e}")
        raise HTTPException(status_code=500, detail="Fout bij updaten template")


@router.delete(
    "/planning-templates/{template_id}",
    status_code=204,
    summary="Template verwijderen"
)
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Verwijder een template (taken worden mee-verwijderd via CASCADE)."""
    try:
        result = db.table('planning_templates') \
            .delete() \
            .eq('id', template_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij verwijderen template {template_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Fout bij verwijderen template"
        )


@router.post(
    "/planning-templates/{template_id}/duplicate",
    response_model=TemplateResponse,
    status_code=201,
    summary="Template dupliceren"
)
async def duplicate_template(
    template_id: str,
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """Maak een kopie van een bestaand template inclusief alle taken."""
    resolved_bureau = await resolve_bureau_id(
        current_user, explicit_bureau_id=tenderbureau_id, db=db
    )
    user_id = current_user.get('id')

    try:
        original = db.table('planning_templates') \
            .select('*, planning_template_taken(*)') \
            .eq('id', template_id) \
            .single() \
            .execute()

        if not original.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        orig = original.data
        taken = orig.pop('planning_template_taken', [])

        new_template = db.table('planning_templates').insert({
            'tenderbureau_id': resolved_bureau,
            'naam': f"{orig['naam']} (kopie)",
            'beschrijving': orig.get('beschrijving'),
            'type': orig['type'],
            'is_standaard': False,
            'created_by': user_id
        }).execute()

        if not new_template.data:
            raise HTTPException(status_code=500, detail="Dupliceren mislukt")

        new_id = new_template.data[0]['id']

        new_taken = []
        if taken:
            taken_inserts = [
                {
                    'template_id': new_id,
                    'naam': t['naam'],
                    'beschrijving': t.get('beschrijving'),
                    'rol': t['rol'],
                    't_minus_werkdagen': t['t_minus_werkdagen'],
                    'duur_werkdagen': t.get('duur_werkdagen', 1),
                    'is_mijlpaal': t.get('is_mijlpaal', False),
                    'is_verplicht': t.get('is_verplicht', True),
                    'volgorde': t.get('volgorde', 0)
                }
                for t in sorted(taken, key=lambda x: x.get('volgorde', 0))
            ]
            taken_result = db.table('planning_template_taken') \
                .insert(taken_inserts) \
                .execute()
            new_taken = taken_result.data or []

        return {
            **new_template.data[0],
            'taken': new_taken
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij dupliceren template {template_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Fout bij dupliceren template"
        )


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# 7. TEMPLATE TAKEN BULK UPDATE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

@router.put(
    "/planning-templates/{template_id}/taken",
    response_model=TemplateResponse,
    summary="Alle taken van een template vervangen"
)
async def replace_template_taken(
    template_id: str,
    request: TemplateTakenBulkRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Vervangt alle taken in een template.
    Bestaande taken worden verwijderd en vervangen door de nieuwe lijst.
    """
    try:
        tmpl = db.table('planning_templates') \
            .select('id, tenderbureau_id, naam, beschrijving, type, is_standaard, is_actief') \
            .eq('id', template_id) \
            .single() \
            .execute()

        if not tmpl.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        db.table('planning_template_taken') \
            .delete() \
            .eq('template_id', template_id) \
            .execute()

        taken_inserts = [
            {
                'template_id': template_id,
                'naam': t.naam,
                'beschrijving': t.beschrijving,
                'rol': t.rol,
                't_minus_werkdagen': t.t_minus_werkdagen,
                'duur_werkdagen': t.duur_werkdagen,
                'is_mijlpaal': t.is_mijlpaal,
                'is_verplicht': t.is_verplicht,
                'volgorde': t.volgorde,
                'afhankelijk_van': str(t.afhankelijk_van) if t.afhankelijk_van else None
            }
            for t in request.taken
        ]

        taken_result = db.table('planning_template_taken') \
            .insert(taken_inserts) \
            .execute()

        return {
            **tmpl.data,
            'taken': taken_result.data or []
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fout bij updaten taken voor template {template_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Fout bij updaten template taken"
        )


# ═══════════════════════════════════════════════════
# 8. PLANNING SAVE — Voor SmartImport wizard
# ═══════════════════════════════════════════════════

@router.post("/planning/save", summary="Opslaan planning taken")
async def save_planning(
    request: dict,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Sla planning taken en checklist items op voor een tender.
    
    Request body:
    {
        "tender_id": "uuid",
        "taken": [...],
        "checklist": [...],
        "team_assignments": {...},
        "tenderbureau_id": "uuid"
    }
    """
    try:
        tender_id = request.get('tender_id')
        taken = request.get('taken', [])
        checklist = request.get('checklist', [])
        team_assignments = request.get('team_assignments', {})
        tenderbureau_id = request.get('tenderbureau_id')
        
        if not tender_id:
            raise HTTPException(status_code=400, detail="tender_id is verplicht")
        
        logger.info(f"💾 Opslaan planning voor tender {tender_id}: {len(taken or [])} taken, {len(checklist or [])} checklist items, {len(team_assignments or {})} team assignments")
        
        # ── Stap 1: Planning taken opslaan ──
        # Simpele conversie - verwacht al correct format van BackplanningService
        planning_inserts = []
        for taak in taken:
            # toegewezen_aan komt nu als array van user IDs
            toegewezen = taak.get('toegewezen_aan')
            
            # Ensure het een list is
            if not isinstance(toegewezen, list):
                toegewezen = [toegewezen] if toegewezen else []
            
            planning_inserts.append({
                'tender_id': tender_id,
                'taak_naam': taak.get('naam'),
                'beschrijving': taak.get('beschrijving'),
                'datum': taak.get('datum'),
                'categorie': taak.get('categorie') or taak.get('rol') or 'algemeen',
                'toegewezen_aan': toegewezen,  # Al correct format: ["uuid"]
                'is_milestone': taak.get('is_mijlpaal', False),
                'volgorde': taak.get('volgorde', 0),
                'status': 'todo',
                'tenderbureau_id': tenderbureau_id
            })

        # ── Stap 2: Checklist items opslaan ──
        checklist_inserts = []

        # Insert planning taken (NA de loop!)
        if planning_inserts:
            logger.info(f"💾 Planning inserts array bevat: {len(planning_inserts)} items")
            logger.info(f"🔍 Eerste 3 taken: {[p.get('taak_naam') for p in planning_inserts[:3]]}")
            
            db.table('planning_taken').insert(planning_inserts).execute()
            
            # Check hoeveel er echt in DB zijn gekomen
            verify = db.table('planning_taken').select('id').eq('tender_id', tender_id).execute()
            logger.info(f"✅ {len(planning_inserts)} taken VERSTUURD, {len(verify.data)} in DATABASE")

        # Checklist loop
        for item in checklist:
            toegewezen = item.get('toegewezen_aan')
            
            # Ensure het een list is
            if not isinstance(toegewezen, list):
                toegewezen = [toegewezen] if toegewezen else []
            
            checklist_inserts.append({
                'tender_id': tender_id,
                'taak_naam': item.get('naam'),
                'beschrijving': item.get('beschrijving'),
                'sectie': item.get('categorie') or item.get('sectie') or 'algemeen',
                'deadline': item.get('datum') or item.get('deadline'),
                'verantwoordelijke_data': toegewezen,  # Al correct format: ["uuid"]
                'is_verplicht': item.get('is_verplicht', True),
                'volgorde': item.get('volgorde', 0),
                'status': 'pending',
                'tenderbureau_id': tenderbureau_id
            })

        if checklist_inserts:
            db.table('checklist_items').insert(checklist_inserts).execute()
            logger.info(f"✅ {len(checklist_inserts)} checklist items opgeslagen")
                      
        # ── Stap 3: Team assignments opslaan ──
        # FIX v3.8: Robuuste validatie + error handling
        team_saved = 0
        if team_assignments:
            team_inserts = []
            for rol, user_id in team_assignments.items():
                if not user_id:
                    continue
                
                # Validate dat user_id bestaat in users tabel
                try:
                    user_check = db.table('users').select('id').eq('id', user_id).execute()
                    if not user_check.data or len(user_check.data) == 0:
                        logger.warning(f"⚠️ User {user_id} niet in users tabel - skip '{rol}'")
                        continue
                except Exception as check_err:
                    logger.warning(f"⚠️ Validatie user {user_id} gefaald: {check_err} - skip '{rol}'")
                    continue
                
                team_inserts.append({
                    'tender_id': tender_id,
                    'user_id': user_id,
                    'rol_in_tender': rol
                })
            
            if team_inserts:
                try:
                    # Verwijder bestaande assignments eerst
                    db.table('tender_team_assignments').delete().eq('tender_id', tender_id).execute()
                    db.table('tender_team_assignments').insert(team_inserts).execute()
                    team_saved = len(team_inserts)
                    logger.info(f"✅ {team_saved} team assignments opgeslagen")
                except Exception as team_err:
                    logger.error(f"❌ Team assignments opslaan gefaald: {team_err}")
                    # Don't raise - planning en checklist zijn al opgeslagen
        
        return {
            "success": True,
            "planning_count": len(planning_inserts),
            "checklist_count": len(checklist_inserts),
            "team_count": team_saved
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Fout bij opslaan planning: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Fout bij opslaan planning: {str(e)}")