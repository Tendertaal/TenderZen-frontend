/* ============================================
   DocumentPreview.js  —  v2.0  (2026-04-16)
   Fullscreen overlay preview binnen de TCC modal.
   Position: absolute inset:0 over .tcc-panel (position:relative).

   Afhankelijkheden (globaal via andere TCC-scripts):
     tccState, tccApiCall, escHtml, tccIcon
   ============================================ */

const DocPreview = (() => {

    // ── State ──
    let _activeDocId  = null;
    let _docs         = [];   // huidige documentenlijst voor navigatie
    let _escHandler   = null;

    // ── Public API ──

    async function open(docId, tenderId, fileName) {
        if (!docId || !tenderId) return;

        // Zelfde doc nogmaals → sluit
        if (_activeDocId === docId) { close(); return; }

        // Documentenlijst voor navigatie bijhouden
        _docs = tccState.data?.documenten || [];

        _activeDocId = docId;
        _setCardActive(docId);
        _showLoading(fileName);

        try {
            const result = await tccApiCall(
                `/api/v1/ai-documents/tenders/${tenderId}/documents/${docId}/preview-url`
            );
            if (!result?.url) throw new Error('Geen signed URL ontvangen');
            _showContent(result.url, result.file_type, result.file_name || fileName);
        } catch (e) {
            console.error('[DocPreview] Fout bij laden preview:', e);
            _showError(fileName, e.message);
        }
    }

    function close() {
        _activeDocId = null;
        _setCardActive(null);
        _getPanel()?.classList.remove('open');
        _removeEscHandler();
    }

    // ── Private ──

    function _getPanel() {
        return tccState.overlay?.querySelector('#dp-panel');
    }

    function _currentIdx() {
        return _docs.findIndex(d => d.id === _activeDocId);
    }

    function _navTo(idx) {
        const doc = _docs[idx];
        if (!doc) return;
        open(doc.id, doc.tender_id || tccState.tenderId,
             doc.original_file_name || doc.file_name || '');
    }

    function _setCardActive(docId) {
        tccState.overlay?.querySelectorAll('.tcc-docs-card').forEach(card => {
            card.classList.toggle(
                'tcc-docs-card--preview-active',
                !!docId && card.dataset.docId === docId
            );
        });
    }

    // ── Render helpers ──

    function _headerHtml(fileName, url, hasNav) {
        const idx   = _currentIdx();
        const total = _docs.length;
        const navHtml = hasNav && total > 1 ? `
            <div class="dp-nav">
                <button class="dp-nav-btn" id="dp-prev" ${idx <= 0 ? 'disabled' : ''} title="Vorige">
                    ${tccIcon('chevronLeft', 13, 'currentColor')}
                </button>
                <span class="dp-nav-count">${idx + 1} / ${total}</span>
                <button class="dp-nav-btn" id="dp-next" ${idx >= total - 1 ? 'disabled' : ''} title="Volgende">
                    ${tccIcon('chevronRight', 13, 'currentColor')}
                </button>
            </div>` : '';

        const dlHtml = url ? `
            <a class="dp-header-btn dp-download-btn"
               href="${escHtml(url)}" target="_blank" title="Downloaden">
                ${tccIcon('download', 15, '#64748b')}
            </a>` : '';

        return `
            <div class="dp-header">
                <div class="dp-header-name" title="${escHtml(fileName)}">${escHtml(fileName)}</div>
                ${navHtml}
                <div class="dp-header-actions">
                    ${dlHtml}
                    <button class="dp-header-btn dp-close-btn" title="Sluiten (Esc)">
                        ${tccIcon('x', 16, '#64748b')}
                    </button>
                </div>
            </div>`;
    }

    function _openPanel(html) {
        const panel = _getPanel();
        if (!panel) return;
        panel.innerHTML = html;
        panel.classList.add('open');

        // Event handlers
        panel.querySelector('.dp-close-btn')?.addEventListener('click', () => close());
        panel.querySelector('#dp-prev')?.addEventListener('click', () => _navTo(_currentIdx() - 1));
        panel.querySelector('#dp-next')?.addEventListener('click', () => _navTo(_currentIdx() + 1));

        // Escape toets
        _removeEscHandler();
        _escHandler = (e) => {
            if (e.key === 'Escape' && panel.classList.contains('open')) close();
        };
        document.addEventListener('keydown', _escHandler);
    }

    function _removeEscHandler() {
        if (_escHandler) {
            document.removeEventListener('keydown', _escHandler);
            _escHandler = null;
        }
    }

    function _showLoading(fileName) {
        _openPanel(`
            ${_headerHtml(fileName, null, false)}
            <div class="dp-body dp-body--center">
                <div class="dp-spinner"></div>
                <div class="dp-loading-label">Preview laden…</div>
            </div>`);
    }

    function _showContent(url, fileType, fileName) {
        const isPdf = (fileType || '').toLowerCase().includes('pdf')
            || (fileName || '').toLowerCase().endsWith('.pdf');
        const isImg = /\.(png|jpe?g|gif|webp|svg)$/i.test(fileName || '')
            || (fileType || '').startsWith('image/');

        let bodyHtml;
        if (isPdf) {
            bodyHtml = `<iframe class="dp-iframe" src="${escHtml(url)}" title="${escHtml(fileName)}"></iframe>`;
        } else if (isImg) {
            bodyHtml = `
                <div class="dp-body dp-body--center dp-img-wrap">
                    <img src="${escHtml(url)}" class="dp-img" alt="${escHtml(fileName)}">
                </div>`;
        } else {
            bodyHtml = `
                <div class="dp-body dp-body--center">
                    <div class="dp-fallback">
                        ${tccIcon('fileText', 40, '#94a3b8')}
                        <div class="dp-fallback-name">${escHtml(fileName)}</div>
                        <div class="dp-fallback-msg">Preview niet beschikbaar voor dit bestandstype.</div>
                        <a class="tcc-btn tcc-btn--primary tcc-btn--sm"
                           href="${escHtml(url)}" target="_blank" download="${escHtml(fileName)}">
                            ${tccIcon('download', 14, '#fff')} Downloaden
                        </a>
                    </div>
                </div>`;
        }

        _openPanel(`
            ${_headerHtml(fileName, url, true)}
            ${isPdf ? `<div class="dp-body">${bodyHtml}</div>` : bodyHtml}`);
    }

    function _showError(fileName, msg) {
        _openPanel(`
            ${_headerHtml(fileName, null, false)}
            <div class="dp-body dp-body--center">
                ${tccIcon('alertCircle', 32, '#ef4444')}
                <div class="dp-error-msg">Preview kon niet worden geladen.</div>
                <div class="dp-error-detail">${escHtml(msg || '')}</div>
            </div>`);
    }

    // ── CSS injectie ──

    (function injectCSS() {
        if (document.getElementById('dp-css')) return;
        const style = document.createElement('style');
        style.id = 'dp-css';
        style.textContent = `

/* ── Docs container — volledige breedte ── */
.dp-split { display: block; }
.dp-split-left { display: contents; }

/* ── Overlay panel — bedekt volledige TCC ── */
.dp-panel {
    position: absolute;
    inset: 0;
    background: #fff;
    border-radius: 12px;
    z-index: 50;
    display: none;
    flex-direction: column;
    overflow: hidden;
}
.dp-panel.open { display: flex; }

/* ── Header ── */
.dp-header {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 16px; flex-shrink: 0;
    background: #f8fafc; border-bottom: 1px solid #e2e8f0;
}
.dp-header-name {
    font-size: 13px; font-weight: 600; color: #0f172a;
    flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.dp-header-actions { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.dp-header-btn {
    background: none; border: none; cursor: pointer;
    padding: 5px; border-radius: 6px; color: #64748b;
    display: flex; align-items: center;
    transition: background .12s; text-decoration: none;
}
.dp-header-btn:hover { background: #f1f5f9; }

/* ── Navigatie ── */
.dp-nav { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.dp-nav-btn {
    width: 26px; height: 26px; border: 1px solid #e2e8f0;
    border-radius: 6px; background: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #64748b; transition: background .12s;
}
.dp-nav-btn:hover:not(:disabled) { background: #f1f5f9; }
.dp-nav-btn:disabled { opacity: .35; cursor: default; }
.dp-nav-count { font-size: 12px; color: #94a3b8; padding: 0 6px; white-space: nowrap; }

/* ── Body ── */
.dp-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
.dp-body--center {
    align-items: center; justify-content: center;
    padding: 32px; gap: 12px; text-align: center;
}

/* ── PDF iframe ── */
.dp-iframe { width: 100%; height: 100%; border: none; flex: 1; }

/* ── Afbeelding ── */
.dp-img-wrap { flex: 1; background: #f8fafc; }
.dp-img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; }

/* ── Loading / states ── */
.dp-spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid #e2e8f0; border-top-color: #6366f1;
    animation: dp-spin .7s linear infinite;
}
@keyframes dp-spin { to { transform: rotate(360deg); } }
.dp-loading-label { font-size: 13px; color: #94a3b8; }
.dp-error-msg   { font-size: 13px; font-weight: 600; color: #0f172a; }
.dp-error-detail { font-size: 11px; color: #94a3b8; max-width: 280px; word-break: break-all; }

/* ── Fallback ── */
.dp-fallback { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.dp-fallback-name { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-all; max-width: 320px; }
.dp-fallback-msg  { font-size: 12px; color: #64748b; max-width: 260px; line-height: 1.5; }

/* ── Card highlight ── */
.tcc-docs-card { cursor: pointer; }
.tcc-docs-card--preview-active {
    border-color: #6366f1 !important;
    background: #eef2ff !important;
}

        `;
        document.head.appendChild(style);
    })();

    return { open, close };
})();
