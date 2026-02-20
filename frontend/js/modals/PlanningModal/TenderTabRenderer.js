/**
 * TenderTabRenderer.js - Tender Planning Tab
 * Frontend/js/modals/PlanningModal/TenderTabRenderer.js
 * 
 * Rendert tenderplanning tab met mijlpalen uit tender object
 * Read-only view van aanbestedende dienst planning
 */

import { PlanningHelpers } from './PlanningHelpers.js';

export class TenderTabRenderer {
    constructor(modal) {
        this.modal = modal;
    }

    // ============================================
    // MAIN RENDER
    // ============================================
    
    render() {
        const milestones = this.modal.tenderMilestones;
        const passedCount = milestones.filter(m => m.isPassed).length;

        return `
            ${this._renderToolbar(passedCount, milestones.length)}
            <div class="tp-list">
                ${milestones.length > 0 ? PlanningHelpers.renderColumnHeaders('tender') : ''}
                ${milestones.length === 0 ? PlanningHelpers.renderEmptyState('tender') : ''}
                ${milestones.map((m, i) => this._renderMilestoneWithMarker(m)).join('')}
            </div>
        `;
    }

    // ============================================
    // TOOLBAR
    // ============================================
    
    _renderToolbar(passed, total) {
        const percentage = total > 0 ? Math.round((passed / total) * 100) : 0;
        
        return `
            <div class="planning-toolbar" style="justify-content: flex-end;">
                <div class="planning-progress-inline">
                    <div class="planning-progress-track">
                        <div class="planning-progress-fill" style="width: ${percentage}%; background: linear-gradient(90deg, #3b82f6, #60a5fa);"></div>
                    </div>
                    <span class="planning-progress-label">${passed} van ${total} gepasseerd</span>
                </div>
            </div>
        `;
    }

    // ============================================
    // MILESTONE RENDERING
    // ============================================
    
    _renderMilestoneWithMarker(milestone) {
        // Add "eerst volgende" marker before next milestone
        const marker = milestone.isNext ? `
            <div class="tp-next-marker">
                <span class="tp-next-marker-label">▾ Eerst volgende</span>
                <span class="tp-next-marker-line"></span>
            </div>
        ` : '';
        
        return marker + this._renderMilestone(milestone);
    }

    _renderMilestone(milestone) {
        const d = milestone.date;
        const datumStr = d.toLocaleDateString('nl-NL', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
        const weekday = PlanningHelpers.getWeekday(d);
        
        // Check if time is set (not midnight)
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
        const timeStr = hasTime ? d.toLocaleTimeString('nl-NL', { 
            hour: '2-digit', 
            minute: '2-digit' 
        }) : '';

        const iconSvg = PlanningHelpers.getMilestoneIconSVG(milestone.iconName);
        const statusHtml = this._renderStatus(milestone);
        
        const rowClasses = [
            'tp-item',
            milestone.isPassed ? 'tp-item--passed' : '',
            milestone.isNext ? 'tp-item--next' : '',
            milestone.isDeadline && !milestone.isPassed ? 'tp-item--deadline' : ''
        ].filter(Boolean).join(' ');

        return `
            <div class="${rowClasses}">
                <div class="tp-icon tp-icon--${milestone.iconType}">
                    ${iconSvg}
                </div>
                <div class="tp-content">
                    <div class="tp-label${milestone.isDeadline && !milestone.isPassed ? ' tp-label--deadline' : ''}">${milestone.label}</div>
                    <div class="tp-sublabel">${milestone.sublabel}</div>
                </div>
                <div class="tp-date">
                    <div class="tp-date-main${milestone.isDeadline && !milestone.isPassed ? ' tp-date--deadline' : ''}">${datumStr} <span class="tp-weekday">(${weekday})</span></div>
                    ${timeStr ? `<div class="tp-date-time">${timeStr}</div>` : ''}
                </div>
                ${statusHtml}
            </div>
        `;
    }

    _renderStatus(milestone) {
        if (milestone.isPassed) {
            return '<span class="tp-status tp-status--passed">Gepasseerd</span>';
        }
        if (milestone.isNext) {
            return '<span class="tp-status tp-status--next">Eerstvolgende</span>';
        }
        if (milestone.isDeadline) {
            return '<span class="tp-status tp-status--deadline">Deadline</span>';
        }
        return '<span class="tp-status tp-status--upcoming">Gepland</span>';
    }
}