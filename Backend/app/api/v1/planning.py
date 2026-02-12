"""
Planning & Checklist API Router
TenderZen v3.3 — Toegevoegd: bulk-save endpoint voor backplanning

Endpoints:
- GET             /api/v1/planning/agenda                — Agenda data (alle taken over alle tenders)
- GET/POST       /api/v1/tenders/{id}/planning         — Planning taken per tender
- PATCH/DELETE    /api/v1/planning/{taak_id}            — Individuele taak
- GET/POST       /api/v1/tenders/{id}/checklist         — Checklist items per tender
- PATCH/DELETE    /api/v1/checklist/{item_id}            — Individueel item
- GET             /api/v1/planning-counts                — Tellingen alle tenders
- GET             /api/v1/tenders/{id}/planning-counts   — Tellingen per tender
- POST            /api/v1/tenders/{id}/populate-templates — Auto-populate vanuit templates
- POST            /api/v1/tenders/{id}/planning-bulk     — ⭐ Bulk opslaan backplanning (1 call)
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


# ⭐ Bulk-save models voor backplanning
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


# ============================================
# ⭐ BULK SAVE — Backplanning (1 API call i.p.v. 26)
# ============================================

@router.post("/tenders/{tender_id}/planning-bulk")
async def bulk_save_planning(
    tender_id: str,
    request: BulkPlanningRequest,
    user: dict = Depends(get_current_user),
    service: PlanningService = Depends(get_planning_service)
):
    """
    Bulk opslaan van backplanning resultaten.
    
    Bij overwrite=true worden eerst alle bestaande planning_taken 
    en checklist_items voor deze tender verwijderd.
    
    Vervangt 26+ individuele API calls door 1 enkele call.
    """
    try:
        # Haal bureau_id op
        bureau_id = await service._get_tender_bureau_id(tender_id)
        if not bureau_id:
            raise HTTPException(status_code=404, detail="Tender niet gevonden of geen bureau")

        planning_count = 0
        checklist_count = 0

        # ── Stap 1: Verwijder bestaande items indien overwrite ──
        if request.overwrite:
            service.db.table('planning_taken')\
                .delete()\
                .eq('tender_id', tender_id)\
                .execute()
            
            service.db.table('checklist_items')\
                .delete()\
                .eq('tender_id', tender_id)\
                .execute()
            
            print(f"🗑️ Bestaande planning data verwijderd voor tender {tender_id}")

        # ── Stap 2: Bulk insert planning taken ──
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
            print(f"✅ {planning_count} planning taken bulk-inserted")

        # ── Stap 3: Bulk insert checklist items ──
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
            print(f"✅ {checklist_count} checklist items bulk-inserted")

        return {
            "success": True,
            "data": {
                "planning_taken": planning_count,
                "checklist_items": checklist_count,
                "overwritten": request.overwrite
            },
            "message": f"Backplanning opgeslagen: {planning_count} taken + {checklist_count} checklist items"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Bulk save error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Bulk save mislukt: {str(e)}")


# ════════════════════════════════════════════════════════
# TEAM ASSIGNMENTS — Teamleden aan tender toewijzen
# ════════════════════════════════════════════════════════

class TeamAssignmentCreate(BaseModel):
    team_member_id: str
    rol_in_tender: str = "schrijver"
    geplande_uren: int = 0


@router.post("/tenders/{tender_id}/team-assignments")
async def add_team_assignment(
    tender_id: str,
    request: TeamAssignmentCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Voeg een teamlid toe aan een tender."""
    try:
        # Check of tender bestaat
        tender_check = supabase.table('tenders').select('id, tenderbureau_id').eq('id', tender_id).execute()
        if not tender_check.data:
            raise HTTPException(status_code=404, detail="Tender niet gevonden")

        # Check of assignment al bestaat
        existing = supabase.table('tender_team_assignments') \
            .select('id') \
            .eq('tender_id', tender_id) \
            .eq('team_member_id', request.team_member_id) \
            .eq('rol_in_tender', request.rol_in_tender) \
            .execute()

        if existing.data:
            raise HTTPException(
                status_code=409,
                detail="Dit teamlid is al toegewezen aan deze tender met deze rol"
            )

        # Insert
        new_assignment = {
            'tender_id': tender_id,
            'team_member_id': request.team_member_id,
            'rol_in_tender': request.rol_in_tender,
            'geplande_uren': request.geplande_uren
        }

        result = supabase.table('tender_team_assignments').insert(new_assignment).execute()

        print(f"✅ Team assignment toegevoegd: {request.team_member_id} → {tender_id} als {request.rol_in_tender}")

        return {
            "status": "success",
            "data": result.data[0] if result.data else new_assignment,
            "message": f"Teamlid toegevoegd als {request.rol_in_tender}"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Team assignment error: {e}")
        raise HTTPException(status_code=500, detail=f"Toevoegen mislukt: {str(e)}")


@router.delete("/tenders/{tender_id}/team-assignments/{assignment_id}")
async def remove_team_assignment(
    tender_id: str,
    assignment_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Verwijder een teamlid van een tender.
    
    assignment_id kan een tender_team_assignments.id OF een team_member_id zijn.
    """
    try:
        # Probeer eerst op assignment ID
        result = supabase.table('tender_team_assignments') \
            .delete() \
            .eq('id', assignment_id) \
            .eq('tender_id', tender_id) \
            .execute()

        # Als dat niets verwijderde, probeer op team_member_id
        if not result.data:
            result = supabase.table('tender_team_assignments') \
                .delete() \
                .eq('team_member_id', assignment_id) \
                .eq('tender_id', tender_id) \
                .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Assignment niet gevonden")

        deleted_count = len(result.data)
        print(f"🗑️ {deleted_count} team assignment(s) verwijderd voor tender {tender_id}")

        return {
            "status": "success",
            "deleted": deleted_count,
            "message": f"{deleted_count} toewijzing(en) verwijderd"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Team assignment delete error: {e}")
        raise HTTPException(status_code=500, detail=f"Verwijderen mislukt: {str(e)}")


@router.get("/tenders/{tender_id}/team-assignments")
async def get_team_assignments(
    tender_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Haal alle teamtoewijzingen op voor een tender, inclusief teamlid details."""
    try:
        result = supabase.table('tender_team_assignments') \
            .select('*, team_member:team_members(*)') \
            .eq('tender_id', tender_id) \
            .execute()

        assignments = result.data or []

        # Flatten: voeg team_member velden samen met assignment
        enriched = []
        for a in assignments:
            tm = a.pop('team_member', {}) or {}
            enriched.append({
                **a,
                'naam': tm.get('naam', ''),
                'email': tm.get('email', ''),
                'avatar_kleur': tm.get('avatar_kleur', ''),
                'functie_titel': tm.get('functie_titel', ''),
                'user_id': tm.get('user_id', '')
            })

        return {
            "status": "success",
            "data": enriched,
            "count": len(enriched)
        }

    except Exception as e:
        print(f"❌ Team assignments get error: {e}")
        raise HTTPException(status_code=500, detail=f"Ophalen mislukt: {str(e)}")
@router.get("/team-members")
async def get_team_members(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase_async)
):
    """Haal alle teamleden op voor het bureau (of super-admin: alle leden)."""
    try:
        # Super-admins krijgen alle teamleden
        if current_user.get("role") == "super-admin":
            result = supabase.table('team_members').select('*').execute()
            return {"status": "success", "data": result.data, "count": len(result.data)}
        # Voor andere users: alleen teamleden van hun bureau, maar alleen als bureau_id geldig is
        bureau_id = current_user.get("tenderbureau_id")
        if not bureau_id:
            # Geen bureau_id beschikbaar, geef lege lijst terug
            return {"status": "success", "data": [], "count": 0}
        # Probeer eerst op tenderbureau_id, anders op bureau_id (voor compatibiliteit)
        result = supabase.table('team_members').select('*').or_(f"tenderbureau_id.eq.{bureau_id},bureau_id.eq.{bureau_id}").execute()
        return {"status": "success", "data": result.data, "count": len(result.data)}
    except Exception as e:
        print(f"❌ Team members get error: {e}")
        raise HTTPException(status_code=500, detail=f"Fout bij ophalen teamleden: {str(e)}")