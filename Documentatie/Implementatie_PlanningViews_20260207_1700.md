# TenderZen — Planning Views Redesign: Implementatiegids

**Datum:** 2026-02-07
**Status:** Klaar voor implementatie
**Mockup:** `Planning_AllViews_20260207_1640.html` (project knowledge)

---

## 1. SAMENVATTING

De AgendaView wordt uitgebreid van een enkele maand-Gantt naar vier schakelbare tijdlijn-weergaven: **Week**, **Maand**, **Kwartaal** en **Jaar**. Alle views delen dezelfde design-patronen:

- **Losse kaarten** (niet meer één groot grid) met 10px tussenruimte
- **Sticky header** met 3 lagen: Jaar → Sub-labels → Heatmap drukte-indicator
- **Fase-kleur balk** per tender card met geïntegreerde tijdlijn-headers
- **Sidebar** (240px) met tender-info links, tijdlijn rechts
- Consistente visuele taal: Gantt-balken, vandaag-lijn, deadline-vlaggetjes, taak-indicatoren

---

## 2. BESTAANDE BESTANDEN

### Bestanden die worden AANGEPAST:

| Bestand | Locatie | Wijziging |
|---------|---------|-----------|
| `AgendaView.js` | `js/views/` | Volledige herschrijving render-logica, view-switching toevoegen |
| `AgendaView.css` | `css/` | Volledige herschrijving naar nieuw card-gebaseerd design |
| `PlanningService.js` | `js/services/` | Eventueel uitbreiden voor deadline/publicatiedatum ophalen |

### Bestanden die NIET wijzigen (maar wel worden hergebruikt):

| Bestand | Wat het levert |
|---------|---------------|
| `TenderCardHeader.js` | Fase badge, status, actie-knoppen (size: 'compact') |
| `TenderCardBody.js` | Naam, AI badge, info lines (size: 'compact') |
| `TenderCardFooter.js` | Team avatars, planning/checklist counts (size: 'compact') |
| `PlanningService.js` | `getAllCounts()`, taken per tender ophalen |
| `TenderService.js` | Tender data inclusief deadlines |
| `FaseTransitieRules.js` | FASE_META kleuren |
| `icons.js` | SVG icon library |

### Nieuw aan te maken bestanden:

| Bestand | Doel |
|---------|------|
| `js/components/TimelineCell.js` | Bestaat al — hergebruiken/uitbreiden voor nieuwe views |
| `js/components/TimelineSection.js` | Bestaat al — hergebruiken/uitbreiden |
| `css/AgendaView.css` | Nieuwe stylesheet (vervangt huidige) |

---

## 3. ARCHITECTUUR

### 3.1 View-switching

De AgendaView krijgt een `currentView` state die schakelt tussen 4 render-functies:

```javascript
// In AgendaView.js
class AgendaView extends BaseView {
    constructor() {
        super();
        this.currentView = 'month'; // week | month | quarter | year
        this.offset = 0;            // navigatie-offset t.o.v. vandaag
    }

    render() {
        this.renderAgendaHeader();
        this.renderFilterBar();
        this.renderStickyHeader();
        this.renderTenderCards();
        this.renderLegend();
        this.renderOngepland();
    }

    switchView(view) {
        this.currentView = view;
        this.offset = 0;
        this.render();
    }
}
```

### 3.2 Card-structuur (alle views)

Elke tender is een **losse kaart** met deze structuur:

```
┌─────────────────────────────────────────────────────────┐
│ FASE-KLEUR BALK (gradient)                              │
│ ┌─────────────┬─────────────────────────────────────┐   │
│ │ Fase-pill    │ Tijdlijn-headers (W6, W7... of      │   │
│ │ AI badge     │ Jan, Feb... afhankelijk van view)    │   │
│ │ Iconen       │ Huidige periode = highlighted        │   │
│ └─────────────┴─────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ BODY                                                     │
│ ┌─────────────┬─────────────────────────────────────┐   │
│ │ SIDEBAR     │ TIJDLIJN                             │   │
│ │ 240px       │ Gantt-balk, dots/pills, deadline,    │   │
│ │             │ vandaag-lijn                          │   │
│ │ Tender naam │                                       │   │
│ │ Organisatie │                                       │   │
│ │ Deadline    │                                       │   │
│ │ Avatars     │                                       │   │
│ │ Voortgang   │                                       │   │
│ └─────────────┴─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Sidebar — hergebruik TenderCard componenten

De sidebar **hergebruikt** de bestaande TenderCard componenten in `compact` formaat:

```javascript
import { TenderCardHeader } from '../components/TenderCardHeader.js';
import { TenderCardBody } from '../components/TenderCardBody.js';
import { TenderCardFooter } from '../components/TenderCardFooter.js';

// Of: een vereenvoudigde inline sidebar die dezelfde info toont
// Keuze afhankelijk van performance-eisen (veel kaarten tegelijk)
```

**Sidebar bevat:**
- Tender naam (max 2 regels, ellipsis)
- Organisatie (met 🏢 icoon)
- Deadline badge (kleurcode: ok/warn/danger/verlopen)
- Team avatars
- Voortgang of planning/checklist tellingen

---

## 4. STICKY HEADER — 3 LAGEN

### Structuur (alle views):

```
┌──────────┬──────────────────────────────────────────┐
│          │              JAAR (2026)                   │ ← Laag 1: Jaar
│ TENDERS  ├──────────────────────────────────────────┤
│          │   Q1  ·  Q2  ·  Q3  ·  Q4                │ ← Laag 2: Sub-labels
│          ├──────────────────────────────────────────┤
│          │  ▓▓░░▓▓▓▓░░░░▓▓▓░░░░░░░░░░░░            │ ← Laag 3: Heatmap
└──────────┴──────────────────────────────────────────┘
```

### Per view:

| View | Laag 1 | Laag 2 | Heatmap cellen |
|------|--------|--------|----------------|
| **Week** | 2026 | "Week 6 · Februari" | 7 (per dag) |
| **Maand** | 2026 | "Februari" | 4-5 (per week) |
| **Kwartaal** | 2026 | "Q1 · Januari – Maart" | 3 (per maand) |
| **Jaar** | 2026 | "Q1 · Q2 · Q3 · Q4" | 12 (per maand) |

### Heatmap berekening:

```javascript
function calculateHeatmap(startDate, endDate) {
    let tasks = 0, deadlines = 0;
    tenders.forEach(t => {
        // Tel taken in deze periode
        t.planning_taken.forEach(taak => {
            if (taak.datum >= startDate && taak.datum <= endDate) tasks++;
        });
        // Tel deadlines (wegen 2x mee)
        if (t.deadline >= startDate && t.deadline <= endDate) deadlines++;
    });
    return tasks + (deadlines * 2); // activiteitsscore
}

function heatLevel(activity, maxActivity) {
    if (activity === 0) return 0;        // Rustig — #f1f5f9
    const ratio = activity / maxActivity;
    if (ratio <= 0.15) return 1;          // Licht — #dbeafe
    if (ratio <= 0.35) return 2;          // Normaal — #93c5fd
    if (ratio <= 0.55) return 3;          // Druk — #fbbf24
    if (ratio <= 0.80) return 4;          // Zeer druk — #f97316
    return 5;                              // Piek — #ef4444
}
```

### Heatmap kleuren:

| Level | Label | Achtergrondkleur |
|-------|-------|------------------|
| 0 | Rustig | `#f1f5f9` |
| 1 | Licht | `#dbeafe` |
| 2 | Normaal | `#93c5fd` |
| 3 | Druk | `#fbbf24` |
| 4 | Zeer druk | `#f97316` |
| 5 | Piek | `#ef4444` |

---

## 5. VIEW-SPECIFIEKE DETAILS

### 5.1 WEEK VIEW

**Bereik:** 7 dagen (ma-zo)
**Navigatie-eenheid:** 1 week
**Kolommen:** 7 dagkolommen

**Fase-kleur balk headers:**
```
Ma 2 | Di 3 | Wo 4 | Do 5 | Vr 6 | Za 7 | Zo 8
```
Huidige dag: highlighted met `.cd` class

**Tijdlijn inhoud per dagkolom:**
- Volledige **taakkaarten** (niet dots) met:
  - Gekleurde linkerborder (fase-kleur)
  - Taaknaam leesbaar
  - `.done` = doorgestreept + opacity
  - `.urgent` = rode border + rode achtergrond
- Vandaag-lijn (paarse verticale lijn)
- Deadline vlaggetje (rood)

**CSS classes:**
```css
.wt          /* week taakkaart */
.wt.done     /* afgeronde taak */
.wt.urgent   /* urgente taak */
.week-sub    /* dagkolom container */
.week-sub.cur /* huidige dag */
```

### 5.2 MAAND VIEW

**Bereik:** 1 kalendermaand
**Navigatie-eenheid:** 1 maand
**Kolommen:** 4-5 weekkolommen

**Fase-kleur balk headers:**
```
W5 | W6 | W7 | W8 | W9
```
Huidige week: highlighted met `.cw` class

**Tijdlijn inhoud per weekkolom:**
- **Taakpills** (compact, 1 regel) met:
  - Gekleurde linkerborder (2px)
  - Taaknaam (ellipsis bij overflow)
  - `.done` / `.urgent` classes
- Gantt-balk (licht transparant, publicatie→deadline)
- Vandaag-lijn
- Deadline vlaggetje

**CSS classes:**
```css
.mt          /* maand taakpill */
.mt.done     /* afgerond */
.mt.urgent   /* urgent */
```

### 5.3 KWARTAAL VIEW

**Bereik:** 3 maanden
**Navigatie-eenheid:** 1 kwartaal
**Kolommen:** 3 maandkolommen, elk intern weekraster

**Fase-kleur balk headers:**
```
[--- Januari ---] [--- Februari ---] [--- Maart ---]
 W1  W2  W3  W4    W5  W6  W7  W8    W9 W10 W11 W12
```
Huidige week: highlighted

**Tijdlijn inhoud:**
- **Taakdots** (7px bolletjes) gepositioneerd op exacte dag
  - Hover: scale(1.8) + tooltip met taaknaam
  - `.dn` = afgerond (opacity 0.4)
  - Rood = urgent
- Gantt-balk per maand
- Vandaag-lijn
- Deadline vlaggetje

**CSS classes:**
```css
.td          /* taakdot */
.td.dn       /* afgerond */
.tl-cell     /* tijdlijn cel */
.tl-cell.cur /* huidige periode */
```

### 5.4 JAAR VIEW

**Bereik:** 12 maanden
**Navigatie-eenheid:** 1 jaar
**Kolommen:** 12 maandkolommen

**Fase-kleur balk headers:**
```
Jan | Feb | Mrt | Apr | Mei | Jun | Jul | Aug | Sep | Okt | Nov | Dec
```
Huidige maand: highlighted met `.cm` class

**Tijdlijn inhoud:**
- **Gantt-balk** — hoofdverhaal op jaarniveau (publicatie→deadline)
  - Licht transparant (15% opacity) met 1px border
- **Deadline flag** — rode verticale lijn + vlaggetje
- **Taak-density dots** — kleine bolletjes onderaan maandcel
  - Max 6 zichtbaar, daarna "+N" indicator
  - Open = helder, done = faded, urgent = rood
- Vandaag-lijn
- Kwartaalscheidingslijnen (sterkere borders bij maand 3, 6, 9)

**CSS classes:**
```css
.task-density     /* container voor density dots */
.td-pip           /* individuele pip */
.td-pip.dn        /* afgeronde pip */
.gbar             /* Gantt balk */
.dl-flag          /* deadline vlaggetje */
.today-line       /* vandaag-lijn */
.tl-cell.qsep     /* kwartaalscheiding */
```

---

## 6. DATA-VEREISTEN

### Benodigde data per tender:

```javascript
{
    id: 'uuid',
    naam: 'Tendernaam',
    organisatie: 'Opdrachtgever',
    fase: 'lopend',                     // voor kleur
    fase_status: 'inplannen',           // voor pill-label
    ai_pitstop_status: 'ai_pro',       // voor AI badge

    // Tijdlijn
    publicatie_datum: '2025-12-09',     // start Gantt-balk
    deadline: '2026-03-03',             // einde Gantt-balk + vlaggetje
    deadline_display: '3 mrt · Nog 24 dagen',
    deadline_urgency: 'ok',             // ok | warn | danger | verlopen

    // Team
    team_assignments: [...],            // voor avatars

    // Taken (nodig voor tijdlijn)
    planning_taken: [
        { id, naam, datum: '2026-02-07', done: false, urgent: false, assignee_id }
    ],
    checklist_items: [
        { id, naam, datum: '2026-02-10', done: true, urgent: false }
    ],

    // Tellingen
    _planningCounts: { done: 3, total: 12 },
    _checklistCounts: { done: 8, total: 12 }
}
```

### API endpoint nodig:

`PlanningService` moet taken **met datum** kunnen ophalen per tender. Controleer of de huidige `getAllCounts()` voldoende is of dat een nieuw endpoint nodig is:

```javascript
// Nodig: taken met datums voor tijdlijn-positionering
async getTakenMetDatums(tenderIds) {
    // Retourneer: { tenderId: [{ naam, datum, done, urgent, type }] }
}
```

---

## 7. CSS KLASSEN-MAPPING

### Vanuit mockup → productie:

| Mockup class | Productie class | Bestand |
|-------------|-----------------|---------|
| `.tender-card` | `.agenda-tender-card` | `AgendaView.css` |
| `.tc-color-bar` | `.agenda-card-bar` | `AgendaView.css` |
| `.tc-body` | `.agenda-card-body` | `AgendaView.css` |
| `.tender-sidebar` | `.agenda-sidebar` | `AgendaView.css` |
| `.sticky-header` | `.agenda-sticky-header` | `AgendaView.css` |
| `.sh-heatmap` | `.agenda-heatmap` | `AgendaView.css` |
| `.sh-heat` | `.agenda-heat-cell` | `AgendaView.css` |
| `.gbar` | `.agenda-gantt-bar` | `AgendaView.css` |
| `.dl-flag` | `.agenda-deadline-flag` | `AgendaView.css` |
| `.today-line` | `.agenda-today-line` | `AgendaView.css` |
| `.td` | `.agenda-task-dot` | `AgendaView.css` |
| `.wt` | `.agenda-week-task` | `AgendaView.css` |
| `.mt` | `.agenda-month-task` | `AgendaView.css` |

> **Let op:** Prefix alle classes met `agenda-` om conflicts met bestaande CSS te voorkomen.

---

## 8. NAVIGATIE

### Knoppen:
- **‹ / ›** — vorige/volgende periode
- **Vandaag** — spring naar huidige periode (offset = 0)
- **Pijltjestoetsen** — keyboard navigatie

### State management:

```javascript
this.offset = 0;  // Relatief t.o.v. vandaag

// Week: offset * 7 dagen
// Maand: offset maanden
// Kwartaal: offset kwartalen
// Jaar: offset jaren

navigate(direction) {  // -1 of +1
    this.offset += direction;
    this.render();
}

goToday() {
    this.offset = 0;
    this.render();
}
```

### Agenda header update per view:

| View | Nav-indicator | Bereik-label |
|------|---------------|--------------|
| Week | "Week 6" | "Week 6 · 2 Feb – 8 Feb 2026" |
| Maand | "Februari 2026" | "Februari 2026 · 4 weken" |
| Kwartaal | "Q1 2026" | "Q1 2026 · Januari – Maart" |
| Jaar | "2026" | "2026 · Januari – December" |

---

## 9. VISUELE ELEMENTEN — KLEURENSYSTEEM

### Fase-kleuren (uit bestaande FASE_META):

| Fase | Gradient start | Gradient end | Accent |
|------|---------------|--------------|--------|
| Acquisitie | `#d97706` | `#e5921a` | `#ea580c` |
| Lopend | `#6d5ccd` | `#7c6fe0` | `#7c3aed` |
| Ingediend | `#0d9263` | `#10b981` | `#16a34a` |
| Afronden | `#0d9488` | `#14b8a6` | `#0d9488` |
| Archief | `#475569` | `#5a6b80` | `#64748b` |

### Gantt-balken:
- Achtergrond: `{accent}25` (15% opacity)
- Border: `{accent}44` (27% opacity)
- Hover: hoogte groeit, shadow verschijnt

### Deadline badge kleuren:

| Status | Achtergrond | Tekstkleur |
|--------|-------------|------------|
| ok (>14d) | `#f0fdf4` | `#16a34a` |
| warn (7-14d) | `#fefce8` | `#a16207` |
| danger (0-7d) | `#fef2f2` | `#dc2626` |
| verlopen | `#fee2e2` | `#991b1b` |

---

## 10. IMPLEMENTATIE-VOLGORDE

### Stap 1: AgendaView.css herschrijven
- Kopieer shared styles uit mockup
- Prefix alle classes met `agenda-`
- Organiseer per sectie: header, cards, sidebar, timeline, heatmap

### Stap 2: AgendaView.js — basis framework
- View-switching mechanisme
- Navigatie (offset + keyboard)
- Sticky header renderer (3 lagen + heatmap)
- Card container renderer

### Stap 3: Jaar view implementeren (eenvoudigst)
- 12 maandkolommen
- Gantt-balken + deadline flags
- Task density dots
- Heatmap berekening

### Stap 4: Kwartaal view
- 3 maandkolommen met weekraster
- Task dots op exacte dag
- Gantt-balken per maand

### Stap 5: Maand view
- 4-5 weekkolommen
- Task pills (leesbare namen)
- Gantt-balk

### Stap 6: Week view
- 7 dagkolommen
- Volledige taakkaarten
- Deadline markers

### Stap 7: Ongepland sectie
- Taken zonder datum groeperen per tender
- Warning banner voor niet-toegewezen taken

### Stap 8: API integratie
- PlanningService uitbreiden voor taken met datums
- Real-time data laden i.p.v. mock

---

## 11. ONGEPLAND SECTIE

Onder de tijdlijn-cards wordt een "Ongepland" sectie getoond:

```
📋 ONGEPLAND  [20 taken zonder datum]

┌─ ARCHIEF · Verkoop 't Poortershuys ──── 20 taken ─┐
│ ○ kick-off meeting   ✓ [PLANNING]                   │
│ ○ Uittreksel KvK     [CHECKLIST]                    │
│ ○ Plan van Aanpak    [CHECKLIST]                    │
└─────────────────────────────────────────────────────┘

⚠️ 21 taken zonder toewijzing
```

---

## 12. PERFORMANCE OVERWEGINGEN

- **Lazy rendering:** Render alleen zichtbare kaarten bij veel tenders
- **DOM recycling:** Bij navigatie, update bestaande elementen i.p.v. innerHTML vervangen
- **Heatmap caching:** Bereken eenmalig bij data-load, niet bij elke render
- **Sidebar compactheid:** Gebruik eenvoudige HTML i.p.v. TenderCard componenten als performance een issue is (veel kaarten × 4 views)

---

## 13. MOCKUP REFERENTIE

Het gecombineerde prototype met alle 4 views staat in project knowledge:

**`Planning_AllViews_20260207_1640.html`**

Dit bestand bevat:
- Werkende view-switcher (Week/Maand/Kwartaal/Jaar)
- Volledige CSS voor alle views
- Mock data met realistische tenders
- Alle visuele elementen (heatmap, Gantt, dots, pills, flags)
- Navigatie met pijltjestoetsen
- Ongepland sectie

Open dit bestand in een browser om het exacte gewenste resultaat te zien.

---

## 14. BESTANDSOVERZICHT HUIDIGE CODEBASE

### CSS (`frontend/css/`):
```
css/
├── components/
│   ├── TenderCard.css
│   ├── TenderCardBody.css
│   ├── TenderCardFooter.css
│   └── TenderCardHeader.css
├── modals/
│   └── FaseTransitieModal.css
├── AgendaView.css          ← HERSCHRIJVEN
├── KanbanView.css
├── variables.css
├── views.css
└── ... (overige)
```

### JavaScript (`frontend/js/`):
```
js/
├── components/
│   ├── TenderCardHeader.js  ← hergebruiken (size: 'compact')
│   ├── TenderCardBody.js    ← hergebruiken (size: 'compact')
│   ├── TenderCardFooter.js  ← hergebruiken (size: 'compact')
│   ├── TimelineCell.js      ← uitbreiden voor nieuwe views
│   └── TimelineSection.js   ← uitbreiden
├── services/
│   ├── PlanningService.js   ← eventueel uitbreiden
│   └── TenderService.js
├── views/
│   ├── AgendaView.js        ← HERSCHRIJVEN
│   └── BaseView.js
└── utils/
    └── FaseTransitieRules.js
```

---

## 15. CHECKLIST VOOR OPLEVERING

- [ ] View-switcher werkt (Week/Maand/Kwartaal/Jaar)
- [ ] Sticky header met 3 lagen per view
- [ ] Heatmap drukte-indicator in header
- [ ] Losse kaarten met fase-kleur balk
- [ ] Geïntegreerde tijdlijn-headers in kaart-balk
- [ ] Sidebar met tender-info (naam, org, deadline, avatars)
- [ ] Gantt-balken (licht transparant)
- [ ] Vandaag-lijn (paars)
- [ ] Deadline vlaggetjes (rood)
- [ ] Taak-indicatoren per view (kaarten/pills/dots/density)
- [ ] Navigatie (pijltjes + "Vandaag" + keyboard)
- [ ] Ongepland sectie
- [ ] Hover effecten (card lift, dot scale, tooltip)
- [ ] Animaties (fade-in bij laden)
- [ ] Geen CSS conflicts met bestaande views (prefix!)
- [ ] Real data via PlanningService
