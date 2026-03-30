# Stijlgids: Fase Kleuren — TenderZen

> **Single source of truth:** `frontend/js/config/FaseKleuren.js`
> Wijzig kleuren **alleen** in dat bestand. Nooit hardcoded in componenten.

---

## Fase overzicht

| Fase-ID        | Label          | Kleur      | Achtergrond | Badge bg   | Badge tekst |
|----------------|----------------|------------|-------------|------------|-------------|
| `acquisitie`   | Acquisitie     | `#ea580c`  | `#fff7ed`   | `#fff7ed`  | `#ea580c`   |
| `inschrijvingen` | Inschrijvingen | `#7c3aed` | `#f5f3ff`   | `#f5f3ff`  | `#7c3aed`   |
| `ingediend`    | Ingediend      | `#16a34a`  | `#f0fdf4`   | `#f0fdf4`  | `#16a34a`   |
| `evaluatie`    | Afronden       | `#0d9488`  | `#f0fdfa`   | `#f0fdfa`  | `#0d9488`   |
| `archief`      | Archief        | `#64748b`  | `#f8fafc`   | `#f8fafc`  | `#64748b`   |

> **Let op:** De DB-sleutel is `evaluatie`, het weergavelabel is **Afronden**.
> **Let op:** `inschrijvingen` is **paars** (`#7c3aed`), niet blauw.

---

## Badge styling

| Toestand    | Achtergrond       | Tekst  |
|-------------|-------------------|--------|
| Inactief    | `fk.badgeBg`      | `fk.badgeTekst` |
| Actief      | `fk.badgeActiveBg` | `#fff` |

- `border-radius: 6px`
- `font-size: 11px`, `font-weight: 700`
- Achtergrond en kleur worden altijd via **inline style** gezet (niet via CSS-klasse), omdat ze per fase variëren.

---

## Gebruik in JavaScript

```js
// Haal kleurconfig op
const fk = window.FaseKleuren.get(faseId);

// Beschikbare velden:
fk.kleur            // hoofdkleur (tekst, icoon)
fk.bg               // achtergrond (tab, kaart)
fk.badgeBg          // badge achtergrond (inactief)
fk.badgeTekst       // badge tekst (inactief)
fk.badgeActiveBg    // badge achtergrond (actief)
fk.badgeActiveTekst // badge tekst (actief) — altijd '#fff'
fk.border           // randkleur
fk.icon             // icoon-naam (voor Icons library)
fk.label            // weergavelabel

// Alle fase-sleutels in volgorde:
window.FaseKleuren.alleFases();
// → ['acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief']
```

---

## Aliassen

`FaseKleuren.get()` ondersteunt de volgende aliassen:

| Alias       | Wijst naar     |
|-------------|----------------|
| `afronden`  | `evaluatie`    |
| `lopend`    | `inschrijvingen` |

Onbekende fase-IDs vallen terug op de `archief`-kleuren.

---

## Componenten die FaseKleuren gebruiken

| Component | Migratiestatus |
|-----------|---------------|
| `FaseBar.js` | ✅ Volledig via `FaseKleuren.get()` |
| `TenderCardHeader.js` | ✅ `FALLBACK_CONFIG` bijgewerkt |
| `FaseTransitieModal.js` | ✅ `_getFaseConfig()` bijgewerkt, `evaluatie` toegevoegd |
| `TenderListView.js` | ✅ `getFaseKleur()` delegeert naar `FaseKleuren` |
| `KanbanView.js` | ⚠️ Eigen `FASE_META` — werkt correct, migratie optioneel |

---

## Wat NIET te doen

- Geen hardcoded hex-waarden voor fase-kleuren in componenten
- Nooit `#2563eb` (blauw) als fase-kleur voor `inschrijvingen` — dat is UI-blauw, niet de fase-kleur
- `evaluatie` heeft kleur `#0d9488` (teal), **niet** blauw
