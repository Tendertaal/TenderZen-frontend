"""
ComplianceZen Scoringmotor

R01: Control score = (status / 4.0) * clausule_gewicht
     Norm score = gewogen gemiddelde van alle control scores * 100
     Realtime herberekening bij elke statuswijziging

R02: Exporteerbaar als:
     - norm_score >= drempel (standaard 60%)
     - geen kritieke clausule met status < 2
"""

from typing import Optional
from dataclasses import dataclass


@dataclass
class ControlScore:
    control_id: str
    status: int
    gewicht: float
    clausule_code: str
    is_kritiek: bool


@dataclass
class NormScoreResultaat:
    norm_score: float
    exporteerbaar: bool
    blokkade_reden: Optional[str]
    control_scores: list


def bereken_control_score(status: int, gewicht: float) -> float:
    """R01: Control score = (status / 4.0) * gewicht"""
    if status < 0 or status > 4:
        raise ValueError(f"Ongeldige control status: {status}. Moet 0-4 zijn.")
    return (status / 4.0) * gewicht


def bereken_norm_score(controls: list, drempel: float = 60.0) -> NormScoreResultaat:
    """
    R01: Norm score = gewogen gemiddelde * 100
    R02: Exporteerbaar als score >= drempel EN geen kritieke clausule < status 2
    """
    if not controls:
        return NormScoreResultaat(
            norm_score=0.0,
            exporteerbaar=False,
            blokkade_reden="Geen controls aangemaakt",
            control_scores=[],
        )

    totaal_gewicht = sum(c.gewicht for c in controls) or float(len(controls))
    gewogen_som = sum(bereken_control_score(c.status, c.gewicht) for c in controls)
    norm_score = (gewogen_som / totaal_gewicht) * 100

    blokkade_reden = None

    if norm_score < drempel:
        blokkade_reden = f"Norm score {norm_score:.0f}% is onder de drempel van {drempel:.0f}%"

    if blokkade_reden is None:
        for c in controls:
            if c.is_kritiek and c.status < 2:
                blokkade_reden = (
                    f"Kritieke clausule {c.clausule_code} heeft status {c.status} "
                    f"(minimaal 2 vereist voor export)"
                )
                break

    control_scores = [
        {
            "control_id": c.control_id,
            "clausule_code": c.clausule_code,
            "status": c.status,
            "gewicht": c.gewicht,
            "score": bereken_control_score(c.status, c.gewicht),
            "score_pct": (
                (bereken_control_score(c.status, c.gewicht) / c.gewicht * 100)
                if c.gewicht > 0 else 0
            ),
        }
        for c in controls
    ]

    return NormScoreResultaat(
        norm_score=round(norm_score, 2),
        exporteerbaar=blokkade_reden is None,
        blokkade_reden=blokkade_reden,
        control_scores=control_scores,
    )


async def herbereken_en_sla_op(
    company_norm_id: str,
    tenderbureau_id: str,
    db,
) -> NormScoreResultaat:
    """
    Haal controls op, herbereken score, sla op in compliance_company_norms.score.
    Aanroepen na elke control-statuswijziging (R01).
    """
    controls_result = (
        db.table("compliance_controls")
        .select(
            "id, status, "
            "compliance_control_requirements!inner("
            "  compliance_norm_requirements!inner(clausule_code, gewicht, is_kritiek)"
            "  , is_primair"
            ")"
        )
        .eq("company_norm_id", company_norm_id)
        .eq("tenderbureau_id", tenderbureau_id)
        .execute()
    )

    # Drempel ophalen via company_norm → norm
    norm_res = (
        db.table("compliance_company_norms")
        .select("compliance_normen!inner(drempel_score)")
        .eq("id", company_norm_id)
        .execute()
    )
    drempel = 60.0
    if norm_res.data:
        drempel = float(
            norm_res.data[0].get("compliance_normen", {}).get("drempel_score", 60)
        )

    controls = []
    for row in (controls_result.data or []):
        primaire_req = next(
            (
                r["compliance_norm_requirements"]
                for r in row.get("compliance_control_requirements", [])
                if r.get("is_primair")
            ),
            None,
        )
        if primaire_req:
            controls.append(
                ControlScore(
                    control_id=row["id"],
                    status=row["status"],
                    gewicht=float(primaire_req.get("gewicht", 1.0)),
                    clausule_code=primaire_req["clausule_code"],
                    is_kritiek=bool(primaire_req.get("is_kritiek", False)),
                )
            )

    resultaat = bereken_norm_score(controls, drempel=drempel)

    db.table("compliance_company_norms").update(
        {"score": resultaat.norm_score}
    ).eq("id", company_norm_id).execute()

    return resultaat
