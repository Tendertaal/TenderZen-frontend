# ================================================================
# TenderZen — Planning Router
# Backend/app/routers/planning_router.py
# Datum: 2026-02-09 (v2 — import fix)
# ================================================================
#
# FastAPI endpoints voor:
# - POST /planning/generate-backplanning
# - GET  /team/workload
# - GET/POST/PUT/DELETE /planning-templates
#
# Registratie in main.py:
#   from app.routers.planning_router import router as planning_router
#   app.include_router(planning_router, prefix="/api/v1")
# ================================================================

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from datetime import date
import logging

from app.core.database import get_supabase
from app.core.dependencies import get_current_user
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


# ════════════════════════════════════════════════
# DEPENDENCY: BackplanningService
# ════════════════════════════════════════════════

def get_backplanning_service():
    """Dependency injection voor BackplanningService."""
    db = get_supabase()
    return BackplanningService(db)


# ════════════════════════════════════════════════
# 1. TEAM MEMBERS — Teamleden ophalen per bureau
# ════════════════════════════════════════════════

@router.get(
    "/team-members",
    summary="Haal teamleden op voor het bureau",
    description="Retourneert alle actieve teamleden van het huidige bureau."
)
async def get_team_members(
    tenderbureau_id: Optional[str] = Query(None, description="Override bureau ID"),
    current_user: dict = Depends(get_current_user)
):
    """Haal alle teamleden op voor het bureau van de ingelogde gebruiker."""
    bureau_id = tenderbureau_id or current_user.get('tenderbureau_id')
    db = get_supabase()

    try:
        # Als geen bureau_id (super_admin in "Alle bureau's" modus),
        # pak het bureau van de tender via de wizard state
        if not bureau_id:
            # Fallback: haal alle access records op voor deze user
            # en gebruik het eerste bureau
            user_id = current_user.get('id') or current_user.get('sub')
            if user_id:
                access_result = db.table('user_bureau_access') \
                    .select('tenderbureau_id') \
                    .eq('user_id', user_id) \
                    .eq('is_active', True) \
                    .limit(1) \
                    .execute()
                if access_result.data:
                    bureau_id = access_result.data[0]['tenderbureau_id']

        if not bureau_id:
            return {"data": []}

        # Stap 1: Haal access records op
        access_result = db.table('user_bureau_access') \
            .select('id, user_id, role, functie_titel, avatar_kleur, capaciteit_uren_per_week') \
            .eq('tenderbureau_id', bureau_id) \
            .eq('is_active', True) \
            .order('role') \
            .execute()

        access_records = access_result.data or []
        if not access_records:
            return {"data": []}

        # Stap 2: Haal user details op
        user_ids = [r['user_id'] for r in access_records if r.get('user_id')]
        users_map = {}
        if user_ids:
            users_result = db.table('users') \
                .select('id, email, naam, avatar_url') \
                .in_('id', user_ids) \
                .execute()
            for u in (users_result.data or []):
                users_map[u['id']] = u

        # Stap 3: Combineer
        members = []
        for item in access_records:
            user = users_map.get(item.get('user_id'), {})
            naam = user.get('naam') or user.get('email', '?').split('@')[0]
            initialen = ''.join(
                w[0].upper() for w in naam.split()[:2]
            ) if naam else '?'

            members.append({
                'id': item.get('user_id'),
                'access_id': item.get('id'),
                'naam': naam,
                'email': user.get('email'),
                'avatar_url': user.get('avatar_url'),
                'avatar_kleur': item.get('avatar_kleur'),
                'rol': item.get('role'),
                'functie_titel': item.get('functie_titel'),
                'capaciteit_uren_per_week': item.get('capaciteit_uren_per_week'),
                'initialen': initialen
            })

        return {"data": members}

    except Exception as e:
        logger.error(f"Fout bij ophalen teamleden: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Fout bij ophalen teamleden"
        )


# ════════════════════════════════════════════════
# 2. AGENDA — Cross-tender overzicht (AgendaView)
# ════════════════════════════════════════════════

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
    current_user: dict = Depends(get_current_user)
):
    """Haal agenda data op: alle taken over alle tenders voor het bureau."""
    db = get_supabase()

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
            c['start_datum'] = c.get('deadline')  # Normaliseer veldnaam
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
        tenderbureau_id = current_user.get('tenderbureau_id')
        if tenderbureau_id:
            team_result = db.table('gebruikers') \
                .select('id, naam, email, rol, avatar_url') \
                .eq('tenderbureau_id', tenderbureau_id) \
                .eq('actief', True) \
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


# ════════════════════════════════════════════════
# 2. BACK-PLANNING GENERATIE
# ════════════════════════════════════════════════

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
    - **team_assignments**: Mapping van rol → user_id
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


# ════════════════════════════════════════════════
# 2. WORKLOAD QUERY
# ════════════════════════════════════════════════

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
    service: BackplanningService = Depends(get_backplanning_service),
    current_user: dict = Depends(get_current_user)
):
    """Haal workload data op voor teamleden in een periode."""
    if start > end:
        raise HTTPException(
            status_code=400,
            detail="Startdatum mag niet na einddatum liggen"
        )

    # Parse user_ids
    ids = [uid.strip() for uid in user_ids.split(',') if uid.strip()]
    if not ids:
        raise HTTPException(
            status_code=400,
            detail="Minimaal 1 user_id vereist"
        )

    tenderbureau_id = current_user.get('tenderbureau_id')
    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen bureau toegang")

    try:
        result = await service.get_workload(
            user_ids=ids,
            start_date=start,
            end_date=end,
            tenderbureau_id=tenderbureau_id
        )
        return {"workload": result}

    except Exception as e:
        logger.error(f"Fout bij ophalen workload: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Er ging iets mis bij het ophalen van de workload"
        )


# ════════════════════════════════════════════════
# 3. PLANNING & CHECKLIST COUNTS
# ════════════════════════════════════════════════

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
    current_user: dict = Depends(get_current_user)
):
    """Haal planning & checklist tellingen op voor alle tenders van het bureau."""
    tenderbureau_id = current_user.get('tenderbureau_id')
    db = get_supabase()

    try:
        counts = {}

        # Planning taken per tender
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

        # Checklist items per tender
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


# ════════════════════════════════════════════════
# 4. TEMPLATE CRUD
# ════════════════════════════════════════════════

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
    current_user: dict = Depends(get_current_user)
):
    """Haal alle templates op voor het huidige bureau."""
    db = get_supabase()
    tenderbureau_id = current_user.get('tenderbureau_id')
    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen bureau toegang")

    try:
        query = db.table('planning_templates') \
            .select('*, planning_template_taken(*)') \
            .eq('tenderbureau_id', tenderbureau_id) \
            .eq('is_actief', True) \
            .order('naam')

        if type:
            query = query.eq('type', type)

        result = query.execute()
        templates = result.data or []

        # Transformeer naar response format
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
    summary="Eén template met taken ophalen"
)
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Haal een specifiek template op inclusief alle taken."""
    db = get_supabase()

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
    current_user: dict = Depends(get_current_user)
):
    """Maak een nieuw planning- of checklist-template aan."""
    db = get_supabase()
    tenderbureau_id = current_user.get('tenderbureau_id')
    user_id = current_user.get('id')

    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen bureau toegang")

    try:
        # Als is_standaard=True, zet andere templates van dit type op false
        if request.is_standaard:
            db.table('planning_templates') \
                .update({'is_standaard': False}) \
                .eq('tenderbureau_id', tenderbureau_id) \
                .eq('type', request.type) \
                .execute()

        result = db.table('planning_templates').insert({
            'tenderbureau_id': tenderbureau_id,
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
    current_user: dict = Depends(get_current_user)
):
    """Update een bestaand template."""
    db = get_supabase()
    tenderbureau_id = current_user.get('tenderbureau_id')

    try:
        # Bouw update dict (alleen meegegeven velden)
        update_data = {
            k: v for k, v in request.model_dump().items()
            if v is not None
        }

        if not update_data:
            raise HTTPException(
                status_code=400,
                detail="Geen velden om te updaten"
            )

        # Als is_standaard=True, zet andere templates op false
        if update_data.get('is_standaard'):
            # Haal type op van het huidige template
            current = db.table('planning_templates') \
                .select('type') \
                .eq('id', template_id) \
                .single() \
                .execute()

            if current.data:
                db.table('planning_templates') \
                    .update({'is_standaard': False}) \
                    .eq('tenderbureau_id', tenderbureau_id) \
                    .eq('type', current.data['type']) \
                    .neq('id', template_id) \
                    .execute()

        result = db.table('planning_templates') \
            .update(update_data) \
            .eq('id', template_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        # Haal taken op voor response
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
    current_user: dict = Depends(get_current_user)
):
    """Verwijder een template (taken worden mee-verwijderd via CASCADE)."""
    db = get_supabase()

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
    current_user: dict = Depends(get_current_user)
):
    """Maak een kopie van een bestaand template inclusief alle taken."""
    db = get_supabase()
    tenderbureau_id = current_user.get('tenderbureau_id')
    user_id = current_user.get('id')

    try:
        # Haal origineel op
        original = db.table('planning_templates') \
            .select('*, planning_template_taken(*)') \
            .eq('id', template_id) \
            .single() \
            .execute()

        if not original.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        orig = original.data
        taken = orig.pop('planning_template_taken', [])

        # Maak kopie van template
        new_template = db.table('planning_templates').insert({
            'tenderbureau_id': tenderbureau_id,
            'naam': f"{orig['naam']} (kopie)",
            'beschrijving': orig.get('beschrijving'),
            'type': orig['type'],
            'is_standaard': False,
            'created_by': user_id
        }).execute()

        if not new_template.data:
            raise HTTPException(status_code=500, detail="Dupliceren mislukt")

        new_id = new_template.data[0]['id']

        # Kopieer taken
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
                    # afhankelijk_van wordt niet gekopieerd (andere UUIDs)
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


# ════════════════════════════════════════════════
# 4. TEMPLATE TAKEN BULK UPDATE
# ════════════════════════════════════════════════

@router.put(
    "/planning-templates/{template_id}/taken",
    response_model=TemplateResponse,
    summary="Alle taken van een template vervangen"
)
async def replace_template_taken(
    template_id: str,
    request: TemplateTakenBulkRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Vervangt alle taken in een template.
    Bestaande taken worden verwijderd en vervangen door de nieuwe lijst.
    """
    db = get_supabase()

    try:
        # Check of template bestaat
        tmpl = db.table('planning_templates') \
            .select('id, tenderbureau_id, naam, beschrijving, type, is_standaard, is_actief') \
            .eq('id', template_id) \
            .single() \
            .execute()

        if not tmpl.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")

        # Verwijder alle bestaande taken
        db.table('planning_template_taken') \
            .delete() \
            .eq('template_id', template_id) \
            .execute()

        # Voeg nieuwe taken toe
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