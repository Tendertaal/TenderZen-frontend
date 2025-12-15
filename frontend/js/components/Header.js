/**
 * Header Component
 * TenderZen v2.4 - Multi-Bureau Support + Button Fix + Iconen Beheer + Archief Tab
 * 
 * De header bestaat uit twee delen:
 * 1. Main Header - Altijd zichtbaar (logo, BUREAU SWITCHER, menu, profile)
 * 2. Sub Header - Dynamisch per context (tenders, bedrijven, etc.)
 * 
 * CHANGELOG v2.4:
 * - NIEUW: Archief tab toegevoegd aan tender sub-header
 * - NIEUW: archief count in tenderCounts
 * - NIEUW: phase-indicator.archief styling
 * 
 * CHANGELOG v2.3:
 * - NIEUW: Iconen beheer menu-item voor super-admins
 * 
 * CHANGELOG v2.2:
 * - FIX: Context create button event listener werkt nu correct
 * 
 * CHANGELOG v2.1:
 * - BureauSwitcher toegevoegd voor multi-bureau support
 * 
 * GEBRUIK:
 * header.setContext('tenders', { counts: {...} });
 * header.setContext('bedrijven', { count: 5, onAdd: () => {} });
 * header.setContext('tenderbureaus', { count: 3, onAdd: () => {} });
 * header.setContext('settings', { activeTab: 'security' });
 */

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

// NIEUW: Import BureauSwitcher
import { BureauSwitcher } from '/js/components/BureauSwitcher.js';
import { bureauAccessService } from '/js/services/BureauAccessService.js';

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
        this.tenderCounts = {
            totaal: 0,
            acquisitie: 0,
            inschrijvingen: 0,
            ingediend: 0,
            archief: 0  // ⭐ v2.4: Archief count toegevoegd
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
        this.onCreateTender = null;
        this.onMenuAction = null;
        this.onContextAction = null; // Generic action callback for any context
        this.onTeamFilter = null;
        this.onStatusFilter = null;
        
        // NIEUW: Bureau state en callback
        this.bureauSwitcher = null;
        this.currentBureau = null;
        this.onBureauChange = null;
    }

    /**
     * Set the current context (changes sub-header)
     * @param {string} context - 'tenders' | 'bedrijven' | 'tenderbureaus' | 'settings' | 'team'
     * @param {object} data - Context-specific data
     */
    setContext(context, data = {}) {
        this.currentContext = context;
        this.contextData = data;
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
     * NIEUW: Initialize the bureau switcher component
     * Call this after render() and after user is authenticated
     */
    async initBureauSwitcher() {
        try {
            // Create and initialize the switcher
            this.bureauSwitcher = new BureauSwitcher();
            await this.bureauSwitcher.init();
            
            // Get current bureau
            this.currentBureau = bureauAccessService.getCurrentBureau();
            
            // Set callback for bureau changes
            this.bureauSwitcher.onBureauChange = (newBureau) => {
                this.currentBureau = newBureau;
                
                // Notify parent (App)
                if (this.onBureauChange) {
                    this.onBureauChange(newBureau);
                }
            };
            
            // Render into container
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
        
        // NIEUW: Update iconen menu item visibility
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
     * ⭐ v2.4: Archief badge toegevoegd
     */
    updateBadges() {
        const badges = {
            'totaal': document.querySelector('[data-tab="totaal"] .badge'),
            'acquisitie': document.querySelector('[data-tab="acquisitie"] .badge'),
            'inschrijvingen': document.querySelector('[data-tab="inschrijvingen"] .badge'),
            'ingediend': document.querySelector('[data-tab="ingediend"] .badge'),
            'archief': document.querySelector('[data-tab="archief"] .badge')  // ⭐ v2.4
        };

        Object.entries(badges).forEach(([tab, badge]) => {
            if (badge) {
                badge.textContent = this.tenderCounts[tab] || 0;
            }
        });
    }

    /**
     * Update team filter options
     * @param {Array} teamMembers - Array of team member names
     */
    updateTeamOptions(teamMembers) {
        this.teamMembers = teamMembers || [];
        // Team filter is optional - only update if element exists
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
     * Render TenderZen Logo
     */
    renderLogo() {
        return `
            <div class="logo-container">
                <div class="logo-icon">
                    <svg width="32" height="36" viewBox="0 0 48 52" fill="none">
                        <defs>
                            <linearGradient id="logoGradient" x1="24" y1="5" x2="24" y2="49" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stop-color="#c084fc"/>
                                <stop offset="50%" stop-color="#818cf8"/>
                                <stop offset="100%" stop-color="#667eea"/>
                            </linearGradient>
                        </defs>
                        <ellipse cx="24" cy="10" rx="9" ry="5.5" fill="url(#logoGradient)" opacity="0.6"/>
                        <ellipse cx="24" cy="25" rx="12" ry="6.5" fill="url(#logoGradient)" opacity="0.8"/>
                        <ellipse cx="24" cy="42" rx="15" ry="7" fill="url(#logoGradient)"/>
                    </svg>
                </div>
                <span class="logo-text">TenderZen</span>
            </div>
        `;
    }

    /**
     * Render the complete header
     */
    render() {
        const container = document.createElement('div');
        container.className = 'header-wrapper';
        container.id = 'header-wrapper';

        container.innerHTML = `
            <!-- Main Header Bar (Always visible) -->
            <header class="header">
                <div class="header-left">
                    ${this.renderLogo()}
                    
                    <!-- NIEUW: Bureau Switcher Container -->
                    <div id="bureau-switcher-container" class="bureau-switcher-container">
                        <!-- BureauSwitcher wordt hier gerenderd via initBureauSwitcher() -->
                    </div>
                </div>

                <div class="header-right">
                    <!-- Menu Dropdown -->
                    <div class="menu-dropdown">
                        <button class="menu-btn" id="menu-btn">
                            <span class="menu-icon">${Icons.grid ? Icons.grid({ size: 18 }) : ''}</span>
                            <span>Menu</span>
                            <span class="chevron-icon">${Icons.chevronDown ? Icons.chevronDown({ size: 14 }) : ''}</span>
                        </button>
                        <div class="menu-content" id="menu-content">
                            <a class="menu-item" data-action="tenders">
                                <span class="menu-item-icon">${Icons.fileText ? Icons.fileText({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Tenders</span>
                            </a>
                            <a class="menu-item" data-action="bedrijven">
                                <span class="menu-item-icon">${Icons.building ? Icons.building({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Bedrijven</span>
                            </a>
                            <div class="menu-divider"></div>
                            <a class="menu-item" data-action="team">
                                <span class="menu-item-icon">${Icons.users ? Icons.users({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Teamleden beheren</span>
                            </a>
                            <div class="menu-divider"></div>
                            <a class="menu-item" data-action="reports">
                                <span class="menu-item-icon">${Icons.barChart ? Icons.barChart({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Rapportages</span>
                            </a>
                            <a class="menu-item" data-action="settings">
                                <span class="menu-item-icon">${Icons.settings ? Icons.settings({ size: 18 }) : ''}</span>
                                <span class="menu-item-label">Instellingen</span>
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

                    <!-- Profile Avatar (simplified) -->
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
     * Render Tenders sub-header (tabs + view toggle)
     * ⭐ v2.4: Archief tab toegevoegd
     */
    renderTendersSubHeader() {
        return `
            <div class="sub-header sub-header-tenders">
                <div class="sub-header-left">
                    <button class="main-tab ${this.activeTab === 'totaal' ? 'active' : ''}" data-tab="totaal">
                        <span class="tab-icon">${Icons.dashboard ? Icons.dashboard({ size: 18 }) : ''}</span>
                        <span class="tab-label">Totaaloverzicht</span>
                        <span class="badge">${this.tenderCounts.totaal}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'acquisitie' ? 'active' : ''}" data-tab="acquisitie">
                        <span class="phase-indicator acquisitie"></span>
                        <span class="tab-label">Acquisitie</span>
                        <span class="badge">${this.tenderCounts.acquisitie}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'inschrijvingen' ? 'active' : ''}" data-tab="inschrijvingen">
                        <span class="phase-indicator inschrijvingen"></span>
                        <span class="tab-label">Inschrijvingen</span>
                        <span class="badge">${this.tenderCounts.inschrijvingen}</span>
                    </button>
                    <button class="main-tab ${this.activeTab === 'ingediend' ? 'active' : ''}" data-tab="ingediend">
                        <span class="phase-indicator ingediend"></span>
                        <span class="tab-label">Ingediend</span>
                        <span class="badge">${this.tenderCounts.ingediend}</span>
                    </button>
                    <!-- ⭐ v2.4: Archief tab -->
                    <button class="main-tab ${this.activeTab === 'archief' ? 'active' : ''}" data-tab="archief">
                        <span class="phase-indicator archief"></span>
                        <span class="tab-label">Archief</span>
                        <span class="badge">${this.tenderCounts.archief}</span>
                    </button>
                </div>

                <div class="sub-header-right">
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
                    
                    <button class="create-btn" id="create-tender-btn">
                        ${Icons.plus ? Icons.plus({ size: 16, color: '#ffffff' }) : ''}
                        <span>Tender</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render Bedrijven sub-header (Voorstel C: Underline stijl)
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
                            <option value="">Alle plaatsen</option>
                            ${(filterOptions.plaatsen || []).map(p => `
                                <option value="${p}" ${filters.plaats === p ? 'selected' : ''}>${p}</option>
                            `).join('')}
                        </select>
                        
                        <button class="btn-icon-compact btn-reset-filters" id="context-reset-filters" title="Reset filters">
                            ${Icons.x ? Icons.x({ size: 14, color: '#94a3b8' }) : '×'}
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
     * Render Tenderbureaus sub-header (Voorstel C: Underline stijl)
     */
    renderTenderbureausSubHeader() {
        const count = this.contextData.count || 0;
        const filters = this.contextData.filters || {};
        
        return `
            <div class="sub-header sub-header-context">
                <div class="sub-header-left">
                    <div class="nav-tab active" data-color="purple">
                        ${Icons.briefcase ? Icons.briefcase({ size: 16, color: '#8b5cf6' }) : ''}
                        <span>Tenderbureaus Beheer</span>
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
                                   placeholder="Zoek bureau..."
                                   value="${filters.search || ''}">
                        </div>
                        
                        <div class="filter-divider"></div>
                        
                        <select id="context-filter-1" class="filter-select-compact">
                            <option value="">Alle tiers</option>
                            <option value="free" ${filters.tier === 'free' ? 'selected' : ''}>Free</option>
                            <option value="basic" ${filters.tier === 'basic' ? 'selected' : ''}>Basic</option>
                            <option value="professional" ${filters.tier === 'professional' ? 'selected' : ''}>Professional</option>
                            <option value="enterprise" ${filters.tier === 'enterprise' ? 'selected' : ''}>Enterprise</option>
                        </select>
                        
                        <select id="context-filter-2" class="filter-select-compact">
                            <option value="all" ${filters.active === 'all' ? 'selected' : ''}>Alle status</option>
                            <option value="active" ${filters.active === 'active' ? 'selected' : ''}>Actief</option>
                            <option value="inactive" ${filters.active === 'inactive' ? 'selected' : ''}>Inactief</option>
                        </select>
                        
                        <button class="btn-icon-compact btn-reset-filters" id="context-reset-filters" title="Reset filters">
                            ${Icons.x ? Icons.x({ size: 14, color: '#94a3b8' }) : '×'}
                        </button>
                    </div>
                </div>

                <div class="sub-header-right">
                    <button class="create-btn create-btn-purple" id="context-create-btn">
                        ${Icons.plus ? Icons.plus({ size: 16, color: '#ffffff' }) : ''}
                        <span>Tenderbureau</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render Settings sub-header
     */
    renderSettingsSubHeader() {
        const activeTab = this.contextData.activeTab || 'profile';
        
        return `
            <div class="sub-header sub-header-settings">
                <div class="sub-header-left">
                    <div class="context-title">
                        <span class="context-icon context-icon-settings">
                            ${Icons.settings ? Icons.settings({ size: 22, color: '#6366f1' }) : ''}
                        </span>
                        <h1>Instellingen</h1>
                    </div>
                    
                    <div class="settings-tabs">
                        <button class="settings-tab ${activeTab === 'profile' ? 'active' : ''}" data-settings-tab="profile">
                            ${Icons.user ? Icons.user({ size: 16 }) : ''}
                            <span>Profiel</span>
                        </button>
                        <button class="settings-tab ${activeTab === 'security' ? 'active' : ''}" data-settings-tab="security">
                            ${Icons.shieldCheck ? Icons.shieldCheck({ size: 16 }) : ''}
                            <span>Beveiliging</span>
                        </button>
                        <button class="settings-tab ${activeTab === 'notifications' ? 'active' : ''}" data-settings-tab="notifications">
                            ${Icons.bell ? Icons.bell({ size: 16 }) : ''}
                            <span>Notificaties</span>
                        </button>
                        <button class="settings-tab ${activeTab === 'preferences' ? 'active' : ''}" data-settings-tab="preferences">
                            ${Icons.sliders ? Icons.sliders({ size: 16 }) : ''}
                            <span>Voorkeuren</span>
                        </button>
                    </div>
                </div>

                <div class="sub-header-right">
                    <!-- Empty for settings -->
                </div>
            </div>
        `;
    }

    /**
     * Render Team sub-header (Voorstel C: Underline stijl)
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
                        <span>Teamleden Beheer</span>
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
                            ${(filterOptions.roles || []).map(r => `
                                <option value="${r.key}" ${filters.role === r.key ? 'selected' : ''}>${r.label}</option>
                            `).join('')}
                        </select>
                        
                        <button class="btn-icon-compact btn-reset-filters" id="context-reset-filters" title="Reset filters">
                            ${Icons.x ? Icons.x({ size: 14, color: '#94a3b8' }) : '×'}
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
     * FIX v2.2: Context create button now uses explicit self reference
     */
    attachSubHeaderListeners() {
        const subHeader = document.getElementById('sub-header-container');
        if (!subHeader) return;

        // Store reference to this for callbacks
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

        // Create tender button
        const createTenderBtn = subHeader.querySelector('#create-tender-btn');
        if (createTenderBtn) {
            createTenderBtn.addEventListener('click', () => {
                if (self.onCreateTender) self.onCreateTender();
            });
        }

        // ============================================================
        // FIX v2.2: Context create button (bedrijven, tenderbureaus, team)
        // Using explicit self reference and regular function for reliable this binding
        // ============================================================
        const contextCreateBtn = subHeader.querySelector('#context-create-btn');
        if (contextCreateBtn) {
            contextCreateBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('🔥 Context create button clicked');
                console.log('📋 contextData:', self.contextData);
                
                if (self.contextData && typeof self.contextData.onAdd === 'function') {
                    console.log('✅ Calling contextData.onAdd()');
                    self.contextData.onAdd();
                } else if (self.onContextAction) {
                    console.log('✅ Calling onContextAction()');
                    self.onContextAction('create', self.currentContext);
                } else {
                    console.warn('⚠️ No handler found for context create button');
                }
            });
        }

        // ========== CONTEXT FILTER LISTENERS ==========
        
        // Search input with debounce
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
        
        // Filter dropdown 1 (branche / tier)
        const filter1 = subHeader.querySelector('#context-filter-1');
        if (filter1) {
            filter1.addEventListener('change', (e) => {
                if (self.contextData.onFilterChange) {
                    self.contextData.onFilterChange('filter1', e.target.value);
                }
            });
        }
        
        // Filter dropdown 2 (plaats / status)
        const filter2 = subHeader.querySelector('#context-filter-2');
        if (filter2) {
            filter2.addEventListener('change', (e) => {
                if (self.contextData.onFilterChange) {
                    self.contextData.onFilterChange('filter2', e.target.value);
                }
            });
        }
        
        // Reset filters button
        const resetBtn = subHeader.querySelector('#context-reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                // Reset input values visually
                const searchInput = subHeader.querySelector('#context-filter-search');
                const filter1 = subHeader.querySelector('#context-filter-1');
                const filter2 = subHeader.querySelector('#context-filter-2');
                
                if (searchInput) searchInput.value = '';
                if (filter1) filter1.value = '';
                if (filter2) filter2.value = filter2.options[0]?.value || '';
                
                // Notify view
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
        // Store reference to this
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

        // Search input
        const searchInput = container.querySelector('#search-input');
        let searchTimeout;
        
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (self.onSearch) self.onSearch(e.target.value);
            }, 300);
        });

        // Attach sub-header listeners
        this.attachSubHeaderListeners();
    }

    /**
     * Set active tab programmatically
     */
    setActiveTab(tabName) {
        this.activeTab = tabName;
        
        const tabs = document.querySelectorAll('.main-tab');
        tabs.forEach(tab => {
            if (tab.dataset.tab === tabName) {
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
     * NIEUW: Cleanup
     */
    destroy() {
        if (this.bureauSwitcher) {
            this.bureauSwitcher.destroy();
        }
    }
}

export default Header;