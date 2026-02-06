/**
 * TenderCardBody â€” Herbruikbaar body component voor tender kaarten
 * TenderZen v1.0
 *
 * Bevat: Tender naam, AI badge, info lines (opdrachtgever, inschrijver, bureau)
 * Twee formaten: 'default' (lijstweergave) en 'compact' (kanban/planning)
 *
 * Gebruik:
 *   import { TenderCardBody } from './TenderCardBody.js';
 *
 *   const body = new TenderCardBody({
 *       tender: tenderObject,
 *       searchQuery: 'zoekterm',
 *       size: 'default'
 *   });
 *
 *   html += body.render();
 */

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
// TENDER CARD BODY CLASS
// ============================================

export class TenderCardBody {
    /**
     * @param {Object} options
     * @param {Object}  options.tender       - Tender data object
     * @param {string}  options.searchQuery  - Zoekterm voor highlighting
     * @param {string}  options.size         - 'default' of 'compact'
     * @param {boolean} options.showBureau   - Toon bureau regel (default: true voor default, false voor compact)
     */
    constructor(options = {}) {
        this.tender = options.tender || {};
        this.searchQuery = options.searchQuery || '';
        this.size = options.size || 'default';
        this.showBureau = options.showBureau !== undefined ? options.showBureau : (this.size === 'default');
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    render() {
        const sizeClass = this.size === 'compact' ? 'tcb--compact' : '';
        const tender = this.tender;

        return `
            <div class="tcb ${sizeClass}" data-tender-id="${tender.id}">
                <div class="tcb-name-row">
                    <h3 class="tcb-name">${this._highlight(tender.naam || 'Geen naam')}</h3>
                    ${this._renderAIBadge()}
                </div>

                <div class="tcb-info">
                    ${tender.opdrachtgever ? `
                        <div class="tcb-info-line tcb-info-line--opdrachtgever">
                            ${getIcon('building', this.size === 'compact' ? 12 : 14, '#94a3b8')}
                            <span>${this._highlight(tender.opdrachtgever)}</span>
                        </div>
                    ` : ''}

                    ${tender.bedrijfsnaam ? `
                        <div class="tcb-info-line tcb-info-line--inschrijver">
                            ${getIcon('hardhat', this.size === 'compact' ? 12 : 14, '#7c3aed')}
                            <span>Inschrijver: <strong>${this._highlight(tender.bedrijfsnaam)}</strong></span>
                        </div>
                    ` : ''}

                    ${this.showBureau && (tender.tenderbureau_naam || tender.tenderbureaus?.naam) ? `
                        <div class="tcb-info-line tcb-info-line--bureau">
                            ${getIcon('edit', this.size === 'compact' ? 12 : 14, '#94a3b8')}
                            <span>Bureau: ${this._highlight(tender.tenderbureau_naam || tender.tenderbureaus?.naam)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // ============================================
    // AI BADGE (3 states: new / haiku / pro)
    // ============================================

    _renderAIBadge() {
        const tender = this.tender;
        const hasAnalysis = !!tender.smart_import_id;
        const modelUsed = tender.ai_model_used || 'haiku';
        const isPro = modelUsed === 'sonnet' || (modelUsed && modelUsed.includes('sonnet'));

        let badgeClass, label, tooltip;

        if (!hasAnalysis) {
            badgeClass = 'tcb-ai-badge tcb-ai-badge--new';
            label = `${getIcon('sparkles', 12, 'currentColor')} AI`;
            tooltip = 'Start AI analyse - Upload documenten om automatisch gegevens te extraheren';
        } else if (isPro) {
            badgeClass = 'tcb-ai-badge tcb-ai-badge--pro';
            label = `${getIcon('zap', 12, 'currentColor')} AI Pro`;
            tooltip = 'Geanalyseerd met AI Pro - Klik voor details';
        } else {
            badgeClass = 'tcb-ai-badge tcb-ai-badge--haiku';
            label = `${getIcon('sparkles', 12, 'currentColor')} AI`;
            tooltip = 'Geanalyseerd met AI - Klik voor details of upgrade naar Pro';
        }

        return `
            <button class="${badgeClass}" 
                    data-action="open-ai"
                    data-tender-id="${tender.id}"
                    data-smart-import-id="${tender.smart_import_id || ''}"
                    data-has-analysis="${hasAnalysis}"
                    title="${tooltip}">
                ${label}
            </button>
        `;
    }

    // ============================================
    // HELPERS
    // ============================================

    _highlight(text) {
        if (!text) return '';
        const escaped = this._esc(text);
        if (!this.searchQuery) return escaped;
        const escapedQuery = this.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escaped.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    _esc(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}