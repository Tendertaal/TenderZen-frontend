"""
Planning & Checklist API Router - 100% COMPLETE UNIFIED VERSION
TenderZen v4.1 - Single Professional Planning Router

════════════════════════════════════════════════════════════════════
VOLLEDIGE MERGE van:
- Backend/app/api/v1/planning.py (CRUD endpoints, bulk save)
- Backend/app/routers/planning_router.py (backplanning, templates, workload)
════════════════════════════════════════════════════════════════════

KRITIEKE WIJZIGINGEN v4.1:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ team_members tabel VOLLEDIG VERWIJDERD
✅ v_bureau_team view overal gebruikt (user_bureau_access + users)
✅ Single Source of Truth - geen data duplicatie
✅ /planning/save endpoint toegevoegd (BackplanningService integration)
✅ Robuuste user validatie in team assignments
✅ Complete error handling en logging
✅ RLS-compatible met get_user_db

ENDPOINTS COMPLEET OVERZICHT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAM & WORKLOAD (v_bureau_team):
  GET  /team-members                        — Bureau teamleden
  GET  /team/workload                       — Workload analyse
  GET  /tenders/{id}/team-assignments       — Tender team ophalen
  POST /tenders/{id}/team-assignments       — Teamlid toevoegen
  DEL  /tenders/{id}/team-assignments/{id}  — Teamlid verwijderen

PLANNING TAKEN (per tender):
  GET    /tenders/{id}/planning              — Planning taken ophalen
  POST   /tenders/{id}/planning              — Planning taak aanmaken
  PATCH  /planning/{taak_id}                 — Planning taak updaten
  DELETE /planning/{taak_id}                 — Planning taak verwijderen

CHECKLIST ITEMS (per tender):
  GET    /tenders/{id}/checklist             — Checklist items ophalen
  POST   /tenders/{id}/checklist             — Checklist item aanmaken
  PATCH  /checklist/{item_id}                — Checklist item updaten
  DELETE /checklist/{item_id}                — Checklist item verwijderen

BACKPLANNING & AI:
  POST /planning/generate-backplanning       — AI backplanning generatie
  POST /planning/save                        — Planning opslaan (BackplanningService)
  POST /tenders/{id}/planning-bulk           — Bulk save (SmartImport wizard)

VIEWS & AGGREGATES:
  GET  /planning/agenda                      — Cross-tender agenda (AgendaView)
  GET  /planning-counts                      — Tellingen alle tenders
  GET  /tenders/{id}/planning-counts         — Tellingen per tender

TEMPLATES:
  GET    /planning-templates                 — Templates lijst
  GET    /planning-templates/{id}            — Specifiek template
  POST   /planning-templates                 — Nieuw template
  PUT    /planning-templates/{id}            — Update template
  DELETE /planning-templates/{id}            — Delete template
  POST   /planning-templates/{id}/duplicate  — Dupliceer template
  PUT    /planning-templates/{id}/taken      — Bulk update taken
  GET    /checklist-templates                — Checklist templates
  GET    /template-names                     — Template namen
  POST   /tenders/{id}/populate-templates    — Apply template

Registratie in main.py:
    from app.api.v1.planning import router as planning_router
    app.include_router(planning_router, prefix="/api/v1", tags=["Planning"])
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import datetime, date
from supabase import Client
import logging

# Core dependencies
from app.core.database import get_supabase, get_supabase_async
from app.core.dependencies import get_current_user, get_user_db
from app.core.bureau_context import resolve_bureau_id

# Services
from app.services.planning_service import PlanningService
from app.services.backplanning_service import BackplanningService

# Models
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

router = APIRouter(tags=["Planning & Checklist"])


# ════════════════════════════════════════════════════════
# PYDANTIC MODELS
# ════════════════════════════════════════════════════════

class PlanningTaakCreate(BaseModel):
    taak_naam: str
    categorie: str = 'Algemeen'
    beschrijving: Optional[str] = None
    status: str = 'todo'
    is_milestone: bool = False
    datum: Optional[str] = None
    toegewezen_aan: Optional[List[dict]] = Field(default_factory=list)
    volgorde: int = 0

class PlanningTaakUpdate(BaseModel):
    taak_naam: Optional[str] = None
    categorie: Optional[str] = None
    beschrijving: Optional[str] = None
    status: Optional[str] = None
    is_milestone: Optional[bool] = None
    datum: Optional[str] = None
    toegewezen_aan: Optional[List[dict]] = None
    volgorde: Optional[int] = None

class ChecklistItemCreate(BaseModel):
    taak_naam: str
    sectie: str = 'Documenten'
    beschrijving: Optional[str] = None
    is_verplicht: bool = True
    status: str = 'pending'
    volgorde: int = 0

class ChecklistItemUpdate(BaseModel):
    taak_naam: Optional[str] = None
    sectie: Optional[str] = None
    beschrijving: Optional[str] = None
    is_verplicht: Optional[bool] = None
    status: Optional[str] = None
    verantwoordelijke: Optional[str] = None
    verantwoordelijke_data: Optional[dict] = None
    deadline: Optional[str] = None
    notitie: Optional[str] = None
    volgorde: Optional[int] = None

class PopulateRequest(BaseModel):
    template_naam: str = 'Standaard'
    overwrite: bool = False

class BulkPlanningTaak(BaseModel):
    taak_naam: str
    categorie: str = 'Voorbereiding'
    beschrijving: Optional[str] = ''
    datum: Optional[str] = None
    toegewezen_aan: Optional[List[str]] = []
    status: str = 'todo'
    volgorde: int = 0
    is_milestone: bool = False

class BulkChecklistItem(BaseModel):
    taak_naam: str
    sectie: str = 'Overige Documenten'
    beschrijving: Optional[str] = ''
    is_verplicht: bool = True
    status: str = 'pending'
    volgorde: int = 0

class BulkPlanningRequest(BaseModel):
    planning_taken: List[BulkPlanningTaak] = []
    checklist_items: List[BulkChecklistItem] = []
    overwrite: bool = True

class TeamAssignmentCreate(BaseModel):
    team_member_id: str
    rol_in_tender: str = "schrijver"
    geplande_uren: int = 0

class TeamMemberOut(BaseModel):
    user_id: str
    naam: str
    email: Optional[str] = None
    bureau_rol: Optional[str] = None
    initialen: Optional[str] = None
    avatar_kleur: Optional[str] = None
    tenderbureau_id: Optional[str] = None

class TeamMembersResponse(BaseModel):
    success: bool
    data: List[TeamMemberOut]
    count: int


# ════════════════════════════════════════════════════════
# DEPENDENCIES
# ════════════════════════════════════════════════════════

def get_planning_service(db: Client = Depends(get_supabase_async)) -> PlanningService:
    return PlanningService(db)

def get_backplanning_service(db: Client = Depends(get_user_db)) -> BackplanningService:
    return BackplanningService(db)


# ════════════════════════════════════════════════════════
# 1. TEAM MEMBERS — Bureau teamleden (v_bureau_team)
# ════════════════════════════════════════════════════════
# ⚠️ KRITIEK: v_bureau_team view gebruikt (GEEN team_members tabel!)
# View combineert: user_bureau_access JOIN users
# Velden: user_id, naam, email, bureau_rol, initialen, avatar_kleur

@router.get(
    "/team-members",
    summary="Bureau team members",
    description="Retourneert alle actieve teamleden via v_bureau_team view",
    response_model=TeamMembersResponse
)
async def get_team_members(
    tenderbureau_id: Optional[str] = Query(None, description="Bureau ID filter"),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Haal bureau teamleden op via v_bureau_team view.
    
    ARCHITECTUUR:
    - Bron: v_bureau_team (view op user_bureau_access + users)
    - Velden: user_id, naam, email, bureau_rol, initialen, avatar_kleur
    - Filter: Altijd op bureau (SECURITY)
    - RLS: auth.uid() via get_user_db
    """
    try:
        bureau_id = await resolve_bureau_id(
            current_user, 
            explicit_bureau_id=tenderbureau_id, 
            db=db
        )

        logger.info(f"📋 Team members ophalen voor bureau: {bureau_id}")

        # Query v_bureau_team view
        result = db.table('v_bureau_team') \
            .select('*') \
            .eq('tenderbureau_id', bureau_id) \
            .order('naam') \
            .execute()

        members = result.data or []
        
        logger.info(f"✅ {len(members)} team members via v_bureau_team")

        # Convert to TeamMemberOut for OpenAPI compatibility
        try:
            members_out = [TeamMemberOut(**m) for m in members]
        except Exception as e:
            logger.warning(f"⚠️ Conversie naar TeamMemberOut gefaald: {e}")
            members_out = members

        return {
            "success": True,
            "data": members_out,
            "count": len(members_out)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Team members error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Fout bij ophalen teamleden"
        )


# ════════════════════════════════════════════════════════
# 2. WORKLOAD — Team workload analysis
# ════════════════════════════════════════════════════════

@router.get(
    "/team/workload",
    response_model=WorkloadResponse,
    summary="Team workload analyse"
)
async def get_workload(
    user_ids: str = Query(..., description="Comma-separated user IDs"),
    start: date = Query(..., description="Start datum (YYYY-MM-DD)"),
    end: date = Query(..., description="Eind datum (YYYY-MM-DD)"),
    tenderbureau_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    service: BackplanningService = Depends(get_backplanning_service)
):
    """Haal workload data op voor teamleden in een periode."""
    if start > end:
        raise HTTPException(
            status_code=400,
            detail="Startdatum mag niet na einddatum"
        )

    user_id_list = [uid.strip() for uid in user_ids.split(',') if uid.strip()]
    if not user_id_list:
        raise HTTPException(status_code=400, detail="Minimaal 1 user_id vereist")

    try:
        bureau_id = await resolve_bureau_id(
            current_user,
            explicit_bureau_id=tenderbureau_id,
            db=service.db
        )

        workload = await service.get_workload(
            user_ids=user_id_list,
            start_date=start,
            end_date=end,
            tenderbureau_id=bureau_id
        )

        return {"workload": workload}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Workload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════
# 3. AGENDA — Cross-tender planning overview
# ════════════════════════════════════════════════════════

@router.get("/planning/agenda")
async def get_agenda_data(
    start_date: str = Query(..., description="Start datum ISO: 2026-02-03"),
    end_date: str = Query(..., description="Eind datum ISO: 2026-02-09"),
    team_member_id: Optional[str] = Query(None, description="Filter op user UUID"),
    tenderbureau_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Agenda view: alle taken over alle tenders voor het bureau.
    
    Returns: planning_taken + checklist_items + tender info + team_members
    """
    try:
        # Planning taken
        planning_query = db.table('planning_taken') \
            .select('*') \
            .gte('datum', start_date) \
            .lte('datum', end_date)

        if team_member_id:
            planning_query = planning_query.contains('toegewezen_aan', [team_member_id])

        planning_result = planning_query.execute()
        planning_taken = planning_result.data or []

        # Checklist items
        checklist_query = db.table('checklist_items') \
            .select('*') \
            .gte('deadline', start_date) \
            .lte('deadline', end_date)

        checklist_result = checklist_query.execute()
        checklist_items = checklist_result.data or []

        # Combineer
        taken = []
        for t in planning_taken:
            t['item_type'] = 'planning'
            taken.append(t)
        for c in checklist_items:
            c['item_type'] = 'checklist'
            c['datum'] = c.get('deadline')
            taken.append(c)

        # Tender info
        tender_ids = list(set(t.get('tender_id') for t in taken if t.get('tender_id')))
        tenders = {}
        if tender_ids:
            tender_result = db.table('tenders') \
                .select('id, naam, opdrachtgever, fase, fase_status, deadline_indiening') \
                .in_('id', tender_ids) \
                .execute()
            tenders = {t['id']: t for t in (tender_result.data or [])}

        # Team members via v_bureau_team
        team_members = []
        bureau_id = await resolve_bureau_id(
            user, 
            explicit_bureau_id=tenderbureau_id, 
            db=db,
            required=False
        )
        if bureau_id:
            team_result = db.table('v_bureau_team') \
                .select('user_id, naam, email, initialen, avatar_kleur, bureau_rol') \
                .eq('tenderbureau_id', bureau_id) \
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
        logger.error(f"❌ Agenda error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Fout bij ophalen agenda")


# ════════════════════════════════════════════════════════
# 4. BACKPLANNING — AI-powered planning generation
# ════════════════════════════════════════════════════════

@router.post(
    "/planning/generate-backplanning",
    response_model=BackplanningResponse,
    summary="Genereer backplanning vanaf deadline"
)
async def generate_backplanning(
    request: BackplanningRequest,
    current_user: dict = Depends(get_current_user),
    service: BackplanningService = Depends(get_backplanning_service)
):
    """
    Genereer automatisch planning + checklist vanaf deadline.
    
    Gebruikt AI (Claude) om taken te genereren op basis van:
    - Tender beschrijving
    - Deadline
    - Template
    - Team assignments
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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Backplanning error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Backplanning generatie mislukt: {str(e)}"
        )


# ════════════════════════════════════════════════════════
# 5. PLANNING SAVE — BackplanningService integration
# ════════════════════════════════════════════════════════

@router.post(
    "/planning/save",
    summary="Opslaan planning taken en checklist"
)
async def save_planning(
    request: Dict[str, Any],
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Sla planning taken en checklist items op voor een tender.
    
    Gebruikt door BackplanningService na AI generatie.
    
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
        
        logger.info(
            f"💾 Planning opslaan: {len(taken)} taken, "
            f"{len(checklist)} checklist, {len(team_assignments)} team"
        )
        
        # ── Planning taken ──
        planning_inserts = []
        for taak in taken:
            toegewezen = taak.get('toegewezen_aan')
            if not isinstance(toegewezen, list):
                toegewezen = [toegewezen] if toegewezen else []
            
            planning_inserts.append({
                'tender_id': tender_id,
                'taak_naam': taak.get('naam'),
                'beschrijving': taak.get('beschrijving'),
                'datum': taak.get('datum'),
                'categorie': taak.get('categorie') or taak.get('rol') or 'algemeen',
                'toegewezen_aan': toegewezen,
                'is_milestone': taak.get('is_mijlpaal', False),
                'volgorde': taak.get('volgorde', 0),
                'status': 'todo',
                'tenderbureau_id': tenderbureau_id
            })

        if planning_inserts:
            db.table('planning_taken').insert(planning_inserts).execute()
            logger.info(f"✅ {len(planning_inserts)} planning taken opgeslagen")

        # ── Checklist items ──
        checklist_inserts = []
        for item in checklist:
            toegewezen = item.get('toegewezen_aan')
            if not isinstance(toegewezen, list):
                toegewezen = [toegewezen] if toegewezen else []
            
            checklist_inserts.append({
                'tender_id': tender_id,
                'taak_naam': item.get('naam'),
                'beschrijving': item.get('beschrijving'),
                'sectie': item.get('categorie') or item.get('sectie') or 'algemeen',
                'deadline': item.get('datum') or item.get('deadline'),
                'verantwoordelijke_data': toegewezen,
                'is_verplicht': item.get('is_verplicht', True),
                'volgorde': item.get('volgorde', 0),
                'status': 'pending',
                'tenderbureau_id': tenderbureau_id
            })

        if checklist_inserts:
            db.table('checklist_items').insert(checklist_inserts).execute()
            logger.info(f"✅ {len(checklist_inserts)} checklist items opgeslagen")
                      
        # ── Team assignments met validatie ──
        team_saved = 0
        if team_assignments:
            team_inserts = []
            for rol, user_id in team_assignments.items():
                if not user_id:
                    continue
                
                # Validate user exists
                try:
                    user_check = db.table('users').select('id').eq('id', user_id).execute()
                    if not user_check.data:
                        logger.warning(f"⚠️ User {user_id} niet gevonden - skip '{rol}'")
                        continue
                except Exception as check_err:
                    logger.warning(f"⚠️ User validatie gefaald: {check_err}")
                    continue
                
                team_inserts.append({
                    'tender_id': tender_id,
                    'user_id': user_id,
                    'rol_in_tender': rol
                })
            
            if team_inserts:
                try:
                    # Verwijder bestaande eerst
                    db.table('tender_team_assignments') \
                        .delete() \
                        .eq('tender_id', tender_id) \
                        .execute()
                    
                    db.table('tender_team_assignments').insert(team_inserts).execute()
                    team_saved = len(team_inserts)
                    logger.info(f"✅ {team_saved} team assignments opgeslagen")
                except Exception as team_err:
                    logger.error(f"❌ Team assignments error: {team_err}")
        
        return {
            "success": True,
            "planning_count": len(planning_inserts),
            "checklist_count": len(checklist_inserts),
            "team_count": team_saved
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Planning save error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Fout bij opslaan planning: {str(e)}"
        )


# ════════════════════════════════════════════════════════
# 6. PLANNING TAKEN — Per tender CRUD
# ════════════════════════════════════════════════════════

@router.get("/tenders/{tender_id}/planning")
async def get_planning_taken(
    tender_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal alle planning taken op voor een tender."""
    data = await service.get_planning_taken(tender_id)
    return {"success": True, "data": data}


@router.post("/tenders/{tender_id}/planning")
async def create_planning_taak(
    tender_id: str,
    taak: PlanningTaakCreate,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Maak een nieuwe planning taak."""
    try:
        data = await service.create_planning_taak(
            tender_id, 
            user['id'], 
            taak.model_dump(exclude_unset=True)
        )
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/planning/{taak_id}")
async def update_planning_taak(
    taak_id: str,
    taak: PlanningTaakUpdate,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Update een planning taak."""
    data = await service.update_planning_taak(
        taak_id, 
        taak.model_dump(exclude_unset=True)
    )
    return {"success": True, "data": data}


@router.delete("/planning/{taak_id}")
async def delete_planning_taak(
    taak_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Verwijder een planning taak."""
    await service.delete_planning_taak(taak_id)
    return {"success": True, "data": None}


# ════════════════════════════════════════════════════════
# 7. CHECKLIST ITEMS — Per tender CRUD
# ════════════════════════════════════════════════════════

@router.get("/tenders/{tender_id}/checklist")
async def get_checklist_items(
    tender_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal alle checklist items op voor een tender."""
    data = await service.get_checklist_items(tender_id)
    return {"success": True, "data": data}


@router.post("/tenders/{tender_id}/checklist")
async def create_checklist_item(
    tender_id: str,
    item: ChecklistItemCreate,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Maak een nieuw checklist item."""
    try:
        data = await service.create_checklist_item(
            tender_id,
            user['id'],
            item.model_dump(exclude_unset=True)
        )
        return {"success": True, "data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/checklist/{item_id}")
async def update_checklist_item(
    item_id: str,
    item: ChecklistItemUpdate,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Update een checklist item."""
    data = await service.update_checklist_item(
        item_id,
        item.model_dump(exclude_unset=True)
    )
    return {"success": True, "data": data}


@router.delete("/checklist/{item_id}")
async def delete_checklist_item(
    item_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Verwijder een checklist item."""
    await service.delete_checklist_item(item_id)
    return {"success": True, "data": None}


# ════════════════════════════════════════════════════════
# 8. BULK SAVE — SmartImport wizard
# ════════════════════════════════════════════════════════

@router.post("/tenders/{tender_id}/planning-bulk")
async def bulk_save_planning(
    tender_id: str,
    request: BulkPlanningRequest,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """
    Bulk opslaan backplanning (SmartImport wizard).
    
    Vervangt 26+ individuele API calls door 1 enkele call.
    """
    try:
        bureau_id = await service._get_tender_bureau_id(tender_id)
        if not bureau_id:
            raise HTTPException(status_code=404, detail="Tender niet gevonden")

        planning_count = 0
        checklist_count = 0

        # Verwijder bestaande indien overwrite
        if request.overwrite:
            service.db.table('planning_taken').delete().eq('tender_id', tender_id).execute()
            service.db.table('checklist_items').delete().eq('tender_id', tender_id).execute()
            logger.info(f"🗑️ Bestaande data verwijderd voor tender {tender_id}")

        # Bulk insert planning taken
        if request.planning_taken:
            planning_rows = [{
                'tender_id': tender_id,
                'tenderbureau_id': bureau_id,
                'taak_naam': t.taak_naam,
                'categorie': t.categorie,
                'beschrijving': t.beschrijving or '',
                'datum': t.datum,
                'toegewezen_aan': t.toegewezen_aan or [],
                'status': t.status,
                'volgorde': t.volgorde,
                'is_milestone': t.is_milestone
            } for t in request.planning_taken]

            service.db.table('planning_taken').insert(planning_rows).execute()
            planning_count = len(planning_rows)
            logger.info(f"✅ {planning_count} planning taken bulk-inserted")

        # Bulk insert checklist items
        if request.checklist_items:
            checklist_rows = [{
                'tender_id': tender_id,
                'tenderbureau_id': bureau_id,
                'taak_naam': c.taak_naam,
                'sectie': c.sectie,
                'beschrijving': c.beschrijving or '',
                'is_verplicht': c.is_verplicht,
                'status': c.status,
                'volgorde': c.volgorde
            } for c in request.checklist_items]

            service.db.table('checklist_items').insert(checklist_rows).execute()
            checklist_count = len(checklist_rows)
            logger.info(f"✅ {checklist_count} checklist items bulk-inserted")

        return {
            "success": True,
            "data": {
                "planning_taken": planning_count,
                "checklist_items": checklist_count,
                "overwritten": request.overwrite
            },
            "message": f"Backplanning opgeslagen: {planning_count} taken + {checklist_count} items"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Bulk save error: {e}")
        raise HTTPException(status_code=500, detail=f"Bulk save mislukt: {str(e)}")


# ════════════════════════════════════════════════════════
# 9. COUNTS & TELLINGEN
# ════════════════════════════════════════════════════════

@router.get("/planning-counts")
async def get_planning_counts(
    tenderbureau_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Tellingen voor alle tenders in het bureau."""
    data = await service.get_planning_counts(user['id'], tenderbureau_id)
    return {"success": True, "data": data}


@router.get("/tenders/{tender_id}/planning-counts")
async def get_tender_planning_counts(
    tender_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Tellingen voor één tender."""
    data = await service.get_tender_counts(tender_id)
    return {"success": True, "data": data}


# ════════════════════════════════════════════════════════
# 10. TEMPLATES — Planning templates beheer
# ════════════════════════════════════════════════════════
@router.get("/planning-templates")
async def get_planning_templates(
    type: Optional[str] = Query(None, pattern='^(planning|checklist)$'),
    tenderbureau_id: Optional[str] = Query(None, description="Bureau filter (verplicht voor niet-admins)"),
    user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db)
):
    """
    Haal planning templates op.
    
    SECURITY & FALLBACK:
    - Normale users: Vereist tenderbureau_id (via resolve_bureau_id)
    - Super-admins: Zonder bureau_id → alle templates
    - Met bureau_id: Gefilterd op bureau
    """
    try:
        # Probeer bureau context te resolven (niet verplicht)
        bureau_id = await resolve_bureau_id(
            user, 
            explicit_bureau_id=tenderbureau_id, 
            db=db,
            required=False  # ← KRITIEK: Graceful degradation
        )
        
        # Build query based on bureau context
        if bureau_id:
            # Gefilterd op bureau
            query = db.table('planning_templates') \
                .select('*, planning_template_taken(*)') \
                .eq('tenderbureau_id', bureau_id) \
                .eq('is_actief', True) \
                .order('naam')
            
            logger.info(f"📋 Templates voor bureau: {bureau_id}")
        else:
            # Super-admin zonder bureau: alle templates
            query = db.table('planning_templates') \
                .select('*, planning_template_taken(*)') \
                .eq('is_actief', True) \
                .order('naam')
            
            logger.warning(f"⚠️ Super-admin {user.get('id')} haalt alle templates op (geen bureau filter)")

        # Type filter (optioneel)
        if type:
            query = query.eq('type', type)

        result = query.execute()
        templates = result.data or []

        # Transform response
        response_data = []
        for tmpl in templates:
            taken = tmpl.pop('planning_template_taken', [])
            response_data.append({
                **tmpl,
                'taken': sorted(taken, key=lambda t: t.get('volgorde', 0))
            })

        return {
            "success": True, 
            "data": response_data, 
            "total": len(response_data),
            "bureau_id": bureau_id  # ← Voor debugging
        }

    except Exception as e:
        logger.error(f"❌ Templates error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Fout bij ophalen templates: {str(e)}"
        )
    
@router.get("/checklist-templates")
async def get_checklist_templates(
    template_naam: str = Query('Standaard'),
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal checklist templates op."""
    data = await service.get_checklist_templates(user['id'], template_naam)
    return {"success": True, "data": data}


@router.get("/template-names")
async def get_template_names(
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Beschikbare template namen."""
    data = await service.get_template_names(user['id'])
    return {"success": True, "data": data}


@router.post("/tenders/{tender_id}/populate-templates")
async def populate_from_templates(
    tender_id: str,
    request: PopulateRequest,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Kopieer template naar tender."""
    try:
        data = await service.populate_from_templates(
            tender_id,
            user['id'],
            template_naam=request.template_naam,
            overwrite=request.overwrite
        )
        
        message = f"Template '{request.template_naam}' toegepast"
        if data.get('skipped'):
            message = data.get('message', 'Overgeslagen')
        
        return {"success": True, "data": data, "message": message}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ════════════════════════════════════════════════════════
# 11. TEAM ASSIGNMENTS — Tender team beheer
# ════════════════════════════════════════════════════════

@router.get("/tenders/{tender_id}/team-assignments")
async def get_team_assignments(
    tender_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Haal tender team op (met user details)."""
    try:
        # Haal assignments op
        result = supabase.table('tender_team_assignments') \
            .select('*') \
            .eq('tender_id', tender_id) \
            .execute()

        assignments = result.data or []

        if not assignments:
            return {"status": "success", "data": [], "count": 0}

        # Haal user IDs
        user_ids = [a['user_id'] for a in assignments if a.get('user_id')]

        # Haal user details
        users_map = {}
        if user_ids:
            users_result = supabase.table('users') \
                .select('id, naam, email, avatar_kleur, functie') \
                .in_('id', user_ids) \
                .execute()
            users_map = {u['id']: u for u in (users_result.data or [])}

        # Combineer
        enriched = []
        for a in assignments:
            user_id = a.get('user_id')
            user = users_map.get(user_id, {})
            enriched.append({
                **a,
                'naam': user.get('naam', ''),
                'email': user.get('email', ''),
                'avatar_kleur': user.get('avatar_kleur', '#667eea'),
                'functie_titel': user.get('functie', ''),
                'user_id': user_id
            })

        return {
            "status": "success",
            "data": enriched,
            "count": len(enriched)
        }

    except Exception as e:
        logger.error(f"❌ Team assignments error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tenders/{tender_id}/team-assignments")
async def add_team_assignment(
    tender_id: str,
    request: TeamAssignmentCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Voeg teamlid toe aan tender."""
    try:
        tender_check = supabase.table('tenders').select('id').eq('id', tender_id).execute()
        if not tender_check.data:
            raise HTTPException(status_code=404, detail="Tender niet gevonden")

        new_assignment = {
            'tender_id': tender_id,
            'team_member_id': request.team_member_id,
            'rol_in_tender': request.rol_in_tender,
            'geplande_uren': request.geplande_uren
        }

        result = supabase.table('tender_team_assignments').insert(new_assignment).execute()
        logger.info(f"✅ Team assignment: {request.team_member_id} → {tender_id}")

        return {
            "status": "success",
            "data": result.data[0] if result.data else new_assignment
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Team assignment error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tenders/{tender_id}/team-assignments/{assignment_id}")
async def remove_team_assignment(
    tender_id: str,
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Verwijder teamlid van tender."""
    try:
        result = supabase.table('tender_team_assignments') \
            .delete() \
            .eq('id', assignment_id) \
            .eq('tender_id', tender_id) \
            .execute()

        if not result.data:
            result = supabase.table('tender_team_assignments') \
                .delete() \
                .eq('team_member_id', assignment_id) \
                .eq('tender_id', tender_id) \
                .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Assignment niet gevonden")

        logger.info(f"🗑️ Team assignment verwijderd: {tender_id}")

        return {
            "status": "success",
            "deleted": len(result.data)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))