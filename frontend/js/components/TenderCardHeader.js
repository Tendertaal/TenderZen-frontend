/**
 * TenderCardHeader — Herbruikbaar header component voor tender kaarten
 * TenderZen v1.1
 *
 * DOEL-PAD:  Frontend/js/components/TenderCardHeader.js
 *
 * CHANGELOG v1.1:
 * - Fase "evaluatie" toegevoegd (label: AFRONDEN, kleur: teal)
 *
 * Bevat: Fase badge, Status dropdown, Actie-knoppen (AI doc, instellingen)
 * Twee formaten: 'default' (lijstweergave) en 'compact' (kanban/planning)
 */

// ============================================
// FASE CONFIGURATIE
// ============================================

export const FASE_CONFIG = {
    acquisitie: {
        label: 'ACQUISITIE',
        kleur: '#ea580c',
        bgKleur: '#fef3c7',
        textKleur: '#92400e',
        borderKleur: '#f59e0b',
        iconName: 'search'
    },
    inschrijvingen: {
        label: 'LOPEND',
        kleur: '#2563eb',
        bgKleur: '#ede9fe',
        textKleur: '#5b21b6',
        borderKleur: '#8b5cf6',
        iconName: 'edit'
    },
    ingediend: {
        label: 'INGEDIEND',
        kleur: '#16a34a',
        bgKleur: '#d1fae5',
        textKleur: '#065f46',
        borderKleur: '#10b981',
        iconName: 'checkCircle'
    },
    evaluatie: {
        label: 'AFRONDEN',
        kleur: '#0d9488',
        bgKleur: '#ccfbf1',
        textKleur: '#115e59',
        borderKleur: '#14b8a6',
        iconName: 'clock'
    },
    archief: {
        label: 'ARCHIEF',
        kleur: '#64748b',
        bgKleur: '#f1f5f9',
        textKleur: '#475569',
        borderKleur: '#94a3b8',
        iconName: 'archive'
    }
};

export const FASE_VOLGORDE = ['acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'];

export const FASE_DROPDOWN_LABELS = {
    acquisitie: 'ACQUISITIE',
    inschrijvingen: 'LOPEND',
    ingediend: 'INGEDIEND',
    evaluatie: 'AFRONDEN',
    archief: 'ARCHIEF'
};

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
     * @param {boolean} options.showActions         - Toon actie-knoppen (default: true voor default, false voor compact)
     * @param {boolean} options.showStatusDropdown  - Toon status dropdown (default: true voor default, false voor compact)
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
        const config = FASE_CONFIG[fase] || FASE_CONFIG.acquisitie;

        return `
            <div class="tch ${sizeClass}" data-tender-id="${tender.id}">
                <div class="tch-left">
                    <span class="tch-fase-badge tch-fase-badge--${fase}">${config.label}</span>
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

        // Bouw opties HTML per fase
        let optionsHtml = '';
        for (const fase of FASE_VOLGORDE) {
            const statussen = this.allFaseStatussen[fase] || [];
            if (statussen.length > 0) {
                optionsHtml += `
                    <div class="tch-dropdown-group" data-fase="${fase}">
                        <div class="tch-dropdown-label">${FASE_DROPDOWN_LABELS[fase]}</div>`;
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