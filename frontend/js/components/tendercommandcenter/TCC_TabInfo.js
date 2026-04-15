/* ============================================
   TCC_TabInfo.js
   Tender Command Center — Tab "Tenderinformatie"
   v1.2 — 12 maart 2026

   WIJZIGING v1.2:
   Secties kunnen niet meer in-/uitklappen tijdens edit mode.
   De toggle-section handler wordt alleen geregistreerd in view mode.

   WIJZIGING v1.1:
   Alle tab-specifieke classnames hebben nu het prefix tcc-info-
   zodat de styling centraal via TenderCommandCenter.css wordt beheerd,
   identiek aan de andere TCC tabs.

   Bevat:
   - renderTabInfo(data)          — hoofd render (view mode)
   - _renderInfoViewMode(tender)  — read-only velden
   - _renderInfoEditMode(tender)  — bewerkbare formulier
   - _renderBureauSection(tender) — tenderbureau info
   - _renderBedrijfSection(tender, bedrijven) — inschrijvend bedrijf
   - initInfoTabEvents(panel)     — event handlers
   - _saveInfoChanges()           — opslaan naar backend
   - _deleteCurrentTender()       — tender verwijderen

   Gebruikt:
   - tccIcon(), escHtml(), _formatDateNL() uit TCC_Core.js
   - tccState, tccApiCall(), showTccToast() uit TCC_Core.js
   - window.Icons uit icons.js
   ============================================ */

// ============================================
// STATE — Info tab specifiek
// ============================================

const _infoState = {
  isEditing: false,
  bedrijven: [],         // Geladen uit BedrijvenView / API
  bedrijvenLoaded: false,
  pendingBedrijfId: null  // Geselecteerd bedrijf_id, wacht op opslaan
};

// ============================================
// RENDER — Hoofd
// ============================================

function renderTabInfo(data) {
  const isActive = tccState.activeTab === 'info';
  return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="info">
        <div class="tcc-info-container">
            <div id="tcc-info-content">
                ${_renderInfoContent(data)}
            </div>
        </div>
    </div>
    `;
}

function _renderInfoContent(data) {
  const tender = data?.tender || {};

  return `
        ${_renderTenderInfoSection(tender)}
        ${_renderBureauSection(tender)}
        ${_renderBedrijfSection(tender)}
        ${_infoState.isEditing ? _renderDangerZone() : ''}
    `;
}

// ============================================
// SECTIE 1: TENDER INFORMATIE
// ============================================

function _renderTenderInfoSection(tender) {
  const hasNaam = !!tender.naam;
  const statusLabel = hasNaam ? 'Compleet' : 'Onvolledig';
  const statusClass = hasNaam ? 'complete' : 'partial';

  const toggleAttr = _infoState.isEditing ? '' : 'data-action="toggle-section"';
  const chevronStyle = _infoState.isEditing ? ' style="opacity:0.3;pointer-events:none;"' : '';

  return `
        <div class="tcc-section is-open" ${toggleAttr}>
            <div class="tcc-section-header" style="${_infoState.isEditing ? 'cursor:default;' : ''}">
                <div class="tcc-section-header-left">
                    <div class="tcc-section-icon">
                        ${tccIcon('fileText', 16, '#4f46e5')}
                    </div>
                    <span class="tcc-section-title">Tender Informatie</span>
                </div>
                <div class="tcc-section-header-right">
                    <span class="tcc-section-status tcc-section-status--${statusClass}">${statusLabel}</span>
                    <span class="tcc-section-chevron"${chevronStyle}>${tccIcon('chevronDown', 16)}</span>
                </div>
            </div>
            <div class="tcc-section-body">
                ${_infoState.isEditing
      ? _renderInfoEditMode(tender)
      : _renderInfoViewMode(tender)
    }
            </div>
        </div>
    `;
}

function _renderInfoViewMode(tender) {
  const fields = [
    { label: 'Tender naam', value: tender.naam, full: true },
    { label: 'Aanbestedende dienst', value: tender.aanbestedende_dienst || tender.opdrachtgever },
    { label: 'Locatie project', value: tender.locatie },
    { label: 'Fase', value: tender.fase ? _capitalize(tender.fase) : '' },
    { label: 'Status', value: tender.status ? _capitalize(tender.status) : '' },
    { label: 'Tendernummer', value: tender.tender_nummer },
    { label: 'Type aanbesteding', value: tender.type ? _formatType(tender.type) : '' },
    { label: 'Korte omschrijving', value: tender.omschrijving, full: true },
    { label: 'TenderNed URL', value: tender.tenderned_url, isLink: true },
    { label: 'Tender ID', value: tender.id, isMono: true }
  ];

  return `
        <div class="tcc-info-grid">
            ${fields.map(f => _renderViewField(f)).join('')}
        </div>
    `;
}

function _renderViewField(field) {
  const fullClass = field.full ? ' tcc-info-field--full' : '';
  let valueHtml;

  if (!field.value) {
    valueHtml = `<span class="tcc-info-field-value tcc-info-field-value--muted">Niet ingevuld</span>`;
  } else if (field.isLink) {
    valueHtml = `<a class="tcc-info-field-value tcc-info-field-value--link" href="${escHtml(field.value)}" target="_blank" rel="noopener">${escHtml(field.value)}</a>`;
  } else if (field.isMono) {
    valueHtml = `<span class="tcc-info-field-value" style="font-size:11px;color:#94a3b8;font-family:monospace;">${escHtml(field.value)}</span>`;
  } else {
    valueHtml = `<span class="tcc-info-field-value">${escHtml(field.value)}</span>`;
  }

  return `
        <div class="tcc-info-field${fullClass}">
            <span class="tcc-info-field-label">${field.label}</span>
            ${valueHtml}
        </div>
    `;
}

function _renderInfoEditMode(tender) {
  const faseOptions = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];
  const typeOptions = [
    { value: 'europese_aanbesteding', label: 'Europese aanbesteding' },
    { value: 'nationale_aanbesteding', label: 'Nationale aanbesteding' },
    { value: 'meervoudig_onderhands', label: 'Meervoudig onderhands' },
    { value: 'enkelvoudig_onderhands', label: 'Enkelvoudig onderhands' }
  ];

  return `
        <div class="tcc-info-grid">
            <div class="tcc-info-field tcc-info-field--full">
                <span class="tcc-info-field-label">Tender naam *</span>
                <input class="tcc-info-input" type="text" data-field="naam"
                       value="${escHtml(tender.naam || '')}" placeholder="Naam van de tender">
            </div>
            <div class="tcc-info-field">
                <span class="tcc-info-field-label">Aanbestedende dienst *</span>
                <input class="tcc-info-input" type="text" data-field="aanbestedende_dienst"
                       value="${escHtml(tender.aanbestedende_dienst || tender.opdrachtgever || '')}"
                       placeholder="Naam aanbestedende dienst">
            </div>
            <div class="tcc-info-field">
                <span class="tcc-info-field-label">Locatie project</span>
                <input class="tcc-info-input" type="text" data-field="locatie"
                       value="${escHtml(tender.locatie || '')}" placeholder="Locatie">
            </div>
            <div class="tcc-info-field">
                <span class="tcc-info-field-label">Fase *</span>
                <select class="tcc-info-input tcc-info-input--select" data-field="fase">
                    ${faseOptions.map(f => `
                        <option value="${f}" ${tender.fase === f ? 'selected' : ''}>${_capitalize(f)}</option>
                    `).join('')}
                </select>
            </div>
            <div class="tcc-info-field">
                <span class="tcc-info-field-label">Status</span>
                <input class="tcc-info-input" type="text" data-field="status"
                       value="${escHtml(tender.status || '')}" placeholder="Status">
            </div>
            <div class="tcc-info-field">
                <span class="tcc-info-field-label">Tendernummer</span>
                <input class="tcc-info-input" type="text" data-field="tender_nummer"
                       value="${escHtml(tender.tender_nummer || '')}" placeholder="Tendernummer">
            </div>
            <div class="tcc-info-field">
                <span class="tcc-info-field-label">Type aanbesteding</span>
                <select class="tcc-info-input tcc-info-input--select" data-field="type">
                    <option value="">-- Selecteer --</option>
                    ${typeOptions.map(o => `
                        <option value="${o.value}" ${tender.type === o.value ? 'selected' : ''}>${o.label}</option>
                    `).join('')}
                </select>
            </div>
            <div class="tcc-info-field tcc-info-field--full">
                <span class="tcc-info-field-label">Korte omschrijving</span>
                <textarea class="tcc-info-input tcc-info-input--textarea" data-field="omschrijving"
                          placeholder="Korte samenvatting van de tender...">${escHtml(tender.omschrijving || '')}</textarea>
            </div>
            <div class="tcc-info-field tcc-info-field--full">
                <span class="tcc-info-field-label">TenderNed URL</span>
                <input class="tcc-info-input" type="url" data-field="tenderned_url"
                       value="${escHtml(tender.tenderned_url || '')}" placeholder="https://tenderned.nl/...">
            </div>
        </div>
    `;
}

// ============================================
// SECTIE 2: TENDERBUREAU
// ============================================

function _renderBureauSection(tender) {
  const bureau = tender.tenderbureau || {};
  const bureauNaam = bureau.bureau_naam || tender.bureau_naam || window.app?.currentBureau?.bureau_naam || '';
  const bureauId = tender.tenderbureau_id || '';
  const initialen = _getInitialen(bureauNaam);
  const createdAt = tender.created_at ? _formatDateNL(tender.created_at) : '';

  return `
    <div class="tcc-section is-open" ${_infoState.isEditing ? '' : 'data-action="toggle-section"'}>
      <div class="tcc-section-header" style="${_infoState.isEditing ? 'cursor:default;' : ''}">
        <div class="tcc-section-header-left">
          <div class="tcc-section-icon">
            ${tccIcon('buildingOffice', 16, '#16a34a')}
          </div>
          <span class="tcc-section-title">Tenderbureau</span>
        </div>
        <div class="tcc-section-header-right">
          <span class="tcc-section-status tcc-section-status--complete">Gekoppeld</span>
          <span class="tcc-section-chevron" ${_infoState.isEditing ? 'style="opacity:0.3;pointer-events:none;"' : ''}>${tccIcon('chevronDown', 16)}</span>
        </div>
      </div>
      <div class="tcc-section-body">
        <div class="tcc-info-bureau-card">
          <div class="tcc-info-bureau-avatar">${initialen}</div>
          <div class="tcc-info-bureau-info">
            <div class="tcc-info-bureau-name">${escHtml(bureauNaam)}</div>
            <div class="tcc-info-bureau-hint">Bureau dat deze tender begeleidt</div>
          </div>
          <span class="tcc-info-bureau-badge">Actief bureau</span>
        </div>
        <div class="tcc-info-grid">
          <div class="tcc-info-field">
            <span class="tcc-info-field-label">Bureau ID</span>
            <span class="tcc-info-field-value" style="font-size:11px;color:#94a3b8;font-family:monospace;">${escHtml(bureauId ? bureauId.substring(0, 12) + '...' : '')}</span>
          </div>
          <div class="tcc-info-field">
            <span class="tcc-info-field-label">Tender aangemaakt</span>
            <span class="tcc-info-field-value">${createdAt}</span>
          </div>
          <div class="tcc-info-field">
            <span class="tcc-info-field-label">Bureau e-mail</span>
            <span class="tcc-info-field-value">${escHtml(bureau.email || '')}</span>
          </div>
          <div class="tcc-info-field">
            <span class="tcc-info-field-label">Bureau adres</span>
            <span class="tcc-info-field-value">${escHtml(bureau.adres || '')}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// SECTIE 3: INSCHRIJVEND BEDRIJF
// ============================================

function _renderBedrijfSection(tender) {
  const bedrijfId = tender.bedrijf_id || tender.inschrijvend_bedrijf_id || null;
  const bedrijfNaam = tender.bedrijfsnaam || tender.bedrijf_naam || '';
  const hasBedrijf = !!bedrijfId || !!bedrijfNaam;

  const statusLabel = hasBedrijf ? 'Gekoppeld' : 'Selecteer bedrijf';
  const statusClass = hasBedrijf ? 'complete' : 'partial';

  return `
        <div class="tcc-section is-open" ${_infoState.isEditing ? '' : 'data-action="toggle-section"'} id="tcc-info-bedrijf-section">
            <div class="tcc-section-header" style="${_infoState.isEditing ? 'cursor:default;' : ''}">
                <div class="tcc-section-header-left">
                    <div class="tcc-section-icon">
                        ${tccIcon('building', 16, '#2563eb')}
                    </div>
                    <span class="tcc-section-title">Inschrijvend Bedrijf</span>
                </div>
                <div class="tcc-section-header-right">
                    <span class="tcc-section-status tcc-section-status--${statusClass}" id="tcc-info-bedrijf-status">${statusLabel}</span>
                    <span class="tcc-section-chevron" ${_infoState.isEditing ? 'style="opacity:0.3;pointer-events:none;"' : ''}>${tccIcon('chevronDown', 16)}</span>
                </div>
            </div>
            <div class="tcc-section-body" id="tcc-info-bedrijf-body">
                ${_infoState.isEditing
      ? _renderBedrijfEditMode(tender)
      : (hasBedrijf ? _renderBedrijfCard(tender) : '<div style="padding:14px 18px;font-size:13px;color:#94a3b8;">Geen bedrijf gekoppeld. Klik op Bewerken om een bedrijf te selecteren.</div>')
    }
            </div>
        </div>
    `;
}

function _renderBedrijfCard(tender) {
  const naam = tender.bedrijfsnaam || tender.bedrijf_naam || 'Bedrijf';
  const initialen = _getInitialen(naam);
  const kvk = tender.bedrijf_kvk || '';
  const plaats = tender.bedrijf_plaats || '';
  const contact = tender.bedrijf_contact || '';
  const branche = tender.bedrijf_branche || '';

  return `
    <div class="tcc-info-bedrijf-card">
      <div class="tcc-info-bedrijf-avatar">${initialen}</div>
      <div class="tcc-info-bedrijf-info">
        <div class="tcc-info-bedrijf-name">${escHtml(naam)}</div>
        <div class="tcc-info-bedrijf-hint">Inschrijvend bedrijf voor deze tender</div>
      </div>
      <span class="tcc-info-bedrijf-badge">Inschrijver</span>
    </div>
    <div class="tcc-info-grid">
      ${kvk ? `<div class="tcc-info-field"><span class="tcc-info-field-label">KvK-nummer</span><span class="tcc-info-field-value">${escHtml(kvk)}</span></div>` : ''}
      ${plaats ? `<div class="tcc-info-field"><span class="tcc-info-field-label">Vestigingsplaats</span><span class="tcc-info-field-value">${escHtml(plaats)}</span></div>` : ''}
      ${contact ? `<div class="tcc-info-field"><span class="tcc-info-field-label">Contactpersoon</span><span class="tcc-info-field-value">${escHtml(contact)}</span></div>` : ''}
      ${branche ? `<div class="tcc-info-field"><span class="tcc-info-field-label">Branche</span><span class="tcc-info-field-value">${escHtml(branche)}</span></div>` : ''}
    </div>
  `;
}

// Edit mode: altijd een dropdown tonen (ook als er al een bedrijf is)
function _renderBedrijfEditMode(tender) {
  const bedrijven = _infoState.bedrijven || [];
  const huidigBedrijfId = _infoState.pendingBedrijfId || tender.bedrijf_id || '';
  const huidigNaam = tender.bedrijfsnaam || tender.bedrijf_naam || '';

  return `
    <div class="tcc-info-select-wrapper">
      <div class="tcc-info-select-label">Bedrijf waarmee wordt ingeschreven</div>
      <select class="tcc-info-input tcc-info-input--select" id="tcc-info-bedrijf-select" data-field="bedrijf_id">
        <option value="">-- Selecteer inschrijvend bedrijf --</option>
        ${bedrijven.length > 0
      ? bedrijven.map(b => `
              <option value="${b.id}" ${b.id === huidigBedrijfId ? 'selected' : ''}>
                ${escHtml(b.naam || b.bedrijfsnaam || 'Bedrijf')}
              </option>`).join('')
      : huidigBedrijfId
        ? `<option value="${huidigBedrijfId}" selected>${escHtml(huidigNaam || huidigBedrijfId)}</option>`
        : ''
    }
      </select>
      ${!_infoState.bedrijvenLoaded ? `
        <div style="font-size:11px;color:#6366f1;margin-top:6px;">
          ${tccIcon('refresh', 12, '#6366f1')} Bedrijven worden geladen...
        </div>
      ` : `
        <div style="font-size:11px;color:#94a3b8;margin-top:6px;">
          Bedrijven worden beheerd in de Bedrijven module.
        </div>
      `}
    </div>
  `;
}

// ============================================
// DANGER ZONE
// ============================================

function _renderDangerZone() {
  return `
        <div class="tcc-info-danger-zone">
            <div class="tcc-info-danger-text">
                <strong>Tender verwijderen</strong>
                <small>Dit verwijdert de tender en alle gekoppelde data permanent.</small>
            </div>
            <button class="tcc-btn tcc-info-btn-danger" data-action="info-delete-tender">
                ${tccIcon('trash', 14, '#dc2626')} Verwijderen
            </button>
        </div>
    `;
}

// ============================================
// FOOTER — Info tab specifiek
// ============================================

function renderInfoFooter() {
  if (_infoState.isEditing) {
    return `
      <button class="tcc-btn tcc-btn--ghost" data-action="info-cancel-edit">
        Annuleren
      </button>
      <div class="tcc-footer-right">
        <button class="tcc-btn tcc-btn--success" data-action="info-save">
          ${tccIcon('save', 14, '#ffffff')} Wijzigingen opslaan
        </button>
      </div>
    `;
  }

  return `
        <div class="tcc-footer-right">
            <button class="tcc-btn tcc-btn--ghost" data-action="tcc-close">
                ${tccIcon('close', 14)} Sluiten
            </button>
            <button class="tcc-btn tcc-btn--ghost" data-action="info-start-edit">
                ${tccIcon('edit', 14)} Bewerken
            </button>
        </div>
    `;
}

// ============================================
// EVENT HANDLERS
// ============================================

function handleInfoStartEdit() {
  _infoState.isEditing = true;
  _refreshInfoTab();
  _loadBedrijven();
}

function handleInfoCancelEdit() {
  _infoState.isEditing = false;
  _infoState.pendingBedrijfId = null;
  _refreshInfoTab();
}

async function handleInfoSave() {
  const panel = tccState.overlay?.querySelector('#tcc-panel');
  if (!panel || !tccState.tenderId) return;

  // Whitelist: alleen kolommen die bestaan in de tenders tabel
  const ALLOWED_FIELDS = new Set([
    'naam', 'aanbestedende_dienst', 'locatie', 'fase', 'status',
    'tender_nummer', 'type', 'omschrijving', 'tenderned_url', 'bedrijf_id'
  ]);

  // Verzamel velden — alleen whitelisted kolommen
  const updateData = {};
  panel.querySelectorAll('.tcc-info-input[data-field]').forEach(input => {
    const field = input.dataset.field;
    if (!ALLOWED_FIELDS.has(field)) return;
    updateData[field] = input.value?.trim() || null;
  });

  // Bedrijf_id uit pendingBedrijfId als de selector niet meer in DOM staat
  if (_infoState.pendingBedrijfId !== null) {
    updateData.bedrijf_id = _infoState.pendingBedrijfId;
  }

  // Validatie
  if (!updateData.naam) {
    showTccToast('Tender naam is verplicht', 'error');
    return;
  }

  try {
    // Update via Supabase of API
    const sb = window.supabaseClient || window.supabase;
    if (sb) {
      const { error } = await sb
        .from('tenders')
        .update(updateData)
        .eq('id', tccState.tenderId);

      if (error) throw new Error(error.message);
    } else {
      await tccApiCall(`/api/v1/tenders/${tccState.tenderId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
    }

    // Update lokale state
    if (tccState.data?.tender) {
      Object.assign(tccState.data.tender, updateData);
    }

    // Update de window.app.tenders array
    if (window.app?.tenders) {
      const idx = window.app.tenders.findIndex(t => t.id === tccState.tenderId);
      if (idx >= 0) Object.assign(window.app.tenders[idx], updateData);
    }

    // Ververs de tenderlijst uit backend/Supabase
    if (window.app?.loadTenders) {
      await window.app.loadTenders();
      if (window.app?.views?.totaal?.render) window.app.views.totaal.render();
    }

    _infoState.isEditing = false;
    _infoState.pendingBedrijfId = null;
    showTccToast('Tenderinformatie opgeslagen', 'success');

    // Re-render tab + header
    _refreshInfoTab();
    _refreshTccHeader();

    // Ververs de actieve view zodat wijzigingen direct zichtbaar zijn
    if (window.app?.kanbanView) {
      window.app.kanbanView.setTenders(window.app.tenders);
      window.app.kanbanView.render();
    }
    Object.values(window.app?.views || {}).forEach(view => {
      if (typeof view?.render === 'function') view.render();
    });

  } catch (err) {
    console.error('[TCC Info] Save mislukt:', err);
    showTccToast(`Opslaan mislukt: ${err.message}`, 'error');
  }
}

async function handleInfoDeleteTender() {
  if (!tccState.tenderId) return;

  const tender = tccState.data?.tender || {};
  const naam = tender.naam || 'deze tender';

  const confirmed = confirm(
    `Weet je zeker dat je "${naam}" wilt verwijderen?\n\n` +
    `Dit verwijdert de tender en alle gekoppelde data (planning, checklist, documenten) permanent.\n\n` +
    `Deze actie kan niet ongedaan worden gemaakt.`
  );
  if (!confirmed) return;

  const doubleConfirm = confirm(
    `LAATSTE KANS: Typ je echt "${naam}" verwijderen?\n\nKlik OK om definitief te verwijderen.`
  );
  if (!doubleConfirm) return;

  try {
    const sb = window.supabaseClient || window.supabase;
    if (sb) {
      const { error } = await sb.from('tenders').delete().eq('id', tccState.tenderId);
      if (error) throw new Error(error.message);
    } else {
      await tccApiCall(`/api/v1/tenders/${tccState.tenderId}`, { method: 'DELETE' });
    }

    showTccToast('Tender verwijderd', 'success');
    closeTcc();

    if (window.app?.loadTenders) {
      setTimeout(() => window.app.loadTenders(), 500);
    }

  } catch (err) {
    console.error('[TCC Info] Delete mislukt:', err);
    showTccToast(`Verwijderen mislukt: ${err.message}`, 'error');
  }
}

function handleInfoBedrijfSelect(select) {
  const bedrijfId = select.value;
  if (!bedrijfId) return;

  const bedrijf = _infoState.bedrijven.find(b => b.id === bedrijfId);
  if (!bedrijf) return;

  // Bewaar geselecteerde bedrijf_id voor opslaan
  _infoState.pendingBedrijfId = bedrijfId;

  // Update lokale tender state
  if (tccState.data?.tender) {
    tccState.data.tender.bedrijf_id = bedrijfId;
    tccState.data.tender.bedrijfsnaam = bedrijf.naam || bedrijf.bedrijfsnaam;
    tccState.data.tender.bedrijf_kvk = bedrijf.kvk_nummer;
    tccState.data.tender.bedrijf_plaats = bedrijf.plaats;
    tccState.data.tender.bedrijf_contact = bedrijf.contactpersoon;
    tccState.data.tender.bedrijf_branche = bedrijf.branche;
  }
}

// ============================================
// BEDRIJVEN LADEN
// ============================================

async function _loadBedrijven() {
  if (_infoState.bedrijvenLoaded) return;

  try {
    const bureauId = tccState.data?.tender?.tenderbureau_id;
    if (!bureauId) return;

    const sb = window.supabaseClient || window.supabase;
    if (sb) {
      const { data, error } = await sb
        .from('bedrijven')
        .select('id, bedrijfsnaam, kvk_nummer, plaats, contactpersoon, branche')
        .eq('tenderbureau_id', bureauId)
        .order('bedrijfsnaam');

      if (error) throw error;
      _infoState.bedrijven = data || [];
    }

    _infoState.bedrijvenLoaded = true;

    const select = document.getElementById('tcc-info-bedrijf-select');
    if (select) {
      const tender = tccState.data?.tender || {};
      select.innerHTML = `
                <option value="">-- Selecteer inschrijvend bedrijf --</option>
                ${_infoState.bedrijven.map(b => `
                    <option value="${b.id}" ${tender.bedrijf_id === b.id ? 'selected' : ''}>
                        ${escHtml(b.naam || b.bedrijfsnaam || 'Bedrijf')}
                    </option>
                `).join('')}
            `;
    }

  } catch (err) {
    console.error('[TCC Info] Bedrijven laden mislukt:', err);
  }
}

// ============================================
// REFRESH HELPERS
// ============================================

function _refreshInfoTab() {
  const panel = tccState.overlay?.querySelector('#tcc-panel');
  if (!panel) return;

  const content = panel.querySelector('#tcc-info-content');
  if (content) {
    content.innerHTML = _renderInfoContent(tccState.data);
  }

  let footer = panel.querySelector('.tcc-footer');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'tcc-footer';
    panel.appendChild(footer);
  }
  footer.innerHTML = renderInfoFooter();
}

function _refreshTccHeader() {
  const panel = tccState.overlay?.querySelector('#tcc-panel');
  if (!panel) return;

  const tender = tccState.data?.tender || {};
  const h2 = panel.querySelector('.tcc-header-info h2');
  if (h2) h2.textContent = tender.naam || 'Tender';

  const faseBadge = panel.querySelector('.tcc-meta-tag--fase');
  if (faseBadge && tender.fase) faseBadge.textContent = tender.fase;
}

// ============================================
// UTILITIES
// ============================================

function _capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function _formatType(type) {
  const map = {
    'europese_aanbesteding': 'Europese aanbesteding',
    'nationale_aanbesteding': 'Nationale aanbesteding',
    'meervoudig_onderhands': 'Meervoudig onderhands',
    'enkelvoudig_onderhands': 'Enkelvoudig onderhands'
  };
  return map[type] || type;
}

function _getInitialen(naam) {
  if (!naam) return '??';
  const parts = naam.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}