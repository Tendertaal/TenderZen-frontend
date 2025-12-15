/**
 * TenderListView - Lijst weergave met tender cards
 * TenderZen v2.0
 * 
 * CHANGELOG:
 * - Emoji's vervangen door SVG iconen
 * - Inline styles vervangen door CSS classes
 * - HeadersRow als apart component geÃ¯mporteerd
 * - Icons dynamisch opgehaald via window.Icons
 * - â­ Dynamische statussen per fase uit database
 * - â­ ALLE statussen zichtbaar in dropdown met fase-kleuren
 */

import { BaseView } from './BaseView.js';
import { HeadersRow } from '../components/HeadersRow.js';
import { faseService } from '../services/FaseService.js';

export class TenderListView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.headersRow = null;
        this.fase = options.fase;
        this.filteredTenders = [];
        
        // â­ Cache voor ALLE fase statussen
        this.allFaseStatussen = {};
        this.faseConfig = {};
    }

    /**
     * Get icon HTML - haalt Icons op runtime op
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
        
        // â­ Laad ALLE statussen van ALLE fases
        await this.loadAllFaseStatussen();
        
        if (this.container) {
            this.render();
        }
    }

    /**
     * â­ Laad statussen voor ALLE fases
     */
    async loadAllFaseStatussen() {
        const fases = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];
        
        // Laad fase config voor kleuren
        const faseConfigs = await faseService.getFases();
        faseConfigs.forEach(config => {
            this.faseConfig[config.fase] = config;
        });
        
        // Laad statussen voor elke fase
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

    /**
     * â­ Get fase kleur
     */
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
     * Filter tenders - filters by fase if set in options
     */
    filterTenders(tenders) {
        if (!tenders) return [];
        
        if (this.fase === null || this.fase === undefined) {
            // TotaalView - filter archief eruit
            return tenders.filter(tender => tender.fase !== 'archief');
        }
        
        return tenders.filter(tender => tender.fase === this.fase);
    }

    /**
     * Render the list view
     */
    render() {
        if (!this.container) return;

        if (!this.filteredTenders || this.filteredTenders.length === 0) {
            this.container.innerHTML = this.renderEmptyState();
            return;
        }

        // Create HeadersRow component
        this.headersRow = new HeadersRow({
            onSort: (column, direction) => this.handleSort(column, direction)
        });

        // Build the view
        const wrapper = document.createElement('div');
        wrapper.className = 'tender-list-view';
        
        // Add headers row
        wrapper.appendChild(this.headersRow.render());
        
        // Add tender cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'tender-cards-container';
        cardsContainer.innerHTML = this.filteredTenders.map(tender => this.renderTenderCard(tender)).join('');
        wrapper.appendChild(cardsContainer);

        // Clear and append
        this.container.innerHTML = '';
        this.container.appendChild(wrapper);

        // Attach event listeners for cards
        this.attachEventListeners();
    }

    /**
     * Handle sort from HeadersRow
     */
    handleSort(column, direction) {
        console.log(`Sorting by ${column} ${direction}`);
        
        // Sort the filtered tenders
        this.filteredTenders.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];
            
            // Handle null/undefined
            if (valA == null) return 1;
            if (valB == null) return -1;
            
            // Date comparison
            if (column.includes('datum') || column.includes('deadline')) {
                valA = new Date(valA);
                valB = new Date(valB);
            }
            
            // Compare
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        
        // Re-render cards only
        const cardsContainer = this.container.querySelector('.tender-cards-container');
        if (cardsContainer) {
            cardsContainer.innerHTML = this.filteredTenders.map(tender => this.renderTenderCard(tender)).join('');
            this.attachEventListeners();
        }
    }

    /**
     * Render custom status dropdown (geen native select)
     */
    renderStatusSelect(tender) {
        const currentStatus = tender.fase_status || tender.status;
        const currentFase = tender.fase;
        
        // Zoek huidige status info
        let currentStatusConfig = null;
        let currentStatusFase = currentFase;
        let currentStatusDisplay = currentStatus;
        
        for (const [fase, statussen] of Object.entries(this.allFaseStatussen)) {
            const found = statussen.find(s => s.status_key === currentStatus);
            if (found) {
                currentStatusConfig = found;
                currentStatusFase = fase;
                currentStatusDisplay = found.status_display;
                break;
            }
        }
        
        // Bouw dropdown opties per fase
        let optionsHtml = '';
        const faseVolgorde = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];
        const faseLabels = {
            'acquisitie': 'ACQUISITIE',
            'inschrijvingen': 'INSCHRIJVINGEN',
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
     * Render a single tender card - â­ NIEUW MINIMALISTISCH DESIGN
     */
    renderTenderCard(tender) {
        const daysUntil = this.getDaysUntil(tender.deadline_indiening);
        const isUrgent = daysUntil !== null && daysUntil <= 7;
        const isCritical = daysUntil !== null && daysUntil <= 3;

        return `
            <div class="tender-row phase-${tender.fase}" data-tender-id="${tender.id}">
                <!-- Sectie 1: Aanbesteding - NIEUW MINIMALISTISCH DESIGN -->
                <div class="section-aanbesteding">
                    <div class="card-header-row">
                        <div class="card-content">
                            <!-- Fase tag + Doc button -->
                            <div class="fase-doc-row">
                                <div class="fase-tag fase-tag--${tender.fase}">
                                    <span class="fase-dot"></span>
                                    ${this.capitalizeFirst(tender.fase)}
                                </div>
                                <button class="doc-button" title="Documenten openen" data-tender-id="${tender.id}">
                                    ${this.getIcon('fileText', 18)}
                                </button>
                            </div>
                            
                            <!-- Tender naam -->
                            <h3 class="tender-name">${tender.naam || 'Geen naam'}</h3>
                            
                            <!-- Info lines -->
                            <div class="info-lines">
                                ${tender.opdrachtgever ? `
                                    <div class="info-line info-line--opdrachtgever">
                                        ${this.getIcon('building', 14)}
                                        <span>${tender.opdrachtgever}</span>
                                    </div>
                                ` : ''}
                                
                                ${tender.bedrijfsnaam ? `
                                    <div class="info-line info-line--inschrijver">
                                        ${this.getIcon('users', 14)}
                                        <span>via ${tender.bedrijfsnaam}</span>
                                    </div>
                                ` : ''}
                                
                                ${tender.tenderbureau ? `
                                    <div class="info-line info-line--tenderbureau">
                                        ${this.getIcon('edit', 14)}
                                        <span>${tender.tenderbureau}</span>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <!-- ⭐ Status dropdown rechts -->
                        <div class="card-actions">
                            ${this.renderStatusSelect(tender)}
                        </div>
                    </div>
                    
                    <!-- Footer row met team en meta -->
                    <div class="card-footer-row">
                        <!-- Team avatars - ⭐ v2.1: Nu via team_assignments -->
                        <div class="team-avatars">
                            ${this.renderTeamAvatars(tender.team_assignments)}
                            <button class="avatar avatar--add" title="Team bewerken" data-tender-id="${tender.id}">
                                ${this.getIcon('plus', 12)}
                            </button>
                        </div>
                        
                        <!-- Meta items -->
                        <div class="meta-row">
                            ${tender.type ? `
                                <span class="type-badge">${tender.type}</span>
                            ` : ''}
                            
                            ${tender.geschatte_workload ? `
                                <div class="meta-item">
                                    ${this.getIcon('clock', 14)}
                                    <span>${tender.geschatte_workload} uur</span>
                                </div>
                            ` : ''}
                            
                            ${tender.deadline_indiening ? `
                                <div class="meta-item ${isCritical ? 'meta-item--urgent' : ''}">
                                    ${this.getIcon('calendar', 14)}
                                    <span>${this.getDaysUntilText(daysUntil)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
                
                
                <!-- Sectie 4: Timeline -->
                <div class="section-timeline">
                    ${this.renderTimelineCell(tender.publicatie_datum)}
                    ${this.renderTimelineCell(tender.schouw_datum)}
                    ${this.renderTimelineCell(tender.nvi1_datum)}
                    ${this.renderTimelineCell(tender.nvi2_datum)}
                    ${this.renderTimelineCell(tender.presentatie_datum)}
                    ${this.renderTimelineCell(tender.interne_deadline)}
                    ${this.renderTimelineCell(tender.deadline_indiening, true)}
                    ${this.renderTimelineCell(tender.voorlopige_gunning)}
                    ${this.renderTimelineCell(tender.definitieve_gunning)}
                    ${this.renderTimelineCell(tender.start_uitvoering)}
                </div>
            </div>
        `;
    }

    /**
     * Render timeline cell
     */
    renderTimelineCell(date, isCritical = false) {
        if (!date) {
            return `
                <div class="timeline-cell">
                    <div class="date-display empty">-</div>
                </div>
            `;
        }

        const dateObj = new Date(date);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('nl-NL', { month: 'short' });
        const isPast = dateObj < new Date();
        const daysUntil = this.getDaysUntil(date);

        let cellClass = '';
        let badgeClass = 'ok';
        
        if (isPast) {
            cellClass = 'completed';
            badgeClass = 'past';
        } else if (isCritical && daysUntil <= 3) {
            cellClass = 'critical';
            badgeClass = 'urgent';
        } else if (isCritical && daysUntil <= 7) {
            cellClass = 'soon';
            badgeClass = 'soon';
        }

        return `
            <div class="timeline-cell">
                <div class="date-display ${cellClass}">
                    <span class="date-day">${day}</span>
                    <span class="date-month">${month}</span>
                </div>
                ${!isPast && daysUntil !== null && daysUntil <= 14 ? `
                    <div class="days-to-deadline ${badgeClass}">
                        ${daysUntil === 0 ? 'Vandaag!' : daysUntil === 1 ? 'Morgen' : `${daysUntil} dagen`}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get days until text
     */
    getDaysUntilText(days) {
        if (days === null) return 'Geen deadline';
        if (days < 0) return `${Math.abs(days)} dagen geleden`;
        if (days === 0) return 'Vandaag!';
        if (days === 1) return 'Morgen';
        return `${days} dagen`;
    }

    /**
     * Capitalize first letter
     */
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    /**
     * Get days until a date
     */
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

    /**
     * Get initials from a name
     */
    getInitials(name) {
        if (!name) return '?';
        
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * ⭐ v2.1: Render team avatars from team_assignments
     * @param {Array} teamAssignments - Array van {team_member_id, naam, rol, uren}
     * @returns {string} HTML string met avatars
     */
    renderTeamAvatars(teamAssignments) {
        if (!teamAssignments || teamAssignments.length === 0) {
            return '';
        }

        // Rol volgorde voor sortering (belangrijkste eerst)
        const rolVolgorde = ['manager', 'coordinator', 'schrijver', 'designer', 'calculator', 'reviewer', 'sales', 'klant_contact'];
        
        // Sorteer op rol volgorde
        const sorted = [...teamAssignments].sort((a, b) => {
            const indexA = rolVolgorde.indexOf(a.rol) !== -1 ? rolVolgorde.indexOf(a.rol) : 99;
            const indexB = rolVolgorde.indexOf(b.rol) !== -1 ? rolVolgorde.indexOf(b.rol) : 99;
            return indexA - indexB;
        });

        // Rol labels voor tooltip
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

        // Render max 5 avatars + overflow indicator
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

        // Overflow indicator
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
     */
    /**
     * Attach event listeners
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
                
                // Sluit alle andere dropdowns en reset z-index
                this.container.querySelectorAll('.status-dropdown.is-open').forEach(d => {
                    d.classList.remove('is-open');
                    d.closest('.tender-row').classList.remove('dropdown-open');
                });
                
                // Toggle deze dropdown
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
                
                // Update trigger text
                const trigger = dropdown.querySelector('.status-dropdown-value');
                trigger.textContent = option.textContent.trim();
                
                // Update selected state
                dropdown.querySelectorAll('.status-dropdown-option').forEach(opt => {
                    opt.classList.remove('is-selected');
                });
                option.classList.add('is-selected');
                
                // Sluit dropdown en reset z-index
                dropdown.classList.remove('is-open');
                tenderRow.classList.remove('dropdown-open');
                
                // Fire callback
                if (this.onStatusChange) {
                    this.onStatusChange(tenderId, newStatus, newFase);
                }
            });
        });
        
        // Sluit dropdown bij klik buiten
        document.addEventListener('click', (e) => {
            // Guard: container kan null zijn na unmount
            if (!this.container) return;
            
            if (!e.target.closest('.status-dropdown')) {
                this.container.querySelectorAll('.status-dropdown.is-open').forEach(d => {
                    d.classList.remove('is-open');
                    d.closest('.tender-row').classList.remove('dropdown-open');
                });
            }
        });

        // Document button click
        this.container.querySelectorAll('.doc-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = btn.dataset.tenderId;
                if (this.onDocumentClick) {
                    this.onDocumentClick(tenderId);
                } else {
                    console.log('Document clicked for tender:', tenderId);
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

        // Tender card click
        this.container.querySelectorAll('.tender-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('.status-dropdown') || 
                    e.target.closest('.unassigned') || 
                    e.target.closest('.doc-button') ||
                    e.target.closest('.avatar--add')) {
                    return;
                }

                const tenderId = row.dataset.tenderId;
                if (this.onTenderClick) {
                    this.onTenderClick(tenderId);
                }
            });
        });
    }


    /**
     * Render empty state
     */
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