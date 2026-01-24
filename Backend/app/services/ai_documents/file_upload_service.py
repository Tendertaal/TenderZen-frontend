"""
File Upload Service
Handles file uploads to Supabase Storage
TenderPlanner v3.0 - AI Features
"""
import os
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
from supabase import Client
from pathlib import Path


class FileUploadService:
    """
    Service voor file uploads naar Supabase Storage.
    Handelt uploads af voor AI document generatie.
    """
    
    # Storage bucket naam
    BUCKET_NAME = "ai-documents"
    
    # Folder structuur
    UPLOADS_FOLDER = "uploads"
    GENERATED_FOLDER = "generated"
    
    # File constraints
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    ALLOWED_MIME_TYPES = {
        'application/pdf': '.pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/msword': '.doc'
    }
    
    def __init__(self, db: Client):
        self.db = db
        self.storage = db.storage
    
    def _generate_storage_path(
        self, 
        tender_id: str, 
        filename: str, 
        is_upload: bool = True
    ) -> str:
        """Genereer een unieke storage path."""
        folder = self.UPLOADS_FOLDER if is_upload else self.GENERATED_FOLDER
        
        # Sanitize filename
        safe_filename = self._sanitize_filename(filename)
        
        if is_upload:
            unique_name = f"{uuid.uuid4().hex}_{safe_filename}"
        else:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            unique_name = f"{timestamp}_{safe_filename}"
        
        return f"{folder}/{tender_id}/{unique_name}"
    
    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Maak filename veilig voor storage."""
        filename = os.path.basename(filename)
        filename = filename.replace(' ', '_')
        filename = ''.join(c for c in filename if c.isalnum() or c in '._-')
        return filename
    
    def _validate_file(
        self, 
        file_content: bytes, 
        mime_type: str
    ) -> tuple[bool, Optional[str]]:
        """Valideer file content en type."""
        # Check file size
        if len(file_content) > self.MAX_FILE_SIZE:
            size_mb = len(file_content) / (1024 * 1024)
            max_mb = self.MAX_FILE_SIZE / (1024 * 1024)
            return False, f"Bestand is te groot: {size_mb:.1f}MB (max {max_mb}MB)"
        
        # Check MIME type
        if mime_type not in self.ALLOWED_MIME_TYPES:
            allowed = ', '.join(self.ALLOWED_MIME_TYPES.values())
            return False, f"Bestandstype niet toegestaan. Toegestaan: {allowed}"
        
        # Check content
        if len(file_content) == 0:
            return False, "Bestand is leeg"
        
        return True, None
    
    async def upload_tender_document(
        self,
        tender_id: str,
        file_content: bytes,
        filename: str,
        mime_type: str,
        file_type: str,
        uploaded_by: str
    ) -> Dict[str, Any]:
        """Upload een tender document naar storage."""
        try:
            # Validate
            is_valid, error = self._validate_file(file_content, mime_type)
            if not is_valid:
                raise ValueError(error)
            
            # Generate storage path
            storage_path = self._generate_storage_path(
                tender_id, 
                filename, 
                is_upload=True
            )
            
            # Upload to Supabase Storage
            result = self.storage.from_(self.BUCKET_NAME).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    'content-type': mime_type,
                    'cache-control': '3600',
                    'upsert': 'false'
                }
            )
            
            print(f"✅ File uploaded: {storage_path} ({len(file_content)} bytes)")
            
            # Return metadata
            return {
                'file_id': str(uuid.uuid4()),
                'filename': filename,
                'storage_path': storage_path,
                'size': len(file_content),
                'type': mime_type,
                'file_type': file_type,
                'uploaded_at': datetime.now(),
                'uploaded_by': uploaded_by
            }
            
        except Exception as e:
            print(f"❌ Upload error: {e}")
            raise Exception(f"Upload mislukt: {str(e)}")
    
    async def get_file_download_url(
        self,
        storage_path: str,
        expires_in_seconds: int = 3600
    ) -> str:
        """Genereer een signed URL voor file download."""
        try:
            result = self.storage.from_(self.BUCKET_NAME).create_signed_url(
                path=storage_path,
                expires_in=expires_in_seconds
            )
            
            if result and 'signedURL' in result:
                return result['signedURL']
            
            raise Exception("Kon geen signed URL genereren")
            
        except Exception as e:
            print(f"❌ Error creating signed URL: {e}")
            raise Exception(f"Download URL genereren mislukt: {str(e)}")
    
    async def save_generated_document(
        self,
        tender_id: str,
        file_content: bytes,
        filename: str,
        mime_type: str = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) -> Dict[str, Any]:
        """Sla een gegenereerd document op in storage."""
        try:
            # Generate storage path
            storage_path = self._generate_storage_path(
                tender_id,
                filename,
                is_upload=False
            )
            
            # Upload to storage
            result = self.storage.from_(self.BUCKET_NAME).upload(
                path=storage_path,
                file=file_content,
                file_options={
                    'content-type': mime_type,
                    'cache-control': '3600',
                    'upsert': 'true'
                }
            )
            
            print(f"✅ Generated document saved: {storage_path}")
            
            # Generate download URL
            download_url = await self.get_file_download_url(
                storage_path,
                expires_in_seconds=7 * 24 * 3600
            )
            
            return {
                'storage_path': storage_path,
                'filename': filename,
                'size': len(file_content),
                'type': mime_type,
                'download_url': download_url,
                'created_at': datetime.now()
            }
            
        except Exception as e:
            print(f"❌ Error saving generated document: {e}")
            raise Excepti