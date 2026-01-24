"""
AI Document Service
Main orchestrator for AI document generation
TenderPlanner v3.0 - AI Features
"""
import uuid
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
from supabase import Client

from .file_upload_service import FileUploadService
from .claude_api_service import ClaudeAPIService


class AIDocumentService:
    """
    Main service voor AI document generatie.
    Orchestreert het volledige generatie proces.
    """
    
    def __init__(self, db: Client, claude_api_key: Optional[str] = None):
        self.db = db
        self.file_service = FileUploadService(db)
        self.claude_service = ClaudeAPIService(api_key=claude_api_key)
    
    # ============================================
    # TEMPLATE MANAGEMENT
    # ============================================
    
    async def get_all_templates(self, only_active: bool = True) -> List[Dict[str, Any]]:
        """Haal alle beschikbare templates op."""
        try:
            query = self.db.table('ai_document_templates')\
                .select('*')\
                .order('volgorde', desc=False)
            
            if only_active:
                query = query.eq('is_active', True)
            
            result = query.execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting templates: {e}")
            return []
    
    async def get_template_by_key(self, template_key: str) -> Optional[Dict[str, Any]]:
        """Haal specifiek template op."""
        try:
            result = self.db.table('ai_document_templates')\
                .select('*')\
                .eq('template_key', template_key)\
                .single()\
                .execute()
            
            return result.data if result.data else None
            
        except Exception as e:
            print(f"❌ Error getting template: {e}")
            return None
    
    # ============================================
    # DOCUMENT MANAGEMENT
    # ============================================
    
    async def create_document(
        self,
        tender_id: str,
        template_key: str,
        tenderbureau_id: str,
        input_data: Dict[str, Any],
        uploaded_files: List[Dict[str, Any]],
        created_by: str,
        generation_config: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """Maak een nieuw AI document record aan."""
        try:
            document_data = {
                'tender_id': tender_id,
                'template_key': template_key,
                'tenderbureau_id': tenderbureau_id,
                'status': 'queued',
                'progress': 0,
                'input_data': input_data,
                'uploaded_files': uploaded_files,
                'generation_config': generation_config or {},
                'created_by': created_by,
                'created_at': datetime.now().isoformat()
            }
            
            result = self.db.table('ai_documents')\
                .insert(document_data)\
                .execute()
            
            if result.data and len(result.data) > 0:
                document_id = result.data[0]['id']
                print(f"✅ AI document created: {document_id}")
                return document_id
            
            return None
            
        except Exception as e:
            print(f"❌ Error creating document: {e}")
            return None
    
    async def update_document_status(
        self,
        document_id: str,
        status: str,
        progress: Optional[int] = None,
        current_step: Optional[str] = None,
        current_step_number: Optional[int] = None,
        error_message: Optional[str] = None
    ) -> bool:
        """Update document status."""
        try:
            update_data = {'status': status}
            
            if progress is not None:
                update_data['progress'] = progress
            
            if current_step:
                update_data['current_step'] = current_step
            
            if current_step_number is not None:
                update_data['current_step_number'] = current_step_number
            
            if error_message:
                update_data['error_message'] = error_message
            
            if status == 'generating' and not update_data.get('started_at'):
                update_data['started_at'] = datetime.now().isoformat()
            
            if status == 'completed':
                update_data['completed_at'] = datetime.now().isoformat()
            
            result = self.db.table('ai_documents')\
                .update(update_data)\
                .eq('id', document_id)\
                .execute()
            
            return True
            
        except Exception as e:
            print(f"❌ Error updating document status: {e}")
            return False
    
    async def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Haal document op."""
        try:
            result = self.db.table('ai_documents')\
                .select('*')\
                .eq('id', document_id)\
                .single()\
                .execute()
            
            return result.data if result.data else None
            
        except Exception as e:
            print(f"❌ Error getting document: {e}")
            return None
    
    async def get_documents_for_tender(
        self,
        tender_id: str,
        include_deleted: bool = False
    ) -> List[Dict[str, Any]]:
        """Haal alle AI documenten op voor een tender."""
        try:
            query = self.db.table('ai_documents')\
                .select('*')\
                .eq('tender_id', tender_id)\
                .order('created_at', desc=True)
            
            if not include_deleted:
                query = query.eq('is_deleted', False)
            
            result = query.execute()
            
            return result.data if result.data else []
            
        except Exception as e:
            print(f"❌ Error getting tender documents: {e}")
            return []
    
    async def get_document_summary_for_tender(
        self,
        tender_id: str
    ) -> Dict[str, Any]:
        """Haal samenvatting op van AI documenten voor een tender."""
        try:
            docs = await self.get_documents_for_tender(tender_id)
            
            return {
                'total_documents': len(docs),
                'completed_documents': len([d for d in docs if d['status'] == 'completed']),
                'generating_documents': len([d for d in docs if d['status'] == 'generating']),
                'failed_documents': len([d for d in docs if d['status'] == 'failed']),
                'latest_document_created_at': max([d['created_at'] for d in docs]) if docs else None
            }
            
        except Exception as e:
            print(f"❌ Error getting document summary: {e}")
            return {
                'total_documents': 0,
                'completed_documents': 0,
                'generating_documents': 0,
                'failed_documents': 0,
                'latest_document_created_at': None
            }
    
    # ============================================
    # SESSION MANAGEMENT
    # ============================================
    
    async def create_generation_session(
        self,
        document_id: str
    ) -> Optional[Dict[str, Any]]:
        """Maak een generation session aan."""
        try:
            session_data = {
                'document_id': document_id,
                'session_token': str(uuid.uuid4()),
                'is_active': True,
                'progress_data': {},
                'last_heartbeat_at': datetime.now().isoformat(),
                'created_at': datetime.now().isoformat()
            }
            
            result = self.db.table('ai_generation_sessions')\
                .insert(session_data)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            return None
            
        except Exception as e:
            print(f"❌ Error creating session: {e}")
            return None
    
    async def get_session_progress(
        self,
        session_token: str
    ) -> Optional[Dict[str, Any]]:
        """Haal session progress op."""
        try:
            result = self.db.table('ai_generation_sessions')\
                .select('*')\
                .eq('session_token', session_token)\
                .eq('is_active', True)\
                .single()\
                .execute()
            
            return result.data if result.data else None
            
        except Exception as e:
            print(f"❌ Error getting session: {e}")
            return None
    
    async def close_session(self, session_token: str):
        """Sluit een session af."""
        try:
            self.db.table('ai_generation_sessions')\
                .update({'is_active': False})\
                .eq('session_token', session_token)\
                .execute()
        except Exception as e:
            print(f"⚠️ Could not close session: {e}")
    
    # ============================================
    # DOCUMENT GENERATION
    # ============================================
    
    async def generate_document(
        self,
        document_id: str
    ) -> Dict[str, Any]:
        """Hoofdfunctie: Genereer een AI document."""
        start_time = datetime.now()
        
        try:
            # Haal document op
            document = await self.get_document_by_id(document_id)
            if not document:
                return {'success': False, 'error': 'Document niet gevonden'}
            
            # Update status naar 'generating'
            await self.update_document_status(
                document_id,
                status='generating',
                progress=0,
                current_step='Voorbereiden generatie'
            )
            
            # Create session
            session = await self.create_generation_session(document_id)
            session_token = session['session_token'] if session else None
            
            # Route naar generator
            if document['template_key'] == 'rode_draad':
                result = await self._generate_rode_draad_document(
                    document,
                    session_token
                )
            else:
                result = {'success': False, 'error': f'Template niet geïmplementeerd: {document["template_key"]}'}
            
            # Handle result
            if result['success']:
                end_time = datetime.now()
                total_seconds = int((end_time - start_time).total_seconds())
                
                await self.update_document_status(
                    document_id,
                    status='completed',
                    progress=100,
                    current_step='Voltooid'
                )
                
                # Update generated file info
                self.db.table('ai_documents')\
                    .update({
                        'generated_file_path': result['file_path'],
                        'generated_file_name': result['filename'],
                        'generated_file_size': result['file_size'],
                        'generated_file_url': result['download_url'],
                        'generation_time_seconds': total_seconds,
                        'claude_tokens_used': result.get('tokens_used', 0),
                        'completed_at': datetime.now().isoformat()
                    })\
                    .eq('id', document_id)\
                    .execute()
                
                print(f"✅ Document generation completed: {document_id}")
                
                return {
                    'success': True,
                    'document_id': document_id,
                    'generated_file_path': result['file_path'],
                    'download_url': result['download_url'],
                    'generation_time_seconds': total_seconds
                }
                
            else:
                await self.update_document_status(
                    document_id,
                    status='failed',
                    error_message=result['error']
                )
                
                return {
                    'success': False,
                    'document_id': document_id,
                    'error': result['error']
                }
            
        except Exception as e:
            print(f"❌ Unexpected error during generation: {e}")
            
            await self.update_document_status(
                document_id,
                status='failed',
                error_message=str(e)
            )
            
            return {
                'success': False,
                'document_id': document_id,
                'error': f'Unexpected error: {str(e)}'
            }
        
        finally:
            if session_token:
                await self.close_session(session_token)
    
    # ============================================
    # RODE DRAAD GENERATOR
    # ============================================
    
    async def _generate_rode_draad_document(
        self,
        document: Dict[str, Any],
        session_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Genereer een Rode Draad document (MVP versie)."""
        try:
            tender_id = document['tender_id']
            input_data = document['input_data']
            
            # STAP 1: Placeholder analysis
            await self.update_document_status(
                document['id'],
                status='generating',
                progress=50,
                current_step='Genereren document',
                current_step_number=1
            )
            
            # Voor MVP: Maak simpel placeholder document
            tender_data = {'opdrachtgever': 'Test Opdrachtgever'}
            
            # STAP 2: Creëer document
            await self.update_document_status(
                document['id'],
                status='generating',
                progress=75,
                current_step='Samenstellen document',
                current_step_number=2
            )
            
            docx_content = self._create_placeholder_docx(tender_data, input_data)
            
            # STAP 3: Upload
            await self.update_document_status(
                document['id'],
                status='generating',
                progress=90,
                current_step='Opslaan document',
                current_step_number=3
            )
            
            filename = f"Rode-draad-sessie_Test_{datetime.now().strftime('%Y%m%d')}.docx"
            
            file_result = await self.file_service.save_generated_document(
                tender_id=tender_id,
                file_content=docx_content,
                filename=filename
            )
            
            return {
                'success': True,
                'file_path': file_result['storage_path'],
                'filename': filename,
                'file_size': file_result['size'],
                'download_url': file_result['download_url'],
                'tokens_used': 0
            }
            
        except Exception as e:
            print(f"❌ Rode Draad generation error: {e}")
            return {
                'success': False,
                'error': f'Generatie mislukt: {str(e)}'
            }
    
    def _create_placeholder_docx(
        self,
        tender_data: Dict[str, Any],
        inschrijver_data: Dict[str, Any]
    ) -> bytes:
        """Creëer placeholder DOCX voor MVP."""
        content = f"""
RODE DRAAD SESSIE DOCUMENT - MVP TEST
=====================================

OPDRACHTGEVER: {tender_data.get('opdrachtgever', 'Onbekend')}
INSCHRIJVER: {inschrijver_data.get('bedrijf', 'Onbekend')}
DATUM: {datetime.now().strftime('%d-%m-%Y')}

Dit is een MVP test document.
De volledige DOCX generatie met alle 6 prompts komt in de volgende fase.
"""
        return content.encode('utf-8')
    
    # ============================================
    # DOWNLOAD
    # ============================================
    
    async def get_download_url(
        self,
        document_id: str,
        user_id: str
    ) -> Optional[str]:
        """Genereer download URL."""
        try:
            document = await self.get_document_by_id(document_id)
            if not document or document['status'] != 'completed':
                return None
            
            download_url = await self.file_service.get_file_download_url(
                storage_path=document['generated_file_path'],
                expires_in_seconds=3600
            )
            
            # Track download
            current_count = document.get('download_count', 0)
            self.db.table('ai_documents')\
                .update({
                    'downloaded_at': datetime.now().isoformat(),
                    'download_count': current_count + 1
                })\
                .eq('id', document_id)\
                .execute()
            
            return download_url
            
        except Exception as e:
            print(f"❌ Error getting download URL: {e}")
            return None