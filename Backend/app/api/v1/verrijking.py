"""
Verrijking API - TenderZen
Website scraping + AI verrijking voor bedrijven in de matchpool.
"""

import asyncio
import json
import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.database import get_supabase_admin
from app.core.dependencies import get_current_user
from app.services.anthropic_service import call_claude

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/verrijking", tags=["verrijking"])

CLAUDE_MODEL   = "claude-haiku-4-5-20251001"
HTTP_TIMEOUT   = 5
SCRAPE_TIMEOUT = 8
MAX_TEXT_CHARS = 4000
PAUZE_SECONDEN = 0.3

HTTP_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; TenderZen-bot/1.0)"}

OVER_ONS_PADEN = [
    "/over-ons", "/over", "/about", "/about-us",
    "/wie-zijn-wij", "/ons-verhaal", "/organisatie",
]

RECHTSVORMEN_PAT = r"\b(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|holding|beheer|groep|group|nederland|nl|inc|ltd)\b"
STOPWOORDEN = {"het", "de", "een", "van", "in", "en", "of", "op", "bij", "voor", "met", "door"}

PARKING_KEYWORDS = [
    "domain is for sale", "domeinnaam is te koop",
    "this domain is parked", "buy this domain",
    "deze domeinnaam is geregistreerd",
    "parked by", "under construction",
    "coming soon", "website in aanbouw",
    "domain parking",
]

# ── Global bulk job state ─────────────────────────────────────────────────────

_bulk_job: dict = {
    "actief":      False,
    "totaal":      0,
    "verwerkt":    0,
    "verrijkt":    0,
    "mislukt":     0,
    "gestart_op":  None,
    "gestopt_op":  None,
    "log":         [],
}

# ── Auth helper ───────────────────────────────────────────────────────────────

def _eis_super_admin(current_user: dict):
    rol = current_user.get("rol") or current_user.get("role") or ""
    if rol != "super_admin":
        raise HTTPException(status_code=403, detail="Alleen super-admin heeft toegang")

# ── Slug & URL kandidaten ─────────────────────────────────────────────────────

def _slugify(tekst: str) -> str:
    tekst = unicodedata.normalize("NFKD", tekst)
    tekst = tekst.encode("ascii", "ignore").decode("ascii")
    tekst = tekst.lower().strip()
    tekst = re.sub(r"[^\w\s-]", "", tekst)
    tekst = re.sub(r"[\s_]+", "-", tekst)
    return re.sub(r"-+", "-", tekst).strip("-")

def _genereer_url_kandidaten(naam: str, stad: str) -> list:
    basis = re.sub(RECHTSVORMEN_PAT, "", naam, flags=re.IGNORECASE).strip()
    slug  = _slugify(basis)

    # Strip leading digits (bijv. "19 Het Atelier" -> "het-atelier")
    slug = re.sub(r"^[\d-]+", "", slug).strip("-")

    woorden = [w for w in slug.split("-") if len(w) > 2]
    if not woorden:
        return []

    # Langste niet-stopwoord als primaire kern
    niet_stop = [w for w in woorden if w not in STOPWOORDEN]
    kern1 = max(niet_stop, key=len) if niet_stop else woorden[0]
    overig = [w for w in woorden if w != kern1 and w not in STOPWOORDEN]
    kern2 = f"{kern1}-{overig[0]}" if overig else kern1

    stad_slug = _slugify(stad) if stad else ""

    kandidaten = [
        f"https://www.{slug}.nl",
        f"https://{slug}.nl",
        f"https://www.{kern1}.nl",
        f"https://{kern1}.nl",
        f"https://www.{kern2}.nl",
        f"https://{kern2}.nl",
    ]
    if stad_slug:
        kandidaten.append(f"https://www.{kern1}-{stad_slug}.nl")
        kandidaten.append(f"https://{kern1}-{stad_slug}.nl")

    gezien: set = set()
    return [u for u in kandidaten if not (u in gezien or gezien.add(u))][:8]

# ── HTTP check ────────────────────────────────────────────────────────────────

async def _check_url(url: str, client: httpx.AsyncClient) -> bool:
    try:
        if (await client.head(url, timeout=HTTP_TIMEOUT)).status_code < 400:
            return True
    except Exception:
        pass
    try:
        return (await client.get(url, timeout=HTTP_TIMEOUT)).status_code < 400
    except Exception:
        return False

async def _vind_werkende_url(kandidaten: list, client: httpx.AsyncClient) -> Optional[str]:
    for url in kandidaten:
        if await _check_url(url, client):
            return url
    return None

# ── Parking page detectie ─────────────────────────────────────────────────────

def _is_parking_page(tekst: str) -> bool:
    tekst_lower = tekst.lower()
    return any(kw in tekst_lower for kw in PARKING_KEYWORDS)

# ── Scraping ──────────────────────────────────────────────────────────────────

def _extraheer_tekst(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "iframe"]):
        tag.decompose()
    return " ".join(soup.get_text(separator=" ").split())

async def _scrape_website(basis_url: str, client: httpx.AsyncClient) -> Optional[str]:
    basis_url = basis_url.rstrip("/")
    try:
        resp = await client.get(basis_url, timeout=SCRAPE_TIMEOUT)
        if resp.status_code >= 400:
            return None
        homepage = _extraheer_tekst(resp.text)
        if _is_parking_page(homepage) or len(homepage) < 100:
            return None
    except Exception:
        return None

    over_tekst = None
    for pad in OVER_ONS_PADEN:
        try:
            r2 = await client.get(basis_url + pad, timeout=SCRAPE_TIMEOUT)
            if r2.status_code < 400:
                t = _extraheer_tekst(r2.text)
                if t and not _is_parking_page(t):
                    over_tekst = t
                    break
        except Exception:
            continue

    gecombineerd = homepage[:2000] + (" " + over_tekst[:2000] if over_tekst else "")
    return gecombineerd[:MAX_TEXT_CHARS]

# ── Claude analyse ────────────────────────────────────────────────────────────

_CLAUDE_PROMPT = """\
Je bent een analist die bedrijfsinformatie structureert voor een aanbestedingsdatabase.

Analyseer de onderstaande website-tekst van het bedrijf "{naam}" uit "{stad}" (branche: {branche}).

Geef ALLEEN een JSON object terug (geen markdown, geen uitleg), met exact deze structuur:
{{
  "kernactiviteit": "1-2 zinnen: wat doet dit bedrijf concreet?",
  "sectoren": ["sector1", "sector2"],
  "klanten": "wie zijn de typische klanten/opdrachtgevers?",
  "werkgebied": "lokaal/regionaal/nationaal/internationaal",
  "organisatiegrootte": "ZZP/MKB/groot bedrijf/onbekend",
  "aanbestedingsrelevant": true,
  "trefwoorden": ["woord1", "woord2", "woord3"]
}}

Website tekst:
{tekst}"""


async def _vraag_claude(naam: str, stad: str, branche: str, tekst: str) -> Optional[dict]:
    prompt = _CLAUDE_PROMPT.format(
        naam=naam, stad=stad or "onbekend",
        branche=branche or "onbekend", tekst=tekst,
    )
    try:
        resp = await asyncio.to_thread(
            call_claude,
            messages=[{"role": "user", "content": prompt}],
            model=CLAUDE_MODEL,
            max_tokens=600,
            log_usage=False,
        )
        raw   = resp.content[0].text.strip()
        start = raw.find("{")
        eind  = raw.rfind("}") + 1
        if start == -1 or eind == 0:
            return None
        return json.loads(raw[start:eind])
    except Exception as e:
        logger.error(f"[verrijking] Claude fout: {e}")
        return None

# ── DB helpers ────────────────────────────────────────────────────────────────

def _sla_status_op(db, bedrijf_id: str, status: str, website: Optional[str] = None):
    update: dict = {
        "website_status":      status,
        "website_verrijkt_op": datetime.now(timezone.utc).isoformat(),
    }
    if website:
        update["website"] = website
    try:
        db.table("bedrijven").update(update).eq("id", bedrijf_id).execute()
    except Exception as e:
        logger.error(f"[verrijking] Status opslaan fout {bedrijf_id}: {e}")

# ── Verrijking pipeline ───────────────────────────────────────────────────────

async def _verrijk_bedrijf(bedrijf: dict) -> dict:
    """Volledige verrijkingspipeline. Slaat altijd op in DB."""
    naam    = (bedrijf.get("bedrijfsnaam") or "").strip()
    stad    = (bedrijf.get("plaats")       or "").strip()
    branche = (bedrijf.get("branche")      or "").strip()
    bid     = bedrijf["id"]
    bestaande_url = (bedrijf.get("website") or "").strip()
    db = get_supabase_admin()

    async with httpx.AsyncClient(verify=False, follow_redirects=True, headers=HTTP_HEADERS) as client:
        # Stap 1: URL vinden
        gevonden_url: Optional[str] = None
        if bestaande_url and bestaande_url.startswith("http"):
            if await _check_url(bestaande_url, client):
                gevonden_url = bestaande_url
        if not gevonden_url:
            kandidaten = _genereer_url_kandidaten(naam, stad)
            gevonden_url = await _vind_werkende_url(kandidaten, client)
        if not gevonden_url:
            _sla_status_op(db, bid, "geen_website")
            return {"id": bid, "status": "geen_website", "website": None,
                    "ai_omschrijving": None, "ai_omschrijving_json": None,
                    "fout": "Geen werkende URL gevonden"}

        # Stap 2: Scrapen
        tekst = await _scrape_website(gevonden_url, client)

    if not tekst:
        _sla_status_op(db, bid, "scrape_mislukt", website=gevonden_url)
        return {"id": bid, "status": "scrape_mislukt", "website": gevonden_url,
                "ai_omschrijving": None, "ai_omschrijving_json": None,
                "fout": "Scraping mislukt of parking page"}

    # Stap 3: Claude (buiten httpx context)
    ai_json = await _vraag_claude(naam, stad, branche, tekst)
    if not ai_json:
        _sla_status_op(db, bid, "ai_fout", website=gevonden_url)
        return {"id": bid, "status": "ai_fout", "website": gevonden_url,
                "ai_omschrijving": None, "ai_omschrijving_json": None,
                "fout": "Claude retourneerde geen geldig JSON"}

    # Stap 4: Opslaan
    update = {
        "website":              gevonden_url,
        "ai_omschrijving":      ai_json.get("kernactiviteit"),
        "ai_omschrijving_json": ai_json,
        "website_status":       "verrijkt",
        "website_verrijkt_op":  datetime.now(timezone.utc).isoformat(),
    }
    try:
        db.table("bedrijven").update(update).eq("id", bid).execute()
    except Exception as e:
        logger.error(f"[verrijking] DB opslaan fout voor {naam}: {e}")

    return {"id": bid, "status": "verrijkt", "website": gevonden_url,
            "ai_omschrijving": ai_json.get("kernactiviteit"),
            "ai_omschrijving_json": ai_json, "fout": None}

# ── Bulk job ──────────────────────────────────────────────────────────────────

def _log_bulk(bericht: str):
    now = datetime.now().strftime("%H:%M:%S")
    _bulk_job["log"].insert(0, f"[{now}] {bericht}")
    if len(_bulk_job["log"]) > 100:
        _bulk_job["log"] = _bulk_job["log"][:100]


async def _run_bulk_job(bedrijf_ids: list):
    db = get_supabase_admin()

    for bid in bedrijf_ids:
        if not _bulk_job["actief"]:
            break

        try:
            r = db.table("bedrijven") \
                .select("id,bedrijfsnaam,plaats,branche,website") \
                .eq("id", bid).limit(1).execute()
            if not r.data:
                _bulk_job["verwerkt"] += 1
                continue
            bedrijf = r.data[0]
        except Exception as e:
            logger.error(f"[bulk] Ophalen fout {bid}: {e}")
            _bulk_job["verwerkt"] += 1
            _bulk_job["mislukt"]  += 1
            continue

        naam = bedrijf.get("bedrijfsnaam", "?")
        try:
            res = await _verrijk_bedrijf(bedrijf)
            _bulk_job["verwerkt"] += 1
            if res["status"] == "verrijkt":
                _bulk_job["verrijkt"] += 1
                _log_bulk(f"[OK] {naam} — verrijkt")
            else:
                _bulk_job["mislukt"] += 1
                _log_bulk(f"[!!] {naam} — {res['status']}")
        except Exception as e:
            logger.error(f"[bulk] Verrijking fout {naam}: {e}")
            _bulk_job["verwerkt"] += 1
            _bulk_job["mislukt"]  += 1
            _log_bulk(f"[ERR] {naam} — onverwachte fout")

        await asyncio.sleep(PAUZE_SECONDEN)

    _bulk_job["actief"]     = False
    _bulk_job["gestopt_op"] = datetime.now(timezone.utc).isoformat()
    _log_bulk("=== Bulk job voltooid ===")

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

class BulkStartRequest(BaseModel):
    alleen_niet_verrijkt: bool = True
    ook_mislukte:         bool = False
    max_bedrijven:        Optional[int] = None


@router.get("/statistieken")
async def get_statistieken(current_user: dict = Depends(get_current_user)):
    _eis_super_admin(current_user)
    db = get_supabase_admin()

    try:
        totaal_r = db.table("bedrijven").select("id", count="exact").execute()
        totaal   = totaal_r.count or 0
    except Exception:
        totaal = 0

    stats: dict = {
        "totaal": totaal, "verrijkt": 0, "geen_website": 0,
        "scrape_mislukt": 0, "ai_fout": 0, "niet_verrijkt": totaal,
    }

    for status in ["verrijkt", "geen_website", "scrape_mislukt", "ai_fout", "niet_verrijkt"]:
        try:
            r = db.table("bedrijven").select("id", count="exact") \
                .eq("website_status", status).execute()
            stats[status] = r.count or 0
        except Exception:
            pass

    return stats


@router.get("/bedrijven")
async def get_bedrijven_lijst(
    status:     Optional[str] = None,
    zoek:       Optional[str] = None,
    pagina:     int = 1,
    per_pagina: int = 50,
    current_user: dict = Depends(get_current_user),
):
    _eis_super_admin(current_user)
    per_pagina = min(per_pagina, 100)
    offset = (pagina - 1) * per_pagina
    db = get_supabase_admin()

    try:
        query = db.table("bedrijven").select(
            "id,bedrijfsnaam,plaats,branche,website,website_status,website_verrijkt_op,ai_omschrijving",
            count="exact",
        )
        if status:
            query = query.eq("website_status", status)
        if zoek:
            query = query.or_(f"bedrijfsnaam.ilike.%{zoek}%,plaats.ilike.%{zoek}%")

        query = query.order("bedrijfsnaam").range(offset, offset + per_pagina - 1)
        resp  = query.execute()
        totaal = resp.count or 0

        return {
            "bedrijven":  resp.data or [],
            "totaal":     totaal,
            "pagina":     pagina,
            "per_pagina": per_pagina,
            "paginas":    max(1, -(-totaal // per_pagina)),
        }
    except Exception as e:
        logger.error(f"[verrijking] Bedrijven lijst fout: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bedrijf/{bedrijf_id}")
async def verrijk_een_bedrijf(
    bedrijf_id:   str,
    current_user: dict = Depends(get_current_user),
):
    _eis_super_admin(current_user)
    db = get_supabase_admin()

    r = db.table("bedrijven") \
        .select("id,bedrijfsnaam,plaats,branche,website") \
        .eq("id", bedrijf_id).limit(1).execute()

    if not r.data:
        raise HTTPException(status_code=404, detail="Bedrijf niet gevonden")

    res = await _verrijk_bedrijf(r.data[0])
    return {
        "succes":           res["status"] == "verrijkt",
        "status":           res["status"],
        "website":          res["website"],
        "ai_omschrijving":  res["ai_omschrijving"],
        "ai_omschrijving_json": res["ai_omschrijving_json"],
        "fout":             res["fout"],
    }


@router.post("/bulk-start")
async def bulk_start(
    body:         BulkStartRequest,
    current_user: dict = Depends(get_current_user),
):
    _eis_super_admin(current_user)

    if _bulk_job["actief"]:
        raise HTTPException(status_code=409, detail="Er is al een bulk job actief")

    db    = get_supabase_admin()
    query = db.table("bedrijven").select("id")

    if body.alleen_niet_verrijkt and not body.ook_mislukte:
        query = query.eq("website_status", "niet_verrijkt")
    elif body.alleen_niet_verrijkt and body.ook_mislukte:
        query = query.in_("website_status",
                          ["niet_verrijkt", "geen_website", "scrape_mislukt", "ai_fout"])
    elif body.ook_mislukte:
        query = query.in_("website_status",
                          ["geen_website", "scrape_mislukt", "ai_fout"])

    if body.max_bedrijven:
        query = query.limit(body.max_bedrijven)

    resp = query.execute()
    ids  = [r["id"] for r in (resp.data or [])]

    if not ids:
        return {"gestart": False, "te_verwerken": 0, "bericht": "Geen bedrijven te verwerken"}

    _bulk_job.update({
        "actief":     True,
        "totaal":     len(ids),
        "verwerkt":   0,
        "verrijkt":   0,
        "mislukt":    0,
        "gestart_op": datetime.now(timezone.utc).isoformat(),
        "gestopt_op": None,
        "log":        [],
    })
    _log_bulk(f"=== Bulk job gestart: {len(ids)} bedrijven ===")

    asyncio.create_task(_run_bulk_job(ids))

    return {"gestart": True, "te_verwerken": len(ids)}


@router.post("/bulk-stop")
async def bulk_stop(current_user: dict = Depends(get_current_user)):
    _eis_super_admin(current_user)
    _bulk_job["actief"] = False
    _log_bulk("=== Job handmatig gestopt ===")
    return {"gestopt": True}


@router.get("/bulk-status")
async def bulk_status(current_user: dict = Depends(get_current_user)):
    _eis_super_admin(current_user)

    verwerkt = _bulk_job["verwerkt"]
    totaal   = _bulk_job["totaal"]
    pct      = round(verwerkt / totaal * 100) if totaal else 0

    eta: Optional[int] = None
    if _bulk_job["actief"] and _bulk_job["gestart_op"] and verwerkt > 0:
        try:
            gestart = datetime.fromisoformat(_bulk_job["gestart_op"])
            elapsed = (datetime.now(timezone.utc) - gestart).total_seconds()
            gem_per = elapsed / verwerkt
            eta     = round(gem_per * (totaal - verwerkt))
        except Exception:
            pass

    return {
        "actief":       _bulk_job["actief"],
        "totaal":       totaal,
        "verwerkt":     verwerkt,
        "verrijkt":     _bulk_job["verrijkt"],
        "mislukt":      _bulk_job["mislukt"],
        "percentage":   pct,
        "gestart_op":   _bulk_job["gestart_op"],
        "eta_seconden": eta,
        "log":          _bulk_job["log"],
    }
