/**
 * HeadersRow Component
 * TenderZen v2.4
 * 
 * CHANGELOG v2.4:
 * - ✅ Chevron iconen (chevronUp/chevronDown) voor sortering
 * - ✅ header-timeline-wrapper matcht section-timeline (flex: 1)
 * - ✅ Aanbesteding 450px matcht section-aanbesteding
 * - ✅ Timeline kolommen 110px matcht timeline-cell
 * 
 * STRUCTUUR (matcht tender cards):
 * .headers-row
 * ├── .column-header.aanbesteding (450px)
 * └── .header-timeline-wrapper (flex: 1)
 *     └── 10x .column-header.timeline (110px)
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
            <!-- Aanbesteding kolom - matcht section-aanbesteding (450px) -->
            <div class="column-header aanbesteding">
                ${this.getIcon('clipboardList', 14)}
                <span>Aanbesteding</span>
            </div>
            
            <!-- Timeline wrapper - matcht section-timeline (flex: 1) -->
            <div class="header-timeline-wrapper">
                <div class="column-header timeline sortable" data-column="publicatie_datum">
                    ${this.getIcon('calendar', 14)}
                    <span>Publicatie</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="schouw_datum">
                    ${this.getIcon('eye', 14)}
                    <span>Schouw</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="nvi1_datum">
                    ${this.getIcon('info', 14)}
                    <span>NVI 1</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="nvi2_datum">
                    ${this.getIcon('info', 14)}
                    <span>NVI 2</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="presentatie_datum">
                    ${this.getIcon('users', 14)}
                    <span>Presentatie</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="interne_deadline">
                    ${this.getIcon('clock', 14)}
                    <span>Intern</span>
                </div>
                
                <div class="column-header timeline critical sortable" data-column="deadline_indiening">
                    ${this.getIcon('zap', 14)}
                    <span>Deadline</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="voorlopige_gunning">
                    ${this.getIcon('checkCircle', 14)}
                    <span>Voorl. Gunning</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="definitieve_gunning">
                    ${this.getIcon('checkCircle', 14)}
                    <span>Def. Gunning</span>
                </div>
                
                <div class="column-header timeline sortable" data-column="start_uitvoering">
                    ${this.getIcon('play', 14)}
                    <span>Start</span>
                </div>
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
     * Update sort indicators - gebruikt chevronUp/chevronDown iconen
     */
    updateSortIndicators(activeHeader) {
        // Remove all sort classes and icons
        this.element.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
            const oldIcon = header.querySelector('.sort-icon');
            if (oldIcon) oldIcon.remove();
        });

        // Add sort class and icon to active header
        activeHeader.classList.add(`sorted-${this.sortDirection}`);
        
        // Add chevron icon
        const iconName = this.sortDirection === 'asc' ? 'chevronUp' : 'chevronDown';
        const iconHtml = this.getIcon(iconName, 14);
        if (iconHtml) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'sort-icon';
            iconSpan.innerHTML = iconHtml;
            activeHeader.appendChild(iconSpan);
        }
    }
}

export default HeadersRow;