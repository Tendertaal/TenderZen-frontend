/* ============================================
   TCC_TabChecklist.js  —  v1.0  (2026-03-13)
   Checklist tab — gelijkgetrokken met standalone PlanningModal

   Bevat:
   - renderTabChecklist(data)         — hoofd render (state router)
   - _renderClLeeg(data)              — lege staat met extractie CTA
   - _renderClPicker(data)            — document selectie voor extractie
   - _renderClLoading()               — loading skeleton
   - _renderClData(data, globalData)  — checklist met items (hoofdweergave)
   - _renderClInhoud(state, data, g)  — state router
   - Per-item rendering, assignee, deadline, status, 3-dot menu
   - Template laden (popover)
   - Item toevoegen
   - Volledig CRUD via write endpoints

   Data model (checklist_items):
     id, tender_id, tenderbureau_id, naam (taak_naam), sectie (categorie),
     is_verplicht, status ('pending'|'in_progress'|'completed'), volgorde,
     toegewezen_aan (array UUID[]), deadline (date), beschrijving

   API endpoints (nieuw toe te voegen in ai_documents.py):
     GET    /ai-documents/tenders/{id}/checklist-items            (bestaand)
     PATCH  /ai-documents/tenders/{id}/checklist-items/{item_id} (nieuw)
     DELETE /ai-documents/tenders/{id}/checklist-items/{item_id} (nieuw)
     POST   /ai-documents/tenders/{id}/checklist-items           (nieuw)
     POST   /ai-documents/tenders/{id}/extract-checklist         (bestaand)

   Handlers via switch in TCC_Core.js initTccEvents():
     case 'cl-toon-picker':       handleClToonPicker(); break;
     case 'cl-annuleer':          handleClAnnuleer(); break;
     case 'cl-picker-toggle':     handleClPickerToggle(btn.dataset.docId, btn.dataset.docNaam); break;
     case 'cl-start-extractie':   handleClStartExtractie(); break;
     case 'cl-toggle-item':       handleClToggleItem(btn.dataset.itemId); break;
     case 'cl-set-deadline':      handleClSetDeadline(btn.dataset.itemId, btn); break;
     case 'cl-assign':            handleClAssign(btn.dataset.itemId, btn); break;
     case 'cl-item-menu':         handleClItemMenu(btn.dataset.itemId); break;
     case 'cl-add-item':          handleClAddItem(); break;
     case 'cl-load-template':     handleClLoadTemplate(); break;
   ============================================ */

// ============================================
// HELPERS
// ============================================

function _clFormatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

// Vaste volgorde voor bekende secties
const CL_SECTIE_VOLGORDE = [
    'Inleverdocumenten',
    'Verklaringen',
    'Selectie-eisen',
    'Geschiktheidseisen',
    'Uitsluitingsgronden',
    'Gunningscriteria',
    'Contracteisen',
    'Overige documenten',
    'Overig',
];

function _clGroupBySectie(items) {
    const grouped = {};
    items.forEach(item => {
        const cat = item.sectie || item.categorie || 'Overig';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    const gesorteerd = {};
    const keys = Object.keys(grouped);
    keys.sort((a, b) => {
        const ia = CL_SECTIE_VOLGORDE.indexOf(a);
        const ib = CL_SECTIE_VOLGORDE.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });
    for (const k of keys) gesorteerd[k] = grouped[k];
    return gesorteerd;
}

function _clGetStatusConfig(status) {
    const map = {
        'completed':   { label: 'Afgerond',    cls: 'cl-status--done' },
        'in_progress': { label: 'In uitvoering', cls: 'cl-status--active' },
        'pending':     { label: 'Te doen',     cls: 'cl-status--todo' },
    };
    return map[status] || map.pending;
}

function _clGetPanel() {
    return tccState.overlay?.querySelector('[data-panel="checklist"]');
}

function _clRerender() {
    const panel = _clGetPanel();
    const container = panel?.querySelector('.tcc-cl-container');
    if (!panel) return;
    if (!container) return;
    const items = tccState.data?.checklist?.items || [];
    const state = tccState.checklistState !== null
        ? tccState.checklistState
        : (items.length > 0 ? 'data' : 'leeg');
    container.innerHTML = _renderClInhoud(state, tccState.data?.checklist || {}, tccState.data || {});
    _updateChecklistBadge();
}

// ============================================
// RENDER — Hoofd
// ============================================

function renderTabChecklist(data) {
    const isActive = tccState.activeTab === 'checklist';
    const items = data?.checklist?.items || [];
    let state = tccState.checklistState;
    if (!state) state = items.length > 0 ? 'data' : 'leeg';

    return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="checklist">
        <div class="tcc-cl-container">
            ${_renderClInhoud(state, data?.checklist || {}, data || {})}
        </div>
    </div>`;
}

function _renderClInhoud(state, clData, globalData) {
    if (state === 'loading') return _renderClLoading();
    if (state === 'picker' || state === 'aanvullen-picker') return _renderClPicker(globalData);
    if (state === 'data') return _renderClData(clData, globalData);
    return _renderClLeeg(globalData);
}

// ============================================
// STATE: LEEG
// ============================================

function _renderClLeeg(_globalData) {
    return `
    <div class="tcc-cl-state-leeg">
        <div class="tcc-empty">
            ${tccIcon('checkSquare', 48, '#cbd5e1')}
            <div class="tcc-empty-title">Geen checklist beschikbaar</div>
            <div class="tcc-empty-desc">Start met AI extractie op basis van het aanbestedingsdocument, of laad een standaard template als startpunt.</div>
            <div class="tcc-cl-leeg-acties">
                <button class="tcc-btn tcc-btn--primary" data-action="cl-toon-picker">
                    ${tccIcon('sparkles', 14, '#fff')} AI Extractie
                </button>
                <button class="tcc-btn tcc-btn--ghost" data-action="cl-load-template" id="cl-template-btn">
                    ${tccIcon('fileText', 14)} Template laden
                </button>
            </div>
        </div>
    </div>`;
}

// ============================================
// STATE: PICKER
// ============================================

function _renderClPicker(globalData) {
    const docs = globalData?.documenten || [];
    const geselecteerd = tccState._clPickerSelected || [];

    return `
    <div class="tcc-cl-state-picker">
        <div class="tcc-actie-balk">
            <div class="tcc-actie-balk-icon tcc-actie-balk-icon--green">
                ${tccIcon('checkSquare', 18, '#16a34a')}
            </div>
            <div class="tcc-actie-balk-info">
                <div class="tcc-actie-balk-title">Selecteer document(en)</div>
                <div class="tcc-actie-balk-desc">Kies documenten om inleveritems uit te extraheren.</div>
            </div>
            <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="cl-annuleer">Annuleren</button>
        </div>

        ${docs.length === 0 ? `
        <div class="tcc-pp-picker-leeg">
            ${tccIcon('fileText', 32, '#cbd5e1')}
            <p>Geen brondocumenten beschikbaar. Upload eerst documenten via de Documenten tab.</p>
        </div>` : `
        <div class="tcc-pp-doc-picker">
            <div class="tcc-pp-picker-header">Beschikbare documenten (${docs.length})</div>
            ${docs.map(doc => {
                const isSelected = geselecteerd.includes(doc.id);
                return `
                <div class="tcc-pp-picker-item${isSelected ? ' selected' : ''}"
                     data-action="cl-picker-toggle"
                     data-doc-id="${escHtml(doc.id)}"
                     data-doc-naam="${escHtml(doc.original_file_name || doc.file_name || '')}">
                    <div class="tcc-pp-picker-checkbox${isSelected ? ' checked' : ''}">
                        ${isSelected ? tccIcon('check', 11, '#fff') : ''}
                    </div>
                    <div class="tcc-pp-picker-meta">
                        <div class="tcc-pp-picker-naam">${escHtml(doc.original_file_name || doc.file_name || 'Document')}</div>
                        <div class="tcc-pp-picker-sub">${doc.file_type ? doc.file_type.toUpperCase() : 'PDF'} · ${doc.uploaded_at ? _clFormatDate(doc.uploaded_at) : ''}</div>
                    </div>
                    ${doc.is_primair ? `<span class="tcc-pp-picker-badge tcc-pp-picker-badge--green">Aanbevolen</span>` : ''}
                </div>`;
            }).join('')}
        </div>
        <div class="tcc-pp-picker-footer">
            <span class="tcc-pp-picker-count">${geselecteerd.length} geselecteerd</span>
            <button class="tcc-btn tcc-btn--primary${geselecteerd.length === 0 ? ' tcc-btn--disabled' : ''}"
                    data-action="cl-start-extractie"
                    ${geselecteerd.length === 0 ? 'disabled' : ''}>
                ${tccIcon('sparkles', 14, '#fff')} Extraheer nu
            </button>
        </div>`}
    </div>`;
}

// ============================================
// STATE: LOADING
// ============================================

function _renderClLoading() {
    return `
    <div class="tcc-cl-state-loading">
        <div class="tcc-cl-loading">
            <div class="tcc-cl-loading-spinner"></div>
            <div class="tcc-cl-loading-tekst">
                <div class="tcc-cl-loading-titel">Checklist wordt geëxtraheerd…</div>
                <div class="tcc-cl-loading-sub">AI analyseert de documenten op inleveritems. Dit duurt ~15 seconden.</div>
            </div>
        </div>
        <div class="tcc-pp-loading-rows">
            ${[...Array(6)].map(() => `
            <div class="tcc-pp-skeleton-row">
                <div class="tcc-pp-skeleton tcc-pp-skeleton--checkbox"></div>
                <div class="tcc-pp-skeleton tcc-pp-skeleton--text"></div>
                <div class="tcc-pp-skeleton tcc-pp-skeleton--short"></div>
                <div class="tcc-pp-skeleton tcc-pp-skeleton--short"></div>
                <div class="tcc-pp-skeleton tcc-pp-skeleton--badge"></div>
            </div>`).join('')}
        </div>
    </div>`;
}

// ============================================
// STATE: DATA (hoofdweergave)
// ============================================

function _renderClData(clData, globalData) {
    const items = clData?.items || [];
    const done = items.filter(i => i.status === 'completed').length;
    const total = items.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const teamleden = globalData?._bureauTeamMembers || [];

    // Groepeer per sectie
    const groepen = _clGroupBySectie(items);

    return `
    <div class="tcc-cl-state-data">

        <!-- Toolbar -->
        <div class="tcc-pp-toolbar">
            <div class="tcc-pp-toolbar-left">
                <!-- Progress cirkel -->
                <div class="tcc-cl-progress-ring">
                    <svg width="36" height="36" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" stroke-width="3"/>
                        <circle cx="18" cy="18" r="14" fill="none"
                            stroke="${pct === 100 ? '#22c55e' : '#7c3aed'}" stroke-width="3"
                            stroke-dasharray="${Math.round(2 * Math.PI * 14 * pct / 100)} 88"
                            stroke-dashoffset="22"
                            stroke-linecap="round"
                            transform="rotate(-90 18 18)"/>
                    </svg>
                    <span class="tcc-cl-progress-label">${pct}%</span>
                </div>
                <div class="tcc-cl-progress-tekst">
                    <span class="tcc-cl-progress-count">${done} van ${total} compleet</span>
                    <span class="tcc-cl-progress-sub">${pct}% afgerond</span>
                </div>
            </div>
            <div class="tcc-pp-toolbar-right">
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="cl-load-template"
                        id="cl-template-btn" title="Template laden">
                    ${tccIcon('fileText', 14)} Template laden
                </button>
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="cl-aanvullen-picker" title="Aanvullen met AI">
                    ${tccIcon('sparkles', 14)} + Aanvullen met AI
                </button>
                <button class="tcc-btn tcc-btn--primary tcc-btn--sm" data-action="cl-add-item">
                    ${tccIcon('plus', 14, '#fff')} Item toevoegen
                </button>
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="cl-toon-picker" title="Opnieuw extraheren (alles vervangen)">
                    ${tccIcon('refresh', 14)} Opnieuw
                </button>
            </div>
        </div>

        <!-- Kolommen header -->
        <div class="tcc-cl-col-header">
            <span class="tcc-cl-col-taak">TAAK</span>
            <span class="tcc-cl-col-assign">TOEGEWEZEN AAN</span>
            <span class="tcc-cl-col-deadline">DEADLINE</span>
            <span class="tcc-cl-col-status">STATUS</span>
        </div>

        <!-- Groepen -->
        ${Object.entries(groepen).map(([sectie, groepItems]) => {
            const grDone = groepItems.filter(i => i.status === 'completed').length;
            const grTotal = groepItems.length;
            return `
            <div class="tcc-cl-groep">
                <div class="tcc-cl-groep-header">
                    <div class="tcc-cl-groep-dot" style="background:${grDone === grTotal && grTotal > 0 ? '#22c55e' : grDone > 0 ? '#f97316' : '#94a3b8'}"></div>
                    <span class="tcc-cl-groep-naam">${escHtml(sectie.toUpperCase())}</span>
                    <span class="tcc-cl-groep-count">${grDone}/${grTotal} taken</span>
                </div>
                ${groepItems.map(item => _renderClItem(item, teamleden)).join('')}
                <div class="tcc-cl-add-row" data-action="cl-add-item" data-sectie="${escHtml(sectie)}">
                    ${tccIcon('plus', 12, '#94a3b8')} Item toevoegen aan ${escHtml(sectie)}...
                </div>
            </div>`;
        }).join('')}

    </div>`;
}

// ============================================
// ITEM ROW RENDER
// ============================================

function _renderClItem(item, teamleden) {
    const isDone = item.status === 'completed';
    const statusCfg = _clGetStatusConfig(item.status);
    const itemId = escHtml(item.id);

    // Assignees
    const assignees = Array.isArray(item.toegewezen_aan) ? item.toegewezen_aan : [];
    const assigneeHtml = _renderClAssignees(assignees, teamleden, item.id);

    // Datum
    const datumHtml = item.deadline
        ? `<span class="tcc-cl-datum-val${_clIsUrgent(item.deadline) ? ' tcc-cl-datum--urgent' : ''}">${_clFormatDate(item.deadline)}</span>`
        : `<span class="tcc-cl-datum-placeholder">${tccIcon('calendar', 12, '#cbd5e1')} Datum</span>`;

    // Naam-cel: alleen klikbaar voor bron als bron_tekst aanwezig
    const naamCelAttr = item.bron_tekst
        ? `data-action="cl-toon-bron" data-item-id="${itemId}"`
        : '';
    const naamCelCls = `tcc-cl-item-naam${item.bron_tekst ? ' tcc-cl-item--heeft-bron' : ''}`;

    return `
    <div class="tcc-cl-item${isDone ? ' tcc-cl-item--done' : ''}" data-item-id="${itemId}">

        <!-- Checkbox: eigen data-action, geen stopPropagation -->
        <div class="tcc-cl-item-left">
            <button class="tcc-cl-checkbox${isDone ? ' tcc-cl-checkbox--checked' : ''}"
                    data-action="cl-toggle-item"
                    data-item-id="${itemId}"
                    title="${isDone ? 'Markeer als te doen' : 'Markeer als afgerond'}">
                ${isDone ? tccIcon('check', 12, '#fff') : ''}
            </button>
        </div>

        <!-- Naam-cel: data-action="cl-toon-bron" ALLEEN hier, niet op de item-rij -->
        <div class="${naamCelCls}" ${naamCelAttr}>
            <span class="tcc-cl-item-tekst${isDone ? ' tcc-cl-item-tekst--done' : ''}">${escHtml(item.naam || item.taak_naam || '')}</span>
            ${item.is_verplicht ? `<span class="tcc-cl-verplicht">Verplicht</span>` : ''}
            ${item.bron_tekst ? `<span class="tcc-cl-item-info-btn">${tccIcon('info', 15, '#7c3aed')}</span>` : ''}
        </div>

        <!-- Toegewezen aan -->
        <div class="tcc-cl-item-assign" data-action="cl-assign" data-item-id="${itemId}">
            ${assigneeHtml}
        </div>

        <!-- Deadline -->
        <div class="tcc-cl-item-deadline" data-action="cl-set-deadline" data-item-id="${itemId}">
            ${datumHtml}
        </div>

        <!-- Status badge -->
        <div class="tcc-cl-item-status">
            <span class="tcc-cl-status-badge tcc-cl-status--${item.status === 'completed' ? 'done' : item.status === 'in_progress' ? 'active' : 'todo'}">${statusCfg.label}</span>
        </div>

        <!-- 3-dot menu -->
        <button class="tcc-cl-menu-btn" data-action="cl-item-menu" data-item-id="${itemId}">
            ${tccIcon('moreVertical', 14, '#94a3b8')}
        </button>

    </div>`;
}

function _clIsUrgent(dateStr) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const now = new Date();
    const diff = (d - now) / (1000 * 60 * 60 * 24);
    return diff < 3;
}

function _renderClAssignees(assigneeIds, teamleden) {
    if (!assigneeIds || assigneeIds.length === 0) {
        return `<span class="tcc-cl-assign-placeholder">${tccIcon('user', 12, '#cbd5e1')} Toewijzen</span>`;
    }

    const avatarHtml = assigneeIds.slice(0, 3).map(aid => {
        const lid = teamleden.find(t => t.user_id === aid || t.id === aid);
        if (!lid) return '';
        const naam = lid.naam || lid.name || lid.email || '?';
        const initialen = naam.split(/\s+/).map(w => w[0]).join('').toUpperCase().substring(0, 2);
        const kleur = _clAvatarKleur(naam);
        return `<span class="tcc-cl-avatar" style="background:${kleur}" title="${escHtml(naam)}">${initialen}</span>`;
    }).join('');

    const extra = assigneeIds.length > 3 ? `<span class="tcc-cl-avatar tcc-cl-avatar--more">+${assigneeIds.length - 3}</span>` : '';
    return `<div class="tcc-cl-avatars">${avatarHtml}${extra}</div>`;
}

// Avatar kleurberekening
function _clAvatarKleur(naam) {
    const kleuren = ['#7c3aed','#2563eb','#16a34a','#ea580c','#db2777','#0891b2'];
    let h = 0;
    for (let i = 0; i < naam.length; i++) h = (h * 31 + naam.charCodeAt(i)) & 0xFFFF;
    return kleuren[h % kleuren.length];
}

// ============================================
// BADGE UPDATE
// ============================================

function _updateChecklistBadge() {
    const items = tccState.data?.checklist?.items || [];
    const done = items.filter(i => i.status === 'completed').length;
    const total = items.length;
    const badge = tccState.overlay?.querySelector('[data-tab="checklist"] .tcc-tab-badge');
    if (badge) badge.textContent = total > 0 ? `${done}/${total}` : '';
}

function _updateChecklistProgress() {
    _updateChecklistBadge();
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleClToonPicker() {
    tccState.checklistState = 'picker';
    tccState._clPickerSelected = [];
    _clRerender();
}

function handleClAanvullenPicker() {
    tccState.checklistState = 'aanvullen-picker';
    tccState._clPickerSelected = [];
    _clRerender();
}

function handleClAnnuleer() {
    const items = tccState.data?.checklist?.items || [];
    tccState.checklistState = items.length > 0 ? 'data' : 'leeg';
    _clRerender();
}

function handleClPickerToggle(docId, _docNaam) {
    if (!tccState._clPickerSelected) tccState._clPickerSelected = [];
    const idx = tccState._clPickerSelected.indexOf(docId);
    if (idx >= 0) {
        tccState._clPickerSelected.splice(idx, 1);
    } else {
        tccState._clPickerSelected.push(docId);
    }
    _clRerender();
}

async function handleClStartExtractie() {
    const geselecteerd = tccState._clPickerSelected || [];
    if (geselecteerd.length === 0) return;

    const isAanvullen = tccState.checklistState === 'aanvullen-picker';
    tccState.checklistState = 'loading';
    _clRerender();

    try {
        const resp = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/extract-checklist`,
            {
                method: 'POST',
                body: JSON.stringify({
                    document_ids: geselecteerd,
                    overschrijf: !isAanvullen,
                    aanvullen: isAanvullen
                })
            }
        );

        if (resp?.success) {
            if (resp.items) {
                if (!tccState.data) tccState.data = {};
                tccState.data.checklist = { items: resp.items, total: resp.items.length };
            } else {
                const clResp = await tccApiCall(
                    `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items`
                );
                if (clResp?.items) {
                    if (!tccState.data) tccState.data = {};
                    tccState.data.checklist = clResp;
                }
            }
            tccState.checklistState = 'data';
            if (isAanvullen) {
                showTccToast(`${resp.toegevoegd} nieuwe items toegevoegd, ${resp.overgeslagen} al aanwezig`, 'success');
            } else {
                showTccToast(`${resp.toegevoegd || resp.items?.length || 0} items gegenereerd`, 'success');
            }
        } else {
            throw new Error(resp?.detail || 'Extractie mislukt');
        }
    } catch (err) {
        console.error('[TCC Checklist] Extractie mislukt:', err);
        showTccToast(`Extractie mislukt: ${err.message}`, 'error');
        const items = tccState.data?.checklist?.items || [];
        tccState.checklistState = items.length > 0 ? 'data' : 'leeg';
    }
    _clRerender();
}

// Toggle checkbox: pending/in_progress → done, done → pending
async function handleClToggleItem(itemId) {
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    if (!item) return;

    // Lees altijd de echte status uit state (niet uit DOM-attribuut)
    const oudeStatus = item.status;
    const nieuweStatus = oudeStatus === 'completed' ? 'pending' : 'completed';

    // Optimistic update
    item.status = nieuweStatus;
    _clRerender();

    window.showAutoSaveIndicator?.('saving');
    try {
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items/${itemId}`,
            { method: 'PATCH', body: JSON.stringify({ status: nieuweStatus }) }
        );
        window.showAutoSaveIndicator?.('saved');
    } catch (err) {
        // Revert
        item.status = oudeStatus;
        _clRerender();
        window.showAutoSaveIndicator?.('error');
        showTccToast('Status bijwerken mislukt', 'error');
    }
}

// Inline datum picker
function handleClSetDeadline(itemId, btn) {
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    const huidigeDatum = item?.deadline || '';

    // Verwijder bestaande pickers
    document.querySelectorAll('.tcc-pp-date-picker-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'tcc-pp-date-picker-popup';
    popup.innerHTML = `
        <div class="tcc-pp-date-picker-inner">
            <label>Deadline</label>
            <input type="date" value="${huidigeDatum}" class="tcc-pp-date-input" id="cl-date-input-${itemId}">
            <div class="tcc-pp-date-actions">
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="cl-datum-annuleer">Annuleren</button>
                <button class="tcc-btn tcc-btn--primary tcc-btn--sm" id="cl-datum-ok">Opslaan</button>
            </div>
        </div>`;

    const rect = btn.closest('.tcc-cl-item-deadline').getBoundingClientRect();
    popup.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${rect.left}px;z-index:99999;`;
    document.body.appendChild(popup);

    popup.querySelector('#cl-datum-annuleer').addEventListener('click', () => popup.remove());
    popup.querySelector('#cl-datum-ok').addEventListener('click', async () => {
        const datum = popup.querySelector(`#cl-date-input-${itemId}`).value;
        popup.remove();
        await _clSaveDatum(itemId, datum || null);
    });

    setTimeout(() => {
        document.addEventListener('click', function closeOnOutside(e) {
            if (!popup.contains(e.target) && e.target !== btn) {
                popup.remove();
                document.removeEventListener('click', closeOnOutside);
            }
        });
    }, 0);
}

async function _clSaveDatum(itemId, datum) {
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    const oud = item?.deadline;
    if (item) item.deadline = datum;
    _clRerender();

    window.showAutoSaveIndicator?.('saving');
    try {
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items/${itemId}`,
            { method: 'PATCH', body: JSON.stringify({ deadline: datum }) }
        );
        window.showAutoSaveIndicator?.('saved');
    } catch (err) {
        if (item) item.deadline = oud;
        _clRerender();
        window.showAutoSaveIndicator?.('error');
        showTccToast('Datum opslaan mislukt', 'error');
    }
}

// Assignee dropdown
function handleClAssign(itemId, btn) {
    const teamleden = tccState.data?._bureauTeamMembers || [];
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    const huidig = Array.isArray(item?.toegewezen_aan) ? item.toegewezen_aan : [];

    document.querySelectorAll('.tcc-pp-assign-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'tcc-pp-assign-popup';

    if (teamleden.length === 0) {
        popup.innerHTML = `<div class="tcc-pp-assign-leeg">Geen teamleden beschikbaar.<br>Voeg teamleden toe via de Team tab.</div>`;
    } else {
        popup.innerHTML = `
            <div class="tcc-pp-assign-header">Toewijzen aan</div>
            ${teamleden.map(lid => {
                const naam = lid.naam || lid.name || lid.email || '?';
                const id = lid.user_id || lid.id;
                const initialen = naam.split(/\s+/).map(w => w[0]).join('').toUpperCase().substring(0, 2);
                const kleur = _clAvatarKleur(naam);
                const geselecteerd = huidig.includes(id);
                return `
                <div class="tcc-pp-assign-lid${geselecteerd ? ' selected' : ''}" data-id="${id}">
                    <span class="tcc-pp-assign-avatar" style="background:${kleur}">${initialen}</span>
                    <span class="tcc-pp-assign-naam">${escHtml(naam)}</span>
                    ${geselecteerd ? tccIcon('check', 14, '#7c3aed') : ''}
                </div>`;
            }).join('')}
            <div class="tcc-pp-assign-footer">
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="cl-assign-annuleer">Annuleren</button>
                <button class="tcc-btn tcc-btn--primary tcc-btn--sm" id="cl-assign-ok">Opslaan</button>
            </div>`;
    }

    const rect = btn.getBoundingClientRect();
    popup.style.cssText = `position:fixed;top:${rect.bottom + 4}px;left:${Math.max(0, rect.left - 160)}px;z-index:99999;min-width:240px;`;
    document.body.appendChild(popup);

    let nieuweIds = [...huidig];
    popup.querySelectorAll('.tcc-pp-assign-lid').forEach(el => {
        el.addEventListener('click', () => {
            const id = el.dataset.id;
            const idx = nieuweIds.indexOf(id);
            if (idx >= 0) { nieuweIds.splice(idx, 1); el.classList.remove('selected'); }
            else { nieuweIds.push(id); el.classList.add('selected'); }
        });
    });

    popup.querySelector('#cl-assign-annuleer')?.addEventListener('click', () => popup.remove());
    popup.querySelector('#cl-assign-ok')?.addEventListener('click', async () => {
        popup.remove();
        await _clSaveAssignees(itemId, nieuweIds);
    });

    setTimeout(() => {
        document.addEventListener('click', function closeOnOutside(e) {
            if (!popup.contains(e.target) && e.target !== btn) {
                popup.remove();
                document.removeEventListener('click', closeOnOutside);
            }
        });
    }, 0);
}

async function _clSaveAssignees(itemId, nieuweIds) {
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    const oud = item?.toegewezen_aan;
    if (item) item.toegewezen_aan = nieuweIds;
    _clRerender();

    window.showAutoSaveIndicator?.('saving');
    try {
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items/${itemId}`,
            { method: 'PATCH', body: JSON.stringify({ toegewezen_aan: nieuweIds }) }
        );
        window.showAutoSaveIndicator?.('saved');
    } catch (err) {
        if (item) item.toegewezen_aan = oud;
        _clRerender();
        window.showAutoSaveIndicator?.('error');
        showTccToast('Toewijzen mislukt', 'error');
    }
}

// 3-dot menu
function handleClItemMenu(itemId) {
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    if (!item) return;

    document.querySelectorAll('.tcc-pp-context-menu').forEach(m => m.remove());

    const btn = tccState.overlay?.querySelector(`[data-action="cl-item-menu"][data-item-id="${itemId}"]`);
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    const menu = document.createElement('div');
    menu.className = 'tcc-pp-context-menu';
    menu.innerHTML = `
        <div class="tcc-pp-menu-item" data-menu="cl-hernoem">
            ${tccIcon('edit', 14)} Naam bewerken
        </div>
        <div class="tcc-pp-menu-item" data-menu="cl-status-toggle">
            ${tccIcon('refresh', 14)} Status wijzigen
        </div>
        <div class="tcc-pp-menu-item" data-menu="cl-verplicht-toggle">
            ${tccIcon('alertCircle', 14)} ${item.is_verplicht ? 'Optioneel maken' : 'Verplicht maken'}
        </div>
        <div class="tcc-pp-menu-separator"></div>
        <div class="tcc-pp-menu-item tcc-pp-menu-item--danger" data-menu="cl-verwijder">
            ${tccIcon('trash', 14, '#dc2626')} Verwijderen
        </div>`;

    menu.style.cssText = `position:fixed;top:${rect.bottom + 2}px;right:${window.innerWidth - rect.right}px;z-index:99999;`;
    document.body.appendChild(menu);

    menu.addEventListener('click', async (e) => {
        const actie = e.target.closest('[data-menu]')?.dataset.menu;
        menu.remove();
        if (!actie) return;

        if (actie === 'cl-hernoem') {
            const nieuweNaam = prompt('Nieuwe naam:', item.naam || item.taak_naam || '');
            if (nieuweNaam && nieuweNaam.trim()) {
                item.naam = nieuweNaam.trim();
                item.taak_naam = nieuweNaam.trim();
                _clRerender();
                await tccApiCall(
                    `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items/${itemId}`,
                    { method: 'PATCH', body: JSON.stringify({ taak_naam: nieuweNaam.trim() }) }
                );
            }
        } else if (actie === 'cl-status-toggle') {
            await handleClToggleItem(itemId);
        } else if (actie === 'cl-verplicht-toggle') {
            item.is_verplicht = !item.is_verplicht;
            _clRerender();
            await tccApiCall(
                `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items/${itemId}`,
                { method: 'PATCH', body: JSON.stringify({ is_verplicht: item.is_verplicht }) }
            );
        } else if (actie === 'cl-verwijder') {
            if (!confirm(`"${item.naam || item.taak_naam}" verwijderen?`)) return;
            const items = tccState.data?.checklist?.items || [];
            const i = items.findIndex(x => x.id === itemId);
            if (i >= 0) items.splice(i, 1);
            _clRerender();
            await tccApiCall(
                `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items/${itemId}`,
                { method: 'DELETE' }
            );
            showTccToast('Item verwijderd', 'success');
        }
    });

    setTimeout(() => {
        document.addEventListener('click', function closeOnOutside(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeOnOutside);
            }
        });
    }, 0);
}

function handleClToonBron(itemId, btn) {
    const item = (tccState.data?.checklist?.items || []).find(i => i.id === itemId);
    if (!item?.bron_tekst) return;

    // Sluit als al open voor dit item
    const bestaand = document.querySelector(`.tcc-cl-bron-popup[data-bron-id="${itemId}"]`);
    if (bestaand) {
        btn.closest('.tcc-cl-item')?.classList.remove('is-actief');
        bestaand.remove();
        return;
    }

    // Sluit alle andere open popups + verwijder is-actief van andere rijen
    document.querySelectorAll('.tcc-cl-bron-popup').forEach(p => p.remove());
    document.querySelectorAll('.tcc-cl-item.is-actief').forEach(r => r.classList.remove('is-actief'));

    const popup = document.createElement('div');
    popup.className = 'tcc-cl-bron-popup';
    popup.dataset.bronId = itemId;
    popup.innerHTML = `
        <div class="tcc-cl-bron-popup-header">
            <div class="tcc-cl-bron-popup-icon">
                ${tccIcon('info', 13, '#7c3aed')}
            </div>
            <span class="tcc-cl-bron-popup-title">Bronvermelding</span>
        </div>
        <div class="tcc-cl-bron-popup-body">
            <div class="tcc-cl-bron-popup-tekst">"${escHtml(item.bron_tekst)}"</div>
            ${item.document_naam ? `
            <div class="tcc-cl-bron-popup-doc">
                ${tccIcon('fileText', 11, '#475569')} ${escHtml(item.document_naam)}
            </div>` : ''}
        </div>`;

    // Inline invoegen na de item-rij (niet als body overlay)
    const itemRij = btn.closest('.tcc-cl-item');
    if (!itemRij) return;
    itemRij.classList.add('is-actief');
    itemRij.insertAdjacentElement('afterend', popup);

    setTimeout(() => {
        document.addEventListener('click', function sluit(e) {
            if (!popup.contains(e.target) && !btn.contains(e.target)) {
                itemRij.classList.remove('is-actief');
                popup.remove();
                document.removeEventListener('click', sluit);
            }
        });
    }, 0);
}

// Item toevoegen
async function handleClAddItem(sectie) {
    const naam = prompt('Naam nieuw checklist item:');
    if (!naam || !naam.trim()) return;

    // Bepaal sectie
    const items = tccState.data?.checklist?.items || [];
    const sectieNaam = sectie || (items.length > 0 ? (items[items.length - 1].sectie || 'Overige documenten') : 'Overige documenten');

    const tijdelijkId = 'temp-' + Date.now();
    const nieuw = {
        id: tijdelijkId,
        naam: naam.trim(),
        taak_naam: naam.trim(),
        sectie: sectieNaam,
        categorie: sectieNaam,
        status: 'pending',
        is_verplicht: false,
        toegewezen_aan: [],
        deadline: null,
        volgorde: items.length,
    };
    items.push(nieuw);
    if (!tccState.data.checklist) tccState.data.checklist = { items };
    tccState.data.checklist.items = items;
    tccState.checklistState = 'data';
    _clRerender();

    try {
        const resp = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items`,
            {
                method: 'POST',
                body: JSON.stringify({
                    taak_naam: naam.trim(),
                    sectie: sectieNaam,
                    is_verplicht: false,
                    status: 'pending',
                    volgorde: items.length - 1,
                })
            }
        );
        // Vervang tijdelijk ID door echte ID
        const idx = tccState.data.checklist.items.findIndex(i => i.id === tijdelijkId);
        if (idx >= 0 && resp?.item?.id) {
            tccState.data.checklist.items[idx].id = resp.item.id;
        }
        showTccToast('Item toegevoegd', 'success');
    } catch (err) {
        // Verwijder tijdelijk item
        tccState.data.checklist.items = items.filter(i => i.id !== tijdelijkId);
        _clRerender();
        showTccToast('Item toevoegen mislukt', 'error');
    }
}

// Template laden (popover met template-keuze)
async function handleClLoadTemplate() {
    const btn = document.getElementById('cl-template-btn');
    if (!btn) return;

    document.querySelectorAll('.tcc-pp-template-popover').forEach(p => p.remove());

    // Laad templates
    const popover = document.createElement('div');
    popover.className = 'tcc-pp-template-popover';
    popover.innerHTML = `<div class="tcc-pp-template-loading">${tccIcon('refresh', 14, '#7c3aed')} Templates laden…</div>`;

    const rect = btn.getBoundingClientRect();
    popover.style.cssText = `position:fixed;top:${rect.bottom + 4}px;right:${window.innerWidth - rect.right}px;z-index:99999;min-width:280px;`;
    document.body.appendChild(popover);

    try {
        const bureauId = tccState.data?.tender?.tenderbureau_id;
        const resp = await tccApiCall(
            `/api/v1/planning-templates?type=checklist&tenderbureau_id=${bureauId}`
        );
        const templates = resp?.templates || resp?.data || [];

        if (templates.length === 0) {
            popover.innerHTML = `
                <div class="tcc-pp-template-header">Templates</div>
                <div class="tcc-pp-template-leeg">Geen checklist templates gevonden voor dit bureau.</div>`;
        } else {
            const heeftItems = (tccState.data?.checklist?.items || []).length > 0;
            popover.innerHTML = `
                <div class="tcc-pp-template-header">Kies een template</div>
                ${heeftItems ? `<div class="tcc-pp-template-waarschuwing">${tccIcon('warning', 14, '#ea580c')} Bestaande items worden overschreven</div>` : ''}
                ${templates.map(t => `
                <div class="tcc-pp-template-item" data-template-id="${t.id}">
                    <div class="tcc-pp-template-naam">
                        ${escHtml(t.naam)} ${t.is_standaard ? '<span class="tcc-pp-template-standaard">Standaard</span>' : ''}
                    </div>
                    <div class="tcc-pp-template-meta">${t.aantal_taken || t.item_count || 0} items</div>
                </div>`).join('')}
                <div class="tcc-pp-template-footer">
                    <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="cl-template-annuleer">Annuleren</button>
                </div>`;
        }
    } catch (err) {
        popover.innerHTML = `<div class="tcc-pp-template-leeg">Templates laden mislukt.</div>`;
    }

    popover.querySelector('#cl-template-annuleer')?.addEventListener('click', () => popover.remove());

    const aanvullen = (tccState.data?.checklist?.items || []).length > 0;
    popover.querySelectorAll('.tcc-pp-template-item').forEach(el => {
        el.addEventListener('click', async () => {
            const templateId = el.dataset.templateId;
            popover.remove();
            await _clLaadTemplate(templateId, aanvullen);
        });
    });

    setTimeout(() => {
        document.addEventListener('click', function closeOnOutside(e) {
            if (!popover.contains(e.target) && e.target !== btn) {
                popover.remove();
                document.removeEventListener('click', closeOnOutside);
            }
        });
    }, 0);
}

async function _clLaadTemplate(templateId, aanvullen = false) {
    tccState.checklistState = 'loading';
    _clRerender();

    try {
        const resp = await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/populate-checklist-from-template`,
            { method: 'POST', body: JSON.stringify({ template_id: templateId, overschrijf: !aanvullen, aanvullen }) }
        );

        if (resp?.items) {
            if (!tccState.data) tccState.data = {};
            tccState.data.checklist = { items: resp.items, total: resp.items.length };
        } else {
            const clResp = await tccApiCall(
                `/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items`
            );
            if (clResp?.items) {
                if (!tccState.data) tccState.data = {};
                tccState.data.checklist = clResp;
            }
        }
        tccState.checklistState = 'data';
        if (aanvullen) {
            showTccToast(`${resp?.toegevoegd ?? '?'} template items toegevoegd`, 'success');
        } else {
            showTccToast(`Template geladen met ${resp?.toegevoegd ?? '?'} items`, 'success');
        }
    } catch (err) {
        showTccToast(`Template laden mislukt: ${err.message}`, 'error');
        const items = tccState.data?.checklist?.items || [];
        tccState.checklistState = items.length > 0 ? 'data' : 'leeg';
    }
    _clRerender();
}

// ============================================
// FOOTER — Checklist tab specifiek
// ============================================

function renderChecklistFooter() {
    const items = tccState.data?.checklist?.items || [];
    const state = tccState.checklistState !== null
        ? tccState.checklistState
        : (items.length > 0 ? 'data' : 'leeg');

    if (state === 'picker') {
        const geselecteerd = tccState._clPickerSelected || [];
        return `
        <button class="tcc-btn tcc-btn--ghost" data-action="cl-annuleer">
            ${tccIcon('close', 14, '#dc2626')} Annuleren
        </button>
        <div class="tcc-footer-right">
            <button class="tcc-btn tcc-btn--ghost" data-action="tcc-close">
                ${tccIcon('close', 14)} Sluiten
            </button>
            <button class="tcc-btn tcc-btn--primary${geselecteerd.length === 0 ? ' tcc-btn--disabled' : ''}"
                    data-action="cl-start-extractie"
                    ${geselecteerd.length === 0 ? 'disabled' : ''}>
                ${tccIcon('sparkles', 14, '#fff')} Extraheer nu
            </button>
        </div>`;
    }

    return `
    <div class="tcc-footer-right">
        <button class="tcc-btn tcc-btn--ghost" data-action="tcc-close">
            ${tccIcon('close', 14, '#dc2626')} Sluiten
        </button>
        <button class="tcc-btn tcc-btn--success" data-action="tcc-close">
            ${tccIcon('save', 14, '#fff')} Opslaan
        </button>
    </div>`;
}