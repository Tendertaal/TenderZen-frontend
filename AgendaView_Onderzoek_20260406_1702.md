# AgendaView Hergebruik Onderzoek — 2026-04-06 17:02

## 1. Lijst-view kaartrender — exacte locatie

**Bestand:** `frontend/js/components/TenderCard.js`
**Methode:** `render()` — line 87
**Aanroep vanuit:** `TenderListView.renderTenderCard(tender)` — line 201

```javascript
// TenderListView.js line 201
renderTenderCard(tender) {
    const card = new TenderCard(tender, {
        searchQuery: this.searchQuery,
        allFaseStatussen: this.allFaseStatussen,
        planningCounts: tender._planningCounts || null,
        checklistCounts: tender._checklistCounts || null
    });
    return card.render();
}
```

**Layout TenderCard:** 3-band horizontaal layout met vaste 420px zijkolom + flexibele timeline
- Band 1: `tc-header-band` — gradient kleurbar + timeline kolomkoppen
- Band 2: `tc-content-band` — kaartinhoud (420px) + datumcellen
- Band 3: `tc-footer-band` — avatars (420px) + footer cellen

**Data verwacht door TenderCard:**
```
id, fase, fase_status, status, geschatte_waarde, team_assignments,
deadline_indiening, publicatie_datum, schouw_datum, nvi1_datum, nvi2_datum,
presentatie_datum, interne_deadline, voorlopige_gunning, definitieve_gunning,
start_uitvoering
```

---

## 2. Herbruikbaarheid TenderCard in AgendaView

**Conclusie: Niet direct herbruikbaar — gedeeltelijk.**

TenderCard is gebouwd voor de horizontale lijst-view met vaste kolombreedte (420px sidebar + 110px datumcellen). De AgendaView heeft een eigen layout (240px sidebar + dynamische tijdlijnkolommen per zoom-level). De data-structuur wijkt ook af: AgendaView gebruikt `tasks` per datum, TenderCard gebruikt vaste datumvelden.

Wat wél herbruikbaar is (zie §3):
- Fase badge styling via `FaseKleuren.get()`
- Deadline pill kleur-semantiek
- Avatar HTML-patroon
- Counter badges

---

## 3. AgendaView data per tender

```javascript
{
    id, naam, organisatie, bedrijfsnaam,
    fase, fase_status, ai_pitstop_status,
    publicatie_datum, deadline,          // ISO strings
    deadlineDisplay,                     // "15 Feb · Nog 3 dagen"
    deadlineUrgency,                     // ok | warn | danger | verlopen
    tasks: { "YYYY-MM-DD": [{ id, n, d, u, bron, assignees, datum }] },
    ongepland: [],                       // ongeplaatste taken
    team: [{ id, naam, avatar_kleur, initialen }],
    total, done, nietToegewezen,
    _heeftPlanning, tenderbureau_id
}
```

---

## 4. AgendaView.css — omvang en custom properties

**Totaal:** 1.551 regels

**41 custom properties (--agenda-* prefix):**

```css
/* Fase gradients */
--acquisitie-start, --acquisitie-end, --acquisitie-accent
--lopend-start, --lopend-end, --lopend-accent
--ingediend-start, --ingediend-end, --ingediend-accent
--afronden-start, --afronden-end, --afronden-accent
--archief-start, --archief-end, --archief-accent

/* Oppervlakken */
--agenda-bg-app: #f1f5f9
--agenda-bg-surface: #ffffff
--agenda-bg-muted: #f8fafc

/* Borders */
--agenda-border: #e2e8f0
--agenda-border-dark: #cbd5e1

/* Tekst */
--agenda-text-1: #0f172a
--agenda-text-2: #475569
--agenda-text-3: #94a3b8

/* Accenten */
--agenda-accent: #667eea
--agenda-accent-bg: #eef2ff

/* Semantisch */
--agenda-ok, --agenda-ok-bg
--agenda-warn, --agenda-warn-bg
--agenda-danger, --agenda-danger-bg
--agenda-verlopen, --agenda-verlopen-bg

/* Schaduwen */
--agenda-shadow-s, --agenda-shadow-m, --agenda-shadow-card

/* Layout */
--agenda-sidebar-w: 240px
```

**Observatie:** De fase gradient variabelen (15 stuks) worden niet gebruikt door `FaseKleuren.js` — dat heeft zijn eigen kleurwaarden. Dit is dubbel.

---

## 5. Herbruikbare onderdelen — overzicht

| Onderdeel | Herbruikbaar? | Aanpak |
|-----------|--------------|--------|
| Tenderkaart (linkerkolom) | **Gedeeltelijk** | Eigen sidebar-render houden (`_renderSidebar`), maar HTML-patroon afstemmen op globale klassen |
| Fase badge | **Ja** | `FaseKleuren.get(fase).badgeBg` + `badgeTekst` — inline stijlen zoals in GanttView `_faseBadgeHtml()` |
| Deadline pill | **Ja** | Kleur-semantiek overnemen van `tc-days-badge--ok/soon/urgent/verlopen`; eigen klassen vervangen |
| Avatars | **Ja** | HTML-patroon `.avatar-wrap > .avatar-circle` globaliseren; `agenda-sidebar-avatar` afstemmen |
| Tellers planning/checklist | **Ja** | `.agenda-count-badge.planning/.checklist` bestaat al — ook bruikbaar vanuit GanttView context |
| Toolbar (nav, zoom, vandaag) | **Ja** | Zelfde knop-HTML als GanttView `_renderToolbar()`; CSS kan worden gedeeld |
| Werkdruk heatmap | **Nee** | Uniek — behouden als-is |

---

## 6. Wat uniek blijft aan AgendaView

- **Tijdlijnkolommen** — dynamische breedte per zoom-level (week/maand/kwartaal/jaar)
- **Sticky header** — 3 lagen met heatmap
- **Heatmap** — `countActivityInRange()` + 5-level kleurschaal
- **Zoom-levels** — week/maand/kwartaal/jaar + navigate
- **Taak-dots en density pips** — taken per dag visueel weergeven

---

## 7. Welke --agenda-* variabelen kunnen worden vervangen

| Huidige variabele | Vervangen door |
|-------------------|----------------|
| `--agenda-bg-surface` | `#ffffff` of globale `--color-surface` |
| `--agenda-bg-muted` | `#F9FAFB` of globale `--color-bg-subtle` |
| `--agenda-border` | globale `--color-border` (`#e2e8f0`) |
| `--agenda-text-1/2/3` | globale `--color-text`, `--color-muted` |
| `--agenda-ok/warn/danger` | globale semantische kleuren |
| Fase gradient vars (15x) | Verwijderen — `FaseKleuren.js` is leidend |

---

## 8. Geschatte impact

| Categorie | Regels nu | Na consolidatie | Besparing |
|-----------|-----------|-----------------|-----------|
| Deadline badge/pill | ~115 | ~30 | ~85 |
| Avatar styling | ~55 | ~20 | ~35 |
| Counter badges | ~50 | ~15 | ~35 |
| Fase badge | ~65 | ~10 | ~55 |
| Fase gradient vars (ongebruikt) | ~40 | ~0 | ~40 |
| Empty/loading states | ~70 | ~25 | ~45 |
| Progress bars | ~30 | ~10 | ~20 |
| **Totaal** | **~425** | **~110** | **~315 regels** |

Realistische besparing: **~300–350 regels** (~20–23% van 1.551).

De overige ~1.200 regels zijn layout-specifiek (grid, sticky header, timeline, heatmap, responsief) en kunnen niet worden vervangen.

---

## 9. Aanbevolen aanpak — volgorde van uitvoering

1. **Fase badge** — vervang inline gradient-stijl in AgendaView door `FaseKleuren.get()` + gedeelde `.fase-badge` klasse (ook herbruikbaar in GanttView, KalenderView)
2. **Deadline pill** — standaardiseer op één set klassen (`dl-pill--ok/warn/urgent/verlopen`) gedeeld door Agenda, Gantt, Kalender
3. **Avatars** — één `.av-circle` klasse met size-modifier (`--sm`, `--md`) voor alle views
4. **Counter badges** — één `.count-badge` klasse met `.planning`/`.checklist` modifier
5. **--agenda-* variabelen** — verwijder fase gradient vars, vervang surface/border/text vars door globale tokens
6. **Toolbar** — GanttView en AgendaView toolbar HTML afstemmen op gedeeld patroon
7. **Heatmap** — behouden, geen consolidatie nodig

> Stap 1–4 zijn laaghangend fruit: kleine, geïsoleerde veranderingen met direct zichtbaar resultaat.
> Stap 5–7 zijn architectureel en vereisen meer coördinatie.
