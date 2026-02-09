# TenderZen — Smart Import Wizard v4.0 Implementatieplan

**Datum:** 8 februari 2026  
**Status:** Ontwerp  
**Scope:** Team toewijzing, back-planning, AI document generatie, component-split

---

## 1. OVERZICHT

### 1.1 Huidige situatie (v3.7)

De Smart Import Wizard heeft 3 stappen:
1. **Upload** — Documenten uploaden (PDF/DOCX/ZIP)
2. **Analyse** — AI extraheert metadata + planning
3. **Controleer** — Review & tender aanmaken

**Wat ontbreekt:**
- Team samenstelling (rollen → personen)
- Back-planning op basis van deadline
- Automatische toewijzing van taken aan personen
- AI-generatie van startdocumenten
- Workload-check bij toewijzing

### 1.2 Nieuwe situatie (v4.0)

De wizard krijgt **5 stappen**:

```
Stap 1: Upload         → Documenten uploaden
Stap 2: Analyse         → AI extraheert data (ongewijzigd)
Stap 3: Controleer      → Metadata + planning review
Stap 4: Team            → ⭐ NIEUW: Rollen toewijzen aan personen
Stap 5: Resultaat       → ⭐ NIEUW: Back-planning + documenten preview
```

### 1.3 Component-split

Het huidige 1100-regels monolithische bestand wordt opgesplitst:

```
Frontend/js/components/
├── SmartImportWizard.js            ← Orchestrator (flow, navigatie, state)
├── smart-import/
│   ├── UploadStep.js               ← Stap 1: upload + drag-drop
│   ├── AnalyzeStep.js              ← Stap 2: polling + progress
│   ├── ReviewStep.js               ← Stap 3: metadata review + edit
│   ├── TeamStep.js                 ← Stap 4: ⭐ NIEUW
│   ├── ResultStep.js               ← Stap 5: ⭐ NIEUW
│   └── SmartImportStyles.js        ← CSS injection
```

---

## 2. DATABASE — NIEUWE TABELLEN

### 2.1 Planning Templates

Templates per bureau voor standaard taken en doorlooptijden.

```sql
-- ============================================
-- Planning Templates
-- ============================================

CREATE TABLE planning_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenderbureau_id UUID NOT NULL REFERENCES tenderbureaus(id) ON DELETE CASCADE,
    naam TEXT NOT NULL,                          -- 'Standaard Tender', 'Europese Aanbesteding', etc.
    beschrijving TEXT,
    type TEXT DEFAULT 'planning',                -- 'planning' | 'checklist'
    is_standaard BOOLEAN DEFAULT false,          -- Default template voor dit bureau
    is_actief BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Elke template bevat meerdere taken
CREATE TABLE planning_template_taken (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES planning_templates(id) ON DELETE CASCADE,
    naam TEXT NOT NULL,                          -- 'Kick-off meeting', 'Tekstschrijven', etc.
    beschrijving TEXT,                           -- Optionele toelichting
    rol TEXT NOT NULL,                           -- 'tendermanager', 'schrijver', 'calculator', etc.
    t_minus_werkdagen INTEGER NOT NULL,          -- Werkdagen vóór deadline (bijv. 25 = T-25)
    duur_werkdagen INTEGER DEFAULT 1,            -- Hoeveel werkdagen de taak duurt
    is_mijlpaal BOOLEAN DEFAULT false,           -- Milestone (bijv. INTERNE DEADLINE)
    is_verplicht BOOLEAN DEFAULT true,           -- Kan AI deze overslaan bij eenvoudige tender?
    volgorde INTEGER DEFAULT 0,                  -- Sorteervolgorde
    afhankelijk_van UUID REFERENCES planning_template_taken(id),  -- Optionele dependency
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexen
CREATE INDEX idx_planning_templates_bureau ON planning_templates(tenderbureau_id);
CREATE INDEX idx_template_taken_template ON planning_template_taken(template_id);
CREATE INDEX idx_template_taken_volgorde ON planning_template_taken(template_id, volgorde);

-- RLS
ALTER TABLE planning_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE planning_template_taken ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bureau ziet eigen templates"
ON planning_templates FOR SELECT
USING (tenderbureau_id IN (
    SELECT tenderbureau_id FROM users WHERE id = auth.uid()
));

CREATE POLICY "Bureau beheert eigen templates"
ON planning_templates FOR ALL
USING (tenderbureau_id IN (
    SELECT tenderbureau_id FROM users WHERE id = auth.uid()
));

CREATE POLICY "Bureau ziet eigen template taken"
ON planning_template_taken FOR SELECT
USING (template_id IN (
    SELECT id FROM planning_templates WHERE tenderbureau_id IN (
        SELECT tenderbureau_id FROM users WHERE id = auth.uid()
    )
));

CREATE POLICY "Bureau beheert eigen template taken"
ON planning_template_taken FOR ALL
USING (template_id IN (
    SELECT id FROM planning_templates WHERE tenderbureau_id IN (
        SELECT tenderbureau_id FROM users WHERE id = auth.uid()
    )
));
```

### 2.2 Checklist Templates

Zelfde structuur maar voor indieningschecklist items.

```sql
-- Hergebruik planning_templates tabel met type='checklist'
-- Template taken voor checklists:

-- Voorbeeld insert:
INSERT INTO planning_templates (tenderbureau_id, naam, type, is_standaard) VALUES
('bureau-uuid', 'Standaard Indieningschecklist', 'checklist', true);

-- Checklist items hebben dezelfde velden maar andere semantiek:
-- - t_minus_werkdagen = wanneer moet dit document klaar zijn
-- - duur_werkdagen = geschatte doorlooptijd om document te verkrijgen
-- - rol = wie is verantwoordelijk
```

### 2.3 AI Gegenereerde Documenten

Opslag voor documenten die de wizard genereert.

```sql
CREATE TABLE ai_generated_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
    smart_import_id UUID REFERENCES smart_imports(id),
    type TEXT NOT NULL,                          -- Zie documenttypes hieronder
    titel TEXT NOT NULL,
    inhoud JSONB NOT NULL,                       -- Gestructureerde content
    inhoud_tekst TEXT,                           -- Plain text versie
    ai_model TEXT,                               -- 'haiku' | 'sonnet'
    status TEXT DEFAULT 'concept',               -- 'concept' | 'geaccepteerd' | 'verwijderd'
    geaccepteerd_door UUID REFERENCES users(id),
    geaccepteerd_op TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documenttypes:
-- 'go_no_go'          → Go/No-Go analyse
-- 'samenvatting'      → Samenvatting voor team
-- 'compliance_matrix' → Eisenlijst / compliance matrix
-- 'nvi_vragen'        → Nota van Inlichtingen vragenlijst
-- 'rode_draad'        → Rode draad document (outline)
-- 'pva_skelet'        → Plan van Aanpak skelet

CREATE INDEX idx_ai_docs_tender ON ai_generated_documents(tender_id);
CREATE INDEX idx_ai_docs_type ON ai_generated_documents(tender_id, type);

ALTER TABLE ai_generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bureau ziet eigen AI docs"
ON ai_generated_documents FOR ALL
USING (tender_id IN (
    SELECT id FROM tenders WHERE tenderbureau_id IN (
        SELECT tenderbureau_id FROM users WHERE id = auth.uid()
    )
));
```

### 2.4 Bureau Feestdagen

Voor back-planning: welke dagen zijn geen werkdagen.

```sql
CREATE TABLE bureau_feestdagen (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenderbureau_id UUID NOT NULL REFERENCES tenderbureaus(id) ON DELETE CASCADE,
    datum DATE NOT NULL,
    naam TEXT NOT NULL,                          -- 'Koningsdag', 'Kerst', etc.
    jaarlijks BOOLEAN DEFAULT false,             -- Herhaalt elk jaar
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenderbureau_id, datum)
);

CREATE INDEX idx_feestdagen_bureau ON bureau_feestdagen(tenderbureau_id);
```

### 2.5 Seed Data — Standaard Templates

```sql
-- ============================================
-- Seed: Standaard Planning Template
-- ============================================

-- Stap 1: Maak template
INSERT INTO planning_templates (id, tenderbureau_id, naam, type, is_standaard, beschrijving)
VALUES (
    'tmpl-planning-standaard',
    '{{BUREAU_ID}}',
    'Standaard Tender Planning',
    'planning',
    true,
    'Standaard back-planning voor een gemiddelde aanbesteding (4-6 weken doorlooptijd)'
);

-- Stap 2: Taken (T-minus = werkdagen vóór deadline)
INSERT INTO planning_template_taken (template_id, naam, rol, t_minus_werkdagen, duur_werkdagen, is_mijlpaal, volgorde) VALUES
('tmpl-planning-standaard', 'Kick-off meeting',              'tendermanager',  25, 1, true,   10),
('tmpl-planning-standaard', 'Analyse aanbestedingsstuk',     'tendermanager',  24, 2, false,  20),
('tmpl-planning-standaard', 'Rode draad sessie',             'tendermanager',  22, 1, false,  30),
('tmpl-planning-standaard', 'Tekstschrijven',                'schrijver',      20, 5, false,  40),
('tmpl-planning-standaard', 'Berekeningen / calculatie',     'calculator',     20, 5, false,  50),
('tmpl-planning-standaard', 'Referentieprojecten verzamelen','sales',          18, 3, false,  60),
('tmpl-planning-standaard', 'Concept versie 1',              'schrijver',      15, 0, true,   70),
('tmpl-planning-standaard', 'Interne review',                'reviewer',       14, 2, false,  80),
('tmpl-planning-standaard', 'Verwerken feedback',            'schrijver',      12, 2, false,  90),
('tmpl-planning-standaard', 'Concept versie 2',              'schrijver',      10, 0, true,  100),
('tmpl-planning-standaard', 'Naar vormgever',                'designer',       10, 4, false, 110),
('tmpl-planning-standaard', 'Opgemaakte versie check',       'tendermanager',   6, 1, false, 120),
('tmpl-planning-standaard', 'INTERNE DEADLINE',              'tendermanager',   3, 0, true,  130),
('tmpl-planning-standaard', 'Definitieve versie',            'tendermanager',   2, 1, false, 140),
('tmpl-planning-standaard', 'Indienen',                      'tendermanager',   0, 0, true,  150);

-- ============================================
-- Seed: Standaard Checklist Template
-- ============================================

INSERT INTO planning_templates (id, tenderbureau_id, naam, type, is_standaard, beschrijving)
VALUES (
    'tmpl-checklist-standaard',
    '{{BUREAU_ID}}',
    'Standaard Indieningschecklist',
    'checklist',
    true,
    'Standaard documenten die bij een inschrijving horen'
);

INSERT INTO planning_template_taken (template_id, naam, rol, t_minus_werkdagen, duur_werkdagen, is_verplicht, volgorde) VALUES
('tmpl-checklist-standaard', 'Uittreksel KvK',                'sales',           10, 1, true,   10),
('tmpl-checklist-standaard', 'Eigen Verklaring',              'tendermanager',    7, 1, true,   20),
('tmpl-checklist-standaard', 'UEA document',                  'tendermanager',    7, 1, true,   30),
('tmpl-checklist-standaard', 'Gedragsverklaring Aanbesteden', 'sales',           10, 3, true,   40),
('tmpl-checklist-standaard', 'Referentieprojecten',           'schrijver',       14, 3, true,   50),
('tmpl-checklist-standaard', 'CV''s sleutelpersoneel',        'schrijver',       10, 2, true,   60),
('tmpl-checklist-standaard', 'Plan van Aanpak',               'schrijver',        5, 5, true,   70),
('tmpl-checklist-standaard', 'Social Return bijlage',         'calculator',       5, 2, false,  80),
('tmpl-checklist-standaard', 'Inschrijfbiljet / prijsblad',   'calculator',       5, 3, true,   90),
('tmpl-checklist-standaard', 'Bankgarantie / verzekering',    'sales',            3, 5, false, 100),
('tmpl-checklist-standaard', 'Presentatie (indien mondeling)', 'tendermanager',   3, 2, false, 110);

-- ============================================
-- Seed: Nederlandse Feestdagen 2026
-- ============================================

INSERT INTO bureau_feestdagen (tenderbureau_id, datum, naam, jaarlijks) VALUES
('{{BUREAU_ID}}', '2026-01-01', 'Nieuwjaarsdag', false),
('{{BUREAU_ID}}', '2026-04-03', 'Goede Vrijdag', false),
('{{BUREAU_ID}}', '2026-04-05', 'Eerste Paasdag', false),
('{{BUREAU_ID}}', '2026-04-06', 'Tweede Paasdag', false),
('{{BUREAU_ID}}', '2026-04-27', 'Koningsdag', false),
('{{BUREAU_ID}}', '2026-05-05', 'Bevrijdingsdag', false),
('{{BUREAU_ID}}', '2026-05-14', 'Hemelvaartsdag', false),
('{{BUREAU_ID}}', '2026-05-15', 'Dag na Hemelvaart', false),
('{{BUREAU_ID}}', '2026-05-24', 'Eerste Pinksterdag', false),
('{{BUREAU_ID}}', '2026-05-25', 'Tweede Pinksterdag', false),
('{{BUREAU_ID}}', '2026-12-25', 'Eerste Kerstdag', false),
('{{BUREAU_ID}}', '2026-12-26', 'Tweede Kerstdag', false);
```

---

## 3. BACKEND — NIEUWE ENDPOINTS

### 3.1 Back-Planning Engine

```
POST /api/v1/planning/generate-backplanning
```

**Request:**
```json
{
    "deadline": "2026-03-15T17:00:00",
    "template_id": "tmpl-planning-standaard",
    "team_assignments": {
        "tendermanager": "user-uuid-rick",
        "schrijver": "user-uuid-nathalie",
        "calculator": "user-uuid-mehmet",
        "reviewer": "user-uuid-sarah",
        "designer": "user-uuid-lisa",
        "sales": "user-uuid-rick"
    },
    "tenderbureau_id": "bureau-uuid"
}
```

**Response:**
```json
{
    "planning_taken": [
        {
            "naam": "Kick-off meeting",
            "datum": "2026-02-09",
            "eind_datum": "2026-02-09",
            "rol": "tendermanager",
            "toegewezen_aan": {
                "id": "user-uuid-rick",
                "naam": "Rick van Dam",
                "initialen": "RI",
                "avatar_kleur": "#7c3aed"
            },
            "is_mijlpaal": true,
            "t_minus": 25,
            "volgorde": 10
        },
        {
            "naam": "Tekstschrijven",
            "datum": "2026-02-13",
            "eind_datum": "2026-02-19",
            "rol": "schrijver",
            "toegewezen_aan": {
                "id": "user-uuid-nathalie",
                "naam": "Nathalie Kuiper",
                "initialen": "NA",
                "avatar_kleur": "#22c55e"
            },
            "is_mijlpaal": false,
            "t_minus": 20,
            "volgorde": 40,
            "conflict": {
                "type": "workload",
                "bericht": "Nathalie heeft 3 andere taken op 13 feb",
                "severity": "warning"
            }
        }
        // ... meer taken
    ],
    "checklist_items": [
        // Zelfde structuur maar voor checklist
    ],
    "workload_warnings": [
        {
            "persoon": "Nathalie Kuiper",
            "week": "2026-W07",
            "taken_count": 6,
            "bericht": "Nathalie heeft 6 taken in week 7 (3 andere tenders)"
        }
    ],
    "metadata": {
        "eerste_taak": "2026-02-09",
        "laatste_taak": "2026-03-15",
        "doorlooptijd_werkdagen": 25,
        "doorlooptijd_kalenderdagen": 34,
        "feestdagen_overgeslagen": ["2026-04-03"]
    }
}
```

### 3.2 Back-Planning Service (Python)

```python
# Backend/app/services/backplanning_service.py

from datetime import date, timedelta
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class BackplanningService:
    """
    Genereert een back-planning op basis van:
    - Deadline (T-0)
    - Template met taken en T-minus werkdagen
    - Team toewijzingen (rol → persoon)
    - Feestdagen van het bureau
    """

    def __init__(self, supabase_client):
        self.db = supabase_client

    async def generate_backplanning(
        self,
        deadline: date,
        template_id: str,
        team_assignments: Dict[str, str],  # rol → user_id
        tenderbureau_id: str,
        tender_id: Optional[str] = None
    ) -> dict:
        """Hoofdfunctie: genereer complete back-planning."""

        # 1. Haal template taken op
        template_taken = await self._get_template_taken(template_id)

        # 2. Haal feestdagen op
        feestdagen = await self._get_feestdagen(tenderbureau_id, deadline.year)

        # 3. Haal team member details op
        team_details = await self._get_team_details(
            list(set(team_assignments.values()))
        )

        # 4. Bereken datums (back-planning)
        planning = []
        for taak in template_taken:
            taak_datum = self._bereken_werkdag(
                deadline, taak['t_minus_werkdagen'], feestdagen
            )
            eind_datum = taak_datum
            if taak['duur_werkdagen'] > 0:
                eind_datum = self._bereken_vooruit(
                    taak_datum, taak['duur_werkdagen'] - 1, feestdagen
                )

            # Koppel persoon aan taak via rol
            user_id = team_assignments.get(taak['rol'])
            persoon = team_details.get(user_id) if user_id else None

            planning.append({
                'naam': taak['naam'],
                'datum': taak_datum.isoformat(),
                'eind_datum': eind_datum.isoformat(),
                'rol': taak['rol'],
                'toegewezen_aan': persoon,
                'is_mijlpaal': taak.get('is_mijlpaal', False),
                't_minus': taak['t_minus_werkdagen'],
                'volgorde': taak.get('volgorde', 0)
            })

        # 5. Check workload conflicten
        workload_warnings = []
        if tender_id:
            workload_warnings = await self._check_workload(
                planning, tenderbureau_id, tender_id
            )
            # Voeg conflict info toe aan taken
            for taak in planning:
                if taak['toegewezen_aan']:
                    for warning in workload_warnings:
                        if (warning['persoon_id'] == taak['toegewezen_aan']['id']
                            and warning['datum'] == taak['datum']):
                            taak['conflict'] = {
                                'type': 'workload',
                                'bericht': warning['bericht'],
                                'severity': warning['severity']
                            }

        # 6. Metadata
        datums = [t['datum'] for t in planning]
        metadata = {
            'eerste_taak': min(datums) if datums else None,
            'laatste_taak': max(datums) if datums else None,
            'doorlooptijd_werkdagen': max(
                t['t_minus'] for t in template_taken
            ) if template_taken else 0,
            'doorlooptijd_kalenderdagen': (
                deadline - date.fromisoformat(min(datums))
            ).days if datums else 0
        }

        return {
            'planning_taken': planning,
            'workload_warnings': workload_warnings,
            'metadata': metadata
        }

    def _bereken_werkdag(
        self, deadline: date, t_minus: int, feestdagen: set
    ) -> date:
        """
        Bereken datum door T-minus werkdagen terug te tellen
        vanaf deadline, weekenden en feestdagen overslaand.
        """
        if t_minus == 0:
            return deadline

        current = deadline
        werkdagen_geteld = 0
        while werkdagen_geteld < t_minus:
            current -= timedelta(days=1)
            if current.weekday() < 5 and current not in feestdagen:
                werkdagen_geteld += 1
        return current

    def _bereken_vooruit(
        self, start: date, werkdagen: int, feestdagen: set
    ) -> date:
        """Bereken einddatum door werkdagen vooruit te tellen."""
        if werkdagen <= 0:
            return start

        current = start
        geteld = 0
        while geteld < werkdagen:
            current += timedelta(days=1)
            if current.weekday() < 5 and current not in feestdagen:
                geteld += 1
        return current

    async def _get_template_taken(self, template_id: str) -> list:
        """Haal alle taken op voor een template, gesorteerd op volgorde."""
        result = self.db.table('planning_template_taken') \
            .select('*') \
            .eq('template_id', template_id) \
            .order('volgorde') \
            .execute()
        return result.data or []

    async def _get_feestdagen(
        self, tenderbureau_id: str, jaar: int
    ) -> set:
        """Haal feestdagen op voor een bureau en jaar."""
        result = self.db.table('bureau_feestdagen') \
            .select('datum') \
            .eq('tenderbureau_id', tenderbureau_id) \
            .gte('datum', f'{jaar}-01-01') \
            .lte('datum', f'{jaar}-12-31') \
            .execute()
        return {
            date.fromisoformat(row['datum'])
            for row in (result.data or [])
        }

    async def _get_team_details(self, user_ids: list) -> dict:
        """Haal team member details op voor een lijst user IDs."""
        if not user_ids:
            return {}
        result = self.db.table('team_members') \
            .select('id, user_id, naam, initialen, avatar_kleur') \
            .in_('user_id', user_ids) \
            .execute()
        return {
            row['user_id']: {
                'id': row['user_id'],
                'naam': row['naam'],
                'initialen': row['initialen'],
                'avatar_kleur': row['avatar_kleur']
            }
            for row in (result.data or [])
        }

    async def _check_workload(
        self, planning: list, tenderbureau_id: str,
        exclude_tender_id: str
    ) -> list:
        """
        Check of teamleden workload-conflicten hebben
        door hun bestaande taken in de Agenda te vergelijken.
        """
        warnings = []
        # Groepeer taken per persoon + datum
        persoon_datums = {}
        for taak in planning:
            if taak['toegewezen_aan']:
                pid = taak['toegewezen_aan']['id']
                d = taak['datum']
                persoon_datums.setdefault(pid, []).append(d)

        for persoon_id, datums in persoon_datums.items():
            for datum in set(datums):
                # Tel bestaande taken voor deze persoon op deze datum
                result = self.db.table('planning_taken') \
                    .select('id', count='exact') \
                    .eq('toegewezen_aan', persoon_id) \
                    .eq('datum', datum) \
                    .neq('tender_id', exclude_tender_id) \
                    .execute()
                
                existing_count = result.count or 0
                if existing_count >= 3:
                    warnings.append({
                        'persoon_id': persoon_id,
                        'persoon': next(
                            t['toegewezen_aan']['naam']
                            for t in planning
                            if t.get('toegewezen_aan', {}).get('id') == persoon_id
                        ),
                        'datum': datum,
                        'severity': 'danger' if existing_count >= 5 else 'warning',
                        'bericht': f'Heeft al {existing_count} taken op {datum}'
                    })

        return warnings
```

### 3.3 AI Document Generatie Endpoint

```
POST /api/v1/smart-import/{import_id}/generate-documents
```

**Request:**
```json
{
    "tender_id": "tender-uuid",
    "documents": [
        "go_no_go",
        "samenvatting",
        "compliance_matrix",
        "nvi_vragen",
        "rode_draad",
        "pva_skelet"
    ],
    "team_assignments": {
        "tendermanager": "user-uuid-rick",
        "schrijver": "user-uuid-nathalie"
    },
    "model": "sonnet"
}
```

**Response:**
```json
{
    "documents": [
        {
            "type": "go_no_go",
            "titel": "Go/No-Go Analyse — Transportdiensten Stedin",
            "status": "concept",
            "preview": "Aanbeveling: GO met kanttekeningen...",
            "id": "doc-uuid-1"
        },
        {
            "type": "samenvatting",
            "titel": "Samenvatting Aanbesteding — Transportdiensten",
            "status": "concept",
            "preview": "Stedin zoekt een partij voor...",
            "id": "doc-uuid-2"
        }
    ]
}
```

### 3.4 Template CRUD Endpoints

```
GET    /api/v1/planning-templates                    → Alle templates voor bureau
GET    /api/v1/planning-templates/{id}               → Template met taken
POST   /api/v1/planning-templates                    → Nieuw template
PUT    /api/v1/planning-templates/{id}               → Update template
DELETE /api/v1/planning-templates/{id}               → Verwijder template
POST   /api/v1/planning-templates/{id}/duplicate     → Kopieer template
```

### 3.5 Workload Query Endpoint

```
GET /api/v1/team/workload?user_ids=uuid1,uuid2&start=2026-02-01&end=2026-03-31
```

**Response:**
```json
{
    "workload": {
        "user-uuid-rick": {
            "naam": "Rick van Dam",
            "weken": {
                "2026-W07": { "taken": 4, "tenders": ["Tender A", "Tender B"] },
                "2026-W08": { "taken": 2, "tenders": ["Tender A"] }
            }
        }
    }
}
```

---

## 4. FRONTEND — NIEUWE STAPPEN

### 4.1 Stap 4: TeamStep.js

De kern van de nieuwe flow. Toont alle benodigde rollen en laat de gebruiker per rol een teamlid selecteren.

```javascript
// Frontend/js/components/smart-import/TeamStep.js

export class TeamStep {
    constructor(wizardState) {
        this.state = wizardState;        // Gedeelde wizard state
        this.teamMembers = [];           // Beschikbare teamleden
        this.assignments = {};           // rol → user_id
        this.requiredRoles = [];         // Rollen die nodig zijn
        this.workloadData = null;        // Workload per persoon
    }

    async init() {
        // 1. Haal teamleden op van dit bureau
        this.teamMembers = await this._fetchTeamMembers();

        // 2. Bepaal benodigde rollen op basis van template
        this.requiredRoles = await this._getRequiredRoles();

        // 3. Haal workload data op voor de deadline-periode
        if (this.state.extractedData?.planning?.deadline_indiening?.value) {
            this.workloadData = await this._fetchWorkload();
        }

        // 4. Auto-suggest: vul standaard rollen in
        this._autoAssign();
    }

    render() {
        return `
            <div class="team-step">
                <div class="team-header">
                    <h3>👥 Team samenstellen</h3>
                    <p>Wijs teamleden toe aan de rollen voor deze tender</p>
                </div>

                <div class="team-roles-grid">
                    ${this.requiredRoles.map(role => this._renderRoleRow(role)).join('')}
                </div>

                ${this._renderWorkloadWarnings()}

                <div class="team-template-info">
                    <span>📋 Template: <strong>${this.state.selectedTemplate?.naam || 'Standaard'}</strong></span>
                    <button class="btn-link" id="changeTemplateBtn">Wijzig template</button>
                </div>
            </div>
        `;
    }

    _renderRoleRow(role) {
        const assignedUserId = this.assignments[role.key];
        const members = this._getMembersForRole(role.key);
        const workload = this._getWorkloadForUser(assignedUserId);

        return `
            <div class="team-role-row ${role.required ? '' : 'optional'}">
                <div class="role-info">
                    <span class="role-icon">${role.icon}</span>
                    <div>
                        <span class="role-naam">${role.label}</span>
                        ${!role.required ? '<span class="role-optional">Optioneel</span>' : ''}
                        <span class="role-taken-count">${role.takenCount} taken</span>
                    </div>
                </div>

                <div class="role-selector">
                    <select class="team-select" data-role="${role.key}">
                        <option value="">— Selecteer —</option>
                        ${role.required ? '' : '<option value="__skip">Niet nodig</option>'}
                        ${members.map(m => `
                            <option value="${m.user_id}" ${m.user_id === assignedUserId ? 'selected' : ''}>
                                ${m.naam} (${m.initialen})
                            </option>
                        `).join('')}
                    </select>

                    ${assignedUserId && workload ? `
                        <div class="workload-indicator ${workload.level}">
                            ${workload.icon} ${workload.label}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    _renderWorkloadWarnings() {
        // Toon waarschuwingen als teamleden overbelast zijn
        const warnings = this._calculateWarnings();
        if (warnings.length === 0) return '';

        return `
            <div class="team-warnings">
                ${warnings.map(w => `
                    <div class="team-warning ${w.severity}">
                        ⚠️ <strong>${w.persoon}</strong>: ${w.bericht}
                    </div>
                `).join('')}
            </div>
        `;
    }

    getData() {
        return {
            team_assignments: { ...this.assignments },
            template_id: this.state.selectedTemplate?.id
        };
    }
}
```

**Rolconfiguratie:**

```javascript
const TENDER_ROLLEN = [
    { key: 'tendermanager',  label: 'Tendermanager',   icon: '👔', required: true  },
    { key: 'schrijver',      label: 'Tekstschrijver',  icon: '✍️', required: true  },
    { key: 'calculator',     label: 'Calculator',      icon: '🔢', required: false },
    { key: 'reviewer',       label: 'Reviewer',        icon: '👁️', required: false },
    { key: 'designer',       label: 'Vormgever',       icon: '🎨', required: false },
    { key: 'sales',          label: 'Sales / Klant',   icon: '🤝', required: false },
    { key: 'coordinator',    label: 'Coördinator',     icon: '📋', required: false },
    { key: 'klant_contact',  label: 'Klant Contact',   icon: '📞', required: false }
];
```

### 4.2 Stap 5: ResultStep.js

Preview van alle gegenereerde output. De gebruiker kan per onderdeel accepteren, aanpassen of overslaan.

```javascript
// Frontend/js/components/smart-import/ResultStep.js

export class ResultStep {
    constructor(wizardState) {
        this.state = wizardState;
        this.backplanning = null;
        this.checklist = null;
        this.documents = [];
        this.acceptedItems = new Set();
        this.isGenerating = false;
    }

    async init() {
        this.isGenerating = true;

        // Parallel genereren:
        const [backplanningResult, documentsResult] = await Promise.all([
            this._generateBackplanning(),
            this._generateDocuments()
        ]);

        this.backplanning = backplanningResult.planning_taken;
        this.checklist = backplanningResult.checklist_items;
        this.documents = documentsResult.documents;
        this.isGenerating = false;

        // Alles standaard geaccepteerd
        this.acceptedItems = new Set([
            'planning', 'checklist',
            ...this.documents.map(d => d.type)
        ]);
    }

    render() {
        if (this.isGenerating) {
            return this._renderGenerating();
        }

        return `
            <div class="result-step">
                <div class="result-header">
                    <h3>✅ Alles is klaar</h3>
                    <p>Review de gegenereerde planning, checklist en documenten</p>
                </div>

                <!-- Back-planning preview -->
                <div class="result-section">
                    <div class="result-section-header">
                        <label class="result-toggle">
                            <input type="checkbox" data-item="planning"
                                ${this.acceptedItems.has('planning') ? 'checked' : ''}>
                            📅 Projectplanning
                            <span class="result-count">${this.backplanning?.length || 0} taken</span>
                        </label>
                        <button class="btn-expand" data-section="planning">▼</button>
                    </div>
                    <div class="result-section-body" id="section-planning">
                        ${this._renderPlanningPreview()}
                    </div>
                </div>

                <!-- Checklist preview -->
                <div class="result-section">
                    <div class="result-section-header">
                        <label class="result-toggle">
                            <input type="checkbox" data-item="checklist"
                                ${this.acceptedItems.has('checklist') ? 'checked' : ''}>
                            📋 Indieningschecklist
                            <span class="result-count">${this.checklist?.length || 0} items</span>
                        </label>
                        <button class="btn-expand" data-section="checklist">▼</button>
                    </div>
                    <div class="result-section-body" id="section-checklist">
                        ${this._renderChecklistPreview()}
                    </div>
                </div>

                <!-- AI Documenten -->
                ${this.documents.map(doc => `
                    <div class="result-section">
                        <div class="result-section-header">
                            <label class="result-toggle">
                                <input type="checkbox" data-item="${doc.type}"
                                    ${this.acceptedItems.has(doc.type) ? 'checked' : ''}>
                                ${this._getDocIcon(doc.type)} ${doc.titel}
                            </label>
                            <button class="btn-expand" data-section="${doc.type}">▼</button>
                        </div>
                        <div class="result-section-body" id="section-${doc.type}">
                            <div class="doc-preview">${doc.preview}</div>
                        </div>
                    </div>
                `).join('')}

                <!-- Workload warnings -->
                ${this._renderWorkloadWarnings()}

                <!-- Samenvatting -->
                <div class="result-summary">
                    <strong>${this.acceptedItems.size}</strong> van
                    <strong>${2 + this.documents.length}</strong> onderdelen geselecteerd
                </div>
            </div>
        `;
    }

    _renderPlanningPreview() {
        if (!this.backplanning?.length) return '<p class="no-data">Geen taken</p>';

        return `
            <div class="planning-preview-list">
                ${this.backplanning.map(taak => `
                    <div class="planning-preview-item ${taak.is_mijlpaal ? 'mijlpaal' : ''} ${taak.conflict ? 'has-conflict' : ''}">
                        <span class="pp-datum">${this._formatDatum(taak.datum)}</span>
                        <span class="pp-naam">${taak.naam}</span>
                        <span class="pp-persoon">
                            ${taak.toegewezen_aan ? `
                                <span class="pp-avatar" style="background:${taak.toegewezen_aan.avatar_kleur}">
                                    ${taak.toegewezen_aan.initialen}
                                </span>
                                ${taak.toegewezen_aan.naam}
                            ` : '<em>Niet toegewezen</em>'}
                        </span>
                        ${taak.conflict ? `
                            <span class="pp-conflict" title="${taak.conflict.bericht}">⚠️</span>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    getData() {
        return {
            accepted: [...this.acceptedItems],
            planning: this.acceptedItems.has('planning') ? this.backplanning : null,
            checklist: this.acceptedItems.has('checklist') ? this.checklist : null,
            documents: this.documents.filter(d => this.acceptedItems.has(d.type))
        };
    }
}
```

---

## 5. WIZARD ORCHESTRATOR — NIEUWE FLOW

### 5.1 SmartImportWizard.js (v4.0 — dunne orchestrator)

```javascript
// Frontend/js/components/SmartImportWizard.js v4.0

import { UploadStep } from './smart-import/UploadStep.js';
import { AnalyzeStep } from './smart-import/AnalyzeStep.js';
import { ReviewStep } from './smart-import/ReviewStep.js';
import { TeamStep } from './smart-import/TeamStep.js';
import { ResultStep } from './smart-import/ResultStep.js';
import { SmartImportStyles } from './smart-import/SmartImportStyles.js';

export class SmartImportWizard {
    constructor(options = {}) {
        this.options = options;
        this.onComplete = options.onComplete || (() => {});
        this.onCancel = options.onCancel || (() => {});

        // Shared state — alle stappen lezen/schrijven hierin
        this.state = {
            currentStep: 1,
            tenderId: options.tenderId || null,
            tenderNaam: options.tenderNaam || null,
            uploadedFiles: [],
            importId: null,
            extractedData: null,
            editedData: {},
            teamAssignments: {},
            selectedTemplate: null,
            backplanning: null,
            generatedDocs: [],
            authToken: '',
            baseURL: window.API_CONFIG?.baseURL || 'http://localhost:3000/api/v1'
        };

        // Stap instances
        this.steps = {
            1: new UploadStep(this.state),
            2: new AnalyzeStep(this.state),
            3: new ReviewStep(this.state),
            4: new TeamStep(this.state),
            5: new ResultStep(this.state)
        };

        this.stepLabels = [
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Analyse' },
            { num: 3, label: 'Controleer' },
            { num: 4, label: 'Team' },
            { num: 5, label: 'Resultaat' }
        ];

        this.backdrop = null;
        SmartImportStyles.inject();
    }

    // --- Publieke methodes (ongewijzigd) ---
    open() { /* ... */ }
    close() { /* ... */ }
    openAsModal(tenderId, tenderNaam) { /* ... */ }

    // --- Navigatie ---
    async goToStep(stepNum) {
        const step = this.steps[stepNum];
        if (step.init) await step.init();
        this.state.currentStep = stepNum;
        this._renderStep();
    }

    async nextStep() {
        const current = this.steps[this.state.currentStep];
        // Valideer huidige stap
        if (current.validate && !current.validate()) return;
        // Verzamel data van huidige stap
        if (current.getData) {
            Object.assign(this.state, current.getData());
        }
        await this.goToStep(this.state.currentStep + 1);
    }

    prevStep() {
        if (this.state.currentStep > 1) {
            this.goToStep(this.state.currentStep - 1);
        }
    }

    // --- Render ---
    _renderStep() {
        const step = this.steps[this.state.currentStep];
        const content = this.backdrop?.querySelector('.wizard-content');
        if (content) {
            content.innerHTML = step.render();
            if (step.attachListeners) step.attachListeners(content);
        }
        this._renderFooter();
        this._renderStepIndicators();
    }

    // --- Laatste stap: alles opslaan ---
    async _finalize() {
        const resultData = this.steps[5].getData();

        // 1. Tender aanmaken (of updaten als bestaande tender)
        // 2. Planning taken opslaan
        // 3. Checklist items opslaan
        // 4. Team assignments opslaan
        // 5. AI documenten opslaan
        // 6. Callback
        this.onComplete(/* result */);
        this.close();
    }
}
```

---

## 6. AI DOCUMENT GENERATIE — PROMPTS

### 6.1 Go/No-Go Analyse

```python
PROMPT_GO_NO_GO = """
Analyseer het volgende aanbestedingsdocument en maak een Go/No-Go analyse.

DOCUMENT:
{document_text}

BUREAU PROFIEL:
- Sectoren: {bureau_sectoren}
- Certificeringen: {bureau_certificeringen}
- Omvang projecten: {bureau_project_range}

TEAM:
{team_info}

Geef een gestructureerde analyse in JSON:
{
    "aanbeveling": "GO" | "NO-GO" | "GO_MET_KANTTEKENINGEN",
    "score": 0-100,
    "samenvatting": "...",
    "sterke_punten": ["..."],
    "risicos": ["..."],
    "aandachtspunten": ["..."],
    "geschatte_winkans": "laag" | "gemiddeld" | "hoog",
    "argumenten_go": ["..."],
    "argumenten_no_go": ["..."]
}
"""
```

### 6.2 Samenvatting voor Team

```python
PROMPT_SAMENVATTING = """
Maak een beknopte samenvatting (max 500 woorden) van deze aanbesteding,
geschikt om naar het projectteam te sturen.

DOCUMENT:
{document_text}

TENDER INFO:
- Naam: {tender_naam}
- Opdrachtgever: {opdrachtgever}
- Deadline: {deadline}
- Geraamde waarde: {waarde}

TEAM:
{team_info}

Structuur:
1. Wat wordt er gevraagd (2-3 zinnen)
2. Kernpunten en eisen (bullet points)
3. Planning en belangrijke data
4. Bijzonderheden / aandachtspunten
5. Rolverdeling (wie doet wat)

Schrijf in het Nederlands, zakelijk maar helder.
"""
```

### 6.3 Compliance Matrix

```python
PROMPT_COMPLIANCE = """
Analyseer het aanbestedingsdocument en maak een volledige compliance matrix.

DOCUMENT:
{document_text}

Geef een JSON array met alle eisen:
[
    {
        "categorie": "Geschiktheidseisen" | "Uitsluitingsgronden" | "Gunningscriteria" | "Contracteisen",
        "eis_nummer": "3.2.1",
        "beschrijving": "...",
        "type": "knock-out" | "gunning" | "wens",
        "bewijsstuk": "...",
        "gewicht_percentage": null | 30,
        "status": "te_beoordelen"
    }
]
"""
```

---

## 7. IMPLEMENTATIE-VOLGORDE

### Fase A: Foundation (1-2 dagen)

| # | Taak | Type |
|---|------|------|
| A1 | Database migratie: `planning_templates` + `planning_template_taken` | SQL |
| A2 | Database migratie: `ai_generated_documents` | SQL |
| A3 | Database migratie: `bureau_feestdagen` | SQL |
| A4 | Seed data: standaard planning + checklist templates | SQL |
| A5 | Seed data: feestdagen 2026 | SQL |
| A6 | Component split: bestaande wizard → 5 bestanden | Frontend |

### Fase B: Back-Planning Engine (2-3 dagen)

| # | Taak | Type |
|---|------|------|
| B1 | `BackplanningService` Python class | Backend |
| B2 | Endpoint `POST /planning/generate-backplanning` | Backend |
| B3 | Endpoint `GET /team/workload` | Backend |
| B4 | Template CRUD endpoints | Backend |
| B5 | Unit tests back-planning logica | Backend |

### Fase C: TeamStep (1-2 dagen)

| # | Taak | Type |
|---|------|------|
| C1 | `TeamStep.js` component | Frontend |
| C2 | Team member dropdown met workload indicators | Frontend |
| C3 | Auto-assign logica | Frontend |
| C4 | Template selector | Frontend |
| C5 | CSS voor TeamStep | Frontend |

### Fase D: ResultStep (2-3 dagen)

| # | Taak | Type |
|---|------|------|
| D1 | `ResultStep.js` component | Frontend |
| D2 | Back-planning preview rendering | Frontend |
| D3 | Checklist preview rendering | Frontend |
| D4 | Document preview cards | Frontend |
| D5 | Accept/reject per onderdeel | Frontend |
| D6 | CSS voor ResultStep | Frontend |

### Fase E: AI Document Generatie (2-3 dagen)

| # | Taak | Type |
|---|------|------|
| E1 | AI prompts voor elk documenttype | Backend |
| E2 | Endpoint `POST /smart-import/{id}/generate-documents` | Backend |
| E3 | Document opslag in `ai_generated_documents` | Backend |
| E4 | Document viewer component (later: in tender detail) | Frontend |

### Fase F: Integratie & Polish (1-2 dagen)

| # | Taak | Type |
|---|------|------|
| F1 | Wizard orchestrator v4.0 met 5-stap flow | Frontend |
| F2 | Finalize functie: alles opslaan in 1 transactie | Backend |
| F3 | Error handling en edge cases | Full stack |
| F4 | Template beheer pagina (admin) | Frontend |

**Totaal geschatte doorlooptijd: 10-15 werkdagen**

---

## 8. RISICO'S EN AANDACHTSPUNTEN

### 8.1 AI kosten

Elk van de 6 documenten vereist een aparte AI-call. Met Sonnet (Pro) model kan dit oplopen. Advies: genereer Go/No-Go en Samenvatting standaard, de rest optioneel met checkboxes zodat de gebruiker kiest.

### 8.2 Template flexibiliteit

Bureaus werken allemaal anders. De templates moeten eenvoudig aanpasbaar zijn via een admin-interface. Begin met seed data maar bouw snel een Template Editor.

### 8.3 Workload berekening

De workload-check is alleen betrouwbaar als bestaande tenders ook planning-taken met datums en toewijzingen hebben. Nieuwe installaties hebben die data nog niet — toon dan geen workload-warnings.

### 8.4 Feestdagen

De back-planning slaat weekenden en feestdagen over. Zorg dat feestdagen per bureau configureerbaar zijn (niet iedereen heeft dezelfde vrije dagen). Bied een "importeer standaard NL feestdagen" knop.

### 8.5 Component-split migratie

De huidige wizard (v3.7) moet in één keer vervangen worden door de gesplitste versie. Plan dit als atomic deployment — niet stapsgewijs migreren.

---

## 9. TOEKOMSTIGE UITBREIDINGEN

- **Referentie-suggesties** — koppel aan projectendatabase
- **Template leren** — AI past templates aan op basis van feedback
- **Workload balancing** — automatisch herverdelen bij overbelasting
- **Gantt preview** — visuele tijdlijn in ResultStep
- **Team capaciteit** — rekening houden met parttime medewerkers
- **Herhalende templates** — vaste patronen voor specifieke opdrachtgevers
