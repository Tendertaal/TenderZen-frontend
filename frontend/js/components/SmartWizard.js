// ================================================================
// TenderZen — Smart Import Wizard v4.0 — Orchestrator
// Frontend/js/components/SmartImportWizard.js
// Datum: 2026-02-09 (v2 — met component-split support)
// ================================================================
//
// Dunne orchestrator die de 5 wizard-stappen aanstuurt.
// Elke stap is een apart component met dezelfde interface:
//   init(), render(), attachListeners(), validate(), getData()
//
// Stappen:
//   1. Upload     → Documenten uploaden
//   2. Analyse    → AI extraheert data (polling, auto-advance)
//   3. Controleer → Metadata review & edit
//   4. Team       → Rollen toewijzen aan personen
//   5. Resultaat  → Planning preview + AI documenten
//
// v3.6 compatible: openAsModal(), viewMode, overrideBureauId
// ================================================================

import { UploadStep } from './smart-import/UploadStep.js';
import { AnalyzeStep } from './smart-import/AnalyzeStep.js';
import { ReviewStep } from './smart-import/ReviewStep.js';
import { TeamStep } from './smart-import/TeamStep.js';
import { ResultStep } from './smart-import/ResultStep.js';
import { SmartImportStyles } from './smart-import/SmartImportStyles.js';


export class SmartImportWizard {

    constructor(options = {}) {
        this.options = options;
        this.onComplete = options.onComplete || (() => {});
        this.onCancel = options.onCancel || (() => {});

        // ── Shared state ──
        // Alle stappen lezen/schrijven hierin (by reference)
        this.state = {
            currentStep: 1,
            totalSteps: 5,
            tenderId: options.tenderId || null,
            tenderNaam: options.tenderNaam || null,
            tenderbureauId: options.tenderbureauId || null,
            overrideBureauId: options.overrideBureauId || null,
            uploadedFiles: [],
            importId: null,
            extractedData: null,
            editedData: {},
            currentModel: 'haiku',
            teamAssignments: {},
            selectedTemplate: null,
            backplanning: null,
            generatedDocs: [],
            authToken: options.authToken || '',
            baseURL: options.baseURL
                || window.API_CONFIG?.baseURL
                || '/api/v1',

            // ── Interne flags (voor inter-stap communicatie) ──
            _reanalyzeMode: false,
            _mergeMode: false,
            _additionalFiles: [],

            // ── Navigatie callback ──
            // Wordt door AnalyzeStep en ReviewStep gebruikt om
            // te navigeren (bijv. auto-advance na analyse)
            _navigateTo: (stepNum) => this.goToStep(stepNum)
        };

        // ── Stap instances ──
        this.steps = {
            1: new UploadStep(this.state),
            2: new AnalyzeStep(this.state),
            3: new ReviewStep(this.state),
            4: new TeamStep(this.state),
            5: new ResultStep(this.state)
        };

        this.stepLabels = [
            { num: 1, label: 'Upload',     icon: '📄' },
            { num: 2, label: 'Analyse',    icon: '🤖' },
            { num: 3, label: 'Controleer', icon: '✏️' },
            { num: 4, label: 'Team',       icon: '👥' },
            { num: 5, label: 'Resultaat',  icon: '✅' }
        ];

        this.backdrop = null;
        this.isTransitioning = false;
        this.isFinalizing = false;

        // Inject CSS
        SmartImportStyles.inject();
    }

    // ══════════════════════════════════════════════
    // PUBLIEKE METHODES
    // ══════════════════════════════════════════════

    /**
     * Open de wizard als modal.
     * Kan met of zonder bestaande tender.
     */
    open(tenderId = null, tenderNaam = null) {
        if (tenderId) {
            this.state.tenderId = tenderId;
            this.state.tenderNaam = tenderNaam;
        }

        this._createModal();
        this.goToStep(1);
    }

    /**
     * v3.6: Alias voor open() — backwards compatible.
     */
    openAsModal(tenderId, tenderNaam) {
        this.open(tenderId, tenderNaam);
    }

    /**
     * v3.7: Open in VIEW mode — toon bestaande analyse resultaten.
     * Springt direct naar stap 3 met data uit de database.
     */
    async openForExistingAnalysis(smartImportId, tenderId, tenderNaam) {
        console.log(`📊 Opening existing analysis: ${smartImportId}`);

        this.state.tenderId = tenderId;
        this.state.tenderNaam = tenderNaam;
        this.state.importId = smartImportId;

        // Haal auth token op
        await this._ensureAuth();

        this._createModal();

        // Toon loading
        const content = this.backdrop?.querySelector('.wizard-content');
        if (content) {
            content.innerHTML = `
                <div class="siw-loading">
                    <div class="siw-loading-spinner"></div>
                    <p>Analyse data laden...</p>
                </div>
            `;
        }

        try {
            const resp = await fetch(
                `${this.state.baseURL}/smart-import/${smartImportId}/status`,
                { headers: { 'Authorization': `Bearer ${this.state.authToken}` } }
            );

            if (!resp.ok) throw new Error('Kon analyse data niet laden');

            const data = await resp.json();
            this.state.extractedData = data.extracted_data;
            this.state.currentModel = data.ai_model_used?.includes('sonnet')
                ? 'sonnet' : 'haiku';

            // Ga naar stap 3 (Review)
            this.state.currentStep = 3;
            this._renderCurrentStep();

        } catch (error) {
            console.error('❌ Error loading analysis:', error);
            if (content) {
                content.innerHTML = `
                    <div class="siw-error-screen">
                        <span class="siw-error-icon">❌</span>
                        <h3>${error.message}</h3>
                        <button class="siw-btn siw-btn--secondary" id="siwViewClose">Sluiten</button>
                    </div>
                `;
                content.querySelector('#siwViewClose')?.addEventListener('click', () => {
                    this.close(true);
                });
            }
        }
    }

    /**
     * Sluit de wizard (met bevestiging als er al data is).
     */
    close(force = false) {
        if (!force && this.state.currentStep > 1) {
            const confirmed = confirm(
                'Weet je zeker dat je de import wilt annuleren?\n' +
                'Alle ingevoerde data gaat verloren.'
            );
            if (!confirmed) return;
        }

        // Cleanup AnalyzeStep polling
        if (this.steps[2]?.destroy) {
            this.steps[2].destroy();
        }

        this._removeModal();
        this.onCancel();
    }

    /**
     * Stel auth token in (bijv. na login).
     */
    setAuthToken(token) {
        this.state.authToken = token;
    }

    /**
     * Stel bureau ID in.
     */
    setBureauId(bureauId) {
        this.state.tenderbureauId = bureauId;
    }

    // ══════════════════════════════════════════════
    // NAVIGATIE
    // ══════════════════════════════════════════════

    /**
     * Ga naar een specifieke stap.
     * Roept init() aan van de stap.
     */
    async goToStep(stepNum) {
        if (stepNum < 1 || stepNum > this.state.totalSteps) return;
        if (this.isTransitioning) return;

        this.isTransitioning = true;

        try {
            const step = this.steps[stepNum];

            // Init (async data laden, upload starten, etc.)
            if (step.init) {
                // Stap 2 (Analyse) toont eigen loading UI in render()
                // Andere stappen tonen generieke loading
                if (stepNum !== 2) {
                    this._showStepLoading(stepNum);
                }
                await step.init();
            }

            this.state.currentStep = stepNum;
            this._renderCurrentStep();

        } catch (err) {
            console.error(`SmartImportWizard: Fout bij stap ${stepNum}:`, err);
            this._showStepError(stepNum, err.message);
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Ga naar de volgende stap (met validatie + data ophalen).
     */
    async nextStep() {
        const currentStep = this.steps[this.state.currentStep];

        // Valideer huidige stap
        if (currentStep.validate && !currentStep.validate()) {
            return;
        }

        // Verzamel data van huidige stap → merge in shared state
        if (currentStep.getData) {
            const data = currentStep.getData();
            Object.assign(this.state, data);
        }

        // Laatste stap? → Finalize
        if (this.state.currentStep === this.state.totalSteps) {
            await this._finalize();
            return;
        }

        await this.goToStep(this.state.currentStep + 1);
    }

    /**
     * Ga naar de vorige stap (zonder validatie).
     */
    async prevStep() {
        if (this.state.currentStep > 1) {
            await this.goToStep(this.state.currentStep - 1);
        }
    }

    // ══════════════════════════════════════════════
    // FINALIZE — ALLES OPSLAAN
    // ══════════════════════════════════════════════

    async _finalize() {
        if (this.isFinalizing) return;
        this.isFinalizing = true;

        this._showFinalizeLoading();

        try {
            const resultStep = this.steps[5];
            const resultData = resultStep.getData ? resultStep.getData() : {};

            const payload = {
                tender_id: this.state.tenderId,
                tender_naam: this.state.tenderNaam,
                tenderbureau_id: this.state.tenderbureauId
                    || this.state.overrideBureauId,
                import_id: this.state.importId,
                metadata: this.state.editedData || this.state.extractedData,
                team_assignments: this.state.teamAssignments || {},
                accepted: resultData.accepted || [],
                planning_taken: resultData.planning || [],
                checklist_items: resultData.checklist || [],
                documents: (resultData.documents || []).map(d => d.id).filter(Boolean),
                planning_metadata: resultData.metadata || {}
            };

            const response = await fetch(
                `${this.state.baseURL}/smart-import/finalize`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Opslaan mislukt (HTTP ${response.status}): ${errorText}`);
            }

            const result = await response.json();

            this._showFinalizeSuccess(result);

            setTimeout(() => {
                this.onComplete(result);
                this._removeModal();
            }, 1500);

        } catch (err) {
            console.error('SmartImportWizard: Finalize mislukt:', err);
            this._showFinalizeError(err.message);
        } finally {
            this.isFinalizing = false;
        }
    }

    // ══════════════════════════════════════════════
    // MODAL MANAGEMENT
    // ══════════════════════════════════════════════

    _createModal() {
        this._removeModal();

        this.backdrop = document.createElement('div');
        this.backdrop.className = 'siw-backdrop';
        this.backdrop.innerHTML = `
            <div class="siw-modal">
                <div class="siw-modal-header">
                    <div class="siw-step-indicators"></div>
                    <button class="siw-close-btn" title="Sluiten">✕</button>
                </div>
                <div class="siw-modal-body">
                    <div class="wizard-content"></div>
                </div>
                <div class="siw-modal-footer"></div>
            </div>
        `;

        this.backdrop.querySelector('.siw-close-btn')
            .addEventListener('click', () => this.close());

        this.backdrop.addEventListener('click', (e) => {
            if (e.target === this.backdrop) this.close();
        });

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this._escHandler);

        document.body.appendChild(this.backdrop);
        document.body.classList.add('siw-open');

        requestAnimationFrame(() => {
            this.backdrop.classList.add('siw-backdrop--visible');
        });
    }

    _removeModal() {
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        document.body.classList.remove('siw-open');
    }

    // ══════════════════════════════════════════════
    // RENDERING
    // ══════════════════════════════════════════════

    _renderCurrentStep() {
        if (!this.backdrop) return;

        const step = this.steps[this.state.currentStep];
        const content = this.backdrop.querySelector('.wizard-content');

        if (content && step.render) {
            content.innerHTML = step.render();
            if (step.attachListeners) {
                step.attachListeners(content);
            }
        }

        this._renderStepIndicators();
        this._renderFooter();
    }

    _renderStepIndicators() {
        const container = this.backdrop?.querySelector('.siw-step-indicators');
        if (!container) return;

        container.innerHTML = this.stepLabels.map(s => {
            let cls = 'siw-step-dot';
            if (s.num < this.state.currentStep) cls += ' siw-step-dot--done';
            if (s.num === this.state.currentStep) cls += ' siw-step-dot--active';

            return `
                <div class="${cls}" data-step="${s.num}" title="${s.label}">
                    <span class="siw-step-num">${s.num}</span>
                </div>
                ${s.num < this.state.totalSteps ? '<div class="siw-step-line"></div>' : ''}
            `;
        }).join('');

        const current = this.stepLabels[this.state.currentStep - 1];
        const existing = container.querySelector('.siw-step-label');
        const labelHtml = `Stap ${current.num} van ${this.state.totalSteps} — ${current.label}`;

        if (existing) {
            existing.textContent = labelHtml;
        } else {
            container.insertAdjacentHTML('beforeend',
                `<span class="siw-step-label">${labelHtml}</span>`
            );
        }
    }

    _renderFooter() {
        const footer = this.backdrop?.querySelector('.siw-modal-footer');
        if (!footer) return;

        const step = this.state.currentStep;
        const isFirst = step === 1;
        const isLast = step === this.state.totalSteps;
        const isAnalyzing = step === 2;

        // Stap 2 (Analyse): geen footer knoppen (auto-advance)
        if (isAnalyzing) {
            footer.innerHTML = `
                <div class="siw-footer-left"></div>
                <div class="siw-footer-right">
                    <button class="siw-btn siw-btn--ghost" id="siwCancelBtn">Annuleren</button>
                </div>
            `;
            footer.querySelector('#siwCancelBtn')
                ?.addEventListener('click', () => this.close());
            return;
        }

        footer.innerHTML = `
            <div class="siw-footer-left">
                ${!isFirst ? `
                    <button class="siw-btn siw-btn--secondary" id="siwPrevBtn">
                        ← Vorige
                    </button>
                ` : ''}
            </div>
            <div class="siw-footer-right">
                <button class="siw-btn siw-btn--ghost" id="siwCancelBtn">
                    Annuleren
                </button>
                <button class="siw-btn siw-btn--primary" id="siwNextBtn">
                    ${isLast ? '🚀 Opslaan & Afronden' : 'Volgende →'}
                </button>
            </div>
        `;

        footer.querySelector('#siwPrevBtn')
            ?.addEventListener('click', () => this.prevStep());
        footer.querySelector('#siwCancelBtn')
            ?.addEventListener('click', () => this.close());
        footer.querySelector('#siwNextBtn')
            ?.addEventListener('click', () => this.nextStep());
    }

    // ══════════════════════════════════════════════
    // LOADING & STATUS SCREENS
    // ══════════════════════════════════════════════

    _showStepLoading(stepNum) {
        const content = this.backdrop?.querySelector('.wizard-content');
        if (!content) return;

        const label = this.stepLabels[stepNum - 1]?.label || '';
        content.innerHTML = `
            <div class="siw-loading">
                <div class="siw-loading-spinner"></div>
                <p>${label} wordt geladen...</p>
            </div>
        `;
    }

    _showStepError(stepNum, message) {
        const content = this.backdrop?.querySelector('.wizard-content');
        if (!content) return;

        const label = this.stepLabels[stepNum - 1]?.label || '';
        content.innerHTML = `
            <div class="siw-error-screen">
                <span class="siw-error-icon">⚠️</span>
                <h3>Fout bij ${label}</h3>
                <p>${message}</p>
            </div>
        `;

        const btn = document.createElement('button');
        btn.className = 'siw-btn siw-btn--secondary';
        btn.textContent = 'Opnieuw proberen';
        btn.addEventListener('click', () => this.goToStep(stepNum));
        content.querySelector('.siw-error-screen')?.appendChild(btn);
    }

    _showFinalizeLoading() {
        const content = this.backdrop?.querySelector('.wizard-content');
        const footer = this.backdrop?.querySelector('.siw-modal-footer');

        if (content) {
            content.innerHTML = `
                <div class="siw-loading">
                    <div class="siw-loading-spinner"></div>
                    <h3>Bezig met opslaan...</h3>
                    <p>Planning, checklist en documenten worden aangemaakt</p>
                </div>
            `;
        }
        if (footer) footer.innerHTML = '';
    }

    _showFinalizeSuccess(result) {
        const content = this.backdrop?.querySelector('.wizard-content');
        if (!content) return;

        const naam = result?.tender_naam || this.state.tenderNaam || 'de tender';
        content.innerHTML = `
            <div class="siw-success-screen">
                <span class="siw-success-icon">🎉</span>
                <h3>Import voltooid!</h3>
                <p><strong>${naam}</strong> is aangemaakt met planning, checklist en documenten.</p>
            </div>
        `;
    }

    _showFinalizeError(message) {
        const content = this.backdrop?.querySelector('.wizard-content');
        const footer = this.backdrop?.querySelector('.siw-modal-footer');

        if (content) {
            content.innerHTML = `
                <div class="siw-error-screen">
                    <span class="siw-error-icon">❌</span>
                    <h3>Opslaan mislukt</h3>
                    <p>${message}</p>
                </div>
            `;
        }

        if (footer) {
            footer.innerHTML = `
                <div class="siw-footer-left"></div>
                <div class="siw-footer-right">
                    <button class="siw-btn siw-btn--secondary" id="siwRetryBtn">
                        🔄 Opnieuw proberen
                    </button>
                    <button class="siw-btn siw-btn--ghost" id="siwCloseBtn">
                        Sluiten
                    </button>
                </div>
            `;

            footer.querySelector('#siwRetryBtn')
                ?.addEventListener('click', () => this._finalize());
            footer.querySelector('#siwCloseBtn')
                ?.addEventListener('click', () => this.close(true));
        }
    }

    // ══════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════

    async _ensureAuth() {
        if (this.state.authToken) return;

        const supabase = window.supabaseClient || window.supabase;
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            this.state.authToken = session?.access_token || '';
        }
    }
}

export default SmartImportWizard;