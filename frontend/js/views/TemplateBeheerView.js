// ================================================================
// TenderZen — Template Beheer (Admin)
// Frontend/js/views/TemplateBeheerView.js
// Datum: 2026-02-09
// ================================================================
//
// Admin pagina voor het beheren van planning- en checklist-templates.
// Gebruikt de bestaande API endpoints uit planning_router (Fase B):
//
//   GET    /planning-templates              → Lijst
//   GET    /planning-templates/{id}         → Detail met taken
//   POST   /planning-templates              → Nieuw
//   PUT    /planning-templates/{id}         → Update
//   DELETE /planning-templates/{id}         → Verwijder
//   POST   /planning-templates/{id}/duplicate → Dupliceer
//   PUT    /planning-templates/{id}/taken   → Bulk replace taken
//
// ================================================================

const ROLLEN = [
    { value: 'tendermanager', label: 'Tendermanager' },
    { value: 'schrijver', label: 'Schrijver' },
    { value: 'calculator', label: 'Calculator' },
    { value: 'reviewer', label: 'Reviewer' },
    { value: 'designer', label: 'Designer' },
    { value: 'sales', label: 'Sales' },
    { value: 'jurist', label: 'Jurist' },
    { value: 'directie', label: 'Directie' }
];

export class TemplateBeheerView {

    constructor(options = {}) {
        this.container = null;
        this.baseURL = options.baseURL || window.API_CONFIG?.baseURL || '/api/v1';
        this.authToken = options.authToken || '';

        // State
        this.templates = [];
        this.activeFilter = 'all';      // 'all', 'planning', 'checklist'
        this.selectedTemplate = null;    // Volledig template object met taken
        this.editingTemplate = null;     // Template in edit-modus (kopie)
        this.unsavedChanges = false;
        this.isLoading = false;
        this.dragState = null;           // Voor drag-to-reorder
    }

    // ══════════════════════════════════════════════
    // LIFECYCLE
    // ══════════════════════════════════════════════

    async mount(container) {
        this.container = container;
        await this._ensureAuth();
        this.render();
        await this.loadTemplates();
    }

    unmount() {
        this.container = null;
    }

    // ══════════════════════════════════════════════
    // DATA LOADING
    // ══════════════════════════════════════════════

    async loadTemplates() {
        this.isLoading = true;
        this._renderList();

        try {
            const resp = await fetch(`${this.baseURL}/planning-templates`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            if (!resp.ok) throw new Error('Templates laden mislukt');

            const data = await resp.json();
            this.templates = data.templates || data || [];
            this.templates.sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));

        } catch (err) {
            console.error('❌ loadTemplates:', err);
            this.templates = [];
        } finally {
            this.isLoading = false;
            this._renderList();
        }
    }

    async loadTemplateDetail(templateId) {
        try {
            const resp = await fetch(`${this.baseURL}/planning-templates/${templateId}`, {
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            if (!resp.ok) throw new Error('Template laden mislukt');

            const data = await resp.json();
            this.selectedTemplate = data;
            this.editingTemplate = JSON.parse(JSON.stringify(data));
            this.unsavedChanges = false;

            // Sorteer taken op volgorde
            if (this.editingTemplate.taken) {
                this.editingTemplate.taken.sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
            }

            this._renderDetail();
            this._renderList(); // active state updaten

        } catch (err) {
            console.error('❌ loadTemplateDetail:', err);
            alert('Template kon niet geladen worden');
        }
    }

    // ══════════════════════════════════════════════
    // CRUD OPERATIES
    // ══════════════════════════════════════════════

    async createTemplate() {
        const naam = prompt('Naam van het nieuwe template:');
        if (!naam?.trim()) return;

        const type = await this._askType();
        if (!type) return;

        try {
            const resp = await fetch(`${this.baseURL}/planning-templates`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    naam: naam.trim(),
                    type: type,
                    beschrijving: '',
                    is_standaard: false
                })
            });

            if (!resp.ok) throw new Error('Aanmaken mislukt');

            const newTemplate = await resp.json();
            await this.loadTemplates();
            await this.loadTemplateDetail(newTemplate.id);

        } catch (err) {
            console.error('❌ createTemplate:', err);
            alert(`Fout: ${err.message}`);
        }
    }

    async saveTemplate() {
        if (!this.editingTemplate) return;

        try {
            // 1. Update template metadata
            const resp1 = await fetch(
                `${this.baseURL}/planning-templates/${this.editingTemplate.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        naam: this.editingTemplate.naam,
                        beschrijving: this.editingTemplate.beschrijving || '',
                        is_standaard: this.editingTemplate.is_standaard || false
                    })
                }
            );

            if (!resp1.ok) throw new Error('Template opslaan mislukt');

            // 2. Bulk replace taken
            const taken = (this.editingTemplate.taken || []).map((t, i) => ({
                naam: t.naam,
                beschrijving: t.beschrijving || '',
                rol: t.rol,
                t_minus_werkdagen: parseInt(t.t_minus_werkdagen) || 0,
                duur_werkdagen: parseInt(t.duur_werkdagen) || 1,
                is_mijlpaal: t.is_mijlpaal || false,
                is_verplicht: t.is_verplicht !== false,
                volgorde: i * 10
            }));

            const resp2 = await fetch(
                `${this.baseURL}/planning-templates/${this.editingTemplate.id}/taken`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ taken })
                }
            );

            if (!resp2.ok) throw new Error('Taken opslaan mislukt');

            this.unsavedChanges = false;
            this.selectedTemplate = JSON.parse(JSON.stringify(this.editingTemplate));

            // Refresh lijst
            await this.loadTemplates();
            this._renderDetail();

            this._showToast('Template opgeslagen');

        } catch (err) {
            console.error('❌ saveTemplate:', err);
            alert(`Fout bij opslaan: ${err.message}`);
        }
    }

    async deleteTemplate(templateId) {
        const tmpl = this.templates.find(t => t.id === templateId);
        if (!tmpl) return;

        const ok = confirm(
            `Weet je zeker dat je "${tmpl.naam}" wilt verwijderen?\n\n` +
            'Dit verwijdert ook alle taken binnen dit template.'
        );
        if (!ok) return;

        try {
            const resp = await fetch(`${this.baseURL}/planning-templates/${templateId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${this.authToken}` }
            });

            if (!resp.ok) throw new Error('Verwijderen mislukt');

            if (this.selectedTemplate?.id === templateId) {
                this.selectedTemplate = null;
                this.editingTemplate = null;
            }

            await this.loadTemplates();
            this._renderDetail();
            this._showToast('Template verwijderd');

        } catch (err) {
            console.error('❌ deleteTemplate:', err);
            alert(`Fout: ${err.message}`);
        }
    }

    async duplicateTemplate(templateId) {
        try {
            const resp = await fetch(
                `${this.baseURL}/planning-templates/${templateId}/duplicate`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.authToken}` }
                }
            );

            if (!resp.ok) throw new Error('Dupliceren mislukt');

            const newTemplate = await resp.json();
            await this.loadTemplates();
            await this.loadTemplateDetail(newTemplate.id);

            this._showToast('Template gedupliceerd');

        } catch (err) {
            console.error('❌ duplicateTemplate:', err);
            alert(`Fout: ${err.message}`);
        }
    }

    // ══════════════════════════════════════════════
    // TAKEN BEHEER
    // ══════════════════════════════════════════════

    addTaak() {
        if (!this.editingTemplate) return;

        if (!this.editingTemplate.taken) {
            this.editingTemplate.taken = [];
        }

        const taken = this.editingTemplate.taken;
        const maxVolgorde = taken.length > 0
            ? Math.max(...taken.map(t => t.volgorde || 0))
            : 0;

        taken.push({
            _tempId: `new-${Date.now()}`,
            naam: '',
            beschrijving: '',
            rol: 'tendermanager',
            t_minus_werkdagen: 10,
            duur_werkdagen: 1,
            is_mijlpaal: false,
            is_verplicht: true,
            volgorde: maxVolgorde + 10
        });

        this.unsavedChanges = true;
        this._renderDetail();

        // Focus op het nieuwe naam-veld
        requestAnimationFrame(() => {
            const rows = this.container?.querySelectorAll('.tb-taak-row');
            const lastRow = rows?.[rows.length - 1];
            lastRow?.querySelector('.tb-taak-naam')?.focus();
        });
    }

    removeTaak(index) {
        if (!this.editingTemplate?.taken) return;

        const taak = this.editingTemplate.taken[index];
        if (taak.naam && !confirm(`"${taak.naam}" verwijderen?`)) return;

        this.editingTemplate.taken.splice(index, 1);
        this.unsavedChanges = true;
        this._renderDetail();
    }

    moveTaak(fromIndex, toIndex) {
        if (!this.editingTemplate?.taken) return;

        const taken = this.editingTemplate.taken;
        if (toIndex < 0 || toIndex >= taken.length) return;

        const [item] = taken.splice(fromIndex, 1);
        taken.splice(toIndex, 0, item);

        // Herbereken volgorde
        taken.forEach((t, i) => { t.volgorde = i * 10; });

        this.unsavedChanges = true;
        this._renderDetail();
    }

    // ══════════════════════════════════════════════
    // RENDERING — MAIN LAYOUT
    // ══════════════════════════════════════════════

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="tb-page">
                <div class="tb-sidebar">
                    <div class="tb-sidebar-header">
                        <h2>Templates</h2>
                        <button class="tb-btn tb-btn--primary tb-btn--sm" id="tbNewBtn">
                            + Nieuw
                        </button>
                    </div>
                    <div class="tb-filter-tabs" id="tbFilterTabs">
                        <button class="tb-filter-tab tb-filter-tab--active" data-filter="all">Alle</button>
                        <button class="tb-filter-tab" data-filter="planning">Planning</button>
                        <button class="tb-filter-tab" data-filter="checklist">Checklist</button>
                    </div>
                    <div class="tb-template-list" id="tbTemplateList">
                        <!-- Filled by _renderList -->
                    </div>
                </div>
                <div class="tb-detail" id="tbDetail">
                    <!-- Filled by _renderDetail -->
                    <div class="tb-empty-state">
                        <span class="tb-empty-icon">📋</span>
                        <h3>Selecteer een template</h3>
                        <p>Klik op een template in de lijst om de taken te bekijken en bewerken.</p>
                    </div>
                </div>
            </div>
        `;

        // Listeners
        this.container.querySelector('#tbNewBtn')
            ?.addEventListener('click', () => this.createTemplate());

        this.container.querySelectorAll('.tb-filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeFilter = tab.dataset.filter;
                this.container.querySelectorAll('.tb-filter-tab').forEach(t =>
                    t.classList.toggle('tb-filter-tab--active', t === tab)
                );
                this._renderList();
            });
        });
    }

    // ══════════════════════════════════════════════
    // RENDERING — TEMPLATE LIJST
    // ══════════════════════════════════════════════

    _renderList() {
        const list = this.container?.querySelector('#tbTemplateList');
        if (!list) return;

        if (this.isLoading) {
            list.innerHTML = '<div class="tb-list-loading">Laden...</div>';
            return;
        }

        const filtered = this.templates.filter(t => {
            if (this.activeFilter === 'all') return true;
            return t.type === this.activeFilter;
        });

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="tb-list-empty">
                    Geen templates gevonden.
                    ${this.activeFilter !== 'all'
                        ? `<br><small>Probeer een ander filter.</small>`
                        : ''}
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(t => {
            const isActive = this.selectedTemplate?.id === t.id;
            const typeLabel = t.type === 'planning' ? '📅' : '✅';
            const badge = t.is_standaard ? '<span class="tb-badge">Standaard</span>' : '';

            return `
                <div class="tb-template-item ${isActive ? 'tb-template-item--active' : ''}"
                     data-id="${t.id}">
                    <div class="tb-template-item-main">
                        <span class="tb-template-type">${typeLabel}</span>
                        <div class="tb-template-info">
                            <div class="tb-template-naam">${this._esc(t.naam)}</div>
                            <div class="tb-template-meta">
                                ${t.type} ${badge}
                            </div>
                        </div>
                    </div>
                    <div class="tb-template-actions">
                        <button class="tb-icon-btn" data-action="duplicate" data-id="${t.id}"
                                title="Dupliceer">📋</button>
                        <button class="tb-icon-btn tb-icon-btn--danger" data-action="delete"
                                data-id="${t.id}" title="Verwijder">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        // Listeners
        list.querySelectorAll('.tb-template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Niet als er op een actie-knop geklikt is
                if (e.target.closest('.tb-template-actions')) return;

                if (this.unsavedChanges) {
                    if (!confirm('Je hebt onopgeslagen wijzigingen. Doorgaan?')) return;
                }

                this.loadTemplateDetail(item.dataset.id);
            });
        });

        list.querySelectorAll('[data-action="duplicate"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.duplicateTemplate(btn.dataset.id);
            });
        });

        list.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTemplate(btn.dataset.id);
            });
        });
    }

    // ══════════════════════════════════════════════
    // RENDERING — TEMPLATE DETAIL
    // ══════════════════════════════════════════════

    _renderDetail() {
        const detail = this.container?.querySelector('#tbDetail');
        if (!detail) return;

        const t = this.editingTemplate;
        if (!t) {
            detail.innerHTML = `
                <div class="tb-empty-state">
                    <span class="tb-empty-icon">📋</span>
                    <h3>Selecteer een template</h3>
                    <p>Klik op een template in de lijst om de taken te bekijken en bewerken.</p>
                </div>
            `;
            return;
        }

        const taken = t.taken || [];
        const typeLabel = t.type === 'planning' ? 'Planning' : 'Checklist';

        detail.innerHTML = `
            <div class="tb-detail-content">
                <!-- Header -->
                <div class="tb-detail-header">
                    <div class="tb-detail-header-left">
                        <input class="tb-detail-naam" id="tbNaam" value="${this._esc(t.naam)}"
                               placeholder="Template naam">
                        <span class="tb-detail-type-badge tb-detail-type-badge--${t.type}">
                            ${typeLabel}
                        </span>
                    </div>
                    <div class="tb-detail-header-right">
                        <label class="tb-checkbox-label">
                            <input type="checkbox" id="tbStandaard"
                                   ${t.is_standaard ? 'checked' : ''}>
                            Standaard template
                        </label>
                        <button class="tb-btn tb-btn--primary" id="tbSaveBtn"
                                ${!this.unsavedChanges ? 'disabled' : ''}>
                            💾 Opslaan
                        </button>
                    </div>
                </div>

                <!-- Beschrijving -->
                <textarea class="tb-detail-beschrijving" id="tbBeschrijving"
                          rows="2" placeholder="Optionele beschrijving..."
                >${this._esc(t.beschrijving || '')}</textarea>

                <!-- Taken header -->
                <div class="tb-taken-header">
                    <h3>Taken (${taken.length})</h3>
                    <button class="tb-btn tb-btn--secondary tb-btn--sm" id="tbAddTaakBtn">
                        + Taak toevoegen
                    </button>
                </div>

                <!-- Taken tabel -->
                ${taken.length > 0 ? `
                    <div class="tb-taken-table">
                        <div class="tb-taken-thead">
                            <div class="tb-col-drag"></div>
                            <div class="tb-col-naam">Taaknaam</div>
                            <div class="tb-col-rol">Rol</div>
                            <div class="tb-col-tminus">T-minus</div>
                            <div class="tb-col-duur">Duur</div>
                            <div class="tb-col-flags">Flags</div>
                            <div class="tb-col-actions"></div>
                        </div>
                        <div class="tb-taken-tbody" id="tbTakenBody">
                            ${taken.map((taak, i) => this._renderTaakRow(taak, i)).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="tb-taken-empty">
                        <p>Nog geen taken. Klik "Taak toevoegen" om te beginnen.</p>
                    </div>
                `}

                ${this.unsavedChanges ? `
                    <div class="tb-unsaved-banner">
                        ⚠️ Onopgeslagen wijzigingen
                    </div>
                ` : ''}
            </div>
        `;

        this._attachDetailListeners(detail);
    }

    _renderTaakRow(taak, index) {
        const rolOptions = ROLLEN.map(r =>
            `<option value="${r.value}" ${taak.rol === r.value ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        return `
            <div class="tb-taak-row ${taak.is_mijlpaal ? 'tb-taak-row--mijlpaal' : ''}"
                 data-index="${index}" draggable="true">
                <div class="tb-col-drag">
                    <span class="tb-drag-handle" title="Sleep om te verplaatsen">⠿</span>
                </div>
                <div class="tb-col-naam">
                    <input class="tb-taak-naam" data-index="${index}" data-field="naam"
                           value="${this._esc(taak.naam)}" placeholder="Taaknaam...">
                    <input class="tb-taak-beschrijving" data-index="${index}" data-field="beschrijving"
                           value="${this._esc(taak.beschrijving || '')}" placeholder="Beschrijving (optioneel)">
                </div>
                <div class="tb-col-rol">
                    <select class="tb-taak-select" data-index="${index}" data-field="rol">
                        ${rolOptions}
                    </select>
                </div>
                <div class="tb-col-tminus">
                    <input type="number" class="tb-taak-number" data-index="${index}"
                           data-field="t_minus_werkdagen" value="${taak.t_minus_werkdagen || 0}"
                           min="0" max="200" title="Werkdagen vóór deadline">
                    <span class="tb-taak-unit">wd</span>
                </div>
                <div class="tb-col-duur">
                    <input type="number" class="tb-taak-number" data-index="${index}"
                           data-field="duur_werkdagen" value="${taak.duur_werkdagen || 1}"
                           min="0" max="50" title="Duur in werkdagen">
                    <span class="tb-taak-unit">wd</span>
                </div>
                <div class="tb-col-flags">
                    <label class="tb-flag" title="Mijlpaal">
                        <input type="checkbox" data-index="${index}" data-field="is_mijlpaal"
                               ${taak.is_mijlpaal ? 'checked' : ''}>
                        🏁
                    </label>
                    <label class="tb-flag" title="Verplicht">
                        <input type="checkbox" data-index="${index}" data-field="is_verplicht"
                               ${taak.is_verplicht !== false ? 'checked' : ''}>
                        ⚡
                    </label>
                </div>
                <div class="tb-col-actions">
                    <button class="tb-icon-btn" data-action="move-up" data-index="${index}"
                            title="Omhoog" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="tb-icon-btn" data-action="move-down" data-index="${index}"
                            title="Omlaag" ${index === (this.editingTemplate?.taken?.length || 0) - 1 ? 'disabled' : ''}>↓</button>
                    <button class="tb-icon-btn tb-icon-btn--danger" data-action="remove"
                            data-index="${index}" title="Verwijder">✕</button>
                </div>
            </div>
        `;
    }

    // ══════════════════════════════════════════════
    // EVENT LISTENERS — DETAIL
    // ══════════════════════════════════════════════

    _attachDetailListeners(detail) {
        const t = this.editingTemplate;
        if (!t) return;

        // Naam
        detail.querySelector('#tbNaam')?.addEventListener('input', (e) => {
            t.naam = e.target.value;
            this._markChanged();
        });

        // Beschrijving
        detail.querySelector('#tbBeschrijving')?.addEventListener('input', (e) => {
            t.beschrijving = e.target.value;
            this._markChanged();
        });

        // Standaard checkbox
        detail.querySelector('#tbStandaard')?.addEventListener('change', (e) => {
            t.is_standaard = e.target.checked;
            this._markChanged();
        });

        // Opslaan
        detail.querySelector('#tbSaveBtn')
            ?.addEventListener('click', () => this.saveTemplate());

        // Taak toevoegen
        detail.querySelector('#tbAddTaakBtn')
            ?.addEventListener('click', () => this.addTaak());

        // Taak veld wijzigingen
        detail.querySelectorAll('[data-field]').forEach(el => {
            const event = (el.type === 'checkbox') ? 'change' : 'input';
            el.addEventListener(event, (e) => {
                const idx = parseInt(e.target.dataset.index);
                const field = e.target.dataset.field;

                if (!t.taken?.[idx]) return;

                if (el.type === 'checkbox') {
                    t.taken[idx][field] = e.target.checked;
                } else if (el.type === 'number') {
                    t.taken[idx][field] = parseInt(e.target.value) || 0;
                } else {
                    t.taken[idx][field] = e.target.value;
                }

                this._markChanged();
            });
        });

        // Move up / down
        detail.querySelectorAll('[data-action="move-up"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.moveTaak(parseInt(btn.dataset.index), parseInt(btn.dataset.index) - 1);
            });
        });

        detail.querySelectorAll('[data-action="move-down"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.moveTaak(parseInt(btn.dataset.index), parseInt(btn.dataset.index) + 1);
            });
        });

        // Remove
        detail.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.removeTaak(parseInt(btn.dataset.index));
            });
        });

        // Drag & drop reorder
        this._attachDragListeners(detail);

        // Keyboard: Ctrl+S
        this._saveHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.unsavedChanges) this.saveTemplate();
            }
        };
        document.addEventListener('keydown', this._saveHandler);
    }

    _attachDragListeners(detail) {
        const tbody = detail.querySelector('#tbTakenBody');
        if (!tbody) return;

        let dragIndex = null;

        tbody.querySelectorAll('.tb-taak-row').forEach(row => {
            row.addEventListener('dragstart', (e) => {
                dragIndex = parseInt(row.dataset.index);
                row.classList.add('tb-taak-row--dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            row.addEventListener('dragend', () => {
                row.classList.remove('tb-taak-row--dragging');
                dragIndex = null;
                tbody.querySelectorAll('.tb-taak-row--dragover').forEach(r =>
                    r.classList.remove('tb-taak-row--dragover')
                );
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                row.classList.add('tb-taak-row--dragover');
            });

            row.addEventListener('dragleave', () => {
                row.classList.remove('tb-taak-row--dragover');
            });

            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('tb-taak-row--dragover');
                const dropIndex = parseInt(row.dataset.index);
                if (dragIndex !== null && dragIndex !== dropIndex) {
                    this.moveTaak(dragIndex, dropIndex);
                }
            });
        });
    }

    // ══════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════

    _markChanged() {
        this.unsavedChanges = true;
        const btn = this.container?.querySelector('#tbSaveBtn');
        if (btn) btn.disabled = false;

        // Toon unsaved banner
        let banner = this.container?.querySelector('.tb-unsaved-banner');
        if (!banner) {
            const content = this.container?.querySelector('.tb-detail-content');
            content?.insertAdjacentHTML('beforeend',
                '<div class="tb-unsaved-banner">⚠️ Onopgeslagen wijzigingen</div>'
            );
        }
    }

    _askType() {
        return new Promise(resolve => {
            const type = prompt(
                'Type template:\n\n' +
                '1 = Planning (taken met deadlines)\n' +
                '2 = Checklist (documenten/bewijsstukken)\n\n' +
                'Voer 1 of 2 in:'
            );

            if (type === '1') resolve('planning');
            else if (type === '2') resolve('checklist');
            else resolve(null);
        });
    }

    _showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'tb-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('tb-toast--visible'));

        setTimeout(() => {
            toast.classList.remove('tb-toast--visible');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    async _ensureAuth() {
        if (this.authToken) return;

        const supabase = window.supabaseClient || window.supabase;
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            this.authToken = session?.access_token || '';
        }
    }

    _esc(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }
}