/**
 * PlanningEventHandlers.js - Complete Event Handling
 * Frontend/js/modals/PlanningModal/PlanningEventHandlers.js
 * 
 * Beheert alle user interactions:
 * - Toggle status (planning + checklist)
 * - Add/Edit/Delete items
 * - Date pickers (inline)
 * - Assignment dropdowns
 * - Template loading
 */

import { planningService } from '../../services/PlanningService.js';
import { PlanningHelpers } from './PlanningHelpers.js';

export class PlanningEventHandlers {
    constructor(modal) {
        this.modal = modal;
        this._escHandler = null;
    }

    // ============================================
    // MAIN EVENT LISTENERS
    // ============================================
    
    attachMainListeners() {
        const m = this.modal.modal;
        
        // Close handlers
        m.querySelector('#planning-modal-close')?.addEventListener('click', () => this.modal.close());
        m.querySelector('#planning-btn-close')?.addEventListener('click', () => this.modal.close());
        m.querySelector('.planning-modal-overlay')?.addEventListener('click', () => this.modal.close());
        
        // Tab switching
        m.querySelectorAll('.planning-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.modal.switchTab(tab.dataset.tab);
            });
        });

        // ESC key
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.modal.isOpen) {
                this.modal.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    }

    attachContentListeners() {
        const body = this.modal.modal?.querySelector('#planning-modal-body');
        if (!body) return;

        // Event delegation
        body.addEventListener('click', async (e) => {
            await this._handleContentClick(e);
        });
    }

    // ============================================
    // CONTENT CLICK ROUTER
    // ============================================
    
    async _handleContentClick(e) {
        // Template loading
        if (e.target.closest('#btn-load-template-planning') || 
            e.target.closest('#btn-empty-template-planning')) {
            return this.handleLoadTemplate('planning');
        }
        if (e.target.closest('#btn-load-template-checklist') || 
            e.target.closest('#btn-empty-template-checklist')) {
            return this.handleLoadTemplate('checklist');
        }

        // Add buttons
        if (e.target.closest('#btn-add-taak') || e.target.closest('#add-taak-bottom')) {
            return this.handleAddTaak();
        }
        if (e.target.closest('#btn-add-checklist')) {
            return this.handleAddChecklistItem();
        }

        // Action targets
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;

        const handlers = {
            'toggle-taak': () => this.handleToggleTaak(target.dataset.taakId, target.dataset.status),
            'toggle-checklist': () => this.handleToggleChecklist(target.dataset.itemId, target.dataset.status),
            'assign-person': () => this.handleAssignPerson(target.dataset.taakId, target),
            'assign-checklist': () => this.handleAssignChecklist(target.dataset.itemId, target),
            'set-date': () => this.handleSetDate(target.dataset.taakId, target),
            'set-checklist-date': () => this.handleSetChecklistDate(target.dataset.itemId, target),
            'taak-menu': () => this.handleTaakMenu(target.dataset.taakId),
            'checklist-menu': () => this.handleChecklistMenu(target.dataset.itemId),
            'add-checklist-in-section': () => this.handleAddChecklistItem(target.dataset.section),
        };

        const handler = handlers[action];
        if (handler) await handler();
    }

    // ============================================
    // TOGGLE HANDLERS
    // ============================================
    
    async handleToggleTaak(taakId, currentStatus) {
        try {
            await planningService.togglePlanningTaakStatus(taakId, currentStatus);

            const taak = this.modal.planningTaken.find(t => t.id === taakId);
            if (taak) {
                taak.status = currentStatus === 'done' ? 'todo' : 'done';
                taak.updated_at = new Date().toISOString();
            }

            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Toggle taak error:', error);
            PlanningHelpers.showAlert('Fout bij bijwerken: ' + error.message);
        }
    }

    async handleToggleChecklist(itemId, currentStatus) {
        try {
            await planningService.toggleChecklistItemStatus(itemId, currentStatus);

            const item = this.modal.checklistItems.find(i => i.id === itemId);
            if (item) {
                item.status = currentStatus === 'completed' ? 'pending' : 'completed';
                item.updated_at = new Date().toISOString();
            }

            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Toggle checklist error:', error);
            PlanningHelpers.showAlert('Fout bij bijwerken: ' + error.message);
        }
    }

    // ============================================
    // DATE PICKER
    // ============================================
    
    handleSetDate(taakId, targetEl) {
        const taak = this.modal.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        // Remove existing pickers
        this.modal.modal.querySelectorAll('.planning-date-picker-popup').forEach(el => el.remove());

        const picker = document.createElement('div');
        picker.className = 'planning-date-picker-popup';
        Object.assign(picker.style, {
            position: 'absolute',
            zIndex: '10001',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '200px'
        });

        const currentDate = taak.datum ? new Date(taak.datum).toISOString().split('T')[0] : '';

        picker.innerHTML = `
            <label style="font-size:12px;font-weight:600;color:#475569;">Datum instellen</label>
            <input type="date" value="${currentDate}" 
                   style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;color:#0f172a;">
            <div style="display:flex;gap:6px;justify-content:flex-end;">
                ${taak.datum ? `<button class="date-picker-clear" style="padding:5px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Wissen</button>` : ''}
                <button class="date-picker-cancel" style="padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Annuleren</button>
                <button class="date-picker-save" style="padding:5px 12px;border-radius:6px;border:none;background:#7c3aed;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Opslaan</button>
            </div>
        `;

        // Position
        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        picker.style.top = `${rect.bottom - modalRect.top + 4}px`;
        picker.style.right = `${modalRect.right - rect.right}px`;

        this.modal.modal.querySelector('.planning-modal-container').appendChild(picker);

        const input = picker.querySelector('input[type="date"]');
        input.focus();

        // Event handlers
        picker.querySelector('.date-picker-save').addEventListener('click', async () => {
            if (input.value) await this._saveTaakDate(taakId, input.value);
            picker.remove();
        });

        picker.querySelector('.date-picker-cancel').addEventListener('click', () => picker.remove());

        picker.querySelector('.date-picker-clear')?.addEventListener('click', async () => {
            await this._saveTaakDate(taakId, null);
            picker.remove();
        });

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter' && input.value) {
                await this._saveTaakDate(taakId, input.value);
                picker.remove();
            }
            if (e.key === 'Escape') picker.remove();
        });

        // Click outside closes
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    async _saveTaakDate(taakId, dateStr) {
        try {
            await planningService.updatePlanningTaak(taakId, {
                datum: dateStr ? `${dateStr}T00:00:00` : null
            });

            const taak = this.modal.planningTaken.find(t => t.id === taakId);
            if (taak) {
                taak.datum = dateStr ? `${dateStr}T00:00:00` : null;
                taak.updated_at = new Date().toISOString();
            }

            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Date update error:', error);
            PlanningHelpers.showAlert('Fout bij opslaan datum: ' + error.message);
        }
    }

    // Checklist date picker (same pattern)
    handleSetChecklistDate(itemId, targetEl) {
        const item = this.modal.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        this.modal.modal.querySelectorAll('.planning-date-picker-popup').forEach(el => el.remove());

        const picker = document.createElement('div');
        picker.className = 'planning-date-picker-popup';
        Object.assign(picker.style, {
            position: 'absolute',
            zIndex: '10001',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '200px'
        });

        const currentDate = item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : '';

        picker.innerHTML = `
            <label style="font-size:12px;font-weight:600;color:#475569;">Deadline instellen</label>
            <input type="date" value="${currentDate}" style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;">
            <div style="display:flex;gap:6px;justify-content:flex-end;">
                ${item.deadline ? `<button class="date-picker-clear" style="padding:5px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;">Wissen</button>` : ''}
                <button class="date-picker-cancel" style="padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;">Annuleren</button>
                <button class="date-picker-save" style="padding:5px 12px;border-radius:6px;border:none;background:#16a34a;color:white;font-size:12px;font-weight:600;cursor:pointer;">Opslaan</button>
            </div>
        `;

        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        picker.style.top = `${rect.bottom - modalRect.top + 4}px`;
        picker.style.right = `${modalRect.right - rect.right}px`;

        this.modal.modal.querySelector('.planning-modal-container').appendChild(picker);

        const input = picker.querySelector('input[type="date"]');
        input.focus();

        picker.querySelector('.date-picker-save').addEventListener('click', async () => {
            if (input.value) await this._saveChecklistDate(itemId, input.value);
            picker.remove();
        });

        picker.querySelector('.date-picker-cancel').addEventListener('click', () => picker.remove());
        picker.querySelector('.date-picker-clear')?.addEventListener('click', async () => {
            await this._saveChecklistDate(itemId, null);
            picker.remove();
        });

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!picker.contains(e.target)) {
                    picker.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    async _saveChecklistDate(itemId, dateStr) {
        try {
            await planningService.updateChecklistItem(itemId, {
                deadline: dateStr || null
            });

            const item = this.modal.checklistItems.find(i => i.id === itemId);
            if (item) {
                item.deadline = dateStr || null;
                item.updated_at = new Date().toISOString();
            }

            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Checklist date update error:', error);
            PlanningHelpers.showAlert('Fout bij opslaan datum: ' + error.message);
        }
    }

    // ============================================
    // ASSIGNMENT DROPDOWN - PLANNING
    // ============================================
    
    handleAssignPerson(taakId, targetEl) {
        const taak = this.modal.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        this.modal.modal.querySelectorAll('.planning-assignee-dropdown').forEach(el => el.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'planning-assignee-dropdown';
        Object.assign(dropdown.style, {
            position: 'absolute',
            zIndex: '10001',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            padding: '8px 0',
            minWidth: '220px',
            maxHeight: '280px',
            overflowY: 'auto'
        });

        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        dropdown.style.top = `${rect.bottom - modalRect.top + 4}px`;
        dropdown.style.left = `${rect.left - modalRect.left}px`;

        this.modal.modal.querySelector('.planning-modal-container').appendChild(dropdown);

        const renderOptions = () => {
            const currentIds = Array.isArray(taak.toegewezen_aan) ? taak.toegewezen_aan : [];
            const count = currentIds.length;

            let html = `<div style="padding:6px 14px 8px;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;">
                <span>Teamlid toewijzen</span>
                ${count > 0 ? `<span style="font-size:11px;color:#7c3aed;font-weight:600;">${count} geselecteerd</span>` : ''}
            </div>`;

            if (this.modal.teamMembers.length === 0) {
                html += `<div style="padding:14px;font-size:13px;color:#94a3b8;text-align:center;">Geen teamleden gevonden</div>`;
            } else {
                this.modal.teamMembers.forEach(member => {
                    const memberId = member.user_id || member.id;
                    const isAssigned = currentIds.includes(memberId);
                    const initialen = member.initialen || (member.naam || '?').substring(0, 2).toUpperCase();
                    const kleur = member.avatar_kleur || '#667eea';
                    const naam = member.naam || member.email || 'Onbekend';
                    const rol = member.rol || '';

                    html += `
                        <div class="assignee-option" data-member-id="${memberId}" 
                             style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;${isAssigned ? 'background:#f5f3ff;' : ''}">
                            <span style="width:28px;height:28px;border-radius:50%;background:${kleur};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${initialen}</span>
                            <div style="flex:1;">
                                <div style="font-size:13px;font-weight:${isAssigned ? '700' : '500'};color:#0f172a;">${naam}</div>
                                ${rol ? `<div style="font-size:11px;color:#94a3b8;">${rol}</div>` : ''}
                            </div>
                            ${isAssigned ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                        </div>
                    `;
                });
            }

            dropdown.innerHTML = html;

            dropdown.querySelectorAll('.assignee-option').forEach(option => {
                option.addEventListener('click', async () => {
                    await this._toggleAssignee(taakId, option.dataset.memberId);
                    renderOptions();
                });
            });
        };

        renderOptions();

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && !targetEl.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                    this.modal.refresh();
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    async _toggleAssignee(taakId, memberId) {
        const taak = this.modal.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        const currentIds = Array.isArray(taak.toegewezen_aan) ? taak.toegewezen_aan : [];
        const newIds = currentIds.includes(memberId)
            ? currentIds.filter(id => id !== memberId)
            : [...currentIds, memberId];

        try {
            await planningService.updatePlanningTaak(taakId, {
                toegewezen_aan: newIds
            });

            taak.toegewezen_aan = newIds;
            taak.updated_at = new Date().toISOString();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Assignee update error:', error);
            PlanningHelpers.showAlert('Fout bij toewijzen: ' + error.message);
        }
    }

    // ============================================
    // ASSIGNMENT DROPDOWN - CHECKLIST
    // ============================================
    
    handleAssignChecklist(itemId, targetEl) {
        const item = this.modal.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        this.modal.modal.querySelectorAll('.planning-assignee-dropdown').forEach(el => el.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'planning-assignee-dropdown';
        Object.assign(dropdown.style, {
            position: 'absolute',
            zIndex: '10001',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            padding: '8px 0',
            minWidth: '220px',
            maxHeight: '280px',
            overflowY: 'auto'
        });

        const currentIds = Array.isArray(item.verantwoordelijke_data) ? item.verantwoordelijke_data : [];
        const currentId = currentIds.length > 0 ? currentIds[0] : null;

        let html = `<div style="padding:6px 14px 8px;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #f1f5f9;">Verantwoordelijke toewijzen</div>`;

        html += `
            <div class="assignee-option" data-member-id="" 
                 style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;${!currentId ? 'background:#f0fdf4;' : ''}">
                <span style="width:28px;height:28px;border-radius:50%;background:#e2e8f0;color:#94a3b8;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">—</span>
                <span style="font-size:13px;color:#94a3b8;font-style:italic;">Geen verantwoordelijke</span>
                ${!currentId ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            </div>`;

        this.modal.teamMembers.forEach(member => {
            const memberId = member.user_id || member.id;
            const isSelected = currentId === memberId;
            const initialen = member.initialen || (member.naam || '?').substring(0, 2).toUpperCase();
            const kleur = member.avatar_kleur || '#667eea';
            const naam = member.naam || member.email || 'Onbekend';

            html += `
                <div class="assignee-option" data-member-id="${memberId}" 
                     style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;${isSelected ? 'background:#f0fdf4;' : ''}">
                    <span style="width:28px;height:28px;border-radius:50%;background:${kleur};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${initialen}</span>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:${isSelected ? '700' : '500'};color:#0f172a;">${naam}</div>
                    </div>
                    ${isSelected ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>`;
        });

        dropdown.innerHTML = html;

        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        dropdown.style.top = `${rect.bottom - modalRect.top + 4}px`;
        dropdown.style.left = `${rect.left - modalRect.left}px`;

        this.modal.modal.querySelector('.planning-modal-container').appendChild(dropdown);

        dropdown.querySelectorAll('.assignee-option').forEach(option => {
            option.addEventListener('click', async () => {
                await this._setChecklistVerantwoordelijke(itemId, option.dataset.memberId || null);
                dropdown.remove();
            });
        });

        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && !targetEl.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    async _setChecklistVerantwoordelijke(itemId, memberId) {
        const item = this.modal.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        const newIds = memberId ? [memberId] : [];

        try {
            await planningService.updateChecklistItem(itemId, {
                verantwoordelijke_data: newIds
            });

            item.verantwoordelijke_data = newIds;
            item.updated_at = new Date().toISOString();

            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Checklist assignee error:', error);
            PlanningHelpers.showAlert('Fout bij toewijzen: ' + error.message);
        }
    }

    // ============================================
    // ADD/EDIT/DELETE
    // ============================================
    
    async handleAddTaak() {
        const naam = PlanningHelpers.showPrompt('Taaknaam:');
        if (!naam?.trim()) return;

        const categorie = PlanningHelpers.showPrompt('Categorie:', 'Algemeen');

        try {
            const newTaak = await planningService.createPlanningTaak(this.modal.tender.id, {
                taak_naam: naam.trim(),
                categorie: categorie?.trim() || 'Algemeen',
                status: 'todo',
                volgorde: this.modal.planningTaken.length
            });

            this.modal.planningTaken.push(newTaak);
            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Add taak error:', error);
            PlanningHelpers.showAlert('Fout bij toevoegen: ' + error.message);
        }
    }

    async handleAddChecklistItem(section = null) {
        const naam = PlanningHelpers.showPrompt('Item naam:');
        if (!naam?.trim()) return;

        const sectie = section || PlanningHelpers.showPrompt('Categorie:', 'Documenten');
        const isVerplicht = PlanningHelpers.showConfirm('Is dit item verplicht?');

        try {
            const newItem = await planningService.createChecklistItem(this.modal.tender.id, {
                taak_naam: naam.trim(),
                sectie: sectie?.trim() || 'Documenten',
                is_verplicht: isVerplicht,
                status: 'pending',
                volgorde: this.modal.checklistItems.length
            });

            this.modal.checklistItems.push(newItem);
            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            console.error('❌ Add checklist item error:', error);
            PlanningHelpers.showAlert('Fout bij toevoegen: ' + error.message);
        }
    }

    handleTaakMenu(taakId) {
        const taak = this.modal.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        const action = PlanningHelpers.showPrompt(
            `"${taak.taak_naam}"\n\n1 = Bewerken\n2 = Verwijderen\n3 = Annuleren`,
            '3'
        );

        if (action === '1') this._editTaak(taak);
        else if (action === '2') this._deleteTaak(taak);
    }

    handleChecklistMenu(itemId) {
        const item = this.modal.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        const action = PlanningHelpers.showPrompt(
            `"${item.taak_naam}"\n\n1 = Bewerken\n2 = Verwijderen\n3 = Annuleren`,
            '3'
        );

        if (action === '1') this._editChecklistItem(item);
        else if (action === '2') this._deleteChecklistItem(item);
    }

    async _editTaak(taak) {
        const naam = PlanningHelpers.showPrompt('Taaknaam:', taak.taak_naam);
        if (naam === null) return;

        try {
            await planningService.updatePlanningTaak(taak.id, { taak_naam: naam.trim() });
            taak.taak_naam = naam.trim();
            this.modal.refresh();
        } catch (error) {
            PlanningHelpers.showAlert('Fout: ' + error.message);
        }
    }

    async _deleteTaak(taak) {
        if (!PlanningHelpers.showConfirm(`"${taak.taak_naam}" verwijderen?`)) return;

        try {
            await planningService.deletePlanningTaak(taak.id);
            this.modal.planningTaken = this.modal.planningTaken.filter(t => t.id !== taak.id);
            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            PlanningHelpers.showAlert('Fout: ' + error.message);
        }
    }

    async _editChecklistItem(item) {
        const naam = PlanningHelpers.showPrompt('Item naam:', item.taak_naam);
        if (naam === null) return;

        try {
            await planningService.updateChecklistItem(item.id, { taak_naam: naam.trim() });
            item.taak_naam = naam.trim();
            this.modal.refresh();
        } catch (error) {
            PlanningHelpers.showAlert('Fout: ' + error.message);
        }
    }

    async _deleteChecklistItem(item) {
        if (!PlanningHelpers.showConfirm(`"${item.taak_naam}" verwijderen?`)) return;

        try {
            await planningService.deleteChecklistItem(item.id);
            this.modal.checklistItems = this.modal.checklistItems.filter(i => i.id !== item.id);
            this.modal.refresh();
            this.modal.notifyUpdate();
        } catch (error) {
            PlanningHelpers.showAlert('Fout: ' + error.message);
        }
    }

    // ============================================
    // TEMPLATE LOADING
    // ============================================
    
    async handleLoadTemplate(scope) {
        const tenderId = this.modal.tender?.id;
        if (!tenderId) return;

        const hasPlanning = this.modal.planningTaken.length > 0;
        const hasChecklist = this.modal.checklistItems.length > 0;
        const hasExisting = (scope === 'planning' && hasPlanning) || (scope === 'checklist' && hasChecklist);

        if (hasExisting) {
            const scopeLabel = scope === 'planning' ? 'projectplanning taken' : 'checklist items';
            const ok = PlanningHelpers.showConfirm(
                `Er zijn al ${scopeLabel}.\n\nVervangen door standaard template?\n\n⚠️ Bestaande items worden verwijderd.`
            );
            if (!ok) return;
        }

        this.modal.renderer.showLoading();

        try {
            const result = await planningService.populateFromTemplates(tenderId, 'Standaard', hasExisting);

            if (result.skipped) {
                PlanningHelpers.showAlert(result.message || 'Template niet geladen.');
                this.modal.refresh();
                return;
            }

            await this.modal.loadData();
            console.log('✅ Template toegepast');
        } catch (error) {
            console.error('❌ Template error:', error);
            PlanningHelpers.showAlert('Fout bij laden template: ' + error.message);
            this.modal.refresh();
        }
    }
}