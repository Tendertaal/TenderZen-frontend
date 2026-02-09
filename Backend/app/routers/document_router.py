# ================================================================
# TenderZen — Document Router
# Backend/app/routers/document_router.py
# Datum: 2026-02-09 (v2 — import fix)
# ================================================================
#
# FastAPI endpoints voor AI document generatie:
# - POST /smart-import/{id}/generate-documents
# - GET  /tenders/{id}/documents
# - GET  /documents/{id}
# - PUT  /documents/{id}
# - POST /documents/{id}/regenerate
# - DELETE /documents/{id}
#
# Registratie in main.py:
#   from app.routers.document_router import router as document_router
#   app.include_router(document_router, prefix="/api/v1")
# ================================================================

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from typing import Optional
import logging

from app.core.database import get_supabase
from app.core.dependencies import get_current_user
from app.services.document_generatie_service import DocumentGeneratieService
from app.models.document_models import (
    DocumentGenerateRequest,
    DocumentGenerateResponse,
    DocumentRegenerateRequest,
    DocumentUpdateRequest,
    DocumentResponse,
    DocumentListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI Documents"])


# ════════════════════════════════════════════════
# DEPENDENCY
# ════════════════════════════════════════════════

def get_document_service():
    db = get_supabase()
    return DocumentGeneratieService(db)


# ════════════════════════════════════════════════
# 1. GENEREER DOCUMENTEN
# ════════════════════════════════════════════════

@router.post(
    "/smart-import/{import_id}/generate-documents",
    response_model=DocumentGenerateResponse,
    summary="Genereer AI documenten voor een tender",
    description=(
        "Genereert één of meerdere AI-documenten op basis van de "
        "geëxtraheerde documenttekst uit de Smart Import sessie. "
        "Beschikbare types: go_no_go, samenvatting, compliance_matrix, "
        "nvi_vragen, rode_draad, pva_skelet."
    )
)
async def generate_documents(
    import_id: str,
    request: DocumentGenerateRequest,
    service: DocumentGeneratieService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Genereer AI-documenten.

    Dit endpoint roept de Anthropic API aan voor elk gevraagd documenttype.
    Afhankelijk van het aantal documenten en het model kan dit 10-60 seconden duren.
    """
    tenderbureau_id = current_user.get('tenderbureau_id')
    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen bureau toegang")

    # Valideer document types
    valid_types = {
        'go_no_go', 'samenvatting', 'compliance_matrix',
        'nvi_vragen', 'rode_draad', 'pva_skelet'
    }
    invalid = [dt for dt in request.documents if dt not in valid_types]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Ongeldig documenttype: {', '.join(invalid)}. "
                   f"Kies uit: {', '.join(sorted(valid_types))}"
        )

    try:
        result = await service.generate_documents(
            tender_id=str(request.tender_id),
            import_id=import_id,
            document_types=request.documents,
            team_assignments=request.team_assignments,
            tenderbureau_id=tenderbureau_id,
            model=request.model
        )
        return result

    except Exception as e:
        logger.error(f"Document generatie mislukt: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Er ging iets mis bij het genereren van de documenten"
        )


# ════════════════════════════════════════════════
# 2. DOCUMENTEN PER TENDER
# ════════════════════════════════════════════════

@router.get(
    "/tenders/{tender_id}/documents",
    response_model=DocumentListResponse,
    summary="Alle AI-documenten voor een tender"
)
async def list_documents(
    tender_id: str,
    type: Optional[str] = Query(None, description="Filter op documenttype"),
    status: Optional[str] = Query(None, description="Filter op status"),
    current_user: dict = Depends(get_current_user)
):
    """Haal alle AI-gegenereerde documenten op voor een tender."""
    db = get_supabase()

    try:
        query = db.table('ai_generated_documents') \
            .select('*') \
            .eq('tender_id', tender_id) \
            .order('created_at', desc=False)

        if type:
            query = query.eq('type', type)
        if status:
            query = query.eq('status', status)

        result = query.execute()
        documents = result.data or []

        # Genereer preview voor elk document
        for doc in documents:
            if not doc.get('preview') and doc.get('inhoud_tekst'):
                doc['preview'] = doc['inhoud_tekst'][:300]
                if len(doc.get('inhoud_tekst', '')) > 300:
                    doc['preview'] += '…'

        return {'documents': documents}

    except Exception as e:
        logger.error(f"Documenten ophalen mislukt: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Fout bij ophalen documenten"
        )


# ════════════════════════════════════════════════
# 3. ENKEL DOCUMENT
# ════════════════════════════════════════════════

@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Eén document ophalen"
)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Haal een specifiek AI-document op inclusief volledige inhoud."""
    db = get_supabase()

    try:
        result = db.table('ai_generated_documents') \
            .select('*') \
            .eq('id', document_id) \
            .single() \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Document niet gevonden")

        return result.data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document ophalen mislukt: {e}")
        raise HTTPException(status_code=500, detail="Fout bij ophalen document")


# ════════════════════════════════════════════════
# 4. DOCUMENT UPDATEN (titel, inhoud, status)
# ════════════════════════════════════════════════

@router.put(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Document updaten"
)
async def update_document(
    document_id: str,
    request: DocumentUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update een AI-document. Gebruik voor:
    - Status wijzigen (concept → geaccepteerd/afgewezen)
    - Titel aanpassen
    - Inhoud handmatig bewerken
    """
    db = get_supabase()

    update_data = {
        k: v for k, v in request.model_dump().items()
        if v is not None
    }

    if not update_data:
        raise HTTPException(status_code=400, detail="Geen velden om te updaten")

    try:
        result = db.table('ai_generated_documents') \
            .update(update_data) \
            .eq('id', document_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Document niet gevonden")

        return result.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document update mislukt: {e}")
        raise HTTPException(status_code=500, detail="Fout bij updaten document")


# ════════════════════════════════════════════════
# 5. DOCUMENT REGENEREREN
# ════════════════════════════════════════════════

@router.post(
    "/documents/{document_id}/regenerate",
    response_model=DocumentResponse,
    summary="Document opnieuw genereren"
)
async def regenerate_document(
    document_id: str,
    request: DocumentRegenerateRequest,
    service: DocumentGeneratieService = Depends(get_document_service),
    current_user: dict = Depends(get_current_user)
):
    """
    Genereer een document opnieuw met (optioneel) andere parameters.
    Het oude document wordt vervangen door de nieuwe versie.
    """
    tenderbureau_id = current_user.get('tenderbureau_id')
    if not tenderbureau_id:
        raise HTTPException(status_code=403, detail="Geen bureau toegang")

    db = get_supabase()

    # Haal het bestaande document op voor tender_id
    existing = db.table('ai_generated_documents') \
        .select('tender_id, type') \
        .eq('id', document_id) \
        .single() \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=404, detail="Document niet gevonden")

    try:
        result = await service.regenerate_document(
            document_id=document_id,
            tender_id=existing.data['tender_id'],
            import_id=str(request.import_id),
            team_assignments=request.team_assignments,
            tenderbureau_id=tenderbureau_id,
            model=request.model
        )
        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Regeneratie mislukt: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Fout bij opnieuw genereren van document"
        )


# ════════════════════════════════════════════════
# 6. DOCUMENT VERWIJDEREN
# ════════════════════════════════════════════════

@router.delete(
    "/documents/{document_id}",
    status_code=204,
    summary="Document verwijderen"
)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Verwijder een AI-gegenereerd document."""
    db = get_supabase()

    try:
        result = db.table('ai_generated_documents') \
            .delete() \
            .eq('id', document_id) \
            .execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Document niet gevonden")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Document verwijderen mislukt: {e}")
        raise HTTPException(
            status_code=500,
            detail="Fout bij verwijderen document"
        )