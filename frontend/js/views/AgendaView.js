/**
 * AgendaView — Planning overzicht over alle tenders
 * TenderZen v2.0 — 4 views: Week / Maand / Kwartaal / Jaar
 *
 * Gebaseerd op: Planning_AllViews_20260207_1640.html (mockup)
 * Gids: Implementatie_PlanningViews_20260207_1700.md
 * CSS: AgendaView_20260207_1830.css (agenda- prefix)
 *
 * Bestand: Frontend/js/views/AgendaView.js
 * Datum: 8 februari 2026
 */

import { BaseView } from './BaseView.js';
import { planningService } from '../services/PlanningService.js';

const Icons = window.Icons || {};

// ══════════════════════════════════════════════
// CONSTANTEN
// ══════════════════════════════════════════════

const MONTHS_SHORT = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const MONTHS_FULL  = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];
const DAYS_SHORT   = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const SIDEBAR_W = 240;

/** Fase-kleuren: gradient start, gradient end, accent (uit mockup) */
const FASE_COLORS = {
    acquisitie:     { s: '#d97706', e: '#e5921a', a: '#ea580c' },
    inschrijvingen: { s: '#6d5ccd', e: '#7c6fe0', a: '#7c3aed' },
    ingediend:      { s: '#0d9263', e: '#10b981', a: '#16a34a' },
    evaluatie:      { s: '#0d9488', e: '#14b8a6', a: '#0d9488' },
    archief:        { s: '#475569', e: '#5a6b80', a: '#64748b' },
};

const FASE_LABELS = {
    acquisitie: 'acquisitie',
    inschrijvingen: 'lopend',
    ingediend: 'ingediend',
    evaluatie: 'afronden',
    archief: 'archief',
};

const HEAT_NAMES = ['Rustig', 'Licht', 'Normaal', 'Druk', 'Zeer druk', 'Piek'];

// ══════════════════════════════════════════════
// DATE HELPERS
// ══════════════════════════════════════════════

function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function isoDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(s) {
    const p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
}

/** Maandag van de week waarin `d` valt */
function getMonday(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    return addDays(dt, day === 0 ? -6 : 1 - day);
}

/** ISO weeknummer */
function weekNumber(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil((((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 864e5) + 1) / 7);
}

/** Alle maandagen van weken in maand (y, m) */
function weeksInMonth(y, m) {
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const weeks = [];
    let cursor = getMonday(first);
    while (cursor <= last) {
        weeks.push(new Date(cursor));
        cursor = addDays(cursor, 7);
    }
    return weeks;
}

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


// ══════════════════════════════════════════════
// HEATMAP BEREKENING
// ══════════════════════════════════════════════

function heatLevel(value, maxValue) {
    if (value === 0) return 0;
    const ratio = value / Math.max(maxValue, 1);
    if (ratio <= 0.15) return 1;
    if (ratio <= 0.35) return 2;
    if (ratio <= 0.55) return 3;
    if (ratio <= 0.80) return 4;
    return 5;
}


// ══════════════════════════════════════════════
// AGENDAVIEW CLASS
// ══════════════════════════════════════════════

export class AgendaView extends BaseView {
    constructor(options = {}) {
        super(options);

        // ── State ──
        this.currentView = 'month';  // week | month | quarter | year
        this.offset = 0;             // Navigatie-offset t.o.v. vandaag
        this.filterMode = 'alle';    // alle | mijn
        this.selectedTeamMemberId = null;
        this.selectedTenderId = null;

        // ── Data ──
        this.tenders = [];           // Array van tender objecten (met taken erin)
        this.teamMembers = [];
        this.isLoading = false;

        // ── Event tracking ──
        this._boundClickHandler = null;
        this._boundKeyHandler = null;

        // ── Callbacks (set door App.js) ──
        this.onOpenPlanningModal = null;

        console.log('📅 AgendaView v2.0 constructed');
    }

    // ── Icon helper ──
    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const opts = { size };
            if (color) opts.color = color;
            return Icons[name](opts);
        }
        return '';
    }

    // ── Fase kleur ophalen ──
    fc(fase) {
        return FASE_COLORS[fase] || FASE_COLORS.archief;
    }


    // ══════════════════════════════════════════════
    // DATA LADEN
    // ══════════════════════════════════════════════

    async loadData() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            const { startDate, endDate } = this.getDateRange();
            const teamMemberId = this.filterMode === 'mijn' ? this.selectedTeamMemberId : null;

            console.log(`📅 loadData: ${startDate} → ${endDate}, view=${this.currentView}, offset=${this.offset}`);

            if (typeof planningService.getAgendaData !== 'function') {
                console.error('❌ planningService.getAgendaData is NOT a function');
                this.isLoading = false;
                this.render();
                return;
            }

            const data = await planningService.getAgendaData(startDate, endDate, teamMemberId);

            // Bouw tenders array op vanuit de API response
            this.tenders = this._buildTenderList(data);
            this.teamMembers = data.team_members || [];

            // Auto-select eerste teamlid
            if (!this.selectedTeamMemberId && this.teamMembers.length > 0) {
                this.selectedTeamMemberId = this.teamMembers[0].id;
            }

            console.log(`📅 Loaded: ${this.tenders.length} tenders`);
        } catch (error) {
            console.error('❌ AgendaView loadData error:', error);
            this.tenders = [];
        }

        this.isLoading = false;
        this.render();
    }

    /** Bepaal datum-bereik op basis van huidige view + offset */
    getDateRange() {
        const today = new Date();
        let startDate, endDate;

        switch (this.currentView) {
            case 'year': {
                const yr = today.getFullYear() + this.offset;
                startDate = isoDate(new Date(yr, 0, 1));
                endDate = isoDate(new Date(yr, 11, 31));
                break;
            }
            case 'quarter': {
                const baseQ = Math.floor(today.getMonth() / 3);
                let q = baseQ + this.offset;
                let y = today.getFullYear();
                while (q < 0) { q += 4; y--; }
                while (q > 3) { q -= 4; y++; }
                startDate = isoDate(new Date(y, q * 3, 1));
                endDate = isoDate(new Date(y, q * 3 + 3, 0));
                break;
            }
            case 'month': {
                const base = new Date(today.getFullYear(), today.getMonth() + this.offset, 1);
                const weeks = weeksInMonth(base.getFullYear(), base.getMonth());
                startDate = isoDate(weeks[0]);
                endDate = isoDate(addDays(weeks[weeks.length - 1], 6));
                break;
            }
            case 'week':
            default: {
                const weekStart = addDays(getMonday(today), this.offset * 7);
                startDate = isoDate(weekStart);
                endDate = isoDate(addDays(weekStart, 6));
                break;
            }
        }

        return { startDate, endDate };
    }

    /** Transformeer API data naar bruikbare tender-array */
    _buildTenderList(data) {
        const taken = data.taken || [];
        const tenderMap = data.tenders || {};

        // Groepeer taken per tender
        const tenderIds = [...new Set(taken.map(t => t.tender_id))];

        return tenderIds.map(id => {
            const info = tenderMap[id] || {};
            const tenderTaken = taken.filter(t => t.tender_id === id);

            // Bouw taken-per-datum object
            const tasks = {};
            tenderTaken.forEach(t => {
                if (t.datum) {
                    const key = t.datum.substring(0, 10);
                    if (!tasks[key]) tasks[key] = [];
                    tasks[key].push({
                        id: t.id,
                        n: t.taak_naam || 'Onbekende taak',
                        d: t.status === 'done',
                        u: t.is_milestone || false,
                        bron: t.bron || 'planning',
                        assignees: t.toegewezen_aan || [],
                    });
                }
            });

            // Ongeplande taken
            const ongepland = tenderTaken.filter(t => !t.datum || t.is_ongepland);

            // Tellingen
            const total = tenderTaken.length;
            const done = tenderTaken.filter(t => t.status === 'done').length;
            const nietToegewezen = tenderTaken.filter(t => !t.toegewezen_aan || t.toegewezen_aan.length === 0).length;

            // Deadline urgentie berekenen
            const deadline = info.deadline_indiening || null;
            let deadlineDisplay = '';
            let deadlineUrgency = 'ok';
            if (deadline) {
                const dl = parseDate(deadline);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((dl - today) / 864e5);
                if (diffDays < 0) {
                    deadlineDisplay = `${dl.getDate()} ${MONTHS_SHORT[dl.getMonth()]} · Verlopen`;
                    deadlineUrgency = 'verlopen';
                } else if (diffDays <= 7) {
                    deadlineDisplay = `${dl.getDate()} ${MONTHS_SHORT[dl.getMonth()]} · Nog ${diffDays} dagen`;
                    deadlineUrgency = 'danger';
                } else if (diffDays <= 14) {
                    deadlineDisplay = `${dl.getDate()} ${MONTHS_SHORT[dl.getMonth()]} · Nog ${diffDays} dagen`;
                    deadlineUrgency = 'warn';
                } else {
                    deadlineDisplay = `${dl.getDate()} ${MONTHS_SHORT[dl.getMonth()]} · Nog ${diffDays} dagen`;
                    deadlineUrgency = 'ok';
                }
            }

            // Team avatars (deduplicated)
            const teamMap = new Map();
            tenderTaken.forEach(t => {
                (t.toegewezen_aan || []).forEach(p => {
                    if (p && p.id && !teamMap.has(p.id)) teamMap.set(p.id, p);
                });
            });

            return {
                id,
                naam: info.naam || 'Onbekend',
                organisatie: info.opdrachtgever || '-',
                fase: info.fase || 'archief',
                fase_status: info.fase_status || '',
                ai_pitstop_status: info.ai_pitstop_status || '',
                publicatie_datum: info.publicatie_datum || null,
                deadline,
                deadlineDisplay,
                deadlineUrgency,
                tasks,
                ongepland,
                team: [...teamMap.values()],
                total,
                done,
                nietToegewezen,
            };
        }).sort((a, b) => {
            // Sorteer op fase, dan naam
            const order = { acquisitie: 0, inschrijvingen: 1, ingediend: 2, evaluatie: 3, archief: 4 };
            const fa = order[a.fase] ?? 99;
            const fb = order[b.fase] ?? 99;
            if (fa !== fb) return fa - fb;
            return (a.naam || '').localeCompare(b.naam || '');
        });
    }


    // ══════════════════════════════════════════════
    // MOUNT / UNMOUNT
    // ══════════════════════════════════════════════

    mount(container) {
        super.mount(container);
        this.loadData();
    }

    unmount() {
        this._removeListeners();
        super.unmount();
    }

    _removeListeners() {
        if (this.container && this._boundClickHandler) {
            this.container.removeEventListener('click', this._boundClickHandler);
        }
        if (this._boundKeyHandler) {
            document.removeEventListener('keydown', this._boundKeyHandler);
        }
        this._boundClickHandler = null;
        this._boundKeyHandler = null;
    }


    // ══════════════════════════════════════════════
    // NAVIGATIE
    // ══════════════════════════════════════════════

    navigate(direction) {
        this.offset += direction;
        this.loadData();
    }

    goToday() {
        this.offset = 0;
        this.loadData();
    }

    switchView(view) {
        if (this.currentView === view) return;
        this.currentView = view;
        this.offset = 0;
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
        if (this.filterMode === 'mijn') this.loadData();
    }


    // ══════════════════════════════════════════════
    // COMPUTED — NAVIGATIE LABELS
    // ══════════════════════════════════════════════

    getNavInfo() {
        const today = new Date();

        switch (this.currentView) {
            case 'year': {
                const yr = today.getFullYear() + this.offset;
                return {
                    indicator: `${yr}`,
                    range: `${yr} · Januari – December`,
                };
            }
            case 'quarter': {
                const baseQ = Math.floor(today.getMonth() / 3);
                let q = baseQ + this.offset;
                let y = today.getFullYear();
                while (q < 0) { q += 4; y--; }
                while (q > 3) { q -= 4; y++; }
                const ms = [q * 3, q * 3 + 1, q * 3 + 2];
                return {
                    indicator: `Q${q + 1} ${y}`,
                    range: `Q${q + 1} ${y} · ${MONTHS_FULL[ms[0]]} – ${MONTHS_FULL[ms[2]]}`,
                };
            }
            case 'month': {
                const base = new Date(today.getFullYear(), today.getMonth() + this.offset, 1);
                const weeks = weeksInMonth(base.getFullYear(), base.getMonth());
                return {
                    indicator: `${MONTHS_FULL[base.getMonth()]} ${base.getFullYear()}`,
                    range: `${MONTHS_FULL[base.getMonth()]} ${base.getFullYear()} · ${weeks.length} weken`,
                };
            }
            case 'week':
            default: {
                const weekStart = addDays(getMonday(today), this.offset * 7);
                const weekEnd = addDays(weekStart, 6);
                const wk = weekNumber(weekStart);
                return {
                    indicator: `Week ${wk}`,
                    range: `Week ${wk} · ${weekStart.getDate()} ${MONTHS_SHORT[weekStart.getMonth()]} – ${weekEnd.getDate()} ${MONTHS_SHORT[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`,
                };
            }
        }
    }

    /** Tel taken + deadlines in een datumbereik (voor heatmap) */
    countActivityInRange(startD, endD) {
        let tasks = 0, deadlines = 0;
        this.tenders.forEach(t => {
            Object.keys(t.tasks).forEach(ds => {
                const d = parseDate(ds);
                if (d >= startD && d <= endD) tasks += t.tasks[ds].length;
            });
            if (t.deadline) {
                const d = parseDate(t.deadline);
                if (d >= startD && d <= endD) deadlines++;
            }
        });
        return { tasks, deadlines, activity: tasks + deadlines * 2 };
    }


    // ══════════════════════════════════════════════
    // STATS
    // ══════════════════════════════════════════════

    getStats() {
        let total = 0, done = 0, ongepland = 0, nietToegewezen = 0;
        this.tenders.forEach(t => {
            total += t.total;
            done += t.done;
            ongepland += t.ongepland.length;
            nietToegewezen += t.nietToegewezen;
        });
        return { total, done, open: total - done, ongepland, nietToegewezen, tenderCount: this.tenders.length };
    }


    // ══════════════════════════════════════════════
    // RENDER — HOOFD
    // ══════════════════════════════════════════════

    render() {
        if (!this.container) return;

        const stats = this.getStats();
        const navInfo = this.getNavInfo();

        // Ongeplande taken (alle views)
        const ongeplandeTenders = this.tenders.filter(t => t.ongepland.length > 0);

        this.container.innerHTML = `
            <div class="agenda-view">
                ${this.renderAgendaHeader(navInfo)}
                ${this.renderFilterBar(stats)}
                <div class="agenda-planning-container">
                    ${this.isLoading
                        ? this.renderLoading()
                        : this.tenders.length === 0
                            ? this.renderEmpty()
                            : this.renderMainContent()
                    }
                </div>
                ${!this.isLoading ? this.renderLegend() : ''}
                ${!this.isLoading && ongeplandeTenders.length > 0 ? this.renderOngepland(ongeplandeTenders) : ''}
                ${!this.isLoading && stats.nietToegewezen > 0 ? this.renderWarningBanner(stats.nietToegewezen) : ''}
            </div>
        `;

        this._attachListeners();
    }

    renderMainContent() {
        return `
            ${this.renderStickyHeader()}
            <div class="agenda-cards-list">
                ${this.tenders.map(t => this.renderTenderCard(t)).join('')}
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — AGENDA HEADER
    // ══════════════════════════════════════════════

    renderAgendaHeader(navInfo) {
        return `
            <div class="agenda-header">
                <div class="agenda-header-left">
                    <div class="agenda-header-icon">📅</div>
                    <div>
                        <div class="agenda-header-title">Agenda</div>
                        <div class="agenda-header-range">${navInfo.range}</div>
                    </div>
                </div>
                <div class="agenda-header-right">
                    <div class="agenda-period-switch">
                        ${['week', 'month', 'quarter', 'year'].map(v => `
                            <button class="agenda-period-btn ${this.currentView === v ? 'active' : ''}"
                                    data-action="switch-view" data-view="${v}">
                                ${{ week: 'Week', month: 'Maand', quarter: 'Kwartaal', year: 'Jaar' }[v]}
                            </button>
                        `).join('')}
                    </div>
                    <button class="agenda-arrow-btn" data-action="nav-prev" title="Vorige">‹</button>
                    <span class="agenda-nav-indicator">${navInfo.indicator}</span>
                    <button class="agenda-arrow-btn" data-action="nav-next" title="Volgende">›</button>
                    <button class="agenda-today-btn" data-action="go-today">Vandaag</button>
                </div>
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — FILTER BAR
    // ══════════════════════════════════════════════

    renderFilterBar(stats) {
        const teamChips = this.filterMode === 'mijn' && this.teamMembers.length > 0
            ? `<span class="agenda-filter-sep"></span>
               <div class="agenda-team-selector">
                   Bekijk als:
                   ${this.teamMembers.map(m => {
                       const sel = m.id === this.selectedTeamMemberId;
                       const color = m.avatar_kleur || '#6366f1';
                       const initials = m.initialen || m.naam?.substring(0, 2).toUpperCase() || '??';
                       return `<span class="agenda-avatar-xs ${sel ? 'selected' : ''}"
                                     style="background:${color}"
                                     data-action="select-member"
                                     data-member-id="${m.id}">${initials}</span>`;
                   }).join(' ')}
               </div>`
            : '';

        return `
            <div class="agenda-filter-bar">
                <div class="agenda-filter-group">
                    <button class="agenda-filter-btn ${this.filterMode === 'alle' ? 'active' : ''}" data-action="filter-alle">👥 Alle taken</button>
                    <button class="agenda-filter-btn ${this.filterMode === 'mijn' ? 'active' : ''}" data-action="filter-mijn">👤 Mijn taken</button>
                </div>
                ${teamChips}
                <div class="agenda-stats">
                    <span class="agenda-stat"><span class="agenda-stat-dot" style="background:#667eea"></span> ${stats.total} totaal</span>
                    <span class="agenda-stat"><span class="agenda-stat-dot" style="background:#ea580c"></span> ${stats.open} open</span>
                    <span class="agenda-stat"><span class="agenda-stat-dot" style="background:#16a34a"></span> ${stats.done} klaar</span>
                </div>
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — STICKY HEADER (3 lagen + heatmap)
    // ══════════════════════════════════════════════

    renderStickyHeader() {
        const today = new Date();
        let topLabel, subsHtml, heatmapHtml, subsColumns, heatColumns;

        switch (this.currentView) {
            case 'year': {
                const yr = today.getFullYear() + this.offset;
                const cm = yr === today.getFullYear() ? today.getMonth() : -1;
                const cq = cm >= 0 ? Math.floor(cm / 3) : -1;
                topLabel = `${yr}`;
                subsColumns = 'repeat(4, 1fr)';
                subsHtml = [0, 1, 2, 3].map(q =>
                    `<div class="agenda-sh-sub ${q === cq ? 'current' : ''}">Q${q + 1}</div>`
                ).join('');
                // Heatmap: 12 maanden
                const mAct = [];
                for (let mi = 0; mi < 12; mi++) {
                    mAct.push(this.countActivityInRange(new Date(yr, mi, 1), new Date(yr, mi + 1, 0)));
                }
                const mxA = Math.max(...mAct.map(a => a.activity), 1);
                heatColumns = 'repeat(12, 1fr)';
                heatmapHtml = mAct.map((a, mi) => {
                    const hl = heatLevel(a.activity, mxA);
                    return `<div class="agenda-heat-cell agenda-heat-${hl}" data-tip="${MONTHS_SHORT[mi]}: ${a.tasks} taken, ${a.deadlines} deadlines · ${HEAT_NAMES[hl]}">${a.tasks || ''}</div>`;
                }).join('');
                break;
            }

            case 'quarter': {
                const baseQ = Math.floor(today.getMonth() / 3);
                let q = baseQ + this.offset;
                let y = today.getFullYear();
                while (q < 0) { q += 4; y--; }
                while (q > 3) { q -= 4; y++; }
                const ms = [q * 3, q * 3 + 1, q * 3 + 2];
                topLabel = `${y}`;
                subsColumns = '1fr';
                subsHtml = `<div class="agenda-sh-sub current">Q${q + 1} · ${MONTHS_FULL[ms[0]]} – ${MONTHS_FULL[ms[2]]}</div>`;
                // Heatmap: 3 maanden
                const mAct = ms.map(mi => this.countActivityInRange(new Date(y, mi, 1), new Date(y, mi + 1, 0)));
                const mxA = Math.max(...mAct.map(a => a.activity), 1);
                heatColumns = 'repeat(3, 1fr)';
                heatmapHtml = mAct.map((a, i) => {
                    const hl = heatLevel(a.activity, mxA);
                    return `<div class="agenda-heat-cell agenda-heat-${hl}" data-tip="${MONTHS_FULL[ms[i]]}: ${a.tasks} taken, ${a.deadlines} deadlines · ${HEAT_NAMES[hl]}">${a.tasks || ''}</div>`;
                }).join('');
                break;
            }

            case 'month': {
                const base = new Date(today.getFullYear(), today.getMonth() + this.offset, 1);
                const yr = base.getFullYear();
                const mo = base.getMonth();
                const weeks = weeksInMonth(yr, mo);
                topLabel = `${yr}`;
                subsColumns = '1fr';
                subsHtml = `<div class="agenda-sh-sub current">${MONTHS_FULL[mo]}</div>`;
                // Heatmap: per week
                const wAct = weeks.map(mon => this.countActivityInRange(mon, addDays(mon, 6)));
                const mxA = Math.max(...wAct.map(a => a.activity), 1);
                heatColumns = `repeat(${weeks.length}, 1fr)`;
                heatmapHtml = wAct.map((a, i) => {
                    const hl = heatLevel(a.activity, mxA);
                    return `<div class="agenda-heat-cell agenda-heat-${hl}" data-tip="W${weekNumber(weeks[i])}: ${a.tasks} taken, ${a.deadlines} deadlines · ${HEAT_NAMES[hl]}">${a.tasks || ''}</div>`;
                }).join('');
                break;
            }

            case 'week':
            default: {
                const weekStart = addDays(getMonday(today), this.offset * 7);
                const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                const yr = weekStart.getFullYear();
                const wk = weekNumber(weekStart);
                topLabel = `${yr}`;
                subsColumns = '1fr';
                subsHtml = `<div class="agenda-sh-sub current">Week ${wk} · ${MONTHS_FULL[weekStart.getMonth()]}</div>`;
                // Heatmap: per dag
                const dAct = days.map(d => this.countActivityInRange(d, d));
                const mxA = Math.max(...dAct.map(a => a.activity), 1);
                heatColumns = 'repeat(7, 1fr)';
                heatmapHtml = dAct.map((a, i) => {
                    const hl = heatLevel(a.activity, mxA);
                    return `<div class="agenda-heat-cell agenda-heat-${hl}" data-tip="${DAYS_SHORT[i]} ${days[i].getDate()} ${MONTHS_SHORT[days[i].getMonth()]}: ${a.tasks} taken · ${HEAT_NAMES[hl]}">${a.tasks || ''}</div>`;
                }).join('');
                break;
            }
        }

        return `
            <div class="agenda-sticky-header" style="grid-template-columns: ${SIDEBAR_W}px 1fr; grid-template-rows: auto auto auto">
                <div class="agenda-sh-corner" style="grid-row: 1 / 4">Tenders</div>
                <div class="agenda-sh-top">${topLabel}</div>
                <div class="agenda-sh-subs" style="grid-template-columns: ${subsColumns}">${subsHtml}</div>
                <div class="agenda-heatmap" style="grid-template-columns: ${heatColumns}">${heatmapHtml}</div>
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — TENDER CARD (alle views)
    // ══════════════════════════════════════════════

    renderTenderCard(tender) {
        const fc = this.fc(tender.fase);

        // Color bar: sidebar-kant + tijdlijn-kolom-headers
        const barSide = this._renderBarSide(tender, fc);
        const barCols = this._renderBarCols(tender, fc);

        // Body: sidebar + tijdlijn
        const sidebar = this._renderSidebar(tender, fc);
        const timeline = this._renderTimeline(tender, fc);

        // Grid template afhankelijk van view
        const bodyGrid = this.currentView === 'quarter'
            ? `${SIDEBAR_W}px repeat(3, 1fr)`
            : `${SIDEBAR_W}px 1fr`;

        const barGrid = this.currentView === 'quarter'
            ? `${SIDEBAR_W}px repeat(3, 1fr)`
            : `${SIDEBAR_W}px 1fr`;

        return `
            <div class="agenda-tender-card" data-tender-id="${tender.id}">
                <div class="agenda-card-bar" style="background: linear-gradient(135deg, ${fc.s}, ${fc.e}); grid-template-columns: ${barGrid}">
                    ${barSide}
                    ${barCols}
                </div>
                <div class="agenda-card-body" style="grid-template-columns: ${bodyGrid}">
                    ${sidebar}
                    ${timeline}
                </div>
            </div>
        `;
    }

    /** Color bar — linker deel: fase pill + AI badge + iconen */
    _renderBarSide(tender, fc) {
        const faseLabel = FASE_LABELS[tender.fase] || tender.fase;
        const aiText = tender.ai_pitstop_status === 'ai_pro' ? '✦ AI Pro'
            : tender.ai_pitstop_status ? '✂ AI'
            : '';

        return `
            <div class="agenda-bar-side">
                <span class="agenda-fase-pill">${escapeHtml(tender.fase_status || faseLabel)} <span class="agenda-pill-arrow">▾</span></span>
                ${aiText ? `<span class="agenda-ai-badge">${aiText}</span>` : ''}
                <span class="agenda-bar-icons">
                    <button class="agenda-bar-icon-btn" data-action="open-planning" data-tender-id="${tender.id}">📄</button>
                    <button class="agenda-bar-icon-btn">⚙</button>
                </span>
            </div>
        `;
    }

    /** Color bar — rechter deel: kolom-headers (view-afhankelijk) */
    _renderBarCols(tender, fc) {
        const today = new Date();

        switch (this.currentView) {
            case 'year': {
                const yr = today.getFullYear() + this.offset;
                const cm = yr === today.getFullYear() ? today.getMonth() : -1;
                return `
                    <div class="agenda-bar-cols" style="grid-template-columns: repeat(12, 1fr)">
                        ${MONTHS_SHORT.map((m, i) => `<div class="agenda-col-header ${i === cm ? 'cm' : ''}">${m}</div>`).join('')}
                    </div>
                `;
            }

            case 'quarter': {
                const baseQ = Math.floor(today.getMonth() / 3);
                let q = baseQ + this.offset;
                let y = today.getFullYear();
                while (q < 0) { q += 4; y--; }
                while (q > 3) { q -= 4; y++; }
                const ms = [q * 3, q * 3 + 1, q * 3 + 2];
                const todayMonday = isoDate(getMonday(today));

                return ms.map(mi => {
                    const weeks = weeksInMonth(y, mi);
                    return `
                        <div class="agenda-bar-cols" style="grid-template-columns: repeat(${weeks.length}, 1fr); border-right: 1px solid rgba(255,255,255,.2)">
                            ${weeks.map(mon => {
                                const isCW = isoDate(mon) === todayMonday;
                                return `<div class="agenda-col-header ${isCW ? 'cw' : ''}">W${weekNumber(mon)}</div>`;
                            }).join('')}
                        </div>
                    `;
                }).join('');
            }

            case 'month': {
                const base = new Date(today.getFullYear(), today.getMonth() + this.offset, 1);
                const weeks = weeksInMonth(base.getFullYear(), base.getMonth());
                const todayMonday = isoDate(getMonday(today));

                return `
                    <div class="agenda-bar-cols" style="grid-template-columns: repeat(${weeks.length}, 1fr)">
                        ${weeks.map(mon => {
                            const isCW = isoDate(mon) === todayMonday;
                            return `<div class="agenda-col-header ${isCW ? 'cw' : ''}">W${weekNumber(mon)}</div>`;
                        }).join('')}
                    </div>
                `;
            }

            case 'week':
            default: {
                const weekStart = addDays(getMonday(today), this.offset * 7);
                const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
                const todayStr = isoDate(today);

                return `
                    <div class="agenda-bar-cols" style="grid-template-columns: repeat(7, 1fr)">
                        ${days.map((d, i) => {
                            const isToday = isoDate(d) === todayStr;
                            return `<div class="agenda-col-header ${isToday ? 'cd' : ''}">${DAYS_SHORT[i]} ${d.getDate()}</div>`;
                        }).join('')}
                    </div>
                `;
            }
        }
    }

    /** Sidebar — tender info (naam, org, deadline, avatars, voortgang) */
    _renderSidebar(tender, fc) {
        const orgSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>`;

        const avatarsHtml = tender.team.slice(0, 4).map((m, i) => {
            const color = m.avatar_kleur || '#6366f1';
            const initials = m.initialen || m.naam?.substring(0, 2).toUpperCase() || '??';
            return `<span class="agenda-sidebar-avatar" style="background:${color}">${initials}</span>`;
        }).join('');

        const progress = tender.total > 0 ? Math.round((tender.done / tender.total) * 100) : 0;

        return `
            <div class="agenda-sidebar">
                <div class="agenda-sidebar-name">${escapeHtml(tender.naam)}</div>
                <div class="agenda-sidebar-org">${orgSvg} ${escapeHtml(tender.organisatie)}</div>
                ${tender.deadline
                    ? `<span class="agenda-deadline-badge ${tender.deadlineUrgency}">⏰ ${escapeHtml(tender.deadlineDisplay)}</span>`
                    : ''}
                <div class="agenda-sidebar-footer">
                    <div class="agenda-sidebar-avatars">${avatarsHtml}</div>
                    <div class="agenda-sidebar-progress">
                        ✓ ${tender.done}/${tender.total}
                        <div class="agenda-progress-bar">
                            <div class="agenda-progress-fill" style="width:${progress}%; background:${fc.a}"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — TIMELINE (view-specifiek)
    // ══════════════════════════════════════════════

    _renderTimeline(tender, fc) {
        switch (this.currentView) {
            case 'year':    return this._renderTimelineYear(tender, fc);
            case 'quarter': return this._renderTimelineQuarter(tender, fc);
            case 'month':   return this._renderTimelineMonth(tender, fc);
            case 'week':
            default:        return this._renderTimelineWeek(tender, fc);
        }
    }

    // ── JAAR VIEW — Gantt + density pips ──
    _renderTimelineYear(tender, fc) {
        const today = new Date();
        const yr = today.getFullYear() + this.offset;
        const cm = yr === today.getFullYear() ? today.getMonth() : -1;
        const yrS = new Date(yr, 0, 1);
        const yrE = new Date(yr, 11, 31);
        const totalD = (yrE - yrS) / 864e5 + 1;

        let overlays = '';

        // Gantt bar
        if (tender.publicatie_datum && tender.deadline) {
            const pub = parseDate(tender.publicatie_datum);
            const dl = parseDate(tender.deadline);
            const bS = pub < yrS ? yrS : pub;
            const bE = dl > yrE ? yrE : dl;
            if (bS <= yrE && bE >= yrS) {
                const l = Math.max(0, (bS - yrS) / 864e5) / totalD * 100;
                const w = Math.min(totalD, (bE - yrS) / 864e5 + 1) / totalD * 100 - l;
                overlays += `<div class="agenda-gantt-bar" style="left:${l}%;width:${Math.max(w, 1)}%;background:${fc.a}25;border:1px solid ${fc.a}44;grid-column:1/-1"></div>`;
            }
        }

        // Deadline flag
        if (tender.deadline) {
            const dl = parseDate(tender.deadline);
            if (dl >= yrS && dl <= yrE) {
                const p = (dl - yrS) / 864e5 / totalD * 100;
                overlays += `<div class="agenda-deadline-flag" style="left:${p}%;background:#dc2626;color:#dc2626;grid-column:1/-1"></div>`;
            }
        }

        // Today line
        if (yr === today.getFullYear()) {
            const tp = (today - yrS) / 864e5 / totalD * 100;
            overlays += `<div class="agenda-today-line" style="left:${tp}%;grid-column:1/-1"><div class="agenda-today-pip"></div></div>`;
        }

        // Maand cellen met density pips
        let monthCells = '';
        for (let mi = 0; mi < 12; mi++) {
            const isCM = mi === cm;
            const isQsep = mi % 3 === 2;

            // Verzamel taken in deze maand
            const mTasks = [];
            Object.keys(tender.tasks).forEach(ds => {
                const d = parseDate(ds);
                if (d.getFullYear() === yr && d.getMonth() === mi) {
                    tender.tasks[ds].forEach(tk => mTasks.push(tk));
                }
            });

            let densityHtml = '';
            if (mTasks.length > 0) {
                const pips = mTasks.slice(0, 6).map(tk =>
                    `<div class="agenda-density-pip ${tk.d ? 'done' : ''}" style="background:${tk.u ? '#dc2626' : fc.a}"></div>`
                ).join('');
                const more = mTasks.length > 6 ? `<div class="agenda-density-more">+${mTasks.length - 6}</div>` : '';
                densityHtml = `<div class="agenda-task-density">${pips}${more}</div>`;
            }

            monthCells += `<div class="agenda-tl-cell ${isCM ? 'cur' : ''} ${isQsep ? 'qsep' : ''}">${densityHtml}</div>`;
        }

        return `
            <div class="agenda-timeline-area" style="grid-template-columns: repeat(12, 1fr)">
                ${overlays}
                ${monthCells}
            </div>
        `;
    }

    // ── KWARTAAL VIEW — Dots per week per maand ──
    _renderTimelineQuarter(tender, fc) {
        const today = new Date();
        const baseQ = Math.floor(today.getMonth() / 3);
        let q = baseQ + this.offset;
        let y = today.getFullYear();
        while (q < 0) { q += 4; y--; }
        while (q > 3) { q -= 4; y++; }
        const ms = [q * 3, q * 3 + 1, q * 3 + 2];
        const todayMonday = isoDate(getMonday(today));
        const todayStr = isoDate(today);

        return ms.map(mi => {
            const weeks = weeksInMonth(y, mi);
            const isCM = y === today.getFullYear() && mi === today.getMonth();
            const mS = new Date(y, mi, 1);
            const mE = new Date(y, mi + 1, 0);
            const totalD = (mE - mS) / 864e5 + 1;

            let overlays = '';

            // Gantt bar (per maand)
            if (tender.publicatie_datum && tender.deadline) {
                const pub = parseDate(tender.publicatie_datum);
                const dl = parseDate(tender.deadline);
                const bS = pub < mS ? mS : pub;
                const bE = dl > mE ? mE : dl;
                if (bS <= mE && bE >= mS) {
                    const l = Math.max(0, (bS - mS) / 864e5) / totalD * 100;
                    const w = Math.min(totalD, (bE - mS) / 864e5 + 1) / totalD * 100 - l;
                    overlays += `<div class="agenda-gantt-bar" style="left:${l}%;width:${Math.max(w, 2)}%;background:${fc.a}25;border:1px solid ${fc.a}44;grid-column:1/-1"></div>`;
                }
            }

            // Deadline flag
            if (tender.deadline) {
                const dl = parseDate(tender.deadline);
                if (dl >= mS && dl <= mE) {
                    const p = (dl - mS) / 864e5 / totalD * 100;
                    overlays += `<div class="agenda-deadline-flag" style="left:${p}%;background:#dc2626;color:#dc2626;grid-column:1/-1"></div>`;
                }
            }

            // Week cellen met task dots
            let weekCells = '';
            weeks.forEach(mon => {
                const isCW = isoDate(mon) === todayMonday;
                let cellContent = '';

                // Today line
                if (isCW) {
                    const dow = (today.getDay() + 6) % 7;
                    const pct = (dow + 0.5) / 7 * 100;
                    cellContent += `<div class="agenda-today-line" style="left:${pct}%"><div class="agenda-today-pip"></div></div>`;
                }

                // Task dots
                let dotIdx = 0;
                for (let d = 0; d < 7; d++) {
                    const day = addDays(mon, d);
                    const key = isoDate(day);
                    const dTasks = tender.tasks[key] || [];
                    dTasks.forEach(tk => {
                        const lp = (d + 0.5) / 7 * 100;
                        const bp = 6 + dotIdx * 11;
                        cellContent += `<div class="agenda-task-dot ${tk.d ? 'done' : ''}" data-tip="${escapeHtml(tk.n)}" style="left:calc(${lp}% - 3.5px);bottom:${bp}px;background:${tk.u ? '#dc2626' : fc.a}"></div>`;
                        dotIdx++;
                    });
                }

                weekCells += `<div style="border-right:1px solid #f0f2f5;position:relative${isCW ? ';background:rgba(102,126,234,.04)' : ''}">${cellContent}</div>`;
            });

            return `
                <div class="agenda-tl-cell ${isCM ? 'cur' : ''}" style="min-height:52px;overflow:visible">
                    <div style="display:grid;grid-template-columns:repeat(${weeks.length},1fr);height:100%;position:relative">
                        ${overlays}
                        ${weekCells}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ── MAAND VIEW — Task pills per weekkolom ──
    _renderTimelineMonth(tender, fc) {
        const today = new Date();
        const base = new Date(today.getFullYear(), today.getMonth() + this.offset, 1);
        const yr = base.getFullYear();
        const mo = base.getMonth();
        const weeks = weeksInMonth(yr, mo);
        const todayMonday = isoDate(getMonday(today));
        const mS = new Date(yr, mo, 1);
        const mE = new Date(yr, mo + 1, 0);
        const totalD = (mE - mS) / 864e5 + 1;

        let overlays = '';

        // Gantt bar
        if (tender.publicatie_datum && tender.deadline) {
            const pub = parseDate(tender.publicatie_datum);
            const dl = parseDate(tender.deadline);
            const bS = pub < mS ? mS : pub;
            const bE = dl > mE ? mE : dl;
            if (bS <= mE && bE >= mS) {
                const l = Math.max(0, (bS - mS) / 864e5) / totalD * 100;
                const w = Math.min(totalD, (bE - mS) / 864e5 + 1) / totalD * 100 - l;
                overlays += `<div class="agenda-gantt-bar" style="left:${l}%;width:${Math.max(w, 2)}%;background:${fc.a}25;border:1px solid ${fc.a}44;grid-column:1/-1"></div>`;
            }
        }

        // Deadline flag
        if (tender.deadline) {
            const dl = parseDate(tender.deadline);
            if (dl >= mS && dl <= mE) {
                const p = (dl - mS) / 864e5 / totalD * 100;
                overlays += `<div class="agenda-deadline-flag" style="left:${p}%;background:#dc2626;color:#dc2626;grid-column:1/-1"></div>`;
            }
        }

        // Week cellen met task pills
        let weekCells = '';
        weeks.forEach(mon => {
            const isCW = isoDate(mon) === todayMonday;
            let cellContent = '';

            // Today line
            if (isCW) {
                const dow = (today.getDay() + 6) % 7;
                const pct = (dow + 0.5) / 7 * 100;
                cellContent += `<div class="agenda-today-line" style="left:${pct}%"><div class="agenda-today-pip"></div></div>`;
            }

            // Task pills voor alle dagen in deze week
            for (let d = 0; d < 7; d++) {
                const day = addDays(mon, d);
                const key = isoDate(day);
                const dTasks = tender.tasks[key] || [];
                dTasks.forEach(tk => {
                    cellContent += `<div class="agenda-month-task ${tk.d ? 'done' : ''} ${tk.u ? 'urgent' : ''}" style="--tc:${fc.a}" title="${escapeHtml(tk.n)}">${escapeHtml(tk.n)}</div>`;
                });
            }

            weekCells += `<div class="agenda-tl-cell ${isCW ? 'cur' : ''}" style="padding:3px 2px;display:flex;flex-direction:column;gap:2px">${cellContent}</div>`;
        });

        return `
            <div class="agenda-timeline-area" style="grid-template-columns: repeat(${weeks.length}, 1fr)">
                ${overlays}
                ${weekCells}
            </div>
        `;
    }

    // ── WEEK VIEW — Volledige taakkaarten per dagkolom ──
    _renderTimelineWeek(tender, fc) {
        const today = new Date();
        const weekStart = addDays(getMonday(today), this.offset * 7);
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        const todayStr = isoDate(today);

        let dayCells = '';
        days.forEach((d, i) => {
            const key = isoDate(d);
            const isToday = key === todayStr;
            const dTasks = tender.tasks[key] || [];

            let cellContent = '';

            // Today line
            if (isToday) {
                cellContent += `<div class="agenda-today-line" style="left:50%"><div class="agenda-today-pip"></div></div>`;
            }

            // Deadline marker
            if (tender.deadline && tender.deadline === key) {
                cellContent += `<div class="agenda-deadline-flag" style="left:50%;background:#dc2626;color:#dc2626"></div>`;
            }

            // Taakkaarten
            dTasks.forEach(tk => {
                cellContent += `<div class="agenda-week-task ${tk.d ? 'done' : ''} ${tk.u ? 'urgent' : ''}" style="--tc:${fc.a}"
                                     data-action="open-planning" data-tender-id="${tender.id}" data-taak-id="${tk.id}">
                    ${escapeHtml(tk.n)}
                </div>`;
            });

            dayCells += `<div class="agenda-week-cell ${isToday ? 'cur' : ''}">${cellContent}</div>`;
        });

        return `
            <div style="display:grid;grid-template-columns:repeat(7,1fr);min-height:52px">
                ${dayCells}
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — LEGEND
    // ══════════════════════════════════════════════

    renderLegend() {
        const legends = {
            year: `
                <span class="agenda-legend-item"><span style="width:5px;height:5px;border-radius:50%;background:#667eea"></span> Taak open</span>
                <span class="agenda-legend-item"><span style="width:5px;height:5px;border-radius:50%;background:#16a34a;opacity:.35"></span> Afgerond</span>
                <span class="agenda-legend-item"><span style="width:5px;height:5px;border-radius:50%;background:#dc2626"></span> Urgent</span>
                <span class="agenda-legend-item"><span style="width:16px;height:2px;border-radius:1px;background:#667eea"></span> Vandaag</span>
                <span class="agenda-legend-item"><span style="width:24px;height:10px;border-radius:3px;background:var(--lopend-accent,#7c3aed);opacity:.15;border:1px solid var(--lopend-accent,#7c3aed)"></span> Looptijd</span>
                <span class="agenda-legend-item"><span style="color:#dc2626;font-size:10px">⚑</span> Deadline</span>
            `,
            quarter: `
                <span class="agenda-legend-item"><span style="width:7px;height:7px;border-radius:50%;background:#667eea"></span> Taak open</span>
                <span class="agenda-legend-item"><span style="width:7px;height:7px;border-radius:50%;background:#16a34a;opacity:.4"></span> Afgerond</span>
                <span class="agenda-legend-item"><span style="width:7px;height:7px;border-radius:50%;background:#dc2626"></span> Urgent</span>
                <span class="agenda-legend-item"><span style="width:16px;height:2px;border-radius:1px;background:#667eea"></span> Vandaag</span>
                <span class="agenda-legend-item"><span style="width:24px;height:10px;border-radius:3px;background:var(--lopend-accent,#7c3aed);opacity:.15;border:1px solid var(--lopend-accent,#7c3aed)"></span> Looptijd</span>
                <span class="agenda-legend-item"><span style="color:#dc2626;font-size:10px">⚑</span> Deadline</span>
            `,
            month: `
                <span class="agenda-legend-item"><span style="width:16px;height:8px;border-radius:3px;border-left:2px solid #667eea;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.1)"></span> Taak open</span>
                <span class="agenda-legend-item"><span style="width:16px;height:8px;border-radius:3px;border-left:2px solid #16a34a;background:#fff;opacity:.45"></span> Afgerond</span>
                <span class="agenda-legend-item"><span style="width:16px;height:8px;border-radius:3px;border-left:2px solid #dc2626;background:#fef2f2"></span> Urgent</span>
                <span class="agenda-legend-item"><span style="width:16px;height:2px;border-radius:1px;background:#667eea"></span> Vandaag</span>
                <span class="agenda-legend-item"><span style="color:#dc2626;font-size:10px">⚑</span> Deadline</span>
            `,
            week: `
                <span class="agenda-legend-item"><span style="width:20px;height:12px;border-radius:4px;border-left:3px solid #667eea;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.1)"></span> Taak open</span>
                <span class="agenda-legend-item"><span style="width:20px;height:12px;border-radius:4px;border-left:3px solid #16a34a;background:#fff;opacity:.5"></span> Afgerond</span>
                <span class="agenda-legend-item"><span style="width:20px;height:12px;border-radius:4px;border-left:3px solid #dc2626;background:#fef2f2"></span> Urgent</span>
                <span class="agenda-legend-item"><span style="width:16px;height:2px;border-radius:1px;background:#667eea"></span> Vandaag</span>
                <span class="agenda-legend-item"><span style="color:#dc2626;font-size:10px">⚑</span> Deadline</span>
            `,
        };

        return `<div class="agenda-legend">${legends[this.currentView] || legends.month}</div>`;
    }


    // ══════════════════════════════════════════════
    // RENDER — ONGEPLAND SECTIE
    // ══════════════════════════════════════════════

    renderOngepland(tenders) {
        const totalOngepland = tenders.reduce((s, t) => s + t.ongepland.length, 0);

        const groups = tenders.map(t => {
            const fc = this.fc(t.fase);
            const faseLabel = (FASE_LABELS[t.fase] || t.fase).toUpperCase();

            const tasks = t.ongepland.map(tk => {
                const isDone = tk.status === 'done';
                const bron = tk.bron || 'planning';
                return `
                    <div class="agenda-ongepland-task" style="--tc:${fc.a}"
                         data-action="open-planning" data-tender-id="${t.id}" data-taak-id="${tk.id}">
                        <span class="agenda-task-cb ${isDone ? 'done' : ''}"
                              data-action="toggle-status" data-taak-id="${tk.id}"
                              data-current-status="${tk.status}" data-bron="${bron}"></span>
                        <div class="agenda-task-body">
                            <div class="agenda-task-name ${isDone ? 'done' : ''}">${escapeHtml(tk.taak_naam || 'Onbekende taak')}</div>
                            <div class="agenda-task-meta">
                                <span class="agenda-task-type ${bron === 'checklist' ? 'checklist' : 'planning'}">${bron === 'checklist' ? 'CHECKLIST' : 'PLANNING'}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="agenda-ongepland-group">
                    <div class="agenda-ongepland-group-header" style="background:linear-gradient(135deg,${fc.s},${fc.e})">
                        ${faseLabel} · ${escapeHtml(t.naam)}
                        <span class="agenda-ongepland-group-count">${t.ongepland.length} taken</span>
                    </div>
                    <div class="agenda-ongepland-tasks">${tasks}</div>
                </div>
            `;
        }).join('');

        return `
            <div class="agenda-ongepland">
                <div class="agenda-ongepland-bar">
                    <span class="agenda-ongepland-icon">📋</span>
                    <span class="agenda-ongepland-title">Ongepland</span>
                    <span class="agenda-ongepland-badge">${totalOngepland} taken zonder datum</span>
                </div>
                ${groups}
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — WARNING BANNER
    // ══════════════════════════════════════════════

    renderWarningBanner(count) {
        return `
            <div class="agenda-warning-banner">
                ⚠️&nbsp; <strong>${count} taken zonder toewijzing</strong>
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // RENDER — LOADING + EMPTY
    // ══════════════════════════════════════════════

    renderLoading() {
        return `
            <div class="agenda-loading">
                <div class="agenda-loading-spinner"></div>
                <span>Agenda laden...</span>
            </div>
        `;
    }

    renderEmpty() {
        const periodLabel = {
            week: 'deze week',
            month: 'deze maand',
            quarter: 'dit kwartaal',
            year: 'dit jaar',
        }[this.currentView] || 'deze periode';

        return `
            <div class="agenda-empty-state">
                <div class="agenda-empty-icon">📅</div>
                <div class="agenda-empty-title">Geen taken gevonden</div>
                <div class="agenda-empty-sub">Er zijn geen taken gepland voor ${periodLabel}</div>
            </div>
        `;
    }


    // ══════════════════════════════════════════════
    // EVENT LISTENERS
    // ══════════════════════════════════════════════

    _attachListeners() {
        if (!this.container) return;
        this._removeListeners();

        // ── Click handler ──
        this._boundClickHandler = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            switch (action) {
                case 'switch-view':
                    this.switchView(btn.dataset.view);
                    break;
                case 'nav-prev':
                    this.navigate(-1);
                    break;
                case 'nav-next':
                    this.navigate(1);
                    break;
                case 'go-today':
                    this.goToday();
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
                case 'toggle-status': {
                    e.stopPropagation();
                    const taakId = btn.dataset.taakId;
                    const currentStatus = btn.dataset.currentStatus;
                    const bron = btn.dataset.bron;
                    if (bron === 'planning') {
                        this._toggleTaakStatus(taakId, currentStatus);
                    }
                    break;
                }
                case 'open-planning': {
                    const tenderId = btn.dataset.tenderId;
                    if (this.onOpenPlanningModal && tenderId) {
                        const tender = this.tenders.find(t => t.id === tenderId);
                        if (tender) this.onOpenPlanningModal(tender);
                    }
                    break;
                }
            }
        };
        this.container.addEventListener('click', this._boundClickHandler);

        // ── Keyboard navigatie ──
        this._boundKeyHandler = (e) => {
            // Alleen als geen input/textarea focus heeft
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowLeft') { this.navigate(-1); }
            if (e.key === 'ArrowRight') { this.navigate(1); }
        };
        document.addEventListener('keydown', this._boundKeyHandler);
    }

    async _toggleTaakStatus(taakId, currentStatus) {
        try {
            await planningService.togglePlanningTaakStatus(taakId, currentStatus);
            await this.loadData();
        } catch (error) {
            console.error('❌ Toggle taak status error:', error);
        }
    }
}