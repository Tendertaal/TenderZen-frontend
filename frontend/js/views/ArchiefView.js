/**
 * ArchiefView - Toont alle gearchiveerde tenders
 * TenderZen v1.0
 * 
 * Statussen in archief:
 * - gewonnen: Tender gewonnen - opdracht gegund
 * - verloren: Tender verloren - niet gegund
 * - ingetrokken: Aanbesteding ingetrokken door opdrachtgever
 * - afgezien: Wij hebben afgezien van inschrijving (No-Go)
 */

import { TenderListView } from './TenderListView.js';

export class ArchiefView extends TenderListView {
    constructor() {
        super({
            name: 'ArchiefView',
            fase: 'archief'
        });
    }

    /**
     * Override filterTenders to only show archived tenders
     */
    filterTenders(tenders) {
        if (!tenders) return [];
        
        return tenders.filter(tender => tender.fase === 'archief');
    }

    /**
     * Override empty state for archief
     */
    renderEmptyState() {
        const Icons = window.Icons || {};
        
        return `
            <div class="empty-state">
                <div class="empty-state-icon">
                    ${Icons.archive ? Icons.archive({ size: 48, color: '#64748b' }) : '📦'}
                </div>
                <h3>Geen gearchiveerde tenders</h3>
                <p>Tenders die zijn afgerond (gewonnen, verloren, of No-Go) verschijnen hier.</p>
            </div>
        `;
    }
}

export default ArchiefView;