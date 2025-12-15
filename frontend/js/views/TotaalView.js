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
     * Override filterTenders to exclude archived tenders
     */
    filterTenders(tenders) {
        if (!tenders) return [];
        
        // Filter out archived tenders - totaaloverzicht toont alleen actieve tenders
        return tenders.filter(tender => tender.fase !== 'archief');
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