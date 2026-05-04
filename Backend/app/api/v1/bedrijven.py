"""
Bedrijven detail API — TenderZen
GET/PATCH bedrijfsprofiel, referenties toevoegen.
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from supabase import Client
from app.core.dependencies import get_current_user, get_user_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bedrijven", tags=["bedrijven"])


def _is_super_admin(current_user: dict) -> bool:
    rol = current_user.get("rol") or current_user.get("role") or ""
    return rol == "super_admin"


def _check_toegang(db: Client, bedrijf_id: str, current_user: dict):
    """Gooit 403 als de gebruiker geen toegang heeft tot dit bedrijf."""
    if _is_super_admin(current_user):
        return
    tenderbureau_id = (
        current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
    )
    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen tenderbureau_id gevonden")

    koppeling = db.table("bureau_bedrijf_relaties") \
        .select("id") \
        .eq("bedrijf_id", bedrijf_id) \
        .eq("tenderbureau_id", tenderbureau_id) \
        .execute()

    if not (koppeling.data):
        raise HTTPException(status_code=403, detail="Geen toegang tot dit bedrijf")


@router.get("/{bedrijf_id}")
async def get_bedrijf_detail(
    bedrijf_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """
    Haalt volledig bedrijfsprofiel op inclusief referenties,
    statistieken en bureau-koppelingen.
    Alleen toegankelijk voor super-admin of bureaus die het bedrijf hebben gekoppeld.
    """
    _check_toegang(db, bedrijf_id, current_user)

    # Bedrijf ophalen (geen .single() — vermijdt 406 bij RLS edge cases)
    bedrijf_result = db.table("bedrijven") \
        .select("*") \
        .eq("id", bedrijf_id) \
        .limit(1) \
        .execute()

    if not bedrijf_result.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")

    bedrijf = bedrijf_result.data[0]

    # Referenties ophalen (meest recent eerst)
    ref_result = db.table("bedrijf_referenties") \
        .select("*") \
        .eq("bedrijf_id", bedrijf_id) \
        .order("jaar", desc=True) \
        .execute()

    referenties = ref_result.data or []

    # Bureau-koppelingen ophalen
    rel_result = db.table("bureau_bedrijf_relaties") \
        .select("*") \
        .eq("bedrijf_id", bedrijf_id) \
        .execute()

    relaties = rel_result.data or []

    # Bureaunamen ophalen en koppelen
    if relaties:
        bureau_ids = [r["tenderbureau_id"] for r in relaties]
        bureaus_result = db.table("tenderbureaus") \
            .select("id,bureau_naam") \
            .in_("id", bureau_ids) \
            .execute()
        bureau_naam_map = {
            b["id"]: b["bureau_naam"]
            for b in (bureaus_result.data or [])
        }
        for rel in relaties:
            rel["bureau_naam"] = bureau_naam_map.get(rel["tenderbureau_id"], "Onbekend")

    # Statistieken berekenen vanuit referenties
    gewonnen = sum(1 for r in referenties if r.get("gewonnen") is True)
    verloren  = sum(1 for r in referenties if r.get("gewonnen") is False)
    totaal    = len(referenties)
    winratio  = round((gewonnen / totaal) * 100) if totaal > 0 else 0

    return {
        "bedrijf": bedrijf,
        "referenties": referenties,
        "bureau_relaties": relaties,
        "statistieken": {
            "totaal":    totaal,
            "gewonnen":  gewonnen,
            "verloren":  verloren,
            "winratio":  winratio,
        },
    }


TOEGESTANE_VELDEN = {
    "bedrijfsnaam", "plaats", "adres", "website", "contactpersoon",
    "email", "omzet_categorie", "aantal_werknemers", "kvk_nummer",
    "certificeringen", "cpv_codes", "tags", "notities", "branche",
}


@router.patch("/{bedrijf_id}")
async def update_bedrijf(
    bedrijf_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """
    Bewerkt bedrijfsgegevens. Alleen super-admin of gekoppeld bureau.
    """
    _check_toegang(db, bedrijf_id, current_user)

    body = await request.json()
    update_data = {k: v for k, v in body.items() if k in TOEGESTANE_VELDEN}

    if not update_data:
        raise HTTPException(status_code=400, detail="Geen geldige velden om bij te werken")

    result = db.table("bedrijven") \
        .update(update_data) \
        .eq("id", bedrijf_id) \
        .execute()

    return {
        "ok": True,
        "bedrijf": result.data[0] if result.data else None,
    }


@router.post("/{bedrijf_id}/referenties")
async def add_referentie(
    bedrijf_id: str,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_user_db),
):
    """Voegt een referentie toe aan een bedrijf."""
    _check_toegang(db, bedrijf_id, current_user)

    body = await request.json()
    gebruiker_id = current_user.get("user_id") or current_user.get("id")

    record = {
        "bedrijf_id":    bedrijf_id,
        "tender_naam":   body.get("tender_naam", ""),
        "opdrachtgever": body.get("opdrachtgever"),
        "jaar":          body.get("jaar"),
        "waarde":        body.get("waarde"),
        "gewonnen":      body.get("gewonnen"),
        "sector":        body.get("sector"),
        "omschrijving":  body.get("omschrijving"),
    }

    result = db.table("bedrijf_referenties") \
        .insert(record) \
        .execute()

    return {
        "ok": True,
        "referentie": result.data[0] if result.data else None,
    }
