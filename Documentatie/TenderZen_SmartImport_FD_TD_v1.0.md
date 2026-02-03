# TenderZen Smart Import Wizard
## Functioneel & Technisch Design Document

**Versie:** 1.0  
**Datum:** 1 februari 2025  
**Status:** Gereed voor ontwikkeling  
**Auteur:** Development Team  

---

## Inhoudsopgave

1. [Executive Summary](#1-executive-summary)
2. [Functioneel Design](#2-functioneel-design)
   - 2.1 [Probleemstelling](#21-probleemstelling)
   - 2.2 [Oplossing](#22-oplossing)
   - 2.3 [User Stories](#23-user-stories)
   - 2.4 [Functionele Requirements](#24-functionele-requirements)
   - 2.5 [User Flow](#25-user-flow)
   - 2.6 [UI/UX Specificaties](#26-uiux-specificaties)
3. [Technisch Design](#3-technisch-design)
   - 3.1 [Architectuur Overzicht](#31-architectuur-overzicht)
   - 3.2 [Database Schema](#32-database-schema)
   - 3.3 [API Specificaties](#33-api-specificaties)
   - 3.4 [AI Extractie Prompt](#34-ai-extractie-prompt)
   - 3.5 [Frontend Componenten](#35-frontend-componenten)
   - 3.6 [Backend Services](#36-backend-services)
4. [Data Mapping](#4-data-mapping)
5. [Error Handling](#5-error-handling)
6. [Security Considerations](#6-security-considerations)
7. [Implementatie Plan](#7-implementatie-plan)
8. [Acceptatiecriteria](#8-acceptatiecriteria)

---

## 1. Executive Summary

### Doel
Automatiseer het aanmaken van tenders in TenderZen door AI-gestuurde extractie van gegevens uit aanbestedingsdocumenten. Hiermee wordt de tijd voor tender-intake gereduceerd van 15-30 minuten naar 2-3 minuten.

### Scope
- Upload van aanbestedingsdocumenten (PDF, DOCX, ZIP)
- AI-gestuurde extractie van alle relevante tender gegevens
- Review & correctie interface met confidence indicators
- Automatisch opslaan in database met gerelateerde documenten

### Out of Scope (v1.0)
- Automatische koppeling aan TenderNed API
- OCR voor gescande documenten
- Batch import van meerdere tenders tegelijk

---

## 2. Functioneel Design

### 2.1 Probleemstelling

**Huidige situatie:**
Wanneer een tenderbureau een offerte-aanvraag ontvangt, moet een medewerker:

1. Handmatig een nieuwe tender aanmaken in TenderZen
2. De aanbestedingsdocumenten doornemen
3. Alle gegevens handmatig invullen:
   - Basisgegevens (naam, opdrachtgever, type, etc.)
   - Alle planning datums (10+ velden)
   - Gunningscriteria en wegingen
   - Vereiste certificeringen
   - Overige eisen en voorwaarden

**Pijnpunten:**
- Tijdrovend: 15-30 minuten per tender
- Foutgevoelig: Typefouten, gemiste datums
- Inconsistent: Verschillende medewerkers vullen anders in
- Dubbel werk: Eerst document lezen, dan overtypen

### 2.2 Oplossing

**Smart Import Wizard:**
Een 3-staps wizard die aanbestedingsdocumenten analyseert met AI en automatisch alle velden invult.

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   STAP 1     │───▶│   STAP 2     │───▶│   STAP 3     │
│   Upload     │    │   Analyse    │    │   Review     │
│              │    │              │    │              │
│  Drag & Drop │    │  AI Extract  │    │  Correctie   │
│  Documenten  │    │  Progress    │    │  & Opslaan   │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 2.3 User Stories

#### US-001: Tender aanmaken via document upload
**Als** tenderschrijver  
**Wil ik** aanbestedingsdocumenten uploaden  
**Zodat** de tender automatisch wordt aangemaakt met alle gegevens

**Acceptatiecriteria:**
- [ ] Ik kan PDF, DOCX en ZIP bestanden uploaden
- [ ] Meerdere bestanden tegelijk uploaden is mogelijk
- [ ] Drag & drop werkt
- [ ] Bestandsgrootte limiet is duidelijk (max 50MB totaal)

#### US-002: AI extractie met voortgang
**Als** tenderschrijver  
**Wil ik** zien dat de AI de documenten analyseert  
**Zodat** ik weet dat het systeem werkt en hoe lang het duurt

**Acceptatiecriteria:**
- [ ] Voortgangsbalk toont percentage
- [ ] Stappen zijn zichtbaar (✓ Documenten gelezen, ◐ Planning zoeken...)
- [ ] Geschatte tijd wordt getoond
- [ ] Annuleren is mogelijk

#### US-003: Review met confidence indicators
**Als** tenderschrijver  
**Wil ik** de geëxtraheerde gegevens controleren  
**Zodat** ik fouten kan corrigeren voordat de tender wordt aangemaakt

**Acceptatiecriteria:**
- [ ] Alle velden zijn bewerkbaar
- [ ] Confidence indicator per veld (🟢 hoog, 🟡 check, 🔴 niet gevonden)
- [ ] Velden met lage confidence zijn gemarkeerd
- [ ] Ik kan ontbrekende velden handmatig invullen

#### US-004: Documenten koppelen
**Als** tenderschrijver  
**Wil ik** dat de geüploade documenten automatisch aan de tender worden gekoppeld  
**Zodat** ik ze later kan terugvinden

**Acceptatiecriteria:**
- [ ] Documenten worden opgeslagen in tender_documents
- [ ] Document type wordt automatisch gedetecteerd (leidraad, bijlage, etc.)
- [ ] Documenten zijn zichtbaar in de tender detail view

### 2.4 Functionele Requirements

#### FR-001: Bestandsupload
| ID | Requirement | Prioriteit |
|----|-------------|------------|
| FR-001.1 | Ondersteuning voor PDF bestanden | Must |
| FR-001.2 | Ondersteuning voor DOCX bestanden | Must |
| FR-001.3 | Ondersteuning voor ZIP bestanden (automatisch uitpakken) | Should |
| FR-001.4 | Drag & drop functionaliteit | Must |
| FR-001.5 | Maximale bestandsgrootte: 50MB totaal | Must |
| FR-001.6 | Maximaal 10 bestanden per import | Must |
| FR-001.7 | Voortgangsindicator per bestand | Should |

#### FR-002: AI Extractie
| ID | Requirement | Prioriteit |
|----|-------------|------------|
| FR-002.1 | Extractie van basisgegevens (naam, opdrachtgever, etc.) | Must |
| FR-002.2 | Extractie van alle planning datums (12 velden) | Must |
| FR-002.3 | Extractie van gunningscriteria met percentages | Must |
| FR-002.4 | Extractie van vereiste certificeringen | Should |
| FR-002.5 | Extractie van CPV codes | Should |
| FR-002.6 | Extractie van geraamde waarde | Should |
| FR-002.7 | Confidence score per geëxtraheerd veld | Must |
| FR-002.8 | Maximale verwerkingstijd: 60 seconden | Must |

#### FR-003: Review Interface
| ID | Requirement | Prioriteit |
|----|-------------|------------|
| FR-003.1 | Alle velden zijn bewerkbaar | Must |
| FR-003.2 | Visuele confidence indicators | Must |
| FR-003.3 | Groepering van velden per categorie | Must |
| FR-003.4 | Validatie van verplichte velden | Must |
| FR-003.5 | Inline date pickers voor datumvelden | Must |
| FR-003.6 | Warnings voor potentiële problemen | Should |

#### FR-004: Opslag
| ID | Requirement | Prioriteit |
|----|-------------|------------|
| FR-004.1 | Tender wordt aangemaakt in tenders tabel | Must |
| FR-004.2 | Documenten worden opgeslagen in tender_documents | Must |
| FR-004.3 | Import metadata wordt gelogd | Should |
| FR-004.4 | Rollback bij fouten | Must |

### 2.5 User Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ENTRY POINT                                    │
│                                                                         │
│   Header: [+ Nieuwe Tender ▼]                                           │
│           ┌──────────────────────────┐                                  │
│           │ 📝 Handmatig aanmaken    │ → Bestaande TenderAanmaken modal │
│           │ ✨ Smart Import (AI)     │ → Smart Import Wizard            │
│           └──────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAP 1: UPLOAD                                      │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                         📄                                      │   │
│   │            Sleep aanbestedingsdocumenten hierheen               │   │
│   │                  of klik om te selecteren                       │   │
│   │                                                                 │   │
│   │   Ondersteund: PDF, DOCX, ZIP  •  Max 50MB                     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   Geüploade bestanden:                                                  │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ 📄 Leidraad.pdf                              2.4 MB    [✕]     │   │
│   │ 📄 Bijlage_Planning.pdf                      1.1 MB    [✕]     │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   [Annuleren]                                    [Analyseren →]         │
│                                                                         │
│   ─────────────────────────────────────────────────────────────────     │
│   Validaties:                                                           │
│   • Minimaal 1 bestand vereist                                         │
│   • Geen bestand > 25MB                                                │
│   • Totaal < 50MB                                                      │
│   • Alleen PDF/DOCX/ZIP                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ [Analyseren →] clicked
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAP 2: ANALYSE                                     │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │                      ◐ ◓ ◑ ◒                                    │   │
│   │                                                                 │   │
│   │              AI analyseert documenten...                        │   │
│   │                                                                 │   │
│   │   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  67%                │   │
│   │                                                                 │   │
│   │   ✓ Documenten geüpload                                        │   │
│   │   ✓ Tekst geëxtraheerd                                         │   │
│   │   ✓ Basisgegevens gevonden                                     │   │
│   │   ◐ Planning datums zoeken...                                  │   │
│   │   ○ Gunningscriteria analyseren                                │   │
│   │   ○ Eisen & certificeringen                                    │   │
│   │                                                                 │   │
│   │   Geschatte tijd: ~15 seconden                                 │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│                                                    [Annuleren]          │
│                                                                         │
│   ─────────────────────────────────────────────────────────────────     │
│   Backend stappen:                                                      │
│   1. Upload files naar Supabase Storage                                │
│   2. Extract tekst uit PDF/DOCX                                        │
│   3. Roep Claude API aan met extractie prompt                          │
│   4. Parse JSON response                                               │
│   5. Return naar frontend                                              │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ Analyse complete
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      STAP 3: REVIEW                                      │
│                                                                         │
│   ✅ 18 van 22 velden automatisch ingevuld                              │
│                                                                         │
│   ┌─ BASISGEGEVENS ─────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  Naam aanbesteding *        [🟢]                                │   │
│   │  [Leveren bloembakken gemeente Rotterdam                    ]   │   │
│   │                                                                 │   │
│   │  Opdrachtgever *   [🟢]            Aanb. dienst      [🟢]      │   │
│   │  [Gemeente Rotterdam   ]            [Stadswerken         ]      │   │
│   │                                                                 │   │
│   │  Tender nummer     [🟢]            Type              [🟢]      │   │
│   │  [2025-ROT-001        ]            [Europese aanbesteding▼]     │   │
│   │                                                                 │   │
│   │  Geraamde waarde   [🟡]            Locatie           [🟢]      │   │
│   │  [€ 450.000           ]            [Rotterdam            ]      │   │
│   │  ⚠️ Geschat op basis van scope                                  │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─ PLANNING ──────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  Publicatie    [🟢]     Schouw         [🟢]     NVI 1       [🟢]│   │
│   │  [2025-02-01     ]      [2025-02-10     ]       [2025-02-15   ] │   │
│   │                                                                 │   │
│   │  NVI 1 antw.   [🟢]     NVI 2          [🔴]     Deadline    [🟢]│   │
│   │  [2025-02-20     ]      [               ]       [2025-03-01   ] │   │
│   │                         Niet gevonden                           │   │
│   │                                                                 │   │
│   │  Presentatie   [🟢]     Voorl. gun.    [🟢]     Def. gun.   [🟢]│   │
│   │  [2025-03-15     ]      [2025-03-25     ]       [2025-04-10   ] │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─ GUNNINGSCRITERIA ──────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  [🟢] Kwaliteit - Plan van Aanpak                         40%  │   │
│   │  [🟢] Kwaliteit - Duurzaamheid                            20%  │   │
│   │  [🟢] Prijs                                               40%  │   │
│   │                                                        ──────  │   │
│   │                                                Total:    100%  │   │
│   │                                                                 │   │
│   │  [+ Criterium toevoegen]                                       │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─ CERTIFICERINGEN & EISEN ───────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  [🟢] ISO 9001    [🟢] VCA**    [🔴] ISO 14001                 │   │
│   │                                                                 │   │
│   │  [+ Certificering toevoegen]                                   │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   ┌─ GEKOPPELDE DOCUMENTEN ─────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │  📄 Leidraad.pdf                    Leidraad         2.4 MB    │   │
│   │  📄 Bijlage_Planning.pdf            Bijlage          1.1 MB    │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   Legenda: [🟢] Hoge zekerheid  [🟡] Check aanbevolen  [🔴] Niet gevonden│
│                                                                         │
│   [← Terug]                    [Annuleren]    [✓ Tender Aanmaken]       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                                │ [Tender Aanmaken] clicked
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      SUCCES                                              │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                 │   │
│   │                         ✅                                      │   │
│   │                                                                 │   │
│   │              Tender succesvol aangemaakt!                       │   │
│   │                                                                 │   │
│   │   "Leveren bloembakken gemeente Rotterdam"                     │   │
│   │                                                                 │   │
│   │   • 18 velden automatisch ingevuld                             │   │
│   │   • 2 documenten gekoppeld                                     │   │
│   │   • Planning compleet                                          │   │
│   │                                                                 │   │
│   │   [Naar Tender]              [Nog een importeren]              │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.6 UI/UX Specificaties

#### 2.6.1 Confidence Indicators

| Indicator | Kleur | Betekenis | Actie |
|-----------|-------|-----------|-------|
| 🟢 | `#10b981` | Hoge zekerheid (>85%) | Geen actie nodig |
| 🟡 | `#f59e0b` | Gemiddelde zekerheid (50-85%) | Check aanbevolen |
| 🔴 | `#ef4444` | Niet gevonden (<50% of leeg) | Handmatig invullen |

#### 2.6.2 Veld Groepering

```
BASISGEGEVENS
├── Naam aanbesteding *
├── Opdrachtgever *
├── Aanbestedende dienst
├── Tender nummer
├── Type aanbesteding
├── Geraamde waarde
├── Locatie
└── TenderNed URL

PLANNING
├── Publicatie datum
├── Schouw datum
├── NVI 1 - Vragen deadline
├── NVI 1 - Publicatie antwoorden
├── NVI 2 - Vragen deadline
├── NVI 2 - Publicatie antwoorden
├── Deadline indiening *
├── Presentatie datum
├── Voorlopige gunning
├── Definitieve gunning
├── Start uitvoering
└── Einde contract

GUNNINGSCRITERIA
├── Criterium 1: Naam + Percentage
├── Criterium 2: Naam + Percentage
├── ...
└── [+ Criterium toevoegen]

CERTIFICERINGEN & EISEN
├── ISO certificeringen
├── VCA certificeringen
├── Referentie eisen
└── Overige eisen

GEKOPPELDE DOCUMENTEN
├── Document 1 (type, grootte)
├── Document 2 (type, grootte)
└── ...
```

#### 2.6.3 Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (>1200px) | 3 kolommen voor datumvelden |
| Tablet (768-1200px) | 2 kolommen |
| Mobile (<768px) | 1 kolom, gestapeld |

---

## 3. Technisch Design

### 3.1 Architectuur Overzicht

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ SmartImport     │  │ UploadStep      │  │ ReviewStep      │         │
│  │ Wizard.js       │──│ Component.js    │──│ Component.js    │         │
│  │                 │  │                 │  │                 │         │
│  │ State Manager   │  │ Drag & Drop     │  │ Form Fields     │         │
│  │ Step Controller │  │ File Preview    │  │ Confidence UI   │         │
│  └────────┬────────┘  └─────────────────┘  └─────────────────┘         │
│           │                                                             │
│           │ HTTP/REST                                                   │
└───────────┼─────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────┴─────────────────────────────────────────────────────────────┐
│                              BACKEND                                     │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    FastAPI Router                                │    │
│  │                /api/v1/smart-import/                            │    │
│  │                                                                 │    │
│  │  POST /upload          - Upload bestanden                       │    │
│  │  POST /analyze         - Start AI analyse                       │    │
│  │  GET  /status/{id}     - Check analyse status                   │    │
│  │  POST /create-tender   - Maak tender aan                        │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ FileUpload      │  │ TextExtraction  │  │ AIExtraction    │         │
│  │ Service         │  │ Service         │  │ Service         │         │
│  │                 │  │                 │  │                 │         │
│  │ Supabase        │  │ PyMuPDF (PDF)   │  │ Claude API      │         │
│  │ Storage         │  │ python-docx     │  │ Sonnet 4        │         │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘         │
│           │                    │                    │                   │
└───────────┼────────────────────┼────────────────────┼───────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌───────────┴────────────────────┴────────────────────┴───────────────────┐
│                              DATABASE                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │ tenders         │  │ tender_documents│  │ smart_imports   │         │
│  │                 │  │                 │  │ (audit log)     │         │
│  │ Tender data     │  │ Uploaded files  │  │ Import history  │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
│                        Supabase PostgreSQL                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Database Schema

#### 3.2.1 Nieuwe tabel: smart_imports (audit/logging)

```sql
-- Tabel voor logging van smart imports
CREATE TABLE public.smart_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenderbureau_id UUID NOT NULL REFERENCES public.tenderbureaus(id),
    tender_id UUID REFERENCES public.tenders(id),  -- NULL tot tender is aangemaakt
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'uploading' 
        CHECK (status IN ('uploading', 'extracting', 'analyzing', 'review', 'completed', 'failed', 'cancelled')),
    
    -- Uploaded files
    uploaded_files JSONB DEFAULT '[]'::jsonb,
    -- Format: [{ "name": "Leidraad.pdf", "size": 2400000, "storage_path": "..." }]
    
    -- Extracted data
    extracted_data JSONB DEFAULT '{}'::jsonb,
    -- Format: { "naam": { "value": "...", "confidence": 0.95 }, ... }
    
    -- AI metadata
    ai_model_used TEXT DEFAULT 'claude-sonnet-4-20250514',
    ai_tokens_used INTEGER,
    extraction_time_seconds INTEGER,
    
    -- Overall stats
    total_fields INTEGER DEFAULT 0,
    fields_extracted INTEGER DEFAULT 0,
    fields_high_confidence INTEGER DEFAULT 0,
    fields_low_confidence INTEGER DEFAULT 0,
    
    -- Warnings
    warnings JSONB DEFAULT '[]'::jsonb,
    -- Format: ["NVI 2 niet gevonden", "Waarde is schatting"]
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    
    -- Audit
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT smart_imports_tenderbureau_id_fkey 
        FOREIGN KEY (tenderbureau_id) REFERENCES public.tenderbureaus(id)
);

-- Indexes
CREATE INDEX idx_smart_imports_tenderbureau ON smart_imports(tenderbureau_id);
CREATE INDEX idx_smart_imports_status ON smart_imports(status);
CREATE INDEX idx_smart_imports_created_at ON smart_imports(created_at DESC);

-- RLS Policies
ALTER TABLE smart_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bureau smart imports"
    ON smart_imports FOR SELECT
    USING (tenderbureau_id IN (
        SELECT tenderbureau_id FROM user_bureau_access 
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY "Users can create smart imports for own bureau"
    ON smart_imports FOR INSERT
    WITH CHECK (tenderbureau_id IN (
        SELECT tenderbureau_id FROM user_bureau_access 
        WHERE user_id = auth.uid() AND is_active = true
    ));

CREATE POLICY "Users can update own bureau smart imports"
    ON smart_imports FOR UPDATE
    USING (tenderbureau_id IN (
        SELECT tenderbureau_id FROM user_bureau_access 
        WHERE user_id = auth.uid() AND is_active = true
    ));
```

#### 3.2.2 Bestaande tabel: tenders (relevante velden)

De Smart Import vult de volgende velden in de `tenders` tabel:

```sql
-- Basisgegevens
naam TEXT NOT NULL,                          -- Naam aanbesteding
tender_nummer TEXT,                          -- Referentienummer
opdrachtgever TEXT,                          -- Opdrachtgever naam
aanbestedende_dienst TEXT,                   -- Aanbestedende dienst
type TEXT,                                   -- Type aanbesteding
aanbestedingsprocedure TEXT,                 -- Procedure type
locatie TEXT,                                -- Locatie
geraamde_waarde NUMERIC,                     -- Geschatte waarde
tenderned_url TEXT,                          -- Link naar TenderNed
cpv_codes TEXT[],                            -- CPV codes array

-- Planning
publicatie_datum DATE,
schouw_datum DATE,
nvi1_datum TIMESTAMP WITH TIME ZONE,         -- NVI 1 deadline vragen
nvi_1_publicatie DATE,                       -- NVI 1 publicatie antwoorden
nvi2_datum TIMESTAMP WITH TIME ZONE,         -- NVI 2 deadline vragen
nvi_2_publicatie DATE,                       -- NVI 2 publicatie antwoorden
deadline_indiening TIMESTAMP WITH TIME ZONE, -- Deadline inschrijving
presentatie_datum DATE,
voorlopige_gunning DATE,
definitieve_gunning DATE,
start_uitvoering DATE,
einde_contract DATE,

-- Eisen
certificeringen_vereist TEXT[],              -- Vereiste certificeringen
referenties_verplicht BOOLEAN,
aantal_referenties_vereist INTEGER,
minimale_omzet NUMERIC,

-- Smart Import metadata
confidence_scores JSONB DEFAULT '{}'::jsonb, -- Confidence per veld
planning_sources JSONB DEFAULT '{}'::jsonb,  -- Bron per datum
planning_warnings TEXT[] DEFAULT ARRAY[]::text[],
planning_extracted_at TIMESTAMP WITH TIME ZONE,
planning_extraction_method TEXT              -- 'automatic' of 'manual'
```

#### 3.2.3 Bestaande tabel: tender_documents

```sql
-- Documenten worden hier opgeslagen met document_type
document_type TEXT NOT NULL,
-- Mogelijke waarden voor Smart Import:
-- 'leidraad', 'bijlage_planning', 'bijlage_eisen', 'bijlage_overig', 'nota_van_inlichtingen'
```

### 3.3 API Specificaties

#### 3.3.1 POST /api/v1/smart-import/upload

Upload bestanden en start een nieuwe import sessie.

**Request:**
```http
POST /api/v1/smart-import/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

files: [File, File, ...]
tenderbureau_id: UUID
```

**Response (201 Created):**
```json
{
    "success": true,
    "import_id": "uuid-here",
    "files_uploaded": [
        {
            "name": "Leidraad.pdf",
            "size": 2400000,
            "storage_path": "smart-imports/{import_id}/Leidraad.pdf",
            "detected_type": "leidraad"
        },
        {
            "name": "Bijlage_Planning.pdf",
            "size": 1100000,
            "storage_path": "smart-imports/{import_id}/Bijlage_Planning.pdf",
            "detected_type": "bijlage_planning"
        }
    ],
    "status": "uploading",
    "next_step": "analyze"
}
```

**Errors:**
- `400`: Invalid file type / File too large
- `401`: Unauthorized
- `413`: Total size exceeds limit

#### 3.3.2 POST /api/v1/smart-import/{import_id}/analyze

Start de AI analyse voor een import sessie.

**Request:**
```http
POST /api/v1/smart-import/{import_id}/analyze
Content-Type: application/json
Authorization: Bearer {token}

{
    "options": {
        "extract_gunningscriteria": true,
        "extract_certificeringen": true,
        "language": "nl"
    }
}
```

**Response (202 Accepted):**
```json
{
    "success": true,
    "import_id": "uuid-here",
    "status": "analyzing",
    "estimated_time_seconds": 20,
    "message": "Analyse gestart. Poll /status voor voortgang."
}
```

#### 3.3.3 GET /api/v1/smart-import/{import_id}/status

Check de status van een analyse.

**Response (200 OK) - In Progress:**
```json
{
    "import_id": "uuid-here",
    "status": "analyzing",
    "progress": 67,
    "current_step": "planning_extraction",
    "steps": [
        { "name": "upload", "status": "completed", "label": "Documenten geüpload" },
        { "name": "text_extraction", "status": "completed", "label": "Tekst geëxtraheerd" },
        { "name": "basic_extraction", "status": "completed", "label": "Basisgegevens gevonden" },
        { "name": "planning_extraction", "status": "in_progress", "label": "Planning datums zoeken" },
        { "name": "criteria_extraction", "status": "pending", "label": "Gunningscriteria analyseren" },
        { "name": "requirements_extraction", "status": "pending", "label": "Eisen & certificeringen" }
    ],
    "elapsed_seconds": 12,
    "estimated_remaining_seconds": 8
}
```

**Response (200 OK) - Completed:**
```json
{
    "import_id": "uuid-here",
    "status": "completed",
    "progress": 100,
    "extracted_data": {
        "basisgegevens": {
            "naam": {
                "value": "Leveren en plaatsen bloembakken gemeente Rotterdam",
                "confidence": 0.98,
                "source": "Leidraad.pdf, pagina 1"
            },
            "opdrachtgever": {
                "value": "Gemeente Rotterdam",
                "confidence": 0.99,
                "source": "Leidraad.pdf, pagina 1"
            },
            "aanbestedende_dienst": {
                "value": "Stadswerken Rotterdam",
                "confidence": 0.92,
                "source": "Leidraad.pdf, pagina 2"
            },
            "tender_nummer": {
                "value": "2025-ROT-BLOEM-001",
                "confidence": 0.95,
                "source": "Leidraad.pdf, header"
            },
            "type": {
                "value": "europese_aanbesteding",
                "confidence": 0.97,
                "source": "Leidraad.pdf, pagina 3"
            },
            "geraamde_waarde": {
                "value": 450000,
                "confidence": 0.65,
                "source": "Geschat op basis van scope",
                "warning": "Niet expliciet vermeld in documenten"
            },
            "locatie": {
                "value": "Rotterdam",
                "confidence": 0.95,
                "source": "Leidraad.pdf, pagina 1"
            },
            "tenderned_url": {
                "value": "https://www.tenderned.nl/aankondigingen/123456",
                "confidence": 0.99,
                "source": "Leidraad.pdf, pagina 1"
            },
            "cpv_codes": {
                "value": ["44112200-0", "45262680-1"],
                "confidence": 0.98,
                "source": "Leidraad.pdf, pagina 4"
            }
        },
        "planning": {
            "publicatie_datum": {
                "value": "2025-02-01",
                "confidence": 0.99,
                "source": "Bijlage_Planning.pdf"
            },
            "schouw_datum": {
                "value": "2025-02-10",
                "confidence": 0.95,
                "source": "Leidraad.pdf, pagina 8"
            },
            "nvi1_datum": {
                "value": "2025-02-15T12:00:00",
                "confidence": 0.98,
                "source": "Bijlage_Planning.pdf"
            },
            "nvi_1_publicatie": {
                "value": "2025-02-20",
                "confidence": 0.92,
                "source": "Bijlage_Planning.pdf"
            },
            "nvi2_datum": {
                "value": null,
                "confidence": 0,
                "source": null,
                "warning": "Niet gevonden in documenten"
            },
            "nvi_2_publicatie": {
                "value": null,
                "confidence": 0,
                "source": null
            },
            "deadline_indiening": {
                "value": "2025-03-01T14:00:00",
                "confidence": 0.99,
                "source": "Leidraad.pdf, pagina 5"
            },
            "presentatie_datum": {
                "value": "2025-03-15",
                "confidence": 0.88,
                "source": "Leidraad.pdf, pagina 12"
            },
            "voorlopige_gunning": {
                "value": "2025-03-25",
                "confidence": 0.85,
                "source": "Bijlage_Planning.pdf"
            },
            "definitieve_gunning": {
                "value": "2025-04-10",
                "confidence": 0.82,
                "source": "Bijlage_Planning.pdf"
            },
            "start_uitvoering": {
                "value": "2025-05-01",
                "confidence": 0.90,
                "source": "Leidraad.pdf, pagina 15"
            },
            "einde_contract": {
                "value": null,
                "confidence": 0,
                "source": null
            }
        },
        "gunningscriteria": {
            "criteria": [
                {
                    "code": "K1",
                    "naam": "Plan van Aanpak",
                    "percentage": 40,
                    "beschrijving": "Kwaliteit van de voorgestelde werkwijze",
                    "confidence": 0.95
                },
                {
                    "code": "K2",
                    "naam": "Duurzaamheid",
                    "percentage": 20,
                    "beschrijving": "Milieu-impact en duurzame oplossingen",
                    "confidence": 0.92
                },
                {
                    "code": "P1",
                    "naam": "Prijs",
                    "percentage": 40,
                    "beschrijving": "Totaalprijs inclusief BTW",
                    "confidence": 0.98
                }
            ],
            "confidence": 0.95,
            "source": "Leidraad.pdf, pagina 10-11"
        },
        "certificeringen": {
            "vereist": [
                {
                    "naam": "ISO 9001",
                    "verplicht": true,
                    "confidence": 0.95
                },
                {
                    "naam": "VCA**",
                    "verplicht": true,
                    "confidence": 0.92
                }
            ],
            "confidence": 0.93,
            "source": "Leidraad.pdf, pagina 6"
        }
    },
    "statistics": {
        "total_fields": 22,
        "fields_extracted": 18,
        "fields_high_confidence": 15,
        "fields_medium_confidence": 2,
        "fields_low_confidence": 1,
        "fields_not_found": 4
    },
    "warnings": [
        "NVI 2 deadline niet gevonden in documenten",
        "Einde contract niet gespecificeerd",
        "Geraamde waarde is een schatting"
    ],
    "processing_time_seconds": 18,
    "tokens_used": 4523
}
```

#### 3.3.4 POST /api/v1/smart-import/{import_id}/create-tender

Maak de tender aan met de geëxtraheerde (en eventueel gecorrigeerde) data.

**Request:**
```http
POST /api/v1/smart-import/{import_id}/create-tender
Content-Type: application/json
Authorization: Bearer {token}

{
    "data": {
        "naam": "Leveren en plaatsen bloembakken gemeente Rotterdam",
        "opdrachtgever": "Gemeente Rotterdam",
        "aanbestedende_dienst": "Stadswerken Rotterdam",
        "tender_nummer": "2025-ROT-BLOEM-001",
        "type": "europese_aanbesteding",
        "geraamde_waarde": 450000,
        "locatie": "Rotterdam",
        "publicatie_datum": "2025-02-01",
        "schouw_datum": "2025-02-10",
        "nvi1_datum": "2025-02-15T12:00:00Z",
        "nvi_1_publicatie": "2025-02-20",
        "deadline_indiening": "2025-03-01T14:00:00Z",
        "presentatie_datum": "2025-03-15",
        "voorlopige_gunning": "2025-03-25",
        "definitieve_gunning": "2025-04-10",
        "start_uitvoering": "2025-05-01",
        "certificeringen_vereist": ["ISO 9001", "VCA**"]
    },
    "options": {
        "fase": "acquisitie",
        "fase_status": "nieuw",
        "link_documents": true
    }
}
```

**Response (201 Created):**
```json
{
    "success": true,
    "tender": {
        "id": "tender-uuid-here",
        "naam": "Leveren en plaatsen bloembakken gemeente Rotterdam",
        "tender_nummer": "2025-ROT-BLOEM-001",
        "fase": "acquisitie",
        "fase_status": "nieuw"
    },
    "documents_linked": 2,
    "import_completed": true,
    "redirect_url": "/tenders/tender-uuid-here"
}
```

### 3.4 AI Extractie Prompt

De volgende prompt wordt gebruikt voor de Claude API:

```
Je bent een expert in het analyseren van Nederlandse aanbestedingsdocumenten. 
Je taak is om alle relevante informatie te extraheren en terug te geven in een gestructureerd JSON formaat.

BELANGRIJKE REGELS:
1. Gebruik ALLEEN informatie die EXPLICIET in de documenten staat
2. Als iets niet gevonden wordt, zet de value op null en confidence op 0
3. Geef bij elke waarde aan waar je het gevonden hebt (bron)
4. Confidence score: 0.0-1.0 (0=niet gevonden, 1=100% zeker)
5. Datums altijd in ISO formaat: YYYY-MM-DD of YYYY-MM-DDTHH:MM:SS
6. Bedragen zonder valutasymbool, als integer

DOCUMENTEN:
{document_content}

EXTRAHEER DE VOLGENDE INFORMATIE:

## 1. BASISGEGEVENS
- naam: Officiële naam/titel van de aanbesteding
- opdrachtgever: Naam van de opdrachtgevende organisatie
- aanbestedende_dienst: Specifieke dienst/afdeling (indien anders dan opdrachtgever)
- tender_nummer: Referentie/kenmerknummer
- type: Type aanbesteding (europese_aanbesteding, nationale_aanbesteding, meervoudig_onderhands, enkelvoudig_onderhands)
- aanbestedingsprocedure: Procedure (openbaar, niet_openbaar, concurrentiegerichte_dialoog, etc.)
- geraamde_waarde: Geschatte opdrachtwaarde in euros
- locatie: Geografische locatie van uitvoering
- tenderned_url: Link naar TenderNed (indien aanwezig)
- cpv_codes: Array van CPV codes

## 2. PLANNING
Zoek ALLE onderstaande datums. Let op variaties in naamgeving:
- publicatie_datum: Publicatiedatum aanbesteding
- schouw_datum: Schouw / Locatiebezoek / Bezichtiging
- nvi1_datum: NVI 1 / Nota van Inlichtingen ronde 1 / Vragen deadline 1 (INCLUSIEF TIJD)
- nvi_1_publicatie: Publicatie antwoorden NVI 1
- nvi2_datum: NVI 2 / Nota van Inlichtingen ronde 2 / Vragen deadline 2 (INCLUSIEF TIJD)
- nvi_2_publicatie: Publicatie antwoorden NVI 2
- deadline_indiening: Inschrijvingstermijn / Deadline indiening / Uiterste datum (INCLUSIEF TIJD)
- presentatie_datum: Presentatie / Interview / Mondelinge toelichting
- voorlopige_gunning: Voorlopige gunning / Voornemen tot gunning
- definitieve_gunning: Definitieve gunning / Gunningsbesluit
- start_uitvoering: Ingangsdatum / Start werkzaamheden / Aanvang opdracht
- einde_contract: Einddatum / Looptijd einde

## 3. GUNNINGSCRITERIA
Extraheer alle gunningscriteria met:
- code: K1, K2, P1, etc.
- naam: Naam van het criterium
- percentage: Weging in procenten
- beschrijving: Korte beschrijving (indien aanwezig)

## 4. CERTIFICERINGEN & EISEN
- certificeringen_vereist: Array van vereiste certificeringen (ISO 9001, VCA, etc.)
- referenties_verplicht: boolean
- aantal_referenties_vereist: integer
- minimale_omzet: Minimale jaaromzet eis

ANTWOORD FORMAAT (STRICT JSON):
{
    "basisgegevens": {
        "naam": { "value": "...", "confidence": 0.0-1.0, "source": "document, pagina X" },
        ...
    },
    "planning": {
        "publicatie_datum": { "value": "YYYY-MM-DD" | null, "confidence": 0.0-1.0, "source": "..." },
        ...
    },
    "gunningscriteria": {
        "criteria": [...],
        "confidence": 0.0-1.0,
        "source": "..."
    },
    "certificeringen": {
        "vereist": [...],
        "confidence": 0.0-1.0,
        "source": "..."
    },
    "warnings": ["waarschuwing 1", "waarschuwing 2"]
}
```

### 3.5 Frontend Componenten

#### 3.5.1 Component Structuur

```
frontend/js/components/smart-import/
├── SmartImportWizard.js      # Hoofdcontainer, state management
├── UploadStep.js             # Stap 1: Drag & drop upload
├── AnalyzeStep.js            # Stap 2: Voortgang analyse
├── ReviewStep.js             # Stap 3: Review & correctie
├── ConfidenceIndicator.js    # 🟢🟡🔴 indicator component
├── FieldGroup.js             # Groepering van velden
├── GunningsCriteriaEditor.js # Editor voor gunningscriteria
└── DocumentsList.js          # Preview van gekoppelde docs
```

#### 3.5.2 SmartImportWizard.js

```javascript
// frontend/js/components/smart-import/SmartImportWizard.js
// Hoofdcomponent voor de Smart Import wizard

export class SmartImportWizard {
    constructor(options = {}) {
        this.tenderbureau_id = options.tenderbureau_id;
        this.onComplete = options.onComplete || (() => {});
        this.onCancel = options.onCancel || (() => {});
        
        // State
        this.currentStep = 1; // 1: upload, 2: analyze, 3: review
        this.importId = null;
        this.uploadedFiles = [];
        this.extractedData = null;
        this.editedData = {};
        
        // DOM
        this.element = null;
        this.overlay = null;
    }
    
    // Stappen
    STEPS = [
        { id: 1, name: 'upload', label: 'Upload', icon: 'upload' },
        { id: 2, name: 'analyze', label: 'Analyseren', icon: 'cpu' },
        { id: 3, name: 'review', label: 'Review', icon: 'checkCircle' }
    ];
    
    open() { /* ... */ }
    close() { /* ... */ }
    
    // Step handlers
    handleFilesUploaded(files) { /* ... */ }
    startAnalysis() { /* ... */ }
    pollAnalysisStatus() { /* ... */ }
    handleAnalysisComplete(data) { /* ... */ }
    handleFieldChange(field, value) { /* ... */ }
    createTender() { /* ... */ }
    
    // Rendering
    render() { /* ... */ }
    renderStepIndicator() { /* ... */ }
    renderCurrentStep() { /* ... */ }
}
```

#### 3.5.3 State Management

```javascript
// Wizard State
{
    currentStep: 1 | 2 | 3,
    
    // Stap 1: Upload
    uploadedFiles: [
        { name: string, size: number, file: File, status: 'pending' | 'uploading' | 'done' | 'error' }
    ],
    uploadProgress: number, // 0-100
    
    // Stap 2: Analyse
    importId: string | null,
    analysisStatus: 'idle' | 'running' | 'completed' | 'failed',
    analysisProgress: number, // 0-100
    analysisSteps: [
        { name: string, status: 'pending' | 'running' | 'completed', label: string }
    ],
    
    // Stap 3: Review
    extractedData: {
        basisgegevens: { [field]: { value, confidence, source } },
        planning: { ... },
        gunningscriteria: { ... },
        certificeringen: { ... }
    },
    editedData: { [field]: value }, // Gebruiker aanpassingen
    validationErrors: { [field]: string },
    
    // General
    isLoading: boolean,
    error: string | null
}
```

### 3.6 Backend Services

#### 3.6.1 Service Structuur

```
backend/app/services/smart_import/
├── __init__.py
├── smart_import_service.py   # Hoofdservice, orchestratie
├── file_upload_service.py    # Bestandsupload naar Supabase
├── text_extraction_service.py # PDF/DOCX tekst extractie
├── ai_extraction_service.py  # Claude API integratie
└── tender_creation_service.py # Tender aanmaken
```

#### 3.6.2 smart_import_service.py

```python
# backend/app/services/smart_import/smart_import_service.py

from typing import List, Dict, Any, Optional
from uuid import UUID
import asyncio

from .file_upload_service import FileUploadService
from .text_extraction_service import TextExtractionService
from .ai_extraction_service import AIExtractionService
from .tender_creation_service import TenderCreationService


class SmartImportService:
    """
    Orchestreert het volledige Smart Import proces.
    """
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
        self.file_service = FileUploadService(supabase_client)
        self.text_service = TextExtractionService()
        self.ai_service = AIExtractionService()
        self.tender_service = TenderCreationService(supabase_client)
    
    async def create_import_session(
        self, 
        tenderbureau_id: UUID, 
        user_id: UUID
    ) -> Dict[str, Any]:
        """Maak een nieuwe import sessie aan."""
        result = self.supabase.table('smart_imports').insert({
            'tenderbureau_id': str(tenderbureau_id),
            'created_by': str(user_id),
            'status': 'uploading'
        }).execute()
        
        return result.data[0]
    
    async def upload_files(
        self, 
        import_id: UUID, 
        files: List[Any]
    ) -> List[Dict[str, Any]]:
        """Upload bestanden naar Supabase Storage."""
        uploaded = []
        
        for file in files:
            result = await self.file_service.upload(
                file=file,
                path=f"smart-imports/{import_id}/{file.filename}"
            )
            uploaded.append(result)
        
        # Update import record
        self.supabase.table('smart_imports').update({
            'uploaded_files': uploaded,
            'status': 'uploaded'
        }).eq('id', str(import_id)).execute()
        
        return uploaded
    
    async def analyze(
        self, 
        import_id: UUID,
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Voer de volledige analyse uit:
        1. Haal bestanden op
        2. Extract tekst
        3. Roep AI aan
        4. Parse resultaat
        """
        # Update status
        self._update_status(import_id, 'analyzing', progress=0)
        
        try:
            # 1. Haal import record op
            import_record = self._get_import(import_id)
            files = import_record['uploaded_files']
            
            # 2. Extract tekst uit alle bestanden
            self._update_status(import_id, 'analyzing', progress=20, 
                              current_step='text_extraction')
            
            combined_text = ""
            for file_info in files:
                text = await self.text_service.extract(file_info['storage_path'])
                combined_text += f"\n\n=== {file_info['name']} ===\n\n{text}"
            
            # 3. AI Extractie
            self._update_status(import_id, 'analyzing', progress=40,
                              current_step='ai_extraction')
            
            extracted_data = await self.ai_service.extract(
                document_content=combined_text,
                options=options
            )
            
            # 4. Bereken statistieken
            stats = self._calculate_statistics(extracted_data)
            
            # 5. Update import record
            self._update_status(import_id, 'completed', progress=100,
                              extracted_data=extracted_data,
                              statistics=stats)
            
            return {
                'import_id': str(import_id),
                'status': 'completed',
                'extracted_data': extracted_data,
                'statistics': stats
            }
            
        except Exception as e:
            self._update_status(import_id, 'failed', 
                              error_message=str(e))
            raise
    
    async def create_tender(
        self,
        import_id: UUID,
        data: Dict[str, Any],
        options: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Maak de tender aan met de geëxtraheerde data."""
        import_record = self._get_import(import_id)
        
        # Maak tender aan
        tender = await self.tender_service.create(
            data=data,
            tenderbureau_id=import_record['tenderbureau_id'],
            created_by=import_record['created_by']
        )
        
        # Link documenten
        if options and options.get('link_documents', True):
            await self._link_documents(
                tender_id=tender['id'],
                import_id=import_id,
                files=import_record['uploaded_files']
            )
        
        # Update import record
        self.supabase.table('smart_imports').update({
            'tender_id': tender['id'],
            'status': 'completed',
            'completed_at': 'now()'
        }).eq('id', str(import_id)).execute()
        
        return tender
    
    def _update_status(self, import_id: UUID, status: str, **kwargs):
        """Update import status in database."""
        update_data = {'status': status, **kwargs}
        self.supabase.table('smart_imports').update(
            update_data
        ).eq('id', str(import_id)).execute()
    
    def _get_import(self, import_id: UUID) -> Dict[str, Any]:
        """Haal import record op."""
        result = self.supabase.table('smart_imports').select(
            '*'
        ).eq('id', str(import_id)).single().execute()
        return result.data
    
    def _calculate_statistics(self, extracted_data: Dict) -> Dict:
        """Bereken extractie statistieken."""
        total = 0
        extracted = 0
        high_conf = 0
        medium_conf = 0
        low_conf = 0
        
        for category in ['basisgegevens', 'planning']:
            if category in extracted_data:
                for field, data in extracted_data[category].items():
                    total += 1
                    if data.get('value') is not None:
                        extracted += 1
                        conf = data.get('confidence', 0)
                        if conf >= 0.85:
                            high_conf += 1
                        elif conf >= 0.5:
                            medium_conf += 1
                        else:
                            low_conf += 1
        
        return {
            'total_fields': total,
            'fields_extracted': extracted,
            'fields_high_confidence': high_conf,
            'fields_medium_confidence': medium_conf,
            'fields_low_confidence': low_conf,
            'fields_not_found': total - extracted
        }
    
    async def _link_documents(
        self, 
        tender_id: UUID, 
        import_id: UUID,
        files: List[Dict]
    ):
        """Koppel geüploade documenten aan tender."""
        for file_info in files:
            # Verplaats naar tender folder
            new_path = f"tenders/{tender_id}/{file_info['name']}"
            await self.file_service.move(
                from_path=file_info['storage_path'],
                to_path=new_path
            )
            
            # Insert in tender_documents
            self.supabase.table('tender_documents').insert({
                'tender_id': str(tender_id),
                'tenderbureau_id': file_info.get('tenderbureau_id'),
                'file_name': file_info['name'],
                'original_file_name': file_info['name'],
                'file_size': file_info['size'],
                'file_type': file_info['name'].split('.')[-1],
                'storage_path': new_path,
                'document_type': file_info.get('detected_type', 'overig')
            }).execute()
```

---

## 4. Data Mapping

### 4.1 Extractie → Database Mapping

| Extractie Veld | Database Tabel | Database Kolom | Type |
|----------------|----------------|----------------|------|
| naam | tenders | naam | TEXT |
| opdrachtgever | tenders | opdrachtgever | TEXT |
| aanbestedende_dienst | tenders | aanbestedende_dienst | TEXT |
| tender_nummer | tenders | tender_nummer | TEXT |
| type | tenders | type | TEXT |
| aanbestedingsprocedure | tenders | aanbestedingsprocedure | TEXT |
| geraamde_waarde | tenders | geraamde_waarde | NUMERIC |
| locatie | tenders | locatie | TEXT |
| tenderned_url | tenders | tenderned_url | TEXT |
| cpv_codes | tenders | cpv_codes | TEXT[] |
| publicatie_datum | tenders | publicatie_datum | DATE |
| schouw_datum | tenders | schouw_datum | DATE |
| nvi1_datum | tenders | nvi1_datum | TIMESTAMP |
| nvi_1_publicatie | tenders | nvi_1_publicatie | DATE |
| nvi2_datum | tenders | nvi2_datum | TIMESTAMP |
| nvi_2_publicatie | tenders | nvi_2_publicatie | DATE |
| deadline_indiening | tenders | deadline_indiening | TIMESTAMP |
| presentatie_datum | tenders | presentatie_datum | DATE |
| voorlopige_gunning | tenders | voorlopige_gunning | DATE |
| definitieve_gunning | tenders | definitieve_gunning | DATE |
| start_uitvoering | tenders | start_uitvoering | DATE |
| einde_contract | tenders | einde_contract | DATE |
| certificeringen | tenders | certificeringen_vereist | TEXT[] |
| referenties_verplicht | tenders | referenties_verplicht | BOOLEAN |
| aantal_referenties | tenders | aantal_referenties_vereist | INTEGER |
| minimale_omzet | tenders | minimale_omzet | NUMERIC |
| confidence_scores | tenders | confidence_scores | JSONB |

### 4.2 Document Type Detectie

| Bestandsnaam Pattern | Gedetecteerd Type |
|---------------------|-------------------|
| `*leidraad*`, `*aanbestedingsdocument*` | leidraad |
| `*planning*`, `*tijdschema*` | bijlage_planning |
| `*programma*eisen*`, `*pve*`, `*bestek*` | bijlage_eisen |
| `*nota*inlichtingen*`, `*nvi*` | nota_van_inlichtingen |
| `*bijlage*` | bijlage_overig |
| (default) | overig |

---

## 5. Error Handling

### 5.1 Frontend Errors

| Error | Gebruikersbericht | Actie |
|-------|-------------------|-------|
| File too large | "Bestand te groot (max 25MB per bestand)" | Markeer bestand rood |
| Invalid file type | "Bestandstype niet ondersteund" | Markeer bestand rood |
| Upload failed | "Upload mislukt. Probeer opnieuw." | Retry button |
| Analysis timeout | "Analyse duurt te lang. Probeer opnieuw." | Retry / Cancel |
| Analysis failed | "Analyse mislukt: [reden]" | Retry / Handmatig |
| Network error | "Geen verbinding. Controleer internet." | Retry |

### 5.2 Backend Errors

| Error Code | HTTP Status | Beschrijving | Recovery |
|------------|-------------|--------------|----------|
| UPLOAD_FAILED | 500 | Supabase Storage error | Retry upload |
| TEXT_EXTRACTION_FAILED | 500 | PDF/DOCX parsing error | Skip file of handmatig |
| AI_TIMEOUT | 504 | Claude API timeout | Retry met kleinere context |
| AI_ERROR | 502 | Claude API error | Retry of fallback |
| VALIDATION_ERROR | 400 | Ongeldige input data | Fix data en retry |
| TENDER_CREATE_FAILED | 500 | Database error | Rollback en retry |

### 5.3 Rollback Strategy

```python
async def create_tender_with_rollback(self, import_id, data):
    """
    Transactie met rollback bij fouten.
    """
    tender_id = None
    documents_created = []
    
    try:
        # 1. Maak tender aan
        tender = await self.tender_service.create(data)
        tender_id = tender['id']
        
        # 2. Link documenten
        for file in files:
            doc = await self.link_document(tender_id, file)
            documents_created.append(doc['id'])
        
        # 3. Update import status
        await self.update_import_status(import_id, 'completed', tender_id)
        
        return tender
        
    except Exception as e:
        # Rollback: verwijder aangemaakte records
        if tender_id:
            await self.tender_service.delete(tender_id)
        
        for doc_id in documents_created:
            await self.document_service.delete(doc_id)
        
        await self.update_import_status(import_id, 'failed', error=str(e))
        raise
```

---

## 6. Security Considerations

### 6.1 Bestandsvalidatie

```python
ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
]

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB per bestand
MAX_TOTAL_SIZE = 50 * 1024 * 1024  # 50MB totaal
MAX_FILES = 10

def validate_file(file):
    # Check MIME type
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(f"Bestandstype niet toegestaan: {file.content_type}")
    
    # Check bestandsgrootte
    if file.size > MAX_FILE_SIZE:
        raise ValidationError(f"Bestand te groot: {file.size / 1024 / 1024:.1f}MB")
    
    # Check magic bytes (niet alleen extensie)
    magic_bytes = file.read(8)
    file.seek(0)
    if not is_valid_magic_bytes(magic_bytes, file.content_type):
        raise ValidationError("Bestandsinhoud komt niet overeen met type")
```

### 6.2 RLS Policies

Alle smart_imports records zijn beschermd door Row Level Security:
- Gebruikers kunnen alleen imports zien van hun eigen tenderbureau
- Alleen actieve bureau toegang wordt gecontroleerd
- Super admins hebben geen speciale toegang (bewust)

### 6.3 API Rate Limiting

```python
# Rate limits per endpoint
RATE_LIMITS = {
    '/api/v1/smart-import/upload': '10/minute',
    '/api/v1/smart-import/analyze': '5/minute',
    '/api/v1/smart-import/create-tender': '10/minute'
}
```

### 6.4 Claude API Key Management

- API key wordt opgeslagen als environment variable
- Nooit in client-side code of logs
- Rotatie elke 90 dagen

---

## 7. Implementatie Plan

### 7.1 Fase 1: Core Infrastructure (2 dagen)

| Taak | Effort | Prioriteit |
|------|--------|------------|
| Database migratie (smart_imports tabel) | 2u | P0 |
| Backend router setup | 2u | P0 |
| FileUploadService | 4u | P0 |
| TextExtractionService | 4u | P0 |
| Basic API endpoints | 4u | P0 |

### 7.2 Fase 2: AI Extractie (1.5 dagen)

| Taak | Effort | Prioriteit |
|------|--------|------------|
| AIExtractionService | 4u | P0 |
| Extractie prompt fine-tuning | 4u | P0 |
| Response parsing | 2u | P0 |
| Confidence calculation | 2u | P1 |

### 7.3 Fase 3: Frontend Wizard (2 dagen)

| Taak | Effort | Prioriteit |
|------|--------|------------|
| SmartImportWizard component | 4u | P0 |
| UploadStep met drag & drop | 3u | P0 |
| AnalyzeStep met progress | 2u | P0 |
| ReviewStep met form | 6u | P0 |
| ConfidenceIndicator component | 1u | P1 |

### 7.4 Fase 4: Integratie & Polish (1 dag)

| Taak | Effort | Prioriteit |
|------|--------|------------|
| Header dropdown integratie | 2u | P0 |
| Tender creation flow | 2u | P0 |
| Document linking | 2u | P1 |
| Error handling UI | 2u | P1 |

### 7.5 Fase 5: Testing & Documentatie (1 dag)

| Taak | Effort | Prioriteit |
|------|--------|------------|
| Unit tests backend | 3u | P1 |
| Integration tests | 2u | P1 |
| Manual testing | 2u | P0 |
| User documentation | 1u | P2 |

**Totale geschatte tijd: 7-8 werkdagen**

---

## 8. Acceptatiecriteria

### 8.1 Functionele Acceptatiecriteria

- [ ] **AC-001**: Gebruiker kan PDF, DOCX en ZIP bestanden uploaden via drag & drop
- [ ] **AC-002**: Voortgangsindicator toont realtime status van analyse
- [ ] **AC-003**: Alle 22 definieerde velden worden geëxtraheerd (of gemarkeerd als niet gevonden)
- [ ] **AC-004**: Confidence indicators zijn zichtbaar per veld
- [ ] **AC-005**: Alle velden zijn bewerkbaar in review stap
- [ ] **AC-006**: Tender wordt correct aangemaakt met alle data
- [ ] **AC-007**: Documenten worden gekoppeld aan de nieuwe tender
- [ ] **AC-008**: Gebruiker kan op elk moment annuleren

### 8.2 Technische Acceptatiecriteria

- [ ] **AC-101**: Analyse compleet binnen 60 seconden voor standaard documenten
- [ ] **AC-102**: API responses conform specificatie
- [ ] **AC-103**: RLS policies correct geïmplementeerd
- [ ] **AC-104**: Rollback werkt correct bij fouten
- [ ] **AC-105**: Error handling voor alle edge cases

### 8.3 Performance Criteria

- [ ] **AC-201**: Upload snelheid minimaal 1MB/sec
- [ ] **AC-202**: UI blijft responsive tijdens analyse
- [ ] **AC-203**: Memory usage stabiel (geen leaks)

---

## Appendix A: Voorbeeld Extractie Output

```json
{
  "basisgegevens": {
    "naam": {
      "value": "Europese aanbesteding voor het leveren en plaatsen van bloembakken",
      "confidence": 0.98,
      "source": "Leidraad_Bloembakken_2025.pdf, pagina 1, regel 1-2"
    },
    "opdrachtgever": {
      "value": "Gemeente Rotterdam",
      "confidence": 0.99,
      "source": "Leidraad_Bloembakken_2025.pdf, pagina 1"
    }
  },
  "planning": {
    "publicatie_datum": {
      "value": "2025-02-01",
      "confidence": 0.95,
      "source": "Bijlage_B_Planning.pdf, tabel rij 1"
    },
    "deadline_indiening": {
      "value": "2025-03-01T14:00:00",
      "confidence": 0.99,
      "source": "Leidraad_Bloembakken_2025.pdf, pagina 5, sectie 2.3"
    }
  },
  "gunningscriteria": {
    "criteria": [
      {
        "code": "K1",
        "naam": "Plan van Aanpak",
        "percentage": 40,
        "confidence": 0.95
      },
      {
        "code": "P1",
        "naam": "Prijs",
        "percentage": 60,
        "confidence": 0.98
      }
    ],
    "source": "Leidraad_Bloembakken_2025.pdf, pagina 10-12"
  },
  "warnings": [
    "NVI 2 deadline niet gevonden - mogelijk is er maar één vragenronde",
    "Einde contract niet gespecificeerd in documenten"
  ]
}
```

---

## Appendix B: API Error Responses

```json
// 400 Bad Request - Validation Error
{
  "error": "VALIDATION_ERROR",
  "message": "Bestand te groot",
  "details": {
    "file": "LargeDocument.pdf",
    "size": 30000000,
    "max_size": 25000000
  }
}

// 500 Internal Server Error - AI Extraction Failed
{
  "error": "AI_EXTRACTION_FAILED",
  "message": "Claude API returned an error",
  "details": {
    "claude_error": "rate_limit_exceeded",
    "retry_after": 60
  }
}
```

---

**Einde Document**

*Voor vragen over dit document, neem contact op met het development team.*
