# app/api/v1/smart_import.py
"""
Smart Import API Routes
TenderZen v3.6

WIJZIGINGEN v3.6 (2026-03-11):
- POST /smart-import/{import_id}/create-tender:
  → Vangt PostgreSQL 23505 (unique violation) af als 409 Conflict
  → Geeft duidelijke foutmelding met tender_nummer in response
  → Frontend kan nu specifiek reageren op duplicate nummers

v3.5:
- Model parameter in analyze endpoint (haiku/sonnet)
- POST /smart-import/{import_id}/reanalyze - Opnieuw analyseren met ander model

v3.3:
- POST /smart-import/{import_id}/add-document - Extra document toevoegen
- POST /smart-import/{import_id}/analyze-supplement - Aanvullende analyse

EXISTING:
- POST /smart-import/upload - Start import met bestanden
- POST /smart-import/{import_id}/analyze - Start AI analyse
- GET /smart-import/{import_id}/status - Haal status op
- POST /smart-import/{import_id}/create-tender - Maak tender aan
- POST /smart-import/{import_id}/cancel - Annuleer import
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import logging

# ============================================
# CORRECTE IMPORTS VOOR JOUW PROJECT STRUCTUUR
# ============================================
from app.core.database import get_supabase_async
from app.core.dependencies import get_current_user
from app.services.smart_import.smart_import_service import SmartImportService
from app.config import TOEGESTANE_MODELLEN, DEFAULT_AI_MODEL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart-import", tags=["smart-import"])


# ==========================================
# Pydantic Models
# ==========================================

class AnalyzeOptions(BaseModel):
    extract_gunningscriteria: bool = True
    extract_certificeringen: bool = True
    language: str = "nl"
    model: Optional[str] = None  # Volledig model-ID, gevalideerd in endpoint


class ReanalyzeOptions(BaseModel):
    model: Optional[str] = None  # Volledig model-ID; default = DEFAULT_AI_MODEL


class SupplementAnalyzeOptions(BaseModel):
    existing_data: Optional[Dict[str, Any]] = None
    focus_on_empty: bool = True


class CreateTenderRequest(BaseModel):
    data: Dict[str, Any]
    options: Optional[Dict[str, Any]] = None


class ImportStatusResponse(BaseModel):
    import_id: str
    status: str
    progress: int
    current_step: Optional[str] = None
    error_message: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    warnings: Optional[List[str]] = None
    newly_filled_fields: Optional[List[str]] = None
    ai_model_used: Optional[str] = None
    steps: Optional[List[Dict[str, Any]]] = None


# ==========================================
# Routes
# ==========================================

@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    tenderbureau_id: str = Query(..., description="UUID van het tenderbureau"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Start een nieuwe Smart Import sessie en upload bestanden.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Geen bestanden geüpload")
    
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximaal 10 bestanden toegestaan")
    
    service = SmartImportService(db)
    
    import_session = await service.create_import_session(
        tenderbureau_id=tenderbureau_id,
        user_id=current_user['id']
    )
    
    try:
        uploaded_files = await service.upload_files(
            import_id=import_session['id'],
            files=files
        )
        
        return {
            "import_id": import_session['id'],
            "status": "uploaded",
            "files": uploaded_files
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload mislukt: {str(e)}")


@router.post("/{import_id}/analyze")
async def start_analysis(
    import_id: str,
    options: AnalyzeOptions = AnalyzeOptions(),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Start de AI analyse voor een import sessie.
    """
    service = SmartImportService(db)
    
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    gekozen_model = options.model or DEFAULT_AI_MODEL
    if gekozen_model not in TOEGESTANE_MODELLEN:
        raise HTTPException(status_code=400, detail=f"Ongeldig model: '{gekozen_model}'")

    logger.info(f"📊 Starting analysis for {import_id} with model: {gekozen_model}")

    try:
        import asyncio
        asyncio.create_task(service.analyze(
            import_id=import_id,
            options=options.model_dump(),
            model=gekozen_model
        ))

        return {
            "import_id": import_id,
            "status": "analyzing",
            "model": gekozen_model,
            "message": f"Analyse gestart met {gekozen_model}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analyse starten mislukt: {str(e)}")


# ==========================================
# v3.5: Re-analyze Endpoint
# ==========================================

@router.post("/{import_id}/reanalyze")
async def reanalyze(
    import_id: str,
    options: ReanalyzeOptions = ReanalyzeOptions(),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Voer de analyse opnieuw uit met een ander model.
    """
    service = SmartImportService(db)
    
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    if import_record.get('status') not in ['completed', 'failed']:
        raise HTTPException(
            status_code=400, 
            detail=f"Kan alleen her-analyseren na voltooide of gefaalde analyse (huidige status: {import_record.get('status')})"
        )
    
    gekozen_model = options.model or DEFAULT_AI_MODEL
    if gekozen_model not in TOEGESTANE_MODELLEN:
        raise HTTPException(status_code=400, detail=f"Ongeldig model: '{gekozen_model}'")

    logger.info(f"🔄 Re-analyzing {import_id} with model: {gekozen_model}")

    try:
        import asyncio
        asyncio.create_task(service.reanalyze(
            import_id=import_id,
            model=gekozen_model
        ))

        return {
            "import_id": import_id,
            "status": "analyzing",
            "model": gekozen_model,
            "message": f"Her-analyse gestart met {gekozen_model}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Her-analyse starten mislukt: {str(e)}")


# ==========================================
# v3.3: Extra Document Endpoints
# ==========================================

@router.post("/{import_id}/add-document")
async def add_document(
    import_id: str,
    file: UploadFile = File(..., description="Extra document om toe te voegen"),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Voeg een extra document toe aan een bestaande import sessie.
    """
    service = SmartImportService(db)
    
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    try:
        result = await service.add_document(
            import_id=import_id,
            file=file
        )
        
        return {
            "success": True,
            "import_id": import_id,
            "file": result['file'],
            "total_files": result['total_files'],
            "message": "Document toegevoegd, klaar voor aanvullende analyse"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document toevoegen mislukt: {str(e)}")


@router.post("/{import_id}/analyze-supplement")
async def analyze_supplement(
    import_id: str,
    options: SupplementAnalyzeOptions = SupplementAnalyzeOptions(),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Voer een aanvullende analyse uit op nieuw toegevoegde documenten.
    """
    service = SmartImportService(db)
    
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    try:
        import asyncio
        asyncio.create_task(service.analyze_supplement(
            import_id=import_id,
            existing_data=options.existing_data,
            focus_on_empty=options.focus_on_empty
        ))
        
        return {
            "import_id": import_id,
            "status": "analyzing",
            "message": "Aanvullende analyse gestart"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Aanvullende analyse starten mislukt: {str(e)}")


# ==========================================
# Status & Actions
# ==========================================

@router.get("/{import_id}/status", response_model=ImportStatusResponse)
async def get_status(
    import_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Haal de huidige status van een import sessie op.
    """
    service = SmartImportService(db)
    import_record = await service.get_import(import_id)
    
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    progress = import_record.get('progress', 0)
    current_step = import_record.get('current_step', '')
    
    steps = [
        {
            "name": "upload",
            "label": "Documenten uploaden",
            "status": "completed" if progress >= 10 else ("in_progress" if current_step == 'upload' else "pending")
        },
        {
            "name": "text_extraction",
            "label": "Tekst extraheren",
            "status": "completed" if progress >= 40 else ("in_progress" if 'text_extraction' in (current_step or '') else "pending")
        },
        {
            "name": "ai_extraction",
            "label": "AI analyse",
            "status": "completed" if progress >= 90 else ("in_progress" if current_step == 'ai_extraction' else "pending")
        },
        {
            "name": "finalizing",
            "label": "Afronden",
            "status": "completed" if progress >= 100 else ("in_progress" if current_step == 'finalizing' else "pending")
        }
    ]
    
    return ImportStatusResponse(
        import_id=import_id,
        status=import_record.get('status', 'unknown'),
        progress=progress,
        current_step=current_step,
        error_message=import_record.get('error_message'),
        extracted_data=import_record.get('extracted_data'),
        warnings=import_record.get('warnings'),
        newly_filled_fields=import_record.get('newly_filled_fields'),
        ai_model_used=import_record.get('ai_model_used'),
        steps=steps
    )


# ==========================================
# v3.6: Create Tender — met 409 bij duplicate
# ==========================================

@router.post("/{import_id}/create-tender")
async def create_tender(
    import_id: str,
    request: CreateTenderRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Maak een nieuwe tender aan met de geëxtraheerde data.
    
    v3.6: Retourneert 409 Conflict bij duplicate tender_nummer
    in plaats van een generieke 500 error.
    """
    service = SmartImportService(db)
    
    # Controleer of import bestaat en voltooid is
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    if import_record.get('status') != 'completed':
        raise HTTPException(
            status_code=400, 
            detail=f"Import is niet voltooid (status: {import_record.get('status')})"
        )
    
    try:
        result = await service.create_tender(
            import_id=import_id,
            data=request.data,
            options=request.options
        )
        
        return {
            "success": True,
            "tender": result['tender'],
            "documents_linked": result['documents_linked']
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        error_str = str(e)
        
        # ── FIX v3.6: Herken PostgreSQL unique violation ──
        # Code 23505 = unique_violation in PostgreSQL
        if '23505' in error_str or 'duplicate key' in error_str.lower():
            tender_nummer = request.data.get('tender_nummer', 'onbekend')
            logger.warning(
                f"Duplicate tender_nummer '{tender_nummer}' bij import {import_id}"
            )
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "DUPLICATE_TENDER_NUMMER",
                    "message": f"Tender nummer '{tender_nummer}' bestaat al in dit bureau.",
                    "tender_nummer": tender_nummer
                }
            )
        
        # Alle andere fouten
        logger.error(f"Tender aanmaken mislukt voor import {import_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Tender aanmaken mislukt: {error_str}"
        )


@router.post("/{import_id}/cancel")
async def cancel_import(
    import_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Annuleer een import sessie.
    """
    service = SmartImportService(db)
    
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    try:
        db.table('smart_imports').update({
            'status': 'cancelled'
        }).eq('id', import_id).execute()
        
        return {
            "success": True,
            "import_id": import_id,
            "status": "cancelled"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Annuleren mislukt: {str(e)}")


# ==========================================
# v3.5: Model Info Endpoint
# ==========================================

@router.get("/models")
async def get_available_models(
    current_user: dict = Depends(get_current_user)
):
    """
    Haal beschikbare AI modellen op.
    """
    return {
        "models": [
            {
                "id": "haiku",
                "name": "Standaard (Haiku)",
                "description": "Snel en goedkoop - geschikt voor de meeste documenten",
                "speed": "fast",
                "cost": "low",
                "default": True
            },
            {
                "id": "sonnet",
                "name": "Pro (Sonnet)",
                "description": "Nauwkeuriger analyse - voor complexe aanbestedingen",
                "speed": "medium",
                "cost": "medium",
                "default": False
            }
        ]
    }