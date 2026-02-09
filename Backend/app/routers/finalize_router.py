# ================================================================
# TenderZen — Finalize Router
# Backend/app/routers/finalize_router.py
# Datum: 2026-02-09 (v2 — import fix)
# ================================================================
#
# Endpoint voor het opslaan van de volledige wizard-output:
#   POST /api/v1/smart-import/finalize
#
# Registratie in main.py:
#   from app.routers.finalize_router import router as finalize_router
#   app.include_router(finalize_router, prefix="/api/v1")
# ================================================================

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
import logging

from app.core.database import get_supabase
from app.core.dependencies import get_current_user
from app.services.finalize_service import FinalizeService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Smart Import"])


# ════════════════════════════════════════════════
# MODELS
# ════════════════════════════════════════════════

class FinalizeRequest(BaseModel):
    """Request body voor POST /smart-import/finalize"""
    tender_id: Optional[str] = Field(
        None,
        description="UUID van bestaande tender (null = nieuwe tender)"
    )
    tender_naam: Optional[str] = Field(
        None,
        description="Naam van de tender (voor display)"
    )
    tenderbureau_id: str = Field(
        ...,
        description="UUID van het bureau"
    )
    import_id: Optional[str] = Field(
        None,
        description="UUID van de smart import sessie"
    )
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tender metadata uit stap 3 (ReviewStep)"
    )
    team_assignments: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping rol → user_id uit stap 4 (TeamStep)"
    )
    accepted: List[str] = Field(
        default_factory=list,
        description="Lijst van geaccepteerde onderdelen (planning, checklist, doc types)"
    )
    planning_taken: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Gegenereerde planning taken uit stap 5"
    )
    checklist_items: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Gegenereerde checklist items uit stap 5"
    )
    documents: List[str] = Field(
        default_factory=list,
        description="UUIDs van geaccepteerde AI-documenten"
    )
    planning_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Planning metadata (doorlooptijd, feestdagen, etc.)"
    )


class FinalizeResponse(BaseModel):
    """Response van POST /smart-import/finalize"""
    tender_id: str
    tender_naam: Optional[str] = None
    planning_count: int = 0
    checklist_count: int = 0
    document_count: int = 0
    team_count: int = 0


# ════════════════════════════════════════════════
# ENDPOINT
# ════════════════════════════════════════════════

@router.post(
    "/smart-import/finalize",
    response_model=FinalizeResponse,
    summary="Sla alle wizard-output op",
    description=(
        "Slaat de volledige output van de Smart Import wizard op: "
        "tender aanmaken/updaten, planning taken, checklist items, "
        "team toewijzingen en AI documenten koppelen. "
        "Dit is het laatste endpoint dat wordt aangeroepen na stap 5."
    )
)
async def finalize_import(
    request: FinalizeRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Finalize de Smart Import wizard.

    Stappen:
    1. Tender aanmaken of updaten met metadata
    2. Planning taken opslaan (als geaccepteerd)
    3. Checklist items opslaan (als geaccepteerd)
    4. Team toewijzingen opslaan
    5. AI documenten koppelen aan tender
    6. Tender fase updaten naar 'Lopend'
    7. Smart import sessie markeren als voltooid
    """
    user_id = current_user.get('id')
    tenderbureau_id = current_user.get('tenderbureau_id')

    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen bureau toegang")

    # Valideer dat bureau_id overeenkomt
    if request.tenderbureau_id != tenderbureau_id:
        raise HTTPException(
            status_code=403,
            detail="Bureau ID komt niet overeen met je account"
        )

    db = get_supabase()
    service = FinalizeService(db)

    try:
        result = await service.finalize(
            user_id=user_id,
            tenderbureau_id=tenderbureau_id,
            payload=request.model_dump()
        )
        return result

    except Exception as e:
        logger.error(f"Finalize mislukt: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Opslaan mislukt: {str(e)}"
        )