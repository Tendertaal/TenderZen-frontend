/**
 * GanttView.js — TenderZen Gantt View
 * 5e view: horizontale balken per tender over tijdlijn
 * Data: window.app.agendaView.tenders (zelfde patroon als KalenderView)
 */

class GanttView {
    constructor() {
        this._container = null;
        this._zoom = 'maand'; // dag | week | maand | kwartaal | jaar
        this._offset = 0;
        this._tenders = [];
        this._expanded = new Set(); // tender id's die uitgeklapt zijn
        this._faseFilter = null;
        this._today = new Date();
        this._today.setHours(0, 0, 0, 0);
    }

    // ─── PUBLIEKE API ───────────────────────────────────────────

    mount(container) {
        this._container = container;
        container.innerHTML = `<div style="padding:40px;text-align:center;color:#6B7280;">Gantt laden...</div>`;
        this._loadData().then(() => this._renderView());
    }

    unmount() {
        if (this._container) {
            this._container.innerHTML = '';
            this._container = null;
        }
    }

    async refresh() {
        window.planningService?.invalidateCache?.();
        if (this._container) {
            this._container.innerHTML = `<div style="padding:40px;text-align:center;color:#6B7280;">Gantt laden...</div>`;
            await this._loadData();
            this._renderView();
        }
    }

    setFaseFilter(fases) {
        this._faseFilter = fases && fases.length > 0 ? fases : null;
        if (this._container) this._renderView();
    }

    // ─── DATA ───────────────────────────────────────────────────

    async _loadData() {
        try {
            const service = window.planningService;
            if (!service) {
                console.error('GanttView: planningService niet beschikbaar');
                this._tenders = [];
                return;
            }

            const start = new Date();
            start.setFullYear(start.getFullYear() - 1);
            const end = new Date();
            end.setFullYear(end.getFullYear() + 1);

            // Haal bureau-gefilterde data op (bureauId zit in getDataForActiveBureau)
            const data = await service.getDataForActiveBureau(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0]
            );

            // Verwerk via AgendaView._buildTenderList() — zelfde logica als AgendaView
            const agendaView = window.app?.agendaView;
            this._tenders = agendaView?._buildTenderList(data) ?? [];
        } catch (err) {
            console.error('GanttView: data laden mislukt', err);
            this._tenders = [];
        }
    }

    // ─── KOLOMMEN ───────────────────────────────────────────────

    _getColumns() {
        const today = this._today;

        if (this._zoom === 'dag') {
            const base = this._getMaandag(today);
            base.setDate(base.getDate() + this._offset * 7);
            const DN = ['Ma','Di','Wo','Do','Vr','Za','Zo'];
            return Array.from({ length: 7 }, (_, i) => {
                const d = this._addDays(base, i);
                return {
                    label: DN[i],
                    sub: d.getDate() + ' ' + d.toLocaleDateString('nl-NL', { month: 'short' }),
                    start: this._stripTime(d),
                    end: this._stripTime(d),
                    weekend: d.getDay() === 0 || d.getDay() === 6,
                };
            });
        }

        if (this._zoom === 'week') {
            const base = this._getMaandag(today);
            base.setDate(base.getDate() + this._offset * 7);
            return Array.from({ length: 4 }, (_, i) => {
                const d = this._addDays(base, i * 7);
                return {
                    label: `W${this._weekNr(d)}`,
                    sub: d.getDate() + ' ' + d.toLocaleDateString('nl-NL', { month: 'short' }),
                    start: this._stripTime(d),
                    end: this._stripTime(this._addDays(d, 6)),
                };
            });
        }

        if (this._zoom === 'maand') {
            const base = new Date(today.getFullYear(), today.getMonth() + this._offset, 1);
            return Array.from({ length: 4 }, (_, i) => {
                const s = new Date(base.getFullYear(), base.getMonth() + i, 1);
                const e = new Date(base.getFullYear(), base.getMonth() + i + 1, 0);
                return { label: s.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' }), start: s, end: e };
            });
        }

        if (this._zoom === 'kwartaal') {
            const baseQ = Math.floor(today.getMonth() / 3) + this._offset;
            return Array.from({ length: 4 }, (_, i) => {
                const q = ((baseQ + i) % 4 + 4) % 4;
                const y = today.getFullYear() + Math.floor((baseQ + i) / 4);
                const s = new Date(y, q * 3, 1);
                const e = new Date(y, q * 3 + 3, 0);
                return { label: `Q${q + 1} ${y}`, start: s, end: e };
            });
        }

        // jaar
        const baseY = today.getFullYear() + this._offset;
        const M = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
        return Array.from({ length: 12 }, (_, i) => {
            const s = new Date(baseY, i, 1);
            const e = new Date(baseY, i + 1, 0);
            return { label: M[i], start: s, end: e };
        });
    }

    // ─── PLANNINGSFASEN ─────────────────────────────────────────

    /**
     * Leidt planningsfasen af uit de tasks van een tender.
     * tasks = { 'YYYY-MM-DD': [{ n, d, ... }] }
     * Groepeert taken in 3 fasen op basis van positie in de tijdlijn.
     */
    _getFasen(tender) {
        const tasksObj = tender.tasks || {};
        const alleData = Object.entries(tasksObj)
            .map(([datumKey, taken]) => ({
                datum: new Date(datumKey),
                taken: Array.isArray(taken) ? taken : [],
            }))
            .filter(e => e.taken.length > 0)
            .sort((a, b) => a.datum - b.datum);

        if (alleData.length === 0) return [];

        const eersteDate = alleData[0].datum;
        const laatsteDate = alleData[alleData.length - 1].datum;
        const totaalDagen = Math.max(1, this._daysBetween(eersteDate, laatsteDate));

        const drempel1 = Math.floor(totaalDagen / 3);
        const drempel2 = Math.floor(totaalDagen * 2 / 3);

        const fasen = [
            { naam: 'Voorbereiding', key: 'voor', taken: [], start: null, eind: null },
            { naam: 'Uitwerking',    key: 'uitw', taken: [], start: null, eind: null },
            { naam: 'Afronding',     key: 'afr',  taken: [], start: null, eind: null },
        ];

        alleData.forEach(({ datum, taken }) => {
            const dagNr = this._daysBetween(eersteDate, datum);
            const faseIdx = dagNr <= drempel1 ? 0 : dagNr <= drempel2 ? 1 : 2;
            taken.forEach(taak => {
                fasen[faseIdx].taken.push({
                    id:       taak.id,
                    naam:     taak.n || taak.naam || 'Taak',
                    gedaan:   taak.d || taak.done || false,
                    assignees: taak.assignees || [],
                    datum:    taak.datum || null,
                });
            });
            if (!fasen[faseIdx].start || datum < fasen[faseIdx].start) fasen[faseIdx].start = datum;
            if (!fasen[faseIdx].eind  || datum > fasen[faseIdx].eind)  fasen[faseIdx].eind  = datum;
        });

        return fasen.filter(f => f.taken.length > 0 && f.start);
    }

    // ─── RENDER HOOFD ───────────────────────────────────────────

    _renderView() {
        if (!this._container) return;
        const zichtbaar = this._visibleTenders();

        this._container.innerHTML = `
            <div class="gantt-view-wrap">
                ${this._renderToolbar()}
                ${this._renderLegend()}
                <div class="gantt-view-outer">
                    <div class="gantt-view-scroll">
                        <div class="gantt-view-table" id="gv-body">
                            ${zichtbaar.length === 0 ? this._renderEmpty() : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._bindToolbar();

        if (zichtbaar.length > 0) {
            this._renderTable(zichtbaar);
        }
    }

    _renderToolbar() {
        const label = this._getPeriodLabel();
        const zooms = ['dag', 'week', 'maand', 'kwartaal', 'jaar'];
        const labels = { dag: 'Dag', week: 'Week', maand: 'Maand', kwartaal: 'Kwartaal', jaar: 'Jaar' };
        return `
            <div class="gantt-view-toolbar">
                <button class="gv-nav-btn" id="gv-prev">&#8249;</button>
                <button class="gv-nav-btn" id="gv-next">&#8250;</button>
                <button class="gv-today-btn" id="gv-today">Vandaag</button>
                <span class="gantt-view-title">${label}</span>
                <div class="gv-zoom-group">
                    ${zooms.map(z => `<button class="gv-zoom-btn${z === this._zoom ? ' active' : ''}" data-zoom="${z}">${labels[z]}</button>`).join('')}
                </div>
            </div>
        `;
    }

    _renderLegend() {
        return `
            <div class="gv-legend">
                <span class="gv-leg-label">Fase:</span>
                <div class="gv-leg-item"><div class="gv-leg-swatch" style="background:#C4B5FD;"></div>Voorbereiding</div>
                <div class="gv-leg-item"><div class="gv-leg-swatch" style="background:#8B5CF6;"></div>Uitwerking</div>
                <div class="gv-leg-item"><div class="gv-leg-swatch" style="background:#4C1D95;"></div>Afronding</div>
                <div class="gv-leg-divider"></div>
                <div class="gv-leg-item"><div class="gv-leg-deadline"></div>Deadline</div>
                <div class="gv-leg-item"><div class="gv-leg-today"></div>Vandaag</div>
            </div>
        `;
    }

    _renderEmpty() {
        return `<div class="gv-empty-state">
            <div class="gv-empty-title">Geen tenders met planning</div>
            <div class="gv-empty-sub">Voeg een projectplanning toe via de TCC om tenders hier te zien.</div>
        </div>`;
    }

    _bindToolbar() {
        const wrap = this._container?.querySelector('.gantt-view-wrap');
        if (!wrap) return;
        wrap.querySelector('#gv-prev')?.addEventListener('click', () => { this._offset--; this._renderView(); });
        wrap.querySelector('#gv-next')?.addEventListener('click', () => { this._offset++; this._renderView(); });
        wrap.querySelector('#gv-today')?.addEventListener('click', () => { this._offset = 0; this._renderView(); });
        wrap.querySelectorAll('.gv-zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._zoom = btn.dataset.zoom;
                this._offset = 0;
                this._renderView();
            });
        });
    }

    // ─── TABEL RENDER ───────────────────────────────────────────

    _getColWidth(aantalKolommen) {
        const LABEL_W = 500;
        const MIN_COL = 80;
        const MAX_COL = Infinity;
        const scroll = this._container?.querySelector('.gantt-view-scroll');
        const containerW = scroll ? scroll.clientWidth : (this._container?.offsetWidth || 1200);
        const available = containerW - LABEL_W - 2;
        const colW = Math.floor(available / aantalKolommen);
        return Math.max(MIN_COL, Math.min(MAX_COL, colW));
    }

    _renderTable(tenders) {
        const body = this._container?.querySelector('#gv-body');
        if (!body) return;

        const cols = this._getColumns();
        const colW = this._getColWidth(cols.length);
        const tlStart = cols[0].start;
        const tlEnd = cols[cols.length - 1].end;
        const totalPx = cols.length * colW;
        const totalDagen = this._daysBetween(tlStart, tlEnd) + 1;

        const todayVisible = this._today >= tlStart && this._today <= tlEnd;
        const todayPx = todayVisible
            ? ((this._daysBetween(tlStart, this._today) + 0.5) / totalDagen) * totalPx
            : null;

        const colBgHtml = cols.map(col => {
            const isCur = col.start <= this._today && this._today <= col.end;
            return `<div class="gv-tl-col${isCur ? ' cur' : ''}${col.weekend ? ' weekend' : ''}" style="width:${colW}px;"></div>`;
        }).join('');

        const colHeaderHtml = cols.map(col => {
            const isCur = col.start <= this._today && this._today <= col.end;
            return `<div class="gv-col-header${isCur ? ' cur' : ''}${col.weekend ? ' weekend' : ''}" style="width:${colW}px;">${col.label}${col.sub ? `<span class="gv-sub-lbl">${col.sub}</span>` : ''}</div>`;
        }).join('');

        let html = `<div class="gv-header">
            <div class="gv-header-label">
                <div class="gv-col-label gv-col-taak">Project / Taak</div>
                <div class="gv-col-label gv-col-start">Start</div>
                <div class="gv-col-label gv-col-eind">Eind / Deadline</div>
            </div>
            <div class="gv-header-cols">${colHeaderHtml}</div>
        </div>`;

        tenders.forEach(tender => {
            html += this._renderTenderRow(tender, cols, tlStart, tlEnd, totalPx, totalDagen, todayPx, colBgHtml);
        });

        body.innerHTML = html;
        this._bindRowClicks();
    }

    _faseBadgeHtml(fase) {
        const map = {
            'acquisitie':     { bg: '#FFF7ED', color: '#9A3412', dot: '#F97316', label: 'Acquisitie' },
            'inschrijvingen': { bg: '#EDE9FE', color: '#5B21B6', dot: '#7C3AED', label: 'Inschrijvingen' },
            'inschrijving':   { bg: '#EDE9FE', color: '#5B21B6', dot: '#7C3AED', label: 'Inschrijvingen' },
            'ingediend':      { bg: '#EFF6FF', color: '#1e40af', dot: '#3B82F6', label: 'Ingediend' },
            'afronden':       { bg: '#F0FDFA', color: '#065F46', dot: '#10B981', label: 'Afronden' },
            'evaluatie':      { bg: '#F0FDFA', color: '#065F46', dot: '#10B981', label: 'Afronden' },
            'archief':        { bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF', label: 'Archief' },
        };
        const f = map[(fase || '').toLowerCase()] || { bg: '#F9FAFB', color: '#6B7280', dot: '#9CA3AF', label: fase || '—' };
        return `<div class="gv-fase-badge" style="background:${f.bg};color:${f.color};">
            <div class="gv-fase-dot" style="background:${f.dot};"></div>
            ${this._escapeHtml(f.label)}
        </div>`;
    }

    _getStartDate(tender) {
        const tasksObj = tender.tasks || {};
        const datums = Object.keys(tasksObj).filter(k => tasksObj[k]?.length > 0);
        if (datums.length === 0) return null;
        return new Date(datums.sort()[0]);
    }

    _renderTenderRow(tender, cols, tlStart, tlEnd, totalPx, totalDagen, todayPx, colBgHtml) {
        const FASE_KLEUREN = { voor: '#C4B5FD', uitw: '#8B5CF6', afr: '#4C1D95' };
        const fasen = this._getFasen(tender);
        const isExp = this._expanded.has(tender.id);
        const deadline = tender.deadline ? new Date(tender.deadline.substring ? tender.deadline.substring(0, 10) : tender.deadline) : null;
        const dlPill = deadline ? this._deadlinePill(deadline) : '';

        // ── Lege staat: tender zonder planning ──
        if (fasen.length === 0) {
            return `<div class="gv-tender-row gv-tender-row-empty" data-tender-id="${tender.id}">
                <div class="gv-row-label">
                    <div class="gv-row-col gv-row-col-taak">
                        <div class="gv-caret gv-caret-disabled">
                            <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 1l3 3-3 3"/></svg>
                        </div>
                        <div class="gv-tender-info">
                            <div class="gv-tender-name-wrap" data-tender-id="${tender.id}" title="Open Tender Command Center">
                                <div class="gv-tender-name">${this._escapeHtml(tender.naam)}</div>
                                <svg class="gv-tcc-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/><path d="M10 2h4v4"/><path d="M14 2 8 8"/></svg>
                            </div>
                            <div class="gv-tender-meta">
                                <div class="gv-tender-meta-row">
                                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><path d="M1 6h14"/></svg>
                                    <span class="gv-tender-meta-val">${this._escapeHtml(tender.organisatie || '—')}</span>
                                </div>
                                <div class="gv-tender-meta-row">
                                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0"/></svg>
                                    <span class="gv-tender-meta-val">${this._escapeHtml(tender.bedrijfsnaam || '—')}</span>
                                </div>
                            </div>
                            ${this._faseBadgeHtml(tender.fase)}
                        </div>
                    </div>
                    <div class="gv-row-col gv-row-col-start">
                        <div class="gv-col-date-muted">—</div>
                    </div>
                    <div class="gv-row-col gv-row-col-eind">
                        <div class="gv-col-date-muted">—</div>
                    </div>
                </div>
                <div class="gv-row-timeline gv-timeline-empty" style="width:${totalPx}px;position:relative;">
                    <div class="gv-tl-bg">${colBgHtml}</div>
                    ${todayPx !== null ? `<div class="gv-today-line" style="left:${todayPx}px;"></div>` : ''}
                    <div class="gv-empty-planning">
                        <span class="gv-empty-planning-text">Geen projectplanning</span>
                        <button class="gv-planning-maken-btn" data-tender-id="${tender.id}">Planning maken</button>
                    </div>
                </div>
            </div>`;
        }

        // Totale span van alle fasen
        let tStart = null, tEnd = null;
        fasen.forEach(f => {
            if (!tStart || f.start < tStart) tStart = f.start;
            if (!tEnd   || f.eind  > tEnd)   tEnd   = f.eind;
        });

        const fullBar = tStart && tEnd ? this._pxAcross(tStart, tEnd, tlStart, tlEnd, totalPx, totalDagen) : null;
        const fullSpanDagen = tStart && tEnd ? this._daysBetween(tStart, tEnd) + 1 : 1;
        const fullSpanPx = fullBar ? fullBar.width : 0;

        // Segmentbalk
        let segBarHtml = '';
        if (fullBar && fullBar.width > 0 && fasen.length > 0) {
            segBarHtml = `<div class="gv-seg-bar" style="left:${fullBar.left}px;width:${fullBar.width}px;">`;
            fasen.forEach((fase, i) => {
                const fStart = fase.start < tStart ? tStart : fase.start;
                const fEnd   = fase.eind  > tEnd   ? tEnd   : fase.eind;
                const segPx = ((this._daysBetween(fStart, fEnd) + 1) / fullSpanDagen) * fullSpanPx;
                const kleur = FASE_KLEUREN[fase.key] || '#8B5CF6';
                segBarHtml += `<div class="gv-seg" style="width:${segPx}px;min-width:0;background:${kleur};">
                    <div class="gv-seg-tooltip">${this._escapeHtml(fase.naam)}</div>
                    <span class="gv-seg-label">${this._escapeHtml(fase.naam.split(' ')[0])}</span>
                </div>`;
                if (i < fasen.length - 1) segBarHtml += `<div class="gv-seg-divider"></div>`;
            });
            segBarHtml += `</div>`;
        }

        // Deadline vlag
        let dlFlagHtml = '';
        if (deadline) {
            const dlStripped = this._stripTime(deadline);
            if (dlStripped >= tlStart && dlStripped <= tlEnd) {
                const dlPx = ((this._daysBetween(tlStart, dlStripped) + 0.5) / totalDagen) * totalPx;
                dlFlagHtml = `<div class="gv-dl-flag" style="left:${dlPx - 5}px;"></div>`;
            }
        }

        const startDatum = this._getStartDate(tender);
        const formatDatum = (d) => d ? d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '—';

        let html = `<div class="gv-tender-row${isExp ? ' expanded' : ''}" data-tender-id="${tender.id}">
            <div class="gv-row-label">
                <div class="gv-row-col gv-row-col-taak">
                    <div class="gv-caret${isExp ? ' open' : ''}">
                        <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 1l3 3-3 3"/></svg>
                    </div>
                    <div class="gv-tender-info">
                        <div class="gv-tender-name-wrap" data-tender-id="${tender.id}" title="Open Tender Command Center">
                            <div class="gv-tender-name">${this._escapeHtml(tender.naam)}</div>
                            <svg class="gv-tcc-link-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9"/><path d="M10 2h4v4"/><path d="M14 2 8 8"/></svg>
                        </div>
                        <div class="gv-tender-meta">
                            <div class="gv-tender-meta-row">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><path d="M1 6h14"/></svg>
                                <span class="gv-tender-meta-val">${this._escapeHtml(tender.organisatie || '—')}</span>
                            </div>
                            <div class="gv-tender-meta-row">
                                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0"/></svg>
                                <span class="gv-tender-meta-val">${this._escapeHtml(tender.bedrijfsnaam || '—')}</span>
                            </div>
                        </div>
                        ${this._faseBadgeHtml(tender.fase)}
                    </div>
                </div>
                <div class="gv-row-col gv-row-col-start">
                    <div class="gv-col-date">${formatDatum(startDatum)}</div>
                </div>
                <div class="gv-row-col gv-row-col-eind">
                    ${dlPill}
                </div>
            </div>
            <div class="gv-row-timeline" style="width:${totalPx}px;">
                <div class="gv-tl-bg">${colBgHtml}</div>
                ${todayPx !== null ? `<div class="gv-today-line" style="left:${todayPx}px;"></div>` : ''}
                ${segBarHtml}
                ${dlFlagHtml}
            </div>
        </div>`;

        // Uitgeklapte fasen
        if (isExp) {
            fasen.forEach(fase => {
                const kleur = FASE_KLEUREN[fase.key] || '#8B5CF6';
                const gedaan = fase.taken.filter(t => t.gedaan).length;
                const phBar = fase.start && fase.eind
                    ? this._pxAcross(fase.start, fase.eind, tlStart, tlEnd, totalPx, totalDagen)
                    : null;

                const subBg     = fase.key === 'voor' ? '#FAF9FF' : fase.key === 'uitw' ? '#F5F3FF' : '#F0EBFF';
                const subBorder = fase.key === 'voor' ? '#A78BFA' : fase.key === 'uitw' ? '#7C3AED' : '#4C1D95';
                const subText   = '#3730A3';

                html += `<div class="gv-subtask-section">
                    <div class="gv-phase-header-row">
                        <div class="gv-phase-label">
                            <div class="gv-row-col gv-row-col-taak" style="padding-left:34px;align-items:center;gap:6px;">
                                <div class="gv-phase-dot" style="background:${kleur};"></div>
                                <span class="gv-phase-name">${this._escapeHtml(fase.naam)}</span>
                                <span class="gv-phase-count">${gedaan}/${fase.taken.length}</span>
                            </div>
                            <div class="gv-row-col gv-row-col-start"></div>
                            <div class="gv-row-col gv-row-col-eind"></div>
                        </div>
                        <div class="gv-phase-timeline" style="width:${totalPx}px;">
                            <div class="gv-tl-bg">${colBgHtml}</div>
                            ${phBar ? `<div style="position:absolute;left:${phBar.left}px;width:${phBar.width}px;top:50%;transform:translateY(-50%);height:4px;background:${kleur};border-radius:2px;opacity:0.3;z-index:2;"></div>` : ''}
                        </div>
                    </div>`;

                fase.taken.forEach(taak => {
                    const assignees = taak.assignees || [];
                    const assigneeHtml = (() => {
                        const avatarHtml = assignees.length === 0
                            ? `<div class="gv-sub-assignee-empty"></div>`
                            : assignees.slice(0, 3).map(a => {
                                const ini = a.initialen || (a.naam || '?').substring(0, 2).toUpperCase();
                                const bg  = a.avatar_kleur || '#C7D2FE';
                                return `<div class="gv-sub-assignee-av" style="background:${bg};">${this._escapeHtml(ini)}</div>`;
                            }).join('');
                        return `<div class="gv-sub-assignees">
                            ${avatarHtml}
                            <div class="gv-sub-assignee-add" data-taak-id="${taak.id}" title="Teamlid toevoegen">+</div>
                        </div>`;
                    })();

                    // Balk per taak op basis van eigen datum; fallback naar fase-balk
                    const taakDatum = taak.datum ? new Date(taak.datum) : null;
                    const balk = taakDatum
                        ? this._pxAcross(taakDatum, taakDatum, tlStart, tlEnd, totalPx, totalDagen)
                        : phBar;
                    const balkBreedte = balk ? balk.width : 0;
                    const tekstInBalk = balkBreedte >= 80;
                    const balkHtml = balk ? `<div class="gv-sub-bar-wrap" style="left:${balk.left}px;width:${Math.max(balkBreedte, 8)}px;">
                        <div class="gv-sub-bar-tooltip">${this._escapeHtml(taak.naam)}</div>
                        <div class="gv-sub-bar" style="width:100%;background:${subBg};border-color:${subBorder};">
                            ${tekstInBalk ? `<span class="gv-sub-bar-name" style="color:${subText};">${this._escapeHtml(taak.naam)}</span>` : ''}
                        </div>
                    </div>${!tekstInBalk ? `<span class="gv-sub-bar-name-naast" style="left:${balk.left + Math.max(balkBreedte, 8) + 6}px;">${this._escapeHtml(taak.naam)}</span>` : ''}` : '';

                    html += `<div class="gv-sub-row">
                        <div class="gv-sub-label">
                            <div class="gv-row-col gv-row-col-taak" style="padding-left:34px;align-items:center;gap:7px;">
                                <div class="gv-sub-check${taak.gedaan ? ' done' : ''}" data-taak-id="${taak.id}"></div>
                                <span class="gv-sub-task-name" title="${this._escapeHtml(taak.naam)}">${this._escapeHtml(taak.naam)}</span>
                                ${assigneeHtml}
                            </div>
                            <div class="gv-row-col gv-row-col-start"></div>
                            <div class="gv-row-col gv-row-col-eind"></div>
                        </div>
                        <div class="gv-sub-timeline" style="width:${totalPx}px;">
                            <div class="gv-tl-bg">${colBgHtml}</div>
                            ${todayPx !== null ? `<div style="position:absolute;top:0;bottom:0;left:${todayPx}px;width:2px;background:rgba(16,185,129,0.1);z-index:3;pointer-events:none;"></div>` : ''}
                            ${balkHtml}
                        </div>
                    </div>`;
                });

                html += `</div>`;
            });
        }

        return html;
    }

    _bindRowClicks() {
        // Uitklapbare rijen (tenders met planning)
        this._container?.querySelectorAll('.gv-tender-row:not(.gv-tender-row-empty)').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.tenderId;
                if (!id) return;
                if (this._expanded.has(id)) {
                    this._expanded.delete(id);
                } else {
                    this._expanded.add(id);
                }
                this._renderView();
            });
        });

        // Klik op tendernaam → open TCC
        this._container?.querySelectorAll('.gv-tender-name-wrap').forEach(wrap => {
            wrap.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = wrap.dataset.tenderId;
                if (!tenderId) return;
                if (typeof window.openCommandCenter === 'function') {
                    window.openCommandCenter(tenderId);
                }
            });
        });

        // "Planning maken" knoppen
        this._container?.querySelectorAll('.gv-planning-maken-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tenderId = btn.dataset.tenderId;
                if (!tenderId) return;
                if (window.app?.openTenderCommandCenter) {
                    window.app.openTenderCommandCenter(tenderId, 'projectplanning');
                }
            });
        });

        // Taak afvinken
        this._container?.querySelectorAll('.gv-sub-check').forEach(check => {
            check.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taakId = check.dataset.taakId;
                if (!taakId) return;
                const wasGedaan = check.classList.contains('done');
                check.classList.toggle('done'); // optimistic update
                try {
                    const service = window.planningService;
                    if (service?.updatePlanningTaak) {
                        await service.updatePlanningTaak(taakId, { status: wasGedaan ? 'todo' : 'done' });
                        service.invalidateCache?.();
                    }
                } catch (err) {
                    check.classList.toggle('done'); // revert
                    console.error('GanttView: taak update mislukt', err);
                }
            });
        });

        // Teamlid toevoegen
        this._container?.querySelectorAll('.gv-sub-assignee-add').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const taakId = btn.dataset.taakId;
                if (!taakId) return;
                const bureauId = window.app?.currentBureau?.bureau_id
                    || this._getBureauIdVoorTaak(taakId);
                if (!bureauId) {
                    console.warn('GanttView: geen bureau_id beschikbaar voor teamleden');
                    return;
                }
                try {
                    const service = window.planningService;
                    const resp = await service._fetch(`/api/v1/team-members?tenderbureau_id=${bureauId}`);
                    const teamleden = resp?.data || [];
                    this._showTeamledenDropdown(btn, taakId, teamleden);
                } catch (err) {
                    console.error('GanttView: teamleden ophalen mislukt', err);
                }
            });
        });
    }

    _getBureauIdVoorTaak(taakId) {
        for (const tender of this._tenders) {
            for (const dagTaken of Object.values(tender.tasks || {})) {
                if (Array.isArray(dagTaken) && dagTaken.find(t => t.id === taakId)) {
                    return tender.tenderbureau_id || null;
                }
            }
        }
        return null;
    }

    _showTeamledenDropdown(anchorEl, taakId, teamleden) {
        document.querySelector('.gv-teamlid-dropdown')?.remove();
        const rect = anchorEl.getBoundingClientRect();
        const dropdown = document.createElement('div');
        dropdown.className = 'gv-teamlid-dropdown';
        dropdown.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:500;background:#fff;border:1px solid #E5E7EB;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:180px;overflow:hidden;`;
        dropdown.innerHTML = teamleden.length === 0
            ? `<div style="padding:10px 14px;font-size:12px;color:#9CA3AF;">Geen teamleden gevonden</div>`
            : teamleden.map(lid => {
                const ini = lid.initialen || (lid.naam || '?').substring(0, 2).toUpperCase();
                const bg  = lid.avatar_kleur || '#C7D2FE';
                return `<div class="gv-teamlid-option" data-lid-id="${lid.user_id}" data-lid-naam="${this._escapeHtml(lid.naam || '')}" data-lid-ini="${this._escapeHtml(ini)}" data-lid-bg="${bg}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;font-size:12px;">
                    <div style="width:24px;height:24px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:600;color:#fff;flex-shrink:0;">${this._escapeHtml(ini)}</div>
                    ${this._escapeHtml(lid.naam || '')}
                </div>`;
            }).join('');
        document.body.appendChild(dropdown);
        dropdown.querySelectorAll('.gv-teamlid-option').forEach(opt => {
            opt.addEventListener('mouseenter', () => opt.style.background = '#F5F3FF');
            opt.addEventListener('mouseleave', () => opt.style.background = '');
            opt.addEventListener('click', async () => {
                dropdown.remove();
                await this._assignTeamlid(taakId, {
                    user_id: opt.dataset.lidId,
                    naam: opt.dataset.lidNaam,
                    initialen: opt.dataset.lidIni,
                    avatar_kleur: opt.dataset.lidBg,
                });
            });
        });
        setTimeout(() => document.addEventListener('click', () => dropdown.remove(), { once: true }), 0);
    }

    async _assignTeamlid(taakId, lid) {
        try {
            const service = window.planningService;
            if (!service) return;
            // Vind huidige assignees in data
            let huidig = [];
            for (const t of this._tenders) {
                for (const taken of Object.values(t.tasks || {})) {
                    const taak = taken.find(tk => tk.id === taakId);
                    if (taak) { huidig = taak.assignees || []; break; }
                }
                if (huidig.length || this._tenders.indexOf(t) === this._tenders.length - 1) break;
            }
            const al = huidig.some(a => a.user_id === lid.user_id);
            const nieuw = al ? huidig : [...huidig, lid];
            await service.updatePlanningTaak(taakId, { toegewezen_aan: nieuw });
            service.invalidateCache?.();
            await this._loadData();
            this._renderView();
        } catch (err) {
            console.error('GanttView: teamlid toevoegen mislukt', err);
        }
    }

    // ─── HELPERS ────────────────────────────────────────────────

    _visibleTenders() {
        return this._tenders.filter(t => {
            if (this._faseFilter && this._faseFilter.length > 0 && !this._faseFilter.includes(t.fase)) return false;
            return true;
        });
    }

    _pxAcross(s, e, tlStart, tlEnd, totalPx, totalDagen) {
        const cs = s < tlStart ? tlStart : s;
        const ce = e > tlEnd   ? tlEnd   : e;
        if (cs > tlEnd || ce < tlStart) return null;
        const left  = (this._daysBetween(tlStart, cs) / totalDagen) * totalPx;
        const width = ((this._daysBetween(cs, ce) + 1) / totalDagen) * totalPx;
        return { left, width };
    }

    _deadlinePill(deadline) {
        const dagen = Math.round((this._stripTime(deadline) - this._today) / 86400000);
        let cls, label;
        if      (dagen < 0)  { cls = 'gv-dl-done'; label = 'Verlopen'; }
        else if (dagen === 0) { cls = 'gv-dl-urg';  label = 'Vandaag'; }
        else if (dagen <= 7)  { cls = 'gv-dl-urg';  label = deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); }
        else if (dagen <= 21) { cls = 'gv-dl-warn'; label = deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); }
        else                  { cls = 'gv-dl-ok';   label = deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); }
        return `<div class="gv-deadline-pill ${cls}">
            <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 2"/></svg>
            ${label}
        </div>`;
    }

    _getPeriodLabel() {
        const cols = this._getColumns();
        if (this._zoom === 'dag') {
            const ws = cols[0].start;
            return `Week ${this._weekNr(ws)} \u00b7 ${ws.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} \u2013 ${cols[6].end.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        }
        if (this._zoom === 'jaar') return `${cols[0].start.getFullYear()}`;
        return cols[0].label + ' \u2013 ' + cols[cols.length - 1].label;
    }

    _getMaandag(datum) {
        const d = new Date(datum);
        const dag = d.getDay();
        const diff = d.getDate() - dag + (dag === 0 ? -6 : 1);
        return new Date(d.getFullYear(), d.getMonth(), diff);
    }

    _stripTime(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    _addDays(d, n) {
        const r = new Date(d);
        r.setDate(r.getDate() + n);
        return r;
    }

    _daysBetween(a, b) {
        return Math.round((this._stripTime(b) - this._stripTime(a)) / 86400000);
    }

    _weekNr(d) {
        const jan1 = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    }

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

window.GanttView = GanttView;
