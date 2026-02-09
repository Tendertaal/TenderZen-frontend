# ================================================================
# TenderZen — Document Models
# Backend/app/models/document_models.py
# Datum: 2026-02-09
# ================================================================

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from uuid import UUID


# ════════════════════════════════════════════════
# REQUEST MODELS
# ════════════════════════════════════════════════

class DocumentGenerateRequest(BaseModel):
    """Request body voor POST /smart-import/{id}/generate-documents"""
    tender_id: UUID = Field(
        ...,
        description="UUID van de tender"
    )
    documents: List[str] = Field(
        ...,
        min_length=1,
        description="Lijst van documenttypes om te genereren",
        examples=[["go_no_go", "samenvatting"]]
    )
    team_assignments: Dict[str, str] = Field(
        default_factory=dict,
        description="Mapping rol → user_id"
    )
    model: str = Field(
        'sonnet',
        pattern='^(sonnet|haiku)$',
        description="AI model: sonnet (beter) of haiku (sneller/goedkoper)"
    )


class DocumentRegenerateRequest(BaseModel):
    """Request body voor POST /documents/{id}/regenerate"""
    import_id: UUID = Field(
        ...,
        description="UUID van de smart import sessie"
    )
    team_assignments: Dict[str, str] = Field(
        default_factory=dict
    )
    model: str = Field(
        'sonnet',
        pattern='^(sonnet|haiku)$'
    )


class DocumentUpdateRequest(BaseModel):
    """Request body voor PUT /documents/{id}"""
    titel: Optional[str] = Field(None, max_length=300)
    inhoud_tekst: Optional[str] = None
    status: Optional[str] = Field(
        None,
        pattern='^(concept|geaccepteerd|afgewezen)$'
    )


# ════════════════════════════════════════════════
# RESPONSE MODELS
# ════════════════════════════════════════════════

class DocumentResponse(BaseModel):
    """Response voor een enkel AI-gegenereerd document"""
    id: Optional[str] = None
    type: str
    titel: str
    status: str = 'concept'
    preview: Optional[str] = None
    inhoud: Optional[Any] = None
    inhoud_tekst: Optional[str] = None
    ai_model: str = 'sonnet'
    versie: int = 1
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class DocumentListResponse(BaseModel):
    """Response voor meerdere documenten"""
    documents: List[DocumentResponse] = []


class DocumentGenerateResponse(BaseModel):
    """Response van POST /smart-import/{id}/generate-documents"""
    documents: List[DocumentResponse] = []