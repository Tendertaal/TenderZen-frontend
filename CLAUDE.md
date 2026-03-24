# TenderZen — CLAUDE.md

## Wat is TenderZen?

TenderZen is een Nederlandstalig **tender management platform** voor professionele dienstverleners (adviesbureaus, engineeringbedrijven). Het ondersteunt het volledige lifecycle van een aanbesteding: van signalering en analyse tot planning, teambeheer en documentgeneratie.

---

## Architectuur

```
TenderZen/
├── Backend/          # Python FastAPI (REST API)
│   ├── app/
│   │   ├── api/v1/   # Route-handlers per domein
│   │   ├── services/ # Business logic
│   │   └── utils/    # Helpers (auth, logging, etc.)
│   ├── scripts/      # Eenmalige DB-scripts
│   └── requirements.txt
├── frontend/         # Vanilla JS SPA (geen build-stap)
│   ├── js/
│   │   ├── views/        # Pagina-level componenten
│   │   ├── components/   # Herbruikbare UI-componenten
│   │   ├── modals/       # Modal-dialogen
│   │   └── services/     # Frontend data-services
│   ├── css/              # Modulaire CSS per component
│   └── index.html
├── Documentatie/     # Functionele & technische specs
└── supabase/         # Supabase Edge Functions (niet actief in gebruik)
```

---

## Tech Stack

| Laag | Technologie |
|------|-------------|
| Frontend | Vanilla JavaScript ES6, HTML5, CSS3 (geen framework, geen build-tools) |
| Backend | Python 3.11+, FastAPI (async), Pydantic |
| Database | Supabase (PostgreSQL + Row Level Security + Auth) |
| AI | Anthropic Claude API (Haiku voor snelheid, Sonnet voor nauwkeurigheid) |
| Auth | JWT via Supabase; rollen: `super_admin`, `admin`, `user` |

---

## Domeinbegrippen (Nederlands)

- **Tender** — Een publieke aanbesteding of RFP
- **Bureau / Tenderbureau** — Kantoorlocatie die tenders beheert
- **Fase** — Projectfase (acquisitie, voorbereiding, schrijf, indiening, gunning, archief)
- **Backplanning** — Automatisch achterwaarts plannen vanuit de indieningsdeadline
- **Gunningscriteria** — Beoordelingscriteria van de aanbestedende dienst
- **Smart Import** — AI-gedreven extractie van key data uit aanbestedingsdocumenten

---

## Kernfunctionaliteiten

1. **Tender tracking** — CRUD, faseoverzicht, Kanban, lijst- en agendaview
2. **Smart Import** — Upload PDF's → Claude AI extraheert deadlines, criteria, bedragen → Tender aanmaken
3. **Backplanning** — AI genereert achterwaartse planning vanuit sjabloon + deadline
4. **Team & workload** — Teamleden koppelen aan tenders, workload-analyse
5. **AI documenten** — Go/No-Go analyse, samenvattingen, compliance-checks via Claude
6. **Checklist beheer** — Deliverables bijhouden met herbruikbare sjablonen
7. **Template beheer** — Planning- en checklistsjablonen per bureau + generieke sjablonen

---

## Multi-tenancy model

- Elke gebruiker is gekoppeld aan één of meerdere **tenderbureau**'s via `user_bureau_access`
- Data wordt gefilterd op `tenderbureau_id`; RLS in Supabase handhaaft dit op DB-niveau
- `super_admin` ziet alle data over alle bureaus
- Frontend beheert de actieve bureaucontext via `BureauAccessService`
- Team-queries gaan via de view `v_bureau_team` (combinatie van `user_bureau_access` + `users`)

---

## Backend conventies

- Routes staan in `Backend/app/api/v1/`, één bestand per domein
- Business logic zit in `Backend/app/services/`, niet in de route-handlers
- Authenticatie verloopt via een `get_current_user` dependency die de Supabase JWT valideert
- Financiële velden gebruiken `Decimal`; serialisatie naar `float` gebeurt in de service-laag
- Alle endpoints geven expliciet HTTP-foutcodes terug (geen stille failures)
- Gebruik `.eq()` filters i.p.v. `.single()` om `406`-fouten bij meerdere resultaten te vermijden

---

## Frontend conventies

- Geen framework, geen bundler — direct ES6-modules via `<script type="module">`
- Views zijn klassen in `frontend/js/views/`, componenten in `frontend/js/components/`
- Data-ophaling loopt via service-klassen in `frontend/js/services/` (niet direct fetch in views)
- CSS is modulair: één bestand per component, geïmporteerd via `<link>` in `index.html`
- Routing gebeurt via hash-gebaseerde navigatie in `App.js`
- Team member data wordt altijd via `v_bureau_team` opgehaald (nooit via de oude `team_members` tabel)

---

## Belangrijke bestanden

| Bestand | Doel |
|---------|------|
| `Backend/app/main.py` | FastAPI app-instantie, middleware, router-registratie |
| `Backend/app/api/v1/tenders.py` | Tender CRUD endpoints |
| `Backend/app/api/v1/planning.py` | Planning, backplanning, checklist endpoints |
| `Backend/app/api/v1/smart_import.py` | Smart Import AI-workflow |
| `Backend/app/api/v1/ai_documents.py` | AI-documentgeneratie endpoints |
| `Backend/app/services/tender_service.py` | Tender business logic |
| `frontend/js/App.js` | SPA-router en app-initialisatie |
| `frontend/js/views/TenderListView.js` | Hoofdoverzicht van tenders |
| `frontend/js/components/TenderAanmaken.js` | Modal voor aanmaken/bewerken tender |
| `frontend/js/components/smart-import/` | SmartImport wizard (Upload/Analyze/Review/Create) |
| `frontend/js/components/tendercommandcenter/` | Tender detail-panel (5 tabs) |
| `frontend/js/components/planning/` | Planning modal en gerelateerde componenten |

---

## Lokaal draaien

### Backend
```bash
cd Backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
Open `frontend/index.html` direct in een browser, of serveer via een lokale HTTP-server:
```bash
npx serve frontend
```

Configuratie via `.env` in de `Backend/`-map (Supabase URL, keys, Anthropic API key).

---

## AI-integratie

- Claude wordt aangeroepen via de Anthropic Python SDK in `Backend/app/services/`
- Modelkeuze: `claude-haiku-4-5` voor snelle/goedkope taken, `claude-sonnet-4-6` voor nauwkeurige analyses
- Prompts worden beheerd in de database-tabel `ai_prompts` (versioned, per bureau aanpasbaar)
- Smart Import slaat de gebruikte model-naam op in `tenders.ai_model_used`
