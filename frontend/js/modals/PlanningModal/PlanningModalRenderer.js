/**
 * PlanningModalRenderer.js - Modal Layout & Rendering
 * Frontend/js/modals/PlanningModal/PlanningModalRenderer.js
 * 
 * Beheert modal HTML structuur, layout en coördineert tab renderers
 */

import { PlanningTabRenderer } from './PlanningTabRenderer.js';
import { TenderTabRenderer } from './TenderTabRenderer.js';
import { ChecklistTabRenderer } from './ChecklistTabRenderer.js';
import { PlanningHelpers } from './PlanningHelpers.js';

export class PlanningModalRenderer {
    constructor(modal) {
        this.modal = modal; // Reference to main PlanningModal
        
        // Tab renderers
        this.planningTab = new PlanningTabRenderer(modal);
        this.tenderTab = new TenderTabRenderer(modal);
        this.checklistTab = new ChecklistTabRenderer(modal);
    }

    // ============================================
    // MODAL CREATION
    // ============================================
    
    createModal() {
        const container = document.createElement('div');
        container.className = 'planning-modal';
        container.id = 'planning-modal';
        
        Object.assign(container.style, {
            display: 'none',
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            zIndex: '10000',
            alignItems: 'center',
            justifyContent: 'center'
        });

        container.innerHTML = this._generateModalHTML();
        return container;
    }

    _generateModalHTML() {
        const tender = this.modal.tender || {};
        const tenderNaam = tender.naam || 'Tender';
        const opdrachtgever = tender.opdrachtgever || '';
        const bureauNaam = tender.tenderbureau_naam || tender.tenderbureaus?.naam || '';

        const subtitle = [opdrachtgever, bureauNaam ? `Bureau: ${bureauNaam}` : '']
            .filter(Boolean).join(' · ');

        return `
            <div class="planning-modal-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(15,23,42,0.5) !important;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:0;"></div>
            <div class="modal-container planning-modal-container" style="position:relative;z-index:1;background:white;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.15),0 0 0 1px rgba(0,0,0,0.05);display:flex;flex-direction:column;max-height:85vh;overflow:hidden;max-width:960px;width:100%;margin:0 20px;">
                ${this._generateHeader(tenderNaam, subtitle)}
                ${this._generateTabs()}
                <div class="planning-modal-body" id="planning-modal-body" style="flex:1;overflow-y:auto;min-height:300px;">
                    <div class="planning-loading">Laden...</div>
                </div>
                ${this._generateFooter()}
            </div>
        `;
    }

    // ============================================
    // HEADER
    // ============================================
    
    _generateHeader(tenderNaam, subtitle) {
        return `
            <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:20px 28px 16px;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
                <div class="modal-header-content" style="display:flex;align-items:center;gap:14px;">
                    <span class="modal-icon planning-modal-icon" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:rgba(139,92,246,0.1);border-radius:11px;flex-shrink:0;">
                        ${PlanningHelpers.getIcon('calendar', 22, '#7c3aed')}
                    </span>
                    <div>
                        <h2 class="modal-title" style="font-size:17px;font-weight:700;color:#0f172a;margin:0;">${tenderNaam}</h2>
                        ${subtitle ? `<p class="planning-modal-subtitle" style="font-size:13px;color:#64748b;margin:2px 0 0 0;font-weight:400;">${subtitle}</p>` : ''}
                    </div>
                </div>
                <button class="modal-close" id="planning-modal-close" type="button" style="width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                    ${PlanningHelpers.getIcon('x', 20)}
                </button>
            </div>
        `;
    }

    // ============================================
    // TABS
    // ============================================
    
    _generateTabs() {
        const tabs = [
            { 
                id: 'planning', 
                label: 'Projectplanning', 
                icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
                activeColor: '#7c3aed',
                badgeBg: '#ede9fe',
                badgeColor: '#6d28d9'
            },
            { 
                id: 'tender', 
                label: 'Tenderplanning', 
                icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 9h1"/><path d="M14 9h1"/><path d="M9 13h1"/><path d="M14 13h1"/></svg>',
                activeColor: '#2563eb',
                badgeBg: '#dbeafe',
                badgeColor: '#1d4ed8'
            },
            { 
                id: 'checklist', 
                label: 'Indieningschecklist', 
                icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
                activeColor: '#16a34a',
                badgeBg: '#dcfce7',
                badgeColor: '#15803d'
            }
        ];

        return `
            <div class="planning-modal-tabs" style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;background:#f8fafc;flex-shrink:0;padding:0;">
                ${tabs.map(tab => this._generateTab(tab)).join('')}
            </div>
        `;
    }

    _generateTab(tab) {
        const isActive = this.modal.activeTab === tab.id;
        
        return `
            <button class="planning-tab ${isActive ? 'active' : ''}" 
                    data-tab="${tab.id}"
                    style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 20px;font-size:14px;font-weight:600;color:${isActive ? tab.activeColor : '#94a3b8'};cursor:pointer;border:none;border-bottom:3px solid ${isActive ? tab.activeColor : 'transparent'};margin-bottom:-2px;transition:all 0.15s;background:${isActive ? 'white' : 'transparent'};font-family:inherit;">
                <span class="planning-tab-icon" style="width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${isActive ? tab.activeColor : '#e2e8f0'};color:${isActive ? 'white' : '#94a3b8'};flex-shrink:0;">
                    ${tab.icon}
                </span>
                <span>${tab.label}</span>
                <span id="tab-badge-${tab.id}" style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:10px;background:${isActive ? tab.badgeBg : '#f1f5f9'};color:${isActive ? tab.badgeColor : '#94a3b8'};">0</span>
            </button>
        `;
    }

    // ============================================
    // FOOTER
    // ============================================
    
    _generateFooter() {
        return `
            <div class="modal-footer" style="display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0;border-radius:0 0 16px 16px;">
                <div class="modal-footer-left">
                    <span class="planning-footer-info" id="planning-footer-info" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;">
                        ${PlanningHelpers.getIcon('clock', 14)}
                        <span>Laatst bijgewerkt: —</span>
                    </span>
                </div>
                <div class="modal-footer-right">
                    <button type="button" class="btn btn-secondary" id="planning-btn-close" style="padding:8px 20px;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#475569;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                        Sluiten
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // CONTENT RENDERING
    // ============================================
    
    renderActiveTab() {
        const body = this.modal.modal?.querySelector('#planning-modal-body');
        if (!body) return;

        let content;
        switch (this.modal.activeTab) {
            case 'planning':
                content = this.planningTab.render();
                break;
            case 'tender':
                content = this.tenderTab.render();
                break;
            case 'checklist':
                content = this.checklistTab.render();
                break;
            default:
                content = '<div class="planning-loading">Onbekende tab</div>';
        }

        body.innerHTML = content;
    }

    // ============================================
    // BADGE UPDATES
    // ============================================
    
    updateBadges() {
        const planBadge = this.modal.modal?.querySelector('#tab-badge-planning');
        const tenderBadge = this.modal.modal?.querySelector('#tab-badge-tender');
        const clBadge = this.modal.modal?.querySelector('#tab-badge-checklist');

        if (planBadge) {
            planBadge.textContent = this.modal.planningTaken.length;
        }
        if (tenderBadge) {
            tenderBadge.textContent = this.modal.tenderMilestones.length;
        }
        if (clBadge) {
            const done = this.modal.checklistItems.filter(i => i.status === 'completed').length;
            clBadge.textContent = `${done}/${this.modal.checklistItems.length}`;
        }
    }

    // ============================================
    // TAB STYLING
    // ============================================
    
    updateTabStyles(activeTab) {
        const colorMap = {
            planning: { active: '#7c3aed', badgeBg: '#ede9fe', badgeColor: '#6d28d9' },
            tender:   { active: '#2563eb', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
            checklist:{ active: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#15803d' }
        };
        
        this.modal.modal.querySelectorAll('.planning-tab').forEach(tab => {
            const type = tab.dataset.tab;
            const isActive = type === activeTab;
            const colors = colorMap[type];
            
            tab.classList.toggle('active', isActive);
            tab.style.color = isActive ? colors.active : '#94a3b8';
            tab.style.borderBottomColor = isActive ? colors.active : 'transparent';
            tab.style.background = isActive ? 'white' : 'transparent';
            
            const circle = tab.querySelector('.planning-tab-icon');
            if (circle) {
                circle.style.background = isActive ? colors.active : '#e2e8f0';
                circle.style.color = isActive ? 'white' : '#94a3b8';
            }
            
            const badge = tab.querySelector('[id^="tab-badge"]');
            if (badge) {
                badge.style.background = isActive ? colors.badgeBg : '#f1f5f9';
                badge.style.color = isActive ? colors.badgeColor : '#94a3b8';
            }
        });
    }

    // ============================================
    // FOOTER UPDATES
    // ============================================
    
    updateFooter() {
        const info = this.modal.modal?.querySelector('#planning-footer-info span');
        if (!info) return;

        const allItems = [...this.modal.planningTaken, ...this.modal.checklistItems];
        if (allItems.length === 0) {
            info.textContent = 'Nog geen items';
            return;
        }

        const latest = allItems.reduce((max, item) => {
            const d = new Date(item.updated_at || item.created_at);
            return d > max ? d : max;
        }, new Date(0));

        info.textContent = PlanningHelpers.timeAgo(latest);
    }

    // ============================================
    // LOADING STATES
    // ============================================
    
    showLoading() {
        const body = this.modal.modal?.querySelector('#planning-modal-body');
        if (body) {
            body.innerHTML = `
                <div class="planning-loading">
                    <div class="planning-spinner"></div>
                    <span>Planning laden...</span>
                </div>
            `;
        }
    }

    showError(error) {
        const body = this.modal.modal?.querySelector('#planning-modal-body');
        if (body) {
            body.innerHTML = `
                <div class="planning-error">
                    <div class="planning-error-icon">⚠️</div>
                    <h3>Fout bij laden</h3>
                    <p>${error.message || 'Er ging iets mis'}</p>
                </div>
            `;
        }
    }
}