/**
 * Header Component
 * TenderZen v2.9 - Smart Import Only (geen + Tender knop meer)
 * 
 * CHANGELOG v2.9:
 * - VERWIJDERD: "+ Tender" knop (handmatig aanmaken)
 * - GEWIJZIGD: "Smart Import" knop is nu de primaire create knop (groene stijl)
 * - Workflow: Tenders worden nu via Smart Import aangemaakt, details via Edit knop
 * 
 * CHANGELOG v2.8:
 * - NIEUW: onSearchClear callback voor terug navigatie na zoeken
 * - removeSearchChip roept nu onSearchClear aan
 * 
 * CHANGELOG v2.7:
 * - NIEUW: setSearchResultsCount() - update resultaten teller in filter chips
 * - NIEUW: Resultaten count geïntegreerd in filter chips balk
 * - NIEUW: "X resultaten" direct naast de chip
 * 
 * CHANGELOG v2.6:
 * - Filter chips balk voor actieve zoekterm
 * - Enter → zoekterm wordt chip
 */

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

// Import BureauSwitcher
import { BureauSwitcher } from '/js/components/BureauSwitcher.js';
import { bureauAccessService } from '/js/services/BureauAccessService.js';
import { SmartImportWizard } from '/js/components/SmartImportWizard.js';

export class Header {
    constructor() {
        this.container = null;
        this.menuOpen = false;
        this.profileMenuOpen = false;

        // Current context
        this.currentContext = 'tenders';
        this.contextData = {};

        // Tender specific state
        this.activeTab = 'totaal';
        this.activeView = 'lijst';
        this.searchQuery = '';           // Huidige waarde in zoekbalk (voor live filtering)
        this.activeSearchChip = '';      // Actieve filter chip (na Enter)
        this.searchResultsCount = null;  // ⭐ v2.7: Resultaten count
        this.tenderCounts = {
            totaal: 0,
            acquisitie: 0,
            inschrijvingen: 0,
            ingediend: 0,
            archief: 0
        };

        // User state
        this.isSuperAdmin = false;
        this.userProfile = {
            naam: '',
            email: '',
            role: '',
            initials: ''
        };

        // Team members for filter
        this.teamMembers = [];
        this.currentTeamFilter = null;
        this.currentStatusFilter = null;

        // Callbacks
        this.onTabChange = null;
        this.onViewChange = null;
        this.onSearch = null;
        this.onSearchClear = null;  // ⭐ v2.8: Callback voor terug navigatie na zoeken
        this.onCreateTender = null;  // ⭐ v2.9: Deprecated - niet meer gebruikt
        this.onSmartImport = null; // Callback voor Smart Import
        this.onMenuAction = null;
        this.onContextAction = null;
        this.onTeamFilter = null;
        this.onStatusFilter = null;

        // Bureau state en callback
        this.bureauSwitcher = null;
        this.currentBureau = null;
        this.onBureauChange = null;
    }

    /**
     * Set the current context (changes sub-header)
     */
    setContext(context, data = {}) {
        this.currentContext = context;
        this.contextData = data;

        // Clear search when changing context
        if (context !== 'tenders') {
            this.searchQuery = '';
            this.activeSearchChip = '';
            this.searchResultsCount = null;
        }

        this.updateSubHeader();
    }

    /**
     * Update only the sub-header without re-rendering everything
     */
    updateSubHeader() {
        const subHeaderContainer = document.getElementById('sub-header-container');
        if (subHeaderContainer) {
            subHeaderContainer.innerHTML = this.renderSubHeader();
            this.attachSubHeaderListeners();
        }
    }

    /**
     * Set super-admin status
     */
    setSuperAdmin(isSuperAdmin) {
        this.isSuperAdmin = isSuperAdmin;
        this.updateMenuVisibility();
    }

    /**
     * Initialize the bureau switcher component
     */
    async initBureauSwitcher() {
        try {
            this.bureauSwitcher = new BureauSwitcher();
            await this.bureauSwitcher.init();

            this.currentBureau = bureauAccessService.getCurrentBureau();

            this.bureauSwitcher.onBureauChange = (newBureau) => {
                this.currentBureau = newBureau;
                if (this.onBureauChange) {
                    this.onBureauChange(newBureau);
                }
            };

            const container = document.getElementById('bureau-switcher-container');
            if (container) {
                container.innerHTML = '';
                container.appendChild(this.bureauSwitcher.render());
            }

            console.log('✅ Bureau switcher initialized');
            return this.currentBureau;

        } catch (error) {
            console.error('❌ Error initializing bureau switcher:', error);
            throw error;
        }
    }

    /**
     * Set user profile data
     */
    setUserProfile(profile) {
        this.userProfile = {
            naam: profile.naam || profile.email?.split('@')[0] || 'Gebruiker',
            email: profile.email || '',
            role: profile.role || 'Gebruiker',
            initials: this.getInitials(profile.naam || profile.email?.split('@')[0] || 'G')
        };
        this.updateProfileUI();
    }

    /**
     * Get initials from name
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    /**
     * Get role display name
     */
    getRoleDisplay(role) {
        const roles = {
            'admin': 'Administrator',
            'manager': 'Manager',
            'member': 'Teamlid',
            'viewer': 'Viewer'
        };
        return roles[role] || role || 'Gebruiker';
    }

    /**
     * Get role icon
     */
    getRoleIcon() {
        if (this.isSuperAdmin || this.userProfile.role === 'admin') {
            return Icons.crown ? Icons.crown({ size: 12, color: 'currentColor' }) : '';
        }
        return Icons.user ? Icons.user({ size: 12, color: 'currentColor' }) : '';
    }

    /**
     * Update profile UI elements
     */
    updateProfileUI() {
        const elements = {
            avatar: document.getElementById('profile-avatar'),
            name: document.getElementById('profile-name'),
            email: document.getElementById('profile-email'),
            role: document.getElementById('profile-role'),
            headerAvatar: document.getElementById('header-avatar'),
            headerName: document.getElementById('header-name'),
            headerRole: document.getElementById('header-role')
        };

        if (elements.avatar) elements.avatar.textContent = this.userProfile.initials;
        if (elements.headerAvatar) elements.headerAvatar.textContent = this.userProfile.initials;
        if (elements.name) elements.name.textContent = this.userProfile.naam;
        if (elements.headerName) elements.headerName.textContent = this.userProfile.naam;
        if (elements.email) elements.email.textContent = this.userProfile.email;
        if (elements.role) elements.role.innerHTML = `
            <span class="badge-icon">${this.getRoleIcon()}</span>
            ${this.getRoleDisplay(this.userProfile.role)}
        `;
        if (elements.headerRole) elements.headerRole.textContent = this.getRoleDisplay(this.userProfile.role);
    }

    /**
     * Update menu visibility based on super-admin status
     */
    updateMenuVisibility() {
        const tenderbureausMenuItem = document.querySelector('[data-action="tenderbureaus"]');
        if (tenderbureausMenuItem) {
            tenderbureausMenuItem.style.display = this.isSuperAdmin ? 'flex' : 'none';
        }
        const iconenMenuItem = document.querySelector('[data-action="iconen"]');
        if (iconenMenuItem) {
            iconenMenuItem.style.display = this.isSuperAdmin ? 'flex' : 'none';
        }
    }

    /**
     * Update tender counts
     */
    updateCounts(counts) {
        this.tenderCounts = { ...this.tenderCounts, ...counts };
        this.updateBadges();
    }

    /**
     * Alias for updateCounts
     */
    setTenderCounts(counts) {
        this.updateCounts(counts);
    }

    /**
     * Update badges without re-rendering
     */
    updateBadges() {
        const badges = {
            'totaal': document.querySelector('[data-tab="totaal"] .badge'),
            'acquisitie': document.querySelector('[data-tab="acquisitie"] .badge'),
            'inschrijvingen': document.querySelector('[data-tab="inschrijvingen"] .badge'),
            'ingediend': document.querySelector('[data-tab="ingediend"] .badge'),
            'archief': document.querySelector('[data-tab="archief"] .badge')
        };

        Object.entries(badges).forEach(([tab, badge]) => {
            if (badge) {
                badge.textContent = this.tenderCounts[tab] || 0;
            }
        });
    }

    /**
     * Update team filter options
     */
    updateTeamOptions(teamMembers) {
        this.teamMembers = teamMembers || [];
        const teamOptionsContainer = document.getElementById('team-options');
        if (teamOptionsContainer && this.teamMembers.length > 0) {
            teamOptionsContainer.innerHTML = this.teamMembers.map(member => `
                <a class="filter-option" data-team="${member}">
                    <span class="option-icon">${Icons.user ? Icons.user({ size: 16 }) : ''}</span>
                    ${member}
                </a>
            `).join('');
        }
    }

    /**
     * Set team members (alias for updateTeamOptions)
     */
    setTeamMembers(members) {
        this.updateTeamOptions(members);
    }

    /**
     * ⭐ v2.7: Set search results count (called from App.js/TenderListView)
     * @param {number} count - Aantal zoekresultaten
     */
    setSearchResultsCount(count) {
        this.searchResultsCount = count;
        this.updateFilterChipsBar();
    }

    /**
     * Create search filter chip (called on Enter)
     */
    createSearchChip(query) {
        if (!query || query.trim() === '') return;

        const trimmedQuery = query.trim();
        this.activeSearchChip = trimmedQuery;
        this.searchQuery = trimmedQuery;

        // Clear the search input
        const searchInput = document.getElementById('tender-search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.blur();
        }

        // Update filter chips bar
        this.updateFilterChipsBar();

        // Notify listeners
        if (this.onSearch) {
            this.onSearch(trimmedQuery);
        }

        console.log(`🏷️ Filter chip aangemaakt: "${trimmedQuery}"`);
    }

    /**
     * Edit search chip (click on chip text)
     */
    editSearchChip() {
        if (!this.activeSearchChip) return;

        const searchInput = document.getElementById('tender-search-input');
        if (searchInput) {
            searchInput.value = this.activeSearchChip;
            searchInput.focus();
            searchInput.select();
        }

        // Remove chip but keep filter active
        this.activeSearchChip = '';
        this.updateFilterChipsBar();

        console.log('✏️ Filter chip bewerken');
    }

    /**
     * Remove search chip
     * ⭐ v2.8: Roept onSearchClear aan voor terug navigatie
     */
    removeSearchChip() {
        this.activeSearchChip = '';
        this.searchQuery = '';
        this.searchResultsCount = null;

        // Clear search input
        const searchInput = document.getElementById('tender-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        // Update UI
        this.updateFilterChipsBar();

        // ⭐ v2.8: Notify listeners - gebruik onSearchClear voor terug navigatie
        if (this.onSearchClear) {
            this.onSearchClear();
        } else if (this.onSearch) {
            // Fallback naar oude gedrag
            this.onSearch('');
        }

        console.log('🗑️ Filter chip verwijderd');
    }

    /**
     * ⭐ v2.7: Update filter chips bar with integrated results count
     */
    updateFilterChipsBar() {
        const chipsContainer = document.getElementById('filter-chips-bar');

        if (!chipsContainer) return;

        if (this.activeSearchChip) {
            // Build results text - geïntegreerd naast de chip
            let resultsText = '';
            if (this.searchResultsCount !== null) {
                const resultWord = this.searchResultsCount === 1 ? 'resultaat' : 'resultaten';
                resultsText = `<span class="filter-results-count">${this.searchResultsCount} ${resultWord}</span>`;
            }

            chipsContainer.innerHTML = `
                <div class="filter-chips-content">
                    <div class="filter-chip filter-chip--search" id="search-filter-chip">
                        <span class="filter-chip-icon">
                            ${Icons.search ? Icons.search({ size: 14, color: '#6366f1' }) : '🔍'}
                        </span>
                        <span class="filter-chip-text" id="search-chip-text">${this.escapeHtml(this.activeSearchChip)}</span>
                        <button class="filter-chip-remove" id="search-chip-remove" title="Filter verwijderen">
                            ${Icons.x ? Icons.x({ size: 14, color: '#6366f1' }) : '×'}
                        </button>
                    </div>
                    ${resultsText}
                </div>
            `;
            chipsContainer.classList.add('has-chips');

            // Attach chip event listeners
            this.attachChipListeners();
        } else {
            chipsContainer.innerHTML = '';
            chipsContainer.classList.remove('has-chips');
        }
    }

    /**
     * Attach event listeners for filter chips
     */
    attachChipListeners() {
        const self = this;

        // Click on chip text to edit
        const chipText = document.getElementById('search-chip-text');
        if (chipText) {
            chipText.addEventListener('click', () => {
                self.editSearchChip();
            });
        }

        // Click on X to remove
        const chipRemove = document.getElementById('search-chip-remove');
        if (chipRemove) {
            chipRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                self.removeSearchChip();
            });
        }
    }

    /**
     * Escape HTML for safe display
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear search and notify listeners
     */
    clearSearch() {
        this.searchQuery = '';
        this.activeSearchChip = '';
        this.searchResultsCount = null;

        const searchInput = document.getElementById('tender-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        this.updateFilterChipsBar();

        if (this.onSearch) {
            this.onSearch('');
        }
    }

    /**
     * Get current search query
     */
    getSearchQuery() {
        return this.activeSearchChip || this.searchQuery;
    }

    /**
     * ⭐ v2.7: Check if search chip is active
     */
    hasActiveSearchChip() {
        return !!this.activeSearchChip;
    }

    /**
     * Render the header
     */
    render() {
        const container = document.createElement('div');
        container.className = 'header-wrapper';
        container.innerHTML = `
            <!-- Main Header -->
            <header class="header">
                <div class="header-left">
                    <!-- Logo -->
                    <div class="logo-container" id="logo">
                        <div class="logo-icon">
                            ${Icons.logo ? Icons.logo({ size: 32 }) : ''}
                        </div>
                        <span class="logo-text">TenderZen</span>
                    </div>

                    <!-- Bureau Switcher (wordt dynamisch geladen) -->
                    <div id="bureau-switcher-container"></div>
                </div>

                <div class="header-right">
                    <!-- Menu -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" id="menu-btn">
                            <span class="menu-icon">${Icons.menu ? Icons.menu({ size: 18 }) : ''}</span>
                            <span>Menu</span>
                            <span class="chevron-icon">${Icons.chevronDown ? Icons.chevronDown({ size: 16 }) : ''}</span>
                        </button>
                        <div class="menu-content" id="menu-content">
                            <a class="menu-item" data-action="tenders">
                                <span class="menu-item-icon">${Icons.clipboardList ? Icons.clipboardList({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Tenders</span>
                            </a>
                            <a class="menu-item" data-action="bedrijven">
                                <span class="menu-item-icon">${Icons.building ? Icons.building({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Bedrijven</span>
                            </a>
                            <a class="menu-item" data-action="team">
                                <span class="menu-item-icon">${Icons.users ? Icons.users({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Team</span>
                            </a>
                            <div class="menu-divider"></div>
                            <a class="menu-item" data-action="reports">
                                <span class="menu-item-icon">${Icons.chartBar ? Icons.chartBar({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Rapportages</span>
                            </a>
                            <a class="menu-item" data-action="export">
                                <span class="menu-item-icon">${Icons.download ? Icons.download({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Exporteren</span>
                            </a>
                            ${this.isSuperAdmin ? `
                            <div class="menu-divider"></div>
                            <a class="menu-item menu-item--admin" data-action="tenderbureaus">
                                <span class="menu-item-icon">${Icons.briefcase ? Icons.briefcase({ size: 18, color: '#d97706' }) : ''}</span>
                                <span class="menu-item-label">Tenderbureaus</span>
                                <span class="admin-badge">Admin</span>
                            </a>
                            <a class="menu-item menu-item--admin" data-action="iconen">
                                <span class="menu-item-icon">${Icons.grid ? Icons.grid({ size: 18, color: '#d97706' }) : ''}</span>
                                <span class="menu-item-label">Iconen beheer</span>
                                <span class="admin-badge">Admin</span>
                            </a>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Profile Avatar -->
                    <div class="profile-dropdown">
                        <button class="profile-avatar-btn" id="profile-btn" title="${this.userProfile.naam || 'Profiel'}">
                            <div class="profile-avatar" id="header-avatar">${this.userProfile.initials || '?'}</div>
                        </button>
                        <div class="profile-menu" id="profile-menu">
                            <div class="profile-header">
                                <div class="profile-avatar-large" id="profile-avatar">${this.userProfile.initials || '?'}</div>
                                <div class="profile-header-info">
                                    <div class="profile-header-name" id="profile-name">${this.userProfile.naam || 'Laden...'}</div>
                                    <div class="profile-header-email" id="profile-email">${this.userProfile.email || ''}</div>
                                    <div class="profile-role-badge" id="profile-role">
                                        <span class="badge-icon">${this.getRoleIcon()}</span>
                                        ${this.getRoleDisplay(this.userProfile.role)}
                                    </div>
                                </div>
                            </div>
                            <div class="profile-menu-items">
                                <a class="profile-menu-item" data-action="profile">
                                    <span class="menu-item-icon">${Icons.user ? Icons.user({ size: 18 }) : ''}</span>
                                    Mijn profiel
                                </a>
                                <a class="profile-menu-item" data-action="mfa-settings">
                                    <span class="menu-item-icon">${Icons.shieldCheck ? Icons.shieldCheck({ size: 18 }) : ''}</span>
                                    Beveiligingsinstellingen
                                </a>
                                <a class="profile-menu-item" data-action="notifications">
                                    <span class="menu-item-icon">${Icons.bell ? Icons.bell({ size: 18 }) : ''}</span>
                                    Notificaties
                                </a>
                                <div class="profile-menu-divider"></div>
                                <a class="profile-menu-item danger" data-action="logout">
                                    <span class="menu-item-icon">${Icons.logOut ? Icons.logOut({ size: 18 }) : ''}</span>
                                    Uitloggen
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Dynamic Sub Header -->
            <div id="sub-header-container" class="sub-header-container">
                ${this.renderSubHeader()}
            </div>
        `;

        this.container = container;
        this.attachEventListeners(container);
        return container;
    }

    /**
     * Render sub-header based on current context
     */
    renderSubHeader() {
        switch (this.currentContext) {
            case 'tenders':
                return this.renderTendersSubHeader();
            case 'bedrijven':
                return this.renderBedrijvenSubHeader();
            case 'tenderbureaus':
                return this.renderTenderbureausSubHeader();
            case 'settings':
                return this.renderSettingsSubHeader();
            case 'team':
                return this.renderTeamSubHeader();
            default:
                return this.renderTendersSubHeader();
        }
    }

    /**
     * ⭐ v2.9: Render Tenders sub-header - ALLEEN Smart Import knop (geen + Tender)
     */
    renderTendersSubHeader() {
        // Build results text for initial render
        let resultsText = '';
        if (this.activeSearchChip && this.searchResultsCount !== null) {
            const resultWord = this.searchResultsCount === 1 ? 'resultaat' : 'resultaten';
            resultsText = `<span class="filter-results-count">${this.searchResultsCount} ${resultWord}</span>`;
        }

        return `
            <div class="sub-header sub-header-tenders">
                <div class="sub-header-left">
                    <button class="main-tab ${this.activeTab === 'totaal' ? 'active' : ''}" data-tab="totaal">
                        <span class="tab-icon">${Icons.dashboard ? Icons.dashboard({ size: 18 }) : ''}</span>
                        <span class="tab-label">Overzicht</span>
                        <span class="badge">${this.tenderCounts.totaal}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'acquisitie' ? 'active' : ''}" data-tab="acquisitie">
                        <span class="phase-indicator acquisitie"></span>
                        <span class="tab-label">Acquisitie</span>
                        <span class="badge">${this.tenderCounts.acquisitie}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'inschrijvingen' ? 'active' : ''}" data-tab="inschrijvingen">
                        <span class="phase-indicator inschrijvingen"></span>
                        <span class="tab-label">Lopend</span>
                        <span class="badge">${this.tenderCounts.inschrijvingen}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'ingediend' ? 'active' : ''}" data-tab="ingediend">
                        <span class="phase-indicator ingediend"></span>
                        <span class="tab-label">Ingediend</span>
                        <span class="badge">${this.tenderCounts.ingediend}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'archief' ? 'active' : ''}" data-tab="archief">
                        <span class="phase-indicator archief"></span>
                        <span class="tab-label">Archief</span>
                        <span class="badge">${this.tenderCounts.archief}</span>
                    </button>
                </div>

                <div class="sub-header-right">
                    <!-- Zoekbalk voor tenders -->
                    <div class="tender-search-container">
                        <span class="tender-search-icon">
                            ${Icons.search ? Icons.search({ size: 16, color: '#94a3b8', strokeWidth: 2 }) : ''}
                        </span>
                        <input type="text" 
                               id="tender-search-input" 
                               class="tender-search-input"
                               placeholder="Zoek tender..."
                               value="">
                    </div>
                    
                    <div class="view-toggle">
                        <button class="${this.activeView === 'lijst' ? 'active' : ''}" data-view="lijst">
                            <span class="view-icon">${Icons.listView ? Icons.listView({ size: 16 }) : ''}</span>
                            <span>Lijst</span>
                        </button>
                        <button class="${this.activeView === 'planning' ? 'active' : ''}" data-view="planning">
                            <span class="view-icon">${Icons.calendarView ? Icons.calendarView({ size: 16 }) : ''}</span>
                            <span>Planning</span>
                        </button>
                        <button class="${this.activeView === 'kanban' ? 'active' : ''}" data-view="kanban">
                            <span class="view-icon">${Icons.grid ? Icons.grid({ size: 16 }) : ''}</span>
                            <span>Kanban</span>
                        </button>
                    </div>
                    
                    <!-- ⭐ v2.9: Smart Import is nu de primaire create knop -->
                    <button id="smart-import-btn" class="create-btn" title="Smart Import - AI analyse van aanbestedingsdocumenten">
                        ✨ <span>Smart Import</span>
                    </button>
                </div>
            </div>
            
            <!-- Filter Chips Bar -->
            <div id="filter-chips-bar" class="filter-chips-bar ${this.activeSearchChip ? 'has-chips' : ''}">
                ${this.activeSearchChip ? `
                    <div class="filter-chips-content">
                        <div class="filter-chip filter-chip--search" id="search-filter-chip">
                            <span class="filter-chip-icon">
                                ${Icons.search ? Icons.search({ size: 14, color: '#6366f1' }) : '🔍'}
                            </span>
                            <span class="filter-chip-text" id="search-chip-text">${this.escapeHtml(this.activeSearchChip)}</span>
                            <button class="filter-chip-remove" id="search-chip-remove" title="Filter verwijderen">
                                ${Icons.x ? Icons.x({ size: 14, color: '#6366f1' }) : '×'}
                            </button>
                        </div>
                        ${resultsText}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render Bedrijven sub-header
     */
    renderBedrijvenSubHeader() {
        const count = this.contextData.count || 0;
        const filters = this.contextData.filters || {};
        const filterOptions = this.contextData.filterOptions || {};

        return `
            <div class="sub-header sub-header-context">
                <div class="sub-header-left">
                    <div class="nav-tab active" data-color="blue">
                        ${Icons.building ? Icons.building({ size: 16, color: '#3b82f6' }) : ''}
                        <span>Bedrijvenbeheer</span>
                        <span class="nav-badge">${count}</span>
                    </div>
                </div>
                
                <div class="sub-header-center">
                    <div class="sub-header-filters">
                        <div class="filter-search-compact">
                            <span class="search-icon">${Icons.search ? Icons.search({ size: 15, color: '#94a3b8', strokeWidth: 2.5 }) : ''}</span>
                            <input type="text" 
                                   id="context-filter-search" 
                                   class="filter-input-compact"
                                   placeholder="Zoek bedrijf..."
                                   value="${filters.search || ''}">
                        </div>
                        
                        <div class="filter-divider"></div>
                        
                        <select id="context-filter-1" class="filter-select-compact">
                            <option value="">Alle branches</option>
                            ${(filterOptions.branches || []).map(b => `
                                <option value="${b}" ${filters.branche === b ? 'selected' : ''}>${b}</option>
                            `).join('')}
                        </select>
                        
                        <select id="context-filter-2" class="filter-select-compact">
                            <option value="all">Alle bedrijven</option>
                            <option value="active" ${filters.status === 'active' ? 'selected' : ''}>Actief</option>
                            <option value="inactive" ${filters.status === 'inactive' ? 'selected' : ''}>Inactief</option>
                        </select>
                        
                        <button class="btn-icon-compact btn-reset-filters" id="context-reset-filters" title="Reset filters">
                            ${Icons.x ? Icons.x({ size: 16 }) : '×'}
                        </button>
                    </div>
                </div>
                
                <div class="sub-header-right">
                    <button class="create-btn create-btn-blue" id="context-create-btn">
                        ${Icons.plus ? Icons.plus({ size: 16, color: '#ffffff' }) : ''}
                        <span>Bedrijf</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render Tenderbureaus sub-header (super-admin only)
     */
    renderTenderbureausSubHeader() {
        const count = this.contextData.count || 0;

        return `
            <div class="sub-header sub-header-context">
                <div class="sub-header-left">
                    <div class="nav-tab active" data-color="purple">
                        ${Icons.briefcase ? Icons.briefcase({ size: 16, color: '#8b5cf6' }) : ''}
                        <span>Tenderbureaus beheer</span>
                        <span class="nav-badge">${count}</span>
                    </div>
                </div>
                
                <div class="sub-header-center">
                    <div class="sub-header-filters">
                        <div class="filter-search-compact">
                            <span class="search-icon">${Icons.search ? Icons.search({ size: 15, color: '#94a3b8', strokeWidth: 2.5 }) : ''}</span>
                            <input type="text" 
                                   id="context-filter-search" 
                                   class="filter-input-compact"
                                   placeholder="Zoek bureau...">
                        </div>
                        
                        <div class="filter-divider"></div>
                        
                        <select id="context-filter-2" class="filter-select-compact">
                            <option value="all">Alle statussen</option>
                            <option value="active">Actief</option>
                            <option value="inactive">Inactief</option>
                        </select>
                    </div>
                </div>
                
                <div class="sub-header-right">
                    <button class="create-btn create-btn-purple" id="context-create-btn">
                        ${Icons.plus ? Icons.plus({ size: 16, color: '#ffffff' }) : ''}
                        <span>Bureau</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render Settings sub-header
     */
    renderSettingsSubHeader() {
        const activeTab = this.contextData.activeTab || 'general';

        return `
            <div class="sub-header sub-header-settings">
                <div class="sub-header-left">
                    <div class="context-title">
                        <div class="context-icon context-icon-settings">
                            ${Icons.settings ? Icons.settings({ size: 24, color: '#6366f1' }) : ''}
                        </div>
                        <h1>Instellingen</h1>
                    </div>
                    
                    <div class="settings-tabs">
                        <button class="settings-tab ${activeTab === 'general' ? 'active' : ''}" data-settings-tab="general">
                            ${Icons.settings ? Icons.settings({ size: 16 }) : ''}
                            <span>Algemeen</span>
                        </button>
                        <button class="settings-tab ${activeTab === 'profile' ? 'active' : ''}" data-settings-tab="profile">
                            ${Icons.user ? Icons.user({ size: 16 }) : ''}
                            <span>Profiel</span>
                        </button>
                        <button class="settings-tab ${activeTab === 'notifications' ? 'active' : ''}" data-settings-tab="notifications">
                            ${Icons.bell ? Icons.bell({ size: 16 }) : ''}
                            <span>Notificaties</span>
                        </button>
                        <button class="settings-tab ${activeTab === 'security' ? 'active' : ''}" data-settings-tab="security">
                            ${Icons.shieldCheck ? Icons.shieldCheck({ size: 16 }) : ''}
                            <span>Beveiliging</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render Team sub-header
     */
    renderTeamSubHeader() {
        const count = this.contextData.count || 0;
        const filters = this.contextData.filters || {};
        const filterOptions = this.contextData.filterOptions || {};

        return `
            <div class="sub-header sub-header-context">
                <div class="sub-header-left">
                    <div class="nav-tab active" data-color="green">
                        ${Icons.users ? Icons.users({ size: 16, color: '#10b981' }) : ''}
                        <span>Teambeheer</span>
                        <span class="nav-badge">${count}</span>
                    </div>
                </div>
                
                <div class="sub-header-center">
                    <div class="sub-header-filters">
                        <div class="filter-search-compact">
                            <span class="search-icon">${Icons.search ? Icons.search({ size: 15, color: '#94a3b8', strokeWidth: 2.5 }) : ''}</span>
                            <input type="text" 
                                   id="context-filter-search" 
                                   class="filter-input-compact"
                                   placeholder="Zoek teamlid..."
                                   value="${filters.search || ''}">
                        </div>
                        
                        <div class="filter-divider"></div>
                        
                        <select id="context-filter-1" class="filter-select-compact">
                            <option value="">Alle rollen</option>
                            ${(filterOptions.roles || ['manager', 'coordinator', 'schrijver', 'designer', 'calculator', 'reviewer', 'sales', 'klant_contact']).map(r => `
                                <option value="${r}" ${filters.rol === r ? 'selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1).replace('_', ' ')}</option>
                            `).join('')}
                        </select>
                        
                        <select id="context-filter-2" class="filter-select-compact">
                            <option value="all">Alle statussen</option>
                            <option value="active" ${filters.status === 'active' ? 'selected' : ''}>Actief</option>
                            <option value="inactive" ${filters.status === 'inactive' ? 'selected' : ''}>Inactief</option>
                        </select>
                        
                        <button class="btn-icon-compact btn-reset-filters" id="context-reset-filters" title="Reset filters">
                            ${Icons.x ? Icons.x({ size: 16 }) : '×'}
                        </button>
                    </div>
                </div>
                
                <div class="sub-header-right">
                    <button class="create-btn create-btn-green" id="context-create-btn">
                        ${Icons.plus ? Icons.plus({ size: 16, color: '#ffffff' }) : ''}
                        <span>Teamlid</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners for sub-header
     * ⭐ v2.9: Verwijderd: create-tender-btn listener (niet meer nodig)
     */
    attachSubHeaderListeners() {
        const subHeader = document.getElementById('sub-header-container');
        if (!subHeader) return;

        const self = this;

        // Tender tabs
        subHeader.querySelectorAll('.main-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                subHeader.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                self.activeTab = tabName;
                if (self.onTabChange) self.onTabChange(tabName);
            });
        });

        // View toggle
        subHeader.querySelectorAll('.view-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                subHeader.querySelectorAll('.view-toggle button').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                self.activeView = view;
                if (self.onViewChange) self.onViewChange(view);
            });
        });

        // ⭐ v2.9: Smart Import button (nu de primaire create knop)
        const smartImportBtn = subHeader.querySelector('#smart-import-btn');
        if (smartImportBtn) {
            smartImportBtn.addEventListener('click', () => {
                if (self.onSmartImport) self.onSmartImport();
            });
        }

        // Tender search input
        const tenderSearchInput = subHeader.querySelector('#tender-search-input');
        if (tenderSearchInput) {
            // ⭐ v2.8: GEEN live filtering meer - alleen zoeken bij Enter
            // Dit voorkomt dat de view wisselt tijdens het typen

            // Enter key creates chip and triggers search
            tenderSearchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();

                    const query = e.target.value.trim();
                    if (query) {
                        self.createSearchChip(query);
                    }
                }

                // Escape key to clear
                if (e.key === 'Escape') {
                    self.clearSearch();
                    tenderSearchInput.blur();
                }
            });
        }

        // Attach chip listeners if chip exists
        this.attachChipListeners();

        // Context create button (bedrijven, tenderbureaus, team)
        const contextCreateBtn = subHeader.querySelector('#context-create-btn');
        if (contextCreateBtn) {
            contextCreateBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔥 Context create button clicked');

                if (self.contextData && typeof self.contextData.onAdd === 'function') {
                    self.contextData.onAdd();
                } else if (self.onContextAction) {
                    self.onContextAction('create', self.currentContext);
                }
            });
        }

        // Context filter listeners
        const searchInput = subHeader.querySelector('#context-filter-search');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (self.contextData.onFilterChange) {
                        self.contextData.onFilterChange('search', e.target.value);
                    }
                }, 300);
            });
        }

        const filter1 = subHeader.querySelector('#context-filter-1');
        if (filter1) {
            filter1.addEventListener('change', (e) => {
                if (self.contextData.onFilterChange) {
                    self.contextData.onFilterChange('filter1', e.target.value);
                }
            });
        }

        const filter2 = subHeader.querySelector('#context-filter-2');
        if (filter2) {
            filter2.addEventListener('change', (e) => {
                if (self.contextData.onFilterChange) {
                    self.contextData.onFilterChange('filter2', e.target.value);
                }
            });
        }

        const resetBtn = subHeader.querySelector('#context-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                const searchInput = subHeader.querySelector('#context-filter-search');
                const filter1 = subHeader.querySelector('#context-filter-1');
                const filter2 = subHeader.querySelector('#context-filter-2');

                if (searchInput) searchInput.value = '';
                if (filter1) filter1.value = '';
                if (filter2) filter2.value = filter2.options[0]?.value || '';

                if (self.contextData.onResetFilters) {
                    self.contextData.onResetFilters();
                }
            });
        }

        // Settings tabs
        subHeader.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const settingsTab = tab.dataset.settingsTab;
                subHeader.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                self.contextData.activeTab = settingsTab;
                if (self.onContextAction) self.onContextAction('settings-tab', settingsTab);
            });
        });
    }

    /**
     * Attach main event listeners
     */
    attachEventListeners(container) {
        const self = this;

        // Menu toggle
        const menuBtn = container.querySelector('#menu-btn');
        const menuContent = container.querySelector('#menu-content');

        menuBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            self.menuOpen = !self.menuOpen;
            menuContent.classList.toggle('show', self.menuOpen);
            menuBtn.classList.toggle('active', self.menuOpen);
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!container.querySelector('.menu-dropdown')?.contains(e.target) &&
                !container.querySelector('.profile-dropdown')?.contains(e.target)) {
                self.menuOpen = false;
                self.profileMenuOpen = false;
                menuContent?.classList.remove('show');
                menuBtn?.classList.remove('active');
                container.querySelector('#profile-menu')?.classList.remove('show');
                container.querySelector('#profile-btn')?.classList.remove('active');
            }
        });

        // Profile dropdown toggle
        const profileBtn = container.querySelector('#profile-btn');
        const profileMenu = container.querySelector('#profile-menu');

        profileBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            self.profileMenuOpen = !self.profileMenuOpen;
            profileMenu?.classList.toggle('show', self.profileMenuOpen);
            profileBtn?.classList.toggle('active', self.profileMenuOpen);

            self.menuOpen = false;
            menuContent?.classList.remove('show');
            menuBtn?.classList.remove('active');
        });

        // Profile menu items
        container.querySelectorAll('.profile-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                self.profileMenuOpen = false;
                profileMenu?.classList.remove('show');
                profileBtn?.classList.remove('active');

                if (self.onMenuAction) self.onMenuAction(action);
            });
        });

        // Menu items
        container.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.dataset.action;
                self.menuOpen = false;
                menuContent?.classList.remove('show');
                menuBtn?.classList.remove('active');

                if (self.onMenuAction) self.onMenuAction(action);
            });
        });

        // Attach sub-header listeners
        this.attachSubHeaderListeners();
    }

    /**
     * Set active tab programmatically
     * ⭐ v2.8: null betekent geen actieve tab (bijv. zoekresultaten view)
     */
    setActiveTab(tabName) {
        this.activeTab = tabName;

        const tabs = document.querySelectorAll('.main-tab');
        tabs.forEach(tab => {
            if (tabName && tab.dataset.tab === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }

    /**
     * Set active view programmatically
     */
    setActiveView(viewName) {
        this.activeView = viewName;

        const buttons = document.querySelectorAll('.view-toggle button');
        buttons.forEach(btn => {
            if (btn.dataset.view === viewName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.bureauSwitcher) {
            this.bureauSwitcher.destroy();
        }
    }
}

export default Header;