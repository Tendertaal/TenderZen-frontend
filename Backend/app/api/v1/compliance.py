"""
ComplianceZen API — Sprint 1A
Norm-extractie, norm opslaan, score herberekenen, normen/clausules ophalen.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from app.core.database import get_supabase_async
from app.core.dependencies import get_current_user
from app.services.compliance_scoring import herbereken_en_sla_op
from app.services.compliance_norm_extractor import (
    extraheer_clausules_uit_tekst,
    sla_norm_op_met_clausules,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class NormExtractieRequest(BaseModel):
    norm_naam:   str
    norm_code:   str
    norm_versie: str
    taal:        str = "nl"
    tekst:       str


class NormOpslaanRequest(BaseModel):
    norm_naam:           str
    norm_code:           str
    norm_versie:         str
    naam_kort:           Optional[str] = None
    type:                str = "certificeerbaar"
    cycle_jaren:         int = 3
    drempel_score:       int = 60
    taal:                str = "nl"
    is_platform_template: bool = False
    clausules:           list


class ScoreHerberekenenRequest(BaseModel):
    company_norm_id: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/normen/extraheer")
async def extraheer_norm(
    body: NormExtractieRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Stap 1 wizard: stuur norm-tekst naar Claude, ontvang clausulelijst.
    Clausules worden NIET opgeslagen — compliance manager reviewt eerst.
    Originele clausule-codes en bewoordingen worden altijd behouden.
    """
    if len(body.tekst) < 100:
        raise HTTPException(
            status_code=400,
            detail="Norm-tekst te kort (minimaal 100 tekens)",
        )

    try:
        clausules = extraheer_clausules_uit_tekst(
            norm_naam=body.norm_naam,
            tekst=body.tekst,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "clausules": clausules,
        "aantal": len(clausules),
        "norm_naam": body.norm_naam,
        "bericht": (
            f"{len(clausules)} clausules geëxtraheerd. "
            f"Review de clausules en bevestig om op te slaan."
        ),
    }


@router.post("/normen/opslaan")
async def norm_opslaan(
    body: NormOpslaanRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Stap 2 wizard: sla goedgekeurde norm + clausules op.
    Aanroepen nadat compliance manager de clausulelijst heeft gereviewed.
    """
    user_id = current_user.get("id") or current_user.get("user_id")

    norm_data = {
        "code":                body.norm_code,
        "versie":              body.norm_versie,
        "naam":                body.norm_naam,
        "naam_kort":           body.naam_kort,
        "type":                body.type,
        "cycle_jaren":         body.cycle_jaren,
        "drempel_score":       body.drempel_score,
        "taal":                body.taal,
        "is_platform_template": body.is_platform_template,
    }

    try:
        resultaat = sla_norm_op_met_clausules(
            norm_data=norm_data,
            clausules=body.clausules,
            aangemaakt_door=user_id,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "norm_id":             resultaat["norm_id"],
        "clausules_opgeslagen": resultaat["clausules_opgeslagen"],
        "bericht": (
            f"Norm '{body.norm_naam}' opgeslagen met "
            f"{resultaat['clausules_opgeslagen']} clausules."
        ),
    }


@router.get("/normen")
async def lijst_normen(
    alleen_templates: bool = False,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Beschikbare normen ophalen.
    alleen_templates=True → alleen platform-brede templates (bibliotheek-dropdown).
    """
    query = db.table("compliance_normen").select("*").order("naam")
    if alleen_templates:
        query = query.eq("is_platform_template", True)

    result = query.execute()
    return {"normen": result.data or []}


@router.get("/normen/{norm_id}/clausules")
async def haal_clausules_op(
    norm_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Haal alle clausules van een norm op, gesorteerd op volgorde."""
    result = (
        db.table("compliance_norm_requirements")
        .select("*")
        .eq("norm_id", norm_id)
        .order("volgorde")
        .execute()
    )
    return {"clausules": result.data or [], "aantal": len(result.data or [])}


@router.post("/score/herbereken")
async def herbereken_score(
    body: ScoreHerberekenenRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    R01: Herbereken norm-score na statuswijziging van een control.
    Aanroepen vanuit elke endpoint die een control-status wijzigt.
    """
    tenderbureau_id = (
        current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
    )
    if not tenderbureau_id:
        raise HTTPException(status_code=400, detail="Geen tenderbureau_id")

    resultaat = await herbereken_en_sla_op(
        company_norm_id=body.company_norm_id,
        tenderbureau_id=tenderbureau_id,
        db=db,
    )

    return {
        "norm_score":     resultaat.norm_score,
        "exporteerbaar":  resultaat.exporteerbaar,
        "blokkade_reden": resultaat.blokkade_reden,
    }
