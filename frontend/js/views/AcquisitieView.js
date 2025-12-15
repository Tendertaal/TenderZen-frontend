/**
 * AcquisitieView - Toont alleen tenders in acquisitie fase
 */

import { TenderListView } from './TenderListView.js';

export class AcquisitieView extends TenderListView {
    constructor() {
        super({
            name: 'AcquisitieView',
            fase: 'acquisitie'
        });
    }

    /**
     * Override empty state for acquisitie
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">🎯</div>
                <h3 class="empty-state-title">Geen acquisitie tenders</h3>
                <p class="empty-state-text">
                    Er zijn momenteel geen tenders in de acquisitie fase.
                </p>
            </div>
        `;
    }
}

export default AcquisitieView;