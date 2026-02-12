/**
 * SmartImportWizard v4.0 — Orchestrator
 * Frontend/js/components/SmartImportWizard.js
 * 
 * Vervangt de v3.7 monoliet (~2362 regels).
 * Alle stap-logica zit in losse componenten in smart-import/.
 * Dit bestand doet alleen: modal, navigatie, shared state, finalize.
 *
 * Stappen:
 *   1. Upload    — Drag & drop bestanden
 *   2. Analyse   — AI analyse + polling (auto-advance)
 *   3. Review    — Metadata review + edit + extra docs + reanalyze
 *   4. Team      — Team samenstellen + template kiezen
 *   5. Resultaat — Back-planning + checklist + AI documenten
 *
 * Public API (backward compatible met v3.6/v3.7):
 *   wizard.open()
 *   wizard.openAsModal(tenderId, tenderNaam)
 *   wizard.openForExistingAnalysis(smartImportId, tenderId, tenderNaam)
 *   wizard.close()
 *
 * @version 4.0.0
 * @date 2026-02-09
 */

import { UploadStep } from './smart-import/UploadStep.js';
import { AnalyzeStep } from './smart-import/AnalyzeStep.js';
import { ReviewStep } from './smart-import/ReviewStep.js';
import { ResultStep } from './smart-import/ResultStep.js';
import { SmartImportStyles } from './smart-import/SmartImportStyles.js';

// ─── Icon helper (zelfde als v3.7) ───
const Icons = window.Icons || {};
const getIcon = (name) => {
    if (Icons[name] && typeof Icons[name] === 'function') return Icons[name]();
    const fb = { iconSparkles: '✨', iconUpload: '📤', iconPlus: '➕' };
    return fb[name] || '';
};

// ─── Step definitions ───
const STEPS = [
    { key: 'upload', num: 1, label: 'Upload', Component: UploadStep },
    { key: 'analyze', num: 2, label: 'Analyse', Component: AnalyzeStep },
    { key: 'review', num: 3, label: 'Controleer', Component: ReviewStep },
    { key: 'result', num: 5, label: 'Resultaat', Component: ResultStep },
];


export class SmartImportWizard {

    constructor(options = {}) {
        this.options = options;
        this.onComplete = options.onComplete || (() => { });
        this.onCancel = options.onCancel || (() => { });

        // v3.6: Tender linking
        this.tenderId = options.tenderId || null;
        this.tenderNaam = options.tenderNaam || null;
        this.overrideBureauId = options.overrideBureauId || null;

        // Shared state — alle stappen delen dit object
        this.state = null;

        // Step instances
        this.stepInstances = {};

        // DOM
        this.backdrop = null;
        this.escapeHandler = null;
    }

    // ═══════════════════════════════════════════
    //  SHARED STATE
    // ═══════════════════════════════════════════

    _createState() {
        return {
            // Navigation
            currentStep: 1,
            totalSteps: STEPS.length,
            viewMode: false,

            // Auth & config
            authToken: '',
            baseURL: window.API_CONFIG?.baseURL || 'http://localhost:3000/api/v1',
            tenderbureauId: null,
            overrideBureauId: this.overrideBureauId || null,

            // Upload (stap 1)
            uploadedFiles: [],

            // Analyse (stap 2)
            importId: null,
            isAnalyzing: false,
            analysisProgress: 0,
            analysisSteps: [],

            // Review (stap 3)
            extractedData: null,
            editedData: {},
            currentModel: 'haiku',
            isReanalyzing: false,

            // Extra document (v3.3)
            additionalFiles: [],
            isAddingDocument: false,
            _additionalFiles: [],
            _mergeMode: false,
            _reanalyzeMode: false,

            // Tender linking (v3.6)
            tenderId: this.tenderId || null,
            tenderNaam: this.tenderNaam || null,
            isExistingTender: false,

            // Team (verwijderd)

            // Result (stap 5)
            backplanning: null,
            checklist: null,
            generatedDocs: [],
            acceptedSections: { planning: true, checklist: true, documents: true },

            // ── Callback voor stappen om te navigeren ──
            _navigateTo: (stepNum) => this._goToStep(stepNum),
        };
    }

    // ═══════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════

    /**
     * Open wizard voor nieuwe import
     */
    async open() {
        this._reset();
        await this._ensureAuth();
        this._openModal(1);
    }

    /**
     * v3.6: Open wizard voor bestaande tender
     */
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

    /**
     * v3.7: Open wizard in VIEW mode — bestaande analyse bekijken
     * Springt direct naar stap 3 (Review)
     */
    async openForExistingAnalysis(smartImportId, tenderId, tenderNaam) {
        console.log(`📊 Opening existing analysis: ${smartImportId} for tender: ${tenderNaam}`);

        this._reset();
        this.state.tenderId = tenderId;
        this.state.tenderNaam = tenderNaam;
        this.state.importId = smartImportId;
        this.state.viewMode = true;
        this.state.currentStep = 3;

        // Ensure auth
        await this._ensureAuth();

        // Inject CSS + render modal met loading state
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
            console.log('📊 Loaded analysis data:', data);

            this.state.extractedData = data.extracted_data;
            this.state.currentModel = data.ai_model_used?.includes('sonnet') ? 'sonnet' : 'haiku';

            // Render stap 3
            await this._renderCurrentStep();

        } catch (error) {
            console.error('❌ Error loading analysis:', error);
            this._showError(error.message);
        }
    }

    /**
     * Sluit de wizard en ruim alles op
     */
    close() {
        // Stop polling in AnalyzeStep
        this.stepInstances.analyze?.destroy?.();

        // Remove escape handler
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        // Remove modal
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }

        document.body.classList.remove('siw-open');
    }

    /**
     * v3.6: Link smart_import aan bestaande tender
     */
    async linkToTender(smartImportId) {
        if (!this.state?.tenderId) {
            console.log('ℹ️ Geen tenderId - skip linking');
            return;
        }
        try {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return;

            const { error } = await supabase
                .from('tenders')
                .update({
                    smart_import_id: smartImportId,
                    ai_model_used: this.state.currentModel
                })
                .eq('id', this.state.tenderId);

            if (error) console.error('❌ Error linking tender:', error);
            else console.log('✅ Tender linked to smart_import');
        } catch (err) {
            console.error('❌ linkToTender error:', err);
        }
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: RESET & INIT
    // ═══════════════════════════════════════════

    _reset() {
        this.state = this._createState();
        this.stepInstances = {};
    }

    async _ensureAuth() {
        // 1. Auth token
        if (!this.state.authToken) {
            const supabase = window.supabaseClient || window.supabase;
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                this.state.authToken = session?.access_token || '';
            }
        }

        // 2. Bureau ID (altijd resolven, onafhankelijk van token)
        if (!this.state.tenderbureauId) {
            this.state.tenderbureauId =
                this.overrideBureauId
                || window.bureauAccessService?.getActiveBureauId?.()
                || window.activeBureauId
                || null;

            // Fallback: localStorage
            if (!this.state.tenderbureauId) {
                const stored = localStorage.getItem('selectedBureauId');
                if (stored && stored !== 'ALL_BUREAUS') {
                    this.state.tenderbureauId = stored;
                }
            }

            console.log('🏢 Wizard bureau resolved:', this.state.tenderbureauId);
        }
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: MODAL RENDERING
    // ═══════════════════════════════════════════

    _openModal(startStep) {
        this.state.currentStep = startStep;
        SmartImportStyles.inject();
        this._renderModal();
        this._renderCurrentStep();
    }

    _renderModal() {
        // Verwijder bestaande
        if (this.backdrop) this.backdrop.remove();

        this.backdrop = document.createElement('div');
        this.backdrop.className = 'siw-backdrop';

        this.backdrop.innerHTML = `
            <div class="siw-modal">
                <div class="siw-modal-header">
                    <div class="siw-step-indicators">
                        ${this._renderStepIndicators()}
                    </div>
                    <button class="siw-close-btn" title="Sluiten">&times;</button>
                </div>
                <div class="siw-modal-body" id="siwBody">
                    <!-- Step content rendered here -->
                </div>
                <div class="siw-modal-footer">
                    <div class="siw-footer-left" id="siwFooterLeft"></div>
                    <div class="siw-footer-right" id="siwFooterRight"></div>
                </div>
            </div>
        `;

        document.body.appendChild(this.backdrop);
        document.body.classList.add('siw-open');

        // Fade in
        requestAnimationFrame(() => this.backdrop.classList.add('siw-backdrop--visible'));

        // Global listeners
        this._attachGlobalListeners();
    }

    _renderStepIndicators() {
        const cur = this.state.currentStep;

        return STEPS.map((step, i) => {
            const isDone = step.num < cur;
            const isActive = step.num === cur;
            let dotClass = 'siw-step-dot';
            if (isDone) dotClass += ' siw-step-dot--done';
            if (isActive) dotClass += ' siw-step-dot--active';

            const dot = `
                <div class="${dotClass}">
                    <span class="siw-step-num">${isDone ? '✓' : step.num}</span>
                </div>
            `;

            const line = i < STEPS.length - 1
                ? '<div class="siw-step-line"></div>'
                : '';

            return dot + line;
        }).join('') + `
            <span class="siw-step-label">${STEPS[cur - 1]?.label || ''}</span>
        `;
    }

    _updateStepIndicators() {
        const header = this.backdrop?.querySelector('.siw-step-indicators');
        if (header) header.innerHTML = this._renderStepIndicators();
    }

    _updateFooter() {
        const left = this.backdrop?.querySelector('#siwFooterLeft');
        const right = this.backdrop?.querySelector('#siwFooterRight');
        if (!left || !right) return;

        const cur = this.state.currentStep;
        const isFirst = cur === 1;
        const isLast = cur === STEPS.length;
        const isAnalyze = cur === 2;
        const isViewMode = this.state.viewMode;

        // ── Left side ──
        left.innerHTML = '';

        if (!isFirst && !isAnalyze) {
            left.innerHTML = `
                <button class="siw-btn siw-btn--ghost" id="siwPrevBtn">
                    ← Vorige
                </button>
            `;
        }

        // ── Right side ──
        right.innerHTML = '';

        if (isViewMode && cur === 3) {
            // View mode: alleen Sluiten
            right.innerHTML = `
                <button class="siw-btn siw-btn--secondary" id="siwCancelBtn">Sluiten</button>
            `;
        } else if (isAnalyze) {
            // Analyse: alleen Annuleren (disabled tijdens analyse)
            right.innerHTML = `
                <button class="siw-btn siw-btn--secondary" id="siwCancelBtn">Annuleren</button>
            `;
        } else if (isLast) {
            // Laatste stap: Finalize
            right.innerHTML = `
                <button class="siw-btn siw-btn--secondary" id="siwCancelBtn">Annuleren</button>
                <button class="siw-btn siw-btn--primary" id="siwFinalizeBtn">
                    ✓ Tender aanmaken
                </button>
            `;
        } else {
            // Normale stap: Annuleren + Volgende
            const nextLabel = cur === 1 ? 'Analyseren →' : 'Volgende →';

            right.innerHTML = `
                <button class="siw-btn siw-btn--secondary" id="siwCancelBtn">Annuleren</button>
                <button class="siw-btn siw-btn--primary" id="siwNextBtn">
                    ${nextLabel}
                </button>
            `;
        }

        // ── Attach footer listeners ──
        this.backdrop.querySelector('#siwCancelBtn')?.addEventListener('click', () => {
            this.close();
            this.onCancel();
        });

        this.backdrop.querySelector('#siwPrevBtn')?.addEventListener('click', () => {
            this._goToStep(cur - 1);
        });

        this.backdrop.querySelector('#siwNextBtn')?.addEventListener('click', () => {
            this._handleNext();
        });

        this.backdrop.querySelector('#siwFinalizeBtn')?.addEventListener('click', () => {
            this._handleFinalize();
        });
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: STEP RENDERING
    // ═══════════════════════════════════════════

    async _renderCurrentStep() {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;

        const cur = this.state.currentStep;
        const stepDef = STEPS[cur - 1];
        if (!stepDef) return;

        // Get or create step instance
        let instance = this.stepInstances[stepDef.key];
        if (!instance) {
            instance = new stepDef.Component(this.state);
            this.stepInstances[stepDef.key] = instance;
        }

        // Show loading during init
        body.innerHTML = `
            <div class="siw-loading">
                <div class="siw-loading-spinner"></div>
                <h3>Laden...</h3>
            </div>
        `;

        try {
            // Init (async data loading)
            await instance.init();

            // Render HTML
            body.innerHTML = instance.render();

            // Attach step-specific listeners
            instance.attachListeners(body);

        } catch (error) {
            console.error(`❌ Error in step ${stepDef.key}:`, error);
            body.innerHTML = `
                <div class="siw-error-screen">
                    <span class="siw-error-icon">⚠️</span>
                    <h3>Er ging iets mis</h3>
                    <p>${error.message}</p>
                    <button class="siw-btn siw-btn--secondary" id="siwRetryBtn">Opnieuw proberen</button>
                </div>
            `;
            body.querySelector('#siwRetryBtn')?.addEventListener('click', () => {
                this._renderCurrentStep();
            });
        }

        // Update header + footer
        this._updateStepIndicators();
        this._updateFooter();
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: NAVIGATION
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

        // Validate current step
        if (instance?.validate && !instance.validate()) {
            return; // Validation failed — step toont zelf foutmelding
        }

        // Collect data from current step into shared state
        if (instance?.getData) {
            const data = instance.getData();
            // Merge step data into state
            // Team data niet meer nodig
            if (data.editedData) this.state.editedData = data.editedData;
        }

        // Go to next step
        await this._goToStep(cur + 1);
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: FINALIZE
    // ═══════════════════════════════════════════

    async _handleFinalize() {
        const resultInstance = this.stepInstances.result;
        if (!resultInstance) return;

        // Validate
        if (!resultInstance.validate()) {
            this._showNotification('Selecteer minimaal één onderdeel om aan te maken', 'error');
            return;
        }

        const resultData = resultInstance.getData();
        const btn = this.backdrop?.querySelector('#siwFinalizeBtn');

        try {
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Bezig...';
            }

            await this._ensureAuth();

            // Collect alle data
            const tenderData = this._collectTenderData();

            console.log('📝 Finalizing tender with data:', tenderData);

            // ── Stap A: Tender aanmaken (als nog niet bestaat) ──
            let tenderId = this.state.tenderId;

            if (!tenderId) {
                const createResp = await fetch(
                    `${this.state.baseURL}/smart-import/${this.state.importId}/create-tender`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${this.state.authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            data: tenderData,
                            options: {
                                fase: 'acquisitie',
                                link_documents: true
                            }
                        })
                    }
                );

                if (!createResp.ok) {
                    const err = await createResp.json().catch(() => ({}));
                    throw new Error(err.detail || 'Tender aanmaken mislukt');
                }

                const createResult = await createResp.json();
                tenderId = createResult.tender?.id;
                console.log('✅ Tender created:', createResult);
            }

            // ── Stap B: Planning opslaan (als geaccepteerd) ──
            if (resultData.planning && tenderId) {
                try {
                    await fetch(
                        `${this.state.baseURL}/planning/save`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${this.state.authToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                tender_id: tenderId,
                                taken: resultData.planning,
                                checklist: resultData.checklist,
                                team_assignments: this.state.teamAssignments
                            })
                        }
                    );
                    console.log('✅ Planning saved');
                } catch (planErr) {
                    console.warn('⚠️ Planning opslaan mislukt:', planErr);
                }
            }

            // ── Stap C: Documenten opslaan (als geaccepteerd) ──
            if (resultData.documents?.length > 0 && tenderId) {
                try {
                    await fetch(
                        `${this.state.baseURL}/smart-import/${this.state.importId}/save-documents`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${this.state.authToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                tender_id: tenderId,
                                documents: resultData.documents
                            })
                        }
                    );
                    console.log('✅ Documents saved');
                } catch (docErr) {
                    console.warn('⚠️ Documenten opslaan mislukt:', docErr);
                }
            }

            // ── Succes! ──
            this._showSuccess(tenderData.naam || 'Nieuwe tender');

            // Callback na 1.5s
            setTimeout(() => {
                this.close();
                this.onComplete({
                    id: tenderId,
                    naam: tenderData.naam,
                    fase: 'acquisitie',
                    accepted: resultData.accepted
                });
            }, 1500);

        } catch (error) {
            console.error('❌ Finalize error:', error);
            this._showNotification(`Fout: ${error.message}`, 'error');
            if (btn) {
                btn.disabled = false;
                btn.textContent = '✓ Tender aanmaken';
            }
        }
    }

    /**
     * Verzamel basisgegevens + planning uit editedData + extractedData
     * (zelfde logica als v3.7 collectFormData)
     */
    _collectTenderData() {
        const data = {};
        const ed = this.state.editedData || {};
        const ex = this.state.extractedData || {};

        // Basisgegevens
        const basisFields = [
            'naam', 'opdrachtgever', 'aanbestedende_dienst', 'tender_nummer',
            'type', 'geraamde_waarde', 'locatie', 'tenderned_url'
        ];
        for (const f of basisFields) {
            const val = ed[f] ?? ex.basisgegevens?.[f]?.value;
            if (val !== null && val !== undefined && val !== '') {
                data[f] = f === 'geraamde_waarde' ? parseFloat(val) : val;
            }
        }

        // Planning
        const planFields = [
            'publicatie_datum', 'schouw_datum', 'nvi1_datum', 'nvi_1_publicatie',
            'nvi2_datum', 'nvi_2_publicatie', 'deadline_indiening', 'presentatie_datum',
            'voorlopige_gunning', 'definitieve_gunning', 'start_uitvoering', 'einde_contract'
        ];
        for (const f of planFields) {
            const val = ed[f] ?? ex.planning?.[f]?.value;
            if (val !== null && val !== undefined && val !== '') {
                data[f] = val;
            }
        }

        return data;
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: GLOBAL LISTENERS
    // ═══════════════════════════════════════════

    _attachGlobalListeners() {
        if (!this.backdrop) return;

        // Close button
        this.backdrop.querySelector('.siw-close-btn')?.addEventListener('click', () => {
            this.close();
            this.onCancel();
        });

        // Backdrop click
        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) {
                this.close();
                this.onCancel();
            }
        });

        // Escape key
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.close();
                this.onCancel();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    // ═══════════════════════════════════════════
    //  INTERNAL: UI HELPERS
    // ═══════════════════════════════════════════

    _showLoading(message) {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;
        body.innerHTML = `
            <div class="siw-loading">
                <div class="siw-loading-spinner"></div>
                <h3>${message}</h3>
            </div>
        `;
        this._updateStepIndicators();
        this._updateFooter();
    }

    _showError(message) {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;
        body.innerHTML = `
            <div class="siw-error-screen">
                <span class="siw-error-icon">❌</span>
                <h3>Er ging iets mis</h3>
                <p>${message}</p>
                <button class="siw-btn siw-btn--secondary" id="siwCloseErr">Sluiten</button>
            </div>
        `;
        body.querySelector('#siwCloseErr')?.addEventListener('click', () => {
            this.close();
        });
    }

    _showSuccess(tenderNaam) {
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;
        body.innerHTML = `
            <div class="siw-success-screen">
                <span class="siw-success-icon">🎉</span>
                <h3>Tender aangemaakt!</h3>
                <p>${tenderNaam}</p>
            </div>
        `;
        // Hide footer
        const footer = this.backdrop?.querySelector('.siw-modal-footer');
        if (footer) footer.style.display = 'none';
    }

    _showNotification(message, type = 'error') {
        // Simpele notificatie bovenaan de body
        const body = this.backdrop?.querySelector('#siwBody');
        if (!body) return;

        // Verwijder bestaande notificatie
        body.querySelector('.siw-notification')?.remove();

        const colors = {
            error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
            success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
            info: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
        };
        const c = colors[type] || colors.info;

        const el = document.createElement('div');
        el.className = 'siw-notification';
        el.style.cssText = `
            padding: 10px 16px; margin-bottom: 16px; border-radius: 6px;
            background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
            font-size: 13px; animation: siw-modal-in 0.2s ease;
        `;
        el.textContent = message;

        body.insertBefore(el, body.firstChild);

        // Auto-remove na 5s
        setTimeout(() => el.remove(), 5000);
    }
}

// Default export voor backward compatibility
export default SmartImportWizard;