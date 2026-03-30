/**
 * FaseKleuren.js — Centrale kleurenconfiguratie voor alle fases
 *
 * SINGLE SOURCE OF TRUTH — alle componenten die fase-kleuren nodig hebben
 * MOETEN dit bestand gebruiken via window.FaseKleuren.get(faseId).
 *
 * Wijzig kleuren ALLEEN hier. Nooit hardcoded in afzonderlijke componenten.
 *
 * Gebruikt door: FaseBar, KanbanView (fallback), TenderCardHeader,
 *                FaseTransitieModal, TenderListView, en toekomstige componenten.
 *
 * Laden in index.html VOOR alle componenten die FaseKleuren gebruiken.
 */

const FaseKleuren = {
    acquisitie: {
        label:            'Acquisitie',
        kleur:            '#ea580c',
        bg:               '#fff7ed',
        badgeBg:          '#fff7ed',
        badgeTekst:       '#ea580c',
        badgeActiveBg:    '#ea580c',
        badgeActiveTekst: '#fff',
        border:           '#fed7aa',
        icon:             'search',
    },
    inschrijvingen: {
        label:            'Inschrijvingen',
        kleur:            '#7c3aed',
        bg:               '#f5f3ff',
        badgeBg:          '#f5f3ff',
        badgeTekst:       '#7c3aed',
        badgeActiveBg:    '#7c3aed',
        badgeActiveTekst: '#fff',
        border:           '#ddd6fe',
        icon:             'edit',
    },
    ingediend: {
        label:            'Ingediend',
        kleur:            '#16a34a',
        bg:               '#f0fdf4',
        badgeBg:          '#f0fdf4',
        badgeTekst:       '#16a34a',
        badgeActiveBg:    '#16a34a',
        badgeActiveTekst: '#fff',
        border:           '#bbf7d0',
        icon:             'upload',
    },
    evaluatie: {
        label:            'Afronden',
        kleur:            '#0d9488',   // TEAL — niet blauw
        bg:               '#f0fdfa',
        badgeBg:          '#f0fdfa',
        badgeTekst:       '#0d9488',
        badgeActiveBg:    '#0d9488',
        badgeActiveTekst: '#fff',
        border:           '#99f6e4',
        icon:             'clock',
    },
    archief: {
        label:            'Archief',
        kleur:            '#64748b',
        bg:               '#f8fafc',
        badgeBg:          '#f8fafc',
        badgeTekst:       '#64748b',
        badgeActiveBg:    '#64748b',
        badgeActiveTekst: '#fff',
        border:           '#e2e8f0',
        icon:             'fileText',
    },
};

/**
 * Haal kleurconfig op voor een fase.
 * Ondersteunt aliassen: 'afronden' → 'evaluatie', 'lopend' → 'inschrijvingen'.
 * Fallback naar archief-kleuren als fase onbekend is.
 */
FaseKleuren.get = function(faseId) {
    const aliassen = {
        afronden: 'evaluatie',
        lopend:   'inschrijvingen',
    };
    const key = aliassen[faseId] || faseId;
    return this[key] || this.archief;
};

/** Alle fase-sleutels als geordende array. */
FaseKleuren.alleFases = function() {
    return ['acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'];
};

window.FaseKleuren = FaseKleuren;
