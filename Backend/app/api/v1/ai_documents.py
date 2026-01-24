"""
AI Documents API Router
FastAPI endpoints for AI document generation
TenderPlanner v3.0 - AI Features
"""
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/ai-documents", tags=["AI Documents"])


@router.get("/templates")
async def get_templates(only_active: bool = True):
    """Haal alle beschikbare AI document templates op."""
    return {
        'success': True,
        'templates': [],
        'total': 0,
        'message': 'AI Documents service not configured yet'
    }


@router.get("/templates/{template_key}")
async def get_template(template_key: str):
    """Haal specifiek template op."""
    raise HTTPException(status_code=404, detail="Template niet gevonden")


@router.get("/health")
async def health_check():
    """Health check voor AI Documents service."""
    return {
        'success': True,
        'service': 'AI Documents',
        'status': 'healthy'
    }