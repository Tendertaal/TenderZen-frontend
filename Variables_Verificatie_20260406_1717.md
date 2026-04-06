# Variables.css Veiligheidsverificatie — 2026-04-06 17:17

## Conclusie vooraf

**Niet direct veilig laden — twee echte conflicten aanwezig.**
Zie §3 voor details en §5 voor aanbevolen aanpak.

---

## 1. Welke variabelen worden al gebruikt in de app?

Variabelen uit `variables.css` die actief worden gebruikt (`var(--...)` in CSS of JS):

**Kleurschalen (actief gebruikt):**
- `--color-gray-50` t/m `--color-gray-900` — breed gebruikt
- `--color-primary-50` t/m `--color-primary-700` — breed gebruikt
- `--color-success-50/200/500/600/700`
- `--color-error-50/100/200/500/600/700`
- `--color-warning-50/100/200/500/600/700`
- `--color-info-50/100/200/600/700`
- `--color-purple-50/200/500/600/700`
- `--color-pink-50/200/700`
- `--color-teal-50/200/700`
- `--color-amber-50/200/600/700`

**Typografie:**
- `--font-family`, `--font-family-mono`, `--font-family-logo`
- `--font-size-xs/sm/base/md/lg/xl/2xl/3xl`
- `--font-weight-normal/medium/semibold/bold`

**Spacing:**
- `--space-0-5/1/1-5/2/2-5/3/4/5/6/7/8/10/16`
- `--spacing-xs/sm/md/lg/xl` (legacy aliassen)

**Border radius:** `--radius-sm/md/lg/xl/2xl/full`

**Shadows:** `--shadow-sm/md/lg/2xl/primary/primary-lg/success/error`

**Transitions:** `--transition-fast/normal/all/colors/shadow/base`

**Z-index:** `--z-dropdown/sticky/modal`

**Achtergronden:** `--bg-body/surface/secondary/hover`

**Tekst:** `--text-primary/secondary/tertiary/muted/inverse`

**Status:** `--status-go/no-go/maybe`

**Sidebar:** `--sidebar-bg/hover/active/width-collapsed/width-expanded/transition`

**Brand:** `--tz-gradient-diagonal`

---

## 2. Welke variabelen worden nergens gebruikt (dode code)?

Nooit gebruikt via `var(--...)` in CSS of JS:

- `--tz-purple-light`, `--tz-purple`, `--tz-indigo-light`, `--tz-indigo`, `--tz-indigo-dark`, `--tz-violet`
- `--tz-gradient-vertical`, `--tz-gradient-horizontal`
- `--color-primary-800/900`
- `--color-success-100/300/400/800/900`
- `--color-error-300/400/800/900`
- `--color-warning-300/400/800/900`
- `--color-info-300/400/500/800/900`
- `--color-amber-300/400/500/800/900`
- Alle `--deadline-*` vars (red/green/orange bg/border/text/hover)
- Alle `--workload-*` vars
- Alle `--avatar-*` vars
- `--bg-active`, `--bg-dark`, `--bg-dark-surface`, `--bg-dark-elevated`, `--bg-white`, `--bg-header`
- `--border-focus`
- `--text-link`, `--text-link-hover`
- `--font-size-4xl/5xl`
- `--line-height-*`
- `--letter-spacing-*`
- `--space-9/11/12/14/20/24`
- `--spacing-2xl/3xl`
- `--radius-none/2xl/3xl`
- `--shadow-xs/xl/inner`
- `--transition-slow/slower/transform`
- `--z-below/base/above/overlay/popover/toast/tooltip/max`
- `--header-height`, `--container-max`, `--content-max`
- `--sidebar-collapsed` (anders gespeld dan in Sidebar.css)
- Alle `--fase-*` vars (acquisitie/inschrijvingen/ingediend)
- `--status-pending`
- `--icon-*` vars (alle 10 icon kleuren)

Schatting: **~60% van variables.css is momenteel ongebruikte dode code.**

---

## 3. Naamconflicten — KRITIEK

### Conflict 1: `--color-primary` (HOOG RISICO)

| Bestand | Definitie |
|---------|-----------|
| `main.css` (geladen) | `--color-primary: #3b82f6` (blauw) |
| `variables.css` (niet geladen) | **niet gedefinieerd** |

`variables.css` definieert `--color-primary-*` schalen maar **niet** de bare `--color-primary`. Dit is **geen conflict** — maar als `variables.css` vóór `main.css` zou worden geladen, zou `main.css` de winner zijn. Geen probleem.

### Conflict 2: `--shadow-sm` en `--shadow-md` (HOOG RISICO)

| Variabele | main.css | variables.css |
|-----------|----------|---------------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)` |

**Dit zijn echte conflicten** — beide bestanden zitten in `:root`. De winner is de **laatste** in load-volgorde. Als `variables.css` ná `main.css` wordt geladen, overschrijft het de schaduwwaarden. Zichtbaar effect: subtiel verschil in card shadows op componenten die `var(--shadow-sm/md)` gebruiken.

### Conflict 3: `--spacing-sm` (LAAG RISICO)

| Variabele | main.css | variables.css |
|-----------|----------|---------------|
| `--spacing-sm` | `8px` | `var(--space-2)` → resolveert naar `8px` |

Zelfde eindwaarde, geen zichtbaar effect.

### Conflict 4: `--color-gray-50` t/m `--color-gray-900`

Beide bestanden definiëren exact dezelfde waarden. **Geen conflict** — identiek.

### Conflict 5: styles.css (MEDIUM RISICO)

`styles.css` (geladen op regel 39 in index.html, ná `main.css`) definieert **204 custom properties** in `:root`, waaronder:
- `--color-primary-50` t/m `--color-primary-900` — zelfde waarden als `variables.css` ✓
- `--color-success-*` — **andere waarden**: `success-50: #dcfce7` vs variables.css `#f0fdf4`
- `--color-error-*` — **andere waarden**: `error-50: #fee2e2` vs variables.css `#fef2f2`
- `--tz-purple`, `--tz-indigo` etc. — zelfde waarden ✓

De `styles.css`/`variables.css` conflicten op success/error zijn zichtbaar als badge achtergrondkleur. Maar omdat `styles.css` al geladen is en `badge.css` ook `var(--color-success-50)` gebruikt — het huidige gedrag is bepaald door `styles.css`. Laden van `variables.css` ná `styles.css` zou de success-badge achtergrond veranderen van `#dcfce7` naar `#f0fdf4` (minder saturated groen).

---

## 4. `badge.css` en `base.css` — inhoud en bruikbaarheid

### `badge.css`
- **Inhoud:** Volledig uitgewerkte badge library — `.badge`, `.status-badge`, `.phase-badge` + alle varianten (go/no-go/fase/count/size/pill/dot)
- **Afhankelijkheid:** Gebruikt vrijwel uitsluitend `var(--color-*)`, `var(--space-*)` etc. uit `variables.css` — **werkt niet zonder variables.css**
- **Niet geladen** in `index.html`
- **Bruikbaar?** Ja, maar vereist eerst `variables.css` en afstemming met `styles.css` conflicts
- **Overlap:** De fase badge klassen (`phase-badge--acquisitie`) hebben hardcoded waarden die afwijken van `FaseKleuren.js` — extra merge werk nodig

### `base.css`
- **Inhoud:** CSS reset + base typography + utility classes (`flex`, `text-*`, `font-*`, `mt-*`, `gap-*`, etc.)
- **Afhankelijkheid:** Gebruikt `var(--font-family)`, `var(--gray-*)`, `var(--bg-body)` etc.
- **Niet geladen** in `index.html`
- **Bruikbaar?** Gedeeltelijk — de reset en utility classes zijn nuttig, maar `main.css` heeft al een CSS reset en utility classes. Laden veroorzaakt geen visuele breuk maar wel redundantie.
- **Opmerking:** Heet intern nog "TenderPlanner v2.0" — is nooit omgezet naar TenderZen

---

## 5. Veiligheid: conclusie en aanbeveling

### Veilig laden? **Nee, niet zonder aanpassing.**

| Risico | Severity | Oplossing |
|--------|----------|-----------|
| `--shadow-sm/md` conflict met `main.css` | Medium | Verwijder duplicaten uit `main.css` of laad `variables.css` vóór `main.css` |
| `--color-success/error-*` conflict met `styles.css` | Medium | Verwijder conflicterende vars uit `styles.css` |
| `badge.css` werkt niet zonder `variables.css` | n.v.t. | `badge.css` niet laden totdat `variables.css` actief is |

### Aanbevolen aanpak (veiligste volgorde):

**Stap 1:** Laad `variables.css` als allereerste CSS in `index.html` (vóór `main.css`):
```html
<link rel="stylesheet" href="css/variables.css">   <!-- NIEUW, als eerste -->
<link rel="stylesheet" href="css/main.css?v=3">    <!-- nu tweede -->
```
Met `variables.css` als eerste worden eventuele `:root` herdefinities in `main.css` en `styles.css` de winners — het huidige visuele gedrag blijft intact.

**Stap 2 (later):** Verwijder conflicterende variabelen uit `main.css` en `styles.css` die identiek zijn aan `variables.css`.

**Stap 3 (later):** Laad `badge.css` na `variables.css` wanneer je de badge library wil activeren.

**Stap 4 (optioneel):** `base.css` laden als reset/utilities gewenst zijn — evalueer overlap met `main.css` first.

### Geen actie vereist voor:
- AgendaView `--agenda-*` vars — unieke namen, geen conflict
- Sidebar.css component-level vars — unieke names, geen conflict
- `--color-gray-*` duplicaten — identieke waarden, geen effect
