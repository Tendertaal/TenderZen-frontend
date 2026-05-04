"""
Tendermatch API endpoint — TenderZen
Matching engine die live Supabase bedrijven query gebruikt + sessie persistentie.
"""

import json
import logging
import re
import traceback
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client
from app.core.database import get_supabase_async
from app.core.dependencies import get_current_user
from app.services.anthropic_service import call_claude

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/tendermatch", tags=["tendermatch"])


class MatchRequest(BaseModel):
    aanbesteding_tekst: str
    tenderbureau_id: str | None = None


# ── Sessie titel genereren ────────────────────────────────────────────────────
def genereer_sessie_titel(tekst: str, analyse: dict) -> str:
    """Genereer een korte sessietitel op basis van de analyse."""
    omschrijving = analyse.get("omschrijving", "").strip()
    if omschrijving:
        titel = omschrijving[:60].rstrip()
        if len(omschrijving) > 60:
            titel += "..."
        return titel
    sectoren = ", ".join(analyse.get("sectoren", []))
    regio = analyse.get("regio") or "landelijk"
    if sectoren:
        return f"{sectoren} — {regio}"
    return (tekst[:60].rstrip() + "...") if len(tekst) > 60 else tekst


# ── Stap 1: Analyseer aanbesteding via Claude ─────────────────────────────────
def analyseer_aanbesteding(tekst: str) -> dict:
    prompt = f"""Analyseer deze Nederlandse aanbesteding. Geef ALLEEN een JSON object terug, geen markdown, geen uitleg.

AANBESTEDING:
{tekst[:3000]}

Geef terug:
{{
  "omschrijving": "één zin: wat voor bedrijf zoek je precies",
  "sectoren": ["1 of 2 meest relevante branches"],
  "regio": "stad of regio of null voor landelijk",
  "certificeringen": ["vereiste certificeringen als array, leeg als geen"],
  "minimale_omzet": null,
  "trefwoorden": ["6 kernwoorden uit de opdracht"],
  "zoektermen": ["3 korte zoektermen voor bedrijfsnamen"],
  "tender_naam": "officiële naam van de aanbesteding, max 80 tekens",
  "aanbestedende_dienst": "naam van de aanbestedende organisatie of null",
  "deadline": "sluitingsdatum in YYYY-MM-DD formaat of null",
  "cpv_codes": ["CPV codes als strings, bijv. '79600000-0'"],
  "procedure": "openbaar/niet-openbaar/onderhandeling/meervoudig onderhands of null",
  "type_opdracht": "diensten/leveringen/werken of null",
  "aard_opdracht": "raamovereenkomst/enkelvoudig/concessie of null",
  "tenderned_kenmerk": "het TenderNed-kenmerk nummer als string of null",
  "referentienummer": "het referentienummer als string of null",
  "tenderned_url": null
}}

Beschikbare branches (gebruik exact deze waarden):
Bouw & Infra, IT & Software, Zorg & Gezondheid, Groen & Milieu,
Energie & Utiliteit, Logistiek & Transport, Beveiliging & Veiligheid,
Facilitair & Services, Onderwijs & Training, HR & Recruitment,
Advies & Consultancy, Financieel & Juridisch, Industrie & Productie,
Handel & Retail, Overheid & Non-profit."""

    response = call_claude(
        messages=[{"role": "user", "content": prompt}],
        model="claude-haiku-4-5-20251001",
        max_tokens=900,
        system="Je antwoordt ALTIJD met alleen valid JSON. Geen markdown backticks. Geen uitleg.",
        log_usage=False,
    )
    text = response.content[0].text.strip()
    text = re.sub(r'```json|```', '', text).strip()
    start = text.find('{')
    end = text.rfind('}') + 1
    if start == -1 or end == 0:
        raise ValueError(f"Geen JSON object gevonden in response: {text[:200]}")
    text = text[start:end]
    return json.loads(text)


# ── Stap 2: Filter bedrijven uit Supabase ─────────────────────────────────────
def filter_bedrijven(analyse: dict, bedrijven: list) -> list:
    sectoren = set(analyse.get("sectoren", []))
    regio = (analyse.get("regio") or "").lower()
    zoektermen = [z.lower() for z in analyse.get("zoektermen", [])]
    trefwoorden = [t.lower() for t in analyse.get("trefwoorden", [])]
    cert_vereist = [c.lower() for c in analyse.get("certificeringen", [])]

    kandidaten = []
    for b in bedrijven:
        score = 0
        naam_lower = (b.get("bedrijfsnaam") or "").lower()
        branche = b.get("branche") or ""
        plaats_lower = (b.get("plaats") or "").lower()
        bedrijf_tags = [t.lower() for t in (b.get("tags") or [])]
        bedrijf_certs = [c.lower() for c in (b.get("certificeringen") or [])]

        if branche in sectoren:
            score += 4

        if regio and regio in plaats_lower:
            score += 3
        elif not regio:
            score += 1

        for cert in cert_vereist:
            if any(cert in bc for bc in bedrijf_certs):
                score += 3
                break

        for term in zoektermen + trefwoorden:
            if len(term) > 3 and (term in naam_lower or term in bedrijf_tags):
                score += 2
                break

        if score >= 2:
            kandidaten.append({**b, "_voorlopig_score": score})

    kandidaten.sort(key=lambda x: -x["_voorlopig_score"])
    return kandidaten[:50]


# ── Stap 3: Referenties ophalen per bedrijf ───────────────────────────────────
def haal_referenties_op(db, bedrijf_ids: list) -> dict:
    """
    Haal referenties op voor een lijst van bedrijf IDs.
    Geeft een dict terug: {bedrijf_id (str): [referenties]}
    """
    if not bedrijf_ids:
        return {}

    try:
        result = db.table("bedrijf_referenties") \
            .select(
                "bedrijf_id, tender_naam, opdrachtgever, jaar, "
                "waarde, gewonnen, sector, regio, omschrijving"
            ) \
            .in_("bedrijf_id", bedrijf_ids) \
            .order("jaar", desc=True) \
            .limit(200) \
            .execute()

        referenties_per_bedrijf: dict = {}
        for ref in (result.data or []):
            bid = str(ref["bedrijf_id"])
            referenties_per_bedrijf.setdefault(bid, []).append(ref)
        return referenties_per_bedrijf
    except Exception as e:
        logger.warning(f"[tendermatch] Referenties ophalen mislukt: {e}")
        return {}


# ── Stap 4: Claude scoort de kandidaten (uitgebreid met referenties) ──────────
def scoor_kandidaten(
    aanbesteding_tekst: str,
    analyse: dict,
    kandidaten: list,
    referenties_per_bedrijf: dict = None,
) -> list:
    """
    Stuur kandidaten naar Claude voor scoring met uitgebreide analyse.
    Includeert referentiehistorie en certificeringen per kandidaat.
    """
    if not kandidaten:
        return []

    if referenties_per_bedrijf is None:
        referenties_per_bedrijf = {}

    cert_vereist = analyse.get("certificeringen", [])

    # Bouw kandidatenblokken met referenties
    kandidaat_blokken = []
    for i, b in enumerate(kandidaten[:30]):  # Max 30 voor kwaliteit
        bedrijf_id = str(b.get("id", ""))
        refs = referenties_per_bedrijf.get(bedrijf_id, [])

        # Certificeringen check
        bedrijf_certs = [c.lower() for c in (b.get("certificeringen") or [])]
        cert_status = []
        for cert in cert_vereist:
            heeft = any(cert.lower() in bc for bc in bedrijf_certs)
            cert_status.append(f"{'✓' if heeft else '✗'} {cert}")

        # Referenties samenvatting (max 3)
        ref_regels = []
        for ref in refs[:3]:
            gewonnen = "✓" if ref.get("gewonnen") else ("✗" if ref.get("gewonnen") is False else "?")
            jaar = ref.get("jaar", "")
            naam = (ref.get("tender_naam") or "")[:60]
            waarde = f"€{ref.get('waarde'):,.0f}" if ref.get("waarde") else ""
            ref_regels.append(f"  {gewonnen} {jaar} — {naam} {waarde}".rstrip())

        blok = f"""KANDIDAAT {i+1}: {b['bedrijfsnaam']}
Branche: {b.get('branche', '—')} | Plaats: {b.get('plaats', '—')}
Certificeringen: {', '.join(b.get('certificeringen') or []) or 'geen bekend'}
Certificeringen check: {' | '.join(cert_status) if cert_status else 'geen eisen'}
Referenties ({len(refs)} totaal):
{chr(10).join(ref_regels) if ref_regels else '  Geen referenties bekend'}"""
        kandidaat_blokken.append(blok)

    prompt = f"""Je bent acquisitie-expert voor een tenderburo. Analyseer welke bedrijven het meest geschikt zijn om in te schrijven op deze aanbesteding.

AANBESTEDING:
{aanbesteding_tekst[:1000]}

ANALYSE:
Sector: {', '.join(analyse.get('sectoren', []))}
Regio: {analyse.get('regio') or 'landelijk'}
Vereiste certificeringen: {', '.join(cert_vereist) or 'geen specifiek'}
Omschrijving: {analyse.get('omschrijving', '')}

KANDIDATEN OM TE BEOORDELEN:
{chr(10).join(kandidaat_blokken)}

Beoordeel elk kandidaat op vier criteria en geef een totaalscore.
Geef ALLEEN een JSON array terug, geen markdown, geen uitleg buiten de JSON:

[
  {{
    "naam": "exacte naam van de kandidaat",
    "score": 1-10,
    "aanbevolen": true of false,
    "score_breakdown": {{
      "sector": {{
        "score": 0-3,
        "max": 3,
        "reden": "max 15 woorden waarom deze score"
      }},
      "regio": {{
        "score": 0-2,
        "max": 2,
        "reden": "max 15 woorden waarom deze score"
      }},
      "certificeringen": {{
        "score": 0-3,
        "max": 3,
        "reden": "max 15 woorden waarom deze score"
      }},
      "referenties": {{
        "score": 0-2,
        "max": 2,
        "reden": "max 20 woorden: noem specifieke relevante referenties als die er zijn"
      }}
    }},
    "matchingsadvies": "2-3 zinnen: waarom is dit bedrijf wel of niet geschikt? Wat zijn de sterke punten en zwakke punten voor deze specifieke opdracht?",
    "reden": "max 12 woorden samenvatting voor in de kandidatenlijst"
  }}
]

Scoringsrichtlijnen:
- Sector (0-3): 3=perfecte match, 2=gerelateerd, 1=indirect relevant, 0=geen match
- Regio (0-2): 2=zelfde regio/stad, 1=aangrenzend/landelijk, 0=verkeerde regio
- Certificeringen (0-3): 3=alle vereiste certs aanwezig, 2=meeste aanwezig, 1=deels, 0=geen
- Referenties (0-2): 2=aantoonbaar vergelijkbare gewonnen opdrachten, 1=gerelateerd, 0=geen
- aanbevolen=true als totaalscore >= 6 EN sector score >= 2"""

    response = call_claude(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system="Je antwoordt ALTIJD met alleen een valid JSON array. Geen markdown backticks. Geen uitleg buiten de JSON.",
        messages=[{"role": "user", "content": prompt}],
        log_usage=False,
    )

    text = response.content[0].text.strip()
    text = re.sub(r'```json|```', '', text).strip()
    start = text.find('[')
    end = text.rfind(']') + 1
    if start == -1 or end == 0:
        raise ValueError(f"Geen JSON array gevonden in response: {text[:200]}")
    text = text[start:end]
    scored = json.loads(text)

    naam_index = {b["bedrijfsnaam"]: b for b in kandidaten}
    result = []
    for item in scored:
        db_item = naam_index.get(item["naam"], {})
        bedrijf_id = str(db_item.get("id", "")) if db_item.get("id") else None
        refs = referenties_per_bedrijf.get(bedrijf_id, []) if bedrijf_id else []

        result.append({
            "bedrijf_id":        bedrijf_id,
            "bedrijfsnaam":      item["naam"],
            "match_score":       item["score"],
            "match_reden":       item.get("reden", ""),
            "aanbevolen":        item.get("aanbevolen", False),
            "score_breakdown":   item.get("score_breakdown", {}),
            "matchingsadvies":   item.get("matchingsadvies", ""),
            "branche":           db_item.get("branche", ""),
            "plaats":            db_item.get("plaats", ""),
            "certificeringen":   db_item.get("certificeringen") or [],
            "contact_email":     db_item.get("contact_email", ""),
            "contact_telefoon":  db_item.get("contact_telefoon", ""),
            "website":           db_item.get("website", ""),
            "aantal_referenties": len(refs),
        })

    return sorted(result, key=lambda x: -x["match_score"])


# ── Hoofd match endpoint ───────────────────────────────────────────────────────
@router.post("/match")
async def match_tender(
    body: MatchRequest,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    tenderbureau_id = (
        current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
        or body.tenderbureau_id
    )
    if not tenderbureau_id:
        raise HTTPException(status_code=400, detail="Geen tenderbureau_id gevonden")

    tekst = body.aanbesteding_tekst.strip()
    if not tekst or len(tekst) < 50:
        raise HTTPException(status_code=400, detail="Aanbesteding tekst te kort (minimaal 50 tekens)")

    try:
        # Bedrijven ophalen via koppeltabel
        relaties = db.table("bureau_bedrijf_relaties") \
            .select("bedrijf_id") \
            .eq("tenderbureau_id", tenderbureau_id) \
            .eq("status", "actief") \
            .execute()

        bedrijf_ids = [r["bedrijf_id"] for r in (relaties.data or [])]

        if not bedrijf_ids:
            return {
                "sessie_id": None,
                "analyse": {},
                "shortlist": [],
                "kandidaten_gevonden": 0,
                "bedrijven_in_database": 0,
                "bericht": "Geen actieve bedrijven gekoppeld aan dit bureau"
            }

        result = db.table("bedrijven") \
            .select("id,bedrijfsnaam,branche,plaats,certificeringen,tags,omzet_categorie,contact_email,contact_telefoon,website") \
            .in_("id", bedrijf_ids) \
            .eq("is_actief", True) \
            .execute()

        bedrijven = result.data or []
        if not bedrijven:
            return {
                "sessie_id": None,
                "analyse": {},
                "shortlist": [],
                "kandidaten_gevonden": 0,
                "bedrijven_in_database": 0,
                "bericht": "Geen actieve bedrijven gevonden in uw database"
            }

        # Matching pipeline
        analyse = analyseer_aanbesteding(tekst)
        kandidaten = filter_bedrijven(analyse, bedrijven)

        # Referenties ophalen voor de top-30 kandidaten
        bedrijf_ids = [str(k["id"]) for k in kandidaten[:30] if k.get("id")]
        referenties_per_bedrijf = haal_referenties_op(db, bedrijf_ids)

        shortlist = scoor_kandidaten(tekst, analyse, kandidaten, referenties_per_bedrijf)

        # Sessie aanmaken
        titel = genereer_sessie_titel(tekst, analyse)
        sessie_id = str(uuid.uuid4())
        db.table("tendermatch_sessies").insert({
            "id": sessie_id,
            "tenderbureau_id": tenderbureau_id,
            "titel": titel,
            "aanbesteding_tekst": tekst[:2000],
            "analyse_json": analyse,
            "status": "open",
            "kandidaten_count": len(shortlist),
            "created_by": current_user.get("id"),
        }).execute()

        # Kandidaten opslaan gekoppeld aan sessie
        if shortlist:
            records = [
                {
                    "sessie_id":       sessie_id,
                    "tenderbureau_id": tenderbureau_id,
                    "bedrijf_id":      item.get("bedrijf_id"),
                    "bedrijfsnaam":    item["bedrijfsnaam"],
                    "match_score":     item["match_score"],
                    "match_reden":     item["match_reden"],
                    "score_breakdown": item.get("score_breakdown"),
                    "matchingsadvies": item.get("matchingsadvies"),
                    "aanbevolen":      item.get("aanbevolen", False),
                    "status":          "zoeken_bedrijf",
                    "aanbesteding_tekst": tekst[:1000],
                    "analyse_json":    analyse,
                    "created_by":      current_user.get("id"),
                }
                for item in shortlist
            ]
            db.table("tendermatch_kandidaten").insert(records).execute()

        return {
            "sessie_id": sessie_id,
            "titel": titel,
            "analyse": analyse,
            "shortlist": shortlist,
            "kandidaten_gevonden": len(kandidaten),
            "bedrijven_in_database": len(bedrijven),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[tendermatch] ONVERWACHTE FOUT: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Acquisitie statussen ophalen ──────────────────────────────────────────────
@router.get("/acquisitie-statussen")
async def get_acquisitie_statussen(
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    """Haal acquisitie fase statussen op uit fase_statussen tabel."""
    try:
        result = db.table("fase_statussen") \
            .select("status_key, status_display, volgorde") \
            .eq("fase", "acquisitie") \
            .eq("is_aktief", True) \
            .order("volgorde") \
            .execute()
        statussen = result.data or []
    except Exception as e:
        logger.error(f"[tendermatch] fase_statussen ophalen fout: {e}")
        statussen = []

    # Voeg afgewezen toe als extra optie (geen fase_status maar wel nodig voor kandidaat flow)
    keys = {s["status_key"] for s in statussen}
    if "afgewezen" not in keys:
        statussen.append({
            "status_key": "afgewezen",
            "status_display": "Afgewezen",
            "volgorde": 99
        })
    return statussen


# ── Sessies ophalen ────────────────────────────────────────────────────────────
@router.get("/sessies")
async def get_sessies(
    bureau_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    tenderbureau_id = (
        current_user.get("tenderbureau_id")
        or current_user.get("_original_tenderbureau_id")
        or bureau_id
    )
    if not tenderbureau_id:
        raise HTTPException(status_code=400, detail="Geen tenderbureau_id gevonden")

    try:
        result = db.table("tendermatch_sessies") \
            .select("id,titel,status,kandidaten_count,analyse_json,aanbesteding_tekst,created_at,updated_at") \
            .eq("tenderbureau_id", tenderbureau_id) \
            .order("created_at", desc=True) \
            .limit(50) \
            .execute()
        return result.data or []
    except Exception as e:
        logger.error(f"[tendermatch] GET sessies fout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Kandidaten van sessie ophalen ──────────────────────────────────────────────
@router.get("/sessies/{sessie_id}/kandidaten")
async def get_sessie_kandidaten(
    sessie_id: str,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    try:
        result = db.table("tendermatch_kandidaten") \
            .select("*") \
            .eq("sessie_id", sessie_id) \
            .order("match_score", desc=True) \
            .execute()
        return result.data or []
    except Exception as e:
        logger.error(f"[tendermatch] GET kandidaten fout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Sessie status updaten ──────────────────────────────────────────────────────
@router.patch("/sessies/{sessie_id}/status")
async def update_sessie_status(
    sessie_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    nieuwe_status = body.get("status")
    geldige_statussen = ["open", "geconverteerd", "gesloten"]
    if nieuwe_status not in geldige_statussen:
        raise HTTPException(status_code=400, detail=f"Ongeldige status: {nieuwe_status}")

    try:
        db.table("tendermatch_sessies") \
            .update({"status": nieuwe_status}) \
            .eq("id", sessie_id) \
            .execute()
        return {"status": nieuwe_status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Kandidaat tender_id linken ─────────────────────────────────────────────────
@router.patch("/kandidaat/{kandidaat_id}/tender")
async def link_kandidaat_tender(
    kandidaat_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    tender_id = body.get("tender_id")
    if not tender_id:
        raise HTTPException(status_code=400, detail="tender_id ontbreekt")

    try:
        db.table("tendermatch_kandidaten") \
            .update({"tender_id": tender_id, "status": "offerte"}) \
            .eq("id", kandidaat_id) \
            .execute()
        return {"tender_id": tender_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Kandidaat status update ────────────────────────────────────────────────────
@router.patch("/kandidaat/{kandidaat_id}/status")
async def update_kandidaat_status(
    kandidaat_id: str,
    body: dict,
    current_user: dict = Depends(get_current_user),
    db: Client = Depends(get_supabase_async)
):
    nieuwe_status = body.get("status")
    if not nieuwe_status:
        raise HTTPException(status_code=400, detail="status ontbreekt")

    db.table("tendermatch_kandidaten") \
        .update({"status": nieuwe_status}) \
        .eq("id", kandidaat_id) \
        .execute()

    return {"status": nieuwe_status}
