/**
 * ZoekresultatenView - Globale zoekresultaten over alle tenders
 * TenderZen v1.0
 * 
 * Deze view toont zoekresultaten over ALLE fases (inclusief archief).
 * Extends TenderListView voor hergebruik van card rendering.
 * 
 * Features:
 * - Doorzoekt alle tenders ongeacht fase
 * - Sorteert op relevantie (exacte match eerst) + datum
 * - Volledige tender cards
 * - Platte lijst zonder groepering
 */

import { TenderListView } from './TenderListView.js';

export class ZoekresultatenView extends TenderListView {
    constructor(options = {}) {
        // Geen fase filter meegeven
        super({ ...options, fase: null });
        
        this.viewName = 'zoekresultaten';
        this.previousView = options.previousView || 'totaal';
    }

    /**
     * Override: Filter tenders - geen fase filter, alleen zoekquery
     * Plus: sorteer op relevantie
     */
    filterTenders(tenders) {
        let filtered = [...tenders];

        // GEEN fase filter - doorzoek alles

        // Filter op zoekquery (meerdere velden)
        if (this.searchQuery) {
            const query = this.searchQuery;
            filtered = filtered.filter(tender => {
                const searchFields = [
                    tender.naam,
                    tender.opdrachtgever,
                    tender.aanbestedende_dienst,
                    tender.locatie,
                    tender.tender_nummer,
                    tender.bedrijfsnaam,
                    tender.beschrijving
                ];
                
                return searchFields.some(field => 
                    field && field.toLowerCase().includes(query)
                );
            });

            // Sorteer op relevantie + datum
            filtered = this.sortByRelevance(filtered, query);
        }

        return filtered;
    }

    /**
     * Sorteer resultaten op relevantie
     * 1. Exacte match in naam (hoogste prioriteit)
     * 2. Naam begint met zoekterm
     * 3. Naam bevat zoekterm
     * 4. Match in andere velden
     * Bij gelijke relevantie: sorteer op updated_at (nieuwste eerst)
     */
    sortByRelevance(tenders, query) {
        return tenders.sort((a, b) => {
            const scoreA = this.getRelevanceScore(a, query);
            const scoreB = this.getRelevanceScore(b, query);
            
            // Hogere score = relevanter
            if (scoreA !== scoreB) {
                return scoreB - scoreA;
            }
            
            // Bij gelijke score: sorteer op datum (nieuwste eerst)
            const dateA = new Date(a.updated_at || a.created_at || 0);
            const dateB = new Date(b.updated_at || b.created_at || 0);
            return dateB - dateA;
        });
    }

    /**
     * Bereken relevantie score voor een tender
     */
    getRelevanceScore(tender, query) {
        let score = 0;
        const naam = (tender.naam || '').toLowerCase();
        
        // Exacte match in naam: +100
        if (naam === query) {
            score += 100;
        }
        // Naam begint met zoekterm: +50
        else if (naam.startsWith(query)) {
            score += 50;
        }
        // Naam bevat zoekterm: +25
        else if (naam.includes(query)) {
            score += 25;
        }
        
        // Match in opdrachtgever: +15
        if ((tender.opdrachtgever || '').toLowerCase().includes(query)) {
            score += 15;
        }
        
        // Match in bedrijfsnaam: +10
        if ((tender.bedrijfsnaam || '').toLowerCase().includes(query)) {
            score += 10;
        }
        
        // Match in locatie: +5
        if ((tender.locatie || '').toLowerCase().includes(query)) {
            score += 5;
        }
        
        // Match in beschrijving: +3
        if ((tender.beschrijving || '').toLowerCase().includes(query)) {
            score += 3;
        }
        
        // Match in tender_nummer: +2
        if ((tender.tender_nummer || '').toLowerCase().includes(query)) {
            score += 2;
        }
        
        return score;
    }

    /**
     * Override: Render empty state specifiek voor zoekresultaten
     */
    renderEmptyState() {
        const Icons = window.Icons;
        
        return `
            <div class="empty-state empty-state--search">
                <div class="empty-state-icon">
                    ${Icons?.search ? Icons.search({ size: 64, color: '#cbd5e1' }) : '🔍'}
                </div>
                <div class="empty-state-title">Zoek een tender</div>
                <div class="empty-state-text">
                    Typ een zoekterm in het zoekveld hierboven om tenders te vinden.
                </div>
            </div>
        `;
    }

    /**
     * Override: Render no search results state
     */
    renderNoSearchResults() {
        const Icons = window.Icons;
        
        return `
            <div class="empty-state empty-state--no-results">
                <div class="empty-state-icon">
                    ${Icons?.searchX ? Icons.searchX({ size: 64, color: '#cbd5e1' }) : '🔍'}
                </div>
                <div class="empty-state-title">Geen resultaten gevonden</div>
                <div class="empty-state-text">
                    Er zijn geen tenders gevonden voor "<strong>${this.escapeHtml(this.searchQuery)}</strong>"
                </div>
                <div class="empty-state-hint">
                    <p>Tips:</p>
                    <ul>
                        <li>Controleer de spelling</li>
                        <li>Probeer andere zoektermen</li>
                        <li>Gebruik minder specifieke termen</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * Set previous view (voor terug navigatie)
     */
    setPreviousView(viewName) {
        this.previousView = viewName;
    }

    /**
     * Get previous view
     */
    getPreviousView() {
        return this.previousView;
    }
}

export default ZoekresultatenView;