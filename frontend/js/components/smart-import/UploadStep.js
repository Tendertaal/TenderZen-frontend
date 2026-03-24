// ================================================================
// TenderZen — Smart Import v4.1 — Stap 1: Upload
// Frontend/js/components/smart-import/UploadStep.js
// Datum: 2026-03-11
// ================================================================
//
// CHANGELOG v4.1:
// - Alle emoji's vervangen door SVG iconen uit window.Icons
// - Icon helper met fallback naar emoji als Icons niet geladen
// - Consistent met TCC design system
//
// Drag & drop file upload met validatie.
// Accepteert PDF, DOCX, ZIP bestanden (max 25MB, max 10 stuks).
//
// State die gelezen wordt:
//   - state.tenderId, state.tenderNaam (optioneel, voor header)
//   - state.uploadedFiles (array)
//
// State die geschreven wordt:
//   - state.uploadedFiles (array van { name, size, type, file })
// ================================================================

const MAX_FILE_SIZE = 25 * 1024 * 1024;  // 25 MB
const MAX_FILES = 10;
const VALID_EXTENSIONS = /\.(pdf|docx|zip)$/i;
const VALID_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed'
];

// ── Icon helper met fallback ──
const _getIcon = (name, opts = {}) => {
    const Icons = window.Icons || {};
    if (Icons[name] && typeof Icons[name] === 'function') return Icons[name](opts);
    const fallbacks = {
        upload: '📤', fileText: '📄', clipboardList: '📋',
        download: '📦', close: '×', warning: '⚠️',
        checkCircle: '✓', info: 'ℹ'
    };
    return fallbacks[name] || '';
};


export class UploadStep {

    constructor(wizardState) {
        this.state = wizardState;
    }

    // ── Interface ──

    async init() {
        // Noop — geen async initialisatie nodig
    }

    render() {
        const files = this.state.uploadedFiles || [];

        // v3.6: Header voor bestaande tender
        const tenderHeader = (this.state.tenderId && this.state.tenderNaam)
            ? `<div class="si-upload-for-tender">
                   <span class="si-upload-tender-label">
                       ${_getIcon('clipboardList', { size: 16, color: '#0d9488' })}
                       Documenten voor:
                   </span>
                   <span class="si-upload-tender-name">${this._esc(this.state.tenderNaam)}</span>
               </div>`
            : '';

        return `
            <div class="si-upload">
                ${tenderHeader}

                <div class="si-dropzone" id="siDropzone">
                    <div class="si-dropzone-content">
                        <span class="si-dropzone-icon">
                            ${_getIcon('upload', { size: 40, color: '#0d9488' })}
                        </span>
                        <h3>Sleep bestanden hierheen</h3>
                        <p>of klik om te selecteren</p>
                        <p class="si-dropzone-hint">PDF, DOCX of ZIP · Max 25 MB per bestand · Max 10 bestanden</p>
                    </div>
                    <input type="file" id="siFileInput" multiple
                           accept=".pdf,.docx,.zip" style="display:none">
                </div>

                <div class="si-file-list" id="siFileList">
                    ${files.length > 0 ? this._renderFileList(files) : ''}
                </div>

                ${files.length > 0 ? `
                    <div class="si-upload-summary" id="siUploadSummary">
                        <span>${files.length} bestand${files.length !== 1 ? 'en' : ''} geselecteerd</span>
                        <span>${this._formatBytes(files.reduce((s, f) => s + f.size, 0))}</span>
                    </div>
                ` : ''}

                <div class="si-upload-skip" style="text-align:center;padding:16px 0 0;">
                    <button class="siw-btn siw-btn--ghost" data-action="si-skip-upload" style="color:#6366f1;font-size:13px;">
                        Geen documenten? Sla over en maak de tender direct aan →
                    </button>
                </div>
            </div>
        `;
    }

    attachListeners(container) {
        const dropzone = container.querySelector('#siDropzone');
        const fileInput = container.querySelector('#siFileInput');

        if (!dropzone || !fileInput) return;

        // Click → open file picker
        dropzone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            this._handleFiles(e.target.files, container);
        });

        // Drag & drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('si-dropzone--dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('si-dropzone--dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('si-dropzone--dragover');
            this._handleFiles(e.dataTransfer.files, container);
        });

        // Remove buttons
        this._attachRemoveListeners(container);
    }

    validate() {
        const files = this.state.uploadedFiles || [];
        if (files.length === 0) {
            alert('Upload minimaal één document om door te gaan.');
            return false;
        }
        return true;
    }

    getData() {
        return {
            uploadedFiles: this.state.uploadedFiles || []
        };
    }

    // ── File handling ──

    _handleFiles(fileList, container) {
        const files = this.state.uploadedFiles;

        for (const file of fileList) {
            if (files.length >= MAX_FILES) {
                alert(`Maximaal ${MAX_FILES} bestanden toegestaan`);
                break;
            }

            if (!VALID_MIME_TYPES.includes(file.type) && !VALID_EXTENSIONS.test(file.name)) {
                alert(`Ongeldig bestandstype: ${file.name}`);
                continue;
            }

            if (file.size > MAX_FILE_SIZE) {
                alert(`Bestand te groot: ${file.name} (max 25 MB)`);
                continue;
            }

            // Duplicaat check
            if (files.some(f => f.name === file.name)) {
                continue;
            }

            files.push({
                name: file.name,
                size: file.size,
                type: file.type,
                file: file
            });
        }

        this._updateUI(container);
    }

    _updateUI(container) {
        const files = this.state.uploadedFiles;
        const fileListEl = container.querySelector('#siFileList');

        if (fileListEl) {
            fileListEl.innerHTML = files.length > 0
                ? this._renderFileList(files)
                : '';
            this._attachRemoveListeners(container);
        }

        // Update summary
        let summary = container.querySelector('#siUploadSummary');
        if (files.length > 0) {
            const html = `
                <span>${files.length} bestand${files.length !== 1 ? 'en' : ''} geselecteerd</span>
                <span>${this._formatBytes(files.reduce((s, f) => s + f.size, 0))}</span>
            `;
            if (summary) {
                summary.innerHTML = html;
            } else {
                container.querySelector('.si-upload')?.insertAdjacentHTML('beforeend',
                    `<div class="si-upload-summary" id="siUploadSummary">${html}</div>`
                );
            }
        } else if (summary) {
            summary.remove();
        }
    }

    _attachRemoveListeners(container) {
        container.querySelectorAll('.si-file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                this.state.uploadedFiles.splice(idx, 1);
                this._updateUI(container);
            });
        });
    }

    // ── Rendering helpers ──

    _renderFileList(files) {
        return files.map((file, i) => `
            <div class="si-file-item">
                <span class="si-file-icon">${this._fileIcon(file.name)}</span>
                <div class="si-file-info">
                    <div class="si-file-name">${this._esc(file.name)}</div>
                    <div class="si-file-size">${this._formatBytes(file.size)}</div>
                </div>
                <button class="si-file-remove" data-index="${i}" title="Verwijderen">
                    ${_getIcon('close', { size: 16, color: '#dc2626' })}
                </button>
            </div>
        `).join('');
    }

    // ── Utilities ──

    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    _fileIcon(name) {
        const ext = name.split('.').pop().toLowerCase();
        const iconMap = {
            pdf:  () => _getIcon('fileText', { size: 18, color: '#4f46e5' }),
            docx: () => _getIcon('fileText', { size: 18, color: '#4f46e5' }),
            doc:  () => _getIcon('fileText', { size: 18, color: '#4f46e5' }),
            zip:  () => _getIcon('download', { size: 18, color: '#2563eb' })
        };
        return (iconMap[ext] || (() => _getIcon('fileText', { size: 18, color: '#64748b' })))();
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
}