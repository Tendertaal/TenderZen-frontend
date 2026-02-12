# Handover: Tender Command Center — Klaar voor Implementatie
**Datum:** 10 februari 2026, 11:00
**Status:** UX Design afgerond, klaar voor code-implementatie

---

## 1. Wat is het Tender Command Center (TCC)?

Het TCC is een **modal/popup** die opent wanneer een gebruiker op een tender klikt (vanuit ListView, KanbanView, of PlanningView). Het toont alle AI-analyse resultaten, planning, checklist, documenten en workflow voor die specifieke tender in één overzichtelijk paneel.

**Vergelijk het met:** Een "detail view" modal die alle tender-informatie centraal bundelt.

---

## 2. Finale Structuur: 5 Tabs

### Tab 1: 🤖 AI Analyse (met sub-toggle)
**Sub-navigatie via segmented control:**

#### Sub A: 📊 Analyse Resultaten (14/20)
- **Score bar:** Ring chart (70%), velden teller (14/20), confidence badges (13 hoog, 1 gemiddeld)
- **Collapsible secties:**
  1. Basisgegevens (8/9) — 2-kolom grid met velden + confidence dots
  2. Planning & Deadlines (8/12) — Verticale timeline met status dots
  3. Overeenkomst & Contract (5/7) — 2-kolom grid
  4. Gunningscriteria (3) — Tabel met weighted progress bars
  5. Percelen (2) — Expandable kaarten met bedrag
  6. AI Opmerkingen (5) — Gekleurde waarschuwingen/tips

#### Sub B: ⚡ AI Generatie (1/4)
- **2x2 grid met document-kaarten:**
  1. Go/No-Go Analyse — Score 72, GO verdict, sterke punten + risico's
  2. Samenvatting — Nog niet gegenereerd, "Genereer" button
  3. Compliance Matrix — Nog niet gegenereerd
  4. Risico Analyse — Bezig met genereren (spinner)
- **Elke kaart heeft:** Icon, titel, beschrijving, status, actie-buttons

### Tab 2: 📅 Planning
- Header met statistieken (14 dagen rest, 4/12 taken klaar)
- Taken gegroepeerd per fase (Voorbereiding → Schrijffase → Indiening)
- Fase-labels als gekleurde headers
- Per taak: status checkbox, naam, avatar, persoon, datum
- Urgente deadlines in rood

### Tab 3: ✅ Checklist
- Progress bar met percentage (38%)
- Items gegroepeerd: Documenten (2/4), Verklaringen (1/3)
- Per item: checkbox, naam, beschrijving, upload-actie
- Done items: doorgestreept met groene checkbox

### Tab 4: 📎 Documenten
- **Sectie 1 — Aanbestedingsstukken:**
  - Drag & drop upload zone
  - Tip-balk
  - Bestandenlijst met tags (✓ Geanalyseerd, 📎 Bronbestand)
  - Per bestand: bekijken, downloaden, verwijderen
- **Sectie 2 — Gegenereerde Documenten** (na visuele divider):
  - AI-gegenereerde bestanden met herkomst-tags (⚡ AI Generatie, 🔄 Workflow stap X)
  - Doorverwijzing naar AI Generatie en Workflow tabs

### Tab 5: 🔄 Workflow (7 stappen: 0-6)
- **Progress bar:** Horizontale stap-indicator (done/active/pending)
- **Stap-kaarten met 3 states:**
  - **Done** (groen): Collapsed, resultaat-preview, "Bekijk" / "Opnieuw"
  - **Active** (paars): Expanded, prompt-card, how-to instructies, 3 actie-buttons
  - **Pending** (grijs): Collapsed, dimmed
- **Workflow stappen:**
  0. Tenderplanning — Deadlines extraheren
  1. Inlever Checklist — Verplichte documenten
  2. Tender Samenvatting — Overzicht voor team
  3. Tenderofferte — Professionele offerte
  4. Rode Draad Sessie — Kick-off document
  5. Versie 1 Concept — Eerste concept
  6. Check op Win Succes — Win-analyse

---

## 3. Design System / Styling

### Icons
- **Alle iconen zijn SVG** uit de `icons.js` library (project file)
- **Geen emoji's** — alleen SVG iconen met correcte kleurlogica
- Iconen worden gerenderd via `data-icon` attributen en een inline icon library in de HTML
- **Kleurlogica:** Zie `ICONEN_KLEURLOGICA.md` (project file)

### Belangrijkste icon-mappings:
| Element | Icon | Kleur |
|---------|------|-------|
| AI tab | `sparkles` | Purple (#9333ea) |
| Planning tab | `calendar` | Blue (#2563eb) |
| Checklist tab | `checkSquare` | Green (#16a34a) |
| Documenten tab | `fileText` | Indigo (#4f46e5) |
| Workflow tab | `refresh` | Blue (#2563eb) |
| Close button | `close` | Red (#dc2626) |
| Save/Opslaan | `save` | Green (#16a34a) |
| Copy | `copy` | Blue (#2563eb) |
| Delete/Trash | `trash` | Red (#dc2626) |
| Warning | `warning` | Orange (#ea580c) |
| Tip/Lightbulb | `lightbulb` | Amber (#d97706) |
| AI Prompt | `robot` | White op purple bg |
| External link | `externalLink` | Blue (#2563eb) |

### CSS Architecture
- Alle classes prefixed met `tcc-` (Tender Command Center)
- BEM-achtige naming: `tcc-section-header`, `tcc-wf-step--active`
- States via `is-open`, `is-active`, `is-dragover`
- Responsive: grid collapse op <700px

### Key CSS patterns:
```
.tcc-overlay          — Full-screen backdrop
.tcc-panel            — Modal container (max-width: 1060px, 92vh)
.tcc-header           — Fixed header met tabs
.tcc-body             — Scrollable content area
.tcc-footer           — Fixed footer met context-afhankelijke buttons
.tcc-tab / .tcc-tab.is-active
.tcc-subnav / .tcc-subnav-btn.is-active
.tcc-section / .tcc-section.is-open
.tcc-wf-step--done / --active / --pending
```

### Footer gedrag:
De footer past zich aan per tab:
- **AI Analyse:** "Extra document" | "Sluiten" + "Gegevens bewerken"
- **AI Generatie (sub):** "Alles genereren" | "Sluiten" + "Alles downloaden"
- **Planning:** "Template" + "Taak" | "Sluiten" + "Opslaan"
- **Checklist:** "+ Item" | "Sluiten" + "Opslaan"
- **Documenten:** "Document uploaden" | "Sluiten" + "Alles downloaden"
- **Workflow:** "Alle prompts" | "Sluiten" + "Volgende stap"

---

## 4. Prototype Bestanden

| Versie | Bestand | Beschrijving |
|--------|---------|-------------|
| v4 | `TenderCommandCenter_v4_20260210_1000.html` | 5-tab versie (oude emoji's, AI Analyse + AI Documenten apart) |
| v5 | `TenderCommandCenter_v5_20260210_1015.html` | 6-tab versie met Documenten tab |
| v6 | `TenderCommandCenter_v6_20260210_1030.html` | 5-tab met gecombineerde AI tab (emoji's) |
| **v7** | **`TenderCommandCenter_v7_20260210_1045.html`** | **✅ FINALE — 5-tab met SVG iconen** |

---

## 5. Data Model / API Endpoints (nog te bouwen)

### TCC openen:
```
GET /api/tenders/{tender_id}/command-center
```
Retourneert alle data voor het TCC in één call:
- Analyse resultaten (velden, confidence scores)
- Planning taken
- Checklist items
- Documenten (uploaded + generated)
- Workflow stappen (status, resultaten)

### Specifieke endpoints:
```
POST /api/tenders/{id}/documents/upload        — Upload aanbestedingsstuk
GET  /api/tenders/{id}/documents               — Lijst alle documenten
POST /api/tenders/{id}/ai/generate/{type}      — Genereer AI document (gonogo/samenvatting/compliance/risico)
GET  /api/tenders/{id}/workflow/steps           — Workflow stappen + statussen
POST /api/tenders/{id}/workflow/{step}/save     — Sla workflow resultaat op
GET  /api/tenders/{id}/workflow/{step}/prompt   — Haal prompt op (met auto-filled data)
PUT  /api/tenders/{id}/planning/tasks           — Update planning taken
PUT  /api/tenders/{id}/checklist/items          — Update checklist items
```

---

## 6. Integratie met bestaande views

Het TCC wordt geopend vanuit:
1. **ListView** — Klik op tender rij
2. **KanbanView** — Klik op tender kaart
3. **PlanningView** — Klik op tender item

**Trigger:** `openCommandCenter(tenderId)` functie die:
1. Data ophaalt via API
2. Modal rendert met alle tabs
3. Huidige view blijft zichtbaar op achtergrond (overlay)

---

## 7. Technologie Stack (reminder)

- **Frontend:** Vanilla JavaScript ES6, geen build process
- **Backend:** Python FastAPI + Supabase PostgreSQL
- **Icons:** `icons.js` library (SVG, Lucide-stijl)
- **AI:** Claude API voor document analyse
- **Componenten:** Modulair (TenderCardHeader, TenderCardBody, etc.)

---

## 8. Volgende Stappen

### Prioriteit 1: Component Architecture
- [ ] `TenderCommandCenter.js` — Hoofd component
- [ ] `TenderCommandCenter.css` — Alle styling (uit prototype)
- [ ] Sub-componenten per tab overwegen

### Prioriteit 2: API & Data
- [ ] Backend endpoints bouwen
- [ ] Database tabellen voor workflow stappen
- [ ] Document upload/storage via Supabase

### Prioriteit 3: Integratie
- [ ] Aansluiten op bestaande views (ListView, Kanban, Planning)
- [ ] AI analyse resultaten laden uit SmartImport data
- [ ] Workflow prompts systeem

### Prioriteit 4: Interactiviteit
- [ ] Drag & drop file upload
- [ ] Inline editing van analyse velden
- [ ] Real-time generatie status updates
- [ ] Copy-to-clipboard voor prompts

---

## 9. Ontwerpbeslissingen (vastgelegd)

| Vraag | Besluit | Reden |
|-------|---------|-------|
| Aantal tabs? | 5 tabs | 6 was te veel, AI Analyse + Generatie gecombineerd |
| Hoe AI combineren? | Sub-toggle (segmented control) | Analyse en Generatie zijn beide "AI output" |
| Documenten aanpak? | 1 tab met 2 secties | Upload + gegenereerd samen, met visuele divider |
| Emoji vs SVG? | SVG iconen (icons.js) | Professioneel, consistent, past bij bestaand design system |
| Tab badge wat tonen? | Score/count per tab | 14/20, 12, 3/8, 5, 2/6 |

---

## 10. Referentie Bestanden in Project

| Bestand | Relevant voor |
|---------|--------------|
| `icons.js` | Icon library — alle beschikbare iconen |
| `ICONEN_KLEURLOGICA.md` | Kleur regels per icon type |
| `TenderPlanner_Technical_Spec_v2.md` | Algemene technische specificatie |
| `KanbanView_20260208_1830.js` | Kanban view (TCC trigger) |
| `SmartImport*.md` | Smart Import workflow (data bron voor AI tab) |
| `FaseTransitieRules_*.js` | Business rules (relevant voor workflow) |
