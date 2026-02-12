// ================================================================
// TenderZen — Smart Import v4.0 — Stap 2: Analyse
// Frontend/js/components/smart-import/AnalyzeStep.js
// Datum: 2026-02-09
// ================================================================
//
// Upload bestanden naar API, start AI analyse, poll voor status.
// Auto-advance naar stap 3 wanneer analyse klaar is.
//
// State die gelezen wordt:
//   - state.uploadedFiles      (bestanden uit stap 1)
//   - state.tenderId           (optioneel, voor tender linking)
//   - state.tenderbureauId     (bureau ID)
//   - state.overrideBureauId   (optioneel, super-admin override)
//   - state.authToken
//   - state.baseURL
//   - state._navigateTo        (callback naar orchestrator)
//
// State die geschreven wordt:
//   - state.importId           (UUID van smart import sessie)
//   - state.extractedData      (AI-geëxtraheerde data)
//   - state.currentModel       (haiku of sonnet)
//
// Speciale flows:
//   - Normale analyse: init() upload + start + poll → auto-advance
//   - Reanalyze Pro:   state._reanalyzeMode = true → skip upload
//   - Extra document:  state._additionalFiles + state._mergeMode = true
// ================================================================

export class AnalyzeStep {

    constructor(wizardState) {
        this.state = wizardState;

        this.pollingInterval = null;
        this.progress = 0;
        this.steps = [];
        this.container = null;
        this.aborted = false;
    }

    // ── Interface ──

    async init() {
        this.progress = 0;
        this.steps = [];
        this.aborted = false;

        // Ensure auth token
        await this._ensureAuth();

        // Determine which flow to run
        if (this.state._reanalyzeMode) {
            // v3.5: Re-analyze with Pro model (importId already exists)
            await this._startReanalysis();
        } else if (this.state._mergeMode && this.state._additionalFiles?.length > 0) {
            // v3.3: Additional document analysis
            await this._startAdditionalAnalysis();
        } else {
            // Normal flow: upload + analyze
            await this._startNormalAnalysis();
        }
    }

    render() {
        const isAdding = this.state._mergeMode;
        const isReanalyzing = this.state._reanalyzeMode;

        let title = 'Documenten worden geanalyseerd...';
        if (isAdding) title = 'Extra document wordt geanalyseerd...';
        if (isReanalyzing) title = 'Opnieuw analyseren met Pro model...';

        const stepsHtml = (this.steps.length > 0 ? this.steps : [
            { name: 'upload', label: 'Documenten uploaden', status: 'pending' },
            { name: 'text_extraction', label: 'Tekst extraheren', status: 'pending' },
            { name: 'ai_extraction', label: 'AI analyse', status: 'pending' },
            { name: 'finalizing', label: 'Afronden', status: 'pending' }
        ]).map(s => `
            <div class="si-analysis-step si-analysis-step--${s.status}">
                <span class="si-step-icon">
                    ${s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '◐' : '○'}
                </span>
                <span>${s.label}</span>
            </div>
        `).join('');

        return `
            <div class="si-analyze">
                <div class="si-analyze-spinner">
                    <div class="si-spinner"></div>
                </div>

                <h3>${title}</h3>
                <p>Dit duurt ongeveer 15-30 seconden</p>

                <div class="si-progress-bar">
                    <div class="si-progress-fill" id="siProgressFill"
                         style="width: ${this.progress}%"></div>
                </div>
                <div class="si-progress-text" id="siProgressText">${this.progress}%</div>

                <div class="si-analysis-steps" id="siAnalysisSteps">
                    ${stepsHtml}
                </div>
            </div>
        `;
    }

    attachListeners(container) {
        this.container = container;
    }

    validate() {
        // Analyse stap wordt automatisch overgeslagen (auto-advance)
        return true;
    }

    getData() {
        return {
            importId: this.state.importId,
            extractedData: this.state.extractedData,
            currentModel: this.state.currentModel || 'haiku'
        };
    }

    // ══════════════════════════════════════════════
    // NORMALE ANALYSE FLOW
    // ══════════════════════════════════════════════

    async _startNormalAnalysis() {
        try {
            const tenderbureauId = this._getBureauId();
            if (!tenderbureauId) {
                throw new Error('Selecteer eerst een specifiek bureau om Smart Import te gebruiken.');
            }

            // 1. Upload bestanden
            const formData = new FormData();
            for (const f of this.state.uploadedFiles) {
                formData.append('files', f.file);
            }

            const uploadUrl = `${this.state.baseURL}/smart-import/upload?tenderbureau_id=${encodeURIComponent(tenderbureauId)}`;
            const uploadResp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.state.authToken}` },
                body: formData
            });

            if (!uploadResp.ok) {
                const err = await uploadResp.json().catch(() => ({}));
                throw new Error(err.detail || 'Upload mislukt');
            }

            const uploadResult = await uploadResp.json();
            this.state.importId = uploadResult.import_id;

            console.log('📤 Upload successful, import_id:', this.state.importId);

            // 2. Start analyse
            const analyzeResp = await fetch(
                `${this.state.baseURL}/smart-import/${this.state.importId}/analyze`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        extract_gunningscriteria: true,
                        extract_certificeringen: true,
                        language: 'nl'
                    })
                }
            );

            if (!analyzeResp.ok) {
                const err = await analyzeResp.json().catch(() => ({}));
                throw new Error(err.detail || 'Analyse starten mislukt');
            }

            console.log('🤖 Analysis started, polling...');

            // 3. Start polling
            this._startPolling(this.state.importId);

        } catch (error) {
            console.error('❌ Analysis error:', error);
            this._showError(error.message);
        }
    }

    // ══════════════════════════════════════════════
    // v3.5: REANALYZE MET PRO MODEL
    // ══════════════════════════════════════════════

    async _startReanalysis() {
        try {
            console.log('🔄 Re-analyzing with Sonnet Pro model...');

            const resp = await fetch(
                `${this.state.baseURL}/smart-import/${this.state.importId}/reanalyze`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ model: 'sonnet' })
                }
            );

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || 'Her-analyse starten mislukt');
            }

            this.state.currentModel = 'sonnet';
            this._startPolling(this.state.importId);

        } catch (error) {
            console.error('❌ Reanalysis error:', error);
            this._showError(error.message);
        } finally {
            this.state._reanalyzeMode = false;
        }
    }

    // ══════════════════════════════════════════════
    // v3.3: EXTRA DOCUMENT ANALYSE
    // ══════════════════════════════════════════════

    async _startAdditionalAnalysis() {
        try {
            const tenderbureauId = this._getBureauId();
            const additionalFiles = this.state._additionalFiles || [];

            console.log('📤 Uploading additional document...');

            // Upload extra bestanden (maakt nieuw import_id)
            const formData = new FormData();
            for (const f of additionalFiles) {
                formData.append('files', f.file);
            }

            const uploadUrl = `${this.state.baseURL}/smart-import/upload?tenderbureau_id=${encodeURIComponent(tenderbureauId)}`;
            const uploadResp = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.state.authToken}` },
                body: formData
            });

            if (!uploadResp.ok) {
                const err = await uploadResp.json().catch(() => ({}));
                throw new Error(err.detail || 'Upload mislukt');
            }

            const uploadResult = await uploadResp.json();
            const additionalImportId = uploadResult.import_id;

            // Start analyse
            const analyzeResp = await fetch(
                `${this.state.baseURL}/smart-import/${additionalImportId}/analyze`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        extract_gunningscriteria: true,
                        extract_certificeringen: true,
                        language: 'nl'
                    })
                }
            );

            if (!analyzeResp.ok) {
                const err = await analyzeResp.json().catch(() => ({}));
                throw new Error(err.detail || 'Analyse starten mislukt');
            }

            console.log('🤖 Additional analysis started...');

            // Poll met merge-logica bij voltooiing
            this._startPolling(additionalImportId, true);

        } catch (error) {
            console.error('❌ Additional analysis error:', error);
            this._showError(error.message);
        } finally {
            this.state._mergeMode = false;
            this.state._additionalFiles = [];
        }
    }

    // ══════════════════════════════════════════════
    // POLLING
    // ══════════════════════════════════════════════

    _startPolling(importId, mergeOnComplete = false) {
        this._stopPolling();
        this._analysisCompleted = false;

        this.pollingInterval = setInterval(async () => {
            // Guard: voorkom dat meerdere overlappende callbacks verwerken
            if (this.aborted || this._analysisCompleted) {
                this._stopPolling();
                return;
            }

            try {
                const resp = await fetch(
                    `${this.state.baseURL}/smart-import/${importId}/status`,
                    {
                        headers: { 'Authorization': `Bearer ${this.state.authToken}` }
                    }
                );

                if (!resp.ok) throw new Error('Status ophalen mislukt');

                const status = await resp.json();

                this.progress = status.progress || 0;
                this.steps = status.steps || [];
                this._updateProgressUI();

                if (status.status === 'completed' && !this._analysisCompleted) {
                    this._analysisCompleted = true;  // Voorkom dubbele verwerking
                    this._stopPolling();

                    console.log('✅ Analysis completed!');

                    if (mergeOnComplete && this.state.extractedData) {
                        // Merge met bestaande data
                        this._mergeExtractedData(status.extracted_data);
                        // Voeg extra bestanden toe aan uploadedFiles
                        const extra = this.state._additionalFiles || [];
                        this.state.uploadedFiles.push(...extra.map(f => ({
                            ...f, isAdditional: true
                        })));
                    } else {
                        this.state.extractedData = status.extracted_data;
                    }

                    // Track model
                    if (status.ai_model_used) {
                        this.state.currentModel = status.ai_model_used.includes('sonnet')
                            ? 'sonnet' : 'haiku';
                    }

                    // Link tender indien nodig
                    if (this.state.tenderId && this.state.importId) {
                        await this._linkToTender(this.state.importId);
                    }

                    // Auto-advance naar stap 3
                    if (this.state._navigateTo) {
                        this.state._navigateTo(3);
                    }

                } else if (status.status === 'failed') {
                    this._stopPolling();
                    this._showError(status.error_message || 'Analyse mislukt');
                }

            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 1000);
    }

    _stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    cleanup() {
        this._stopPolling();
        this._analysisCompleted = false;
        this.aborted = true;
    }

    _updateProgressUI() {
        if (!this.container) return;

        const fill = this.container.querySelector('#siProgressFill');
        const text = this.container.querySelector('#siProgressText');
        const stepsEl = this.container.querySelector('#siAnalysisSteps');

        if (fill) fill.style.width = `${this.progress}%`;
        if (text) text.textContent = `${this.progress}%`;

        if (stepsEl && this.steps.length > 0) {
            stepsEl.innerHTML = this.steps.map(s => `
                <div class="si-analysis-step si-analysis-step--${s.status}">
                    <span class="si-step-icon">
                        ${s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '◐' : '○'}
                    </span>
                    <span>${s.label}</span>
                </div>
            `).join('');
        }
    }

    _showError(message) {
        if (!this.container) return;

        // Herken overload/AI-provider errors
        const isOverload =
            typeof message === 'string' &&
            (message.toLowerCase().includes('overload') ||
                message.includes('529') ||
                message.toLowerCase().includes('overloaded_error'));

        let userMessage = message;
        if (isOverload) {
            userMessage = `De AI-analyse is tijdelijk niet beschikbaar omdat de externe AI-dienst overbelast is.<br>
            Dit ligt buiten onze applicatie. Probeer het later opnieuw.<br>
            <span style='color:#991b1b;'>Excuses voor het ongemak!</span>`;
        }

        this.container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <span style="font-size: 48px;">⚠️</span>
                <h3 style="margin: 16px 0 8px; color: #991b1b;">Analyse mislukt</h3>
                <p style="color: #64748b; margin: 0 0 20px;">${userMessage}</p>
                <button class="siw-btn siw-btn--secondary" id="siRetryBtn">
                    Terug naar Upload
                </button>
            </div>
        `;

        this.container.querySelector('#siRetryBtn')?.addEventListener('click', () => {
            if (this.state._navigateTo) this.state._navigateTo(1);
        });
    }

    // ══════════════════════════════════════════════
    // v3.6: TENDER LINKING
    // ══════════════════════════════════════════════

    async _linkToTender(importId) {
        if (!this.state.tenderId) return;

        try {
            const supabase = window.supabaseClient || window.supabase;
            if (!supabase) return;

            const { error } = await supabase
                .from('tenders')
                .update({
                    smart_import_id: importId,
                    ai_model_used: this.state.currentModel
                })
                .eq('id', this.state.tenderId);

            if (error) {
                console.error('❌ Error linking tender:', error);
            } else {
                console.log('✅ Tender linked to smart_import');
            }
        } catch (err) {
            console.error('❌ linkToTender error:', err);
        }
    }

    // ══════════════════════════════════════════════
    // v3.3: MERGE LOGICA
    // ══════════════════════════════════════════════

    _mergeExtractedData(newData) {
        if (!newData || !this.state.extractedData) return;

        console.log('🔀 Merging extracted data...');
        const existing = this.state.extractedData;

        // Merge categorieën
        for (const cat of ['basisgegevens', 'planning']) {
            if (!newData[cat]) continue;
            if (!existing[cat]) { existing[cat] = {}; }

            for (const [key, newVal] of Object.entries(newData[cat])) {
                const oldVal = existing[cat][key];
                const oldEmpty = !oldVal || oldVal.value === null || oldVal.value === '';
                const newHas = newVal && newVal.value !== null && newVal.value !== '';
                const newBetter = newVal && oldVal &&
                    (newVal.confidence || 0) > (oldVal.confidence || 0);

                if ((oldEmpty && newHas) || (newBetter && newHas)) {
                    existing[cat][key] = newVal;
                }
            }
        }

        // Merge gunningscriteria
        if (newData.gunningscriteria?.criteria?.length > 0) {
            if (!existing.gunningscriteria) existing.gunningscriteria = { criteria: [] };
            const codes = new Set(existing.gunningscriteria.criteria.map(c => c.code || c.naam));
            for (const c of newData.gunningscriteria.criteria) {
                if (!codes.has(c.code || c.naam)) {
                    existing.gunningscriteria.criteria.push(c);
                }
            }
        }

        // Merge warnings
        if (newData.warnings?.length > 0) {
            if (!existing.warnings) existing.warnings = [];
            for (const w of newData.warnings) {
                if (!existing.warnings.includes(w)) existing.warnings.push(w);
            }
        }

        console.log('✅ Merge complete');
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

    _getBureauId() {
        const id = this.state.overrideBureauId
            || this.state.tenderbureauId
            || window.currentUser?.tenderbureau_id
            || window.activeBureauId
            || localStorage.getItem('tenderbureau_id')
            || localStorage.getItem('active_bureau_id')
            || window.bureauAccessService?.getActiveBureauId?.()
            || document.querySelector('[data-bureau-id]')?.dataset?.bureauId;

        // Valideer UUID
        const isUUID = id &&
            id !== 'ALL_BUREAUS' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        return isUUID ? id : null;
    }

    /**
     * Cleanup bij wizard sluiting.
     * Wordt aangeroepen door orchestrator (optioneel).
     */
    destroy() {
        this.aborted = true;
        this._stopPolling();
    }
}