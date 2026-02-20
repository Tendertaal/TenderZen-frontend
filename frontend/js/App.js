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
import { SmartImportWizard } from './components/SmartImportWizard.js';
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
            team: null
        };

        // AgendaView (apart beheerd)
        this.agendaView = null;

        // KanbanView (apart beheerd)
        this.kanbanView = null;

        // State
        this.currentView = 'totaal';
        this.previousView = 'totaal';
        this.currentViewType = 'lijst'; // lijst, planning, kanban
        this.tenders = []; // Master data - all tenders
        this.isSuperAdmin = false;

        // Zoekquery state
        this.searchQuery = '';

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
            const members = await teamService.getAllTeamMembers();
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

        // Initialize AgendaView
        this.agendaView = new AgendaView();
        this.agendaView.onOpenPlanningModal = (tenderId, openType) => {
            this.handleOpenPlanningModal(tenderId, openType || 'planning');
        };

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

        if (this.views[this.currentView]) {
            this.views[this.currentView].unmount();
        }

        this.currentView = viewName;

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
                const members = await teamService.getAllTeamMembers();
                await view.setTeamMembers(members);
            }
            else if (viewName === 'templatebeheer') {
                this.header.setContext('tenders');
                this.header.setActiveTab(null);
            }
            else if (viewName === 'profiel') {
                this.header.setContext('profiel', { title: 'Mijn Profiel' });
                this.header.setActiveTab(null);
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

        const previousViewType = this.currentViewType;
        this.currentViewType = viewType;

        if (viewType === 'planning') {
            if (previousViewType === 'kanban' && this.kanbanView) {
                this.kanbanView.unmount();
            } else if (this.views[this.currentView]) {
                this.views[this.currentView].unmount();
            }

            this.agendaView.mount(this.contentContainer);
            console.log('📅 AgendaView gemount');

        } else if (viewType === 'kanban') {
            if (previousViewType === 'planning' && this.agendaView) {
                this.agendaView.unmount();
            } else if (this.views[this.currentView]) {
                this.views[this.currentView].unmount();
            }

            this.kanbanView.mount(this.contentContainer);
            this.kanbanView.setTenders(this.tenders);
            console.log('⊞ KanbanView gemount');

        } else if (viewType === 'lijst') {
            if (previousViewType === 'planning' && this.agendaView) {
                this.agendaView.unmount();
            }
            if (previousViewType === 'kanban' && this.kanbanView) {
                this.kanbanView.unmount();
            }

            const currentTenderView = this.views[this.currentView];
            if (currentTenderView) {
                currentTenderView.mount(this.contentContainer);
                currentTenderView.setTenders(this.tenders);
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