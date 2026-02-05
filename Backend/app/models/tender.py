"""
Tender data models - Updated to match extended Supabase schema
Met dynamische fase validatie uit database

v2.1: bedrijf_id toegevoegd voor bedrijf koppeling
v2.2: Status pattern verwijderd - nu dynamisch via fase_statussen tabel
v2.3: Smart Import koppeling
v2.4: date → datetime voor timestamp velden (tijd ondersteuning)
v2.7: tenderbureau_naam in TenderResponse voor kaart weergave
"""
from datetime import datetime
from typing import Optional, List, Set
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
import functools
import time


# ============================================
# DYNAMISCHE FASE VALIDATIE
# ============================================

class FaseValidator:
    """
    Cache voor geldige fases uit de database.
    Haalt fases op uit fase_config tabel en cached ze.
    """
    _cache: Set[str] = set()
    _cache_time: float = 0
    _cache_ttl: int = 300  # 5 minuten cache
    
    @classmethod
    def get_valid_fases(cls, supabase_client=None) -> Set[str]:
        """
        Haal geldige fases op uit database met caching.
        Fallback naar hardcoded waarden als database niet beschikbaar is.
        """
        current_time = time.time()
        
        # Return cached als nog geldig
        if cls._cache and (current_time - cls._cache_time) < cls._cache_ttl:
            return cls._cache
        
        # Probeer uit database te laden
        if supabase_client:
            try:
                response = supabase_client.table('fase_config').select('fase').execute()
                if response.data:
                    cls._cache = {row['fase'] for row in response.data}
                    cls._cache_time = current_time
                    return cls._cache
            except Exception as e:
                print(f"⚠️ Kon fases niet laden uit database: {e}")
        
        # Fallback naar defaults (inclusief archief!)
        if not cls._cache:
            cls._cache = {'acquisitie', 'inschrijvingen', 'ingediend', 'archief'}
        
        return cls._cache
    
    @classmethod
    def is_valid_fase(cls, fase: str, supabase_client=None) -> bool:
        """Check of een fase geldig is."""
        valid_fases = cls.get_valid_fases(supabase_client)
        return fase in valid_fases
    
    @classmethod
    def clear_cache(cls):
        """Clear de cache (bijv. na toevoegen nieuwe fase)."""
        cls._cache = set()
        cls._cache_time = 0
    
    @classmethod
    def refresh_cache(cls, supabase_client):
        """Forceer een refresh van de cache."""
        cls.clear_cache()
        return cls.get_valid_fases(supabase_client)


# Global validator instance
fase_validator = FaseValidator()


# ============================================
# PYDANTIC MODELS
# ============================================

class TenderBase(BaseModel):
    """Base tender model matching Supabase schema"""
    # Basis tender info
    naam: str
    tender_nummer: Optional[str] = None
    fase: str = Field(default="acquisitie")
    fase_status: Optional[str] = None
    
    # ⭐ NIEUW: Tenderbureau koppeling
    tenderbureau_id: Optional[str] = None
    
    # ⭐ v2.1: Bedrijf koppeling via ID
    bedrijf_id: Optional[str] = None
    
    # Bedrijfsgegevens (inschrijvende partij) - DEPRECATED
    bedrijfsnaam: Optional[str] = None
    kvk_nummer: Optional[str] = None
    btw_nummer: Optional[str] = None
    contactpersoon: Optional[str] = None
    contact_email: Optional[str] = None
    contact_telefoon: Optional[str] = None
    bedrijfs_adres: Optional[str] = None
    bedrijfs_postcode: Optional[str] = None
    bedrijfs_plaats: Optional[str] = None
    
    # Aanbesteding info
    aanbestedende_dienst: Optional[str] = None
    opdrachtgever: Optional[str] = None
    locatie: Optional[str] = None
    type: Optional[str] = None
    aanbestedingsprocedure: Optional[str] = None
    cpv_codes: Optional[List[str]] = None
    
    # Financieel
    tender_waarde: Optional[Decimal] = None
    geraamde_waarde: Optional[Decimal] = None
    minimum_bedrag: Optional[Decimal] = None
    maximum_bedrag: Optional[Decimal] = None
    waarborgsom: Optional[Decimal] = None
    win_kans: Optional[int] = Field(None, ge=0, le=100)
    geschatte_winkans: Optional[int] = Field(None, ge=0, le=100)
    opdracht_duur: Optional[int] = None
    opdracht_duur_eenheid: Optional[str] = "maanden"
    
    # ⭐ v2.2: Status - GEEN pattern meer, dynamisch via fase_statussen tabel
    status: Optional[str] = None
    go_nogo_opmerkingen: Optional[str] = None
    
    # Basis velden
    omschrijving: Optional[str] = None
    geschatte_workload: Optional[int] = None
    manager: Optional[str] = None
    schrijver: Optional[str] = None
    
    # Team assignments (voor team builder)
    team_assignments: Optional[List[dict]] = None
    
    # ⭐ v2.4: Timeline velden - nu datetime voor tijd ondersteuning
    publicatie_datum: Optional[datetime] = None
    deadline_indiening: Optional[datetime] = None
    interne_deadline: Optional[datetime] = None
    
    # Timeline velden - extra
    schouw_datum: Optional[datetime] = None
    nvi1_datum: Optional[datetime] = None
    nvi2_datum: Optional[datetime] = None
    presentatie_datum: Optional[datetime] = None
    voorlopige_gunning: Optional[datetime] = None
    definitieve_gunning: Optional[datetime] = None
    start_uitvoering: Optional[datetime] = None
    
    # Documenten & Links
    tenderned_url: Optional[str] = None
    platform_naam: Optional[str] = None
    documenten_link: Optional[str] = None
    interne_map_link: Optional[str] = None
    
    # Inschrijvingseisen
    certificeringen_vereist: Optional[List[str]] = None
    minimale_omzet: Optional[Decimal] = None
    referenties_verplicht: Optional[bool] = False
    aantal_referenties_vereist: Optional[int] = None
    eisen_notities: Optional[str] = None
    
    # Risico & Strategie
    risicos: Optional[dict] = None
    concurrentie_analyse: Optional[str] = None
    usps: Optional[str] = None
    strategie_notities: Optional[str] = None
    
    # Metadata
    is_concept: Optional[bool] = False
    
    # ⭐ Dynamische fase validatie
    @field_validator('fase')
    @classmethod
    def validate_fase(cls, v: str) -> str:
        """Valideer fase tegen database waarden."""
        valid_fases = fase_validator.get_valid_fases()
        if v not in valid_fases:
            raise ValueError(f"Fase '{v}' is niet geldig. Geldige fases: {', '.join(sorted(valid_fases))}")
        return v


class TenderCreate(TenderBase):
    """Model for creating a tender"""
    pass


class TenderUpdate(BaseModel):
    """Model for updating a tender - all fields optional"""
    # Basis
    naam: Optional[str] = None
    tender_nummer: Optional[str] = None
    fase: Optional[str] = None
    fase_status: Optional[str] = None
    
    # ⭐ NIEUW: Tenderbureau koppeling
    tenderbureau_id: Optional[str] = None
    
    # ⭐ v2.1: Bedrijf koppeling via ID (vervangt losse bedrijfsvelden)
    bedrijf_id: Optional[str] = None
    
    # Bedrijfsgegevens (DEPRECATED - voor backwards compatibility)
    bedrijfsnaam: Optional[str] = None
    kvk_nummer: Optional[str] = None
    btw_nummer: Optional[str] = None
    contactpersoon: Optional[str] = None
    contact_email: Optional[str] = None
    contact_telefoon: Optional[str] = None
    bedrijfs_adres: Optional[str] = None
    bedrijfs_postcode: Optional[str] = None
    bedrijfs_plaats: Optional[str] = None
    
    # Aanbesteding
    aanbestedende_dienst: Optional[str] = None
    opdrachtgever: Optional[str] = None
    locatie: Optional[str] = None
    type: Optional[str] = None
    aanbestedingsprocedure: Optional[str] = None
    cpv_codes: Optional[List[str]] = None
    
    # Financieel
    tender_waarde: Optional[Decimal] = None
    geraamde_waarde: Optional[Decimal] = None
    minimum_bedrag: Optional[Decimal] = None
    maximum_bedrag: Optional[Decimal] = None
    waarborgsom: Optional[Decimal] = None
    win_kans: Optional[int] = Field(None, ge=0, le=100)
    geschatte_winkans: Optional[int] = Field(None, ge=0, le=100)
    opdracht_duur: Optional[int] = None
    opdracht_duur_eenheid: Optional[str] = None
    
    # ⭐ v2.2: Status - GEEN pattern meer, dynamisch via fase_statussen tabel
    status: Optional[str] = None
    go_nogo_opmerkingen: Optional[str] = None
    
    # Basis velden
    omschrijving: Optional[str] = None
    geschatte_workload: Optional[int] = None
    manager: Optional[str] = None
    schrijver: Optional[str] = None
    
    # Team assignments (voor team builder)
    team_assignments: Optional[List[dict]] = None
    
    # ⭐ v2.4: Timeline velden - nu datetime voor tijd ondersteuning
    publicatie_datum: Optional[datetime] = None
    deadline_indiening: Optional[datetime] = None
    interne_deadline: Optional[datetime] = None
    
    # Timeline velden - extra
    schouw_datum: Optional[datetime] = None
    nvi1_datum: Optional[datetime] = None
    nvi2_datum: Optional[datetime] = None
    presentatie_datum: Optional[datetime] = None
    voorlopige_gunning: Optional[datetime] = None
    definitieve_gunning: Optional[datetime] = None
    start_uitvoering: Optional[datetime] = None
    
    # Documenten & Links
    tenderned_url: Optional[str] = None
    platform_naam: Optional[str] = None
    documenten_link: Optional[str] = None
    interne_map_link: Optional[str] = None
    
    # Inschrijvingseisen
    certificeringen_vereist: Optional[List[str]] = None
    minimale_omzet: Optional[Decimal] = None
    referenties_verplicht: Optional[bool] = None
    aantal_referenties_vereist: Optional[int] = None
    eisen_notities: Optional[str] = None
    
    # Risico & Strategie
    risicos: Optional[dict] = None
    concurrentie_analyse: Optional[str] = None
    usps: Optional[str] = None
    strategie_notities: Optional[str] = None
    
    # Metadata
    is_concept: Optional[bool] = None
    
    # ⭐ Dynamische fase validatie
    @field_validator('fase')
    @classmethod
    def validate_fase(cls, v: Optional[str]) -> Optional[str]:
        """Valideer fase tegen database waarden."""
        if v is None:
            return v
        valid_fases = fase_validator.get_valid_fases()
        if v not in valid_fases:
            raise ValueError(f"Fase '{v}' is niet geldig. Geldige fases: {', '.join(sorted(valid_fases))}")
        return v


class TenderResponse(TenderBase):
    """Model for tender response - includes database generated fields"""
    id: str
    tenderbureau_id: Optional[str] = None  # ⭐ NIEUW: Expliciet in response
    company_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # ⭐ v2.3: Smart Import koppeling
    smart_import_id: Optional[str] = None
    ai_model_used: Optional[str] = None
    # ⭐ v2.7: Tenderbureau naam (geflatened uit join)
    tenderbureau_naam: Optional[str] = None
    
    class Config:
        from_attributes = True
        json_encoders = {
            Decimal: lambda v: float(v) if v else None
        }


# ============================================
# HELPER FUNCTIES
# ============================================

def init_fase_validator(supabase_client):
    """
    Initialiseer de fase validator met een Supabase client.
    Roep dit aan bij het opstarten van de applicatie.
    """
    fase_validator.refresh_cache(supabase_client)
    print(f"✅ Fase validator geïnitialiseerd met fases: {fase_validator._cache}")


def get_valid_fases() -> Set[str]:
    """Helper functie om geldige fases op te halen."""
    return fase_validator.get_valid_fases()