"""
AI Documents API Router
Handles AI document generation endpoints
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from supabase import Client
from app.core.database import get_supabase_async
from typing import List, Optional

router = APIRouter(prefix="/ai-documents", tags=["AI Documents"])


# ============================================
# HELPER FUNCTIONS
# ============================================

def map_document_row(row):
    """Map database document row to API response."""
    return {
        "id": row.get("id"),
        "tender_id": row.get("tender_id"),
        "template_key": row.get("template_key"),
        "status": row.get("status"),
        "progress": row.get("progress", 0),
        "generated_file_url": row.get("generated_file_url"),
        "created_at": str(row.get("created_at", "")),
        "completed_at": str(row.get("completed_at", "")),
    }


def map_template_row(row):
    """Map database template row to API response."""
    # Color mapping voor frontend
    color_map = {
        'samenvatting': 'blue',
        'offerte': 'green',
        'rode_draad': 'purple',
        'versie1_inschrijving': 'orange',
        'win_check': 'success'
    }
    
    return {
        "id": row.get("id"),
        "template_key": row.get("template_key"),
        "template_name": row.get("naam"),
        "template_icon": row.get("icon", "📄"),
        "beschrijving": row.get("beschrijving", ""),
        "prompt_template": row.get("prompt_template"),
        "default_prompt": row.get("default_prompt"),
        "priority": row.get("volgorde", 999),  # ✅ FIX: volgorde → priority
        "color": color_map.get(row.get("template_key"), "blue"),
        "estimated_time_minutes": row.get("estimated_duration_minutes", 10),
        "recommended_documents": row.get("required_files", []),
        "is_active": row.get("is_active", True),
        "is_beta": row.get("is_beta", False),
        "created_at": str(row.get("created_at", "")),
        "updated_at": str(row.get("updated_at", "")),
    }


# ============================================
# ENDPOINTS
# ============================================

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "ai-documents"}


@router.get("/templates")
async def get_templates(
    only_active: bool = Query(True),
    db: Client = Depends(get_supabase_async)
):
    """Haal alle beschikbare AI document templates op."""
    try:
        query = db.table('ai_document_templates').select('*').order('volgorde')
        
        if only_active:
            query = query.eq('is_active', True)
        
        result = query.execute()
        
        templates = [map_template_row(row) for row in result.data]
        
        return {
            'success': True,
            'templates': templates,
            'total': len(templates)
        }
        
    except Exception as e:
        print(f"❌ Error fetching templates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/templates/{template_key}")
async def get_template(
    template_key: str,
    db: Client = Depends(get_supabase_async)
):
    """Haal een specifieke template op."""
    try:
        result = db.table('ai_document_templates')\
            .select('*')\
            .eq('template_key', template_key)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Template niet gevonden")
        
        return {
            'success': True,
            'template': map_template_row(result.data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching template: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tenders/{tender_id}/ai-documents")
async def get_tender_documents(
    tender_id: str,
    db: Client = Depends(get_supabase_async)
):
    """Haal alle AI documents op voor een specifieke tender."""
    try:
        result = db.table('ai_documents')\
            .select('*')\
            .eq('tender_id', tender_id)\
            .order('created_at', desc=True)\
            .execute()
        
        documents = [map_document_row(row) for row in result.data]
        
        return {
            'success': True,
            'documents': documents,
            'total': len(documents)
        }
        
    except Exception as e:
        print(f"❌ Error fetching tender documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ai-documents/{document_id}")
async def get_document(
    document_id: str,
    db: Client = Depends(get_supabase_async)
):
    """Haal een specifiek AI document op."""
    try:
        result = db.table('ai_documents')\
            .select('*')\
            .eq('id', document_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document niet gevonden")
        
        return {
            'success': True,
            'document': map_document_row(result.data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching document: {e}")
        raise HTTPException(status_code=500, detail=str(e))