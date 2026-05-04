/* ============================================================
   TCC_TabImplementatiePlanning.js  —  v1.0
   Project Implementatieplanning tab voor Tender Command Center

   Exporteert globaal:
     renderTabImplementatieplanning(data)   — initieel shell-panel
     handleIpAIGenereer()                   — open AI-generatie modal
     handleIpAIGenereerStart()              — verstuur AI-generatie request
     handleIpAIGenereerClose()              — sluit AI-modal
     handleIpHandmatigStart()               — handmatig beginnen (lege sectie)
     handleIpTaakOpen(taakId)               — open taak bewerk-modal
     handleIpTaakSave()                     — sla taak op (add of edit)
     handleIpTaakClose()                    — sluit taak modal
     handleIpTaakVerwijder(taakId)          — verwijder taak
     handleIpSectieOpen(sectieId)           — open sectie modal
     handleIpSectieVerwijder(sectieId)      — verwijder sectie
     handleIpExportExcel()                  — download Excel
     handleIpExportPDF()                    — download PDF

   Vereist toevoeging in TCC_Core.js:
     _getNavItems: { key:'implementatieplanning', icon:'barChart', ... }
     renderTcc body: ${renderTabImplementatieplanning(data)}
     _switchTab: if (tabKey==='implementatieplanning') setTimeout(()=>_ipInit(tccState.tenderId),150)
     initTccEvents switch: ip-* cases (zie onderaan dit bestand)
   ============================================================ */

// ── Interne state ──────────────────────────────────────────────────────────

const _ipState = {
    tenderId:     null,
    planning:     null,   // { metadata, secties: [{...taken:[]}] }
    status:       'loading',  // 'loading' | 'leeg' | 'data'
    editingTaak:  null,   // {taakId, sectieId} of null bij nieuw
    editingSectie: null,  // sectieId of null bij nieuw
    chatModus:    'aanpas', // 'aanpas' | 'vraag'
    zoom:         'week',   // 'dag' | 'week' | 'maand' | 'kwartaal' | 'jaar'
    schaal:       1.0,      // Gantt-breedte vermenigvuldiger, bereik 0.5–4.0
    isFullscreen: false,    // bewaakt de fullscreen-toggle; DOM-klasse is onbetrouwbaar na verplaatsing
    kolomBreedtes: { nr: 48, taak: 280, verantwoordelijke: 180, status: 90, datum: 115 },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function _ipGetPanel() {
    return tccState.overlay?.querySelector('[data-panel="implementatieplanning"]');
}

function _ipGetContainer() {
    return _ipGetPanel()?.querySelector('#ip-container');
}

// Vindt de actieve .ip-wrap — in fullscreen staat die in <body>, anders in #ip-container.
function _ipGetWrap() {
    return document.body.querySelector('.ip-wrap.ip-fullscreen')
        || _ipGetPanel()?.querySelector('.ip-wrap')
        || document.querySelector('#ip-container .ip-wrap');
}

function _ipSetContainer(html) {
    const fsWrap = document.body.querySelector('.ip-wrap.ip-fullscreen');
    if (fsWrap) { fsWrap.innerHTML = html; return; }
    const el = _ipGetContainer();
    if (el) el.innerHTML = html;
}

function _ipParseDatum(str) {
    if (!str) return null;
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function _ipFormatDatum(str) {
    if (!str) return '—';
    const d = _ipParseDatum(str);
    if (!d) return str;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

function _ipFormatKort(str) {
    if (!str) return '';
    const d = _ipParseDatum(str);
    if (!d) return str;
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

function _ipBerekenPositie(startdatum, einddatum) {
    const meta = _ipState.planning?.metadata;
    if (!meta?.planstart || !meta?.planeinde) return { left: '0%', width: '100%' };
    const ps = _ipParseDatum(meta.planstart);
    const pe = _ipParseDatum(meta.planeinde);
    const ts = _ipParseDatum(startdatum);
    const te = _ipParseDatum(einddatum);
    if (!ps || !pe || !ts || !te) return { left: '0%', width: '4%' };
    const totaalMs = pe - ps;
    if (totaalMs <= 0) return { left: '0%', width: '100%' };
    const leftPct  = ((ts - ps) / totaalMs) * 100;
    const widthPct = ((te - ts) / totaalMs) * 100;
    return {
        left:  Math.max(0, leftPct).toFixed(2) + '%',
        width: Math.max(0.5, widthPct).toFixed(2) + '%',
    };
}

function _ipVandaagPositie() {
    const meta = _ipState.planning?.metadata;
    if (!meta?.planstart || !meta?.planeinde) return null;
    const ps = _ipParseDatum(meta.planstart);
    const pe = _ipParseDatum(meta.planeinde);
    const nu = new Date();
    nu.setHours(0, 0, 0, 0);
    const totaalMs = pe - ps;
    if (totaalMs <= 0 || nu < ps || nu > pe) return null;
    return ((nu - ps) / totaalMs * 100).toFixed(2) + '%';
}

// ── Gantt wrap helper (werkt ook in fullscreen) ────────────────────────────

function _ipGetGanttWrap() {
    return _ipGetPanel()?.querySelector('.ip-gantt-wrap')
        || document.body.querySelector('.ip-wrap.ip-fullscreen .ip-gantt-wrap');
}

// ── Kolombreedtes — zet CSS-variabelen op .ip-gantt-wrap ──────────────────

function _ipApplyKolomBreedtes() {
    const wrap = _ipGetGanttWrap();
    if (!wrap) return;
    const b = _ipState.kolomBreedtes;
    wrap.style.setProperty('--ip-col-nr',      b.nr + 'px');
    wrap.style.setProperty('--ip-col-taak',    b.taak + 'px');
    wrap.style.setProperty('--ip-col-verantw', b.verantwoordelijke + 'px');
    wrap.style.setProperty('--ip-col-status',  b.status + 'px');
    wrap.style.setProperty('--ip-col-datum',   b.datum + 'px');
    // Gantt-kolom breedte meteen meeschaald
    wrap.style.setProperty('--ip-gantt-kolom-breedte', (_IP_GANTT_BASIS_BREEDTE * _ipState.schaal) + 'px');
}

// ── Gantt-schaal — zet de breedte van de Gantt-kolom via CSS-variabele ────

const _IP_GANTT_BASIS_BREEDTE = 600; // px bij schaal 1.0

function _ipSetSchaal(waarde) {
    _ipState.schaal = waarde;

    // Slider syncen
    const slider = _ipGetWrap()?.querySelector('#ip-schaal-slider');
    if (slider) slider.value = waarde;

    // Gantt-kolom min-breedte bijwerken via CSS-variabele op .ip-gantt-wrap
    const ganttWrap = _ipGetGanttWrap();
    if (ganttWrap) {
        ganttWrap.style.setProperty('--ip-gantt-kolom-breedte', (_IP_GANTT_BASIS_BREEDTE * waarde) + 'px');
    }
}

// ── ISO weeknummer ─────────────────────────────────────────────────────────

function _ipWeekNummer(d) {
    const t = new Date(d.getTime());
    t.setHours(0, 0, 0, 0);
    t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
    const w1 = new Date(t.getFullYear(), 0, 4);
    return 1 + Math.round(((t - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

// ── Tijdlijn periodes genereren ────────────────────────────────────────────

function _ipGenereerTijdlijn(planstart, planeinde, zoom) {
    const ps = _ipParseDatum(planstart);
    const pe = _ipParseDatum(planeinde);
    if (!ps || !pe || pe <= ps) return { groepen: [], ticks: [] };
    const totaalMs = pe - ps;
    const MAANDEN  = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

    function clip(s, e) {
        const cs = Math.max(s instanceof Date ? s.getTime() : s, ps.getTime());
        const ce = Math.min(e instanceof Date ? e.getTime() : e, pe.getTime());
        if (ce <= cs) return null;
        return {
            l: ((cs - ps) / totaalMs * 100).toFixed(2),
            w: ((ce - cs) / totaalMs * 100).toFixed(2),
        };
    }

    const ticks = [], groepen = [];

    if (zoom === 'dag') {
        // Ticks: dagen
        const cur = new Date(ps);
        while (cur < pe) {
            const nxt = new Date(cur); nxt.setDate(nxt.getDate() + 1);
            const p = clip(cur, nxt);
            if (p) ticks.push({ label: cur.getDate().toString(), leftPct: p.l, breedtePct: p.w });
            cur.setDate(cur.getDate() + 1);
        }
        // Groepen: weken (maandag als start)
        const wc = new Date(ps);
        const wd0 = wc.getDay();
        wc.setDate(wc.getDate() - (wd0 === 0 ? 6 : wd0 - 1));
        while (wc < pe) {
            const wnd = new Date(wc); wnd.setDate(wnd.getDate() + 7);
            const p = clip(wc, wnd);
            if (p) groepen.push({ label: 'W' + _ipWeekNummer(wc), leftPct: p.l, breedtePct: p.w });
            wc.setDate(wc.getDate() + 7);
        }

    } else if (zoom === 'week') {
        // Ticks: weken
        const wc = new Date(ps);
        const wd = wc.getDay();
        wc.setDate(wc.getDate() - (wd === 0 ? 6 : wd - 1));
        while (wc < pe) {
            const wnd = new Date(wc); wnd.setDate(wnd.getDate() + 7);
            const p = clip(wc, wnd);
            if (p) ticks.push({ label: 'W' + _ipWeekNummer(wc), leftPct: p.l, breedtePct: p.w });
            wc.setDate(wc.getDate() + 7);
        }
        // Groepen: maanden
        const mc = new Date(ps.getFullYear(), ps.getMonth(), 1);
        while (mc < pe) {
            const mnd = new Date(mc.getFullYear(), mc.getMonth() + 1, 1);
            const p = clip(mc, mnd);
            if (p) groepen.push({ label: MAANDEN[mc.getMonth()], leftPct: p.l, breedtePct: p.w });
            mc.setMonth(mc.getMonth() + 1);
        }

    } else if (zoom === 'maand') {
        // Ticks: maanden
        const mc = new Date(ps.getFullYear(), ps.getMonth(), 1);
        while (mc < pe) {
            const mnd = new Date(mc.getFullYear(), mc.getMonth() + 1, 1);
            const p = clip(mc, mnd);
            if (p) ticks.push({ label: MAANDEN[mc.getMonth()], leftPct: p.l, breedtePct: p.w });
            mc.setMonth(mc.getMonth() + 1);
        }
        // Groepen: jaren
        const yc = new Date(ps.getFullYear(), 0, 1);
        while (yc < pe) {
            const ynd = new Date(yc.getFullYear() + 1, 0, 1);
            const p = clip(yc, ynd);
            if (p) groepen.push({ label: yc.getFullYear().toString(), leftPct: p.l, breedtePct: p.w });
            yc.setFullYear(yc.getFullYear() + 1);
        }

    } else if (zoom === 'kwartaal') {
        // Ticks: kwartalen
        const startQ = Math.floor(ps.getMonth() / 3);
        const qc = new Date(ps.getFullYear(), startQ * 3, 1);
        while (qc < pe) {
            const qnd = new Date(qc.getFullYear(), qc.getMonth() + 3, 1);
            const q   = Math.floor(qc.getMonth() / 3) + 1;
            const p   = clip(qc, qnd);
            if (p) ticks.push({ label: 'Q' + q + ' ' + qc.getFullYear(), leftPct: p.l, breedtePct: p.w });
            qc.setMonth(qc.getMonth() + 3);
        }
        // Geen groepen: kwartaal-label bevat al het jaar

    } else if (zoom === 'jaar') {
        // Ticks: jaren
        const yc = new Date(ps.getFullYear(), 0, 1);
        while (yc < pe) {
            const ynd = new Date(yc.getFullYear() + 1, 0, 1);
            const p   = clip(yc, ynd);
            if (p) ticks.push({ label: yc.getFullYear().toString(), leftPct: p.l, breedtePct: p.w });
            yc.setFullYear(yc.getFullYear() + 1);
        }
    }

    return { groepen, ticks };
}

// ── Gantt timeline HTML (in kolom-header) ─────────────────────────────────

function _ipRenderTimeline(meta) {
    if (!meta?.planstart || !meta?.planeinde) {
        return '<span class="ip-tl-leeg">Gantt</span>';
    }
    const { groepen, ticks } = _ipGenereerTijdlijn(
        meta.planstart, meta.planeinde, _ipState.zoom || 'week'
    );

    const groepenHtml = groepen.map(g =>
        `<div class="ip-tl-item ip-tl-groep-item" style="left:${g.leftPct}%;width:${g.breedtePct}%;">${_ipEsc(g.label)}</div>`
    ).join('');

    const ticksHtml = ticks.map(t =>
        `<div class="ip-tl-item ip-tl-tick-item" style="left:${t.leftPct}%;width:${t.breedtePct}%;">${_ipEsc(t.label)}</div>`
    ).join('');

    return `
    <div class="ip-gantt-timeline">
        ${groepen.length ? `<div class="ip-tl-groepen">${groepenHtml}</div>` : ''}
        <div class="ip-tl-ticks">${ticksHtml}</div>
    </div>`;
}

// ── Zoom pills HTML ────────────────────────────────────────────────────────

function _ipRenderZoomPills() {
    const LABELS = { dag: 'Dag', week: 'Week', maand: 'Maand', kwartaal: 'Kwartaal', jaar: 'Jaar' };
    const huidig = _ipState.zoom || 'week';
    return Object.entries(LABELS).map(([z, lbl]) =>
        `<button class="ip-zoom-pill${huidig === z ? ' actief' : ''}"
                 data-action="ip-zoom" data-zoom="${z}">${lbl}</button>`
    ).join('');
}

function _ipStatusBadge(status) {
    const map = {
        open:          ['ip-status-badge--open',          'Open'],
        in_uitvoering: ['ip-status-badge--in_uitvoering', 'In uitvoering'],
        afgerond:      ['ip-status-badge--afgerond',      'Afgerond'],
    };
    const [cls, lbl] = map[status] || map.open;
    return `<span class="ip-status-badge ${cls}">${lbl}</span>`;
}

function _ipEsc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function _ipTotaalTaken() {
    return (_ipState.planning?.secties || []).reduce((s, sec) => s + (sec.taken?.length || 0), 0);
}

function _ipTotaalAfgerond() {
    return (_ipState.planning?.secties || []).reduce((s, sec) =>
        s + (sec.taken || []).filter(t => t.status === 'afgerond').length, 0);
}

// ── API ────────────────────────────────────────────────────────────────────

async function _ipApiCall(path, options = {}) {
    return tccApiCall(path, options);
}

// ── Initialisatie (lazy load bij tab wisselen) ─────────────────────────────

async function _ipInit(tenderId) {
    _ipState.tenderId = tenderId;
    _ipState.status   = 'loading';
    _ipSetContainer(`
        <div class="ip-loading">
            <span class="ip-spinner"></span>
            <span>Implementatieplanning laden…</span>
        </div>`);

    try {
        const data = await _ipApiCall(`/api/v1/implementatieplanning/${tenderId}`);
        _ipState.planning = data;
        _ipState.status   = (data.secties && data.secties.length > 0) ? 'data' : 'leeg';
    } catch (e) {
        _ipState.planning = { metadata: null, secties: [] };
        _ipState.status   = 'leeg';
        console.warn('[IP] Laden mislukt:', e);
    }

    _ipRerender();
    _ipBindEvents();
}

function _ipRerender() {
    const container = _ipGetContainer();
    if (!container) return;

    switch (_ipState.status) {
        case 'loading': container.innerHTML = _ipRenderLoading(); break;
        case 'leeg':    container.innerHTML = _ipRenderLeeg();    break;
        case 'data':    container.innerHTML = _ipRenderData();    break;
        default:        container.innerHTML = _ipRenderLeeg();
    }

    // In fullscreen staat .ip-wrap in <body> i.p.v. in #ip-container.
    // De nieuwe content staat nu in de verborgen container — swap naar de zichtbare body-wrap.
    const fsWrap = document.body.querySelector('.ip-wrap.ip-fullscreen');
    if (fsWrap) {
        const newWrap = container.querySelector('.ip-wrap');
        if (newWrap) {
            // Vervang de body-wrap door de nieuwe (met fullscreen klasse)
            newWrap.classList.add('ip-fullscreen');
            fsWrap.replaceWith(newWrap);
            // _ipFullscreenClose() plaatst de wrap terug in container
            _ipFullscreenWrapParent = container;
            _ipFullscreenWrapNext   = null;
        } else {
            // loading/leeg staat: update de bestaande body-wrap inline
            fsWrap.innerHTML = container.innerHTML;
        }
    }

    _ipBindEvents();
    if (_ipState.status === 'data') _ipApplyKolomBreedtes();
}

// ── RENDER: lege staat ─────────────────────────────────────────────────────

function _ipRenderLoading() {
    return `
    <div class="ip-loading">
        <span class="ip-spinner"></span>
        <span>Laden…</span>
    </div>`;
}

function _ipRenderLeeg() {
    const tender = tccState.data?.tender || {};
    return `
    <div class="ip-leeg">
        <div class="ip-leeg-icon">${tccIcon('barChart', 42, '#94a3b8')}</div>
        <h3>Nog geen implementatieplanning</h3>
        <p>Genereer automatisch een planning op basis van de tender, of begin handmatig.</p>
        <div class="ip-leeg-acties">
            <button class="ip-btn ip-btn--primary" data-action="ip-ai-genereer">
                ${tccIcon('sparkles', 13, '#fff')} AI-planning genereren <em style="font-size:10px;opacity:.75">(aanbevolen)</em>
            </button>
            <button class="ip-btn ip-btn--secondary" data-action="ip-handmatig-start">
                ${tccIcon('plus', 13)} Handmatig beginnen
            </button>
        </div>
    </div>`;
}

// ── RENDER: data (Gantt) ───────────────────────────────────────────────────

function _ipRenderData() {
    const planning = _ipState.planning;
    const meta     = planning?.metadata || {};
    const secties  = planning?.secties  || [];

    const aiBanner = meta.ai_gegenereerd ? `
    <div class="ip-ai-banner">
        <span class="ip-ai-banner-icon">${tccIcon('sparkles', 13, '#7c3aed')}</span>
        <span class="ip-ai-banner-text">Gegenereerd met AI</span>
        <span class="ip-ai-banner-datum">${_ipFormatDatum(meta.ai_gegenereerd_op)}</span>
    </div>` : '';

    const projectnaam = _ipEsc(meta.projectnaam   || tccState.data?.tender?.naam || 'Project');
    const opdrachtgever = _ipEsc(meta.opdrachtgever || '');
    const periode = (meta.planstart && meta.planeinde)
        ? `${_ipFormatKort(meta.planstart)} – ${_ipFormatKort(meta.planeinde)}`
        : '';

    const totaal    = _ipTotaalTaken();
    const afgerond  = _ipTotaalAfgerond();

    const ganttBody = secties.map(s => _ipRenderSectie(s)).join('');

    return `
    <div class="ip-wrap">
        ${aiBanner}
        <div class="ip-toolbar">
            <div class="ip-toolbar-meta">
                <div class="ip-toolbar-project">${projectnaam}${opdrachtgever ? ` <span style="font-weight:400;color:#64748b;">· ${opdrachtgever}</span>` : ''}</div>
                ${periode ? `<div class="ip-toolbar-periode">${_ipEsc(periode)}</div>` : ''}
            </div>
            <div class="ip-zoom-pills" id="ip-zoom-pills">
                ${_ipRenderZoomPills()}
            </div>
            <div class="ip-schaal-control">
                <button class="ip-schaal-btn" data-action="ip-schaal-min" title="Zoom uit">−</button>
                <input type="range" class="ip-schaal-slider" id="ip-schaal-slider"
                       min="0.5" max="4" step="0.25" value="${_ipState.schaal}"
                       data-action="ip-schaal-slider">
                <button class="ip-schaal-btn" data-action="ip-schaal-plus" title="Zoom in">+</button>
            </div>
            <div class="ip-toolbar-actions">
                <button class="ip-btn ip-btn--secondary" data-action="ip-sectie-open" data-sectie-id="">
                    ${tccIcon('plus', 12)} Sectie
                </button>
                <button class="ip-btn ip-btn--secondary" data-action="ip-taak-open" data-taak-id="">
                    ${tccIcon('plus', 12)} Taak
                </button>
                <button class="ip-btn ip-btn--primary" data-action="ip-ai-genereer">
                    ${tccIcon('sparkles', 12, '#fff')} AI-planning
                </button>
                <button class="ip-btn ip-btn--secondary" data-action="ip-chat-toggle"
                        title="Verfijn planning met AI">
                    ${tccIcon('sparkles', 12, '#7c3aed')} Verfijnen
                </button>
                <button class="ip-btn ip-btn--secondary" data-action="ip-export-excel">
                    ${tccIcon('download', 12)} Excel
                </button>
                <button class="ip-btn ip-btn--secondary" data-action="ip-export-pdf">
                    ${tccIcon('fileText', 12)} PDF
                </button>
                <button class="ip-btn--fullscreen" data-action="ip-fullscreen"
                        title="Volledig scherm">
                    ${_ipIconMaximize()}
                </button>
            </div>
        </div>

        <div class="ip-main-layout" id="ip-main-layout">
            <div class="ip-gantt-wrap" id="ip-gantt-wrap">
                <!-- Kolom headers met resize handles -->
                <div class="ip-col-header" id="ip-col-header">
                    <div class="ip-th" data-col="nr">Nr
                        <div class="ip-col-resize-handle" data-col="nr"></div>
                    </div>
                    <div class="ip-th" data-col="taak">Taak
                        <div class="ip-col-resize-handle" data-col="taak"></div>
                    </div>
                    <div class="ip-th" data-col="verantw">Verantwoordelijke
                        <div class="ip-col-resize-handle" data-col="verantw"></div>
                    </div>
                    <div class="ip-th ip-th--center" data-col="status">Status
                        <div class="ip-col-resize-handle" data-col="status"></div>
                    </div>
                    <div class="ip-th" data-col="datum">Datum
                        <div class="ip-col-resize-handle" data-col="datum"></div>
                    </div>
                    <div class="ip-col-header-gantt" id="ip-col-header-gantt">
                        <div id="ip-gantt-timeline-wrap">${_ipRenderTimeline(meta)}</div>
                    </div>
                </div>

                ${ganttBody || '<div class="ip-sectie-leeg" style="padding:24px 16px;">Geen secties. Voeg een sectie toe.</div>'}
            </div>

            ${_ipRenderChatPaneel(secties)}
        </div>

        <div class="ip-footer-tel">
            <span>${totaal} taken</span>
            <span>${afgerond} afgerond</span>
            <span>${totaal - afgerond} open</span>
        </div>
    </div>`;
}

function _ipRenderChatPaneel(secties) {
    const aantalSecties = secties?.length || 0;
    const aantalTaken   = (secties || []).reduce((s, sec) => s + (sec.taken?.length || 0), 0);

    return `
    <div class="ip-chat-paneel" id="ip-chat-paneel" style="display:none;">
        <div class="ip-chat-header">
            <div class="ip-chat-icon">${tccIcon('sparkles', 11, '#fff')}</div>
            <span class="ip-chat-title">Planning verfijnen</span>
            <select id="ip-chat-model" class="ip-chat-model-select">
                <option value="claude-sonnet-4-6">Sonnet</option>
                <option value="claude-haiku-4-5-20251001">Haiku</option>
                <option value="claude-opus-4-6">Opus</option>
            </select>
            <button class="ip-chat-close-btn" data-action="ip-chat-toggle"
                    title="Chat sluiten">
                ${tccIcon('close', 13)}
            </button>
        </div>

        <div class="ip-chat-msgs" id="ip-chat-msgs">
            <div class="ip-msg ip-msg-ai">
                <span class="ip-msg-label">AI</span>
                Planning geladen met ${aantalSecties} secties en ${aantalTaken} taken.
                Wat wil je aanpassen?
            </div>
        </div>

        <div class="ip-chat-suggestions" id="ip-chat-sugs">
            ${_ipChatSuggesties('aanpas')}
        </div>

        <div class="ip-chat-modus-bar">
            <button class="ip-modus-btn actief-aanpas" data-action="ip-chat-modus"
                    data-modus="aanpas" title="Pas de planning aan">
                ${tccIcon('edit', 11, 'currentColor')} Aanpassen
            </button>
            <button class="ip-modus-btn" data-action="ip-chat-modus"
                    data-modus="vraag" title="Stel een vraag over de planning">
                ${tccIcon('helpCircle', 11, 'currentColor')} Vragen
            </button>
        </div>

        <div class="ip-chat-hint" id="ip-chat-hint">
            Beschrijf wat je wilt wijzigen in de planning.
        </div>

        <div class="ip-chat-input-wrap">
            <textarea id="ip-chat-input" class="ip-chat-textarea"
                      placeholder="Pas de planning aan..." rows="2"></textarea>
            <button class="ip-chat-send" data-action="ip-chat-stuur"
                    title="Versturen">
                ${tccIcon('chevronRight', 13, '#fff')}
            </button>
        </div>
    </div>`;
}

function _ipRenderSectie(sectie) {
    const kleur   = sectie.kleur || '#c7d2fe';
    const taken   = sectie.taken || [];

    const taken_html = taken.length > 0
        ? taken.map(t => _ipRenderTaakRij(t, kleur)).join('')
        : `<div class="ip-sectie-leeg">Geen taken in deze sectie</div>`;

    return `
    <div class="ip-sectie-blok" data-sectie-id="${_ipEsc(sectie.id)}">
        <div class="ip-sectie-header" style="background:${_ipEsc(kleur)}22; border-left:3px solid ${_ipEsc(kleur)};">
            <span class="ip-sectie-naam">${_ipEsc(sectie.naam)}</span>
            <div class="ip-sectie-acties">
                <button class="ip-btn ip-btn--ghost" data-action="ip-taak-open"
                        data-taak-id="" data-sectie-id="${_ipEsc(sectie.id)}"
                        title="Taak toevoegen">${tccIcon('plus', 12)}</button>
                <button class="ip-btn ip-btn--ghost" data-action="ip-sectie-open"
                        data-sectie-id="${_ipEsc(sectie.id)}"
                        title="Sectie bewerken">${tccIcon('edit', 12)}</button>
                <button class="ip-btn ip-btn--ghost" data-action="ip-sectie-verwijder"
                        data-sectie-id="${_ipEsc(sectie.id)}"
                        title="Sectie verwijderen">${tccIcon('trash', 12)}</button>
            </div>
        </div>
        ${taken_html}
    </div>`;
}

function _ipRenderTaakRij(taak, sectieKleur) {
    const pos     = (taak.startdatum && taak.einddatum)
        ? _ipBerekenPositie(taak.startdatum, taak.einddatum)
        : null;
    const vandaag = _ipVandaagPositie();

    const ganttBar = pos
        ? `<div class="ip-gantt-bar" style="left:${pos.left};width:${pos.width};background:${sectieKleur};"></div>`
        : '';
    const vandaagLijn = vandaag
        ? `<div class="ip-vandaag-lijn" style="left:${vandaag};"></div>`
        : '';

    const startKort = taak.startdatum ? _ipFormatKort(taak.startdatum) : '';
    const eindeKort = taak.einddatum  ? _ipFormatKort(taak.einddatum)  : '';
    const datumTxt  = startKort && eindeKort ? `${startKort} – ${eindeKort}` : (startKort || '');

    return `
    <div class="ip-gantt-row" data-taak-id="${_ipEsc(taak.id)}"
         data-action="ip-taak-open">
        <div class="ip-taak-cel ip-taak-cel--nr">${_ipEsc(taak.nummer || '')}</div>
        <div class="ip-taak-cel ip-taak-cel--naam">${_ipEsc(taak.naam)}</div>
        <div class="ip-taak-cel ip-taak-cel--verantw">${_ipEsc(taak.verantwoordelijke || '')}</div>
        <div class="ip-taak-cel ip-taak-cel--status">${_ipStatusBadge(taak.status)}</div>
        <div class="ip-taak-cel ip-taak-cel--datum">${_ipEsc(datumTxt)}</div>
        <div class="ip-taak-cel ip-taak-cel--gantt">
            <div class="ip-gantt-bar-container">
                ${vandaagLijn}
                ${ganttBar}
            </div>
        </div>
    </div>`;
}

// ── RENDER: AI-generatie modal ─────────────────────────────────────────────

function _ipRenderAIModal() {
    const tender = tccState.data?.tender || {};
    const omschrijving = _ipEsc((tender.omschrijving || '').substring(0, 400));
    const vandaag = new Date().toISOString().split('T')[0];

    return `
    <div class="ip-modal-overlay" id="ip-modal-overlay">
        <div class="ip-modal">
            <div class="ip-modal-header">
                <span class="ip-modal-titel">${tccIcon('sparkles', 15, '#7c3aed')} AI-planning genereren</span>
                <button class="ip-btn ip-btn--ghost" data-action="ip-ai-genereer-close">
                    ${tccIcon('close', 14)}
                </button>
            </div>
            <div class="ip-modal-body">
                ${omschrijving ? `
                <div class="ip-veld">
                    <label>Tenderomschrijving (preview)</label>
                    <textarea readonly rows="3" style="font-size:11px;color:#475569;">${omschrijving}</textarea>
                </div>` : ''}

                <div class="ip-veld">
                    <label>Documenten uploaden (optioneel — PDF/Word, max 5 MB per bestand, max 5 bestanden)</label>
                    <div class="doc-dropzone ip-dropzone" id="ip-dropzone">
                        <div class="doc-dropzone-inner">
                            ${tccIcon('upload', 20, '#7c3aed')}
                            <div class="doc-dropzone-tekst">
                                <span class="doc-dropzone-hoofd">Sleep bestanden hierheen</span>
                                <span class="doc-dropzone-sub">of <button class="doc-dropzone-knop" id="ip-upload-knop">klik om te kiezen</button></span>
                            </div>
                            <div class="doc-dropzone-hint">PDF, Word — max 5 MB · max 5 bestanden</div>
                        </div>
                        <input type="file" id="ip-doc-input" accept=".pdf,.docx,.doc"
                               multiple style="display:none;">
                    </div>
                    <div id="ip-doc-lijst" style="display:none;margin-top:6px;"></div>
                </div>

                <div class="ip-veld-rij">
                    <div class="ip-veld">
                        <label>Projectnaam</label>
                        <input type="text" id="ip-gen-projectnaam"
                               value="${_ipEsc(tender.naam || '')}"
                               placeholder="Bijv. Sarphatihuis">
                    </div>
                    <div class="ip-veld">
                        <label>Opdrachtgever</label>
                        <input type="text" id="ip-gen-opdrachtgever"
                               value="${_ipEsc(tender.opdrachtgever || '')}"
                               placeholder="Bijv. Gemeente Amsterdam">
                    </div>
                </div>
                <div class="ip-veld-rij">
                    <div class="ip-veld">
                        <label>Opdrachtnemer</label>
                        <input type="text" id="ip-gen-opdrachtnemer"
                               placeholder="Bijv. Snijder B.V.">
                    </div>
                    <div class="ip-veld">
                        <label>Startdatum project</label>
                        <input type="date" id="ip-gen-planstart" value="${vandaag}">
                    </div>
                </div>

                <div class="ip-veld">
                    <label>AI-model</label>
                    <select id="ip-gen-model">
                        <option value="claude-haiku-4-5-20251001">Haiku — snel &amp; efficiënt (standaard)</option>
                        <option value="claude-sonnet-4-6">Sonnet — slimmer, complexe planningen</option>
                        <option value="claude-opus-4-6">Opus — meest capabel, grote aanbestedingen</option>
                    </select>
                    <span style="font-size:11px;color:#94a3b8;margin-top:2px;">
                        Sonnet aanbevolen bij uitgebreide aanbestedingsdocumenten
                    </span>
                </div>

                <div id="ip-gen-status" style="display:none;text-align:center;padding:12px 0;">
                    <span class="ip-spinner"></span>
                    <span style="margin-left:8px;color:#64748b;font-size:13px;">
                        AI genereert planning…
                    </span>
                </div>
            </div>
            <div class="ip-modal-footer">
                <button class="ip-btn ip-btn--secondary" data-action="ip-ai-genereer-close">
                    Annuleren
                </button>
                <button class="ip-btn ip-btn--primary" id="ip-gen-btn" data-action="ip-ai-genereer-start">
                    ${tccIcon('sparkles', 13, '#fff')} Genereer planning
                </button>
            </div>
        </div>
    </div>`;
}

// ── RENDER: taak modal ─────────────────────────────────────────────────────

function _ipRenderTaakModal(taak, sectieId) {
    const isNieuw   = !taak;
    const titel     = isNieuw ? 'Taak toevoegen' : 'Taak bewerken';
    const secties   = _ipState.planning?.secties || [];

    const sectieopties = secties.map(s => `
        <option value="${_ipEsc(s.id)}"
            ${(sectieId || taak?.sectie_id) === s.id ? 'selected' : ''}>
            ${_ipEsc(s.naam)}
        </option>`).join('');

    // Bereken dagen (readonly, berekend)
    const berekenDagen = (start, einde) => {
        if (!start || !einde) return '';
        const s = _ipParseDatum(start);
        const e = _ipParseDatum(einde);
        if (!s || !e) return '';
        return Math.max(0, Math.round((e - s) / 86400000)).toString();
    };

    return `
    <div class="ip-modal-overlay" id="ip-modal-overlay">
        <div class="ip-modal">
            <div class="ip-modal-header">
                <span class="ip-modal-titel">${_ipEsc(titel)}</span>
                <button class="ip-btn ip-btn--ghost" data-action="ip-taak-close">
                    ${tccIcon('close', 14)}
                </button>
            </div>
            <div class="ip-modal-body">
                <div class="ip-veld">
                    <label>Sectie <span style="color:#dc2626">*</span></label>
                    <select id="ip-taak-sectie-id">${sectieopties}</select>
                </div>
                <div class="ip-veld-rij">
                    <div class="ip-veld">
                        <label>Nummer</label>
                        <input type="text" id="ip-taak-nummer"
                               value="${_ipEsc(taak?.nummer || '')}"
                               placeholder="bijv. O.1">
                    </div>
                    <div class="ip-veld">
                        <label>Status</label>
                        <select id="ip-taak-status">
                            <option value="open"         ${(!taak || taak.status==='open')         ? 'selected':''}>Open</option>
                            <option value="in_uitvoering" ${taak?.status==='in_uitvoering'          ? 'selected':''}>In uitvoering</option>
                            <option value="afgerond"     ${taak?.status==='afgerond'               ? 'selected':''}>Afgerond</option>
                        </select>
                    </div>
                </div>
                <div class="ip-veld">
                    <label>Naam <span style="color:#dc2626">*</span></label>
                    <input type="text" id="ip-taak-naam"
                           value="${_ipEsc(taak?.naam || '')}"
                           placeholder="Taaknaam">
                </div>
                <div class="ip-veld">
                    <label>Verantwoordelijke</label>
                    <input type="text" id="ip-taak-verantw"
                           value="${_ipEsc(taak?.verantwoordelijke || '')}"
                           placeholder="Bijv. Opdrachtgever + Opdrachtnemer">
                </div>
                <div class="ip-veld">
                    <label>Toelichting</label>
                    <textarea id="ip-taak-toelichting" rows="3"
                              placeholder="Korte toelichting…">${_ipEsc(taak?.toelichting || '')}</textarea>
                </div>
                <div class="ip-veld-rij">
                    <div class="ip-veld">
                        <label>Startdatum</label>
                        <input type="date" id="ip-taak-startdatum"
                               value="${taak?.startdatum || ''}">
                    </div>
                    <div class="ip-veld">
                        <label>Einddatum</label>
                        <input type="date" id="ip-taak-einddatum"
                               value="${taak?.einddatum || ''}">
                    </div>
                </div>
                <div class="ip-veld">
                    <label>Dagen (berekend)</label>
                    <input type="number" id="ip-taak-dagen" readonly
                           value="${berekenDagen(taak?.startdatum, taak?.einddatum)}">
                </div>
            </div>
            <div class="ip-modal-footer">
                ${!isNieuw ? `
                <button class="ip-btn ip-btn--danger" style="margin-right:auto;"
                        data-action="ip-taak-verwijder"
                        data-taak-id="${_ipEsc(taak.id)}">
                    ${tccIcon('trash', 12)} Verwijderen
                </button>` : ''}
                <button class="ip-btn ip-btn--secondary" data-action="ip-taak-close">
                    Annuleren
                </button>
                <button class="ip-btn ip-btn--primary" data-action="ip-taak-save"
                        data-taak-id="${_ipEsc(taak?.id || '')}">
                    ${isNieuw ? 'Toevoegen' : 'Opslaan'}
                </button>
            </div>
        </div>
    </div>`;
}

// ── RENDER: sectie modal ───────────────────────────────────────────────────

function _ipRenderSectieModal(sectie) {
    const isNieuw = !sectie;
    return `
    <div class="ip-modal-overlay" id="ip-modal-overlay">
        <div class="ip-modal">
            <div class="ip-modal-header">
                <span class="ip-modal-titel">${isNieuw ? 'Sectie toevoegen' : 'Sectie bewerken'}</span>
                <button class="ip-btn ip-btn--ghost" data-action="ip-sectie-close">
                    ${tccIcon('close', 14)}
                </button>
            </div>
            <div class="ip-modal-body">
                <div class="ip-veld">
                    <label>Sectienaam <span style="color:#dc2626">*</span></label>
                    <input type="text" id="ip-sectie-naam"
                           value="${_ipEsc(sectie?.naam || '')}"
                           placeholder="Bijv. Initiatiefase">
                </div>
                <div class="ip-veld">
                    <label>Kleur</label>
                    <input type="color" id="ip-sectie-kleur"
                           value="${sectie?.kleur || '#c7d2fe'}"
                           style="height:36px;width:80px;">
                </div>
            </div>
            <div class="ip-modal-footer">
                ${!isNieuw ? `
                <button class="ip-btn ip-btn--danger" style="margin-right:auto;"
                        data-action="ip-sectie-verwijder"
                        data-sectie-id="${_ipEsc(sectie.id)}">
                    ${tccIcon('trash', 12)} Verwijderen
                </button>` : ''}
                <button class="ip-btn ip-btn--secondary" data-action="ip-sectie-close">
                    Annuleren
                </button>
                <button class="ip-btn ip-btn--primary" data-action="ip-sectie-save"
                        data-sectie-id="${_ipEsc(sectie?.id || '')}">
                    ${isNieuw ? 'Toevoegen' : 'Opslaan'}
                </button>
            </div>
        </div>
    </div>`;
}

// ── Modal helpers ──────────────────────────────────────────────────────────

function _ipToonModal(html) {
    const wrap = _ipGetWrap();
    if (!wrap) return;
    document.getElementById('ip-modal-overlay')?.remove();
    wrap.insertAdjacentHTML('beforeend', html);
    // Focus eerste input
    setTimeout(() => wrap.querySelector('#ip-modal-overlay input:not([readonly])')?.focus(), 50);
}

function _ipSluitModal() {
    document.getElementById('ip-modal-overlay')?.remove();
}

// ── Event binding ──────────────────────────────────────────────────────────

function _ipBindEvents() {
    const wrap = _ipGetWrap();
    if (!wrap) return;

    // Dropzone opnieuw binden (vers bij elke modal-open)
    _ipBindDropzone(wrap);

    // Voorkom dubbele bindings op dezelfde wrap-instantie
    if (wrap._ipBound) return;
    wrap._ipBound = true;

    // Datum-berekening in taak modal
    wrap.addEventListener('change', (e) => {
        if (e.target.id === 'ip-taak-startdatum' || e.target.id === 'ip-taak-einddatum') {
            const s  = wrap.querySelector('#ip-taak-startdatum')?.value;
            const e2 = wrap.querySelector('#ip-taak-einddatum')?.value;
            const dagenEl = wrap.querySelector('#ip-taak-dagen');
            if (dagenEl && s && e2) {
                const start = _ipParseDatum(s);
                const einde = _ipParseDatum(e2);
                if (start && einde) {
                    dagenEl.value = Math.max(0, Math.round((einde - start) / 86400000));
                }
            }
        }
    }, { capture: false });

    // Schaal-slider — gebruikt 'input' event, niet click
    const slider = wrap.querySelector('#ip-schaal-slider');
    if (slider) {
        slider.addEventListener('input', (e) => {
            _ipSetSchaal(parseFloat(e.target.value));
        });
    }

    // Resize handles — mousedown per handle, drag op document
    wrap.querySelectorAll('.ip-col-resize-handle').forEach(h => {
        h.addEventListener('mousedown', _ipResizeStart);
    });
}

function _ipBindDropzone(panel) {
    const dropzone = panel?.querySelector('#ip-dropzone');
    const input    = panel?.querySelector('#ip-doc-input');
    const knop     = panel?.querySelector('#ip-upload-knop');
    if (!dropzone || !input) return;

    // Knop → file picker (zonder zone-click te triggeren)
    knop?.addEventListener('click', (e) => {
        e.stopPropagation();
        input.click();
    });

    dropzone.addEventListener('click', () => input.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('doc-dropzone--actief');
    });
    dropzone.addEventListener('dragleave', (e) => {
        if (!dropzone.contains(e.relatedTarget)) {
            dropzone.classList.remove('doc-dropzone--actief');
        }
    });
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('doc-dropzone--actief');
        _ipHandleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => {
        _ipHandleFiles(input.files);
        input.value = '';   // reset zodat hetzelfde bestand opnieuw gekozen kan worden
    });
}

function _ipHandleFiles(fileList) {
    if (!fileList?.length) return;
    const MAX_BESTANDEN = 5;
    const MAX_BYTES     = 5 * 1024 * 1024;

    for (const file of fileList) {
        // Duplicaat op naam overslaan
        if (_ipState._genDocumenten.some(f => f.name === file.name)) continue;

        if (_ipState._genDocumenten.length >= MAX_BESTANDEN) {
            showTccToast(`Maximaal ${MAX_BESTANDEN} documenten toegestaan`, 'warn');
            break;
        }
        if (file.size > MAX_BYTES) {
            showTccToast(`${file.name}: te groot (max 5 MB)`, 'warn');
            continue;
        }
        _ipState._genDocumenten.push(file);
    }
    _ipRenderDocLijst();
}

function _ipRenderDocLijst() {
    const lijst = document.getElementById('ip-doc-lijst');
    if (!lijst) return;
    const docs = _ipState._genDocumenten || [];
    if (docs.length === 0) {
        lijst.style.display = 'none';
        lijst.innerHTML = '';
        return;
    }
    lijst.style.display = 'block';
    lijst.innerHTML = `
        <div class="ip-doc-teller">${docs.length} bestand${docs.length !== 1 ? 'en' : ''} geselecteerd</div>
        ${docs.map((f, i) => `
        <div class="ip-doc-item">
            ${tccIcon('fileText', 12, '#7c3aed')}
            <span class="ip-doc-item-naam">${_ipEsc(f.name)}</span>
            <button class="ip-doc-item-verwijder" data-action="ip-doc-verwijder"
                    data-idx="${i}" title="Verwijderen">
                ${tccIcon('close', 11, '#94a3b8')}
            </button>
        </div>`).join('')}`;
}

function handleIpDocVerwijder(btn) {
    const idx = parseInt(btn?.dataset?.idx, 10);
    if (isNaN(idx) || !_ipState._genDocumenten) return;
    _ipState._genDocumenten.splice(idx, 1);
    _ipRenderDocLijst();
}

// ── Action handlers (publiek, aangeroepen vanuit TCC_Core switch) ──────────

async function handleIpAIGenereer() {
    _ipToonModal(_ipRenderAIModal());
    _ipState._genDocumenten = [];   // array van File-objecten
    _ipBindEvents();
}

function handleIpAIGenereerClose() {
    _ipSluitModal();
}

async function handleIpAIGenereerStart() {
    const genBtn    = document.getElementById('ip-gen-btn');
    const statusEl  = document.getElementById('ip-gen-status');
    const overlay   = document.getElementById('ip-modal-overlay');

    const projectnaam   = document.getElementById('ip-gen-projectnaam')?.value?.trim()   || '';
    const opdrachtgever = document.getElementById('ip-gen-opdrachtgever')?.value?.trim() || '';
    const opdrachtnemer = document.getElementById('ip-gen-opdrachtnemer')?.value?.trim() || '';
    const planstart     = document.getElementById('ip-gen-planstart')?.value              || '';
    const model         = document.getElementById('ip-gen-model')?.value                  || 'claude-haiku-4-5-20251001';

    if (genBtn)   { genBtn.disabled = true; }
    if (statusEl) { statusEl.style.display = 'block'; }

    // Converteer alle geselecteerde bestanden parallel naar base64
    let documenten = [];
    const bronBestanden = _ipState._genDocumenten || [];
    if (bronBestanden.length > 0) {
        try {
            documenten = await Promise.all(
                bronBestanden.map(bestand => new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload  = e => resolve({
                        base64: e.target.result.split(',')[1],
                        naam:   bestand.name,
                    });
                    reader.onerror = reject;
                    reader.readAsDataURL(bestand);
                }))
            );
        } catch (e) {
            console.warn('[IP] Base64 conversie mislukt:', e);
        }
    }

    const tender = tccState.data?.tender || {};

    try {
        const res = await _ipApiCall(
            `/api/v1/implementatieplanning/${_ipState.tenderId}/genereer`,
            {
                method: 'POST',
                body: JSON.stringify({
                    documenten,
                    tender_omschrijving: tender.omschrijving || '',
                    projectnaam,
                    opdrachtgever,
                    opdrachtnemer,
                    planstart,
                    model,
                }),
            }
        );
        _ipSluitModal();
        showTccToast(`Planning gegenereerd met ${res.totaal_taken} taken. Controleer en pas aan.`, 'success');
        await _ipInit(_ipState.tenderId);
    } catch (e) {
        showTccToast(`Generatie mislukt: ${e.message}`, 'error');
        if (genBtn)   { genBtn.disabled = false; }
        if (statusEl) { statusEl.style.display = 'none'; }
    }
}

function _ipFileToBase64(_unused) {
    // Vervangen door Promise.all in handleIpAIGenereerStart — niet meer direct gebruikt
    return Promise.resolve('');
}

async function handleIpHandmatigStart() {
    // Maak een lege sectie aan + sla metadata op
    try {
        const tender = tccState.data?.tender || {};
        await _ipApiCall(
            `/api/v1/implementatieplanning/${_ipState.tenderId}/metadata`,
            {
                method: 'PUT',
                body: JSON.stringify({
                    projectnaam:   tender.naam          || 'Project',
                    opdrachtgever: tender.opdrachtgever || '',
                    planstart:     new Date().toISOString().split('T')[0],
                }),
            }
        );
        await _ipApiCall(
            `/api/v1/implementatieplanning/${_ipState.tenderId}/secties`,
            {
                method: 'POST',
                body: JSON.stringify({ naam: 'Initiatiefase', kleur: '#c7d2fe', volgorde: 0 }),
            }
        );
        await _ipInit(_ipState.tenderId);
    } catch (e) {
        showTccToast(`Aanmaken mislukt: ${e.message}`, 'error');
    }
}

function handleIpTaakOpen(btn) {
    const taakId   = btn?.dataset?.taakId   || '';
    const sectieId = btn?.dataset?.sectieId || '';

    let taak     = null;
    let defSectie = sectieId;

    if (taakId) {
        // Zoek bestaande taak
        for (const s of (_ipState.planning?.secties || [])) {
            const gevonden = (s.taken || []).find(t => t.id === taakId);
            if (gevonden) { taak = gevonden; defSectie = s.id; break; }
        }
    }

    _ipToonModal(_ipRenderTaakModal(taak, defSectie));
    _ipBindEvents();
}

function handleIpTaakClose() {
    _ipSluitModal();
}

async function handleIpTaakSave(btn) {
    const taakId = btn?.dataset?.taakId || '';
    const isNieuw = !taakId;

    const naam = document.getElementById('ip-taak-naam')?.value?.trim();
    if (!naam) {
        showTccToast('Taaknaam is verplicht', 'warn');
        return;
    }

    const payload = {
        sectie_id:        document.getElementById('ip-taak-sectie-id')?.value      || null,
        nummer:           document.getElementById('ip-taak-nummer')?.value?.trim()  || null,
        naam,
        verantwoordelijke: document.getElementById('ip-taak-verantw')?.value?.trim()    || null,
        toelichting:      document.getElementById('ip-taak-toelichting')?.value?.trim() || null,
        status:           document.getElementById('ip-taak-status')?.value           || 'open',
        startdatum:       document.getElementById('ip-taak-startdatum')?.value       || null,
        einddatum:        document.getElementById('ip-taak-einddatum')?.value        || null,
        dagen:            parseInt(document.getElementById('ip-taak-dagen')?.value)  || null,
    };

    try {
        if (isNieuw) {
            await _ipApiCall('/api/v1/implementatieplanning/taken', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
        } else {
            await _ipApiCall(`/api/v1/implementatieplanning/taken/${taakId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
        }
        _ipSluitModal();
        showTccToast(isNieuw ? 'Taak toegevoegd' : 'Taak opgeslagen', 'success');
        await _ipInit(_ipState.tenderId);
    } catch (e) {
        showTccToast(`Opslaan mislukt: ${e.message}`, 'error');
    }
}

async function handleIpTaakVerwijder(taakId) {
    const ok = await window.ConfirmDialog?.show({
        titel:   'Taak verwijderen',
        tekst:   'Weet je zeker dat je deze taak wilt verwijderen?',
        bevestig: 'Verwijderen',
        annuleer: 'Annuleren',
    });
    if (!ok) return;
    try {
        await _ipApiCall(`/api/v1/implementatieplanning/taken/${taakId}`, { method: 'DELETE' });
        _ipSluitModal();
        showTccToast('Taak verwijderd', 'success');
        await _ipInit(_ipState.tenderId);
    } catch (e) {
        showTccToast(`Verwijderen mislukt: ${e.message}`, 'error');
    }
}

function handleIpSectieOpen(btn) {
    const sectieId = btn?.dataset?.sectieId || '';
    let sectie = null;
    if (sectieId) {
        sectie = (_ipState.planning?.secties || []).find(s => s.id === sectieId) || null;
    }
    _ipToonModal(_ipRenderSectieModal(sectie));
}

function handleIpSectieClose() {
    _ipSluitModal();
}

async function handleIpSectieSave(btn) {
    const sectieId = btn?.dataset?.sectieId || '';
    const isNieuw  = !sectieId;

    const naam  = document.getElementById('ip-sectie-naam')?.value?.trim();
    if (!naam) { showTccToast('Sectienaam is verplicht', 'warn'); return; }
    const kleur = document.getElementById('ip-sectie-kleur')?.value || '#c7d2fe';

    try {
        if (isNieuw) {
            await _ipApiCall(`/api/v1/implementatieplanning/${_ipState.tenderId}/secties`, {
                method: 'POST',
                body: JSON.stringify({ naam, kleur, volgorde: 99 }),
            });
        } else {
            await _ipApiCall(`/api/v1/implementatieplanning/secties/${sectieId}`, {
                method: 'PUT',
                body: JSON.stringify({ naam, kleur }),
            });
        }
        _ipSluitModal();
        showTccToast(isNieuw ? 'Sectie toegevoegd' : 'Sectie opgeslagen', 'success');
        await _ipInit(_ipState.tenderId);
    } catch (e) {
        showTccToast(`Opslaan mislukt: ${e.message}`, 'error');
    }
}

async function handleIpSectieVerwijder(sectieId) {
    const ok = await window.ConfirmDialog?.show({
        titel:   'Sectie verwijderen',
        tekst:   'Hiermee worden ook alle taken in deze sectie verwijderd. Doorgaan?',
        bevestig: 'Verwijderen',
        annuleer: 'Annuleren',
    });
    if (!ok) return;
    try {
        await _ipApiCall(`/api/v1/implementatieplanning/secties/${sectieId}`, { method: 'DELETE' });
        _ipSluitModal();
        showTccToast('Sectie verwijderd', 'success');
        await _ipInit(_ipState.tenderId);
    } catch (e) {
        showTccToast(`Verwijderen mislukt: ${e.message}`, 'error');
    }
}

async function handleIpExportExcel() {
    try {
        showTccToast('Excel genereren…', 'info');
        const res = await _ipApiCall(
            `/api/v1/implementatieplanning/${_ipState.tenderId}/export/excel`,
            { method: 'POST' }
        );
        _ipDownload(res.base64, res.bestandsnaam, res.mimetype);
        showTccToast('Excel gedownload', 'success');
    } catch (e) {
        showTccToast(`Excel mislukt: ${e.message}`, 'error');
    }
}

async function handleIpExportPDF() {
    try {
        showTccToast('PDF genereren…', 'info');
        const res = await _ipApiCall(
            `/api/v1/implementatieplanning/${_ipState.tenderId}/export/pdf`,
            { method: 'POST' }
        );
        _ipDownload(res.base64, res.bestandsnaam, res.mimetype);
        showTccToast('PDF gedownload', 'success');
    } catch (e) {
        showTccToast(`PDF mislukt: ${e.message}`, 'error');
    }
}

function _ipDownload(base64, naam, mimetype) {
    const bytes   = atob(base64);
    const arr     = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob    = new Blob([arr], { type: mimetype });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = naam;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

// ── Chat helpers ───────────────────────────────────────────────────────────

function _ipChatSuggesties(modus) {
    if (modus === 'vraag') {
        return `
            <button class="ip-sug" data-action="ip-chat-sug"
                    data-tekst="Hoeveel taken lopen er parallel in de uitvoeringsfase?">
                Hoeveel taken lopen er parallel in de uitvoeringsfase?
            </button>
            <button class="ip-sug" data-action="ip-chat-sug"
                    data-tekst="Welke secties hebben geen einddatum?">
                Welke secties hebben geen einddatum?
            </button>
            <button class="ip-sug" data-action="ip-chat-sug"
                    data-tekst="Geef een samenvatting van de planning">
                Geef een samenvatting van de planning
            </button>`;
    }
    return `
        <button class="ip-sug" data-action="ip-chat-sug"
                data-tekst="Voeg een evaluatiefase toe na de uitvoering">
            Voeg een evaluatiefase toe na de uitvoering
        </button>
        <button class="ip-sug" data-action="ip-chat-sug"
                data-tekst="Maak de uitvoeringsfase 2 weken korter">
            Maak de uitvoeringsfase 2 weken korter
        </button>
        <button class="ip-sug" data-action="ip-chat-sug"
                data-tekst="Voeg een communicatiemoment toe per fase">
            Voeg een communicatiemoment toe per fase
        </button>`;
}

function _ipChatRenderSuggesties(modus) {
    const sugs = document.getElementById('ip-chat-sugs');
    if (!sugs) return;
    sugs.style.display = '';
    sugs.innerHTML = _ipChatSuggesties(modus);
}

let _ipChatMsgCounter = 0;

function _ipChatAddMsg(tekst, rol, isLoading = false) {
    const msgs = document.getElementById('ip-chat-msgs');
    if (!msgs) return null;
    const id  = `ip-msg-${++_ipChatMsgCounter}`;
    const cls = rol === 'user' ? 'ip-msg-user' : 'ip-msg-ai';
    const label = rol === 'user' ? '' : '<span class="ip-msg-label">AI</span>';
    msgs.insertAdjacentHTML('beforeend', `
        <div class="ip-msg ${cls}" id="${id}">
            ${label}
            <span class="ip-msg-tekst">${_ipEsc(tekst)}</span>
        </div>`);
    msgs.scrollTop = msgs.scrollHeight;
    return id;
}

function _ipChatReplaceMsg(id, samenvatting, aantalWijzigingen, isError = false, modus = 'aanpas') {
    const el = document.getElementById(id);
    if (!el) return;
    let chip = '';
    if (isError) {
        chip = `<span class="ip-wijziging-chip fout">Mislukt</span>`;
    } else if (modus === 'vraag') {
        chip = `<span class="ip-chip-vraag">${tccIcon('helpCircle', 10, '#2563eb')} Antwoord</span>`;
    } else if (aantalWijzigingen > 0) {
        chip = `<span class="ip-wijziging-chip">${aantalWijzigingen} wijziging${aantalWijzigingen !== 1 ? 'en' : ''} toegepast</span>`;
    }
    el.innerHTML = `
        <span class="ip-msg-label">AI</span>
        <span class="ip-msg-tekst">${_ipEsc(samenvatting)}</span>
        ${chip}`;
}

// ── Chat event handlers ────────────────────────────────────────────────────

function handleIpChatToggle() {
    const layout = document.getElementById('ip-main-layout');
    const paneel = document.getElementById('ip-chat-paneel');
    if (!layout || !paneel) return;
    const isOpen = layout.classList.toggle('chat-open');
    paneel.style.display = isOpen ? 'flex' : 'none';
    if (isOpen) {
        setTimeout(() => document.getElementById('ip-chat-input')?.focus(), 50);
    }
}

function handleIpChatSug(btn) {
    const tekst = btn?.dataset?.tekst || '';
    if (!tekst) return;
    const input = document.getElementById('ip-chat-input');
    if (input) {
        input.value = tekst;
        handleIpChatStuur();
    }
}

function handleIpChatModus(btn) {
    const modus = btn?.dataset?.modus;
    if (!modus || modus === _ipState.chatModus) return;

    _ipState.chatModus = modus;

    // Update actieve klasse op knoppen
    const bar = document.querySelector('.ip-chat-modus-bar');
    if (bar) {
        bar.querySelectorAll('.ip-modus-btn').forEach(b => {
            b.classList.remove('actief-aanpas', 'actief-vraag');
        });
        btn.classList.add(modus === 'aanpas' ? 'actief-aanpas' : 'actief-vraag');
    }

    // Update hint-tekst
    const hint = document.getElementById('ip-chat-hint');
    if (hint) {
        hint.textContent = modus === 'vraag'
            ? 'Stel een vraag over de planning — de planning wordt niet gewijzigd.'
            : 'Beschrijf wat je wilt wijzigen in de planning.';
    }

    // Update placeholder
    const input = document.getElementById('ip-chat-input');
    if (input) {
        input.placeholder = modus === 'vraag'
            ? 'Stel een vraag over de planning...'
            : 'Pas de planning aan...';
    }

    // Toon passende suggesties
    _ipChatRenderSuggesties(modus);
}

async function handleIpChatStuur() {
    const input   = document.getElementById('ip-chat-input');
    const bericht = input?.value?.trim();
    if (!bericht) return;

    input.value = '';
    // Suggesties verbergen na eerste verstuurde bericht
    const sugs = document.getElementById('ip-chat-sugs');
    if (sugs) sugs.style.display = 'none';

    _ipChatAddMsg(bericht, 'user');
    const loadingId = _ipChatAddMsg('…', 'ai', true);

    const model  = document.getElementById('ip-chat-model')?.value || 'claude-sonnet-4-6';
    const modus  = _ipState.chatModus || 'aanpas';

    try {
        const res = await _ipApiCall(
            `/api/v1/implementatieplanning/${_ipState.tenderId}/chat`,
            {
                method: 'POST',
                body: JSON.stringify({
                    bericht,
                    model,
                    modus,
                    planning: _ipState.planning,
                }),
            }
        );

        if (res.modus === 'vraag') {
            // Antwoord tonen — géén planning-update
            _ipChatReplaceMsg(loadingId, res.antwoord, 0, false, 'vraag');
        } else {
            // Aanpas-modus: wijzigingen toegepast, planning herladen
            _ipChatReplaceMsg(loadingId, res.samenvatting, res.wijzigingen_toegepast, false, 'aanpas');
            // Planning herladen vanuit DB (source of truth na wijzigingen)
            await _ipInit(_ipState.tenderId);
            // Chat paneel heropenen want _ipInit herrendert de hele container
            const layout = document.getElementById('ip-main-layout');
            const paneel = document.getElementById('ip-chat-paneel');
            if (layout && paneel) {
                layout.classList.add('chat-open');
                paneel.style.display = 'flex';
            }
        }
    } catch (e) {
        _ipChatReplaceMsg(loadingId, 'Er ging iets mis. Probeer opnieuw.', 0, true);
        console.error('[IP-chat] Fout:', e);
    }
}

// ── Kolombreedtes resize drag ──────────────────────────────────────────────

const _IP_COL_KEY = { nr: 'nr', taak: 'taak', verantw: 'verantwoordelijke', status: 'status', datum: 'datum' };
const _IP_COL_MIN = { nr: 32,   taak: 120,    verantw: 80,                  status: 70,       datum: 80 };

let _ipResizeDrag = null;

function _ipResizeStart(e) {
    const col = e.currentTarget?.dataset?.col;
    if (!col || !_IP_COL_KEY[col]) return;
    e.preventDefault();
    e.stopPropagation();
    _ipResizeDrag = {
        col,
        key:        _IP_COL_KEY[col],
        startX:     e.clientX,
        startWidth: _ipState.kolomBreedtes[_IP_COL_KEY[col]],
        handle:     e.currentTarget,
    };
    e.currentTarget.classList.add('actief');
    document.addEventListener('mousemove', _ipResizeMove);
    document.addEventListener('mouseup',   _ipResizeEnd);
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
}

function _ipResizeMove(e) {
    if (!_ipResizeDrag) return;
    const delta = e.clientX - _ipResizeDrag.startX;
    const min   = _IP_COL_MIN[_ipResizeDrag.col] || 60;
    _ipState.kolomBreedtes[_ipResizeDrag.key] = Math.max(min, _ipResizeDrag.startWidth + delta);
    _ipApplyKolomBreedtes();
}

function _ipResizeEnd() {
    _ipResizeDrag?.handle?.classList.remove('actief');
    _ipResizeDrag = null;
    document.removeEventListener('mousemove', _ipResizeMove);
    document.removeEventListener('mouseup',   _ipResizeEnd);
    document.body.style.cursor     = '';
    document.body.style.userSelect = '';
}

// ── Zoom ───────────────────────────────────────────────────────────────────

function handleIpZoom(btn) {
    const zoom = btn?.dataset?.zoom;
    if (!zoom || zoom === _ipState.zoom) return;
    _ipState.zoom = zoom;

    // Update pill actieve staat
    document.querySelectorAll('.ip-zoom-pill').forEach(p => {
        p.classList.toggle('actief', p.dataset.zoom === zoom);
    });

    // Herrender alleen de timeline — geen volledige tab rerender
    const tlWrap = document.getElementById('ip-gantt-timeline-wrap');
    if (tlWrap) {
        tlWrap.innerHTML = _ipRenderTimeline(_ipState.planning?.metadata);
    }
}

// ── Fullscreen SVG-iconen (niet beschikbaar in window.Icons) ──────────────

function _ipIconMaximize() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>`;
}

function _ipIconMinimize() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="#374151" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
        <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
    </svg>`;
}

// ── Centrale ip-* event dispatcher ────────────────────────────────────────
// Gebruikt door zowel TCC_Core.js (panel delegation) als de fullscreen body-
// handler. Wijzig hier — beide plekken profiteren automatisch.

function handleIpEvent(action, btn) {
    switch (action) {
        case 'ip-ai-genereer':       handleIpAIGenereer(); break;
        case 'ip-ai-genereer-start': handleIpAIGenereerStart(); break;
        case 'ip-ai-genereer-close': handleIpAIGenereerClose(); break;
        case 'ip-handmatig-start':   handleIpHandmatigStart(); break;
        case 'ip-taak-open':         handleIpTaakOpen(btn); break;
        case 'ip-taak-save':         handleIpTaakSave(btn); break;
        case 'ip-taak-close':        handleIpTaakClose(); break;
        case 'ip-taak-verwijder':    handleIpTaakVerwijder(btn.dataset.taakId); break;
        case 'ip-sectie-open':       handleIpSectieOpen(btn); break;
        case 'ip-sectie-save':       handleIpSectieSave(btn); break;
        case 'ip-sectie-close':      handleIpSectieClose(); break;
        case 'ip-sectie-verwijder':  handleIpSectieVerwijder(btn.dataset.sectieId); break;
        case 'ip-export-excel':      handleIpExportExcel(); break;
        case 'ip-export-pdf':        handleIpExportPDF(); break;
        case 'ip-fullscreen':        handleIpFullscreen(); break;
        case 'ip-chat-toggle':       handleIpChatToggle(); break;
        case 'ip-chat-stuur':        handleIpChatStuur(); break;
        case 'ip-chat-sug':          handleIpChatSug(btn); break;
        case 'ip-chat-modus':        handleIpChatModus(btn); break;
        case 'ip-zoom':              handleIpZoom(btn); break;
        case 'ip-schaal-min':        _ipSetSchaal(Math.max(0.5, _ipState.schaal - 0.25)); break;
        case 'ip-schaal-plus':       _ipSetSchaal(Math.min(4.0, _ipState.schaal + 0.25)); break;
        case 'ip-schaal-slider':     break; // slider gebruikt 'input' event — zie _ipBindEvents()
        case 'ip-doc-verwijder':     handleIpDocVerwijder(btn); break;
    }
}

// ── Fullscreen ─────────────────────────────────────────────────────────────

let _ipFullscreenBackdrop  = null;
let _ipFullscreenWrapParent = null;   // originele parent van .ip-wrap
let _ipFullscreenWrapNext   = null;   // originele next sibling (voor terugplaatsen)

function handleIpFullscreen() {
    // Toggle op basis van state — niet op DOM-klasse. De DOM-klasse check faalt
    // omdat .ip-wrap na verplaatsing naar <body> niet meer in het panel zit.
    if (_ipState.isFullscreen) {
        _ipFullscreenClose();
    } else {
        _ipFullscreenOpen();
    }
}

function _ipFullscreenOpen() {
    const wrap = _ipGetWrap();
    if (!wrap) return;

    // ── Stap 1: backdrop eerst invoegen (DOM-volgorde: vóór wrap) ──
    _ipFullscreenBackdrop = document.createElement('div');
    _ipFullscreenBackdrop.className = 'ip-fullscreen-backdrop';
    _ipFullscreenBackdrop.id = 'ip-fullscreen-backdrop';
    _ipFullscreenBackdrop.addEventListener('click', _ipFullscreenClose);
    document.body.appendChild(_ipFullscreenBackdrop);

    // ── Stap 2: .ip-wrap tijdelijk naar <body> verplaatsen ──
    // Dit haalt hem uit elke nested stacking context van TCC-parent-elementen,
    // zodat zijn z-index: 10000 direct t.o.v. <body> geldt — hoger dan backdrop 9999.
    _ipFullscreenWrapParent = wrap.parentNode;
    _ipFullscreenWrapNext   = wrap.nextSibling;
    document.body.appendChild(wrap);

    // ── Stap 3: fullscreen klasse + state + ESC ──
    wrap.classList.add('ip-fullscreen');
    _ipState.isFullscreen = true;
    document.addEventListener('keydown', _ipFullscreenEsc);
    _ipUpdateFullscreenBtn(true);

    // ── Stap 4: body click-handler voor ip-* events ──
    // Na de DOM-verplaatsing borrelen clicks in .ip-wrap niet meer omhoog
    // naar #tcc-panel. Deze handler vangt ze op via event delegation op body.
    document._ipFullscreenHandler = function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (!action.startsWith('ip-')) return;
        handleIpEvent(action, btn);
    };
    document.body.addEventListener('click', document._ipFullscreenHandler);
}

function _ipFullscreenClose() {
    // ── Stap 1: body click-handler verwijderen ──
    if (document._ipFullscreenHandler) {
        document.body.removeEventListener('click', document._ipFullscreenHandler);
        document._ipFullscreenHandler = null;
    }

    const wrap = _ipGetWrap();

    if (wrap) {
        wrap.classList.remove('ip-fullscreen');

        // .ip-wrap terugplaatsen op originele positie in de DOM
        if (_ipFullscreenWrapParent) {
            _ipFullscreenWrapParent.insertBefore(wrap, _ipFullscreenWrapNext);
        }
    }

    _ipState.isFullscreen   = false;
    _ipFullscreenBackdrop?.remove();
    _ipFullscreenBackdrop   = null;
    _ipFullscreenWrapParent = null;
    _ipFullscreenWrapNext   = null;
    document.removeEventListener('keydown', _ipFullscreenEsc);
    _ipUpdateFullscreenBtn(false);
}

function _ipFullscreenEsc(e) {
    if (e.key === 'Escape') _ipFullscreenClose();
}

function _ipUpdateFullscreenBtn(isFs) {
    const btn = _ipGetWrap()?.querySelector('[data-action="ip-fullscreen"]');
    if (!btn) return;
    btn.title = isFs ? 'Volledig scherm sluiten' : 'Volledig scherm';
    btn.innerHTML = isFs ? _ipIconMinimize() : _ipIconMaximize();
}

// ── TCC_Core integratie: renderTabImplementatieplanning ───────────────────

function renderTabImplementatieplanning(data) {
    const isActive = tccState.activeTab === 'implementatieplanning';
    return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="implementatieplanning">
        <div id="ip-container" style="height:100%;display:flex;flex-direction:column;overflow:hidden;">
            <div class="ip-loading">
                <span class="ip-spinner"></span>
                <span>Laden…</span>
            </div>
        </div>
    </div>`;
}

/*
  ─────────────────────────────────────────────────────────────────
  Voeg toe in TCC_Core.js — _getNavItems():
  Na { key: 'projectplanning', ... }, vóór { key: 'checklist', ... }:

    { key: 'implementatieplanning', icon: 'barChart', label: 'Implementatieplanning', badge: '', badgeType: '' },

  Voeg toe in TCC_Core.js — renderTcc():
  Na ${renderTabProjectplanning(data)}:

    ${renderTabImplementatieplanning(data)}

  Voeg toe in TCC_Core.js — _switchTab():
  Na:  if (tabKey === 'projectplanning') setTimeout(...)

    if (tabKey === 'implementatieplanning') setTimeout(() => _ipInit(tccState.tenderId), 150);

  Voeg toe in TCC_Core.js — initTccEvents() switch:

      case 'ip-ai-genereer':       handleIpAIGenereer(); break;
      case 'ip-ai-genereer-start': handleIpAIGenereerStart(); break;
      case 'ip-ai-genereer-close': handleIpAIGenereerClose(); break;
      case 'ip-handmatig-start':   handleIpHandmatigStart(); break;
      case 'ip-taak-open':         handleIpTaakOpen(btn); break;
      case 'ip-taak-save':         handleIpTaakSave(btn); break;
      case 'ip-taak-close':        handleIpTaakClose(); break;
      case 'ip-taak-verwijder':    handleIpTaakVerwijder(btn.dataset.taakId); break;
      case 'ip-sectie-open':       handleIpSectieOpen(btn); break;
      case 'ip-sectie-save':       handleIpSectieSave(btn); break;
      case 'ip-sectie-close':      handleIpSectieClose(); break;
      case 'ip-sectie-verwijder':  handleIpSectieVerwijder(btn.dataset.sectieId); break;
      case 'ip-export-excel':      handleIpExportExcel(); break;
      case 'ip-export-pdf':        handleIpExportPDF(); break;
  ─────────────────────────────────────────────────────────────────
*/
