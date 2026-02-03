"""
AI Documents API Router
FastAPI endpoints for AI document generation  
TenderPlanner v3.0 - AI Features
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query, Request
from supabase import Client
from app.services.ai_documents.ai_document_service import AIDocumentService
from app.core.database import get_supabase_async
from datetime import datetime
from typing import Optional
import os
import uuid
import base64
import json

router = APIRouter(prefix="/ai-documents", tags=["AI Documents"])


# ============================================
# HELPER FUNCTIONS
# ============================================

def get_user_id_from_request(request: Request) -> Optional[str]:
    """Extract user ID from JWT token in Authorization header (without PyJWT library)."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            print("⚠️ No valid Authorization header")
            return None
        
        token = auth_header.replace('Bearer ', '')
        
        # JWT tokens have 3 parts: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            print("⚠️ Invalid JWT format")
            return None
        
        # Decode the payload (second part)
        # Add padding if needed for base64
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        # Decode base64 and parse JSON
        payload_json = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_json)
        
        user_id = payload.get('sub')
        
        print(f"✅ Extracted user_id from JWT: {user_id}")
        return user_id
        
    except Exception as e:
        print(f"⚠️ Could not extract user_id from JWT: {e}")
        import traceback
        traceback.print_exc()
        return None


def map_template_row(row):
    """Map database template row to API response."""
    color_map = {
        'samenvatting': 'blue',
        'offerte': 'green',
        'rode_draad': 'purple',
        'versie1_inschrijving': 'orange',
        'win_check': 'success'
    }
    
    template_key = row.get("template_key")
    
    return {
        "id": row.get("id"),
        "template_key": template_key,
        "template_name": row.get("naam"),
        "template_icon": row.get("icon", "📄"),
        "beschrijving": row.get("beschrijving", ""),
        "prompt_template": row.get("prompt_template"),
        "default_prompt": row.get("default_prompt"),
        "priority": row.get("volgorde", 999),
        "color": color_map.get(template_key, "blue"),
        "estimated_time_minutes": row.get("estimated_duration_minutes", 10),
        "recommended_documents": row.get("required_files", []),
        "is_active": row.get("is_active", True),
        "is_beta": row.get("is_beta", False),
        "created_at": str(row.get("created_at", "")),
        "updated_at": str(row.get("updated_at", "")),
    }


def map_document_row(row):
    """Map AI document row to API response."""
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


def map_tender_document_row(row):
    """Map tender_documents row to API response."""
    return {
        "id": row.get("id"),
        "tender_id": row.get("tender_id"),
        "file_name": row.get("file_name"),
        "original_file_name": row.get("original_file_name"),
        "file_size": row.get("file_size"),
        "file_type": row.get("file_type"),
        "document_type": row.get("document_type"),
        "storage_path": row.get("storage_path"),
        "uploaded_by": row.get("uploaded_by"),
        "uploaded_at": str(row.get("uploaded_at", "")),
        "created_at": str(row.get("created_at", "")),
    }


# ============================================
# AI TEMPLATES ENDPOINTS
# ============================================

@router.get("/health")
async def health_check():
    return {
        'success': True,
        'service': 'AI Documents',
        'status': 'healthy'
    }


@router.get("/templates")
async def get_templates(
    only_active: bool = Query(True), 
    db: Client = Depends(get_supabase_async)
):
    """Get all AI document templates."""
    service = AIDocumentService(db)
    templates = await service.get_all_templates(only_active=only_active)
    mapped = [map_template_row(t) for t in templates]
    return {
        'success': True, 
        'templates': mapped, 
        'total': len(mapped)
    }


@router.get("/templates/{template_key}")
async def get_template(
    template_key: str, 
    db: Client = Depends(get_supabase_async)
):
    """Get a specific AI document template."""
    service = AIDocumentService(db)
    template = await service.get_template_by_key(template_key)
    if not template:
        raise HTTPException(status_code=404, detail="Template niet gevonden")
    return {
        'success': True,
        'template': map_template_row(template)
    }


@router.get("/tenders/{tender_id}/ai-documents")
async def get_tender_ai_documents(
    tender_id: str, 
    db: Client = Depends(get_supabase_async)
):
    """Get all AI-generated documents for a tender."""
    service = AIDocumentService(db)
    docs = await service.get_documents_for_tender(tender_id)
    mapped = [map_document_row(d) for d in docs]
    return {
        'success': True,
        'documents': mapped,
        'total': len(mapped)
    }


@router.get("/ai-documents/{document_id}")
async def get_ai_document(
    document_id: str, 
    db: Client = Depends(get_supabase_async)
):
    """Get a specific AI-generated document."""
    service = AIDocumentService(db)
    doc = await service.get_document_by_id(document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document niet gevonden")
    return {
        'success': True,
        'document': map_document_row(doc)
    }



# ============================================
# TENDER DOCUMENTS UPLOAD ENDPOINTS
# ============================================

# ⚠️ BELANGRIJK: Deze route MOET VOOR /tenders/{tender_id}/documents komen!
@router.get("/tenders/{tender_id}/generated")
async def get_generated_documents(
    tender_id: str,
    db: Client = Depends(get_supabase_async)
):
    """
    Get all AI-generated documents for a tender.
    These are documents created by AI (stored in ai_documents table).
    """
    try:
        print(f"📋 Fetching generated documents for tender: {tender_id}")
        
        result = db.table('ai_documents')\
            .select('*')\
            .eq('tender_id', tender_id)\
            .eq('is_deleted', False)\
            .order('created_at', desc=True)\
            .execute()
        
        documents = result.data or []
        
        print(f"✅ Found {len(documents)} generated documents")
        
        return {
            'success': True,
            'documents': documents,
            'total': len(documents)
        }
        
    except Exception as e:
        print(f"❌ Error fetching generated documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tenders/{tender_id}/documents/upload")
async def upload_tender_document(
    tender_id: str,
    request: Request,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Client = Depends(get_supabase_async)
):
    """
    Upload a tender document to Supabase Storage (ai-documents bucket).
    Files are stored in: ai-documents/tenders/{tender_id}/{filename}
    
    Parameters:
    - tender_id: UUID of the tender
    - document_type: Type of document (aanbestedingsleidraad, pve, gunningscriteria, bijlagen, referenties)
    - file: The file to upload
    """
    try:
        print(f"📤 Uploading document for tender {tender_id}: {file.filename}")
        
        # Validate file size (10MB max)
        max_size = 10 * 1024 * 1024  # 10MB
        file_content = await file.read()
        
        if len(file_content) > max_size:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Max size is {max_size / 1024 / 1024}MB"
            )
        
        # Get tender info
        tender_result = db.table('tenders').select('tenderbureau_id').eq('id', tender_id).single().execute()
        
        if not tender_result.data:
            raise HTTPException(status_code=404, detail="Tender niet gevonden")
        
        tenderbureau_id = tender_result.data['tenderbureau_id']
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        
        # Storage path: tenders/{tender_id}/{filename}
        storage_path = f"tenders/{tender_id}/{unique_filename}"
        
        print(f"📁 Storage path: {storage_path}")
        
        # Upload to Supabase Storage (ai-documents bucket)
        try:
            upload_result = db.storage.from_('ai-documents').upload(
                storage_path,
                file_content,
                {
                    'content-type': file.content_type or 'application/octet-stream',
                    'cache-control': '3600',
                    'upsert': 'false'
                }
            )
            print(f"✅ File uploaded to storage: {storage_path}")
        except Exception as storage_error:
            print(f"❌ Storage upload error: {storage_error}")
            raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(storage_error)}")
        
        # Get current user ID from JWT token
        user_id = get_user_id_from_request(request)
        
        if not user_id:
            print("⚠️ Warning: Could not extract user_id, using None")
        
        # Save metadata to database
        document_data = {
            'tender_id': tender_id,
            'tenderbureau_id': tenderbureau_id,
            'file_name': unique_filename,
            'original_file_name': file.filename,
            'file_size': len(file_content),
            'file_type': file.content_type or 'application/octet-stream',
            'storage_path': storage_path,
            'document_type': document_type,
            'uploaded_by': user_id
        }
        
        db_result = db.table('tender_documents').insert(document_data).execute()
        
        if not db_result.data:
            raise HTTPException(status_code=500, detail="Failed to save document metadata")
        
        print(f"✅ Document metadata saved: {db_result.data[0]['id']}")
        
        return {
            'success': True,
            'document': map_tender_document_row(db_result.data[0]),
            'message': 'Document successfully uploaded'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error uploading document: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tenders/{tender_id}/documents")
async def get_tender_documents(
    tender_id: str,
    document_type: Optional[str] = None,
    db: Client = Depends(get_supabase_async)
):
    """
    Get all uploaded documents for a tender.
    
    Parameters:
    - tender_id: UUID of the tender
    - document_type: Optional filter by document type
    """
    try:
        print(f"📋 Fetching documents for tender: {tender_id}")
        
        query = db.table('tender_documents')\
            .select('*')\
            .eq('tender_id', tender_id)\
            .eq('is_deleted', False)\
            .order('uploaded_at', desc=True)
        
        if document_type:
            query = query.eq('document_type', document_type)
        
        result = query.execute()
        
        documents = [map_tender_document_row(row) for row in result.data]
        
        print(f"✅ Found {len(documents)} documents")
        
        return {
            'success': True,
            'documents': documents,
            'total': len(documents)
        }
        
    except Exception as e:
        print(f"❌ Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tenders/{tender_id}/documents/{document_id}")
async def get_tender_document(
    tender_id: str,
    document_id: str,
    db: Client = Depends(get_supabase_async)
):
    """Get a specific tender document metadata."""
    try:
        result = db.table('tender_documents')\
            .select('*')\
            .eq('id', document_id)\
            .eq('tender_id', tender_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Document niet gevonden")
        
        return {
            'success': True,
            'document': map_tender_document_row(result.data)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching document: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/tenders/{tender_id}/documents/{document_id}")
async def delete_tender_document(
    tender_id: str,
    document_id: str,
    request: Request,
    db: Client = Depends(get_supabase_async)
):
    """Soft delete a tender document."""
    try:
        print(f"🗑️ Deleting document: {document_id}")
        
        # Get document
        doc_result = db.table('tender_documents')\
            .select('*')\
            .eq('id', document_id)\
            .eq('tender_id', tender_id)\
            .eq('is_deleted', False)\
            .single()\
            .execute()
        
        if not doc_result.data:
            raise HTTPException(status_code=404, detail="Document niet gevonden")
        
        # Get current user ID from JWT token
        user_id = get_user_id_from_request(request)
        
        # Soft delete in database
        update_result = db.table('tender_documents')\
            .update({
                'is_deleted': True,
                'deleted_at': datetime.now().isoformat(),
                'deleted_by': user_id
            })\
            .eq('id', document_id)\
            .execute()
        
        print(f"✅ Document soft deleted: {document_id}")
        
        # Note: We don't delete from storage for recovery purposes
        
        return {
            'success': True,
            'message': 'Document successfully deleted'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting document: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    

    # ============================================
# PROMPT FILLING ENDPOINT
# ============================================

@router.post("/tenders/{tender_id}/fill-prompt/{template_key}")
async def fill_prompt_template(
    tender_id: str,
    template_key: str,
    db: Client = Depends(get_supabase_async)
):
    """
    Fill a prompt template with tender data and uploaded documents.
    
    Logic:
    1. Get tender info
    2. Find best matching prompt (bureau-specific OR global default)
    3. Fill prompt with variables
    4. Return filled prompt ready for Claude.ai
    """
    try:
        print(f"📝 Filling prompt for tender {tender_id}, template {template_key}")
        
        # 1. Get tender info (including bureau)
        tender_result = db.table('tenders')\
            .select('*')\
            .eq('id', tender_id)\
            .single()\
            .execute()
        
        if not tender_result.data:
            raise HTTPException(status_code=404, detail="Tender niet gevonden")
        
        tender = tender_result.data
        tenderbureau_id = tender.get('tenderbureau_id')
        
        # 2. Get best matching prompt
        # Priority: Bureau-specific active prompt > Global active prompt
        prompt_result = db.table('ai_prompts')\
            .select('*')\
            .eq('template_key', template_key)\
            .eq('status', 'active')\
            .or_(f'tenderbureau_id.eq.{tenderbureau_id},tenderbureau_id.is.null')\
            .order('tenderbureau_id', desc=False)\
            .limit(1)\
            .execute()
        
        if not prompt_result.data or len(prompt_result.data) == 0:
            raise HTTPException(
                status_code=404, 
                detail=f"Geen actieve prompt gevonden voor template '{template_key}'"
            )
        
        prompt = prompt_result.data[0]
        prompt_content = prompt.get('prompt_content', '')
        
        print(f"✅ Using prompt: {prompt.get('prompt_title')} (version {prompt.get('version')})")
        
        # 3. Get uploaded documents
        docs_result = db.table('tender_documents')\
            .select('*')\
            .eq('tender_id', tender_id)\
            .eq('is_deleted', False)\
            .execute()
        
        documents = docs_result.data or []
        
        # 4. Build variables dictionary
        variables = {
            'tender_naam': tender.get('naam', 'Onbekende tender'),
            'tender_nummer': tender.get('tender_nummer', 'Geen nummer'),
            'opdrachtgever': tender.get('opdrachtgever', 'Onbekende opdrachtgever'),
            'aanbestedende_dienst': tender.get('aanbestedende_dienst', tender.get('opdrachtgever', 'Onbekend')),
            'locatie': tender.get('locatie', 'Niet opgegeven'),
            'tender_waarde': f"€ {tender.get('tender_waarde', 0):,.2f}" if tender.get('tender_waarde') else 'Niet opgegeven',
            'deadline': str(tender.get('deadline_indiening', 'Niet opgegeven')),
            'omschrijving': tender.get('omschrijving', 'Geen beschrijving'),
            'fase': tender.get('fase', 'onbekend'),
            'status': tender.get('status', 'onbekend'),
        }
        
        # 5. Build documents list
        if documents:
            doc_list = []
            for doc in documents:
                doc_type_label = {
                    'aanbestedingsleidraad': 'Aanbestedingsleidraad',
                    'pve': 'Programma van Eisen',
                    'gunningscriteria': 'Gunningscriteria',
                    'bijlagen': 'Bijlagen',
                    'referenties': 'Referenties'
                }.get(doc.get('document_type'), 'Document')
                
                doc_list.append(f"- {doc_type_label}: {doc.get('original_file_name')}")
            
            variables['documenten_lijst'] = '\n'.join(doc_list)
            variables['aantal_documenten'] = str(len(documents))
        else:
            variables['documenten_lijst'] = '(Nog geen documenten geüpload)'
            variables['aantal_documenten'] = '0'
        
        # 6. Fill template with variables
        filled_prompt = prompt_content
        for key, value in variables.items():
            placeholder = f"{{{{{key}}}}}"  # {{variable}}
            filled_prompt = filled_prompt.replace(placeholder, str(value))
        
        print(f"✅ Prompt filled successfully ({len(filled_prompt)} characters)")
        
        return {
            'success': True,
            'filled_prompt': filled_prompt,
            'variables': variables,
            'prompt_info': {
                'id': prompt.get('id'),
                'title': prompt.get('prompt_title'),
                'version': prompt.get('version'),
                'is_bureau_specific': prompt.get('tenderbureau_id') is not None
            },
            'template_key': template_key,
            'tender_id': tender_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error filling prompt: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
    # ============================================
# PROMPT MANAGEMENT ENDPOINTS
# ============================================

@router.get("/prompts")
async def get_prompts(
    template_key: Optional[str] = None,
    status: Optional[str] = None,
    db: Client = Depends(get_supabase_async)
):
    """
    Get all prompts, optionally filtered.
    Shows bureau-specific prompts + global prompts.
    """
    try:
        query = db.table('ai_prompts').select('*')
        
        if template_key:
            query = query.eq('template_key', template_key)
        
        if status:
            query = query.eq('status', status)
        
        query = query.order('template_key').order('version', desc=True)
        
        result = query.execute()
        
        return {
            'success': True,
            'prompts': result.data,
            'total': len(result.data)
        }
        
    except Exception as e:
        print(f"❌ Error fetching prompts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ⚠️ BELANGRIJK: Deze route MOET VOOR /prompts/{prompt_id} komen!
@router.get("/prompts/active/{template_key}")
async def get_active_prompt(
    template_key: str,
    db: Client = Depends(get_supabase_async)
):
    """
    Get the active prompt for a specific template.
    Returns the global active prompt (where tenderbureau_id is null).
    """
    try:
        print(f"📋 Fetching active prompt for template: {template_key}")
        
        # Find active prompt for this template (global = tenderbureau_id is null)
        result = db.table('ai_prompts')\
            .select('*')\
            .eq('template_key', template_key)\
            .eq('status', 'active')\
            .is_('tenderbureau_id', 'null')\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(
                status_code=404, 
                detail=f"Geen actieve prompt gevonden voor template '{template_key}'"
            )
        
        print(f"✅ Found active prompt: {result.data.get('prompt_title')} (v{result.data.get('version')})")
        
        return {
            'success': True,
            'prompt': result.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching active prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ⬇️ Daarna komt pas @router.get("/prompts/{prompt_id}")



@router.get("/prompts/{prompt_id}")
async def get_prompt(
    prompt_id: str,
    db: Client = Depends(get_supabase_async)
):
    """Get a specific prompt by ID."""
    try:
        result = db.table('ai_prompts')\
            .select('*')\
            .eq('id', prompt_id)\
            .single()\
            .execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Prompt niet gevonden")
        
        return {
            'success': True,
            'prompt': result.data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error fetching prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prompts")
async def create_prompt(
    request: Request,
    prompt_data: dict,
    db: Client = Depends(get_supabase_async)
):
    """
    Create a new prompt version.
    
    Body should contain:
    - template_key
    - prompt_title
    - prompt_content
    - tenderbureau_id (optional, null = global)
    - description (optional)
    """
    try:
        print(f"📝 Creating new prompt for template: {prompt_data.get('template_key')}")
        
        # Get user ID
        user_id = get_user_id_from_request(request)
        
        # Get latest version for this template + bureau
        template_key = prompt_data.get('template_key')
        tenderbureau_id = prompt_data.get('tenderbureau_id')
        
        version_query = db.table('ai_prompts')\
            .select('version')\
            .eq('template_key', template_key)
        
        if tenderbureau_id:
            version_query = version_query.eq('tenderbureau_id', tenderbureau_id)
        else:
            version_query = version_query.is_('tenderbureau_id', 'null')
        
        version_result = version_query.order('version', desc=True).limit(1).execute()
        
        next_version = 1
        if version_result.data and len(version_result.data) > 0:
            next_version = version_result.data[0]['version'] + 1
        
        # Create new prompt
        new_prompt = {
            'template_key': template_key,
            'tenderbureau_id': tenderbureau_id,
            'version': next_version,
            'prompt_title': prompt_data.get('prompt_title'),
            'prompt_content': prompt_data.get('prompt_content'),
            'variables': prompt_data.get('variables', []),
            'status': 'draft',  # Always start as draft
            'description': prompt_data.get('description'),
            'created_by': user_id
        }
        
        result = db.table('ai_prompts').insert(new_prompt).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create prompt")
        
        print(f"✅ Created prompt version {next_version}")
        
        return {
            'success': True,
            'prompt': result.data[0],
            'message': f'Prompt versie {next_version} aangemaakt'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error creating prompt: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/prompts/{prompt_id}")
async def update_prompt(
    prompt_id: str,
    request: Request,
    updates: dict,
    db: Client = Depends(get_supabase_async)
):
    """
    Update an existing prompt.
    Only draft prompts can be updated.
    Active prompts require creating a new version.
    """
    try:
        print(f"📝 Updating prompt: {prompt_id}")
        
        # Get current prompt
        current = db.table('ai_prompts')\
            .select('*')\
            .eq('id', prompt_id)\
            .single()\
            .execute()
        
        if not current.data:
            raise HTTPException(status_code=404, detail="Prompt niet gevonden")
        
        # Check if prompt is draft
        if current.data.get('status') != 'draft':
            raise HTTPException(
                status_code=400, 
                detail="Alleen draft prompts kunnen bewerkt worden. Maak een nieuwe versie voor actieve prompts."
            )
        
        # Get user ID
        user_id = get_user_id_from_request(request)
        
        # Update prompt
        update_data = {
            'prompt_title': updates.get('prompt_title', current.data.get('prompt_title')),
            'prompt_content': updates.get('prompt_content', current.data.get('prompt_content')),
            'description': updates.get('description', current.data.get('description')),
            'variables': updates.get('variables', current.data.get('variables')),
            'updated_by': user_id
        }
        
        result = db.table('ai_prompts')\
            .update(update_data)\
            .eq('id', prompt_id)\
            .execute()
        
        print(f"✅ Prompt updated")
        
        return {
            'success': True,
            'prompt': result.data[0] if result.data else {},
            'message': 'Prompt bijgewerkt'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error updating prompt: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/prompts/{prompt_id}/activate")
async def activate_prompt(
    prompt_id: str,
    request: Request,
    db: Client = Depends(get_supabase_async)
):
    """
    Activate a prompt.
    Deactivates the currently active prompt for this template + bureau.
    """
    try:
        print(f"✅ Activating prompt: {prompt_id}")
        
        # Get prompt to activate
        prompt_result = db.table('ai_prompts')\
            .select('*')\
            .eq('id', prompt_id)\
            .single()\
            .execute()
        
        if not prompt_result.data:
            raise HTTPException(status_code=404, detail="Prompt niet gevonden")
        
        prompt = prompt_result.data
        template_key = prompt.get('template_key')
        tenderbureau_id = prompt.get('tenderbureau_id')
        
        # Get user ID
        user_id = get_user_id_from_request(request)
        
        # Deactivate current active prompt for this template + bureau
        deactivate_query = db.table('ai_prompts')\
            .update({
                'status': 'archived',
                'updated_by': user_id
            })\
            .eq('template_key', template_key)\
            .eq('status', 'active')
        
        if tenderbureau_id:
            deactivate_query = deactivate_query.eq('tenderbureau_id', tenderbureau_id)
        else:
            deactivate_query = deactivate_query.is_('tenderbureau_id', 'null')
        
        deactivate_query.execute()
        
        # Activate new prompt
        activate_result = db.table('ai_prompts')\
            .update({
                'status': 'active',
                'activated_at': datetime.now().isoformat(),
                'activated_by': user_id,
                'updated_by': user_id
            })\
            .eq('id', prompt_id)\
            .execute()
        
        print(f"✅ Prompt activated (version {prompt.get('version')})")
        
        return {
            'success': True,
            'prompt': activate_result.data[0] if activate_result.data else {},
            'message': f"Prompt versie {prompt.get('version')} geactiveerd"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error activating prompt: {e}")
        import traceback
        traceback.print_exc()

        