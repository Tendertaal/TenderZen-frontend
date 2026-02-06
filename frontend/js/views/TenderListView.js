/**
 * TenderListView - Lijst weergave met tender cards
 * TenderZen v3.1 - Per-Card Headers
 * 
 * DOEL-PAD:  Frontend/js/views/TenderListView.js
 *
 * CHANGELOG v3.1:
 * - VERWIJDERD: Globale HeadersRow (nu per kaart in TenderCard v3.3)
 * - VERWIJDERD: setupStickyHeader / cleanupStickyHeader
 * - VERWIJDERD: HeadersRow import
 *
 * CHANGELOG v3.0:
 * - Event selectors aangepast voor nieuwe component class names
 */

import { BaseView } from './BaseView.js';
import { faseService } from '../services/FaseService.js';
import { AIDocumentenModal } from '../components/AIDocumentenModal.js';
import { SmartImportPanel } from '../components/SmartImportPanel.js';
import { SmartImportWizard } from '../components/SmartImportWizard.js';
import { TenderCard } from '../components/TenderCard.js';
import { planningService } from '../services/PlanningService.js';

export class TenderListView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.fase = options.fase;
        this.filteredTenders = [];
        
        this.searchQuery = '';
        this.onSearchResultsCount = null;

        this.allFaseStatussen = {};
        this.faseConfig = {};
        
        this.smartImportPanel = null;
        this.smartImportWizard = null;
        
        this.initSmartImport();
    }

    initSmartImport() {
        this.smartImportPanel = new SmartImportPanel({
            onReanalyzeComplete: (tenderId, newData) => {
                console.log('✅ Reanalyze complete for tender:', tenderId);
                if (this.onTenderUpdated) {
                    this.onTenderUpdated(tenderId);
                }
            },
            onClose: () => {
                console.log('Smart Import Panel closed');
            }
        });
        this.injectSmartImportStyles();
    }
    
    injectSmartImportStyles() {
        if (document.getElementById('smart-import-inline-styles')) return;
        const styleSheet = document.createElement('style');
        styleSheet.id = 'smart-import-inline-styles';
        styleSheet.textContent = `
            .ai-badge {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 4px 8px; border-radius: 12px; font-size: 11px;
                font-weight: 600; cursor: pointer; transition: all 0.2s ease;
                margin-left: 8px; flex-shrink: 0;
            }
            .ai-badge.ai-badge--new {
                background: linear-gradient(135deg, #f1f5f9, #e2e8f0);
                border: 1px dashed #94a3b8; color: #64748b;
            }
            .ai-badge.ai-badge--new:hover {
                background: linear-gradient(135deg, #e0f2fe, #bae6fd);
                border: 1px solid #7dd3fc; color: #0369a1;
                transform: scale(1.05); box-shadow: 0 2px 8px rgba(3,105,161,0.2);
            }
            .ai-badge.ai-badge--haiku {
                background: linear-gradient(135deg, #e0f2fe, #bae6fd);
                border: 1px solid #7dd3fc; color: #0369a1;
            }
            .ai-badge.ai-badge--haiku:hover {
                background: linear-gradient(135deg, #bae6fd, #7dd3fc);
                transform: scale(1.05); box-shadow: 0 2px 8px rgba(3,105,161,0.3);
            }
            .ai-badge.ai-badge--pro {
                background: linear-gradient(135deg, #fef3c7, #fde68a);
                border: 1px solid #fbbf24; color: #92400e;
            }
            .ai-badge.ai-badge--pro:hover {
                background: linear-gradient(135deg, #fde68a, #fcd34d);
                transform: scale(1.05); box-shadow: 0 2px 8px rgba(251,191,36,0.4);
            }
            .ai-badge .badge-icon { font-size: 12px; }
            .ai-badge .badge-label { letter-spacing: 0.3px; }
            .tender-name-row {
                display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
            }
            .tender-name-row .tender-name { margin: 0; }
        `;
        document.head.appendChild(styleSheet);
    }

    getIcon(name, size = 14, color = null) {
        const Icons = window.Icons;
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        console.warn(`Icon '${name}' not found`);
        return '';
    }

    async setTenders(tenders) {
        this.tenders = tenders || [];
        this.filteredTenders = this.filterTenders(this.tenders);
        await this.loadAllFaseStatussen();
        this.notifySearchResultsCount();
        if (this.container) this.render();

        try {
            const counts = await planningService.getAllCounts();
            if (counts && Object.keys(counts).length > 0) {
                for (const tender of this.tenders) {
                    const c = counts[tender.id];
                    if (c) {
                        tender._planningCounts = { done: c.planning_done, total: c.planning_total };
                        tender._checklistCounts = { done: c.checklist_done, total: c.checklist_total };
                    }
                }
                this.filteredTenders = this.filterTenders(this.tenders);
                if (this.container) this.render();
            }
        } catch (e) {
            console.warn('⚠️ Planning counts niet geladen:', e.message);
        }
    }
    
    setSearchQuery(query) {
        this.searchQuery = query?.toLowerCase()?.trim() || '';
        this.filteredTenders = this.filterTenders(this.tenders);
        this.notifySearchResultsCount();
        if (this.container) this.render();
        console.log(`🔍 TenderListView: Zoeken op "${this.searchQuery}", ${this.filteredTenders.length} resultaten`);
    }

    notifySearchResultsCount() {
        if (this.onSearchResultsCount && this.searchQuery) {
            this.onSearchResultsCount(this.filteredTenders.length);
        }
    }

    getSearchResultsCount() {
        return this.searchQuery ? this.filteredTenders.length : null;
    }

    clearSearchQuery() {
        this.setSearchQuery('');
    }

    async loadAllFaseStatussen() {
        const fases = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];
        const faseConfigs = await faseService.getFases();
        faseConfigs.forEach(config => { this.faseConfig[config.fase] = config; });
        for (const fase of fases) {
            if (!this.allFaseStatussen[fase]) {
                try {
                    this.allFaseStatussen[fase] = await faseService.getStatussenVoorFase(fase);
                } catch (error) {
                    console.error(`Error loading statussen for fase ${fase}:`, error);
                    this.allFaseStatussen[fase] = [];
                }
            }
        }
    }

    getFaseKleur(fase) {
        const kleuren = { 'acquisitie': '#f59e0b', 'inschrijvingen': '#8b5cf6', 'ingediend': '#10b981', 'archief': '#64748b' };
        return this.faseConfig[fase]?.kleur || kleuren[fase] || '#6366f1';
    }

    filterTenders(tenders) {
        if (!tenders) return [];
        let filtered = tenders;
        if (this.fase === null || this.fase === undefined) {
            filtered = filtered.filter(t => t.fase !== 'archief');
        } else {
            filtered = filtered.filter(t => t.fase === this.fase);
        }
        if (this.searchQuery && this.searchQuery.length > 0) {
            const query = this.searchQuery;
            filtered = filtered.filter(tender => {
                return [tender.naam, tender.opdrachtgever, tender.aanbestedende_dienst,
                        tender.locatie, tender.tender_nummer, tender.bedrijfsnaam, tender.beschrijving]
                    .some(field => field && field.toLowerCase().includes(query));
            });
        }
        return filtered;
    }

    render() {
        if (!this.container) return;
        if (!this.filteredTenders || this.filteredTenders.length === 0) {
            this.container.innerHTML = this.searchQuery ? this.renderNoSearchResults() : this.renderEmptyState();
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'tender-list-view';

        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'tender-cards-container';
        cardsContainer.innerHTML = this.filteredTenders.map(t => this.renderTenderCard(t)).join('');
        wrapper.appendChild(cardsContainer);

        this.container.innerHTML = '';
        this.container.appendChild(wrapper);
        this.attachEventListeners();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderNoSearchResults() {
        return `<div class="empty-state empty-state--search">
            <div class="empty-state-icon">${this.getIcon('search', 48)}</div>
            <div class="empty-state-title">Geen resultaten gevonden</div>
            <div class="empty-state-text">Er zijn geen tenders gevonden voor "<strong>${this.escapeHtml(this.searchQuery)}</strong>"</div>
            <div class="empty-state-hint">Probeer een andere zoekterm of pas je filters aan.</div>
        </div>`;
    }

    handleSort(column, direction) {
        this.filteredTenders.sort((a, b) => {
            let valA = a[column], valB = b[column];
            if (valA == null) return 1;
            if (valB == null) return -1;
            if (column.includes('datum') || column.includes('deadline')) { valA = new Date(valA); valB = new Date(valB); }
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        const cc = this.container.querySelector('.tender-cards-container');
        if (cc) { cc.innerHTML = this.filteredTenders.map(t => this.renderTenderCard(t)).join(''); this.attachEventListeners(); }
    }

    renderTenderCard(tender) {
        const card = new TenderCard(tender, {
            searchQuery: this.searchQuery,
            allFaseStatussen: this.allFaseStatussen,
            planningCounts: tender._planningCounts || null,
            checklistCounts: tender._checklistCounts || null
        });
        return card.render();
    }

    // =========================================================================
    // SMART IMPORT
    // =========================================================================

    async handleAIBadgeClick(tenderId, smartImportId, hasAnalysis) {
        const tender = this.tenders.find(t => t.id === tenderId);
        const tenderNaam = tender?.naam || 'Tender';
        const tenderBureauId = tender?.tenderbureau_id || null;
        this.ensureWizardExists(tenderId);
        if (tenderBureauId) this.smartImportWizard.overrideBureauId = tenderBureauId;
        if (hasAnalysis && smartImportId) {
            await this.smartImportWizard.openForExistingAnalysis(smartImportId, tenderId, tenderNaam);
        } else {
            this.smartImportWizard.openAsModal(tenderId, tenderNaam);
        }
    }
    
    ensureWizardExists(tenderId) {
        if (!this.smartImportWizard) {
            let wc = document.getElementById('smart-import-wizard-container');
            if (!wc) { wc = document.createElement('div'); wc.id = 'smart-import-wizard-container'; document.body.appendChild(wc); }
            this.smartImportWizard = new SmartImportWizard({
                container: wc,
                onComplete: async (result) => { if (this.onTenderUpdated) this.onTenderUpdated(tenderId); this.smartImportWizard.close(); },
                onCancel: () => { this.smartImportWizard.close(); }
            });
        }
    }

    async openSmartImportWizard(tenderId) {
        const tender = this.tenders.find(t => t.id === tenderId);
        this.ensureWizardExists(tenderId);
        if (tender?.tenderbureau_id) this.smartImportWizard.overrideBureauId = tender.tenderbureau_id;
        this.smartImportWizard.openAsModal(tenderId, tender?.naam || 'Tender');
    }

    async openSmartImportPanel(smartImportId, tenderId) {
        const tender = this.tenders.find(t => t.id === tenderId);
        this.ensureWizardExists(tenderId);
        await this.smartImportWizard.openForExistingAnalysis(smartImportId, tenderId, tender?.naam || 'Tender');
    }

    // =========================================================================
    // DATUM HELPERS
    // =========================================================================

    getDaysUntil(dateString) {
        if (!dateString) return null;
        const t = new Date(dateString), today = new Date();
        today.setHours(0,0,0,0); t.setHours(0,0,0,0);
        return Math.ceil((t - today) / 86400000);
    }

    hasExplicitTime(dateString) {
        if (!dateString) return false;
        const m = dateString.match(/T(\d{2}):(\d{2})/);
        if (!m) return false;
        return parseInt(m[1],10) !== 0 || parseInt(m[2],10) !== 0;
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    attachEventListeners() {
        // Status dropdown toggle
        this.container.querySelectorAll('.tch-status-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation(); e.preventDefault();
                const dd = trigger.closest('.tch-status-dropdown');
                const row = trigger.closest('.tender-row');
                const isOpen = dd.classList.contains('is-open');
                this.container.querySelectorAll('.tch-status-dropdown.is-open').forEach(d => {
                    d.classList.remove('is-open'); d.closest('.tender-row').classList.remove('dropdown-open');
                });
                if (!isOpen) { dd.classList.add('is-open'); row.classList.add('dropdown-open'); }
            });
        });

        // Status dropdown select
        this.container.querySelectorAll('.tch-dropdown-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const dd = option.closest('.tch-status-dropdown');
                const row = dd.closest('.tender-row');
                const tenderId = dd.dataset.tenderId;
                const newStatus = option.dataset.value;
                const newFase = option.dataset.fase;
                const currentFase = dd.dataset.currentFase;
                dd.querySelector('.tch-status-value').textContent = option.textContent.trim();
                if (newFase !== currentFase) {
                    const badge = row.querySelector('.tch-fase-badge');
                    if (badge) { badge.textContent = newFase.toUpperCase(); badge.className = 'tch-fase-badge tch-fase-badge--' + newFase; }
                    row.className = row.className.replace(/phase-\w+/, 'phase-' + newFase);
                    dd.dataset.currentFase = newFase;
                }
                dd.querySelectorAll('.tch-dropdown-option').forEach(o => o.classList.remove('is-selected'));
                option.classList.add('is-selected');
                dd.classList.remove('is-open'); row.classList.remove('dropdown-open');
                if (this.onStatusChange) this.onStatusChange(tenderId, newStatus, newFase);
            });
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.container) return;
            if (!e.target.closest('.tch-status-dropdown')) {
                this.container.querySelectorAll('.tch-status-dropdown.is-open').forEach(d => {
                    d.classList.remove('is-open'); d.closest('.tender-row').classList.remove('dropdown-open');
                });
            }
        });

        // AI Docs button
        this.container.querySelectorAll('[data-action="open-ai-docs"]').forEach(btn => {
            btn.addEventListener('click', async (e) => { e.stopPropagation(); const modal = new AIDocumentenModal(btn.dataset.tenderId); await modal.show(); });
        });

        // Settings button
        this.container.querySelectorAll('[data-action="open-settings"]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); if (this.onTenderClick) this.onTenderClick(btn.dataset.tenderId); });
        });

        // Team edit button
        this.container.querySelectorAll('[data-action="edit-team"]').forEach(btn => {
            btn.addEventListener('click', (e) => { e.stopPropagation(); if (this.onAddTeamMember) this.onAddTeamMember(btn.dataset.tenderId); });
        });
        
        // AI Badge
        this.container.querySelectorAll('.tcb-ai-badge').forEach(badge => {
            badge.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.handleAIBadgeClick(badge.dataset.tenderId, badge.dataset.smartImportId, badge.dataset.hasAnalysis === 'true');
            });
        });
        
        // Timeline cells
        this.container.querySelectorAll('.timeline-cell--editable').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openDatePicker(cell, cell.dataset.tenderId, cell.dataset.field, cell.dataset.date || '');
            });
        });

        // Planning/Checklist shortcuts
        this.container.querySelectorAll('.tcf-shortcut').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const openType = btn.dataset.action === 'open-checklist' ? 'checklist' : 'planning';
                if (this.onOpenPlanningModal) this.onOpenPlanningModal(btn.dataset.tenderId, openType);
            });
        });
    }

    // =========================================================================
    // INLINE DATE PICKER
    // =========================================================================
    
    openDatePicker(cell, tenderId, fieldName, currentDate) {
        this.closeDatePicker();
        let inputValue = '';
        if (currentDate) {
            const d = new Date(currentDate);
            if (!isNaN(d.getTime())) {
                inputValue = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            }
        }
        const picker = document.createElement('div');
        picker.className = 'inline-date-picker';
        picker.innerHTML = `
            <div class="date-picker-header">
                <span class="date-picker-title">${this.getFieldLabel(fieldName)}</span>
                <button class="date-picker-close" title="Sluiten">×</button>
            </div>
            <div class="date-picker-inputs">
                <div class="date-picker-field"><label>Datum</label><input type="date" class="date-picker-date" value="${inputValue ? inputValue.split('T')[0] : ''}"></div>
                <div class="date-picker-field"><label>Tijd <span class="optional-label">(optioneel)</span></label><input type="time" class="date-picker-time" value="${inputValue ? inputValue.split('T')[1] || '' : ''}"></div>
            </div>
            <div class="date-picker-actions">
                ${currentDate ? '<button class="date-picker-clear">Wissen</button>' : ''}
                <button class="date-picker-save">Opslaan</button>
            </div>`;
        const rect = cell.getBoundingClientRect();
        picker.style.cssText = `position:fixed;top:${rect.bottom+4}px;left:${rect.left}px;z-index:10000`;
        document.body.appendChild(picker);
        const pr = picker.getBoundingClientRect();
        if (pr.right > window.innerWidth) picker.style.left = `${window.innerWidth - pr.width - 16}px`;
        if (pr.bottom > window.innerHeight) picker.style.top = `${rect.top - pr.height - 4}px`;
        this.activeDatePicker = picker;
        const dateInput = picker.querySelector('.date-picker-date'), timeInput = picker.querySelector('.date-picker-time');
        dateInput.focus();
        picker.querySelector('.date-picker-close').addEventListener('click', () => this.closeDatePicker());
        picker.querySelector('.date-picker-save').addEventListener('click', async () => { await this.saveDateChange(tenderId, fieldName, this.combineDateTimeInputs(dateInput.value, timeInput.value), cell); this.closeDatePicker(); });
        const clearBtn = picker.querySelector('.date-picker-clear');
        if (clearBtn) clearBtn.addEventListener('click', async () => { await this.saveDateChange(tenderId, fieldName, null, cell); this.closeDatePicker(); });
        const kd = async (e) => {
            if (e.key === 'Enter') { await this.saveDateChange(tenderId, fieldName, this.combineDateTimeInputs(dateInput.value, timeInput.value), cell); this.closeDatePicker(); }
            if (e.key === 'Escape') this.closeDatePicker();
        };
        dateInput.addEventListener('keydown', kd); timeInput.addEventListener('keydown', kd);
        setTimeout(() => document.addEventListener('click', this.handleOutsideClick), 10);
    }
    
    combineDateTimeInputs(dateValue, timeValue) {
        if (!dateValue) return null;
        return timeValue ? `${dateValue}T${timeValue}:00` : `${dateValue}T00:00:00`;
    }
    
    handleOutsideClick = (e) => { if (this.activeDatePicker && !this.activeDatePicker.contains(e.target)) this.closeDatePicker(); }
    closeDatePicker() { if (this.activeDatePicker) { this.activeDatePicker.remove(); this.activeDatePicker = null; } document.removeEventListener('click', this.handleOutsideClick); }
    
    async saveDateChange(tenderId, fieldName, newDate, cell) {
        try {
            cell.classList.add('is-saving');
            const updateData = { [fieldName]: newDate };
            if (window.apiService?.updateTender) { await window.apiService.updateTender(tenderId, updateData); }
            else { const sb = window.supabaseClient || window.supabase; if (sb) { const { error } = await sb.from('tenders').update(updateData).eq('id', tenderId); if (error) throw error; } }
            const tender = this.tenders.find(t => t.id === tenderId);
            if (tender) tender[fieldName] = newDate;
            cell.dataset.date = newDate || '';
            this.updateCellDisplay(cell, newDate, fieldName);
        } catch (error) { console.error('❌ Error saving date:', error); alert('Fout bij opslaan van datum'); }
        finally { cell.classList.remove('is-saving'); }
    }
    
    updateCellDisplay(cell, date, fieldName) {
        const isDeadline = fieldName === 'deadline_indiening';
        if (!date) { cell.innerHTML = '<div class="date-display empty"><span class="date-add-icon">+</span></div>'; return; }
        const d = new Date(date), day = d.getDate(), month = d.toLocaleDateString('nl-NL', { month: 'short' });
        const isPast = d < new Date(), daysUntil = this.getDaysUntil(date);
        const hasTime = this.hasExplicitTime(date);
        let timeStr = hasTime ? `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` : null;
        let cls = ['filled'], bc = 'ok';
        if (isPast) cls = ['completed'];
        else if (isDeadline) { if (daysUntil <= 3) { cls = ['urgent']; bc = 'urgent'; } else if (daysUntil <= 7) { cls = ['soon']; bc = 'soon'; } else { cls = ['deadline']; } }
        const showBadge = isDeadline && !isPast && daysUntil !== null;
        cell.innerHTML = `<div class="date-display ${cls.join(' ')} ${hasTime?'has-time':''}"><span class="date-day">${day}</span><span class="date-month">${month}</span>${hasTime?`<span class="date-time">${timeStr}</span>`:''}</div>${showBadge?`<div class="days-to-deadline ${bc}">${daysUntil===0?'Vandaag!':daysUntil===1?'Morgen':daysUntil+' dagen'}</div>`:''}`;
    }
    
    getFieldLabel(fieldName) {
        return { 'publicatie_datum':'Publicatie','schouw_datum':'Schouw','nvi1_datum':'NvI 1','nvi2_datum':'NvI 2','presentatie_datum':'Presentatie','interne_deadline':'Interne deadline','deadline_indiening':'Deadline','voorlopige_gunning':'Voorlopige gunning','definitieve_gunning':'Definitieve gunning','start_uitvoering':'Start uitvoering' }[fieldName] || fieldName;
    }

    renderEmptyState() {
        return `<div class="empty-state"><div class="empty-state-icon">${this.getIcon('clipboardList', 48)}</div><div class="empty-state-title">Geen tenders gevonden</div><div class="empty-state-text">Maak een nieuwe tender aan of pas je filters aan.</div></div>`;
    }
}

export default TenderListView;