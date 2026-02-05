// frontend/js/components/TenderCard.js
// VERSIE: 20250204_0230 - Volledig functioneel (gesynchroniseerd met TenderListView v2.6)
//
// Standalone component met ALLE features uit TenderListView:
// - AI Badge met 3 states (new/haiku/pro)
// - Status dropdown met fase-groepen
// - Inline datum editing op timeline cellen
// - Urgentie badges (deadline countdown)
// - Tijd weergave bij expliciete tijden
// - Team avatars met rol-sortering + overflow
// - Search highlighting
// - Planning/Checklist shortcut knoppen

export class TenderCard {
    /**
     * @param {Object} tender - Tender data object
     * @param {Object} options - Configuratie opties
     * @param {string} [options.searchQuery=''] - Huidige zoekterm voor highlighting
     * @param {Object} [options.allFaseStatussen={}] - Status opties per fase
     * @param {Object} [options.planningCounts=null] - { done: 8, total: 12 } of null
     * @param {Object} [options.checklistCounts=null] - { done: 5, total: 7 } of null
     */
    constructor(tender, options = {}) {
        this.tender = tender;
        this.searchQuery = options.searchQuery || '';
        this.allFaseStatussen = options.allFaseStatussen || {};
        this.planningCounts = options.planningCounts || null;
        this.checklistCounts = options.checklistCounts || null;
    }

    // ─────────────────────────────────────────────
    // Icon helper - gebruikt window.Icons
    // ─────────────────────────────────────────────
    getIcon(name, size = 14, color = null) {
        const Icons = window.Icons;
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    // ─────────────────────────────────────────────
    // Datum helpers
    // ─────────────────────────────────────────────
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
     * Check of datum string een echte tijd bevat (niet 00:00:00)
     * Voorkomt false positives door timezone conversie
     */
    hasExplicitTime(dateString) {
        if (!dateString) return false;
        const timeMatch = dateString.match(/T(\d{2}):(\d{2})/);
        if (!timeMatch) return false;
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        return hours !== 0 || minutes !== 0;
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // ─────────────────────────────────────────────
    // Search highlighting
    // ─────────────────────────────────────────────
    highlightSearchTerm(text) {
        if (!text || !this.searchQuery) return text;
        const escapedQuery = this.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    // ─────────────────────────────────────────────
    // ⭐ AI Badge - ALTIJD ZICHTBAAR (3 states)
    // ─────────────────────────────────────────────
    renderAIBadge(tender) {
        const hasAnalysis = !!tender.smart_import_id;
        const modelUsed = tender.ai_model_used || 'haiku';
        const isPro = modelUsed === 'sonnet' || (modelUsed && modelUsed.includes('sonnet'));

        let badgeClass, icon, label, tooltip;

        if (!hasAnalysis) {
            badgeClass = 'ai-badge ai-badge--new';
            icon = '✨';
            label = 'AI';
            tooltip = 'Start AI analyse - Upload documenten om automatisch gegevens te extraheren';
        } else if (isPro) {
            badgeClass = 'ai-badge ai-badge--pro';
            icon = '⚡';
            label = 'AI Pro';
            tooltip = 'Geanalyseerd met AI Pro - Klik voor details';
        } else {
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

    // ─────────────────────────────────────────────
    // Status dropdown met fase-groepen
    // ─────────────────────────────────────────────
    renderStatusSelect(tender) {
        const currentStatus = tender.fase_status || tender.status;
        const currentFase = tender.fase;

        let currentStatusFase = currentFase;
        let currentStatusDisplay = currentStatus;

        // Zoek display naam van huidige status
        for (const [fase, statussen] of Object.entries(this.allFaseStatussen)) {
            const found = statussen.find(s => s.status_key === currentStatus);
            if (found) {
                currentStatusFase = fase;
                currentStatusDisplay = found.status_display;
                break;
            }
        }

        // Bouw opties HTML per fase
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

    // ─────────────────────────────────────────────
    // ⭐ Timeline cell met inline editing + urgentie
    // ─────────────────────────────────────────────
    renderTimelineCell(tenderId, fieldName, date, isDeadline = false) {
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

        // Check echte tijd (niet 00:00:00)
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

    // ─────────────────────────────────────────────
    // Team avatars met rol-sortering + overflow
    // ─────────────────────────────────────────────
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

    // ─────────────────────────────────────────────
    // Planning/Checklist count badges
    // ─────────────────────────────────────────────
    renderPlanningCount() {
        if (this.planningCounts) {
            return `${this.planningCounts.done}/${this.planningCounts.total}`;
        }
        return '0/0';
    }

    renderChecklistCount() {
        if (this.checklistCounts) {
            return `${this.checklistCounts.done}/${this.checklistCounts.total}`;
        }
        return '0/0';
    }

    // ─────────────────────────────────────────────
    // ⭐ MAIN RENDER - Volledige tender card
    // ─────────────────────────────────────────────
    render() {
        const tender = this.tender;
        const daysUntil = this.getDaysUntil(tender.deadline_indiening);
        const isCritical = daysUntil !== null && daysUntil <= 3;

        const faseBadgeLabels = {
            acquisitie: 'ACQUISITIE',
            inschrijvingen: 'LOPEND',
            ingediend: 'INGEDIEND',
            archief: 'ARCHIEF'
        };
        const faseLabel = faseBadgeLabels[tender.fase] || (tender.fase ? tender.fase.toUpperCase() : '');

        return `
            <div class="tender-row phase-${tender.fase || ''}" data-tender-id="${tender.id}">
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
                            
                            ${(tender.tenderbureau_naam || tender.tenderbureaus?.naam) ? `
                                <div class="info-line info-line--tenderbureau">
                                    ${this.getIcon('edit', 14)}
                                    <span>Bureau: ${this.highlightSearchTerm(tender.tenderbureau_naam || tender.tenderbureaus?.naam)}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Footer: Team + Planning/Checklist knoppen -->
                    <div class="card-footer-row">
                        <div class="team-avatars">
                            ${this.renderTeamAvatars(tender.team_assignments)}
                            <button class="avatar avatar--add" title="Team bewerken" data-tender-id="${tender.id}">
                                ${this.getIcon('plus', 12)}
                            </button>
                        </div>
                        
                        <div class="meta-row">
                            <button class="planning-shortcut planning-shortcut--planning" 
                                    data-tender-id="${tender.id}" 
                                    data-open="planning"
                                    title="Projectplanning openen">
                                ${this.getIcon('calendar', 13)}
                                <span class="planning-shortcut__count">${this.renderPlanningCount()}</span>
                            </button>
                            <button class="planning-shortcut planning-shortcut--checklist" 
                                    data-tender-id="${tender.id}" 
                                    data-open="checklist"
                                    title="Indieningschecklist openen">
                                ${this.getIcon('check', 13)}
                                <span class="planning-shortcut__count">${this.renderChecklistCount()}</span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Sectie 2: Timeline -->
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
}