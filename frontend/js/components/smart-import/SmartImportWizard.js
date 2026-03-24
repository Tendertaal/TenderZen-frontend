/**
 * SmartImportWizard v5.1 — Orchestrator (TCC Design System)
 * Frontend/js/components/SmartImportWizard.js
 *
 * WIJZIGINGEN v5.1 (2026-03-11):
 * - TCC-style header: gradient achtergrond, icoon, titel + subtitel
 * - Header toont context: bestandsnamen, AI model, analyse status
 * - Step indicators als TCC-tabs (horizontale tab-bar onder header)
 * - Iconen uit window.Icons (icons.js) i.p.v. emoji
 * - Grotere typografie voor betere leesbaarheid
 * - _showNotification met scrollTop fix
 * - 409 duplicate tender_nummer afhandeling
 *
 * v5.0 (2026-03-11):
 * - 3 stappen: Upload → Analyse → Review (geen Team/Resultaat)
 * - Vereenvoudigde finalize: alleen tender + documenten
 *
 * @version 5.1.0
 * @date 2026-03-11
 */

import { BasicInfoStep } from './BasicInfoStep.js';
import { UploadStep } from './UploadStep.js';
import { AnalyzeStep } from './AnalyzeStep.js';
import { ReviewStep } from './ReviewStep.js';
import { SmartImportStyles } from './SmartImportStyles.js';

// ─── Icon helper (uit icons.js) ───
const getIcon = (name, opts = {}) => {
    const Icons = window.Icons || {};
    if (Icons[name] && typeof Icons[name] === 'function') return Icons[name](opts);
    return '';
};

// ─── Step definitions ───
const STEPS = [
    { key: 'basicinfo', num: 1, label: 'Basisgegevens', icon: 'clipboardList' },
    { key: 'upload',    num: 2, label: 'Upload',        icon: 'upload' },
    { key: 'analyze',   num: 3, label: 'Analyse',       icon: 'zap' },
    { key: 'review',    num: 4, label: 'Controleer',    icon: 'clipboardList' },
];

// ─── Step component classes ───
const STEP_COMPONENTS = {
    basicinfo: BasicInfoStep,
    upload:    UploadStep,
    analyze:   AnalyzeStep,
    review:    ReviewStep,
};


export class SmartImportWizard {

    constructor(options = {}) {
        this.options = options;
        this.onComplete = options.onComplete || (() => { });
        this.onCancel = options.onCancel || (() => { });

        this.tenderId = options.tenderId || null;
        this.tenderNaam = options.tenderNaam || null;
        this.overrideBureauId = options.overrideBureauId || null;

        this.state = null;
        this.stepInstances = {};
        this.backdrop = null;
        this.escapeHandler = null;
    }

    // ═══════════════════════════════════════════
    //  SHARED STATE
    // ═══════════════════════════════════════════

    _createState() {
        return {
            currentStep: 1,
            totalSteps: STEPS.length,
            viewMode: false,

            authToken: '',
            baseURL: window.API_CONFIG?.baseURL || 'http://localhost:3000/api/v1',
            tenderbureauId: null,
            overrideBureauId: this.overrideBureauId || null,

            uploadedFiles: [],

            importId: null,
            isAnalyzing: false,
            analysisProgress: 0,
            analysisSteps: [],

            extractedData: null,
            editedData: {},
            currentModel: 'haiku',
            isReanalyzing: false,

            additionalFiles: [],
            isAddingDocument: false,
            _additionalFiles: [],
            _mergeMode: false,
            _reanalyzeMode: false,

            tenderId: this.tenderId || null,
            tenderNaam: this.tenderNaam || null,
            isExistingTender: false,

            _navigateTo: (stepNum) => this._goToStep(stepNum),
        };
    }

    // ═══════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════

    async open() {
        this._reset();
        await this._ensureAuth();
        this._openModal(1);
    }

    async openAsModal(tenderId = null, tenderNaam = null) {
        this.tenderId = tenderId;
        this.tenderNaam = tenderNaam;
        this._reset();
        this.state.tenderId = tenderId;
        this.state.tenderNaam = tenderNaam;
        this.state.isExistingTender = !!tenderId;
        await this._ensureAuth();
        this._openModal(1);
        console.log(`📤 Smart Import Wizard opened for tender: ${tenderId} (${tenderNaam})`);
    }

    async openForExistingAnalysis(smartImportId, tenderId, tenderNaam) {
        console.log(`📊 Opening existing analysis: ${smartImportId} for tender: ${tenderNaam}`);
        this._reset();
        this.state.tenderId = tenderId;
        this.state.tenderNaam = tenderNaam;
        this.state.importId = smartImportId;
        this.state.viewMode = true;
        this.state.currentStep = 4;

        await this._ensureAuth();
        SmartImportStyles.inject();
        this._renderModal();
        this._showLoading('Analyse data laden...');

        try {
            const resp = await fetch(
                `${this.state.baseURL}/smart-import/${smartImportId}/status`,
                { headers: { 'Authorization': `Bearer ${this.state.authToken}` } }
            );
            if (!resp.ok) throw new Error('Kon analyse data niet laden');
            const data = await resp.json();
            this.state.extractedData = data.extracted_data;
            this.state.currentModel = data.ai_model_used?.includes('sonnet') ? 'sonnet' : 'haiku';
            await this._renderCurrentStep();
        } catch (error) {
            console.error('❌ Error loading analysis:', error);
            this._showError(error.message);
        }
    }

    close() {
        this.stepInstances.analyze?.destroy?.();
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        document.body.classList.remove('siw-open');
    }

    async linkToTender(smartImportId) {
        if (!this.state?.tenderId) return;
        try {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return;
            const { error } = await supabase
                .from('tenders')
                .update({ smart_import_id: smartImportId, ai_model_used: this.state.currentModel })
                .eq('id', this.state.tenderId);
            if (error) console.error('❌ Error linking tender:', error);
            else console.log('✅ Tender linked to smart_import');
        } catch (err) {
            console.error('❌ linkToTender error:', err);
        }
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: RESET & AUTH
    // ═══════════════════════════════════════════

    _reset() {
        this.state = this._createState();
        this.stepInstances = {};
    }

    async _ensureAuth() {
        if (!this.state.authToken) {
            const supabase = window.supabaseClient || window.supabase;
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                this.state.authToken = session?.access_token || '';
            }
        }
        if (!this.state.tenderbureauId) {
            const _validId = (v) => (v && v !== 'ALL_BUREAUS') ? v : null;
            this.state.tenderbureauId =
                _validId(this.overrideBureauId)
                || _validId(window.bureauAccessService?.getActiveBureauId?.())
                || _validId(window.activeBureauId)
                || _validId(localStorage.getItem('selectedBureauId'))
                || _validId(localStorage.getItem('tenderbureau_id'))
                || null;
            console.log('🏢 Wizard bureau resolved:', this.state.tenderbureauId);
            this.state.activeBureauId = this.state.tenderbureauId;
            this.state.tenderbureau_id = this.state.tenderbureauId;
        }
    }

    // ═══════════════════════════════════════════
    //  MODAL RENDERING
    // ═══════════════════════════════════════════

    _openModal(startStep) {
        this.state.currentStep = startStep;
        SmartImportStyles.inject();
        this._renderModal();
        this._renderCurrentStep();
    }

    _renderModal() {
        if (this.backdrop) this.backdrop.remove();
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'siw-backdrop';

        this.backdrop.innerHTML = `
            <div class="siw-modal">
                <div class="siw-header">
                    <div class="siw-header-top">
                        <div class="siw-header-left">
                            <div class="siw-header-icon">
                                ${getIcon('zap', { size: 22, color: '#ffffff' })}
                            </div>
                            <div class="siw-header-info">
                                <h2>Smart Import</h2>
                                <div class="siw-header-meta" id="siwHeaderMeta">
                                    ${this._renderHeaderMeta()}
                                </div>
                            </div>
                        </div>
                        <button class="siw-close-btn" title="Sluiten">
                            ${getIcon('close', { size: 18, color: '#64748b' })}
                        </button>
                    </div>
                    <div class="siw-tabs" id="siwTabs">
                        ${this._renderTabs()}
                    </div>
                </div>
                <div class="siw-body" id="siwBody"></div>
                <div class="siw-footer">
                    <div class="siw-footer-left" id="siwFooterLeft"></div>
                    <div class="siw-footer-right" id="siwFooterRight"></div>
                </div>
            </div>
        `;

        document.body.appendChild(this.backdrop);
        document.body.classList.add('siw-open');
        requestAnimationFrame(() => this.backdrop.classList.add('siw-backdrop--visible'));
        this._attachGlobalListeners();
    }

    // ═══════════════════════════════════════════
    //  TCC-STYLE HEADER
    // ═══════════════════════════════════════════

    _renderHeaderMeta() {
        const tags = [];
        const files = this.state.uploadedFiles || [];
        const model = this.state.currentModel;
        const tenderNaam = this.state.tenderNaam;
        const extractedNaam = this.state.extractedData?.basisgegevens?.naam?.value;

        // Context: tender naam of "Nieuwe tender"
        if (tenderNaam) {
            tags.push(`<span class="siw-meta-tag siw-meta-tag--tender">${this._esc(tenderNaam)}</span>`);
        } else if (extractedNaam) {
            tags.push(`<span class="siw-meta-tag siw-meta-tag--tender">${this._esc(extractedNaam)}</span>`);
        } else {
            tags.push(`<span class="siw-meta-tag siw-meta-tag--info">Nieuwe tender importeren</span>`);
        }

        // Bestanden count
        if (files.length > 0) {
            tags.push(`<span class="siw-meta-tag siw-meta-tag--files">${getIcon('fileText', { size: 12, color: '#4338ca' })} ${files.length} bestand${files.length !== 1 ? 'en' : ''}</span>`);
        }

        // AI Model
        if (this.state.currentStep >= 3 && model) {
            const isPro = model === 'sonnet' || model.includes('sonnet');
            tags.push(`<span class="siw-meta-tag siw-meta-tag--model">${getIcon('zap', { size: 12, color: isPro ? '#92400e' : '#4338ca' })} ${isPro ? 'Pro (Sonnet)' : 'Standaard (Haiku)'}</span>`);
        }

        return tags.join('');
    }

    _updateHeaderMeta() {
        const meta = this.backdrop?.querySelector('#siwHeaderMeta');
        if (meta) meta.innerHTML = this._renderHeaderMeta();
    }

    // ═══════════════════════════════════════════
    //  TCC-STYLE TABS
    // ═══════════════════════════════════════════

    _renderTabs() {
        const cur = this.state.currentStep;

        return STEPS.map(step => {
            const isDone = step.num < cur;
            const isActive = step.num === cur;
            let cls = 'siw-tab';
            if (isActive) cls += ' is-active';
            if (isDone) cls += ' is-done';

            const iconColor = isActive ? '#4338ca' : isDone ? '#22c55e' : '#94a3b8';
            const icon = isDone
                ? getIcon('checkCircle', { size: 16, color: '#22c55e' })
                : getIcon(step.icon, { size: 16, color: iconColor });

            const badge = isDone
                ? '<span class="siw-tab-badge siw-tab-badge--done">✓</span>'
                : '';

            return `
                <button class="${cls}" data-step="${step.num}">
                    <span class="siw-tab-icon">${icon}</span>
                    <span class="siw-tab-label">${step.label}</span>
                    ${badge}
                </button>
            `;
        }).join('');
    }

    _updateTabs() {
        const tabs = this.backdrop?.querySelector('#siwTabs');
        if (tabs) tabs.innerHTML = this._renderTabs();
    }

    // ═══════════════════════════════════════════
    //  FOOTER
    // ═══════════════════════════════════════════

    _updateFooter() {
        const left = this.backdrop?.querySelector('#siwFooterLeft');
        const right = this.backdrop?.querySelector('#siwFooterRight');
        if (!left || !right) return;

        const cur = this.state.currentStep;
        const isFirst = cur === 1;
        const isLast = cur === STEPS.length;
        const isAnalyze = cur === 3;
        const isViewMode = this.state.viewMode;

        left.innerHTML = '';
        if (!isFirst && !isAnalyze) {
            left.innerHTML = `
                <button class="siw-btn siw-btn--ghost" id="siwPrevBtn">
                    ${getIcon('chevronLeft', { size: 16, color: '#64748b' })} Vorige
                </button>
            `;
        }

        right.innerHTML = '';
        if (isViewMode && cur === 3) {
            right.innerHTML = `
                <button class="siw-btn siw-btn--ghost" id="siwCancelBtn">
                    ${getIcon('close', { size: 16, color: '#dc2626' })} Sluiten
                </button>
            `;
        } else if (isAnalyze) {
            right.innerHTML = `
                <button class="siw-btn siw-btn--ghost" id="siwCancelBtn">
                    ${getIcon('close', { size: 16, color: '#dc2626' })} Annuleren
                </button>
            `;
        } else if (isLast) {
            right.innerHTML = `
                <button class="siw-btn siw-btn--ghost" id="siwCancelBtn">
                    ${getIcon('close', { size: 16, color: '#dc2626' })} Annuleren
                </button>
                <button class="siw-btn siw-btn--primary" id="siwFinalizeBtn">
                    ${getIcon('check', { size: 16, color: '#ffffff' })} Tender aanmaken
                </button>
            `;
        } else {
            const nextLabel = cur === 1 ? 'Analyseren' : 'Volgende';
            right.innerHTML = `
                <button class="siw-btn siw-btn--ghost" id="siwCancelBtn">
                    ${getIcon('close', { size: 16, color: '#dc2626' })} Annuleren
                </button>
                <button class="siw-btn siw-btn--primary" id="siwNextBtn">
                    ${nextLabel} ${getIcon('chevronRight', { size: 16, color: '#ffffff' })}
                </button>
            `;
        }

        this.backdrop.querySelector('#siwCancelBtn')?.addEventListener('click', () => { this.close(); this.onCancel(); });
        this.backdrop.querySelector('#siwPrevBtn')?.addEventListener('click', () => { this._goToStep(cur - 1); });
        this.backdrop.querySelector('#siwNextBtn')?.addEventListener('click', () => { this._handleNext(); });
        this.backdrop.querySelector('#siwFinalizeBtn')?.addEventListener('click', () => { this._handleFinalize(); });
    }

    // ═══════════════════════════════════════════
    //  STEP RENDERING
    // ═══════════════════════════════════════════

    async _renderCurrentStep() {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;

        const cur = this.state.currentStep;
        const stepDef = STEPS[cur - 1];
        if (!stepDef) return;

        let instance = this.stepInstances[stepDef.key];
        if (!instance) {
            const Cls = STEP_COMPONENTS[stepDef.key];
            instance = new Cls(this.state);
            this.stepInstances[stepDef.key] = instance;
        }

        body.innerHTML = `
            <div class="siw-loading">
                <div class="siw-loading-spinner"></div>
                <p>Laden...</p>
            </div>
        `;

        try {
            await instance.init();
            body.innerHTML = instance.render();
            instance.attachListeners(body);
        } catch (error) {
            console.error(`❌ Error in step ${stepDef.key}:`, error);
            body.innerHTML = `
                <div class="siw-error-screen">
                    <div class="siw-error-icon">${getIcon('alertCircle', { size: 48, color: '#dc2626' })}</div>
                    <h3>Er ging iets mis</h3>
                    <p>${error.message}</p>
                    <button class="siw-btn siw-btn--ghost" id="siwRetryBtn">
                        ${getIcon('refresh', { size: 16, color: '#64748b' })} Opnieuw proberen
                    </button>
                </div>
            `;
            body.querySelector('#siwRetryBtn')?.addEventListener('click', () => this._renderCurrentStep());
        }

        this._updateTabs();
        this._updateHeaderMeta();
        this._updateFooter();
    }

    // ═══════════════════════════════════════════
    //  NAVIGATION
    // ═══════════════════════════════════════════

    async _goToStep(stepNum) {
        if (stepNum < 1 || stepNum > STEPS.length) return;
        this.state.currentStep = stepNum;
        await this._renderCurrentStep();
    }

    async _handleNext() {
        const cur = this.state.currentStep;
        const stepDef = STEPS[cur - 1];
        const instance = this.stepInstances[stepDef.key];

        if (instance?.validate && !instance.validate()) return;
        if (instance?.getData) {
            const data = instance.getData();
            Object.assign(this.state, data);
            if (data.editedData) this.state.editedData = data.editedData;
        }
        await this._goToStep(cur + 1);
    }

    // ═══════════════════════════════════════════
    //  FINALIZE
    // ═══════════════════════════════════════════

    async _handleFinalize() {
        const reviewInstance = this.stepInstances.review;
        if (reviewInstance?.getData) {
            const data = reviewInstance.getData();
            Object.assign(this.state, data);
            if (data.editedData) this.state.editedData = data.editedData;
        }

        const btn = this.backdrop?.querySelector('#siwFinalizeBtn');
        try {
            if (btn) { btn.disabled = true; btn.innerHTML = `<span class="siw-btn-spinner"></span> Bezig...`; }
            await this._ensureAuth();
            const tenderData = this._collectTenderData();
            console.log('📝 Finalizing tender with data:', tenderData);

            let tenderId = this.state.tenderId;
            if (!tenderId) {
                const createResp = await fetch(
                    `${this.state.baseURL}/smart-import/${this.state.importId}/create-tender`,
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${this.state.authToken}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: tenderData, options: { fase: 'acquisitie', link_documents: true } })
                    }
                );

                if (!createResp.ok) {
                    const err = await createResp.json().catch(() => ({}));
                    if (createResp.status === 409 || err.detail?.code === 'DUPLICATE_TENDER_NUMMER') {
                        const nummer = tenderData.tender_nummer || '';
                        this._showNotification(
                            `Tender nummer "${nummer}" bestaat al in dit bureau. Pas het nummer aan en probeer opnieuw.`,
                            'error'
                        );
                        if (btn) { btn.disabled = false; btn.innerHTML = `${getIcon('check', { size: 16, color: '#ffffff' })} Tender aanmaken`; }
                        return;
                    }
                    throw new Error(typeof err.detail === 'string' ? err.detail : err.detail?.message || 'Tender aanmaken mislukt');
                }

                const createResult = await createResp.json();
                tenderId = createResult.tender?.id;
                console.log('✅ Tender created:', tenderId);
            }

            this._showSuccess(tenderData.naam || 'Nieuwe tender');
            setTimeout(() => {
                this.close();
                this.onComplete({ id: tenderId, naam: tenderData.naam, fase: 'acquisitie' });
            }, 1500);

        } catch (error) {
            console.error('❌ Finalize error:', error);
            this._showNotification(`Fout: ${error.message}`, 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = `${getIcon('check', { size: 16, color: '#ffffff' })} Tender aanmaken`; }
        }
    }

    _collectTenderData() {
        const data = {};
        const ed = this.state.editedData || {};
        const ex = this.state.extractedData || {};

        for (const f of ['naam', 'opdrachtgever', 'aanbestedende_dienst', 'tender_nummer', 'type', 'geraamde_waarde', 'locatie', 'tenderned_url']) {
            const val = ed[f] ?? ex.basisgegevens?.[f]?.value;
            if (val !== null && val !== undefined && val !== '') data[f] = f === 'geraamde_waarde' ? parseFloat(val) : val;
        }
        for (const f of ['publicatie_datum', 'schouw_datum', 'nvi1_datum', 'nvi_1_publicatie', 'nvi2_datum', 'nvi_2_publicatie', 'deadline_indiening', 'presentatie_datum', 'voorlopige_gunning', 'definitieve_gunning', 'start_uitvoering', 'einde_contract']) {
            const val = ed[f] ?? ex.planning?.[f]?.value;
            if (val !== null && val !== undefined && val !== '') data[f] = val;
        }
        return data;
    }

    // ═══════════════════════════════════════════
    //  GLOBAL LISTENERS
    // ═══════════════════════════════════════════

    _attachGlobalListeners() {
        if (!this.backdrop) return;
        this.backdrop.querySelector('.siw-close-btn')?.addEventListener('click', () => { this.close(); this.onCancel(); });
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) { this.close(); this.onCancel(); return; }
            const btn = e.target.closest('[data-action="si-skip-upload"]');
            if (btn) this._handleSkipUpload();
        });
        this.escapeHandler = (e) => { if (e.key === 'Escape') { this.close(); this.onCancel(); } };
        document.addEventListener('keydown', this.escapeHandler);
    }

    async _handleSkipUpload() {
        const btn = this.backdrop?.querySelector('[data-action="si-skip-upload"]');
        try {
            if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }
            await this._ensureAuth();

            const tenderData = {
                naam: this.state.tenderNaam || '',
                opdrachtgever: this.state.opdrachtgever || '',
                bedrijf_id: this.state.bedrijfId || null,
                deadline_indiening: this.state.deadline ? `${this.state.deadline}T00:00:00` : null,
                tenderbureau_id: this.state.tenderbureauId || null,
                fase: 'acquisitie',
            };

            const resp = await fetch(`${this.state.baseURL}/tenders`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.state.authToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(tenderData),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(typeof err.detail === 'string' ? err.detail : 'Tender aanmaken mislukt');
            }

            const result = await resp.json();
            const tenderId = result.id || result.tender?.id;
            this._showSuccess(tenderData.naam || 'Nieuwe tender');
            setTimeout(() => {
                this.close();
                this.onComplete({ id: tenderId, naam: tenderData.naam, fase: 'acquisitie' });
            }, 1500);
        } catch (err) {
            console.error('❌ Skip upload fout:', err);
            this._showNotification(`Fout: ${err.message}`, 'error');
            if (btn) { btn.disabled = false; btn.textContent = 'Geen documenten? Sla over en maak de tender direct aan →'; }
        }
    }

    // ═══════════════════════════════════════════
    //  UI HELPERS
    // ═══════════════════════════════════════════

    _showLoading(message) {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;
        body.innerHTML = `
            <div class="siw-loading">
                <div class="siw-loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        this._updateTabs();
        this._updateHeaderMeta();
        this._updateFooter();
    }

    _showError(message) {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;
        body.innerHTML = `
            <div class="siw-error-screen">
                <div class="siw-error-icon">${getIcon('alertCircle', { size: 48, color: '#dc2626' })}</div>
                <h3>Er ging iets mis</h3>
                <p>${message}</p>
                <button class="siw-btn siw-btn--ghost" id="siwCloseErr">
                    ${getIcon('close', { size: 16, color: '#64748b' })} Sluiten
                </button>
            </div>
        `;
        body.querySelector('#siwCloseErr')?.addEventListener('click', () => this.close());
    }

    _showSuccess(tenderNaam) {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;
        body.innerHTML = `
            <div class="siw-success-screen">
                <div class="siw-success-icon">${getIcon('checkCircle', { size: 64, color: '#22c55e' })}</div>
                <h3>Tender aangemaakt!</h3>
                <p class="siw-success-name">${this._esc(tenderNaam)}</p>
                <p class="siw-success-hint">Open de tender om team en planning in te stellen</p>
            </div>
        `;
        const footer = this.backdrop?.querySelector('.siw-footer');
        if (footer) footer.style.display = 'none';
    }

    _showNotification(message, type = 'error') {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;

        body.querySelector('.siw-notification')?.remove();

        const icons = { error: 'alertCircle', success: 'checkCircle', info: 'info' };
        const colors = {
            error:   { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', icon: '#dc2626' },
            success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', icon: '#22c55e' },
            info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', icon: '#2563eb' },
        };
        const c = colors[type] || colors.info;

        const el = document.createElement('div');
        el.className = 'siw-notification';
        el.style.cssText = `
            display: flex; align-items: flex-start; gap: 10px;
            padding: 14px 18px; margin-bottom: 16px; border-radius: 10px;
            background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
            font-size: 14px; line-height: 1.5; animation: siw-modal-in 0.25s ease;
        `;
        el.innerHTML = `
            <span style="flex-shrink:0; margin-top: 1px;">${getIcon(icons[type] || 'info', { size: 18, color: c.icon })}</span>
            <span>${message}</span>
        `;

        body.insertBefore(el, body.firstChild);
        body.scrollTop = 0;

        setTimeout(() => el.remove(), 8000);
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
}

export default SmartImportWizard;