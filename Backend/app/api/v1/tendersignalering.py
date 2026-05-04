"""
Tendersignalering API — TenderZen
Dashboard, matches ophalen/bijwerken, scan uitvoeren via Claude AI.
"""
import asyncio
import json
import logging
import re
import traceback
import uuid
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from supabase import Client

from app.core.dependencies import get_current_user
from app.core.database import get_supabase_async
from app.services.anthropic_service import call_claude
from app.api.v1.tendermatch import analyseer_aanbesteding, haal_referenties_op

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tendersignalering", tags=["Tendersignalering"])

CLAUDE_MODEL = "claude-haiku-4-5-20251001"

GELDIGE_STATUSSEN = {"nieuw", "bekeken", "opgeslagen", "afgewezen", "benaderd", "geinteresseerd", "offerte", "niet_relevant"}


# ---------------------------------------------------------------------------
# JSON-extractie helper
# ---------------------------------------------------------------------------

def extraheer_json(tekst: str) -> str:
    """Extraheert JSON uit Claude response, ook als die in markdown backticks zit."""
    if "```" in tekst:
        match = re.search(r'```(?:json)?\s*([\s\S]*?)```', tekst)
        if match:
            tekst = match.group(1).strip()

    # Fallback: zoek eerste { tot laatste }
    start = tekst.find('{')
    eind  = tekst.rfind('}') + 1
    if start != -1 and eind > start:
        return tekst[start:eind]

    return tekst.strip()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_super_admin(current_user: dict) -> bool:
    rol = current_user.get("rol") or current_user.get("role") or ""
    return rol == "super_admin"


def _check_toegang(db: Client, bedrijf_id: str, current_user: dict):
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


def _score_kleur(score: float) -> str:
    if score >= 75:
        return "groen"
    if score >= 50:
        return "oranje"
    return "rood"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class StatusUpdate(BaseModel):
    status: str


class ScanRequest(BaseModel):
    tender_ids: Optional[List[str]] = None   # None = alle actieve tenders van bureau
    max_tenders: Optional[int] = 20

class ScanBureauRequest(BaseModel):
    max_tenders_per_bedrijf: Optional[int] = 20


class HandmatigMatchRequest(BaseModel):
    aanbesteding_tekst: str
    tender_titel: Optional[str] = None
    aanbestedende_dienst: Optional[str] = None
    deadline: Optional[str] = None
    procedure: Optional[str] = None
    waarde_min: Optional[float] = None
    waarde_max: Optional[float] = None
    tenderned_url: Optional[str] = None


class InstellingenRequest(BaseModel):
    weging_vakinhoud: int
    weging_certificeringen: int
    weging_regio: int
    weging_financieel: int
    weging_ervaring: int
    drempel_opslaan: int
    drempel_hoog: int
    drempel_notificatie: int


class TenderAanmakenRequest(BaseModel):
    tender_naam: str
    aanbestedende_dienst: Optional[str] = None
    deadline: Optional[str] = None
    procedure: Optional[str] = None
    waarde_min: Optional[float] = None
    waarde_max: Optional[float] = None
    omschrijving: Optional[str] = None


INSTELLINGEN_DEFAULTS = {
    "weging_vakinhoud":       35,
    "weging_certificeringen": 25,
    "weging_regio":           20,
    "weging_financieel":      12,
    "weging_ervaring":        8,
    "drempel_opslaan":        0,
    "drempel_hoog":           75,
    "drempel_notificatie":    80,
}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/bureau-dashboard")
async def get_bureau_dashboard(
    status: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    bureau_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Bureau-breed dashboard: alle matches van alle signalering-actieve bedrijven
    van het actieve bureau, gesorteerd op score.
    Super-admin kan een bureau_id meesturen; anders verplicht.
    """
    try:
        return await _bureau_dashboard_impl(status, min_score, bureau_id, current_user, db)
    except HTTPException:
        raise
    except Exception as e:
        print(f"[bureau-dashboard ERROR]\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


async def _bureau_dashboard_impl(
    status: Optional[str],
    min_score: Optional[float],
    bureau_id: Optional[str],
    current_user: dict,
    db: Client,
):
    is_sa = _is_super_admin(current_user)

    # Bureau-id bepalen
    effectief_bureau_id = bureau_id
    if not effectief_bureau_id and not is_sa:
        effectief_bureau_id = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
    if not effectief_bureau_id and not is_sa:
        raise HTTPException(status_code=400, detail="Bureau-id ontbreekt")

    # Haal alle signalering-actieve bedrijven op voor dit bureau
    bedrijf_query = (
        db.table("bedrijven")
        .select("id,bedrijfsnaam,profiel_kwaliteit,signalering_actief")
        .eq("signalering_actief", True)
    )
    if effectief_bureau_id:
        # Join via bureau_bedrijf_relaties — filter op bureau
        rel_res = (
            db.table("bureau_bedrijf_relaties")
            .select("bedrijf_id")
            .eq("tenderbureau_id", effectief_bureau_id)
            .execute()
        )
        bedrijf_ids = [r["bedrijf_id"] for r in (rel_res.data or [])]
        if not bedrijf_ids:
            return {
                "bureau_id": effectief_bureau_id,
                "signalering_actieve_bedrijven": 0,
                "stats": {"totaal": 0, "nieuw": 0, "opgeslagen": 0, "afgewezen": 0, "gem_score": 0, "hoog_pct": 0},
                "matches": [],
            }
        bedrijf_query = bedrijf_query.in_("id", bedrijf_ids)

    bedrijven_res = bedrijf_query.execute()
    actieve_bedrijven = bedrijven_res.data or []
    actieve_ids = [b["id"] for b in actieve_bedrijven]
    bedrijf_map = {b["id"]: b for b in actieve_bedrijven}

    if not actieve_ids:
        return {
            "bureau_id": effectief_bureau_id,
            "signalering_actieve_bedrijven": 0,
            "stats": {"totaal": 0, "nieuw": 0, "opgeslagen": 0, "afgewezen": 0, "gem_score": 0, "hoog_pct": 0},
            "matches": [],
        }

    # Haal alle matches op via tenderbureau_id — geen JOIN op tenders nodig,
    # alle tenderinfo staat als losse kolommen in tendersignalering_matches.
    # bedrijven-join werkt wel via bedrijf_id FK.
    match_query = (
        db.table("tendersignalering_matches")
        .select("*, bedrijven(bedrijfsnaam, branche, plaats)")
        .eq("tenderbureau_id", effectief_bureau_id)
        .order("gevonden_op", desc=True)
    )
    if status:
        match_query = match_query.eq("status", status)
    if min_score is not None:
        match_query = match_query.gte("match_score", min_score)

    matches_res = match_query.execute()
    matches = matches_res.data or []

    # Voeg score_kleur toe
    for m in matches:
        m["score_kleur"] = _score_kleur(m["match_score"])

    # Statistieken: aparte query voor alle matches van dit bureau (zonder status/score filter)
    alle_res = (
        db.table("tendersignalering_matches")
        .select("match_score,status")
        .eq("tenderbureau_id", effectief_bureau_id)
        .execute()
        .data or []
    )
    stats = {
        "totaal":     len(alle_res),
        "nieuw":      sum(1 for m in alle_res if m["status"] == "nieuw"),
        "opgeslagen": sum(1 for m in alle_res if m["status"] == "opgeslagen"),
        "afgewezen":  sum(1 for m in alle_res if m["status"] == "afgewezen"),
        "gem_score":  round(sum(m["match_score"] for m in alle_res) / len(alle_res), 1) if alle_res else 0,
        "hoog_pct":   round(sum(1 for m in alle_res if m["match_score"] >= 75) / len(alle_res) * 100) if alle_res else 0,
    }

    return {
        "bureau_id": effectief_bureau_id,
        "signalering_actieve_bedrijven": len(actieve_bedrijven),
        "stats": stats,
        "matches": matches,
    }


@router.post("/scan-bureau")
async def scan_bureau(
    body: ScanBureauRequest,
    bureau_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Start een scan voor alle signalering-actieve bedrijven van het bureau in één keer.
    Roept intern per bedrijf de scan-logica aan.
    """
    is_sa = _is_super_admin(current_user)
    effectief_bureau_id = bureau_id
    if not effectief_bureau_id and not is_sa:
        effectief_bureau_id = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
    if not effectief_bureau_id and not is_sa:
        raise HTTPException(status_code=400, detail="Bureau-id ontbreekt")

    # Haal signalering-actieve bedrijven op
    bedrijf_query = (
        db.table("bedrijven")
        .select("id,bedrijfsnaam")
        .eq("signalering_actief", True)
    )
    if effectief_bureau_id:
        rel_res = (
            db.table("bureau_bedrijf_relaties")
            .select("bedrijf_id")
            .eq("tenderbureau_id", effectief_bureau_id)
            .execute()
        )
        bedrijf_ids = [r["bedrijf_id"] for r in (rel_res.data or [])]
        if bedrijf_ids:
            bedrijf_query = bedrijf_query.in_("id", bedrijf_ids)
        else:
            return {"ok": True, "gescande_bedrijven": 0, "totaal_nieuwe_matches": 0}

    bedrijven = (bedrijf_query.execute().data or [])

    if not bedrijven:
        return {"ok": True, "gescande_bedrijven": 0, "totaal_nieuwe_matches": 0}

    totaal_nieuw = 0
    resultaten = []

    for bedrijf in bedrijven:
        try:
            scan_req = ScanRequest(max_tenders=body.max_tenders_per_bedrijf or 20)
            # Hergebruik de scan-logica via directe aanroep
            res = await scan_tenders(
                bedrijf_id=bedrijf["id"],
                body=scan_req,
                current_user=current_user,
                db=db,
            )
            totaal_nieuw += res.get("nieuwe_matches", 0)
            resultaten.append({"bedrijf_id": bedrijf["id"], "bedrijfsnaam": bedrijf["bedrijfsnaam"], "nieuwe_matches": res.get("nieuwe_matches", 0)})
        except Exception as e:
            logger.warning("Scan mislukt voor bedrijf %s: %s", bedrijf["id"], e)
            resultaten.append({"bedrijf_id": bedrijf["id"], "bedrijfsnaam": bedrijf["bedrijfsnaam"], "fout": str(e)})

    return {
        "ok": True,
        "gescande_bedrijven": len(bedrijven),
        "totaal_nieuwe_matches": totaal_nieuw,
        "resultaten": resultaten,
    }


@router.get("/dashboard/{bedrijf_id}")
async def get_dashboard(
    bedrijf_id: str,
    status: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Dashboard met samenvatting + match-lijst voor één bedrijf.
    Optioneel gefilterd op status en minimale score.
    """
    _check_toegang(db, bedrijf_id, current_user)

    # Bedrijf ophalen
    bedrijf_res = (
        db.table("bedrijven")
        .select("id,bedrijfsnaam,signalering_actief,profiel_kwaliteit")
        .eq("id", bedrijf_id)
        .limit(1)
        .execute()
    )
    if not bedrijf_res.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")
    bedrijf = bedrijf_res.data[0]

    # Matches ophalen — alle tenderinfo staat als losse kolommen, geen JOIN op tenders
    query = (
        db.table("tendersignalering_matches")
        .select("*")
        .eq("bedrijf_id", bedrijf_id)
        .order("match_score", desc=True)
    )
    if status:
        query = query.eq("status", status)
    if min_score is not None:
        query = query.gte("match_score", min_score)

    matches_res = query.execute()
    matches = matches_res.data or []

    # Statistieken berekenen
    alle_matches = (
        db.table("tendersignalering_matches")
        .select("match_score,status")
        .eq("bedrijf_id", bedrijf_id)
        .execute()
        .data or []
    )

    stats = {
        "totaal":      len(alle_matches),
        "nieuw":       sum(1 for m in alle_matches if m["status"] == "nieuw"),
        "opgeslagen":  sum(1 for m in alle_matches if m["status"] == "opgeslagen"),
        "afgewezen":   sum(1 for m in alle_matches if m["status"] == "afgewezen"),
        "gem_score":   round(
            sum(m["match_score"] for m in alle_matches) / len(alle_matches), 1
        ) if alle_matches else 0,
        "hoog_pct":    round(
            sum(1 for m in alle_matches if m["match_score"] >= 75) / len(alle_matches) * 100
        ) if alle_matches else 0,
    }

    # Verrijk matches met kleur
    for m in matches:
        m["score_kleur"] = _score_kleur(m["match_score"])

    return {
        "bedrijf": bedrijf,
        "stats":   stats,
        "matches": matches,
    }


@router.get("/matches/{bedrijf_id}")
async def get_matches(
    bedrijf_id: str,
    status: Optional[str] = Query(None),
    min_score: Optional[float] = Query(None, ge=0, le=100),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Match-lijst voor een bedrijf, gefilterd en gesorteerd."""
    _check_toegang(db, bedrijf_id, current_user)

    query = (
        db.table("tendersignalering_matches")
        .select("*")
        .eq("bedrijf_id", bedrijf_id)
        .order("match_score", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)
    if min_score is not None:
        query = query.gte("match_score", min_score)

    result = query.execute()
    matches = result.data or []

    for m in matches:
        m["score_kleur"] = _score_kleur(m["match_score"])

    return {"matches": matches}


@router.patch("/matches/{match_id}/status")
async def update_match_status(
    match_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Wijzig de status van een match (bekeken/opgeslagen/afgewezen)."""
    nieuwe_status = body.get("status")
    if nieuwe_status not in GELDIGE_STATUSSEN:
        raise HTTPException(
            status_code=400,
            detail=f"Ongeldige status. Kies uit: {', '.join(sorted(GELDIGE_STATUSSEN))}"
        )

    # Haal match op om bureau-toegang te controleren via tenderbureau_id
    match_res = (
        db.table("tendersignalering_matches")
        .select("id,tenderbureau_id")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_res.data:
        raise HTTPException(status_code=404, detail="Match niet gevonden")

    if not _is_super_admin(current_user):
        user_bureau = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
        if str(match_res.data[0]["tenderbureau_id"]) != str(user_bureau):
            raise HTTPException(status_code=403, detail="Geen toegang tot deze match")

    try:
        db.table("tendersignalering_matches")\
            .update({"status": nieuwe_status})\
            .eq("id", match_id)\
            .execute()
    except Exception as e:
        logger.error("Status update mislukt voor match %s: %s", match_id, e)
        raise HTTPException(status_code=500, detail="Status bijwerken mislukt")

    return {"ok": True, "status": nieuwe_status}


@router.post("/scan/{bedrijf_id}")
async def scan_tenders(
    bedrijf_id: str,
    body: ScanRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Voer een AI-scan uit: vergelijk het bedrijfsprofiel met actieve tenders
    en sla matches op met totaalscore + score_breakdown.
    """
    _check_toegang(db, bedrijf_id, current_user)

    # Bedrijf ophalen
    bedrijf_res = (
        db.table("bedrijven")
        .select("*")
        .eq("id", bedrijf_id)
        .limit(1)
        .execute()
    )
    if not bedrijf_res.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")
    bedrijf = bedrijf_res.data[0]

    if not bedrijf.get("signalering_actief"):
        raise HTTPException(status_code=400, detail="Tendersignalering is niet actief voor dit bedrijf")

    # Referenties ophalen (max 5 voor context)
    ref_res = (
        db.table("bedrijf_referenties")
        .select("tender_naam,sector,omschrijving,cpv_codes")
        .eq("bedrijf_id", bedrijf_id)
        .order("jaar", desc=True)
        .limit(5)
        .execute()
    )
    referenties = ref_res.data or []

    # Tenders ophalen (actieve tenders van het bureau)
    max_t = min(body.max_tenders or 20, 50)
    tenderbureau_id = (
        current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
    )

    if body.tender_ids:
        tenders_res = (
            db.table("tenders")
            .select("id,projectnaam,aanbestedende_dienst,omschrijving,cpv_codes,waarde_geschat,einddatum,fase,tenderbureau_id")
            .in_("id", body.tender_ids[:max_t])
            .execute()
        )
    else:
        query = (
            db.table("tenders")
            .select("id,projectnaam,aanbestedende_dienst,omschrijving,cpv_codes,waarde_geschat,einddatum,fase,tenderbureau_id")
            .not_.in_("fase", ["archief", "gunning"])
            .limit(max_t)
        )
        if tenderbureau_id and not _is_super_admin(current_user):
            query = query.eq("tenderbureau_id", tenderbureau_id)
        tenders_res = query.execute()

    tenders = tenders_res.data or []

    if not tenders:
        return {"ok": True, "gescand": 0, "nieuwe_matches": 0, "matches": []}

    # Lookup-map voor denormalized opslag na de scan
    tender_map = {str(t["id"]): t for t in tenders}

    # Bouw prompt
    bedrijf_context = {
        "naam":               bedrijf.get("bedrijfsnaam"),
        "branche":            bedrijf.get("branche"),
        "competentieprofiel": bedrijf.get("competentieprofiel", ""),
        "cpv_codes":          bedrijf.get("cpv_codes", []),
        "min_contractwaarde": bedrijf.get("min_contractwaarde"),
        "max_contractwaarde": bedrijf.get("max_contractwaarde"),
        "geografische_focus": bedrijf.get("geografische_focus", []),
        "aanbestedende_diensten": bedrijf.get("aanbestedende_diensten", []),
        "referenties":        referenties,
    }

    prompt = f"""Beoordeel de match tussen onderstaand bedrijf en de opgegeven tenders.
Geef voor elke tender een match_score (0-100) en een score_breakdown met 4 subcategorieën (elk 0-25):

- competentie_match (0-25): hoe goed sluit de tender aan op kerncompetenties/branche
- cpv_overlap (0-25): overlap in CPV-codes of sector
- waarde_fit (0-25): past de contractwaarde bij de schaal van het bedrijf
- ervaring_relevantie (0-25): relevante referentieprojecten aanwezig

Bedrijfsprofiel:
{json.dumps(bedrijf_context, ensure_ascii=False, indent=2)}

Tenders om te beoordelen:
{json.dumps(tenders, ensure_ascii=False, indent=2)}

Retourneer UITSLUITEND dit JSON-formaat, geen uitleg:
{{
  "beoordelingen": [
    {{
      "tender_id": "uuid",
      "match_score": 82,
      "score_breakdown": {{
        "competentie_match": 22,
        "cpv_overlap": 18,
        "waarde_fit": 20,
        "ervaring_relevantie": 22
      }},
      "toelichting": "Korte reden (max 1 zin)"
    }}
  ]
}}"""

    raw = ""
    try:
        resp = await asyncio.to_thread(
            call_claude,
            messages=[{"role": "user", "content": prompt}],
            model=CLAUDE_MODEL,
            max_tokens=2000,
            system="Je bent een expert in aanbestedingen en bedrijfsmatching. Retourneer alleen valide JSON.",
            log_usage=False,
        )
        raw = resp.content[0].text.strip()
        data = json.loads(extraheer_json(raw))
        beoordelingen = data.get("beoordelingen", [])
    except json.JSONDecodeError as e:
        logger.error("JSON parse fout bij scan: %s | raw: %s", e, raw[:200])
        raise HTTPException(status_code=502, detail="AI retourneerde ongeldige JSON")
    except Exception as e:
        logger.error("Claude fout bij scan: %s", e)
        raise HTTPException(status_code=502, detail="AI-scan mislukt")

    # Sla matches op (upsert op bedrijf_id + tender_id, denormalized tenderinfo)
    nieuwe_matches = 0
    opgeslagen = []

    for b in beoordelingen:
        tender_id = b.get("tender_id")
        if not tender_id:
            continue
        totaalscore     = float(b.get("match_score", b.get("totaalscore", 0)))
        score_breakdown = b.get("score_breakdown", {})
        toelichting     = b.get("toelichting", "")
        score_breakdown["toelichting"] = toelichting

        # Tenderinfo denormalized opslaan vanuit tender_map
        t = tender_map.get(str(tender_id), {})
        waarde = t.get("waarde_geschat")

        record = {
            "bedrijf_id":          bedrijf_id,
            "tenderbureau_id":     t.get("tenderbureau_id") or tenderbureau_id,
            "tender_id":           str(tender_id),
            "tender_titel":        t.get("projectnaam"),
            "aanbestedende_dienst": t.get("aanbestedende_dienst"),
            "deadline":            t.get("einddatum"),
            "procedure":           t.get("fase"),
            "waarde_min":          float(waarde) if waarde is not None else None,
            "waarde_max":          float(waarde) if waarde is not None else None,
            "cpv_codes":           t.get("cpv_codes"),
            "regio":               None,          # intern tenders hebben geen regio-veld
            "tenderned_url":       None,
            "match_score":         totaalscore,
            "score_breakdown":     score_breakdown,
            "status":              "nieuw",
        }

        try:
            upsert_res = (
                db.table("tendersignalering_matches")
                .upsert(record, on_conflict="bedrijf_id,tender_id", ignore_duplicates=False)
                .execute()
            )
            if upsert_res.data:
                opgeslagen.append(upsert_res.data[0])
                nieuwe_matches += 1
        except Exception as e:
            logger.warning("Upsert mislukt voor tender %s: %s", tender_id, e)

    return {
        "ok":            True,
        "gescand":       len(tenders),
        "nieuwe_matches": nieuwe_matches,
        "matches":       opgeslagen,
    }


@router.put("/activeer/{bedrijf_id}")
async def toggle_signalering(
    bedrijf_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Toggle signalering_actief voor een bedrijf."""
    _check_toegang(db, bedrijf_id, current_user)

    bedrijf_res = (
        db.table("bedrijven")
        .select("signalering_actief")
        .eq("id", bedrijf_id)
        .limit(1)
        .execute()
    )
    if not bedrijf_res.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")

    huidig = bedrijf_res.data[0].get("signalering_actief", False)
    nieuw  = not huidig

    db.table("bedrijven").update({"signalering_actief": nieuw}).eq("id", bedrijf_id).execute()

    return {"ok": True, "signalering_actief": nieuw}


@router.post("/match-handmatig")
async def match_handmatig(
    body: HandmatigMatchRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Scoreer alle signalering-actieve bedrijven van het bureau tegen een handmatig ingevoerde
    aanbesteding tekst. Slaat resultaten op in tendersignalering_matches.
    Hergebruikt analyseer_aanbesteding() uit tendermatch en de 0-100 scoreringssystematiek
    van scan_tenders().
    """
    tekst = body.aanbesteding_tekst.strip()
    if not tekst or len(tekst) < 50:
        raise HTTPException(status_code=400, detail="Aanbesteding tekst te kort (minimaal 50 tekens)")

    # Fix 1: bureau_id eerst uit query param, dan uit current_user
    tenderbureau_id = (
        request.query_params.get("bureau_id")
        or current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
    )
    if not tenderbureau_id or tenderbureau_id == "None":
        raise HTTPException(status_code=400, detail="Geen bureau_id beschikbaar")

    # Signalering-actieve bedrijven van dit bureau ophalen
    bedrijf_query = (
        db.table("bedrijven")
        .select(
            "id,bedrijfsnaam,branche,plaats,competentieprofiel,cpv_codes,"
            "min_contractwaarde,max_contractwaarde,geografische_focus,aanbestedende_diensten"
        )
        .eq("signalering_actief", True)
    )
    if tenderbureau_id:
        rel_res = (
            db.table("bureau_bedrijf_relaties")
            .select("bedrijf_id")
            .eq("tenderbureau_id", tenderbureau_id)
            .execute()
        )
        bedrijf_ids_bureau = [r["bedrijf_id"] for r in (rel_res.data or [])]
        if bedrijf_ids_bureau:
            bedrijf_query = bedrijf_query.in_("id", bedrijf_ids_bureau)
        else:
            return {"matches_aangemaakt": 0, "bedrijven_gescand": 0, "analyse": {}, "matches": []}

    bedrijven = (bedrijf_query.execute().data or [])
    if not bedrijven:
        return {"matches_aangemaakt": 0, "bedrijven_gescand": 0, "analyse": {}, "matches": []}

    # Aanbesteding analyseren via Claude (hergebruikt uit tendermatch)
    try:
        analyse = await asyncio.to_thread(analyseer_aanbesteding, tekst)
    except Exception as e:
        logger.error("Analyse mislukt bij match-handmatig: %s", e)
        analyse = {}

    # Referenties ophalen en aan bedrijven hangen voor de helper
    bedrijf_ids = [str(b["id"]) for b in bedrijven]
    try:
        referenties_per_bedrijf = await asyncio.to_thread(haal_referenties_op, db, bedrijf_ids)
        for b in bedrijven:
            b["_referenties"] = referenties_per_bedrijf.get(str(b["id"]), [])
    except Exception as e:
        logger.warning("Referenties ophalen mislukt: %s", e)
        for b in bedrijven:
            b["_referenties"] = []

    # Instellingen laden voor wegingen + drempel
    instellingen = await _laad_instellingen(db, tenderbureau_id)

    # Scorering via Claude (gedeelde helper)
    beoordelingen = await _scoor_bedrijven_via_claude(bedrijven, analyse, tekst, instellingen)

    # Uniek tender-ID voor deze handmatige invoer (voor upsert-uniekheid)
    tender_id = str(uuid.uuid4())
    bedrijf_map = {str(b["id"]): b for b in bedrijven}

    # Tender-archief record aanmaken in tendersignalering_tenders
    ts_tender_id = None
    tender_record = {
        "tenderbureau_id":    tenderbureau_id,
        "tender_titel":       body.tender_titel or analyse.get("tender_naam") or "Onbekend",
        "aanbestedende_dienst": body.aanbestedende_dienst or analyse.get("aanbestedende_dienst"),
        "deadline":           body.deadline or analyse.get("deadline"),
        "procedure":          body.procedure or analyse.get("procedure"),
        "waarde_min":         body.waarde_min,
        "waarde_max":         body.waarde_max,
        "tenderned_url":      body.tenderned_url,
        "aanbesteding_tekst": tekst,
        "matches_count":      0,
        "ingevoerd_door":     current_user.get("id"),
    }
    try:
        ts_res = db.table("tendersignalering_tenders").insert(tender_record).execute()
        ts_tender_id = ts_res.data[0]["id"] if ts_res.data else None
    except Exception as e:
        logger.warning("Kon tender-archief record niet aanmaken: %s", e)
        ts_tender_id = None

    drempel = instellingen.get("drempel_opslaan", 0)

    # Sla matches op in tendersignalering_matches
    matches_aangemaakt = 0
    matches_output = []

    for b in beoordelingen:
        bedrijf_id = b.get("bedrijf_id")
        if not bedrijf_id:
            continue

        match_score     = float(b.get("match_score", 0))

        # Drempel toepassen
        if match_score < drempel:
            continue

        score_breakdown = b.get("score_breakdown", {})
        matchreden      = b.get("matchreden", "")
        score_breakdown["toelichting"] = matchreden

        bedrijf_info = bedrijf_map.get(str(bedrijf_id), {})

        record = {
            "bedrijf_id":          bedrijf_id,
            "tenderbureau_id":     tenderbureau_id,
            "tender_id":           tender_id,
            "ts_tender_id":        ts_tender_id,
            "tender_titel":        body.tender_titel or analyse.get("tender_naam"),
            "aanbestedende_dienst": body.aanbestedende_dienst or analyse.get("aanbestedende_dienst"),
            "deadline":            body.deadline or analyse.get("deadline"),
            "procedure":           body.procedure or analyse.get("procedure"),
            "waarde_min":          body.waarde_min,
            "waarde_max":          body.waarde_max,
            "cpv_codes":           analyse.get("cpv_codes"),
            "regio":               analyse.get("regio"),
            "tenderned_url":       body.tenderned_url,
            "match_score":         match_score,
            "score_breakdown":     score_breakdown,
            "status":              "nieuw",
        }

        try:
            ins_res = (
                db.table("tendersignalering_matches")
                .insert(record)
                .execute()
            )
            if ins_res.data:
                matches_aangemaakt += 1
                matches_output.append({
                    "bedrijf_id":   bedrijf_id,
                    "bedrijfsnaam": bedrijf_info.get("bedrijfsnaam", "Onbekend"),
                    "match_score":  match_score,
                    "matchreden":   matchreden,
                })
        except Exception as e:
            logger.warning("Insert mislukt voor bedrijf %s: %s", bedrijf_id, e)

    # matches_count bijwerken op het archief-record
    if ts_tender_id:
        try:
            db.table("tendersignalering_tenders").update({"matches_count": matches_aangemaakt}).eq("id", ts_tender_id).execute()
        except Exception as e:
            logger.warning("matches_count update mislukt: %s", e)

    return {
        "matches_aangemaakt": matches_aangemaakt,
        "bedrijven_gescand":  len(bedrijven),
        "ts_tender_id":       ts_tender_id,
        "analyse":            analyse,
        "matches":            sorted(matches_output, key=lambda x: -x["match_score"]),
    }


# ---------------------------------------------------------------------------
# Helper: instellingen laden (of defaults teruggeven)
# ---------------------------------------------------------------------------

async def _laad_instellingen(db: Client, bureau_id: str) -> dict:
    try:
        res = (
            db.table("tendersignalering_instellingen")
            .select("*")
            .eq("tenderbureau_id", bureau_id)
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]
    except Exception as e:
        logger.warning("Instellingen laden mislukt: %s", e)
    return dict(INSTELLINGEN_DEFAULTS)


# ---------------------------------------------------------------------------
# Helper: scoreer bedrijven via Claude (gedeeld door handmatig + hermatchen)
# ---------------------------------------------------------------------------

async def _scoor_bedrijven_via_claude(
    bedrijven: list,
    analyse: dict,
    tekst: str,
    wegingen: dict,
) -> list:
    """
    Roept Claude aan om elk bedrijf te scoren tegen de aanbesteding.
    Wegingen worden meegegeven als context in de prompt.
    Geeft lijst van beoordelingen terug of gooit HTTPException bij fout.
    """
    # Referenties ophalen voor context (geen db-toegang hier; roep apart aan)
    # bedrijven_context is al gebouwd door de aanroeper; hier bouwen we de prompt.
    bedrijven_context = [
        {
            "bedrijf_id":           str(b["id"]),
            "naam":                 b.get("bedrijfsnaam"),
            "branche":              b.get("branche"),
            "competentieprofiel":   b.get("competentieprofiel", ""),
            "cpv_codes":            b.get("cpv_codes", []),
            "min_contractwaarde":   b.get("min_contractwaarde"),
            "max_contractwaarde":   b.get("max_contractwaarde"),
            "geografische_focus":   b.get("geografische_focus", []),
            "referenties":          b.get("_referenties", [])[:3],
        }
        for b in bedrijven
    ]

    weging_tekst = (
        f"- vakinhoud/competenties: {wegingen.get('weging_vakinhoud', 35)} punten\n"
        f"- certificeringen: {wegingen.get('weging_certificeringen', 25)} punten\n"
        f"- regio/geografie: {wegingen.get('weging_regio', 20)} punten\n"
        f"- financiële schaal: {wegingen.get('weging_financieel', 12)} punten\n"
        f"- ervaring/referenties: {wegingen.get('weging_ervaring', 8)} punten"
    )

    prompt = f"""Je bent een aanbestedingsexpert. Beoordeel welke bedrijven het best passen bij de volgende aanbesteding.

Gebruik de volgende wegingen (totaal 100 punten = match_score):
{weging_tekst}

Geef voor elk bedrijf ook een score_breakdown met 4 subcategorieën (elk 0-25):
- competentie_match (0-25): hoe goed passen kerncompetenties/branche bij de aanbesteding
- cpv_overlap (0-25): overlap in CPV-codes of sectorkennis
- waarde_fit (0-25): contractwaarde passend bij schaal van het bedrijf
- ervaring_relevantie (0-25): relevante referentieprojecten aanwezig

Aanbesteding analyse:
{json.dumps(analyse, ensure_ascii=False, indent=2)}

Aanbesteding tekst (eerste 1500 tekens):
{tekst[:1500]}

Bedrijven om te beoordelen:
{json.dumps(bedrijven_context, ensure_ascii=False, indent=2)}

Retourneer UITSLUITEND dit JSON-formaat, geen uitleg:
{{
  "beoordelingen": [
    {{
      "bedrijf_id": "uuid",
      "match_score": 82,
      "score_breakdown": {{
        "competentie_match": 22,
        "cpv_overlap": 18,
        "waarde_fit": 20,
        "ervaring_relevantie": 22
      }},
      "matchreden": "Korte reden waarom dit bedrijf past (max 1 zin)"
    }}
  ]
}}"""

    max_tokens = min(max(4000, len(bedrijven) * 300 + 2000), 8000)

    raw = ""
    try:
        resp = await asyncio.to_thread(
            call_claude,
            messages=[{"role": "user", "content": prompt}],
            model=CLAUDE_MODEL,
            max_tokens=max_tokens,
            system=(
                "Je bent een expert in aanbestedingen en bedrijfsmatching. "
                "Retourneer UITSLUITEND een JSON object. "
                "Geen markdown backticks, geen uitleg, geen tekst buiten het JSON object. "
                "Begin direct met { en eindig met }."
            ),
            log_usage=False,
        )
        raw = resp.content[0].text.strip()
        data = json.loads(extraheer_json(raw))
        return data.get("beoordelingen", [])
    except json.JSONDecodeError as e:
        logger.error("JSON parse fout bij scorering: %s | raw: %s", e, raw[:200])
        raise HTTPException(status_code=502, detail="AI retourneerde ongeldige JSON")
    except Exception as e:
        logger.error("Claude fout bij scorering: %s", e)
        raise HTTPException(status_code=502, detail="AI-scorering mislukt")


# ---------------------------------------------------------------------------
# Instellingen endpoints
# ---------------------------------------------------------------------------

@router.get("/instellingen")
async def get_instellingen(
    bureau_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Haal de signalering-instellingen op voor het actieve bureau (of defaults)."""
    is_sa = _is_super_admin(current_user)
    effectief_bureau_id = bureau_id
    if not effectief_bureau_id and not is_sa:
        effectief_bureau_id = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
    if not effectief_bureau_id:
        raise HTTPException(status_code=400, detail="Bureau-id ontbreekt")

    instellingen = await _laad_instellingen(db, effectief_bureau_id)
    return {"bureau_id": effectief_bureau_id, "instellingen": instellingen}


@router.put("/instellingen")
async def put_instellingen(
    body: InstellingenRequest,
    bureau_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Sla de signalering-instellingen op voor het actieve bureau (upsert)."""
    is_sa = _is_super_admin(current_user)
    effectief_bureau_id = bureau_id
    if not effectief_bureau_id and not is_sa:
        effectief_bureau_id = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
    if not effectief_bureau_id:
        raise HTTPException(status_code=400, detail="Bureau-id ontbreekt")

    # Valideer som wegingen = 100
    som = (
        body.weging_vakinhoud + body.weging_certificeringen +
        body.weging_regio + body.weging_financieel + body.weging_ervaring
    )
    if som != 100:
        raise HTTPException(
            status_code=400,
            detail=f"Wegingen moeten optellen tot 100, nu {som}"
        )

    record = {
        "tenderbureau_id":     effectief_bureau_id,
        "weging_vakinhoud":    body.weging_vakinhoud,
        "weging_certificeringen": body.weging_certificeringen,
        "weging_regio":        body.weging_regio,
        "weging_financieel":   body.weging_financieel,
        "weging_ervaring":     body.weging_ervaring,
        "drempel_opslaan":     body.drempel_opslaan,
        "drempel_hoog":        body.drempel_hoog,
        "drempel_notificatie": body.drempel_notificatie,
        "bijgewerkt_door":     current_user.get("id"),
    }

    try:
        res = (
            db.table("tendersignalering_instellingen")
            .upsert(record, on_conflict="tenderbureau_id")
            .execute()
        )
        return {"ok": True, "instellingen": res.data[0] if res.data else record}
    except Exception as e:
        logger.error("Instellingen opslaan mislukt: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Tender archief endpoints
# ---------------------------------------------------------------------------

@router.get("/tenders")
async def get_tenders_archief(
    bureau_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Haal het tender-archief op voor het actieve bureau."""
    is_sa = _is_super_admin(current_user)
    effectief_bureau_id = bureau_id
    if not effectief_bureau_id and not is_sa:
        effectief_bureau_id = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
    if not effectief_bureau_id and not is_sa:
        raise HTTPException(status_code=400, detail="Bureau-id ontbreekt")

    query = (
        db.table("tendersignalering_tenders")
        .select("*")
        .order("created_at", desc=True)
    )
    if effectief_bureau_id:
        query = query.eq("tenderbureau_id", effectief_bureau_id)

    res = query.execute()
    return {"tenders": res.data or []}


@router.delete("/tenders/{tender_id}")
async def delete_tender_archief(
    tender_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """Verwijder een tender uit het archief (en alle bijbehorende matches via CASCADE)."""
    # Haal eerst op om bureau-check te doen
    res = (
        db.table("tendersignalering_tenders")
        .select("id,tenderbureau_id")
        .eq("id", tender_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Tender niet gevonden")

    bureau_id = res.data[0]["tenderbureau_id"]
    if not _is_super_admin(current_user):
        user_bureau = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
        if str(bureau_id) != str(user_bureau):
            raise HTTPException(status_code=403, detail="Geen toegang tot deze tender")

    db.table("tendersignalering_tenders").delete().eq("id", tender_id).execute()
    return {"ok": True}


@router.post("/tenders/{tender_id}/hermatchen")
async def hematchen_tender(
    tender_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Verwijder alle bestaande matches voor deze tender en scoor opnieuw
    alle signalering-actieve bedrijven van het bureau.
    """
    # Tender ophalen
    tender_res = (
        db.table("tendersignalering_tenders")
        .select("*")
        .eq("id", tender_id)
        .limit(1)
        .execute()
    )
    if not tender_res.data:
        raise HTTPException(status_code=404, detail="Tender niet gevonden")
    tender = tender_res.data[0]
    tenderbureau_id = tender["tenderbureau_id"]

    # Toegangscontrole
    if not _is_super_admin(current_user):
        user_bureau = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
        if str(tenderbureau_id) != str(user_bureau):
            raise HTTPException(status_code=403, detail="Geen toegang tot deze tender")

    # Bestaande matches voor dit ts_tender_id verwijderen
    db.table("tendersignalering_matches").delete().eq("ts_tender_id", tender_id).execute()

    # Signalering-actieve bedrijven van bureau ophalen
    rel_res = (
        db.table("bureau_bedrijf_relaties")
        .select("bedrijf_id")
        .eq("tenderbureau_id", tenderbureau_id)
        .execute()
    )
    bedrijf_ids_bureau = [r["bedrijf_id"] for r in (rel_res.data or [])]
    if not bedrijf_ids_bureau:
        return {"ok": True, "nieuwe_matches": 0}

    bedrijven_res = (
        db.table("bedrijven")
        .select(
            "id,bedrijfsnaam,branche,competentieprofiel,cpv_codes,"
            "min_contractwaarde,max_contractwaarde,geografische_focus"
        )
        .eq("signalering_actief", True)
        .in_("id", bedrijf_ids_bureau)
        .execute()
    )
    bedrijven = bedrijven_res.data or []
    if not bedrijven:
        return {"ok": True, "nieuwe_matches": 0}

    # Referenties laden en als _referenties aan elk bedrijf hangen
    bedrijf_ids = [str(b["id"]) for b in bedrijven]
    referenties_per_bedrijf = await asyncio.to_thread(haal_referenties_op, db, bedrijf_ids)
    for b in bedrijven:
        b["_referenties"] = referenties_per_bedrijf.get(str(b["id"]), [])

    # Instellingen laden
    instellingen = await _laad_instellingen(db, tenderbureau_id)
    drempel = instellingen.get("drempel_opslaan", 0)

    # Aanbesteding analyseren vanuit de opgeslagen tekst
    tekst = tender.get("aanbesteding_tekst", "")
    try:
        analyse = await asyncio.to_thread(analyseer_aanbesteding, tekst) if tekst else {}
    except Exception:
        analyse = {}

    # Scorering via Claude
    beoordelingen = await _scoor_bedrijven_via_claude(bedrijven, analyse, tekst, instellingen)

    # Uniek tender_id voor upsert (hergebruik origineel tender_id als tekst-hash)
    hermatchen_tender_id = f"ts_{tender_id}"

    nieuwe_matches = 0
    for b in beoordelingen:
        bedrijf_id = b.get("bedrijf_id")
        if not bedrijf_id:
            continue
        match_score = float(b.get("match_score", 0))
        if match_score < drempel:
            continue

        score_breakdown = b.get("score_breakdown", {})
        score_breakdown["toelichting"] = b.get("matchreden", "")

        record = {
            "bedrijf_id":          bedrijf_id,
            "tenderbureau_id":     tenderbureau_id,
            "tender_id":           hermatchen_tender_id,
            "ts_tender_id":        tender_id,
            "tender_titel":        tender.get("tender_titel"),
            "aanbestedende_dienst": tender.get("aanbestedende_dienst"),
            "deadline":            tender.get("deadline"),
            "procedure":           tender.get("procedure"),
            "waarde_min":          tender.get("waarde_min"),
            "waarde_max":          tender.get("waarde_max"),
            "cpv_codes":           tender.get("cpv_codes"),
            "regio":               tender.get("regio"),
            "tenderned_url":       tender.get("tenderned_url"),
            "match_score":         match_score,
            "score_breakdown":     score_breakdown,
            "status":              "nieuw",
        }

        try:
            upsert_res = (
                db.table("tendersignalering_matches")
                .upsert(record, on_conflict="bedrijf_id,tender_id", ignore_duplicates=False)
                .execute()
            )
            if upsert_res.data:
                nieuwe_matches += 1
        except Exception as e:
            logger.warning("Hermatchen upsert mislukt voor bedrijf %s: %s", bedrijf_id, e)

    # matches_count bijwerken
    try:
        db.table("tendersignalering_tenders").update({"matches_count": nieuwe_matches}).eq("id", tender_id).execute()
    except Exception as e:
        logger.warning("matches_count update mislukt bij hermatchen: %s", e)

    return {"ok": True, "nieuwe_matches": nieuwe_matches}


# ---------------------------------------------------------------------------
# Tender aanmaken vanuit match (AIDA flow)
# ---------------------------------------------------------------------------

@router.post("/matches/{match_id}/tender-aanmaken")
async def tender_aanmaken_van_match(
    match_id: str,
    body: TenderAanmakenRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async),
):
    """
    Maak een tender aan in de acquisitie funnel vanuit een tendersignalering match.
    Koppelt de aangemaakte tender terug aan de match via tenderzen_tender_id.
    """
    # 1. Haal match op
    match_res = (
        db.table("tendersignalering_matches")
        .select("id,tenderbureau_id,tenderzen_tender_id,aanbestedende_dienst,tender_titel,matchreden")
        .eq("id", match_id)
        .limit(1)
        .execute()
    )
    if not match_res.data:
        raise HTTPException(status_code=404, detail="Match niet gevonden")
    match = match_res.data[0]

    # Toegangscontrole via tenderbureau_id op de match
    if not _is_super_admin(current_user):
        user_bureau = (
            current_user.get("tenderbureau_id")
            or current_user.get("_original_tenderbureau_id")
        )
        if str(match["tenderbureau_id"]) != str(user_bureau):
            raise HTTPException(status_code=403, detail="Geen toegang tot deze match")

    # 2. Controleer of er al een tender is voor deze match
    if match.get("tenderzen_tender_id"):
        raise HTTPException(status_code=400, detail="Er is al een tender aangemaakt voor deze match")

    bureau_id = match["tenderbureau_id"]

    # 3. Tender aanmaken in de tenders tabel
    #    Gebruik de correcte kolomnamen uit de tenders tabel:
    #    naam, fase, aanbestedende_dienst, deadline_indiening,
    #    minimum_bedrag, maximum_bedrag, aanbestedingsprocedure, omschrijving
    tender_data = {
        "tenderbureau_id":    bureau_id,
        "naam":               body.tender_naam,
        "fase":               "acquisitie",
        "aanbestedende_dienst": body.aanbestedende_dienst or match.get("aanbestedende_dienst"),
        "omschrijving":       body.omschrijving or match.get("matchreden") or "",
        "bron":               "tendersignalering",
        "bron_url":           None,
    }
    if body.deadline:
        tender_data["deadline_indiening"] = body.deadline
    if body.waarde_min is not None:
        tender_data["minimum_bedrag"] = body.waarde_min
    if body.waarde_max is not None:
        tender_data["maximum_bedrag"] = body.waarde_max
    if body.procedure:
        tender_data["aanbestedingsprocedure"] = body.procedure

    # Verwijder None waarden voor schone insert
    tender_data = {k: v for k, v in tender_data.items() if v is not None}

    try:
        tender_res = db.table("tenders").insert(tender_data).execute()
    except Exception as e:
        logger.error("Tender insert mislukt: %s", e)
        raise HTTPException(status_code=500, detail="Tender aanmaken mislukt")

    if not tender_res.data:
        raise HTTPException(status_code=500, detail="Tender aanmaken mislukt — geen data terug")

    nieuwe_tender = tender_res.data[0]
    tender_id = nieuwe_tender["id"]

    # 4. Koppel tender terug aan match + status naar 'offerte'
    try:
        db.table("tendersignalering_matches").update({
            "tenderzen_tender_id":  tender_id,
            "tender_aangemaakt_op": datetime.utcnow().isoformat(),
            "status":               "offerte",
        }).eq("id", match_id).execute()
    except Exception as e:
        logger.warning("Match koppeling bijwerken mislukt: %s", e)

    return {
        "tender_id":    tender_id,
        "tender_naam":  nieuwe_tender.get("naam"),
        "boodschap":    f"Tender '{body.tender_naam}' aangemaakt in acquisitie funnel",
    }
