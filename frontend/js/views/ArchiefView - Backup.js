/**
 * ArchiefView - Toont alleen gearchiveerde tenders
 * 
 * Statussen in archief:
 * - Gewonnen (groen)
 * - Verloren (rood)
 * - Ingetrokken (grijs)
 * - Afgezien (grijs)
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
     * Override empty state for archief
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <h3 class="empty-state-title">Archief is leeg</h3>
                <p class="empty-state-text">
                    Er zijn nog geen afgeronde tenders in het archief.<br>
                    Tenders komen hier terecht wanneer ze gewonnen, verloren, ingetrokken of afgezien zijn.
                </p>
            </div>
        `;
    }
}

export default ArchiefView;