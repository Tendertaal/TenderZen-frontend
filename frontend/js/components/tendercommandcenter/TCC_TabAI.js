/* ============================================
   TCC_TabAI.js
   AI Generatie tab
   VERSIE: 20260309_1530 - Downstream vulling na Rode Draad akkoord
   ============================================ */

// ============================================
// EMOJI → ICONS.JS MAPPING
// ============================================

const _emojiIconMap = {
    '📋': { name: 'clipboardList', color: '#4f46e5' },
    '✅': { name: 'checkCircle', color: '#16a34a' },
    '⚠️': { name: 'warning', color: '#d97706' },
    '❌': { name: 'xCircle', color: '#dc2626' },
    '📄': { name: 'fileText', color: '#4f46e5' },
    '📊': { name: 'barChart', color: '#9333ea' },
    '🎯': { name: 'zap', color: '#6366f1' },
    '💡': { name: 'zap', color: '#d97706' },
    '🔍': { name: 'search', color: '#2563eb' },
    '👥': { name: 'users', color: '#16a34a' },
    '📅': { name: 'calendarView', color: '#2563eb' },
    '⚡': { name: 'zap', color: '#6366f1' },
    '🏆': { name: 'checkCircle', color: '#d97706' },
    '📝': { name: 'edit', color: '#4f46e5' },
    '🔒': { name: 'lock', color: '#4f46e5' },
    '💰': { name: 'briefcase', color: '#16a34a' },
    '📈': { name: 'barChart', color: '#16a34a' },
    '🚀': { name: 'zap', color: '#6366f1' },
    '1️⃣': { name: 'info', color: '#2563eb' },
    '2️⃣': { name: 'info', color: '#2563eb' },
    '3️⃣': { name: 'info', color: '#2563eb' },
    '4️⃣': { name: 'info', color: '#2563eb' },
    '5️⃣': { name: 'info', color: '#2563eb' },
    '6️⃣': { name: 'info', color: '#2563eb' },
    '7️⃣': { name: 'info', color: '#2563eb' },
};

// ============================================
// TRANSFORM — AI Generatie
// ============================================

function transformGeneratie(aiDocuments, aiTemplates) {
    const docsByKey = {};
    for (const doc of aiDocuments) docsByKey[doc.template_key] = doc;

    const templateMeta = {
        go_no_go: { icon: 'statusGo', beschrijving: 'Haalbaarheidsanalyse met score' },
        samenvatting: { icon: 'fileText', beschrijving: 'Beknopt overzicht voor team', iconColor: '#2563eb' },
        compliance_matrix: { icon: 'barChart', beschrijving: 'Alle eisen en bewijsstukken' },
        risico_analyse: { icon: 'warning', beschrijving: 'Risico-inventarisatie en mitigatie' },
        rode_draad: { icon: 'zap', beschrijving: 'Rode draad document / kick-off', iconColor: '#7c3aed' },
        offerte: { icon: 'fileText', beschrijving: 'Professionele tenderofferte', iconColor: '#16a34a' },
        versie1_inschrijving: { icon: 'fileText', beschrijving: 'Eerste concept inschrijving', iconColor: '#7c3aed' },
        win_check: { icon: 'checkCircle', beschrijving: 'Feedback voor hogere winstkans', iconColor: '#16a34a' },
        nvi_vragen: { icon: 'clipboardList', beschrijving: 'Nota van Inlichtingen vragenlijst' },
        pva_skelet: { icon: 'fileText', beschrijving: 'Plan van Aanpak skelet', iconColor: '#4338ca' },
        planning_extractor: { icon: 'calendarView', beschrijving: 'Tenderplanning extractie', iconColor: '#6366f1' },
        projectplanning_generator: { icon: 'calendarClock', beschrijving: 'Projectplanning generatie', iconColor: '#7c3aed' },
        checklist_extractor: { icon: 'clipboardList', beschrijving: 'Checklist extractie', iconColor: '#0284c7' },
        checklist_generator: { icon: 'checkSquare', beschrijving: 'Checklist generatie', iconColor: '#16a34a' }
    };

    const documenten = [];
    if (aiTemplates.length > 0) {
        for (const tmpl of aiTemplates) {
            const key = tmpl.template_key;
            const doc = docsByKey[key];
            const meta = templateMeta[key] || { icon: 'fileText', beschrijving: tmpl.beschrijving || '' };
            documenten.push(_buildGenDocCard(key, tmpl.template_name || key, meta, doc));
        }
    } else if (aiDocuments.length > 0) {
        for (const doc of aiDocuments) {
            const key = doc.template_key || doc.type || 'onbekend';
            const meta = templateMeta[key] || { icon: 'fileText', beschrijving: '' };
            documenten.push(_buildGenDocCard(key, doc.titel || key, meta, doc));
        }
    } else {
        for (const [key, meta] of Object.entries(templateMeta)) {
            if (['go_no_go', 'samenvatting', 'compliance_matrix', 'risico_analyse'].includes(key)) {
                const naam = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                documenten.push(_buildGenDocCard(key, naam, meta, null));
            }
        }
    }

    const doneCount = documenten.filter(d => d.status === 'done' || d.status === 'gonogo').length;
    return { badge: documenten.length > 0 ? `${doneCount}/${documenten.length}` : '', documenten };
}

function _buildGenDocCard(key, titel, meta, doc) {
    if (!doc) return {
        type: key, status: 'ready', titel,
        beschrijving: meta.beschrijving || '',
        icon: meta.icon || 'fileText',
        iconColor: meta.iconColor
    };

    const status = doc.status === 'completed' || doc.status === 'geaccepteerd' ? 'done'
        : doc.status === 'generating' || doc.status === 'processing' ? 'generating'
            : doc.status === 'concept' ? 'done'
                : 'ready';

    if (key === 'go_no_go' && status === 'done') {
        const inhoud = doc.inhoud || doc.content || {};
        return {
            type: key, status: 'gonogo', titel,
            beschrijving: meta.beschrijving || '',
            icon: meta.icon || 'statusGo',
            score: inhoud.score || 0,
            verdictLabel: inhoud.aanbeveling || inhoud.verdict || 'Onbekend',
            winkans: inhoud.geschatte_winkans ? `Winkans: ${inhoud.geschatte_winkans}` : '',
            sterktePunten: inhoud.sterke_punten || inhoud.argumenten_go || [],
            risicos: inhoud.risicos || inhoud.argumenten_no_go || [],
            documentId: doc.id || null
        };
    }

    return {
        type: key, status, titel,
        beschrijving: meta.beschrijving || '',
        icon: meta.icon || 'fileText',
        iconColor: meta.iconColor,
        generatedDate: doc.completed_at ? _formatDateNL(doc.completed_at) : '',
        generatingMeta: status === 'generating' ? 'Even geduld...' : '',
        documentId: doc.id || null
    };
}

// ============================================
// RENDER — Tab: AI Generatie
// ============================================

function renderTabAI(data) {
    const generatie = data.generatie || {};
    const isActive = tccState.activeTab === 'ai';
    const docs = generatie.documenten || [];

    const emptyState = docs.length === 0 ? `
        <div class="tcc-docs-empty" style="padding: 48px 20px;">
            ${tccIcon('zap', 32, '#cbd5e1')}
            <div class="tcc-docs-empty-title">Geen AI templates beschikbaar</div>
            <div class="tcc-docs-empty-desc">Er zijn nog geen document templates geconfigureerd voor dit bureau.</div>
        </div>` : '';

    return `
    <div class="tcc-tab-panel${isActive ? ' is-active' : ''}" data-panel="ai">
        <div class="tcc-aidoc-grid">
            ${docs.map(doc => renderAiDocCard(doc)).join('')}
            ${emptyState}
        </div>
    </div>`;
}

// ============================================
// RENDER — AI Doc Cards
// ============================================

function renderAiDocCard(doc) {
    const statusMap = {
        done: renderAiDocDone,
        ready: renderAiDocReady,
        generating: renderAiDocGenerating,
        gonogo: renderAiDocGoNoGo
    };
    const renderBody = statusMap[doc.status] || renderAiDocReady;
    return `
    <div class="tcc-aidoc-card" data-doc-type="${doc.type}" data-document-id="${doc.documentId || ''}">
        <div class="tcc-aidoc-card-header">
            <div class="tcc-aidoc-card-icon tcc-aidoc-card-icon--${doc.type || 'samenvatting'}">
                ${tccIcon(doc.icon || 'fileText', 24, doc.iconColor || undefined)}
            </div>
            <div class="tcc-aidoc-card-info">
                <div class="tcc-aidoc-card-title">${escHtml(doc.titel)}</div>
                <div class="tcc-aidoc-card-desc">${escHtml(doc.beschrijving || '')}</div>
            </div>
        </div>
        <div class="tcc-aidoc-card-body">${renderBody(doc)}</div>
    </div>`;
}

function renderAiDocGoNoGo(doc) {
    const score = doc.score || 0;
    const verdict = score >= 60 ? 'GO' : score >= 40 ? 'MAYBE' : 'NO-GO';
    const verdictLabel = doc.verdictLabel || verdict;
    const bgColor = score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444';
    const bg = score >= 60 ? '#f0fdf4' : score >= 40 ? '#fffbeb' : '#fef2f2';
    const border = score >= 60 ? '#bbf7d0' : score >= 40 ? '#fde68a' : '#fecaca';
    const textColor = score >= 60 ? '#166534' : score >= 40 ? '#92400e' : '#991b1b';

    return `
    <div class="tcc-gonogo-verdict" style="background:${bg};border-color:${border}">
        <div class="tcc-gonogo-score" style="background:${bgColor}">${score}</div>
        <div class="tcc-gonogo-info">
            <div class="tcc-gonogo-label" style="color:${textColor}">${escHtml(verdictLabel)}</div>
            <div class="tcc-gonogo-sublabel">${escHtml(doc.winkans || '')}</div>
        </div>
    </div>
    ${doc.sterktePunten?.length || doc.risicos?.length ? `
    <div class="tcc-gonogo-details">
        ${doc.sterktePunten?.length ? `
        <div class="tcc-gonogo-detail">
            <div class="tcc-gonogo-detail-label">${tccIcon('checkCircle', 12)} Sterk</div>
            <ul>${doc.sterktePunten.map(s => `<li>${tccIcon('check', 11)} ${escHtml(s)}</li>`).join('')}</ul>
        </div>` : ''}
        ${doc.risicos?.length ? `
        <div class="tcc-gonogo-detail">
            <div class="tcc-gonogo-detail-label">${tccIcon('warning', 12)} Risico's</div>
            <ul>${doc.risicos.map(r => `<li>${tccIcon('warning', 11, '#ea580c')} ${escHtml(r)}</li>`).join('')}</ul>
        </div>` : ''}
    </div>` : ''}
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-regenerate" data-type="${doc.type}">${tccIcon('refresh', 13)} Opnieuw</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-copy"       data-type="${doc.type}">${tccIcon('copy', 13)} Kopieer</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-download"   data-type="${doc.type}">${tccIcon('download', 13)} Download</button>
    </div>`;
}

function renderAiDocReady(doc) {
    return `
    <div class="tcc-aidoc-status tcc-aidoc-status--ready">
        ${tccIcon('clipboardList', 16)}
        <div class="tcc-aidoc-status-text">
            <div class="tcc-aidoc-status-label">Nog niet gegenereerd</div>
        </div>
    </div>
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--primary tcc-btn--sm" data-action="ai-generate" data-type="${doc.type}">
            ${tccIcon('zap', 13, '#ffffff')} Genereer
        </button>
    </div>`;
}

function renderAiDocGenerating(doc) {
    return `
    <div class="tcc-aidoc-status tcc-aidoc-status--generating">
        <div class="tcc-spinner"></div>
        <div class="tcc-aidoc-status-text">
            <div class="tcc-aidoc-status-label">Bezig met genereren…</div>
            <div class="tcc-aidoc-status-meta">${escHtml(doc.generatingMeta || 'Even geduld')}</div>
        </div>
    </div>`;
}

function renderAiDocDone(doc) {
    return `
    <div class="tcc-aidoc-status" style="background:#f0fdf4;border:1px solid #bbf7d0;">
        ${tccIcon('checkCircle', 16)}
        <div class="tcc-aidoc-status-text">
            <div class="tcc-aidoc-status-label">Gegenereerd</div>
            <div class="tcc-aidoc-status-meta">${escHtml(doc.generatedDate || '')}</div>
        </div>
    </div>
    <div class="tcc-aidoc-actions">
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-view"       data-type="${doc.type}">${tccIcon('eye', 13)} Bekijk</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-regenerate" data-type="${doc.type}">${tccIcon('refresh', 13)} Opnieuw</button>
        <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" data-action="ai-download"   data-type="${doc.type}">${tccIcon('download', 13)} Download</button>
    </div>`;
}

// ============================================
// HANDLER — AI Genereren (via modal)
// ============================================

function handleAiGenerate(docType) {
    const tenderId = tccState.tenderId;
    if (!tenderId) { showTccToast('Geen tender geselecteerd', 'error'); return; }

    openAiGeneratieModal({
        docType,
        tenderId,
        brondocumenten: _getBrondocumenten(),
        onGenerate: (params) => _executeAiGenerate(docType, params),
        // ✅ NIEUW: akkoord callback — afhandeling downstream
        onAkkoord: (documentId) => _handleAkkoord(docType, documentId),
    });
}

function handleAiRegenerate(docType) {
    handleAiGenerate(docType);
}

// Werkelijke API-call — returnt nu de volledige response incl. document ID
async function _executeAiGenerate(docType, { model, brondocumentIds }) {
    const tenderId = tccState.tenderId;
    if (!tenderId) return;

    const result = await tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/generate-document`, {
        method: 'POST',
        body: JSON.stringify({
            template_key: docType,
            model: model || 'claude-sonnet-4-6',
            brondocument_ids: brondocumentIds || [],
        })
    });
    // Gooit bij fout een exception — modal vangt dit op

    await _refreshAiGrid();

    // ✅ NIEUW: geef document ID terug zodat modal hem kan doorgeven aan onAkkoord
    return result;
}

// ============================================
// AKKOORD & DOWNSTREAM FLOW
// ============================================

/**
 * Wordt aangeroepen door AiGeneratieModal na klik op "Akkoord".
 * - Roept /akkoord endpoint aan
 * - Als rode_draad: toont DownstreamConfirmModal
 * - Anders: sluit modal + refresh
 */
async function _handleAkkoord(docType, documentId) {
    if (!documentId) {
        showTccToast('Document ID niet beschikbaar', 'error');
        return;
    }

    try {
        // 1. Akkoord geven + preview ophalen
        const akkoordResult = await tccApiCall(
            `/api/v1/ai-documents/documents/${documentId}/akkoord`,
            { method: 'POST' }
        );

        // 2. Geen downstream effect (bijv. samenvatting, offerte)
        if (!akkoordResult?.heeft_downstream) {
            showTccToast('Document goedgekeurd', 'success');
            await _refreshAiGrid();
            return;
        }

        // 3. Rode Draad: toon bevestigingsmodal voor downstream vulling
        _toonDownstreamModal(documentId, akkoordResult.preview);

    } catch (err) {
        console.error('[TCC] Akkoord mislukt:', err);
        showTccToast(`Akkoord mislukt: ${err.message}`, 'error');
    }
}

/**
 * Voert downstream uit na gebruikersbevestiging.
 * Vult Tenderplanning, Projectplanning en/of Checklist tabs.
 */
async function _voerDownstreamUit(documentId, geselecteerdeTabs) {
    try {
        const result = await tccApiCall(
            `/api/v1/ai-documents/documents/${documentId}/downstream`,
            {
                method: 'POST',
                body: JSON.stringify({ tabs: geselecteerdeTabs })
            }
        );

        const aangemaakt = Object.values(result.resultaten || {})
            .filter(r => r.status === 'gevuld')
            .map(r => r.aangemaakt || 0)
            .reduce((a, b) => a + b, 0);

        showTccToast(
            `✅ Tabs bijgewerkt — ${aangemaakt} items aangemaakt`,
            'success'
        );

        // Refresh alle betrokken tabs in het TCC
        await _refreshNaDownstream(geselecteerdeTabs);

    } catch (err) {
        console.error('[TCC] Downstream mislukt:', err);
        showTccToast(`Tabs vullen mislukt: ${err.message}`, 'error');
    }
}

/**
 * Refresh de TCC data en herrendert de betrokken tabs.
 */
async function _refreshNaDownstream(tabs) {
    const tenderId = tccState.tenderId;
    if (!tenderId) return;

    // Volledige data refresh
    const freshData = await fetchTccData(tenderId);
    tccState.data = freshData;

    // Herrender elke betrokken tab
    const tabMap = {
        tenderplanning: 'tenderplanning',
        projectplanning: 'projectplanning',
        checklist: 'checklist',
    };

    for (const tab of tabs) {
        const panelKey = tabMap[tab];
        if (!panelKey) continue;

        const panel = tccState.overlay?.querySelector(`[data-panel="${panelKey}"]`);
        if (!panel) continue;

        // Herrender panel inhoud via bestaande render functies
        let nieuwHtml = '';
        if (panelKey === 'tenderplanning' && typeof renderTabTenderplanning === 'function') {
            nieuwHtml = renderTabTenderplanning(freshData);
        } else if (panelKey === 'projectplanning' && typeof renderTabProjectplanning === 'function') {
            nieuwHtml = renderTabProjectplanning(freshData);
        } else if (panelKey === 'checklist' && typeof renderTabChecklist === 'function') {
            nieuwHtml = renderTabChecklist(freshData);
        }

        if (nieuwHtml) {
            panel.outerHTML = nieuwHtml;
        }

        // Badge bijwerken
        const tabBtn = tccState.overlay?.querySelector(`[data-tab="${panelKey}"]`);
        const badge = tabBtn?.querySelector('.tcc-tab-badge');
        if (badge && freshData[panelKey]?.badge) {
            badge.textContent = freshData[panelKey].badge;
        }
    }

    // Ook AI grid refreshen
    await _refreshAiGrid();
}

// ============================================
// DOWNSTREAM CONFIRM MODAL
// ============================================

/**
 * Toont een inline bevestigingsmodal binnen het TCC.
 * Gebruiker kiest welke tabs gevuld worden.
 */
function _toonDownstreamModal(documentId, preview) {
    // Verwijder eventuele bestaande modal
    document.querySelector('#tcc-downstream-modal')?.remove();

    const panel = document.querySelector('#tcc-panel');
    if (!panel) return;

    // Bouw tab rijen op basis van preview
    const tabConfig = [
        {
            key: 'tenderplanning',
            label: 'Tenderplanning',
            icon: 'calendar',
            kleur: '#2563eb',
        },
        {
            key: 'projectplanning',
            label: 'Projectplanning',
            icon: 'calendarView',
            kleur: '#7c3aed',
        },
        {
            key: 'checklist',
            label: 'Checklist',
            icon: 'clipboardList',
            kleur: '#16a34a',
        },
    ];

    const tabRijen = tabConfig.map(tab => {
        const tabPreview = preview?.[tab.key];
        if (!tabPreview) return ''; // Niet beschikbaar in preview

        const aantal = tabPreview.aantal || 0;
        const heeftData = tabPreview.heeft_bestaande_data;
        const overschrijft = tabPreview.overschrijft;

        const badgeHtml = heeftData && overschrijft
            ? `<span class="tcc-ds-badge tcc-ds-badge--warn">${tccIcon('warning', 10, '#92400e')} Overschrijft bestaande data</span>`
            : heeftData
                ? `<span class="tcc-ds-badge tcc-ds-badge--info">Voegt toe aan bestaande data</span>`
                : `<span class="tcc-ds-badge tcc-ds-badge--ok">${tccIcon('checkCircle', 10, '#166534')} Leeg — veilig vullen</span>`;

        // Preview items (max 3)
        const previewItems = (tabPreview.items || []).slice(0, 3);
        const previewHtml = previewItems.length > 0 ? `
            <div class="tcc-ds-preview-items">
                ${previewItems.map(item => `
                    <div class="tcc-ds-preview-item">
                        ${tccIcon('chevronRight', 10, '#94a3b8')}
                        <span>${escHtml(item.mijlpaal || item.taak_naam || item.naam || JSON.stringify(item))}</span>
                    </div>`).join('')}
                ${aantal > 3 ? `<div class="tcc-ds-preview-meer">+${aantal - 3} meer</div>` : ''}
            </div>` : '';

        return `
        <label class="tcc-ds-tab-rij is-checked" data-tab-key="${tab.key}">
            <div class="tcc-ds-tab-check" data-check="${tab.key}">
                ${tccIcon('check', 12, 'white')}
            </div>
            <div class="tcc-ds-tab-icon" style="background:${tab.kleur}15;color:${tab.kleur}">
                ${tccIcon(tab.icon, 16, tab.kleur)}
            </div>
            <div class="tcc-ds-tab-info">
                <div class="tcc-ds-tab-naam">${tab.label}</div>
                <div class="tcc-ds-tab-detail">${aantal} item${aantal !== 1 ? 's' : ''} worden aangemaakt</div>
                ${previewHtml}
            </div>
            <div class="tcc-ds-tab-badge-wrap">${badgeHtml}</div>
        </label>`;
    }).filter(Boolean).join('');

    const modal = document.createElement('div');
    modal.id = 'tcc-downstream-modal';
    modal.className = 'tcc-downstream-overlay';
    modal.innerHTML = `
        <div class="tcc-downstream-modal">
            <div class="tcc-downstream-header">
                <div class="tcc-downstream-header-icon">
                    ${tccIcon('zap', 22, '#7c3aed')}
                </div>
                <div>
                    <div class="tcc-downstream-titel">Tabs bijwerken</div>
                    <div class="tcc-downstream-sub">Het Rode Draad document is goedgekeurd. Kies welke tabs automatisch gevuld worden.</div>
                </div>
                <button class="tcc-downstream-sluit" id="tcc-ds-sluit">
                    ${tccIcon('close', 16)}
                </button>
            </div>
            <div class="tcc-downstream-body">
                <div class="tcc-ds-tabs-lijst">
                    ${tabRijen}
                </div>
                ${tabRijen === '' ? `
                <div class="tcc-ds-leeg">
                    ${tccIcon('warning', 24, '#d97706')}
                    <div>Geen data gevonden om te verwerken. Controleer of de Rode Draad markdown de verwachte secties bevat.</div>
                </div>` : ''}
            </div>
            <div class="tcc-downstream-footer">
                <button class="tcc-btn tcc-btn--ghost" id="tcc-ds-annuleer">Annuleren</button>
                <button class="tcc-btn tcc-btn--primary" id="tcc-ds-bevestig" ${tabRijen === '' ? 'disabled' : ''}>
                    ${tccIcon('check', 14, 'white')} Tabs vullen
                </button>
            </div>
        </div>`;

    panel.appendChild(modal);
    _injectDownstreamStyles();

    // Selectie toggle per tab rij
    modal.querySelectorAll('.tcc-ds-tab-rij').forEach(rij => {
        rij.addEventListener('click', () => {
            rij.classList.toggle('is-checked');
            const check = rij.querySelector('.tcc-ds-tab-check');
            if (check) check.style.background = rij.classList.contains('is-checked') ? '#6366f1' : '';
        });
    });

    // Sluit knoppen
    modal.querySelector('#tcc-ds-sluit')?.addEventListener('click', _sluitDownstreamModal);
    modal.querySelector('#tcc-ds-annuleer')?.addEventListener('click', _sluitDownstreamModal);

    // Bevestig knop
    modal.querySelector('#tcc-ds-bevestig')?.addEventListener('click', async () => {
        const geselecteerd = [...modal.querySelectorAll('.tcc-ds-tab-rij.is-checked')]
            .map(r => r.dataset.tabKey)
            .filter(Boolean);

        if (geselecteerd.length === 0) {
            showTccToast('Selecteer minimaal één tab', 'warn');
            return;
        }

        const btn = modal.querySelector('#tcc-ds-bevestig');
        btn.disabled = true;
        btn.innerHTML = `<div class="tcc-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;margin-right:6px;"></div> Bezig…`;

        _sluitDownstreamModal();
        await _voerDownstreamUit(documentId, geselecteerd);
    });

    // Fade-in
    requestAnimationFrame(() => modal.classList.add('is-open'));
}

function _sluitDownstreamModal() {
    const modal = document.querySelector('#tcc-downstream-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => modal.remove(), 250);
}

function _injectDownstreamStyles() {
    if (document.getElementById('tcc-downstream-styles')) return;

    const style = document.createElement('style');
    style.id = 'tcc-downstream-styles';
    style.textContent = `
/* ── Downstream Modal ── */
.tcc-downstream-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15,23,42,0.45);
    backdrop-filter: blur(3px);
    z-index: 300;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
}
.tcc-downstream-overlay.is-open {
    opacity: 1;
    pointer-events: all;
}
.tcc-downstream-modal {
    background: white;
    border-radius: 16px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06);
    width: 100%;
    max-width: 540px;
    display: flex;
    flex-direction: column;
    max-height: 85vh;
    overflow: hidden;
    transform: translateY(12px) scale(0.98);
    transition: transform 0.25s cubic-bezier(0.16,1,0.3,1);
}
.tcc-downstream-overlay.is-open .tcc-downstream-modal {
    transform: translateY(0) scale(1);
}
.tcc-downstream-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 22px 22px 18px;
    border-bottom: 1px solid #f1f5f9;
}
.tcc-downstream-header-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #f5f3ff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.tcc-downstream-titel {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 3px;
}
.tcc-downstream-sub {
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
}
.tcc-downstream-sluit {
    margin-left: auto;
    flex-shrink: 0;
    width: 30px;
    height: 30px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    transition: all 0.15s;
}
.tcc-downstream-sluit:hover { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
.tcc-downstream-body {
    padding: 18px 22px;
    overflow-y: auto;
    flex: 1;
}
.tcc-ds-tabs-lijst { display: flex; flex-direction: column; gap: 10px; }

/* Tab rij */
.tcc-ds-tab-rij {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
}
.tcc-ds-tab-rij:hover    { border-color: #a5b4fc; background: #fafaff; }
.tcc-ds-tab-rij.is-checked { border-color: #6366f1; background: #eef2ff; }

.tcc-ds-tab-check {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid #cbd5e1;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    margin-top: 1px;
}
.tcc-ds-tab-rij.is-checked .tcc-ds-tab-check {
    background: #6366f1;
    border-color: #6366f1;
}

.tcc-ds-tab-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.tcc-ds-tab-info { flex: 1; min-width: 0; }
.tcc-ds-tab-naam   { font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
.tcc-ds-tab-detail { font-size: 12px; color: #64748b; }

/* Preview items */
.tcc-ds-preview-items {
    margin-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
}
.tcc-ds-preview-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: #475569;
}
.tcc-ds-preview-meer {
    font-size: 11px;
    color: #94a3b8;
    margin-top: 2px;
    padding-left: 15px;
}

/* Badges */
.tcc-ds-badge-wrap { flex-shrink: 0; }
.tcc-ds-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 20px;
    white-space: nowrap;
}
.tcc-ds-badge--warn { background: #fef3c7; color: #92400e; }
.tcc-ds-badge--info { background: #e0f2fe; color: #0369a1; }
.tcc-ds-badge--ok   { background: #f0fdf4; color: #166534; }

/* Leeg state */
.tcc-ds-leeg {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 32px 16px;
    text-align: center;
    font-size: 13px;
    color: #64748b;
}

/* Footer */
.tcc-downstream-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 22px;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
}
`;
    document.head.appendChild(style);
}

// ============================================
// REFRESH HELPERS
// ============================================

async function _refreshAiGrid() {
    const tenderId = tccState.tenderId;
    if (!tenderId) return;

    const freshData = await fetchTccData(tenderId);
    tccState.data = freshData;

    const genGrid = tccState.overlay?.querySelector('[data-panel="ai"] .tcc-aidoc-grid');
    if (genGrid) {
        genGrid.innerHTML = (freshData.generatie?.documenten || [])
            .map(doc => renderAiDocCard(doc)).join('');
    }

    const aiTab = tccState.overlay?.querySelector('[data-tab="ai"]');
    const badge = aiTab?.querySelector('.tcc-tab-badge');
    if (badge && freshData.generatie?.badge) badge.textContent = freshData.generatie.badge;
}

function _getBrondocumenten() {
    const docs = tccState.data?.documenten || [];
    return docs.map(d => ({
        id: d.id || d.document_id || '',
        naam: d.naam || d.bestandsnaam || d.filename || 'Document',
        type: (d.bestandsnaam || d.filename || '').split('.').pop()?.toLowerCase() || 'pdf',
        grootte: d.bestandsgrootte || d.file_size || 0,
        paginas: d.paginas || d.page_count || null,
        bron: (d.bron === 'smart_import' || d.source === 'smart_import') ? 'smart_import' : 'handmatig',
    }));
}

// ============================================
// DOCUMENT VIEWER — Slide-in drawer
// ============================================

async function _handleAiView(docType) {
    const tenderId = tccState.tenderId;
    if (!tenderId) return;

    const doc = tccState.data?.generatie?.documenten?.find(d => d.type === docType);
    if (!doc) return;

    const btn = tccState.overlay?.querySelector(`[data-action="ai-view"][data-type="${docType}"]`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<div class="tcc-spinner" style="width:11px;height:11px;border-width:2px;display:inline-block;"></div>`;
    }

    let content = '';
    let documentId = doc.documentId || null;

    try {
        const result = await tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/ai-documents`);
        const fullDoc = (result?.documents || []).find(d => d.template_key === docType);
        content = fullDoc?.document_content || '';
        documentId = fullDoc?.id || documentId;
    } catch (e) {
        showTccToast('Document laden mislukt', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = `${tccIcon('eye', 13)} Bekijk`; }
        return;
    }

    if (btn) { btn.disabled = false; btn.innerHTML = `${tccIcon('eye', 13)} Bekijk`; }
    if (!content) { showTccToast('Geen inhoud beschikbaar', 'warn'); return; }

    _openDocViewer(doc.titel || docType, content, docType, documentId);
}

function _openDocViewer(titel, content, docType, documentId = null) {
    document.querySelector('#tcc-doc-viewer')?.remove();

    const panel = document.querySelector('#tcc-panel');
    if (!panel) return;

    const viewer = document.createElement('div');
    viewer.id = 'tcc-doc-viewer';
    viewer.className = 'tcc-doc-viewer';

    viewer.innerHTML = `
        <div class="tcc-doc-viewer-header">
            <div class="tcc-doc-viewer-header-left">
                <div class="tcc-doc-viewer-icon">${tccIcon('fileText', 18, '#ffffff')}</div>
                <div>
                    <div class="tcc-doc-viewer-title">${escHtml(titel)}</div>
                    <div class="tcc-doc-viewer-meta">AI gegenereerd document</div>
                </div>
            </div>
            <div class="tcc-doc-viewer-actions">
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="tcc-viewer-copy-btn">
                    ${tccIcon('copy', 13)} Kopieer
                </button>
                <button class="tcc-btn tcc-btn--ghost tcc-btn--sm" id="tcc-viewer-download-btn"
                        ${!documentId ? 'disabled title="Document ID niet beschikbaar"' : ''}>
                    ${tccIcon('download', 13)} Download .docx
                </button>
                <button class="tcc-doc-viewer-close" id="tcc-doc-viewer-close">
                    ${tccIcon('close', 16)}
                </button>
            </div>
        </div>
        <div class="tcc-doc-viewer-body">
            <div class="tcc-doc-viewer-content tcc-md-body">${_renderMarkdown(content)}</div>
        </div>`;

    panel.appendChild(viewer);

    document.getElementById('tcc-doc-viewer-close')
        ?.addEventListener('click', _closeDocViewer);

    document.getElementById('tcc-viewer-copy-btn')
        ?.addEventListener('click', () => {
            navigator.clipboard.writeText(content).then(() => {
                showTccToast('✅ Gekopieerd naar klembord', 'success');
            });
        });

    document.getElementById('tcc-viewer-download-btn')
        ?.addEventListener('click', () => _downloadDocAsDocx(titel, docType, documentId));

    requestAnimationFrame(() => viewer.classList.add('is-open'));
}

function _closeDocViewer() {
    const viewer = document.querySelector('#tcc-doc-viewer');
    if (!viewer) return;
    viewer.classList.remove('is-open');
    setTimeout(() => viewer.remove(), 300);
}

// ============================================
// DOWNLOAD — .docx via backend endpoint
// ============================================

async function _downloadDocAsDocx(titel, docType, documentId = null) {
    const tenderId = tccState.tenderId;
    if (!tenderId) return;

    const btn = document.getElementById('tcc-viewer-download-btn');
    const origHtml = btn?.innerHTML;

    try {
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `<div class="tcc-spinner" style="width:11px;height:11px;border-width:2px;display:inline-block;margin-right:4px;"></div> Bezig...`;
        }

        let docId = documentId;
        if (!docId) {
            const result = await tccApiCall(`/api/v1/ai-documents/tenders/${tenderId}/ai-documents`);
            const fullDoc = (result?.documents || []).find(d => d.template_key === docType);
            docId = fullDoc?.id || null;
        }

        if (!docId) {
            showTccToast('Document niet gevonden — genereer het eerst', 'error');
            return;
        }

        const session = await window.supabaseClient?.auth?.getSession();
        const token = session?.data?.session?.access_token
            || window._tccAuthToken
            || localStorage.getItem('sb-access-token')
            || '';

        const baseUrl = window.CONFIG?.API_BASE_URL || window.API_CONFIG?.BASE_URL || '';
        const url = `${baseUrl}/api/v1/ai-documents/documents/${docId}/download-docx`;

        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Download mislukt (${response.status})`);
        }

        const disposition = response.headers.get('Content-Disposition') || '';
        const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
        const filename = filenameMatch ? filenameMatch[1] : `TenderZen_${docType}.docx`;

        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        showTccToast(`✅ ${filename} gedownload`, 'success');

    } catch (error) {
        console.error('DOCX download mislukt:', error);
        showTccToast(`❌ Download mislukt: ${error.message}`, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHtml;
        }
    }
}

// ============================================
// MARKDOWN RENDERER
// ============================================

function _renderMarkdown(text) {
    if (!text) return '';

    const lines = text.split('\n');
    const output = [];
    let i = 0;

    const esc = (s) => s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    while (i < lines.length) {
        const raw = lines[i];
        const line = raw;

        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s\-|:]+\|/.test(lines[i + 1])) {
            const tableLines = [line];
            i += 2;
            while (i < lines.length && lines[i].includes('|')) {
                tableLines.push(lines[i]);
                i++;
            }
            output.push(_mdTable(tableLines));
            continue;
        }

        if (/^# (?!#)/.test(line)) {
            const content = _replaceEmoji(esc(line.replace(/^# /, '')), true);
            output.push(`<h1 class="tcc-md-h1">${_mdInline(content)}</h1>`);
        } else if (/^## (?!#)/.test(line)) {
            const content = _replaceEmoji(esc(line.replace(/^## /, '')), true);
            output.push(`<h2 class="tcc-md-h2">${_mdInline(content)}</h2>`);
        } else if (/^### /.test(line)) {
            const content = _replaceEmoji(esc(line.replace(/^### /, '')), true);
            output.push(`<h3 class="tcc-md-h3">${_mdInline(content)}</h3>`);
        } else if (/^---+$/.test(line.trim())) {
            output.push(`<hr class="tcc-md-hr">`);
        } else if (/^[-*] /.test(line)) {
            const items = [];
            while (i < lines.length && /^[-*] /.test(lines[i])) {
                const txt = _replaceEmoji(esc(lines[i].replace(/^[-*] /, '')), false);
                items.push(`<li>${_mdInline(txt)}</li>`);
                i++;
            }
            output.push(`<ul class="tcc-md-ul">${items.join('')}</ul>`);
            continue;
        } else if (/^\d+\. /.test(line)) {
            const items = [];
            while (i < lines.length && /^\d+\. /.test(lines[i])) {
                const txt = _replaceEmoji(esc(lines[i].replace(/^\d+\. /, '')), false);
                items.push(`<li>${_mdInline(txt)}</li>`);
                i++;
            }
            output.push(`<ol class="tcc-md-ol">${items.join('')}</ol>`);
            continue;
        } else if (!line.trim()) {
            // lege regel
        } else {
            output.push(`<p class="tcc-md-p">${_mdInline(_replaceEmoji(esc(line), false))}</p>`);
        }

        i++;
    }

    return output.join('\n');
}

function _replaceEmoji(text, asIcon = false) {
    let result = text;
    for (const [emoji, cfg] of Object.entries(_emojiIconMap)) {
        if (result.includes(emoji)) {
            const replacement = asIcon && window.Icons?.[cfg.name]
                ? window.Icons[cfg.name]({ size: 16, color: cfg.color })
                : '';
            result = result.replaceAll(emoji, replacement);
        }
    }
    result = result.replace(/[\u{1F300}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|\u{FE0F}|\u{20E3}/gu, '');
    return result.trim();
}

function _mdInline(text) {
    return text
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="tcc-md-code">$1</code>');
}

function _mdTable(tableLines) {
    if (tableLines.length === 0) return '';
    const parseRow = (line) =>
        line.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    const headers = parseRow(tableLines[0]);
    const rows = tableLines.slice(1);
    const headerHtml = headers.map(h => `<th class="tcc-md-th">${_mdInline(h)}</th>`).join('');
    const rowsHtml = rows.map((row, idx) => {
        const cells = parseRow(row);
        const cellsHtml = headers.map((_, ci) =>
            `<td class="tcc-md-td">${_mdInline(cells[ci] || '')}</td>`
        ).join('');
        return `<tr class="${idx % 2 === 0 ? 'tcc-md-tr-even' : 'tcc-md-tr-odd'}">${cellsHtml}</tr>`;
    }).join('');
    return `<div class="tcc-md-table-wrap"><table class="tcc-md-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}