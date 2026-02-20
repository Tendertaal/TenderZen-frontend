/**
 * PlanningHelpers.js - Shared Utilities
 * Frontend/js/modals/PlanningModal/PlanningHelpers.js
 * 
 * Gedeelde helper functies voor alle PlanningModal modules
 * Bevat: Icon rendering, datum formatting, HTML generators
 */

const Icons = window.Icons || {};

export class PlanningHelpers {
    // ============================================
    // ICON UTILITIES
    // ============================================
    
    static getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    // ============================================
    // DATE FORMATTING
    // ============================================
    
    static formatDate(dateStr, format = 'short') {
        if (!dateStr) return '';
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        
        if (format === 'short') {
            return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
        }
        if (format === 'long') {
            return d.toLocaleDateString('nl-NL', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
            });
        }
        return d.toLocaleDateString('nl-NL');
    }

    static formatDateTime(dateStr) {
        if (!dateStr) return '';
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '';
        
        return d.toLocaleString('nl-NL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    static getWeekday(dateStr) {
        const d = new Date(dateStr);
        const weekdays = ['zo.', 'ma.', 'di.', 'wo.', 'do.', 'vr.', 'za.'];
        return weekdays[d.getDay()];
    }

    // ============================================
    // COLUMN HEADERS
    // ============================================
    
    static renderColumnHeaders(type) {
        if (type === 'tender') {
            return `
                <div class="planning-col-headers" style="
                    display:flex;align-items:center;gap:14px;
                    padding:6px 12px;border-bottom:2px solid #e2e8f0;margin:0 -4px 4px -4px;
                    font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
                    <span style="width:36px;flex-shrink:0;"></span>
                    <span style="flex:1;min-width:0;">Mijlpaal</span>
                    <span style="text-align:right;flex-shrink:0;min-width:140px;">Datum</span>
                    <span style="flex-shrink:0;min-width:90px;text-align:center;">Status</span>
                </div>
            `;
        }

        // Planning & Checklist
        return `
            <div class="planning-col-headers" style="
                display:grid;grid-template-columns:32px 1fr 200px 110px 72px 32px;align-items:center;gap:8px;
                padding:6px 4px;border-bottom:2px solid #e2e8f0;margin:0 -4px 4px -4px;
                font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">
                <span></span>
                <span>Taak</span>
                <span>Toegewezen aan</span>
                <span>Deadline</span>
                <span style="text-align:center;">Status</span>
                <span></span>
            </div>
        `;
    }

    // ============================================
    // USER RENDERING
    // ============================================
    
    static renderUserPill(userId, resolver) {
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

    // ============================================
    // PROGRESS CALCULATIONS
    // ============================================
    
    static calculateProgress(items, doneStatus) {
        const total = items.length;
        const done = items.filter(i => i.status === doneStatus).length;
        const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
        
        return { total, done, percentage };
    }

    // ============================================
    // STATUS RENDERING
    // ============================================
    
    static getStatusConfig(status, type = 'planning') {
        if (type === 'planning') {
            const map = {
                'done': { label: 'Klaar', class: 'status--done' },
                'active': { label: 'Actief', class: 'status--active' },
                'todo': { label: 'Te doen', class: 'status--todo' }
            };
            return map[status] || map.todo;
        }
        
        // Checklist
        const map = {
            'completed': { label: 'Compleet', class: 'status--done' },
            'pending': { label: 'Te doen', class: 'status--todo' }
        };
        return map[status] || map.pending;
    }

    // ============================================
    // CATEGORY GROUPING
    // ============================================
    
    static groupByCategory(items, categoryField = 'categorie') {
        const grouped = {};
        
        items.forEach(item => {
            const cat = item[categoryField] || 'Algemeen';
            if (!grouped[cat]) {
                grouped[cat] = [];
            }
            grouped[cat].push(item);
        });
        
        return grouped;
    }

    // ============================================
    // COLOR UTILITIES
    // ============================================
    
    static getCategoryColor(doneCount, totalCount) {
        if (doneCount === totalCount) return '#22c55e'; // Green
        if (doneCount > 0) return '#f97316'; // Orange
        return '#94a3b8'; // Gray
    }

    // ============================================
    // DIALOGS
    // ============================================
    
    static showConfirm(message) {
        return confirm(message);
    }

    static showPrompt(message, defaultValue = '') {
        return prompt(message, defaultValue);
    }

    static showAlert(message) {
        alert(message);
    }

    // ============================================
    // EMPTY STATE
    // ============================================
    
    static renderEmptyState(type, onButtonClick = null) {
        const config = {
            planning: {
                icon: this.getIcon('calendar', 40, '#cbd5e1'),
                title: 'Nog geen taken',
                description: 'Start met de standaard projectplanning of voeg handmatig taken toe.',
                buttonText: 'Standaard template laden',
                buttonId: 'btn-empty-template-planning',
                buttonColor: '#7c3aed'
            },
            tender: {
                icon: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>',
                title: 'Geen tenderplanning beschikbaar',
                description: 'Vul de timeline-data in bij de tendergegevens of gebruik Smart Import om ze automatisch te importeren.',
                buttonText: null,
                buttonId: null,
                buttonColor: null
            },
            checklist: {
                icon: this.getIcon('checkCircle', 40, '#cbd5e1'),
                title: 'Nog geen checklist items',
                description: 'Start met de standaard indieningschecklist of voeg handmatig items toe.',
                buttonText: 'Standaard checklist laden',
                buttonId: 'btn-empty-template-checklist',
                buttonColor: '#16a34a'
            }
        };

        const cfg = config[type];
        if (!cfg) return '';

        return `
            <div class="planning-empty">
                <div class="planning-empty-icon">${cfg.icon}</div>
                <h3>${cfg.title}</h3>
                <p>${cfg.description}</p>
                ${cfg.buttonText ? `
                    <button class="planning-empty-btn" id="${cfg.buttonId}" 
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:${cfg.buttonColor};color:white;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:12px;transition:all 0.15s;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        ${cfg.buttonText}
                    </button>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // TIME AGO
    // ============================================
    
    static timeAgo(dateStr) {
        if (!dateStr) return 'Nog geen items';
        
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return 'Nog geen items';
        
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);

        if (diffMin < 1) return 'Zojuist bijgewerkt';
        if (diffMin < 60) return `${diffMin} min. geleden bijgewerkt`;
        
        return `Bijgewerkt: ${d.toLocaleDateString('nl-NL')} om ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // ============================================
    // MILESTONE ICONS
    // ============================================
    
    static getMilestoneIconSVG(iconName) {
        const icons = {
            calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
            eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            checkCircle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        };
        
        return icons[iconName] || icons.clock;
    }
}