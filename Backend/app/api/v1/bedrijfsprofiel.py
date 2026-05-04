"""
Bedrijfsprofiel API — TenderZen
Volledig profiel beheer: basis, competenties, CPV, referenties, kwaliteit, signalering.
"""
import asyncio
import json
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from supabase import Client

from app.core.dependencies import get_current_user, get_user_db
from app.services.anthropic_service import call_claude

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bedrijfsprofiel", tags=["Bedrijfsprofiel"])

CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_super_admin(current_user: dict) -> bool:
    rol = current_user.get("rol") or current_user.get("role") or ""
    return rol == "super_admin"


def _check_toegang(db: Client, bedrijf_id: str, current_user: dict):
    """403 als de gebruiker geen toegang heeft tot dit bedrijf."""
    if _is_super_admin(current_user):
        return
    tenderbureau_id = (
        current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
    )
    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen tenderbureau_id gevonden")

    koppeling = (
        db.table("bureau_bedrijf_relaties")
        .select("id")
        .eq("bedrijf_id", bedrijf_id)
        .eq("tenderbureau_id", tenderbureau_id)
        .execute()
    )
    if not koppeling.data:
        raise HTTPException(status_code=403, detail="Geen toegang tot dit bedrijf")


def _bereken_profiel_kwaliteit(bedrijf: dict, referenties: list) -> int:
    """
    Berekent een kwaliteitsscore 0-100 op basis van profielvolledigheid.
    Gewogen: basis (40%), competenties (25%), referenties (20%), signalering (15%).
    """
    score = 0

    # Basisgegevens (40 punten)
    basis_velden = ["bedrijfsnaam", "adres", "email", "contactpersoon",
                    "kvk_nummer", "website", "branche", "omzet_categorie"]
    gevuld = sum(1 for v in basis_velden if bedrijf.get(v))
    score += round((gevuld / len(basis_velden)) * 40)

    # Competentieprofiel + CPV (25 punten)
    if bedrijf.get("competentieprofiel") and len(bedrijf["competentieprofiel"]) > 50:
        score += 15
    cpv = bedrijf.get("cpv_codes") or []
    if len(cpv) >= 3:
        score += 10
    elif len(cpv) >= 1:
        score += 5

    # Referenties (20 punten)
    n_ref = len(referenties)
    if n_ref >= 5:
        score += 20
    elif n_ref >= 3:
        score += 14
    elif n_ref >= 1:
        score += 7

    # Signalering-instellingen (15 punten)
    if bedrijf.get("min_contractwaarde") is not None:
        score += 5
    if bedrijf.get("geografische_focus"):
        score += 5
    if bedrijf.get("aanbestedende_diensten"):
        score += 5

    return min(score, 100)


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class ProfielUpdate(BaseModel):
    bedrijfsnaam:        Optional[str]       = None
    adres:               Optional[str]       = None
    email:               Optional[str]       = None
    contactpersoon:      Optional[str]       = None
    kvk_nummer:          Optional[str]       = None
    website:             Optional[str]       = None
    branche:             Optional[str]       = None
    omzet_categorie:     Optional[str]       = None
    aantal_werknemers:   Optional[int]       = None
    notities:            Optional[str]       = None
    competentieprofiel:  Optional[str]       = None
    cpv_codes:           Optional[List[str]] = None
    min_contractwaarde:  Optional[float]     = None
    max_contractwaarde:  Optional[float]     = None
    geografische_focus:  Optional[List[str]] = None
    aanbestedende_diensten: Optional[List[str]] = None
    signalering_actief:  Optional[bool]      = None


class ReferentieCreate(BaseModel):
    tender_naam:   str
    opdrachtgever: Optional[str]       = None
    jaar:          Optional[int]       = None
    waarde:        Optional[float]     = None
    gewonnen:      Optional[bool]      = None
    sector:        Optional[str]       = None
    omschrijving:  Optional[str]       = None
    cpv_codes:     Optional[List[str]] = None


class ReferentieUpdate(BaseModel):
    tender_naam:   Optional[str]       = None
    opdrachtgever: Optional[str]       = None
    jaar:          Optional[int]       = None
    waarde:        Optional[float]     = None
    gewonnen:      Optional[bool]      = None
    sector:        Optional[str]       = None
    omschrijving:  Optional[str]       = None
    cpv_codes:     Optional[List[str]] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{bedrijf_id}")
async def get_profiel(
    bedrijf_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """Volledig bedrijfsprofiel inclusief referenties en kwaliteitsscore."""
    _check_toegang(db, bedrijf_id, current_user)

    result = (
        db.table("bedrijven")
        .select("*")
        .eq("id", bedrijf_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")

    bedrijf = result.data[0]

    ref_result = (
        db.table("bedrijf_referenties")
        .select("*")
        .eq("bedrijf_id", bedrijf_id)
        .order("jaar", desc=True)
        .execute()
    )
    referenties = ref_result.data or []

    kwaliteit = _bereken_profiel_kwaliteit(bedrijf, referenties)

    return {
        "bedrijf":    bedrijf,
        "referenties": referenties,
        "kwaliteit":  kwaliteit,
    }


@router.put("/{bedrijf_id}")
async def update_profiel(
    bedrijf_id: str,
    body: ProfielUpdate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """Bewerkt bedrijfsprofiel inclusief signalering-instellingen."""
    _check_toegang(db, bedrijf_id, current_user)

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Geen velden om bij te werken")

    result = (
        db.table("bedrijven")
        .update(update_data)
        .eq("id", bedrijf_id)
        .execute()
    )

    bedrijf = result.data[0] if result.data else {}

    # Herbereken kwaliteit
    ref_result = (
        db.table("bedrijf_referenties")
        .select("id")
        .eq("bedrijf_id", bedrijf_id)
        .execute()
    )
    referenties = ref_result.data or []
    kwaliteit = _bereken_profiel_kwaliteit(bedrijf, referenties)

    # Sla kwaliteit op
    db.table("bedrijven").update({"profiel_kwaliteit": kwaliteit}).eq("id", bedrijf_id).execute()
    bedrijf["profiel_kwaliteit"] = kwaliteit

    return {"ok": True, "bedrijf": bedrijf, "kwaliteit": kwaliteit}


# ---------------------------------------------------------------------------
# Referenties CRUD
# ---------------------------------------------------------------------------

@router.get("/{bedrijf_id}/referenties")
async def get_referenties(
    bedrijf_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    _check_toegang(db, bedrijf_id, current_user)

    result = (
        db.table("bedrijf_referenties")
        .select("*")
        .eq("bedrijf_id", bedrijf_id)
        .order("jaar", desc=True)
        .execute()
    )
    return {"referenties": result.data or []}


@router.post("/{bedrijf_id}/referenties")
async def create_referentie(
    bedrijf_id: str,
    body: ReferentieCreate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    _check_toegang(db, bedrijf_id, current_user)

    record = {"bedrijf_id": bedrijf_id, **body.model_dump(exclude_none=True)}
    result = db.table("bedrijf_referenties").insert(record).execute()

    return {"ok": True, "referentie": result.data[0] if result.data else None}


@router.put("/{bedrijf_id}/referenties/{ref_id}")
async def update_referentie(
    bedrijf_id: str,
    ref_id: str,
    body: ReferentieUpdate,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    _check_toegang(db, bedrijf_id, current_user)

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Geen velden om bij te werken")

    result = (
        db.table("bedrijf_referenties")
        .update(update_data)
        .eq("id", ref_id)
        .eq("bedrijf_id", bedrijf_id)
        .execute()
    )
    return {"ok": True, "referentie": result.data[0] if result.data else None}


@router.delete("/{bedrijf_id}/referenties/{ref_id}")
async def delete_referentie(
    bedrijf_id: str,
    ref_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    _check_toegang(db, bedrijf_id, current_user)

    db.table("bedrijf_referenties") \
        .delete() \
        .eq("id", ref_id) \
        .eq("bedrijf_id", bedrijf_id) \
        .execute()

    return {"ok": True}


# ---------------------------------------------------------------------------
# AI: competentie-genereren
# ---------------------------------------------------------------------------

@router.post("/{bedrijf_id}/competentie-genereren")
async def genereer_competentieprofiel(
    bedrijf_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """
    Laat Claude een competentieprofiel genereren op basis van
    bedrijfsgegevens + referenties.
    """
    _check_toegang(db, bedrijf_id, current_user)

    # Haal bedrijf + referenties op
    bedrijf_res = (
        db.table("bedrijven")
        .select("bedrijfsnaam,branche,omzet_categorie,aantal_werknemers,cpv_codes,tags,certificeringen")
        .eq("id", bedrijf_id)
        .limit(1)
        .execute()
    )
    if not bedrijf_res.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")
    bedrijf = bedrijf_res.data[0]

    ref_res = (
        db.table("bedrijf_referenties")
        .select("tender_naam,opdrachtgever,sector,omschrijving,jaar,waarde,gewonnen")
        .eq("bedrijf_id", bedrijf_id)
        .order("jaar", desc=True)
        .limit(10)
        .execute()
    )
    referenties = ref_res.data or []

    prompt = f"""Analyseer onderstaande bedrijfsgegevens en genereer een professioneel competentieprofiel \
voor gebruik bij tendersignalering. Het profiel moet in het Nederlands zijn, \
2-4 alinea's bevatten, en de kerncompetenties, ervaring en onderscheidend vermogen beschrijven.

Bedrijf: {json.dumps(bedrijf, ensure_ascii=False)}

Referentieprojecten ({len(referenties)}x):
{json.dumps(referenties, ensure_ascii=False, indent=2)}

Geef ALLEEN de profieltekst terug, geen toelichting of opmaak."""

    try:
        resp = await asyncio.to_thread(
            call_claude,
            messages=[{"role": "user", "content": prompt}],
            model=CLAUDE_MODEL,
            max_tokens=800,
            system="Je bent een expert in aanbestedingen en bedrijfsprofiling.",
            log_usage=False,
        )
        tekst = resp.content[0].text.strip()
    except Exception as e:
        logger.error("Claude fout bij competentie-genereren: %s", e)
        raise HTTPException(status_code=502, detail="AI-generatie mislukt")

    # Sla het gegenereerde profiel op
    db.table("bedrijven") \
        .update({"competentieprofiel": tekst}) \
        .eq("id", bedrijf_id) \
        .execute()

    return {"ok": True, "competentieprofiel": tekst}


# ---------------------------------------------------------------------------
# Kwaliteitsscore berekenen (handmatig triggeren)
# ---------------------------------------------------------------------------

@router.post("/{bedrijf_id}/kwaliteit")
async def bereken_kwaliteit(
    bedrijf_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """Herbereken en sla kwaliteitsscore op."""
    _check_toegang(db, bedrijf_id, current_user)

    bedrijf_res = db.table("bedrijven").select("*").eq("id", bedrijf_id).limit(1).execute()
    if not bedrijf_res.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")

    ref_res = (
        db.table("bedrijf_referenties")
        .select("id")
        .eq("bedrijf_id", bedrijf_id)
        .execute()
    )
    kwaliteit = _bereken_profiel_kwaliteit(bedrijf_res.data[0], ref_res.data or [])

    db.table("bedrijven").update({"profiel_kwaliteit": kwaliteit}).eq("id", bedrijf_id).execute()

    return {"ok": True, "kwaliteit": kwaliteit}
