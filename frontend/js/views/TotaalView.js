/**
 * TotaalView - Toont alle ACTIEVE tenders (exclusief archief)
 * 
 * Let op: fase = null maar we filteren archief eruit
 */

import { TenderListView } from './TenderListView.js';

export class TotaalView extends TenderListView {
    constructor() {
        super({
            name: 'TotaalView',
            fase: null // null = alle fases, maar we overriden filterTenders
        });
    }

    /**
     * Override filterTenders to exclude archived tenders,
     * maar respecteer multi-select faseFilter vanuit FaseBar.
     */
    filterTenders(tenders) {
        if (!tenders) return [];

        // FaseBar multi-select heeft prioriteit (inclusief archief als geselecteerd)
        if (this.faseFilter && this.faseFilter.length > 0) {
            return tenders.filter(t => this.faseFilter.includes(t.fase));
        }

        // Default: alle actieve tenders (exclusief archief)
        return tenders.filter(t => t.fase !== 'archief');
    }

    /**
     * Override empty state for totaal
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📋</div>
                <h3 class="empty-state-title">Geen actieve tenders</h3>
                <p class="empty-state-text">
                    Er zijn momenteel geen actieve tenders.<br>
                    Klik op "Nieuwe Tender" om er een aan te maken.
                </p>
            </div>
        `;
    }
}

export default TotaalView;