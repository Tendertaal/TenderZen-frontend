# TenderZen — AgendaView v2.0 Integratie-checklist

**Datum:** 8 februari 2026  
**Bestanden:** AgendaView_20260207_1830.css + AgendaView_20260208_1400.js

---

## 1. BESTANDEN DEPLOYEN

### Vervangen:

| # | Bron | Doel-pad | Actie |
|---|------|----------|-------|
| 1 | `AgendaView_20260207_1830.css` | `Frontend/css/AgendaView.css` | Vervangen (backup oude versie) |
| 2 | `AgendaView_20260208_1400.js` | `Frontend/js/views/AgendaView.js` | Vervangen (backup oude versie) |

### Niet wijzigen (al correct):

| Bestand | Locatie | Status |
|---------|---------|--------|
| `PlanningService.js` | `Frontend/js/services/` | ✅ `getAgendaData()` aanwezig |
| `planning.py` | `Backend/app/api/v1/` | ✅ `GET /planning/agenda` endpoint aanwezig |
| `planning_service.py` | `Backend/app/services/` | ✅ `get_agenda_data()` implementatie compleet |

---

## 2. OPTIONELE BACKEND-EDIT

In `planning_service.py` → methode `get_agenda_data()` → stap 5 (tenders ophalen):

```python
# HUIDIG:
.select('id, naam, opdrachtgever, fase, fase_status, deadline_indiening, publicatie_datum, tenderbureau_id')

# NIEUW (voeg ai_pitstop_status toe):
.select('id, naam, opdrachtgever, fase, fase_status, deadline_indiening, publicatie_datum, tenderbureau_id, ai_pitstop_status')
```

> **Waarom:** De AgendaView toont een "✦ AI Pro" badge in de color bar. Zonder dit veld verschijnt de badge simpelweg niet — geen errors, puur cosmetisch.

---

## 3. CONTROLEER IMPORTS

Open `AgendaView_20260208_1400.js` en check dat deze imports kloppen in jouw project:

```javascript
import { BaseView } from './BaseView.js';                    // ← Bestaat dit pad?
import { planningService } from '../services/PlanningService.js';  // ← Klopt dit pad?
```

Check ook:
- `window.Icons` — wordt `icons.js` geladen vóór AgendaView? (via `<script>` of import)
- `BaseView` — heeft die `mount(container)` en `unmount()` methodes?

---

## 4. CHECK APP.JS REGISTRATIE

De AgendaView wordt waarschijnlijk geregistreerd in `App.js` of een router. Controleer:

```javascript
// Oud (v1.5):
import { AgendaView } from './views/AgendaView.js';

// Nieuw (v2.0) — zelfde import, class heet nog steeds AgendaView
import { AgendaView } from './views/AgendaView.js';
```

De constructor accepteert dezelfde `options = {}` als voorheen. De `mount(container)` / `unmount()` interface is ongewijzigd.

**Nieuwe callback instellen (optioneel):**
```javascript
const agendaView = new AgendaView();
agendaView.onOpenPlanningModal = (tender) => {
    // Open PlanningModal voor deze tender
    planningModal.open(tender);
};
```

---

## 5. CSS LINK CONTROLEREN

Check `index.html` dat de CSS geladen wordt:

```html
<link rel="stylesheet" href="css/AgendaView.css">
```

De nieuwe CSS gebruikt **CSS variabelen** (`:root`). Controleer dat er geen andere stylesheet dezelfde variabelen overschrijft:
- `--acquisitie-start`, `--lopend-accent`, etc.
- `--agenda-bg-app`, `--agenda-border`, etc.

---

## 6. TESTEN — STAP VOOR STAP

### 6.1 Basis laden
- [ ] Open de Agenda view in de browser
- [ ] Console: check op `📅 AgendaView v2.0 constructed`
- [ ] Console: check op `📡 PlanningService.getAgendaData() →`
- [ ] Console: check op `✅ getAgendaData response:` met aantallen

### 6.2 View switching
- [ ] Klik **Week** → 7 dagkolommen zichtbaar
- [ ] Klik **Maand** → weekkolommen (4-5 stuks)
- [ ] Klik **Kwartaal** → 3 maanden met weekrasters
- [ ] Klik **Jaar** → 12 maandkolommen
- [ ] Actieve knop krijgt paarse achtergrond

### 6.3 Navigatie
- [ ] Klik **›** → volgende periode, indicator verandert
- [ ] Klik **‹** → vorige periode
- [ ] Klik **Vandaag** → spring terug naar huidige periode
- [ ] **Pijltjestoetsen** → links/rechts navigeert (niet als input focus heeft)

### 6.4 Tender cards
- [ ] Elke tender toont als losse kaart met 10px gap
- [ ] **Color bar:** fase-gradient kleur + fase pill + tijdlijn headers
- [ ] **Sidebar (240px):** naam, organisatie, deadline badge, avatars, voortgang
- [ ] **Deadline badge kleuren:**
  - Groen: > 14 dagen
  - Geel: 7-14 dagen  
  - Rood: 0-7 dagen
  - Donkerrood: verlopen

### 6.5 Tijdlijn per view
- [ ] **Jaar:** density pips in maandcellen, Gantt-balk zichtbaar, deadline vlaggetje rood
- [ ] **Kwartaal:** task dots op weekpositie, hover toont taaknaam
- [ ] **Maand:** task pills met leesbare namen
- [ ] **Week:** volledige taakkaarten per dag

### 6.6 Visuele elementen
- [ ] **Vandaag-lijn:** paarse verticale lijn met bolletje
- [ ] **Gantt-balk:** licht transparant, hover → groeit + shadow
- [ ] **Heatmap:** bovenaan sticky header, kleuren 0-5 niveaus
- [ ] **Heatmap tooltips:** hover toont "Jan: 5 taken, 1 deadline · Druk"

### 6.7 Filters
- [ ] **Alle taken** → toont alles
- [ ] **Mijn taken** → toont team selector chips
- [ ] Klik op team member chip → filtert taken
- [ ] Stats updaten: "24 totaal · 16 open · 8 klaar"

### 6.8 Ongepland sectie
- [ ] Verschijnt alleen als er taken zonder datum zijn
- [ ] Gegroepeerd per tender met fase-kleur header
- [ ] Checkbox toggle werkt (todo ↔ done)
- [ ] Badge toont totaal ongeplande taken

### 6.9 Warning banner
- [ ] Verschijnt als er taken zonder toewijzing zijn
- [ ] Toont correct aantal: "⚠️ 21 taken zonder toewijzing"

### 6.10 Responsive
- [ ] Verklein browser < 1200px → sidebar krimpt naar 200px
- [ ] Verklein < 900px → sidebar 170px, compactere layout
- [ ] Verklein < 640px → sidebar 140px, stats verborgen

### 6.11 Lege staat
- [ ] Navigeer naar periode zonder taken
- [ ] "Geen taken gevonden" met correcte periode-tekst

---

## 7. BEKENDE BEPERKINGEN

| Item | Status | Opmerking |
|------|--------|-----------|
| Drag & drop taken verplaatsen | ❌ Niet geïmplementeerd | Mogelijk toekomstige feature |
| Click op tender card → detail | ⚡ Via `onOpenPlanningModal` callback | Moet in App.js worden gekoppeld |
| Checklist status toggle | ⚠️ Alleen planning taken | Checklist gebruikt ander status-systeem (pending/completed) |
| Real-time updates | ❌ Geen Supabase subscription | Handmatig refreshen na wijzigingen |
| Super-admin "alle bureaus" | ✅ Backend ondersteunt het | Frontend toont automatisch alle data |

---

## 8. TROUBLESHOOTING

### "Geen taken gevonden" terwijl er wel taken zijn
1. Open console → zoek `📡 PlanningService.getAgendaData()`
2. Check de URL parameters: klopt het datumbereik?
3. Check response: `✅ getAgendaData response: { taken: 0 }` → backend issue
4. Controleer of taken een `datum` veld hebben (NULL = ongepland, verschijnt alleen onderaan)

### Cards verschijnen zonder styling
1. Check of `AgendaView.css` geladen is (Network tab)
2. Check of classes `agenda-` prefix hebben (Elements tab)
3. Zoek naar CSS conflicten met andere stylesheets

### Heatmap toont geen data
- Heatmap berekent op basis van laden data → als er weinig tenders zijn, zijn levels laag
- Check: `agenda-heat-0` t/m `agenda-heat-5` classes in CSS

### Keyboard navigatie werkt niet
- Check of focus niet op een input/textarea staat
- Event listener zit op `document` → kan conflicteren met andere keyboard handlers

---

## 9. VOLGENDE STAPPEN NA DEPLOY

1. **Test met productiedata** — meerdere tenders, verschillende fases
2. **Koppel `onOpenPlanningModal`** in App.js → klik op tender opent detail
3. **Overweeg Supabase subscription** voor real-time updates
4. **Performance test** met 20+ tenders → lazy rendering toevoegen indien nodig
5. **Checklist toggle** aansluiten (nu alleen planning taken)
