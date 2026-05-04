// ================================================================
// TenderZen — Smart Import Wizard v5.1 — Styles
// Frontend/js/components/smart-import/SmartImportStyles.js
// Bestandsnaam: SmartImportStyles_20260311_1700.js
// Versie: 3.1 — TCC Design System + Header + Tabs
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
body.siw-open { overflow: hidden; }

.siw-backdrop {
    position: fixed; inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    z-index: 9000;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.25s ease;
}
.siw-backdrop--visible { opacity: 1; }

.siw-modal {
    position: relative; background: #fff; border-radius: 16px;
    box-shadow: 0 25px 60px rgba(0,0,0,0.3);
    width: 94vw; max-width: 1060px; height: 92vh;
    display: flex; flex-direction: column; overflow: hidden;
    animation: siw-modal-in 0.35s cubic-bezier(0.16,1,0.3,1);
}
@keyframes siw-modal-in {
    from { opacity:0; transform: translateY(30px) scale(0.98); }
    to { opacity:1; transform: translateY(0) scale(1); }
}

/* HEADER */
.siw-header { flex-shrink:0; background: linear-gradient(135deg,#f8fafc,#f1f5f9); border-bottom:1px solid #e2e8f0; padding:18px 28px 0; }
.siw-header-top { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:14px; }
.siw-header-left { display:flex; gap:14px; align-items:flex-start; }
.siw-header-icon { width:44px; height:44px; background:linear-gradient(135deg,#6366f1,#8b5cf6); border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 2px 8px rgba(99,102,241,0.3); }
.siw-header-info h2 { font-size:17px; font-weight:700; color:#0f172a; margin:0 0 4px; }
.siw-header-meta { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.siw-meta-tag { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:6px; font-size:12px; font-weight:600; white-space:nowrap; }
.siw-meta-tag--tender { background:#fef3c7; color:#92400e; max-width:320px; overflow:hidden; text-overflow:ellipsis; }
.siw-meta-tag--info { background:#eef2ff; color:#4338ca; }
.siw-meta-tag--files { background:#eef2ff; color:#4338ca; }
.siw-meta-tag--model { background:#f0fdf4; color:#166534; }
.siw-close-btn { width:34px; height:34px; border:1px solid #e2e8f0; border-radius:8px; background:white; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; flex-shrink:0; }
.siw-close-btn:hover { background:#f1f5f9; color:#1e293b; }

/* TABS */
.siw-tabs { display:flex; gap:0; overflow-x:auto; -webkit-overflow-scrolling:touch; }
.siw-tabs::-webkit-scrollbar { height:0; }
.siw-tab { padding:11px 20px; font-size:14px; font-weight:600; color:#94a3b8; cursor:default; border:none; background:transparent; border-bottom:2px solid transparent; transition:all 0.15s; display:flex; align-items:center; gap:8px; font-family:inherit; white-space:nowrap; flex-shrink:0; }
.siw-tab.is-active { color:#4338ca; border-bottom-color:#6366f1; }
.siw-tab.is-done { color:#22c55e; }
.siw-tab-icon { display:inline-flex; align-items:center; justify-content:center; }
.siw-tab-badge { font-size:10px; font-weight:700; padding:1px 6px; border-radius:10px; }
.siw-tab-badge--done { background:#f0fdf4; color:#166534; }

/* BODY */
.siw-body { flex:1; overflow-y:auto; padding:24px 28px; min-height:0; }
.siw-body::-webkit-scrollbar { width:6px; }
.siw-body::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:3px; }

/* FOOTER */
.siw-footer { display:flex; align-items:center; justify-content:space-between; padding:14px 28px; background:#fafbfd; border-top:1px solid #e2e8f0; flex-shrink:0; }
.siw-footer-left, .siw-footer-right { display:flex; align-items:center; gap:8px; }

/* BUTTONS */
.siw-btn { padding:9px 18px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.15s; border:none; white-space:nowrap; display:inline-flex; align-items:center; gap:6px; font-family:inherit; }
.siw-btn--primary { background:linear-gradient(135deg,#6366f1,#7c3aed); color:white; box-shadow:0 2px 6px rgba(99,102,241,0.3); }
.siw-btn--primary:hover { box-shadow:0 4px 12px rgba(99,102,241,0.4); transform:translateY(-1px); }
.siw-btn--secondary { background:#eef2ff; color:#4338ca; border:1px solid #c7d2fe; }
.siw-btn--secondary:hover { background:#e0e7ff; }
.siw-btn--ghost { background:transparent; color:#64748b; border:1px solid #e2e8f0; }
.siw-btn--ghost:hover { background:#f1f5f9; color:#1e293b; }
.siw-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none !important; }
.siw-btn-spinner { display:inline-block; width:16px; height:16px; border:2px solid rgba(255,255,255,0.3); border-top-color:white; border-radius:50%; animation:siw-spin 0.6s linear infinite; }

/* SCREENS */
.siw-loading { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 24px; text-align:center; }
.siw-loading p { font-size:15px; color:#64748b; margin:0; }
.siw-loading-spinner { width:44px; height:44px; border:3px solid #e2e8f0; border-top-color:#6366f1; border-radius:50%; animation:siw-spin 0.8s linear infinite; margin-bottom:20px; }
@keyframes siw-spin { to { transform:rotate(360deg); } }

.siw-error-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 24px; text-align:center; }
.siw-error-icon { margin-bottom:16px; }
.siw-error-screen h3 { font-size:20px; font-weight:700; color:#dc2626; margin:0 0 8px; }
.siw-error-screen p { font-size:15px; color:#64748b; margin:0 0 24px; max-width:420px; line-height:1.5; }

.siw-success-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:80px 24px; text-align:center; }
.siw-success-icon { margin-bottom:16px; animation:siw-bounce 0.5s ease; }
@keyframes siw-bounce { 0%,100% { transform:scale(1); } 50% { transform:scale(1.15); } }
.siw-success-screen h3 { font-size:22px; font-weight:700; color:#166534; margin:0 0 8px; }
.siw-success-name { font-size:16px; font-weight:500; color:#1e293b; margin:0 0 8px; }
.siw-success-hint { font-size:13px; color:#94a3b8; margin:0; }

/* UPLOAD STEP */
.si-upload-for-tender { display:flex; align-items:center; gap:10px; padding:14px 18px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; margin-bottom:18px; }
.si-upload-tender-label { font-size:14px; color:#64748b; }
.si-upload-tender-name { font-size:15px; font-weight:600; color:#1e40af; }
.si-dropzone { border:2px dashed #c7d2fe; border-radius:14px; padding:56px 24px; text-align:center; cursor:pointer; transition:all 0.2s; background:linear-gradient(135deg,#fafaff 0%,#f5f3ff 100%); }
.si-dropzone:hover, .si-dropzone--dragover { border-color:#818cf8; background:linear-gradient(135deg,#f5f3ff 0%,#eef2ff 100%); }
.si-dropzone--dragover { border-color:#6366f1; transform:scale(1.01); }
.si-dropzone-icon { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg,#eef2ff,#e0e7ff); display:flex; align-items:center; justify-content:center; margin:0 auto 16px; font-size:26px; }
.si-dropzone-content h3 { margin:0 0 6px; font-size:17px; font-weight:700; color:#1e293b; }
.si-dropzone-content p { margin:0; font-size:15px; color:#64748b; }
.si-dropzone-hint { font-size:13px; color:#94a3b8; margin-top:14px !important; }
.si-file-list { margin-top:18px; display:flex; flex-direction:column; gap:8px; }
.si-file-item { display:flex; align-items:center; gap:14px; padding:14px 18px; background:white; border:1px solid #e2e8f0; border-radius:10px; transition:all 0.15s; }
.si-file-item:hover { border-color:#cbd5e1; box-shadow:0 2px 6px rgba(0,0,0,0.04); }
.si-file-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; background:#fef2f2; font-size:22px; flex-shrink:0; }
.si-file-info { flex:1; min-width:0; }
.si-file-name { font-size:14px; font-weight:600; color:#1e293b; }
.si-bestand-naam-input { width:100%; font-size:13px; font-weight:600; color:#1e293b; border:1px solid #e2e8f0; border-radius:6px; padding:3px 8px; background:#f8fafc; outline:none; transition:border-color 0.15s; box-sizing:border-box; }
.si-bestand-naam-input:focus { border-color:#818cf8; background:white; }
.si-file-size { font-size:12px; color:#94a3b8; margin-top:2px; }
.si-file-remove { width:32px; height:32px; border-radius:8px; border:1px solid #e2e8f0; background:white; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px; color:#94a3b8; transition:all 0.15s; }
.si-file-remove:hover { background:#fef2f2; border-color:#fecaca; color:#dc2626; }
.si-upload-summary { display:flex; justify-content:space-between; padding:14px 18px; background:#eef2ff; border:1px solid #c7d2fe; border-radius:10px; margin-top:18px; color:#4338ca; font-size:14px; font-weight:500; }

/* ANALYSE STEP */
.si-analyze { text-align:center; padding:60px 0; }
.si-analyze-spinner { margin-bottom:28px; }
.si-spinner { width:52px; height:52px; border:4px solid #e2e8f0; border-top-color:#6366f1; border-radius:50%; margin:0 auto; animation:siw-spin 0.8s linear infinite; }
.si-analyze h3 { margin:0 0 8px; font-size:19px; font-weight:700; color:#1e293b; }
.si-analyze > p { color:#64748b; font-size:15px; margin:0 0 28px; }
.si-progress-bar { height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; margin:0 60px 10px; }
.si-progress-fill { height:100%; background:linear-gradient(90deg,#6366f1,#8b5cf6); border-radius:4px; transition:width 0.3s ease; }
.si-progress-text { font-size:14px; font-weight:600; color:#4338ca; margin-bottom:28px; }
.si-analysis-steps { text-align:left; max-width:340px; margin:0 auto; }
.si-analysis-step { display:flex; align-items:center; gap:12px; padding:10px 0; color:#94a3b8; font-size:14px; }
.si-analysis-step--completed { color:#22c55e; font-weight:500; }
.si-analysis-step--in_progress { color:#6366f1; font-weight:600; }
.si-step-icon { font-size:18px; flex-shrink:0; }

/* REVIEW STEP */
.si-review { }
.si-stats-banner { display:flex; align-items:center; gap:10px; padding:14px 18px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; color:#166534; font-size:14px; margin-bottom:16px; }
.si-stats-banner--warn { background:#fffbeb; border-color:#fcd34d; color:#92400e; }
.si-confidence-summary { font-weight:normal; margin-left:8px; }
.si-model-banner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 18px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; font-size:14px; margin-bottom:16px; }
.si-model-label { color:#166534; font-weight:500; }
.si-model-pro-badge { display:inline-flex; align-items:center; gap:4px; padding:4px 12px; background:linear-gradient(135deg,#fef3c7,#fde68a); color:#92400e; border-radius:20px; font-size:12px; font-weight:600; }
.si-btn-reanalyze { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; background:linear-gradient(135deg,#6366f1,#7c3aed); color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.15s; box-shadow:0 2px 6px rgba(99,102,241,0.3); }
.si-btn-reanalyze:hover { box-shadow:0 4px 12px rgba(99,102,241,0.4); transform:translateY(-1px); }
.si-add-doc-banner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 18px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; color:#1e40af; font-size:14px; margin-bottom:16px; }
.si-btn-add-doc { display:inline-flex; align-items:center; gap:6px; padding:9px 18px; background:linear-gradient(135deg,#6366f1,#7c3aed); color:white; border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; white-space:nowrap; transition:all 0.15s; box-shadow:0 2px 6px rgba(99,102,241,0.3); }
.si-btn-add-doc:hover { box-shadow:0 4px 12px rgba(99,102,241,0.4); transform:translateY(-1px); }
.si-mini-upload { margin-bottom:20px; padding:18px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; }
.si-mini-upload-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.si-mini-upload-header h4 { margin:0; font-size:15px; font-weight:600; color:#1e293b; }
.si-mini-close { width:30px; height:30px; border:1px solid #e2e8f0; border-radius:8px; background:white; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:18px; color:#94a3b8; transition:all 0.15s; }
.si-mini-close:hover { background:#fef2f2; border-color:#fecaca; color:#dc2626; }
.si-mini-dropzone { border:2px dashed #c7d2fe; border-radius:10px; padding:28px; text-align:center; cursor:pointer; transition:all 0.2s; background:linear-gradient(135deg,#fafaff,#f5f3ff); }
.si-mini-dropzone:hover, .si-mini-dropzone.si-dropzone--dragover { border-color:#818cf8; background:linear-gradient(135deg,#f5f3ff,#eef2ff); }
.si-mini-dropzone p { margin:0; color:#64748b; font-size:14px; }
.si-mini-file-list { margin-top:14px; }
.si-mini-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:14px; }
.si-doc-badge { display:inline-flex; align-items:center; gap:3px; background:#eef2ff; color:#4338ca; padding:3px 10px; border-radius:6px; font-size:11px; font-weight:600; }
.si-review-sections { margin-top:18px; }
.si-section { margin-bottom:14px; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; transition:box-shadow 0.2s; }
.si-section:hover { box-shadow:0 2px 8px rgba(0,0,0,0.04); }
.si-section h4 { display:flex; align-items:center; gap:10px; margin:0; padding:14px 20px; background:#f8fafc; font-size:15px; font-weight:600; color:#1e293b; border-bottom:1px solid #e2e8f0; }
.si-field-grid { display:grid; grid-template-columns:1fr 1fr; gap:0; }
.si-field-grid--planning { grid-template-columns:repeat(3,1fr); }
.si-field-group { display:flex; flex-direction:column; gap:5px; padding:14px 20px; border-bottom:1px solid #f1f5f9; }
.si-field-grid .si-field-group:nth-child(odd) { border-right:1px solid #f1f5f9; }
.si-field-grid--planning .si-field-group:nth-child(3n+1), .si-field-grid--planning .si-field-group:nth-child(3n+2) { border-right:1px solid #f1f5f9; }
.si-field-grid--planning .si-field-group:nth-child(3n) { border-right:none; }
.si-field-label { font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.3px; display:flex; align-items:center; gap:5px; }
.si-confidence-badge { cursor:help; }
.si-field-input { padding:10px 14px; border:1px solid #e2e8f0; border-radius:8px; font-size:15px; font-weight:500; color:#1e293b; width:100%; box-sizing:border-box; transition:border-color 0.15s,box-shadow 0.15s; }
.si-field-input:focus { outline:none; border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
.si-field-group--empty .si-field-input, .si-field--empty { border-color:#fca5a5; background:#fef2f2; }
.si-field--empty::placeholder { color:#dc2626; font-style:italic; }
.si-field-group--high .si-field-input { border-color:#86efac; background:#f0fdf4; }
.si-field-group--medium .si-field-input { border-color:#fcd34d; background:#fffbeb; }
.si-field-group--low .si-field-input { border-color:#fca5a5; background:#fef2f2; }
.si-no-data { color:#94a3b8; font-style:italic; padding:14px 20px; font-size:14px; }
.si-criteria-list { display:flex; flex-direction:column; gap:0; }
.si-criteria-item { display:flex; align-items:center; gap:12px; padding:12px 20px; border-bottom:1px solid #f1f5f9; }
.si-criteria-item:last-child { border-bottom:none; }
.si-criteria-code { background:linear-gradient(135deg,#6366f1,#7c3aed); color:white; padding:3px 10px; border-radius:6px; font-size:12px; font-weight:700; }
.si-criteria-name { flex:1; font-size:14px; color:#1e293b; }
.si-criteria-weight { font-weight:700; color:#4338ca; font-size:14px; }
.si-doc-list { display:flex; flex-direction:column; gap:0; }
.si-doc-item { display:flex; align-items:center; gap:10px; padding:12px 20px; border-bottom:1px solid #f1f5f9; font-size:14px; color:#1e293b; }
.si-doc-item:last-child { border-bottom:none; }
.si-warnings { margin-top:18px; padding:16px 18px; background:#fffbeb; border:1px solid #fcd34d; border-radius:10px; }
.si-warnings h4 { margin:0 0 8px; padding:0; background:none; border:none; font-size:14px; font-weight:600; color:#92400e; }
.si-warnings ul { margin:0; padding-left:20px; color:#78350f; font-size:14px; line-height:1.7; }
.si-legend { display:flex; gap:16px; padding:14px 20px; border-top:1px solid #e2e8f0; font-size:12px; color:#94a3b8; }

/* BASICINFO STEP */
.si-basic-info { }
.si-basic-info-form { display: flex; flex-direction: column; gap: 18px; }
.si-basic-field { display: flex; flex-direction: column; gap: 4px; }
.si-basic-field--half { flex: 1; min-width: 0; }
.si-basic-row { display: flex; gap: 14px; }
.si-basic-readonly {
    padding: 10px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 14px;
    color: #475569;
}
.si-model-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.si-model-optie { cursor: pointer; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; transition: border-color 0.15s, box-shadow 0.15s; }
.si-model-optie:hover { border-color: #a5b4fc; }
.si-model-optie--actief { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); background: #fafafe; }
@media (max-width:700px) { .si-model-grid { grid-template-columns: repeat(2, 1fr); } }

@media (max-width:700px) {
    .siw-modal { width:100vw; height:100vh; border-radius:0; max-width:100vw; }
    .siw-header { padding:14px 16px 0; }
    .siw-header-info h2 { font-size:15px; }
    .siw-tabs { overflow-x:auto; }
    .siw-tab { padding:10px 14px; font-size:13px; }
    .siw-body { padding:16px; }
    .siw-footer { padding:12px 16px; }
    .siw-btn { padding:8px 14px; font-size:13px; }
    .si-field-grid, .si-field-grid--planning { grid-template-columns:1fr; }
    .si-field-grid .si-field-group:nth-child(odd) { border-right:none; }
    .si-add-doc-banner { flex-direction:column; text-align:center; }
    .si-model-banner { flex-direction:column; gap:8px; }
    .si-dropzone { padding:36px 16px; }
}
`;
}