/* ============================================
   TCC_TabProjectplanning.js  —  v3.0  (2026-03-13)
   Projectplanning tab — alle functies gelijk aan standalone PlanningModal

   WIJZIGINGEN v3.0 t.o.v. v2.0:
   - Volledige checkbox toggle met optimistic update + re-render
   - Inline datum-picker (identiek aan PlanningEventHandlers.handleSetDate)
   - Assignee dropdown met teamleden (meerdere tegelijk, identiek aan standalone)
   - 3-dot menu: Naam bewerken | Status wijzigen | Verwijderen
   - Template laden via /api/v1/ai-documents/tenders/{id}/populate-from-template
   - Taak toevoegen via prompt (inline in data-state)
   - Auto-save indicator via window.showAutoSaveIndicator?.()
   - Alle handlers via switch in TCC_Core.js initTccEvents()

   VEREIST in TCC_Core.js initTccEvents() switch:
     case 'pp-toon-config':     handlePpToonConfig(); break;
     case 'pp-annuleer':        handlePpAnnuleer(); break;
     case 'pp-start-genereren': handlePpStartGenereren(); break;
     case 'pp-toggle-taak':     handlePpToggleTaak(btn.dataset.taakId, btn.dataset.status); break;
     case 'pp-set-date':        handlePpSetDate(btn.dataset.taakId, btn); break;
     case 'pp-assign':          handlePpAssign(btn.dataset.taakId, btn); break;
     case 'pp-taak-menu':       handlePpTaakMenu(btn.dataset.taakId); break;
     case 'pp-add-taak':        handlePpAddTaak(); break;
     case 'pp-load-template':   handlePpLoadTemplate(); break;
   ============================================ */

// ============================================
// HELPERS
// ============================================

function _ppFormatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Vaste volgorde voor bekende categorieën
const PP_CATEGORIE_VOLGORDE = [
    'Voorbereiding',
    'Uitwerking',
    'Schrijven & Review',
    'Afronding & Indiening',
    'Afronding',
    'Projectplanning',
    'Algemeen',
];

function _ppGroupByCategorie(taken) {
    const grouped = {};
    taken.forEach(taak => {
        const cat = taak.categorie || 'Algemeen';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(taak);
    });

    // Sorteer categorieën: bekende volgorde eerst, daarna alfabetisch
    const gesorteerd = {};
    const keys = Object.keys(grouped);
    keys.sort((a, b) => {
        const ia = PP_CATEGORIE_VOLGORDE.indexOf(a);
        const ib = PP_CATEGORIE_VOLGORDE.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });
    for (const k of keys) gesorteerd[k] = grouped[k];
    return gesorteerd;
}

function _ppGetStatusConfig(status) {
    const map = {
        'done':   { label: 'Klaar',   cls: 'status--done' },
        'active': { label: 'Actief',  cls: 'status--active' },
        'todo':   { label: 'Te doen', cls: 'status--todo' }
    };
    return map[status] || map.todo;
}

function _ppGetCategoryColor(doneCount, total) {
    if (doneCount === total && total > 0) return '#22c55e';
    if (doneCount > 0) return '#f97316';
    return '#94a3b8';
}

// Haal panel op voor de projectplanning tab
function _ppGetPanel() {
    return tccState.overlay?.querySelector('[data-panel="projectplanning"]');
}

// Herbereken container-inhoud en render opnieuw
function _ppRerender() {
    const panel = _ppGetPanel();
    if (!panel) return;
    const container = panel.querySelector('.tcc-pp-container');
    if (!container) return;
    const taken = tccState.data?.projectplanning?.taken || [];
    const state = tccState.projectplanningState || (taken.length > 0 ? 'data' : 'leeg');
    container.innerHTML = _renderPpInhoud(state, tccState.data?.projectplanning || {}, tccState.data || {});
    _ppAttachBufferListener(panel);
}

function _ppAttachBufferListener(panel) {
    const select = panel?.querySelector('#pp-buffer');
    const toelichting = panel?.querySelector('#pp-buffer-toelichting');
    if (!select || !toelichting) return;
    select.addEventListener('change', () => {
        const v = parseInt(select.value, 10);
        toelichting.textContent = v === 0
            ? 'De interne deadline valt op de inschrijvingsdeadline zelf.'
            : `De interne deadline wordt ${v} werkdag${v === 1 ? '' : 'en'} vóór de inschrijvingsdeadline gezet.`;
    });
}

// ============================================
// RENDER — Tab: Projectplanning
// ============================================

function renderTabProjectplanning(data) {
    const isActive = tccState.activeTab === 'projectplanning';
    const pp = data.projectplanning || {};
    const taken = pp.taken || [];
    const ppState = tccState.projectplanningState || (taken.length > 0 ? 'data' : 'leeg');

    return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="projectplanning">
        <div class="tcc-pp-container">
            ${_renderPpInhoud(ppState, pp, data)}
        </div>
    </div>`;
}

function _renderPpInhoud(state, pp, data) {
    switch (state) {
        case 'config':  return _renderPpConfig(pp, data);
        case 'loading': return _renderPpLoading();
        case 'data':    return _renderPpData(pp, data);
        default:        return _renderPpLeeg(data);
    }
}

// ── STATE: LEEG ──────────────────────────────

function _renderPpLeeg(data) {
    const deadline = data?.tenderplanning?.items?.find(i => i.key === 'deadline_indiening');
    const deadlineTxt = deadline?.date || '';

    return `
    <div class="tcc-actie-balk tcc-actie-balk--blue">
        <div class="tcc-actie-balk-icon tcc-actie-balk-icon--blue">
            ${tccIcon('calendarView', 18, '#2563eb')}
        </div>
        <div class="tcc-actie-balk-info">
            <div class="tcc-actie-balk-title">Backplanning genereren</div>
            <div class="tcc-actie-balk-desc">Genereer een backplanning op basis van de inschrijvingsdeadline.</div>
        </div>
        <button class="tcc-btn tcc-btn--primary tcc-btn--sm" data-action="pp-toon-config">
            ${tccIcon('zap', 13, '#fff')} Configureer planning
        </button>
    </div>
    <div class="tcc-pp-leeg">
        <div class="tcc-pp-leeg-icon">${tccIcon('calendarView', 36, '#cbd5e1')}</div>
        <div class="tcc-pp-leeg-title">Geen projectplanning</div>
        <div class="tcc-pp-leeg-desc">
            Genereer een backplanning op basis van de inschrijvingsdeadline.
            ${deadlineTxt ? `<br><strong>Deadline: ${escHtml(deadlineTxt)}</strong>` : ''}
        </div>
    </div>`;
}

// ── STATE: CONFIG ────────────────────────────

function _renderPpConfig(pp, data) {
    const taken = pp.taken || [];
    const heeftTaken = taken.length > 0;

    const deadlineItem = data?.tenderplanning?.items?.find(i => i.key === 'deadline_indiening');
    const tenderDeadline = data?.tender?.deadline_indiening;
    const deadlineVal = deadlineItem?.dateRaw
        ? deadlineItem.dateRaw.substring(0, 10)
        : (tenderDeadline ? tenderDeadline.substring(0, 10) : '');
    const teamleden = tccState.data?._bureauTeamMembers || data?.team?.leden || [];

    const takenPreview = heeftTaken ? `
        <div class="tcc-pp-preview">
            <div class="tcc-pp-preview-header">
                <span class="tcc-pp-preview-title">Huidige taken</span>
                <span class="tcc-pp-preview-count">${taken.length} taken</span>
            </div>
            ${taken.slice(0, 4).map((taak, i) => {
                const rawTaak = (taak.taak_naam || taak.naam || '').replace(/\*\*/g, '').trim();
                const naam = (!rawTaak || /^\d{1,3}$/.test(rawTaak))
                    ? (taak.beschrijving || taak.notities || ('Taak ' + (rawTaak || '?'))).replace(/\*\*/g, '').trim()
                    : rawTaak;
                const datum = taak.datum ? _ppFormatDate(taak.datum) : '';
                return `
                <div class="tcc-pp-preview-rij">
                    <div class="tcc-pp-taak-nr">${i + 1}</div>
                    <div class="tcc-pp-taak-body">
                        <div class="tcc-pp-taak-naam">${escHtml(naam)}</div>
                    </div>
                    ${datum ? `<div class="tcc-pp-taak-datum">${escHtml(datum)}</div>` : ''}
                </div>`;
            }).join('')}
            ${taken.length > 4 ? `<div class="tcc-pp-preview-meer">+ ${taken.length - 4} meer taken</div>` : ''}
        </div>` : '';

    return `
    <div class="tcc-actie-balk tcc-actie-balk--blue">
        <div class="tcc-actie-balk-icon tcc-actie-balk-icon--blue">
            ${tccIcon('calendarView', 18, '#2563eb')}
        </div>
        <div class="tcc-actie-balk-info">
            <div class="tcc-actie-balk-title">Backplanning genereren</div>
            <div class="tcc-actie-balk-desc">Laadt automatisch een bureautemplate en laat AI de datums invullen op basis van de inschrijvingsdeadline.</div>
        </div>
        ${heeftTaken ? `<button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="pp-annuleer">Annuleren</button>` : ''}
    </div>

    <div class="tcc-pp-config-card">
        <div class="tcc-pp-config-titel">Configuratie</div>
        <div class="tcc-pp-config-grid">
            <div class="tcc-pp-config-veld">
                <label>Inschrijvingsdeadline</label>
                <input type="date" id="pp-deadline" value="${deadlineVal}">
            </div>
            <div class="tcc-pp-config-veld">
                <label>Interne deadline (vóór externe deadline)</label>
                <select id="pp-buffer">
                    <option value="0">0 werkdagen</option>
                    <option value="1">1 werkdag</option>
                    <option value="2">2 werkdagen</option>
                    <option value="3" selected>3 werkdagen</option>
                    <option value="5">5 werkdagen</option>
                </select>
                <div id="pp-buffer-toelichting" style="font-size:11px;color:#64748b;margin-top:4px;">
                    De interne deadline wordt 3 werkdagen vóór de inschrijvingsdeadline gezet.
                </div>
            </div>
            <div class="tcc-pp-config-veld">
                <label>Primaire uitvoerder</label>
                <select id="pp-uitvoerder">
                    <option value="">— Geen —</option>
                    ${teamleden.map(lid => {
                        const id = lid.user_id || lid.id;
                        const naam = lid.naam || lid.name || '';
                        return `<option value="${id}">${escHtml(naam)}</option>`;
                    }).join('')}
                </select>
            </div>
        </div>
        <button class="tcc-btn tcc-btn--primary tcc-pp-genereer-btn" data-action="pp-start-genereren">
            ${tccIcon('zap', 14, '#fff')} Genereer backplanning
        </button>
    </div>

    ${takenPreview}`;
}

// ── STATE: LOADING ───────────────────────────

function _renderPpLoading() {
    return `
    <div class="tcc-actie-balk tcc-actie-balk--blue">
        <div class="tcc-actie-balk-icon tcc-actie-balk-icon--blue">
            ${tccIcon('calendarView', 18, '#2563eb')}
        </div>
        <div class="tcc-actie-balk-info">
            <div class="tcc-actie-balk-title">Backplanning genereren…</div>
            <div class="tcc-actie-balk-desc">AI maakt taken aan op basis van de deadline.</div>
        </div>
    </div>
    <div class="tcc-extractie-loading">
        <div class="tcc-extractie-spinner"><div class="tcc-spinner tcc-spinner--lg tcc-spinner--blue"></div></div>
        <div class="tcc-extractie-stappen" id="pp-stappen">
            <div class="tcc-stap tcc-stap--actief tcc-stap--blue" data-stap="1">${tccIcon('calendarView', 14, '#2563eb')} <span>Deadline verwerken…</span></div>
            <div class="tcc-stap" data-stap="2">${tccIcon('zap', 14, '#94a3b8')} <span>Taken aanmaken…</span></div>
            <div class="tcc-stap" data-stap="3">${tccIcon('user', 14, '#94a3b8')} <span>Verantwoordelijken toewijzen…</span></div>
            <div class="tcc-stap" data-stap="4">${tccIcon('check', 14, '#94a3b8')} <span>Opslaan in database…</span></div>
        </div>
    </div>`;
}

// ── STATE: DATA ──────────────────────────────

function _renderPpData(pp, data) {
    const taken = pp.taken || [];
    const grouped = _ppGroupByCategorie(taken);
    const categories = Object.keys(grouped);

    const doneCount = taken.filter(t => t.status === 'done').length;
    const totalCount = taken.length;
    const percentage = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return `
    <div class="tcc-actie-balk tcc-actie-balk--blue">
        <div class="tcc-actie-balk-icon tcc-actie-balk-icon--blue">
            ${tccIcon('calendarView', 18, '#2563eb')}
        </div>
        <div class="tcc-actie-balk-info">
            <div class="tcc-actie-balk-title">${totalCount} taken</div>
            <div class="tcc-actie-balk-desc">Backplanning — ${doneCount} van ${totalCount} afgerond</div>
        </div>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="pp-toon-config">
            ${tccIcon('refresh', 13)} Opnieuw
        </button>
    </div>

    <div class="planning-toolbar" style="padding:10px 0;">
        <div class="planning-toolbar-left">
            <button class="planning-toolbar-btn" data-action="pp-load-template"
                    style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#475569;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">
                ${tccIcon('fileText', 14)} Template laden
            </button>
        </div>
        <div style="margin-left:auto;">
            <div class="planning-progress-inline">
                <div class="planning-progress-track">
                    <div class="planning-progress-fill" style="width:${percentage}%"></div>
                </div>
                <span class="planning-progress-label">${doneCount} van ${totalCount} afgerond</span>
            </div>
        </div>
    </div>

    <div class="planning-task-list" style="padding:0 0 20px;">
        ${_ppRenderColumnHeaders()}
        ${categories.length === 0 ? _ppRenderEmpty() : ''}
        ${categories.map(cat => _ppRenderCategory(cat, grouped[cat])).join('')}
        <div class="planning-add-row" data-action="pp-add-taak">
            ${tccIcon('plus', 16)} <span>Taak toevoegen…</span>
        </div>
    </div>`;
}

// ── COLUMN HEADERS ───────────────────────────

function _ppRenderColumnHeaders() {
    return `
    <div style="display:grid;grid-template-columns:32px 1fr 200px 110px 72px 32px;align-items:center;gap:8px;
                padding:6px 4px;border-bottom:2px solid #e2e8f0;margin:0 -4px 4px -4px;
                font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
        <span></span>
        <span>Taak</span>
        <span>Toegewezen aan</span>
        <span>Datum</span>
        <span style="text-align:center;">Status</span>
        <span></span>
    </div>`;
}

// ── EMPTY ────────────────────────────────────

function _ppRenderEmpty() {
    return `
    <div style="display:flex;flex-direction:column;align-items:center;padding:40px 20px;text-align:center;">
        <div style="opacity:.4;margin-bottom:12px;">${tccIcon('calendarView', 36, '#94a3b8')}</div>
        <div style="font-size:14px;font-weight:600;color:#475569;">Nog geen taken</div>
        <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Laad een template of voeg handmatig taken toe.</div>
    </div>`;
}

// ── CATEGORY ─────────────────────────────────

function _ppRenderCategory(categoryName, tasks) {
    const doneCount = tasks.filter(t => t.status === 'done').length;
    const statusColor = _ppGetCategoryColor(doneCount, tasks.length);

    return `
    <div class="planning-category">
        <div class="planning-cat-header">
            <span class="planning-cat-dot" style="background:${statusColor}"></span>
            <span class="planning-cat-label">${escHtml(categoryName)}</span>
            <span class="planning-cat-count">${doneCount}/${tasks.length} taken</span>
        </div>
        ${tasks.map(task => _ppRenderTaak(task)).join('')}
    </div>`;
}

// ── TAAK ROW ─────────────────────────────────

function _ppRenderTaak(taak) {
    const isDone   = taak.status === 'done';
    const isActive = taak.status === 'active';
    const rawNaam  = (taak.taak_naam || taak.naam || '').replace(/\*\*/g, '').trim();
    const naam     = (!rawNaam || /^\d{1,3}$/.test(rawNaam))
        ? (taak.beschrijving || taak.notities || 'Taak').replace(/\*\*/g, '').trim()
        : rawNaam;

    const isDeadline = !isDone && (
        taak.is_deadline === true ||
        taak.is_mijlpaal === true ||
        /deadline|indiening offerte/i.test(naam)
    );

    const statusCfg = isDeadline
        ? { label: 'Deadline', cls: 'status--deadline' }
        : _ppGetStatusConfig(taak.status);
    const rowBg = isActive ? 'planning-task-row--active' : '';

    // Assignees
    const assigneeIds = Array.isArray(taak.toegewezen_aan) ? taak.toegewezen_aan : [];
    const assigneeHtml = _ppRenderAssignees(assigneeIds);

    // Datum
    const datumHtml = _ppRenderDatum(taak, isDone, isActive, isDeadline);

    const naamStyle = isDeadline ? ' style="color:#dc2626;font-weight:700;"' : '';

    return `
    <div class="planning-task-row ${rowBg}" data-taak-id="${taak.id}">
        <div class="planning-task-check ${isDone ? 'done' : isActive ? 'active' : ''}"
             data-action="pp-toggle-taak" data-taak-id="${taak.id}" data-status="${taak.status}">
            ${isDone ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>
        <span class="planning-task-name ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}"${naamStyle}>
            ${escHtml(naam)}
            ${taak.beschrijving ? `<button class="tcc-pp-info-btn" data-action="pp-toon-info" data-taak-id="${escHtml(taak.id)}" title="Meer informatie">${tccIcon('info', 15, '#7c3aed')}</button>` : ''}
        </span>
        <div class="planning-task-assignees" data-action="pp-assign" data-taak-id="${taak.id}"
             style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;"
             title="Klik om teamlid toe te wijzen">
            ${assigneeHtml}
        </div>
        ${datumHtml}
        <span class="planning-task-status ${statusCfg.cls}">${statusCfg.label}</span>
        <button class="planning-task-menu" data-action="pp-taak-menu" data-taak-id="${taak.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
        </button>
    </div>`;
}

function _ppRenderAssignees(userIds) {
    const teamleden = tccState.data?._bureauTeamMembers || [];

    if (userIds.length === 0) {
        return `<span style="display:inline-flex;align-items:center;gap:4px;color:#94a3b8;font-size:12px;">
            ${tccIcon('user', 14)} <span>Toewijzen</span>
        </span>`;
    }

    // Eén persoon
    if (userIds.length === 1) {
        const lid = teamleden.find(m => (m.user_id || m.id) === userIds[0]);
        const naam  = lid?.naam || lid?.email || 'Onbekend';
        const init  = lid?.initialen || naam.substring(0, 2).toUpperCase();
        const kleur = lid?.avatar_kleur || '#667eea';
        return `
        <span class="planning-assignee-pill" title="${escHtml(naam)}">
            <span class="planning-assignee-dot" style="background:${kleur}">${escHtml(init)}</span>
            <span>${escHtml(naam.split(' ')[0])}</span>
        </span>`;
    }

    // Meerdere — avatar stack
    const zichtbaar = userIds.slice(0, 3);
    const rest = userIds.length - zichtbaar.length;
    const avatars = zichtbaar.map(uid => {
        const lid = teamleden.find(m => (m.user_id || m.id) === uid);
        const init  = lid?.initialen || (lid?.naam || '?').substring(0, 2).toUpperCase();
        const kleur = lid?.avatar_kleur || '#667eea';
        return `<span style="width:22px;height:22px;border-radius:50%;background:${kleur};color:white;
                             font-size:9px;font-weight:700;display:inline-flex;align-items:center;
                             justify-content:center;border:2px solid white;margin-left:-6px;first:margin-left:0;">
            ${escHtml(init)}</span>`;
    }).join('');

    return `<span style="display:inline-flex;align-items:center;">
        <span style="margin-left:6px;">${avatars}</span>
        ${rest > 0 ? `<span class="planning-assignee-more" style="margin-left:4px;">+${rest}</span>` : ''}
    </span>`;
}

function _ppRenderDatum(taak, isDone, isActive, isDeadline) {
    if (!taak.datum) {
        return `<span class="planning-task-date" data-action="pp-set-date" data-taak-id="${taak.id}"
                      style="cursor:pointer;color:#cbd5e1;font-size:12px;" title="Datum instellen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Datum
        </span>`;
    }

    const datumStr = _ppFormatDate(taak.datum);
    const datumCls = isDone ? 'done' : isActive ? 'highlight' : '';
    const datumStyle = isDeadline ? 'color:#dc2626;font-weight:700;' : '';
    return `<span class="planning-task-date ${datumCls}" data-action="pp-set-date" data-taak-id="${taak.id}"
                  style="cursor:pointer;${datumStyle}" title="Datum wijzigen">
        ${datumStr}
    </span>`;
}

// ============================================
// HANDLERS — State transitions
// ============================================

function handlePpToonConfig() {
    tccState.projectplanningState = 'config';
    _ppRerender();
    _ppAttachBufferListener(_ppGetPanel());
}

function handlePpAnnuleer() {
    const heeftTaken = (tccState.data?.projectplanning?.taken || []).length > 0;
    tccState.projectplanningState = heeftTaken ? 'data' : 'leeg';
    _ppRerender();
}

// ============================================
// HANDLER — Backplanning genereren
// ============================================

async function handlePpStartGenereren() {
    const panel = _ppGetPanel();
    if (!panel) return;

    const deadline   = panel.querySelector('#pp-deadline')?.value || '';
    const buffer     = panel.querySelector('#pp-buffer')?.value || '3';
    const uitvoerder = panel.querySelector('#pp-uitvoerder')?.value || '';

    if (!deadline) {
        showTccToast('Vul een inschrijvingsdeadline in', 'warn');
        return;
    }

    const tenderId = tccState.tenderId;
    if (!tenderId) {
        showTccToast('Geen tender geselecteerd', 'error');
        return;
    }

    // B) Bevestigingsdialoog als er al taken bestaan
    const bestaandeTaken = tccState.data?.projectplanning?.taken || [];
    if (bestaandeTaken.length > 0) {
        const bevestigd = confirm(
            `Er staan al ${bestaandeTaken.length} taken in de planning. Wil je deze overschrijven?`
        );
        if (!bevestigd) return;
    }

    tccState.projectplanningState = 'loading';
    panel.querySelector('.tcc-pp-container').innerHTML = _renderPpLoading();
    _animeerPpStappen();

    try {
        const bureauId = tccState.data?.tender?.tenderbureau_id || window.app?.currentBureau?.id;

        // Als er nog geen taken zijn: laad eerst template zodat de AI datums kan invullen
        if (bestaandeTaken.length === 0) {
            let templateId = null;
            if (bureauId) {
                try {
                    const templatesResp = await tccApiCall(
                        `/api/v1/planning-templates?type=planning&tenderbureau_id=${bureauId}`,
                        { method: 'GET' }
                    );
                    const templates = templatesResp?.data || [];
                    const gekozenTemplate = templates.find(t => t.is_standaard) || templates[0] || null;
                    templateId = gekozenTemplate?.id || null;
                } catch (templateErr) {
                    console.warn('[TCC] Templates ophalen mislukt:', templateErr);
                }
            }
            if (templateId) {
                await tccApiCall(
                    `/api/v1/ai-documents/tenders/${tenderId}/populate-from-template`,
                    {
                        method: 'POST',
                        body: JSON.stringify({ template_id: templateId, overschrijf: false })
                    }
                );
            } else {
                showTccToast('Geen template gevonden voor dit bureau. Maak eerst een planningstemplate aan.', 'warn', 6000);
                tccState.projectplanningState = 'config';
                const panelEl = _ppGetPanel();
                if (panelEl) panelEl.outerHTML = renderTabProjectplanning(tccState.data || {});
                return;
            }
        }

        // AI vult datums in op de bestaande taken (geen DELETE/INSERT)
        const result = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tenderId}/generate-backplanning`,
            {
                method: 'POST',
                body: JSON.stringify({
                    deadline: deadline,
                    buffer_werkdagen: parseInt(buffer, 10),
                    overschrijf: false
                })
            }
        );

        const freshData = await fetchTccData(tenderId);
        tccState.data = freshData;
        tccState.projectplanningState = 'data';

        const panelEl = _ppGetPanel();
        if (panelEl) panelEl.outerHTML = renderTabProjectplanning(freshData);

        const tabBtn = tccState.overlay?.querySelector('[data-tab="projectplanning"]');
        const badge  = tabBtn?.querySelector('.tcc-tab-badge');
        if (badge && freshData.projectplanning?.badge) badge.textContent = freshData.projectplanning.badge;

        const bijgewerkt = result.bijgewerkt || (freshData.projectplanning?.taken?.length || 0);
        showTccToast(`✅ ${bijgewerkt} taken bijgewerkt met datums`, 'success');

    } catch (err) {
        const errMsg = err.message || String(err);
        const isApiLimiet = errMsg.includes('API usage limits') || errMsg.includes('rate_limit') ||
                            errMsg.includes('overloaded') || err.status === 429;

        if (isApiLimiet) {
            console.warn('[TCC] AI API limiet bereikt — probeer template fallback');
            showTccToast(
                'AI-credits zijn tijdelijk op. Planning wordt aangemaakt op basis van het template — je kunt handmatig aanvullen.',
                'warn',
                8000
            );
            try {
                await _ppTemplateOnlyFallback(tenderId, deadline, uitvoerder);
                return;
            } catch (fallbackErr) {
                console.error('[TCC] Template fallback ook mislukt:', fallbackErr);
            }
        }

        console.error('[TCC] Backplanning genereren mislukt:', err);
        tccState.projectplanningState = 'config';
        const panelEl = _ppGetPanel();
        if (panelEl) panelEl.outerHTML = renderTabProjectplanning(tccState.data || {});
        showTccToast(`Genereren mislukt: ${errMsg}`, 'error');
    }
}

async function _ppTemplateOnlyFallback(tenderId, deadline, uitvoerder) {
    const bureauId = tccState.data?.tender?.tenderbureau_id;
    if (!bureauId) throw new Error('Geen tenderbureau_id beschikbaar voor template fallback');

    // Haal template-lijst op voor dit bureau
    const templatesResp = await tccApiCall(`/api/v1/planning-templates?tenderbureau_id=${bureauId}`);
    const templates = templatesResp?.data || templatesResp || [];
    const template = Array.isArray(templates)
        ? templates.find(t => t.is_standaard) || templates[0]
        : null;

    if (!template) throw new Error('Geen planning template gevonden voor dit bureau');

    const teamAssignments = uitvoerder ? { tendermanager: uitvoerder } : {};

    await tccApiCall('/api/v1/planning/generate-backplanning', {
        method: 'POST',
        body: JSON.stringify({
            deadline,
            template_id: template.id,
            team_assignments: teamAssignments,
            tenderbureau_id: bureauId,
            tender_id: tenderId,
            include_checklist: true
        })
    });

    const freshData = await fetchTccData(tenderId);
    tccState.data = freshData;
    tccState.projectplanningState = 'data';
    const panelEl = _ppGetPanel();
    if (panelEl) panelEl.outerHTML = renderTabProjectplanning(freshData);
    const aangemaakt = freshData.projectplanning?.taken?.length || 0;
    showTccToast(`${aangemaakt} taken aangemaakt (template, zonder AI)`, 'success');
}

function _animeerPpStappen() {
    let stapNr = 1;
    const interval = setInterval(() => {
        stapNr++;
        if (stapNr > 4) { clearInterval(interval); return; }
        const stappen = tccState.overlay?.querySelectorAll('[data-panel="projectplanning"] [data-stap]');
        if (!stappen) { clearInterval(interval); return; }
        stappen.forEach(el => {
            const nr = parseInt(el.dataset.stap);
            el.classList.toggle('tcc-stap--actief', nr === stapNr);
            el.classList.toggle('tcc-stap--blue',   nr === stapNr);
            el.classList.toggle('tcc-stap--gedaan',  nr < stapNr);
        });
    }, 1800);
}

// ============================================
// HANDLER — Toggle taak status
// ============================================

async function handlePpToggleTaak(taakId, huidigStatus) {
    const nieuweStatus = huidigStatus === 'done' ? 'todo' : 'done';
    try {
        window.showAutoSaveIndicator?.('saving');

        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken/${taakId}`,
            { method: 'PATCH', body: JSON.stringify({ status: nieuweStatus }) }
        );

        // Optimistic update in lokale state
        const taken = tccState.data?.projectplanning?.taken || [];
        const taak  = taken.find(t => t.id === taakId);
        if (taak) taak.status = nieuweStatus;

        window.showAutoSaveIndicator?.('saved');
        _ppRerender();

    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        console.error('[TCC] Toggle taak mislukt:', err);
        showTccToast('Status bijwerken mislukt', 'error');
    }
}

// ============================================
// HANDLER — Datum picker
// ============================================

function handlePpSetDate(taakId, targetEl) {
    const taken = tccState.data?.projectplanning?.taken || [];
    const taak  = taken.find(t => t.id === taakId);
    if (!taak) return;

    // Verwijder bestaande pickers
    tccState.overlay?.querySelectorAll('.pp-date-picker').forEach(el => el.remove());

    const picker = document.createElement('div');
    picker.className = 'pp-date-picker';
    Object.assign(picker.style, {
        position: 'absolute', zIndex: '10100',
        background: 'white', borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '12px', display: 'flex', flexDirection: 'column',
        gap: '8px', minWidth: '200px'
    });

    const currentDate = taak.datum ? new Date(taak.datum).toISOString().split('T')[0] : '';

    picker.innerHTML = `
        <label style="font-size:12px;font-weight:600;color:#475569;">Datum instellen</label>
        <input type="date" value="${currentDate}"
               style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;color:#0f172a;">
        <div style="display:flex;gap:6px;justify-content:flex-end;">
            ${taak.datum ? `<button class="pp-dp-clear" style="padding:5px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Wissen</button>` : ''}
            <button class="pp-dp-cancel" style="padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Annuleren</button>
            <button class="pp-dp-save" style="padding:5px 12px;border-radius:6px;border:none;background:#2563eb;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Opslaan</button>
        </div>
    `;

    // Positioneer relatief aan de TCC overlay
    const overlayEl = tccState.overlay;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlayEl?.getBoundingClientRect() || { top: 0, right: window.innerWidth };
    picker.style.top  = `${rect.bottom - overlayRect.top + 4}px`;
    picker.style.right = `${overlayRect.right - rect.right + 8}px`;
    overlayEl?.appendChild(picker);

    const input = picker.querySelector('input[type="date"]');
    input.focus();

    picker.querySelector('.pp-dp-save').addEventListener('click', async () => {
        if (input.value) await _ppSaveDatum(taakId, input.value);
        picker.remove();
    });
    picker.querySelector('.pp-dp-cancel').addEventListener('click', () => picker.remove());
    picker.querySelector('.pp-dp-clear')?.addEventListener('click', async () => {
        await _ppSaveDatum(taakId, null);
        picker.remove();
    });
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && input.value) { await _ppSaveDatum(taakId, input.value); picker.remove(); }
        if (e.key === 'Escape') picker.remove();
    });

    setTimeout(() => {
        const close = (e) => {
            if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close); }
        };
        document.addEventListener('click', close);
    }, 100);
}

async function _ppSaveDatum(taakId, dateStr) {
    try {
        window.showAutoSaveIndicator?.('saving');
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken/${taakId}`,
            { method: 'PATCH', body: JSON.stringify({ datum: dateStr ? `${dateStr}T00:00:00` : null }) }
        );

        const taak = (tccState.data?.projectplanning?.taken || []).find(t => t.id === taakId);
        if (taak) taak.datum = dateStr ? `${dateStr}T00:00:00` : null;

        window.showAutoSaveIndicator?.('saved');
        _ppRerender();
    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        console.error('[TCC] Datum opslaan mislukt:', err);
        showTccToast('Datum opslaan mislukt', 'error');
    }
}

// ============================================
// HANDLER — Assignee dropdown
// ============================================

function handlePpAssign(taakId, targetEl) {
    const taken    = tccState.data?.projectplanning?.taken || [];
    const taak     = taken.find(t => t.id === taakId);
    if (!taak) return;

    const teamleden = tccState.data?._bureauTeamMembers || [];

    // Verwijder bestaande dropdowns
    tccState.overlay?.querySelectorAll('.pp-assignee-dd').forEach(el => el.remove());

    const dd = document.createElement('div');
    dd.className = 'pp-assignee-dd';
    Object.assign(dd.style, {
        position: 'absolute', zIndex: '10100',
        background: 'white', borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        padding: '8px 0', minWidth: '220px', maxHeight: '280px', overflowY: 'auto'
    });

    const overlayEl = tccState.overlay;
    const rect = targetEl.getBoundingClientRect();
    const overlayRect = overlayEl?.getBoundingClientRect() || { top: 0, left: 0 };
    dd.style.top  = `${rect.bottom - overlayRect.top + 4}px`;
    dd.style.left = `${rect.left - overlayRect.left}px`;
    overlayEl?.appendChild(dd);

    const renderOpties = () => {
        const currentIds = Array.isArray(taak.toegewezen_aan) ? taak.toegewezen_aan : [];

        let html = `<div style="padding:6px 14px 8px;font-size:12px;font-weight:700;color:#475569;
                                border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
            <span>Teamlid toewijzen</span>
            ${currentIds.length > 0 ? `<span style="font-size:11px;color:#2563eb;font-weight:600;">${currentIds.length} geselecteerd</span>` : ''}
        </div>`;

        if (teamleden.length === 0) {
            html += `<div style="padding:14px;font-size:13px;color:#94a3b8;text-align:center;">Geen teamleden gevonden</div>`;
        } else {
            teamleden.forEach(lid => {
                const memberId  = lid.user_id || lid.id;
                const isAssigned = currentIds.includes(memberId);
                const init  = lid.initialen || (lid.naam || '?').substring(0, 2).toUpperCase();
                const kleur = lid.avatar_kleur || '#667eea';
                const naam  = lid.naam || lid.email || 'Onbekend';
                const rol   = lid.bureau_rol || lid.rol || '';

                html += `<div class="pp-assignee-opt" data-member-id="${memberId}"
                              style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;
                                     ${isAssigned ? 'background:#eff6ff;' : ''}">
                    <span style="width:28px;height:28px;border-radius:50%;background:${kleur};color:white;
                                 font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        ${escHtml(init)}
                    </span>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:${isAssigned ? '700' : '500'};color:#0f172a;">${escHtml(naam)}</div>
                        ${rol ? `<div style="font-size:11px;color:#94a3b8;">${escHtml(rol)}</div>` : ''}
                    </div>
                    ${isAssigned ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>`;
            });
        }

        dd.innerHTML = html;

        dd.querySelectorAll('.pp-assignee-opt').forEach(opt => {
            opt.addEventListener('click', async () => {
                await _ppToggleAssignee(taakId, opt.dataset.memberId);
                renderOpties(); // refresh dropdown
            });
        });
    };

    renderOpties();

    setTimeout(() => {
        const close = (e) => {
            if (!dd.contains(e.target) && !targetEl.contains(e.target)) {
                dd.remove();
                document.removeEventListener('click', close);
                _ppRerender();
            }
        };
        document.addEventListener('click', close);
    }, 100);
}

async function _ppToggleAssignee(taakId, memberId) {
    const taak = (tccState.data?.projectplanning?.taken || []).find(t => t.id === taakId);
    if (!taak) return;

    const current = Array.isArray(taak.toegewezen_aan) ? taak.toegewezen_aan : [];
    const nieuweIds = current.includes(memberId)
        ? current.filter(id => id !== memberId)
        : [...current, memberId];

    try {
        window.showAutoSaveIndicator?.('saving');
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken/${taakId}`,
            { method: 'PATCH', body: JSON.stringify({ toegewezen_aan: nieuweIds }) }
        );
        taak.toegewezen_aan = nieuweIds;
        window.showAutoSaveIndicator?.('saved');
    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        console.error('[TCC] Toewijzen mislukt:', err);
        showTccToast('Toewijzen mislukt', 'error');
    }
}

// ============================================
// HANDLER — 3-dot menu
// ============================================

function handlePpTaakMenu(taakId) {
    const taken = tccState.data?.projectplanning?.taken || [];
    const taak  = taken.find(t => t.id === taakId);
    if (!taak) return;

    // Verwijder bestaande menus
    tccState.overlay?.querySelectorAll('.pp-taak-menu-popup').forEach(el => el.remove());

    // Zoek de menu-knop op voor positionering
    const menuBtn = tccState.overlay?.querySelector(`[data-action="pp-taak-menu"][data-taak-id="${taakId}"]`);

    const menu = document.createElement('div');
    menu.className = 'pp-taak-menu-popup';
    Object.assign(menu.style, {
        position: 'absolute', zIndex: '10100',
        background: 'white', borderRadius: '10px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
        padding: '4px 0', minWidth: '190px'
    });

    const statusOpties = [
        { value: 'todo',   label: 'Te doen',  icon: 'circle' },
        { value: 'active', label: 'Actief',   icon: 'zap' },
        { value: 'done',   label: 'Klaar',    icon: 'checkCircle' }
    ];

    menu.innerHTML = `
        <div style="padding:4px 14px 6px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                    letter-spacing:0.5px;border-bottom:1px solid #f1f5f9;margin-bottom:2px;">
            ${escHtml((taak.taak_naam || '').substring(0, 30))}${(taak.taak_naam || '').length > 30 ? '…' : ''}
        </div>
        <div class="pp-menu-item" data-menu="edit-naam"
             style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;font-size:13px;color:#334155;">
            ${tccIcon('edit', 14, '#64748b')} Naam bewerken
        </div>
        <div style="padding:4px 14px 2px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                    letter-spacing:0.5px;border-top:1px solid #f1f5f9;margin-top:2px;">Status</div>
        ${statusOpties.map(s => `
        <div class="pp-menu-item" data-menu="status-${s.value}"
             style="display:flex;align-items:center;gap:10px;padding:7px 14px;cursor:pointer;font-size:13px;
                    color:${taak.status === s.value ? '#2563eb' : '#334155'};
                    background:${taak.status === s.value ? '#eff6ff' : 'transparent'};">
            ${tccIcon(s.icon, 14, taak.status === s.value ? '#2563eb' : '#64748b')} ${s.label}
            ${taak.status === s.value ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
        </div>`).join('')}
        <div style="border-top:1px solid #f1f5f9;margin-top:2px;"></div>
        <div class="pp-menu-item pp-menu-item--danger" data-menu="verwijder"
             style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;font-size:13px;color:#dc2626;">
            ${tccIcon('trash', 14, '#dc2626')} Verwijderen
        </div>
    `;

    // Positioneer
    const overlayEl = tccState.overlay;
    const overlayRect = overlayEl?.getBoundingClientRect() || { top: 0, right: window.innerWidth };
    if (menuBtn) {
        const rect = menuBtn.getBoundingClientRect();
        menu.style.top   = `${rect.bottom - overlayRect.top + 4}px`;
        menu.style.right = `${overlayRect.right - rect.right + 4}px`;
    }
    overlayEl?.appendChild(menu);

    // Hover-stijl
    menu.querySelectorAll('.pp-menu-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            if (!item.classList.contains('pp-menu-item--danger')) item.style.background = '#f8fafc';
            else item.style.background = '#fef2f2';
        });
        item.addEventListener('mouseleave', () => {
            const menuKey = item.dataset.menu;
            const isActiveStatus = menuKey?.startsWith('status-') && taak.status === menuKey.replace('status-', '');
            item.style.background = isActiveStatus ? '#eff6ff' : 'transparent';
        });
    });

    // Acties
    menu.querySelector('[data-menu="edit-naam"]').addEventListener('click', () => {
        menu.remove();
        _ppEditNaam(taak);
    });

    statusOpties.forEach(s => {
        menu.querySelector(`[data-menu="status-${s.value}"]`)?.addEventListener('click', async () => {
            menu.remove();
            await _ppSetStatus(taakId, s.value);
        });
    });

    menu.querySelector('[data-menu="verwijder"]').addEventListener('click', () => {
        menu.remove();
        _ppVerwijderTaak(taak);
    });

    // Klik buiten sluit
    setTimeout(() => {
        const close = (e) => {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }
        };
        document.addEventListener('click', close);
    }, 100);
}

async function _ppEditNaam(taak) {
    const naam = prompt('Taaknaam:', taak.taak_naam || '');
    if (naam === null || !naam.trim()) return;

    try {
        window.showAutoSaveIndicator?.('saving');
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken/${taak.id}`,
            { method: 'PATCH', body: JSON.stringify({ taak_naam: naam.trim() }) }
        );
        taak.taak_naam = naam.trim();
        window.showAutoSaveIndicator?.('saved');
        _ppRerender();
    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        showTccToast('Naam opslaan mislukt', 'error');
    }
}

async function _ppSetStatus(taakId, nieuweStatus) {
    const taak = (tccState.data?.projectplanning?.taken || []).find(t => t.id === taakId);
    if (!taak) return;

    try {
        window.showAutoSaveIndicator?.('saving');
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken/${taakId}`,
            { method: 'PATCH', body: JSON.stringify({ status: nieuweStatus }) }
        );
        taak.status = nieuweStatus;
        window.showAutoSaveIndicator?.('saved');
        _ppRerender();
    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        showTccToast('Status bijwerken mislukt', 'error');
    }
}

async function _ppVerwijderTaak(taak) {
    if (!confirm(`"${taak.taak_naam}" verwijderen?`)) return;

    try {
        window.showAutoSaveIndicator?.('saving');
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken/${taak.id}`,
            { method: 'DELETE' }
        );

        if (tccState.data?.projectplanning?.taken) {
            tccState.data.projectplanning.taken =
                tccState.data.projectplanning.taken.filter(t => t.id !== taak.id);
        }

        window.showAutoSaveIndicator?.('saved');
        _ppRerender();
    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        showTccToast('Verwijderen mislukt', 'error');
    }
}

// ============================================
// HANDLER — Taak toevoegen
// ============================================

async function handlePpAddTaak() {
    const naam = prompt('Taaknaam:');
    if (!naam?.trim()) return;

    const categorie = prompt('Categorie:', 'Algemeen') || 'Algemeen';

    try {
        window.showAutoSaveIndicator?.('saving');
        const result = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken`,
            {
                method: 'POST',
                body: JSON.stringify({
                    taak_naam: naam.trim(),
                    categorie: categorie.trim(),
                    status: 'todo',
                    volgorde: (tccState.data?.projectplanning?.taken || []).length
                })
            }
        );

        if (result && !tccState.data.projectplanning) tccState.data.projectplanning = { taken: [] };
        if (result?.id) tccState.data.projectplanning.taken.push(result);

        window.showAutoSaveIndicator?.('saved');
        tccState.projectplanningState = 'data';
        _ppRerender();
    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        showTccToast('Taak toevoegen mislukt', 'error');
    }
}

// ============================================
// HANDLER — Template laden (popover)
// ============================================

async function handlePpLoadTemplate() {
    const btn = document.querySelector('[data-action="pp-load-template"]');
    if (!btn) return;

    // Sluit bestaande popover als die al open is
    const bestaand = document.getElementById('pp-template-popover');
    if (bestaand) { bestaand.remove(); return; }

    // Laad-indicator op de knop zetten
    const origHTML = btn.innerHTML;
    btn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;">
        <span style="width:12px;height:12px;border:2px solid #cbd5e1;border-top-color:#2563eb;
            border-radius:50%;animation:pp-spin .6s linear infinite;display:inline-block;"></span>
        Laden…
    </span>`;
    btn.disabled = true;

    let templates = [];
    try {
        const bureauId = window.app?.currentBureau?.id;
        const url = bureauId
            ? `/api/v1/planning-templates?type=planning&tenderbureau_id=${bureauId}`
            : `/api/v1/planning-templates?type=planning`;
        const resp = await tccApiCall(url, { method: 'GET' });
        templates = resp?.data || [];
    } catch (err) {
        console.error('[TCC] Templates ophalen mislukt:', err);
        showTccToast('Templates ophalen mislukt', 'error');
        btn.innerHTML = origHTML;
        btn.disabled = false;
        return;
    }

    btn.innerHTML = origHTML;
    btn.disabled = false;

    if (!templates.length) {
        showTccToast('Geen templates gevonden voor dit bureau', 'warning');
        return;
    }

    // Popover bouwen
    const heeftTaken = (tccState.data?.projectplanning?.taken || []).length > 0;
    const aantalTaken = tccState.data?.projectplanning?.taken?.length || 0;

    const popover = document.createElement('div');
    popover.id = 'pp-template-popover';
    popover.innerHTML = `
        <div class="pp-popover-header">
            <span class="pp-popover-title">Template laden</span>
            <button class="pp-popover-close" id="pp-popover-close">✕</button>
        </div>
        ${heeftTaken ? `
        <div class="pp-popover-warning">
            <span>⚠️</span>
            <span>${aantalTaken} bestaande taken worden vervangen</span>
        </div>` : ''}
        <div class="pp-popover-list">
            ${templates.map(t => `
                <button class="pp-popover-item" data-template-id="${t.id}">
                    <div class="pp-popover-item-main">
                        <span class="pp-popover-item-naam">${t.naam || 'Template'}</span>
                        ${t.is_standaard ? '<span class="pp-popover-badge">Standaard</span>' : ''}
                    </div>
                    <div class="pp-popover-item-meta">
                        ${t.taken?.length || 0} taken
                        ${t.beschrijving ? `· ${t.beschrijving}` : ''}
                    </div>
                </button>
            `).join('')}
        </div>
    `;

    // Positie berekenen t.o.v. de knop
    document.body.appendChild(popover);
    const rect = btn.getBoundingClientRect();
    const pw = popover.offsetWidth || 280;
    let left = rect.left;
    if (left + pw > window.innerWidth - 16) left = window.innerWidth - pw - 16;
    popover.style.top  = `${rect.bottom + 6}px`;
    popover.style.left = `${left}px`;

    // Animatie in
    requestAnimationFrame(() => popover.classList.add('pp-popover--visible'));

    // Sluit bij klik buiten
    function sluitPopover(e) {
        if (!popover.contains(e.target) && e.target !== btn) {
            popover.remove();
            document.removeEventListener('mousedown', sluitPopover);
        }
    }
    setTimeout(() => document.addEventListener('mousedown', sluitPopover), 0);

    // Sluit-knop
    popover.querySelector('#pp-popover-close').addEventListener('click', () => {
        popover.remove();
        document.removeEventListener('mousedown', sluitPopover);
    });

    // Template selectie
    popover.querySelectorAll('.pp-popover-item').forEach(item => {
        item.addEventListener('click', async () => {
            const templateId = item.dataset.templateId;
            const templateNaam = item.querySelector('.pp-popover-item-naam')?.textContent || 'Template';
            popover.remove();
            document.removeEventListener('mousedown', sluitPopover);
            await _ppVoerTemplateLaden(templateId, templateNaam, heeftTaken);
        });
    });
}

async function _ppVoerTemplateLaden(templateId, templateNaam, overschrijf) {
    try {
        window.showAutoSaveIndicator?.('saving');
        const tenderId = tccState.tenderId;
        if (!tenderId) return;

        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tenderId}/populate-from-template`,
            {
                method: 'POST',
                body: JSON.stringify({
                    template_id: templateId,
                    overschrijf: overschrijf
                })
            }
        );

        // Data herladen en tab herrenderen
        const freshData = await fetchTccData(tenderId);
        tccState.data = freshData;
        tccState.projectplanningState = 'data';
        _ppRerender();

        window.showAutoSaveIndicator?.('saved');
        showTccToast(`✅ "${templateNaam}" geladen`, 'success');

    } catch (err) {
        window.showAutoSaveIndicator?.('error');
        console.error('[TCC] Template laden mislukt:', err);
        showTccToast(`Template laden mislukt: ${err.message}`, 'error');
    }
}

// ============================================
// CSS INJECTIE
// ============================================

// ── Info popup handler ──────────────────────────────────────────
function handlePpToonInfo(taakId) {
    console.log('[PP] toon info taakId:', taakId,
                'taken:', tccState.data?.projectplanning?.taken?.length);
    const taak = (tccState.data?.projectplanning?.taken || []).find(t => String(t.id) === String(taakId));
    if (!taak?.beschrijving) return;

    const bestaand = document.querySelector(`.tcc-pp-info-popup[data-info-id="${taakId}"]`);
    if (bestaand) {
        document.querySelector(`.planning-task-row[data-taak-id="${taakId}"]`)?.classList.remove('is-actief');
        bestaand.remove();
        return;
    }

    document.querySelectorAll('.tcc-pp-info-popup').forEach(p => p.remove());
    document.querySelectorAll('.planning-task-row.is-actief').forEach(r => r.classList.remove('is-actief'));

    const popup = document.createElement('div');
    popup.className = 'tcc-pp-info-popup';
    popup.dataset.infoId = taakId;
    popup.innerHTML = `
        <div class="tcc-pp-info-popup-header">
            <div class="tcc-pp-info-popup-icon">${tccIcon('info', 13, '#64748b')}</div>
            <span class="tcc-pp-info-popup-title">Taakinformatie</span>
        </div>
        <div class="tcc-pp-info-popup-body">
            <div class="tcc-pp-info-popup-tekst">${escHtml(taak.beschrijving)}</div>
        </div>`;

    const rij = document.querySelector(`.planning-task-row[data-taak-id="${taakId}"]`);
    console.log('[PP] rij gevonden:', rij);
    if (!rij) return;
    rij.classList.add('is-actief');
    rij.insertAdjacentElement('afterend', popup);

    setTimeout(() => {
        document.addEventListener('click', function sluit(e) {
            if (!popup.contains(e.target) && !e.target.closest(`[data-taak-id="${taakId}"]`)) {
                rij.classList.remove('is-actief');
                popup.remove();
                document.removeEventListener('click', sluit);
            }
        });
    }, 0);
}

(function injectProjectplanningCSS() {
    if (document.getElementById('tcc-projectplanning-css')) return;
    const style = document.createElement('style');
    style.id = 'tcc-projectplanning-css';
    style.textContent = `

/* ── Container ── */
.tcc-pp-container { display: flex; flex-direction: column; gap: 0; }

/* ── Actie balk blauw ── */
.tcc-actie-balk--blue { border-left: 3px solid #2563eb; }
.tcc-actie-balk-icon--blue { background: #eff6ff; }

/* ── Empty state ── */
.tcc-pp-leeg {
    display: flex; flex-direction: column; align-items: center;
    gap: 12px; padding: 56px 20px; text-align: center;
}
.tcc-pp-leeg-icon { opacity: .5; }
.tcc-pp-leeg-title { font-size: 16px; font-weight: 700; color: #0f172a; }
.tcc-pp-leeg-desc  { font-size: 13px; color: #64748b; line-height: 1.5; max-width: 380px; }

/* ── Warning banner ── */
.tcc-pp-warning {
    display: flex; align-items: flex-start; gap: 10px;
    background: #fffbeb; border: 1px solid #fde68a;
    border-radius: 10px; padding: 12px 14px;
    font-size: 13px; color: #92400e; line-height: 1.5;
    margin: 12px 0;
}
.tcc-pp-warning strong { display: block; font-weight: 700; margin-bottom: 2px; }

/* ── Config card ── */
.tcc-pp-config-card {
    background: #fff; border: 1px solid #e2e8f0;
    border-radius: 12px; padding: 20px; margin: 12px 0;
}
.tcc-pp-config-titel { font-size: 13px; font-weight: 600; color: #0f172a; margin-bottom: 14px; }
.tcc-pp-config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.tcc-pp-config-veld { display: flex; flex-direction: column; gap: 4px; }
.tcc-pp-config-veld label {
    font-size: 11px; font-weight: 600; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.5px;
}
.tcc-pp-config-veld input,
.tcc-pp-config-veld select {
    padding: 8px 10px; border: 1px solid #e2e8f0; border-radius: 8px;
    font-size: 13px; color: #0f172a; background: #f8fafc; font-family: inherit;
}
.tcc-pp-config-veld input:focus,
.tcc-pp-config-veld select:focus {
    outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px #dbeafe;
}
.tcc-pp-config-veld--full { grid-column: 1 / -1; }
.tcc-pp-config-checkbox {
    display: flex; align-items: center; gap: 10px;
    padding: 10px; background: #ede9fe; border-radius: 8px;
}
.tcc-pp-config-checkbox label {
    font-size: 13px; color: #4c1d95; cursor: pointer;
    margin: 0; text-transform: none; letter-spacing: 0;
}
.tcc-pp-genereer-btn { width: 100%; justify-content: center; }

/* ── Preview (in config state) ── */
.tcc-pp-preview {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 10px; padding: 14px; margin-top: 12px;
}
.tcc-pp-preview-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
.tcc-pp-preview-title  { font-size: 13px; font-weight: 600; color: #0f172a; }
.tcc-pp-preview-count  { font-size: 12px; color: #64748b; }
.tcc-pp-preview-rij {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 0; border-bottom: 1px solid #e2e8f0;
}
.tcc-pp-preview-rij:last-of-type { border-bottom: none; }
.tcc-pp-preview-meer {
    font-size: 12px; color: #94a3b8;
    padding: 8px 0 0; text-align: center;
}

/* ── Taak rij componenten ── */
.tcc-pp-taak-nr {
    width: 24px; height: 24px; border-radius: 6px;
    background: #eff6ff; color: #2563eb;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.tcc-pp-taak-body  { flex: 1; min-width: 0; }
.tcc-pp-taak-naam  { font-size: 13px; font-weight: 600; color: #0f172a; }
.tcc-pp-taak-meta  { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.tcc-pp-taak-datum { font-size: 12px; color: #475569; white-space: nowrap; flex-shrink: 0; }

/* ── Toolbar scoped ── */
.tcc-pp-container .planning-toolbar {
    border-bottom: 1px solid #f1f5f9;
    background: white; margin: 0; padding: 10px 0;
}

/* ── Task list scoped ── */
.tcc-pp-container .planning-task-list  { padding: 0 0 20px; }
.tcc-pp-container .planning-task-row  {
    grid-template-columns: 32px 1fr 200px 110px 72px 32px;
    margin: 0; border-radius: 4px;
}

/* ── Status pills fallback ── */
.tcc-pp-container .status--done     { background: #dcfce7; color: #15803d; }
.tcc-pp-container .status--active   { background: #ffedd5; color: #ea580c; }
.tcc-pp-container .status--todo     { background: #f1f5f9; color: #64748b; }
.tcc-pp-container .status--deadline { background: #fee2e2; color: #dc2626; font-weight: 700; }

/* ── Loading stappen blauw variant ── */
.tcc-stap--blue    { color: #2563eb !important; background: #eff6ff !important; }

/* ── Template popover ── */
@keyframes pp-spin { to { transform: rotate(360deg); } }

#pp-template-popover {
    position: fixed;
    z-index: 99999;
    width: 280px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(15,23,42,.12), 0 2px 6px rgba(15,23,42,.06);
    overflow: hidden;
    opacity: 0;
    transform: translateY(-6px) scale(.98);
    transition: opacity .15s ease, transform .15s ease;
    pointer-events: none;
}
#pp-template-popover.pp-popover--visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
}
.pp-popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 10px;
    border-bottom: 1px solid #f1f5f9;
}
.pp-popover-title {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.pp-popover-close {
    border: none;
    background: none;
    color: #94a3b8;
    font-size: 12px;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1;
}
.pp-popover-close:hover { background: #f1f5f9; color: #475569; }

.pp-popover-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #fffbeb;
    border-bottom: 1px solid #fde68a;
    font-size: 12px;
    color: #92400e;
}
.pp-popover-list { padding: 6px; }

.pp-popover-item {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 12px;
    border: none;
    background: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: background .1s;
}
.pp-popover-item:hover { background: #f8fafc; }
.pp-popover-item:active { background: #eff6ff; }

.pp-popover-item-main {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}
.pp-popover-item-naam {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    flex: 1;
}
.pp-popover-badge {
    font-size: 10px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 2px 6px;
    border-radius: 20px;
    white-space: nowrap;
}
.pp-popover-item-meta {
    font-size: 11px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
}
.tcc-spinner--blue { border-top-color: #2563eb !important; }

/* ── Date picker & assignee popup ── */
.pp-date-picker,
.pp-assignee-dd,
.pp-taak-menu-popup { font-family: inherit; }

/* ── Info popup ── */
.tcc-pp-info-popup {
    background: #ffffff;
    border: 0.5px solid #c4b5fd;
    border-top: none;
    border-radius: 0 0 10px 10px;
    margin-bottom: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    overflow: hidden;
}
.tcc-pp-info-popup-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px 8px;
    border-bottom: 0.5px solid #f1f5f9;
    background: #f8fafc;
}
.tcc-pp-info-popup-icon {
    width: 28px;
    height: 28px;
    background: #ede9fe;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.tcc-pp-info-popup-title {
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: .05em;
}
.tcc-pp-info-popup-body { padding: 12px 14px; }
.tcc-pp-info-popup-tekst {
    font-size: 13px;
    color: #374151;
    line-height: 1.6;
}

`;
    document.head.appendChild(style);
})();