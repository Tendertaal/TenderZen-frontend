/* ============================================
   TCC_Core.js
   Tender Command Center — kern
   v3.6 — Notities integratie + icon fix

   WIJZIGINGEN v3.6:
   - tccIcon() gecorrigeerd: Icons[name]({ size, color }) i.p.v. (size, color)
     (icons.js verwacht een options-object, geen losse parameters)
   - TCC_TabNotities geïntegreerd: init bij open, destroy bij close
   - renderTccFooter() bevat in elke tab de notities-toggle knop
   - _switchTab() herplaatst notities-knop na footer-wissel
   - tccState uitgebreid met _notities property

   WIJZIGINGEN v3.5:
   - fetchTccData() haalt data direct via losse calls
     (geen /command-center poging meer — dat endpoint bestaat niet)
   - /smart-import/tenders/{id}/latest verwijderd (endpoint bestaat niet)
   - SmartImport data is nu leeg object als fallback (was toch niet beschikbaar)
   - Geen 404 console errors meer bij opstarten

   Bevat:
   - tccState
   - openCommandCenter() / closeTcc()
   - fetchTccData() / buildTccData()
   - renderTcc() — main render
   - renderTccTabs() / renderTccFooter()
   - initTccEvents()
   - tccApiCall()
   - showTccToast()
   - Helper functies: tccIcon, escHtml, _formatDateNL,
     _formatCurrency, _daysUntil
   ============================================ */

// ============================================
// STATE
// ============================================

const tccState = {
  tenderId: null,
  activeTab: 'info',
  overlay: null,
  data: null,
  loading: false,
  toastTimer: null,
  checklistState: null    // null | 'leeg' | 'picker' | 'loading' | 'data'
};

// ============================================
// OPEN / CLOSE
// ============================================

async function openCommandCenter(tenderId) {
  if (!tenderId) { console.warn('[TCC] Geen tenderId opgegeven'); return; }
  if (tccState.loading) return;

  // Notities paneel koppelen aan geselecteerde tender
  if (window.notitiesPanel) {
    const tender = window.app?.tenders?.find(t => t.id === tenderId);
    window.notitiesPanel.setTender(
      tenderId,
      tender?.naam || 'Tender',
      tender?.tenderbureau_id || null
    );
  }

  tccState.tenderId = tenderId;
  tccState.activeTab = 'info';
  tccState.loading = true;

  const overlay = document.createElement('div');
  overlay.className = 'tcc-overlay';
  overlay.id = 'tcc-overlay';
  overlay.innerHTML = _renderLoadingSkeleton();
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  tccState.overlay = overlay;

  try {
    const data = await fetchTccData(tenderId);
    tccState.data = data;
    tccState.loading = false;
    overlay.innerHTML = renderTcc(data);
    initTccEvents(overlay);

    overlay.querySelector('[data-tab="team"]')?.addEventListener('click', () => {
      setTimeout(() => loadTeamWorkload(), 100);
    });

    overlay.querySelector('[data-tab="projectplanning"]')?.addEventListener('click', () => {
      setTimeout(() => _bridgePlanningToTcc(), 150);
    });

  } catch (err) {
    tccState.loading = false;
    console.error('[TCC] Laden mislukt:', err);
    overlay.innerHTML = _renderErrorState(err.message);
    overlay.querySelector('[data-action="tcc-close"]')?.addEventListener('click', closeTcc);
  }
}

function closeTcc() {
  const overlay = document.getElementById('tcc-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => overlay.remove(), 200);
  }
  document.body.style.overflow = '';
  document.querySelector('#tcc-doc-viewer')?.remove();
  tccState.overlay = null;
  tccState.data = null;
  tccState.tenderId = null;
  tccState.activeTab = 'ai';
  tccState.checklistState = null;

  // Forced refresh van tenderlijst view
  if (window.app?.loadData) {
    window.app.loadData().then(() => {
      if (window.app?.views?.totaal?.render) window.app.views.totaal.render();
    });
  }
}

const closeCommandCenter = closeTcc;

// ============================================
// DATA — Fetch & Build
// ============================================

async function fetchTccData(tenderId) {
  // Direct losse calls — gecombineerde /command-center endpoint bestaat niet
  const tender = window.app?.tenders?.find(t => t.id === tenderId) || {};
  const bureauId = tender.tenderbureau_id;

  const [
    aiDocsResult,
    templatesResult,
    teamResult,
    docsResult,
    milestonesResult,
    planningTakenResult,
    checklistResult,
    bureauTeamResult,
    tenderplanningTemplateResult
  ] = await Promise.allSettled([
    tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/ai-documents`),
    tccApiCall(`/api/v1/ai-documents/templates`),
    tccApiCall(`/api/v1/tenders/${tenderId}/team-assignments`),
    tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/documents`),
    tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/milestones`),
    tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/planning-taken`),
    tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/checklist-items`),
    bureauId
      ? tccApiCall(`/api/v1/team-members?tenderbureau_id=${bureauId}`)
      : Promise.resolve(null),
    tccApiCall('/api/v1/planning-templates?type=tenderplanning').catch(() => null)
  ]);

  const aiDocuments       = aiDocsResult.status === 'fulfilled'          ? (aiDocsResult.value?.documents || [])          : [];
  const aiTemplates       = templatesResult.status === 'fulfilled'       ? (templatesResult.value?.templates || [])        : [];
  const teamAssignments   = teamResult.status === 'fulfilled'            ? (teamResult.value?.data || [])                  : [];
  const documenten        = docsResult.status === 'fulfilled'            ? (docsResult.value?.documents || [])             : [];
  const milestones        = milestonesResult.status === 'fulfilled'      ? (milestonesResult.value?.items || [])           : [];
  const planningTaken     = planningTakenResult.status === 'fulfilled'   ? (planningTakenResult.value?.items || [])        : [];
  const checklistItems    = checklistResult.status === 'fulfilled'       ? (checklistResult.value?.items || [])            : [];
  const bureauTeamMembers = bureauTeamResult?.status === 'fulfilled'     ? (bureauTeamResult.value?.data || [])            : [];
  const smartImport       = null; // smart-import endpoint niet beschikbaar — data via tenderkaart

  // Tenderplanning template ophalen
  const tpTemplateData  = tenderplanningTemplateResult?.status === 'fulfilled'
    ? (tenderplanningTemplateResult.value?.data || []) : [];
  const tpTemplate      = tpTemplateData.find(t => t.is_standaard) || tpTemplateData[0] || null;
  const tpTemplateTaken = tpTemplate?.taken || null;

  const tenderWithTeam = { ...tender, tender_team_assignments: teamAssignments };
  const extractedData  = smartImport?.extracted_data || smartImport?.data || {};

  return {
    tender: tenderWithTeam,
    generatie: transformGeneratie(aiDocuments, aiTemplates),
    tenderplanning: transformTenderplanning(tenderWithTeam, extractedData, smartImport, milestones, {}, tpTemplateTaken),
    projectplanning: transformProjectplanning(planningTaken),
    checklist: transformChecklist(checklistItems),
    team: transformTeam(tenderWithTeam, bureauTeamMembers),
    documenten,
    _bureauTeamMembers: bureauTeamMembers
  };
}

function buildTccData(raw) {
  const tender            = raw.tender || {};
  const extractedData     = raw.smart_import?.extracted_data || raw.extracted_data || {};
  const aiDocuments       = raw.ai_documents || [];
  const aiTemplates       = raw.ai_templates || [];
  const bureauTeamMembers = raw.bureau_team_members || [];
  const milestones        = raw.milestones || [];
  const planningTaken     = raw.planning_taken || [];
  const checklistItems    = raw.checklist_items || [];

  return {
    tender,
    generatie: transformGeneratie(aiDocuments, aiTemplates),
    tenderplanning: transformTenderplanning(tender, extractedData, raw.smart_import, milestones),
    projectplanning: transformProjectplanning(planningTaken),
    checklist: transformChecklist(checklistItems),
    team: transformTeam(tender, bureauTeamMembers),
    documenten: raw.documents || raw.documenten || [],
    _bureauTeamMembers: bureauTeamMembers
  };
}

// ============================================
// GLOBALS — Tab modules
// ============================================
// TCC_TabTenderplanning.js moet geladen zijn vóór deze file!
// Functies worden nu via window.* gebruikt
var transformTenderplanning  = window.transformTenderplanning;
var handleTpStartPicker      = window.handleTpStartPicker;
var handleTpAnnuleer         = window.handleTpAnnuleer;
var handleTpPickerToggle     = window.handleTpPickerToggle;
var handleTpStartExtractie   = window.handleTpStartExtractie;

// ============================================
// TRANSFORMS — Downstream data
// ============================================

/**
 * Vertaalt checklist_items (backend) naar TCC formaat.
 */
function transformChecklist(items = []) {
  if (!items.length) return { items: [], badge: '' };
  const doneCount = items.filter(i => i.status === 'completed' || i.checked).length;
  const total = items.length;
  return { items, badge: `${doneCount}/${total}`, done: doneCount, total };
}

/**
 * Vertaalt planning_taken (backend) naar TCC projectplanning formaat.
 */
function transformProjectplanning(items = []) {
  if (!items.length) return { taken: [], badge: '' };
  const doneTaken = items.filter(i => i.status === 'done').length;
  return {
    taken: items,
    badge: items.length > 0 ? String(items.length) : '',
    done: doneTaken,
    total: items.length
  };
}

// ============================================
// RENDER — Hoofd
// ============================================

function renderTcc(data) {
  const tender      = data.tender || {};
  const naam        = tender.naam || tender.name || 'Tender';
  const fase        = tender.fase || tender.status || '';
  const deadline    = tender.deadline_indiening || tender.sluitingsdatum || '';
  const deadlineStr = deadline ? _formatDateNL(deadline) : '';
  const savedExpanded = localStorage.getItem('tz_tcc_sidebar_open') === 'true';

  return `
    <div class="tcc-panel" id="tcc-panel">
        ${_renderSideNav(data, savedExpanded)}
        <div class="tcc-content-area">
            <div class="tcc-header">
                <div class="tcc-header-top">
                    <div class="tcc-header-left">
                        <div class="tcc-header-icon">
                            ${tccIcon('zap', 22, '#ffffff')}
                        </div>
                        <div class="tcc-header-info">
                            <h2>${escHtml(naam)}</h2>
                            <div class="tcc-header-meta">
                                ${fase ? `<span class="tcc-meta-tag tcc-meta-tag--fase">${escHtml(fase)}</span>` : ''}
                                ${deadlineStr ? `<span class="tcc-meta-tag tcc-meta-tag--date">${tccIcon('clock', 11, '#dc2626')} ${deadlineStr}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <button class="tcc-close-btn" data-action="tcc-close" title="Sluiten">
                        ${tccIcon('close', 16)}
                    </button>
                </div>
            </div>
            <div class="tcc-body">
                ${renderTabAI(data)}
                ${renderTabTenderplanning(data)}
                ${renderTabProjectplanning(data)}
                ${renderTabChecklist(data)}
                ${renderTabTeam(data)}
                ${renderTabDocs(data)}
                ${renderTabInfo(data)}
            </div>
            ${renderTccFooter(tccState.activeTab, data)}
            <div id="tcc-toast" class="tcc-toast" style="display:none;"></div>
        </div>
        <div class="dp-panel" id="dp-panel"></div>
    </div>`;
}

function _getNavItems(data) {
  const totalDocs = (data.documenten?.length || 0) +
    (data.generatie?.documenten?.filter(d => d.status === 'done' || d.status === 'gonogo').length || 0);

  return [
    { key: 'info',            icon: 'info',         label: 'Tenderinformatie', badge: '',                                  badgeType: '' },
    { key: 'ai',              icon: 'sparkles',     label: 'AI',               badge: data.generatie?.badge || '',          badgeType: 'score' },
    { divider: true },
    { key: 'tenderplanning',  icon: 'calendarView', label: 'Tenderplanning',   badge: data.tenderplanning?.badge || '',     badgeType: '' },
    { key: 'projectplanning', icon: 'calendarClock',label: 'Projectplanning',  badge: data.projectplanning?.badge || '',    badgeType: '' },
    { key: 'checklist',       icon: 'checkSquare',  label: 'Checklist',        badge: data.checklist?.badge || '',          badgeType: 'warn' },
    { divider: true },
    { key: 'team',            icon: 'users',        label: 'Team',             badge: data.team?.badge || '',               badgeType: '' },
    { key: 'docs',            icon: 'folderOpen',   label: 'Documenten',       badge: totalDocs > 0 ? String(totalDocs) : '', badgeType: '' },
    { spacer: true },
    { divider: true },
    { key: 'settings',        icon: 'settings',     label: 'Instellingen',     badge: '',                                  badgeType: '', cls: 'tcc-nav-item--settings' },
  ];
}

function _renderSideNav(data, isExpanded) {
  const items = _getNavItems(data);
  const expandedCls = isExpanded ? ' is-expanded' : '';

  const itemsHtml = items.map(item => {
    if (item.divider) return `<div class="tcc-nav-divider"></div>`;
    if (item.spacer)  return `<div class="tcc-nav-spacer"></div>`;

    const isActive   = item.key === tccState.activeTab;
    const badgeCls   = item.badgeType ? ` tcc-nav-badge--${item.badgeType}` : '';
    const badgeHtml  = item.badge
      ? `<span class="tcc-nav-badge${badgeCls}">${item.badge}</span>`
      : '';

    return `
      <button class="tcc-nav-item${isActive ? ' is-active' : ''}${item.cls ? ' ' + item.cls : ''}"
              data-tab="${item.key}" title="${escHtml(item.label)}">
          ${tccIcon(item.icon, 17)}
          <span class="tcc-nav-label">${escHtml(item.label)}</span>
          ${badgeHtml}
          <span class="tcc-nav-tooltip">${escHtml(item.label)}</span>
      </button>`;
  }).join('');

  return `
    <nav class="tcc-sidenav${expandedCls}" id="tcc-sidenav">
        <div class="tcc-brand-header">
            <span class="tcc-brand-short">TCC</span>
            <span class="tcc-brand-full">Tender Command Center</span>
        </div>
        ${itemsHtml}
        <button class="tcc-nav-toggle" id="tcc-nav-toggle" title="Zijmenu in-/uitklappen">
            ${isExpanded ? tccIcon('chevronLeft', 12) : tccIcon('chevronRight', 12)}
        </button>
    </nav>`;
}

// ============================================
// RENDER — Checklist Tab
// Gedelegeerd naar TCC_TabChecklist.js
// ============================================

// renderTabChecklist() is gedefinieerd in TCC_TabChecklist.js

// ============================================
// RENDER — Footer
// De notities-knop wordt NIET in de HTML gezet —
// TCC_TabNotities._renderFooterKnop() plaatst hem zelf
// via insertBefore() zodra init() is aangeroepen.
// Hier staat alleen de tab-specifieke content.
// ============================================

function renderTccFooter(_activeTab, _data) {
  const content = `
    <div class="tcc-footer-left">
      <button class="tcc-btn tcc-btn--secondary" data-action="edit-fields">
        ${tccIcon('edit', 14)} Bewerken
      </button>
    </div>
    <div class="tcc-footer-right">
      <!-- Notities knop wordt hier geplaatst door TCC_TabNotities via appendChild -->
    </div>`;

  return `<div class="tcc-footer">${content}</div>`;
}

// ============================================
// EVENTS
// ============================================

function initTccEvents(overlay) {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeTcc();
  });

  const escHandler = e => {
    if (e.key === 'Escape') { closeTcc(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);

  const panel = overlay.querySelector('#tcc-panel');
  if (!panel) return;

  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    console.log('[TCC] click action:', action, btn);

    switch (action) {
      case 'tcc-close': closeTcc(); break;
      case 'toggle-section': _toggleSection(btn.closest('.tcc-section')); break;
      case 'toggle-perceel': _togglePerceel(btn.closest('.tcc-perceel-card')); break;
      case 'goto-tab': _switchTab(btn.dataset.target, panel); break;

      // AI Generatie — handlers in TCC_TabAI.js
      case 'ai-generate':
      case 'ai-regenerate':   handleAiGenerate(btn.dataset.type); break;
      case 'ai-view':         _handleAiView(btn.dataset.type); break;
      case 'ai-copy':         _handleAiCopy(btn.dataset.type); break;
      case 'ai-download':     _handleAiDownload(btn.dataset.type); break;

      // Tenderplanning — handlers in TCC_TabPlanning.js
      case 'tp-toon-info':      handleTpToonInfo(btn.dataset.key); break;
      case 'tp-start-picker':   handleTpStartPicker(); break;
      case 'tp-annuleer':       handleTpAnnuleer(); break;
      case 'tp-picker-toggle':  handleTpPickerToggle(btn.dataset.docId); break;
      case 'tp-edit-item':      handleTpEditItem(btn.dataset.key, btn); break;
      case 'tp-assign':         handleTpAssign(btn.dataset.key, btn); break;
      case 'tp-extract-start':
      case 'tp-start-extractie': handleTpStartExtractie(); break;
      case 'tp-toggle-check':    handleTpToggleCheck(btn.dataset.key, panel); break;
      case 'tp-toggle-check-ai': handleTpToggleCheckAi(btn.dataset.id, panel); break;
      case 'tp-toggle-detail':   handleTpToggleDetail(btn.dataset.key, panel); break;
      case 'tp-toggle-detail-ai': handleTpToggleDetailAi(btn.dataset.id, panel); break;

      // Projectplanning — handlers in TCC_TabProjectplanning.js
      case 'pp-toon-info':      handlePpToonInfo(btn.dataset.taakId); break;
      case 'pp-toon-config':    handlePpToonConfig(); break;
      case 'pp-annuleer':       handlePpAnnuleer(); break;
      case 'pp-start-genereren': handlePpStartGenereren(); break;
      case 'pp-toggle-taak':    handlePpToggleTaak(btn.dataset.taakId, btn.dataset.status); break;
      case 'pp-set-date':       handlePpSetDate(btn.dataset.taakId, btn); break;
      case 'pp-assign':         handlePpAssign(btn.dataset.taakId, btn); break;
      case 'pp-taak-menu':      handlePpTaakMenu(btn.dataset.taakId); break;
      case 'pp-add-taak':       handlePpAddTaak(); break;
      case 'pp-load-template':  handlePpLoadTemplate(); break;

      // Team — handlers in TCC_TabTeam.js
      case 'team-search-select': handleTeamSearchSelect(btn.dataset.memberId); break;
      case 'team-rol-select':    handleTeamRolSelect(btn.dataset.rol); break;
      case 'team-add-cancel':    handleTeamAddCancel(); break;
      case 'team-add-confirm':   handleTeamAddMember(); break;
      case 'team-remove':        handleTeamRemoveMember(btn.dataset.memberId); break;

      // Documenten — handlers in TCC_TabDocs.js
      case 'docs-upload-trigger': handleDocUpload(); break;
      case 'doc-delete':          handleDocDelete(btn.dataset.docId); break;
      case 'doc-preview':         handleDocPreview(btn.dataset.docId, btn.dataset.docName); break;
      case 'smart-import-trigger': handleSmartImportTrigger(); break;

      // Checklist — handlers in TCC_TabChecklist.js
      case 'cl-toon-picker':       handleClToonPicker(); break;
      case 'cl-aanvullen-picker':  handleClAanvullenPicker(); break;
      case 'cl-annuleer':          handleClAnnuleer(); break;
      case 'cl-picker-toggle':     handleClPickerToggle(btn.dataset.docId, btn.dataset.docNaam); break;
      case 'cl-start-extractie':   handleClStartExtractie(); break;
      case 'cl-toggle-item':       handleClToggleItem(btn.dataset.itemId); break;
      case 'cl-set-deadline':      handleClSetDeadline(btn.dataset.itemId, btn); break;
      case 'cl-assign':            handleClAssign(btn.dataset.itemId, btn); break;
      case 'cl-item-menu':         handleClItemMenu(btn.dataset.itemId); break;
      case 'cl-toon-bron':         handleClToonBron(btn.dataset.itemId, btn); break;
      case 'cl-add-item':          handleClAddItem(); break;
      case 'cl-load-template':     handleClLoadTemplate(); break;

      // Bewerken / Info tab
      case 'edit-fields':        _handleEditFields(); break;
      case 'info-start-edit':    handleInfoStartEdit(); break;
      case 'info-cancel-edit':   handleInfoCancelEdit(); break;
      case 'info-save':          handleInfoSave(); break;
      case 'info-delete-tender': handleInfoDeleteTender(); break;
      case 'info-change-bedrijf': handleInfoChangeBedrijf(); break;
    }
  });

  // Tab wisselen
  panel.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    _switchTab(tab.dataset.tab, panel);
  });

  // Sub-nav (Analyse / Generatie)
  panel.addEventListener('click', e => {
    const subBtn = e.target.closest('[data-sub]');
    if (!subBtn) return;
    const subKey = subBtn.dataset.sub;
    const container = subBtn.closest('.tcc-tab-panel');
    if (!container) return;

    container.querySelectorAll('.tcc-subnav-btn').forEach(b => b.classList.remove('is-active'));
    container.querySelectorAll('.tcc-subpanel').forEach(p => p.classList.remove('is-active'));
    subBtn.classList.add('is-active');
    container.querySelector(`[data-subpanel="${subKey}"].tcc-subpanel`)?.classList.add('is-active');
  });

  // Sidebar toggle
  panel.querySelector('#tcc-nav-toggle')?.addEventListener('click', () => {
    const sidenav = panel.querySelector('#tcc-sidenav');
    const toggleBtn = panel.querySelector('#tcc-nav-toggle');
    if (!sidenav || !toggleBtn) return;
    const isExpanded = sidenav.classList.toggle('is-expanded');
    toggleBtn.innerHTML = isExpanded ? tccIcon('chevronLeft', 12) : tccIcon('chevronRight', 12);
    localStorage.setItem('tz_tcc_sidebar_open', isExpanded);
  });

  _initDropZone(panel);

  // Zoekbalk input event (Team tab)
  panel.addEventListener('input', e => {
    if (e.target.id === 'tcc-team-search-input') {
      if (typeof handleTeamSearchInput === 'function') handleTeamSearchInput(e.target.value);
    }
  });

  // Bedrijf selectie (Info tab)
  panel.addEventListener('change', e => {
    if (e.target.id === 'tcc-info-bedrijf-select') {
      if (typeof handleInfoBedrijfSelect === 'function') handleInfoBedrijfSelect(e.target);
    }
  });

  // Initialiseer styles van sub-modules
  if (typeof injectChecklistStyles === 'function') injectChecklistStyles();
  if (typeof injectPlanningStyles === 'function') injectPlanningStyles();
  // TCC_TabTeam CSS wordt automatisch geïnjecteerd via IIFE bij laden
}

function _switchTab(tabKey, panel) {
  if (!tabKey || tabKey === tccState.activeTab) return;
  tccState.activeTab = tabKey;

  panel.querySelectorAll('.tcc-nav-item[data-tab]').forEach(t => {
    t.classList.toggle('is-active', t.dataset.tab === tabKey);
  });

  panel.querySelectorAll('.tcc-tab-panel').forEach(p => {
    p.classList.toggle('is-active', p.dataset.panel === tabKey);
  });

  // Footer vervangen
  const footer = panel.querySelector('.tcc-footer');
  if (footer) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderTccFooter(tabKey, tccState.data);
    footer.replaceWith(tempDiv.firstElementChild);


  }

  if (tabKey === 'team') setTimeout(() => loadTeamWorkload(), 100);
  if (tabKey === 'projectplanning') setTimeout(() => _bridgePlanningToTcc(), 150);
}

function _toggleSection(section) {
  if (!section) return;
  section.classList.toggle('is-open');
}

function _togglePerceel(card) {
  if (!card) return;
  card.classList.toggle('is-open');
}

function _initDropZone(panel) {
  const dropZone = panel.querySelector('#tcc-docs-drop-zone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('is-dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragover'));
  dropZone.addEventListener('drop', async e => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    const files = Array.from(e.dataTransfer?.files || []);
    for (const file of files) await _uploadSingleDoc(file);
  });
}

// ============================================
// DOWNSTREAM REFRESH
// ============================================

async function _refreshNaDownstream(tabs = []) {
  const panel = tccState.overlay?.querySelector('#tcc-panel');
  if (!panel || !tccState.tenderId) return;

  console.log('[TCC] Refresh na downstream voor tabs:', tabs);

  try {
    const fetches = {};

    if (tabs.includes('tenderplanning')) {
      fetches.milestones = tccApiCall(`/api/v1/ai-documents/tenders/${tccState.tenderId}/milestones`)
        .then(r => r?.items || []).catch(() => []);
    }
    if (tabs.includes('projectplanning')) {
      fetches.planningTaken = tccApiCall(`/api/v1/ai-documents/tenders/${tccState.tenderId}/planning-taken`)
        .then(r => r?.items || []).catch(() => []);
    }
    if (tabs.includes('checklist')) {
      fetches.checklistItems = tccApiCall(`/api/v1/ai-documents/tenders/${tccState.tenderId}/checklist-items`)
        .then(r => r?.items || []).catch(() => []);
    }

    const results = await Promise.all(Object.values(fetches));
    const keys = Object.keys(fetches);
    const resolved = {};
    keys.forEach((k, i) => resolved[k] = results[i]);

    if (resolved.milestones !== undefined) {
      const bestaandeTp = tccState.data.tenderplanning || {};
      tccState.data.tenderplanning = {
        ...bestaandeTp,
        ...transformTenderplanningVanMilestones(resolved.milestones),
      };
    }
    if (resolved.planningTaken !== undefined) {
      tccState.data.projectplanning = transformProjectplanning(resolved.planningTaken);
    }
    if (resolved.checklistItems !== undefined) {
      tccState.data.checklist = transformChecklist(resolved.checklistItems);
    }

    for (const tab of tabs) {
      _refreshTabPanel(panel, tab);
    }
    _refreshTabBadges(panel);

    showTccToast(`Tabs bijgewerkt: ${tabs.join(', ')}`, 'success');

  } catch (err) {
    console.error('[TCC] Refresh na downstream mislukt:', err);
    showTccToast('Tabs verversen mislukt', 'error');
  }
}
window._refreshNaDownstream = _refreshNaDownstream;

function _refreshTabPanel(panel, tabKey) {
  const oudPanel = panel.querySelector(`[data-panel="${tabKey}"]`);
  if (!oudPanel) return;

  const wasActive = oudPanel.classList.contains('is-active');

  let nieuwHtml = '';
  switch (tabKey) {
    case 'tenderplanning':   nieuwHtml = renderTabTenderplanning(tccState.data); break;
    case 'projectplanning':  nieuwHtml = renderTabProjectplanning(tccState.data); break;
    case 'checklist':        nieuwHtml = renderTabChecklist(tccState.data); break;
    default: return;
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = nieuwHtml;
  const nieuwPanel = tempDiv.firstElementChild;

  if (wasActive) nieuwPanel.classList.add('is-active');
  oudPanel.replaceWith(nieuwPanel);
}

function _refreshTabBadges(panel) {
  const data = tccState.data;
  const badgeUpdates = {
    tenderplanning:  data.tenderplanning?.badge  || '',
    projectplanning: data.projectplanning?.badge || '',
    checklist:       data.checklist?.badge       || '',
    team:            data.team?.badge            || ''
  };

  for (const [tabKey, badge] of Object.entries(badgeUpdates)) {
    const tabBtn = panel.querySelector(`[data-tab="${tabKey}"]`);
    if (!tabBtn) continue;

    let badgeEl = tabBtn.querySelector('.tcc-tab-badge');
    if (badge) {
      if (badgeEl) {
        badgeEl.textContent = badge;
      } else {
        badgeEl = document.createElement('span');
        badgeEl.className = 'tcc-tab-badge tcc-tab-badge--count';
        badgeEl.textContent = badge;
        tabBtn.appendChild(badgeEl);
      }
    } else {
      badgeEl?.remove();
    }
  }
}

function transformTenderplanningVanMilestones(milestones = []) {
  if (!milestones.length) return { milestones: [], badge: '' };
  return { milestones, badge: String(milestones.length) };
}

// ============================================
// ACTION HANDLERS
// ============================================

function _handleAiCopy(docType) {
  const content = tccState.data?.generatie?.documenten?.find(d => d.type === docType);
  if (content) showTccToast('Gebruik de Bekijk knop om te kopiëren', 'info');
}

function _handleAiDownload(docType) {
  _handleAiView(docType);
}

function _handleEditFields() {
  // Navigeer naar Info tab en open edit mode
  const panel = tccState.overlay?.querySelector('#tcc-panel');
  if (panel) {
    _switchTab('info', panel);
    setTimeout(() => {
      if (typeof handleInfoStartEdit === 'function') handleInfoStartEdit();
    }, 100);
  }
}

// ============================================
// BRIDGE — PlanningModal in TCC
// ============================================

async function _bridgePlanningToTcc() {
  const host = tccState.overlay?.querySelector('.tcc-bridge-host');
  if (!host) return;

  try {
    if (typeof renderPlanningInTcc === 'function') {
      await renderPlanningInTcc(tccState.tenderId, host);
    } else if (typeof PlanningModal !== 'undefined') {
      const modal = new PlanningModal(tccState.tenderId);
      await modal.renderInto(host);
    } else {
      host.innerHTML = `
        <div class="tcc-docs-empty">
            ${tccIcon('calendarClock', 28, '#cbd5e1')}
            <div class="tcc-docs-empty-title">Projectplanning</div>
            <div class="tcc-docs-empty-desc">De planning module is beschikbaar via het Agenda overzicht.</div>
            <button class="tcc-btn tcc-btn--secondary" data-action="tcc-close">
                ${tccIcon('close', 14)} Sluiten
            </button>
        </div>`;
    }
  } catch (e) {
    console.warn('[TCC] Planning bridge mislukt:', e);
    host.innerHTML = `<div style="padding:20px;color:#94a3b8;font-size:13px;">Planning laden mislukt: ${e.message}</div>`;
  }
}

// ============================================
// API
// ============================================

async function tccApiCall(endpoint, options = {}) {
  const session = await window.supabaseClient?.auth?.getSession();
  const token = session?.data?.session?.access_token
    || window._tccAuthToken
    || localStorage.getItem('sb-access-token')
    || '';

  const baseUrl = window.CONFIG?.API_BASE_URL || window.API_CONFIG?.BASE_URL || '';
  const url = `${baseUrl}${endpoint}`;

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(errText || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================
// TOAST
// ============================================

function showTccToast(message, type = 'info') {
  const toast = tccState.overlay?.querySelector('#tcc-toast');
  if (!toast) return;

  const colorMap = { success: '#16a34a', error: '#dc2626', info: '#4338ca', warn: '#f59e0b' };
  toast.style.display = 'flex';
  toast.style.background = colorMap[type] || colorMap.info;
  toast.textContent = message;

  if (tccState.toastTimer) clearTimeout(tccState.toastTimer);
  tccState.toastTimer = setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ============================================
// SKELETON / ERROR STATE
// ============================================

function _renderLoadingSkeleton() {
  return `
    <div class="tcc-panel" style="display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;color:#94a3b8;">
            <div class="tcc-spinner" style="width:32px;height:32px;border-width:3px;margin:0 auto 16px;"></div>
            <div style="font-size:14px;font-weight:500;">Tender laden…</div>
        </div>
    </div>`;
}

function _renderErrorState(message) {
  return `
    <div class="tcc-panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:40px;">
        <div style="color:#dc2626;">${tccIcon('warning', 32, '#dc2626')}</div>
        <div style="font-size:15px;font-weight:600;color:#0f172a;">Laden mislukt</div>
        <div style="font-size:13px;color:#64748b;text-align:center;max-width:320px;">${escHtml(message || 'Er is een fout opgetreden')}</div>
        <button class="tcc-btn tcc-btn--secondary" data-action="tcc-close">Sluiten</button>
    </div>`;
}

// ============================================
// HELPERS
// ============================================

/**
 * Rendert een icoon uit de Icons library.
 * Icons.js verwacht een options-object: { size, color }
 * NIET als losse parameters Icons[name](size, color).
 */
function tccIcon(name, size = 16, color) {
  const opts = { size };
  if (color) opts.color = color;

  if (typeof Icons !== 'undefined' && Icons[name]) return Icons[name](opts);
  if (typeof window.Icons !== 'undefined' && window.Icons[name]) return window.Icons[name](opts);
  return `<span style="display:inline-block;width:${size}px;height:${size}px;"></span>`;
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _formatDateNL(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return String(dateStr);
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return String(dateStr); }
}

function _formatCurrency(value) {
  if (!value) return '—';
  const num = parseFloat(String(value).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
}

function _daysUntil(date) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}