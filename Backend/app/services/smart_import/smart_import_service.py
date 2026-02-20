import unicodedata
# app/services/smart_import/smart_import_service.py
"""
Smart Import Service
Orchestreert het volledige import proces voor AI-gestuurde tender aanmaak
TenderZen v3.5

NEW v3.5:
- Model keuze: Haiku (standaard) of Sonnet (pro)
- "Opnieuw analyseren" met ander model
- Model info wordt opgeslagen voor tracking
- reanalyze() methode voor her-analyse met ander model

NEW v3.4:
- json-repair library voor robuuste JSON parsing
- Verhoogde max_tokens (8000) voor langere responses
- Betere error logging bij JSON parse failures

NEW v3.3:
- add_document() methode voor extra documenten toevoegen
- analyze_supplement() methode voor aanvullende analyse
- Merge logica voor bestaande + nieuwe data
- Focus op lege velden bij aanvullende analyse

FIX v3.2:
- Dynamische fase_status lookup uit database (geen hardcoded 'nieuw')
- Betere logging van extracted data
- Verwijder fase_status als niet meegegeven in options

FIX v3.1:
- JSON parsing toegevoegd voor Claude API response (was string, nu dict)
- Betere error handling bij JSON parse failures

HERGEBRUIKT BESTAANDE SERVICES:
- ClaudeAPIService voor AI extractie (v2.0 met model keuze)
- Supabase client voor database/storage

MODELLEN:
- haiku / claude-haiku-4-5-20251001 (standaard) - Snel, goedkoop
- sonnet / claude-sonnet-4-20250514 (pro) - Nauwkeuriger
"""
import json
import logging
import re
import time
from typing import List, Dict, Any, Optional
from datetime import datetime

from supabase import Client
from json_repair import repair_json

from .text_extraction_service import TextExtractionService
from ..ai_documents.claude_api_service import ClaudeAPIService
from app.config import settings

logger = logging.getLogger(__name__)

# Configuratie
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB per bestand
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50MB totaal
MAX_FILES = 10
ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
]
STORAGE_BUCKET = 'smart-imports'


class SmartImportService:
    """
    Orchestreert het volledige Smart Import proces:
    1. Bestandsupload naar Supabase Storage
    2. Tekst extractie uit PDF/DOCX
    3. AI analyse via bestaande ClaudeAPIService
    4. Tender aanmaken met geëxtraheerde data

    v3.5: Model keuze (Haiku standaard, Sonnet pro)
    v3.4: Robuuste JSON parsing met json-repair
    v3.3: Extra document toevoegen en aanvullende analyse
    """

    @staticmethod
    def safe_filename(filename: str) -> str:
        """
        Normalize and sanitize filenames for safe storage in Supabase.
        - Removes/replace unsafe characters
        - Normalizes unicode
        - Prevents path traversal
        """
        # Normalize unicode
        filename = unicodedata.normalize('NFKD', filename)
        # Remove path separators
        filename = filename.replace('..', '').replace('/', '_').replace('\\', '_')
        # Remove unsafe characters (allow alphanum, dash, underscore, dot)
        filename = re.sub(r'[^A-Za-z0-9._-]', '_', filename)
        # Prevent empty filename
        if not filename or filename.startswith('.'):
            filename = f'file_{int(time.time())}'
        return filename
    
    def __init__(self, db: Client):
        self.db = db
        self.storage = db.storage
        self.text_service = TextExtractionService()
        
        # Hergebruik bestaande ClaudeAPIService - gebruik settings uit config.py
        if settings.anthropic_api_key:
            self.claude_service = ClaudeAPIService(api_key=settings.anthropic_api_key)
        else:
            self.claude_service = None
            logger.warning("⚠️ ANTHROPIC_API_KEY not found - AI extraction disabled")
    
    # ==========================================
    # Import Session Management
    # ==========================================
    
    async def create_import_session(
        self, 
        tenderbureau_id: str, 
        user_id: str
    ) -> Dict[str, Any]:
        """Maak een nieuwe import sessie aan."""
        try:
            result = self.db.table('smart_imports').insert({
                'tenderbureau_id': tenderbureau_id,
                'created_by': user_id,
                'status': 'uploading',
                'progress': 0
            }).execute()
            
            logger.info(f"✅ Created import session: {result.data[0]['id']}")
            return result.data[0]
            
        except Exception as e:
            logger.exception(f"❌ Failed to create import session: {e}")
            raise
    
    async def get_import(self, import_id: str) -> Optional[Dict[str, Any]]:
        """Haal import record op."""
        try:
            result = self.db.table('smart_imports').select(
                '*'
            ).eq('id', import_id).single().execute()
            return result.data
        except Exception:
            return None
    
    # ==========================================
    # File Upload
    # ==========================================
    
    async def upload_files(
        self, 
        import_id: str, 
        files: List[Any]
    ) -> List[Dict[str, Any]]:
        """Upload bestanden naar Supabase Storage."""
        uploaded = []
        total_size = 0
        
        for file in files:
            # Valideer bestandstype
            if file.content_type not in ALLOWED_MIME_TYPES:
                raise ValueError(f"Bestandstype niet toegestaan: {file.content_type}")
            
            # Lees bestand
            content = await file.read()
            file_size = len(content)
            
            # Valideer grootte
            if file_size > MAX_FILE_SIZE:
                raise ValueError(f"Bestand te groot: {file.filename} ({file_size / 1024 / 1024:.1f}MB, max 25MB)")
            
            total_size += file_size
            if total_size > MAX_TOTAL_SIZE:
                raise ValueError(f"Totale grootte overschrijdt 50MB limiet")
            
            # Sanitize filename
            safe_name = self.safe_filename(file.filename)
            storage_path = f"{import_id}/{safe_name}"

            try:
                self.storage.from_(STORAGE_BUCKET).upload(
                    path=storage_path,
                    file=content,
                    file_options={"content-type": file.content_type}
                )
            except Exception as e:
                logger.exception(f"❌ Failed to upload {file.filename}: {e}")
                raise ValueError(f"Upload mislukt voor {file.filename}")

            # Detecteer document type
            detected_type = self._detect_document_type(safe_name)

            uploaded.append({
                'name': safe_name,
                'size': file_size,
                'storage_path': f"{STORAGE_BUCKET}/{storage_path}",
                'detected_type': detected_type,
                'mime_type': file.content_type
            })

            logger.info(f"✅ Uploaded: {safe_name} ({file_size} bytes)")
        
        # Update import record
        self.db.table('smart_imports').update({
            'uploaded_files': uploaded,
            'status': 'uploaded',
            'progress': 10
        }).eq('id', import_id).execute()
        
        return uploaded
    
    # ==========================================
    # v3.3: Add Extra Document
    # ==========================================
    
    async def add_document(
        self,
        import_id: str,
        file: Any
    ) -> Dict[str, Any]:
        """
        Voeg een extra document toe aan een bestaande import sessie.
        Dit wordt gebruikt om ontbrekende data aan te vullen.
        """
        try:
            # Haal huidige import op
            import_record = await self.get_import(import_id)
            if not import_record:
                raise ValueError(f"Import not found: {import_id}")
            
            # Valideer bestandstype
            if file.content_type not in ALLOWED_MIME_TYPES:
                raise ValueError(f"Bestandstype niet toegestaan: {file.content_type}")
            
            # Lees bestand
            content = await file.read()
            file_size = len(content)
            
            # Valideer grootte
            if file_size > MAX_FILE_SIZE:
                raise ValueError(f"Bestand te groot: {file.filename}")
            
            # Upload naar Supabase Storage
            storage_path = f"{import_id}/{file.filename}"
            
            try:
                self.storage.from_(STORAGE_BUCKET).upload(
                    path=storage_path,
                    file=content,
                    file_options={"content-type": file.content_type}
                )
            except Exception as e:
                # Bestand bestaat mogelijk al, probeer te overschrijven
                logger.warning(f"⚠️ Upload failed, trying update: {e}")
                try:
                    self.storage.from_(STORAGE_BUCKET).update(
                        path=storage_path,
                        file=content,
                        file_options={"content-type": file.content_type}
                    )
                except Exception as e2:
                    logger.exception(f"❌ Failed to upload/update {file.filename}: {e2}")
                    raise ValueError(f"Upload mislukt voor {file.filename}")
            
            # Voeg toe aan bestaande files lijst
            current_files = import_record.get('uploaded_files', [])
            
            # Check of bestand al bestaat
            existing_index = next(
                (i for i, f in enumerate(current_files) if f['name'] == file.filename), 
                None
            )
            
            new_file_info = {
                'name': file.filename,
                'size': file_size,
                'storage_path': f"{STORAGE_BUCKET}/{storage_path}",
                'detected_type': self._detect_document_type(file.filename),
                'mime_type': file.content_type,
                'is_supplement': True,  # Markeer als aanvullend document
                'added_at': datetime.utcnow().isoformat()
            }
            
            if existing_index is not None:
                current_files[existing_index] = new_file_info
            else:
                current_files.append(new_file_info)
            
            # Update import record
            # Gebruik 'uploaded' status (bestaat in database constraint)
            self.db.table('smart_imports').update({
                'uploaded_files': current_files,
                'status': 'uploaded',  # Was 'document_added' maar bestaat niet in constraint
                'progress': 10
            }).eq('id', import_id).execute()
            
            logger.info(f"✅ Added extra document: {file.filename} to import {import_id}")
            
            return {
                'success': True,
                'file': new_file_info,
                'total_files': len(current_files)
            }
            
        except Exception as e:
            logger.exception(f"❌ Failed to add document: {e}")
            raise
    
    # ==========================================
    # v3.3: Supplemental Analysis
    # ==========================================
    
    async def analyze_supplement(
        self,
        import_id: str,
        existing_data: Dict[str, Any] = None,
        focus_on_empty: bool = True
    ) -> Dict[str, Any]:
        """
        Voer een aanvullende analyse uit op nieuw toegevoegde documenten.
        Merget de resultaten met bestaande data, waarbij nieuwe waarden
        alleen worden toegevoegd als ze ontbreken of hogere confidence hebben.
        """
        start_time = time.time()
        
        try:
            # Update status
            self._update_status(import_id, 'analyzing', progress=15, current_step='supplement_extraction')
            
            # Haal import record op
            import_record = await self.get_import(import_id)
            if not import_record:
                raise ValueError(f"Import not found: {import_id}")
            
            # Gebruik bestaande data uit record als niet meegegeven
            if existing_data is None:
                existing_data = import_record.get('extracted_data', {})
            
            # Vind het meest recente supplement document
            files = import_record.get('uploaded_files', [])
            supplement_files = [f for f in files if f.get('is_supplement', False)]
            
            if not supplement_files:
                # Analyseer het laatste bestand
                supplement_files = [files[-1]] if files else []
            
            if not supplement_files:
                raise ValueError("Geen aanvullend document gevonden")
            
            logger.info(f"📄 Analyzing {len(supplement_files)} supplement file(s)")
            
            # Extract tekst uit supplement bestanden
            self._update_status(import_id, 'analyzing', progress=25, current_step='text_extraction')
            
            combined_text = ""
            for file_info in supplement_files:
                file_content = self._download_file(import_id, file_info['name'])
                text = await self.text_service.extract(
                    content=file_content,
                    filename=file_info['name'],
                    mime_type=file_info.get('mime_type', 'application/pdf')
                )
                combined_text += f"\n\n{'='*60}\n=== {file_info['name']} (AANVULLEND) ===\n{'='*60}\n\n{text}"
            
            # AI Extractie met focus op ontbrekende velden
            self._update_status(import_id, 'analyzing', progress=50, current_step='ai_extraction')
            
            if not self.claude_service:
                raise ValueError("Claude API niet geconfigureerd")
            
            # Bepaal welke velden nog leeg zijn
            empty_fields = self._find_empty_fields(existing_data) if focus_on_empty else []
            
            logger.info(f"🤖 Starting supplemental AI extraction (focus on: {len(empty_fields)} empty fields)")
            
            new_data = await self._extract_with_ai_supplement(
                combined_text, 
                empty_fields,
                existing_data
            )
            
            # Merge data
            self._update_status(import_id, 'analyzing', progress=80, current_step='merging')
            merged_data, newly_filled = self._merge_extracted_data(existing_data, new_data)
            
            logger.info(f"✨ Newly filled fields: {newly_filled}")
            
            # Bereken statistieken
            self._update_status(import_id, 'analyzing', progress=95, current_step='finalizing')
            stats = self._calculate_statistics(merged_data)
            extraction_time = int(time.time() - start_time)
            
            # Update import record
            self.db.table('smart_imports').update({
                'status': 'completed',
                'progress': 100,
                'current_step': None,
                'extracted_data': merged_data,
                'total_fields': stats['total_fields'],
                'fields_extracted': stats['fields_extracted'],
                'fields_high_confidence': stats['fields_high_confidence'],
                'fields_medium_confidence': stats['fields_medium_confidence'],
                'fields_low_confidence': stats['fields_low_confidence'],
                'warnings': merged_data.get('warnings', []),
                'extraction_time_seconds': extraction_time,
                'ai_tokens_used': (
                    import_record.get('ai_tokens_used', 0) + 
                    new_data.get('_meta', {}).get('tokens_used', 0)
                ),
                'supplement_analysis_at': datetime.utcnow().isoformat(),
                'newly_filled_fields': newly_filled
            }).eq('id', import_id).execute()
            
            logger.info(f"✅ Supplemental analysis completed in {extraction_time}s")
            
            return {
                'import_id': import_id,
                'status': 'completed',
                'extracted_data': merged_data,
                'newly_filled_fields': newly_filled,
                'statistics': stats,
                'extraction_time_seconds': extraction_time
            }
            
        except Exception as e:
            logger.exception(f"❌ Supplemental analysis failed: {e}")
            self._update_status(import_id, 'failed', error_message=str(e))
            raise
    
    def _find_empty_fields(self, data: Dict[str, Any]) -> List[str]:
        """Vind alle velden die nog geen waarde hebben."""
        empty = []
        
        for category in ['basisgegevens', 'planning']:
            category_data = data.get(category, {})
            for key, value in category_data.items():
                if isinstance(value, dict) and not value.get('value'):
                    empty.append(f"{category}.{key}")
        
        return empty
    
    def _merge_extracted_data(
        self,
        existing: Dict[str, Any],
        new: Dict[str, Any]
    ) -> tuple[Dict[str, Any], List[str]]:
        """
        Merge nieuwe data met bestaande data.
        Returns: (merged_data, list of newly filled field labels)
        """
        merged = json.loads(json.dumps(existing))  # Deep copy
        newly_filled = []
        
        field_labels = {
            'naam': 'Tendernaam',
            'opdrachtgever': 'Opdrachtgever',
            'aanbestedende_dienst': 'Aanbestedende dienst',
            'tender_nummer': 'Tendernummer',
            'type': 'Type',
            'geraamde_waarde': 'Geraamde waarde',
            'locatie': 'Locatie',
            'tenderned_url': 'TenderNed URL',
            'publicatie_datum': 'Publicatiedatum',
            'schouw_datum': 'Schouwdatum',
            'nvi1_datum': 'NvI 1 deadline',
            'nvi_1_publicatie': 'NvI 1 publicatie',
            'nvi2_datum': 'NvI 2 deadline',
            'nvi_2_publicatie': 'NvI 2 publicatie',
            'deadline_indiening': 'Deadline indiening',
            'presentatie_datum': 'Presentatiedatum',
            'voorlopige_gunning': 'Voorlopige gunning',
            'definitieve_gunning': 'Definitieve gunning',
            'start_uitvoering': 'Start uitvoering',
            'einde_contract': 'Einde contract'
        }
        
        # Merge basisgegevens
        for key in ['basisgegevens', 'planning']:
            if key not in merged:
                merged[key] = {}
            if key not in new:
                continue
                
            for field, new_value in new[key].items():
                if not isinstance(new_value, dict):
                    continue
                    
                existing_value = merged[key].get(field, {})
                existing_val = existing_value.get('value') if isinstance(existing_value, dict) else None
                new_val = new_value.get('value')
                new_conf = new_value.get('confidence', 0)
                existing_conf = existing_value.get('confidence', 0) if isinstance(existing_value, dict) else 0
                
                # Voeg toe als:
                # 1. Existing is leeg en new heeft waarde
                # 2. New heeft hogere confidence
                should_update = (
                    (not existing_val and new_val) or
                    (new_val and new_conf > existing_conf)
                )
                
                if should_update and new_val:
                    if not existing_val:
                        label = field_labels.get(field, field)
                        newly_filled.append(label)
                        logger.info(f"  ✨ Filled: {field} = {new_val}")
                    else:
                        logger.info(f"  🔄 Updated: {field} = {new_val} (higher confidence)")
                    
                    merged[key][field] = new_value
        
        # Merge gunningscriteria
        if 'gunningscriteria' in new and new['gunningscriteria'].get('criteria'):
            if 'gunningscriteria' not in merged or not merged['gunningscriteria'].get('criteria'):
                merged['gunningscriteria'] = new['gunningscriteria']
                newly_filled.append('Gunningscriteria')
        
        # Merge certificeringen
        if 'certificeringen' in new and new['certificeringen'].get('vereist'):
            if 'certificeringen' not in merged or not merged['certificeringen'].get('vereist'):
                merged['certificeringen'] = new['certificeringen']
                newly_filled.append('Certificeringen')
        
        # Update warnings - verwijder "niet gevonden" warnings als data nu wel gevonden is
        existing_warnings = merged.get('warnings', [])
        new_warnings = new.get('warnings', [])
        
        # Filter out warnings over ontbrekende data als we die nu hebben gevonden
        if newly_filled:
            existing_warnings = [
                w for w in existing_warnings 
                if not any(label.lower() in w.lower() for label in newly_filled)
            ]
        
        merged['warnings'] = list(set(existing_warnings + new_warnings))
        
        return merged, newly_filled
    
    async def _extract_with_ai_supplement(
        self,
        document_content: str,
        empty_fields: List[str],
        existing_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Gebruik AI voor aanvullende extractie, met focus op lege velden."""
        
        # Truncate indien nodig
        max_chars = 150000
        if len(document_content) > max_chars:
            document_content = document_content[:max_chars] + "\n\n[Document afgekapt...]"
        
        # Bouw lijst van ontbrekende velden voor de prompt
        empty_fields_text = ""
        if empty_fields:
            empty_fields_text = f"""
LET OP: De volgende velden ontbreken nog en zijn EXTRA BELANGRIJK om te vinden:
{chr(10).join(f'- {f}' for f in empty_fields)}

Focus vooral op het vinden van deze ontbrekende informatie!
"""
        
        system_prompt = """Je bent een expert in het analyseren van Nederlandse aanbestedingsdocumenten. 
Je taak is om AANVULLENDE informatie te extraheren uit een extra document.

REGELS:
1. Gebruik ALLEEN informatie die EXPLICIET in dit document staat
2. Als iets niet gevonden wordt, zet value op null en confidence op 0
3. Geef bij elke waarde de bron aan (source)
4. Confidence score: 0.0-1.0 (0=niet gevonden, 1=100% zeker)
5. Datums in ISO formaat: YYYY-MM-DD of YYYY-MM-DDTHH:MM:SS
6. Bedragen als integer (geen valutasymbool)
7. Retourneer ALLEEN valide JSON, geen uitleg ervoor of erna
8. Dit is een AANVULLEND document - zoek vooral naar planning, deadlines en andere details"""

        user_prompt = f"""Analyseer dit AANVULLENDE aanbestedingsdocument en extraheer alle informatie.
{empty_fields_text}

DOCUMENT:
{document_content}

EXTRAHEER (geef ALLEEN JSON terug):
{{
    "basisgegevens": {{
        "naam": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "document/pagina" }},
        "opdrachtgever": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "aanbestedende_dienst": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "tender_nummer": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "type": {{ "value": "europese_aanbesteding|nationale_aanbesteding|meervoudig_onderhands|enkelvoudig_onderhands of null", "confidence": 0.0-1.0, "source": "..." }},
        "geraamde_waarde": {{ "value": "number of null", "confidence": 0.0-1.0, "source": "..." }},
        "locatie": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "tenderned_url": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }}
    }},
    "planning": {{
        "publicatie_datum": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "schouw_datum": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi1_datum": {{ "value": "YYYY-MM-DDTHH:MM:SS of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi_1_publicatie": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi2_datum": {{ "value": "YYYY-MM-DDTHH:MM:SS of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi_2_publicatie": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "deadline_indiening": {{ "value": "YYYY-MM-DDTHH:MM:SS of null", "confidence": 0.0-1.0, "source": "..." }},
        "presentatie_datum": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "voorlopige_gunning": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "definitieve_gunning": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "start_uitvoering": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "einde_contract": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }}
    }},
    "gunningscriteria": {{
        "criteria": [
            {{ "code": "K1", "naam": "...", "percentage": 40, "confidence": 0.0-1.0 }}
        ],
        "source": "..."
    }},
    "certificeringen": {{
        "vereist": [
            {{ "naam": "ISO 9001", "verplicht": true, "confidence": 0.0-1.0 }}
        ],
        "source": "..."
    }},
    "warnings": ["lijst van waarschuwingen"]
}}"""

        result = await self.claude_service.execute_prompt_with_retry(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_format="json",
            max_tokens=8000,
            temperature=0.2
        )
        
        if result['success']:
            content = result['content']
            
            # v3.4: Robuuste JSON parsing met json-repair
            if isinstance(content, str):
                logger.info("📝 Parsing JSON string response from Claude")
                
                # Strip markdown codeblocks indien aanwezig
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
                if json_match:
                    content = json_match.group(1)
                
                # Gebruik json-repair library voor robuuste parsing
                try:
                    extracted = json.loads(repair_json(content))
                    logger.info("✅ JSON parsed successfully")
                except Exception as e:
                    logger.error(f"❌ JSON parse failed even after repair: {e}")
                    logger.error(f"📄 Raw content (first 1000 chars): {content[:1000]}")
                    raise ValueError(f"Kon JSON niet parsen: {e}")
            else:
                extracted = content
            
            # Voeg metadata toe
            extracted['_meta'] = {
                'model': result.get('model', 'claude-haiku-4-5-20251001'),
                'tokens_used': result.get('usage', {}).get('input_tokens', 0) + result.get('usage', {}).get('output_tokens', 0),
                'is_supplement': True
            }
            
            return extracted
        else:
            raise ValueError(f"AI extraction failed: {result.get('error')}")
    
    def _detect_document_type(self, filename: str) -> str:
        """Detecteer document type op basis van bestandsnaam."""
        filename_lower = filename.lower()
        
        if 'leidraad' in filename_lower or 'aanbestedingsdocument' in filename_lower:
            return 'leidraad'
        elif 'planning' in filename_lower or 'tijdschema' in filename_lower:
            return 'bijlage_planning'
        elif 'programma' in filename_lower and 'eisen' in filename_lower:
            return 'bijlage_eisen'
        elif 'pve' in filename_lower or 'bestek' in filename_lower:
            return 'bijlage_eisen'
        elif 'nota' in filename_lower and 'inlichtingen' in filename_lower:
            return 'nota_van_inlichtingen'
        elif 'nvi' in filename_lower:
            return 'nota_van_inlichtingen'
        elif 'bijlage' in filename_lower:
            return 'bijlage_overig'
        else:
            return 'overig'
    
    # ==========================================
    # Analysis (Original)
    # ==========================================
    
    async def analyze(
        self, 
        import_id: str,
        options: Dict[str, Any] = None,
        model: str = None  # v3.5: Model keuze (None=haiku, "sonnet"=pro)
    ) -> Dict[str, Any]:
        """
        Voer de volledige analyse uit.
        
        Args:
            import_id: UUID van de import sessie
            options: Analyse opties (extract_gunningscriteria, etc.)
            model: AI model - None/"haiku" voor standaard, "sonnet" voor pro
        """
        start_time = time.time()
        options = options or {}
        
        # v3.5: Model uit options of parameter
        selected_model = model or options.get('model', 'haiku')
        logger.info(f"🤖 Analysis will use model: {selected_model}")
        
        try:
            # Update status
            self._update_status(import_id, 'analyzing', progress=15, current_step='text_extraction')
            
            # 1. Haal import record op
            import_record = await self.get_import(import_id)
            if not import_record:
                raise ValueError(f"Import not found: {import_id}")
            
            files = import_record.get('uploaded_files', [])
            if not files:
                raise ValueError("Geen bestanden gevonden")
            
            # 2. Extract tekst uit alle bestanden
            logger.info(f"📄 Extracting text from {len(files)} files")
            combined_text = ""
            
            for i, file_info in enumerate(files):
                self._update_status(
                    import_id, 'analyzing', 
                    progress=15 + (i * 15 // len(files)),
                    current_step=f'text_extraction:{file_info["name"]}'
                )
                
                # Download bestand
                file_content = self._download_file(import_id, file_info['name'])
                
                # Extract tekst
                text = await self.text_service.extract(
                    content=file_content,
                    filename=file_info['name'],
                    mime_type=file_info.get('mime_type', 'application/pdf')
                )
                
                combined_text += f"\n\n{'='*60}\n=== {file_info['name']} ===\n{'='*60}\n\n{text}"
            
            # 3. AI Extractie
            self._update_status(import_id, 'analyzing', progress=40, current_step='ai_extraction')
            
            if not self.claude_service:
                raise ValueError("Claude API niet geconfigureerd - voeg ANTHROPIC_API_KEY toe aan .env")
            
            logger.info("🤖 Starting AI extraction")
            extracted_data = await self._extract_with_ai(combined_text, options, selected_model)
            
            # Log extracted data for debugging
            logger.info("📊 Extracted data summary:")
            if 'basisgegevens' in extracted_data:
                for key, val in extracted_data['basisgegevens'].items():
                    if isinstance(val, dict) and val.get('value'):
                        logger.info(f"  📌 {key}: {val.get('value')} (conf: {val.get('confidence', 0):.0%})")
            if 'planning' in extracted_data:
                for key, val in extracted_data['planning'].items():
                    if isinstance(val, dict) and val.get('value'):
                        logger.info(f"  📅 {key}: {val.get('value')} (conf: {val.get('confidence', 0):.0%})")
            
            # 4. Bereken statistieken
            self._update_status(import_id, 'analyzing', progress=90, current_step='finalizing')
            stats = self._calculate_statistics(extracted_data)
            warnings = extracted_data.get('warnings', [])
            
            # 5. Bereken tijd
            extraction_time = int(time.time() - start_time)
            
            # 6. Update import record
            self.db.table('smart_imports').update({
                'status': 'completed',
                'progress': 100,
                'current_step': None,
                'extracted_data': extracted_data,
                'total_fields': stats['total_fields'],
                'fields_extracted': stats['fields_extracted'],
                'fields_high_confidence': stats['fields_high_confidence'],
                'fields_medium_confidence': stats['fields_medium_confidence'],
                'fields_low_confidence': stats['fields_low_confidence'],
                'warnings': warnings,
                'extraction_time_seconds': extraction_time,
                'ai_tokens_used': extracted_data.get('_meta', {}).get('tokens_used', 0),
                'ai_model_used': selected_model,  # v3.5: Track welk model is gebruikt
                'completed_at': datetime.utcnow().isoformat()
            }).eq('id', import_id).execute()
            
            logger.info(f"✅ Analysis completed for {import_id} in {extraction_time}s")
            
            return {
                'import_id': import_id,
                'status': 'completed',
                'extracted_data': extracted_data,
                'statistics': stats,
                'warnings': warnings,
                'extraction_time_seconds': extraction_time
            }
            
        except Exception as e:
            logger.exception(f"❌ Analysis failed for {import_id}: {e}")
            self._update_status(import_id, 'failed', error_message=str(e))
            raise
    
    # ==========================================
    # v3.5: Re-analyze with different model
    # ==========================================
    
    async def reanalyze(
        self,
        import_id: str,
        model: str = "sonnet"  # Default naar Pro model voor re-analyse
    ) -> Dict[str, Any]:
        """
        Voer de analyse opnieuw uit met een ander model.
        Vooral bedoeld om van Haiku naar Sonnet te upgraden.
        
        Args:
            import_id: UUID van de import sessie
            model: AI model ("haiku" of "sonnet")
        
        Returns:
            Updated analysis result
        """
        logger.info(f"🔄 Re-analyzing import {import_id} with model: {model}")
        
        # Haal bestaande import op
        import_record = await self.get_import(import_id)
        if not import_record:
            raise ValueError(f"Import not found: {import_id}")
        
        # Reset status voor nieuwe analyse
        self._update_status(import_id, 'analyzing', progress=10, current_step='reanalyze_init')
        
        # Voer analyse uit met nieuw model
        return await self.analyze(
            import_id=import_id,
            options=import_record.get('options', {}),
            model=model
        )
    
    async def _extract_with_ai(
        self,
        document_content: str,
        options: Dict[str, Any],
        model: str = "haiku"  # v3.5: Model parameter
    ) -> Dict[str, Any]:
        """
        Gebruik bestaande ClaudeAPIService voor data extractie.
        
        Args:
            document_content: Gecombineerde tekst uit documenten
            options: Extractie opties
            model: AI model ("haiku" of "sonnet")
        """
        
        # Truncate indien nodig
        max_chars = 150000  # ~40k tokens
        if len(document_content) > max_chars:
            document_content = document_content[:max_chars] + "\n\n[Document afgekapt...]"
        
        system_prompt = """Je bent een expert in het analyseren van Nederlandse aanbestedingsdocumenten. 
Je taak is om alle relevante informatie te extraheren en terug te geven in een gestructureerd JSON formaat.

REGELS:
1. Gebruik ALLEEN informatie die EXPLICIET in de documenten staat
2. Als iets niet gevonden wordt, zet value op null en confidence op 0
3. Geef bij elke waarde de bron aan (source)
4. Confidence score: 0.0-1.0 (0=niet gevonden, 1=100% zeker)
5. Datums in ISO formaat: YYYY-MM-DD of YYYY-MM-DDTHH:MM:SS
6. Bedragen als integer (geen valutasymbool)
7. Retourneer ALLEEN valide JSON, geen uitleg ervoor of erna"""

        user_prompt = f"""Analyseer dit aanbestedingsdocument en extraheer alle informatie.

DOCUMENT:
{document_content}

EXTRAHEER (geef ALLEEN JSON terug):
{{
    "basisgegevens": {{
        "naam": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "document/pagina" }},
        "opdrachtgever": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "aanbestedende_dienst": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "tender_nummer": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "type": {{ "value": "europese_aanbesteding|nationale_aanbesteding|meervoudig_onderhands|enkelvoudig_onderhands of null", "confidence": 0.0-1.0, "source": "..." }},
        "geraamde_waarde": {{ "value": "number of null", "confidence": 0.0-1.0, "source": "..." }},
        "locatie": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }},
        "tenderned_url": {{ "value": "string of null", "confidence": 0.0-1.0, "source": "..." }}
    }},
    "planning": {{
        "publicatie_datum": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "schouw_datum": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi1_datum": {{ "value": "YYYY-MM-DDTHH:MM:SS of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi_1_publicatie": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi2_datum": {{ "value": "YYYY-MM-DDTHH:MM:SS of null", "confidence": 0.0-1.0, "source": "..." }},
        "nvi_2_publicatie": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "deadline_indiening": {{ "value": "YYYY-MM-DDTHH:MM:SS of null", "confidence": 0.0-1.0, "source": "..." }},
        "presentatie_datum": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "voorlopige_gunning": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "definitieve_gunning": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "start_uitvoering": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }},
        "einde_contract": {{ "value": "YYYY-MM-DD of null", "confidence": 0.0-1.0, "source": "..." }}
    }},
    "gunningscriteria": {{
        "criteria": [
            {{ "code": "K1", "naam": "...", "percentage": 40, "confidence": 0.0-1.0 }}
        ],
        "source": "..."
    }},
    "certificeringen": {{
        "vereist": [
            {{ "naam": "ISO 9001", "verplicht": true, "confidence": 0.0-1.0 }}
        ],
        "source": "..."
    }},
    "warnings": ["lijst van waarschuwingen over ontbrekende of onzekere data"]
}}"""

        # Gebruik bestaande ClaudeAPIService met retry
        # v3.5: Model parameter toegevoegd
        result = await self.claude_service.execute_prompt_with_retry(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            response_format="json",
            max_tokens=8000,
            temperature=0.2,
            model=model  # v3.5: Gekozen model
        )
        
        if result['success']:
            content = result['content']
            
            # v3.4: Robuuste JSON parsing met json-repair
            if isinstance(content, str):
                logger.info("📝 Parsing JSON string response from Claude")
                
                # Strip markdown codeblocks indien aanwezig
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
                if json_match:
                    content = json_match.group(1)
                
                # Gebruik json-repair library voor robuuste parsing
                try:
                    extracted = json.loads(repair_json(content))
                    logger.info("✅ JSON parsed successfully")
                except Exception as e:
                    logger.error(f"❌ JSON parse failed even after repair: {e}")
                    logger.error(f"📄 Raw content (first 1000 chars): {content[:1000]}")
                    raise ValueError(f"Kon JSON niet parsen: {e}")
            else:
                extracted = content
            
            # Voeg metadata toe
            extracted['_meta'] = {
                'model': result.get('model', model),
                'model_type': result.get('model_type', 'standaard'),  # v3.5
                'tokens_used': result.get('usage', {}).get('input_tokens', 0) + result.get('usage', {}).get('output_tokens', 0)
            }
            
            return extracted
        else:
            raise ValueError(f"AI extraction failed: {result.get('error')}")
    
    # ==========================================
    # Helper Methods
    # ==========================================
    
    def _download_file(self, import_id: str, filename: str) -> bytes:
        """Download bestand uit Supabase Storage."""
        storage_path = f"{import_id}/{filename}"
        try:
            response = self.storage.from_(STORAGE_BUCKET).download(storage_path)
            return response
        except Exception as e:
            logger.exception(f"❌ Failed to download {filename}: {e}")
            raise ValueError(f"Download mislukt voor {filename}")
    
    def _update_status(
        self, 
        import_id: str, 
        status: str, 
        progress: int = None,
        current_step: str = None,
        error_message: str = None
    ):
        """Update import status."""
        update_data = {'status': status}
        if progress is not None:
            update_data['progress'] = progress
        if current_step is not None:
            update_data['current_step'] = current_step
        if error_message is not None:
            update_data['error_message'] = error_message
        
        self.db.table('smart_imports').update(update_data).eq('id', import_id).execute()
    
    def _calculate_statistics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Bereken statistieken over de geëxtraheerde data."""
        total = 0
        extracted = 0
        high = 0
        medium = 0
        low = 0
        
        for category in ['basisgegevens', 'planning']:
            category_data = data.get(category, {})
            for field_name, field_value in category_data.items():
                if isinstance(field_value, dict) and 'value' in field_value:
                    total += 1
                    if field_value['value'] is not None:
                        extracted += 1
                        conf = field_value.get('confidence', 0)
                        if conf >= 0.85:
                            high += 1
                        elif conf >= 0.5:
                            medium += 1
                        else:
                            low += 1
        
        return {
            'total_fields': total,
            'fields_extracted': extracted,
            'fields_high_confidence': high,
            'fields_medium_confidence': medium,
            'fields_low_confidence': low,
            'extraction_percentage': round(extracted / total * 100, 1) if total > 0 else 0
        }
    
    # ==========================================
    # v3.2: Dynamic Fase Status Lookup
    # ==========================================
    
    async def _get_default_fase_status(self, fase: str) -> Optional[str]:
        """Haal de eerste (default) fase_status op voor een gegeven fase."""
        try:
            result = self.db.table('fase_statussen').select(
                'status'
            ).eq('fase', fase).order('volgorde').limit(1).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]['status']
            return None
        except Exception as e:
            logger.warning(f"⚠️ Could not get default fase_status for {fase}: {e}")
            return None
    
    # ==========================================
    # Tender Creation
    # ==========================================
    
    async def create_tender(
        self, 
        import_id: str,
        data: Dict[str, Any],
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Maak een nieuwe tender aan met de geëxtraheerde data."""
        options = options or {}
        
        try:
            # Haal import record op
            import_record = await self.get_import(import_id)
            if not import_record:
                raise ValueError(f"Import not found: {import_id}")
            
            tenderbureau_id = import_record['tenderbureau_id']
            created_by = import_record['created_by']
            
            # Bouw tender data
            # v3.5: smart_import_id en ai_model_used toegevoegd voor tracking
            tender_data = {
                'tenderbureau_id': tenderbureau_id,
                'created_by': created_by,
                'naam': data.get('naam', 'Smart Import Tender'),
                'opdrachtgever': data.get('opdrachtgever'),
                'aanbestedende_dienst': data.get('aanbestedende_dienst'),
                'tender_nummer': data.get('tender_nummer'),
                'type': data.get('type'),
                'geraamde_waarde': data.get('geraamde_waarde'),
                'locatie': data.get('locatie'),
                'tenderned_url': data.get('tenderned_url'),
                'fase': options.get('fase', 'acquisitie'),
                # Planning velden
                'publicatie_datum': data.get('publicatie_datum'),
                'schouw_datum': data.get('schouw_datum'),
                'nvi1_datum': data.get('nvi1_datum'),
                'nvi_1_publicatie': data.get('nvi_1_publicatie'),
                'nvi2_datum': data.get('nvi2_datum'),
                'nvi_2_publicatie': data.get('nvi_2_publicatie'),
                'deadline_indiening': data.get('deadline_indiening'),
                'presentatie_datum': data.get('presentatie_datum'),
                'voorlopige_gunning': data.get('voorlopige_gunning'),
                'definitieve_gunning': data.get('definitieve_gunning'),
                'start_uitvoering': data.get('start_uitvoering'),
                'einde_contract': data.get('einde_contract'),
                # v3.5: Smart Import tracking
                'smart_import_id': import_id,
                'ai_model_used': import_record.get('ai_model_used', 'haiku')
            }
            
            # v3.2: Dynamische fase_status lookup
            fase = options.get('fase', 'acquisitie')
            fase_status = options.get('fase_status')
            
            if not fase_status:
                fase_status = await self._get_default_fase_status(fase)
                logger.info(f"📊 Using default fase_status for {fase}: {fase_status}")
            
            if fase_status:
                tender_data['fase_status'] = fase_status
            
            # Verwijder None waarden
            tender_data = {k: v for k, v in tender_data.items() if v is not None}
            
            # Insert tender
            logger.info(f"📝 Creating tender: {tender_data.get('naam')}")
            result = self.db.table('tenders').insert(tender_data).execute()
            tender = result.data[0]
            
            # Koppel documenten indien gewenst
            documents_linked = 0
            if options.get('link_documents', True):
                files = import_record.get('uploaded_files', [])
                for file_info in files:
                    try:
                        self.db.table('tender_documents').insert({
                            'tender_id': tender['id'],
                            'naam': file_info['name'],
                            'storage_path': file_info['storage_path'],
                            'type': file_info.get('detected_type', 'overig'),
                            'size': file_info.get('size', 0),
                            'uploaded_by': created_by
                        }).execute()
                        documents_linked += 1
                    except Exception as e:
                        logger.warning(f"⚠️ Could not link document {file_info['name']}: {e}")
            
            # Update import record
            self.db.table('smart_imports').update({
                'status': 'tender_created',
                'tender_id': tender['id']
            }).eq('id', import_id).execute()
            
            logger.info(f"✅ Tender created: {tender['id']} with {documents_linked} documents")
            
            return {
                'tender': tender,
                'documents_linked': documents_linked
            }
            
        except Exception as e:
            logger.exception(f"❌ Failed to create tender: {e}")
            raise
