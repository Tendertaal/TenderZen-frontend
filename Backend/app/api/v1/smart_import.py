# app/api/v1/smart_import.py
"""
Smart Import API Routes
TenderZen v3.5

NEW v3.5:
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
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel
import logging

# ============================================
# CORRECTE IMPORTS VOOR JOUW PROJECT STRUCTUUR
# ============================================
from app.core.database import get_supabase_async
from app.core.dependencies import get_current_user
from app.services.smart_import.smart_import_service import SmartImportService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/smart-import", tags=["smart-import"])


# ==========================================
# Pydantic Models
# ==========================================

class AnalyzeOptions(BaseModel):
    extract_gunningscriteria: bool = True
    extract_certificeringen: bool = True
    language: str = "nl"
    model: Optional[Literal["haiku", "sonnet"]] = "haiku"  # v3.5: Model keuze


class ReanalyzeOptions(BaseModel):
    """v3.5: Opties voor her-analyse met ander model"""
    model: Literal["haiku", "sonnet"] = "sonnet"  # Default naar Pro


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
    newly_filled_fields: Optional[List[str]] = None  # v3.3
    ai_model_used: Optional[str] = None  # v3.5: Welk model is gebruikt
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
    
    # Maak import sessie
    import_session = await service.create_import_session(
        tenderbureau_id=tenderbureau_id,
        user_id=current_user['id']
    )
    
    # Upload bestanden
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
    
    v3.5: Ondersteunt model keuze:
    - model="haiku" (default) - Snel, goedkoop
    - model="sonnet" - Nauwkeuriger, duurder
    """
    service = SmartImportService(db)
    
    # Controleer of import bestaat en bij gebruiker hoort
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    # Log model keuze
    logger.info(f"📊 Starting analysis for {import_id} with model: {options.model}")
    
    # Start analyse (asynchroon)
    try:
        import asyncio
        asyncio.create_task(service.analyze(
            import_id=import_id,
            options=options.model_dump(),
            model=options.model  # v3.5: Model parameter
        ))
        
        return {
            "import_id": import_id,
            "status": "analyzing",
            "model": options.model,
            "message": f"Analyse gestart met {options.model} model"
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
    
    Typisch gebruik: eerst met Haiku (snel/goedkoop), 
    dan met Sonnet (nauwkeuriger) als resultaat onvoldoende is.
    """
    service = SmartImportService(db)
    
    # Controleer of import bestaat
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    # Controleer of er al een analyse is geweest
    if import_record.get('status') not in ['completed', 'failed']:
        raise HTTPException(
            status_code=400, 
            detail=f"Kan alleen her-analyseren na voltooide of gefaalde analyse (huidige status: {import_record.get('status')})"
        )
    
    logger.info(f"🔄 Re-analyzing {import_id} with model: {options.model}")
    
    # Start her-analyse (asynchroon)
    try:
        import asyncio
        asyncio.create_task(service.reanalyze(
            import_id=import_id,
            model=options.model
        ))
        
        return {
            "import_id": import_id,
            "status": "analyzing",
            "model": options.model,
            "message": f"Her-analyse gestart met {options.model} model"
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
    Dit kan gebruikt worden om ontbrekende data aan te vullen.
    """
    service = SmartImportService(db)
    
    # Controleer of import bestaat
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
    Merget de resultaten met bestaande data.
    """
    service = SmartImportService(db)
    
    # Controleer of import bestaat
    import_record = await service.get_import(import_id)
    if not import_record:
        raise HTTPException(status_code=404, detail="Import niet gevonden")
    
    try:
        # Start aanvullende analyse (asynchroon)
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
    
    # Bouw step info voor frontend
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
        newly_filled_fields=import_record.get('newly_filled_fields'),  # v3.3
        ai_model_used=import_record.get('ai_model_used'),  # v3.5
        steps=steps
    )


@router.post("/{import_id}/create-tender")
async def create_tender(
    import_id: str,
    request: CreateTenderRequest,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_supabase_async)
):
    """
    Maak een nieuwe tender aan met de geëxtraheerde data.
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
        raise HTTPException(status_code=500, detail=f"Tender aanmaken mislukt: {str(e)}")


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
        # Update status naar cancelled
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
    Kan gebruikt worden in de frontend om model keuze te tonen.
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