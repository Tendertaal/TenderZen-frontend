/**
 * PlanningModal - Modal met tabs: Projectplanning + Tenderplanning + Indieningschecklist
 * TenderZen v3.0
 * 
 * Pattern: Exact same als TeamlidModal & BedrijfModal
 * - modal-overlay + modal-container structuur
 * - Direct style.display control
 * - External CSS (PlanningModal.css)
 * 
 * v2.9: Tenderplanning tab toegevoegd — toont mijlpalen van aanbestedende dienst
 *       uit tender-object velden (publicatie_datum, nvi1_datum, deadline_indiening, etc.)
 *       Geen extra API calls nodig.
 * v3.0: Template laden functionaliteit — kopieer standaard bureau-templates naar tender
 *       "Template laden" knop in toolbar Projectplanning + Indieningschecklist
 *       Empty state met prominente CTA knop
 * 
 * INSTALLATIE:
 * 1. Kopieer naar Frontend/js/modals/PlanningModal.js
 * 2. Voeg CSS toe: <link rel="stylesheet" href="css/PlanningModal.css">
 * 3. Importeer in de view die het nodig heeft
 */

import { planningService } from '../services/PlanningService.js';

const Icons = window.Icons || {};

export class PlanningModal {
    constructor() {
        this.isOpen = false;
        this.modal = null;
        this.tender = null;
        this.activeTab = 'planning'; // 'planning' | 'tender' | 'checklist'

        // Data
        this.planningTaken = [];
        this.checklistItems = [];
        this.tenderMilestones = []; // Gebouwd uit tender-object
        this.teamMembers = [];      // Bureau teamleden voor toewijzing
        this.isLoading = false;

        // Active dropdowns/pickers
        this._activeDropdownTaakId = null;

        // Callback na wijzigingen
        this.onUpdate = null;
    }

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    // ============================================
    // OPEN / CLOSE
    // ============================================

    async open(tender, initialTab = 'planning') {
        console.log('📋 PlanningModal.open()', tender?.naam);

        this.tender = tender;
        this.activeTab = initialTab;

        this.render();

        if (!document.body.contains(this.modal)) {
            document.body.appendChild(this.modal);
        }

        this.modal.style.display = 'flex';
        this.isOpen = true;
        document.body.style.overflow = 'hidden';

        // Laad data
        await this.loadData();
    }

    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    }

    // ============================================
    // DATA LOADING
    // ============================================

    async loadData() {
        if (!this.tender?.id) return;

        this.isLoading = true;
        this.renderContent();

        try {
            const [taken, items] = await Promise.all([
                planningService.getPlanningTaken(this.tender.id),
                planningService.getChecklistItems(this.tender.id)
            ]);

            this.planningTaken = taken;
            this.checklistItems = items;
            this.tenderMilestones = this.buildTenderMilestones();
            console.log(`✅ Loaded: ${taken.length} taken, ${items.length} checklist items, ${this.tenderMilestones.length} milestones`);
        } catch (error) {
            console.error('❌ Error loading planning data:', error);
            this.planningTaken = [];
            this.checklistItems = [];
            this.tenderMilestones = this.buildTenderMilestones();
        }

        this.isLoading = false;
        this.renderContent();

        // Team members laden (async, na content render zodat modal snel opent)
        this._loadTeamMembers();
    }

    async _loadTeamMembers() {
        try {
            const supabase = window.supabaseClient;
            if (!supabase || !this.tender?.tenderbureau_id) return;

            const { data, error } = await supabase
                .from('team_members')
                .select('id, naam, email, initialen, avatar_kleur, rol, tenderbureau_id')
                .eq('tenderbureau_id', this.tender.tenderbureau_id)
                .eq('is_active', true)
                .order('naam');

            if (error) {
                console.warn('⚠️ Team members query error:', error.message);
                return;
            }

            this.teamMembers = data || [];
            console.log(`👥 Loaded ${this.teamMembers.length} team members voor bureau ${this.tender.tenderbureau_id}`);
        } catch (error) {
            console.warn('⚠️ Team members niet geladen:', error.message);
            this.teamMembers = [];
        }
    }

    // ============================================
    // RENDER — MAIN STRUCTURE
    // ============================================

    render() {
        // Verwijder oude modal als die er nog is
        const existing = document.getElementById('planning-modal');
        if (existing) existing.remove();

        this.modal = document.createElement('div');
        this.modal.className = 'planning-modal';
        this.modal.id = 'planning-modal';
        
        // ⭐ Critical inline styles — zorgt dat modal ALTIJD als overlay werkt
        Object.assign(this.modal.style, {
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

        const tenderNaam = this.tender?.naam || 'Tender';
        const opdrachtgever = this.tender?.opdrachtgever || '';
        const bureauNaam = this.tender?.tenderbureau_naam ||
            this.tender?.tenderbureaus?.naam || '';

        const subtitle = [opdrachtgever, bureauNaam ? `Bureau: ${bureauNaam}` : '']
            .filter(Boolean).join(' · ');

        this.modal.innerHTML = `
            <div class="planning-modal-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(15,23,42,0.5) !important;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:0;"></div>
            <div class="modal-container planning-modal-container" style="position:relative;z-index:1;background:white;border-radius:16px;box-shadow:0 25px 60px rgba(0,0,0,0.15),0 0 0 1px rgba(0,0,0,0.05);display:flex;flex-direction:column;max-height:85vh;overflow:hidden;max-width:960px;width:100%;margin:0 20px;">
                <!-- Header -->
                <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;padding:20px 28px 16px;border-bottom:1px solid #e2e8f0;flex-shrink:0;">
                    <div class="modal-header-content" style="display:flex;align-items:center;gap:14px;">
                        <span class="modal-icon planning-modal-icon" style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:rgba(139,92,246,0.1);border-radius:11px;flex-shrink:0;">
                            ${this.getIcon('calendar', 22, '#7c3aed')}
                        </span>
                        <div>
                            <h2 class="modal-title" style="font-size:17px;font-weight:700;color:#0f172a;margin:0;">${tenderNaam}</h2>
                            ${subtitle ? `<p class="planning-modal-subtitle" style="font-size:13px;color:#64748b;margin:2px 0 0 0;font-weight:400;">${subtitle}</p>` : ''}
                        </div>
                    </div>
                    <button class="modal-close" id="planning-modal-close" type="button" style="width:36px;height:36px;border-radius:10px;border:none;background:transparent;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        ${this.getIcon('x', 20)}
                    </button>
                </div>

                <!-- Tabs -->
                <div class="planning-modal-tabs" style="display:flex;gap:0;border-bottom:2px solid #e2e8f0;background:#f8fafc;flex-shrink:0;padding:0;">
                    <button class="planning-tab ${this.activeTab === 'planning' ? 'active' : ''}" 
                            data-tab="planning"
                            style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 20px;font-size:14px;font-weight:600;color:${this.activeTab === 'planning' ? '#7c3aed' : '#94a3b8'};cursor:pointer;border:none;border-bottom:3px solid ${this.activeTab === 'planning' ? '#7c3aed' : 'transparent'};margin-bottom:-2px;transition:all 0.15s;background:${this.activeTab === 'planning' ? 'white' : 'transparent'};font-family:inherit;">
                        <span class="planning-tab-icon" style="width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${this.activeTab === 'planning' ? '#7c3aed' : '#e2e8f0'};color:${this.activeTab === 'planning' ? 'white' : '#94a3b8'};flex-shrink:0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        </span>
                        <span>Projectplanning</span>
                        <span id="tab-badge-planning" style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:10px;background:${this.activeTab === 'planning' ? '#ede9fe' : '#f1f5f9'};color:${this.activeTab === 'planning' ? '#6d28d9' : '#94a3b8'};">0</span>
                    </button>
                    <button class="planning-tab ${this.activeTab === 'tender' ? 'active' : ''}" 
                            data-tab="tender"
                            style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 20px;font-size:14px;font-weight:600;color:${this.activeTab === 'tender' ? '#2563eb' : '#94a3b8'};cursor:pointer;border:none;border-bottom:3px solid ${this.activeTab === 'tender' ? '#2563eb' : 'transparent'};margin-bottom:-2px;transition:all 0.15s;background:${this.activeTab === 'tender' ? 'white' : 'transparent'};font-family:inherit;">
                        <span class="planning-tab-icon" style="width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${this.activeTab === 'tender' ? '#2563eb' : '#e2e8f0'};color:${this.activeTab === 'tender' ? 'white' : '#94a3b8'};flex-shrink:0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/><path d="M9 9h1"/><path d="M14 9h1"/><path d="M9 13h1"/><path d="M14 13h1"/></svg>
                        </span>
                        <span>Tenderplanning</span>
                        <span id="tab-badge-tender" style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:10px;background:${this.activeTab === 'tender' ? '#dbeafe' : '#f1f5f9'};color:${this.activeTab === 'tender' ? '#1d4ed8' : '#94a3b8'};">0</span>
                    </button>
                    <button class="planning-tab ${this.activeTab === 'checklist' ? 'active' : ''}" 
                            data-tab="checklist"
                            style="flex:1;display:flex;align-items:center;justify-content:center;gap:10px;padding:16px 20px;font-size:14px;font-weight:600;color:${this.activeTab === 'checklist' ? '#16a34a' : '#94a3b8'};cursor:pointer;border:none;border-bottom:3px solid ${this.activeTab === 'checklist' ? '#16a34a' : 'transparent'};margin-bottom:-2px;transition:all 0.15s;background:${this.activeTab === 'checklist' ? 'white' : 'transparent'};font-family:inherit;">
                        <span class="planning-tab-icon" style="width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:${this.activeTab === 'checklist' ? '#16a34a' : '#e2e8f0'};color:${this.activeTab === 'checklist' ? 'white' : '#94a3b8'};flex-shrink:0;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        </span>
                        <span>Indieningschecklist</span>
                        <span id="tab-badge-checklist" style="font-size:11px;font-weight:700;padding:2px 10px;border-radius:10px;background:${this.activeTab === 'checklist' ? '#dcfce7' : '#f1f5f9'};color:${this.activeTab === 'checklist' ? '#15803d' : '#94a3b8'};">0/0</span>
                    </button>
                </div>

                <!-- Content area (dynamisch) -->
                <div class="planning-modal-body" id="planning-modal-body" style="flex:1;overflow-y:auto;min-height:300px;">
                    <div class="planning-loading">Laden...</div>
                </div>

                <!-- Footer -->
                <div class="modal-footer" style="display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0;border-radius:0 0 16px 16px;">
                    <div class="modal-footer-left">
                        <span class="planning-footer-info" id="planning-footer-info" style="display:flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;">
                            ${this.getIcon('clock', 14)}
                            <span>Laatst bijgewerkt: —</span>
                        </span>
                    </div>
                    <div class="modal-footer-right">
                        <button type="button" class="btn btn-secondary" id="planning-btn-close" style="padding:8px 20px;border-radius:8px;border:1px solid #e2e8f0;background:white;color:#475569;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;">
                            Sluiten
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    // ============================================
    // RENDER — CONTENT (herlaadbaar)
    // ============================================

    renderContent() {
        const body = this.modal?.querySelector('#planning-modal-body');
        if (!body) return;

        if (this.isLoading) {
            body.innerHTML = `<div class="planning-loading">
                <div class="planning-spinner"></div>
                <span>Planning laden...</span>
            </div>`;
            return;
        }

        // Update tab badges
        this.updateBadges();

        if (this.activeTab === 'planning') {
            body.innerHTML = this.renderPlanningTab();
        } else if (this.activeTab === 'tender') {
            body.innerHTML = this.renderTenderplanningTab();
        } else {
            body.innerHTML = this.renderChecklistTab();
        }

        // Attach content event listeners
        this.attachContentListeners();

        // Update footer
        this.updateFooter();
    }

    updateBadges() {
        const planBadge = this.modal?.querySelector('#tab-badge-planning');
        const tenderBadge = this.modal?.querySelector('#tab-badge-tender');
        const clBadge = this.modal?.querySelector('#tab-badge-checklist');

        if (planBadge) {
            planBadge.textContent = this.planningTaken.length;
        }
        if (tenderBadge) {
            tenderBadge.textContent = this.tenderMilestones.length;
        }
        if (clBadge) {
            const done = this.checklistItems.filter(i => i.status === 'completed').length;
            clBadge.textContent = `${done}/${this.checklistItems.length}`;
        }
    }

    updateFooter() {
        const info = this.modal?.querySelector('#planning-footer-info span');
        if (!info) return;

        // Vind meest recente updated_at
        const allItems = [...this.planningTaken, ...this.checklistItems];
        if (allItems.length === 0) {
            info.textContent = 'Nog geen items';
            return;
        }

        const latest = allItems.reduce((max, item) => {
            const d = new Date(item.updated_at || item.created_at);
            return d > max ? d : max;
        }, new Date(0));

        if (latest.getTime() === 0) {
            info.textContent = 'Nog geen items';
        } else {
            const now = new Date();
            const diffMs = now - latest;
            const diffMin = Math.floor(diffMs / 60000);

            if (diffMin < 1) info.textContent = 'Zojuist bijgewerkt';
            else if (diffMin < 60) info.textContent = `${diffMin} min. geleden bijgewerkt`;
            else {
                info.textContent = `Bijgewerkt: ${latest.toLocaleDateString('nl-NL')} om ${latest.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
            }
        }
    }

    // ============================================
    // RENDER — PLANNING TAB
    // ============================================

    renderPlanningTab() {
        const progress = planningService.calculateProgress(this.planningTaken, 'done');
        const grouped = planningService.groupByCategorie(this.planningTaken, 'categorie');
        const categories = Object.keys(grouped);
        const hasTaken = categories.length > 0;

        return `
            <!-- Toolbar -->
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

            <!-- Taken lijst -->
            <div class="planning-task-list">
                ${hasTaken ? this.renderColumnHeaders('planning') : ''}
                ${!hasTaken ? this.renderEmptyState('planning') : ''}
                ${categories.map(cat => this.renderPlanningCategory(cat, grouped[cat])).join('')}
                
                <!-- Taak toevoegen (onderaan) -->
                <div class="planning-add-row" id="add-taak-bottom">
                    ${this.getIcon('plus', 16)}
                    <span>Taak toevoegen…</span>
                </div>
            </div>
        `;
    }

    // ─────────────────────────────────────────────
    // KOLOM HEADERS
    // ─────────────────────────────────────────────

    renderColumnHeaders(type) {
        if (type === 'tender') {
            // Tenderplanning: flex layout, matched aan .tp-item
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

        // Planning & Checklist: grid layout, matched aan .planning-task-row
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

    renderPlanningCategory(categoryName, tasks) {
        const doneCount = tasks.filter(t => t.status === 'done').length;
        const statusColor = doneCount === tasks.length ? '#22c55e' :
            doneCount > 0 ? '#f97316' : '#94a3b8';

        return `
            <div class="planning-category">
                <div class="planning-cat-header">
                    <span class="planning-cat-dot" style="background: ${statusColor}"></span>
                    <span class="planning-cat-label">${categoryName}</span>
                    <span class="planning-cat-count">${doneCount}/${tasks.length} taken</span>
                </div>
                ${tasks.map(task => this.renderPlanningTask(task)).join('')}
            </div>
        `;
    }

    renderPlanningTask(task) {
        const isDone = task.status === 'done';
        const isActive = task.status === 'active';
        const isMilestone = task.is_milestone;

        // Assignees
        const assignees = task.toegewezen_aan || [];
        const assigneeHtml = assignees.slice(0, 2).map(a => `
            <span class="planning-assignee-pill" title="${a.naam || ''}">
                <span class="planning-assignee-dot" style="background: ${a.avatar_kleur || '#667eea'}">${a.initialen || '?'}</span>
                <span>${a.naam?.split(' ')[0] || ''}</span>
            </span>
        `).join('');
        const moreCount = assignees.length > 2 ? `<span class="planning-assignee-more">+${assignees.length - 2}</span>` : '';

        // Klikbare assignee zone
        const assigneeZone = `
            <div class="planning-task-assignees" data-action="assign-person" data-taak-id="${task.id}" 
                 style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;" 
                 title="Klik om teamlid toe te wijzen">
                ${assignees.length > 0 ? `${assigneeHtml}${moreCount}` : `
                    <span style="display:inline-flex;align-items:center;gap:4px;color:#94a3b8;font-size:12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        <span>Toewijzen</span>
                    </span>
                `}
            </div>`;

        // Klikbare datum zone
        const datumValue = task.datum ? new Date(task.datum).toISOString().split('T')[0] : '';
        let datumZone;
        if (task.datum) {
            const d = new Date(task.datum);
            const datumStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
            const datumClass = isDone ? 'done' : isActive ? 'highlight' : '';
            datumZone = `
                <span class="planning-task-date ${datumClass}" data-action="set-date" data-taak-id="${task.id}" 
                      style="cursor:pointer;" title="Klik om datum te wijzigen">
                    ${datumStr}
                </span>`;
        } else {
            datumZone = `
                <span class="planning-task-date" data-action="set-date" data-taak-id="${task.id}" 
                      style="cursor:pointer;color:#cbd5e1;font-size:12px;" title="Klik om datum in te stellen">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Datum
                </span>`;
        }

        // Status
        const statusMap = {
            'done': { label: 'Klaar', class: 'status--done' },
            'active': { label: 'Actief', class: 'status--active' },
            'todo': { label: 'Te doen', class: 'status--todo' }
        };
        const status = statusMap[task.status] || statusMap.todo;

        // Milestone styling
        const milestoneClass = isMilestone ? 'planning-task-row--milestone' : '';
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
                <span class="planning-task-status ${status.class}">${status.label}</span>
                <button class="planning-task-menu" data-action="taak-menu" data-taak-id="${task.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                </button>
            </div>
        `;
    }

    // ============================================
    // RENDER — TENDERPLANNING TAB
    // ============================================

    /**
     * Bouw lijst van mijlpalen uit tender-object velden
     * Retourneert gesorteerde array met label, datum, icon, status
     */
    buildTenderMilestones() {
        if (!this.tender) return [];

        const now = new Date();
        const t = this.tender;

        // Configuratie: veldnaam → label + icon info
        const milestoneConfig = [
            { field: 'publicatie_datum',     label: 'Publicatie Aanbesteding',     sublabel: 'Gepubliceerd op TenderNed / Mercell',  iconType: 'blue',   iconName: 'calendar' },
            { field: 'schouw_datum',         label: 'Schouw / Locatiebezoek',      sublabel: 'Optioneel bezoekmoment',               iconType: 'gray',   iconName: 'eye' },
            { field: 'nvi1_datum',           label: 'NVI 1 — Indiening vragen',    sublabel: 'Nota van Inlichtingen ronde 1',        iconType: 'blue',   iconName: 'clock' },
            { field: 'nvi_1_publicatie',     label: 'NVI 1 — Publicatie antwoorden',sublabel: 'Antwoorden op ingediende vragen',      iconType: 'blue',   iconName: 'clock' },
            { field: 'nvi2_datum',           label: 'NVI 2 — Indiening vragen',    sublabel: 'Nota van Inlichtingen ronde 2',        iconType: 'blue',   iconName: 'clock' },
            { field: 'nvi_2_publicatie',     label: 'NVI 2 — Publicatie antwoorden',sublabel: 'Eventuele aanvullende vragen',         iconType: 'blue',   iconName: 'clock' },
            { field: 'presentatie_datum',    label: 'Presentatie / Interview',      sublabel: 'Mondelinge toelichting op inschrijving',iconType: 'orange', iconName: 'users' },
            { field: 'interne_deadline',     label: 'Interne deadline',             sublabel: 'Eigen streefdatum voor indieningsgereed',iconType: 'orange',iconName: 'shield' },
            { field: 'deadline_indiening',   label: 'Deadline indienen Inschrijvingen', sublabel: 'Uiterste moment voor indiening',   iconType: 'red',    iconName: 'zap',     isDeadline: true },
            { field: 'voorlopige_gunning',   label: 'Voorlopige gunning',           sublabel: 'Communicatie voorgenomen gunningsbeslissing', iconType: 'blue', iconName: 'checkCircle' },
            { field: 'definitieve_gunning',  label: 'Definitieve gunning',          sublabel: 'Na bezwaartermijn',                    iconType: 'blue',   iconName: 'checkCircle' },
            { field: 'start_uitvoering',     label: 'Start Raamovereenkomst',       sublabel: 'Ingangsdatum overeenkomst',            iconType: 'green',  iconName: 'play' },
            { field: 'einde_contract',       label: 'Einde Contract',               sublabel: 'Einddatum overeenkomst',               iconType: 'gray',   iconName: 'clock' },
        ];

        const milestones = [];

        for (const config of milestoneConfig) {
            const rawDate = t[config.field];
            if (!rawDate) continue;

            const date = new Date(rawDate);
            if (isNaN(date.getTime())) continue;

            const isPassed = date < now;

            milestones.push({
                label: config.label,
                sublabel: config.sublabel,
                date: date,
                iconType: config.iconType,
                iconName: config.iconName,
                isDeadline: config.isDeadline || false,
                isPassed: isPassed,
                isNext: false, // wordt hieronder bepaald
                field: config.field
            });
        }

        // Sorteer chronologisch
        milestones.sort((a, b) => a.date - b.date);

        // Markeer de eerstvolgende (eerste niet-gepasseerde)
        const nextIdx = milestones.findIndex(m => !m.isPassed);
        if (nextIdx !== -1) {
            milestones[nextIdx].isNext = true;
        }

        return milestones;
    }

    renderTenderplanningTab() {
        const milestones = this.tenderMilestones;
        const passedCount = milestones.filter(m => m.isPassed).length;

        return `
            <!-- Info bar -->
            <div class="planning-toolbar" style="justify-content: flex-end;">
                <div class="planning-progress-inline">
                    <div class="planning-progress-track">
                        <div class="planning-progress-fill" style="width: ${milestones.length > 0 ? Math.round((passedCount / milestones.length) * 100) : 0}%; background: linear-gradient(90deg, #3b82f6, #60a5fa);"></div>
                    </div>
                    <span class="planning-progress-label">${passedCount} van ${milestones.length} gepasseerd</span>
                </div>
            </div>

            <!-- Milestones lijst -->
            <div class="tp-list">
                ${milestones.length > 0 ? this.renderColumnHeaders('tender') : ''}
                ${milestones.length === 0 ? this.renderEmptyState('tender') : ''}
                ${milestones.map((m, i) => {
                    // Voeg "eerst volgende" marker toe vóór het next-item
                    const marker = m.isNext ? `
                        <div class="tp-next-marker">
                            <span class="tp-next-marker-label">▾ Eerst volgende</span>
                            <span class="tp-next-marker-line"></span>
                        </div>
                    ` : '';
                    return marker + this.renderTenderMilestone(m);
                }).join('')}
            </div>
        `;
    }

    renderTenderMilestone(milestone) {
        const d = milestone.date;
        const datumStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
        const weekdays = ['zo.', 'ma.', 'di.', 'wo.', 'do.', 'vr.', 'za.'];
        const weekday = weekdays[d.getDay()];
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
        const timeStr = hasTime ? d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '';

        // Icon SVGs per type
        const iconSvgs = {
            calendar: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
            eye: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            users: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            shield: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
            zap: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            checkCircle: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        };

        const iconSvg = iconSvgs[milestone.iconName] || iconSvgs.clock;

        // Status badge
        let statusHtml;
        if (milestone.isPassed) {
            statusHtml = '<span class="tp-status tp-status--passed">Gepasseerd</span>';
        } else if (milestone.isNext) {
            statusHtml = '<span class="tp-status tp-status--next">Eerstvolgende</span>';
        } else if (milestone.isDeadline) {
            statusHtml = '<span class="tp-status tp-status--deadline">Deadline</span>';
        } else {
            statusHtml = '<span class="tp-status tp-status--upcoming">Gepland</span>';
        }

        // Row classes
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

    // ============================================
    // RENDER — CHECKLIST TAB
    // ============================================

    renderChecklistTab() {
        const progress = planningService.calculateProgress(this.checklistItems, 'completed');
        const grouped = planningService.groupByCategorie(this.checklistItems, 'sectie');
        const sections = Object.keys(grouped);

        // SVG ring berekening
        const radius = 18;
        const circumference = 2 * Math.PI * radius;
        const dashOffset = circumference - (progress.percentage / 100) * circumference;

        return `
            <!-- Toolbar -->
            <div class="planning-toolbar">
                <div class="planning-toolbar-left">
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
                        ${this.getIcon('plus', 14)}
                        <span>Item toevoegen</span>
                    </button>
                </div>
            </div>

            <!-- Checklist items -->
            <div class="checklist-items-list">
                ${sections.length > 0 ? this.renderColumnHeaders('checklist') : ''}
                ${sections.length === 0 ? this.renderEmptyState('checklist') : ''}
                ${sections.map(sec => this.renderChecklistSection(sec, grouped[sec])).join('')}
            </div>
        `;
    }

    renderChecklistSection(sectionName, items) {
        const doneCount = items.filter(i => i.status === 'completed').length;
        const statusColor = doneCount === items.length ? '#22c55e' :
            doneCount > 0 ? '#f97316' : '#94a3b8';

        return `
            <div class="planning-category">
                <div class="planning-cat-header">
                    <span class="planning-cat-dot" style="background: ${statusColor}"></span>
                    <span class="planning-cat-label">${sectionName}</span>
                    <span class="planning-cat-count">${doneCount}/${items.length} taken</span>
                </div>
                ${items.map(item => this.renderChecklistItem(item)).join('')}
                <div class="planning-add-row" data-action="add-checklist-in-section" data-section="${sectionName}">
                    ${this.getIcon('plus', 16)}
                    <span>Item toevoegen aan ${sectionName}…</span>
                </div>
            </div>
        `;
    }

    renderChecklistItem(item) {
        const isChecked = item.status === 'completed';

        // Verantwoordelijke — zelfde stijl als planning assignee zone
        const verantwoordelijke = item.verantwoordelijke_data || null;
        let assigneeZone;
        if (verantwoordelijke) {
            const initialen = verantwoordelijke.initialen || (verantwoordelijke.naam || '?').substring(0, 2).toUpperCase();
            const kleur = verantwoordelijke.avatar_kleur || '#667eea';
            assigneeZone = `
                <div class="planning-task-assignees" data-action="assign-checklist" data-item-id="${item.id}" 
                     style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;" 
                     title="${verantwoordelijke.naam || ''}">
                    <span class="planning-assignee-pill">
                        <span class="planning-assignee-dot" style="background: ${kleur}">${initialen}</span>
                        <span>${(verantwoordelijke.naam || '').split(' ')[0]}</span>
                    </span>
                </div>`;
        } else {
            assigneeZone = `
                <div class="planning-task-assignees" data-action="assign-checklist" data-item-id="${item.id}" 
                     style="cursor:pointer;min-width:80px;display:flex;align-items:center;gap:4px;" 
                     title="Verantwoordelijke toewijzen">
                    <span style="display:inline-flex;align-items:center;gap:4px;color:#94a3b8;font-size:12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        <span>Toewijzen</span>
                    </span>
                </div>`;
        }

        // Datum — zelfde stijl als planning datum zone
        let datumZone;
        if (item.deadline) {
            const d = new Date(item.deadline);
            const datumStr = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
            const datumClass = isChecked ? 'done' : '';
            datumZone = `
                <span class="planning-task-date ${datumClass}" data-action="set-checklist-date" data-item-id="${item.id}" 
                      style="cursor:pointer;" title="Datum wijzigen">
                    ${datumStr}
                </span>`;
        } else {
            datumZone = `
                <span class="planning-task-date" data-action="set-checklist-date" data-item-id="${item.id}" 
                      style="cursor:pointer;color:#cbd5e1;font-size:12px;" title="Deadline instellen">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Datum
                </span>`;
        }

        // Status badge — zelfde stijl als planning
        const statusLabel = isChecked ? 'Compleet' : 'Te doen';
        const statusClass = isChecked ? 'status--done' : 'status--todo';

        // Verplicht indicator als subtiel label naast de naam
        const verplichtIndicator = item.is_verplicht 
            ? '<span style="margin-left:6px;font-size:10px;font-weight:600;color:#ef4444;opacity:0.7;letter-spacing:0.3px;">VERPLICHT</span>' 
            : '';

        return `
            <div class="planning-task-row ${isChecked ? '' : ''}" data-item-id="${item.id}">
                <div class="planning-task-check ${isChecked ? 'done' : ''}" 
                     data-action="toggle-checklist" data-item-id="${item.id}" data-status="${item.status}">
                    ${isChecked ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                </div>
                <span class="planning-task-name ${isChecked ? 'done' : ''}">
                    ${item.taak_naam}${verplichtIndicator}
                </span>
                ${assigneeZone}
                ${datumZone}
                <span class="planning-task-status ${statusClass}">${statusLabel}</span>
                <button class="planning-task-menu" data-action="checklist-menu" data-item-id="${item.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                    </svg>
                </button>
            </div>
        `;
    }

    // ============================================
    // RENDER — EMPTY STATE
    // ============================================

    renderEmptyState(type) {
        if (type === 'planning') {
            return `
                <div class="planning-empty">
                    <div class="planning-empty-icon">${this.getIcon('calendar', 40, '#cbd5e1')}</div>
                    <h3>Nog geen taken</h3>
                    <p>Start met de standaard projectplanning of voeg handmatig taken toe.</p>
                    <button class="planning-empty-btn" id="btn-empty-template-planning" 
                            style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:#7c3aed;color:white;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:12px;transition:all 0.15s;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                        Standaard template laden
                    </button>
                </div>
            `;
        }
        if (type === 'tender') {
            return `
                <div class="planning-empty">
                    <div class="planning-empty-icon">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-4h6v4"/></svg>
                    </div>
                    <h3>Geen tenderplanning beschikbaar</h3>
                    <p>Vul de timeline-data in bij de tendergegevens of gebruik Smart Import om ze automatisch te importeren.</p>
                </div>
            `;
        }
        return `
            <div class="planning-empty">
                <div class="planning-empty-icon">${this.getIcon('checkCircle', 40, '#cbd5e1')}</div>
                <h3>Nog geen checklist items</h3>
                <p>Start met de standaard indieningschecklist of voeg handmatig items toe.</p>
                <button class="planning-empty-btn" id="btn-empty-template-checklist" 
                        style="display:inline-flex;align-items:center;gap:8px;padding:10px 22px;border-radius:10px;border:none;background:#16a34a;color:white;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;margin-top:12px;transition:all 0.15s;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                    Standaard checklist laden
                </button>
            </div>
        `;
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    attachEventListeners() {
        // Close handlers
        this.modal.querySelector('#planning-modal-close')?.addEventListener('click', () => this.close());
        this.modal.querySelector('#planning-btn-close')?.addEventListener('click', () => this.close());
        this.modal.querySelector('.planning-modal-overlay')?.addEventListener('click', () => this.close());

        // Tab switching
        this.modal.querySelectorAll('.planning-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                if (tabName === this.activeTab) return;

                this.activeTab = tabName;
                
                // Color map per tab type
                const colorMap = {
                    planning: { active: '#7c3aed', badgeBg: '#ede9fe', badgeColor: '#6d28d9' },
                    tender:   { active: '#2563eb', badgeBg: '#dbeafe', badgeColor: '#1d4ed8' },
                    checklist:{ active: '#16a34a', badgeBg: '#dcfce7', badgeColor: '#15803d' }
                };
                
                // Update alle tab styles
                this.modal.querySelectorAll('.planning-tab').forEach(t => {
                    const type = t.dataset.tab;
                    const isActive = type === this.activeTab;
                    const colors = colorMap[type];
                    
                    t.classList.toggle('active', isActive);
                    t.style.color = isActive ? colors.active : '#94a3b8';
                    t.style.borderBottomColor = isActive ? colors.active : 'transparent';
                    t.style.background = isActive ? 'white' : 'transparent';
                    
                    // Icon cirkel
                    const circle = t.querySelector('.planning-tab-icon');
                    if (circle) {
                        circle.style.background = isActive ? colors.active : '#e2e8f0';
                        circle.style.color = isActive ? 'white' : '#94a3b8';
                    }
                    
                    // Badge
                    const badge = t.querySelector('[id^="tab-badge"]');
                    if (badge) {
                        badge.style.background = isActive ? colors.badgeBg : '#f1f5f9';
                        badge.style.color = isActive ? colors.badgeColor : '#94a3b8';
                    }
                });
                
                this.renderContent();
            });
        });

        // ESC key
        this._escHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        };
        document.addEventListener('keydown', this._escHandler);
    }

    attachContentListeners() {
        const body = this.modal?.querySelector('#planning-modal-body');
        if (!body) return;

        // Gebruik event delegation voor dynamische content
        body.addEventListener('click', async (e) => {
            // Template laden knoppen
            if (e.target.closest('#btn-load-template-planning') || e.target.closest('#btn-empty-template-planning')) {
                this.handleLoadTemplates('planning');
                return;
            }
            if (e.target.closest('#btn-load-template-checklist') || e.target.closest('#btn-empty-template-checklist')) {
                this.handleLoadTemplates('checklist');
                return;
            }

            const target = e.target.closest('[data-action]');
            if (!target) {
                // Check ook voor add knoppen
                if (e.target.closest('#btn-add-taak') || e.target.closest('#add-taak-bottom')) {
                    this.handleAddTaak();
                    return;
                }
                if (e.target.closest('#btn-add-checklist')) {
                    this.handleAddChecklistItem();
                    return;
                }
                return;
            }

            const action = target.dataset.action;

            switch (action) {
                case 'toggle-taak':
                    await this.handleToggleTaak(target.dataset.taakId, target.dataset.status);
                    break;
                case 'toggle-checklist':
                    await this.handleToggleChecklist(target.dataset.itemId, target.dataset.status);
                    break;
                case 'taak-menu':
                    this.handleTaakMenu(target.dataset.taakId, target);
                    break;
                case 'checklist-menu':
                    this.handleChecklistMenu(target.dataset.itemId, target);
                    break;
                case 'add-checklist-in-section':
                    this.handleAddChecklistItem(target.dataset.section);
                    break;
                case 'set-date':
                    this.handleSetDate(target.dataset.taakId, target);
                    break;
                case 'assign-person':
                    this.handleAssignPerson(target.dataset.taakId, target);
                    break;
                case 'set-checklist-date':
                    this.handleSetChecklistDate(target.dataset.itemId, target);
                    break;
                case 'assign-checklist':
                    this.handleAssignChecklist(target.dataset.itemId, target);
                    break;
            }
        });
    }

    // ============================================
    // DATE & ASSIGNEE ACTIONS
    // ============================================

    handleSetDate(taakId, targetEl) {
        const taak = this.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        // Verwijder bestaande date pickers
        this.modal.querySelectorAll('.planning-date-picker-popup').forEach(el => el.remove());

        // Maak inline date picker
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

        // Positioneer naast de target
        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        picker.style.top = `${rect.bottom - modalRect.top + 4}px`;
        picker.style.right = `${modalRect.right - rect.right}px`;

        this.modal.querySelector('.planning-modal-container').appendChild(picker);

        // Focus the input
        const input = picker.querySelector('input[type="date"]');
        input.focus();

        // Event handlers
        picker.querySelector('.date-picker-save').addEventListener('click', async () => {
            const newDate = input.value;
            if (newDate) {
                await this._saveTaakDate(taakId, newDate);
            }
            picker.remove();
        });

        picker.querySelector('.date-picker-cancel').addEventListener('click', () => picker.remove());

        picker.querySelector('.date-picker-clear')?.addEventListener('click', async () => {
            await this._saveTaakDate(taakId, null);
            picker.remove();
        });

        // Enter key saves
        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const newDate = input.value;
                if (newDate) await this._saveTaakDate(taakId, newDate);
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
            const updateData = { datum: dateStr ? `${dateStr}T00:00:00` : null };
            await planningService.updatePlanningTaak(taakId, updateData);

            const taak = this.planningTaken.find(t => t.id === taakId);
            if (taak) {
                taak.datum = dateStr ? `${dateStr}T00:00:00` : null;
                taak.updated_at = new Date().toISOString();
            }

            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Date update error:', error);
            alert('Fout bij opslaan datum: ' + error.message);
        }
    }

    handleAssignPerson(taakId, targetEl) {
        const taak = this.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        // Verwijder bestaande dropdowns
        this.modal.querySelectorAll('.planning-assignee-dropdown').forEach(el => el.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'planning-assignee-dropdown';
        Object.assign(dropdown.style, {
            position: 'absolute',
            zIndex: '10001',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '8px 0',
            minWidth: '220px',
            maxHeight: '280px',
            overflowY: 'auto'
        });

        // Positioneer naast de target
        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        dropdown.style.top = `${rect.bottom - modalRect.top + 4}px`;
        dropdown.style.left = `${rect.left - modalRect.left}px`;

        this.modal.querySelector('.planning-modal-container').appendChild(dropdown);

        // Render opties (herbruikbaar na elke toggle)
        const renderOptions = () => {
            const currentIds = (taak.toegewezen_aan || []).map(a => a.id);
            const count = currentIds.length;

            let html = `<div style="padding:6px 14px 8px;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;">
                <span>Teamlid toewijzen</span>
                ${count > 0 ? `<span style="font-size:11px;color:#7c3aed;font-weight:600;">${count} geselecteerd</span>` : ''}
            </div>`;

            if (this.teamMembers.length === 0) {
                html += `<div style="padding:14px;font-size:13px;color:#94a3b8;text-align:center;">Geen teamleden gevonden</div>`;
            } else {
                this.teamMembers.forEach(member => {
                    const isAssigned = currentIds.includes(member.id);
                    const initialen = member.initialen || (member.naam || '?').substring(0, 2).toUpperCase();
                    const kleur = member.avatar_kleur || '#667eea';
                    const naam = member.naam || member.email || 'Onbekend';
                    const rol = member.rol || '';

                    html += `
                        <div class="assignee-option" data-member-id="${member.id}" 
                             style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background 0.1s;${isAssigned ? 'background:#f5f3ff;' : ''}">
                            <span style="width:28px;height:28px;border-radius:50%;background:${kleur};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${initialen}</span>
                            <div style="flex:1;min-width:0;">
                                <div style="font-size:13px;font-weight:${isAssigned ? '700' : '500'};color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${naam}</div>
                                ${rol ? `<div style="font-size:11px;color:#94a3b8;">${rol}</div>` : ''}
                            </div>
                            ${isAssigned ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : `<span style="width:16px;"></span>`}
                        </div>
                    `;
                });
            }

            dropdown.innerHTML = html;

            // Event handlers opnieuw koppelen
            dropdown.querySelectorAll('.assignee-option').forEach(option => {
                option.addEventListener('click', async () => {
                    const memberId = option.dataset.memberId;
                    await this._toggleAssignee(taakId, memberId);
                    renderOptions(); // Herrender opties met bijgewerkte vinkjes
                });
            });
        };

        renderOptions();

        // Click outside closes en herrendert taken
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!dropdown.contains(e.target) && !targetEl.contains(e.target)) {
                    dropdown.remove();
                    document.removeEventListener('click', closeHandler);
                    this.renderContent(); // Taak rijen bijwerken met nieuwe avatars
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    async _toggleAssignee(taakId, memberId) {
        const taak = this.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        const currentAssignees = taak.toegewezen_aan || [];
        const isCurrentlyAssigned = currentAssignees.some(a => a.id === memberId);
        const member = this.teamMembers.find(m => m.id === memberId);
        if (!member) return;

        let newAssignees;
        if (isCurrentlyAssigned) {
            newAssignees = currentAssignees.filter(a => a.id !== memberId);
        } else {
            newAssignees = [...currentAssignees, {
                id: member.id,
                naam: member.naam || member.email,
                initialen: member.initialen || (member.naam || '?').substring(0, 2).toUpperCase(),
                avatar_kleur: member.avatar_kleur || '#667eea'
            }];
        }

        try {
            await planningService.updatePlanningTaak(taakId, { 
                toegewezen_aan: newAssignees 
            });

            taak.toegewezen_aan = newAssignees;
            taak.updated_at = new Date().toISOString();
            // Geen renderContent() hier — dropdown renderOptions() toont vinkjes,
            // volledige herrender gebeurt bij sluiten dropdown
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Assignee update error:', error);
            alert('Fout bij toewijzen: ' + error.message);
        }
    }

    // ============================================
    // CHECKLIST DATE & ASSIGNEE
    // ============================================

    handleSetChecklistDate(itemId, targetEl) {
        const item = this.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        // Verwijder bestaande popups
        this.modal.querySelectorAll('.planning-date-picker-popup').forEach(el => el.remove());

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

        const currentDate = item.deadline ? new Date(item.deadline).toISOString().split('T')[0] : '';

        picker.innerHTML = `
            <label style="font-size:12px;font-weight:600;color:#475569;">Deadline instellen</label>
            <input type="date" value="${currentDate}" 
                   style="padding:7px 10px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;color:#0f172a;">
            <div style="display:flex;gap:6px;justify-content:flex-end;">
                ${item.deadline ? `<button class="date-picker-clear" style="padding:5px 12px;border-radius:6px;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Wissen</button>` : ''}
                <button class="date-picker-cancel" style="padding:5px 12px;border-radius:6px;border:1px solid #e2e8f0;background:white;color:#64748b;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Annuleren</button>
                <button class="date-picker-save" style="padding:5px 12px;border-radius:6px;border:none;background:#16a34a;color:white;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">Opslaan</button>
            </div>
        `;

        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        picker.style.top = `${rect.bottom - modalRect.top + 4}px`;
        picker.style.right = `${modalRect.right - rect.right}px`;

        this.modal.querySelector('.planning-modal-container').appendChild(picker);

        const input = picker.querySelector('input[type="date"]');
        input.focus();

        picker.querySelector('.date-picker-save').addEventListener('click', async () => {
            const newDate = input.value;
            if (newDate) {
                await this._saveChecklistDate(itemId, newDate);
            }
            picker.remove();
        });

        picker.querySelector('.date-picker-cancel').addEventListener('click', () => picker.remove());

        picker.querySelector('.date-picker-clear')?.addEventListener('click', async () => {
            await this._saveChecklistDate(itemId, null);
            picker.remove();
        });

        input.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                if (input.value) await this._saveChecklistDate(itemId, input.value);
                picker.remove();
            }
            if (e.key === 'Escape') picker.remove();
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

            const item = this.checklistItems.find(i => i.id === itemId);
            if (item) {
                item.deadline = dateStr || null;
                item.updated_at = new Date().toISOString();
            }

            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Checklist date update error:', error);
            alert('Fout bij opslaan datum: ' + error.message);
        }
    }

    handleAssignChecklist(itemId, targetEl) {
        const item = this.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        // Verwijder bestaande dropdowns
        this.modal.querySelectorAll('.planning-assignee-dropdown').forEach(el => el.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'planning-assignee-dropdown';
        Object.assign(dropdown.style, {
            position: 'absolute',
            zIndex: '10001',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
            padding: '8px 0',
            minWidth: '220px',
            maxHeight: '280px',
            overflowY: 'auto'
        });

        const currentId = item.verantwoordelijke_data?.id || null;

        let html = `<div style="padding:6px 14px 8px;font-size:12px;font-weight:700;color:#475569;border-bottom:1px solid #f1f5f9;">Verantwoordelijke toewijzen</div>`;

        // Optie: niemand
        html += `
            <div class="assignee-option" data-member-id="" 
                 style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;${!currentId ? 'background:#f0fdf4;' : ''}"
                 onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='${!currentId ? '#f0fdf4' : 'transparent'}'">
                <span style="width:28px;height:28px;border-radius:50%;background:#e2e8f0;color:#94a3b8;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">—</span>
                <span style="font-size:13px;color:#94a3b8;font-style:italic;">Geen verantwoordelijke</span>
                ${!currentId ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" style="margin-left:auto;"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
            </div>`;

        if (this.teamMembers.length === 0) {
            html += `<div style="padding:14px;font-size:13px;color:#94a3b8;text-align:center;">Geen teamleden gevonden</div>`;
        } else {
            this.teamMembers.forEach(member => {
                const isSelected = currentId === member.id;
                const initialen = member.initialen || (member.naam || '?').substring(0, 2).toUpperCase();
                const kleur = member.avatar_kleur || '#667eea';
                const naam = member.naam || member.email || 'Onbekend';
                const rol = member.rol || '';

                html += `
                    <div class="assignee-option" data-member-id="${member.id}" 
                         style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;${isSelected ? 'background:#f0fdf4;' : ''}"
                         onmouseover="this.style.background='${isSelected ? '#dcfce7' : '#f8fafc'}'" 
                         onmouseout="this.style.background='${isSelected ? '#f0fdf4' : 'transparent'}'">
                        <span style="width:28px;height:28px;border-radius:50%;background:${kleur};color:white;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;">${initialen}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:13px;font-weight:${isSelected ? '700' : '500'};color:#0f172a;">${naam}</div>
                            ${rol ? `<div style="font-size:11px;color:#94a3b8;">${rol}</div>` : ''}
                        </div>
                        ${isSelected ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                    </div>`;
            });
        }

        dropdown.innerHTML = html;

        const rect = targetEl.getBoundingClientRect();
        const modalRect = this.modal.querySelector('.planning-modal-container').getBoundingClientRect();
        dropdown.style.top = `${rect.bottom - modalRect.top + 4}px`;
        dropdown.style.left = `${rect.left - modalRect.left}px`;

        this.modal.querySelector('.planning-modal-container').appendChild(dropdown);

        dropdown.querySelectorAll('.assignee-option').forEach(option => {
            option.addEventListener('click', async () => {
                const memberId = option.dataset.memberId;
                await this._setChecklistVerantwoordelijke(itemId, memberId || null);
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
        const item = this.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        let verantwoordelijkeData = null;
        if (memberId) {
            const member = this.teamMembers.find(m => m.id === memberId);
            if (member) {
                verantwoordelijkeData = {
                    id: member.id,
                    naam: member.naam || member.email,
                    initialen: member.initialen || (member.naam || '?').substring(0, 2).toUpperCase(),
                    avatar_kleur: member.avatar_kleur || '#667eea'
                };
            }
        }

        try {
            await planningService.updateChecklistItem(itemId, {
                verantwoordelijke: verantwoordelijkeData?.naam || null,
                verantwoordelijke_data: verantwoordelijkeData
            });

            item.verantwoordelijke = verantwoordelijkeData?.naam || null;
            item.verantwoordelijke_data = verantwoordelijkeData;
            item.updated_at = new Date().toISOString();

            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Checklist assignee error:', error);
            alert('Fout bij toewijzen: ' + error.message);
        }
    }

    // ============================================
    // ACTIONS
    // ============================================

    async handleToggleTaak(taakId, currentStatus) {
        try {
            await planningService.togglePlanningTaakStatus(taakId, currentStatus);

            // Update lokale data
            const taak = this.planningTaken.find(t => t.id === taakId);
            if (taak) {
                taak.status = currentStatus === 'done' ? 'todo' : 'done';
                taak.updated_at = new Date().toISOString();
            }

            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Toggle taak error:', error);
            alert('Fout bij bijwerken: ' + error.message);
        }
    }

    async handleToggleChecklist(itemId, currentStatus) {
        try {
            await planningService.toggleChecklistItemStatus(itemId, currentStatus);

            // Update lokale data
            const item = this.checklistItems.find(i => i.id === itemId);
            if (item) {
                item.status = currentStatus === 'completed' ? 'pending' : 'completed';
                item.updated_at = new Date().toISOString();
            }

            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Toggle checklist error:', error);
            alert('Fout bij bijwerken: ' + error.message);
        }
    }

    async handleAddTaak() {
        const naam = prompt('Taaknaam:');
        if (!naam?.trim()) return;

        const categorie = prompt('Categorie (bijv. Voorbereiding, Schrijven & Review):', 'Algemeen');

        try {
            const newTaak = await planningService.createPlanningTaak(this.tender.id, {
                taak_naam: naam.trim(),
                categorie: categorie?.trim() || 'Algemeen',
                status: 'todo',
                volgorde: this.planningTaken.length
            });

            this.planningTaken.push(newTaak);
            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Add taak error:', error);
            alert('Fout bij toevoegen: ' + error.message);
        }
    }

    async handleAddChecklistItem(section = null) {
        const naam = prompt('Item naam:');
        if (!naam?.trim()) return;

        const sectie = section || prompt('Categorie (bijv. Documenten, Inschrijving):', 'Documenten');
        const isVerplicht = confirm('Is dit item verplicht?');

        try {
            const newItem = await planningService.createChecklistItem(this.tender.id, {
                taak_naam: naam.trim(),
                sectie: sectie?.trim() || 'Documenten',
                is_verplicht: isVerplicht,
                status: 'pending',
                volgorde: this.checklistItems.length
            });

            this.checklistItems.push(newItem);
            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            console.error('❌ Add checklist item error:', error);
            alert('Fout bij toevoegen: ' + error.message);
        }
    }

    handleTaakMenu(taakId, buttonEl) {
        const taak = this.planningTaken.find(t => t.id === taakId);
        if (!taak) return;

        // Simpel context menu met confirm/prompt
        const action = prompt(
            `"${taak.taak_naam}"\n\nKies actie:\n1 = Bewerken\n2 = Verwijderen\n3 = Annuleren`,
            '3'
        );

        if (action === '1') {
            this.handleEditTaak(taak);
        } else if (action === '2') {
            this.handleDeleteTaak(taak);
        }
    }

    handleChecklistMenu(itemId, buttonEl) {
        const item = this.checklistItems.find(i => i.id === itemId);
        if (!item) return;

        const action = prompt(
            `"${item.taak_naam}"\n\nKies actie:\n1 = Bewerken\n2 = Verwijderen\n3 = Annuleren`,
            '3'
        );

        if (action === '1') {
            this.handleEditChecklistItem(item);
        } else if (action === '2') {
            this.handleDeleteChecklistItem(item);
        }
    }

    async handleEditTaak(taak) {
        const naam = prompt('Taaknaam:', taak.taak_naam);
        if (naam === null) return;

        try {
            await planningService.updatePlanningTaak(taak.id, {
                taak_naam: naam.trim()
            });
            taak.taak_naam = naam.trim();
            this.renderContent();
        } catch (error) {
            alert('Fout bij bewerken: ' + error.message);
        }
    }

    async handleDeleteTaak(taak) {
        if (!confirm(`"${taak.taak_naam}" verwijderen?`)) return;

        try {
            await planningService.deletePlanningTaak(taak.id);
            this.planningTaken = this.planningTaken.filter(t => t.id !== taak.id);
            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            alert('Fout bij verwijderen: ' + error.message);
        }
    }

    async handleEditChecklistItem(item) {
        const naam = prompt('Item naam:', item.taak_naam);
        if (naam === null) return;

        try {
            await planningService.updateChecklistItem(item.id, {
                taak_naam: naam.trim()
            });
            item.taak_naam = naam.trim();
            this.renderContent();
        } catch (error) {
            alert('Fout bij bewerken: ' + error.message);
        }
    }

    async handleDeleteChecklistItem(item) {
        if (!confirm(`"${item.taak_naam}" verwijderen?`)) return;

        try {
            await planningService.deleteChecklistItem(item.id);
            this.checklistItems = this.checklistItems.filter(i => i.id !== item.id);
            this.renderContent();
            this._notifyUpdate();
        } catch (error) {
            alert('Fout bij verwijderen: ' + error.message);
        }
    }

    // ============================================
    // TEMPLATE LADEN
    // ============================================

    async handleLoadTemplates(scope = 'both') {
        /**
         * scope: 'planning' | 'checklist' | 'both'
         * 
         * Laadt standaard template taken vanuit bureau-templates naar deze tender.
         * Als er al items bestaan, vraag of ze overschreven moeten worden.
         */
        const tenderId = this.tender?.id;
        if (!tenderId) return;

        // Check of er al items zijn
        const hasPlanning = this.planningTaken.length > 0;
        const hasChecklist = this.checklistItems.length > 0;
        const hasExisting = (scope === 'planning' && hasPlanning) || 
                           (scope === 'checklist' && hasChecklist) ||
                           (scope === 'both' && (hasPlanning || hasChecklist));

        let overwrite = false;
        if (hasExisting) {
            const scopeLabel = scope === 'planning' ? 'projectplanning taken' :
                              scope === 'checklist' ? 'checklist items' : 'planning taken en checklist items';
            const ok = confirm(
                `Er zijn al ${scopeLabel} voor deze tender.\n\n` +
                `Wil je de huidige items VERVANGEN door de standaard template?\n\n` +
                `⚠️ Bestaande items worden verwijderd.`
            );
            if (!ok) return;
            overwrite = true;
        }

        // Loading state
        const body = this.modal?.querySelector('#planning-modal-body');
        if (body) {
            body.innerHTML = `<div class="planning-loading">
                <div class="planning-spinner"></div>
                <span>Template laden...</span>
            </div>`;
        }

        try {
            const result = await planningService.populateFromTemplates(
                tenderId, 
                'Standaard',
                overwrite
            );

            console.log('✅ Template geladen:', result);

            if (result.skipped) {
                alert(result.message || 'Template niet geladen — er bestaan al items.');
                this.renderContent();
                return;
            }

            // Herlaad alle data
            await this.loadData();

            // Succes feedback
            const msg = [];
            if (result.planning_taken > 0) msg.push(`${result.planning_taken} planning taken`);
            if (result.checklist_items > 0) msg.push(`${result.checklist_items} checklist items`);
            
            if (msg.length > 0) {
                console.log(`✅ Template toegepast: ${msg.join(', ')}`);
            }

        } catch (error) {
            console.error('❌ Template laden error:', error);
            alert('Fout bij laden van template: ' + error.message);
            this.renderContent();
        }
    }

    _notifyUpdate() {
        if (this.onUpdate) {
            this.onUpdate(this.tender?.id);
        }
    }
}

export default PlanningModal;