"""
ComplianceZen AI Norm-Extractie Service

Extraheert clausules uit norm-tekst met Claude.

KERNPRINCIPES:
- clausule_code is altijd de ORIGINELE code uit het normdocument — nooit genereren
- Titels zijn altijd de ORIGINELE bewoordingen uit de norm — nooit parafraseren
- Bij EN-norm: beschrijving vertaald naar NL, is_vertaling=True
- JSON extraheren via find('[') / rfind(']') patroon
"""

import json
import logging
from app.services.anthropic_service import call_claude

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-haiku-4-5-20251001"

EXTRACTIE_SYSTEM_PROMPT = """Je bent een expert in compliance en normstandaarden.
Je taak is clausules extraheren uit norm-documenten.

KRITIEKE REGELS — ALTIJD VOLGEN:
1. Clausule-codes kopieer je EXACT zoals ze in het document staan. Nooit aanpassen.
   Voorbeelden: "4.1", "8.1.2", "9.2", "A.5.1", "6.1.2.1"
2. Titels kopieer je EXACT zoals ze in het document staan.
3. Als het document Engels is, vertaal je de beschrijving naar Nederlands.
   Zet dan is_vertaling op true. De titel laat je in de originele taal.
4. Geef ALLEEN een JSON array terug — geen markdown, geen uitleg, geen preamble.
5. Neem alleen inhoudelijke clausules op (vereisten/controls).
   Sla inhoudsopgave, verwijzingen, bibliografie en introductieteksten over."""

EXTRACTIE_USER_PROMPT = """Extraheer alle clausules uit de volgende norm-tekst.

NORM: {norm_naam}

TEKST:
{tekst}

Geef een JSON array terug in dit exacte formaat:
[
  {{
    "clausule_code": "4.1",
    "titel": "Inzicht in de organisatie en haar context",
    "beschrijving": "De organisatie moet externe en interne kwesties bepalen...",
    "is_vertaling": false,
    "parent_code": null,
    "level": 1,
    "is_kritiek": false,
    "volgorde": 1
  }}
]

Regels:
- clausule_code: exact zoals in het document
- titel: exact zoals in het document
- beschrijving: originele tekst of NL-vertaling indien EN-norm
- is_vertaling: true als beschrijving een NL-vertaling is
- parent_code: code van de bovenliggende clausule of null
- level: 1 hoofdclausule, 2 sub, 3 sub-sub
- is_kritiek: true voor essentiële clausules (bij ISO 9001: 6.1, 8.1, 9.2)
- volgorde: oplopende integer"""


def extraheer_clausules_uit_tekst(
    norm_naam: str,
    tekst: str,
    max_tekens: int = 8000,
) -> list:
    """
    Stuur norm-tekst naar Claude en ontvang gestructureerde clausulelijst.

    Returns:
        Lijst van clausule-dicts klaar voor opslag in compliance_norm_requirements.
    """
    tekst_getrimd = tekst[:max_tekens]
    prompt = EXTRACTIE_USER_PROMPT.format(norm_naam=norm_naam, tekst=tekst_getrimd)

    response = call_claude(
        messages=[{"role": "user", "content": prompt}],
        model=CLAUDE_MODEL,
        max_tokens=4000,
        system=EXTRACTIE_SYSTEM_PROMPT,
        log_usage=False,
    )
    response_tekst = response.content[0].text

    # JSON array extraheren via find/rfind patroon
    start = response_tekst.find('[')
    einde = response_tekst.rfind(']')

    if start == -1 or einde == -1:
        raise ValueError(
            f"Claude gaf geen geldige JSON array terug. "
            f"Ontvangen: {response_tekst[:300]}"
        )

    try:
        clausules = json.loads(response_tekst[start:einde + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"Ongeldige JSON van Claude: {e}")

    gevalideerd = []
    for i, c in enumerate(clausules):
        if not c.get("clausule_code") or not c.get("titel"):
            continue
        gevalideerd.append({
            "clausule_code": str(c["clausule_code"]).strip(),
            "titel":         str(c["titel"]).strip(),
            "beschrijving":  c.get("beschrijving", ""),
            "is_vertaling":  bool(c.get("is_vertaling", False)),
            "parent_code":   c.get("parent_code"),
            "level":         int(c.get("level", 1)),
            "is_kritiek":    bool(c.get("is_kritiek", False)),
            "gewicht":       1.0,
            "volgorde":      int(c.get("volgorde", i + 1)),
        })

    logger.info(f"Norm-extractie '{norm_naam}': {len(gevalideerd)} clausules geëxtraheerd")
    return gevalideerd


def sla_norm_op_met_clausules(
    norm_data: dict,
    clausules: list,
    aangemaakt_door: str,
    db,
) -> dict:
    """
    Sla norm en clausules op na goedkeuring door compliance manager.

    Args:
        norm_data: {code, versie, naam, naam_kort, type, cycle_jaren,
                    drempel_score, taal, is_platform_template}
        clausules: output van extraheer_clausules_uit_tekst()
        aangemaakt_door: user_id
        db: Supabase service client

    Returns:
        {norm_id, clausules_opgeslagen, norm}
    """
    norm_result = db.table("compliance_normen").insert(
        {**norm_data, "aangemaakt_door": aangemaakt_door}
    ).execute()

    if not norm_result.data:
        raise ValueError("Norm kon niet worden opgeslagen")

    norm = norm_result.data[0]
    norm_id = norm["id"]

    if clausules:
        req_result = db.table("compliance_norm_requirements").insert(
            [{**c, "norm_id": norm_id} for c in clausules]
        ).execute()
        opgeslagen = len(req_result.data or [])
    else:
        opgeslagen = 0

    return {"norm_id": norm_id, "clausules_opgeslagen": opgeslagen, "norm": norm}
