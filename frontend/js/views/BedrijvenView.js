/**
 * BedrijvenView - Overzicht en beheer van bedrijven/opdrachtgevers
 * TenderZen v3.0 - Professionele versie met externe CSS
 * 
 * CSS: Gebruikt /css/table-view.css voor styling
 * Geen inline getStyles() - alle styling via externe CSS
 * 
 * CHANGELOG:
 * - v3.0: Refactored naar externe CSS met BEM naming
 */

import { BaseView } from './BaseView.js';

const Icons = window.Icons || {};

export class BedrijvenView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.bedrijven = [];
        this.filteredBedrijven = [];
        this.filters = {
            search: '',
            branche: null,
            plaats: null
        };
        this.sortColumn = 'naam';
        this.sortDirection = 'asc';

        this.branches = [];
        this.plaatsen = [];

        this.onCreateBedrijf = null;
        this.onEditBedrijf = null;
        this.onDeleteBedrijf = null;
    }

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    async setBedrijven(bedrijven) {
        this.bedrijven = bedrijven || [];
        this.extractFilterOptions();
        this.applyFilters();
        this.updateHeaderContext();

        if (this.container) {
            this.render();
        }
    }

    extractFilterOptions() {
        const brancheSet = new Set();
        const plaatsSet = new Set();

        this.bedrijven.forEach(b => {
            if (b.branche) brancheSet.add(b.branche);
            if (b.plaats) plaatsSet.add(b.plaats);
        });

        this.branches = Array.from(brancheSet).sort();
        this.plaatsen = Array.from(plaatsSet).sort();
    }

    async reload() {
        try {
            const { bedrijvenService } = await import('../services/Bedrijvenservice.js');
            const bedrijven = await bedrijvenService.getAllBedrijven();
            await this.setBedrijven(bedrijven);
        } catch (error) {
            console.error('Error reloading bedrijven:', error);
        }
    }

    updateHeaderContext() {
        if (window.app?.header) {
            window.app.header.setContext('bedrijven', {
                count: this.filteredBedrijven.length,
                filters: this.filters,
                filterOptions: {
                    branches: this.branches,
                    plaatsen: this.plaatsen
                },
                onAdd: () => {
                    if (this.onCreateBedrijf) this.onCreateBedrijf();
                },
                onFilterChange: (filterType, value) => {
                    if (filterType === 'search') {
                        this.setSearch(value);
                    } else if (filterType === 'filter1') {
                        this.setBrancheFilter(value || null);
                    } else if (filterType === 'filter2') {
                        this.setPlaatsFilter(value || null);
                    }
                },
                onResetFilters: () => {
                    this.resetFilters();
                }
            });
        }
    }

    applyFilters() {
        let filtered = [...this.bedrijven];

        if (this.filters.search) {
            const query = this.filters.search.toLowerCase();
            filtered = filtered.filter(b =>
                (b.naam || b.bedrijfsnaam)?.toLowerCase().includes(query) ||
                b.contactpersoon?.toLowerCase().includes(query) ||
                (b.email || b.contact_email)?.toLowerCase().includes(query) ||
                b.plaats?.toLowerCase().includes(query)
            );
        }

        if (this.filters.branche) {
            filtered = filtered.filter(b => b.branche === this.filters.branche);
        }

        if (this.filters.plaats) {
            filtered = filtered.filter(b => b.plaats === this.filters.plaats);
        }

        filtered.sort((a, b) => {
            let valA = a[this.sortColumn] || (this.sortColumn === 'naam' ? a.bedrijfsnaam : null) || '';
            let valB = b[this.sortColumn] || (this.sortColumn === 'naam' ? b.bedrijfsnaam : null) || '';

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            let result = valA < valB ? -1 : valA > valB ? 1 : 0;
            return this.sortDirection === 'desc' ? -result : result;
        });

        this.filteredBedrijven = filtered;
    }

    setSearch(query) {
        this.filters.search = query;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    setBrancheFilter(branche) {
        this.filters.branche = branche;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    setPlaatsFilter(plaats) {
        this.filters.plaats = plaats;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    resetFilters() {
        this.filters = { search: '', branche: null, plaats: null };
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.applyFilters();
        this.render();
    }

    /**
     * Main render - Gebruikt externe CSS classes (table-view.css)
     */
    render() {
        if (!this.container) return;

        const sortIcon = (col) => {
            if (this.sortColumn !== col) return '';
            return this.sortDirection === 'asc'
                ? this.getIcon('chevronUp', 12)
                : this.getIcon('chevronDown', 12);
        };

        const sortableClass = (col) => {
            let classes = 'table-view__col table-view__col--sortable';
            if (this.sortColumn === col) classes += ' table-view__col--sorted';
            return classes;
        };

        this.container.innerHTML = `
            <div class="table-view bedrijven-view">
                <div class="table-view__headers">
                    <div class="${sortableClass('naam')} table-view__col--main" data-sort="naam">
                        ${this.getIcon('building', 14)}
                        <span>Bedrijf</span>
                        ${sortIcon('naam')}
                    </div>
                    <div class="${sortableClass('plaats')} table-view__col--md" data-sort="plaats">
                        <span>Locatie</span>
                        ${sortIcon('plaats')}
                    </div>
                    <div class="${sortableClass('bureau_naam')} table-view__col--md" data-sort="bureau_naam">
                        ${this.getIcon('home', 14)}
                        <span>Tenderbureau</span>
                        ${sortIcon('bureau_naam')}
                    </div>
                    <div class="${sortableClass('contactpersoon')} table-view__col--md" data-sort="contactpersoon">
                        ${this.getIcon('user', 14)}
                        <span>Contactpersoon</span>
                        ${sortIcon('contactpersoon')}
                    </div>
                    <div class="table-view__col table-view__col--sm">
                        <span>Branche</span>
                    </div>
                    <div class="table-view__col table-view__col--sm">
                        <span>Rating</span>
                    </div>
                    <div class="table-view__col table-view__col--sm">
                        ${this.getIcon('fileText', 14)}
                        <span>Tenders</span>
                    </div>
                </div>
                <div class="table-view__body">
                    ${this.filteredBedrijven.length > 0
                ? this.filteredBedrijven.map(b => this.renderDataRow(b)).join('')
                : this.renderEmptyState()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderDataRow(bedrijf) {
        const naam = bedrijf.naam || bedrijf.bedrijfsnaam || 'Onbekend';
        const initials = this.generateInitials(naam);
        const rating = bedrijf.rating || 0;
        const tenderCount = bedrijf.tender_count || 0;
        const bureauNaam = bedrijf.bureau_naam || bedrijf.tenderbureau?.naam || '-';

        const brancheColors = {
            'Bouw': '#3b82f6',
            'Techniek': '#10b981',
            'Infra': '#8b5cf6',
            'ICT': '#06b6d4',
            'Zorg': '#ec4899',
            'Overheid': '#f59e0b',
            'Onderwijs': '#6366f1',
            'Energie': '#22c55e'
        };
        const brancheColor = brancheColors[bedrijf.branche] || '#64748b';

        return `
            <div class="table-view__row" data-bedrijf-id="${bedrijf.id}">
                <div class="table-view__col table-view__col--main">
                    <div class="table-view__avatar" style="background: ${brancheColor}">
                        ${initials}
                    </div>
                    <div class="table-view__info">
                        <div class="table-view__name">${naam}</div>
                        <div class="table-view__meta">${bedrijf.kvk_nummer ? `KvK: ${bedrijf.kvk_nummer}` : (bedrijf.email || bedrijf.contact_email || '')}</div>
                    </div>
                </div>
                <div class="table-view__col table-view__col--md">
                    <span class="table-view__text">${bedrijf.plaats || '-'}</span>
                </div>
                <div class="table-view__col table-view__col--md">
                    <span class="table-view__text table-view__text--bold">${bureauNaam}</span>
                </div>
                <div class="table-view__col table-view__col--md">
                    <span class="table-view__text">${bedrijf.contactpersoon || '-'}</span>
                </div>
                <div class="table-view__col table-view__col--sm">
                    ${bedrijf.branche ? `
                        <span class="table-view__tag" style="background: ${brancheColor}15; color: ${brancheColor}; border: 1px solid ${brancheColor}30">
                            ${bedrijf.branche}
                        </span>
                    ` : '<span class="table-view__text table-view__text--muted">-</span>'}
                </div>
                <div class="table-view__col table-view__col--sm">
                    ${this.renderRating(rating)}
                </div>
                <div class="table-view__col table-view__col--sm">
                    <span class="table-view__text">${tenderCount}</span>
                </div>
            </div>
        `;
    }

    renderRating(rating) {
        const maxStars = 5;
        let html = '<span class="table-view__rating">';
        for (let i = 1; i <= maxStars; i++) {
            if (i <= rating) {
                html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            } else {
                html += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
            }
        }
        html += '</span>';
        return html;
    }

    renderEmptyState() {
        const hasFilters = this.filters.search || this.filters.branche || this.filters.plaats;

        return `
            <div class="table-view__empty">
                <div class="table-view__empty-icon">
                    ${this.getIcon('building', 48, '#94a3b8')}
                </div>
                <h3 class="table-view__empty-title">${hasFilters ? 'Geen resultaten' : 'Nog geen bedrijven'}</h3>
                <p class="table-view__empty-text">${hasFilters
                ? 'Probeer andere zoektermen of filters.'
                : 'Voeg je eerste bedrijf toe om te beginnen.'}</p>
                ${!hasFilters ? `
                    <button class="table-view__empty-btn" id="btn-create-empty">
                        ${this.getIcon('plus', 16)}
                        <span>Eerste bedrijf toevoegen</span>
                    </button>
                ` : ''}
            </div>
        `;
    }

    generateInitials(naam) {
        if (!naam) return '??';
        const parts = naam.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    attachEventListeners() {
        // Sortable columns
        this.container.querySelectorAll('.table-view__col--sortable').forEach(col => {
            col.addEventListener('click', () => {
                const column = col.dataset.sort;
                if (column) this.sortBy(column);
            });
        });

        // Empty state create button
        const createBtn = this.container.querySelector('#btn-create-empty');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (this.onCreateBedrijf) this.onCreateBedrijf();
            });
        }

        // Row click = edit modal
        this.container.querySelectorAll('.table-view__row').forEach(row => {
            row.addEventListener('click', () => {
                const bedrijfId = row.dataset.bedrijfId;
                const bedrijf = this.bedrijven.find(b => b.id === bedrijfId);
                if (bedrijf && this.onEditBedrijf) {
                    this.onEditBedrijf(bedrijf);
                }
            });
        });
    }
}

export default BedrijvenView;