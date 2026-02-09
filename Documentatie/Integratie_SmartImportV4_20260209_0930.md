# Smart Import v4.0 — Integratie Handleiding (Fase F)

**Datum:** 9 februari 2026  
**Status:** Alle 6 fasen voltooid  
**Scope:** Complete integratie van alle componenten

---

## 1. OVERZICHT ALLE BESTANDEN

### Fase A — Database (eerder opgeleverd)
| Bestand | Actie |
|---------|-------|
| `Migratie_SmartImportV4_Tabellen_20260208_2130.sql` | Uitvoeren in Supabase SQL Editor |
| `Migratie_SmartImportV4_SeedData_20260208_2130.sql` | Uitvoeren na tabellen-migratie |

### Fase B — BackplanningService
| Bestand | Doel-pad |
|---------|----------|
| `backplanning_service_20260208_2230.py` | `Backend/app/services/backplanning_service.py` |
| `planning_models_20260208_2230.py` | `Backend/app/models/planning_models.py` |
| `planning_router_20260208_2230.py` | `Backend/app/routers/planning_router.py` |
| `test_backplanning_service_20260208_2230.py` | `Backend/tests/test_backplanning_service.py` |

### Fase C — TeamStep
| Bestand | Doel-pad |
|---------|----------|
| `TeamStep_20260208_2300.js` | `Frontend/js/components/smart-import/TeamStep.js` |
| `TeamStep_20260208_2300.css` | `Frontend/css/components/TeamStep.css` |

### Fase D — ResultStep
| Bestand | Doel-pad |
|---------|----------|
| `ResultStep_20260208_2300.js` | `Frontend/js/components/smart-import/ResultStep.js` |
| `ResultStep_20260208_2300.css` | `Frontend/css/components/ResultStep.css` |

### Fase E — AI Document Generatie
| Bestand | Doel-pad |
|---------|----------|
| `document_generatie_service_20260209_0930.py` | `Backend/app/services/document_generatie_service.py` |
| `document_models_20260209_0930.py` | `Backend/app/models/document_models.py` |
| `document_router_20260209_0930.py` | `Backend/app/routers/document_router.py` |

### Fase F — Integratie & Orchestrator
| Bestand | Doel-pad |
|---------|----------|
| `SmartImportWizard_20260209_0930.js` | `Frontend/js/components/SmartImportWizard.js` |
| `SmartImportStyles_20260209_0930.js` | `Frontend/js/components/smart-import/SmartImportStyles.js` |
| `finalize_service_20260209_0930.py` | `Backend/app/services/finalize_service.py` |
| `finalize_router_20260209_0930.py` | `Backend/app/routers/finalize_router.py` |

---

## 2. DIRECTORY STRUCTUUR

### Backend (na integratie)
```
Backend/
├── app/
│   ├── core/
│   │   ├── database.py          ← bestaand (get_supabase_client)
│   │   └── auth.py              ← bestaand (get_current_user)
│   ├── models/
│   │   ├── planning_models.py   ← NIEUW (Fase B)
│   │   └── document_models.py   ← NIEUW (Fase E)
│   ├── routers/
│   │   ├── planning_router.py   ← NIEUW (Fase B)
│   │   ├── document_router.py   ← NIEUW (Fase E)
│   │   └── finalize_router.py   ← NIEUW (Fase F)
│   └── services/
│       ├── backplanning_service.py      ← NIEUW (Fase B)
│       ├── document_generatie_service.py ← NIEUW (Fase E)
│       └── finalize_service.py          ← NIEUW (Fase F)
├── tests/
│   └── test_backplanning_service.py     ← NIEUW (Fase B)
└── main.py                              ← AANPASSEN
```

### Frontend (na integratie)
```
Frontend/
├── js/
│   └── components/
│       ├── SmartImportWizard.js          ← VERVANGEN (Fase F)
│       └── smart-import/
│           ├── UploadStep.js             ← SPLITSEN uit huidige wizard
│           ├── AnalyzeStep.js            ← SPLITSEN uit huidige wizard
│           ├── ReviewStep.js             ← SPLITSEN uit huidige wizard
│           ├── TeamStep.js               ← NIEUW (Fase C)
│           ├── ResultStep.js             ← NIEUW (Fase D)
│           └── SmartImportStyles.js      ← NIEUW (Fase F)
└── css/
    └── components/
        ├── TeamStep.css                  ← NIEUW (Fase C)
        └── ResultStep.css                ← NIEUW (Fase D)
```

---

## 3. BACKEND REGISTRATIE

### main.py — Routers toevoegen

Voeg toe aan je `main.py`:

```python
# ── Bestaande imports ──
# from app.routers.tender_router import router as tender_router
# from app.routers.smart_import_router import router as smart_import_router

# ── Nieuwe imports (v4.0) ──
from app.routers.planning_router import router as planning_router
from app.routers.document_router import router as document_router
from app.routers.finalize_router import router as finalize_router

# ── Bestaande router registraties ──
# app.include_router(tender_router, prefix="/api/v1")
# app.include_router(smart_import_router, prefix="/api/v1")

# ── Nieuwe router registraties (v4.0) ──
app.include_router(planning_router, prefix="/api/v1")
app.include_router(document_router, prefix="/api/v1")
app.include_router(finalize_router, prefix="/api/v1")
```

### Dependencies installeren

```bash
pip install anthropic --break-system-packages
```

### Environment variabelen

Voeg toe aan je `.env`:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## 4. COMPONENT SPLIT — Bestaande Wizard

De huidige monolithische `SmartImportWizard.js` (~1100 regels) moet gesplitst worden in 3 losse step-componenten. Dit is de enige handmatige stap.

### Stap-interface contract

Elke step-component moet deze interface volgen:

```javascript
export class StepComponent {
    constructor(wizardState) {
        this.state = wizardState;  // Gedeelde state (by reference)
    }

    async init() { }           // Optioneel: data laden
    render() { return ''; }    // Verplicht: HTML string
    attachListeners(el) { }    // Optioneel: event binding
    validate() { return true; } // Optioneel: validatie
    getData() { return {}; }   // Optioneel: data ophalen
}
```

### Wat splitsen

| Stap | Nieuwe file | Wat verplaatsen |
|------|------------|-----------------|
| 1 | `UploadStep.js` | Drag & drop, file handling, upload logica |
| 2 | `AnalyzeStep.js` | Polling, progress bar, AI extractie |
| 3 | `ReviewStep.js` | Metadata display, edit forms, validatie |

### Aanpak

1. Maak `Frontend/js/components/smart-import/` directory aan
2. Kopieer relevante code naar `UploadStep.js`, `AnalyzeStep.js`, `ReviewStep.js`
3. Wrap elke stap in een class met de interface hierboven
4. Vervang de oude `SmartImportWizard.js` door de nieuwe orchestrator
5. Voeg `TeamStep.js` en `ResultStep.js` toe (al opgeleverd)
6. Test de complete flow

**Belangrijk:** Dit moet atomic gebeuren. Niet stapsgewijs migreren.

---

## 5. CSS LADEN

### Optie A: Link in HTML
```html
<link rel="stylesheet" href="/css/components/TeamStep.css">
<link rel="stylesheet" href="/css/components/ResultStep.css">
```

### Optie B: Import in je main CSS
```css
@import 'components/TeamStep.css';
@import 'components/ResultStep.css';
```

De wizard modal-styles worden automatisch geïnjecteerd door `SmartImportStyles.js` (via `SmartImportStyles.inject()`).

---

## 6. WIZARD AANROEPEN

### Vanuit JavaScript
```javascript
import { SmartImportWizard } from './components/SmartImportWizard.js';

const wizard = new SmartImportWizard({
    authToken: 'Bearer ...',
    tenderbureauId: 'uuid-van-bureau',
    baseURL: '/api/v1',
    onComplete: (result) => {
        console.log('Import voltooid:', result);
        // result = { tender_id, tender_naam, planning_count, ... }
        // Navigeer naar tender detail of refresh lijst
        window.location.href = `/tenders/${result.tender_id}`;
    },
    onCancel: () => {
        console.log('Import geannuleerd');
    }
});

// Open als modal
wizard.open();

// Of met bestaande tender
wizard.open('tender-uuid', 'Aanbesteding Transport');
```

### Vanuit een bestaande knop
```javascript
document.getElementById('btnNieuweTender').addEventListener('click', () => {
    const wizard = new SmartImportWizard({
        authToken: authService.getToken(),
        tenderbureauId: bureauService.getCurrentBureauId(),
        onComplete: (result) => {
            showNotification(`${result.tender_naam} aangemaakt!`);
            refreshTenderList();
        }
    });
    wizard.open();
});
```

---

## 7. ALLE ENDPOINTS (OVERZICHT)

### Planning (Fase B)
| Method | Pad | Doel |
|--------|-----|------|
| POST | `/planning/generate-backplanning` | Genereer back-planning |
| GET | `/team/workload` | Workload per teamlid |
| GET | `/planning-templates` | Lijst templates |
| GET | `/planning-templates/{id}` | Eén template met taken |
| POST | `/planning-templates` | Nieuw template |
| PUT | `/planning-templates/{id}` | Update template |
| DELETE | `/planning-templates/{id}` | Verwijder template |
| POST | `/planning-templates/{id}/duplicate` | Dupliceer template |
| PUT | `/planning-templates/{id}/taken` | Bulk replace taken |

### AI Documenten (Fase E)
| Method | Pad | Doel |
|--------|-----|------|
| POST | `/smart-import/{id}/generate-documents` | Genereer AI docs |
| GET | `/tenders/{id}/documents` | Alle docs per tender |
| GET | `/documents/{id}` | Eén document |
| PUT | `/documents/{id}` | Update document |
| POST | `/documents/{id}/regenerate` | Regenereer document |
| DELETE | `/documents/{id}` | Verwijder document |

### Finalize (Fase F)
| Method | Pad | Doel |
|--------|-----|------|
| POST | `/smart-import/finalize` | Alles opslaan |

---

## 8. TEST CHECKLIST

### Database
- [ ] Tabellen aangemaakt: `planning_templates`, `planning_template_taken`, `ai_generated_documents`, `bureau_feestdagen`
- [ ] Seed data geladen: 2 templates + feestdagen 2026
- [ ] RLS policies actief (test met andere bureau-user)

### Backend
- [ ] `pip install anthropic` gedaan
- [ ] `ANTHROPIC_API_KEY` in `.env`
- [ ] Server start zonder errors
- [ ] `GET /api/v1/planning-templates` retourneert 2 templates
- [ ] `POST /api/v1/planning/generate-backplanning` genereert planning
- [ ] `GET /api/v1/team/workload` retourneert workload data
- [ ] Unit tests: `pytest tests/test_backplanning_service.py -v`

### Frontend
- [ ] `smart-import/` directory aangemaakt
- [ ] Component split uitgevoerd (UploadStep, AnalyzeStep, ReviewStep)
- [ ] CSS bestanden geplaatst en geladen
- [ ] Wizard opent als modal
- [ ] Stap 1-3 werken (bestaande functionaliteit)
- [ ] Stap 4 (Team) toont rollen en dropdowns
- [ ] Stap 5 (Resultaat) toont planning preview
- [ ] "Opslaan & Afronden" slaat alles op

### Integratie
- [ ] Volledige flow: Upload → Analyse → Review → Team → Resultaat → Opslaan
- [ ] Nieuwe tender verschijnt in Kanban na voltooiing
- [ ] Planning taken zichtbaar in tender detail
- [ ] AI documenten beschikbaar bij tender

---

## 9. BEKENDE BEPERKINGEN

1. **Component split (stap 1-3)** is nog niet gedaan — dit vereist handmatige refactoring van de bestaande wizard code

2. **AI Document generatie** vereist een Anthropic API key met voldoende credits

3. **Workload check** is alleen betrouwbaar als bestaande tenders ook planning-taken hebben — nieuwe installaties tonen geen workload warnings

4. **Template beheer** (admin pagina) is nog niet gebouwd — templates kunnen voorlopig alleen via SQL of API beheerd worden

5. **Finalize** gaat ervan uit dat `planning_taken`, `checklist_items` en `tender_team` tabellen bestaan. Als die nog niet bestaan in je schema, moeten die eerst aangemaakt worden
