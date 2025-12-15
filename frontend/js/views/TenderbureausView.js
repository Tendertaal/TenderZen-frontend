/**
 * TenderbureausView - Overzicht en beheer van tenderbureaus (Super Admin)
 * TenderZen v1.0 - Consistente zwevende structuur
 * 
 * FEATURES:
 * - Zwevende headers en cards (zoals TenderListView)
 * - Zoeken en filteren via sub-header
 * - CRUD operaties via TenderbureauModal
 * - Sorteerbare kolommen
 * - Alleen zichtbaar voor super_admin
 * 
 * CHANGELOG:
 * - v1.0: Initial version met consistente zwevende structuur
 */

import { BaseView } from './BaseView.js';

// Referentie naar globale Icons
const Icons = window.Icons || {};

export class TenderbureausView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.tenderbureaus = [];
        this.filteredTenderbureaus = [];
        this.filters = {
            search: '',
            tier: null,
            status: null
        };
        this.sortColumn = 'naam';
        this.sortDirection = 'asc';
        
        // Tiers moeten matchen met TenderbureausService
        this.tiers = [
            { key: 'free', label: 'Free', color: '#64748b' },
            { key: 'basic', label: 'Basic', color: '#3b82f6' },
            { key: 'professional', label: 'Professional', color: '#8b5cf6' },
            { key: 'enterprise', label: 'Enterprise', color: '#f59e0b' }
        ];
        
        // Callbacks - Namen moeten matchen met app.js
        this.onCreateBureau = null;
        this.onEditBureau = null;
        this.onDeleteBureau = null;
        this.onViewUsers = null;
    }

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    /**
     * Set tenderbureaus data - methode naam moet matchen met app.js
     */
    async setBureaus(tenderbureaus) {
        this.tenderbureaus = tenderbureaus || [];
        this.applyFilters();
        this.updateHeaderContext();
        
        if (this.container) {
            this.render();
        }
    }

    /**
     * Alias voor backwards compatibility
     */
    async setTenderbureaus(tenderbureaus) {
        return this.setBureaus(tenderbureaus);
    }

    async reload() {
        try {
            // Import service dynamically to avoid circular dependencies
            const { tenderbureausService } = await import('../services/TenderbureausService.js');
            const bureaus = await tenderbureausService.getAllBureaus();
            await this.setBureaus(bureaus);
        } catch (error) {
            console.error('❌ Error reloading tenderbureaus:', error);
        }
    }

    updateHeaderContext() {
        if (window.app?.header) {
            window.app.header.setContext('tenderbureaus', {
                count: this.filteredTenderbureaus.length,
                filters: this.filters,
                filterOptions: {
                    tiers: this.tiers
                },
                onAdd: () => {
                    if (this.onCreateBureau) this.onCreateBureau();
                },
                onFilterChange: (filterType, value) => {
                    if (filterType === 'search') {
                        this.setSearch(value);
                    } else if (filterType === 'filter1') {
                        this.setTierFilter(value || null);
                    } else if (filterType === 'filter2') {
                        this.setStatusFilter(value || null);
                    }
                },
                onResetFilters: () => {
                    this.resetFilters();
                }
            });
        }
    }

    applyFilters() {
        let filtered = [...this.tenderbureaus];

        if (this.filters.search) {
            const query = this.filters.search.toLowerCase();
            filtered = filtered.filter(t => 
                t.naam?.toLowerCase().includes(query) ||
                t.slug?.toLowerCase().includes(query) ||
                t.email?.toLowerCase().includes(query)
            );
        }

        // Filter op subscription_tier (veld uit database)
        if (this.filters.tier) {
            filtered = filtered.filter(t => t.subscription_tier === this.filters.tier);
        }

        // Filter op is_active (veld uit database)
        if (this.filters.status === 'active') {
            filtered = filtered.filter(t => t.is_active !== false);
        } else if (this.filters.status === 'inactive') {
            filtered = filtered.filter(t => t.is_active === false);
        }

        filtered.sort((a, b) => {
            let valA = a[this.sortColumn];
            let valB = b[this.sortColumn];
            
            if (valA == null) valA = '';
            if (valB == null) valB = '';
            
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            
            let result = 0;
            if (valA < valB) result = -1;
            if (valA > valB) result = 1;
            
            return this.sortDirection === 'desc' ? -result : result;
        });

        this.filteredTenderbureaus = filtered;
    }

    setSearch(query) {
        this.filters.search = query;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    setTierFilter(tier) {
        this.filters.tier = tier;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    setStatusFilter(status) {
        this.filters.status = status;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    resetFilters() {
        this.filters = { search: '', tier: null, status: null };
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

    render() {
        if (!this.container) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'tenderbureaus-list-view';
        
        wrapper.appendChild(this.createHeadersRow());
        
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'tenderbureaus-cards-container';
        
        if (this.filteredTenderbureaus.length > 0) {
            cardsContainer.innerHTML = this.filteredTenderbureaus.map(bureau => this.renderBureauCard(bureau)).join('');
        } else {
            cardsContainer.innerHTML = this.renderEmptyState();
        }
        
        wrapper.appendChild(cardsContainer);

        const styleEl = document.createElement('style');
        styleEl.textContent = this.getStyles();
        wrapper.appendChild(styleEl);

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        this.attachEventListeners();
    }

    createHeadersRow() {
        const row = document.createElement('div');
        row.className = 'headers-row';
        
        const sortIndicator = (col) => {
            if (this.sortColumn !== col) return '';
            return `<span class="sort-indicator">${this.sortDirection === 'asc' ? '↑' : '↓'}</span>`;
        };

        row.innerHTML = `
            <div class="header-cell header-main sortable" data-sort="naam">
                ${this.getIcon('briefcase', 14)}
                <span>Tenderbureau</span>
                ${sortIndicator('naam')}
            </div>
            <div class="header-cell header-md sortable" data-sort="slug">
                <span>Slug</span>
                ${sortIndicator('slug')}
            </div>
            <div class="header-cell header-sm sortable" data-sort="users_count">
                ${this.getIcon('users', 14)}
                <span>Users</span>
                ${sortIndicator('users_count')}
            </div>
            <div class="header-cell header-sm sortable" data-sort="tenders_count">
                ${this.getIcon('fileText', 14)}
                <span>Tenders</span>
                ${sortIndicator('tenders_count')}
            </div>
            <div class="header-cell header-sm">
                <span>Tier</span>
            </div>
            <div class="header-cell header-sm">
                <span>Status</span>
            </div>
            <div class="header-cell header-actions">
                <span>Acties</span>
            </div>
        `;

        row.querySelectorAll('.sortable').forEach(cell => {
            cell.addEventListener('click', () => {
                const col = cell.dataset.sort;
                if (col) this.sortBy(col);
            });
        });

        return row;
    }

    renderBureauCard(bureau) {
        const initials = this.generateInitials(bureau.naam);
        // Gebruik subscription_tier uit database
        const tierConfig = this.tiers.find(t => t.key === bureau.subscription_tier) || this.tiers[0];
        // Gebruik is_active uit database
        const isActive = bureau.is_active !== false;
        const usersCount = bureau.users_count || 0;
        const tendersCount = bureau.tenders_count || 0;

        return `
            <div class="bureau-row" data-bureau-id="${bureau.id}" style="border-left-color: ${tierConfig.color}">
                <div class="section-main">
                    <div class="bureau-avatar" style="background: linear-gradient(135deg, ${tierConfig.color}, ${this.darkenColor(tierConfig.color, 20)})">
                        ${initials}
                    </div>
                    <div class="bureau-info">
                        <div class="bureau-name">${bureau.naam || 'Onbekend'}</div>
                        <div class="bureau-meta">${bureau.email || ''}</div>
                    </div>
                </div>
                <div class="section-md section-slug">
                    <code>${bureau.slug || '-'}</code>
                </div>
                <div class="section-sm">
                    <span class="count-badge">${usersCount}</span>
                </div>
                <div class="section-sm">
                    <span class="count-badge">${tendersCount}</span>
                </div>
                <div class="section-sm">
                    <span class="tier-tag" style="background: ${tierConfig.color}15; color: ${tierConfig.color}; border: 1px solid ${tierConfig.color}30">
                        ${tierConfig.label}
                    </span>
                </div>
                <div class="section-sm">
                    <span class="status-indicator ${isActive ? 'active' : 'inactive'}">
                        <span class="status-dot"></span>
                        ${isActive ? 'Actief' : 'Inactief'}
                    </span>
                </div>
                <div class="section-actions">
                    <button class="action-btn edit" data-action="edit" data-bureau-id="${bureau.id}" title="Bewerken">
                        ${this.getIcon('edit', 16)}
                    </button>
                    <button class="action-btn delete" data-action="delete" data-bureau-id="${bureau.id}" title="Verwijderen">
                        ${this.getIcon('trash', 16)}
                    </button>
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        const hasFilters = this.filters.search || this.filters.tier || this.filters.status;
        
        return `
            <div class="empty-state-card">
                <div class="empty-icon">
                    ${this.getIcon('briefcase', 48, '#94a3b8')}
                </div>
                <h3 class="empty-title">${hasFilters ? 'Geen resultaten' : 'Nog geen tenderbureaus'}</h3>
                <p class="empty-text">${hasFilters 
                    ? 'Probeer andere zoektermen of filters.' 
                    : 'Voeg je eerste tenderbureau toe om te beginnen.'}</p>
                ${!hasFilters ? `
                    <button class="empty-btn" id="btn-create-empty">
                        ${this.getIcon('plus', 16)}
                        <span>Eerste tenderbureau toevoegen</span>
                    </button>
                ` : ''}
            </div>
        `;
    }

    generateInitials(naam) {
        if (!naam) return '??';
        const words = naam.trim().split(/\s+/);
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    darkenColor(hex, percent) {
        if (!hex || !hex.startsWith('#')) return hex;
        const num = parseInt(hex.slice(1), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return `#${(1 << 24 | R << 16 | G << 8 | B).toString(16).slice(1)}`;
    }

    attachEventListeners() {
        const createBtn = this.container.querySelector('#btn-create-empty');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (this.onCreateBureau) this.onCreateBureau();
            });
        }

        this.container.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const bureauId = btn.dataset.bureauId;
                const bureau = this.tenderbureaus.find(t => t.id === bureauId);
                
                if (action === 'edit' && bureau && this.onEditBureau) {
                    this.onEditBureau(bureau);
                } else if (action === 'delete' && bureau && this.onDeleteBureau) {
                    if (confirm(`Weet je zeker dat je "${bureau.naam}" wilt verwijderen? Dit verwijdert ook alle gekoppelde data.`)) {
                        this.onDeleteBureau(bureauId);
                    }
                }
            });
        });

        this.container.querySelectorAll('.bureau-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                const bureauId = row.dataset.bureauId;
                const bureau = this.tenderbureaus.find(t => t.id === bureauId);
                if (bureau && this.onEditBureau) {
                    this.onEditBureau(bureau);
                }
            });
        });
    }

    getStyles() {
        return `
            /* ============================================
               TENDERBUREAUS LIST VIEW - Consistent met TenderListView
               ============================================ */
            
            .tenderbureaus-list-view {
                width: 100%;
                min-width: max-content;
                padding: var(--space-4, 16px);
            }

            .tenderbureaus-cards-container {
                display: flex;
                flex-direction: column;
                gap: var(--space-3, 12px);
            }

            /* ============================================
               HEADERS ROW - Zwevend
               ============================================ */
            
            .tenderbureaus-list-view .headers-row {
                display: flex;
                align-items: stretch;
                background: var(--bg-surface, white);
                border-radius: var(--radius-lg, 12px);
                margin-bottom: var(--space-3, 12px);
                min-width: max-content;
                border: 1px solid var(--border-light, #e2e8f0);
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
            }

            .tenderbureaus-list-view .headers-row .header-cell {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--space-3, 12px) var(--space-2, 8px);
                font-size: 11px;
                font-weight: 600;
                color: var(--text-tertiary, #64748b);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-right: 1px solid var(--border-light, #e2e8f0);
                gap: 6px;
            }

            .tenderbureaus-list-view .headers-row .header-cell:last-child {
                border-right: none;
            }

            .tenderbureaus-list-view .headers-row .header-cell svg {
                opacity: 0.7;
            }

            .tenderbureaus-list-view .headers-row .header-cell.sortable {
                cursor: pointer;
                transition: color 0.15s;
            }

            .tenderbureaus-list-view .headers-row .header-cell.sortable:hover {
                color: var(--text-primary, #0f172a);
            }

            .sort-indicator {
                font-size: 10px;
                color: var(--color-primary, #6366f1);
            }

            /* Header widths */
            .header-main {
                width: 280px;
                min-width: 280px;
                justify-content: flex-start !important;
                padding-left: var(--space-5, 20px) !important;
            }

            .header-md {
                width: 160px;
                min-width: 160px;
            }

            .header-sm {
                width: 100px;
                min-width: 100px;
            }

            .header-actions {
                width: 100px;
                min-width: 100px;
            }

            /* ============================================
               BUREAU ROW - Zwevende kaart
               ============================================ */
            
            .bureau-row {
                display: flex;
                align-items: stretch;
                background: var(--bg-surface, white);
                border-radius: var(--radius-xl, 16px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04);
                transition: all 0.2s ease;
                overflow: hidden;
                min-width: max-content;
                cursor: pointer;
                border-left: 5px solid #f59e0b;
            }

            .bureau-row:hover {
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.08);
                transform: translateY(-3px);
            }

            /* Sections */
            .section-main {
                width: 280px;
                min-width: 280px;
                padding: 20px 24px;
                display: flex;
                align-items: center;
                gap: 12px;
                border-right: 1px solid var(--border-light, #f1f5f9);
            }

            .section-md {
                width: 160px;
                min-width: 160px;
                padding: 20px 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-right: 1px solid var(--border-light, #f1f5f9);
            }

            .section-sm {
                width: 100px;
                min-width: 100px;
                padding: 20px 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-right: 1px solid var(--border-light, #f1f5f9);
            }

            .section-actions {
                width: 100px;
                min-width: 100px;
                padding: 20px 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            }

            .section-slug code {
                font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
                font-size: 12px;
                color: #64748b;
                background: #f1f5f9;
                padding: 6px 10px;
                border-radius: 6px;
            }

            /* Bureau Avatar */
            .bureau-avatar {
                width: 44px;
                height: 44px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 15px;
                flex-shrink: 0;
            }

            .bureau-info {
                min-width: 0;
            }

            .bureau-name {
                font-weight: 600;
                font-size: 15px;
                color: #0f172a;
                margin-bottom: 2px;
            }

            .bureau-meta {
                font-size: 12px;
                color: #94a3b8;
            }

            /* Count Badge */
            .count-badge {
                font-size: 15px;
                font-weight: 700;
                color: #0f172a;
            }

            /* Tier Tag */
            .tier-tag {
                display: inline-flex;
                align-items: center;
                padding: 5px 10px;
                border-radius: 6px;
                font-size: 11px;
                font-weight: 600;
            }

            /* Status Indicator */
            .status-indicator {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 13px;
            }

            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }

            .status-indicator.active .status-dot {
                background: #10b981;
            }

            .status-indicator.inactive .status-dot {
                background: #94a3b8;
            }

            .status-indicator.active {
                color: #047857;
            }

            .status-indicator.inactive {
                color: #64748b;
            }

            /* Action Buttons */
            .action-btn {
                width: 34px;
                height: 34px;
                border: none;
                background: transparent;
                border-radius: 8px;
                cursor: pointer;
                color: #94a3b8;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
            }

            .action-btn:hover {
                background: #f1f5f9;
                color: #64748b;
            }

            .action-btn.edit:hover {
                color: #2563eb;
                background: #dbeafe;
            }

            .action-btn.delete:hover {
                color: #dc2626;
                background: #fef2f2;
            }

            /* ============================================
               EMPTY STATE - Zwevende kaart
               ============================================ */
            
            .empty-state-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
                padding: 80px 40px;
                background: var(--bg-surface, white);
                border-radius: var(--radius-xl, 16px);
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                border: 2px dashed #e2e8f0;
            }

            .empty-icon {
                margin-bottom: 20px;
                color: #94a3b8;
            }

            .empty-title {
                font-size: 18px;
                font-weight: 600;
                color: #0f172a;
                margin: 0 0 8px 0;
            }

            .empty-text {
                font-size: 14px;
                color: #64748b;
                margin: 0 0 24px 0;
                max-width: 300px;
            }

            .empty-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .empty-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
        `;
    }
}

export default TenderbureausView;