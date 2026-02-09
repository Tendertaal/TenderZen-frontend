"""
Tender data models - Updated to match extended Supabase schema
Met dynamische fase validatie uit database

DOEL-PAD: Backend/app/models/tender.py

CHANGELOG:
- v2.3: FaseValidator haalt zelf Supabase client op — geen parameter meer nodig
        Fallback nu inclusief 'evaluatie'
        init_fase_validator() aangepast voor startup
- v2.2: Status dynamisch via fase_statussen tabel
- v2.1: Bedrijf koppeling via ID
- v2.0: Dynamische fase validatie uit database
"""
from datetime import datetime, date
from typing import Optional, List, Set
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
import time


# ============================================
# DYNAMISCHE FASE VALIDATIE
# ============================================

class FaseValidator:
    """
    Cache voor geldige fases uit de database.
    Haalt fases op uit fase_config tabel en cached ze.
    
    v2.3: Haalt zelf de Supabase admin client op — geen parameter meer nodig.
    """
    _cache: Set[str] = set()
    _cache_time: float = 0
    _cache_ttl: int = 300  # 5 minuten cache
    
    @classmethod
    def _get_client(cls):
        """
        Haal Supabase admin client op via de bestaande database helper.
        Probeert meerdere import paden (voor flexibiliteit).
        """
        try:
            from app.core.database import get_supabase_admin
            return get_supabase_admin()
        except ImportError:
            pass
        
        try:
            from app.core.database import get_supabase_client
            return get_supabase_client()
        except ImportError:
            pass
        
        try:
            # Directe Supabase import als fallback
            import os
            from supabase import create_client
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")
            if url and key:
                return create_client(url, key)
        except Exception:
            pass
        
        return None
    
    @classmethod
    def get_valid_fases(cls) -> Set[str]:
        """
        Haal geldige fases op uit database met caching.
        Fallback naar bekende waarden als database niet beschikbaar is.
        
        v2.3: Geen supabase_client parameter meer nodig.
        """
        current_time = time.time()
        
        # Return cached als nog geldig
        if cls._cache and (current_time - cls._cache_time) < cls._cache_ttl:
            return cls._cache
        
        # Probeer uit database te laden
        try:
            client = cls._get_client()
            if client:
                response = client.table('fase_config').select('fase').execute()
                if response.data:
                    cls._cache = {row['fase'] for row in response.data}
                    cls._cache_time = current_time
                    print(f"✅ FaseValidator: {len(cls._cache)} fases geladen uit database: {sorted(cls._cache)}")
                    return cls._cache
        except Exception as e:
            print(f"⚠️ FaseValidator: Kon fases niet laden uit database: {e}")
        
        # Fallback naar defaults (inclusief evaluatie!)
        if not cls._cache:
            cls._cache = {'acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'}
            print(f"⚠️ FaseValidator: Fallback naar defaults: {sorted(cls._cache)}")
        
        return cls._cache
    
    @classmethod
    def is_valid_fase(cls, fase: str) -> bool:
        """Check of een fase geldig is."""
        return fase in cls.get_valid_fases()
    
    @classmethod
    def clear_cache(cls):
        """Clear de cache (bijv. na toevoegen nieuwe fase)."""
        cls._cache = set()
        cls._cache_time = 0
    
    @classmethod
    def refresh_cache(cls):
        """Forceer een refresh van de cache."""
        cls.clear_cache()
        return cls.get_valid_fases()


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
    
    # Tenderbureau koppeling
    tenderbureau_id: Optional[str] = None
    
    # Bedrijf koppeling via ID
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
    
    # Status - dynamisch via fase_statussen tabel
    status: Optional[str] = None
    go_nogo_opmerkingen: Optional[str] = None
    
    # Basis velden
    omschrijving: Optional[str] = None
    geschatte_workload: Optional[int] = None
    manager: Optional[str] = None
    schrijver: Optional[str] = None
    
    # Team assignments (voor team builder)
    team_assignments: Optional[List[dict]] = None
    
    # Timeline velden - datetime voor tijd ondersteuning
    publicatie_datum: Optional[datetime] = None
    deadline_indiening: Optional[datetime] = None
    interne_deadline: Optional[datetime] = None
    
    # Timeline velden - extra
    schouw_datum: Optional[datetime] = None
    nota_inlichtingen_datum: Optional[datetime] = None
    gunning_datum: Optional[datetime] = None
    contract_start: Optional[date] = None
    contract_einde: Optional[date] = None
    
    # AI pitstop
    ai_pitstop_status: Optional[str] = None
    
    # Notities
    notities: Optional[str] = None
    interne_notities: Optional[str] = None
    
    # Metadata
    bron: Optional[str] = None
    bron_url: Optional[str] = None
    referentie_nummer: Optional[str] = None
    
    @field_validator('fase')
    @classmethod
    def validate_fase(cls, v):
        """
        Valideer fase tegen dynamische lijst uit database.
        v2.3: Haalt automatisch Supabase client op (geen parameter nodig).
        """
        if v is None:
            return v
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
    
    # Tenderbureau koppeling
    tenderbureau_id: Optional[str] = None
    
    # Bedrijf koppeling via ID
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
    
    # Status - dynamisch via fase_statussen tabel
    status: Optional[str] = None
    go_nogo_opmerkingen: Optional[str] = None
    
    # Basis velden
    omschrijving: Optional[str] = None
    geschatte_workload: Optional[int] = None
    manager: Optional[str] = None
    schrijver: Optional[str] = None
    
    # Team assignments (voor team builder)
    team_assignments: Optional[List[dict]] = None
    
    # Timeline velden - datetime voor tijd ondersteuning
    publicatie_datum: Optional[datetime] = None
    deadline_indiening: Optional[datetime] = None
    interne_deadline: Optional[datetime] = None
    
    # Timeline velden - extra
    schouw_datum: Optional[datetime] = None
    nota_inlichtingen_datum: Optional[datetime] = None
    gunning_datum: Optional[datetime] = None
    contract_start: Optional[date] = None
    contract_einde: Optional[date] = None
    
    # AI pitstop
    ai_pitstop_status: Optional[str] = None
    
    # Notities
    notities: Optional[str] = None
    interne_notities: Optional[str] = None
    
    # Metadata
    bron: Optional[str] = None
    bron_url: Optional[str] = None
    referentie_nummer: Optional[str] = None
    
    @field_validator('fase')
    @classmethod
    def validate_fase(cls, v):
        """
        Valideer fase tegen dynamische lijst uit database.
        v2.3: Haalt automatisch Supabase client op (geen parameter nodig).
        """
        if v is None:
            return v
        valid_fases = fase_validator.get_valid_fases()
        if v not in valid_fases:
            raise ValueError(f"Fase '{v}' is niet geldig. Geldige fases: {', '.join(sorted(valid_fases))}")
        return v


class TenderResponse(BaseModel):
    """Model for API responses"""
    id: str
    naam: str
    tender_nummer: Optional[str] = None
    fase: str
    fase_status: Optional[str] = None
    
    # Tenderbureau koppeling
    tenderbureau_id: Optional[str] = None
    
    # Bedrijf koppeling via ID
    bedrijf_id: Optional[str] = None
    
    # Bedrijfsgegevens (DEPRECATED)
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
    win_kans: Optional[int] = None
    geschatte_winkans: Optional[int] = None
    opdracht_duur: Optional[int] = None
    opdracht_duur_eenheid: Optional[str] = None
    
    # Status
    status: Optional[str] = None
    go_nogo_opmerkingen: Optional[str] = None
    
    # Basis
    omschrijving: Optional[str] = None
    geschatte_workload: Optional[int] = None
    manager: Optional[str] = None
    schrijver: Optional[str] = None
    
    # Team
    team_assignments: Optional[List[dict]] = None
    
    # Timeline
    publicatie_datum: Optional[datetime] = None
    deadline_indiening: Optional[datetime] = None
    interne_deadline: Optional[datetime] = None
    schouw_datum: Optional[datetime] = None
    nota_inlichtingen_datum: Optional[datetime] = None
    gunning_datum: Optional[datetime] = None
    contract_start: Optional[date] = None
    contract_einde: Optional[date] = None
    
    # AI pitstop
    ai_pitstop_status: Optional[str] = None
    
    # Notities
    notities: Optional[str] = None
    interne_notities: Optional[str] = None
    
    # Metadata
    bron: Optional[str] = None
    bron_url: Optional[str] = None
    referentie_nummer: Optional[str] = None
    
    # Timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================
# HELPER FUNCTIES
# ============================================

def init_fase_validator():
    """
    Initialiseer de FaseValidator cache bij app startup.
    Roep dit aan in main.py of app startup.
    
    v2.3: Geen parameter meer nodig — haalt zelf client op.
    """
    fases = fase_validator.refresh_cache()
    print(f"✅ Fase validator geïnitialiseerd met fases: {sorted(fases)}")


def get_valid_fases() -> Set[str]:
    """Helper functie om geldige fases op te halen."""
    return fase_validator.get_valid_fases()