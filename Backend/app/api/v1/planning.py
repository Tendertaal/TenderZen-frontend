"""
Planning & Checklist API Router
TenderZen v3.2 — Fix: datum veld als str i.p.v. datetime (voorkomt Pydantic validatie 500)

Endpoints:
- GET             /api/v1/planning/agenda                — Agenda data (alle taken over alle tenders)
- GET/POST       /api/v1/tenders/{id}/planning         — Planning taken per tender
- PATCH/DELETE    /api/v1/planning/{taak_id}            — Individuele taak
- GET/POST       /api/v1/tenders/{id}/checklist         — Checklist items per tender
- PATCH/DELETE    /api/v1/checklist/{item_id}            — Individueel item
- GET             /api/v1/planning-counts                — Tellingen alle tenders
- GET             /api/v1/tenders/{id}/planning-counts   — Tellingen per tender
- POST            /api/v1/tenders/{id}/populate-templates — Auto-populate vanuit templates
- GET             /api/v1/planning-templates              — Templates ophalen
- GET             /api/v1/checklist-templates             — Checklist templates ophalen
- GET             /api/v1/template-names                  — Beschikbare template namen

INSTALLATIE:
1. Kopieer naar Backend/app/api/v1/planning.py
2. Voeg toe aan main.py:
   from app.api.v1.planning import router as planning_router
   app.include_router(planning_router, prefix="/api/v1")
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime
from supabase import Client

from app.core.dependencies import get_current_user
from app.core.database import get_supabase_async
from app.services.planning_service import PlanningService

router = APIRouter(tags=["Planning & Checklist"])


# ============================================
# PYDANTIC MODELS
# ============================================

class PlanningTaakCreate(BaseModel):
    taak_naam: str
    categorie: str = 'Algemeen'
    beschrijving: Optional[str] = None
    status: str = 'todo'
    is_milestone: bool = False
    datum: Optional[str] = None          # ⭐ str i.p.v. datetime — accepteert "2026-02-05" én "2026-02-05T00:00:00"
    toegewezen_aan: Optional[List[dict]] = Field(default_factory=list)
    volgorde: int = 0

class PlanningTaakUpdate(BaseModel):
    taak_naam: Optional[str] = None
    categorie: Optional[str] = None
    beschrijving: Optional[str] = None
    status: Optional[str] = None
    is_milestone: Optional[bool] = None
    datum: Optional[str] = None          # ⭐ str i.p.v. datetime — voorkomt Pydantic validatie error
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

class ApiResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: Optional[str] = None


# ============================================
# HELPER: PlanningService instantie
# ============================================

def get_planning_service(db: Client = Depends(get_supabase_async)) -> PlanningService:
    return PlanningService(db)


# ============================================
# ⭐ AGENDA — Alle taken over alle tenders
# BELANGRIJK: Dit endpoint MOET BOVEN /planning/{taak_id} staan!
# Anders matcht FastAPI "agenda" als een taak_id.
# ============================================

@router.get("/planning/agenda")
async def get_agenda_data(
    start_date: str = Query(..., description="Start datum ISO format: 2026-02-03"),
    end_date: str = Query(..., description="Eind datum ISO format: 2026-02-09"),
    team_member_id: Optional[str] = Query(None, description="Filter op teamlid UUID"),
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """
    Haal agenda data op: alle taken over alle tenders voor het bureau.
    Retourneert planning_taken + checklist_items + tender info + team_members.
    """
    try:
        data = await service.get_agenda_data(
            user_id=user['id'],
            start_date=start_date,
            end_date=end_date,
            team_member_id=team_member_id
        )
        return {"success": True, "data": data}
    except Exception as e:
        print(f"❌ Agenda data error: {e}")
        return {"success": False, "error": str(e)}


# ============================================
# PLANNING TAKEN — per tender
# ============================================

@router.get("/tenders/{tender_id}/planning")
async def get_planning_taken(
    tender_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal alle planning taken op voor een tender"""
    data = await service.get_planning_taken(tender_id)
    return {"success": True, "data": data}


@router.post("/tenders/{tender_id}/planning")
async def create_planning_taak(
    tender_id: str,
    taak: PlanningTaakCreate,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Maak een nieuwe planning taak"""
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
    """Update een planning taak"""
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
    """Verwijder een planning taak"""
    await service.delete_planning_taak(taak_id)
    return {"success": True, "data": None}


# ============================================
# CHECKLIST ITEMS — per tender
# ============================================

@router.get("/tenders/{tender_id}/checklist")
async def get_checklist_items(
    tender_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal alle checklist items op voor een tender"""
    data = await service.get_checklist_items(tender_id)
    return {"success": True, "data": data}


@router.post("/tenders/{tender_id}/checklist")
async def create_checklist_item(
    tender_id: str,
    item: ChecklistItemCreate,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Maak een nieuw checklist item"""
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
    """Update een checklist item"""
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
    """Verwijder een checklist item"""
    await service.delete_checklist_item(item_id)
    return {"success": True, "data": None}


# ============================================
# TELLINGEN
# ============================================

@router.get("/planning-counts")
async def get_planning_counts(
    tenderbureau_id: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal tellingen op voor alle tenders in het bureau"""
    data = await service.get_planning_counts(user['id'], tenderbureau_id)
    return {"success": True, "data": data}


@router.get("/tenders/{tender_id}/planning-counts")
async def get_tender_planning_counts(
    tender_id: str,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal tellingen op voor één tender"""
    data = await service.get_tender_counts(tender_id)
    return {"success": True, "data": data}


# ============================================
# TEMPLATES
# ============================================

@router.get("/planning-templates")
async def get_planning_templates(
    template_naam: str = Query('Standaard'),
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal planning templates op voor het bureau"""
    data = await service.get_planning_templates(user['id'], template_naam)
    return {"success": True, "data": data}


@router.get("/checklist-templates")
async def get_checklist_templates(
    template_naam: str = Query('Standaard'),
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal checklist templates op voor het bureau"""
    data = await service.get_checklist_templates(user['id'], template_naam)
    return {"success": True, "data": data}


@router.get("/template-names")
async def get_template_names(
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """Haal beschikbare template namen op"""
    data = await service.get_template_names(user['id'])
    return {"success": True, "data": data}


# ============================================
# AUTO-POPULATE vanuit templates
# ============================================

@router.post("/tenders/{tender_id}/populate-templates")
async def populate_from_templates(
    tender_id: str,
    request: PopulateRequest,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """
    Kopieer template taken + checklist items naar een tender.
    
    Body:
    - template_naam: 'Standaard' (default)
    - overwrite: false (default) — als true, vervangt bestaande items
    """
    try:
        data = await service.populate_from_templates(
            tender_id,
            user['id'],
            template_naam=request.template_naam,
            overwrite=request.overwrite
        )
        
        message = f"Template '{request.template_naam}' toegepast"
        if data.get('skipped'):
            message = data.get('message', 'Overgeslagen — tender heeft al items')
        
        return {"success": True, "data": data, "message": message}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fout bij toepassen template: {str(e)}")