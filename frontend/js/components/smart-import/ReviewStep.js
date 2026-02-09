// ================================================================
// TenderZen — Smart Import v4.0 — Stap 3: Controleer
// Frontend/js/components/smart-import/ReviewStep.js
// Datum: 2026-02-09
// ================================================================
//
// Review en bewerk de AI-geëxtraheerde metadata.
// Toont velden met confidence-indicators en de mogelijkheid
// om opnieuw te analyseren met het Pro model of een extra
// document toe te voegen.
//
// State die gelezen wordt:
//   - state.extractedData     (AI resultaten)
//   - state.editedData        (handmatige aanpassingen)
//   - state.currentModel      (haiku / sonnet)
//   - state.uploadedFiles     (voor documentenlijst)
//   - state.importId
//   - state._navigateTo       (callback)
//
// State die geschreven wordt:
//   - state.editedData        (veld-wijzigingen)
//   - state._reanalyzeMode    (trigger voor AnalyzeStep)
//   - state._mergeMode        (trigger voor AnalyzeStep)
//   - state._additionalFiles  (extra bestanden)
// ================================================================

export class ReviewStep {

    constructor(wizardState) {
        this.state = wizardState;
        this.additionalFiles = [];
    }

    // ── Interface ──

    async init() {
        // Data komt uit state.extractedData (gezet door AnalyzeStep)
    }

    render() {
        const data = this.state.extractedData;
        if (!data) {
            return '<div class="si-review"><p style="color:#64748b;">Geen data beschikbaar</p></div>';
        }

        const stats = this._calcStats();
        const hasEmpty = stats.total > stats.extracted;
        const model = this.state.currentModel || 'haiku';

        return `
            <div class="si-review">
                <!-- Stats banner -->
                <div class="si-stats-banner ${hasEmpty ? 'si-stats-banner--warn' : ''}">
                    ✅ <strong>${stats.extracted}</strong> van <strong>${stats.total}</strong> velden automatisch ingevuld
                    <span class="si-confidence-summary">
                        (🟢 ${stats.high} hoog · 🟡 ${stats.medium} gemiddeld · 🔴 ${stats.low} laag)
                    </span>
                </div>

                <!-- Model info + reanalyze -->
                <div class="si-model-banner">
                    <span class="si-model-label">
                        🤖 Geanalyseerd met: <strong>${model === 'sonnet' ? 'Pro (Sonnet)' : 'Standaard (Haiku)'}</strong>
                    </span>
                    ${model !== 'sonnet' ? `
                        <button class="si-btn-reanalyze" id="siReanalyzeBtn">
                            ⚡ Opnieuw analyseren met Pro
                        </button>
                    ` : `
                        <span class="si-model-pro-badge">✨ Pro analyse</span>
                    `}
                </div>

                <!-- Extra document banner -->
                ${hasEmpty ? `
                    <div class="si-add-doc-banner">
                        <span>📄 Ontbreken er gegevens? Upload een extra document om de analyse aan te vullen.</span>
                        <button class="si-btn-add-doc" id="siAddDocBtn">
                            ➕ Extra document toevoegen
                        </button>
                    </div>
                ` : ''}

                <!-- Mini upload (hidden) -->
                <div class="si-mini-upload" id="siMiniUpload" style="display:none;">
                    <div class="si-mini-upload-header">
                        <h4>📄 Extra document toevoegen</h4>
                        <button class="si-mini-close" id="siMiniClose">&times;</button>
                    </div>
                    <div class="si-mini-dropzone" id="siMiniDropzone">
                        <p>Sleep een extra document hierheen of klik om te selecteren</p>
                        <p class="si-dropzone-hint">De nieuwe data wordt samengevoegd met de bestaande analyse</p>
                        <input type="file" id="siMiniFileInput" accept=".pdf,.docx" style="display:none">
                    </div>
                    <div class="si-mini-file-list" id="siMiniFileList"></div>
                    <div class="si-mini-actions" id="siMiniActions" style="display:none;">
                        <button class="siw-btn siw-btn--ghost" id="siMiniCancel">Annuleren</button>
                        <button class="siw-btn siw-btn--primary" id="siMiniStart">🔍 Analyseren & Samenvoegen</button>
                    </div>
                </div>

                <!-- Velden -->
                <div class="si-review-sections">
                    ${this._renderBasisgegevens()}
                    ${this._renderPlanning()}
                    ${this._renderGunningscriteria()}
                    ${this._renderDocumenten()}
                </div>

                <!-- Warnings -->
                ${data.warnings?.length > 0 ? `
                    <div class="si-warnings">
                        <h4>⚠️ Opmerkingen</h4>
                        <ul>${data.warnings.map(w => `<li>${w}</li>`).join('')}</ul>
                    </div>
                ` : ''}

                <!-- Legenda -->
                <div class="si-legend">
                    <span>🟢 Hoge zekerheid (&gt;85%)</span>
                    <span>🟡 Gemiddeld (50-85%)</span>
                    <span>🔴 Lage zekerheid (&lt;50%)</span>
                </div>
            </div>
        `;
    }

    attachListeners(container) {
        // Field changes
        container.querySelectorAll('.si-field-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.state.editedData[e.target.dataset.field] = e.target.value;
            });
        });

        // Reanalyze with Pro
        container.querySelector('#siReanalyzeBtn')?.addEventListener('click', () => {
            this._startReanalyze();
        });

        // Add document
        const addBtn = container.querySelector('#siAddDocBtn');
        const miniUpload = container.querySelector('#siMiniUpload');

        addBtn?.addEventListener('click', () => {
            if (miniUpload) miniUpload.style.display = 'block';
            if (addBtn) addBtn.style.display = 'none';
        });

        // Mini upload: close / cancel
        const closeMini = () => {
            if (miniUpload) miniUpload.style.display = 'none';
            if (addBtn) addBtn.style.display = 'inline-flex';
            this.additionalFiles = [];
            this._updateMiniFileList(container);
        };

        container.querySelector('#siMiniClose')?.addEventListener('click', closeMini);
        container.querySelector('#siMiniCancel')?.addEventListener('click', closeMini);

        // Mini dropzone
        const miniDz = container.querySelector('#siMiniDropzone');
        const miniInput = container.querySelector('#siMiniFileInput');

        miniDz?.addEventListener('click', () => miniInput?.click());

        miniInput?.addEventListener('change', (e) => {
            this._handleMiniFiles(e.target.files, container);
        });

        miniDz?.addEventListener('dragover', (e) => {
            e.preventDefault();
            miniDz.classList.add('si-dropzone--dragover');
        });
        miniDz?.addEventListener('dragleave', () => {
            miniDz.classList.remove('si-dropzone--dragover');
        });
        miniDz?.addEventListener('drop', (e) => {
            e.preventDefault();
            miniDz.classList.remove('si-dropzone--dragover');
            this._handleMiniFiles(e.dataTransfer.files, container);
        });

        // Start mini analysis
        container.querySelector('#siMiniStart')?.addEventListener('click', () => {
            this._startAdditionalAnalysis();
        });
    }

    validate() {
        // Minimaal een naam is wenselijk maar niet verplicht
        // (de wizard laat altijd door naar stap 4)
        return true;
    }

    getData() {
        return {
            editedData: { ...this.state.editedData },
            extractedData: this.state.extractedData
        };
    }

    // ══════════════════════════════════════════════
    // VELD RENDERING
    // ══════════════════════════════════════════════

    _renderBasisgegevens() {
        const data = this.state.extractedData?.basisgegevens || {};
        const fields = [
            { key: 'naam', label: 'Tendernaam', type: 'text' },
            { key: 'opdrachtgever', label: 'Opdrachtgever', type: 'text' },
            { key: 'aanbestedende_dienst', label: 'Aanbestedende dienst', type: 'text' },
            { key: 'tender_nummer', label: 'Tendernummer', type: 'text' },
            { key: 'type', label: 'Type', type: 'select', options: [
                { value: 'europese_aanbesteding', label: 'Europese aanbesteding' },
                { value: 'nationale_aanbesteding', label: 'Nationale aanbesteding' },
                { value: 'meervoudig_onderhands', label: 'Meervoudig onderhands' },
                { value: 'enkelvoudig_onderhands', label: 'Enkelvoudig onderhands' }
            ]},
            { key: 'geraamde_waarde', label: 'Geraamde waarde (€)', type: 'number' },
            { key: 'locatie', label: 'Locatie', type: 'text' },
            { key: 'tenderned_url', label: 'TenderNed URL', type: 'text' }
        ];

        return `
            <div class="si-section">
                <h4>Basisgegevens</h4>
                <div class="si-field-grid">
                    ${fields.map(f => this._renderField(f, data[f.key])).join('')}
                </div>
            </div>
        `;
    }

    _renderPlanning() {
        const data = this.state.extractedData?.planning || {};
        const fields = [
            { key: 'publicatie_datum', label: 'Publicatiedatum', type: 'date' },
            { key: 'schouw_datum', label: 'Schouwdatum', type: 'date' },
            { key: 'nvi1_datum', label: 'NvI 1 deadline', type: 'datetime-local' },
            { key: 'nvi_1_publicatie', label: 'NvI 1 publicatie', type: 'date' },
            { key: 'nvi2_datum', label: 'NvI 2 deadline', type: 'datetime-local' },
            { key: 'nvi_2_publicatie', label: 'NvI 2 publicatie', type: 'date' },
            { key: 'deadline_indiening', label: 'Deadline indiening', type: 'datetime-local' },
            { key: 'presentatie_datum', label: 'Presentatiedatum', type: 'date' },
            { key: 'voorlopige_gunning', label: 'Voorlopige gunning', type: 'date' },
            { key: 'definitieve_gunning', label: 'Definitieve gunning', type: 'date' },
            { key: 'start_uitvoering', label: 'Start uitvoering', type: 'date' },
            { key: 'einde_contract', label: 'Einde contract', type: 'date' }
        ];

        return `
            <div class="si-section">
                <h4>Planning</h4>
                <div class="si-field-grid si-field-grid--planning">
                    ${fields.map(f => this._renderField(f, data[f.key])).join('')}
                </div>
            </div>
        `;
    }

    _renderGunningscriteria() {
        const criteria = this.state.extractedData?.gunningscriteria?.criteria || [];

        if (criteria.length === 0) {
            return `
                <div class="si-section">
                    <h4>Gunningscriteria</h4>
                    <p class="si-no-data">Geen gunningscriteria gevonden</p>
                </div>
            `;
        }

        return `
            <div class="si-section">
                <h4>Gunningscriteria</h4>
                <div class="si-criteria-list">
                    ${criteria.map((c, i) => `
                        <div class="si-criteria-item">
                            <span class="si-criteria-code">${c.code || `K${i + 1}`}</span>
                            <span class="si-criteria-name">${c.naam}</span>
                            <span class="si-criteria-weight">${c.percentage}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _renderDocumenten() {
        const allFiles = this.state.uploadedFiles || [];
        if (allFiles.length === 0) return '';

        return `
            <div class="si-section">
                <h4>Gekoppelde documenten (${allFiles.length})</h4>
                <div class="si-doc-list">
                    ${allFiles.map(f => `
                        <div class="si-doc-item">
                            ${this._fileIcon(f.name)}
                            <span>${f.name}</span>
                            ${f.isAdditional ? '<span class="si-doc-badge">Extra</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    _renderField(field, data) {
        const value = this.state.editedData[field.key] !== undefined
            ? this.state.editedData[field.key]
            : (data?.value ?? '');
        const confidence = data?.confidence ?? 0;
        const source = data?.source ?? '';

        const confClass = confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
        const confIcon = confidence >= 0.85 ? '🟢' : confidence >= 0.5 ? '🟡' : '🔴';
        const isEmpty = value === null || value === undefined || value === '';

        let inputHtml;
        if (field.type === 'select') {
            inputHtml = `
                <select class="si-field-input ${isEmpty ? 'si-field--empty' : ''}" data-field="${field.key}">
                    <option value="">-- Selecteer --</option>
                    ${field.options.map(o => `
                        <option value="${o.value}" ${value === o.value ? 'selected' : ''}>${o.label}</option>
                    `).join('')}
                </select>
            `;
        } else {
            const iType = field.type === 'datetime-local' ? 'datetime-local' : field.type;
            const fmtVal = this._formatForInput(value, field.type);
            inputHtml = `
                <input type="${iType}" class="si-field-input ${isEmpty ? 'si-field--empty' : ''}"
                       data-field="${field.key}" value="${fmtVal}"
                       placeholder="${isEmpty ? 'Niet gevonden' : ''}">
            `;
        }

        return `
            <div class="si-field-group ${isEmpty ? 'si-field-group--empty' : `si-field-group--${confClass}`}">
                <label class="si-field-label">
                    ${field.label}
                    ${confidence > 0 ? `<span class="si-confidence-badge" title="Bron: ${source}">${confIcon}</span>` : ''}
                </label>
                ${inputHtml}
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // REANALYZE + EXTRA DOCUMENT
    // ══════════════════════════════════════════════

    _startReanalyze() {
        if (!this.state.importId) {
            alert('Geen import sessie gevonden');
            return;
        }

        const ok = confirm(
            'Wil je de documenten opnieuw analyseren met het Pro model?\n\n' +
            '⚡ Dit kan nauwkeurigere resultaten opleveren, vooral bij complexe aanbestedingen.\n' +
            '💰 Let op: Dit kost iets meer credits dan de standaard analyse.'
        );
        if (!ok) return;

        // Zet flags zodat AnalyzeStep de juiste flow kiest
        this.state._reanalyzeMode = true;

        // Navigeer terug naar stap 2
        if (this.state._navigateTo) {
            this.state._navigateTo(2);
        }
    }

    _startAdditionalAnalysis() {
        if (this.additionalFiles.length === 0) {
            alert('Selecteer eerst een bestand');
            return;
        }

        // Zet flags
        this.state._mergeMode = true;
        this.state._additionalFiles = this.additionalFiles;

        // Navigeer naar stap 2
        if (this.state._navigateTo) {
            this.state._navigateTo(2);
        }
    }

    // ══════════════════════════════════════════════
    // MINI UPLOAD
    // ══════════════════════════════════════════════

    _handleMiniFiles(fileList, container) {
        const validTypes = ['application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

        for (const file of fileList) {
            if (!validTypes.includes(file.type) && !/\.(pdf|docx)$/i.test(file.name)) {
                alert(`Ongeldig bestandstype: ${file.name}. Alleen PDF of DOCX.`);
                continue;
            }
            if (file.size > 25 * 1024 * 1024) {
                alert(`Bestand te groot: ${file.name} (max 25 MB)`);
                continue;
            }
            const all = [...this.state.uploadedFiles, ...this.additionalFiles];
            if (all.some(f => f.name === file.name)) {
                alert(`${file.name} is al toegevoegd`);
                continue;
            }

            this.additionalFiles.push({
                name: file.name,
                size: file.size,
                type: file.type,
                file: file,
                isAdditional: true
            });
        }

        this._updateMiniFileList(container);
    }

    _updateMiniFileList(container) {
        const listEl = container.querySelector('#siMiniFileList');
        const actionsEl = container.querySelector('#siMiniActions');

        if (listEl) {
            if (this.additionalFiles.length > 0) {
                listEl.innerHTML = this.additionalFiles.map((f, i) => `
                    <div class="si-file-item">
                        <span class="si-file-icon">${this._fileIcon(f.name)}</span>
                        <div class="si-file-info">
                            <div class="si-file-name">${f.name}</div>
                            <div class="si-file-size">${this._formatBytes(f.size)}</div>
                        </div>
                        <button class="si-file-remove si-mini-remove" data-index="${i}">&times;</button>
                    </div>
                `).join('');

                listEl.querySelectorAll('.si-mini-remove').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.additionalFiles.splice(parseInt(btn.dataset.index), 1);
                        this._updateMiniFileList(container);
                    });
                });
            } else {
                listEl.innerHTML = '';
            }
        }

        if (actionsEl) {
            actionsEl.style.display = this.additionalFiles.length > 0 ? 'flex' : 'none';
        }
    }

    // ══════════════════════════════════════════════
    // STATS
    // ══════════════════════════════════════════════

    _calcStats() {
        let total = 0, extracted = 0, high = 0, medium = 0, low = 0;

        for (const cat of ['basisgegevens', 'planning']) {
            const data = this.state.extractedData?.[cat] || {};
            for (const field of Object.values(data)) {
                if (typeof field === 'object' && 'value' in field) {
                    total++;
                    if (field.value !== null && field.value !== undefined && field.value !== '') {
                        extracted++;
                        const c = field.confidence || 0;
                        if (c >= 0.85) high++;
                        else if (c >= 0.5) medium++;
                        else low++;
                    }
                }
            }
        }

        return { total, extracted, high, medium, low };
    }

    // ══════════════════════════════════════════════
    // UTILITIES
    // ══════════════════════════════════════════════

    _formatForInput(value, type) {
        if (!value) return '';
        if (type === 'date' && value.includes('T')) return value.split('T')[0];
        if (type === 'datetime-local' && value.includes('T')) return value.slice(0, 16);
        return value;
    }

    _formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    _fileIcon(name) {
        const ext = (name || '').split('.').pop().toLowerCase();
        return { pdf: '📄', docx: '📝', doc: '📝', zip: '📦' }[ext] || '📎';
    }
}