/**
 * TenderCardHeader — Herbruikbaar header component voor tender kaarten
 * TenderZen v2.0 — Dynamische fase configuratie uit database
 *
 * DOEL-PAD:  Frontend/js/components/TenderCardHeader.js
 *
 * CHANGELOG v2.0:
 * - DYNAMISCH: Alle fase labels, kleuren en volgorde komen uit faseService
 * - Geen hardcoded FASE_CONFIG meer — nieuwe fases verschijnen automatisch
 * - Kleur-afgeleide functies (bg, text, border) voor badge styling
 * - Fallback naar defaults als faseService nog niet geladen is
 *
 * CHANGELOG v1.1:
 * - Fase "evaluatie" toegevoegd (label: AFRONDEN, kleur: teal)
 *
 * Bevat: Fase badge, Status dropdown, Actie-knoppen (AI doc, instellingen)
 * Twee formaten: 'default' (lijstweergave) en 'compact' (kanban/planning)
 */

import { faseService } from '../services/FaseService.js';

// ============================================
// KLEUR UTILITIES
// ============================================

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
    };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/**
 * Maak een zeer lichte tint (voor badge achtergrond)
 * Mix base kleur met 88% wit
 */
function maakBgKleur(hex) {
    const { r, g, b } = hexToRgb(hex);
    const mix = 0.88;
    return rgbToHex(
        r + (255 - r) * mix,
        g + (255 - g) * mix,
        b + (255 - b) * mix
    );
}

/**
 * Maak een donkere variant (voor badge tekst)
 * Donkerder met factor 0.45
 */
function maakTextKleur(hex) {
    const { r, g, b } = hexToRgb(hex);
    const factor = 0.45;
    return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

/**
 * Maak border kleur (iets lichter dan base)
 * Mix base kleur met 20% wit
 */
function maakBorderKleur(hex) {
    const { r, g, b } = hexToRgb(hex);
    const mix = 0.2;
    return rgbToHex(
        r + (255 - r) * mix,
        g + (255 - g) * mix,
        b + (255 - b) * mix
    );
}

// ============================================
// FALLBACK CONFIGURATIE
// ============================================

const FALLBACK_CONFIG = {
    acquisitie:     { label: 'ACQUISITIE',  kleur: '#ea580c' },
    inschrijvingen: { label: 'LOPEND',      kleur: '#2563eb' },
    ingediend:      { label: 'INGEDIEND',   kleur: '#16a34a' },
    evaluatie:      { label: 'AFRONDEN',    kleur: '#0d9488' },
    archief:        { label: 'ARCHIEF',     kleur: '#64748b' }
};

const FALLBACK_VOLGORDE = ['acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'];

// ============================================
// DYNAMISCHE FASE HELPERS
// ============================================

/**
 * Haal fase configuratie op uit faseService.
 * Returns object met per fase: label, kleur, bgKleur, textKleur, borderKleur
 */
function getFaseConfig() {
    const fases = faseService.fases;

    // Als faseService geladen is, bouw config dynamisch
    if (fases && fases.length > 0) {
        const config = {};
        fases.forEach(fc => {
            const kleur = fc.kleur || '#64748b';
            config[fc.fase] = {
                label: (fc.naam_display || fc.fase).toUpperCase(),
                kleur: kleur,
                bgKleur: maakBgKleur(kleur),
                textKleur: maakTextKleur(kleur),
                borderKleur: maakBorderKleur(kleur)
            };
        });
        return config;
    }

    // Fallback: bouw van defaults
    const config = {};
    for (const [fase, fb] of Object.entries(FALLBACK_CONFIG)) {
        config[fase] = {
            label: fb.label,
            kleur: fb.kleur,
            bgKleur: maakBgKleur(fb.kleur),
            textKleur: maakTextKleur(fb.kleur),
            borderKleur: maakBorderKleur(fb.kleur)
        };
    }
    return config;
}

/**
 * Haal fase volgorde op uit faseService.
 */
function getFaseVolgorde() {
    const fases = faseService.fases;
    if (fases && fases.length > 0) {
        return fases
            .sort((a, b) => a.volgorde - b.volgorde)
            .map(fc => fc.fase);
    }
    return FALLBACK_VOLGORDE;
}

/**
 * Haal dropdown labels op (fase → display naam).
 */
function getFaseDropdownLabels() {
    const fases = faseService.fases;
    if (fases && fases.length > 0) {
        const labels = {};
        fases.forEach(fc => {
            labels[fc.fase] = (fc.naam_display || fc.fase).toUpperCase();
        });
        return labels;
    }
    // Fallback
    const labels = {};
    for (const [fase, fb] of Object.entries(FALLBACK_CONFIG)) {
        labels[fase] = fb.label;
    }
    return labels;
}

// ============================================
// BACKWARDS-COMPATIBLE EXPORTS
// (dynamisch — altijd actuele waarden)
// ============================================

/** @deprecated Gebruik getFaseConfig() voor actuele waarden */
export const FASE_CONFIG = new Proxy({}, {
    get(_, prop) {
        return getFaseConfig()[prop];
    },
    ownKeys() {
        return Object.keys(getFaseConfig());
    },
    getOwnPropertyDescriptor(_, prop) {
        const config = getFaseConfig();
        if (prop in config) {
            return { value: config[prop], writable: false, enumerable: true, configurable: true };
        }
    },
    has(_, prop) {
        return prop in getFaseConfig();
    }
});

/** @deprecated Gebruik getFaseVolgorde() voor actuele waarden */
export const FASE_VOLGORDE = getFaseVolgorde();

/** @deprecated Gebruik getFaseDropdownLabels() voor actuele waarden */
export const FASE_DROPDOWN_LABELS = new Proxy({}, {
    get(_, prop) {
        return getFaseDropdownLabels()[prop];
    },
    ownKeys() {
        return Object.keys(getFaseDropdownLabels());
    },
    getOwnPropertyDescriptor(_, prop) {
        const labels = getFaseDropdownLabels();
        if (prop in labels) {
            return { value: labels[prop], writable: false, enumerable: true, configurable: true };
        }
    },
    has(_, prop) {
        return prop in getFaseDropdownLabels();
    }
});

// ============================================
// ICON HELPER
// ============================================

function getIcon(name, size = 14, color = null) {
    if (window.Icons && typeof window.Icons[name] === 'function') {
        const opts = { size };
        if (color) opts.color = color;
        return window.Icons[name](opts);
    }
    return '';
}

// ============================================
// TENDER CARD HEADER CLASS
// ============================================

export class TenderCardHeader {
    /**
     * @param {Object} options
     * @param {Object}  options.tender            - Tender data object
     * @param {Object}  options.allFaseStatussen   - Status opties per fase { fase: [{ status_key, status_display }] }
     * @param {string}  options.size               - 'default' of 'compact'
     * @param {boolean} options.showActions         - Toon actie-knoppen
     * @param {boolean} options.showStatusDropdown  - Toon status dropdown
     */
    constructor(options = {}) {
        this.tender = options.tender || {};
        this.allFaseStatussen = options.allFaseStatussen || {};
        this.size = options.size || 'default';
        this.showActions = options.showActions !== undefined ? options.showActions : (this.size === 'default');
        this.showStatusDropdown = options.showStatusDropdown !== undefined ? options.showStatusDropdown : (this.size === 'default');
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    render() {
        const sizeClass = this.size === 'compact' ? 'tch--compact' : '';
        const tender = this.tender;
        const fase = tender.fase || 'acquisitie';

        // ⭐ v2.0: Dynamische config
        const faseConfig = getFaseConfig();
        const config = faseConfig[fase] || { label: fase.toUpperCase(), kleur: '#64748b', bgKleur: '#f1f5f9', textKleur: '#475569', borderKleur: '#94a3b8' };

        // Inline styles voor dynamische kleuren
        const badgeStyle = `background-color:${config.bgKleur};color:${config.textKleur};border-color:${config.borderKleur}`;

        return `
            <div class="tch ${sizeClass}" data-tender-id="${tender.id}">
                <div class="tch-left">
                    <span class="tch-fase-badge" style="${badgeStyle}">${config.label}</span>
                    ${this.showStatusDropdown ? this._renderStatusDropdown() : ''}
                </div>
                ${this.showActions ? `
                    <div class="tch-right">
                        <button class="tch-action-btn tch-action-btn--ai" 
                                data-action="open-ai-docs"
                                data-tender-id="${tender.id}" 
                                title="AI Documenten">
                            ${getIcon('ai', 18)}
                        </button>
                        <button class="tch-action-btn tch-action-btn--settings" 
                                data-action="open-settings"
                                data-tender-id="${tender.id}" 
                                title="Tender instellingen">
                            ${getIcon('settings', 18)}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // STATUS DROPDOWN
    // ============================================

    _renderStatusDropdown() {
        const tender = this.tender;
        const currentStatus = tender.fase_status || tender.status;
        const currentFase = tender.fase;

        // Zoek display naam van huidige status
        let currentStatusDisplay = currentStatus || '';
        for (const [fase, statussen] of Object.entries(this.allFaseStatussen)) {
            const found = statussen.find(s => s.status_key === currentStatus);
            if (found) {
                currentStatusDisplay = found.status_display;
                break;
            }
        }

        // ⭐ v2.0: Dynamische volgorde en labels
        const faseVolgorde = getFaseVolgorde();
        const dropdownLabels = getFaseDropdownLabels();
        const faseConfig = getFaseConfig();

        // Bouw opties HTML per fase
        let optionsHtml = '';
        for (const fase of faseVolgorde) {
            const statussen = this.allFaseStatussen[fase] || [];
            if (statussen.length > 0) {
                // ⭐ v2.0: Label kleur inline vanuit config
                const labelKleur = faseConfig[fase]?.textKleur || '#64748b';
                optionsHtml += `
                    <div class="tch-dropdown-group" data-fase="${fase}">
                        <div class="tch-dropdown-label" style="color:${labelKleur}">${dropdownLabels[fase] || fase.toUpperCase()}</div>`;
                for (const status of statussen) {
                    const isSelected = status.status_key === currentStatus;
                    const isSpecial = ['gewonnen', 'verloren'].includes(status.status_key);
                    optionsHtml += `
                        <div class="tch-dropdown-option ${isSelected ? 'is-selected' : ''} ${isSpecial ? 'tch-status--' + status.status_key : ''}" 
                             data-value="${status.status_key}" 
                             data-fase="${fase}">
                            ${status.status_display}
                        </div>`;
                }
                optionsHtml += `</div>`;
            }
        }

        return `
            <div class="tch-status-dropdown" data-tender-id="${tender.id}" data-current-fase="${currentFase}">
                <button class="tch-status-trigger" type="button">
                    <span class="tch-status-value">${currentStatusDisplay}</span>
                    ${getIcon('chevronDown', 14, '#64748b')}
                </button>
                <div class="tch-status-menu">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }
}