/**
 * TenderCard Component
 * TenderZen v2.0
 * 
 * CHANGELOG:
 * - Emoji's vervangen door SVG iconen
 * - Inline styles vervangen door CSS classes
 * - Verbeterde toggle functionaliteit
 * - Icon helpers geïntegreerd
 * 
 * VEREIST: icons.js moet geladen zijn VOOR dit bestand
 */

import { PhaseBadge } from './PhaseBadge.js';
import { TeamSection } from './TeamSection.js';
import { StatusSelect } from './StatusSelect.js';
import { TimelineSection } from './TimelineSection.js';

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

export class TenderCard {
    constructor(tenderData, options = {}) {
        this.data = tenderData;
        this.isCollapsed = false;
        this.options = {
            showToggle: true,
            showLeads: true,
            showWorkload: true,
            showDeadline: true,
            ...options
        };
        
        // Callbacks
        this.onStatusChange = null;
        this.onLeadsClick = null;
        this.onCardClick = null;
    }

    /**
     * Create toggle button with icon
     */
    createToggleButton() {
        const btn = document.createElement('button');
        btn.className = 'toggle-btn';
        btn.innerHTML = Icons.chevronUp({ size: 16 });
        btn.setAttribute('aria-label', 'Toggle card');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleCollapse(btn);
        });

        return btn;
    }

    /**
     * Toggle collapse state
     */
    toggleCollapse(button) {
        this.isCollapsed = !this.isCollapsed;
        button.innerHTML = this.isCollapsed 
            ? Icons.chevronDown({ size: 16 }) 
            : Icons.chevronUp({ size: 16 });
        
        const card = button.closest('.tender-row');
        if (card) {
            card.classList.toggle('collapsed', this.isCollapsed);
        }
    }

    /**
     * Calculate days until deadline
     */
    calculateDaysUntil(dateString) {
        if (!dateString) return null;
        
        const deadlineDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    /**
     * Get urgency level for styling
     */
    getUrgencyLevel(daysUntil) {
        if (daysUntil === null) return 'none';
        if (daysUntil < 0) return 'past';
        if (daysUntil <= 3) return 'urgent';
        if (daysUntil <= 7) return 'soon';
        return 'ok';
    }

    /**
     * Format days until text
     */
    formatDaysUntil(daysUntil) {
        if (daysUntil === null) return 'Geen deadline';
        if (daysUntil < 0) return `${Math.abs(daysUntil)} dagen geleden`;
        if (daysUntil === 0) return 'Vandaag!';
        if (daysUntil === 1) return '1 dag';
        return `${daysUntil} dagen`;
    }

    /**
     * Create aanbesteding section
     */
    createAanbestedingSection() {
        const section = document.createElement('div');
        section.className = 'section-aanbesteding';

        // Toggle button
        if (this.options.showToggle) {
            section.appendChild(this.createToggleButton());
        }

        // Main content wrapper
        const mainContent = document.createElement('div');
        mainContent.className = 'card-main-content';

        // Title row with phase badge
        const titleRow = document.createElement('div');
        titleRow.className = 'card-title-row';

        const phaseBadge = new PhaseBadge(this.data.phase);
        titleRow.appendChild(phaseBadge.render());

        const titleSpan = document.createElement('span');
        titleSpan.className = 'tender-name';
        titleSpan.textContent = this.data.title;
        titleRow.appendChild(titleSpan);

        mainContent.appendChild(titleRow);

        // Collapsible content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'card-content';

        // Client info
        if (this.data.client || this.data.subtitle) {
            const clientDiv = document.createElement('div');
            clientDiv.className = 'card-client';
            clientDiv.innerHTML = `
                <span class="client-icon">${Icons.building({ size: 14 })}</span>
                <span class="client-name">${this.data.client || this.data.subtitle}</span>
            `;
            contentDiv.appendChild(clientDiv);
        }

        // Type badge
        if (this.data.type) {
            const typeDiv = document.createElement('span');
            typeDiv.className = 'card-type';
            typeDiv.innerHTML = `
                <span class="type-icon">${Icons.fileText({ size: 12 })}</span>
                ${this.data.type}
            `;
            contentDiv.appendChild(typeDiv);
        }

        // Leads button (for acquisitie phase)
        if (this.options.showLeads && this.data.phase === 'acquisitie' && this.data.leadsCount) {
            const leadsBtn = document.createElement('button');
            leadsBtn.className = 'leads-btn';
            leadsBtn.innerHTML = `
                <span class="btn-icon">${Icons.briefcase({ size: 16 })}</span>
                Leads beheren
                <span class="leads-count">${this.data.leadsCount}</span>
            `;

            leadsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.onLeadsClick) {
                    this.onLeadsClick(this.data);
                }
            });

            contentDiv.appendChild(leadsBtn);
        }

        // Workload block
        if (this.options.showWorkload && this.data.workloadEstimate !== undefined) {
            const workloadDiv = document.createElement('div');
            workloadDiv.className = 'workload-block';
            workloadDiv.innerHTML = `
                <span class="workload-icon">${Icons.clock({ size: 16 })}</span>
                <span class="workload-label">Workload:</span>
                <input type="number" 
                       value="${this.data.workloadEstimate}" 
                       min="0" 
                       step="10"
                       class="workload-input">
                <span class="workload-unit">uur</span>
            `;

            // Handle input change
            const input = workloadDiv.querySelector('input');
            input.addEventListener('change', (e) => {
                this.data.workloadEstimate = parseInt(e.target.value) || 0;
            });
            input.addEventListener('click', (e) => e.stopPropagation());

            contentDiv.appendChild(workloadDiv);
        }

        mainContent.appendChild(contentDiv);
        section.appendChild(mainContent);

        // Deadline block (always visible, even when collapsed)
        if (this.options.showDeadline && this.data.mainDeadline) {
            const daysUntil = this.calculateDaysUntil(this.data.mainDeadline.date);
            const urgency = this.getUrgencyLevel(daysUntil);
            const isUrgent = urgency === 'urgent' || urgency === 'past';

            const deadlineBlock = document.createElement('div');
            deadlineBlock.className = `deadline-block ${isUrgent ? 'urgent' : ''}`;

            const icon = isUrgent 
                ? Icons.alertCircle({ size: 16 }) 
                : Icons.calendarView({ size: 16 });

            deadlineBlock.innerHTML = `
                <span class="deadline-icon">${icon}</span>
                <span class="deadline-label">Deadline:</span>
                <span class="deadline-value">${this.formatDaysUntil(daysUntil)}</span>
            `;

            section.appendChild(deadlineBlock);
        }

        return section;
    }

    /**
     * Render the complete card
     */
    render() {
        const card = document.createElement('div');
        card.className = `tender-row phase-${this.data.phase}`;
        card.dataset.tenderId = this.data.id;

        // Card click handler
        card.addEventListener('click', () => {
            if (this.onCardClick) {
                this.onCardClick(this.data);
            }
        });

        // Aanbesteding sectie
        card.appendChild(this.createAanbestedingSection());

        // Team sectie
        const teamSection = new TeamSection(this.data.team || []);
        card.appendChild(teamSection.render());

        // Status sectie
        const statusSelect = new StatusSelect(this.data.status, (newStatus) => {
            this.data.status = newStatus;
            if (this.onStatusChange) {
                this.onStatusChange(this.data.id, newStatus);
            }
        });
        card.appendChild(statusSelect.render());

        // Timeline sectie
        const timelineSection = new TimelineSection(this.data.deadlines || []);
        card.appendChild(timelineSection.render());

        return card;
    }

    /**
     * Render as HTML string (for template literals)
     */
    toHTML() {
        const element = this.render();
        return element.outerHTML;
    }

    // ============================================
    // STATIC HELPERS
    // ============================================

    /**
     * Create a card element
     */
    static create(tenderData, options = {}) {
        const card = new TenderCard(tenderData, options);
        return card.render();
    }

    /**
     * Create an empty state element
     */
    static createEmptyState(message = 'Geen tenders gevonden') {
        const empty = document.createElement('div');
        empty.className = 'tenders-empty';
        empty.innerHTML = `
            <div class="empty-icon">${Icons.clipboardList({ size: 48, color: '#94a3b8' })}</div>
            <div class="empty-title">${message}</div>
            <div class="empty-description">
                Maak een nieuwe tender aan of pas je filters aan om resultaten te zien.
            </div>
        `;
        return empty;
    }

    /**
     * Create a loading skeleton
     */
    static createSkeleton() {
        const skeleton = document.createElement('div');
        skeleton.className = 'tender-row loading';
        skeleton.innerHTML = `
            <div class="section-aanbesteding">
                <div class="skeleton" style="height: 24px; width: 60%; margin-bottom: 8px;"></div>
                <div class="skeleton" style="height: 16px; width: 40%; margin-bottom: 16px;"></div>
                <div class="skeleton" style="height: 40px; width: 100%;"></div>
            </div>
            <div class="section-team">
                <div class="skeleton" style="height: 28px; width: 100%; margin-bottom: 8px;"></div>
                <div class="skeleton" style="height: 28px; width: 100%;"></div>
            </div>
            <div class="section-status">
                <div class="skeleton" style="height: 40px; width: 100%;"></div>
            </div>
            <div class="section-timeline">
                <div class="timeline-cell">
                    <div class="skeleton" style="height: 60px; width: 80%;"></div>
                </div>
                <div class="timeline-cell">
                    <div class="skeleton" style="height: 60px; width: 80%;"></div>
                </div>
            </div>
        `;
        return skeleton;
    }
}

export default TenderCard;