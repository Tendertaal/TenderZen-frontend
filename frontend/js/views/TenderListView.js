/**
 * TenderListView - Lijst weergave met tender cards
 * TenderZen v2.8 - TenderCard Component Integratie
 * 
 * CHANGELOG v2.8:
 * - REFACTOR: TenderCard als standalone component (import)
 * - VERWIJDERD: Gedupliceerde render methods (renderAIBadge, renderStatusSelect, 
 *   renderTimelineCell, renderTeamAvatars, highlightSearchTerm) → nu in TenderCard.js
 * - BEHOUDEN: Event handlers, date picker, sticky header, smart import logica
 * 
 * CHANGELOG v2.7:
 * - Planning & Checklist shortcut knoppen op tender cards
 * - JS-based sticky header (CSS sticky fix)
 * 
 * CHANGELOG v2.6:
 * - Inline datum editing op timeline cellen
 * - Klik op datum om date picker te openen
 * - Lege cellen tonen "+" om datum toe te voegen
 * - Wis knop om datum te verwijderen
 * 
 * CHANGELOG v2.5:
 * - Smart Import Wizard hergebruik voor bestaande analyses
 * - ensureWizardExists() helper methode
 * 
 * CHANGELOG v2.4:
 * - AI badge nu ALTIJD zichtbaar op elke tender
 * - Conditioneel gedrag bij klik (geen/wel analyse)
 * - renderAIBadge() vervangt renderSmartImportBadge()
 * - handleAIBadgeClick() met conditionele logica
 * 
 * CHANGELOG v2.3:
 * - Smart Import Badge op tender cards
 * - SmartImportPanel voor details en reanalyze
 * 
 * CHANGELOG v2.2:
 * - search-results-info balk verwijderd
 * - onSearchResultsCount callback voor Header integratie
 */

import { BaseView } from './BaseView.js';
import { HeadersRow } from '../components/HeadersRow.js';
import { faseService } from '../services/FaseService.js';
import { AIDocumentenModal } from '../components/AIDocumentenModal.js';
// ⭐ v2.3: Smart Import imports
import { SmartImportPanel } from '../components/SmartImportPanel.js';
import { SmartImportWizard } from '../components/SmartImportWizard.js';
// ⭐ v2.8: TenderCard als standalone component
import { TenderCard } from '../components/TenderCard.js';
import { planningService } from '../services/PlanningService.js';

export class TenderListView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.headersRow = null;
        this.fase = options.fase;
        this.filteredTenders = [];
        
        this.searchQuery = '';
        this.onSearchResultsCount = null;

        // Cache voor ALLE fase statussen
        this.allFaseStatussen = {};
        this.faseConfig = {};
        
        // ⭐ v2.4: Smart Import instances
        this.smartImportPanel = null;
        this.smartImportWizard = null;
        
        this.initSmartImport();
    }

    // ⭐ v2.4: Initialiseer Smart Import componenten
    initSmartImport() {
        // Panel voor bestaande analyses
        this.smartImportPanel = new SmartImportPanel({
            onReanalyzeComplete: (tenderId, newData) => {
                console.log('✅ Reanalyze complete for tender:', tenderId);
                if (this.onTenderUpdated) {
                    this.onTenderUpdated(tenderId);
                }
            },
            onClose: () => {
                console.log('Smart Import Panel closed');
            }
        });
        
        // Inject CSS
        this.injectSmartImportStyles();
    }
    
    // ⭐ v2.4: CSS voor AI badge (altijd zichtbaar)
    injectSmartImportStyles() {
        if (document.getElementById('smart-import-inline-styles')) return;
        
        const styleSheet = document.createElement('style');
        styleSheet.id = 'smart-import-inline-styles';
        styleSheet.textContent = `
            /* AI Badge - Altijd zichtbaar */
            .ai-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-left: 8px;
                flex-shrink: 0;
            }
            
            /* Standaard state - geen analyse gedaan */
            .ai-badge.ai-badge--new {
                background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
                border: 1px dashed #94a3b8;
                color: #64748b;
            }
            
            .ai-badge.ai-badge--new:hover {
                background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                border: 1px solid #7dd3fc;
                color: #0369a1;
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(3, 105, 161, 0.2);
            }
            
            /* Haiku analyse gedaan */
            .ai-badge.ai-badge--haiku {
                background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                border: 1px solid #7dd3fc;
                color: #0369a1;
            }
            
            .ai-badge.ai-badge--haiku:hover {
                background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(3, 105, 161, 0.3);
            }
            
            /* Pro (Sonnet) analyse gedaan */
            .ai-badge.ai-badge--pro {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border: 1px solid #fbbf24;
                color: #92400e;
            }
            
            .ai-badge.ai-badge--pro:hover {
                background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
            }
            
            .ai-badge .badge-icon {
                font-size: 12px;
            }
            
            .ai-badge .badge-label {
                letter-spacing: 0.3px;
            }
            
            /* Tender name row met badge */
            .tender-name-row {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }
            
            .tender-name-row .tender-name {
                margin: 0;
            }
        `;
        document.head.appendChild(styleSheet);
    }

    /**
     * Get icon HTML
     */
    getIcon(name, size = 14, color = null) {
        const Icons = window.Icons;

        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }

        console.warn(`Icon '${name}' not found`);
        return '';
    }

    /**
     * Set tenders and filter them
     */
    async setTenders(tenders) {
        this.tenders = tenders || [];
        this.filteredTenders = this.filterTenders(this.tenders);

        await this.loadAllFaseStatussen();
        this.notifySearchResultsCount();

        if (this.container) {
            this.render();
        }

        // Planning & checklist tellingen ophalen (async, herrendert na laden)
        try {
            const counts = await planningService.getAllCounts();
            if (counts && Object.keys(counts).length > 0) {
                for (const tender of this.tenders) {
                    const c = counts[tender.id];
                    if (c) {
                        tender._planningCounts = { done: c.planning_done, total: c.planning_total };
                        tender._checklistCounts = { done: c.checklist_done, total: c.checklist_total };
                    }
                }
                this.filteredTenders = this.filterTenders(this.tenders);
                if (this.container) this.render();
            }
        } catch (e) {
            console.warn('⚠️ Planning counts niet geladen:', e.message);
        }
    }
    
    /**
     * Set search query and re-filter tenders
     */
    setSearchQuery(query) {
        this.searchQuery = query?.toLowerCase()?.trim() || '';
        this.filteredTenders = this.filterTenders(this.tenders);
        this.notifySearchResultsCount();
        
        if (this.container) {
            this.render();
        }
        
        console.log(`🔍 TenderListView: Zoeken op "${this.searchQuery}", ${this.filteredTenders.length} resultaten`);
    }

    notifySearchResultsCount() {
        if (this.onSearchResultsCount && this.searchQuery) {
            this.onSearchResultsCount(this.filteredTenders.length);
        }
    }

    getSearchResultsCount() {
        return this.searchQuery ? this.filteredTenders.length : null;
    }

    clearSearchQuery() {
        this.setSearchQuery('');
    }

    /**
     * Laad statussen voor ALLE fases
     */
    async loadAllFaseStatussen() {
        const fases = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];

        const faseConfigs = await faseService.getFases();
        faseConfigs.forEach(config => {
            this.faseConfig[config.fase] = config;
        });

        for (const fase of fases) {
            if (!this.allFaseStatussen[fase]) {
                try {
                    this.allFaseStatussen[fase] = await faseService.getStatussenVoorFase(fase);
                } catch (error) {
                    console.error(`Error loading statussen for fase ${fase}:`, error);
                    this.allFaseStatussen[fase] = [];
                }
            }
        }
    }

    getFaseKleur(fase) {
        const kleuren = {
            'acquisitie': '#f59e0b',
            'inschrijvingen': '#8b5cf6',
            'ingediend': '#10b981',
            'archief': '#64748b'
        };
        return this.faseConfig[fase]?.kleur || kleuren[fase] || '#6366f1';
    }

    /**
     * Filter tenders
     */
    filterTenders(tenders) {
        if (!tenders) return [];

        let filtered = tenders;

        if (this.fase === null || this.fase === undefined) {
            filtered = filtered.filter(tender => tender.fase !== 'archief');
        } else {
            filtered = filtered.filter(tender => tender.fase === this.fase);
        }

        if (this.searchQuery && this.searchQuery.length > 0) {
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
        }

        return filtered;
    }

    /**
     * Render the list view
     */
    render() {
        if (!this.container) return;

        if (!this.filteredTenders || this.filteredTenders.length === 0) {
            this.cleanupStickyHeader();
            this.container.innerHTML = this.searchQuery 
                ? this.renderNoSearchResults() 
                : this.renderEmptyState();
            return;
        }

        this.headersRow = new HeadersRow({
            onSort: (column, direction) => this.handleSort(column, direction)
        });

        const wrapper = document.createElement('div');
        wrapper.className = 'tender-list-view';

        wrapper.appendChild(this.headersRow.render());

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'tender-cards-container';
        cardsContainer.innerHTML = this.filteredTenders.map(tender => this.renderTenderCard(tender)).join('');
        wrapper.appendChild(cardsContainer);

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        this.attachEventListeners();
        
        // ⭐ v2.7: JS-based sticky header (CSS sticky werkt niet met geneste containers)
        this.setupStickyHeader();
    }

    /**
     * ⭐ v2.7: Setup sticky header via JavaScript
     * CSS position:sticky werkt niet betrouwbaar met geneste scroll containers.
     * Deze oplossing luistert naar het scroll event op #app-content en houdt
     * de header bovenaan via transform: translateY().
     */
    setupStickyHeader() {
        const scrollContainer = document.getElementById('app-content');
        const headerRow = this.container.querySelector('.headers-row');
        if (!scrollContainer || !headerRow) return;

        // Cleanup vorige listener
        this.cleanupStickyHeader();

        // ⭐ Wrap header in een container met solide achtergrond
        // zodat content niet doorschijnt bij scrollen
        let stickyWrap = headerRow.parentElement.querySelector('.sticky-header-backdrop');
        if (!stickyWrap) {
            stickyWrap = document.createElement('div');
            stickyWrap.className = 'sticky-header-backdrop';
            headerRow.parentNode.insertBefore(stickyWrap, headerRow);
            stickyWrap.appendChild(headerRow);
        }

        // Sla referenties op voor cleanup
        this._stickyScrollContainer = scrollContainer;
        this._stickyHeaderWrap = stickyWrap;

        this._stickyScrollHandler = () => {
            const scrollTop = scrollContainer.scrollTop;
            
            if (scrollTop > 0) {
                stickyWrap.style.transform = `translateY(${scrollTop}px)`;
                stickyWrap.style.zIndex = '50';
                stickyWrap.style.position = 'relative';
                stickyWrap.classList.add('is-sticky');
            } else {
                stickyWrap.style.transform = '';
                stickyWrap.style.zIndex = '';
                stickyWrap.style.position = '';
                stickyWrap.classList.remove('is-sticky');
            }
        };

        scrollContainer.addEventListener('scroll', this._stickyScrollHandler, { passive: true });
    }

    /**
     * ⭐ v2.7: Cleanup sticky header listener
     */
    cleanupStickyHeader() {
        if (this._stickyScrollHandler && this._stickyScrollContainer) {
            this._stickyScrollContainer.removeEventListener('scroll', this._stickyScrollHandler);
        }
        this._stickyScrollHandler = null;
        this._stickyScrollContainer = null;
        this._stickyHeaderWrap = null;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderNoSearchResults() {
        return `
            <div class="empty-state empty-state--search">
                <div class="empty-state-icon">${this.getIcon('search', 48)}</div>
                <div class="empty-state-title">Geen resultaten gevonden</div>
                <div class="empty-state-text">
                    Er zijn geen tenders gevonden voor "<strong>${this.escapeHtml(this.searchQuery)}</strong>"
                </div>
                <div class="empty-state-hint">
                    Probeer een andere zoekterm of pas je filters aan.
                </div>
            </div>
        `;
    }

    handleSort(column, direction) {
        console.log(`Sorting by ${column} ${direction}`);

        this.filteredTenders.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            if (valA == null) return 1;
            if (valB == null) return -1;

            if (column.includes('datum') || column.includes('deadline')) {
                valA = new Date(valA);
                valB = new Date(valB);
            }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });

        const cardsContainer = this.container.querySelector('.tender-cards-container');
        if (cardsContainer) {
            cardsContainer.innerHTML = this.filteredTenders.map(tender => this.renderTenderCard(tender)).join('');
            this.attachEventListeners();
        }
    }

    // =========================================================================
    // ⭐ v2.8: TENDER CARD RENDERING via TenderCard component
    // =========================================================================

    /**
     * Render a single tender card
     * ⭐ v2.8: Delegeert naar TenderCard component
     */
    renderTenderCard(tender) {
        const card = new TenderCard(tender, {
            searchQuery: this.searchQuery,
            allFaseStatussen: this.allFaseStatussen,
            planningCounts: tender._planningCounts || null,
            checklistCounts: tender._checklistCounts || null
        });
        return card.render();
    }

    // =========================================================================
    // SMART IMPORT HANDLERS
    // =========================================================================

    /**
     * ⭐ v2.4: Handle AI Badge click - conditioneel gedrag
     * v2.5: Gebruik SmartImportWizard voor beide scenarios (consistent UI)
     */
    async handleAIBadgeClick(tenderId, smartImportId, hasAnalysis) {
        console.log(`🤖 AI Badge clicked: tender=${tenderId}, smartImport=${smartImportId}, hasAnalysis=${hasAnalysis}`);
        
        // Zoek tender data
        const tender = this.tenders.find(t => t.id === tenderId);
        const tenderNaam = tender?.naam || 'Tender';
        const tenderBureauId = tender?.tenderbureau_id || null;
        
        // Zorg dat wizard bestaat
        this.ensureWizardExists(tenderId);
        
        // Set bureau override voor super-admin
        if (tenderBureauId) {
            this.smartImportWizard.overrideBureauId = tenderBureauId;
        }
        
        if (hasAnalysis && smartImportId) {
            // v2.5: Bestaande analyse - open wizard in VIEW mode (stap 3)
            await this.smartImportWizard.openForExistingAnalysis(smartImportId, tenderId, tenderNaam);
        } else {
            // Geen analyse - open wizard voor nieuwe upload (stap 1)
            this.smartImportWizard.openAsModal(tenderId, tenderNaam);
        }
    }
    
    /**
     * Zorg dat SmartImportWizard instance bestaat
     */
    ensureWizardExists(tenderId) {
        if (!this.smartImportWizard) {
            let wizardContainer = document.getElementById('smart-import-wizard-container');
            if (!wizardContainer) {
                wizardContainer = document.createElement('div');
                wizardContainer.id = 'smart-import-wizard-container';
                document.body.appendChild(wizardContainer);
            }
            
            this.smartImportWizard = new SmartImportWizard({
                container: wizardContainer,
                onComplete: async (result) => {
                    console.log('✅ Smart Import Wizard completed:', result);
                    if (this.onTenderUpdated) {
                        this.onTenderUpdated(tenderId);
                    }
                    this.smartImportWizard.close();
                },
                onCancel: () => {
                    console.log('❌ Smart Import Wizard cancelled');
                    this.smartImportWizard.close();
                }
            });
        }
    }

    /**
     * ⭐ v2.4: Open Smart Import Wizard voor nieuwe analyse
     */
    async openSmartImportWizard(tenderId) {
        console.log(`📤 Opening Smart Import Wizard for tender: ${tenderId}`);
        
        // Zoek tender data
        const tender = this.tenders.find(t => t.id === tenderId);
        const tenderNaam = tender?.naam || 'Tender';
        
        // v2.4.1: Haal bureau_id van de tender (voor super-admin met "Alle bureaus")
        const tenderBureauId = tender?.tenderbureau_id || null;
        
        console.log(`📋 Tender: ${tenderNaam}, Bureau: ${tenderBureauId}`);
        
        // Zorg dat wizard bestaat
        this.ensureWizardExists(tenderId);
        
        // v2.4.1: Stel bureau_id in voor de wizard (override "Alle bureaus")
        if (tenderBureauId) {
            this.smartImportWizard.overrideBureauId = tenderBureauId;
        }
        
        // Open wizard als modal MET parameters
        this.smartImportWizard.openAsModal(tenderId, tenderNaam);
    }

    /**
     * Open Smart Import Panel voor bestaande analyse
     * @deprecated v2.5: Gebruik nu handleAIBadgeClick met openForExistingAnalysis
     */
    async openSmartImportPanel(smartImportId, tenderId) {
        // Redirect naar nieuwe methode
        const tender = this.tenders.find(t => t.id === tenderId);
        const tenderNaam = tender?.naam || 'Tender';
        
        this.ensureWizardExists(tenderId);
        await this.smartImportWizard.openForExistingAnalysis(smartImportId, tenderId, tenderNaam);
    }

    // =========================================================================
    // DATUM HELPERS (nog nodig voor updateCellDisplay na inline editing)
    // =========================================================================

    getDaysUntil(dateString) {
        if (!dateString) return null;
        const targetDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);
        const diffTime = targetDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    /**
     * ⭐ v2.6: Check of datum string een echte tijd bevat (niet 00:00:00)
     */
    hasExplicitTime(dateString) {
        if (!dateString) return false;
        const timeMatch = dateString.match(/T(\d{2}):(\d{2})/);
        if (!timeMatch) return false;
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        return hours !== 0 || minutes !== 0;
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    /**
     * Attach event listeners
     * ⭐ v2.4: AI Badge met conditioneel gedrag
     * ⭐ v2.6: Timeline cell inline editing
     * ⭐ v2.7: Planning/Checklist shortcut knoppen
     */
    attachEventListeners() {
        // Custom dropdown - toggle menu
        this.container.querySelectorAll('.status-dropdown-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const dropdown = trigger.closest('.status-dropdown');
                const tenderRow = trigger.closest('.tender-row');
                const isOpen = dropdown.classList.contains('is-open');

                this.container.querySelectorAll('.status-dropdown.is-open').forEach(d => {
                    d.classList.remove('is-open');
                    d.closest('.tender-row').classList.remove('dropdown-open');
                });

                if (!isOpen) {
                    dropdown.classList.add('is-open');
                    tenderRow.classList.add('dropdown-open');
                }
            });
        });

        // Custom dropdown - select option
        this.container.querySelectorAll('.status-dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = option.closest('.status-dropdown');
                const tenderRow = dropdown.closest('.tender-row');
                const tenderId = dropdown.dataset.tenderId;
                const newStatus = option.dataset.value;
                const newFase = option.dataset.fase;
                const currentFase = dropdown.dataset.currentFase;

                const trigger = dropdown.querySelector('.status-dropdown-value');
                trigger.textContent = option.textContent.trim();

                if (newFase !== currentFase) {
                    const faseBadge = tenderRow.querySelector('.fase-badge');
                    if (faseBadge) {
                        faseBadge.textContent = newFase.toUpperCase();
                        faseBadge.className = `fase-badge fase-badge--${newFase}`;
                    }
                    tenderRow.className = tenderRow.className.replace(/phase-\w+/, `phase-${newFase}`);
                    dropdown.dataset.currentFase = newFase;
                }

                dropdown.querySelectorAll('.status-dropdown-option').forEach(opt => {
                    opt.classList.remove('is-selected');
                });
                option.classList.add('is-selected');

                dropdown.classList.remove('is-open');
                tenderRow.classList.remove('dropdown-open');

                if (this.onStatusChange) {
                    this.onStatusChange(tenderId, newStatus, newFase);
                }
            });
        });

        // Sluit dropdown bij klik buiten
        document.addEventListener('click', (e) => {
            if (!this.container) return;

            if (!e.target.closest('.status-dropdown')) {
                this.container.querySelectorAll('.status-dropdown.is-open').forEach(d => {
                    d.classList.remove('is-open');
                    d.closest('.tender-row').classList.remove('dropdown-open');
                });
            }
        });

        // Documentknop: Open AI Documenten modal
        this.container.querySelectorAll('.doc-button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tenderId = btn.dataset.tenderId;
                const modal = new AIDocumentenModal(tenderId);
                await modal.show();
            });
        });

        // Edit button click
        this.container.querySelectorAll('.edit-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = btn.dataset.tenderId;
                if (this.onTenderClick) {
                    this.onTenderClick(tenderId);
                } else {
                    console.log('Edit clicked for tender:', tenderId);
                }
            });
        });

        // Add team member button click
        this.container.querySelectorAll('.avatar--add').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = btn.dataset.tenderId;
                if (this.onAddTeamMember) {
                    this.onAddTeamMember(tenderId);
                } else {
                    console.log('Add team member clicked for tender:', tenderId);
                }
            });
        });
        
        // ⭐ v2.4: AI Badge click handler - CONDITIONEEL GEDRAG
        this.container.querySelectorAll('.ai-badge').forEach(badge => {
            badge.addEventListener('click', async (e) => {
                e.stopPropagation();
                const tenderId = badge.dataset.tenderId;
                const smartImportId = badge.dataset.smartImportId;
                const hasAnalysis = badge.dataset.hasAnalysis === 'true';
                
                await this.handleAIBadgeClick(tenderId, smartImportId, hasAnalysis);
            });
        });
        
        // ⭐ v2.6: Timeline cell click handler - INLINE DATUM EDITING
        this.container.querySelectorAll('.timeline-cell--editable').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = cell.dataset.tenderId;
                const fieldName = cell.dataset.field;
                const currentDate = cell.dataset.date || '';
                
                this.openDatePicker(cell, tenderId, fieldName, currentDate);
            });
        });

        // ⭐ v2.7: Planning/Checklist shortcut knoppen
        this.container.querySelectorAll('.planning-shortcut').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = btn.dataset.tenderId;
                const openType = btn.dataset.open; // 'planning' of 'checklist'
                
                if (this.onOpenPlanningModal) {
                    this.onOpenPlanningModal(tenderId, openType);
                } else {
                    console.log(`${openType} shortcut clicked for tender:`, tenderId);
                }
            });
        });
    }

    // =========================================================================
    // INLINE DATE PICKER (v2.6)
    // =========================================================================
    
    /**
     * ⭐ v2.6: Open inline date picker with time support
     */
    openDatePicker(cell, tenderId, fieldName, currentDate) {
        // Sluit bestaande date pickers
        this.closeDatePicker();
        
        // Format huidige datum/tijd voor input
        let inputValue = '';
        if (currentDate) {
            // Zorg dat we een proper datetime-local format hebben (YYYY-MM-DDTHH:MM)
            const dateObj = new Date(currentDate);
            if (!isNaN(dateObj.getTime())) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                const hours = String(dateObj.getHours()).padStart(2, '0');
                const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                inputValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
        }
        
        // Maak date picker popup
        const picker = document.createElement('div');
        picker.className = 'inline-date-picker';
        picker.innerHTML = `
            <div class="date-picker-header">
                <span class="date-picker-title">${this.getFieldLabel(fieldName)}</span>
                <button class="date-picker-close" title="Sluiten">×</button>
            </div>
            <div class="date-picker-inputs">
                <div class="date-picker-field">
                    <label>Datum</label>
                    <input type="date" class="date-picker-date" value="${inputValue ? inputValue.split('T')[0] : ''}">
                </div>
                <div class="date-picker-field">
                    <label>Tijd <span class="optional-label">(optioneel)</span></label>
                    <input type="time" class="date-picker-time" value="${inputValue ? inputValue.split('T')[1] || '' : ''}">
                </div>
            </div>
            <div class="date-picker-actions">
                ${currentDate ? `<button class="date-picker-clear">Wissen</button>` : ''}
                <button class="date-picker-save">Opslaan</button>
            </div>
        `;
        
        // Positie de picker bij de cell
        const rect = cell.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.top = `${rect.bottom + 4}px`;
        picker.style.left = `${rect.left}px`;
        picker.style.zIndex = '10000';
        
        // Check of picker buiten scherm valt
        document.body.appendChild(picker);
        const pickerRect = picker.getBoundingClientRect();
        if (pickerRect.right > window.innerWidth) {
            picker.style.left = `${window.innerWidth - pickerRect.width - 16}px`;
        }
        if (pickerRect.bottom > window.innerHeight) {
            picker.style.top = `${rect.top - pickerRect.height - 4}px`;
        }
        
        this.activeDatePicker = picker;
        
        // Focus op date input
        const dateInput = picker.querySelector('.date-picker-date');
        const timeInput = picker.querySelector('.date-picker-time');
        dateInput.focus();
        
        // Event handlers
        picker.querySelector('.date-picker-close').addEventListener('click', () => {
            this.closeDatePicker();
        });
        
        picker.querySelector('.date-picker-save').addEventListener('click', async () => {
            const newDate = this.combineDateTimeInputs(dateInput.value, timeInput.value);
            await this.saveDateChange(tenderId, fieldName, newDate, cell);
            this.closeDatePicker();
        });
        
        const clearBtn = picker.querySelector('.date-picker-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                await this.saveDateChange(tenderId, fieldName, null, cell);
                this.closeDatePicker();
            });
        }
        
        // Enter om op te slaan
        const handleKeydown = async (e) => {
            if (e.key === 'Enter') {
                const newDate = this.combineDateTimeInputs(dateInput.value, timeInput.value);
                await this.saveDateChange(tenderId, fieldName, newDate, cell);
                this.closeDatePicker();
            }
            if (e.key === 'Escape') {
                this.closeDatePicker();
            }
        };
        dateInput.addEventListener('keydown', handleKeydown);
        timeInput.addEventListener('keydown', handleKeydown);
        
        // Sluit bij klik buiten
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 10);
    }
    
    /**
     * ⭐ v2.6: Combine date and time inputs into ISO string
     */
    combineDateTimeInputs(dateValue, timeValue) {
        if (!dateValue) return null;
        
        if (timeValue) {
            return `${dateValue}T${timeValue}:00`;
        } else {
            return `${dateValue}T00:00:00`;
        }
    }
    
    /**
     * ⭐ v2.6: Handle click outside date picker
     */
    handleOutsideClick = (e) => {
        if (this.activeDatePicker && !this.activeDatePicker.contains(e.target)) {
            this.closeDatePicker();
        }
    }
    
    /**
     * ⭐ v2.6: Close date picker
     */
    closeDatePicker() {
        if (this.activeDatePicker) {
            this.activeDatePicker.remove();
            this.activeDatePicker = null;
        }
        document.removeEventListener('click', this.handleOutsideClick);
    }
    
    /**
     * ⭐ v2.6: Save date change to backend
     */
    async saveDateChange(tenderId, fieldName, newDate, cell) {
        try {
            console.log(`📅 Saving date: ${fieldName} = ${newDate} for tender ${tenderId}`);
            
            // Show loading state
            cell.classList.add('is-saving');
            
            // Update via API
            const updateData = { [fieldName]: newDate };
            
            // Gebruik apiService als beschikbaar, anders direct Supabase
            if (window.apiService && window.apiService.updateTender) {
                await window.apiService.updateTender(tenderId, updateData);
            } else {
                const supabase = window.supabaseClient || window.supabase;
                if (supabase) {
                    const { error } = await supabase
                        .from('tenders')
                        .update(updateData)
                        .eq('id', tenderId);
                    
                    if (error) throw error;
                }
            }
            
            // Update lokale data
            const tender = this.tenders.find(t => t.id === tenderId);
            if (tender) {
                tender[fieldName] = newDate;
            }
            
            // Update cell UI
            cell.dataset.date = newDate || '';
            this.updateCellDisplay(cell, newDate, fieldName);
            
            console.log(`✅ Date saved successfully`);
            
        } catch (error) {
            console.error('❌ Error saving date:', error);
            alert('Fout bij opslaan van datum');
        } finally {
            cell.classList.remove('is-saving');
        }
    }
    
    /**
     * ⭐ v2.6: Update cell display after date change (met tijd support)
     */
    updateCellDisplay(cell, date, fieldName) {
        const isDeadline = fieldName === 'deadline_indiening';
        
        if (!date) {
            cell.innerHTML = `
                <div class="date-display empty">
                    <span class="date-add-icon">+</span>
                </div>
            `;
            return;
        }
        
        const dateObj = new Date(date);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('nl-NL', { month: 'short' });
        const isPast = dateObj < new Date();
        const daysUntil = this.getDaysUntil(date);
        
        // Check of er ECHT een tijd is ingevuld (niet 00:00 in originele string)
        const hasTime = this.hasExplicitTime(date);
        let timeString = null;
        if (hasTime) {
            const hours = dateObj.getHours();
            const minutes = dateObj.getMinutes();
            timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
        
        let cellClasses = ['filled'];
        let badgeClass = 'ok';
        
        if (isPast) {
            cellClasses = ['completed'];
        } else if (isDeadline) {
            if (daysUntil <= 3) {
                cellClasses = ['urgent'];
                badgeClass = 'urgent';
            } else if (daysUntil <= 7) {
                cellClasses = ['soon'];
                badgeClass = 'soon';
            } else {
                cellClasses = ['deadline'];
                badgeClass = 'ok';
            }
        }
        
        const showBadge = isDeadline && !isPast && daysUntil !== null;
        
        cell.innerHTML = `
            <div class="date-display ${cellClasses.join(' ')} ${hasTime ? 'has-time' : ''}">
                <span class="date-day">${day}</span>
                <span class="date-month">${month}</span>
                ${hasTime ? `<span class="date-time">${timeString}</span>` : ''}
            </div>
            ${showBadge ? `
                <div class="days-to-deadline ${badgeClass}">
                    ${daysUntil === 0 ? 'Vandaag!' : daysUntil === 1 ? 'Morgen' : `${daysUntil} dagen`}
                </div>
            ` : ''}
        `;
    }
    
    /**
     * ⭐ v2.6: Get human readable field label
     */
    getFieldLabel(fieldName) {
        const labels = {
            'publicatie_datum': 'Publicatie',
            'schouw_datum': 'Schouw',
            'nvi1_datum': 'NvI 1',
            'nvi2_datum': 'NvI 2',
            'presentatie_datum': 'Presentatie',
            'interne_deadline': 'Interne deadline',
            'deadline_indiening': 'Deadline',
            'voorlopige_gunning': 'Voorlopige gunning',
            'definitieve_gunning': 'Definitieve gunning',
            'start_uitvoering': 'Start uitvoering'
        };
        return labels[fieldName] || fieldName;
    }

    // =========================================================================
    // EMPTY STATES
    // =========================================================================

    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">${this.getIcon('clipboardList', 48)}</div>
                <div class="empty-state-title">Geen tenders gevonden</div>
                <div class="empty-state-text">Maak een nieuwe tender aan of pas je filters aan.</div>
            </div>
        `;
    }
}

export default TenderListView;