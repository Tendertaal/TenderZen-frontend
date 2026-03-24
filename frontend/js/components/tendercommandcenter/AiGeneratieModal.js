/* ============================================
   AiGeneratieModal.js
   AI Generatie — 3-stappen modal
   VERSIE: 20260309_1530

   Stap 1: Document selectie (brondocumenten)
   Stap 2: Model selectie (Haiku / Sonnet / Opus)
   Stap 3a: Genereren (loading)
   Stap 3b: Preview & Akkoord

   Gebruik:
     openAiGeneratieModal({
       docType,
       tenderId,
       brondocumenten,   // array van { id, naam, type, grootte, paginas, bron }
       onGenerate,       // async (params: { model, brondocumentIds }) => void
     });

   Afhankelijkheden (globaal beschikbaar):
     tccIcon(name, size, color)   — uit TCC_Core.js
     escHtml(str)                 — uit TCC_Core.js
     showTccToast(msg, type)      — uit TCC_Core.js
     window.Icons                 — uit icons.js
   ============================================ */

// ============================================
// CONFIG — per document type
// ============================================

const AI_GEN_DOC_META = {
    go_no_go:             { naam: 'Go/No-Go Analyse',        model: 'opus',   iconName: 'statusGo',     iconColor: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    samenvatting:         { naam: 'Tender Samenvatting',      model: 'haiku',  iconName: 'fileText',     iconColor: '#2563eb', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)' },
    compliance_matrix:    { naam: 'Compliance Matrix',        model: 'sonnet', iconName: 'barChart',     iconColor: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
    risico_analyse:       { naam: 'Risico Analyse',           model: 'sonnet', iconName: 'warning',      iconColor: '#d97706', bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)' },
    rode_draad:           { naam: 'Rode Draad Sessie',        model: 'sonnet', iconName: 'zap',          iconColor: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
    offerte:              { naam: 'Tenderofferte',            model: 'sonnet', iconName: 'fileText',     iconColor: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    versie1_inschrijving: { naam: 'Versie 1 Inschrijving',   model: 'sonnet', iconName: 'edit',         iconColor: '#7c3aed', bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)' },
    win_check:            { naam: 'Check op Win Succes',      model: 'opus',   iconName: 'checkCircle',  iconColor: '#16a34a', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' },
    nvi_vragen:           { naam: 'NvI Vragenlijst',          model: 'haiku',  iconName: 'clipboardList',iconColor: '#2563eb', bg: 'linear-gradient(135deg,#eff6ff,#dbeafe)' },
    pva_skelet:           { naam: 'Plan van Aanpak Skelet',   model: 'sonnet', iconName: 'fileText',     iconColor: '#4338ca', bg: 'linear-gradient(135deg,#eef2ff,#e0e7ff)' },
    planning_extractor:   { naam: 'Planning Extractor',       model: 'haiku',  iconName: 'calendarView', iconColor: '#6366f1', bg: 'linear-gradient(135deg,#eef2ff,#e0e7ff)' },
    checklist_extractor:  { naam: 'Checklist Extractor',      model: 'haiku',  iconName: 'clipboardList',iconColor: '#0284c7', bg: 'linear-gradient(135deg,#f0f9ff,#e0f2fe)' },
};

const AI_GEN_MODELS = [
    {
        key:         'haiku',
        apiId:       'claude-haiku-4-5-20251001',
        naam:        'Claude Haiku 4.5',
        badge:       'Snel & Economisch',
        badgeKlasse: 'ai-gen-badge--fast',
        tagline:     'Gestructureerde extractie · Laagste kosten',
        beschrijving:'Meest efficiënte model. Uitstekend voor het extraheren van gestructureerde data uit documenten: checklists, tijdlijnen en basisgegevens. Minder geschikt voor langere narratieve teksten.',
        kosten:      '~€ 0,01–0,05',
        gebruikVoor: ['Checklist Extractor', 'Planning Extractor', 'Tender Samenvatting', 'NvI Vragenlijst'],
    },
    {
        key:         'sonnet',
        apiId:       'claude-sonnet-4-6',
        naam:        'Claude Sonnet 4.6',
        badge:       'Aanbevolen',
        badgeKlasse: 'ai-gen-badge--recommended',
        tagline:     'Optimale balans kwaliteit & kosten',
        beschrijving:'Optimale balans tussen kwaliteit en kosten. Geschikt voor vrijwel alle document types. Genereert vloeiende, professionele teksten én kan goed structureren.',
        kosten:      '~€ 0,10–0,40',
        gebruikVoor: ['Rode Draad Sessie', 'Tenderofferte', 'Versie 1 Inschrijving', 'Compliance Matrix'],
    },
    {
        key:         'opus',
        apiId:       'claude-opus-4-6',
        naam:        'Claude Opus 4.6',
        badge:       'Maximale Kwaliteit',
        badgeKlasse: 'ai-gen-badge--power',
        tagline:     'Zwaarste model · Hoogste precisie',
        beschrijving:'Zwaarste model. Beste resultaten voor complexe redenering, nuancering en lange documenten. Bewust inzetten voor documenten waar kwaliteit het meest telt.',
        kosten:      '~€ 0,50–2,00',
        gebruikVoor: ['Go/No-Go Analyse', 'Check op Win Succes', 'Risico Analyse'],
    },
];

// ============================================
// STATE
// ============================================

let _agmState = null;  // actieve modal state

// ============================================
// PUBLIC — open modal
// ============================================

function openAiGeneratieModal({ docType, tenderId, brondocumenten = [], onGenerate, onAkkoord }) {
    _agmClose(true);

    const meta         = AI_GEN_DOC_META[docType] || { naam: docType, model: 'sonnet', iconName: 'fileText', iconColor: '#4338ca', bg: '#eef2ff' };
    const defaultModel = meta.model || 'sonnet';

    _agmState = {
        docType,
        tenderId,
        brondocumenten: [],          // wordt gevuld na API call
        onGenerate,
        onAkkoord,
        meta,
        stap:              1,
        gekozenModel:      defaultModel,
        geselecteerdeDocs: [],
        genTimer:          null,
        _docsGeladen:      false,
    };

    _agmInjectStyles();
    _agmRender();
    _agmSetStap(1);   // toont laad-skeleton in panel 1

    // Open met animatie
    requestAnimationFrame(() => {
        const overlay = document.getElementById('ai-gen-overlay');
        if (overlay) overlay.classList.add('ai-gen-is-open');
    });

    // Haal documenten op — vul panel 1 zodra klaar
    _agmLaadDocumenten(tenderId, brondocumenten);
}

// Laad brondocumenten: eerst de doorgegeven lijst gebruiken, daarna live via API bijwerken
async function _agmLaadDocumenten(tenderId, initialDocs) {
    // Stap 1: toon meteen wat we al hebben uit tccState (snelle eerste render)
    if (initialDocs.length > 0) {
        _agmState.brondocumenten   = initialDocs;
        _agmState.geselecteerdeDocs = initialDocs
            .filter(d => d.bron === 'smart_import')
            .map(d => d.id);
        _agmHerlaadPanel1();
    }

    // Stap 2: haal verse lijst op via dezelfde endpoint als TCC_TabDocs
    try {
        const result = await tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/documents`);
        const docs   = result?.documents || result?.data || result || [];
        const gemap  = docs.map(d => ({
            id:      d.id || '',
            naam:    d.original_file_name || d.file_name || d.bestandsnaam || 'Document',
            type:    (d.original_file_name || d.file_name || '').split('.').pop()?.toLowerCase() || 'pdf',
            grootte: d.file_size || d.bestandsgrootte || 0,
            paginas: d.paginas || d.page_count || null,
            bron:    (d.document_type === 'smart_import' || d.source === 'smart_import' || d.bron === 'smart_import') ? 'smart_import' : 'handmatig',
        }));

        if (gemap.length > 0) {
            _agmState.brondocumenten   = gemap;
            // Behoud huidige selectie + voeg smart_import toe die er nog niet in zaten
            const extraIds = gemap
                .filter(d => d.bron === 'smart_import' && !_agmState.geselecteerdeDocs.includes(d.id))
                .map(d => d.id);
            _agmState.geselecteerdeDocs.push(...extraIds);
            _agmState._docsGeladen = true;
            _agmHerlaadPanel1();
        }
    } catch (e) {
        console.warn('[AiGeneratieModal] Documenten ophalen mislukt:', e);
        // Geen probleem — we tonen wat we al hadden
    }
}

// Herrender panel 1 in-place (zonder stap te wisselen)
function _agmHerlaadPanel1() {
    if (_agmState.stap !== 1) return;
    const body = document.getElementById('ai-gen-body');
    if (!body) return;
    body.innerHTML = _agmPanel1();
    _agmBindPanel1();
    _agmUpdateFooter();
}

// ============================================
// RENDER — overlay + modal structuur
// ============================================

function _agmRender() {
    const { meta, docType } = _agmState;

    const iconSvg = window.Icons?.[meta.iconName]
        ? window.Icons[meta.iconName]({ size: 20, color: meta.iconColor })
        : tccIcon(meta.iconName, 20, meta.iconColor);

    const isRodeDraad = docType === 'rode_draad';

    const html = `
    <div id="ai-gen-overlay" class="ai-gen-overlay">
        <div id="ai-gen-modal" class="ai-gen-modal" role="dialog" aria-modal="true">

            <!-- Header -->
            <div class="ai-gen-header">
                <div class="ai-gen-header-top">
                    <div class="ai-gen-doc-badge">
                        <div class="ai-gen-doc-icon" style="background:${meta.bg}">${iconSvg}</div>
                        <div>
                            <div class="ai-gen-doc-naam">${escHtml(meta.naam)}</div>
                            <div class="ai-gen-doc-sub">AI Document Generatie</div>
                        </div>
                    </div>
                    <button class="ai-gen-sluit" id="ai-gen-sluit-btn" aria-label="Sluiten">
                        ${tccIcon('close', 14)}
                    </button>
                </div>

                <!-- Stap indicator -->
                <div class="ai-gen-stap-indicator">
                    <div class="ai-gen-stap-item">
                        <div class="ai-gen-stap-dot" id="ai-gen-dot-1">1</div>
                        <span class="ai-gen-stap-label" id="ai-gen-label-1">Documenten</span>
                    </div>
                    <div class="ai-gen-connector" id="ai-gen-conn-1"></div>
                    <div class="ai-gen-stap-item">
                        <div class="ai-gen-stap-dot" id="ai-gen-dot-2">2</div>
                        <span class="ai-gen-stap-label" id="ai-gen-label-2">Model</span>
                    </div>
                    <div class="ai-gen-connector" id="ai-gen-conn-2"></div>
                    <div class="ai-gen-stap-item">
                        <div class="ai-gen-stap-dot" id="ai-gen-dot-3">3</div>
                        <span class="ai-gen-stap-label" id="ai-gen-label-3">Genereer & Review</span>
                    </div>
                </div>
            </div>

            <!-- Body (panels worden hier ingeladen) -->
            <div class="ai-gen-body" id="ai-gen-body"></div>

            <!-- Footer -->
            <div class="ai-gen-footer">
                <div class="ai-gen-footer-links" id="ai-gen-footer-links">
                    <span class="ai-gen-kosten-badge" id="ai-gen-kosten-badge">
                        ${tccIcon('info', 12, '#64748b')}
                        Schatting: <strong id="ai-gen-kosten-waarde">~€ 0,10–0,40</strong>
                    </span>
                </div>
                <div class="ai-gen-footer-rechts" id="ai-gen-footer-rechts">
                    <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="ai-gen-btn-annuleer">
                        Annuleren
                    </button>
                    <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="ai-gen-btn-terug" style="display:none">
                        ${tccIcon('chevronLeft', 13)} Terug
                    </button>
                    <button class="tcc-btn tcc-btn--primary tcc-btn--sm" id="ai-gen-btn-volgende">
                        Volgende ${tccIcon('chevronRight', 13, '#ffffff')}
                    </button>
                </div>
            </div>

        </div>
    </div>`;

    // Injecteer in #tcc-panel als dat bestaat, anders in body
    const container = document.getElementById('tcc-panel') || document.body;
    const existing  = document.getElementById('ai-gen-overlay');
    if (existing) existing.remove();

    container.insertAdjacentHTML('beforeend', html);

    // Events binden
    document.getElementById('ai-gen-sluit-btn')
        ?.addEventListener('click', () => _agmClose());
    document.getElementById('ai-gen-btn-annuleer')
        ?.addEventListener('click', () => _agmClose());
    document.getElementById('ai-gen-btn-terug')
        ?.addEventListener('click', _agmTerug);
    document.getElementById('ai-gen-btn-volgende')
        ?.addEventListener('click', _agmVolgende);
    document.getElementById('ai-gen-overlay')
        ?.addEventListener('click', (e) => {
            if (e.target.id === 'ai-gen-overlay') _agmClose();
        });

    document.addEventListener('keydown', _agmKeydown);
}

// ============================================
// STAP NAVIGATIE
// ============================================

function _agmSetStap(stap) {
    _agmState.stap = stap;
    _agmRenderBody();
    _agmUpdateIndicator();
    _agmUpdateFooter();
}

function _agmVolgende() {
    const { stap } = _agmState;
    if (stap === 1)    _agmSetStap(2);
    else if (stap === 2) _agmStartGenereren();
    else if (stap === '3b') _agmGeefAkkoord();
}

function _agmTerug() {
    const { stap } = _agmState;
    if (stap === 2)    _agmSetStap(1);
    else if (stap === '3b') _agmSetStap(2);
}

// ============================================
// AKKOORD HANDLER
// ============================================

async function _agmGeefAkkoord() {
    const documentId = _agmState._documentId;
    const onAkkoord  = _agmState.onAkkoord;

    // Sluit de modal altijd eerst
    _agmClose();

    if (onAkkoord && documentId) {
        try {
            await onAkkoord(documentId);
        } catch (err) {
            console.error('[AiGeneratieModal] onAkkoord callback mislukt:', err);
        }
    }
}

// ============================================
// BODY PANELS
// ============================================

function _agmRenderBody() {
    const body = document.getElementById('ai-gen-body');
    if (!body) return;

    const { stap } = _agmState;

    if (stap === 1)    body.innerHTML = _agmPanel1();
    else if (stap === 2)   body.innerHTML = _agmPanel2();
    else if (stap === '3a') body.innerHTML = _agmPanel3a();
    else if (stap === '3b') body.innerHTML = _agmPanel3b();

    // Events per panel
    if (stap === 1)    _agmBindPanel1();
    else if (stap === 2)   _agmBindPanel2();
}

// ── Panel 1: Document selectie ────────────────

function _agmPanel1() {
    const { brondocumenten, geselecteerdeDocs, _docsGeladen } = _agmState;

    // Skeleton terwijl docs nog laden
    if (brondocumenten.length === 0 && !_docsGeladen) {
        return `
        <div class="ai-gen-panel" id="ai-gen-panel-1">
            <div class="ai-gen-panel-titel">Selecteer brondocumenten</div>
            <div class="ai-gen-panel-tekst">Kies welke aanbestedingsstukken de AI mag gebruiken. Smart Import documenten zijn standaard geselecteerd.</div>
            <div class="ai-gen-docs-laden">
                <div class="tcc-spinner tcc-spinner--xs"></div>
                <span>Documenten ophalen…</span>
            </div>
        </div>`;
    }

    const smartImport = brondocumenten.filter(d => d.bron === 'smart_import');
    const handmatig   = brondocumenten.filter(d => d.bron !== 'smart_import');

    const renderDoc = (d) => {
        const isChecked  = geselecteerdeDocs.includes(d.id);
        const ext        = d.type?.toLowerCase() || 'pdf';
        const typeKlasse = ['docx', 'doc'].includes(ext) ? 'docx' : ext === 'xlsx' || ext === 'xls' ? 'xlsx' : 'pdf';
        const typeLabel  = ext.toUpperCase().slice(0, 4);
        const grootteStr = d.grootte > 0 ? _agmFormatFileSize(d.grootte) : '';
        const metaTxt    = [grootteStr, d.paginas ? `${d.paginas} pag.` : ''].filter(Boolean).join(' · ');
        const checkHtml  = isChecked
            ? (window.Icons?.check ? window.Icons.check({ size: 10, color: 'white' }) : '✓')
            : '';
        return `
        <div class="ai-gen-doc-item${isChecked ? ' is-checked' : ''}" data-doc-id="${escHtml(d.id)}">
            <div class="ai-gen-doc-checkbox">${checkHtml}</div>
            <div class="ai-gen-doc-type-badge ai-gen-doc-type--${typeKlasse}">${typeLabel}</div>
            <div class="ai-gen-doc-info">
                <div class="ai-gen-doc-naam-tekst" title="${escHtml(d.naam)}">${escHtml(d.naam)}</div>
                ${metaTxt ? `<div class="ai-gen-doc-meta">${metaTxt}</div>` : ''}
            </div>
        </div>`;
    };

    const aantalGeselecteerd = geselecteerdeDocs.length;
    const tellerHtml = brondocumenten.length > 0
        ? `<span class="ai-gen-selectie-teller" id="ai-gen-selectie-teller">
               ${aantalGeselecteerd} van ${brondocumenten.length} geselecteerd
           </span>`
        : '';

    const smartHtml = smartImport.length
        ? `<div class="ai-gen-sectie-label">
               ${tccIcon('zap', 11, '#7c3aed')} Smart Import — standaard geselecteerd
           </div>
           <div class="ai-gen-doc-lijst">${smartImport.map(renderDoc).join('')}</div>`
        : '';

    const handmatigHtml = handmatig.length
        ? `<div class="ai-gen-sectie-label" style="margin-top:14px">
               ${tccIcon('fileText', 11, '#64748b')} Eerder geüpload
           </div>
           <div class="ai-gen-doc-lijst">${handmatig.map(renderDoc).join('')}</div>`
        : '';

    const leegHtml = brondocumenten.length === 0
        ? `<div class="ai-gen-leeg-state">
               ${tccIcon('folderOpen', 28, '#cbd5e1')}
               <div class="ai-gen-leeg-titel">Geen documenten gevonden</div>
               <div class="ai-gen-leeg-tekst">Upload aanbestedingsstukken via de knop hieronder of via de Documenten tab.</div>
           </div>`
        : '';

    return `
    <div class="ai-gen-panel" id="ai-gen-panel-1">
        <div class="ai-gen-panel-header-rij">
            <div>
                <div class="ai-gen-panel-titel">Selecteer brondocumenten</div>
                <div class="ai-gen-panel-tekst">Kies welke aanbestedingsstukken de AI mag gebruiken.</div>
            </div>
            ${tellerHtml}
        </div>
        ${smartHtml}${handmatigHtml}${leegHtml}
        <div class="ai-gen-upload-zone" id="ai-gen-upload-zone">
            <input type="file" id="ai-gen-file-input" accept=".pdf,.docx,.doc,.xlsx,.xls" style="display:none;" multiple />
            ${tccIcon('upload', 20, '#a5b4fc')}
            <div class="ai-gen-upload-titel">Aanvullend document toevoegen</div>
            <div class="ai-gen-upload-tekst">Sleep een bestand hierheen of klik · PDF, DOCX, XLSX · max 25 MB</div>
        </div>
    </div>`;
}

// Bestandsgrootte formatteren (identiek aan TCC_TabDocs)
function _agmFormatFileSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function _agmBindPanel1() {
    // ── Checkbox toggle per document ──
    document.querySelectorAll('.ai-gen-doc-item').forEach(el => {
        el.addEventListener('click', () => {
            const docId = el.dataset.docId;
            if (!docId) return;
            const idx = _agmState.geselecteerdeDocs.indexOf(docId);
            if (idx >= 0) {
                _agmState.geselecteerdeDocs.splice(idx, 1);
                el.classList.remove('is-checked');
                el.querySelector('.ai-gen-doc-checkbox').innerHTML = '';
            } else {
                _agmState.geselecteerdeDocs.push(docId);
                el.classList.add('is-checked');
                el.querySelector('.ai-gen-doc-checkbox').innerHTML = window.Icons?.check
                    ? window.Icons.check({ size: 10, color: 'white' }) : '✓';
            }
            _agmUpdateSelectieTeller();
            const btn = document.getElementById('ai-gen-btn-volgende');
            if (btn) btn.disabled = _agmState.geselecteerdeDocs.length === 0 && _agmState.brondocumenten.length > 0;
        });
    });

    // ── Upload zone — klik opent file picker ──
    const uploadZone  = document.getElementById('ai-gen-upload-zone');
    const fileInput   = document.getElementById('ai-gen-file-input');

    uploadZone?.addEventListener('click', (e) => {
        if (e.target.closest('#ai-gen-file-input')) return;
        fileInput?.click();
    });

    // ── Drag & drop ──
    uploadZone?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('is-dragover');
    });
    uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('is-dragover'));
    uploadZone?.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadZone.classList.remove('is-dragover');
        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length) await _agmUploadBestanden(files);
    });

    // ── File input change ──
    fileInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) await _agmUploadBestanden(files);
        fileInput.value = '';
    });

    // ── Initieel: volgende uitschakelen als er docs zijn maar niets geselecteerd ──
    const btn = document.getElementById('ai-gen-btn-volgende');
    if (btn) btn.disabled = _agmState.geselecteerdeDocs.length === 0 && _agmState.brondocumenten.length > 0;
}

// Update de selectie-teller tekst
function _agmUpdateSelectieTeller() {
    const teller = document.getElementById('ai-gen-selectie-teller');
    if (!teller) return;
    const n = _agmState.geselecteerdeDocs.length;
    const t = _agmState.brondocumenten.length;
    teller.textContent = `${n} van ${t} geselecteerd`;
    teller.className   = 'ai-gen-selectie-teller' + (n === 0 ? ' is-nul' : '');
}

// Upload bestanden via dezelfde endpoint als TCC_TabDocs
async function _agmUploadBestanden(files) {
    const MAX_MB = 25;
    const uploadZone = document.getElementById('ai-gen-upload-zone');

    for (const file of files) {
        if (file.size > MAX_MB * 1024 * 1024) {
            showTccToast(`${file.name} is te groot (max ${MAX_MB} MB)`, 'error');
            continue;
        }

        // Toon uploading-indicator in de zone
        if (uploadZone) {
            uploadZone.classList.add('is-uploading');
            uploadZone.querySelector('.ai-gen-upload-titel').textContent = `${file.name} uploaden…`;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('document_type', 'aanbesteding');

            const result = await tccApiCallRaw(
                `/api/v1/ai-documents/tenders/${_agmState.tenderId}/documents/upload`,
                { method: 'POST', body: formData }
            );

            const nieuwDoc = result.document || result.data || result;

            // Voeg toe aan tccState zodat Documenten tab ook ververst
            if (tccState?.data?.documenten) {
                tccState.data.documenten.unshift(nieuwDoc);
                _updateDocsBadge?.();
            }

            // Voeg toe aan modal state
            const gemapt = {
                id:      nieuwDoc.id || '',
                naam:    nieuwDoc.original_file_name || nieuwDoc.file_name || file.name,
                type:    (nieuwDoc.original_file_name || file.name).split('.').pop()?.toLowerCase() || 'pdf',
                grootte: nieuwDoc.file_size || file.size || 0,
                paginas: null,
                bron:    'handmatig',
            };
            _agmState.brondocumenten.push(gemapt);
            _agmState.geselecteerdeDocs.push(gemapt.id);

            showTccToast(`${file.name} geüpload`, 'success');

        } catch (e) {
            showTccToast(`Upload mislukt: ${e.message}`, 'error');
        } finally {
            if (uploadZone) {
                uploadZone.classList.remove('is-uploading');
                uploadZone.querySelector('.ai-gen-upload-titel').textContent = 'Aanvullend document toevoegen';
            }
        }
    }

    // Herrender panel zodat nieuwe doc zichtbaar is
    _agmHerlaadPanel1();
}

// ── Panel 2: Model selectie ──────────────────

function _agmPanel2() {
    const gekozen = _agmState.gekozenModel;

    const renderModel = (m) => {
        const isSelected = m.key === gekozen;
        const radioHtml  = isSelected
            ? `<div class="ai-gen-radio is-geselecteerd"><div class="ai-gen-radio-dot"></div></div>`
            : `<div class="ai-gen-radio"><div class="ai-gen-radio-dot"></div></div>`;
        const gebruikHtml = m.gebruikVoor.map(g =>
            `<span class="ai-gen-gebruik-tag">${escHtml(g)}</span>`
        ).join('');
        return `
        <div class="ai-gen-model-kaart${isSelected ? ' is-geselecteerd' : ''}" data-model-key="${m.key}">
            <div class="ai-gen-model-header">
                ${radioHtml}
                <div class="ai-gen-model-info">
                    <div class="ai-gen-model-naam-rij">
                        <span class="ai-gen-model-naam">${escHtml(m.naam)}</span>
                        <span class="ai-gen-badge ${m.badgeKlasse}">${escHtml(m.badge)}</span>
                    </div>
                    <div class="ai-gen-model-tagline">${escHtml(m.tagline)}</div>
                </div>
                <div class="ai-gen-model-kosten">
                    <div class="ai-gen-kosten-waarde">${escHtml(m.kosten)}</div>
                    <div class="ai-gen-kosten-label">per document</div>
                </div>
            </div>
            <div class="ai-gen-model-desc">${escHtml(m.beschrijving)}</div>
            <div class="ai-gen-gebruik-tags">${gebruikHtml}</div>
        </div>`;
    };

    return `
    <div class="ai-gen-panel" id="ai-gen-panel-2">
        <div class="ai-gen-panel-titel">Kies het AI-model</div>
        <div class="ai-gen-panel-tekst">Het aanbevolen model is voorgeselecteerd op basis van het document type. Je kunt altijd een ander model kiezen.</div>
        <div class="ai-gen-model-lijst">
            ${AI_GEN_MODELS.map(renderModel).join('')}
        </div>
        <div class="ai-gen-kosten-disclaimer">
            ${tccIcon('info', 12, '#d97706')}
            Bedragen zijn indicatief op basis van gemiddeld tokengebruik bij 2–3 brondocumenten van ~50 pagina's. Meer of grotere documenten verhogen de kosten proportioneel.
        </div>
    </div>`;
}

function _agmBindPanel2() {
    document.querySelectorAll('.ai-gen-model-kaart').forEach(el => {
        el.addEventListener('click', () => {
            const key = el.dataset.modelKey;
            if (!key) return;
            _agmState.gekozenModel = key;

            // Visueel updaten zonder re-render
            document.querySelectorAll('.ai-gen-model-kaart').forEach(k => {
                const isThis = k.dataset.modelKey === key;
                k.classList.toggle('is-geselecteerd', isThis);
                const radio = k.querySelector('.ai-gen-radio');
                if (radio) radio.classList.toggle('is-geselecteerd', isThis);
            });

            // Kosten in footer updaten
            const model  = AI_GEN_MODELS.find(m => m.key === key);
            const kosten = document.getElementById('ai-gen-kosten-waarde');
            if (kosten && model) kosten.textContent = model.kosten;
        });
    });
}

// ── Panel 3a: Genereren (loading) ─────────────

function _agmPanel3a() {
    const model    = AI_GEN_MODELS.find(m => m.key === _agmState.gekozenModel) || AI_GEN_MODELS[1];
    const aantalDocs = _agmState.geselecteerdeDocs.length;
    const docNaam  = _agmState.meta.naam;

    return `
    <div class="ai-gen-panel ai-gen-panel--laden" id="ai-gen-panel-3a">
        <div class="ai-gen-laden-icoon">
            ${tccIcon('zap', 28, 'white')}
        </div>
        <div class="ai-gen-laden-titel">Document wordt gegenereerd…</div>
        <div class="ai-gen-laden-sub">${escHtml(model.naam)} · ${aantalDocs} ${aantalDocs === 1 ? 'document' : 'documenten'} · ${escHtml(docNaam)}</div>
        <div class="ai-gen-stappen-lijst">
            <div class="ai-gen-gen-stap is-done" id="ai-gen-gstap-1">
                <div class="ai-gen-gen-stap-dot">${tccIcon('check', 10, 'white')}</div>
                <span>Documenten ophalen en voorbereiden</span>
            </div>
            <div class="ai-gen-gen-stap is-done" id="ai-gen-gstap-2">
                <div class="ai-gen-gen-stap-dot">${tccIcon('check', 10, 'white')}</div>
                <span>Aanbestedingsstukken analyseren</span>
            </div>
            <div class="ai-gen-gen-stap is-actief" id="ai-gen-gstap-3">
                <div class="ai-gen-gen-stap-dot ai-gen-gen-stap-dot--puls">3</div>
                <span>Document samenstellen met AI…</span>
            </div>
            <div class="ai-gen-gen-stap" id="ai-gen-gstap-4">
                <div class="ai-gen-gen-stap-dot">4</div>
                <span>Opslaan en preview voorbereiden</span>
            </div>
        </div>
    </div>`;
}

// ── Panel 3b: Preview & Akkoord ───────────────

function _agmPanel3b() {
    const model       = AI_GEN_MODELS.find(m => m.key === _agmState.gekozenModel) || AI_GEN_MODELS[1];
    const aantalDocs  = _agmState.geselecteerdeDocs.length;
    const isRodeDraad = _agmState.docType === 'rode_draad';

    // Inhoud van het gegenereerde document ophalen uit tccState
    const docs       = window.tccState?.data?.generatie?.documenten || [];
    const gegenereerd = docs.find(d => d.type === _agmState.docType);
    const inhoud     = _agmState._gegenereerdeInhoud || '';

    const previewHtml = inhoud
        ? `<div class="tcc-doc-viewer-content tcc-md-body">${_renderMarkdown(inhoud)}</div>`
        : `<div class="ai-gen-preview-leeg">
               ${tccIcon('fileText', 24, '#cbd5e1')}
               <div>Document gegenereerd — open de Bekijk knop om het te lezen.</div>
           </div>`;

    const rodeDraadWaarschuwing = isRodeDraad ? `
        <div class="ai-gen-rode-draad-warning">
            ${tccIcon('warning', 14, '#d97706')}
            <span><strong>Rode Draad Sessie goedkeuren?</strong> Na akkoord worden Tenderplanning, Projectplanning, Checklist en Team automatisch bijgewerkt met de geëxtraheerde data. Je kunt per onderdeel kiezen wat je overneemt.</span>
        </div>` : '';

    return `
    <div class="ai-gen-panel" id="ai-gen-panel-3b">
        <div class="ai-gen-preview-header">
            <div class="ai-gen-panel-titel" style="margin-bottom:0">Gegenereerd document</div>
            <div class="ai-gen-preview-meta">
                <span class="ai-gen-preview-tag ai-gen-preview-tag--model">${escHtml(model.naam.replace('Claude ',''))}</span>
                <span class="ai-gen-preview-tag ai-gen-preview-tag--docs">${aantalDocs} docs</span>
            </div>
        </div>
        <div class="ai-gen-preview-content">
            ${previewHtml}
        </div>
        ${rodeDraadWaarschuwing}
    </div>`;
}

// ============================================
// GENEREER — API aanroep + stap animatie
// ============================================

async function _agmStartGenereren() {
    // Toon laad-panel
    _agmState.stap = '3a';
    _agmRenderBody();
    _agmUpdateIndicator();
    _agmUpdateFooter();

    // Simuleer stap-animatie (stap 3 → 4) terwijl API call loopt
    const stap3 = () => {
        const el3 = document.getElementById('ai-gen-gstap-3');
        const el4 = document.getElementById('ai-gen-gstap-4');
        if (el3) { el3.className = 'ai-gen-gen-stap is-done'; el3.querySelector('.ai-gen-gen-stap-dot').innerHTML = tccIcon('check', 10, 'white'); }
        if (el4) { el4.className = 'ai-gen-gen-stap is-actief'; el4.querySelector('.ai-gen-gen-stap-dot').classList.add('ai-gen-gen-stap-dot--puls'); }
    };

    const animTimer = setTimeout(stap3, 1800);

    try {
        const model  = AI_GEN_MODELS.find(m => m.key === _agmState.gekozenModel);
        await _agmState.onGenerate({
            model:            model?.apiId || 'claude-sonnet-4-6',
            brondocumentIds:  _agmState.geselecteerdeDocs,
        });

        clearTimeout(animTimer);

        // Stap 4 afvinken
        const el3 = document.getElementById('ai-gen-gstap-3');
        const el4 = document.getElementById('ai-gen-gstap-4');
        if (el3) { el3.className = 'ai-gen-gen-stap is-done'; el3.querySelector('.ai-gen-gen-stap-dot').innerHTML = tccIcon('check', 10, 'white'); }
        if (el4) { el4.className = 'ai-gen-gen-stap is-done'; el4.querySelector('.ai-gen-gen-stap-dot').innerHTML = tccIcon('check', 10, 'white'); }

        // Laad inhoud voor preview
        await _agmLaadInhoud();

        // Toon preview na korte delay (visuele bevrediging)
        setTimeout(() => _agmSetStap('3b'), 600);

    } catch (err) {
        clearTimeout(animTimer);
        console.error('[AiGeneratieModal] Genereren mislukt:', err);
        showTccToast(`Genereren mislukt: ${err.message}`, 'error');
        // Terug naar stap 2
        _agmSetStap(2);
    }
}

// Haal de inhoud van het net gegenereerde document op
async function _agmLaadInhoud() {
    try {
        const { tenderId, docType } = _agmState;
        const result  = await tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/ai-documents`);
        const fullDoc = (result?.documents || []).find(d => d.template_key === docType);
        _agmState._gegenereerdeInhoud = fullDoc?.document_content || '';
        _agmState._documentId         = fullDoc?.id || null;
    } catch (e) {
        _agmState._gegenereerdeInhoud = '';
    }
}

// ============================================
// FOOTER & INDICATOR UPDATE
// ============================================

function _agmUpdateFooter() {
    const { stap, gekozenModel, geselecteerdeDocs, docType } = _agmState;

    const btnAnnuleer = document.getElementById('ai-gen-btn-annuleer');
    const btnTerug    = document.getElementById('ai-gen-btn-terug');
    const btnVolgende = document.getElementById('ai-gen-btn-volgende');
    const footerLinks = document.getElementById('ai-gen-footer-links');
    const kosten      = document.getElementById('ai-gen-kosten-waarde');

    if (!btnVolgende) return;

    // Reset
    btnAnnuleer.style.display = '';
    btnTerug.style.display    = 'none';
    btnVolgende.style.display = '';
    btnVolgende.disabled      = false;
    btnVolgende.className     = 'tcc-btn tcc-btn--primary tcc-btn--sm';

    const model = AI_GEN_MODELS.find(m => m.key === gekozenModel) || AI_GEN_MODELS[1];
    if (kosten) kosten.textContent = model.kosten;

    if (stap === 1) {
        btnVolgende.innerHTML  = `Volgende ${tccIcon('chevronRight', 13, '#ffffff')}`;
        btnVolgende.disabled   = geselecteerdeDocs.length === 0;
        if (footerLinks) footerLinks.style.display = '';

    } else if (stap === 2) {
        btnTerug.style.display = '';
        btnVolgende.innerHTML  = `${tccIcon('zap', 13, '#ffffff')} Genereer document`;
        if (footerLinks) footerLinks.style.display = '';

    } else if (stap === '3a') {
        btnAnnuleer.style.display = 'none';
        btnVolgende.style.display = 'none';
        if (footerLinks) footerLinks.style.display = 'none';

    } else if (stap === '3b') {
        btnTerug.style.display = '';
        btnTerug.innerHTML     = `${tccIcon('refresh', 13)} Opnieuw genereren`;
        btnTerug.onclick       = () => _agmSetStap(2);

        const isRodeDraad      = docType === 'rode_draad';
        btnVolgende.className  = 'tcc-btn tcc-btn--sm';
        btnVolgende.style.background = 'linear-gradient(135deg, #22c55e, #16a34a)';
        btnVolgende.style.color      = 'white';
        btnVolgende.style.boxShadow  = '0 2px 8px rgba(34,197,94,0.3)';
        btnVolgende.innerHTML  = isRodeDraad
            ? `${tccIcon('checkCircle', 13, '#ffffff')} Akkoord & Importeer`
            : `${tccIcon('checkCircle', 13, '#ffffff')} Akkoord`;
        if (footerLinks) footerLinks.style.display = 'none';
    }
}

function _agmUpdateIndicator() {
    const { stap } = _agmState;
    const stapNr   = stap === '3a' || stap === '3b' ? 3 : stap;

    for (let s = 1; s <= 3; s++) {
        const dot   = document.getElementById(`ai-gen-dot-${s}`);
        const label = document.getElementById(`ai-gen-label-${s}`);
        const conn  = document.getElementById(`ai-gen-conn-${s}`);

        if (!dot) continue;

        const isDone   = s < stapNr;
        const isActief = s === stapNr;

        dot.className  = `ai-gen-stap-dot${isDone ? ' is-done' : isActief ? ' is-actief' : ''}`;
        dot.innerHTML  = isDone
            ? (window.Icons?.check ? window.Icons.check({ size: 10, color: 'white' }) : '✓')
            : String(s);

        if (label) label.className = `ai-gen-stap-label${isActief ? ' is-actief' : isDone ? ' is-done' : ''}`;
        if (conn)  conn.className  = `ai-gen-connector${isDone ? ' is-done' : ''}`;
    }
}

// ============================================
// SLUITEN
// ============================================

function _agmClose(direct = false) {
    if (_agmState?.genTimer) clearTimeout(_agmState.genTimer);
    document.removeEventListener('keydown', _agmKeydown);

    const overlay = document.getElementById('ai-gen-overlay');
    if (!overlay) return;

    if (direct) {
        overlay.remove();
    } else {
        overlay.classList.remove('ai-gen-is-open');
        setTimeout(() => overlay.remove(), 280);
    }
    _agmState = null;
}

function _agmKeydown(e) {
    if (e.key === 'Escape') _agmClose();
}

// ============================================
// CSS — injecteer eenmalig
// ============================================

function _agmInjectStyles() {
    if (document.getElementById('ai-gen-modal-styles')) return;

    const css = `
/* ── AI Generatie Modal ── */

/* ── OVERLAY: vult het volledige TCC panel ── */
#ai-gen-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.0);
    z-index: 200;
    display: flex;
    align-items: stretch;
    justify-content: stretch;
    padding: 0;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
}
#ai-gen-overlay.ai-gen-is-open {
    opacity: 1;
    pointer-events: all;
}

/* ── MODAL: vult overlay volledig ── */
.ai-gen-modal {
    background: #ffffff;
    border-radius: 0;
    box-shadow: none;
    width: 100%;
    max-width: 100%;
    height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
    overflow: hidden;
}
#ai-gen-overlay.ai-gen-is-open .ai-gen-modal {
    transform: translateX(0);
}

/* ── HEADER ── */
.ai-gen-header {
    padding: 20px 32px 0;
    flex-shrink: 0;
    background: #fff;
    border-bottom: 1px solid #f1f5f9;
}
.ai-gen-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 18px;
}
.ai-gen-doc-badge {
    display: flex;
    align-items: center;
    gap: 12px;
}
.ai-gen-doc-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.ai-gen-doc-naam {
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.3;
}
.ai-gen-doc-sub {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 1px;
}
.ai-gen-sluit {
    width: 32px;
    height: 32px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    transition: all 0.15s;
    flex-shrink: 0;
}
.ai-gen-sluit:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
}

/* ── STAP INDICATOR ── */
.ai-gen-stap-indicator {
    display: flex;
    align-items: center;
    padding-bottom: 18px;
    border-bottom: 1px solid #f1f5f9;
}
.ai-gen-stap-item {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
}
.ai-gen-stap-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
    background: #f1f5f9;
    color: #94a3b8;
    border: 2px solid #e2e8f0;
    transition: all 0.25s;
}
.ai-gen-stap-dot.is-actief {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border-color: transparent;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
}
.ai-gen-stap-dot.is-done {
    background: #22c55e;
    color: white;
    border-color: transparent;
}
.ai-gen-stap-label {
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.25s;
}
.ai-gen-stap-label.is-actief { color: #4f46e5; }
.ai-gen-stap-label.is-done   { color: #16a34a; }
.ai-gen-connector {
    flex: 1;
    height: 2px;
    background: #e2e8f0;
    margin: 0 8px;
    transition: background 0.25s;
    flex-shrink: 0;
    min-width: 20px;
}
.ai-gen-connector.is-done { background: #22c55e; }

/* ── BODY: scrollbaar, gecentreerde content ── */
.ai-gen-body {
    flex: 1;
    overflow-y: auto;
    padding: 0 32px;
    display: flex;
    flex-direction: column;
    min-height: 0;
}
.ai-gen-body::-webkit-scrollbar { width: 5px; }
.ai-gen-body::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }

/* Gewone panels: gecentreerd met max breedte voor leesbaarheid */
.ai-gen-body > .ai-gen-panel {
    flex-shrink: 0;
}
/* Preview panel: vult beschikbare hoogte */
.ai-gen-body > #ai-gen-panel-3b {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
}

/* ── PANEL: gecentreerd ── */
.ai-gen-panel {
    padding: 28px 0 28px;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
}

/* ── PANEL TEKSTEN ── */
.ai-gen-panel-titel {
    font-size: 18px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 6px;
}
.ai-gen-panel-tekst {
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 20px;
}

/* ── SECTIE LABELS ── */
.ai-gen-sectie-label {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
}

/* ── DOCUMENT ITEMS ── */
.ai-gen-doc-lijst { display: flex; flex-direction: column; gap: 8px; }
.ai-gen-doc-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    background: white;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
}
.ai-gen-doc-item:hover  { border-color: #a5b4fc; background: #eef2ff; }
.ai-gen-doc-item.is-checked { border-color: #818cf8; background: #eef2ff; }
.ai-gen-doc-checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid #cbd5e1;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
}
.ai-gen-doc-item.is-checked .ai-gen-doc-checkbox {
    background: #6366f1;
    border-color: #6366f1;
}
.ai-gen-doc-type-badge {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    flex-shrink: 0;
}
.ai-gen-doc-type--pdf  { background: #fef2f2; color: #dc2626; }
.ai-gen-doc-type--docx { background: #eef2ff; color: #4338ca; }
.ai-gen-doc-type--xlsx { background: #f0fdf4; color: #16a34a; }
.ai-gen-doc-info { flex: 1; min-width: 0; }
.ai-gen-doc-naam-tekst {
    font-size: 14px;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.ai-gen-doc-meta {
    font-size: 12px;
    color: #94a3b8;
    margin-top: 2px;
}

/* ── UPLOAD ZONE ── */
.ai-gen-upload-zone {
    border: 2px dashed #a5b4fc;
    border-radius: 12px;
    padding: 24px;
    text-align: center;
    background: linear-gradient(135deg, #fafaff, #f5f3ff);
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}
.ai-gen-upload-zone:hover { border-color: #6366f1; background: #eef2ff; }
.ai-gen-upload-titel { font-size: 14px; font-weight: 600; color: #475569; }
.ai-gen-upload-tekst { font-size: 13px; color: #94a3b8; }

/* ── LEEG STATE ── */
.ai-gen-leeg-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 40px 16px;
    text-align: center;
}
.ai-gen-leeg-titel { font-size: 15px; font-weight: 600; color: #475569; }
.ai-gen-leeg-tekst { font-size: 13px; color: #94a3b8; line-height: 1.6; max-width: 380px; }

/* ── MODEL KAARTEN ── */
.ai-gen-model-lijst { display: flex; flex-direction: column; gap: 10px; }
.ai-gen-model-kaart {
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px 22px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
}
.ai-gen-model-kaart:hover { border-color: #a5b4fc; box-shadow: 0 2px 10px rgba(99,102,241,0.08); }
.ai-gen-model-kaart.is-geselecteerd {
    border-color: #6366f1;
    background: #eef2ff;
    box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
}
.ai-gen-model-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
}
.ai-gen-radio {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 3px;
    transition: all 0.15s;
}
.ai-gen-radio.is-geselecteerd { border-color: #6366f1; background: #6366f1; }
.ai-gen-radio-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: white;
    opacity: 0;
    transition: opacity 0.15s;
}
.ai-gen-radio.is-geselecteerd .ai-gen-radio-dot { opacity: 1; }
.ai-gen-model-info { flex: 1; }
.ai-gen-model-naam-rij {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 3px;
}
.ai-gen-model-naam    { font-size: 15px; font-weight: 700; color: #0f172a; }
.ai-gen-model-tagline { font-size: 13px; color: #64748b; }
.ai-gen-model-kosten  { flex-shrink: 0; text-align: right; }
.ai-gen-kosten-waarde { font-size: 14px; font-weight: 700; color: #1e293b; }
.ai-gen-kosten-label  { font-size: 11px; color: #94a3b8; }
.ai-gen-model-desc {
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
    margin-bottom: 10px;
}
.ai-gen-gebruik-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.ai-gen-gebruik-tag {
    font-size: 11px;
    font-weight: 500;
    padding: 3px 9px;
    border-radius: 5px;
    background: #f1f5f9;
    color: #475569;
}
.ai-gen-model-kaart.is-geselecteerd .ai-gen-gebruik-tag {
    background: rgba(99,102,241,0.1);
    color: #4338ca;
}

/* ── BADGES ── */
.ai-gen-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
}
.ai-gen-badge--fast        { background: #e0f2fe; color: #0369a1; }
.ai-gen-badge--recommended { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.ai-gen-badge--power       { background: #fdf4ff; color: #7e22ce; }

/* ── KOSTEN DISCLAIMER ── */
.ai-gen-kosten-disclaimer {
    margin-top: 14px;
    padding: 12px 16px;
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 10px;
    font-size: 13px;
    color: #78350f;
    line-height: 1.5;
    display: flex;
    gap: 8px;
    align-items: flex-start;
}

/* ── LADEN PANEL: volledig gecentreerd ── */
.ai-gen-panel--laden {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 60px 0 40px;
    max-width: 860px;
    width: 100%;
    margin: 0 auto;
}
.ai-gen-laden-icoon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 0 14px rgba(99,102,241,0.1);
    animation: ai-gen-pulse 2s ease-in-out infinite;
}
@keyframes ai-gen-pulse {
    0%,100% { box-shadow: 0 0 0 14px rgba(99,102,241,0.1); }
    50%      { box-shadow: 0 0 0 22px rgba(99,102,241,0.04); }
}
.ai-gen-laden-titel { font-size: 20px; font-weight: 700; color: #1e293b; }
.ai-gen-laden-sub   { font-size: 14px; color: #64748b; margin-top: -8px; text-align: center; }
.ai-gen-stappen-lijst {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.ai-gen-gen-stap {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    font-size: 14px;
    color: #64748b;
    transition: all 0.3s;
}
.ai-gen-gen-stap.is-done   { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
.ai-gen-gen-stap.is-actief { background: #eef2ff; border-color: #a5b4fc; color: #4338ca; font-weight: 600; }
.ai-gen-gen-stap-dot {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    flex-shrink: 0;
    background: #e2e8f0;
    color: #94a3b8;
    transition: all 0.3s;
}
.ai-gen-gen-stap.is-done   .ai-gen-gen-stap-dot { background: #22c55e; }
.ai-gen-gen-stap.is-actief .ai-gen-gen-stap-dot { background: #6366f1; color: white; }
.ai-gen-gen-stap-dot--puls {
    animation: ai-gen-puls-dot 1.2s ease-in-out infinite;
}
@keyframes ai-gen-puls-dot {
    0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
    60%     { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
}

/* ── PREVIEW PANEL ── */
#ai-gen-panel-3b {
    padding: 20px 0 0;
    max-width: 100%;
    width: 100%;
    margin: 0 auto;
}
.ai-gen-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 700;
    color: #1e293b;
}
.ai-gen-preview-meta { display: flex; gap: 6px; }
.ai-gen-preview-tag {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 5px;
}
.ai-gen-preview-tag--model { background: #eef2ff; color: #4338ca; }
.ai-gen-preview-tag--docs  { background: #f1f5f9; color: #475569; }
.ai-gen-preview-content {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: white;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 28px;
}
.ai-gen-preview-content::-webkit-scrollbar { width: 5px; }
.ai-gen-preview-content::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 3px; }
.ai-gen-preview-leeg {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 60px 0;
    color: #94a3b8;
    font-size: 13px;
    text-align: center;
}
.ai-gen-rode-draad-warning {
    margin-top: 12px;
    padding: 12px 16px;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 10px;
    font-size: 13px;
    color: #78350f;
    display: flex;
    gap: 8px;
    align-items: flex-start;
    line-height: 1.5;
}

/* ── FOOTER ── */
.ai-gen-footer {
    padding: 16px 32px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    background: #f8fafc;
}
.ai-gen-footer-links  { display: flex; align-items: center; gap: 10px; }
.ai-gen-footer-rechts { display: flex; gap: 8px; align-items: center; }
.ai-gen-kosten-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #64748b;
}
.ai-gen-kosten-badge strong { color: #334155; }

/* ── PANEL HEADER RIJ ── */
.ai-gen-panel-header-rij {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
}
.ai-gen-panel-header-rij .ai-gen-panel-titel { margin-bottom: 2px; }
.ai-gen-panel-header-rij .ai-gen-panel-tekst { margin-bottom: 0; }

/* ── SELECTIE TELLER ── */
.ai-gen-selectie-teller {
    flex-shrink: 0;
    font-size: 13px;
    font-weight: 600;
    color: #4f46e5;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    padding: 4px 12px;
    border-radius: 12px;
    white-space: nowrap;
    margin-top: 2px;
}
.ai-gen-selectie-teller.is-nul {
    color: #94a3b8;
    background: #f8fafc;
    border-color: #e2e8f0;
}

/* ── DOCS LADEN SKELETON ── */
.ai-gen-docs-laden {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 24px 0;
    color: #94a3b8;
    font-size: 14px;
}

/* ── UPLOAD ZONE STATES ── */
.ai-gen-upload-zone.is-dragover {
    border-color: #6366f1;
    background: #eef2ff;
    transform: scale(1.01);
}
.ai-gen-upload-zone.is-uploading {
    opacity: 0.7;
    pointer-events: none;
}
`;

    const style        = document.createElement('style');
    style.id           = 'ai-gen-modal-styles';
    style.textContent  = css;
    document.head.appendChild(style);
}