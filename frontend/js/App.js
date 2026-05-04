/**
 * TenderPlanner App Controller
 * TenderZen v3.1 - Dynamische fase configuratie
 * 
 * DOEL-PAD: Frontend/js/App.js
 * 
 * CHANGELOG:
 * - v3.1: DYNAMISCHE FASES — counts, tabs en kolommen worden opgebouwd uit fase_config DB tabel
 *         Geen hardcoded fases meer in updateHeaderCounts(), Header of KanbanView
 * - v3.0: KanbanView geïntegreerd via view toggle (drag & drop fase wijziging)
 * - v2.9: AgendaView (Planning view) geïntegreerd via view toggle
 * - v2.8: Explicit bureau context bij loadBedrijven (loadAll voor super-admin)
 * - v2.7: teamService.clearCache() bij bureau wissel + immediate setContext in showView
 * - v2.6: PlanningModal integratie + onOpenPlanningModal/onAddTeamMember callbacks
 * - v2.5: Zoekresultaten navigeert naar aparte view met alle matches
 * - v2.4: Zoekresultaten count naar Header filter chips balk
 * - v2.3: Zoekfunctie geïntegreerd (handleTenderSearch)
 * - v2.2.1: Super admin toegang fix
 * - v2.2: Custom logout confirmation modal
 * - v2.1: Multi-bureau support toegevoegd
 * - v2.0: TenderbureausView, Header context support
 */

import { Header } from './components/Header.js';
import { SmartImportWizard } from './components/smart-import/SmartImportWizard.js';
import { TenderAanmaken } from './components/TenderAanmaken.js';
import { BedrijfModal } from './components/BedrijfModal.js';
import { TeamlidModal } from './components/TeamlidModal.js';
import { PlanningModal } from './modals/PlanningModal/PlanningModal.js';
import { apiService } from './services/ApiService.js';
import { faseService } from './services/FaseService.js';
import { bedrijvenService } from './services/Bedrijvenservice.js';
import { tenderbureausService } from './services/TenderbureausService.js';
import { getSupabase } from './config.js';

// Import LogoutConfirmModal
import { confirmLogout } from './components/LogoutConfirmModal.js';
import { showToast } from './utils/toast.js';

// Import BureauAccessService
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
import { ArchiefView } from './views/ArchiefView.js';
import { ZoekresultatenView } from './views/ZoekresultatenView.js';
import { AgendaView } from './views/AgendaView.js';
import { KanbanView } from './views/KanbanView.js';
import { teamService } from './services/TeamService.js';
import { TemplateBeheerView } from './views/TemplateBeheerView.js';
import { ProfielView } from './views/ProfielView.js';
import { AIUsageView } from './views/AIUsageView.js';

export class App {
    constructor() {
        // Components
        this.header = null;
        this.tenderAanmaken = null;
        this.bedrijfModal = null;
        this.teamlidModal = null;
        this.planningModal = null;
        this.smartImportWizard = null;

        // Views
        this.views = {
            totaal: null,
            acquisitie: null,
            inschrijvingen: null,
            ingediend: null,
            archief: null,
            zoekresultaten: null,
            bedrijven: null,
            tenderbureaus: null,
            team: null,
            templatebeheer: null,
            profiel: null
        };

        // AgendaView (apart beheerd)
        this.agendaView = null;

        // KanbanView (apart beheerd)
        this.kanbanView = null;

        // KalenderView (apart beheerd)
        this.kalenderView = null;

        // GanttView (apart beheerd)
        this.ganttView = null;

        // State
        this.currentView = 'totaal';
        this.previousView = 'totaal';
        this.currentViewType = 'lijst'; // lijst, planning, kanban, kalender
        this.tenders = []; // Master data - all tenders
        this.isSuperAdmin = false;

        // Zoekquery + fase filter state
        this.searchQuery = '';
        this.currentFaseFilter = null; // null = alle fases; string[] = actieve FaseBar selectie

        // Bureau state
        this.currentBureau = null;

        // DOM references
        this.contentContainer = null;

        // Make app globally available
        window.app = this;
        window.apiService = apiService;
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

            // 3b. Load alle tenderbureaus (voor lookup in modals/views)
            try {
                this.tenderbureaus = await tenderbureausService.getAllBureaus();
                console.log(`✅ Alle tenderbureaus geladen: ${this.tenderbureaus.length}`);
            } catch (e) {
                console.error('❌ Kan tenderbureaus niet laden:', e);
                this.tenderbureaus = [];
            }

            // v2.2.1 FIX: Check of user toegang heeft tot minimaal 1 bureau
            if (!this.currentBureau && !this.isSuperAdmin) {
                console.warn('⚠️ Geen bureau toegang en geen super admin');
                this.showNoBureauAccess();
                return;
            }

            if (this.isSuperAdmin && !this.currentBureau) {
                console.log('✅ Super admin - toegang verleend zonder specifiek bureau');
            }

            // 4. Load fase configuration
            console.log('📋 Loading fase configuration...');
            await faseService.loadConfig();

            // 4b. Load bedrijven data
            console.log('🏢 Loading bedrijven...');
            const initBureauId = this.currentBureau?.bureau_id || null;
            await bedrijvenService.loadBedrijven(
                initBureauId ? { tenderbureauId: initBureauId } : { loadAll: true }
            );

            // 5. Initialize components
            this.initHeader();
            // Smart Import wizard component
            this.smartImportWizard = new SmartImportWizard({
                getTenderbureauId: () => this.currentBureau?.bureau_id || window.activeBureauId || window.currentUser?.tenderbureau_id,
                onComplete: (tender) => {
                    this.loadData();
                },
                onCancel: () => {
                    console.log('Smart Import geannuleerd');
                }
            });

            // 5b. Initialize bureau switcher in header
            console.log('🔀 Initializing bureau switcher...');
            await this.header.initBureauSwitcher();

            // 5c. Initialize sidebar + topbar (na bureau switcher zodat we die kunnen verplaatsen)
            this.initSidebarTopbar();
            // Sidebar user menu event koppelen
            document.addEventListener('sidebar:userAction', (e) => {
                const action = e.detail.action;
                this.handleMenuAction(action);
            });

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
            this.initPlanningModal();
            this.initViews();

            // 7. Load data (nu bureau-specifiek)
            await this.loadData();

            // 8. Show initial view
            this.showView('totaal');

            // 9. Hide loading screen
            this.hideLoading();

            // 10. Notities paneel initialiseren
            if (typeof NotitiesPanel !== 'undefined') {
                window.notitiesPanel = new NotitiesPanel();
                await window.notitiesPanel.init(document.body);
                window.notitiesPanel.restoreLastTender();
            }

            console.log('✅ TenderPlanner App succesvol geladen!');
            if (this.currentBureau) {
                console.log(`📍 Actief bureau: ${this.currentBureau.bureau_naam}`);
            } else {
                console.log(`📍 Actief bureau: Alle bureau's (super_admin)`);
            }

        } catch (error) {
            console.error('❌ App init error:', error);
            this.showError('Er ging iets fout bij het laden van de applicatie.');
        }
    }

    /**
     * Initialize bureau context
     */
    async initBureauContext() {
        try {
            this.currentBureau = await bureauAccessService.initializeBureauContext();

            const savedBureauId = localStorage.getItem('selectedBureauId');
            if (savedBureauId === 'ALL_BUREAUS' && this.isSuperAdmin) {
                this.currentBureau = null;
                bureauAccessService.setAllBureausMode();
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
     */
    async handleBureauChange(newBureau) {
        console.log('🔄 Bureau gewisseld naar:', newBureau?.bureau_naam || 'Alle bureau\'s');

        // Notities paneel leegmaken bij bureau wisselen
        localStorage.removeItem('tz_last_tender');
        window.notitiesPanel?.clear();

        this.currentBureau = newBureau;
        if (newBureau === null) {
            localStorage.setItem('selectedBureauId', 'ALL_BUREAUS');
            bureauAccessService.setAllBureausMode();
        } else if (newBureau?.bureau_id) {
            localStorage.setItem('selectedBureauId', newBureau.bureau_id);
        }

        this.showBureauLoading();

        try {
            bedrijvenService.clearCache();
            teamService.clearCache();
            window.planningService?.invalidateCache?.();
            // Reset bureau-gebonden singleton views zodat ze bij herladen de nieuwe bureau-context pakken
            this._tendersignaleringView = null;
            this._bedrijfsProfielView   = null;

            const bureauId = newBureau?.bureau_id || null;
            await bedrijvenService.loadBedrijven(
                bureauId ? { tenderbureauId: bureauId } : { loadAll: true }
            );

            await this.loadData();
            await this.refreshCurrentView();
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
        if (this.currentViewType === 'planning' && this.agendaView) {
            this.agendaView.loadData();
            return;
        }

        if (this.currentViewType === 'kanban' && this.kanbanView) {
            this.kanbanView.setTenders(this.tenders);
            return;
        }

        if (this.currentViewType === 'kalender' && this.kalenderView) {
            this.kalenderView.refresh();
            return;
        }

        if (this.currentViewType === 'gantt' && this.ganttView) {
            this.ganttView.refresh();
            return;
        }

        // Non-module singleton views die bureau-context nodig hebben: opnieuw mounten
        if (this.currentView === 'tendersignalering') {
            // Instantie is al op null gezet in handleBureauChange; nieuwe aanmaken + mounten
            this._tendersignaleringView = new window.TendersignaleringView();
            this.contentContainer.innerHTML = '';
            this._tendersignaleringView.mount(this.contentContainer);
            return;
        }

        if (this.currentView === 'bedrijfsprofiel') {
            // BedrijfsProfielView is per bedrijf — navigeer terug naar bedrijvenlijst
            this._bedrijfsProfielView = null;
            this.showView('bedrijven');
            return;
        }

        const view = this.views[this.currentView];

        if (!view) return;

        if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend', 'archief'].includes(this.currentView)) {
            view.setTenders(this.tenders);
        }
        else if (this.currentView === 'bedrijven') {
            const bureauId = this.currentBureau?.bureau_id || null;
            await bedrijvenService.loadBedrijven(
                bureauId ? { tenderbureauId: bureauId } : { loadAll: true }
            );
            const bedrijven = bedrijvenService.getAllBedrijven();
            await view.setBedrijven(bedrijven);
        }
        else if (this.currentView === 'team') {
            const members = await teamService.getAllTeamMembers(true);
            await view.setTeamMembers(members);
        }
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
     * ⭐ v3.1: Geeft fase configuratie door aan Header
     */
    initHeader() {
        console.log('📊 Initializing header...');

        this.header = new Header();

        // ⭐ v3.1: Stel dynamische fase config in vanuit faseService
        this.header.setFaseConfig(faseService.fases || []);

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
        this.header.onTeamFilter = (team) => this.handleTeamFilter(team);
        this.header.onStatusFilter = (status) => this.handleStatusFilter(status);
        this.header.onCreateTender = () => this.handleCreateTender();
        this.header.onSmartImport = () => {
            if (this.smartImportWizard) this.smartImportWizard.open();
        };
        this.header.onMenuAction = (action) => this.handleMenuAction(action);
        this.header.onContextAction = (action, data) => this.handleContextAction(action, data);

        // Zoekfunctie callbacks
        this.header.onSearch = (query) => this.handleTenderSearch(query);
        this.header.onSearchClear = () => this.handleSearchClear();
    }

    /**
     * Initialize sidebar en topbar layout
     * Wordt aangeroepen NA header.initBureauSwitcher() zodat #bureau-switcher-container
     * al bestaat en verplaatst kan worden naar de topbar.
     */
    initSidebarTopbar() {
        console.log('🗂️ Initializing sidebar + topbar...');

        // Zorg dat currentUser beschikbaar is voor Sidebar._isAdmin() en _userData()
        if (!window.app.currentUser && this.userProfile) {
            window.app.currentUser = this.userProfile;
        }

        // ── Sidebar ────────────────────────────────────────────
        const sidebarContainer = document.getElementById('app-sidebar');
        if (sidebarContainer && window.Sidebar) {
            this.sidebar = new window.Sidebar();
            sidebarContainer.appendChild(this.sidebar.render());

            // Zet actief item op basis van huidige view
            this.sidebar.setActive(this.currentView || 'tenders');
        }

        // ── Topbar ─────────────────────────────────────────────
        const topbarContainer = document.getElementById('app-topbar');
        if (topbarContainer && window.Topbar) {
            this.topbar = new window.Topbar();
            topbarContainer.appendChild(this.topbar.render());

            // Verplaats BureauSwitcher van verborgen header naar topbar
            const bureauSwitcher = document.getElementById('bureau-switcher-container');
            const bureauSlot = document.getElementById('tz-topbar-bureau-slot');
            if (bureauSwitcher && bureauSlot) {
                bureauSlot.appendChild(bureauSwitcher);
            }

            // Initiële context: standaard tenders view
            this.topbar.setContext('tenders');
        }

        // ── FaseBar initialiseren in #app-phase-tabs ──────────
        const phaseTabsContainer = document.getElementById('app-phase-tabs');
        if (phaseTabsContainer && window.FaseBar) {
            this.faseBar = new window.FaseBar();
            phaseTabsContainer.appendChild(this.faseBar.render());
        }

        // ── Sidebar layout sync (margin-left meebeweegt) ───────
        const appMain = document.getElementById('app-main');

        const syncSidebarLayout = (isOpen) => {
            if (!appMain) return;
            appMain.classList.toggle('sidebar-expanded', isOpen);
        };

        // Direct toepassen op basis van initiële sidebar staat
        if (this.sidebar) {
            syncSidebarLayout(this.sidebar._isOpen);
            this.sidebar.onToggle = (isOpen) => syncSidebarLayout(isOpen);
        }

        // ── Helper: toon/verberg fase tabs ────────────────────
        const setPhaseTabsVisible = (visible) => {
            if (phaseTabsContainer) {
                phaseTabsContainer.style.display = visible ? '' : 'none';
            }
        };

        // Initieel: fase tabs zichtbaar (default view = tenders)
        setPhaseTabsVisible(true);

        // ── Event listeners ────────────────────────────────────

        // Sidebar navigatie → correcte view laden via bestaande handleMenuAction logica
        document.addEventListener('sidebar:navigate', (e) => {
            const view = e.detail?.view;
            if (!view) return;

            const isTendersCtx = (view === 'tenders');
            setPhaseTabsVisible(isTendersCtx);
            if (this.topbar) this.topbar.showViewSwitcher(isTendersCtx);

            // Map sidebar item → bestaande app navigatie
            switch (view) {
                case 'tenders':
                    this.showView('totaal');
                    break;
                case 'bedrijven':
                    this.showView('bedrijven');
                    break;
                case 'team':
                    this.showView('team');
                    break;
                case 'templatebeheer':
                    this.showView('templatebeheer');
                    break;
                case 'tenderbureaus':
                    if (this.isSuperAdmin) {
                        this.showView('tenderbureaus');
                    }
                    break;
                case 'profiel':
                    // Verberg view switcher en fase tabs (niet relevant voor profiel)
                    if (this.topbar) this.topbar.showViewSwitcher(false);
                    const phaseTabs = document.getElementById('app-phase-tabs');
                    if (phaseTabs) phaseTabs.style.display = 'none';
                    this.showView('profiel');
                    break;
                case 'ai-usage':
                    if (this.isSuperAdmin) {
                        this.showView('ai-usage');
                    }
                    break;
                case 'tendermatch':
                    // Geïntegreerd in Tendersignalering
                    this.showView('tendersignalering');
                    break;
                case 'matchpool':
                    if (this.isSuperAdmin) {
                        this.showView('matchpool');
                    }
                    break;
                case 'verrijking':
                    if (this.isSuperAdmin) {
                        this.showView('verrijking');
                    }
                    break;
                case 'tendersignalering':
                    if (this.isSuperAdmin) {
                        this.showView('tendersignalering');
                    }
                    break;
                case 'offerte-overzicht':
                    this.showView('offerte-overzicht');
                    break;
                case 'rapportages':
                case 'exporteren':
                case 'instellingen':
                case 'iconenbeheer':
                    alert(`${view} — komt binnenkort!`);
                    break;
                default:
                    this.showView(view);
            }
        });

        // Topbar view pills → handleViewTypeChange
        document.addEventListener('topbar:viewChange', (e) => {
            const view = e.detail?.view;
            if (view) this.handleViewTypeChange(view);
        });

        // FaseBar zoeken
        document.addEventListener('fasebar:search', (e) => {
            const query = e.detail?.query || '';
            if (query) this.handleTenderSearch(query);
            else this.handleSearchClear();
        });

        // FaseBar fase filter — slaat filter op en past de actieve view aan
        document.addEventListener('fasebar:filterChange', (e) => {
            const fases = e.detail?.fases; // null = alles, string[] = selectie
            this.currentFaseFilter = fases; // centraal opslaan voor view-type wissels

            if (this.currentViewType === 'kanban') {
                if (this.kanbanView) this.kanbanView.setFaseFilter(fases);
                return;
            }

            if (this.currentViewType === 'planning') {
                if (this.agendaView) this.agendaView.setFaseFilter(fases);
                return;
            }

            if (this.currentViewType === 'kalender') {
                if (this.kalenderView) this.kalenderView.setFaseFilter(fases);
                return;
            }

            if (this.currentViewType === 'gantt') {
                if (this.ganttView) this.ganttView.setFaseFilter(fases);
                return;
            }

            // Lijst-modus: filter op totaalView
            const totaalView = this.views['totaal'];
            if (!totaalView) return;
            if (this.currentView !== 'totaal') {
                this.showView('totaal'); // mount is sync, filter wordt direct erna gezet
            }
            totaalView.setFaseFilter(fases);
        });

        // Topbar Smart Import
        document.addEventListener('topbar:smartImport', () => {
            if (this.smartImportWizard) this.smartImportWizard.open();
        });

        // Topbar + Bedrijf
        document.addEventListener('topbar:addBedrijf', () => {
            if (this.bedrijfModal) this.bedrijfModal.open();
        });

        // Topbar + Teamlid
        document.addEventListener('topbar:addTeamlid', () => {
            if (this.teamlidModal) this.teamlidModal.open();
        });

        console.log('✅ Sidebar + topbar geïnitialiseerd');
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
            // ... bestaande code ...
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

        // Callback for deleting tenders
        this.tenderAanmaken.onDelete = async (tenderId) => {
            try {
                await apiService.deleteTender(tenderId);
                console.log('✅ Tender deleted');
                await this.loadData();
            } catch (error) {
                console.error('❌ Delete tender error:', error);
                alert('Er ging iets fout bij het verwijderen van de tender.');
            }
        };
    }

    /**
     * Initialize bedrijf modal
     */
    initBedrijfModal() {
        console.log('🏢 Initializing bedrijf modal...');

        this.bedrijfModal = new BedrijfModal();

        this.bedrijfModal.onSave = async (bedrijf) => {
            console.log('✅ Bedrijf saved:', bedrijf);

            if (this.currentView === 'bedrijven') {
                await this.views.bedrijven.reload();
            }

            await bedrijvenService.refresh();
        };
    }

    /**
     * Initialize teamlid modal
     */
    initTeamlidModal() {
        console.log('👤 Initializing teamlid modal...');

        this.teamlidModal = new TeamlidModal();

        this.teamlidModal.onSave = async (teamlid) => {
            console.log('✅ Teamlid saved:', teamlid);

            if (this.currentView === 'team') {
                await this.views.team.reload();
            }
        };
    }

    /**
     * Initialize planning modal
     */
    initPlanningModal() {
        console.log('📋 Initializing planning modal...');


        this.planningModal = new PlanningModal();
        window.planningModal = this.planningModal;

        this.planningModal.onUpdate = async (tenderId) => {
            console.log('✅ Planning/checklist updated for tender:', tenderId);
            await this.loadData();
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
            archief: new ArchiefView(),
            zoekresultaten: new ZoekresultatenView(),
            bedrijven: new BedrijvenView(),
            tenderbureaus: new TenderbureausView(),
            team: new TeamledenView(),
            templatebeheer: new TemplateBeheerView(),
            profiel: new ProfielView()
        };

        if (this.isSuperAdmin) {
            this.views['ai-usage'] = new AIUsageView();
        }

        if (window.TendermatchView) {
            this.views['tendermatch'] = new window.TendermatchView();
        }

        // Initialize AgendaView
        this.agendaView = new AgendaView();
        this.agendaView.onOpenPlanningModal = (tenderId, openType) => {
            this.handleOpenPlanningModal(tenderId, openType || 'planning');
        };

        // Initialize KalenderView
        if (window.KalenderView) {
            this.kalenderView = new window.KalenderView();
        }

        // Initialize GanttView
        if (window.GanttView) {
            this.ganttView = new window.GanttView();
        }

        // ⭐ v3.1: Initialize KanbanView met dynamische fase config
        this.kanbanView = new KanbanView({
            faseConfig: faseService.fases || [],
            allFaseStatussen: faseService.statussen || {}
        });
        this.kanbanView.onTenderClick = (tenderId) => {
            this.handleTenderClick(tenderId);
        };
        this.kanbanView.onFaseChange = async (tenderId, newFase) => {
            console.log(`⊞ Kanban fase change: ${tenderId} → ${newFase}`);
            try {
                const eersteStatus = await faseService.getDefaultStatus(newFase);
                console.log(`🔄 Fase status wordt: ${eersteStatus}`);

                await apiService.updateTender(tenderId, { fase: newFase, fase_status: eersteStatus });

                const tender = this.tenders.find(t => t.id === tenderId);
                if (tender) {
                    tender.fase = newFase;
                    tender.fase_status = eersteStatus;
                }

                this.updateHeaderCounts();
                console.log(`✅ Fase succesvol gewijzigd naar ${newFase} (status: ${eersteStatus})`);
            } catch (error) {
                console.error('❌ Fase wijziging mislukt:', error);
                alert('Fase wijzigen mislukt. Probeer opnieuw.');
                await this.loadData();
                if (this.kanbanView) {
                    this.kanbanView.setTenders(this.tenders);
                }
            }
        };
        this.kanbanView.onCreateTender = (fase) => {
            console.log(`⊞ Kanban create tender in fase: ${fase}`);
            this.handleCreateTender();
        };

        // Set callbacks for tender views
        const self = this;
        const tenderViewKeys = ['totaal', 'acquisitie', 'inschrijvingen', 'ingediend', 'archief', 'zoekresultaten'];

        Object.entries(this.views).forEach(([key, view]) => {
            if (tenderViewKeys.includes(key)) {
                view.onStatusChange = (tenderId, status, fase) => this.handleStatusChange(tenderId, status, fase);
                view.onTenderClick = (tenderId) => this.handleTenderClick(tenderId);
                view.onAddTeamMember = (tenderId) => this.handleAddTeamMember(tenderId);
                view.onOpenPlanningModal = (tenderId, openType) => this.handleOpenPlanningModal(tenderId, openType);

                view.onSearchResultsCount = (count) => {
                    if (self.currentView === key && self.header && self.header.setSearchResultsCount) {
                        self.header.setSearchResultsCount(count);
                    }
                };
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

        this.views.bedrijven.onOpenProfiel = (bedrijfId) => {
            this.showView(`bedrijfsprofiel:${bedrijfId}`);
            if (this.sidebar) this.sidebar.setActive('bedrijven');
        };

        this.views.bedrijven.onOpenSignalering = (_bedrijfId) => {
            // Bureau-breed dashboard — bedrijfId niet nodig als route-param
            this.showView('tendersignalering');
            if (this.sidebar) this.sidebar.setActive('tendersignalering');
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

        // Set callbacks for tenderbureaus view
        this.views.tenderbureaus.onCreateBureau = () => {
            alert('Nieuw tenderbureau aanmaken - komt binnenkort!');
        };

        this.views.tenderbureaus.onEditBureau = (bureau) => {
            console.log('Edit bureau:', bureau);
            alert(`Bureau bewerken: ${bureau.bureau_naam} - komt binnenkort!`);
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
            alert(`Users van ${bureau.bureau_naam} bekijken - komt binnenkort!`);
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
        // ── AI Button → Tender Command Center / Smart Import ──
        // Vangt clicks op data-action="open-ai" (TenderCardBody) 
        // en data-action="open-ai-docs" (TenderCardHeader)
        document.addEventListener('click', (e) => {
            const aiBtn = e.target.closest('[data-action="open-ai"], [data-action="open-ai-docs"]');
            if (!aiBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const tenderId = aiBtn.dataset.tenderId;
            const smartImportId = aiBtn.dataset.smartImportId;
            const hasAnalysis = aiBtn.dataset.hasAnalysis === 'true';

            if (!tenderId) return;

            const tender = this.tenders.find(t => t.id === tenderId);
            const tenderNaam = tender?.naam || 'Onbekende tender';

            console.log(`🤖 AI button clicked: tender="${tenderNaam}", hasAnalysis=${hasAnalysis}`);

            if (hasAnalysis) {
                // Bestaande analyse → open Tender Command Center
                window.openCommandCenter(tenderId);
            } else if (this.smartImportWizard) {
                // Geen analyse → open Smart Import wizard
                this.smartImportWizard.openAsModal(tenderId, tenderNaam);
            }
        });
    }

    /**
     * Load all data from API
     */
    async loadData() {
        console.log('📥 Loading data...');

        try {
            let bureauId = this.currentBureau?.bureau_id || null;
            if (this.isSuperAdmin && this.currentBureau === null) {
                bureauId = null;
            }

            const tenders = await apiService.getTenders(bureauId);
            this.tenders = Array.isArray(tenders) ? tenders : [];

            console.log(`✅ Loaded ${this.tenders.length} tenders`);

            this.updateViews();
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
            if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend', 'archief'].includes(key)) {
                view.setTenders(this.tenders);
            }
        });

        if (this.currentViewType === 'kanban' && this.kanbanView) {
            this.kanbanView.setTenders(this.tenders);
        }
    }

    /**
     * ⭐ v3.1: DYNAMISCHE header badge counts
     * Berekent counts op basis van faseService.fases i.p.v. hardcoded lijst.
     * 
     * Logica:
     * - "totaal" = alle tenders BEHALVE archief
     * - Per fase = simpele filter op tender.fase
     */
    updateHeaderCounts() {
        const allFases = faseService.fases || [];
        const counts = {};

        // Per fase dynamisch tellen
        allFases.forEach(faseConfig => {
            const faseKey = faseConfig.fase;
            counts[faseKey] = this.tenders.filter(t => t.fase === faseKey).length;
        });

        // "totaal" = alles behalve archief
        // (archief is conceptueel het eindstation, niet "actief")
        counts.totaal = this.tenders.filter(t => t.fase !== 'archief').length;

        this.header.updateCounts(counts);
        if (this.faseBar) this.faseBar.updateCounts(counts);

        const teamMembers = this.getUniqueTeamMembers();
        this.header.updateTeamOptions(teamMembers);

        console.log('📊 Dynamic counts:', counts);
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

        if (this.tenderAanmaken && this.tenderAanmaken.isOpen) {
            this.tenderAanmaken.close();
        }

        if (this.bedrijfModal && this.bedrijfModal.isOpen) {
            this.bedrijfModal.close();
        }

        if (this.teamlidModal && this.teamlidModal.isOpen) {
            this.teamlidModal.close();
        }

        if (this.planningModal && this.planningModal.isOpen) {
            this.planningModal.close();
        }

        if (this.tenderbureauModal && this.tenderbureauModal.isOpen) {
            this.tenderbureauModal.close();
        }

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

        document.body.style.overflow = '';
    }

    /**
     * Show a specific view
     */
    async showView(viewName) {
        // Tendermatch is geïntegreerd in Tendersignalering
        if (viewName === 'tendermatch') {
            this.showView('tendersignalering');
            return;
        }
        this.closeAllModals();
        console.log(`👁️ Showing view: ${viewName}`);

        // Unmount agenda als die actief was
        if (this.currentViewType === 'planning' && this.agendaView) {
            this.agendaView.unmount();
            this.currentViewType = 'lijst';
            this.header.setActiveView('lijst');
        }

        // Unmount kanban als die actief was
        if (this.currentViewType === 'kanban' && this.kanbanView) {
            this.kanbanView.unmount();
            this.currentViewType = 'lijst';
            this.header.setActiveView('lijst');
        }

        // Unmount kalender als die actief was
        if (this.currentViewType === 'kalender' && this.kalenderView) {
            this.kalenderView.unmount();
            this.currentViewType = 'lijst';
            if (this.topbar) this.topbar.setActiveView('lijst');
        }

        // Unmount gantt als die actief was
        if (this.currentViewType === 'gantt' && this.ganttView) {
            this.ganttView.unmount();
            this.currentViewType = 'lijst';
            if (this.topbar) this.topbar.setActiveView('lijst');
        }

        if (this.views[this.currentView]) {
            this.views[this.currentView].unmount();
        }

        // Unmount matchpool view als die actief was
        if (this._matchpoolView && this.currentView === 'matchpool') {
            this._matchpoolView.unmount();
        }

        // Unmount verrijking view als die actief was
        if (this._verrijkingView && this.currentView === 'verrijking') {
            this._verrijkingView.unmount();
        }

        // Unmount offerte calculator view als die actief was
        if (this._offerteCalculatorView && typeof this.currentView === 'string' && this.currentView.startsWith('offerte-calculator')) {
            this._offerteCalculatorView = null;
        }

        // Unmount bedrijfsprofiel view als die actief was
        if (this._bedrijfsProfielView && this.currentView === 'bedrijfsprofiel') {
            this._bedrijfsProfielView.unmount();
        }

        // Unmount tendersignalering view als die actief was
        if (this._tendersignaleringView && this.currentView === 'tendersignalering') {
            this._tendersignaleringView.unmount();
        }

        this.currentView = viewName;

        // Sync sidebar actief item + fase tabs + topbar view switcher
        // Fase-views (totaal/acquisitie/etc.) mappen op sidebar item 'tenders'
        const sidebarItemId = ['totaal', 'zoekresultaten', 'acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'].includes(viewName)
            ? 'tenders'
            : viewName;
        if (this.sidebar) this.sidebar.setActive(sidebarItemId);
        const isTendersView = ['totaal', 'zoekresultaten', 'acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'].includes(viewName);
        const phaseTabsEl = document.getElementById('app-phase-tabs');
        if (phaseTabsEl) phaseTabsEl.style.display = isTendersView ? '' : 'none';
        if (this.topbar) this.topbar.showViewSwitcher(isTendersView);

        // Context-gevoelige actieknop bijwerken
        if (this.topbar) {
            const topbarContext = isTendersView ? 'tenders'
                : ['bedrijven', 'team'].includes(viewName) ? viewName
                : null;
            this.topbar.setContext(topbarContext);
        }

        const view = this.views[viewName];
        if (view) {
            view.mount(this.contentContainer);

            if (viewName === 'zoekresultaten') {
                this.header.setContext('tenders');
                this.header.setActiveTab(null);
            }
            else if (['totaal', 'acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'].includes(viewName)) {
                this.header.setContext('tenders');
                this.header.setActiveTab(viewName);

                if (this.header.hasActiveSearchChip && this.header.hasActiveSearchChip()) {
                    this.header.clearSearch();
                }
            }
            else if (viewName === 'bedrijven') {
                this.header.setContext('bedrijven', { count: 0 });
                // Altijd bureau-gefilterde view — super-admin heeft eigen Matchpool pagina
                const bureauId = this.currentBureau?.bureau_id || null;
                await bedrijvenService.loadBedrijven(
                    bureauId ? { tenderbureauId: bureauId } : { loadAll: true }
                );
                const bedrijven = bedrijvenService.getAllBedrijven();
                await view.setBedrijven(bedrijven);
            }
            else if (viewName === 'tenderbureaus') {
                this.header.setContext('tenderbureaus', { count: 0 });
                const bureaus = await tenderbureausService.getAllBureaus();
                await view.setBureaus(bureaus);
            }
            else if (viewName === 'team') {
                this.header.setContext('team', { count: 0 });
                const members = await teamService.getAllTeamMembers(true);
                await view.setTeamMembers(members);
            }
            else if (viewName === 'templatebeheer') {
                this.header.setContext('tenders');
                this.header.setActiveTab(null);
            }
            else if (viewName === 'ai-usage') {
                this.header.setContext('profiel', { title: 'AI token verbruik' });
                this.header.setActiveTab(null);
            }
            else if (viewName === 'profiel') {
                this.header.setContext('profiel', { title: 'Mijn Profiel' });
                this.header.setActiveTab(null);
            }

        } else if (viewName === 'matchpool') {
            // MatchpoolView is een non-module global — niet in this.views
            this.header.setContext('profiel', { title: 'Matchpool' });
            if (!this._matchpoolView) {
                this._matchpoolView = new window.MatchpoolView();
            }
            this.contentContainer.innerHTML = '';
            this._matchpoolView.mount(this.contentContainer);
        } else if (viewName === 'verrijking') {
            // VerrijkingView is een non-module global — niet in this.views
            this.header.setContext('profiel', { title: 'Website verrijking' });
            if (!this._verrijkingView) {
                this._verrijkingView = new window.VerrijkingView();
            }
            this.contentContainer.innerHTML = '';
            this._verrijkingView.mount(this.contentContainer);
        } else if (viewName === 'tendersignalering') {
            // TendersignaleringView is een non-module global — bureau-breed dashboard
            this.header.setContext('profiel', { title: 'Tendersignalering' });
            if (!this._tendersignaleringView) {
                this._tendersignaleringView = new window.TendersignaleringView();
            }
            this.contentContainer.innerHTML = '';
            // bureauId wordt door de view zelf opgehaald via window.app.currentBureau
            this._tendersignaleringView.mount(this.contentContainer);
        } else if (viewName === 'offerte-overzicht') {
            this.header.setContext('profiel', { title: 'Offertes' });
            if (this.sidebar) this.sidebar.setActive('offerte-overzicht');
            this._toonOfferteOverzicht();
        } else if (typeof viewName === 'string' && viewName.startsWith('offerte-calculator:')) {
            this.header.setContext('profiel', { title: 'Offerte Calculator' });
            const tenderId = viewName.split(':')[1] || null;
            if (!this._offerteCalculatorView) {
                this._offerteCalculatorView = new window.OfferteCalculatorView();
            }
            this.contentContainer.innerHTML = '';
            this._offerteCalculatorView.mount(this.contentContainer, { tenderId });
        } else if (viewName === 'bedrijfsprofiel' || (typeof viewName === 'string' && viewName.startsWith('bedrijfsprofiel:'))) {
            // BedrijfsProfielView is een non-module global — niet in this.views
            this.header.setContext('profiel', { title: 'Bedrijfsprofiel' });
            const bedrijfId = viewName.includes(':') ? viewName.split(':')[1] : null;
            if (!this._bedrijfsProfielView) {
                this._bedrijfsProfielView = new window.BedrijfsProfielView();
            }
            this.contentContainer.innerHTML = '';
            this._bedrijfsProfielView.mount(this.contentContainer, { bedrijfId });
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

        const previousViewType = this.currentViewType;
        this.currentViewType = viewType;

        // Sync topbar pill
        if (this.topbar) this.topbar.setActiveView(viewType);

        // Helper: unmount de vorige view
        const unmountPrevious = () => {
            if (previousViewType === 'planning' && this.agendaView) this.agendaView.unmount();
            if (previousViewType === 'kanban' && this.kanbanView) this.kanbanView.unmount();
            if (previousViewType === 'kalender' && this.kalenderView) this.kalenderView.unmount();
            if (previousViewType === 'gantt' && this.ganttView) this.ganttView.unmount();
            if (previousViewType === 'lijst' && this.views[this.currentView]) this.views[this.currentView].unmount();
        };

        if (viewType === 'planning') {
            unmountPrevious();
            this.agendaView.mount(this.contentContainer);
            if (this.currentFaseFilter) this.agendaView.setFaseFilter(this.currentFaseFilter);
            console.log('📅 AgendaView gemount');

        } else if (viewType === 'kalender') {
            unmountPrevious();
            if (this.kalenderView) {
                window.planningService?.invalidateCache?.();
                this.kalenderView.mount(this.contentContainer);
                if (this.currentFaseFilter) this.kalenderView.setFaseFilter(this.currentFaseFilter);
            }
            console.log('📆 KalenderView gemount');

        } else if (viewType === 'gantt') {
            unmountPrevious();
            if (this.ganttView) {
                window.planningService?.invalidateCache?.();
                this.ganttView.mount(this.contentContainer);
                if (this.currentFaseFilter) this.ganttView.setFaseFilter(this.currentFaseFilter);
            }
            console.log('📊 GanttView gemount');

        } else if (viewType === 'kanban') {
            unmountPrevious();
            this.kanbanView.mount(this.contentContainer);
            this.kanbanView.setTenders(this.tenders);
            if (this.currentFaseFilter) this.kanbanView.setFaseFilter(this.currentFaseFilter);
            console.log('⊞ KanbanView gemount');

        } else if (viewType === 'lijst') {
            if (previousViewType === 'planning' && this.agendaView) this.agendaView.unmount();
            if (previousViewType === 'kanban' && this.kanbanView) this.kanbanView.unmount();
            if (previousViewType === 'kalender' && this.kalenderView) this.kalenderView.unmount();
            if (previousViewType === 'gantt' && this.ganttView) this.ganttView.unmount();

            const currentTenderView = this.views[this.currentView];
            if (currentTenderView) {
                currentTenderView.mount(this.contentContainer);
                currentTenderView.setTenders(this.tenders);
                // setTenders hergebruikt bestaande faseFilter; voor zekerheid ook expliciet zetten
                if (this.currentFaseFilter && typeof currentTenderView.setFaseFilter === 'function') {
                    currentTenderView.setFaseFilter(this.currentFaseFilter);
                }
            }
            console.log(`📋 Lijst view hersteld: ${this.currentView}`);
        }
    }

    /**
     * Handle tender search
     */
    handleTenderSearch(query) {
        console.log(`🔍 Zoeken: "${query}"`);

        this.searchQuery = query;

        if (query && query.trim()) {
            if (this.currentView !== 'zoekresultaten') {
                this.previousView = this.currentView;
            }
            this.showSearchResults(query);
        } else {
            if (this.currentView === 'zoekresultaten') {
                this.handleSearchClear();
            }
        }
    }

    /**
     * Show search results view
     */
    showSearchResults(query) {
        console.log(`🔍 Navigeren naar zoekresultaten voor: "${query}"`);

        const zoekView = this.views.zoekresultaten;

        zoekView.setTenders(this.tenders);
        zoekView.setSearchQuery(query);
        zoekView.setPreviousView(this.previousView);

        this.showView('zoekresultaten');

        const count = zoekView.getSearchResultsCount();
        if (this.header && this.header.setSearchResultsCount) {
            this.header.setSearchResultsCount(count || 0);
        }

        console.log(`🔍 Zoekresultaten: ${count} tenders gevonden`);
    }

    /**
     * Handle search clear
     */
    handleSearchClear() {
        console.log(`🔍 Zoekfilter verwijderd, terug naar: ${this.previousView}`);

        this.searchQuery = '';

        if (this.views.zoekresultaten) {
            this.views.zoekresultaten.clearSearchQuery();
        }

        const targetView = this.previousView || 'totaal';
        this.showView(targetView);

        if (this.header && this.header.setSearchResultsCount) {
            this.header.setSearchResultsCount(null);
        }
    }

    handleTeamFilter(team) {
        console.log(`👥 Team filter: ${team}`);
        const view = this.views[this.currentView];
        if (view && view.setTeamFilter) view.setTeamFilter(team);
    }

    handleStatusFilter(status) {
        console.log(`🎯 Status filter: ${status}`);
        const view = this.views[this.currentView];
        if (view && view.setStatusFilter) view.setStatusFilter(status);
    }

    handleCreateTender() {
        console.log('➕ Create tender');
        this.tenderAanmaken.open();
    }

    handleTenderClick(tenderId) {
        console.log(`📋 Tender clicked: ${tenderId}`);
        const tender = this.tenders.find(t => t.id === tenderId);
        if (tender) {
            this.tenderAanmaken.open(tender);
        } else {
            console.error('Tender not found:', tenderId);
        }
    }

    handleAddTeamMember(tenderId) {
        console.log(`👥 Add team member for tender: ${tenderId}`);
        const tender = this.tenders.find(t => t.id === tenderId);
        if (tender) {
            this.tenderAanmaken.open(tender, { scrollToSection: 'team' });
        } else {
            console.error('Tender not found:', tenderId);
        }
    }

    async handleOpenPlanningModal(tenderId, openType) {
        let tender;
        if (typeof tenderId === 'object' && tenderId !== null) {
            const tenderObj = tenderId;
            console.log(`📋 Open ${openType} modal for tender: ${tenderObj.naam || tenderObj.id}`);
            tender = this.tenders.find(t => t.id === tenderObj.id) || tenderObj;
        } else {
            console.log(`📋 Open ${openType} modal for tender: ${tenderId}`);
            tender = this.tenders.find(t => t.id === tenderId);
        }

        if (!tender) {
            console.error('Tender not found:', tenderId);
            return;
        }

        if (!this.planningModal) {
            console.error('❌ PlanningModal niet geïnitialiseerd!');
            return;
        }

        try {
            await this.planningModal.open(tender, openType);
        } catch (error) {
            console.error('❌ PlanningModal open error:', error);
        }
    }

    async handleStatusChange(tenderId, newStatus, newFase = null) {
        console.log(`🔄 Status change: ${tenderId} → ${newStatus}`, newFase ? `(fase: ${newFase})` : '');

        try {
            const updateData = { fase_status: newStatus };
            if (newFase) updateData.fase = newFase;

            await apiService.updateTender(tenderId, updateData);

            const tender = this.tenders.find(t => t.id === tenderId);
            if (tender) {
                tender.fase_status = newStatus;
                if (newFase) tender.fase = newFase;
            }

            this.updateViews();
            this.updateHeaderCounts();
            console.log('✅ Status updated');
        } catch (error) {
            console.error('❌ Status update error:', error);
            alert('Status wijzigen mislukt.');
            await this.loadData();
        }
    }

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
                this.showView('profiel');
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
                this.showView('templatebeheer');
                break;
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
     * Navigeer naar een view — kan worden aangeroepen vanuit sub-views via window.app.navigeerNaar()
     * @param {string} view  Viewnaam, bijv. 'bedrijven', 'bedrijfsprofiel:uuid', 'tendersignalering:uuid'
     */
    navigeerNaar(view) {
        this.showView(view);
    }

    async logout() {
        const confirmed = await confirmLogout();

        if (confirmed) {
            try {
                bureauAccessService.reset();
                const supabase = getSupabase();
                await supabase.auth.signOut();
                window.location.href = '/login.html';
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    }

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

    hideLoading() {
        const loading = document.querySelector('.loading-screen');
        if (loading) loading.style.display = 'none';
        document.getElementById('app')?.classList.add('loaded');
    }

    /**
     * Toon overzicht van alle offerte-calculaties voor het actieve bureau.
     * Rendert inline — geen aparte view class nodig.
     */
    async _toonOfferteOverzicht() {
        const container = this.contentContainer;
        if (!container) return;

        // Helper: icon ophalen
        const icon = (name, size = 16) =>
            (window.Icons && typeof window.Icons[name] === 'function')
                ? window.Icons[name]({ size })
                : '';

        // Helper: euro formatteren
        const euro = val => val
            ? new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val)
            : '—';

        // Helper: datum formatteren (lang formaat voor aparte kolom)
        const datum = iso => {
            if (!iso) return '—';
            try {
                const [y, m, d] = String(iso).split('-').map(Number);
                return new Date(y, m - 1, d).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
            } catch { return iso; }
        };

        // Helper: datum als DD-MM-YYYY voor meta-rijen
        const formatDatum = str => {
            if (!str) return '';
            const parts = String(str).split('T')[0].split('-');
            if (parts.length !== 3) return str;
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
        };

        // Helper: dagen tot deadline + gekleurde badge
        const dagenBadge = datumStr => {
            if (!datumStr) return '';
            const [y, m, d] = datumStr.split('T')[0].split('-').map(Number);
            const deadline = new Date(y, m - 1, d);
            const vandaag = new Date();
            vandaag.setHours(0, 0, 0, 0);
            const diff = Math.ceil((deadline - vandaag) / (1000 * 60 * 60 * 24));
            if (diff > 14)       return `<span class="oov-dagen-badge oov-dagen-groen">nog ${diff} dagen</span>`;
            if (diff >= 1)       return `<span class="oov-dagen-badge oov-dagen-oranje">nog ${diff} dagen</span>`;
            if (diff === 0)      return `<span class="oov-dagen-badge oov-dagen-rood">vandaag</span>`;
            return `<span class="oov-dagen-badge oov-dagen-grijs">verlopen</span>`;
        };

        function offerteStatusBadge(status) {
            const kleuren = {
                concept:      { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa', label: 'Concept' },
                verzonden:    { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'Verzonden' },
                geaccepteerd: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7', label: 'Geaccepteerd' },
                afgewezen:    { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5', label: 'Afgewezen' },
            };
            const k = kleuren[status] || kleuren.concept;
            return `<span style="background:${k.bg};color:${k.text};border:0.5px solid ${k.border};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:500">${k.label}</span>`;
        }

        const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Laadscherm
        container.innerHTML = `
            <div class="oov-root">
                <div class="oov-header">
                    <div class="oov-header-info">
                        <h1 class="oov-titel">${icon('fileText', 18)} Offerte Calculator</h1>
                        <p class="oov-sub">Offerteberekeningen voor het actieve bureau</p>
                    </div>
                    <button class="oov-btn oov-btn--primary" id="oov-nieuw-btn">
                        ${icon('plus', 14)} Nieuwe offerte
                    </button>
                </div>
                <div class="oov-body" id="oov-body">
                    <div class="oov-laden">Laden…</div>
                </div>
            </div>`;

        // Stijlen (inline, één keer)
        if (!document.getElementById('oov-styles')) {
            const style = document.createElement('style');
            style.id = 'oov-styles';
            style.textContent = `
                .oov-root { display:flex;flex-direction:column;height:100%;background:#f5f3ff;font-family:'Inter','Segoe UI',sans-serif; }
                .oov-header { display:flex;align-items:center;gap:16px;padding:18px 28px 14px;background:#fff;border-bottom:1px solid #e5e7eb;flex-shrink:0; }
                .oov-header-info { flex:1; }
                .oov-titel { font-size:18px;font-weight:700;color:#1e1b4b;margin:0;display:flex;align-items:center;gap:8px; }
                .oov-sub { font-size:12px;color:#6b7280;margin:2px 0 0; }
                .oov-btn { display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:background 0.15s; }
                .oov-btn--primary { background:#7c3aed;color:#fff;border-color:#7c3aed; }
                .oov-btn--primary:hover { background:#6d28d9; }
                .oov-btn--ghost { background:none;color:#7c3aed;border-color:#ddd6fe;font-size:12px;padding:5px 10px; }
                .oov-btn--ghost:hover { background:#f5f3ff; }
                .oov-body { flex:1;overflow-y:auto;padding:20px 28px; }
                .oov-laden { display:flex;align-items:center;justify-content:center;height:120px;font-size:14px;color:#9ca3af; }
                .oov-leeg { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;height:280px;color:#9ca3af;text-align:center; }
                .oov-leeg-icon { opacity:0.3; }
                .oov-leeg-titel { font-size:15px;font-weight:600;color:#374151; }
                .oov-leeg-sub { font-size:13px; }
                .oov-tabel { width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06); }
                .oov-tabel thead tr { background:#f9fafb;border-bottom:1px solid #e5e7eb; }
                .oov-tabel th { text-align:left;padding:10px 14px;font-size:11px;font-weight:600;color:#6b7280;white-space:nowrap; }
                .oov-tabel td { padding:12px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6; }
                .oov-tabel tbody tr:last-child td { border-bottom:none; }
                .oov-tabel tbody tr:hover { background:#fafafa; }
                .oov-tabel-naam { font-size:1.1rem;font-weight:600;color:#1e1b4b;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
                .oov-badge { font-size:11px;font-weight:600;padding:3px 8px;border-radius:12px;background:#f3f4f6;color:#374151;white-space:nowrap; }
                .oov-badge--blauw { background:#dbeafe;color:#1d4ed8; }
                .oov-badge--groen { background:#dcfce7;color:#15803d; }
                .oov-badge--rood { background:#fee2e2;color:#b91c1c; }
                .oov-bedrag { font-weight:600;color:#1e1b4b;white-space:nowrap; }
                .oov-netto { font-weight:700;color:#16a34a;white-space:nowrap; }
                .oov-tender-link { background:none;color:#6366f1;border:0.5px solid #c7d2fe;font-size:11px;padding:3px 8px;border-radius:5px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;transition:background 0.15s; }
                .oov-tender-link:hover { background:#eef2ff;border-color:#818cf8; }
                .oov-col-klikbaar { cursor:pointer; }
                .oov-col-klikbaar:hover { background:#faf5ff !important; }
                .oov-dagen-badge { display:inline-block;font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;margin-left:6px;white-space:nowrap; }
                .oov-dagen-groen { background:#dcfce7;color:#15803d; }
                .oov-dagen-oranje { background:#ffedd5;color:#c2410c; }
                .oov-dagen-rood { background:#fee2e2;color:#b91c1c; }
                .oov-dagen-grijs { background:#f3f4f6;color:#6b7280; }
                .oov-btn-notitie { width:32px;height:32px;border-radius:6px;border:0.5px solid #e0e7ff;background:#f5f3ff;color:#6366f1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.15s; }
                .oov-btn-notitie:hover { background:#e0e7ff; }
                .oov-geen-tender { font-size:13px;color:#d1d5db; }
                .oov-btn-verwijder { width:32px;height:32px;border-radius:6px;border:0.5px solid #fca5a5;background:#fff5f5;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.15s; }
                .oov-btn-verwijder:hover { background:#fee2e2; }
            `;
            document.head.appendChild(style);
        }

        // Event: Nieuwe offerte
        container.querySelector('#oov-nieuw-btn')?.addEventListener('click', () => {
            this._offerteNieuwDialog();
        });

        // Data laden
        try {
            const supabase = window.getSupabase ? window.getSupabase() : null;
            const { data: { session } } = supabase
                ? await supabase.auth.getSession()
                : { data: { session: null } };
            const token = session?.access_token || '';
            const baseUrl = window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';

            const bureauId = this.currentBureau?.bureau_id || '';
            const url = bureauId
                ? `/api/v1/offerte-calculator?bureau_id=${encodeURIComponent(bureauId)}`
                : `/api/v1/offerte-calculator`;

            const resp = await fetch(`${baseUrl}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const { calculaties } = await resp.json();

            const body = container.querySelector('#oov-body');
            if (!body) return;

            if (!calculaties.length) {
                body.innerHTML = `
                    <div class="oov-leeg">
                        <div class="oov-leeg-icon">${icon('fileText', 40)}</div>
                        <div class="oov-leeg-titel">Geen offertes gevonden</div>
                        <div class="oov-leeg-sub">Klik op "+ Nieuwe offerte" om een berekening te starten,<br>of open de Offerte Calculator vanuit een tender (TCC).</div>
                    </div>`;
                return;
            }

            const rijen = calculaties.map(c => {
                const naam       = c.aanbesteding || c.inschrijvende_partij || 'Nieuwe offerte';
                const dienst     = c.aanbestedende_dienst || '';
                const bureauNaam = c.bureau_naam || window.app?.currentBureau?.bureau_naam || '';
                const d          = datum(c.deadline || c.created_at);
                const bedrag     = euro(c.factuur_tenderschrijven || c.bedrag_berekend);
                const netto      = c.factuur_totaal ? euro(c.factuur_totaal) : '—';
                const badge      = offerteStatusBadge(c.status || 'concept');

                return `
                <tr>
                    <td class="oov-col-klikbaar" data-offerte-id="${esc(c.id)}" data-tender-id="${esc(c.tender_id || '')}">
                        <div class="oov-tabel-naam">${esc(naam)}</div>
                        <div class="tcb-info" style="margin-top:4px;">
                            ${dienst ? `
                                <div class="tcb-info-line tcb-info-line--opdrachtgever">
                                    ${icon('building', 14)}
                                    <span>${esc(dienst)}</span>
                                </div>
                            ` : ''}
                            ${c.deadline ? `
                                <div class="tcb-info-line">
                                    ${icon('calendar', 14)}
                                    <span>Deadline: <strong>${formatDatum(c.deadline)}</strong></span>
                                </div>
                            ` : ''}
                            ${bureauNaam ? `
                                <div class="tcb-info-line tcb-info-line--bureau">
                                    ${icon('crown', 14)}
                                    <span>Bureau: <strong>${esc(bureauNaam)}</strong></span>
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td>${badge}</td>
                    <td class="oov-bedrag">${bedrag}</td>
                    <td class="oov-netto">${netto}</td>
                    <td>${d}${c.deadline ? dagenBadge(c.deadline) : ''}</td>
                    <td>${c.tender_id
                        ? `<button class="oov-btn oov-tender-link" data-open-tender="${esc(c.tender_id)}" title="Open tender in TCC">
                               ${icon('externalLink', 11)} Tender Command Center
                           </button>`
                        : `<span class="oov-geen-tender">—</span>`}
                    </td>
                    <td style="display:flex;align-items:center;gap:6px;">
                        <button class="oov-btn-notitie" data-notitie-tender-id="${esc(c.tender_id || '')}" data-notitie-naam="${esc(naam)}" title="Notities openen">
                            ${icon('messageSquare', 14)}
                        </button>
                        <button class="oov-btn-verwijder" data-verwijder-id="${esc(c.id)}" data-verwijder-naam="${esc(naam)}" title="Verwijderen">
                            ${window.Icons?.trash({ size: 14 }) || '🗑'}
                        </button>
                    </td>
                </tr>`;
            }).join('');

            body.innerHTML = `
                <table class="oov-tabel">
                    <thead>
                        <tr>
                            <th>Aanbesteding</th>
                            <th>Status</th>
                            <th>Tenderschrijven</th>
                            <th>Totale factuur</th>
                            <th>Datum / deadline</th>
                            <th>Tender</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${rijen}</tbody>
                </table>`;

            // "Openen" knoppen
            body.querySelectorAll('[data-offerte-id]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const offerteId = btn.dataset.offerteId;
                    const tenderId  = btn.dataset.tenderId;
                    if (!this._offerteCalculatorView) {
                        this._offerteCalculatorView = new window.OfferteCalculatorView();
                    }
                    this.currentView = `offerte-calculator:${tenderId}`;
                    this.header.setContext('profiel', { title: 'Offerte Calculator' });
                    this.contentContainer.innerHTML = '';
                    this._offerteCalculatorView.mount(this.contentContainer, { tenderId: tenderId || null, offerteId });
                });
            });

            // "Tender" knoppen → open TCC overlay
            body.querySelectorAll('[data-open-tender]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tenderId = btn.dataset.openTender;
                    if (tenderId && typeof openCommandCenter === 'function') {
                        openCommandCenter(tenderId);
                    }
                });
            });

            // "Verwijder" knoppen
            body.querySelectorAll('[data-verwijder-id]').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const offerteId = btn.dataset.verwijderId;
                    const naam      = btn.dataset.verwijderNaam || 'deze offerte';
                    if (!confirm(`Offerte "${naam}" definitief verwijderen?`)) return;
                    try {
                        const { data: { session } } = await window.supabaseClient.auth.getSession();
                        const token   = session?.access_token || '';
                        const baseUrl = window.API_CONFIG?.BASE_URL || '';
                        const res = await fetch(`${baseUrl}/api/v1/offerte-calculator/${offerteId}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        if (!res.ok) throw new Error(`HTTP ${res.status}`);
                        this.showView('offerte-overzicht');
                    } catch (err) {
                        alert('Verwijderen mislukt: ' + err.message);
                    }
                });
            });

            // "Notitie" knoppen → koppel notities-paneel aan de bijbehorende tender
            body.querySelectorAll('[data-notitie-tender-id]').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const tenderId = btn.dataset.notitieTenderId;
                    const naam     = btn.dataset.notitieNaam || 'Offerte';
                    if (!tenderId) {
                        showToast('Geen gekoppelde tender voor notities', 'info');
                        return;
                    }
                    if (window.notitiesPanel) {
                        window.notitiesPanel.setTender(tenderId, naam);
                    }
                });
            });

        } catch (e) {
            const body = container.querySelector('#oov-body');
            if (body) body.innerHTML = `<div class="oov-laden" style="color:#dc2626;">Laden mislukt: ${e.message}</div>`;
        }
    }

    /**
     * Dialoogvenster voor nieuwe offerte — kies tender of maak blanco aan.
     */
    _offerteNieuwDialog() {
        const icon = (name, size = 14) =>
            (window.Icons && typeof window.Icons[name] === 'function')
                ? window.Icons[name]({ size })
                : '';

        // Bouw opties: actieve tenders (geen archief)
        const activeTenders = (this.tenders || []).filter(t => t.fase !== 'archief');
        const tenderOpties = activeTenders
            .map(t => `<option value="${t.id}">${
                t.naam || 'Tender'
            }${t.aanbestedende_dienst ? ' — ' + t.aanbestedende_dienst : ''}</option>`)
            .join('');

        const modal = document.createElement('div');
        modal.className = 'oov-modal-overlay';
        modal.id = 'oov-nieuw-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9000;display:flex;align-items:center;justify-content:center;';
        modal.innerHTML = `
            <div style="background:#fff;border-radius:12px;padding:24px;width:460px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                <h3 style="font-size:15px;font-weight:700;color:#1e1b4b;margin:0 0 6px;display:flex;align-items:center;gap:8px;">
                    ${icon('fileText', 16)} Nieuwe offerte aanmaken
                </h3>
                <p style="font-size:13px;color:#6b7280;margin:0 0 18px;">
                    Koppel de offerte aan een bestaande tender.
                </p>
                <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px;">
                    <label style="font-size:12px;font-weight:600;color:#374151;">Koppelen aan tender</label>
                    <select id="oov-nieuw-tender" style="font-size:13px;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-family:inherit;">
                        <option value="">— Selecteer een tender —</option>
                        ${tenderOpties}
                    </select>
                    <span id="oov-nieuw-fout" style="font-size:12px;color:#dc2626;display:none;">
                        ${icon('alertCircle', 12)} Selecteer een tender of maak eerst een nieuwe aan.
                    </span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <button id="oov-nieuw-tender-btn" style="display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid #ddd6fe;border-radius:8px;font-size:13px;cursor:pointer;background:#f5f3ff;color:#7c3aed;font-family:inherit;">
                        ${icon('plus', 13)} Nieuwe tender aanmaken
                    </button>
                    <div style="display:flex;gap:10px;">
                        <button id="oov-nieuw-annuleer" style="padding:7px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;cursor:pointer;background:#fff;color:#374151;font-family:inherit;">
                            Annuleren
                        </button>
                        <button id="oov-nieuw-bevestig" style="display:inline-flex;align-items:center;gap:6px;padding:7px 16px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;background:#7c3aed;color:#fff;font-family:inherit;">
                            ${icon('barChart', 14)} Calculator openen
                        </button>
                    </div>
                </div>
            </div>`;

        document.body.appendChild(modal);

        const sluit = () => modal.remove();
        modal.querySelector('#oov-nieuw-annuleer').addEventListener('click', sluit);
        modal.addEventListener('click', e => { if (e.target === modal) sluit(); });

        // "Calculator openen" — vereist een geselecteerde tender
        modal.querySelector('#oov-nieuw-bevestig').addEventListener('click', () => {
            const tenderId = modal.querySelector('#oov-nieuw-tender').value;
            if (!tenderId) {
                modal.querySelector('#oov-nieuw-fout').style.display = 'flex';
                modal.querySelector('#oov-nieuw-fout').style.gap = '4px';
                modal.querySelector('#oov-nieuw-fout').style.alignItems = 'center';
                return;
            }
            sluit();
            this._offerteCalculatorView = null; // verse instantie per tender
            this.showView(`offerte-calculator:${tenderId}`);
        });

        // "Nieuwe tender aanmaken" — sluit modal, open Smart Import wizard, navigeer daarna naar calculator
        modal.querySelector('#oov-nieuw-tender-btn').addEventListener('click', () => {
            sluit();

            // Sla de huidige onComplete op en vervang tijdelijk
            const origOnComplete = this.smartImportWizard.onComplete;
            this.smartImportWizard.onComplete = (tender) => {
                // Herstel onComplete direct
                this.smartImportWizard.onComplete = origOnComplete;
                this.loadData();
                if (tender?.id) {
                    this._offerteCalculatorView = null;
                    this.showView(`offerte-calculator:${tender.id}`);
                }
            };

            this.smartImportWizard.open();
        });
    }

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