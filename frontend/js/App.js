/**
 * TenderPlanner App Controller
 * TenderZen v2.2 - Multi-Bureau Support + Custom Logout Modal
 * 
 * CHANGELOG:
 * - v2.2: Custom logout confirmation modal
 * - v2.1: Multi-bureau support toegevoegd
 *   - BureauAccessService integratie
 *   - Bureau context initialisatie
 *   - Bureau switcher in header
 *   - Data herladen bij bureau wissel
 * - v2.0: TenderbureausView, Header context support
 */

import { Header } from './components/Header.js';
import { TenderAanmaken } from './components/TenderAanmaken.js';
import { BedrijfModal } from './components/BedrijfModal.js';
import { TeamlidModal } from './components/TeamlidModal.js';
import { apiService } from './services/ApiService.js';
import { faseService } from './services/FaseService.js';
import { bedrijvenService } from './services/Bedrijvenservice.js';
import { tenderbureausService } from './services/TenderbureausService.js';
import { getSupabase } from './config.js';

// ============================================================
// NIEUW: Import LogoutConfirmModal
// ============================================================
import { confirmLogout } from './components/LogoutConfirmModal.js';

// ============================================================
// Import BureauAccessService
// ============================================================
import { bureauAccessService } from './services/BureauAccessService.js';
import { UserService } from './services/UserService.js';

// Views
import { TotaalView } from './views/TotaalView.js';
import { AcquisitieView } from './views/AcquisitieView.js';
import { InschrijvingenView } from './views/InschrijvingenView.js';
import { IngediendView } from './views/IngediendView.js';
import { BedrijvenView } from './views/BedrijvenView.js';
import { TenderbureausView } from './views/TenderbureausView.js';
import { TeamledenView } from './views/TeamledenView.js';
import { teamService } from './services/TeamService.js';

export class App {
    constructor() {
        // Components
        this.header = null;
        this.tenderAanmaken = null;
        this.bedrijfModal = null;
        this.teamlidModal = null;

        // Views
        this.views = {
            totaal: null,
            acquisitie: null,
            inschrijvingen: null,
            ingediend: null,
            bedrijven: null,
            tenderbureaus: null,
            team: null
        };

        // State
        this.currentView = 'totaal';
        this.currentViewType = 'lijst'; // lijst, planning, kanban
        this.tenders = []; // Master data - all tenders
        this.isSuperAdmin = false;

        // Bureau state
        this.currentBureau = null;

        // DOM references
        this.contentContainer = null;

        // Make app globally available
        window.app = this;
    }

    /**
     * Initialize the app
     */
    async init() {
        console.log('🚀 TenderPlanner App wordt geïnitialiseerd...');

        try {
            // 1. Check authentication
            const isAuthenticated = await this.checkAuth();
            if (!isAuthenticated) {
                window.location.href = '/login.html';
                return;
            }

            // 2. Get DOM references
            this.contentContainer = document.getElementById('app-content');

            // 3. Initialize bureau context VOOR andere data laden
            console.log('🏢 Initializing bureau context...');
            await this.initBureauContext();

            // Check of user toegang heeft tot minimaal 1 bureau
            if (!this.currentBureau) {
                this.showNoBureauAccess();
                return;
            }

            // 4. Load fase configuration
            console.log('📋 Loading fase configuration...');
            await faseService.loadConfig();

            // 4b. Load bedrijven data
            console.log('🏢 Loading bedrijven...');
            await bedrijvenService.loadBedrijven();

            // 5. Initialize components
            this.initHeader();

            // 5b. Initialize bureau switcher in header
            console.log('🔀 Initializing bureau switcher...');
            await this.header.initBureauSwitcher();

            // Determine if user is super-admin (authoritative)
            try {
                const me = await UserService.getMe();
                this.isSuperAdmin = !!(me && me.is_super_admin);
            } catch (e) {
                console.warn('Could not fetch /users/me:', e);
                this.isSuperAdmin = false;
            }

            // Listen for global view toggle events
            window.addEventListener('globalViewToggled', async (ev) => {
                const enabled = ev.detail && ev.detail.enabled;
                console.log('🌐 Global view toggled:', enabled);
                // Reload data when toggled
                try {
                    await this.loadData();
                    await this.refreshCurrentView();
                } catch (err) {
                    console.error('❌ Error reloading data after global toggle:', err);
                }
            });

            // 5c. Setup bureau change handler
            this.header.onBureauChange = (newBureau) => this.handleBureauChange(newBureau);

            // 6. Initialize other components
            this.initTenderAanmaken();
            this.initBedrijfModal();
            this.initTeamlidModal();
            this.initViews();

            // 7. Load data (nu bureau-specifiek)
            await this.loadData();

            // 8. Show initial view
            this.showView('totaal');

            // 9. Hide loading screen
            this.hideLoading();

            console.log('✅ TenderPlanner App succesvol geladen!');
            console.log(`📍 Actief bureau: ${this.currentBureau.bureau_naam}`);

        } catch (error) {
            console.error('❌ App init error:', error);
            this.showError('Er ging iets fout bij het laden van de applicatie.');
        }
    }

    /**
     * Initialize bureau context
     * Moet VOOR data laden worden aangeroepen
     */
    async initBureauContext() {
        try {
            // Initialize bureau access service
            this.currentBureau = await bureauAccessService.initializeBureauContext();

            // Herstel selectie van 'Alle bureau's' uit localStorage (voor super_admin)
            const savedBureauId = localStorage.getItem('selectedBureauId');
            if (savedBureauId === 'ALL_BUREAUS' && this.isSuperAdmin) {
                this.currentBureau = null;
                console.log('⭐ Restored: Alle bureau\'s');
            }

            if (!this.currentBureau && !this.isSuperAdmin) {
                console.warn('⚠️ Geen bureau gevonden voor deze gebruiker');
                return null;
            }

            if (this.currentBureau) {
                console.log('✅ Bureau context:', this.currentBureau.bureau_naam);
                console.log('👤 Rol in bureau:', this.currentBureau.user_role);
            } else {
                console.log('⭐ Bureau context: Alle bureau\'s (super_admin)');
            }

            return this.currentBureau;

        } catch (error) {
            console.error('❌ Error initializing bureau context:', error);
            throw error;
        }
    }

    /**
     * Handle bureau change - herlaad alle data
     * @param {Object} newBureau - Het nieuwe bureau
     */
    async handleBureauChange(newBureau) {
        console.log('🔄 Bureau gewisseld naar:', newBureau?.bureau_naam || 'Alle bureau\'s');

        this.currentBureau = newBureau;
        if (newBureau === null) {
            localStorage.setItem('selectedBureauId', 'ALL_BUREAUS');
        } else if (newBureau?.bureau_id) {
            localStorage.setItem('selectedBureauId', newBureau.bureau_id);
        }

        // Toon loading state
        this.showBureauLoading();

        try {
            // Herlaad bedrijven cache voor nieuw bureau
            await bedrijvenService.refresh();

            // Herlaad alle tender data voor het nieuwe bureau
            await this.loadData();

            // Re-render huidige view
            await this.refreshCurrentView();

            // Update header counts
            this.updateHeaderCounts();

            console.log('✅ Data herladen voor nieuw bureau');

        } catch (error) {
            console.error('❌ Error loading data for new bureau:', error);
            this.showError('Er ging iets fout bij het laden van bureau data.');
        } finally {
            this.hideBureauLoading();
        }
    }

    /**
     * Refresh de huidige view na bureau wissel
     */
    async refreshCurrentView() {
        const view = this.views[this.currentView];

        if (!view) return;

        // Tender views
        if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend'].includes(this.currentView)) {
            view.setTenders(this.tenders);
        }
        // Bedrijven view
        else if (this.currentView === 'bedrijven') {
            const bedrijven = await bedrijvenService.getAllBedrijven();
            await view.setBedrijven(bedrijven);
        }
        // Team view
        else if (this.currentView === 'team') {
            const members = await teamService.getAllTeamMembers();
            await view.setTeamMembers(members);
        }
        // Tenderbureaus view (alleen super admin)
        else if (this.currentView === 'tenderbureaus') {
            const bureaus = await tenderbureausService.getAllBureaus();
            await view.setBureaus(bureaus);
        }
    }

    /**
     * Toon scherm wanneer user geen bureau toegang heeft
     */
    showNoBureauAccess() {
        this.hideLoading();

        if (this.contentContainer) {
            this.contentContainer.innerHTML = `
                <div class="no-bureau-access">
                    <div class="no-bureau-icon">🏢</div>
                    <h2>Geen bureau toegang</h2>
                    <p>Je hebt nog geen toegang tot een tenderbureau.</p>
                    <p>Vraag een collega om je uit te nodigen, of neem contact op met de beheerder.</p>
                    <div class="no-bureau-actions">
                        <button class="btn btn-secondary" onclick="window.app.checkForInvites()">
                            🔄 Controleer uitnodigingen
                        </button>
                        <button class="btn btn-outline" onclick="window.app.logout()">
                            Uitloggen
                        </button>
                    </div>
                </div>
            `;
        }

        // Minimale header zonder bureau switcher
        const headerContainer = document.getElementById('app-header');
        if (headerContainer) {
            headerContainer.innerHTML = `
                <header class="header header--minimal">
                    <div class="header-left">
                        <div class="logo-container">
                            <span class="logo-text">TenderZen</span>
                        </div>
                    </div>
                    <div class="header-right">
                        <span class="user-email">${this.userProfile?.email || ''}</span>
                    </div>
                </header>
            `;
        }
    }

    /**
     * Check voor openstaande uitnodigingen
     */
    async checkForInvites() {
        // Check URL voor invite token
        const urlParams = new URLSearchParams(window.location.search);
        const inviteToken = urlParams.get('invite');

        if (inviteToken) {
            try {
                await bureauAccessService.acceptInvite(inviteToken);
                alert('Uitnodiging geaccepteerd! De pagina wordt herladen.');
                window.location.reload();
            } catch (error) {
                alert(`Fout bij accepteren uitnodiging: ${error.message}`);
            }
        } else {
            alert('Geen uitnodigingslink gevonden. Vraag een collega om je een uitnodiging te sturen.');
        }
    }

    showBureauLoading() {
        // Verwijder bestaande overlay
        this.hideBureauLoading();

        const overlay = document.createElement('div');
        overlay.id = 'bureau-loading-overlay';
        overlay.innerHTML = `
            <div class="bureau-loading-spinner">
                <div class="spinner"></div>
                <p>Bureau wisselen...</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    hideBureauLoading() {
        const overlay = document.getElementById('bureau-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    /**
     * Check authentication and get user profile
     */
    async checkAuth() {
        console.log('🔑 Checking authentication...');

        try {
            const supabase = getSupabase();

            if (!supabase) {
                console.error('❌ Supabase client not available');
                return false;
            }

            const { data: { session }, error } = await supabase.auth.getSession();

            if (error || !session) {
                console.log('❌ Not authenticated');
                return false;
            }

            console.log('✅ Authenticated:', session.user.email);

            // Get user profile to check super-admin status
            const { data: profile } = await supabase
                .from('users')
                .select('naam, role, is_super_admin')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                this.isSuperAdmin = profile.is_super_admin || false;
                this.userProfile = {
                    naam: profile.naam || session.user.email?.split('@')[0],
                    email: session.user.email,
                    role: profile.role || 'member',
                    is_super_admin: this.isSuperAdmin
                };
                console.log('👤 User profile loaded, super-admin:', this.isSuperAdmin);
            }

            return true;
        } catch (error) {
            console.error('Auth check error:', error);
            return false;
        }
    }

    /**
     * Initialize header
     */
    initHeader() {
        console.log('📊 Initializing header...');

        this.header = new Header();

        // Set super-admin status
        this.header.setSuperAdmin(this.isSuperAdmin);

        // Set user profile
        if (this.userProfile) {
            this.header.setUserProfile(this.userProfile);
        }

        // Render header
        const headerContainer = document.getElementById('app-header');
        headerContainer.innerHTML = '';
        headerContainer.appendChild(this.header.render());

        // Bind events
        this.header.onTabChange = (tab) => this.handleTabChange(tab);
        this.header.onViewChange = (view) => this.handleViewTypeChange(view);
        this.header.onSearch = (query) => this.handleSearch(query);
        this.header.onTeamFilter = (team) => this.handleTeamFilter(team);
        this.header.onStatusFilter = (status) => this.handleStatusFilter(status);
        this.header.onCreateTender = () => this.handleCreateTender();
        this.header.onMenuAction = (action) => this.handleMenuAction(action);
        this.header.onContextAction = (action, data) => this.handleContextAction(action, data);
    }

    /**
     * Initialize tender creation form
     */
    initTenderAanmaken() {
        console.log('📝 Initializing tender form...');

        this.tenderAanmaken = new TenderAanmaken();
        document.body.appendChild(this.tenderAanmaken.render());

        // Callback for creating new tenders
        this.tenderAanmaken.onSave = async (data) => {
            try {
                await apiService.createTender(data);
                console.log('✅ Tender created');
                await this.loadData();
            } catch (error) {
                console.error('❌ Create tender error:', error);
                alert('Er ging iets fout bij het aanmaken van de tender.');
            }
        };

        // Callback for updating existing tenders
        this.tenderAanmaken.onUpdate = async (tenderId, data, isConcept) => {
            try {
                await apiService.updateTender(tenderId, data);
                console.log('✅ Tender updated');
                await this.loadData();
            } catch (error) {
                console.error('❌ Update tender error:', error);
                alert('Er ging iets fout bij het updaten van de tender.');
            }
        };
    }

    /**
     * Initialize bedrijf modal
     */
    initBedrijfModal() {
        console.log('🏢 Initializing bedrijf modal...');

        this.bedrijfModal = new BedrijfModal();

        // Callback when bedrijf is saved
        this.bedrijfModal.onSave = async (bedrijf) => {
            console.log('✅ Bedrijf saved:', bedrijf);

            // Reload bedrijven view if active
            if (this.currentView === 'bedrijven') {
                await this.views.bedrijven.reload();
            }

            // Reload bedrijven service cache
            await bedrijvenService.refresh();
        };
    }

    /**
     * Initialize teamlid modal
     */
    initTeamlidModal() {
        console.log('👤 Initializing teamlid modal...');

        this.teamlidModal = new TeamlidModal();

        // Callback when teamlid is saved
        this.teamlidModal.onSave = async (teamlid) => {
            console.log('✅ Teamlid saved:', teamlid);

            // Reload team view if active
            if (this.currentView === 'team') {
                await this.views.team.reload();
            }
        };
    }

    /**
     * Initialize all views
     */
    initViews() {
        console.log('👁️ Initializing views...');

        this.views = {
            totaal: new TotaalView(),
            acquisitie: new AcquisitieView(),
            inschrijvingen: new InschrijvingenView(),
            ingediend: new IngediendView(),
            bedrijven: new BedrijvenView(),
            tenderbureaus: new TenderbureausView(),
            team: new TeamledenView()
        };

        // Set callbacks for tender views
        Object.entries(this.views).forEach(([key, view]) => {
            if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend'].includes(key)) {
                view.onStatusChange = (tenderId, status) => this.handleStatusChange(tenderId, status);
                view.onTenderClick = (tenderId) => this.handleTenderClick(tenderId);
            }
        });

        // Set callbacks for bedrijven view
        this.views.bedrijven.onCreateBedrijf = () => {
            console.log('🔧 onCreateBedrijf callback triggered');
            this.bedrijfModal.open();
        };

        this.views.bedrijven.onEditBedrijf = (bedrijf, viewMode) => {
            console.log('🔧 onEditBedrijf callback triggered', { bedrijf: bedrijf?.bedrijfsnaam });
            this.bedrijfModal.open(bedrijf, viewMode);
        };

        this.views.bedrijven.onDeleteBedrijf = async (bedrijfId) => {
            try {
                await bedrijvenService.deleteBedrijf(bedrijfId);
                await this.views.bedrijven.reload();
                console.log('✅ Bedrijf deleted');
            } catch (error) {
                console.error('❌ Delete bedrijf error:', error);
                alert('Er ging iets fout bij het verwijderen.');
            }
        };

        // Set callbacks for tenderbureaus view (alleen super-admin)
        this.views.tenderbureaus.onCreateBureau = () => {
            alert('Nieuw tenderbureau aanmaken - komt binnenkort!');
        };

        this.views.tenderbureaus.onEditBureau = (bureau) => {
            console.log('Edit bureau:', bureau);
            alert(`Bureau bewerken: ${bureau.naam} - komt binnenkort!`);
        };

        this.views.tenderbureaus.onDeleteBureau = async (bureauId) => {
            try {
                await tenderbureausService.deactivateBureau(bureauId);
                await this.views.tenderbureaus.reload();
                console.log('✅ Bureau deactivated');
            } catch (error) {
                console.error('❌ Deactivate bureau error:', error);
                alert('Er ging iets fout bij het deactiveren.');
            }
        };

        this.views.tenderbureaus.onViewUsers = (bureau) => {
            console.log('View users for bureau:', bureau);
            alert(`Users van ${bureau.naam} bekijken - komt binnenkort!`);
        };

        // Set callbacks for team view
        this.views.team.onCreateMember = () => {
            this.teamlidModal.open();
        };

        this.views.team.onEditMember = (member) => {
            console.log('Edit member:', member);
            this.teamlidModal.open(member);
        };

        this.views.team.onDeleteMember = async (memberId) => {
            if (confirm('Weet je zeker dat je dit teamlid wilt verwijderen?')) {
                try {
                    await teamService.deleteTeamMember(memberId);
                    await this.views.team.reload();
                    console.log('✅ Teamlid deleted');
                } catch (error) {
                    console.error('❌ Delete teamlid error:', error);
                    alert('Er ging iets fout bij het verwijderen.');
                }
            }
        };

        console.log('✅ All views initialized');
    }

    /**
     * Load all data from API
     */
    async loadData() {
        console.log('📥 Loading data...');

        try {
            // Bepaal bureauId voor API call
            let bureauId = this.currentBureau?.bureau_id || null;
            if (this.isSuperAdmin && this.currentBureau === null) {
                bureauId = null; // "Alle bureau's"
            }

            const tenders = await apiService.getTenders(bureauId);
            this.tenders = Array.isArray(tenders) ? tenders : [];

            console.log(`✅ Loaded ${this.tenders.length} tenders`);

            // Update all views with new data
            this.updateViews();

            // Update header counts
            this.updateHeaderCounts();

        } catch (error) {
            console.error('❌ Load data error:', error);
            throw error;
        }
    }

    /**
     * Update all views with current tender data
     */
    updateViews() {
        Object.entries(this.views).forEach(([key, view]) => {
            if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend'].includes(key)) {
                view.setTenders(this.tenders);
            }
        });
    }

    /**
     * Update header badge counts
     */
    updateHeaderCounts() {
        const counts = {
            totaal: this.tenders.length,
            acquisitie: this.tenders.filter(t => t.fase === 'acquisitie').length,
            inschrijvingen: this.tenders.filter(t => t.fase === 'inschrijvingen').length,
            ingediend: this.tenders.filter(t => t.fase === 'ingediend').length
        };

        this.header.updateCounts(counts);

        // Update team members for filter
        const teamMembers = this.getUniqueTeamMembers();
        this.header.updateTeamOptions(teamMembers);
    }

    /**
     * Get unique team members
     */
    getUniqueTeamMembers() {
        const members = new Set();
        this.tenders.forEach(t => {
            if (t.manager) members.add(t.manager);
            if (t.schrijver) members.add(t.schrijver);
        });
        return Array.from(members).sort();
    }

    /**
     * Close all open modals
     */
    closeAllModals() {
        console.log('🔒 Closing all modals...');

        // Close TenderAanmaken modal
        if (this.tenderAanmaken && this.tenderAanmaken.isOpen) {
            this.tenderAanmaken.close();
        }

        // Close BedrijfModal
        if (this.bedrijfModal && this.bedrijfModal.isOpen) {
            this.bedrijfModal.close();
        }

        // Close TeamlidModal
        if (this.teamlidModal && this.teamlidModal.isOpen) {
            this.teamlidModal.close();
        }

        // Close TenderbureauModal
        if (this.tenderbureauModal && this.tenderbureauModal.isOpen) {
            this.tenderbureauModal.close();
        }

        // FALLBACK: Close any modal via DOM (in case they're not tracked)
        const modalSelectors = [
            '.teamlid-modal',
            '.bedrijf-modal',
            '.tenderbureau-modal',
            '.tender-aanmaken-modal',
            '.modal'
        ];

        modalSelectors.forEach(selector => {
            const modals = document.querySelectorAll(selector);
            modals.forEach(modal => {
                if (modal.classList.contains('is-open')) {
                    modal.classList.remove('is-open');
                    console.log(`🔒 Closed modal via fallback: ${modal.className}`);
                }
            });
        });

        // Reset body overflow
        document.body.style.overflow = '';
    }

    /**
     * Show a specific view
     */
    async showView(viewName) {
        // Close all open modals before switching view
        this.closeAllModals();
        console.log(`👁️ Showing view: ${viewName}`);

        // Unmount current view
        if (this.views[this.currentView]) {
            this.views[this.currentView].unmount();
        }

        // Update current view
        this.currentView = viewName;

        // Mount new view
        const view = this.views[viewName];
        if (view) {
            view.mount(this.contentContainer);

            // Handle view-specific data loading and header context
            if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend'].includes(viewName)) {
                this.header.setContext('tenders');
                this.header.setActiveTab(viewName);
            }
            else if (viewName === 'bedrijven') {
                const bedrijven = await bedrijvenService.getAllBedrijven();
                await view.setBedrijven(bedrijven);
            }
            else if (viewName === 'tenderbureaus') {
                const bureaus = await tenderbureausService.getAllBureaus();
                await view.setBureaus(bureaus);
            }
            else if (viewName === 'team') {
                const members = await teamService.getAllTeamMembers();
                await view.setTeamMembers(members);
            }

        } else {
            console.error(`View not found: ${viewName}`);
        }
    }

    /**
     * Handle tab change
     */
    handleTabChange(tab) {
        console.log(`📖 Tab change: ${tab}`);
        this.showView(tab);
    }

    /**
     * Handle view type change (lijst/planning/kanban)
     */
    handleViewTypeChange(viewType) {
        console.log(`🔄 View type change: ${viewType}`);
        this.currentViewType = viewType;

        if (viewType !== 'lijst') {
            alert(`${viewType.charAt(0).toUpperCase() + viewType.slice(1)} view komt binnenkort!`);
        }
    }

    /**
     * Handle search
     */
    handleSearch(query) {
        console.log(`🔍 Search: ${query}`);

        const view = this.views[this.currentView];
        if (view && view.setSearch) {
            view.setSearch(query);
        }
    }

    /**
     * Handle team filter
     */
    handleTeamFilter(team) {
        console.log(`👥 Team filter: ${team}`);

        const view = this.views[this.currentView];
        if (view && view.setTeamFilter) {
            view.setTeamFilter(team);
        }
    }

    /**
     * Handle status filter
     */
    handleStatusFilter(status) {
        console.log(`🎯 Status filter: ${status}`);

        const view = this.views[this.currentView];
        if (view && view.setStatusFilter) {
            view.setStatusFilter(status);
        }
    }

    /**
     * Handle create tender
     */
    handleCreateTender() {
        console.log('➕ Create tender');
        this.tenderAanmaken.open();
    }

    /**
     * Handle tender click - Open tender in edit modal
     */
    handleTenderClick(tenderId) {
        console.log(`📋 Tender clicked: ${tenderId}`);

        const tender = this.tenders.find(t => t.id === tenderId);

        if (tender) {
            this.tenderAanmaken.open(tender);
        } else {
            console.error('Tender not found:', tenderId);
        }
    }

    /**
     * Handle status change
     */
    async handleStatusChange(tenderId, newStatus) {
        console.log(`🔄 Status change: ${tenderId} → ${newStatus}`);

        try {
            await apiService.updateTender(tenderId, { status: newStatus });

            const tender = this.tenders.find(t => t.id === tenderId);
            if (tender) {
                tender.status = newStatus;
            }

            console.log('✅ Status updated');
        } catch (error) {
            console.error('❌ Status update error:', error);
            alert('Status wijzigen mislukt.');
            await this.loadData();
        }
    }

    /**
     * Handle context action (from dynamic header)
     */
    handleContextAction(action, data) {
        console.log(`🎯 Context action: ${action}`, data);

        switch (action) {
            case 'create':
                if (data === 'bedrijven') {
                    this.bedrijfModal.open();
                } else if (data === 'tenderbureaus') {
                    alert('Nieuw tenderbureau aanmaken - komt binnenkort!');
                }
                break;
            case 'settings-tab':
                console.log('Settings tab:', data);
                break;
        }
    }

    /**
     * Handle menu action
     */
    handleMenuAction(action) {
        console.log(`📋 Menu action: ${action}`);

        switch (action) {
            case 'tenders':
                this.showView('totaal');
                break;

            case 'bedrijven':
                this.showView('bedrijven');
                break;

            case 'tenderbureaus':
                if (this.isSuperAdmin) {
                    this.showView('tenderbureaus');
                } else {
                    alert('Je hebt geen toegang tot tenderbureaus beheer.');
                }
                break;

            case 'logout':
                this.logout();
                break;

            case 'export':
                this.exportData();
                break;

            case 'profile':
                alert('Profiel bewerken - komt binnenkort!');
                break;
            case 'mfa-settings':
                alert('MFA instellingen - komt binnenkort!');
                break;
            case 'notifications':
                alert('Notificatie instellingen - komt binnenkort!');
                break;

            case 'team':
                this.showView('team');
                break;

            case 'templates':
            case 'reports':
            case 'import':
            case 'settings':
            case 'preferences':
                alert(`${action} - Komt binnenkort!`);
                break;

            default:
                console.warn('Unknown menu action:', action);
        }
    }

    /**
     * Logout
     * ============================================================
     * v2.2: Custom logout confirmation modal
     * ============================================================
     */
    async logout() {
        // Gebruik custom modal in plaats van browser confirm()
        const confirmed = await confirmLogout();

        if (confirmed) {
            try {
                // Reset bureau service voor schone state
                bureauAccessService.reset();

                const supabase = getSupabase();
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    }

    /**
     * Export data
     */
    async exportData() {
        try {
            const json = JSON.stringify(this.tenders, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tenders-export-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export error:', error);
            alert('Export mislukt.');
        }
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        const loading = document.querySelector('.loading-screen');
        if (loading) {
            loading.style.display = 'none';
        }
        document.getElementById('app')?.classList.add('loaded');
    }

    /**
     * Show error
     */
    showError(message) {
        this.hideLoading();
        if (this.contentContainer) {
            this.contentContainer.innerHTML = `
                <div class="error-state">
                    <div class="error-icon">❌</div>
                    <h3>${message}</h3>
                    <button class="btn btn-primary" onclick="window.location.reload()">
                        Opnieuw proberen
                    </button>
                </div>
            `;
        }
    }
}

export default App;