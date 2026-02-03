// frontend/js/components/SmartImportPanel.js
// Smart Import Panel - Detail weergave van AI import met reanalyze optie
// TenderZen v1.0
// Datum: 2025-02-02
//
// Functie:
// - Overlay/panel dat Smart Import details toont
// - Model info, confidence scores, extracted fields
// - "Opnieuw analyseren met Pro" knop
// - Real-time status updates tijdens reanalyze

export class SmartImportPanel {
    constructor(options = {}) {
        this.baseURL = window.API_CONFIG?.baseURL || 'http://localhost:3000/api/v1';
        this.authToken = options.authToken || '';
        this.onReanalyzeComplete = options.onReanalyzeComplete || (() => {});
        this.onClose = options.onClose || (() => {});
        
        this.smartImportId = null;
        this.tenderId = null;
        this.importData = null;
        this.isReanalyzing = false;
        this.pollingInterval = null;
        
        this.element = null;
    }
    
    /**
     * Open het panel voor een specifieke Smart Import
     */
    async open(smartImportId, tenderId) {
        this.smartImportId = smartImportId;
        this.tenderId = tenderId;
        
        // Render loading state
        this.renderPanel(true);
        
        // Fetch data
        try {
            await this.fetchImportData();
            this.renderPanel(false);
        } catch (error) {
            console.error('Error loading Smart Import data:', error);
            this.renderError(error.message);
        }
    }
    
    /**
     * Sluit het panel
     */
    close() {
        this.stopPolling();
        if (this.element) {
            this.element.remove();
            this.element = null;
        }
        this.onClose();
    }
    
    /**
     * Fetch Smart Import data van de API
     */
    async fetchImportData() {
        const response = await fetch(`${this.baseURL}/smart-import/${this.smartImportId}/status`, {
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Kon Smart Import data niet laden');
        }
        
        this.importData = await response.json();
        return this.importData;
    }
    
    /**
     * Render het panel
     */
    renderPanel(loading = false) {
        // Inject CSS (only once)
        this.injectStyles();
        
        // Remove existing
        if (this.element) {
            this.element.remove();
        }
        
        // Create backdrop
        this.element = document.createElement('div');
        this.element.className = 'smart-import-panel-backdrop';
        this.element.innerHTML = `
            <div class="smart-import-panel">
                <div class="panel-header">
                    <h3>✨ AI Import Details</h3>
                    <button class="panel-close" id="closePanel">&times;</button>
                </div>
                
                <div class="panel-content">
                    ${loading ? this.renderLoading() : this.renderContent()}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.element);
        this.attachEventListeners();
    }
    
    /**
     * Inject CSS styles into page (only once)
     */
    injectStyles() {
        if (document.getElementById('smart-import-panel-styles')) return;
        
        const styleSheet = document.createElement('style');
        styleSheet.id = 'smart-import-panel-styles';
        styleSheet.textContent = SmartImportPanel.getStyles();
        document.head.appendChild(styleSheet);
    }
    
    /**
     * Render loading state
     */
    renderLoading() {
        return `
            <div class="panel-loading">
                <div class="loading-spinner"></div>
                <p>Data laden...</p>
            </div>
        `;
    }
    
    /**
     * Render error state
     */
    renderError(message) {
        if (!this.element) return;
        
        const content = this.element.querySelector('.panel-content');
        if (content) {
            content.innerHTML = `
                <div class="panel-error">
                    <span class="error-icon">❌</span>
                    <p>${message}</p>
                    <button class="btn btn-secondary" id="retryBtn">Opnieuw proberen</button>
                </div>
            `;
            
            this.element.querySelector('#retryBtn')?.addEventListener('click', () => {
                this.open(this.smartImportId, this.tenderId);
            });
        }
    }
    
    /**
     * Render panel content
     */
    renderContent() {
        if (!this.importData) {
            return '<p>Geen data beschikbaar</p>';
        }
        
        const data = this.importData;
        const modelUsed = data.ai_model_used || 'haiku';
        const isPro = modelUsed === 'sonnet' || modelUsed.includes('sonnet');
        const extractedData = data.extracted_data || {};
        
        // Calculate stats
        const stats = this.calculateStats(extractedData);
        
        return `
            <!-- Model Info -->
            <div class="model-info-section">
                <div class="model-badge ${isPro ? 'pro' : ''}">
                    <span class="model-icon">${isPro ? '⚡' : '✨'}</span>
                    <span class="model-name">${isPro ? 'Pro (Sonnet)' : 'Standaard (Haiku)'}</span>
                </div>
                ${!isPro ? `
                    <button class="btn btn-reanalyze-panel" id="reanalyzeBtn">
                        ⚡ Opnieuw analyseren met Pro
                    </button>
                ` : `
                    <span class="pro-indicator">✨ Beste analyse kwaliteit</span>
                `}
            </div>
            
            <!-- Stats -->
            <div class="stats-section">
                <div class="stat-item">
                    <span class="stat-value">${stats.extracted}</span>
                    <span class="stat-label">Velden gevuld</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.high}</span>
                    <span class="stat-label">Hoge zekerheid</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${stats.medium}</span>
                    <span class="stat-label">Gemiddeld</span>
                </div>
                <div class="stat-item ${stats.low > 0 ? 'warning' : ''}">
                    <span class="stat-value">${stats.low}</span>
                    <span class="stat-label">Laag</span>
                </div>
            </div>
            
            <!-- Key Fields -->
            <div class="fields-section">
                <h4>Geëxtraheerde gegevens</h4>
                ${this.renderExtractedFields(extractedData)}
            </div>
            
            <!-- Warnings -->
            ${data.warnings && data.warnings.length > 0 ? `
                <div class="warnings-section">
                    <h4>⚠️ Opmerkingen (${data.warnings.length})</h4>
                    <ul class="warnings-list">
                        ${data.warnings.map(w => `<li>${w}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <!-- Meta info -->
            <div class="meta-section">
                <span>📅 ${new Date(data.completed_at || data.created_at).toLocaleDateString('nl-NL')}</span>
                <span>🔢 ${extractedData._meta?.tokens_used || '?'} tokens</span>
            </div>
        `;
    }
    
    /**
     * Render reanalyzing state
     */
    renderReanalyzing() {
        return `
            <div class="reanalyzing-state">
                <div class="reanalyze-spinner"></div>
                <h4>⚡ Opnieuw analyseren met Pro model...</h4>
                <p>Dit kan 30-60 seconden duren</p>
                <div class="progress-bar">
                    <div class="progress-fill" id="reanalyzeProgress" style="width: 0%"></div>
                </div>
                <p class="progress-status" id="reanalyzeStatus">Initialiseren...</p>
            </div>
        `;
    }
    
    /**
     * Calculate statistics from extracted data
     */
    calculateStats(extractedData) {
        let total = 0, extracted = 0, high = 0, medium = 0, low = 0;
        
        const sections = ['basisgegevens', 'planning'];
        sections.forEach(section => {
            const sectionData = extractedData[section] || {};
            Object.values(sectionData).forEach(field => {
                if (typeof field === 'object' && field !== null) {
                    total++;
                    const conf = field.confidence || 0;
                    if (field.value !== null && field.value !== undefined && field.value !== '') {
                        extracted++;
                        if (conf >= 0.85) high++;
                        else if (conf >= 0.5) medium++;
                        else low++;
                    }
                }
            });
        });
        
        return { total, extracted, high, medium, low };
    }
    
    /**
     * Render extracted fields summary
     */
    renderExtractedFields(extractedData) {
        const basisgegevens = extractedData.basisgegevens || {};
        const planning = extractedData.planning || {};
        
        const keyFields = [
            { key: 'naam', label: 'Naam', data: basisgegevens },
            { key: 'opdrachtgever', label: 'Opdrachtgever', data: basisgegevens },
            { key: 'type', label: 'Type', data: basisgegevens },
            { key: 'deadline_indiening', label: 'Deadline', data: planning }
        ];
        
        return `
            <div class="fields-list">
                ${keyFields.map(f => {
                    const field = f.data[f.key];
                    const value = field?.value;
                    const conf = field?.confidence || 0;
                    const confClass = conf >= 0.85 ? 'high' : (conf >= 0.5 ? 'medium' : 'low');
                    
                    return `
                        <div class="field-row">
                            <span class="field-label">${f.label}</span>
                            <span class="field-value ${!value ? 'empty' : ''}">${value || '-'}</span>
                            <span class="confidence-dot ${confClass}" title="${Math.round(conf * 100)}% zekerheid"></span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    /**
     * Start reanalyze met Pro model
     */
    async startReanalyze() {
        if (this.isReanalyzing) return;
        
        const confirmed = confirm(
            'Wil je de documenten opnieuw analyseren met het Pro model?\n\n' +
            '⚡ Dit kan nauwkeurigere resultaten opleveren.\n' +
            '💰 Let op: Dit kost extra credits.'
        );
        
        if (!confirmed) return;
        
        this.isReanalyzing = true;
        
        // Update UI
        const content = this.element.querySelector('.panel-content');
        if (content) {
            content.innerHTML = this.renderReanalyzing();
        }
        
        try {
            // Call reanalyze API
            const response = await fetch(`${this.baseURL}/smart-import/${this.smartImportId}/reanalyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ model: 'sonnet' })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Reanalyze mislukt');
            }
            
            console.log('🔄 Reanalyze started, polling for status...');
            
            // Start polling
            this.startPolling();
            
        } catch (error) {
            console.error('Reanalyze error:', error);
            alert(`Fout: ${error.message}`);
            this.isReanalyzing = false;
            this.renderPanel(false);
        }
    }
    
    /**
     * Start polling for reanalyze status
     */
    startPolling() {
        this.pollingInterval = setInterval(() => this.pollReanalyzeStatus(), 1500);
    }
    
    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    /**
     * Poll for reanalyze status
     */
    async pollReanalyzeStatus() {
        try {
            const response = await fetch(`${this.baseURL}/smart-import/${this.smartImportId}/status`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });
            
            if (!response.ok) return;
            
            const status = await response.json();
            
            // Update progress UI
            const progressEl = this.element?.querySelector('#reanalyzeProgress');
            const statusEl = this.element?.querySelector('#reanalyzeStatus');
            
            if (progressEl) {
                progressEl.style.width = `${status.progress || 0}%`;
            }
            if (statusEl) {
                statusEl.textContent = this.getStatusText(status.current_step);
            }
            
            // Check completion
            if (status.status === 'completed') {
                this.stopPolling();
                this.isReanalyzing = false;
                this.importData = status;
                
                console.log('✅ Reanalyze completed!');
                
                // Show success and refresh
                this.renderPanel(false);
                this.onReanalyzeComplete(this.tenderId, status);
                
            } else if (status.status === 'failed') {
                this.stopPolling();
                this.isReanalyzing = false;
                alert(`Analyse mislukt: ${status.error_message || 'Onbekende fout'}`);
                this.renderPanel(false);
            }
            
        } catch (error) {
            console.error('Polling error:', error);
        }
    }
    
    /**
     * Get human readable status text
     */
    getStatusText(step) {
        const steps = {
            'reanalyze_init': 'Voorbereiden...',
            'text_extraction': 'Tekst extraheren...',
            'ai_extraction': 'AI analyse (Pro)...',
            'finalizing': 'Afronden...'
        };
        return steps[step] || 'Bezig...';
    }
    
    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        this.element?.querySelector('#closePanel')?.addEventListener('click', () => this.close());
        
        // Backdrop click
        this.element?.addEventListener('click', (e) => {
            if (e.target === this.element) {
                this.close();
            }
        });
        
        // Reanalyze button
        this.element?.querySelector('#reanalyzeBtn')?.addEventListener('click', () => this.startReanalyze());
        
        // ESC key
        this.keyHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }
    
    /**
     * Get CSS styles
     */
    static getStyles() {
        return `
            /* Smart Import Panel Backdrop */
            .smart-import-panel-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            /* Panel */
            .smart-import-panel {
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 520px;
                max-height: 85vh;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from { 
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Header */
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #e5e7eb;
                background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            }
            
            .panel-header h3 {
                margin: 0;
                font-size: 18px;
                color: #1f2937;
            }
            
            .panel-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6b7280;
                width: 32px;
                height: 32px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .panel-close:hover {
                background: #f3f4f6;
                color: #1f2937;
            }
            
            /* Content */
            .panel-content {
                padding: 24px;
                overflow-y: auto;
                max-height: calc(85vh - 80px);
            }
            
            /* Model Info Section */
            .model-info-section {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                background: #f9fafb;
                border-radius: 12px;
                margin-bottom: 20px;
            }
            
            .model-badge {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 14px;
                background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                border-radius: 20px;
                font-weight: 600;
                color: #0369a1;
            }
            
            .model-badge.pro {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                color: #92400e;
            }
            
            .model-icon {
                font-size: 16px;
            }
            
            .btn-reanalyze-panel {
                padding: 10px 16px;
                background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            
            .btn-reanalyze-panel:hover {
                background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
            }
            
            .pro-indicator {
                color: #92400e;
                font-size: 13px;
                font-weight: 500;
            }
            
            /* Stats Section */
            .stats-section {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-bottom: 20px;
            }
            
            .stat-item {
                text-align: center;
                padding: 12px 8px;
                background: #f9fafb;
                border-radius: 10px;
            }
            
            .stat-item.warning {
                background: #fef3c7;
            }
            
            .stat-value {
                display: block;
                font-size: 24px;
                font-weight: 700;
                color: #1f2937;
            }
            
            .stat-label {
                font-size: 11px;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.3px;
            }
            
            /* Fields Section */
            .fields-section {
                margin-bottom: 20px;
            }
            
            .fields-section h4 {
                margin: 0 0 12px 0;
                font-size: 14px;
                color: #374151;
            }
            
            .fields-list {
                background: #f9fafb;
                border-radius: 10px;
                overflow: hidden;
            }
            
            .field-row {
                display: flex;
                align-items: center;
                padding: 10px 14px;
                border-bottom: 1px solid #e5e7eb;
            }
            
            .field-row:last-child {
                border-bottom: none;
            }
            
            .field-label {
                flex: 0 0 100px;
                font-size: 12px;
                color: #6b7280;
                font-weight: 500;
            }
            
            .field-value {
                flex: 1;
                font-size: 13px;
                color: #1f2937;
                font-weight: 500;
            }
            
            .field-value.empty {
                color: #9ca3af;
                font-style: italic;
            }
            
            .confidence-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-left: 8px;
            }
            
            .confidence-dot.high { background: #10b981; }
            .confidence-dot.medium { background: #f59e0b; }
            .confidence-dot.low { background: #ef4444; }
            
            /* Warnings Section */
            .warnings-section {
                margin-bottom: 20px;
                padding: 14px;
                background: #fef3c7;
                border-radius: 10px;
                border: 1px solid #fde68a;
            }
            
            .warnings-section h4 {
                margin: 0 0 10px 0;
                font-size: 13px;
                color: #92400e;
            }
            
            .warnings-list {
                margin: 0;
                padding-left: 20px;
                font-size: 12px;
                color: #92400e;
            }
            
            .warnings-list li {
                margin-bottom: 4px;
            }
            
            /* Meta Section */
            .meta-section {
                display: flex;
                gap: 16px;
                font-size: 12px;
                color: #9ca3af;
            }
            
            /* Loading State */
            .panel-loading {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 60px 20px;
            }
            
            .loading-spinner {
                width: 40px;
                height: 40px;
                border: 3px solid #e5e7eb;
                border-top-color: #3b82f6;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 16px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            /* Reanalyzing State */
            .reanalyzing-state {
                text-align: center;
                padding: 40px 20px;
            }
            
            .reanalyze-spinner {
                width: 50px;
                height: 50px;
                border: 4px solid #e5e7eb;
                border-top-color: #7c3aed;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }
            
            .reanalyzing-state h4 {
                margin: 0 0 8px 0;
                color: #1f2937;
            }
            
            .reanalyzing-state p {
                margin: 0 0 20px 0;
                color: #6b7280;
                font-size: 14px;
            }
            
            .progress-bar {
                height: 8px;
                background: #e5e7eb;
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 12px;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #7c3aed 0%, #a855f7 100%);
                transition: width 0.3s ease;
            }
            
            .progress-status {
                font-size: 13px;
                color: #7c3aed;
                margin: 0;
            }
            
            /* Error State */
            .panel-error {
                text-align: center;
                padding: 40px 20px;
            }
            
            .error-icon {
                font-size: 48px;
                display: block;
                margin-bottom: 16px;
            }
            
            .panel-error p {
                color: #6b7280;
                margin-bottom: 20px;
            }
        `;
    }
}

export default SmartImportPanel;