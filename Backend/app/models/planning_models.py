# ================================================================
# TenderZen — Planning Models
# Backend/app/models/planning_models.py
# Datum: 2026-02-08
# ================================================================
#
# Pydantic modellen voor request/response validatie
# van de planning endpoints.
# ================================================================

from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from datetime import date, datetime
from uuid import UUID


# ════════════════════════════════════════════════
# REQUEST MODELS
# ════════════════════════════════════════════════

class BackplanningRequest(BaseModel):
    """Request body voor POST /planning/generate-backplanning"""
    deadline: date = Field(
        ...,
        description="Indiendatum (T-0)"
    )
    template_id: UUID = Field(
        ...,
        description="UUID van het planning template"
    )
    team_assignments: Dict[str, str] = Field(
        ...,
        description="Mapping rol → user_id",
        examples=[{
            "tendermanager": "uuid-rick",
            "schrijver": "uuid-nathalie"
        }]
    )
    tenderbureau_id: UUID = Field(
        ...,
        description="UUID van het bureau"
    )
    tender_id: Optional[UUID] = Field(
        None,
        description="UUID van de tender (voor workload-check)"
    )
    include_checklist: bool = Field(
        True,
        description="Ook checklist items meenemen"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "deadline": "2026-03-15",
                "template_id": "abc-123",
                "team_assignments": {
                    "tendermanager": "user-uuid-1",
                    "schrijver": "user-uuid-2"
                },
                "tenderbureau_id": "bureau-uuid"
            }
        }


class WorkloadRequest(BaseModel):
    """Query parameters voor GET /team/workload"""
    user_ids: str = Field(
        ...,
        description="Komma-gescheiden lijst van user UUIDs"
    )
    start: date = Field(
        ...,
        description="Startdatum van de periode"
    )
    end: date = Field(
        ...,
        description="Einddatum van de periode"
    )


class TemplateCreateRequest(BaseModel):
    """Request body voor POST /planning-templates"""
    naam: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Naam van het template"
    )
    beschrijving: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optionele beschrijving"
    )
    type: str = Field(
        'planning',
        pattern='^(planning|checklist)$',
        description="Type: planning of checklist"
    )
    is_standaard: bool = Field(
        False,
        description="Standaard template voor dit bureau"
    )


class TemplateUpdateRequest(BaseModel):
    """Request body voor PUT /planning-templates/{id}"""
    naam: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200
    )
    beschrijving: Optional[str] = Field(None, max_length=1000)
    is_standaard: Optional[bool] = None
    is_actief: Optional[bool] = None


class TemplateTaakRequest(BaseModel):
    """Een individuele taak binnen een template"""
    naam: str = Field(..., min_length=1, max_length=200)
    beschrijving: Optional[str] = None
    rol: str = Field(
        ...,
        description="tendermanager, schrijver, calculator, reviewer, designer, sales, coordinator, klant_contact"
    )
    t_minus_werkdagen: int = Field(..., ge=0)
    duur_werkdagen: int = Field(1, ge=0)
    is_mijlpaal: bool = False
    is_verplicht: bool = True
    volgorde: int = 0
    afhankelijk_van: Optional[UUID] = None


class TemplateTakenBulkRequest(BaseModel):
    """Bulk update van taken in een template"""
    taken: List[TemplateTaakRequest] = Field(
        ...,
        min_length=1,
        description="Lijst van taken (vervangt alle bestaande taken)"
    )


# ════════════════════════════════════════════════
# RESPONSE MODELS
# ════════════════════════════════════════════════

class PersoonInfo(BaseModel):
    """Team member info in een planning-taak"""
    id: str
    naam: str
    initialen: str
    avatar_kleur: str = '#6b7280'


class ConflictInfo(BaseModel):
    """Workload conflict bij een taak"""
    type: str = 'workload'
    bericht: str
    severity: str = 'warning'  # warning | danger


class PlanningTaak(BaseModel):
    """Een berekende taak in de back-planning"""
    naam: str
    beschrijving: Optional[str] = None
    datum: str
    eind_datum: str
    duur_werkdagen: int = 1
    rol: str
    toegewezen_aan: Optional[PersoonInfo] = None
    is_mijlpaal: bool = False
    is_verplicht: bool = True
    t_minus: int
    volgorde: int
    conflict: Optional[ConflictInfo] = None


class WorkloadWarning(BaseModel):
    """Workload waarschuwing"""
    persoon_id: str
    persoon: str
    datum: str
    week: str
    taken_count: int
    severity: str
    bericht: str


class PlanningMetadata(BaseModel):
    """Samenvattende metadata van de planning"""
    eerste_taak: Optional[str] = None
    laatste_taak: Optional[str] = None
    deadline: Optional[str] = None
    doorlooptijd_werkdagen: int = 0
    doorlooptijd_kalenderdagen: int = 0
    feestdagen_overgeslagen: List[str] = []


class BackplanningResponse(BaseModel):
    """Response van POST /planning/generate-backplanning"""
    planning_taken: List[PlanningTaak] = []
    checklist_items: List[PlanningTaak] = []
    workload_warnings: List[WorkloadWarning] = []
    metadata: PlanningMetadata = PlanningMetadata()


class WorkloadWeek(BaseModel):
    """Workload data voor één week"""
    taken: int
    tenders: List[str] = []


class WorkloadPersoon(BaseModel):
    """Workload data voor één persoon"""
    naam: str
    weken: Dict[str, WorkloadWeek] = {}


class WorkloadResponse(BaseModel):
    """Response van GET /team/workload"""
    workload: Dict[str, WorkloadPersoon] = {}


class TemplateTaakResponse(BaseModel):
    """Template taak in een response"""
    id: str
    naam: str
    beschrijving: Optional[str] = None
    rol: str
    t_minus_werkdagen: int
    duur_werkdagen: int = 1
    is_mijlpaal: bool = False
    is_verplicht: bool = True
    volgorde: int = 0
    afhankelijk_van: Optional[str] = None


class TemplateResponse(BaseModel):
    """Response voor een template met taken"""
    id: str
    tenderbureau_id: str
    naam: str
    beschrijving: Optional[str] = None
    type: str
    is_standaard: bool = False
    is_actief: bool = True
    taken: List[TemplateTaakResponse] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TemplateListResponse(BaseModel):
    """Response voor lijst van templates"""
    data: List[TemplateResponse] = []
    total: int = 0