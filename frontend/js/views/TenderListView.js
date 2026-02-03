/**
 * TenderListView - Lijst weergave met tender cards
 * TenderZen v2.6 - Inline Datum Editing
 * 
 * CHANGELOG v2.6:
 * - NIEUW: Inline datum editing op timeline cellen
 * - NIEUW: Klik op datum om date picker te openen
 * - NIEUW: Lege cellen tonen "+" om datum toe te voegen
 * - NIEUW: Wis knop om datum te verwijderen
 * 
 * CHANGELOG v2.5:
 * - Smart Import Wizard hergebruik voor bestaande analyses
 * - ensureWizardExists() helper methode
 * 
 * CHANGELOG v2.4:
 * - GEWIJZIGD: AI badge nu ALTIJD zichtbaar op elke tender
 * - NIEUW: Conditioneel gedrag bij klik:
 *   - Geen analyse → Open SmartImportWizard
 *   - Wel analyse → Open SmartImportPanel
 * - NIEUW: renderAIBadge() vervangt renderSmartImportBadge()
 * - NIEUW: handleAIBadgeClick() met conditionele logica
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

    /**
     * Render custom status dropdown
     */
    renderStatusSelect(tender) {
        const currentStatus = tender.fase_status || tender.status;
        const currentFase = tender.fase;

        let currentStatusFase = currentFase;
        let currentStatusDisplay = currentStatus;

        for (const [fase, statussen] of Object.entries(this.allFaseStatussen)) {
            const found = statussen.find(s => s.status_key === currentStatus);
            if (found) {
                currentStatusFase = fase;
                currentStatusDisplay = found.status_display;
                break;
            }
        }

        let optionsHtml = '';
        const faseVolgorde = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];
        const faseLabels = {
            'acquisitie': 'ACQUISITIE',
            'inschrijvingen': 'LOPEND',
            'ingediend': 'INGEDIEND',
            'archief': 'ARCHIEF'
        };

        for (const fase of faseVolgorde) {
            const statussen = this.allFaseStatussen[fase] || [];
            if (statussen.length > 0) {
                optionsHtml += `<div class="status-dropdown-group" data-fase="${fase}">
                    <div class="status-dropdown-label">${faseLabels[fase]}</div>`;
                for (const status of statussen) {
                    const isSelected = status.status_key === currentStatus;
                    const isSpecial = ['gewonnen', 'verloren'].includes(status.status_key);
                    optionsHtml += `
                        <div class="status-dropdown-option ${isSelected ? 'is-selected' : ''} ${isSpecial ? 'status--' + status.status_key : ''}" 
                             data-value="${status.status_key}" 
                             data-fase="${fase}">
                            ${status.status_display}
                        </div>`;
                }
                optionsHtml += `</div>`;
            }
        }

        return `
            <div class="status-dropdown" data-tender-id="${tender.id}" data-current-fase="${currentStatusFase}">
                <button class="status-dropdown-trigger" type="button">
                    <span class="status-dropdown-value">${currentStatusDisplay}</span>
                    <svg class="status-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="status-dropdown-menu">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }

    /**
     * ⭐ v2.4: Render AI Badge - ALTIJD ZICHTBAAR
     * 
     * States:
     * - new: Geen analyse gedaan (grijs, dashed border)
     * - haiku: Standaard analyse gedaan (blauw)
     * - pro: Pro analyse gedaan (goud)
     */
    renderAIBadge(tender) {
        const hasAnalysis = !!tender.smart_import_id;
        const modelUsed = tender.ai_model_used || 'haiku';
        const isPro = modelUsed === 'sonnet' || (modelUsed && modelUsed.includes('sonnet'));
        
        let badgeClass, icon, label, tooltip;
        
        if (!hasAnalysis) {
            // Geen analyse - toon "nieuwe analyse" optie
            badgeClass = 'ai-badge ai-badge--new';
            icon = '✨';
            label = 'AI';
            tooltip = 'Start AI analyse - Upload documenten om automatisch gegevens te extraheren';
        } else if (isPro) {
            // Pro analyse gedaan
            badgeClass = 'ai-badge ai-badge--pro';
            icon = '⚡';
            label = 'AI Pro';
            tooltip = 'Geanalyseerd met AI Pro - Klik voor details';
        } else {
            // Standaard analyse gedaan
            badgeClass = 'ai-badge ai-badge--haiku';
            icon = '✨';
            label = 'AI';
            tooltip = 'Geanalyseerd met AI - Klik voor details of upgrade naar Pro';
        }
        
        return `
            <button class="${badgeClass}" 
                    data-tender-id="${tender.id}"
                    data-smart-import-id="${tender.smart_import_id || ''}"
                    data-has-analysis="${hasAnalysis}"
                    title="${tooltip}">
                <span class="badge-icon">${icon}</span>
                <span class="badge-label">${label}</span>
            </button>
        `;
    }

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

    /**
     * Render a single tender card
     * ⭐ v2.4: Met AI badge die ALTIJD zichtbaar is
     */
    renderTenderCard(tender) {
        const daysUntil = this.getDaysUntil(tender.deadline_indiening);
        const isCritical = daysUntil !== null && daysUntil <= 3;

        const faseBadgeLabels = {
            acquisitie: 'ACQUISITIE',
            inschrijvingen: 'LOPEND',
            ingediend: 'INGEDIEND',
            archief: 'ARCHIEF'
        };
        const faseLabel = faseBadgeLabels[tender.fase] || tender.fase.toUpperCase();

        return `
            <div class="tender-row phase-${tender.fase}" data-tender-id="${tender.id}">
                <!-- Sectie 1: Aanbesteding -->
                <div class="section-aanbesteding">
                    
                    <!-- Header: Fase badge + Status dropdown + Action buttons -->
                    <div class="card-header-row">
                        <div class="card-header-left">
                            <div class="fase-status-group">
                                <span class="fase-badge fase-badge--${tender.fase}">${faseLabel}</span>
                                ${this.renderStatusSelect(tender)}
                            </div>
                        </div>
                        <div class="card-header-right">
                            <button class="action-btn doc-button" title="AI Documenten" data-tender-id="${tender.id}">
                                ${this.getIcon('ai', 18)}
                            </button>
                            <button class="action-btn edit-button" title="Tender instellingen" data-tender-id="${tender.id}">
                                ${this.getIcon('settings', 18)}
                            </button>
                        </div>
                    </div>
                    
                    <!-- Content: Tender naam + AI Badge + info -->
                    <div class="card-content">
                        <!-- ⭐ v2.4: Tender naam met AI Badge (ALTIJD ZICHTBAAR) -->
                        <div class="tender-name-row">
                            <h3 class="tender-name">${this.highlightSearchTerm(tender.naam || 'Geen naam')}</h3>
                            ${this.renderAIBadge(tender)}
                        </div>
                        
                        <div class="info-lines">
                            ${tender.opdrachtgever ? `
                                <div class="info-line info-line--opdrachtgever">
                                    ${this.getIcon('building', 14)}
                                    <span>${this.highlightSearchTerm(tender.opdrachtgever)}</span>
                                </div>
                            ` : ''}
                            
                            ${tender.bedrijfsnaam ? `
                                <div class="info-line info-line--inschrijver">
                                    ${this.getIcon('users', 14)}
                                    <span>Inschrijver: <strong style="color: #7c3aed;">${this.highlightSearchTerm(tender.bedrijfsnaam)}</strong></span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Footer: Team + Meta -->
                    <div class="card-footer-row">
                        <div class="team-avatars">
                            ${this.renderTeamAvatars(tender.team_assignments)}
                            <button class="avatar avatar--add" title="Team bewerken" data-tender-id="${tender.id}">
                                ${this.getIcon('plus', 12)}
                            </button>
                        </div>
                        
                        <div class="meta-row">
                            ${tender.deadline_indiening ? `
                                <div class="meta-item ${isCritical ? 'meta-item--urgent' : ''}">
                                    ${this.getIcon('calendar', 14)}
                                    <span>${this.getDaysUntilText(daysUntil)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Sectie: Timeline -->
                <div class="section-timeline">
                    ${this.renderTimelineCell(tender.id, 'publicatie_datum', tender.publicatie_datum)}
                    ${this.renderTimelineCell(tender.id, 'schouw_datum', tender.schouw_datum)}
                    ${this.renderTimelineCell(tender.id, 'nvi1_datum', tender.nvi1_datum)}
                    ${this.renderTimelineCell(tender.id, 'nvi2_datum', tender.nvi2_datum)}
                    ${this.renderTimelineCell(tender.id, 'presentatie_datum', tender.presentatie_datum)}
                    ${this.renderTimelineCell(tender.id, 'interne_deadline', tender.interne_deadline)}
                    ${this.renderTimelineCell(tender.id, 'deadline_indiening', tender.deadline_indiening, true)}
                    ${this.renderTimelineCell(tender.id, 'voorlopige_gunning', tender.voorlopige_gunning)}
                    ${this.renderTimelineCell(tender.id, 'definitieve_gunning', tender.definitieve_gunning)}
                    ${this.renderTimelineCell(tender.id, 'start_uitvoering', tender.start_uitvoering)}
                </div>
            </div>
        `;
    }

    highlightSearchTerm(text) {
        if (!text || !this.searchQuery) return text;
        
        const escapedQuery = this.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    /**
     * ⭐ v2.6: Render timeline cell met inline datum editing + tijd weergave
     * @param {string} tenderId - ID van de tender
     * @param {string} fieldName - Naam van het datum veld
     * @param {string} date - Datum waarde
     * @param {boolean} isDeadline - Is dit een deadline veld?
     */
    renderTimelineCell(tenderId, fieldName, date, isDeadline = false) {
        // Data attributen voor klik-handling
        const dataAttrs = `data-tender-id="${tenderId}" data-field="${fieldName}" data-date="${date || ''}"`;
        
        if (!date) {
            return `
                <div class="timeline-cell timeline-cell--editable" ${dataAttrs} title="Klik om datum in te vullen">
                    <div class="date-display empty">
                        <span class="date-add-icon">+</span>
                    </div>
                </div>
            `;
        }

        const dateObj = new Date(date);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('nl-NL', { month: 'short' });
        const isPast = dateObj < new Date();
        const daysUntil = this.getDaysUntil(date);
        
        // Check of er een ECHTE tijd is ingevuld (niet 00:00:00 in de originele string)
        // Dit voorkomt timezone conversie problemen
        const hasRealTime = this.hasExplicitTime(date);
        let timeString = null;
        if (hasRealTime) {
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

        return `
            <div class="timeline-cell timeline-cell--editable" ${dataAttrs} title="Klik om datum te wijzigen">
                <div class="date-display ${cellClasses.join(' ')} ${hasRealTime ? 'has-time' : ''}">
                    <span class="date-day">${day}</span>
                    <span class="date-month">${month}</span>
                    ${hasRealTime ? `<span class="date-time">${timeString}</span>` : ''}
                </div>
                ${showBadge ? `
                    <div class="days-to-deadline ${badgeClass}">
                        ${daysUntil === 0 ? 'Vandaag!' : daysUntil === 1 ? 'Morgen' : `${daysUntil} dagen`}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    /**
     * ⭐ v2.6: Check of datum string een echte tijd bevat (niet 00:00:00)
     * Dit voorkomt false positives door timezone conversie
     */
    hasExplicitTime(dateString) {
        if (!dateString) return false;
        
        // Check of de string een T bevat met een tijd die niet 00:00:00 is
        const timeMatch = dateString.match(/T(\d{2}):(\d{2})/);
        if (!timeMatch) return false;
        
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        
        // Alleen true als tijd niet 00:00 is
        return hours !== 0 || minutes !== 0;
    }

    getDaysUntilText(days) {
        if (days === null) return 'Geen deadline';
        if (days < 0) return `${Math.abs(days)} dagen geleden`;
        if (days === 0) return 'Vandaag!';
        if (days === 1) return 'Morgen';
        return `${days} dagen`;
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    getDaysUntil(dateString) {
        if (!dateString) return null;

        const targetDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        targetDate.setHours(0, 0, 0, 0);

        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return diffDays;
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    renderTeamAvatars(teamAssignments) {
        if (!teamAssignments || teamAssignments.length === 0) {
            return '';
        }

        const rolVolgorde = ['manager', 'coordinator', 'schrijver', 'designer', 'calculator', 'reviewer', 'sales', 'klant_contact'];

        const sorted = [...teamAssignments].sort((a, b) => {
            const indexA = rolVolgorde.indexOf(a.rol) !== -1 ? rolVolgorde.indexOf(a.rol) : 99;
            const indexB = rolVolgorde.indexOf(b.rol) !== -1 ? rolVolgorde.indexOf(b.rol) : 99;
            return indexA - indexB;
        });

        const rolLabels = {
            'manager': 'Manager',
            'coordinator': 'Coördinator',
            'schrijver': 'Schrijver',
            'designer': 'Designer',
            'calculator': 'Calculator',
            'reviewer': 'Reviewer',
            'sales': 'Sales',
            'klant_contact': 'Klant contact'
        };

        const maxVisible = 5;
        const visible = sorted.slice(0, maxVisible);
        const overflow = sorted.length - maxVisible;

        let html = visible.map(member => {
            const rolLabel = rolLabels[member.rol] || member.rol || 'Teamlid';
            const initialen = member.initialen || this.getInitials(member.naam);
            const urenText = member.uren ? ` - ${member.uren}u` : '';

            return `
                <div class="avatar avatar--${member.rol || 'teamlid'}" 
                     title="${member.naam} (${rolLabel}${urenText})"
                     data-member-id="${member.team_member_id}">
                    ${initialen}
                </div>
            `;
        }).join('');

        if (overflow > 0) {
            html += `
                <div class="avatar avatar--overflow" title="${overflow} meer teamleden">
                    +${overflow}
                </div>
            `;
        }

        return html;
    }

    /**
     * Attach event listeners
     * ⭐ v2.4: AI Badge met conditioneel gedrag
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
    }
    
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
                // Format: YYYY-MM-DDTHH:MM (voor datetime-local input)
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
            // Combineer datum en tijd
            return `${dateValue}T${timeValue}:00`;
        } else {
            // Alleen datum (standaard naar 00:00)
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