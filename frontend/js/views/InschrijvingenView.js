/**
 * InschrijvingenView - Toont alleen tenders in inschrijvingen fase
 */

import { TenderListView } from './TenderListView.js';

export class InschrijvingenView extends TenderListView {
    constructor() {
        super({
            name: 'InschrijvingenView',
            fase: 'inschrijvingen'
        });
    }

    /**
     * Override empty state for inschrijvingen
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">✍️</div>
                <h3 class="empty-state-title">Geen actieve inschrijvingen</h3>
                <p class="empty-state-text">
                    Er zijn momenteel geen tenders in de inschrijvingen fase.
                </p>
            </div>
        `;
    }
}

export default InschrijvingenView;