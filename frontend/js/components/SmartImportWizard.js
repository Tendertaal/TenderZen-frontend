// frontend/js/components/SmartImportWizard.js
// Smart Import Wizard - AI-gestuurde tender aanmaak
// TenderZen v3.6
// Datum: 2025-02-02
// 
// NEW v3.6:
// - openAsModal() voor bestaande tenders
// - linkToTender() om tender te koppelen aan smart_import
// - Toon tender naam in upload stap
// - tenderId en tenderNaam in constructor
//
// NEW v3.5:
// - "Opnieuw analyseren met Pro" knop in Review stap
// - Model keuze support (haiku standaard, sonnet pro)
// - Model info tonen in Review stap
// - reanalyze() methode voor her-analyse
//
// NEW v3.3:
// - "Extra document toevoegen" functionaliteit in Review stap
// - Merge logica: nieuwe data vult lege velden aan
// - Mini-upload interface in Review stap
//
// FIX v3.2:
// - Betere logging van extracted data
// - Console output voor debugging
// - Fix voor lege planning velden

// Gebruik eigen iconenset
const Icons = window.Icons || {};
const getIcon = (name) => {
    if (Icons[name] && typeof Icons[name] === 'function') {
        return Icons[name]();
    }
    // Fallback emoji's
    const fallbacks = { iconSparkles: '✨', iconUpload: '📤', iconPlus: '➕' };
    return fallbacks[name] || '';
};

export class SmartImportWizard {
    constructor(options = {}) {
        this.options = options;
        this.onComplete = options.onComplete || (() => {});
        this.onCancel = options.onCancel || (() => {});
        
        // v3.6: Tender linking - voor gebruik vanuit bestaande tender
        this.tenderId = options.tenderId || null;
        this.tenderNaam = options.tenderNaam || null;
        this.overrideBureauId = options.overrideBureauId || null;  // v3.6: Voor super-admin
        
        // v3.7: View mode - voor bekijken van bestaande analyse
        this.viewMode = false;  // Als true: toon "Sluiten" ipv "Tender aanmaken"
        
        // State
        this.currentStep = 1;
        this.uploadedFiles = [];
        this.importId = null;
        this.extractedData = null;
        this.editedData = {};
        this.analysisProgress = 0;
        this.analysisSteps = [];
        this.pollingInterval = null;
        this.isAnalyzing = false;
        
        // v3.3: Extra document state
        this.isAddingDocument = false;
        this.additionalFiles = [];
        
        // v3.5: Model state
        this.currentModel = 'haiku';  // Standaard model
        this.isReanalyzing = false;
        
        // Auth & API
        this.authToken = '';
        this.baseURL = window.API_CONFIG?.baseURL || 'http://localhost:3000/api/v1';
        
        this.element = null;
        this.backdrop = null;
    }
    
    // ==========================================
    // Public Methods
    // ==========================================
    
    open() {
        this.reset();
        this.render();
        this.attachEventListeners();
        document.body.style.overflow = 'hidden';
    }
    
    close() {
        this.stopPolling();
        if (this.backdrop) {
            this.backdrop.remove();
        }
        document.body.style.overflow = '';
    }
    
    /**
     * v3.6: Open wizard als modal voor een bestaande tender
     * Gebruik dit vanuit TenderListView om documenten aan bestaande tender toe te voegen
     */
    openAsModal(tenderId = null, tenderNaam = null) {
        this.tenderId = tenderId;
        this.tenderNaam = tenderNaam;
        this.viewMode = false;  // Nieuwe analyse mode
        this.reset();
        this.render();
        this.attachEventListeners();
        document.body.style.overflow = 'hidden';
        
        console.log(`📤 Smart Import Wizard opened for tender: ${tenderId} (${tenderNaam})`);
    }
    
    /**
     * v3.7: Open wizard in VIEW mode - toon bestaande analyse resultaten
     * Hergebruikt de Review stap (stap 3) met data uit database
     */
    async openForExistingAnalysis(smartImportId, tenderId, tenderNaam) {
        console.log(`📊 Opening existing analysis: ${smartImportId} for tender: ${tenderNaam}`);
        
        this.tenderId = tenderId;
        this.tenderNaam = tenderNaam;
        this.importId = smartImportId;
        this.viewMode = true;  // View mode - geen "Tender aanmaken" knop
        
        // Get auth token
        const supabase = window.supabaseClient || window.supabase;
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            this.authToken = session?.access_token || '';
        }
        
        // Render loading state
        this.currentStep = 3;
        this.extractedData = null;
        this.render();
        this.attachEventListeners();
        document.body.style.overflow = 'hidden';
        
        // Show loading in content
        const content = this.backdrop?.querySelector('.wizard-content');
        if (content) {
            content.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                    <p style="color: #64748b;">Analyse data laden...</p>
                </div>
            `;
        }
        
        // Fetch data from API
        try {
            const response = await fetch(`${this.baseURL}/smart-import/${smartImportId}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Kon analyse data niet laden');
            }
            
            const data = await response.json();
            console.log('📊 Loaded analysis data:', data);
            
            // Set extracted data
            this.extractedData = data.extracted_data;
            this.currentModel = data.ai_model_used?.includes('sonnet') ? 'sonnet' : 'haiku';
            
            // Re-render with data
            this.render();
            this.attachEventListeners();
            
        } catch (error) {
            console.error('❌ Error loading analysis:', error);
            if (content) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px;">
                        <span style="font-size: 48px;">❌</span>
                        <p style="color: #ef4444; margin-top: 16px;">${error.message}</p>
                        <button class="btn btn-secondary" onclick="this.closest('.smart-import-backdrop').remove(); document.body.style.overflow = '';">
                            Sluiten
                        </button>
                    </div>
                `;
            }
        }
    }
    
    /**
     * v3.6: Link smart_import aan bestaande tender in database
     */
    async linkToTender(smartImportId) {
        if (!this.tenderId) {
            console.log('ℹ️ Geen tenderId - skip linking');
            return;
        }
        
        try {
            console.log(`🔗 Linking smart_import ${smartImportId} to tender ${this.tenderId}`);
            
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) {
                console.error('❌ Supabase client not found');
                return;
            }
            
            const { error } = await supabase
                .from('tenders')
                .update({ 
                    smart_import_id: smartImportId,
                    ai_model_used: this.currentModel
                })
                .eq('id', this.tenderId);
            
            if (error) {
                console.error('❌ Error linking tender:', error);
            } else {
                console.log('✅ Tender linked to smart_import');
            }
        } catch (err) {
            console.error('❌ Error in linkToTender:', err);
        }
    }
    
    reset() {
        this.currentStep = 1;
        this.uploadedFiles = [];
        this.importId = null;
        this.extractedData = null;
        this.editedData = {};
        this.analysisProgress = 0;
        this.analysisSteps = [];
        this.isAnalyzing = false;
        this.isAddingDocument = false;
        this.additionalFiles = [];
        this.currentModel = 'haiku';  // v3.5
        this.isReanalyzing = false;   // v3.5
        this.viewMode = false;        // v3.7
        // v3.6: NIET resetten: tenderId en tenderNaam (die worden via openAsModal gezet)
        this.stopPolling();
    }
    
    // ==========================================
    // Render Methods
    // ==========================================
    
    render() {
        // Remove existing
        if (this.backdrop) this.backdrop.remove();
        
        // Create backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'smart-import-backdrop';
        this.backdrop.innerHTML = `
            <div class="smart-import-wizard">
                <div class="wizard-header">
                    <h2>${getIcon('iconSparkles')} Smart Import</h2>
                    <p>Upload aanbestedingsdocumenten en laat AI de tender voor je aanmaken</p>
                    <button class="wizard-close-btn" title="Sluiten">&times;</button>
                </div>
                
                <div class="wizard-steps">
                    ${this.renderStepIndicator()}
                </div>
                
                <div class="wizard-content">
                    ${this.renderCurrentStep()}
                </div>
                
                <div class="wizard-footer">
                    ${this.renderFooterButtons()}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.backdrop);
        this.element = this.backdrop.querySelector('.smart-import-wizard');
        
        // Add styles
        this.injectStyles();
    }
    
    renderStepIndicator() {
        const steps = [
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Analyse' },
            { num: 3, label: 'Controleer' }
        ];
        
        return `
            <div class="step-indicators">
                ${steps.map(step => `
                    <div class="step-indicator ${step.num === this.currentStep ? 'active' : ''} ${step.num < this.currentStep ? 'completed' : ''}">
                        <div class="step-circle">${step.num < this.currentStep ? '✓' : step.num}</div>
                        <div class="step-label">${step.label}</div>
                    </div>
                    ${step.num < 3 ? '<div class="step-line"></div>' : ''}
                `).join('')}
            </div>
        `;
    }
    
    renderCurrentStep() {
        switch (this.currentStep) {
            case 1: return this.renderUploadStep();
            case 2: return this.renderAnalyzeStep();
            case 3: return this.renderReviewStep();
            default: return '';
        }
    }
    
    renderUploadStep() {
        // v3.6: Toon tender naam als we voor een bestaande tender werken
        const tenderHeader = this.tenderId && this.tenderNaam
            ? `<div class="upload-for-tender">
                   <span class="upload-tender-label">📋 Documenten voor:</span>
                   <span class="upload-tender-name">${this.tenderNaam}</span>
               </div>`
            : '';
        
        return `
            <div class="upload-step">
                ${tenderHeader}
                <div class="dropzone" id="dropzone">
                    <div class="dropzone-content">
                        ${getIcon('iconUpload')}
                        <h3>Sleep bestanden hierheen</h3>
                        <p>of klik om te selecteren</p>
                        <p class="dropzone-hint">PDF, DOCX of ZIP • Max 25MB per bestand • Max 10 bestanden</p>
                    </div>
                    <input type="file" id="fileInput" multiple accept=".pdf,.docx,.zip" style="display:none">
                </div>
                
                <div class="file-list" id="fileList">
                    ${this.uploadedFiles.length > 0 ? this.renderFileList() : ''}
                </div>
                
                ${this.uploadedFiles.length > 0 ? `
                    <div class="upload-summary">
                        <span>${this.uploadedFiles.length} bestand${this.uploadedFiles.length !== 1 ? 'en' : ''} geselecteerd</span>
                        <span>${this.formatBytes(this.uploadedFiles.reduce((sum, f) => sum + f.size, 0))}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    renderFileList() {
        return this.uploadedFiles.map((file, index) => `
            <div class="file-item">
                <div class="file-icon">${this.getFileIcon(file.name)}</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatBytes(file.size)}</div>
                </div>
                <button class="file-remove" data-index="${index}" title="Verwijderen">&times;</button>
            </div>
        `).join('');
    }
    
    renderAnalyzeStep() {
        const steps = this.analysisSteps.length > 0 ? this.analysisSteps : [
            { name: 'upload', label: 'Documenten uploaden', status: 'pending' },
            { name: 'text_extraction', label: 'Tekst extraheren', status: 'pending' },
            { name: 'ai_extraction', label: 'AI analyse', status: 'pending' },
            { name: 'finalizing', label: 'Afronden', status: 'pending' }
        ];
        
        return `
            <div class="analyze-step">
                <div class="analyze-spinner">
                    <div class="spinner"></div>
                </div>
                
                <h3>${this.isAddingDocument ? 'Extra document wordt geanalyseerd...' : 'Documenten worden geanalyseerd...'}</h3>
                <p>Dit duurt ongeveer 15-30 seconden</p>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${this.analysisProgress}%"></div>
                </div>
                <div class="progress-text">${this.analysisProgress}%</div>
                
                <div class="analysis-steps">
                    ${steps.map(step => `
                        <div class="analysis-step ${step.status}">
                            <span class="step-icon">
                                ${step.status === 'completed' ? '✓' : step.status === 'in_progress' ? '◐' : '○'}
                            </span>
                            <span class="step-text">${step.label}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderReviewStep() {
        if (!this.extractedData) {
            return `<div class="review-step"><p>Geen data beschikbaar</p></div>`;
        }
        
        console.log('📊 SmartImportWizard - Extracted Data:', this.extractedData);
        
        const stats = this.calculateStats();
        const hasEmptyFields = stats.total > stats.extracted;
        
        return `
            <div class="review-step">
                <div class="review-header">
                    <div class="stats-banner ${hasEmptyFields ? 'has-warnings' : ''}">
                        ✅ <strong>${stats.extracted}</strong> van <strong>${stats.total}</strong> velden automatisch ingevuld
                        <span class="confidence-summary">
                            (🟢 ${stats.high} hoog • 🟡 ${stats.medium} gemiddeld • 🔴 ${stats.low} laag)
                        </span>
                    </div>
                    
                    <!-- v3.5: Model info en reanalyze optie -->
                    <div class="model-info-banner">
                        <span class="model-label">
                            🤖 Geanalyseerd met: <strong>${this.currentModel === 'sonnet' ? 'Pro (Sonnet)' : 'Standaard (Haiku)'}</strong>
                        </span>
                        ${this.currentModel !== 'sonnet' ? `
                            <button class="btn btn-reanalyze" id="reanalyzeBtn" title="Opnieuw analyseren met het Pro model voor nauwkeurigere resultaten">
                                ⚡ Opnieuw analyseren met Pro
                            </button>
                        ` : `
                            <span class="model-pro-badge">✨ Pro analyse</span>
                        `}
                    </div>
                    
                    ${hasEmptyFields ? `
                        <div class="add-document-banner">
                            <span>📄 Ontbreken er gegevens? Upload een extra document om de analyse aan te vullen.</span>
                            <button class="btn btn-add-document" id="addDocumentBtn">
                                ➕ Extra document toevoegen
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <!-- v3.3: Mini upload interface (hidden by default) -->
                <div class="mini-upload-section" id="miniUploadSection" style="display: none;">
                    <div class="mini-upload-header">
                        <h4>📄 Extra document toevoegen</h4>
                        <button class="mini-upload-close" id="closeMiniUpload">&times;</button>
                    </div>
                    <div class="mini-dropzone" id="miniDropzone">
                        <p>Sleep een extra document hierheen of klik om te selecteren</p>
                        <p class="dropzone-hint">De nieuwe data wordt samengevoegd met de bestaande analyse</p>
                        <input type="file" id="miniFileInput" accept=".pdf,.docx" style="display:none">
                    </div>
                    <div class="mini-file-list" id="miniFileList"></div>
                    <div class="mini-upload-actions" id="miniUploadActions" style="display: none;">
                        <button class="btn btn-secondary" id="cancelMiniUpload">Annuleren</button>
                        <button class="btn btn-primary" id="startMiniAnalysis">🔍 Analyseren & Samenvoegen</button>
                    </div>
                </div>
                
                <div class="review-sections">
                    ${this.renderBasisgegevens()}
                    ${this.renderPlanning()}
                    ${this.renderGunningscriteria()}
                    ${this.renderDocumenten()}
                </div>
                
                ${this.extractedData.warnings && this.extractedData.warnings.length > 0 ? `
                    <div class="warnings-section">
                        <h4>⚠️ Opmerkingen</h4>
                        <ul>
                            ${this.extractedData.warnings.map(w => `<li>${w}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="review-legend">
                    <span class="legend-item">🟢 Hoge zekerheid (&gt;85%)</span>
                    <span class="legend-item">🟡 Gemiddeld (50-85%)</span>
                    <span class="legend-item">🔴 Lage zekerheid (&lt;50%)</span>
                </div>
            </div>
        `;
    }
    
    renderBasisgegevens() {
        const data = this.extractedData?.basisgegevens || {};
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
            <div class="review-section">
                <h4>Basisgegevens</h4>
                <div class="field-grid">
                    ${fields.map(field => this.renderField(field, data[field.key])).join('')}
                </div>
            </div>
        `;
    }
    
    renderPlanning() {
        const data = this.extractedData?.planning || {};
        
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
            <div class="review-section">
                <h4>Planning</h4>
                <div class="field-grid planning-grid">
                    ${fields.map(field => this.renderField(field, data[field.key])).join('')}
                </div>
            </div>
        `;
    }
    
    renderGunningscriteria() {
        const data = this.extractedData?.gunningscriteria || {};
        const criteria = data.criteria || [];
        
        if (criteria.length === 0) {
            return `
                <div class="review-section">
                    <h4>Gunningscriteria</h4>
                    <p class="no-data">Geen gunningscriteria gevonden</p>
                </div>
            `;
        }
        
        return `
            <div class="review-section">
                <h4>Gunningscriteria</h4>
                <div class="criteria-list">
                    ${criteria.map((c, i) => `
                        <div class="criteria-item">
                            <span class="criteria-code">${c.code || `K${i+1}`}</span>
                            <span class="criteria-name">${c.naam}</span>
                            <span class="criteria-weight">${c.percentage}%</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderDocumenten() {
        const allFiles = [...this.uploadedFiles, ...this.additionalFiles];
        if (allFiles.length === 0) return '';
        
        return `
            <div class="review-section">
                <h4>Gekoppelde documenten (${allFiles.length})</h4>
                <div class="documents-list">
                    ${allFiles.map(file => `
                        <div class="document-item">
                            ${this.getFileIcon(file.name)}
                            <span>${file.name}</span>
                            ${file.isAdditional ? '<span class="doc-badge">Extra</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderField(field, data) {
        const value = this.editedData[field.key] !== undefined 
            ? this.editedData[field.key] 
            : (data?.value ?? '');
        const confidence = data?.confidence ?? 0;
        const source = data?.source ?? '';
        
        const confidenceClass = confidence >= 0.85 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
        const confidenceIcon = confidence >= 0.85 ? '🟢' : confidence >= 0.5 ? '🟡' : '🔴';
        const isEmpty = value === null || value === undefined || value === '';
        
        let inputHtml;
        if (field.type === 'select') {
            inputHtml = `
                <select class="field-input ${isEmpty ? 'is-empty' : ''}" data-field="${field.key}">
                    <option value="">-- Selecteer --</option>
                    ${field.options.map(opt => `
                        <option value="${opt.value}" ${value === opt.value ? 'selected' : ''}>${opt.label}</option>
                    `).join('')}
                </select>
            `;
        } else {
            const inputType = field.type === 'datetime-local' ? 'datetime-local' : field.type;
            const formattedValue = this.formatValueForInput(value, field.type);
            inputHtml = `
                <input type="${inputType}" class="field-input ${isEmpty ? 'is-empty' : ''}" data-field="${field.key}" value="${formattedValue}" placeholder="${isEmpty ? 'Niet gevonden' : ''}">
            `;
        }
        
        return `
            <div class="field-group ${isEmpty ? 'is-empty' : `confidence-${confidenceClass}`}">
                <label class="field-label">
                    ${field.label}
                    ${confidence > 0 ? `<span class="confidence-badge" title="Bron: ${source}">${confidenceIcon}</span>` : ''}
                </label>
                ${inputHtml}
            </div>
        `;
    }
    
    renderFooterButtons() {
        switch (this.currentStep) {
            case 1:
                return `
                    <button class="btn btn-secondary" id="cancelBtn">Annuleren</button>
                    <button class="btn btn-primary" id="nextBtn" ${this.uploadedFiles.length === 0 ? 'disabled' : ''}>
                        Analyseren →
                    </button>
                `;
            case 2:
                return `
                    <button class="btn btn-secondary" id="cancelBtn" ${this.isAnalyzing ? 'disabled' : ''}>
                        Annuleren
                    </button>
                `;
            case 3:
                // v3.7: In viewMode toon "Sluiten" ipv "Tender aanmaken"
                if (this.viewMode) {
                    return `
                        <button class="btn btn-secondary" id="cancelBtn">Sluiten</button>
                    `;
                }
                return `
                    <button class="btn btn-secondary" id="cancelBtn">Annuleren</button>
                    <button class="btn btn-primary" id="createBtn">
                        ✓ Tender aanmaken
                    </button>
                `;
            default:
                return '';
        }
    }
    
    // ==========================================
    // Event Handlers
    // ==========================================
    
    attachEventListeners() {
        if (!this.backdrop) return;
        
        // Close button
        const closeBtn = this.backdrop.querySelector('.wizard-close-btn');
        closeBtn?.addEventListener('click', () => this.close());
        
        // Backdrop click
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) this.close();
        });
        
        // Escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.escapeHandler);
        
        // Cancel button
        const cancelBtn = this.backdrop.querySelector('#cancelBtn');
        cancelBtn?.addEventListener('click', () => {
            if (this.importId && this.isAnalyzing) {
                this.cancelImport();
            }
            this.close();
            this.onCancel();
        });
        
        // Step-specific listeners
        this.attachStepListeners();
    }
    
    attachStepListeners() {
        switch (this.currentStep) {
            case 1:
                this.attachUploadListeners();
                break;
            case 3:
                this.attachReviewListeners();
                break;
        }
    }
    
    attachUploadListeners() {
        const dropzone = this.backdrop.querySelector('#dropzone');
        const fileInput = this.backdrop.querySelector('#fileInput');
        const nextBtn = this.backdrop.querySelector('#nextBtn');
        
        // Dropzone click
        dropzone?.addEventListener('click', () => fileInput?.click());
        
        // File input change
        fileInput?.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });
        
        // Drag & drop
        dropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        
        dropzone?.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });
        
        dropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
        
        // Remove file buttons
        this.backdrop.querySelectorAll('.file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.uploadedFiles.splice(index, 1);
                this.updateUploadUI();
            });
        });
        
        // Next button
        nextBtn?.addEventListener('click', () => this.startAnalysis());
    }
    
    attachReviewListeners() {
        // Field changes
        this.backdrop.querySelectorAll('.field-input').forEach(input => {
            input.addEventListener('change', (e) => {
                this.editedData[e.target.dataset.field] = e.target.value;
            });
        });
        
        // Create button
        const createBtn = this.backdrop.querySelector('#createBtn');
        createBtn?.addEventListener('click', () => this.createTender());
        
        // ==========================================
        // v3.3: Extra document upload listeners
        // ==========================================
        
        const addDocumentBtn = this.backdrop.querySelector('#addDocumentBtn');
        const miniUploadSection = this.backdrop.querySelector('#miniUploadSection');
        const closeMiniUpload = this.backdrop.querySelector('#closeMiniUpload');
        const cancelMiniUpload = this.backdrop.querySelector('#cancelMiniUpload');
        const miniDropzone = this.backdrop.querySelector('#miniDropzone');
        const miniFileInput = this.backdrop.querySelector('#miniFileInput');
        const startMiniAnalysis = this.backdrop.querySelector('#startMiniAnalysis');
        
        // ==========================================
        // v3.5: Reanalyze with Pro model
        // ==========================================
        const reanalyzeBtn = this.backdrop.querySelector('#reanalyzeBtn');
        reanalyzeBtn?.addEventListener('click', () => this.startReanalysis());
        
        // Show mini upload
        addDocumentBtn?.addEventListener('click', () => {
            miniUploadSection.style.display = 'block';
            addDocumentBtn.style.display = 'none';
        });
        
        // Close mini upload
        const closeMiniUploadFn = () => {
            miniUploadSection.style.display = 'none';
            if (addDocumentBtn) addDocumentBtn.style.display = 'inline-flex';
            this.additionalFiles = [];
            this.updateMiniFileList();
        };
        
        closeMiniUpload?.addEventListener('click', closeMiniUploadFn);
        cancelMiniUpload?.addEventListener('click', closeMiniUploadFn);
        
        // Mini dropzone click
        miniDropzone?.addEventListener('click', () => miniFileInput?.click());
        
        // Mini file input change
        miniFileInput?.addEventListener('change', (e) => {
            this.handleMiniFiles(e.target.files);
        });
        
        // Mini drag & drop
        miniDropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            miniDropzone.classList.add('dragover');
        });
        
        miniDropzone?.addEventListener('dragleave', () => {
            miniDropzone.classList.remove('dragover');
        });
        
        miniDropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            miniDropzone.classList.remove('dragover');
            this.handleMiniFiles(e.dataTransfer.files);
        });
        
        // Start mini analysis
        startMiniAnalysis?.addEventListener('click', () => this.startAdditionalAnalysis());
    }
    
    // ==========================================
    // File Handling
    // ==========================================
    
    handleFiles(files) {
        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/x-zip-compressed'];
        const maxSize = 25 * 1024 * 1024;
        const maxFiles = 10;
        
        for (const file of files) {
            if (this.uploadedFiles.length >= maxFiles) {
                alert(`Maximaal ${maxFiles} bestanden toegestaan`);
                break;
            }
            
            if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|zip)$/i)) {
                alert(`Ongeldig bestandstype: ${file.name}`);
                continue;
            }
            
            if (file.size > maxSize) {
                alert(`Bestand te groot: ${file.name} (max 25MB)`);
                continue;
            }
            
            // Check duplicates
            if (this.uploadedFiles.some(f => f.name === file.name)) {
                continue;
            }
            
            this.uploadedFiles.push({
                name: file.name,
                size: file.size,
                type: file.type,
                file: file
            });
        }
        
        this.updateUploadUI();
    }
    
    // v3.3: Handle mini upload files
    handleMiniFiles(files) {
        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const maxSize = 25 * 1024 * 1024;
        
        for (const file of files) {
            if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx)$/i)) {
                alert(`Ongeldig bestandstype: ${file.name}. Alleen PDF of DOCX toegestaan.`);
                continue;
            }
            
            if (file.size > maxSize) {
                alert(`Bestand te groot: ${file.name} (max 25MB)`);
                continue;
            }
            
            // Check duplicates in both lists
            const allFiles = [...this.uploadedFiles, ...this.additionalFiles];
            if (allFiles.some(f => f.name === file.name)) {
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
        
        this.updateMiniFileList();
    }
    
    updateMiniFileList() {
        const miniFileList = this.backdrop?.querySelector('#miniFileList');
        const miniUploadActions = this.backdrop?.querySelector('#miniUploadActions');
        
        if (miniFileList) {
            if (this.additionalFiles.length > 0) {
                miniFileList.innerHTML = this.additionalFiles.map((file, index) => `
                    <div class="file-item">
                        <div class="file-icon">${this.getFileIcon(file.name)}</div>
                        <div class="file-info">
                            <div class="file-name">${file.name}</div>
                            <div class="file-size">${this.formatBytes(file.size)}</div>
                        </div>
                        <button class="file-remove mini-file-remove" data-index="${index}" title="Verwijderen">&times;</button>
                    </div>
                `).join('');
                
                // Attach remove listeners
                miniFileList.querySelectorAll('.mini-file-remove').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const index = parseInt(btn.dataset.index);
                        this.additionalFiles.splice(index, 1);
                        this.updateMiniFileList();
                    });
                });
            } else {
                miniFileList.innerHTML = '';
            }
        }
        
        if (miniUploadActions) {
            miniUploadActions.style.display = this.additionalFiles.length > 0 ? 'flex' : 'none';
        }
    }
    
    updateUploadUI() {
        const fileList = this.backdrop.querySelector('#fileList');
        const nextBtn = this.backdrop.querySelector('#nextBtn');
        
        if (fileList) {
            fileList.innerHTML = this.uploadedFiles.length > 0 ? this.renderFileList() : '';
            
            // Re-attach remove listeners
            this.backdrop.querySelectorAll('.file-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    this.uploadedFiles.splice(index, 1);
                    this.updateUploadUI();
                });
            });
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.uploadedFiles.length === 0;
        }
        
        // Update summary
        const content = this.backdrop.querySelector('.wizard-content');
        if (content && this.currentStep === 1) {
            const summary = content.querySelector('.upload-summary');
            if (this.uploadedFiles.length > 0 && !summary) {
                content.querySelector('.upload-step').insertAdjacentHTML('beforeend', `
                    <div class="upload-summary">
                        <span>${this.uploadedFiles.length} bestand${this.uploadedFiles.length !== 1 ? 'en' : ''} geselecteerd</span>
                        <span>${this.formatBytes(this.uploadedFiles.reduce((sum, f) => sum + f.size, 0))}</span>
                    </div>
                `);
            } else if (summary) {
                summary.innerHTML = `
                    <span>${this.uploadedFiles.length} bestand${this.uploadedFiles.length !== 1 ? 'en' : ''} geselecteerd</span>
                    <span>${this.formatBytes(this.uploadedFiles.reduce((sum, f) => sum + f.size, 0))}</span>
                `;
            }
        }
    }
    
    // ==========================================
    // API Calls
    // ==========================================
    
    async startAnalysis() {
        try {
            // Show step 2
            this.currentStep = 2;
            this.isAnalyzing = true;
            this.render();
            this.attachEventListeners();
            
            // Get auth token from Supabase
            const supabase = window.supabaseClient || window.supabase;
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                this.authToken = session?.access_token || '';
            }
            
            // Get tenderbureau_id
            // v3.6: Check overrideBureauId eerst (voor super-admin met "Alle bureaus")
            let tenderbureauId = this.overrideBureauId
                || this.options.getTenderbureauId?.()
                || window.currentUser?.tenderbureau_id 
                || window.activeBureauId
                || localStorage.getItem('tenderbureau_id')
                || localStorage.getItem('active_bureau_id')
                || document.querySelector('[data-bureau-id]')?.dataset?.bureauId;
            
            if (!tenderbureauId && window.bureauAccessService) {
                tenderbureauId = window.bureauAccessService.getActiveBureauId?.();
            }
            
            console.log('📍 Using tenderbureau_id:', tenderbureauId, this.overrideBureauId ? '(override from tender)' : '');
            
            const isValidUUID = tenderbureauId && 
                tenderbureauId !== 'ALL_BUREAUS' && 
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenderbureauId);
            
            if (!isValidUUID) {
                throw new Error('Selecteer eerst een specifiek bureau (niet "Alle bureaus") om Smart Import te gebruiken.');
            }
            
            // Create FormData
            const formData = new FormData();
            for (const fileInfo of this.uploadedFiles) {
                formData.append('files', fileInfo.file);
            }
            
            // Upload files
            const uploadUrl = `${this.baseURL}/smart-import/upload?tenderbureau_id=${encodeURIComponent(tenderbureauId)}`;
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });
            
            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.detail || 'Upload mislukt');
            }
            
            const uploadResult = await uploadResponse.json();
            this.importId = uploadResult.import_id;
            
            console.log('📤 Upload successful, import_id:', this.importId);
            
            // Start analysis
            const analyzeResponse = await fetch(`${this.baseURL}/smart-import/${this.importId}/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    extract_gunningscriteria: true,
                    extract_certificeringen: true,
                    language: 'nl'
                })
            });
            
            if (!analyzeResponse.ok) {
                const error = await analyzeResponse.json();
                throw new Error(error.detail || 'Analyse starten mislukt');
            }
            
            console.log('🤖 Analysis started, polling for status...');
            
            // Start polling
            this.startPolling();
            
        } catch (error) {
            console.error('Analysis error:', error);
            alert(`Fout: ${error.message}`);
            this.currentStep = 1;
            this.isAnalyzing = false;
            this.render();
            this.attachEventListeners();
        }
    }
    
    // ==========================================
    // v3.3: Additional Document Analysis
    // ==========================================
    
    async startAdditionalAnalysis() {
        if (this.additionalFiles.length === 0) {
            alert('Selecteer eerst een bestand');
            return;
        }
        
        try {
            this.isAddingDocument = true;
            this.currentStep = 2;
            this.analysisProgress = 0;
            this.render();
            this.attachEventListeners();
            
            // Get auth token
            const supabase = window.supabaseClient || window.supabase;
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                this.authToken = session?.access_token || '';
            }
            
            // Get tenderbureau_id
            // v3.6: Check overrideBureauId eerst (voor super-admin met "Alle bureaus")
            let tenderbureauId = this.overrideBureauId
                || this.options.getTenderbureauId?.()
                || window.currentUser?.tenderbureau_id 
                || window.activeBureauId
                || localStorage.getItem('tenderbureau_id');
            
            if (!tenderbureauId && window.bureauAccessService) {
                tenderbureauId = window.bureauAccessService.getActiveBureauId?.();
            }
            
            // Create FormData for additional files
            const formData = new FormData();
            for (const fileInfo of this.additionalFiles) {
                formData.append('files', fileInfo.file);
            }
            
            console.log('📤 Uploading additional document...');
            
            // Upload additional files (creates new import)
            const uploadUrl = `${this.baseURL}/smart-import/upload?tenderbureau_id=${encodeURIComponent(tenderbureauId)}`;
            const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });
            
            if (!uploadResponse.ok) {
                const error = await uploadResponse.json();
                throw new Error(error.detail || 'Upload mislukt');
            }
            
            const uploadResult = await uploadResponse.json();
            const additionalImportId = uploadResult.import_id;
            
            console.log('📤 Additional upload successful, import_id:', additionalImportId);
            
            // Start analysis
            const analyzeResponse = await fetch(`${this.baseURL}/smart-import/${additionalImportId}/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    extract_gunningscriteria: true,
                    extract_certificeringen: true,
                    language: 'nl'
                })
            });
            
            if (!analyzeResponse.ok) {
                const error = await analyzeResponse.json();
                throw new Error(error.detail || 'Analyse starten mislukt');
            }
            
            console.log('🤖 Additional analysis started...');
            
            // Poll for additional analysis
            this.pollAdditionalAnalysis(additionalImportId);
            
        } catch (error) {
            console.error('Additional analysis error:', error);
            alert(`Fout: ${error.message}`);
            this.isAddingDocument = false;
            this.currentStep = 3;
            this.render();
            this.attachEventListeners();
        }
    }
    
    // ==========================================
    // v3.5: Re-analyze with Pro Model
    // ==========================================
    
    async startReanalysis() {
        if (!this.importId) {
            alert('Geen import sessie gevonden');
            return;
        }
        
        // Bevestiging vragen
        const confirmed = confirm(
            'Wil je de documenten opnieuw analyseren met het Pro model?\n\n' +
            '⚡ Dit kan nauwkeurigere resultaten opleveren, vooral bij complexe aanbestedingen.\n' +
            '💰 Let op: Dit kost iets meer credits dan de standaard analyse.'
        );
        
        if (!confirmed) return;
        
        try {
            this.isReanalyzing = true;
            this.currentStep = 2;  // Terug naar analyse stap
            this.analysisProgress = 0;
            this.isAnalyzing = true;
            this.render();
            this.attachEventListeners();
            
            // Get auth token
            const supabase = window.supabaseClient || window.supabase;
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                this.authToken = session?.access_token || '';
            }
            
            console.log('🔄 Starting re-analysis with Sonnet Pro model...');
            
            // Start re-analysis met Sonnet model
            const reanalyzeResponse = await fetch(`${this.baseURL}/smart-import/${this.importId}/reanalyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'sonnet'  // Pro model
                })
            });
            
            if (!reanalyzeResponse.ok) {
                const error = await reanalyzeResponse.json();
                throw new Error(error.detail || 'Her-analyse starten mislukt');
            }
            
            const result = await reanalyzeResponse.json();
            console.log('🤖 Re-analysis started with Pro model:', result);
            
            // Update model state
            this.currentModel = 'sonnet';
            
            // Start polling
            this.startPolling();
            
        } catch (error) {
            console.error('Re-analysis error:', error);
            alert(`Fout bij her-analyse: ${error.message}`);
            this.isReanalyzing = false;
            this.isAnalyzing = false;
            this.currentStep = 3;
            this.render();
            this.attachEventListeners();
        }
    }
    
    async pollAdditionalAnalysis(additionalImportId) {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.baseURL}/smart-import/${additionalImportId}/status`, {
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Status ophalen mislukt');
                }
                
                const status = await response.json();
                
                console.log('📊 Additional poll status:', status.status, `(${status.progress}%)`);
                
                this.analysisProgress = status.progress || 0;
                this.analysisSteps = status.steps || [];
                this.updateAnalysisUI();
                
                if (status.status === 'completed') {
                    clearInterval(pollInterval);
                    
                    console.log('✅ Additional analysis completed!');
                    console.log('📊 Additional extracted_data:', status.extracted_data);
                    
                    // Merge the new data with existing data
                    this.mergeExtractedData(status.extracted_data);
                    
                    // Move additional files to uploadedFiles for display
                    this.uploadedFiles.push(...this.additionalFiles);
                    this.additionalFiles = [];
                    
                    this.isAddingDocument = false;
                    this.currentStep = 3;
                    this.render();
                    this.attachEventListeners();
                    
                } else if (status.status === 'failed') {
                    clearInterval(pollInterval);
                    this.isAddingDocument = false;
                    alert(`Analyse mislukt: ${status.error_message || 'Onbekende fout'}`);
                    this.currentStep = 3;
                    this.render();
                    this.attachEventListeners();
                }
                
            } catch (error) {
                console.error('Additional polling error:', error);
            }
        }, 1000);
    }
    
    // v3.3: Merge new extracted data with existing data
    mergeExtractedData(newData) {
        if (!newData) return;
        
        console.log('🔀 Merging extracted data...');
        
        // Helper function to merge a category
        const mergeCategory = (category) => {
            if (!newData[category]) return;
            
            if (!this.extractedData[category]) {
                this.extractedData[category] = {};
            }
            
            for (const [key, newValue] of Object.entries(newData[category])) {
                const existingValue = this.extractedData[category][key];
                
                // Only update if:
                // 1. No existing value, OR
                // 2. Existing value is null/empty and new value has data, OR
                // 3. New value has higher confidence
                const existingIsEmpty = !existingValue || existingValue.value === null || existingValue.value === '';
                const newHasValue = newValue && newValue.value !== null && newValue.value !== '';
                const newHasHigherConfidence = newValue && existingValue && 
                    (newValue.confidence || 0) > (existingValue.confidence || 0);
                
                if (existingIsEmpty && newHasValue) {
                    console.log(`  ➕ Adding ${category}.${key}: ${newValue.value}`);
                    this.extractedData[category][key] = newValue;
                } else if (newHasHigherConfidence && newHasValue) {
                    console.log(`  ⬆️ Updating ${category}.${key} (higher confidence): ${newValue.value}`);
                    this.extractedData[category][key] = newValue;
                }
            }
        };
        
        // Merge each category
        mergeCategory('basisgegevens');
        mergeCategory('planning');
        
        // Merge gunningscriteria (append if different)
        if (newData.gunningscriteria?.criteria?.length > 0) {
            if (!this.extractedData.gunningscriteria) {
                this.extractedData.gunningscriteria = { criteria: [] };
            }
            
            const existingCodes = new Set(
                this.extractedData.gunningscriteria.criteria.map(c => c.code || c.naam)
            );
            
            for (const criterion of newData.gunningscriteria.criteria) {
                const key = criterion.code || criterion.naam;
                if (!existingCodes.has(key)) {
                    console.log(`  ➕ Adding criterion: ${key}`);
                    this.extractedData.gunningscriteria.criteria.push(criterion);
                }
            }
        }
        
        // Merge warnings
        if (newData.warnings?.length > 0) {
            if (!this.extractedData.warnings) {
                this.extractedData.warnings = [];
            }
            
            // Add unique warnings
            for (const warning of newData.warnings) {
                if (!this.extractedData.warnings.includes(warning)) {
                    this.extractedData.warnings.push(warning);
                }
            }
        }
        
        console.log('✅ Merge complete');
    }
    
    startPolling() {
        this.pollingInterval = setInterval(() => this.pollStatus(), 1000);
    }
    
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    async pollStatus() {
        if (!this.importId) return;
        
        try {
            const response = await fetch(`${this.baseURL}/smart-import/${this.importId}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Status ophalen mislukt');
            }
            
            const status = await response.json();
            
            console.log('📊 Poll status:', status.status, `(${status.progress}%)`);
            
            this.analysisProgress = status.progress || 0;
            this.analysisSteps = status.steps || [];
            
            // Update UI
            this.updateAnalysisUI();
            
            // Check completion
            if (status.status === 'completed') {
                this.stopPolling();
                this.extractedData = status.extracted_data;
                this.isAnalyzing = false;
                this.isReanalyzing = false;  // v3.5: Reset reanalyzing flag
                
                // v3.5: Track welk model is gebruikt
                if (status.ai_model_used) {
                    this.currentModel = status.ai_model_used === 'sonnet' || 
                                       status.ai_model_used.includes('sonnet') ? 'sonnet' : 'haiku';
                    console.log('🤖 Model used:', this.currentModel);
                }
                
                console.log('✅ Analysis completed!');
                console.log('📊 Full extracted_data:', JSON.stringify(this.extractedData, null, 2));
                
                // v3.6: Link to existing tender if tenderId is set
                if (this.tenderId && this.importId) {
                    await this.linkToTender(this.importId);
                }
                
                this.currentStep = 3;
                this.render();
                this.attachEventListeners();
            } else if (status.status === 'failed') {
                this.stopPolling();
                this.isAnalyzing = false;
                this.isReanalyzing = false;  // v3.5
                alert(`Analyse mislukt: ${status.error_message || 'Onbekende fout'}`);
                this.currentStep = 1;
                this.render();
                this.attachEventListeners();
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }
    
    updateAnalysisUI() {
        const progressFill = this.backdrop?.querySelector('.progress-fill');
        const progressText = this.backdrop?.querySelector('.progress-text');
        const stepsContainer = this.backdrop?.querySelector('.analysis-steps');
        
        if (progressFill) {
            progressFill.style.width = `${this.analysisProgress}%`;
        }
        if (progressText) {
            progressText.textContent = `${this.analysisProgress}%`;
        }
        if (stepsContainer && this.analysisSteps.length > 0) {
            stepsContainer.innerHTML = this.analysisSteps.map(step => `
                <div class="analysis-step ${step.status}">
                    <span class="step-icon">
                        ${step.status === 'completed' ? '✓' : step.status === 'in_progress' ? '◐' : '○'}
                    </span>
                    <span class="step-text">${step.label}</span>
                </div>
            `).join('');
        }
    }
    
    async cancelImport() {
        if (!this.importId) return;
        
        try {
            await fetch(`${this.baseURL}/smart-import/${this.importId}/cancel`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
        } catch (error) {
            console.error('Cancel error:', error);
        }
    }
    
    async createTender() {
        try {
            const createBtn = this.backdrop.querySelector('#createBtn');
            if (createBtn) {
                createBtn.disabled = true;
                createBtn.textContent = 'Bezig...';
            }
            
            // Collect data from form
            const tenderData = this.collectFormData();
            
            console.log('📝 Creating tender with data:', tenderData);
            
            const response = await fetch(`${this.baseURL}/smart-import/${this.importId}/create-tender`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: tenderData,
                    options: {
                        fase: 'acquisitie',
                        link_documents: true
                    }
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Tender aanmaken mislukt');
            }
            
            const result = await response.json();
            
            console.log('✅ Tender created:', result);
            
            this.close();
            this.onComplete(result.tender);
            
            // Show success message
            alert(`✅ Tender "${result.tender.naam}" aangemaakt met ${result.documents_linked} documenten!`);
            
        } catch (error) {
            console.error('Create tender error:', error);
            alert(`Fout: ${error.message}`);
            
            const createBtn = this.backdrop.querySelector('#createBtn');
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.textContent = '✓ Tender aanmaken';
            }
        }
    }
    
    collectFormData() {
        const data = {};
        
        // Basisgegevens
        const basisFields = ['naam', 'opdrachtgever', 'aanbestedende_dienst', 'tender_nummer', 'type', 'geraamde_waarde', 'locatie', 'tenderned_url'];
        for (const field of basisFields) {
            const value = this.editedData[field] ?? this.extractedData?.basisgegevens?.[field]?.value;
            if (value !== null && value !== undefined && value !== '') {
                data[field] = field === 'geraamde_waarde' ? parseFloat(value) : value;
            }
        }
        
        // Planning
        const planningFields = ['publicatie_datum', 'schouw_datum', 'nvi1_datum', 'nvi_1_publicatie', 'nvi2_datum', 'nvi_2_publicatie', 'deadline_indiening', 'presentatie_datum', 'voorlopige_gunning', 'definitieve_gunning', 'start_uitvoering', 'einde_contract'];
        for (const field of planningFields) {
            const value = this.editedData[field] ?? this.extractedData?.planning?.[field]?.value;
            if (value !== null && value !== undefined && value !== '') {
                data[field] = value;
            }
        }
        
        console.log('📋 Collected form data:', data);
        
        return data;
    }
    
    // ==========================================
    // Utility Methods
    // ==========================================
    
    calculateStats() {
        let total = 0;
        let extracted = 0;
        let high = 0;
        let medium = 0;
        let low = 0;
        
        for (const category of ['basisgegevens', 'planning']) {
            const data = this.extractedData?.[category] || {};
            for (const field of Object.values(data)) {
                if (typeof field === 'object' && 'value' in field) {
                    total++;
                    if (field.value !== null && field.value !== undefined && field.value !== '') {
                        extracted++;
                        const conf = field.confidence || 0;
                        if (conf >= 0.85) high++;
                        else if (conf >= 0.5) medium++;
                        else low++;
                    }
                }
            }
        }
        
        return { total, extracted, high, medium, low };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    formatValueForInput(value, type) {
        if (!value) return '';
        
        if (type === 'date' && value.includes('T')) {
            return value.split('T')[0];
        }
        if (type === 'datetime-local' && value.includes('T')) {
            return value.slice(0, 16);
        }
        
        return value;
    }
    
    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch (ext) {
            case 'pdf': return '📄';
            case 'docx': case 'doc': return '📝';
            case 'zip': return '📦';
            default: return '📎';
        }
    }
    
    // ==========================================
    // Styles
    // ==========================================
    
    injectStyles() {
        if (document.getElementById('smart-import-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'smart-import-styles';
        styles.textContent = `
            .smart-import-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 20px;
            }
            
            .smart-import-wizard {
                background: white;
                border-radius: 12px;
                width: 100%;
                max-width: 900px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            
            .wizard-header {
                padding: 24px;
                border-bottom: 1px solid #e5e7eb;
                position: relative;
            }
            
            .wizard-header h2 {
                margin: 0 0 8px 0;
                font-size: 24px;
                color: #1f2937;
            }
            
            .wizard-header p {
                margin: 0;
                color: #6b7280;
            }
            
            .wizard-close-btn {
                position: absolute;
                top: 16px;
                right: 16px;
                background: none;
                border: none;
                font-size: 28px;
                cursor: pointer;
                color: #9ca3af;
                padding: 4px 8px;
                line-height: 1;
            }
            
            .wizard-close-btn:hover {
                color: #4b5563;
            }
            
            .wizard-steps {
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
            }
            
            .step-indicators {
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .step-indicator {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }
            
            .step-circle {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: #e5e7eb;
                color: #6b7280;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
                font-size: 14px;
            }
            
            .step-indicator.active .step-circle {
                background: #3b82f6;
                color: white;
            }
            
            .step-indicator.completed .step-circle {
                background: #10b981;
                color: white;
            }
            
            .step-label {
                font-size: 13px;
                color: #6b7280;
            }
            
            .step-indicator.active .step-label {
                color: #3b82f6;
                font-weight: 500;
            }
            
            .step-line {
                width: 80px;
                height: 2px;
                background: #e5e7eb;
                margin: 0 12px;
                margin-bottom: 24px;
            }
            
            .wizard-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }
            
            .wizard-footer {
                padding: 16px 24px;
                border-top: 1px solid #e5e7eb;
                display: flex;
                justify-content: flex-end;
                gap: 12px;
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: #10b981;
                color: white;
            }
            
            .btn-primary:hover:not(:disabled) {
                background: #059669;
            }
            
            .btn-primary:disabled {
                background: #6ee7b7;
                cursor: not-allowed;
            }
            
            .btn-secondary {
                background: #f3f4f6;
                color: #374151;
            }
            
            .btn-secondary:hover:not(:disabled) {
                background: #e5e7eb;
            }
            
            .btn-add-document {
                background: #3b82f6;
                color: white;
                padding: 8px 16px;
                font-size: 13px;
            }
            
            .btn-add-document:hover {
                background: #2563eb;
            }
            
            /* Upload Step */
            .dropzone {
                border: 2px dashed #d1d5db;
                border-radius: 8px;
                padding: 48px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .dropzone:hover, .dropzone.dragover {
                border-color: #3b82f6;
                background: #eff6ff;
            }
            
            .dropzone-content h3 {
                margin: 16px 0 8px;
                color: #374151;
            }
            
            .dropzone-content p {
                margin: 0;
                color: #6b7280;
            }
            
            .dropzone-hint {
                font-size: 12px;
                margin-top: 12px !important;
            }
            
            .file-list {
                margin-top: 16px;
            }
            
            .file-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: #f9fafb;
                border-radius: 6px;
                margin-bottom: 8px;
            }
            
            .file-icon {
                font-size: 24px;
            }
            
            .file-info {
                flex: 1;
            }
            
            .file-name {
                font-weight: 500;
                color: #1f2937;
            }
            
            .file-size {
                font-size: 12px;
                color: #6b7280;
            }
            
            .file-remove {
                background: none;
                border: none;
                font-size: 20px;
                color: #9ca3af;
                cursor: pointer;
                padding: 4px 8px;
            }
            
            .file-remove:hover {
                color: #ef4444;
            }
            
            .upload-summary {
                display: flex;
                justify-content: space-between;
                padding: 12px;
                background: #f0f9ff;
                border-radius: 6px;
                margin-top: 16px;
                color: #1e40af;
                font-size: 14px;
            }
            
            /* v3.6: Upload for existing tender header */
            .upload-for-tender {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 16px;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                border: 1px solid #7dd3fc;
                border-radius: 8px;
                margin-bottom: 16px;
            }
            
            .upload-tender-label {
                font-size: 13px;
                color: #64748b;
            }
            
            .upload-tender-name {
                font-size: 14px;
                font-weight: 600;
                color: #0369a1;
            }
            
            /* Analyze Step */
            .analyze-step {
                text-align: center;
                padding: 40px 0;
            }
            
            .analyze-spinner {
                margin-bottom: 24px;
            }
            
            .spinner {
                width: 48px;
                height: 48px;
                border: 4px solid #e5e7eb;
                border-top-color: #3b82f6;
                border-radius: 50%;
                margin: 0 auto;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .analyze-step h3 {
                margin: 0 0 8px;
                color: #1f2937;
            }
            
            .analyze-step > p {
                color: #6b7280;
                margin: 0 0 24px;
            }
            
            .progress-bar {
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .progress-fill {
                height: 100%;
                background: #3b82f6;
                transition: width 0.3s ease;
            }
            
            .progress-text {
                font-size: 14px;
                color: #6b7280;
                margin-bottom: 24px;
            }
            
            .analysis-steps {
                text-align: left;
                max-width: 300px;
                margin: 0 auto;
            }
            
            .analysis-step {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 0;
                color: #9ca3af;
            }
            
            .analysis-step.completed {
                color: #10b981;
            }
            
            .analysis-step.in_progress {
                color: #3b82f6;
            }
            
            .step-icon {
                font-size: 16px;
            }
            
            /* Review Step */
            .review-header {
                margin-bottom: 24px;
            }
            
            .stats-banner {
                background: #f0fdf4;
                border: 1px solid #86efac;
                padding: 12px 16px;
                border-radius: 6px;
                color: #166534;
            }
            
            .stats-banner.has-warnings {
                background: #fefce8;
                border-color: #fde047;
                color: #854d0e;
            }
            
            .confidence-summary {
                font-weight: normal;
                margin-left: 8px;
            }
            
            /* v3.3: Add document banner */
            .add-document-banner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-top: 12px;
                padding: 12px 16px;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 6px;
                color: #1e40af;
                font-size: 14px;
            }
            
            /* v3.5: Model info banner */
            .model-info-banner {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                margin-top: 12px;
                padding: 10px 16px;
                background: #f0fdf4;
                border: 1px solid #bbf7d0;
                border-radius: 6px;
                font-size: 14px;
            }
            
            .model-label {
                color: #166534;
            }
            
            .model-pro-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 10px;
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                color: #92400e;
                border-radius: 9999px;
                font-size: 12px;
                font-weight: 600;
            }
            
            .btn-reanalyze {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 1px 3px rgba(124, 58, 237, 0.3);
            }
            
            .btn-reanalyze:hover {
                background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 6px rgba(124, 58, 237, 0.4);
            }
            
            .btn-reanalyze:active {
                transform: translateY(0);
            }
            
            /* v3.3: Mini upload section */
            .mini-upload-section {
                margin-bottom: 24px;
                padding: 16px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
            }
            
            .mini-upload-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .mini-upload-header h4 {
                margin: 0;
                color: #1f2937;
            }
            
            .mini-upload-close {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #9ca3af;
            }
            
            .mini-dropzone {
                border: 2px dashed #cbd5e1;
                border-radius: 6px;
                padding: 24px;
                text-align: center;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .mini-dropzone:hover, .mini-dropzone.dragover {
                border-color: #3b82f6;
                background: #eff6ff;
            }
            
            .mini-dropzone p {
                margin: 0;
                color: #64748b;
                font-size: 14px;
            }
            
            .mini-file-list {
                margin-top: 12px;
            }
            
            .mini-upload-actions {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                margin-top: 12px;
            }
            
            .doc-badge {
                background: #dbeafe;
                color: #1e40af;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
            }
            
            .review-section {
                margin-bottom: 24px;
            }
            
            .review-section h4 {
                margin: 0 0 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e5e7eb;
                color: #374151;
            }
            
            .field-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
            }
            
            .planning-grid {
                grid-template-columns: repeat(3, 1fr);
            }
            
            .field-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .field-group.is-empty .field-input {
                border-color: #fca5a5;
                background: #fef2f2;
            }
            
            .field-group.is-empty .field-input::placeholder {
                color: #dc2626;
                font-style: italic;
            }
            
            .field-label {
                font-size: 13px;
                color: #6b7280;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .confidence-badge {
                cursor: help;
            }
            
            .field-input {
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .field-input:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
            }
            
            .field-group.confidence-high .field-input {
                border-color: #86efac;
                background: #f0fdf4;
            }
            
            .field-group.confidence-medium .field-input {
                border-color: #fcd34d;
                background: #fefce8;
            }
            
            .field-group.confidence-low .field-input {
                border-color: #fca5a5;
                background: #fef2f2;
            }
            
            .no-data {
                color: #9ca3af;
                font-style: italic;
            }
            
            .criteria-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .criteria-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 12px;
                background: #f9fafb;
                border-radius: 4px;
            }
            
            .criteria-code {
                background: #3b82f6;
                color: white;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .criteria-name {
                flex: 1;
            }
            
            .criteria-weight {
                font-weight: 600;
                color: #3b82f6;
            }
            
            .documents-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .document-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #f9fafb;
                border-radius: 4px;
            }
            
            .warnings-section {
                margin-top: 16px;
                padding: 12px 16px;
                background: #fefce8;
                border: 1px solid #fde047;
                border-radius: 6px;
            }
            
            .warnings-section h4 {
                margin: 0 0 8px;
                color: #854d0e;
            }
            
            .warnings-section ul {
                margin: 0;
                padding-left: 20px;
                color: #713f12;
                font-size: 14px;
            }
            
            .review-legend {
                display: flex;
                gap: 16px;
                padding-top: 16px;
                border-top: 1px solid #e5e7eb;
                font-size: 12px;
                color: #6b7280;
            }
            
            @media (max-width: 768px) {
                .field-grid, .planning-grid {
                    grid-template-columns: 1fr;
                }
                
                .step-line {
                    width: 40px;
                }
                
                .add-document-banner {
                    flex-direction: column;
                    text-align: center;
                }
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Export for use
export default SmartImportWizard;