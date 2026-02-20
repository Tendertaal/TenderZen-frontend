/**
 * ChecklistTabRenderer.js - Checklist Tab
 * Frontend/js/modals/PlanningModal/ChecklistTabRenderer.js
 * 
 * Rendert indieningschecklist tab met items gegroepeerd per sectie
 * Ondersteunt verantwoordelijke assignment via UserResolutionHelper
 */

import { planningService } from '../../services/PlanningService.js';
import { getUserResolver } from '../../utils/UserResolutionHelper.js';
import { PlanningHelpers } from './PlanningHelpers.js';

export class ChecklistTabRenderer {
    constructor(modal) {
        this.modal = modal;
    }

    // ============================================
    // MAIN RENDER
    // ============================================
    
    render() {
        const progress = planningService.calculateProgress(
            this.modal.checklistItems, 
            'completed'
        );
        
        const grouped = planningService.groupByCategorie(
            this.modal.checklistItems, 
            'sectie'
        );
        
        const sections = Object.keys(grouped);

        return `
            ${this._renderToolbar(progress)}
            <div class="checklist-items-list">
                ${sections.length > 0 ? PlanningHelpers.renderColumnHeaders('checklist') : ''}
                ${sections.length === 0 ? PlanningHelpers.renderEmptyState('checklist') : ''}
                ${sections.map(sec => this._renderSection(sec, grouped[sec])).join('')}
            </div>
        `;
    }

    // ============================================
    // TOOLBAR
    // ============================================
    
    _renderToolbar(progress) {
        return `
            <div class="planning-toolbar">
                <div class="planning-toolbar-left">
                    ${this._renderProgressRing(progress)}
                    <div class="checklist-progress-text">
                        <span class="checklist-progress-number">${progress.done} van ${progress.total} compleet</span>
                        <span class="checklist-progress-sub">${progress.percentage}% afgerond</span>
                    </div>
                </div>
                <div class="planning-toolbar-right" style="display:flex;align-items:center;gap:8px;">
                    <button class="planning-toolbar-btn" id="btn-load-template-checklist" 
                            style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#475569;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;"
                            title="Standaard checklist laden vanuit bureau-template">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Template laden
                    </button>
                    <button class="btn-planning-add btn-planning-add--green" id="btn-add-checklist">
                        ${PlanningHelpers.getIcon('plus', 14)}
                        <span>Item toevoegen</span>
                    </button>
                </div>
            </div>
        `;
    }

    _renderProgressRing(progress) {
        const radius = 18;
        const circumference = 2 * Math.PI * radius;
        const dashOffset = circumference - (progress.percentage / 100) * circumference;

        return `
            <div class="checklist-progress-ring">
                <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle cx="22" cy="22" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="4" 
                            style="transform: rotate(-90deg); transform-origin: center;"/>
                    <circle cx="22" cy="22" r="${radius}" fill="none" stroke="#22c55e" stroke-width="4" 
                            stroke-linecap="round"
                            stroke-dasharray="${circumference}" 
                            stroke-dashoffset="${dashOffset}"
                            style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 0.4s ease;"/>
                </svg>
            </div>
        `;
    }

    // ============================================
    // SECTION RENDERING
    // ============================================
    
    _renderSection(sectionName, items) {
        const doneCount = items.filter(i => i.status === 'completed').length;
        const statusColor = PlanningHelpers.getCategoryColor(doneCount, items.length);

        return `
            <div class="planning-category">
                <div class="planning-cat-header">
                    <span class="planning-cat-dot" style="background: ${statusColor}"></span>
                    <span class="planning-cat-label">${sectionName}</span>
                    <span class="planning-cat-count">${doneCount}/${items.length} taken</span>
                </div>
                ${items.map(item => this._renderItem(item)).join('')}
                <div class="planning-add-row" data-action="add-checklist-in-section" data-section="${sectionName}">
                    ${PlanningHelpers.getIcon('plus', 16)}
                    <span>Item toevoegen aan ${sectionName}…</span>
                </div>
            </div>
        `;
    }

    // ============================================
    // ITEM RENDERING
    // ============================================
    
    _renderItem(item) {
        const isChecked = item.status === 'completed';

        // OPTIE A: verantwoordelijke_data is array van user IDs
        const verantwoordelijkeIds = Array.isArray(item.verantwoordelijke_data) ? item.verantwoordelijke_data : [];
        const assigneeZone = this._renderVerantwoordelijke(verantwoordelijkeIds, item.id);

        // Datum
        const datumZone = this._renderDeadline(item, isChecked);

        // Status
        const statusConfig = PlanningHelpers.getStatusConfig(item.status, 'checklist');

        // Verplicht indicator
        const verplichtIndicator = item.is_verplicht 
            ? '<span style="margin-left:6px;font-size:10px;font-weight:600;color:#ef4444;opacity:0.7;letter-spacing:0.3px;">VERPLICHT</span>' 
            : '';

        return `
            <div class="planning-task-row" data-item-id="${item.id}">
                <div class="planning-task-check ${isChecked ? 'done' : ''}" 
                     data-action="toggle-checklist" data-item-id="${item.id}" data-status="${item.status}">
                    ${isChecked ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>
                <span class="planning-task-name ${isChecked ? 'done' : ''}">
                    ${item.taak_naam}${verplichtIndicator}
                </span>
                ${assigneeZone}
                ${datumZone}
                <span class="planning-task-status ${statusConfig.class}">${statusConfig.label}</span>
                <button class="planning-task-menu" data-action="checklist-menu" data-item-id="${item.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                </button>
            </div>
        `;
    }

    _renderVerantwoordelijke(userIds, itemId) {
        if (userIds.length === 0) {
            return `
                <div class="planning-task-assignees" data-action="assign-checklist" data-item-id="${itemId}" 
                     style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;" 
                     title="Verantwoordelijke toewijzen">
                    <span style="display:inline-flex;align-items:center;gap:4px;color:#94a3b8;font-size:12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        <span>Toewijzen</span>
                    </span>
                </div>
            `;
        }

        const resolver = getUserResolver();
        const userId = userIds[0]; // Checklist heeft meestal 1 verantwoordelijke
        const naam = resolver.getUserName(userId);
        const initialen = resolver.getUserInitials(userId);
        const kleur = resolver.getUserColor(userId);
        
        return `
            <div class="planning-task-assignees" data-action="assign-checklist" data-item-id="${itemId}" 
                 style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;" 
                 title="${naam}">
                <span class="planning-assignee-pill">
                    <span class="planning-assignee-dot" style="background: ${kleur}">${initialen}</span>
                    <span>${naam.split(' ')[0]}</span>
                </span>
            </div>
        `;
    }

    _renderDeadline(item, isChecked) {
        if (!item.deadline) {
            return `
                <span class="planning-task-date" data-action="set-checklist-date" data-item-id="${item.id}" 
                      style="cursor:pointer;color:#cbd5e1;font-size:12px;" title="Deadline instellen">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Datum
                </span>
            `;
        }

        const datumStr = PlanningHelpers.formatDate(item.deadline, 'short');
        const datumClass = isChecked ? 'done' : '';
        
        return `
            <span class="planning-task-date ${datumClass}" data-action="set-checklist-date" data-item-id="${item.id}" 
                  style="cursor:pointer;" title="Datum wijzigen">
                ${datumStr}
            </span>
        `;
    }
}