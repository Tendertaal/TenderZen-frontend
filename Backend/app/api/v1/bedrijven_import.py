"""
Bedrijven Bulk Import API — TenderZen
SSE streaming endpoint voor het importeren van grote aantallen bedrijven via JSON.

Veldmapping (compacte keys → DB kolommen):
  n → bedrijfsnaam
  s → plaats
  c → branche
  r → tags (array)
  t → referentie count (int, indien > 0 → record in bedrijf_referenties)

Duplicaat check: case-insensitive bedrijfsnaam + plaats combinatie.
"""

import json
import logging
import asyncio
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import StreamingResponse
from supabase import Client
from app.core.database import get_supabase_admin
from app.core.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/bedrijven", tags=["bedrijven"])


def _sse_event(data: dict) -> str:
    """Formatteer een SSE event als string."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _stream_import(
    records: list[dict],
    db: Client,
    gebruiker_id: str,
) -> AsyncGenerator[str, None]:
    """
    Verwerk records één voor één en yield SSE events.

    Elke record kan de velden hebben:
      n (str)  — bedrijfsnaam
      s (str)  — plaats
      c (str)  — branche
      r (list) — tags
      t (int)  — aantal referenties (optioneel)
    """
    totaal = len(records)
    aangemaakt = 0
    overgeslagen = 0
    fouten = 0

    # Stap 1: laad bestaande (bedrijfsnaam, plaats) combinaties voor dup-check
    # We doen dit in één query aan het begin voor performance
    yield _sse_event({
        "type": "start",
        "totaal": totaal,
        "bericht": f"Import gestart: {totaal} records worden verwerkt..."
    })
    await asyncio.sleep(0)

    # Haal alle bestaande bedrijven op (naam+plaats) voor dup-check
    bestaande = set()
    try:
        pagina = 0
        batch_size = 1000
        while True:
            resp = db.table("bedrijven") \
                .select("bedrijfsnaam,plaats") \
                .range(pagina * batch_size, (pagina + 1) * batch_size - 1) \
                .execute()
            rijen = resp.data or []
            for r in rijen:
                key = (
                    (r.get("bedrijfsnaam") or "").strip().lower(),
                    (r.get("plaats") or "").strip().lower(),
                )
                bestaande.add(key)
            if len(rijen) < batch_size:
                break
            pagina += 1
    except Exception as e:
        logger.error(f"[import] Fout bij laden bestaande bedrijven: {e}")
        yield _sse_event({
            "type": "error",
            "bericht": f"Kon bestaande bedrijven niet laden: {str(e)}",
        })
        return

    yield _sse_event({
        "type": "voortgang",
        "verwerkt": 0,
        "totaal": totaal,
        "aangemaakt": 0,
        "overgeslagen": 0,
        "fouten": 0,
        "bericht": f"Duplicaatcontrole klaar: {len(bestaande)} bestaande bedrijven gevonden.",
    })
    await asyncio.sleep(0)

    # Stap 2: verwerk records in batches van 100
    BATCH = 100
    buffer: list[dict] = []

    async def flush_buffer():
        nonlocal aangemaakt, fouten
        if not buffer:
            return
        snapshot = list(buffer)
        try:
            resp = db.table("bedrijven").insert(snapshot).execute()
            ingevoegd = resp.data or []
            aangemaakt += len(ingevoegd)
        except Exception as e:
            logger.error(f"[import] Batch insert fout: {type(e).__name__}: {e}")
            fouten += len(snapshot)
        finally:
            buffer.clear()

    for idx, rec in enumerate(records, start=1):
        naam = (rec.get("n") or "").strip()
        plaats = (rec.get("s") or "").strip()
        branche = (rec.get("c") or "").strip() or None
        tags = rec.get("r") or []
        t_count = int(rec.get("t") or 0)

        if not naam:
            overgeslagen += 1
        else:
            key = (naam.lower(), (plaats or "").lower())
            if key in bestaande:
                overgeslagen += 1
            else:
                bestaande.add(key)
                row = {
                    "bedrijfsnaam": naam,
                    "is_actief": True,
                    "tender_count": t_count,
                    "plaats": plaats or None,
                    "branche": branche or None,
                    "tags": tags if isinstance(tags, list) and tags else None,
                }
                buffer.append(row)

        # Flush buffer elke BATCH records
        if len(buffer) >= BATCH:
            await flush_buffer()

        # Voortgandsupdate elke 100 records (niet op laatste: klaar-event doet dat)
        if idx % 100 == 0 and idx < totaal:
            yield _sse_event({
                "type": "voortgang",
                "verwerkt": idx,
                "totaal": totaal,
                "aangemaakt": aangemaakt,
                "overgeslagen": overgeslagen,
                "fouten": fouten,
                "bericht": f"{idx}/{totaal} verwerkt...",
            })
            await asyncio.sleep(0)

    # Flush resterende records (na de loop)
    await flush_buffer()

    # Eindrapportage
    yield _sse_event({
        "type": "klaar",
        "verwerkt": totaal,
        "totaal": totaal,
        "aangemaakt": aangemaakt,
        "overgeslagen": overgeslagen,
        "fouten": fouten,
        "bericht": f"Import voltooid: {aangemaakt} aangemaakt, {overgeslagen} overgeslagen, {fouten} fouten.",
    })


@router.post("/import/stream")
async def import_bedrijven_stream(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    """
    Bulk import van bedrijven via SSE streaming.

    Request body: JSON array van compacte bedrijfsobjecten:
      [{ "n": "Naam BV", "s": "Amsterdam", "c": "IT & Software", "r": ["tag1"], "t": 3 }, ...]

    Response: SSE stream met voortgandsevents (type: start | voortgang | klaar | error).
    """
    # Controleer super_admin rol
    rol = current_user.get("rol") or current_user.get("role") or ""
    if rol != "super_admin":
        raise HTTPException(status_code=403, detail="Alleen super-admin kan bedrijven importeren")

    gebruiker_id = str(current_user.get("id") or current_user.get("user_id") or "")

    # Admin client omzeilt RLS — auth is al gecontroleerd via get_current_user + rol check
    db = get_supabase_admin()

    # Lees body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Ongeldige JSON body")

    if not isinstance(body, list):
        raise HTTPException(status_code=400, detail="Body moet een JSON array zijn")

    if len(body) == 0:
        raise HTTPException(status_code=400, detail="Lege array ontvangen")

    if len(body) > 50_000:
        raise HTTPException(status_code=400, detail="Maximaal 50.000 records per import")

    generator = _stream_import(body, db, gebruiker_id)

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
