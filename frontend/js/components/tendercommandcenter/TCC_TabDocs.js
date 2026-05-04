/* ============================================
   TCC_TabDocs.js  —  v2.0  (2026-03-10)
   Documenten tab — twee secties:
   1. Aanbestedingsdocumenten (tender_documents)
   2. AI Gegenereerde documenten (ai_documents)

   Wijzigingen v2.0:
   - Bestandsrijen als cards met border-radius (conform mockup)
   - Type-badge (PDF / DOCX / XLSX) rechts in rij
   - Upload-zone verborgen achter compacte "Document uploaden" knop
   - Smart Import CTA bovenaan (paarse gradiënt banner)
   - Secties met label + count ipv grote section-header blokken
   - AI docs: status inline in naam, acties als icon-knoppen
   - CSS volledig via IIFE geïnjecteerd
   ============================================ */

// ============================================
// RENDER — Tab: Documenten
// ============================================

function renderTabDocs(data) {
    const docs = data.documenten || [];
    const isActive = tccState.activeTab === 'docs';

    return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="docs">
        <div class="tcc-docs-container">
            ${_renderAanbestedingSection(docs)}
        </div>
    </div>`;
}

// ============================================
// Smart Import CTA banner
// ============================================

function _renderSmartImportCta() {
    return `
    <div class="tcc-docs-smart-import-cta">
        <div class="tcc-docs-smart-import-icon">
            ${tccIcon('zap', 20, '#fff')}
        </div>
        <div class="tcc-docs-smart-import-info">
            <div class="tcc-docs-smart-import-title">Smart Import beschikbaar</div>
            <div class="tcc-docs-smart-import-desc">Analyseer documenten automatisch en extraheer tenderinformatie met AI.</div>
        </div>
        <button class="tcc-btn tcc-btn--secondary tcc-btn--sm" data-action="smart-import-trigger">
            Start Smart Import
        </button>
    </div>`;
}

// ============================================
// SECTIE 1 — Aanbestedingsdocumenten
// ============================================

function _renderAanbestedingSection(docs) {
    const listHtml = docs.length > 0
        ? `<div class="tcc-docs-list">${docs.map(doc => _renderDocCard(doc)).join('')}</div>`
        : `<div class="tcc-docs-leeg">
               ${tccIcon('folderOpen', 24, '#cbd5e1')}
               <span>Nog geen documenten geüpload</span>
           </div>`;

    return `
    <div class="tcc-docs-sectie">
        <div class="tcc-docs-sectie-label">
            Aanbestedingsdocumenten
            <span class="tcc-docs-sectie-count">(${docs.length})</span>
        </div>
        ${listHtml}
        <div class="doc-dropzone" id="doc-dropzone">
            <div class="doc-dropzone-inner">
                ${tccIcon('upload', 24, '#7c3aed')}
                <div class="doc-dropzone-tekst">
                    <span class="doc-dropzone-hoofd">Sleep bestanden hierheen</span>
                    <span class="doc-dropzone-sub">of <button class="doc-dropzone-knop" id="doc-upload-knop">klik om te uploaden</button></span>
                </div>
                <div class="doc-dropzone-hint">PDF, Word, Excel — max 25 MB per bestand</div>
            </div>
            <input type="file" id="doc-file-input" multiple
                accept=".pdf,.doc,.docx,.xlsx,.xls,.pptx,.ppt,.txt,.csv"
                style="display:none">
        </div>
    </div>`;
}

// ============================================
// SECTIE 2 — AI Gegenereerde documenten
// ============================================

function _renderAiDocsSection(aiDocs) {
    const generated = aiDocs.filter(d => d.status === 'done' || d.status === 'gonogo');

    if (generated.length === 0) return '';

    const listHtml = `<div class="tcc-docs-list">${generated.map(doc => _renderAiDocCard(doc)).join('')}</div>`;

    return `
    <div class="tcc-docs-sectie tcc-docs-sectie--ai">
        <div class="tcc-docs-sectie-label">
            AI Gegenereerde documenten
            <span class="tcc-docs-sectie-count">(${generated.length}/${aiDocs.length} gereed)</span>
        </div>
        ${listHtml}
    </div>`;
}

// ============================================
// Document card — geüploade bestanden
// ============================================

function _renderDocCard(doc) {
    const extIconMap = {
        pdf: { icon: 'fileText', color: '#dc2626', bg: '#fef2f2', badge: 'PDF', badgeCls: 'tcc-docs-badge--pdf' },
        docx: { icon: 'fileText', color: '#2563eb', bg: '#eff6ff', badge: 'DOCX', badgeCls: 'tcc-docs-badge--docx' },
        doc: { icon: 'fileText', color: '#2563eb', bg: '#eff6ff', badge: 'DOC', badgeCls: 'tcc-docs-badge--docx' },
        xlsx: { icon: 'barChart', color: '#16a34a', bg: '#f0fdf4', badge: 'XLSX', badgeCls: 'tcc-docs-badge--xlsx' },
        xls: { icon: 'barChart', color: '#16a34a', bg: '#f0fdf4', badge: 'XLS', badgeCls: 'tcc-docs-badge--xlsx' },
        pptx: { icon: 'fileText', color: '#ea580c', bg: '#fff7ed', badge: 'PPTX', badgeCls: 'tcc-docs-badge--pptx' },
        ppt: { icon: 'fileText', color: '#ea580c', bg: '#fff7ed', badge: 'PPT', badgeCls: 'tcc-docs-badge--pptx' },
        txt: { icon: 'fileText', color: '#64748b', bg: '#f8fafc', badge: 'TXT', badgeCls: 'tcc-docs-badge--txt' },
        csv: { icon: 'barChart', color: '#0891b2', bg: '#ecfeff', badge: 'CSV', badgeCls: 'tcc-docs-badge--csv' },
    };

    const bestandsnaam = doc.original_file_name || doc.file_name || doc.bestandsnaam || doc.filename || 'Onbekend';
    const ext = bestandsnaam.split('.').pop().toLowerCase();
    const m = extIconMap[ext] || { icon: 'fileText', color: '#64748b', bg: '#f8fafc', badge: ext.toUpperCase(), badgeCls: 'tcc-docs-badge--txt' };

    const uploadedAt = doc.uploaded_at || doc.created_at;
    const datumStr = uploadedAt ? _formatDateNL(uploadedAt) : '';
    const grootte = doc.file_size || doc.bestandsgrootte;
    const grootteStr = grootte ? _formatFileSize(grootte) : '';

    const subParts = [datumStr, grootteStr].filter(Boolean);

    return `
    <div class="tcc-docs-card" data-doc-id="${doc.id}" data-action="doc-preview" data-doc-name="${escHtml(bestandsnaam)}">
        <div class="tcc-docs-card-icon" style="background:${m.bg};">
            ${tccIcon(m.icon, 18, m.color)}
        </div>
        <div class="tcc-docs-card-meta">
            <div class="tcc-docs-card-name">${escHtml(bestandsnaam)}</div>
            ${subParts.length ? `<div class="tcc-docs-card-sub">${subParts.join(' · ')}</div>` : ''}
        </div>
        <span class="tcc-docs-badge ${m.badgeCls}">${m.badge}</span>
        <div class="tcc-docs-card-actions">
            <button class="tcc-btn tcc-btn--ghost tcc-btn--xs tcc-btn--danger"
                    data-action="doc-delete" data-doc-id="${doc.id}" title="Verwijderen">
                ${tccIcon('trash', 12, '#dc2626')}
            </button>
        </div>
    </div>`;
}

// ============================================
// Document card — AI gegenereerde documenten
// ============================================

function _renderAiDocCard(doc) {
    const isDone = doc.status === 'done' || doc.status === 'gonogo';
    const isGenerating = doc.status === 'generating';

    const iconBg = isDone ? '#f0fdf4' : '#f5f3ff';
    const iconColor = isDone ? '#16a34a' : '#7c3aed';

    const statusHtml = isDone
        ? `<span class="tcc-docs-status tcc-docs-status--ok">${tccIcon('checkCircle', 10, '#16a34a')} Gegenereerd</span>`
        : isGenerating
            ? `<span class="tcc-docs-status tcc-docs-status--busy"><div class="tcc-spinner tcc-spinner--xs"></div> Bezig</span>`
            : `<span class="tcc-docs-status tcc-docs-status--pending">Nog niet gegenereerd</span>`;

    const subHtml = [
        doc.beschrijving ? escHtml(doc.beschrijving) : '',
        doc.generatedDate ? escHtml(doc.generatedDate) : ''
    ].filter(Boolean).join(' · ');

    const actionsHtml = '';

    return `
    <div class="tcc-docs-card tcc-docs-card--ai${isDone ? ' tcc-docs-card--done' : ''}">
        <div class="tcc-docs-card-icon" style="background:${iconBg};">
            ${tccIcon(doc.icon || 'fileText', 18, iconColor)}
        </div>
        <div class="tcc-docs-card-meta">
            <div class="tcc-docs-card-name">
                ${escHtml(doc.titel)}
                ${statusHtml}
            </div>
            ${subHtml ? `<div class="tcc-docs-card-sub">${subHtml}</div>` : ''}
        </div>
        <div class="tcc-docs-card-actions">
            ${actionsHtml}
        </div>
    </div>`;
}

// Backwards compat alias (gebruikt door TCC_Core refresh)
function renderDocRow(doc) { return _renderDocCard(doc); }

// ============================================
// HANDLERS — Upload
// ============================================

function _bindDocsDropzone() {
    const zone  = tccState.overlay?.querySelector('#doc-dropzone');
    const input = tccState.overlay?.querySelector('#doc-file-input');
    const knop  = tccState.overlay?.querySelector('#doc-upload-knop');

    if (!zone || !input) return;
    if (zone.dataset.bound) return;   // voorkom dubbel binden
    zone.dataset.bound = '1';

    // Klik op knop → file picker (zonder zone-click te triggeren)
    knop?.addEventListener('click', (e) => {
        e.stopPropagation();
        input.click();
    });

    // Klik op zone zelf → file picker
    zone.addEventListener('click', () => input.click());

    // File input change
    input.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        for (const file of files) await _uploadSingleDoc(file);
        input.value = '';
    });

    // Drag events
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('doc-dropzone--actief');
    });
    zone.addEventListener('dragleave', (e) => {
        if (!zone.contains(e.relatedTarget)) {
            zone.classList.remove('doc-dropzone--actief');
        }
    });
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('doc-dropzone--actief');
        const files = Array.from(e.dataTransfer.files || []);
        files.forEach(f => _uploadSingleDoc(f));
    });
}

async function _uploadSingleDoc(file) {
    const MAX_MB = 25;
    if (file.size > MAX_MB * 1024 * 1024) {
        showTccToast(`${file.name} is te groot (max ${MAX_MB} MB)`, 'error');
        return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempCardHtml = `
        <div class="tcc-docs-card tcc-docs-card--uploading" data-doc-id="${tempId}">
            <div class="tcc-docs-card-icon" style="background:#f1f5f9;">
                <div class="tcc-spinner tcc-spinner--xs"></div>
            </div>
            <div class="tcc-docs-card-meta">
                <div class="tcc-docs-card-name">${escHtml(file.name)}</div>
                <div class="tcc-docs-card-sub">Uploaden…</div>
            </div>
        </div>`;

    // Zorg dat er een .tcc-docs-list bestaat (maak aan als die er nog niet is)
    const sectie = tccState.overlay?.querySelector('.tcc-docs-sectie:not(.tcc-docs-sectie--ai)');
    let docsListEl = sectie?.querySelector('.tcc-docs-list');
    const leegEl = sectie?.querySelector('.tcc-docs-leeg');

    if (leegEl && !docsListEl) {
        leegEl.insertAdjacentHTML('beforebegin', '<div class="tcc-docs-list"></div>');
        leegEl.remove();
        docsListEl = sectie?.querySelector('.tcc-docs-list');
    }
    if (docsListEl) docsListEl.insertAdjacentHTML('afterbegin', tempCardHtml);

    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('document_type', 'aanbesteding');

        const result = await tccApiCallRaw(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/documents/upload`,
            { method: 'POST', body: formData }
        );

        const uploaded = result.document || result.data || result;
        const tempCard = tccState.overlay?.querySelector(`[data-doc-id="${tempId}"]`);
        if (tempCard) tempCard.outerHTML = _renderDocCard(uploaded);

        if (tccState.data?.documenten) tccState.data.documenten.unshift(uploaded);
        _updateDocsBadge();
        showTccToast(`${file.name} geüpload`, 'success');

    } catch (e) {
        tccState.overlay?.querySelector(`[data-doc-id="${tempId}"]`)?.remove();
        showTccToast(`Upload mislukt: ${e.message}`, 'error');
    }
}

// ============================================
// HANDLER — Verwijderen
// ============================================

async function handleDocDelete(docId) {
    if (!docId || !tccState.tenderId) return;

    const card = tccState.overlay?.querySelector(`[data-doc-id="${docId}"]`);
    const bestandsnaam = card?.querySelector('.tcc-docs-card-name')?.textContent?.trim() || 'dit document';

    if (!confirm(`Weet je zeker dat je "${bestandsnaam}" wilt verwijderen?`)) return;

    try {
        await tccApiCall(
            `/api/v1/ai-documents/tenders/${tccState.tenderId}/documents/${docId}`,
            { method: 'DELETE' }
        );

        card?.remove();

        if (tccState.data?.documenten) {
            tccState.data.documenten = tccState.data.documenten.filter(d => d.id !== docId);
        }

        // Toon leeg-state als lijst leeg is
        const sectie = tccState.overlay?.querySelector('.tcc-docs-sectie:not(.tcc-docs-sectie--ai)');
        const lijst = sectie?.querySelector('.tcc-docs-list');
        if (lijst && !lijst.children.length) {
            lijst.outerHTML = `
                <div class="tcc-docs-leeg">
                    ${tccIcon('folderOpen', 24, '#cbd5e1')}
                    <span>Nog geen documenten geüpload</span>
                </div>`;
        }

        _updateDocsBadge();
        showTccToast('Document verwijderd', 'success');

    } catch (e) {
        console.error('[TCC] Doc delete error:', e);
        showTccToast(`Verwijderen mislukt: ${e.message}`, 'error');
    }
}

// ============================================
// HANDLER — Document Preview
// ============================================

async function handleDocPreview(docId, docName) {
    if (!docId || !tccState.tenderId) return;
    await DocPreview.open(docId, tccState.tenderId, docName);
}

// ============================================
// HANDLER — Smart Import
// ============================================

function handleSmartImportTrigger() {
    if (typeof window.app?.smartImportWizard?.open === 'function') {
        window.app.smartImportWizard.open();
    } else {
        showTccToast('Smart Import niet beschikbaar', 'error');
    }
}

// ============================================
// HELPERS
// ============================================

function _updateDocsBadge() {
    const docsTab = tccState.overlay?.querySelector('[data-tab="docs"]');
    const badge = docsTab?.querySelector('.tcc-nav-badge');
    const count = tccState.data?.documenten?.length || 0;
    if (badge) badge.textContent = count;
    else if (docsTab && count > 0) {
        // Badge bestaat nog niet (was 0 bij laden) — voeg toe
        const span = document.createElement('span');
        span.className = 'tcc-nav-badge';
        span.textContent = count;
        docsTab.appendChild(span);
    }
}

function _formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function tccApiCallRaw(endpoint, options = {}) {
    const session = await window.supabaseClient?.auth?.getSession();
    const token = session?.data?.session?.access_token
        || window._tccAuthToken
        || localStorage.getItem('sb-access-token')
        || '';

    const baseUrl = window.CONFIG?.API_BASE_URL || window.API_CONFIG?.BASE_URL || '';
    const url = `${baseUrl}${endpoint}`;
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) }
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
    }
    return response.json();
}

// ============================================
// CSS INJECTIE
// ============================================

(function injectDocsCSS() {
    if (document.getElementById('tcc-docs-css')) return;
    const style = document.createElement('style');
    style.id = 'tcc-docs-css';
    style.textContent = `

/* ── Container ── */
.tcc-docs-container { display: flex; flex-direction: column; gap: 20px; }

/* ── Smart Import CTA ── */
.tcc-docs-smart-import-cta {
    background: linear-gradient(135deg, #faf5ff, #ede9fe);
    border: 1px solid #c4b5fd; border-radius: 12px;
    padding: 14px 18px; display: flex; align-items: center; gap: 14px;
}
.tcc-docs-smart-import-icon {
    width: 38px; height: 38px; border-radius: 10px;
    background: #7c3aed; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.tcc-docs-smart-import-info { flex: 1; min-width: 0; }
.tcc-docs-smart-import-title { font-size: 13px; font-weight: 600; color: #4c1d95; margin-bottom: 2px; }
.tcc-docs-smart-import-desc  { font-size: 12px; color: #7c3aed; }

/* ── Sectie ── */
.tcc-docs-sectie { display: flex; flex-direction: column; gap: 8px; }
.tcc-docs-sectie--ai { margin-top: 4px; }

.tcc-docs-sectie-label {
    font-size: 12px; font-weight: 700; color: #64748b;
    text-transform: uppercase; letter-spacing: .06em;
    display: flex; align-items: center; gap: 4px;
}
.tcc-docs-sectie-count { font-weight: 500; color: #94a3b8; }

/* ── Bestandslijst ── */
.tcc-docs-list { display: flex; flex-direction: column; gap: 6px; }

/* ── Leeg state ── */
.tcc-docs-leeg {
    display: flex; align-items: center; gap: 10px;
    padding: 18px 16px; color: #94a3b8; font-size: 13px;
    background: #f8fafc; border-radius: 10px; border: 1px dashed #e2e8f0;
}

/* ── Document card ── */
.tcc-docs-card {
    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 11px 14px; display: flex; align-items: center; gap: 12px;
    transition: border-color .15s;
}
.tcc-docs-card:hover { border-color: #c4b5fd; }
.tcc-docs-card--done { background: #f9fffe; border-color: #bbf7d0; }
.tcc-docs-card--done:hover { border-color: #86efac; }
.tcc-docs-card--uploading { opacity: .7; }

.tcc-docs-card-icon {
    width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
}
.tcc-docs-card-meta { flex: 1; min-width: 0; }
.tcc-docs-card-name {
    font-size: 13px; font-weight: 600; color: #0f172a;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.tcc-docs-card-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }

/* ── Type badge ── */
.tcc-docs-badge {
    font-size: 10px; font-weight: 700; padding: 2px 7px;
    border-radius: 5px; flex-shrink: 0; letter-spacing: .04em;
}
.tcc-docs-badge--pdf  { background: #fef2f2; color: #dc2626; }
.tcc-docs-badge--docx { background: #eff6ff; color: #2563eb; }
.tcc-docs-badge--xlsx { background: #f0fdf4; color: #16a34a; }
.tcc-docs-badge--pptx { background: #fff7ed; color: #ea580c; }
.tcc-docs-badge--txt  { background: #f8fafc; color: #64748b; }
.tcc-docs-badge--csv  { background: #ecfeff; color: #0891b2; }

/* ── Card acties ── */
.tcc-docs-card-actions { display: flex; gap: 4px; flex-shrink: 0; }

/* ── Status badges (AI docs) ── */
.tcc-docs-status {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 11px; font-weight: 500; padding: 1px 7px;
    border-radius: 5px; white-space: nowrap; flex-shrink: 0;
}
.tcc-docs-status--ok      { background: #f0fdf4; color: #16a34a; }
.tcc-docs-status--busy    { background: #faf5ff; color: #7c3aed; }
.tcc-docs-status--pending { background: #f8fafc; color: #94a3b8; }

/* ── Dropzone ── */
.doc-dropzone {
    border: 2px dashed var(--color-border-secondary, #e2e8f0);
    border-radius: 10px;
    padding: 20px 16px;
    text-align: center;
    cursor: pointer;
    transition: border-color .2s, background .2s;
    background: var(--color-background-primary, #fafaff);
}
.doc-dropzone:hover,
.doc-dropzone--actief {
    border-color: #7c3aed;
    background: #f5f3ff;
}
.doc-dropzone-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    pointer-events: none;
}
.doc-dropzone-knop {
    pointer-events: auto;
}
.doc-dropzone-tekst { line-height: 1.5; }
.doc-dropzone-hoofd {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary, #1e293b);
}
.doc-dropzone-sub {
    display: block;
    font-size: 12px;
    color: var(--color-text-secondary, #64748b);
}
.doc-dropzone-knop {
    background: none;
    border: none;
    color: #7c3aed;
    font-size: 12px;
    cursor: pointer;
    text-decoration: underline;
    padding: 0;
}
.doc-dropzone-hint {
    font-size: 11px;
    color: var(--color-text-secondary, #94a3b8);
    margin-top: 2px;
}

/* ── Spinner ── */
.tcc-spinner { border-radius: 50%; animation: tcc-spin .7s linear infinite; }
.tcc-spinner--xs {
    width: 14px; height: 14px;
    border: 2px solid #e2e8f0; border-top-color: #7c3aed;
}
@keyframes tcc-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
})();