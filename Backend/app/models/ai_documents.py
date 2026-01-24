"""
AI Document Models
Pydantic models for AI document generation system
TenderPlanner v3.0 - AI Features
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ============================================
# ENUMS
# ============================================

class DocumentStatus(str, Enum):
    """Status van een AI document generatie"""
    QUEUED = "queued"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TemplateKey(str, Enum):
    """Beschikbare template types"""
    RODE_DRAAD = "rode_draad"
    OFFERTE = "offerte"
    VERSIE1 = "versie1_inschrijving"


# ============================================
# FILE MODELS
# ============================================

class UploadedFile(BaseModel):
    """Metadata van een geüpload bestand"""
    filename: str
    storage_path: str
    size: int  # bytes
    type: str  # MIME type
    uploaded_at: datetime = Field(default_factory=datetime.now)


class FileRequirement(BaseModel):
    """Vereisten voor een bestandstype"""
    type: str  # 'aanbestedingsleidraad', 'programma_van_eisen'
    label: str
    required: bool
    accept: str  # '.pdf', '.docx'
    maxSize: int = 10485760  # 10MB default


# ============================================
# TEMPLATE MODELS
# ============================================

class AIDocumentTemplate(BaseModel):
    """AI Document Template definitie"""
    id: Optional[str] = None
    template_key: str
    naam: str
    beschrijving: Optional[str] = None
    icon: Optional[str] = None
    kleur: str = "#3b82f6"
    required_files: List[FileRequirement] = []
    optional_files: List[FileRequirement] = []
    estimated_duration_minutes: int = 10
    requires_bedrijf_data: bool = True
    requires_team_data: bool = False
    volgorde: int = 0
    is_active: bool = True
    is_beta: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================
# DOCUMENT MODELS
# ============================================

class AIDocumentBase(BaseModel):
    """Base model voor AI document"""
    tender_id: str
    template_key: str
    tenderbureau_id: str


class AIDocumentCreate(AIDocumentBase):
    """Create een nieuw AI document"""
    input_data: Dict[str, Any]
    uploaded_files: List[UploadedFile] = []
    generation_config: Optional[Dict[str, Any]] = None
    created_by: str


class AIDocument(AIDocumentBase):
    """Volledig AI document met alle data"""
    id: str
    
    # Status
    status: DocumentStatus
    progress: int = 0
    current_step: Optional[str] = None
    current_step_number: int = 0
    total_steps: int = 6
    
    # Files
    uploaded_files: List[UploadedFile] = []
    generated_file_path: Optional[str] = None
    generated_file_name: Optional[str] = None
    generated_file_size: Optional[int] = None
    generated_file_url: Optional[str] = None
    
    # Data
    input_data: Dict[str, Any] = {}
    generation_config: Dict[str, Any] = {}
    generation_log: List[Dict[str, Any]] = []
    
    # Error handling
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    
    # Metrics
    generation_time_seconds: Optional[int] = None
    claude_tokens_used: Optional[int] = None
    claude_model_used: str = "claude-sonnet-4-20250514"
    
    # Quality
    quality_score: Optional[int] = None
    validation_passed: Optional[bool] = None
    
    # User tracking
    created_by: str
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    downloaded_at: Optional[datetime] = None
    download_count: int = 0
    
    # Soft delete
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None
    
    class Config:
        from_attributes = True


# ============================================
# PROGRESS TRACKING MODELS
# ============================================

class GenerationProgress(BaseModel):
    """Real-time progress update"""
    document_id: str
    status: DocumentStatus
    progress: int = Field(ge=0, le=100)
    current_step: str
    current_step_number: int
    total_steps: int
    estimated_time_remaining_seconds: Optional[int] = None
    
    # Timestamps
    started_at: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=datetime.now)