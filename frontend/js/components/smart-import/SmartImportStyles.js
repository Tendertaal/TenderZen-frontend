// ================================================================
// TenderZen — Smart Import Wizard v4.0 — Styles
// Frontend/js/components/smart-import/SmartImportStyles.js
// Datum: 2026-02-09 (v2 — met step 1-3 styles)
// ================================================================
//
// CSS injection voor de wizard modal + stap 1, 2, 3.
// Prefixen:
//   .siw-  → modal wrapper (SmartImportWizard)
//   .si-   → step 1-3 componenten
//   .ts-   → step 4 (TeamStep.css — apart bestand)
//   .rs-   → step 5 (ResultStep.css — apart bestand)
// ================================================================

export class SmartImportStyles {
    static _injected = false;

    static inject() {
        if (SmartImportStyles._injected) return;
        SmartImportStyles._injected = true;

        const style = document.createElement('style');
        style.id = 'siw-styles';
        style.textContent = SmartImportStyles.CSS;
        document.head.appendChild(style);
    }

    static CSS = `
/* ═══════════════════════════════════════════════
   BODY LOCK
   ═══════════════════════════════════════════════ */

body.siw-open {
    overflow: hidden;
}

/* ═══════════════════════════════════════════════
   BACKDROP + MODAL
   ═══════════════════════════════════════════════ */

.siw-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
}

.siw-backdrop--visible {
    opacity: 1;
}

.siw-modal {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    width: 90vw;
    max-width: 860px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: siw-modal-in 0.25s ease;
}

@keyframes siw-modal-in {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ═══════════════════════════════════════════════
   MODAL HEADER — Step Indicators
   ═══════════════════════════════════════════════ */

.siw-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
}

.siw-step-indicators {
    display: flex;
    align-items: center;
    gap: 0;
    flex: 1;
}

.siw-step-dot {
    width: 30px; height: 30px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 600;
    background: #e2e8f0; color: #94a3b8;
    flex-shrink: 0;
    transition: background 0.2s, color 0.2s;
}
.siw-step-dot--active {
    background: #6366f1; color: #fff;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
}
.siw-step-dot--done { background: #22c55e; color: #fff; }
.siw-step-num { line-height: 1; }
.siw-step-line { width: 20px; height: 2px; background: #e2e8f0; flex-shrink: 0; }
.siw-step-label {
    margin-left: 16px; font-size: 13px; font-weight: 500;
    color: #475569; white-space: nowrap;
}

.siw-close-btn {
    width: 32px; height: 32px; border: none; background: transparent;
    color: #94a3b8; font-size: 18px; cursor: pointer; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0; margin-left: 12px;
}
.siw-close-btn:hover { background: #f1f5f9; color: #475569; }

/* ═══════════════════════════════════════════════
   MODAL BODY + FOOTER
   ═══════════════════════════════════════════════ */

.siw-modal-body {
    flex: 1; overflow-y: auto; padding: 24px; min-height: 300px;
}

.siw-modal-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
}
.siw-footer-left, .siw-footer-right {
    display: flex; align-items: center; gap: 8px;
}

/* ═══════════════════════════════════════════════
   BUTTONS (shared)
   ═══════════════════════════════════════════════ */

.siw-btn {
    padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: background 0.15s, border-color 0.15s;
    border: 1px solid transparent; white-space: nowrap;
}
.siw-btn--primary { background: #6366f1; color: #fff; border-color: #6366f1; }
.siw-btn--primary:hover { background: #4f46e5; border-color: #4f46e5; }
.siw-btn--primary:active { background: #4338ca; }
.siw-btn--secondary { background: #fff; color: #475569; border-color: #cbd5e1; }
.siw-btn--secondary:hover { background: #f1f5f9; border-color: #94a3b8; }
.siw-btn--ghost { background: transparent; color: #64748b; border-color: transparent; }
.siw-btn--ghost:hover { background: #f1f5f9; color: #475569; }
.siw-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ═══════════════════════════════════════════════
   LOADING / ERROR / SUCCESS SCREENS
   ═══════════════════════════════════════════════ */

.siw-loading {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 24px; text-align: center; color: #475569;
}
.siw-loading h3 { font-size: 16px; font-weight: 600; color: #1e293b; margin: 0 0 4px; }
.siw-loading p { font-size: 13px; color: #64748b; margin: 0; }

.siw-loading-spinner {
    width: 40px; height: 40px; border: 3px solid #e2e8f0;
    border-top-color: #6366f1; border-radius: 50%;
    animation: siw-spin 0.8s linear infinite; margin-bottom: 20px;
}
@keyframes siw-spin { to { transform: rotate(360deg); } }

.siw-error-screen {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 24px; text-align: center;
}
.siw-error-icon { font-size: 48px; margin-bottom: 16px; }
.siw-error-screen h3 { font-size: 18px; font-weight: 600; color: #991b1b; margin: 0 0 8px; }
.siw-error-screen p { font-size: 13px; color: #64748b; margin: 0 0 20px; max-width: 400px; }

.siw-success-screen {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 60px 24px; text-align: center;
}
.siw-success-icon { font-size: 64px; margin-bottom: 16px; animation: siw-bounce 0.5s ease; }
@keyframes siw-bounce { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
.siw-success-screen h3 { font-size: 20px; font-weight: 600; color: #166534; margin: 0 0 8px; }
.siw-success-screen p { font-size: 14px; color: #475569; margin: 0; }


/* ═══════════════════════════════════════════════
   STEP 1 — UPLOAD
   ═══════════════════════════════════════════════ */

.si-upload-for-tender {
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px; background: #f0f9ff; border: 1px solid #7dd3fc;
    border-radius: 8px; margin-bottom: 16px;
}
.si-upload-tender-label { font-size: 13px; color: #64748b; }
.si-upload-tender-name { font-size: 14px; font-weight: 600; color: #0369a1; }

.si-dropzone {
    border: 2px dashed #d1d5db; border-radius: 8px; padding: 48px;
    text-align: center; cursor: pointer; transition: all 0.2s;
}
.si-dropzone:hover, .si-dropzone--dragover {
    border-color: #6366f1; background: #eef2ff;
}
.si-dropzone-icon { font-size: 32px; }
.si-dropzone-content h3 { margin: 12px 0 8px; color: #374151; }
.si-dropzone-content p { margin: 0; color: #6b7280; }
.si-dropzone-hint { font-size: 12px; color: #94a3b8; margin-top: 12px !important; }

.si-file-list { margin-top: 16px; }

.si-file-item {
    display: flex; align-items: center; gap: 12px;
    padding: 12px; background: #f9fafb; border-radius: 6px; margin-bottom: 8px;
}
.si-file-icon { font-size: 24px; }
.si-file-info { flex: 1; }
.si-file-name { font-weight: 500; color: #1f2937; }
.si-file-size { font-size: 12px; color: #6b7280; }
.si-file-remove {
    background: none; border: none; font-size: 20px; color: #9ca3af;
    cursor: pointer; padding: 4px 8px;
}
.si-file-remove:hover { color: #ef4444; }

.si-upload-summary {
    display: flex; justify-content: space-between; padding: 12px;
    background: #eef2ff; border-radius: 6px; margin-top: 16px;
    color: #4338ca; font-size: 14px;
}


/* ═══════════════════════════════════════════════
   STEP 2 — ANALYSE
   ═══════════════════════════════════════════════ */

.si-analyze { text-align: center; padding: 40px 0; }
.si-analyze-spinner { margin-bottom: 24px; }

.si-spinner {
    width: 48px; height: 48px; border: 4px solid #e5e7eb;
    border-top-color: #6366f1; border-radius: 50%;
    margin: 0 auto; animation: siw-spin 1s linear infinite;
}

.si-analyze h3 { margin: 0 0 8px; color: #1f2937; }
.si-analyze > p { color: #6b7280; margin: 0 0 24px; }

.si-progress-bar {
    height: 8px; background: #e5e7eb; border-radius: 4px;
    overflow: hidden; margin: 0 40px 8px;
}
.si-progress-fill {
    height: 100%; background: #6366f1; transition: width 0.3s ease;
}
.si-progress-text { font-size: 14px; color: #6b7280; margin-bottom: 24px; }

.si-analysis-steps { text-align: left; max-width: 300px; margin: 0 auto; }
.si-analysis-step {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 0; color: #9ca3af;
}
.si-analysis-step--completed { color: #10b981; }
.si-analysis-step--in_progress { color: #6366f1; }
.si-step-icon { font-size: 16px; }


/* ═══════════════════════════════════════════════
   STEP 3 — REVIEW
   ═══════════════════════════════════════════════ */

.si-review { }

.si-stats-banner {
    background: #f0fdf4; border: 1px solid #86efac; padding: 12px 16px;
    border-radius: 6px; color: #166534; margin-bottom: 12px;
}
.si-stats-banner--warn {
    background: #fefce8; border-color: #fde047; color: #854d0e;
}
.si-confidence-summary { font-weight: normal; margin-left: 8px; }

/* Model banner */
.si-model-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 10px 16px; background: #f0fdf4; border: 1px solid #bbf7d0;
    border-radius: 6px; font-size: 14px; margin-bottom: 12px;
}
.si-model-label { color: #166534; }
.si-model-pro-badge {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
    background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e;
    border-radius: 9999px; font-size: 12px; font-weight: 600;
}
.si-btn-reanalyze {
    display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;
    background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white;
    border: none; border-radius: 6px; font-size: 13px; font-weight: 500;
    cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(124,58,237,0.3);
}
.si-btn-reanalyze:hover {
    background: linear-gradient(135deg, #6d28d9, #5b21b6);
    transform: translateY(-1px); box-shadow: 0 4px 6px rgba(124,58,237,0.4);
}

/* Add document banner */
.si-add-doc-banner {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 16px; background: #eff6ff; border: 1px solid #bfdbfe;
    border-radius: 6px; color: #1e40af; font-size: 14px; margin-bottom: 12px;
}
.si-btn-add-doc {
    display: inline-flex; align-items: center; gap: 4px; padding: 8px 16px;
    background: #3b82f6; color: white; border: none; border-radius: 6px;
    font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap;
}
.si-btn-add-doc:hover { background: #2563eb; }

/* Mini upload */
.si-mini-upload {
    margin-bottom: 24px; padding: 16px; background: #f8fafc;
    border: 1px solid #e2e8f0; border-radius: 8px;
}
.si-mini-upload-header {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
}
.si-mini-upload-header h4 { margin: 0; color: #1f2937; }
.si-mini-close {
    background: none; border: none; font-size: 20px; cursor: pointer; color: #9ca3af;
}
.si-mini-dropzone {
    border: 2px dashed #cbd5e1; border-radius: 6px; padding: 24px;
    text-align: center; cursor: pointer; transition: all 0.2s;
}
.si-mini-dropzone:hover, .si-mini-dropzone.si-dropzone--dragover {
    border-color: #6366f1; background: #eef2ff;
}
.si-mini-dropzone p { margin: 0; color: #64748b; font-size: 14px; }
.si-mini-file-list { margin-top: 12px; }
.si-mini-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.si-doc-badge {
    background: #dbeafe; color: #1e40af; padding: 2px 8px;
    border-radius: 4px; font-size: 11px; font-weight: 500;
}

/* Review sections + field grid */
.si-review-sections { margin-top: 20px; }

.si-section { margin-bottom: 24px; }
.si-section h4 {
    margin: 0 0 12px; padding-bottom: 8px;
    border-bottom: 1px solid #e5e7eb; color: #374151;
}

.si-field-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
.si-field-grid--planning { grid-template-columns: repeat(3, 1fr); }

.si-field-group { display: flex; flex-direction: column; gap: 4px; }

.si-field-label {
    font-size: 13px; color: #6b7280;
    display: flex; align-items: center; gap: 6px;
}
.si-confidence-badge { cursor: help; }

.si-field-input {
    padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;
    width: 100%; box-sizing: border-box;
}
.si-field-input:focus {
    outline: none; border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

/* Empty field */
.si-field-group--empty .si-field-input,
.si-field--empty {
    border-color: #fca5a5; background: #fef2f2;
}
.si-field--empty::placeholder { color: #dc2626; font-style: italic; }

/* Confidence colors */
.si-field-group--high .si-field-input { border-color: #86efac; background: #f0fdf4; }
.si-field-group--medium .si-field-input { border-color: #fcd34d; background: #fefce8; }
.si-field-group--low .si-field-input { border-color: #fca5a5; background: #fef2f2; }

.si-no-data { color: #9ca3af; font-style: italic; }

/* Gunningscriteria */
.si-criteria-list { display: flex; flex-direction: column; gap: 8px; }
.si-criteria-item {
    display: flex; align-items: center; gap: 12px;
    padding: 8px 12px; background: #f9fafb; border-radius: 4px;
}
.si-criteria-code {
    background: #6366f1; color: white; padding: 2px 8px;
    border-radius: 4px; font-size: 12px; font-weight: 500;
}
.si-criteria-name { flex: 1; }
.si-criteria-weight { font-weight: 600; color: #6366f1; }

/* Documents */
.si-doc-list { display: flex; flex-direction: column; gap: 8px; }
.si-doc-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; background: #f9fafb; border-radius: 4px;
}

/* Warnings */
.si-warnings {
    margin-top: 16px; padding: 12px 16px;
    background: #fefce8; border: 1px solid #fde047; border-radius: 6px;
}
.si-warnings h4 { margin: 0 0 8px; color: #854d0e; }
.si-warnings ul { margin: 0; padding-left: 20px; color: #713f12; font-size: 14px; }

/* Legend */
.si-legend {
    display: flex; gap: 16px; padding-top: 16px;
    border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;
}


/* ═══════════════════════════════════════════════
   RESPONSIVE
   ═══════════════════════════════════════════════ */

@media (max-width: 640px) {
    .siw-modal {
        width: 100vw; max-width: 100vw; max-height: 100vh;
        border-radius: 0; height: 100vh;
    }
    .siw-modal-header { padding: 12px 16px; }
    .siw-step-label { display: none; }
    .siw-modal-body { padding: 16px; }
    .siw-modal-footer { padding: 12px 16px; }
    .siw-btn { padding: 8px 14px; font-size: 12px; }

    .si-field-grid, .si-field-grid--planning { grid-template-columns: 1fr; }
    .si-add-doc-banner { flex-direction: column; text-align: center; }
    .si-model-banner { flex-direction: column; gap: 8px; }
    .si-dropzone { padding: 32px 16px; }
}
`;
}