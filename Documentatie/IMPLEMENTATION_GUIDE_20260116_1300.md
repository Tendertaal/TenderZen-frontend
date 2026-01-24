# AI DOCUMENTEN SYSTEEM - IMPLEMENTATIE GUIDE
## TenderPlanner v3.0 - Fase 1: Backend + Database

**Datum:** 16 januari 2026, 13:00  
**Status:** Backend Foundation Complete - Ready for Frontend

---

## 📦 DELIVERABLES OVERZICHT

### ✅ Database (Supabase)
- `migration_ai_documents_20260116_1200.sql` - Complete database schema (3 tabellen + seed data)

### ✅ Backend (Python FastAPI)
- `ai_document_models_20260116_1200.py` - Pydantic models
- `file_upload_service_20260116_1215.py` - Supabase Storage handler
- `claude_api_service_20260116_1230.py` - Claude API wrapper
- `ai_document_service_20260116_1245.py` - Main orchestrator
- `ai_documents_router_20260116_1300.py` - FastAPI endpoints

---

## 🚀 STAP-VOOR-STAP INSTALLATIE

### STAP 1: Database Setup (10 min)

**1.1 - Run Migration**
```sql
-- Ga naar Supabase Dashboard > SQL Editor
-- Plak de inhoud van: migration_ai_documents_20260116_1200.sql
-- Klik "Run"
```

**1.2 - Verificatie**
```sql
-- Check of tabellen zijn aangemaakt:
SELECT * FROM ai_document_templates;
-- Zou 3 templates moeten tonen: rode_draad, offerte, versie1_inschrijving

SELECT COUNT(*) FROM ai_documents;
-- Zou 0 moeten zijn (nog geen documenten)
```

**1.3 - Storage Bucket Aanmaken**
```
1. Ga naar Supabase Dashboard > Storage
2. Klik "New Bucket"
3. Naam: "ai-documents"
4. Public: UNCHECKED (private bucket)
5. File size limit: 10MB
6. Allowed MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
7. Klik "Create bucket"
```

---

### STAP 2: Backend Dependencies (5 min)

**2.1 - Update requirements.txt**
```txt
# Voeg toe aan requirements.txt:

# AI Features
anthropic>=0.25.0              # Claude API
python-docx>=0.8.11            # DOCX manipulation
PyPDF2>=3.0.0                  # PDF text extraction
python-magic>=0.4.27           # File type detection (optioneel)

# Async/Background tasks (optioneel voor MVP)
celery>=5.3.0                  # Task queue
redis>=5.0.0                   # Voor Celery backend
```

**2.2 - Installeer Dependencies**
```bash
# Activate venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Install new packages
pip install anthropic python-docx PyPDF2
pip install -r requirements.txt
```

---

### STAP 3: Backend Configuration (5 min)

**3.1 - Update .env**
```env
# Voeg toe aan .env file:

# Claude API
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: AI Feature Flags
AI_DOCUMENTS_ENABLED=true
AI_MAX_FILE_SIZE_MB=10
AI_GENERATION_TIMEOUT_SECONDS=300
```

**3.2 - Update config.py**
```python
# Voeg toe aan app/config.py:

class Settings(BaseSettings):
    # ... bestaande settings ...
    
    # AI Configuration
    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    ai_documents_enabled: bool = Field(default=True, alias="AI_DOCUMENTS_ENABLED")
    ai_max_file_size_mb: int = Field(default=10, alias="AI_MAX_FILE_SIZE_MB")
    ai_generation_timeout: int = Field(default=300, alias="AI_GENERATION_TIMEOUT_SECONDS")
    
    @property
    def ai_enabled(self) -> bool:
        """Check if AI features are enabled"""
        return bool(self.anthropic_api_key and self.ai_documents_enabled)
```

---

### STAP 4: Backend Code Integratie (15 min)

**4.1 - Plaats Service Files**
```bash
# Maak directory structuur:
mkdir -p app/services/ai_documents

# Verplaats bestanden naar:
app/services/ai_documents/
├── __init__.py  (maak deze aan - zie hieronder)
├── ai_document_service.py
├── file_upload_service.py
├── claude_api_service.py
└── template_registry_service.py (optioneel)

app/models/
└── ai_document.py  (models bestand)

app/api/v1/
└── ai_documents.py  (router bestand)
```

**4.2 - Create __init__.py**
```python
# app/services/ai_documents/__init__.py

from .ai_document_service import AIDocumentService
from .file_upload_service import FileUploadService
from .claude_api_service import ClaudeAPIService

__all__ = [
    'AIDocumentService',
    'FileUploadService',
    'ClaudeAPIService'
]
```

**4.3 - Register Router in main.py**
```python
# app/main.py

from fastapi import FastAPI
from app.api.v1 import tenders, users, ai_documents  # ← Add import

app = FastAPI(...)

# Register routers
app.include_router(tenders.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(ai_documents.router, prefix="/api/v1")  # ← Add this
```

---

### STAP 5: Backend Testing (10 min)

**5.1 - Start Backend**
```bash
# Start FastAPI server
uvicorn app.main:app --reload --port 3000
```

**5.2 - Test Endpoints**
```bash
# Test 1: Health Check
curl http://localhost:3000/api/v1/ai-documents/health

# Expected: {"success": true, "status": "healthy"}

# Test 2: Get Templates
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/api/v1/ai-documents/templates

# Expected: List van 3 templates (rode_draad, offerte, versie1)

# Test 3: Check Storage Bucket
# Ga naar Supabase Dashboard > Storage
# Bucket "ai-documents" zou moeten bestaan
```

**5.3 - Verify Logs**
```bash
# Je zou moeten zien:
✅ Storage bucket 'ai-documents' aangemaakt (of bestaat al)
✅ FastAPI app gestart
✅ AI Documents router registered
```

---

## 📋 PRE-FRONTEND CHECKLIST

Voordat je aan de frontend begint, check:

- [ ] Database migration succesvol uitgevoerd
- [ ] 3 templates zichtbaar in `ai_document_templates` tabel
- [ ] Supabase Storage bucket "ai-documents" aangemaakt
- [ ] `ANTHROPIC_API_KEY` in `.env` file
- [ ] Dependencies geïnstalleerd (anthropic, python-docx, PyPDF2)
- [ ] Backend start zonder errors
- [ ] `/api/v1/ai-documents/health` endpoint reageert
- [ ] `/api/v1/ai-documents/templates` endpoint geeft templates terug
- [ ] Storage bucket is privé (public=false)

---

## 🎨 VOLGENDE FASE: FRONTEND

Nu de backend klaar is, kunnen we beginnen met:

### Frontend Deliverables (Komende stap)
1. **TenderListView.js** - Knop toevoegen aan tender cards
2. **AIDocumentenView.js** - Template selector pagina
3. **FileUploader.js** - Drag & drop component
4. **RodeDraadWorkflow.js** - Workflow voor Rode Draad
5. **ProgressTracker.js** - Real-time progress indicator
6. **AIDocumentService.js** - API communicatie (frontend)

### Routing
```javascript
// Nieuwe routes toevoegen aan App.js:
{
  path: '/ai-documenten',
  component: AIDocumentenView,
  requiresAuth: true
}
```

---

## 🐛 TROUBLESHOOTING

### Error: "Bucket already exists"
→ Normaal! Bucket was al aangemaakt. Check of hij privé is (public=false).

### Error: "anthropic module not found"
```bash
pip install anthropic
```

### Error: "ANTHROPIC_API_KEY not found"
→ Check .env file, zorg dat variabele naam klopt (geen spaties).
→ Herstart backend na .env wijziging.

### Error: "Table ai_document_templates does not exist"
→ Migration niet succesvol. Run de SQL opnieuw in Supabase SQL Editor.

### Database permission errors
→ Check Row Level Security (RLS) policies. Templates zijn public readable.
→ Documents filteren op tenderbureau_id.

---

## 📊 SUCCESS METRICS

**Backend is klaar als:**
- ✅ Alle 3 tabellen bestaan in Supabase
- ✅ Seed data (templates) is zichtbaar
- ✅ Storage bucket werkt
- ✅ API endpoints reageren
- ✅ Health check geeft "healthy" status

**Klaar voor frontend als:**
- ✅ Alle items in Pre-Frontend Checklist afgevinkt
- ✅ Test API calls werken met Postman/curl
- ✅ Geen errors in backend logs

---

## 🔒 SECURITY NOTES

**Belangrijke Security Checks:**
1. Supabase Storage bucket is PRIVATE (public=false)
2. RLS policies zijn actief op alle 3 tabellen
3. ANTHROPIC_API_KEY staat alleen in .env (NIET in git)
4. File upload size limits zijn geactiveerd (10MB)
5. MIME type validatie werkt (alleen PDF/DOCX)
6. User kan alleen eigen tenderbureau documents zien

---

## 📞 SUPPORT & VOLGENDE STAPPEN

**Status:** ✅ Backend Foundation Complete

**Volgende stap:** Frontend implementatie
- Begin met: TenderListView.js aanpassen (knop toevoegen)
- Dan: AIDocumentenView.js pagina maken
- Vervolgens: Complete Rode Draad workflow

**Vragen?**
- Check de code comments in de service files
- Alle endpoints zijn gedocumenteerd in ai_documents_router.py
- Test elk endpoint met Postman voordat je frontend bouwt

---

**🎉 BACKEND IS KLAAR VOOR FRONTEND DEVELOPMENT!**
