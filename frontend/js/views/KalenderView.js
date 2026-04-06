/**
 * KalenderView.js — TenderZen Kalender View
 * 4e view: maand/week grid met planning_taken als chips
 * Integreert met PlanningService.getAgendaData()
 */

class KalenderView {
    constructor() {
        this._container = null;
        this._mode = 'maand'; // 'maand' | 'week'
        this._offset = 0;
        this._data = null;
        this._tasks = [];
        this._activeFilter = null;  // tender_id filter
        this._faseFilter = null;    // fase filter (van FaseBar)
        this._today = new Date();
        this._today.setHours(0, 0, 0, 0);
        this._isLoading = false;
    }

    // ─── PUBLIEKE API ───────────────────────────────────────────

    mount(container) {
        this._container = container;
        container.innerHTML = `<div style="padding:40px;text-align:center;color:#6B7280;">Kalender laden...</div>`;
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
            this._container.innerHTML = `<div style="padding:40px;text-align:center;color:#6B7280;">Kalender laden...</div>`;
            await this._loadData();
            this._renderView();
        }
    }

    setFaseFilter(fases) {
        this._faseFilter = fases && fases.length > 0 ? fases : null;
        if (this._container && !this._isLoading) this._renderView();
    }

    // ─── DATA ───────────────────────────────────────────────────

    async _loadData() {
        this._isLoading = true;
        try {
            const service = window.planningService;
            if (!service) {
                console.error('KalenderView: planningService niet beschikbaar');
                this._tasks = [];
                return;
            }

            const start = new Date(this._today);
            start.setFullYear(start.getFullYear() - 1);
            const end = new Date(this._today);
            end.setFullYear(end.getFullYear() + 1);

            // Haal bureau-gefilterde data op (bureauId zit in getDataForActiveBureau)
            const data = await service.getDataForActiveBureau(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0]
            );

            // Verwerk via AgendaView._buildTenderList() — zelfde logica als AgendaView
            const agendaView = window.app?.agendaView;
            const tenders = agendaView?._buildTenderList(data) ?? [];
            this._tasks = this._processTasks(tenders);
        } catch (err) {
            console.error('KalenderView: data laden mislukt', err);
            this._tasks = [];
        } finally {
            this._isLoading = false;
        }
    }

    _processTasks(tenders) {
        if (!tenders || tenders.length === 0) return [];
        const tasks = [];

        tenders.forEach(tender => {
            const fk = window.FaseKleuren ? window.FaseKleuren.get(tender.fase) : null;
            const tenderInfo = {
                id: tender.id,
                naam: tender.naam || 'Naamloze tender',
                opdrachtgever: tender.organisatie || '',
                bedrijfsnaam: tender.bedrijfsnaam || '',
                fase: tender.fase || '',
                kleur: fk ? fk.kleur : this._faseKleur(tender.fase),
                deadline: tender.deadline ? this._parseDatum(tender.deadline.substring(0, 10)) : null,
                teamleden: tender.team || [],
            };

            // tasks is een object: { 'YYYY-MM-DD': [{ id, n, d, u, bron, assignees }, ...], ... }
            const tasksObj = tender.tasks || {};
            Object.entries(tasksObj).forEach(([datumKey, dagTaken]) => {
                if (!Array.isArray(dagTaken)) return;
                const start = this._parseDatum(datumKey);
                if (!start || isNaN(start.getTime())) return;

                dagTaken.forEach(taak => {
                    tasks.push({
                        id: taak.id,
                        tender: tenderInfo,
                        naam: taak.n || 'Taak',
                        start,
                        done: taak.d || false,
                        milestone: taak.u || false,
                        status: taak.d ? 'done' : 'todo',
                        subtaken: [],
                        isDeadline: false,
                    });
                });
            });

            // Deadline als aparte marker
            if (tenderInfo.deadline) {
                tasks.push({
                    id: `dl_${tender.id}`,
                    tender: tenderInfo,
                    naam: 'DEADLINE',
                    start: tenderInfo.deadline,
                    done: false,
                    milestone: true,
                    status: 'deadline',
                    subtaken: [],
                    isDeadline: true,
                });
            }
        });

        return tasks;
    }

    // ─── RENDER HOOFD ───────────────────────────────────────────

    _renderView() {
        if (!this._container) return;
        this._container.innerHTML = `
            <div class="kalender-wrap">
                ${this._renderToolbar()}
                <div id="kal-body"></div>
            </div>
        `;
        this._bindToolbar();
        this._renderGrid();
    }

    _renderToolbar() {
        const label = this._getPeriodLabel();
        return `
            <div class="kalender-toolbar">
                <button class="kal-nav-btn" id="kal-prev">&#8249;</button>
                <button class="kal-nav-btn" id="kal-next">&#8250;</button>
                <button class="kal-today-btn" id="kal-today">Vandaag</button>
                <span class="kalender-title">${label}</span>
                <div class="kal-mode-group">
                    <button class="kal-mode-btn${this._mode === 'maand' ? ' active' : ''}" data-mode="maand">Maand</button>
                    <button class="kal-mode-btn${this._mode === 'week' ? ' active' : ''}" data-mode="week">Week</button>
                </div>
            </div>
        `;
    }

    _bindToolbar() {
        const wrap = this._container?.querySelector('.kalender-wrap');
        if (!wrap) return;
        wrap.querySelector('#kal-prev')?.addEventListener('click', () => { this._offset--; this._renderView(); });
        wrap.querySelector('#kal-next')?.addEventListener('click', () => { this._offset++; this._renderView(); });
        wrap.querySelector('#kal-today')?.addEventListener('click', () => { this._offset = 0; this._renderView(); });
        wrap.querySelectorAll('.kal-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._mode = btn.dataset.mode;
                this._offset = 0;
                this._renderView();
            });
        });
    }

    _renderGrid() {
        const body = this._container?.querySelector('#kal-body');
        if (!body) return;
        body.innerHTML = this._mode === 'maand' ? this._renderMaand() : this._renderWeek();
        this._fixDetailPanelFlip();
        this._bindDragDrop();
    }

    // ─── MAAND GRID ─────────────────────────────────────────────

    _renderMaand() {
        const ms = new Date(this._today.getFullYear(), this._today.getMonth() + this._offset, 1);
        const gs = this._getMaandag(ms);
        const dagen = Array.from({ length: 42 }, (_, i) => {
            const d = new Date(gs);
            d.setDate(gs.getDate() + i);
            return d;
        });

        let html = `<div class="kal-month-grid">
            <div class="kal-month-head">
                ${['Ma','Di','Wo','Do','Vr','Za','Zo'].map(n => `<div class="kal-mh">${n}</div>`).join('')}
            </div>
            <div class="kal-month-body">`;

        dagen.forEach(dag => {
            const andereMonth = dag.getMonth() !== ms.getMonth();
            const isVandaag = this._sameDay(dag, this._today);
            const dagStr = this._datumNaarString(dag);
            html += `<div class="kal-day${andereMonth ? ' kal-dim' : ''}${isVandaag ? ' kal-today' : ''}" data-datum="${dagStr}">`;
            html += `<span class="kal-day-num${isVandaag ? ' kal-today-num' : ''}${andereMonth ? ' kal-other-month' : ''}">${dag.getDate()}</span>`;
            this._getTasksForDay(dag).forEach(taak => { html += this._renderChip(taak, dagStr); });
            html += `</div>`;
        });

        html += `</div></div>`;
        return html;
    }

    // ─── WEEK GRID ──────────────────────────────────────────────

    _renderWeek() {
        const weekStart = this._getMaandag(this._today);
        weekStart.setDate(weekStart.getDate() + this._offset * 7);
        const dagen = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + i);
            return d;
        });
        const dagNamen = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

        let html = `<div class="kal-week-grid">
            <div class="kal-week-head">
                <div class="kal-week-corner"></div>`;

        dagen.forEach((dag, i) => {
            const isVandaag = this._sameDay(dag, this._today);
            html += `<div class="kal-week-dh${isVandaag ? ' kal-wk-today' : ''}">
                <div class="kal-wk-day-name">${dagNamen[i]}</div>
                <div class="kal-wk-day-num${isVandaag ? ' kal-today-num' : ''}">${dag.getDate()}</div>
            </div>`;
        });

        html += `</div><div class="kal-week-body"><div class="kal-week-aside"></div>`;

        dagen.forEach(dag => {
            const isVandaag = this._sameDay(dag, this._today);
            const dagStr = this._datumNaarString(dag);
            html += `<div class="kal-week-cell${isVandaag ? ' kal-today-cell' : ''}" data-datum="${dagStr}">`;
            this._getTasksForDay(dag).forEach(taak => { html += this._renderChip(taak, dagStr); });
            html += `</div>`;
        });

        html += `</div></div>`;
        return html;
    }

    // ─── CHIP RENDER ────────────────────────────────────────────

    _renderChip(taak, dagStr) {
        const t = taak.tender;
        const zichtbaar = this._isVisible(taak);
        const buildingIcon = window.Icons?.building({ size: 11, color: '#9CA3AF' }) || '';
        const userIcon = window.Icons?.user({ size: 11, color: '#9CA3AF' }) || '';

        if (taak.isDeadline) {
            const deadlineDatum = t.deadline
                ? t.deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—';
            return `<div class="kal-chip-wrap kal-deadline-wrap${zichtbaar ? '' : ' kal-chip-dimmed'}">
                <div class="kal-chip kal-chip-deadline" style="border-color:${t.kleur};">
                    <div class="kal-deadline-header">
                        <div class="kal-dl-diamond"></div>
                        <span class="kal-dl-label">Deadline</span>
                    </div>
                    <div class="kal-chip-naam">${this._escapeHtml(t.naam)}</div>
                    <hr class="kal-chip-divider">
                    <div class="kal-chip-meta">
                        <div class="kal-chip-meta-row">${buildingIcon}<span class="kal-chip-meta-val">${this._escapeHtml(t.opdrachtgever || '—')}</span></div>
                        <div class="kal-chip-meta-row">${userIcon}<span class="kal-chip-meta-val">${this._escapeHtml(t.bedrijfsnaam || '—')}</span></div>
                    </div>
                    <div class="kal-chip-footer">
                        <div class="kal-dl-date">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 2"/></svg>
                            ${deadlineDatum}
                        </div>
                        ${this._faseBadgeHtml(t.fase)}
                    </div>
                </div>
            </div>`;
        }

        const datum = dagStr || this._datumNaarString(taak.start);
        const avatarHtml = (t.teamleden || []).slice(0, 3).map(lid => {
            const bg = lid.avatar_kleur || '#C7D2FE';
            const ini = lid.initialen || '?';
            return `<div class="kal-chip-av" style="background:${bg};color:#fff;">${this._escapeHtml(ini)}</div>`;
        }).join('') || '<div class="kal-chip-av-empty"></div>';

        return `<div class="kal-chip-wrap" data-taak-id="${taak.id}">
            <div class="kal-chip${zichtbaar ? '' : ' kal-chip-dimmed'}"
                 draggable="true"
                 data-taak-id="${taak.id}"
                 data-datum="${datum}"
                 style="border-color:${t.kleur};">
                <div class="kal-chip-project" style="color:${t.kleur};">${this._escapeHtml(t.naam)}</div>
                <div class="kal-chip-naam">${this._escapeHtml(taak.naam)}</div>
                <hr class="kal-chip-divider">
                <div class="kal-chip-meta">
                    <div class="kal-chip-meta-row">${buildingIcon}<span class="kal-chip-meta-val">${this._escapeHtml(t.opdrachtgever || '—')}</span></div>
                    <div class="kal-chip-meta-row">${userIcon}<span class="kal-chip-meta-val">${this._escapeHtml(t.bedrijfsnaam || '—')}</span></div>
                </div>
                <div class="kal-chip-footer">
                    <div class="kal-chip-avs">${avatarHtml}</div>
                    ${this._faseBadgeHtml(t.fase)}
                </div>
            </div>
            ${this._renderDetailPanel(taak)}
        </div>`;
    }

    _faseBadgeHtml(fase) {
        const map = {
            'acquisitie':     { bg: '#FED7AA', color: '#9A3412', label: 'Acquisitie' },
            'inschrijvingen': { bg: '#EDE9FE', color: '#5B21B6', label: 'Inschrijvingen' },
            'inschrijving':   { bg: '#EDE9FE', color: '#5B21B6', label: 'Inschrijvingen' },
            'ingediend':      { bg: '#DBEAFE', color: '#1e40af', label: 'Ingediend' },
            'afronden':       { bg: '#D1FAE5', color: '#065F46', label: 'Afronden' },
            'evaluatie':      { bg: '#D1FAE5', color: '#065F46', label: 'Afronden' },
            'archief':        { bg: '#F3F4F6', color: '#6B7280', label: 'Archief' },
        };
        const f = map[(fase || '').toLowerCase()] || { bg: '#F3F4F6', color: '#6B7280', label: fase || '—' };
        return `<span class="kal-fase-badge" style="background:${f.bg};color:${f.color};">${f.label}</span>`;
    }

    _renderDetailPanel(taak) {
        const t = taak.tender;
        const dlStatus = this._deadlineStatus(t.deadline, t.fase);
        const faseLabel = window.FaseKleuren ? window.FaseKleuren.get(t.fase).label : t.fase;

        const teamHtml = (t.teamleden || []).slice(0, 4).map(lid => {
            const bg = lid.avatar_kleur || '#C7D2FE';
            const initials = lid.initialen || '?';
            return `<div class="kal-dp-av" style="background:${bg};color:#fff;">${this._escapeHtml(initials)}</div>`;
        }).join('');

        const { cls, label } = dlStatus;

        return `<div class="kal-detail-panel" style="border-color:${t.kleur};">
            <div class="kal-dp-bar" style="background:${t.kleur};"></div>
            <div class="kal-dp-body">
                <div class="kal-dp-top">
                    <span class="kal-dp-project" style="color:${t.kleur};">${this._escapeHtml(t.naam.substring(0, 24))}</span>
                    <span class="kal-dp-status" style="background:${this._lightenColor(t.kleur)};color:${t.kleur};">${this._escapeHtml(faseLabel)}</span>
                </div>
                <div class="kal-dp-name">${this._escapeHtml(taak.naam)}</div>
                <hr class="kal-dp-divider">
                <div class="kal-dp-meta">
                    <div class="kal-dp-meta-row">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="2" width="14" height="12" rx="2"/><path d="M1 6h14"/></svg>
                        ${this._escapeHtml(t.opdrachtgever || '—')}
                    </div>
                </div>
                <div class="kal-dp-footer">
                    <div class="kal-dp-avatars">${teamHtml}</div>
                    <div class="kal-dl-pill ${cls}">
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 5v3.5l2 2"/></svg>
                        ${label}
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ─── HELPERS ────────────────────────────────────────────────

    _getTasksForDay(dag) {
        return this._tasks.filter(t => {
            if (!this._sameDay(dag, t.start)) return false;
            if (this._faseFilter && this._faseFilter.length > 0) {
                const canonFase = window.FaseKleuren ? window.FaseKleuren.alleFases().find(f => {
                    const fk = window.FaseKleuren[f];
                    return fk === window.FaseKleuren.get(t.tender.fase);
                }) : t.tender.fase;
                if (!this._faseFilter.includes(canonFase)) return false;
            }
            return true;
        });
    }

    _isVisible(taak) {
        if (!this._activeFilter) return true;
        return taak.tender.id === this._activeFilter;
    }

    _deadlineStatus(deadline, fase) {
        const afgerond = ['ingediend', 'archief', 'afronden', 'evaluatie', 'gewonnen', 'verloren'].includes(fase);
        if (afgerond) return { cls: 'kal-dl-done', label: 'Afgerond' };
        if (!deadline) return { cls: 'kal-dl-ok', label: 'Geen deadline' };
        const dagenOver = Math.round((this._stripTime(deadline) - this._today) / 86400000);
        if (dagenOver < 0) return { cls: 'kal-dl-done', label: 'Verlopen' };
        if (dagenOver === 0) return { cls: 'kal-dl-urg', label: 'Vandaag' };
        if (dagenOver <= 7) return { cls: 'kal-dl-urg', label: deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) };
        if (dagenOver <= 21) return { cls: 'kal-dl-warn', label: deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) };
        return { cls: 'kal-dl-ok', label: deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) };
    }

    _getPeriodLabel() {
        if (this._mode === 'maand') {
            const ms = new Date(this._today.getFullYear(), this._today.getMonth() + this._offset, 1);
            return ms.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
        }
        const ws = this._getMaandag(this._today);
        ws.setDate(ws.getDate() + this._offset * 7);
        const we = new Date(ws);
        we.setDate(ws.getDate() + 6);
        const jan1 = new Date(ws.getFullYear(), 0, 1);
        const weekNr = Math.ceil(((ws - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        return `Week ${weekNr} \u00b7 ${ws.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} \u2013 ${we.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }

    _getMaandag(datum) {
        const d = new Date(datum);
        const dag = d.getDay();
        const diff = d.getDate() - dag + (dag === 0 ? -6 : 1);
        return new Date(d.getFullYear(), d.getMonth(), diff);
    }

    _datumNaarString(dag) {
        const y = dag.getFullYear();
        const m = String(dag.getMonth() + 1).padStart(2, '0');
        const d = String(dag.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    _parseDatum(datumStr) {
        if (!datumStr) return null;
        const [y, m, d] = datumStr.split('-').map(Number);
        return new Date(y, m - 1, d, 0, 0, 0, 0); // lokale tijd, geen UTC
    }

    _stripTime(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    _sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
               a.getMonth() === b.getMonth() &&
               a.getDate() === b.getDate();
    }

    _lightenColor(hex) {
        const map = {
            '#7C3AED': '#F5F3FF', '#6366F1': '#EEF2FF', '#A855F7': '#FAF5FF',
            '#10B981': '#ECFDF5', '#F97316': '#FFF7ED', '#3B82F6': '#EFF6FF',
            '#EC4899': '#FDF2F8', '#EF4444': '#FEF2F2', '#14B8A6': '#F0FDFA',
            '#F59E0B': '#FFFBEB', '#ea580c': '#FFF7ED', '#16a34a': '#F0FDF4',
            '#0d9488': '#F0FDFA', '#64748b': '#F8FAFC',
        };
        return map[hex] || map[hex?.toLowerCase()] || '#F9FAFB';
    }

    _escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _fixDetailPanelFlip() {
        if (!this._container) return;
        requestAnimationFrame(() => {
            this._container?.querySelectorAll('.kal-chip-wrap').forEach(wrap => {
                const rect = wrap.getBoundingClientRect();
                if (rect.left + rect.width + 296 > window.innerWidth) {
                    wrap.classList.add('kal-flip-left');
                }
            });
        });
    }

    // ─── DRAG & DROP ────────────────────────────────────────────

    _bindDragDrop() {
        if (!this._container) return;

        // DRAG START
        this._container.querySelectorAll('.kal-chip[draggable="true"]').forEach(chip => {
            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('taakId', chip.dataset.taakId);
                e.dataTransfer.setData('datum', chip.dataset.datum);
                chip.classList.add('kal-chip-dragging');
            });
            chip.addEventListener('dragend', () => {
                chip.classList.remove('kal-chip-dragging');
                this._container.querySelectorAll('.kal-drop-target')
                    .forEach(el => el.classList.remove('kal-drop-target'));
            });
        });

        // DRAG OVER / LEAVE / DROP op dagcellen
        this._container.querySelectorAll('[data-datum]').forEach(cel => {
            // Skip chips zelf — alleen containercellen
            if (cel.classList.contains('kal-chip')) return;

            cel.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cel.classList.add('kal-drop-target');
            });
            cel.addEventListener('dragleave', (e) => {
                // Voorkom flikkering bij kind-elementen
                if (!cel.contains(e.relatedTarget)) {
                    cel.classList.remove('kal-drop-target');
                }
            });
            cel.addEventListener('drop', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                cel.classList.remove('kal-drop-target');

                const taakId = e.dataTransfer.getData('taakId');
                const oudeDatum = e.dataTransfer.getData('datum');
                const nieuweDatum = cel.dataset.datum;

                console.log('DROP:', { taakId, oudeDatum, nieuweDatum });

                if (!taakId || !nieuweDatum || nieuweDatum === oudeDatum) {
                    console.log('DROP: geen actie nodig');
                    return;
                }

                // 1. Optimistic update — verplaats lokaal en herrender
                this._verplaatsTaakLokaal(taakId, nieuweDatum);
                this._renderGrid();

                try {
                    // 2. API call
                    await window.planningService.updatePlanningTaak(taakId, { datum: nieuweDatum });
                    console.log('DROP: API succesvol');

                    // 3. Invalideer cache zodat Agenda en Gantt ook bijwerken
                    window.planningService?.invalidateCache?.();
                    await window.app?.agendaView?.loadData?.();
                    this._tasks = this._processTasks(window.app?.agendaView?.tenders || []);
                    this._renderGrid();
                } catch (err) {
                    console.error('DROP: API mislukt, revert', err);
                    this._verplaatsTaakLokaal(taakId, oudeDatum);
                    this._renderGrid();
                }
            });
        });
    }

    _verplaatsTaakLokaal(taakId, nieuweDatumStr) {
        const nieuweDate = this._parseDatum(nieuweDatumStr);
        this._tasks = this._tasks.map(taak => {
            if (taak.id !== taakId) return taak;
            return { ...taak, start: nieuweDate, eind: nieuweDate };
        });
    }

    _faseKleur(fase) {
        if (window.FaseKleuren) return window.FaseKleuren.get(fase).kleur;
        const map = {
            acquisitie:     '#ea580c',
            inschrijvingen: '#7c3aed',
            ingediend:      '#16a34a',
            evaluatie:      '#0d9488',
            afronden:       '#0d9488',
            archief:        '#64748b',
        };
        return map[(fase || '').toLowerCase()] || '#7c3aed';
    }
}

window.KalenderView = KalenderView;
