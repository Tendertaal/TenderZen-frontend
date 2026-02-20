/**
 * PlanningTabRenderer.js - Planning Tab
 * Frontend/js/modals/PlanningModal/PlanningTabRenderer.js
 * 
 * Rendert projectplanning tab met taken gegroepeerd per categorie
 * Ondersteunt user assignment via UserResolutionHelper
 */

import { planningService } from '../../services/PlanningService.js';
import { getUserResolver } from '../../utils/UserResolutionHelper.js';
import { PlanningHelpers } from './PlanningHelpers.js';

export class PlanningTabRenderer {
    constructor(modal) {
        this.modal = modal;
    }

    // ============================================
    // MAIN RENDER
    // ============================================
    
    render() {
        const progress = planningService.calculateProgress(
            this.modal.planningTaken, 
            'done'
        );
        
        const grouped = planningService.groupByCategorie(
            this.modal.planningTaken, 
            'categorie'
        );
        
        const categories = Object.keys(grouped);
        const hasTaken = categories.length > 0;

        return `
            ${this._renderToolbar(progress)}
            <div class="planning-task-list">
                ${hasTaken ? PlanningHelpers.renderColumnHeaders('planning') : ''}
                ${!hasTaken ? PlanningHelpers.renderEmptyState('planning') : ''}
                ${categories.map(cat => this._renderCategory(cat, grouped[cat])).join('')}
                ${this._renderAddButton()}
            </div>
        `;
    }

    // ============================================
    // TOOLBAR
    // ============================================
    
    _renderToolbar(progress) {
        return `
            <div class="planning-toolbar">
                <div class="planning-toolbar-left" style="display:flex;align-items:center;gap:8px;">
                    <button class="planning-toolbar-btn" id="btn-load-template-planning" 
                            style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#475569;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;"
                            title="Standaard taken laden vanuit bureau-template">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Template laden
                    </button>
                </div>
                <div class="planning-toolbar-right" style="margin-left:auto;">
                    <div class="planning-progress-inline">
                        <div class="planning-progress-track">
                            <div class="planning-progress-fill" style="width: ${progress.percentage}%"></div>
                        </div>
                        <span class="planning-progress-label">${progress.done} van ${progress.total} afgerond</span>
                    </div>
                </div>
            </div>
        `;
    }

    // ============================================
    // CATEGORY RENDERING
    // ============================================
    
    _renderCategory(categoryName, tasks) {
        const doneCount = tasks.filter(t => t.status === 'done').length;
        const statusColor = PlanningHelpers.getCategoryColor(doneCount, tasks.length);

        return `
            <div class="planning-category">
                <div class="planning-cat-header">
                    <span class="planning-cat-dot" style="background: ${statusColor}"></span>
                    <span class="planning-cat-label">${categoryName}</span>
                    <span class="planning-cat-count">${doneCount}/${tasks.length} taken</span>
                </div>
                ${tasks.map(task => this._renderTask(task)).join('')}
            </div>
        `;
    }

    // ============================================
    // TASK RENDERING
    // ============================================
    
    _renderTask(task) {
        const isDone = task.status === 'done';
        const isActive = task.status === 'active';
        const isMilestone = task.is_milestone;

        // OPTIE A: toegewezen_aan is array van user IDs
        const assigneeIds = Array.isArray(task.toegewezen_aan) ? task.toegewezen_aan : [];
        const assigneeHTML = this._renderAssignees(assigneeIds);
        const assigneeZone = `
            <div class="planning-task-assignees" data-action="assign-person" data-taak-id="${task.id}" 
                 style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;" 
                 title="Klik om teamlid toe te wijzen">
                ${assigneeHTML}
            </div>`;

        // Datum zone
        const datumZone = this._renderDate(task, isDone, isActive);

        // Status
        const statusConfig = PlanningHelpers.getStatusConfig(task.status, 'planning');
        
        // Row styling
        const rowBg = isActive ? 'planning-task-row--active' :
            isMilestone ? 'planning-task-row--milestone' : '';

        return `
            <div class="planning-task-row ${rowBg}" data-taak-id="${task.id}">
                <div class="planning-task-check ${isDone ? 'done' : isActive ? 'active' : ''}" 
                     data-action="toggle-taak" data-taak-id="${task.id}" data-status="${task.status}">
                    ${isDone ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>
                <span class="planning-task-name ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}">
                    ${isMilestone ? '🚩 ' : ''}${task.taak_naam}
                </span>
                ${assigneeZone}
                ${datumZone}
                <span class="planning-task-status ${statusConfig.class}">${statusConfig.label}</span>
                <button class="planning-task-menu" data-action="taak-menu" data-taak-id="${task.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                </button>
            </div>
        `;
    }

    _renderAssignees(userIds) {
        if (userIds.length === 0) {
            return `
                <span style="display:inline-flex;align-items:center;gap:4px;color:#94a3b8;font-size:12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                    <span>Toewijzen</span>
                </span>
            `;
        }

        const resolver = getUserResolver();
        
        if (userIds.length === 1) {
            const userId = userIds[0];
            const naam = resolver.getUserName(userId);
            const initialen = resolver.getUserInitials(userId);
            const kleur = resolver.getUserColor(userId);
            
            return `
                <span class="planning-assignee-pill" title="${naam}">
                    <span class="planning-assignee-dot" style="background: ${kleur}">${initialen}</span>
                    <span>${naam.split(' ')[0]}</span>
                </span>
            `;
        }

        // Multiple users - use avatar stack
        return resolver.renderAvatarStack(userIds, 2);
    }

    _renderDate(task, isDone, isActive) {
        if (!task.datum) {
            return `
                <span class="planning-task-date" data-action="set-date" data-taak-id="${task.id}" 
                      style="cursor:pointer;color:#cbd5e1;font-size:12px;" title="Klik om datum in te stellen">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Datum
                </span>
            `;
        }

        const datumStr = PlanningHelpers.formatDate(task.datum, 'short');
        const datumClass = isDone ? 'done' : isActive ? 'highlight' : '';
        
        return `
            <span class="planning-task-date ${datumClass}" data-action="set-date" data-taak-id="${task.id}" 
                  style="cursor:pointer;" title="Klik om datum te wijzigen">
                ${datumStr}
            </span>
        `;
    }

    // ============================================
    // ADD BUTTON
    // ============================================
    
    _renderAddButton() {
        return `
            <div class="planning-add-row" id="add-taak-bottom">
                ${PlanningHelpers.getIcon('plus', 16)}
                <span>Taak toevoegen…</span>
            </div>
        `;
    }
}