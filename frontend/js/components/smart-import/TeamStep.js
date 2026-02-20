// ================================================================
// TenderZen — Smart Import v4.0 — TeamStep.js
// Stap 4: Team samenstellen
// Datum: 2026-02-17
// Doel-pad: Frontend/js/components/smart-import/TeamStep.js
// ================================================================
//
// FIXES v2.1 (2026-02-17):
// 1. _updateFooterStatus() toegevoegd (was aanwezig in aanroepen maar niet gedefinieerd)
// 2. _renderRoleRow() echte implementatie toegevoegd (was lege placeholder)
// 3. _getWorkloadHtml() toegevoegd (helper voor workload badge)
// 4. _updateRoleRowState() toegevoegd (was aanwezig in aanroepen maar niet gedefinieerd)
// 5. _showValidationErrors() en _hideValidationErrors() toegevoegd
// 6. _renderTemplateBar() echte implementatie (was lege placeholder)
// 7. _renderWarnings() echte implementatie (was lege placeholder)
// ================================================================

/**
 * Rolconfiguratie voor tender-teams.
 * Volgorde bepaalt weergave in de UI.
 */
const TENDER_ROLLEN = [
  { key: 'tendermanager', label: 'Tendermanager', icon: '👔', required: true },
  { key: 'schrijver', label: 'Tekstschrijver', icon: '✏️', required: true },
  { key: 'calculator', label: 'Calculator', icon: '🔢', required: false },
  { key: 'reviewer', label: 'Reviewer', icon: '👁️', required: false },
  { key: 'designer', label: 'Vormgever', icon: '🎨', required: false },
  { key: 'sales', label: 'Sales / Klant', icon: '🤝', required: false },
  { key: 'coordinator', label: 'Coördinator', icon: '📋', required: false },
  { key: 'klant_contact', label: 'Klant Contact', icon: '📞', required: false }
];

/**
 * Workload drempelwaarden per week
 */
const WORKLOAD_LEVELS = {
  low:    { min: 0, max: 2,  icon: '🟢', label: 'Beschikbaar', cssClass: 'ts-workload--low' },
  medium: { min: 3, max: 4,  icon: '🟡', label: 'Druk',        cssClass: 'ts-workload--medium' },
  high:   { min: 5, max: 99, icon: '🔴', label: 'Overbelast',  cssClass: 'ts-workload--high' }
};


export class TeamStep {

  // ── Geeft het aantal ingevulde verplichte rollen terug ──
  _getAssignedRequiredCount() {
    return this.requiredRoles.filter(r => r.required && this.assignments[r.key]).length;
  }

  // ── Geeft het totaal aantal verplichte rollen terug ──
  _getRequiredCount() {
    return this.requiredRoles.filter(r => r.required).length;
  }

  constructor(wizardState) {
    this.state = wizardState;
    this.teamMembers = [];
    this.assignments = {};         // rol → user_id
    this.requiredRoles = [];       // Gefilterde TENDER_ROLLEN op basis van template
    this.workloadData = null;      // user_id → { week: count }
    this.templates = [];           // Beschikbare planning templates
    this.validationErrors = [];
    this._container = null;
  }

  // ══════════════════════════════════════════════
  // HELPER: Automatisch teamleden toewijzen aan rollen
  // ══════════════════════════════════════════════

  _autoAssign() {
    for (const role of this.requiredRoles) {
      if (this.assignments[role.key]) continue; // Al ingevuld

      // Strategie 1: Teamlid met matching rol of bureau_rol
      let match = this.teamMembers.find(m =>
        m.rol === role.key || m.bureau_rol === role.key
      );

      // Strategie 2: Teamlid dat matching rol-label heeft
      if (!match) {
        match = this.teamMembers.find(m =>
          Array.isArray(m.rollen) && m.rollen.includes(role.key)
        );
      }

      // Strategie 3: Match op rol naam (backend retourneert 'schrijver', 'manager', etc.)
      if (!match) {
        const rolLower = role.key.toLowerCase();
        match = this.teamMembers.find(m => {
          const mRol = (m.rol || m.bureau_rol || m.role || '').toLowerCase();
          return mRol.includes(rolLower) || rolLower.includes(mRol);
        });
      }

      // Strategie 4: Als er maar 1 teamlid is, wijs die toe aan verplichte rollen
      if (!match && role.required && this.teamMembers.length === 1) {
        match = this.teamMembers[0];
      }

      if (match) {
        this.assignments[role.key] = match.user_id || match.id;
      }
    }
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
            <button class="ts-btn-auto" id="tsAutoAssign"
              title="Automatisch toewijzen op basis van standaard rollen">
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
    if (!this.templates.length) return '';
    return `
      <div class="ts-template-bar">
        <span class="ts-template-label">📋 Template:</span>
        <select class="ts-template-select" id="tsTemplateSelect">
          ${this.templates.map(t => `
            <option value="${t.id}"
              ${this.state.selectedTemplate?.id === t.id ? 'selected' : ''}>
              ${t.naam}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  _renderRoleRow(role) {
    const assignedUserId = this.assignments[role.key] || '';
    const workloadHtml = this._getWorkloadHtml(assignedUserId);

    return `
      <div class="ts-role-row ts-role-row--${role.required ? 'required' : 'optional'}"
           data-role="${role.key}">
        <div class="ts-role-info">
          <span class="ts-role-icon">${role.icon}</span>
          <div class="ts-role-text">
            <span class="ts-role-name">${role.label}</span>
            <div class="ts-role-meta">
              <span class="ts-badge ts-badge--${role.required ? 'required' : 'optional'}">
                ${role.required ? 'Verplicht' : 'Optioneel'}
              </span>
              ${role.takenCount ? `<span>${role.takenCount} taken</span>` : ''}
            </div>
          </div>
        </div>
        <div class="ts-role-assign">
          <select class="ts-select" data-role="${role.key}">
            <option value="">— Selecteer —</option>
            ${!role.required ? '<option value="__skip">Overslaan</option>' : ''}
            ${this.teamMembers.map(m => {
              const uid = m.user_id || m.id;
              return `<option value="${uid}" ${uid === assignedUserId ? 'selected' : ''}>
                ${m.naam}
              </option>`;
            }).join('')}
          </select>
          <div class="ts-workload-slot" data-workload-role="${role.key}">
            ${assignedUserId ? workloadHtml : ''}
          </div>
        </div>
      </div>
    `;
  }

  _renderWarnings() {
    if (!this.workloadData) return '';

    const warnings = this.requiredRoles.filter(r => {
      const uid = this.assignments[r.key];
      if (!uid || !this.workloadData[uid]) return false;
      return Math.max(...Object.values(this.workloadData[uid])) >= 5;
    });

    if (!warnings.length) return '';

    return `
      <div class="ts-warnings">
        <div class="ts-warnings-title">⚠️ Workload waarschuwingen</div>
        ${warnings.map(r => {
          const uid = this.assignments[r.key];
          const member = this.teamMembers.find(m => (m.user_id || m.id) === uid);
          const max = Math.max(...Object.values(this.workloadData[uid]));
          return `<div class="ts-warning ts-warning--danger">
            ${member?.naam || uid} heeft ${max} taken in een week
          </div>`;
        }).join('')}
      </div>
    `;
  }

  _renderValidationErrors() {
    if (!this.validationErrors.length) return '';
    return `
      <div class="ts-validation-errors">
        ${this.validationErrors.map(e =>
          `<div class="ts-validation-error">❌ ${e.message}</div>`
        ).join('')}
      </div>
    `;
  }

  // ══════════════════════════════════════════════
  // INLINE UI UPDATES (geen full re-render)
  // ══════════════════════════════════════════════

  _updateFooterStatus(container) {
    const assignedCount = this._getAssignedRequiredCount();
    const requiredCount = this._getRequiredCount();
    const allFilled = assignedCount >= requiredCount;

    const statusEl = container.querySelector('.ts-status');
    if (!statusEl) return;

    statusEl.className = `ts-status ${allFilled ? 'ts-status--ok' : 'ts-status--incomplete'}`;
    statusEl.innerHTML = `
      <span class="ts-status-icon">${allFilled ? '✅' : '⚠️'}</span>
      <span>${assignedCount} van ${requiredCount} verplichte rollen ingevuld</span>
    `;
  }

  _updateRoleRowState(container, roleKey) {
    const userId = this.assignments[roleKey] || '';
    const slot = container.querySelector(`[data-workload-role="${roleKey}"]`);
    if (slot) {
      slot.innerHTML = userId ? this._getWorkloadHtml(userId) : '';
    }
    // Verwijder error-klasse als rol nu ingevuld is
    if (userId) {
      const row = container.querySelector(`.ts-role-row[data-role="${roleKey}"]`);
      if (row) row.classList.remove('ts-role-row--error');
    }
  }

  _showValidationErrors(container) {
    let errBlock = container.querySelector('.ts-validation-errors');
    if (!errBlock) {
      errBlock = document.createElement('div');
      errBlock.className = 'ts-validation-errors';
      container.querySelector('.ts')?.appendChild(errBlock);
    }
    errBlock.innerHTML = this.validationErrors
      .map(e => `<div class="ts-validation-error">❌ ${e.message}</div>`)
      .join('');
  }

  _hideValidationErrors(container) {
    container.querySelector('.ts-validation-errors')?.remove();
  }

  _getWorkloadHtml(userId) {
    if (!userId || !this.workloadData) {
      return '<span class="ts-workload ts-workload--low">🟢 Beschikbaar</span>';
    }
    const userWorkload = this.workloadData[userId];
    if (!userWorkload || !Object.keys(userWorkload).length) {
      return '<span class="ts-workload ts-workload--low">🟢 Beschikbaar</span>';
    }
    const maxTaken = Math.max(...Object.values(userWorkload));
    const level = maxTaken >= 5 ? WORKLOAD_LEVELS.high
                : maxTaken >= 3 ? WORKLOAD_LEVELS.medium
                : WORKLOAD_LEVELS.low;
    return `<span class="ts-workload ${level.cssClass}">${level.icon} ${level.label} (${maxTaken})</span>`;
  }

  // ══════════════════════════════════════════════
  // HELPER: Bepaal benodigde rollen op basis van template
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

  // ══════════════════════════════════════════════
  // API CALLS
  // ══════════════════════════════════════════════

  async _fetchTeamMembers() {
    try {
      // TEMP: Hardcode geldige bureau_id voor test
      const bureauId = 'b542d006-de2a-4492-a2bb-0ecc83eda8bd';
      const url = `${this.state.baseURL}/team-members?tenderbureau_id=${bureauId}`;
      console.log('👥 TeamStep: Fetching team members from:', url);
      const response = await fetch(url, { headers: this._headers() });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`👥 TeamStep: HTTP ${response.status}:`, errText);
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const members = data.data || data || [];
      console.log(
        `👥 TeamStep: ${members.length} teamleden geladen`,
        members.map(m => `${m.naam} (${m.user_id || m.id})`)
      );
      return members;
    } catch (err) {
      console.error('👥 TeamStep: Fout bij ophalen teamleden:', err);
      return [];
    }
  }

async _fetchTemplates() {
    try {
        // Probeer bureau_id uit verschillende bronnen
        const bureauId = this.state.activeBureauId 
                      || this.state.tenderbureau_id 
                      || this.state.extractedData?.tenderbureau_id;
        
        // Build URL met optionele bureau filter
        let url = `${this.state.baseURL}/planning-templates?type=planning`;
        if (bureauId) {
            url += `&tenderbureau_id=${bureauId}`;
            console.log(`📋 Fetching templates voor bureau: ${bureauId}`);
        } else {
            console.warn('⚠️ Geen bureau_id - fetching alle templates');
        }
        
        const response = await fetch(url, { 
            headers: this._headers() 
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`❌ Templates HTTP ${response.status}: ${errorText}`);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const templates = data.data || data || [];
        
        console.log(`✅ ${templates.length} templates geladen`);
        return templates;
        
    } catch (err) {
        console.error('❌ TeamStep: Fout bij ophalen templates:', err);
        // Graceful degradation: return lege array i.p.v. crash
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

      // TEMP: Hardcode bureau_id — TODO: dynamisch maken
      const bureauId = 'b542d006-de2a-4492-a2bb-0ecc83eda8bd';

      const userIdsArr = this.teamMembers
        .map(m => m.id || m.user_id)
        .filter(Boolean);
      if (!userIdsArr.length) {
        this.workloadData = null;
        return;
      }

      const userIdsParam = encodeURIComponent(userIdsArr.join(','));
      const response = await fetch(
        `${this.state.baseURL}/team/workload?user_ids=${userIdsParam}&start=${startDate}&end=${endDate}&tenderbureau_id=${bureauId}`,
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