/**
 * IngediendView - Toont alleen ingediende tenders
 */

import { TenderListView } from './TenderListView.js';

export class IngediendView extends TenderListView {
    constructor() {
        super({
            name: 'IngediendView',
            fase: 'ingediend'
        });
    }

    /**
     * Override empty state for ingediend
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📬</div>
                <h3 class="empty-state-title">Geen ingediende tenders</h3>
                <p class="empty-state-text">
                    Er zijn momenteel geen tenders die zijn ingediend en wachten op gunning.
                </p>
            </div>
        `;
    }
}

export default IngediendView;