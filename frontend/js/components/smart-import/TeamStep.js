// ================================================================
// TenderZen — Smart Import v4.0 — TeamStep.js
// Stap 4: Team samenstellen
// Datum: 2026-02-08
// Doel-pad: Frontend/js/components/smart-import/TeamStep.js
// ================================================================

/**
 * Rolconfiguratie voor tender-teams.
 * Volgorde bepaalt weergave in de UI.
 */
const TENDER_ROLLEN = [
    { key: 'tendermanager',  label: 'Tendermanager',   icon: '👔', required: true  },
    { key: 'schrijver',      label: 'Tekstschrijver',  icon: '✏️',  required: true  },
    { key: 'calculator',     label: 'Calculator',      icon: '🔢', required: false },
    { key: 'reviewer',       label: 'Reviewer',        icon: '👁️',  required: false },
    { key: 'designer',       label: 'Vormgever',       icon: '🎨', required: false },
    { key: 'sales',          label: 'Sales / Klant',   icon: '🤝', required: false },
    { key: 'coordinator',    label: 'Coördinator',     icon: '📋', required: false },
    { key: 'klant_contact',  label: 'Klant Contact',   icon: '📞', required: false }
];

/**
 * Workload drempelwaarden per week
 */
const WORKLOAD_LEVELS = {
    low:    { min: 0, max: 2,  icon: '🟢', label: 'Beschikbaar', cssClass: 'ts-workload--low'    },
    medium: { min: 3, max: 4,  icon: '🟡', label: 'Druk',        cssClass: 'ts-workload--medium' },
    high:   { min: 5, max: 99, icon: '🔴', label: 'Overbelast',  cssClass: 'ts-workload--high'   }
};


export class TeamStep {
    constructor(wizardState) {
        this.state = wizardState;
        this.teamMembers = [];
        this.assignments = {};         // rol → user_id
        this.requiredRoles = [];       // Gefilterde TENDER_ROLLEN op basis van template
        this.workloadData = null;      // user_id → { naam, weken }
        this.templates = [];           // Beschikbare planning templates
        this.validationErrors = [];
        this._container = null;
    }

    // ══════════════════════════════════════════════
    // LIFECYCLE (wizard interface)
    // ══════════════════════════════════════════════

    async init() {
        // 1. Haal teamleden op van dit bureau
        this.teamMembers = await this._fetchTeamMembers();

        // 2. Haal beschikbare planning templates op
        this.templates = await this._fetchTemplates();

        // 3. Selecteer standaard template als er nog geen is
        if (!this.state.selectedTemplate) {
            this.state.selectedTemplate =
                this.templates.find(t => t.is_standaard) ||
                this.templates[0] ||
                null;
        }

        // 4. Bepaal benodigde rollen op basis van template-taken
        this.requiredRoles = this._determineRequiredRoles();

        // 5. Herstel eerdere toewijzingen (als gebruiker teruggaat)
        if (this.state.teamAssignments && Object.keys(this.state.teamAssignments).length > 0) {
            this.assignments = { ...this.state.teamAssignments };
        } else {
            this._autoAssign();
        }

        // 6. Haal workload data op
        await this._loadWorkload();
    }

    render() {
        const assignedCount = this._getAssignedRequiredCount();
        const requiredCount = this._getRequiredCount();
        const allFilled = assignedCount >= requiredCount;

        return `
            <div class="ts">
                <div class="ts-header">
                    <h3 class="ts-title">👥 Team samenstellen</h3>
                    <p class="ts-subtitle">Wijs teamleden toe aan de rollen voor deze tender</p>
                </div>

                ${this._renderTemplateBar()}

                <div class="ts-roles-grid">
                    ${this.requiredRoles.map(role => this._renderRoleRow(role)).join('')}
                </div>

                ${this._renderWarnings()}

                <div class="ts-footer-bar">
                    <div class="ts-status ${allFilled ? 'ts-status--ok' : 'ts-status--incomplete'}">
                        <span class="ts-status-icon">${allFilled ? '✅' : '⚠️'}</span>
                        <span>${assignedCount} van ${requiredCount} verplichte rollen ingevuld</span>
                    </div>
                    ${this.teamMembers.length > 0 ? `
                        <button class="ts-btn-auto" id="tsAutoAssign" title="Automatisch toewijzen op basis van standaard rollen">
                            ⚡ Auto-assign
                        </button>
                    ` : ''}
                </div>

                ${this._renderValidationErrors()}
            </div>
        `;
    }

    attachListeners(container) {
        this._container = container;

        // ── Rol selectie dropdowns ──
        container.querySelectorAll('.ts-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const role = e.target.dataset.role;
                const userId = e.target.value;

                if (userId === '' || userId === '__skip') {
                    delete this.assignments[role];
                } else {
                    this.assignments[role] = userId;
                }

                // Update workload indicator inline (geen full re-render)
                this._updateRoleRowState(container, role);
                this._updateFooterStatus(container);
                this.validationErrors = [];
                this._hideValidationErrors(container);
            });
        });

        // ── Template selector ──
        const templateSelect = container.querySelector('#tsTemplateSelect');
        if (templateSelect) {
            templateSelect.addEventListener('change', (e) => {
                const templateId = e.target.value;
                this.state.selectedTemplate =
                    this.templates.find(t => t.id === templateId) || null;
                this.requiredRoles = this._determineRequiredRoles();

                // Re-render alleen de rollen grid
                const grid = container.querySelector('.ts-roles-grid');
                if (grid) {
                    grid.innerHTML = this.requiredRoles
                        .map(role => this._renderRoleRow(role))
                        .join('');
                    // Re-attach select listeners
                    this.attachListeners(container);
                }
            });
        }

        // ── Auto-assign knop ──
        const autoBtn = container.querySelector('#tsAutoAssign');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => {
                this._autoAssign();
                // Update alle dropdowns
                container.querySelectorAll('.ts-select').forEach(select => {
                    const role = select.dataset.role;
                    select.value = this.assignments[role] || '';
                    this._updateRoleRowState(container, role);
                });
                this._updateFooterStatus(container);
            });
        }
    }

    validate() {
        this.validationErrors = [];

        const missingRoles = this.requiredRoles.filter(
            r => r.required && !this.assignments[r.key]
        );

        if (missingRoles.length > 0) {
            this.validationErrors = missingRoles.map(r => ({
                role: r.key,
                message: `${r.label} is verplicht`
            }));

            // Highlight ontbrekende rollen
            if (this._container) {
                missingRoles.forEach(r => {
                    const row = this._container.querySelector(
                        `.ts-role-row[data-role="${r.key}"]`
                    );
                    if (row) row.classList.add('ts-role-row--error');
                });
                this._showValidationErrors(this._container);
            }
            return false;
        }
        return true;
    }

    getData() {
        return {
            teamAssignments: { ...this.assignments },
            selectedTemplate: this.state.selectedTemplate
        };
    }

    // ══════════════════════════════════════════════
    // RENDER HELPERS
    // ══════════════════════════════════════════════

    _renderTemplateBar() {
        if (this.templates.length === 0) {
            return `
                <div class="ts-template-bar ts-template-bar--empty">
                    <span>⚠️ Geen planning templates gevonden voor dit bureau</span>
                </div>
            `;
        }

        return `
            <div class="ts-template-bar">
                <label class="ts-template-label" for="tsTemplateSelect">
                    📋 Planning template
                </label>
                <select id="tsTemplateSelect" class="ts-template-select">
                    ${this.templates.map(t => `
                        <option value="${t.id}"
                            ${t.id === this.state.selectedTemplate?.id ? 'selected' : ''}>
                            ${t.naam}${t.is_standaard ? ' ★' : ''}
                            (${t.taken?.length || 0} taken)
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    _renderRoleRow(role) {
        const assignedUserId = this.assignments[role.key];
        const workload = this._getWorkloadLevel(assignedUserId);
        const hasError = this.validationErrors.some(e => e.role === role.key);

        return `
            <div class="ts-role-row ${role.required ? 'ts-role-row--required' : 'ts-role-row--optional'}
                ${hasError ? 'ts-role-row--error' : ''}"
                data-role="${role.key}">

                <div class="ts-role-info">
                    <span class="ts-role-icon">${role.icon}</span>
                    <div class="ts-role-text">
                        <span class="ts-role-name">${role.label}</span>
                        <span class="ts-role-meta">
                            ${role.required
                                ? `<span class="ts-badge ts-badge--required">Verplicht</span>`
                                : `<span class="ts-badge ts-badge--optional">Optioneel</span>`
                            }
                            <span class="ts-role-taken">${role.takenCount || 0} taken</span>
                        </span>
                    </div>
                </div>

                <div class="ts-role-assign">
                    <select class="ts-select" data-role="${role.key}">
                        <option value="">— Selecteer —</option>
                        ${!role.required ? '<option value="__skip">Niet nodig</option>' : ''}
                        ${this.teamMembers.map(m => `
                            <option value="${m.user_id}"
                                ${m.user_id === assignedUserId ? 'selected' : ''}>
                                ${m.naam} (${m.initialen})
                            </option>
                        `).join('')}
                    </select>

                    <div class="ts-workload-slot" data-role-workload="${role.key}">
                        ${assignedUserId && workload ? `
                            <span class="ts-workload ${workload.cssClass}"
                                title="${workload.details || ''}">
                                ${workload.icon} ${workload.label}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    _renderWarnings() {
        const warnings = this._getWorkloadWarnings();
        if (warnings.length === 0) return '';

        return `
            <div class="ts-warnings">
                <div class="ts-warnings-title">⚠️ Aandachtspunten</div>
                ${warnings.map(w => `
                    <div class="ts-warning ts-warning--${w.severity}">
                        <strong>${w.persoon}</strong>: ${w.bericht}
                    </div>
                `).join('')}
            </div>
        `;
    }

    _renderValidationErrors() {
        if (this.validationErrors.length === 0) return '';

        return `
            <div class="ts-validation-errors" id="tsValidationErrors">
                ${this.validationErrors.map(e => `
                    <div class="ts-validation-error">❌ ${e.message}</div>
                `).join('')}
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // INLINE UI UPDATES (geen full re-render)
    // ══════════════════════════════════════════════

    _updateRoleRowState(container, roleKey) {
        const row = container.querySelector(`.ts-role-row[data-role="${roleKey}"]`);
        if (!row) return;

        // Remove error state
        row.classList.remove('ts-role-row--error');

        // Update workload indicator
        const workloadSlot = row.querySelector(`[data-role-workload="${roleKey}"]`);
        if (workloadSlot) {
            const userId = this.assignments[roleKey];
            const workload = this._getWorkloadLevel(userId);

            if (userId && workload) {
                workloadSlot.innerHTML = `
                    <span class="ts-workload ${workload.cssClass}"
                        title="${workload.details || ''}">
                        ${workload.icon} ${workload.label}
                    </span>
                `;
            } else {
                workloadSlot.innerHTML = '';
            }
        }
    }

    _updateFooterStatus(container) {
        const status = container.querySelector('.ts-status');
        if (!status) return;

        const assigned = this._getAssignedRequiredCount();
        const required = this._getRequiredCount();
        const allFilled = assigned >= required;

        status.className = `ts-status ${allFilled ? 'ts-status--ok' : 'ts-status--incomplete'}`;
        status.innerHTML = `
            <span class="ts-status-icon">${allFilled ? '✅' : '⚠️'}</span>
            <span>${assigned} van ${required} verplichte rollen ingevuld</span>
        `;
    }

    _showValidationErrors(container) {
        const el = container.querySelector('#tsValidationErrors');
        if (!el) {
            // Insert validation errors block
            const footer = container.querySelector('.ts-footer-bar');
            if (footer) {
                footer.insertAdjacentHTML('afterend', this._renderValidationErrors());
            }
        }
    }

    _hideValidationErrors(container) {
        const el = container.querySelector('#tsValidationErrors');
        if (el) el.remove();
    }

    // ══════════════════════════════════════════════
    // BUSINESS LOGICA
    // ══════════════════════════════════════════════

    _determineRequiredRoles() {
        const template = this.state.selectedTemplate;

        if (!template || !template.taken?.length) {
            // Geen template data: toon alleen verplichte basis-rollen
            return TENDER_ROLLEN
                .filter(r => r.required)
                .map(r => ({ ...r, takenCount: 0 }));
        }

        // Tel taken per rol in het template
        const rolTakenCount = {};
        const usedRoles = new Set();
        for (const taak of template.taken) {
            if (taak.rol) {
                usedRoles.add(taak.rol);
                rolTakenCount[taak.rol] = (rolTakenCount[taak.rol] || 0) + 1;
            }
        }

        // Combineer: verplichte rollen + rollen die in template voorkomen
        return TENDER_ROLLEN
            .filter(r => r.required || usedRoles.has(r.key))
            .map(r => ({
                ...r,
                takenCount: rolTakenCount[r.key] || 0
            }));
    }

    _autoAssign() {
        for (const role of this.requiredRoles) {
            if (this.assignments[role.key]) continue; // Al ingevuld

            // Strategie 1: Teamlid met matching standaard_rol
            let match = this.teamMembers.find(m =>
                m.standaard_rol === role.key
            );

            // Strategie 2: Teamlid dat deze rol in zijn rollen-array heeft
            if (!match) {
                match = this.teamMembers.find(m =>
                    Array.isArray(m.rollen) && m.rollen.includes(role.key)
                );
            }

            // Strategie 3: Als er maar 1 teamlid is, wijs die toe aan verplichte rollen
            if (!match && role.required && this.teamMembers.length === 1) {
                match = this.teamMembers[0];
            }

            if (match) {
                this.assignments[role.key] = match.user_id;
            }
        }
    }

    _getWorkloadLevel(userId) {
        if (!userId || !this.workloadData?.[userId]) return null;

        const data = this.workloadData[userId];
        const weken = Object.values(data.weken || {});

        if (weken.length === 0) {
            return { ...WORKLOAD_LEVELS.low, details: 'Geen taken in deze periode' };
        }

        // Neem de drukste week
        const maxTaken = Math.max(...weken.map(w => w.taken || 0));
        const totalTaken = weken.reduce((sum, w) => sum + (w.taken || 0), 0);

        let level;
        if (maxTaken >= WORKLOAD_LEVELS.high.min) {
            level = WORKLOAD_LEVELS.high;
        } else if (maxTaken >= WORKLOAD_LEVELS.medium.min) {
            level = WORKLOAD_LEVELS.medium;
        } else {
            level = WORKLOAD_LEVELS.low;
        }

        return {
            ...level,
            details: `${totalTaken} taken verdeeld over ${weken.length} weken (max ${maxTaken}/week)`
        };
    }

    _getWorkloadWarnings() {
        if (!this.workloadData) return [];

        const warnings = [];
        const assignedUserIds = new Set(Object.values(this.assignments));

        for (const [userId, data] of Object.entries(this.workloadData)) {
            if (!assignedUserIds.has(userId)) continue;

            for (const [weekKey, weekData] of Object.entries(data.weken || {})) {
                if (weekData.taken >= 5) {
                    const tenderList = weekData.tenders?.join(', ') || '';
                    warnings.push({
                        persoon: data.naam,
                        severity: weekData.taken >= 7 ? 'danger' : 'warning',
                        bericht: `${weekData.taken} taken in ${weekKey}${tenderList ? ` (${tenderList})` : ''}`
                    });
                }
            }
        }

        return warnings;
    }

    _getAssignedRequiredCount() {
        return this.requiredRoles.filter(
            r => r.required && this.assignments[r.key]
        ).length;
    }

    _getRequiredCount() {
        return this.requiredRoles.filter(r => r.required).length;
    }

    // ══════════════════════════════════════════════
    // API CALLS
    // ══════════════════════════════════════════════

    async _fetchTeamMembers() {
        try {
            const response = await fetch(
                `${this.state.baseURL}/team-members`,
                { headers: this._headers() }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.data || data || [];
        } catch (err) {
            console.error('TeamStep: Fout bij ophalen teamleden:', err);
            return [];
        }
    }

    async _fetchTemplates() {
        try {
            const response = await fetch(
                `${this.state.baseURL}/planning-templates?type=planning`,
                { headers: this._headers() }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return data.data || data || [];
        } catch (err) {
            console.error('TeamStep: Fout bij ophalen templates:', err);
            return [];
        }
    }

    async _loadWorkload() {
        const deadline = this.state.extractedData?.planning?.deadline_indiening?.value;
        if (!deadline || this.teamMembers.length === 0) {
            this.workloadData = null;
            return;
        }

        try {
            // Periode: 6 weken vóór deadline tot deadline
            const endDate = deadline.split('T')[0];
            const start = new Date(endDate);
            start.setDate(start.getDate() - 42);
            const startDate = start.toISOString().split('T')[0];

            const userIds = this.teamMembers
                .map(m => m.id || m.user_id)
                .filter(Boolean)
                .join(',');

            // Guard: skip als geen geldige user_ids
            if (!userIds) {
                this.workloadData = null;
                return;
            }

            const response = await fetch(
                `${this.state.baseURL}/team/workload?user_ids=${userIds}&start=${startDate}&end=${endDate}`,
                { headers: this._headers() }
            );

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            this.workloadData = data.workload || null;
        } catch (err) {
            console.error('TeamStep: Fout bij ophalen workload:', err);
            this.workloadData = null;
        }
    }

    _headers() {
        return {
            'Authorization': `Bearer ${this.state.authToken}`,
            'Content-Type': 'application/json'
        };
    }
}