/**
 * AgendaView — Agenda/planning overzicht over alle tenders
 * TenderZen v1.5 — Kwartaalweergave + tender sidebar
 * 
 * v1.5:
 * - Kwartaal kalender (3 mini-maanden naast elkaar)
 * - Tender sidebar bij maand + kwartaal views (consistent met weekview)
 * - Week/Maand/Kwartaal toggle links van navigatie knoppen
 * - Klik tender in sidebar → filter taken in kalender
 * 
 * v1.4: Maandweergave
 * v1.3: Weekgrid altijd zichtbaar
 * v1.2: Ongeplande + niet-toegewezen taken
 * 
 * Bestand: Frontend/js/views/AgendaView.js
 * Datum: 4 februari 2026
 */

import { BaseView } from './BaseView.js';
import { planningService } from '../services/PlanningService.js';

const Icons = window.Icons || {};

// ── Constanten ──
const DAYS_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const MONTHS_NL = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const MONTHS_FULL = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];

const FASE_META = {
    acquisitie:     { color: '#f59e0b', label: 'ACQUISITIE', bg: '#fffbeb', border: '#fde68a' },
    inschrijvingen: { color: '#3b82f6', label: 'LOPEND',     bg: '#eff6ff', border: '#bfdbfe' },
    ingediend:      { color: '#10b981', label: 'INGEDIEND',  bg: '#ecfdf5', border: '#a7f3d0' },
    archief:        { color: '#94a3b8', label: 'ARCHIEF',    bg: '#f8fafc', border: '#e2e8f0' },
};

const CARD_LEFT_W = 290;

// ── Date helpers ──
function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function dateKey(dt) {
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function formatDate(dt) {
    return `${dt.getDate()} ${MONTHS_NL[dt.getMonth()]} ${dt.getFullYear()}`;
}

function getMonday(dt) {
    const d = new Date(dt);
    const day = d.getDay();
    return addDays(d, day === 0 ? -6 : 1 - day);
}

function isoDate(dt) {
    return dateKey(dt);
}


export class AgendaView extends BaseView {
    constructor(options = {}) {
        super(options);

        // State
        this.currentWeekStart = getMonday(new Date());
        this.currentMonthDate = new Date();   // v1.4: Maand navigatie referentie
        this.viewMode = 'week';        // 'week' | 'maand' | 'kwartaal'
        this.filterMode = 'alle';      // 'alle' | 'mijn'
        this.selectedTeamMemberId = null;
        this.selectedTenderId = null;

        // Data
        this.taken = [];
        this.tenders = {};
        this.teamMembers = [];

        // Loading state
        this.isLoading = false;

        // ── v1.1: Event listener tracking ──
        this._boundClickHandler = null;

        // Callbacks (set by App.js)
        this.onOpenPlanningModal = null;

        console.log('📅 AgendaView constructed, currentWeekStart:', dateKey(this.currentWeekStart));
    }

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const opts = { size };
            if (color) opts.color = color;
            return Icons[name](opts);
        }
        return '';
    }

    // ── Data laden ──
    async loadData() {
        if (this.isLoading) {
            console.log('⏳ AgendaView.loadData() skipped — already loading');
            return;
        }

        this.isLoading = true;
        this.renderLoadingState();

        try {
            let startDate, endDate;

            if (this.viewMode === 'kwartaal') {
                // Kwartaal view: 3 maanden
                const months = this.getQuarterMonths();
                const firstGrid = this.getMonthGridFor(months[0]);
                const lastGrid = this.getMonthGridFor(months[2]);
                startDate = dateKey(firstGrid[0]);
                endDate = dateKey(lastGrid[lastGrid.length - 1]);
            } else if (this.viewMode === 'maand') {
                // Maand view: alle weken van de maand
                const weeks = this.getMonthWeeks();
                startDate = dateKey(weeks[0][0]);
                endDate = dateKey(weeks[weeks.length - 1][6]);
            } else {
                // Week view
                startDate = isoDate(this.currentWeekStart);
                endDate = isoDate(addDays(this.currentWeekStart, 6));
            }

            const teamMemberId = this.filterMode === 'mijn' ? this.selectedTeamMemberId : null;

            console.log(`📅 AgendaView.loadData() — requesting: ${startDate} → ${endDate}`, 
                teamMemberId ? `teamMember: ${teamMemberId}` : '(alle)');

            // Check of getAgendaData bestaat
            if (typeof planningService.getAgendaData !== 'function') {
                console.error('❌ planningService.getAgendaData is NOT a function! Methode ontbreekt in PlanningService.js');
                this.isLoading = false;
                this.render();
                return;
            }

            const data = await planningService.getAgendaData(startDate, endDate, teamMemberId);
            
            console.log('📅 AgendaView received data:', {
                taken: data?.taken?.length || 0,
                tenders: data?.tenders ? Object.keys(data.tenders).length : 0,
                team_members: data?.team_members?.length || 0
            });

            this.taken = data.taken || [];
            this.tenders = data.tenders || {};
            this.teamMembers = data.team_members || [];

            // Auto-select eerste teamlid als nog niet geselecteerd
            if (!this.selectedTeamMemberId && this.teamMembers.length > 0) {
                this.selectedTeamMemberId = this.teamMembers[0].id;
            }
        } catch (error) {
            console.error('❌ AgendaView loadData error:', error);
            this.taken = [];
            this.tenders = {};
        }

        this.isLoading = false;
        this.render();
    }

    // ── Mount/Unmount ──
    mount(container) {
        super.mount(container);
        console.log('📅 AgendaView.mount() called');
        this.loadData();
    }

    unmount() {
        // ── v1.1: Remove event listener bij unmount ──
        if (this.container && this._boundClickHandler) {
            this.container.removeEventListener('click', this._boundClickHandler);
            this._boundClickHandler = null;
        }
        super.unmount();
        console.log('📅 AgendaView.unmount() called');
    }

    // ── Navigatie ──
    navigateWeek(direction) {
        this.currentWeekStart = addDays(this.currentWeekStart, direction * 7);
        console.log(`📅 Navigated ${direction > 0 ? 'forward' : 'back'}, now: ${dateKey(this.currentWeekStart)}`);
        this.loadData();
    }

    navigateMonth(direction) {
        const d = new Date(this.currentMonthDate);
        d.setMonth(d.getMonth() + direction);
        this.currentMonthDate = d;
        console.log(`📅 Month navigated ${direction > 0 ? 'forward' : 'back'}, now: ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`);
        this.loadData();
    }

    navigateQuarter(direction) {
        const d = new Date(this.currentMonthDate);
        d.setMonth(d.getMonth() + direction * 3);
        this.currentMonthDate = d;
        const q = Math.floor(d.getMonth() / 3) + 1;
        console.log(`📅 Quarter navigated, now: Q${q} ${d.getFullYear()}`);
        this.loadData();
    }

    goToday() {
        this.currentWeekStart = getMonday(new Date());
        this.currentMonthDate = new Date();
        console.log(`📅 Go today`);
        this.loadData();
    }

    setViewMode(mode) {
        if (this.viewMode === mode) return;
        this.viewMode = mode;
        console.log(`📅 View mode: ${mode}`);
        this.loadData();
    }

    setFilterMode(mode) {
        this.filterMode = mode;
        this.selectedTenderId = null;
        this.loadData();
    }

    selectTeamMember(memberId) {
        this.selectedTeamMemberId = memberId;
        this.selectedTenderId = null;
        if (this.filterMode === 'mijn') {
            this.loadData();
        }
    }

    toggleTenderSelection(tenderId) {
        this.selectedTenderId = this.selectedTenderId === tenderId ? null : tenderId;
        this.render();
    }

    // ── Status toggle (checkbox) ──
    async toggleTaakStatus(taakId, currentStatus) {
        try {
            await planningService.togglePlanningTaakStatus(taakId, currentStatus);
            await this.loadData();
        } catch (error) {
            console.error('❌ Toggle taak status error:', error);
        }
    }

    // ── Computed data ──
    getVisibleTenders() {
        const tenderIds = [...new Set(this.taken.map(t => t.tender_id))];
        
        let tenderList = tenderIds
            .map(id => ({
                id,
                ...(this.tenders[id] || { naam: 'Onbekend', fase: 'acquisitie' }),
                taken: this.taken.filter(t => t.tender_id === id)
            }))
            .sort((a, b) => {
                const faseOrder = { acquisitie: 0, inschrijvingen: 1, ingediend: 2, archief: 3 };
                const fa = faseOrder[a.fase] ?? 99;
                const fb = faseOrder[b.fase] ?? 99;
                if (fa !== fb) return fa - fb;
                return (a.naam || '').localeCompare(b.naam || '');
            });

        if (this.selectedTenderId) {
            tenderList = tenderList.filter(t => t.id === this.selectedTenderId);
        }

        return tenderList;
    }

    getWeekDays() {
        return Array.from({ length: 7 }, (_, i) => addDays(this.currentWeekStart, i));
    }

    // v1.5: Generieke maandgrid voor willekeurige maand (gebruikt door kwartaalview)
    getMonthGridFor(monthDate) {
        const year = monthDate.getFullYear();
        const month = monthDate.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        let startDay = new Date(firstOfMonth);
        const dow = startDay.getDay();
        const offsetToMonday = dow === 0 ? -6 : 1 - dow;
        startDay = addDays(startDay, offsetToMonday);
        const totalDays = 42;
        const days = [];
        for (let i = 0; i < totalDays; i++) {
            days.push(addDays(startDay, i));
        }
        return days;
    }

    // v1.5: Kwartaal — welke 3 maanden
    getQuarterMonths() {
        const month = this.currentMonthDate.getMonth();
        const year = this.currentMonthDate.getFullYear();
        const qStart = Math.floor(month / 3) * 3;
        return [
            new Date(year, qStart, 1),
            new Date(year, qStart + 1, 1),
            new Date(year, qStart + 2, 1)
        ];
    }

    getPeriodLabel() {
        if (this.viewMode === 'kwartaal') {
            const month = this.currentMonthDate.getMonth();
            const year = this.currentMonthDate.getFullYear();
            const q = Math.floor(month / 3) + 1;
            return `Q${q} ${year}`;
        }
        if (this.viewMode === 'maand') {
            return `${MONTHS_FULL[this.currentMonthDate.getMonth()]} ${this.currentMonthDate.getFullYear()}`;
        }
        const days = this.getWeekDays();
        const first = days[0];
        const last = days[6];
        return `${first.getDate()} – ${last.getDate()} ${MONTHS_NL[last.getMonth()]} ${last.getFullYear()}`;
    }

    getMyStats() {
        let total = 0, done = 0, ongepland = 0, nietToegewezen = 0;
        this.taken.forEach(t => {
            total++;
            if (t.status === 'done') done++;
            if (t.is_ongepland || !t.datum) ongepland++;
            if (t.is_niet_toegewezen || !t.toegewezen_aan || t.toegewezen_aan.length === 0) nietToegewezen++;
        });

        const tenderCount = [...new Set(this.taken.map(t => t.tender_id))].length;

        return {
            thisWeek: total,
            open: total - done,
            done,
            tenderCount,
            ongepland,
            nietToegewezen
        };
    }

    getSelectedTeamMember() {
        return this.teamMembers.find(m => m.id === this.selectedTeamMemberId);
    }

    // ── Render: Loading ──
    renderLoadingState() {
        if (!this.container) return;
        const mainEl = this.container.querySelector('.agenda-main');
        if (mainEl) {
            mainEl.innerHTML = `
                <div class="agenda-loading">
                    <div class="agenda-loading-spinner"></div>
                    <span>Agenda laden...</span>
                </div>
            `;
        }
    }

    // ── Render: Hoofd ──
    render() {
        if (!this.container) return;

        const tenders = this.getVisibleTenders();
        const today = new Date();
        const todayStr = dateKey(today);
        const stats = this.getMyStats();
        const selectedMember = this.getSelectedTeamMember();
        const ongeplandeTaken = this.taken.filter(t => t.is_ongepland || !t.datum);

        let mainContent = '';

        if (this.isLoading) {
            mainContent = `<div class="agenda-loading"><div class="agenda-loading-spinner"></div><span>Agenda laden...</span></div>`;
        } else if (tenders.length === 0 && ongeplandeTaken.length === 0) {
            mainContent = this.renderEmptyState(selectedMember);
        } else if (this.viewMode === 'kwartaal') {
            // ── KWARTAAL VIEW ── Gantt chart
            mainContent = this.renderGanttChart(tenders, todayStr);
            if (ongeplandeTaken.length > 0) mainContent += this.renderOngeplandSection(ongeplandeTaken);
        } else if (this.viewMode === 'maand') {
            // ── MAAND VIEW ── gestapelde weekgrids (zelfde layout als weekview)
            mainContent = this.renderMonthWideGrid(tenders, todayStr);
            if (ongeplandeTaken.length > 0) mainContent += this.renderOngeplandSection(ongeplandeTaken);
        } else {
            // ── WEEK VIEW ── (bestaand: tender rows met dag cellen)
            const days = this.getWeekDays();
            const tendersInGrid = tenders.filter(t => 
                t.taken.some(tk => tk.datum && !tk.is_ongepland)
            );
            mainContent = this.renderWeekGrid(tendersInGrid, days, todayStr);
            if (ongeplandeTaken.length > 0) mainContent += this.renderOngeplandSection(ongeplandeTaken);
        }

        // Niet-toegewezen hint (alle views)
        if (!this.isLoading && stats.nietToegewezen > 0) {
            mainContent += `
                <div class="agenda-niet-toegewezen-hint">
                    <span class="agenda-nta-icon">⚠️</span>
                    <span>${stats.nietToegewezen} ${stats.nietToegewezen === 1 ? 'taak' : 'taken'} zonder toewijzing</span>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="agenda-view">
                ${this.renderToolbar()}
                ${this.renderFilterBar(tenders, stats)}
                ${this.filterMode === 'mijn' && selectedMember ? this.renderWelcomeBanner(selectedMember, stats) : ''}
                <div class="agenda-main">
                    ${mainContent}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    // ── Render: Toolbar ──
    renderToolbar() {
        const navActions = {
            week:     { prev: 'prev-week',    next: 'next-week',    prevT: 'Vorige week',     nextT: 'Volgende week' },
            maand:    { prev: 'prev-month',   next: 'next-month',   prevT: 'Vorige maand',    nextT: 'Volgende maand' },
            kwartaal: { prev: 'prev-quarter',  next: 'next-quarter',  prevT: 'Vorig kwartaal',  nextT: 'Volgend kwartaal' }
        };
        const nav = navActions[this.viewMode] || navActions.week;

        return `
            <div class="agenda-toolbar">
                <div class="agenda-toolbar-left">
                    ${this.getIcon('calendarView', 20, '#7c3aed')}
                    <span class="agenda-toolbar-title">Agenda</span>
                    <span class="agenda-toolbar-period">${this.getPeriodLabel()}</span>
                </div>
                <div class="agenda-toolbar-right">
                    <div class="agenda-viewmode-toggle">
                        <button class="agenda-viewmode-btn ${this.viewMode === 'week' ? 'active' : ''}" data-action="viewmode-week">Week</button>
                        <button class="agenda-viewmode-btn ${this.viewMode === 'maand' ? 'active' : ''}" data-action="viewmode-maand">Maand</button>
                        <button class="agenda-viewmode-btn ${this.viewMode === 'kwartaal' ? 'active' : ''}" data-action="viewmode-kwartaal">Kwartaal</button>
                    </div>
                    <div class="agenda-nav-group">
                        <button class="agenda-btn-icon" data-action="${nav.prev}" title="${nav.prevT}">
                            ${this.getIcon('chevronLeft', 14)}
                        </button>
                        <button class="agenda-btn-today" data-action="today">Vandaag</button>
                        <button class="agenda-btn-icon" data-action="${nav.next}" title="${nav.nextT}">
                            ${this.getIcon('chevronRight', 14)}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Render: Filter bar ──
    renderFilterBar(tenders, stats) {
        const totalTaken = tenders.reduce((s, t) => s + t.taken.length, 0);

        return `
            <div class="agenda-filter-bar">
                <div class="agenda-filter-left">
                    <div class="agenda-toggle-wrap">
                        <button class="agenda-toggle-btn ${this.filterMode === 'alle' ? 'active' : ''}" data-action="filter-alle">
                            ${this.getIcon('users', 14)}
                            Alle taken
                        </button>
                        <button class="agenda-toggle-btn ${this.filterMode === 'mijn' ? 'active' : ''}" data-action="filter-mijn">
                            ${this.getIcon('user', 14)}
                            Mijn taken
                        </button>
                    </div>
                    ${this.filterMode === 'mijn' ? this.renderTeamSelector() : ''}
                </div>
                <div class="agenda-filter-right">
                    ${this.filterMode === 'mijn' && stats ? `
                        <div class="agenda-stats-row">
                            <span class="agenda-stat-item">
                                <span class="agenda-stat-dot" style="background:#3b82f6"></span>
                                ${stats.thisWeek} totaal
                            </span>
                            <span class="agenda-stat-item">
                                <span class="agenda-stat-dot" style="background:#f59e0b"></span>
                                ${stats.open} open
                            </span>
                            <span class="agenda-stat-item">
                                <span class="agenda-stat-dot" style="background:#10b981"></span>
                                ${stats.done} klaar
                            </span>
                            ${stats.nietToegewezen > 0 ? `
                                <span class="agenda-stat-item agenda-stat-warning">
                                    <span class="agenda-stat-dot" style="background:#ef4444"></span>
                                    ${stats.nietToegewezen} niet toegewezen
                                </span>
                            ` : ''}
                        </div>
                    ` : `
                        <span class="agenda-filter-summary">
                            ${tenders.length} tender${tenders.length !== 1 ? 's' : ''} · ${totalTaken} taken
                            ${stats.ongepland > 0 ? ` · ${stats.ongepland} ongepland` : ''}
                            ${stats.nietToegewezen > 0 ? ` · ${stats.nietToegewezen} niet toegewezen` : ''}
                        </span>
                    `}
                </div>
            </div>
        `;
    }

    // ── Render: Team selector chips ──
    renderTeamSelector() {
        if (this.teamMembers.length === 0) return '';

        const chips = this.teamMembers.map(m => {
            const isSelected = m.id === this.selectedTeamMemberId;
            const avatarColor = m.avatar_kleur || '#6366f1';
            return `
                <button class="agenda-user-chip ${isSelected ? 'selected' : ''}"
                        data-action="select-member"
                        data-member-id="${m.id}"
                        style="${isSelected ? `--chip-color: ${avatarColor}` : ''}">
                    <span class="agenda-user-chip-avatar ${isSelected ? 'active' : ''}"
                          style="background: ${isSelected ? avatarColor : '#e2e8f0'}; color: ${isSelected ? 'white' : '#94a3b8'}">
                        ${m.initialen || m.naam?.substring(0, 2).toUpperCase() || '??'}
                    </span>
                    ${m.naam}
                </button>
            `;
        }).join('');

        return `
            <div class="agenda-user-selector">
                <span class="agenda-user-selector-label">Bekijk als:</span>
                <div class="agenda-user-chips">${chips}</div>
            </div>
        `;
    }

    // ── Render: Welkom banner ──
    renderWelcomeBanner(member, stats) {
        const color = member.avatar_kleur || '#7c3aed';
        const initials = member.initialen || member.naam?.substring(0, 2).toUpperCase() || '??';

        const taskText = stats.thisWeek === 0
            ? 'Geen taken deze week 🎉'
            : `${stats.thisWeek} ${stats.thisWeek === 1 ? 'taak' : 'taken'} deze week`;
        
        const tenderText = stats.tenderCount > 0
            ? ` · ${stats.tenderCount} tender${stats.tenderCount !== 1 ? 's' : ''}`
            : '';

        return `
            <div class="agenda-welcome-banner" style="border-left-color: ${color}">
                <div class="agenda-welcome-inner">
                    <div class="agenda-welcome-avatar" style="background: ${color}">${initials}</div>
                    <div class="agenda-welcome-text">
                        <div class="agenda-welcome-name">Welkom ${member.naam}</div>
                        <div class="agenda-welcome-sub">${taskText}${tenderText}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Render: Empty state ──
    renderEmptyState(member) {
        const naam = member?.naam || '';
        const periodTekst = this.viewMode === 'kwartaal' ? 'dit kwartaal' : this.viewMode === 'maand' ? 'deze maand' : 'deze week';
        return `
            <div class="agenda-empty-state">
                ${this.getIcon('calendarView', 48, '#cbd5e1')}
                <div class="agenda-empty-title">Geen taken gevonden</div>
                <div class="agenda-empty-sub">
                    ${this.filterMode === 'mijn' && naam
                        ? `${naam} heeft ${periodTekst} geen toegewezen taken`
                        : `Er zijn geen taken gepland voor ${periodTekst}`}
                </div>
            </div>
        `;
    }

    // ── Render: Ongepland sectie ──
    renderOngeplandSection(ongeplandeTaken) {
        // Groepeer ongeplande taken per tender
        const byTender = {};
        ongeplandeTaken.forEach(t => {
            if (!byTender[t.tender_id]) byTender[t.tender_id] = [];
            byTender[t.tender_id].push(t);
        });

        const tenderCards = Object.entries(byTender).map(([tenderId, taken]) => {
            const tenderInfo = this.tenders[tenderId] || { naam: 'Onbekend', fase: 'acquisitie' };
            const fm = FASE_META[tenderInfo.fase] || FASE_META.acquisitie;
            
            const taskCards = taken.map(task => {
                const isDone = task.status === 'done';
                const isNietToegewezen = !task.toegewezen_aan || task.toegewezen_aan.length === 0;
                
                const avatarsHtml = (task.toegewezen_aan || []).slice(0, 3).map(p => {
                    const color = p.avatar_kleur || '#6366f1';
                    const initials = p.initialen || p.naam?.substring(0, 2).toUpperCase() || '??';
                    return `<div class="agenda-task-avatar" style="background:${color}">${initials}</div>`;
                }).join('');

                return `
                    <div class="agenda-ongepland-card ${isDone ? 'done' : ''}"
                         data-action="open-planning"
                         data-tender-id="${task.tender_id}"
                         data-taak-id="${task.id}"
                         style="border-left-color: ${fm.color}">
                        <div class="agenda-task-top">
                            <button class="agenda-task-checkbox ${isDone ? 'checked' : ''}"
                                    data-action="toggle-status"
                                    data-taak-id="${task.id}"
                                    data-current-status="${task.status}"
                                    data-bron="${task.bron || 'planning'}"
                                    title="${isDone ? 'Markeer als open' : 'Markeer als klaar'}">
                                ${isDone ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                            </button>
                            <div class="agenda-task-name ${isDone ? 'done' : ''}">
                                ${task.is_milestone ? '<span class="agenda-task-flag">🚩</span>' : ''}
                                ${task.taak_naam || 'Onbekende taak'}
                            </div>
                        </div>
                        <div class="agenda-ongepland-meta">
                            ${isNietToegewezen 
                                ? '<span class="agenda-niet-toegewezen-badge">👤 Niet toegewezen</span>' 
                                : `<div class="agenda-task-avatars">${avatarsHtml}</div>`
                            }
                            <span class="agenda-bron-badge agenda-bron-${task.bron || 'planning'}">${task.bron === 'checklist' ? 'Checklist' : 'Planning'}</span>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="agenda-ongepland-tender">
                    <div class="agenda-ongepland-tender-header" style="border-left-color: ${fm.color}">
                        <span class="agenda-mini-fase-badge" style="background:${fm.bg}; color:${fm.color}; border-color:${fm.border}">${fm.label}</span>
                        <span class="agenda-ongepland-tender-naam">${tenderInfo.naam || 'Onbekend'}</span>
                        <span class="agenda-ongepland-count">${taken.length} ${taken.length === 1 ? 'taak' : 'taken'}</span>
                    </div>
                    <div class="agenda-ongepland-taken">
                        ${taskCards}
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="agenda-ongepland-section">
                <div class="agenda-ongepland-header">
                    <span class="agenda-ongepland-icon">📋</span>
                    <span class="agenda-ongepland-title">Ongepland</span>
                    <span class="agenda-ongepland-subtitle">${ongeplandeTaken.length} ${ongeplandeTaken.length === 1 ? 'taak' : 'taken'} zonder datum</span>
                </div>
                ${tenderCards}
            </div>
        `;
    }

    // ── Render: Tender Sidebar (maand + kwartaal views) ──
    renderTenderSidebar(tenders) {
        const allTenders = this.getVisibleTenders();
        
        const cards = allTenders.map(t => {
            const fm = FASE_META[t.fase] || FASE_META.acquisitie;
            const isSelected = this.selectedTenderId === t.id;
            const total = t.taken?.length || 0;
            const done = t.taken?.filter(tk => tk.status === 'done').length || 0;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;
            const geplande = t.taken?.filter(tk => tk.datum && !tk.is_ongepland).length || 0;

            // Team avatars
            const teamMap = new Map();
            (t.taken || []).forEach(tk => {
                (tk.toegewezen_aan || []).forEach(p => {
                    if (p && p.id && !teamMap.has(p.id)) teamMap.set(p.id, p);
                });
            });
            const teamAvatars = [...teamMap.values()].slice(0, 3);
            const avatarsHtml = teamAvatars.map((m, i) => {
                const color = m.avatar_kleur || '#6366f1';
                const initials = m.initialen || m.naam?.substring(0, 2).toUpperCase() || '??';
                return `<div class="agenda-mini-avatar" style="background:${color}; z-index:${3-i}; margin-left:${i > 0 ? '-6px' : '0'}">${initials}</div>`;
            }).join('');

            return `
                <div class="agenda-sidebar-card ${isSelected ? 'selected' : ''}"
                     data-action="toggle-tender"
                     data-tender-id="${t.id}"
                     style="border-left-color: ${fm.color}">
                    <div class="agenda-sidebar-card-top">
                        <span class="agenda-mini-fase-badge" style="background:${fm.bg}; color:${fm.color}; border-color:${fm.border}">${fm.label}</span>
                    </div>
                    <div class="agenda-sidebar-card-naam">${t.naam || 'Onbekend'}</div>
                    <div class="agenda-sidebar-card-client">
                        <span>🏛</span> ${t.opdrachtgever || '-'}
                    </div>
                    <div class="agenda-sidebar-card-footer">
                        <div class="agenda-mini-avatars">${avatarsHtml}</div>
                        <div class="agenda-sidebar-card-stats">
                            <span class="agenda-sidebar-progress-label">✓ ${done}/${total}</span>
                            <div class="agenda-mini-progress-bar" style="width:48px">
                                <div class="agenda-mini-progress-fill" style="width:${progress}%; background:${progress === 100 ? '#10b981' : fm.color}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="agenda-tender-sidebar">
                <div class="agenda-sidebar-header">
                    <span>TENDERS</span>
                    <span class="agenda-sidebar-count">${allTenders.length}</span>
                </div>
                <div class="agenda-sidebar-list">
                    ${cards || '<div class="agenda-sidebar-empty">Geen tenders</div>'}
                </div>
            </div>
        `;
    }

    // ── Render: Gantt Chart (Kwartaalweergave) ──
    renderGanttChart(tenders, todayStr) {
        const months = this.getQuarterMonths();
        const qStart = new Date(months[0].getFullYear(), months[0].getMonth(), 1);
        const qEnd = new Date(months[2].getFullYear(), months[2].getMonth() + 1, 0); // Laatste dag Q
        const totalDays = Math.round((qEnd - qStart) / (1000 * 60 * 60 * 24)) + 1;

        // Helper: dag-positie als percentage
        const dayPos = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr.substring(0, 10) + 'T12:00:00');
            const diff = Math.round((d - qStart) / (1000 * 60 * 60 * 24));
            if (diff < 0 || diff > totalDays) return null;
            return (diff / totalDays) * 100;
        };

        // ── Maand header kolommen ──
        const monthHeaders = months.map(m => {
            const daysInMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
            const widthPct = (daysInMonth / totalDays) * 100;
            return `
                <div class="gantt-month-col" style="width:${widthPct}%">
                    <div class="gantt-month-name">${MONTHS_FULL[m.getMonth()]} ${m.getFullYear()}</div>
                </div>
            `;
        }).join('');

        // ── Week nummers + verticale lijnen (elke maandag) ──
        let weekCols = '';
        let weekLines = '';
        let cursor = new Date(qStart);
        // Ga naar eerste maandag
        while (cursor.getDay() !== 1) cursor = addDays(cursor, 1);
        let weekNum = 1;
        while (cursor <= qEnd) {
            const pct = dayPos(dateKey(cursor));
            if (pct !== null) {
                weekLines += `<div class="gantt-vline gantt-vline-week" style="left:${pct}%"></div>`;
                weekCols += `<div class="gantt-week-num" style="left:${pct}%">W${weekNum}</div>`;
            }
            weekNum++;
            cursor = addDays(cursor, 7);
        }

        // ── Maand-scheidingslijnen ──
        let monthLines = '';
        for (let i = 1; i < 3; i++) {
            const pct = dayPos(dateKey(months[i]));
            if (pct !== null) {
                monthLines += `<div class="gantt-vline gantt-vline-month" style="left:${pct}%"></div>`;
            }
        }

        // ── Vandaag lijn ──
        const todayPct = dayPos(todayStr);
        const todayLine = todayPct !== null
            ? `<div class="gantt-vline gantt-vline-today" style="left:${todayPct}%"><span class="gantt-today-flag">Vandaag</span></div>`
            : '';

        // ── Achtergrond grid (week + maand lijnen) — wordt in elke rij herhaald ──
        const bgGrid = weekLines + monthLines + todayLine;

        // ── Tender rijen ──
        const tenderRows = tenders.map(t => {
            const fm = FASE_META[t.fase] || FASE_META.acquisitie;
            const isSelected = this.selectedTenderId === t.id;
            const geplande = (t.taken || []).filter(tk => tk.datum && !tk.is_ongepland);

            // Bereken bar range vanuit taken
            let barStartDate = null, barEndDate = null;
            const sortedDates = geplande.map(tk => tk.datum.substring(0, 10)).sort();
            if (sortedDates.length > 0) {
                barStartDate = sortedDates[0];
                barEndDate = sortedDates[sortedDates.length - 1];
            }

            // Verbreed naar publicatie & deadline
            const deadline = this.tenders[t.id]?.deadline_indiening;
            const pubDatum = this.tenders[t.id]?.publicatie_datum;
            if (pubDatum) {
                if (!barStartDate || pubDatum < barStartDate) barStartDate = pubDatum;
                if (!barEndDate || pubDatum > barEndDate) barEndDate = pubDatum;
            }
            if (deadline) {
                if (!barStartDate || deadline < barStartDate) barStartDate = deadline;
                if (!barEndDate || deadline > barEndDate) barEndDate = deadline;
            }

            // ── Gantt bar ──
            let barHtml = '';
            if (barStartDate && barEndDate) {
                const s = dayPos(barStartDate);
                const e = dayPos(barEndDate);
                if (s !== null && e !== null) {
                    const w = Math.max(e - s, 0.3);
                    barHtml = `<div class="gantt-bar" style="left:${s}%; width:${w}%; background:${fm.color}18; border-color:${fm.color}40"></div>`;
                }
            }

            // ── Taak-blokjes op de tijdlijn ──
            const taskDots = geplande.map(tk => {
                const pct = dayPos(tk.datum);
                if (pct === null) return '';
                const isDone = tk.status === 'done';
                return `
                    <div class="gantt-dot ${isDone ? 'done' : ''}"
                         style="left:${pct}%; background:${isDone ? '#10b981' : fm.color}"
                         data-action="open-planning"
                         data-tender-id="${tk.tender_id}"
                         data-taak-id="${tk.id}"
                         title="${tk.taak_naam || ''}&#10;${tk.datum.substring(0, 10)}">
                    </div>
                `;
            }).join('');

            // ── Deadline marker ──
            let deadlineHtml = '';
            if (deadline) {
                const pct = dayPos(deadline);
                if (pct !== null) {
                    deadlineHtml = `<div class="gantt-marker gantt-marker-deadline" style="left:${pct}%" title="Deadline indiening: ${deadline}">◆</div>`;
                }
            }

            // ── Publicatie marker ──
            let pubHtml = '';
            if (pubDatum) {
                const pct = dayPos(pubDatum);
                if (pct !== null) {
                    pubHtml = `<div class="gantt-marker gantt-marker-pub" style="left:${pct}%" title="Publicatiedatum: ${pubDatum}">▸</div>`;
                }
            }

            // ── Mini tender info ──
            const total = t.taken?.length || 0;
            const done = t.taken?.filter(tk => tk.status === 'done').length || 0;
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return `
                <div class="gantt-row ${isSelected ? 'selected' : ''}">
                    <div class="gantt-row-label" style="border-left-color:${fm.color}">
                        <span class="agenda-mini-fase-badge" style="background:${fm.bg}; color:${fm.color}; border-color:${fm.border}; font-size:9px; padding:1px 6px">${fm.label}</span>
                        <div class="gantt-row-naam" title="${t.naam || ''}">${t.naam || 'Onbekend'}</div>
                        <div class="gantt-row-client">${t.opdrachtgever ? '🏛 ' + t.opdrachtgever : ''}</div>
                        <div class="gantt-row-stats">
                            <span>✓ ${done}/${total}</span>
                            <div class="gantt-mini-bar"><div class="gantt-mini-bar-fill" style="width:${progress}%; background:${progress === 100 ? '#10b981' : fm.color}"></div></div>
                        </div>
                    </div>
                    <div class="gantt-row-timeline">
                        ${bgGrid}
                        ${barHtml}
                        ${taskDots}
                        ${deadlineHtml}
                        ${pubHtml}
                    </div>
                </div>
            `;
        }).join('');

        // Lege state
        const emptyHtml = tenders.length === 0
            ? `<div class="gantt-empty">Geen tenders gevonden in dit kwartaal</div>`
            : '';

        // Legenda
        const legend = `
            <div class="gantt-legend">
                <span class="gantt-legend-item"><span class="gantt-legend-swatch task"></span> Taak</span>
                <span class="gantt-legend-item"><span class="gantt-legend-swatch done"></span> Afgerond</span>
                <span class="gantt-legend-item"><span class="gantt-legend-sym deadline">◆</span> Deadline</span>
                <span class="gantt-legend-item"><span class="gantt-legend-sym pub">▸</span> Publicatie</span>
                <span class="gantt-legend-item"><span class="gantt-legend-swatch today-line"></span> Vandaag</span>
            </div>
        `;

        return `
            <div class="gantt-container">
                <div class="gantt-header">
                    <div class="gantt-header-label">TENDERS</div>
                    <div class="gantt-header-timeline">
                        <div class="gantt-months-row">${monthHeaders}</div>
                        <div class="gantt-weeks-row">${weekCols}</div>
                    </div>
                </div>
                <div class="gantt-body">
                    ${tenderRows}
                    ${emptyHtml}
                </div>
                ${legend}
            </div>
        `;
    }

    // ── Render: Maand als breed horizontaal grid (alle dagen naast elkaar) ──
    renderMonthWideGrid(tenders, todayStr) {
        const weeks = this.getMonthWeeks();
        const allDays = weeks.flat(); // Alle dagen van de maand als platte array
        const currentMonth = this.currentMonthDate.getMonth();

        // Alle tenders met minstens 1 geplande taak
        const tendersInMonth = tenders.filter(t => 
            t.taken.some(tk => tk.datum && !tk.is_ongepland)
        );

        // Bereken taken per tender per dag
        const tenderRowData = {};
        tendersInMonth.forEach(t => {
            const byDay = {};
            let maxInDay = 0;
            allDays.forEach(dt => {
                const key = dateKey(dt);
                const tasks = t.taken.filter(tk => {
                    if (!tk.datum) return false;
                    return tk.datum.substring(0, 10) === key;
                });
                byDay[key] = tasks;
                if (tasks.length > maxInDay) maxInDay = tasks.length;
            });
            tenderRowData[t.id] = { byDay, maxInDay };
        });

        // ── Header: week-groep labels ──
        const weekLabels = weeks.map((weekDays, wi) => {
            return `
                <div class="agenda-mw-week-label" style="grid-column: span 7">
                    <span class="agenda-mw-week-num">Week ${wi + 1}</span>
                </div>
            `;
        }).join('');

        // ── Header: dag kolommen ──
        const dayHeaders = allDays.map((dt, i) => {
            const isToday = dateKey(dt) === todayStr;
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            const isCurrentMonth = dt.getMonth() === currentMonth;
            const isWeekStart = i > 0 && i % 7 === 0;
            return `
                <div class="agenda-mw-day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${!isCurrentMonth ? 'other-month' : ''} ${isWeekStart ? 'week-start' : ''}">
                    <div class="agenda-mw-day-name">${DAYS_SHORT[dt.getDay()]}</div>
                    <div class="agenda-mw-day-num ${isToday ? 'today' : ''}">${dt.getDate()}</div>
                    <div class="agenda-mw-day-month">${MONTHS_NL[dt.getMonth()]}</div>
                </div>
            `;
        }).join('');

        // ── Tender rijen ──
        const totalCols = allDays.length;
        const tenderRows = tendersInMonth.map(t => {
            const rd = tenderRowData[t.id] || { byDay: {}, maxInDay: 0 };
            const rowH = Math.max(rd.maxInDay * 58 + 16, 80);
            const isSelected = this.selectedTenderId === t.id;

            const dayCells = allDays.map((dt, i) => {
                const key = dateKey(dt);
                const tasks = rd.byDay[key] || [];
                const isToday = key === todayStr;
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
                const isCurrentMonth = dt.getMonth() === currentMonth;
                const isWeekStart = i > 0 && i % 7 === 0;

                const taskCards = tasks.map(task => this.renderCompactTaskCard(task, t)).join('');

                return `
                    <div class="agenda-mw-day-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${!isCurrentMonth ? 'other-month' : ''} ${isWeekStart ? 'week-start' : ''}">
                        ${taskCards}
                    </div>
                `;
            }).join('');

            return `
                <div class="agenda-mw-tender-row" style="min-height:${rowH}px">
                    ${this.renderMiniTenderCard(t, isSelected, rowH)}
                    <div class="agenda-mw-days-row">${dayCells}</div>
                </div>
            `;
        }).join('');

        // Lege state
        const emptyRow = tendersInMonth.length === 0
            ? `<div class="agenda-mw-empty">Geen geplande taken deze maand</div>`
            : '';

        return `
            <div class="agenda-mw-container">
                <div class="agenda-mw-scroll">
                    <div class="agenda-mw-grid" style="--mw-cols: ${totalCols}">
                        <div class="agenda-mw-header">
                            <div class="agenda-mw-header-corner" style="width:${CARD_LEFT_W}px; min-width:${CARD_LEFT_W}px">
                                <span>TENDERS</span>
                            </div>
                            <div class="agenda-mw-header-days">
                                <div class="agenda-mw-week-labels">${weekLabels}</div>
                                <div class="agenda-mw-day-headers">${dayHeaders}</div>
                            </div>
                        </div>
                        <div class="agenda-mw-body">
                            ${tenderRows}
                            ${emptyRow}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Render: Compacte Task Card (voor maandview) ──
    renderCompactTaskCard(task, tender) {
        const isDone = task.status === 'done';
        const fm = FASE_META[tender?.fase] || FASE_META.acquisitie;
        const isNietToegewezen = !task.toegewezen_aan || task.toegewezen_aan.length === 0;
        const isDeadlineToday = task.is_milestone && task.datum && task.datum.substring(0, 10) === dateKey(new Date());

        return `
            <div class="agenda-mw-task ${isDone ? 'done' : ''} ${isDeadlineToday ? 'deadline' : ''} ${isNietToegewezen ? 'niet-toegewezen' : ''}"
                 style="border-left-color: ${isDeadlineToday ? '#ef4444' : fm.color}"
                 data-action="open-planning"
                 data-tender-id="${task.tender_id}"
                 data-taak-id="${task.id}"
                 title="${task.taak_naam || ''}">
                <button class="agenda-mw-task-check ${isDone ? 'checked' : ''}"
                        data-action="toggle-status"
                        data-taak-id="${task.id}"
                        data-current-status="${task.status}"
                        data-bron="${task.bron || 'planning'}"
                        title="${isDone ? 'Markeer als open' : 'Markeer als klaar'}">
                    ${isDone ? `<svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </button>
                <span class="agenda-mw-task-name ${isDone ? 'done' : ''}">${task.taak_naam || 'Taak'}</span>
                ${isNietToegewezen ? '<span class="agenda-mw-badge">👤?</span>' : ''}
            </div>
        `;
    }

    // ── Helper: Alle weken van de maand (Ma-Zo) ──
    getMonthWeeks() {
        const year = this.currentMonthDate.getFullYear();
        const month = this.currentMonthDate.getMonth();
        const firstOfMonth = new Date(year, month, 1);
        const lastOfMonth = new Date(year, month + 1, 0);

        // Start bij de maandag vóór of op de 1e
        let cursor = new Date(firstOfMonth);
        const dow = cursor.getDay();
        cursor = addDays(cursor, dow === 0 ? -6 : 1 - dow);

        const weeks = [];
        // Genereer weken totdat we voorbij het einde van de maand zijn
        while (true) {
            const week = Array.from({ length: 7 }, (_, i) => addDays(cursor, i));
            weeks.push(week);
            cursor = addDays(cursor, 7);
            // Stop als de maandag na de laatste dag van de maand valt
            if (cursor.getMonth() !== month && cursor > lastOfMonth) break;
            // Veiligheid: max 6 weken
            if (weeks.length >= 6) break;
        }
        return weeks;
    }

    // ── Render: Week Grid ──
    renderWeekGrid(tenders, days, todayStr) {
        const tenderRowData = {};
        tenders.forEach(t => {
            const byDay = {};
            let maxInDay = 0;
            days.forEach(dt => {
                const key = dateKey(dt);
                const tasks = t.taken.filter(tk => {
                    if (!tk.datum) return false;
                    return tk.datum.substring(0, 10) === key;
                });
                byDay[key] = tasks;
                if (tasks.length > maxInDay) maxInDay = tasks.length;
            });
            tenderRowData[t.id] = { byDay, maxInDay };
        });

        const headerCols = days.map((dt, i) => {
            const isToday = dateKey(dt) === todayStr;
            const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
            return `
                <div class="agenda-day-header ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}"
                     style="flex:1">
                    <div class="agenda-day-header-main">
                        ${DAYS_SHORT[dt.getDay()]} ${dt.getDate()} ${MONTHS_NL[dt.getMonth()]}
                    </div>
                </div>
            `;
        }).join('');

        const tenderRows = tenders.map(t => {
            const rd = tenderRowData[t.id] || { byDay: {}, maxInDay: 0 };
            const rowH = Math.max(rd.maxInDay * 74 + 24, 120);
            const isSelected = this.selectedTenderId === t.id;

            const dayCells = days.map((dt, di) => {
                const key = dateKey(dt);
                const tasks = rd.byDay[key] || [];
                const isToday = key === todayStr;
                const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;

                const taskCards = tasks.map(task => this.renderTaskCard(task, t)).join('');

                return `
                    <div class="agenda-day-cell ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''}"
                         style="flex:1">
                        ${taskCards}
                    </div>
                `;
            }).join('');

            return `
                <div class="agenda-tender-row" style="min-height:${rowH}px">
                    ${this.renderMiniTenderCard(t, isSelected, rowH)}
                    ${dayCells}
                </div>
            `;
        }).join('');

        return `
            <div class="agenda-week-grid">
                <div class="agenda-week-header">
                    <div class="agenda-week-header-label" style="width:${CARD_LEFT_W}px; min-width:${CARD_LEFT_W}px">
                        <span>TENDERS</span>
                    </div>
                    ${headerCols}
                </div>
                <div class="agenda-week-body">
                    ${tenderRows}
                </div>
            </div>
        `;
    }

    // ── Render: Mini Tender Card ──
    renderMiniTenderCard(tender, isSelected, height) {
        const fm = FASE_META[tender.fase] || FASE_META.acquisitie;
        const total = tender.planning_total || tender.taken?.length || 0;
        const done = tender.planning_done || tender.taken?.filter(t => t.status === 'done').length || 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        const teamMap = new Map();
        (tender.taken || []).forEach(t => {
            (t.toegewezen_aan || []).forEach(p => {
                if (p && p.id && !teamMap.has(p.id)) {
                    teamMap.set(p.id, p);
                }
            });
        });
        const teamAvatars = [...teamMap.values()].slice(0, 3);
        const extraCount = teamMap.size > 3 ? teamMap.size - 3 : 0;

        const avatarsHtml = teamAvatars.map((m, i) => {
            const color = m.avatar_kleur || '#6366f1';
            const initials = m.initialen || m.naam?.substring(0, 2).toUpperCase() || '??';
            return `<div class="agenda-mini-avatar" style="background:${color}; z-index:${teamAvatars.length - i}; margin-left:${i > 0 ? '-6px' : '0'}">${initials}</div>`;
        }).join('');

        const extraHtml = extraCount > 0 ? `<div class="agenda-mini-avatar-extra">+${extraCount}</div>` : '';

        const taakCountLabel = this.filterMode === 'mijn'
            ? `<span class="agenda-mini-task-count">${tender.taken.length} ${tender.taken.length === 1 ? 'taak' : 'taken'}</span>`
            : '';

        return `
            <div class="agenda-mini-card ${isSelected ? 'selected' : ''}"
                 data-action="toggle-tender"
                 data-tender-id="${tender.id}"
                 style="width:${CARD_LEFT_W}px; min-width:${CARD_LEFT_W}px; min-height:${height}px; border-left-color:${fm.color}">
                <div class="agenda-mini-card-inner">
                    <div class="agenda-mini-top">
                        <span class="agenda-mini-fase-badge" style="background:${fm.bg}; color:${fm.color}; border-color:${fm.border}">${fm.label}</span>
                        ${taakCountLabel}
                    </div>
                    <div class="agenda-mini-naam">${tender.naam || 'Onbekend'}</div>
                    <div class="agenda-mini-opdrachtgever">
                        <span class="agenda-mini-opdrachtgever-icon">🏛</span>
                        ${tender.opdrachtgever || '-'}
                    </div>
                    <div class="agenda-mini-footer">
                        <div class="agenda-mini-avatars">
                            ${avatarsHtml}
                            ${extraHtml}
                        </div>
                        <div class="agenda-mini-progress">
                            <div class="agenda-mini-progress-label">
                                ${this.getIcon('check', 12, '#94a3b8')}
                                <span>${done}/${total}</span>
                            </div>
                            <div class="agenda-mini-progress-bar">
                                <div class="agenda-mini-progress-fill" style="width:${progress}%; background:${progress === 100 ? '#10b981' : fm.color}"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // ── Render: Task Card ──
    renderTaskCard(task, tender) {
        const isDone = task.status === 'done';
        const fm = FASE_META[tender?.fase] || FASE_META.acquisitie;
        const isNietToegewezen = !task.toegewezen_aan || task.toegewezen_aan.length === 0;

        const today = dateKey(new Date());
        const taskDate = task.datum ? task.datum.substring(0, 10) : '';
        const isDeadlineToday = task.is_milestone && taskDate === today;

        const avatarsHtml = (task.toegewezen_aan || []).slice(0, 3).map(p => {
            const color = p.avatar_kleur || '#6366f1';
            const initials = p.initialen || p.naam?.substring(0, 2).toUpperCase() || '??';
            return `<div class="agenda-task-avatar" style="background:${color}">${initials}</div>`;
        }).join('');

        return `
            <div class="agenda-task-card ${isDone ? 'done' : ''} ${isDeadlineToday ? 'deadline' : ''} ${task.bron === 'checklist' ? 'checklist' : ''} ${isNietToegewezen ? 'niet-toegewezen' : ''}"
                 style="border-left-color: ${isDeadlineToday ? '#ef4444' : fm.color}"
                 data-action="open-planning"
                 data-tender-id="${task.tender_id}"
                 data-taak-id="${task.id}">
                <div class="agenda-task-top">
                    <button class="agenda-task-checkbox ${isDone ? 'checked' : ''}"
                            data-action="toggle-status"
                            data-taak-id="${task.id}"
                            data-current-status="${task.status}"
                            data-bron="${task.bron || 'planning'}"
                            title="${isDone ? 'Markeer als open' : 'Markeer als klaar'}">
                        ${isDone ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                    </button>
                    <div class="agenda-task-name ${isDone ? 'done' : ''}">
                        ${task.is_milestone ? '<span class="agenda-task-flag">🚩</span>' : ''}
                        ${task.taak_naam || 'Onbekende taak'}
                    </div>
                </div>
                ${isNietToegewezen 
                    ? '<div class="agenda-niet-toegewezen-badge-small">👤?</div>'
                    : avatarsHtml ? `<div class="agenda-task-avatars">${avatarsHtml}</div>` : ''
                }
            </div>
        `;
    }

    // ── Event Listeners ──
    // v1.1: Attach only once, remove old listener first
    attachEventListeners() {
        if (!this.container) return;

        // Remove previous listener if exists
        if (this._boundClickHandler) {
            this.container.removeEventListener('click', this._boundClickHandler);
        }

        // Create bound handler
        this._boundClickHandler = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;

            switch (action) {
                case 'prev-week':
                    this.navigateWeek(-1);
                    break;

                case 'next-week':
                    this.navigateWeek(1);
                    break;

                case 'prev-month':
                    this.navigateMonth(-1);
                    break;

                case 'next-month':
                    this.navigateMonth(1);
                    break;

                case 'prev-quarter':
                    this.navigateQuarter(-1);
                    break;

                case 'next-quarter':
                    this.navigateQuarter(1);
                    break;

                case 'today':
                    this.goToday();
                    break;

                case 'viewmode-week':
                    this.setViewMode('week');
                    break;

                case 'viewmode-maand':
                    this.setViewMode('maand');
                    break;

                case 'viewmode-kwartaal':
                    this.setViewMode('kwartaal');
                    break;

                case 'filter-alle':
                    this.setFilterMode('alle');
                    break;

                case 'filter-mijn':
                    this.setFilterMode('mijn');
                    break;

                case 'select-member':
                    this.selectTeamMember(btn.dataset.memberId);
                    break;

                case 'toggle-tender':
                    this.toggleTenderSelection(btn.dataset.tenderId);
                    break;

                case 'toggle-status': {
                    e.stopPropagation();
                    const taakId = btn.dataset.taakId;
                    const currentStatus = btn.dataset.currentStatus;
                    const bron = btn.dataset.bron;
                    if (bron === 'planning') {
                        this.toggleTaakStatus(taakId, currentStatus);
                    }
                    break;
                }

                case 'open-planning': {
                    const tenderId = btn.dataset.tenderId;
                    if (this.onOpenPlanningModal && tenderId) {
                        const tenderData = this.tenders[tenderId];
                        if (tenderData) {
                            this.onOpenPlanningModal(tenderData);
                        }
                    }
                    break;
                }
            }
        };

        this.container.addEventListener('click', this._boundClickHandler);
    }
}