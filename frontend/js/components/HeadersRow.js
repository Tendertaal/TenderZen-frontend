/**
 * HeadersRow Component
 * TenderZen v2.1
 * 
 * CHANGELOG v2.1:
 * - ⭐ Team en Status kolommen verwijderd (nu in card)
 * - Alleen Aanbesteding + Timeline kolommen
 */

// Referentie naar globale Icons
const Icons = window.Icons || {};

export class HeadersRow {
    constructor(options = {}) {
        this.onSort = options.onSort || null;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.element = null;
    }

    /**
     * Get icon HTML
     */
    getIcon(name, size = 14) {
        if (Icons && typeof Icons[name] === 'function') {
            return Icons[name]({ size });
        }
        return '';
    }

    /**
     * Render the headers row
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'headers-row';
        
        this.element.innerHTML = `
            <!-- Aanbesteding kolom -->
            <div class="header-cell header-aanbesteding">
                ${this.getIcon('clipboardList', 14)}
                <span>Aanbesteding</span>
            </div>
            
            <!-- Timeline kolommen -->
            <div class="header-cell header-timeline sortable" data-column="publicatie_datum">
                ${this.getIcon('calendarView', 14)}
                <span>Publicatie</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="schouw_datum">
                ${this.getIcon('eye', 14)}
                <span>Schouw</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="nvi1_datum">
                ${this.getIcon('info', 14)}
                <span>NVI 1</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="nvi2_datum">
                ${this.getIcon('info', 14)}
                <span>NVI 2</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="presentatie_datum">
                ${this.getIcon('users', 14)}
                <span>Presentatie</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="interne_deadline">
                ${this.getIcon('clock', 14)}
                <span>Intern</span>
            </div>
            
            <div class="header-cell header-timeline header-deadline sortable" data-column="deadline_indiening">
                ${this.getIcon('zap', 14)}
                <span>Deadline</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="voorlopige_gunning">
                ${this.getIcon('checkCircle', 14)}
                <span>Voorl. Gunning</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="definitieve_gunning">
                ${this.getIcon('checkCircle', 14)}
                <span>Def. Gunning</span>
            </div>
            
            <div class="header-cell header-timeline sortable" data-column="start_uitvoering">
                ${this.getIcon('play', 14)}
                <span>Start</span>
            </div>
        `;

        this.attachEventListeners();
        return this.element;
    }

    /**
     * Attach event listeners for sorting
     */
    attachEventListeners() {
        this.element.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                
                // Toggle direction if same column
                if (this.sortColumn === column) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = column;
                    this.sortDirection = 'asc';
                }

                // Update visual state
                this.updateSortIndicators(header);

                // Trigger callback
                if (this.onSort) {
                    this.onSort(column, this.sortDirection);
                }
            });
        });
    }

    /**
     * Update sort indicators
     */
    updateSortIndicators(activeHeader) {
        // Remove all sort classes
        this.element.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
        });

        // Add sort class to active header
        activeHeader.classList.add(`sorted-${this.sortDirection}`);
    }
}

export default HeadersRow;