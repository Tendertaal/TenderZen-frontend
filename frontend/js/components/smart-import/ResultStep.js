// ================================================================
// TenderZen — Smart Import v4.0 — ResultStep.js
// Stap 5: Resultaat — Planning, Checklist & AI Documenten
// Datum: 2026-02-08
// Doel-pad: Frontend/js/components/smart-import/ResultStep.js
// ================================================================
//
// Preview van alle gegenereerde output:
// - Back-planning (tijdlijn met taken en toewijzingen)
// - Indieningschecklist
// - AI-gegenereerde documenten (Go/No-Go, samenvatting, etc.)
//
// De gebruiker kan per onderdeel accepteren of overslaan.
// ================================================================

/**
 * Documenttype configuratie
 */
const DOC_TYPE_CONFIG = {
    go_no_go: {
        icon: '🎯',
        label: 'Go/No-Go Analyse',
        description: 'Gestructureerde afweging of we moeten inschrijven',
        standaard: true
    },
    samenvatting: {
        icon: '📝',
        label: 'Samenvatting voor Team',
        description: 'Beknopt overzicht om naar het projectteam te sturen',
        standaard: true
    },
    compliance_matrix: {
        icon: '✅',
        label: 'Compliance Matrix',
        description: 'Volledige eisenlijst met categorie en bewijsstukken',
        standaard: false
    },
    nvi_vragen: {
        icon: '❓',
        label: 'NvI Vragenlijst',
        description: 'Suggesties voor vragen in de Nota van Inlichtingen',
        standaard: false
    },
    rode_draad: {
        icon: '🧵',
        label: 'Rode Draad Document',
        description: 'Strategische outline en kernboodschap',
        standaard: false
    },
    pva_skelet: {
        icon: '📐',
        label: 'Plan van Aanpak Skelet',
        description: 'Basis structuur en headings voor het PvA',
        standaard: false
    }
};


export class ResultStep {
    constructor(wizardState) {
        this.state = wizardState;
        this.backplanning = null;
        this.checklist = null;
        this.workloadWarnings = [];
        this.metadata = null;
        this.documents = [];
        this.acceptedItems = new Set();
        this.expandedSections = new Set(['planning']);
        this.isGenerating = false;
        this.generationProgress = { planning: null, documents: null };
        this.errors = [];
        this._container = null;
    }

    // ══════════════════════════════════════════════
    // LIFECYCLE (wizard interface)
    // ══════════════════════════════════════════════

    async init() {
        this.isGenerating = true;
        this.errors = [];

        // Neem teamAssignments over van vorige stap
        if (this.state.teamAssignments) {
            // Merge eventuele updates
        }

        try {
            // Parallel genereren: back-planning + AI documenten
            const [backplanningResult, documentsResult] = await Promise.allSettled([
                this._generateBackplanning(),
                this._generateDocuments()
            ]);

            // ── Verwerk back-planning ──
            if (backplanningResult.status === 'fulfilled') {
                const data = backplanningResult.value;
                this.backplanning = data.planning_taken || [];
                this.checklist = data.checklist_items || [];
                this.workloadWarnings = data.workload_warnings || [];
                this.metadata = data.metadata || {};
                this.generationProgress.planning = 'done';
            } else {
                this.errors.push({
                    type: 'backplanning',
                    message: 'Back-planning kon niet worden gegenereerd',
                    detail: backplanningResult.reason?.message
                });
                this.backplanning = [];
                this.checklist = [];
                this.metadata = {};
                this.generationProgress.planning = 'error';
            }

            // ── Verwerk AI documenten ──
            if (documentsResult.status === 'fulfilled') {
                this.documents = documentsResult.value?.documents || [];
                this.generationProgress.documents = 'done';
            } else {
                this.errors.push({
                    type: 'documents',
                    message: 'AI documenten konden niet worden gegenereerd',
                    detail: documentsResult.reason?.message
                });
                this.documents = [];
                this.generationProgress.documents = 'error';
            }

            // Standaard: alles geaccepteerd (behalve items met errors)
            this.acceptedItems = new Set([
                ...(this.backplanning.length > 0 ? ['planning'] : []),
                ...(this.checklist.length > 0 ? ['checklist'] : []),
                ...this.documents.map(d => d.type)
            ]);

        } catch (err) {
            console.error('ResultStep: Onverwachte fout:', err);
            this.errors.push({
                type: 'general',
                message: 'Er is een onverwachte fout opgetreden',
                detail: err.message
            });
        }

        this.isGenerating = false;
    }

    render() {
        if (this.isGenerating) {
            return this._renderGenerating();
        }

        const sections = [];

        // Errors bovenaan
        if (this.errors.length > 0) {
            sections.push(this._renderErrors());
        }

        // Metadata samenvatting
        sections.push(this._renderMetadata());

        // Back-planning sectie
        sections.push(this._renderSection(
            'planning',
            '📅 Projectplanning',
            `${this.backplanning?.length || 0} taken`,
            this._renderPlanningPreview()
        ));

        // Checklist sectie
        sections.push(this._renderSection(
            'checklist',
            '📋 Indieningschecklist',
            `${this.checklist?.length || 0} items`,
            this._renderChecklistPreview()
        ));

        // AI Documenten
        for (const doc of this.documents) {
            const config = DOC_TYPE_CONFIG[doc.type] || {};
            sections.push(this._renderSection(
                doc.type,
                `${config.icon || '📄'} ${doc.titel || config.label}`,
                config.description || '',
                this._renderDocumentPreview(doc)
            ));
        }

        // Workload warnings
        if (this.workloadWarnings?.length > 0) {
            sections.push(this._renderWorkloadWarnings());
        }

        const totalItems = this._getTotalItems();

        return `
            <div class="rs">
                <div class="rs-header">
                    <h3 class="rs-title">✅ Alles is klaar</h3>
                    <p class="rs-subtitle">Review de gegenereerde planning, checklist en documenten hieronder</p>
                </div>

                ${sections.join('')}

                <div class="rs-summary-bar">
                    <div class="rs-summary-text">
                        <strong>${this.acceptedItems.size}</strong> van
                        <strong>${totalItems}</strong> onderdelen geselecteerd voor aanmaak
                    </div>
                    <div class="rs-summary-hint">
                        Deselecteer onderdelen die je niet wilt aanmaken
                    </div>
                </div>
            </div>
        `;
    }

    attachListeners(container) {
        this._container = container;

        // ── Toggle checkboxen (accepteren/overslaan) ──
        container.querySelectorAll('.rs-toggle-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const item = e.target.dataset.item;
                if (e.target.checked) {
                    this.acceptedItems.add(item);
                } else {
                    this.acceptedItems.delete(item);
                }

                // Update visuele state van de sectie
                const section = e.target.closest('.rs-section');
                if (section) {
                    section.classList.toggle('rs-section--unchecked', !e.target.checked);
                }

                this._updateSummaryBar(container);
            });
        });

        // ── Expand/collapse secties ──
        container.querySelectorAll('.rs-expand-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sectionKey = btn.dataset.section;
                const body = container.querySelector(`#rs-body-${sectionKey}`);
                if (!body) return;

                const isExpanded = this.expandedSections.has(sectionKey);
                if (isExpanded) {
                    this.expandedSections.delete(sectionKey);
                    body.classList.remove('rs-section-body--open');
                    btn.textContent = '▶';
                    btn.title = 'Openklappen';
                } else {
                    this.expandedSections.add(sectionKey);
                    body.classList.add('rs-section-body--open');
                    btn.textContent = '▼';
                    btn.title = 'Inklappen';
                }
            });
        });
    }

    validate() {
        if (this.acceptedItems.size === 0) {
            return false;
        }
        return true;
    }

    getData() {
        return {
            accepted: [...this.acceptedItems],
            planning: this.acceptedItems.has('planning') ? this.backplanning : null,
            checklist: this.acceptedItems.has('checklist') ? this.checklist : null,
            documents: this.documents.filter(d => this.acceptedItems.has(d.type)),
            metadata: this.metadata,
            workload_warnings: this.workloadWarnings
        };
    }

    // ══════════════════════════════════════════════
    // RENDER: LOADING STATE
    // ══════════════════════════════════════════════

    _renderGenerating() {
        return `
            <div class="rs">
                <div class="rs-generating">
                    <div class="rs-spinner"></div>
                    <h3 class="rs-generating-title">Bezig met genereren...</h3>
                    <p class="rs-generating-sub">Planning en documenten worden aangemaakt</p>
                    <div class="rs-progress-list">
                        <div class="rs-progress-item ${this._progressClass('planning')}">
                            <span class="rs-progress-icon">${this._progressIcon('planning')}</span>
                            <span>Projectplanning berekenen</span>
                        </div>
                        <div class="rs-progress-item ${this._progressClass('documents')}">
                            <span class="rs-progress-icon">${this._progressIcon('documents')}</span>
                            <span>AI documenten genereren</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    _progressClass(key) {
        const status = this.generationProgress[key];
        if (status === 'done') return 'rs-progress-item--done';
        if (status === 'error') return 'rs-progress-item--error';
        if (status === null) return 'rs-progress-item--pending';
        return 'rs-progress-item--active';
    }

    _progressIcon(key) {
        const status = this.generationProgress[key];
        if (status === 'done') return '✅';
        if (status === 'error') return '❌';
        return '⏳';
    }

    // ══════════════════════════════════════════════
    // RENDER: ERRORS
    // ══════════════════════════════════════════════

    _renderErrors() {
        return `
            <div class="rs-errors">
                ${this.errors.map(err => `
                    <div class="rs-error">
                        <span class="rs-error-icon">⚠️</span>
                        <div class="rs-error-text">
                            <strong>${err.message}</strong>
                            ${err.detail ? `<span class="rs-error-detail">${err.detail}</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // RENDER: METADATA
    // ══════════════════════════════════════════════

    _renderMetadata() {
        if (!this.metadata || !this.metadata.eerste_taak) return '';

        return `
            <div class="rs-metadata">
                <div class="rs-meta-grid">
                    <div class="rs-meta-item">
                        <span class="rs-meta-label">Eerste taak</span>
                        <span class="rs-meta-value">${this._formatDatum(this.metadata.eerste_taak)}</span>
                    </div>
                    <div class="rs-meta-item">
                        <span class="rs-meta-label">Deadline</span>
                        <span class="rs-meta-value rs-meta-value--accent">${this._formatDatum(this.metadata.deadline || this.metadata.laatste_taak)}</span>
                    </div>
                    <div class="rs-meta-item">
                        <span class="rs-meta-label">Doorlooptijd</span>
                        <span class="rs-meta-value">
                            ${this.metadata.doorlooptijd_werkdagen || 0} werkdagen
                            <span class="rs-meta-sub">(${this.metadata.doorlooptijd_kalenderdagen || 0} kalender)</span>
                        </span>
                    </div>
                    ${this.metadata.feestdagen_overgeslagen?.length > 0 ? `
                        <div class="rs-meta-item">
                            <span class="rs-meta-label">Feestdagen</span>
                            <span class="rs-meta-value">
                                ${this.metadata.feestdagen_overgeslagen.length} overgeslagen
                            </span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // RENDER: SECTIONS (generiek)
    // ══════════════════════════════════════════════

    _renderSection(key, title, subtitle, bodyContent) {
        const isExpanded = this.expandedSections.has(key);
        const isAccepted = this.acceptedItems.has(key);

        return `
            <div class="rs-section ${isAccepted ? '' : 'rs-section--unchecked'}">
                <div class="rs-section-header">
                    <label class="rs-toggle">
                        <input type="checkbox" class="rs-toggle-cb" data-item="${key}"
                            ${isAccepted ? 'checked' : ''}>
                        <span class="rs-section-title">${title}</span>
                        <span class="rs-section-count">${subtitle}</span>
                    </label>
                    <button class="rs-expand-btn" data-section="${key}"
                        title="${isExpanded ? 'Inklappen' : 'Openklappen'}">
                        ${isExpanded ? '▼' : '▶'}
                    </button>
                </div>
                <div class="rs-section-body ${isExpanded ? 'rs-section-body--open' : ''}"
                     id="rs-body-${key}">
                    ${bodyContent}
                </div>
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // RENDER: PLANNING PREVIEW
    // ══════════════════════════════════════════════

    _renderPlanningPreview() {
        if (!this.backplanning?.length) {
            return '<p class="rs-no-data">Geen taken gegenereerd</p>';
        }

        return `
            <div class="rs-planning-list">
                ${this.backplanning.map(taak => this._renderPlanningRow(taak)).join('')}
            </div>
        `;
    }

    _renderPlanningRow(taak) {
        const hasDuration = taak.duur_werkdagen > 1;
        const hasConflict = !!taak.conflict;

        return `
            <div class="rs-plan-row ${taak.is_mijlpaal ? 'rs-plan-row--milestone' : ''}
                ${hasConflict ? 'rs-plan-row--conflict' : ''}">
                <div class="rs-plan-datum">
                    <span class="rs-plan-date">${this._formatDatum(taak.datum)}</span>
                    ${hasDuration ? `
                        <span class="rs-plan-duur">→ ${this._formatDatum(taak.eind_datum)}</span>
                    ` : ''}
                </div>
                <div class="rs-plan-content">
                    <span class="rs-plan-naam">
                        ${taak.is_mijlpaal ? '<span class="rs-plan-flag">⚑</span>' : ''}
                        ${taak.naam}
                    </span>
                    ${taak.beschrijving ? `
                        <span class="rs-plan-desc">${taak.beschrijving}</span>
                    ` : ''}
                </div>
                <div class="rs-plan-persoon">
                    ${taak.toegewezen_aan ? `
                        <span class="rs-avatar"
                            style="background-color: ${taak.toegewezen_aan.avatar_kleur}">
                            ${taak.toegewezen_aan.initialen}
                        </span>
                        <span class="rs-persoon-naam">${taak.toegewezen_aan.naam}</span>
                    ` : '<span class="rs-niet-toegewezen">—</span>'}
                </div>
                ${hasConflict ? `
                    <span class="rs-conflict-badge rs-conflict-badge--${taak.conflict.severity}"
                        title="${taak.conflict.bericht}">
                        ⚠️
                    </span>
                ` : ''}
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // RENDER: CHECKLIST PREVIEW
    // ══════════════════════════════════════════════

    _renderChecklistPreview() {
        if (!this.checklist?.length) {
            return '<p class="rs-no-data">Geen checklist items</p>';
        }

        return `
            <div class="rs-checklist-list">
                ${this.checklist.map(item => `
                    <div class="rs-check-row ${item.is_verplicht ? 'rs-check-row--required' : ''}">
                        <span class="rs-check-box">${item.is_verplicht ? '☐' : '☐'}</span>
                        <span class="rs-check-naam">${item.naam}</span>
                        <span class="rs-check-deadline">${this._formatDatum(item.datum)}</span>
                        <div class="rs-check-assign">
                            ${item.toegewezen_aan ? `
                                <span class="rs-avatar rs-avatar--sm"
                                    style="background-color: ${item.toegewezen_aan.avatar_kleur}">
                                    ${item.toegewezen_aan.initialen}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // RENDER: DOCUMENT PREVIEW
    // ══════════════════════════════════════════════

    _renderDocumentPreview(doc) {
        // Probeer een leesbare preview te tonen uit de JSONB inhoud
        const preview = this._extractDocPreview(doc);

        return `
            <div class="rs-doc-preview">
                <div class="rs-doc-content">
                    ${preview}
                </div>
                <div class="rs-doc-meta">
                    <span class="rs-doc-model">
                        🤖 ${doc.ai_model === 'haiku' ? 'Claude Haiku' : 'Claude Sonnet'}
                    </span>
                    <span class="rs-doc-status rs-doc-status--${doc.status || 'concept'}">
                        ${doc.status === 'geaccepteerd' ? '✅ Geaccepteerd' : '📝 Concept'}
                    </span>
                </div>
            </div>
        `;
    }

    _extractDocPreview(doc) {
        // Preview uit inhoud_tekst (plain text) of inhoud (JSONB)
        if (doc.inhoud_tekst) {
            const truncated = doc.inhoud_tekst.substring(0, 500);
            return `<p class="rs-doc-text">${truncated}${doc.inhoud_tekst.length > 500 ? '…' : ''}</p>`;
        }

        if (doc.inhoud && typeof doc.inhoud === 'object') {
            // Probeer secties te renderen
            if (doc.inhoud.sections) {
                return doc.inhoud.sections.slice(0, 3).map(s => `
                    <div class="rs-doc-section">
                        <strong>${s.titel || s.title || ''}</strong>
                        <p>${(s.inhoud || s.content || '').substring(0, 150)}…</p>
                    </div>
                `).join('');
            }

            // Probeer conclusie of samenvatting
            if (doc.inhoud.conclusie || doc.inhoud.samenvatting) {
                return `<p class="rs-doc-text">${doc.inhoud.conclusie || doc.inhoud.samenvatting}</p>`;
            }
        }

        return '<p class="rs-doc-text rs-doc-text--empty"><em>Preview wordt geladen na generatie…</em></p>';
    }

    // ══════════════════════════════════════════════
    // RENDER: WORKLOAD WARNINGS
    // ══════════════════════════════════════════════

    _renderWorkloadWarnings() {
        return `
            <div class="rs-workload-warnings">
                <div class="rs-workload-title">⚠️ Workload aandachtspunten</div>
                ${this.workloadWarnings.map(w => `
                    <div class="rs-workload-item rs-workload-item--${w.severity}">
                        <strong>${w.persoon}</strong>: ${w.bericht}
                    </div>
                `).join('')}
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // INLINE UI UPDATES
    // ══════════════════════════════════════════════

    _updateSummaryBar(container) {
        const textEl = container.querySelector('.rs-summary-text');
        if (!textEl) return;

        const total = this._getTotalItems();
        textEl.innerHTML = `
            <strong>${this.acceptedItems.size}</strong> van
            <strong>${total}</strong> onderdelen geselecteerd voor aanmaak
        `;
    }

    _getTotalItems() {
        let count = 0;
        if (this.backplanning?.length > 0) count++;
        if (this.checklist?.length > 0) count++;
        count += this.documents.length;
        return count;
    }

    // ══════════════════════════════════════════════
    // UTILITY
    // ══════════════════════════════════════════════

    _formatDatum(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
            const dagen = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
            const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
                             'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
            return `${dagen[d.getDay()]} ${d.getDate()} ${maanden[d.getMonth()]}`;
        } catch {
            return dateStr;
        }
    }

    // ══════════════════════════════════════════════
    // API CALLS
    // ══════════════════════════════════════════════

    async _generateBackplanning() {
        const deadline = this.state.extractedData?.planning?.deadline_indiening?.value;
        const templateId = this.state.selectedTemplate?.id;

        // Guard: skip als geen deadline of template
        if (!deadline || !templateId) {
            console.log('⏩ Backplanning overgeslagen (geen deadline of template)');
            this.generationProgress.planning = 'skipped';
            return null;
        }

        try {
            const response = await fetch(
                `${this.state.baseURL}/planning/generate-backplanning`,
                {
                    method: 'POST',
                    headers: this._headers(),
                    body: JSON.stringify({
                        deadline: deadline.split('T')[0],
                        template_id: templateId,
                        team_assignments: this.state.teamAssignments || {}
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.warn(`⚠️ Backplanning fout: ${response.status} - ${errorText}`);
                this.generationProgress.planning = 'error';
                return null;
            }

            this.generationProgress.planning = 'done';
            return await response.json();
        } catch (err) {
            console.warn('⚠️ Backplanning error:', err);
            this.generationProgress.planning = 'error';
            return null;
        }
    }

    async _generateDocuments() {
        // Standaard documenten: go_no_go + samenvatting
        const selectedDocs = Object.entries(DOC_TYPE_CONFIG)
            .filter(([_, config]) => config.standaard)
            .map(([type]) => type);

        if (selectedDocs.length === 0 || !this.state.importId) {
            this.generationProgress.documents = 'skipped';
            return { documents: [] };
        }

        try {
            const response = await fetch(
                `${this.state.baseURL}/smart-import/${this.state.importId}/generate-documents`,
                {
                    method: 'POST',
                    headers: this._headers(),
                    body: JSON.stringify({
                        tender_id: this.state.tenderId,
                        documents: selectedDocs,
                        model: 'sonnet'
                    })
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.warn(`⚠️ Document generatie fout: ${response.status} - ${errorText}`);
                this.generationProgress.documents = 'error';
                return { documents: [] };
            }

            this.generationProgress.documents = 'done';
            return await response.json();
        } catch (err) {
            console.warn('⚠️ Document generatie error:', err);
            this.generationProgress.documents = 'error';
            return { documents: [] };
        }
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this.state.authToken}`,
            'Content-Type': 'application/json'
        };
    }
}