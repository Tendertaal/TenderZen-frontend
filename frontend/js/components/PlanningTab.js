// frontend/js/components/PlanningTab.js
// VERSIE: 20250129_1300 - Compacte UI: label + datum op één rij
// Verbeterde UX met inline date pickers

import apiService from '../services/ApiService.js';
import { showToast } from '../utils/toast.js';

export class PlanningTab {
  constructor(container, tenderId, options = {}) {
    this.container = container;
    this.tenderId = tenderId;
    this.onNavigateToWorkflow = options.onNavigateToWorkflow || (() => {});
    this.tender = null;
    this.isLoading = true;
  }

  /**
   * Get icon HTML from window.Icons
   */
  getIcon(name, size = 18, color = null) {
    const Icons = window.Icons;
    
    if (Icons && typeof Icons[name] === 'function') {
      const options = { size };
      if (color) options.color = color;
      return Icons[name](options);
    }
    
    console.warn(`Icon '${name}' not found in window.Icons`);
    return '';
  }

  /**
   * Configuratie van alle planningsvelden - gegroepeerd
   */
  getPlanningFieldsConfig() {
    return [
      {
        group: 'publicatie',
        groupLabel: 'Publicatie',
        groupIcon: 'fileText',
        groupColor: '#3b82f6',
        fields: [
          { field: 'publicatie_datum', label: 'Publicatiedatum', type: 'date', hint: 'Datum waarop aanbesteding is gepubliceerd' }
        ]
      },
      {
        group: 'schouw',
        groupLabel: 'Schouw & Locatiebezoek',
        groupIcon: 'eye',
        groupColor: '#8b5cf6',
        fields: [
          { field: 'schouw_datum', label: 'Schouw / Locatiebezoek', type: 'date', hint: 'Datum voor locatiebezoek' }
        ]
      },
      {
        group: 'nvi',
        groupLabel: 'Nota van Inlichtingen',
        groupIcon: 'helpCircle',
        groupColor: '#f59e0b',
        fields: [
          { field: 'nvi1_datum', altField: 'nvi_1_deadline', label: 'NVI 1 - Vragen indienen', type: 'datetime', hint: 'Deadline vragen ronde 1' },
          { field: 'nvi_1_publicatie', label: 'NVI 1 - Publicatie', type: 'date', hint: 'Publicatie antwoorden ronde 1' },
          { field: 'nvi2_datum', altField: 'nvi_2_deadline', label: 'NVI 2 - Vragen indienen', type: 'datetime', hint: 'Deadline vragen ronde 2' },
          { field: 'nvi_2_publicatie', label: 'NVI 2 - Publicatie', type: 'date', hint: 'Publicatie antwoorden ronde 2' }
        ]
      },
      {
        group: 'indiening',
        groupLabel: 'Indiening',
        groupIcon: 'clock',
        groupColor: '#dc2626',
        fields: [
          { field: 'interne_deadline', label: 'Interne Deadline', type: 'date', hint: 'Interne review deadline', isInternal: true },
          { field: 'deadline_indiening', altField: 'deadline_inschrijving', label: 'Deadline Indiening', type: 'datetime', hint: 'Officiële deadline', isPrimary: true }
        ]
      },
      {
        group: 'beoordeling',
        groupLabel: 'Beoordeling & Presentatie',
        groupIcon: 'users',
        groupColor: '#6366f1',
        fields: [
          { field: 'presentatie_datum', label: 'Presentatie / Interview', type: 'date', hint: 'Datum presentatie' }
        ]
      },
      {
        group: 'gunning',
        groupLabel: 'Gunning',
        groupIcon: 'award',
        groupColor: '#10b981',
        fields: [
          { field: 'voorlopige_gunning', label: 'Voorlopige Gunning', type: 'date', hint: 'Verwachte voorlopige gunning' },
          { field: 'definitieve_gunning', label: 'Definitieve Gunning', type: 'date', hint: 'Verwachte definitieve gunning' }
        ]
      },
      {
        group: 'uitvoering',
        groupLabel: 'Contract & Uitvoering',
        groupIcon: 'play',
        groupColor: '#0ea5e9',
        fields: [
          { field: 'start_uitvoering', label: 'Start Uitvoering', type: 'date', hint: 'Startdatum contract' },
          { field: 'einde_contract', label: 'Einde Contract', type: 'date', hint: 'Einddatum contract' }
        ]
      }
    ];
  }

  async render() {
    await this.loadTenderData();

    const groups = this.getPlanningFieldsConfig();
    const stats = this.calculateStats(groups);

    this.container.innerHTML = `
      <div class="planning-tab planning-tab--compact">
        <style>${this.getStyles()}</style>
        
        <div class="content-card">
          <!-- Header -->
          <div class="planning-header">
            <div class="planning-header-left">
              <div class="planning-icon">
                ${this.getIcon('calendar', 32)}
              </div>
              <div>
                <h3 class="planning-title">Tenderplanning</h3>
                <p class="planning-subtitle">Beheer alle belangrijke deadlines en mijlpalen voor deze tender.</p>
              </div>
            </div>
            <div class="planning-header-right">
              <div class="completion-badge ${stats.percentage === 100 ? 'complete' : ''}">
                <span class="completion-dot"></span>
                <span>${stats.filled}/${stats.total} ingevuld</span>
              </div>
            </div>
          </div>

          ${this.isLoading ? this.renderLoading() : this.renderContent(groups)}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  getStyles() {
    return `
      .planning-tab--compact .planning-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 24px;
        border-bottom: 1px solid #e2e8f0;
        margin: -24px -24px 24px -24px;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
        border-radius: 12px 12px 0 0;
      }
      
      .planning-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .planning-icon {
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .planning-icon svg {
        stroke: #2563eb;
      }
      
      .planning-title {
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 4px 0;
      }
      
      .planning-subtitle {
        font-size: 14px;
        color: #64748b;
        margin: 0;
      }
      
      .completion-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #f1f5f9;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        color: #64748b;
      }
      
      .completion-badge.complete {
        background: #dcfce7;
        color: #16a34a;
      }
      
      .completion-dot {
        width: 8px;
        height: 8px;
        background: #10b981;
        border-radius: 50%;
      }
      
      /* Group Styles */
      .planning-group {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        margin-bottom: 16px;
        overflow: hidden;
      }
      
      .group-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .group-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .group-title {
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
        flex: 1;
      }
      
      .group-count {
        font-size: 12px;
        color: #94a3b8;
        background: #f1f5f9;
        padding: 4px 10px;
        border-radius: 12px;
      }
      
      .group-count.complete {
        background: #dcfce7;
        color: #16a34a;
      }
      
      /* Field Row - COMPACT */
      .field-row {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        border-bottom: 1px solid #f1f5f9;
        gap: 16px;
        transition: background-color 0.15s;
      }
      
      .field-row:last-child {
        border-bottom: none;
      }
      
      .field-row:hover {
        background: #fafbfc;
      }
      
      .field-row.has-value {
        background: #fafffe;
      }
      
      .field-label {
        flex: 0 0 220px;
        font-size: 14px;
        color: #374151;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .field-label .badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .badge-primary {
        background: #fee2e2;
        color: #dc2626;
      }
      
      .badge-internal {
        background: #fef3c7;
        color: #d97706;
      }
      
      .field-input-wrapper {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .field-date-input {
        padding: 8px 12px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 14px;
        color: #1e293b;
        background: #fff;
        min-width: 180px;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      
      .field-date-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .field-date-input::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: 0.6;
      }
      
      .field-date-input::-webkit-calendar-picker-indicator:hover {
        opacity: 1;
      }
      
      /* Empty state */
      .field-date-input:not(:valid):not(:focus) {
        color: #94a3b8;
      }
      
      .field-relative {
        font-size: 12px;
        color: #64748b;
        min-width: 100px;
      }
      
      .field-relative.urgent {
        color: #dc2626;
        font-weight: 500;
      }
      
      .field-relative.soon {
        color: #f59e0b;
      }
      
      .field-relative.past {
        color: #10b981;
      }
      
      .field-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      
      .field-row:hover .field-actions {
        opacity: 1;
      }
      
      .btn-clear {
        padding: 6px;
        border: none;
        background: transparent;
        color: #94a3b8;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
      }
      
      .btn-clear:hover {
        background: #fee2e2;
        color: #dc2626;
      }
      
      /* Footer */
      .planning-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      
      .btn-export {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        border: 1px solid #e2e8f0;
        background: #fff;
        color: #374151;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-export:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      
      .planning-meta {
        font-size: 12px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      /* Loading */
      .loading-state {
        padding: 60px 20px;
        text-align: center;
        color: #64748b;
      }
    `;
  }

  async loadTenderData() {
    try {
      this.isLoading = true;
      const response = await apiService.getTender(this.tenderId);
      if (response) {
        this.tender = response;
      }
    } catch (error) {
      console.error('Error loading tender:', error);
      showToast('Fout bij laden van planning', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  calculateStats(groups) {
    let total = 0;
    let filled = 0;

    for (const group of groups) {
      for (const field of group.fields) {
        total++;
        const value = this.getFieldValue(field);
        if (value) filled++;
      }
    }

    return { total, filled, percentage: Math.round((filled / total) * 100) };
  }

  getFieldValue(field) {
    if (!this.tender) return null;
    let value = this.tender[field.field];
    if (!value && field.altField) {
      value = this.tender[field.altField];
    }
    return value;
  }

  renderLoading() {
    return `
      <div class="loading-state">
        <p>Planning laden...</p>
      </div>
    `;
  }

  renderContent(groups) {
    return `
      <div class="planning-groups">
        ${groups.map(group => this.renderGroup(group)).join('')}
      </div>
      
      <div class="planning-footer">
        <button class="btn-export" data-action="export-planning">
          ${this.getIcon('download', 16)}
          Exporteren
        </button>
        ${this.tender?.updated_at ? `
          <span class="planning-meta">
            ${this.getIcon('clock', 14)}
            Laatst bijgewerkt: ${this.formatDate(this.tender.updated_at)}
          </span>
        ` : ''}
      </div>
    `;
  }

  renderGroup(group) {
    const filledCount = group.fields.filter(f => this.getFieldValue(f)).length;
    const totalCount = group.fields.length;

    return `
      <div class="planning-group" data-group="${group.group}">
        <div class="group-header">
          <div class="group-icon" style="background-color: ${group.groupColor}15; color: ${group.groupColor}">
            ${this.getIcon(group.groupIcon, 18)}
          </div>
          <h4 class="group-title">${group.groupLabel}</h4>
          <span class="group-count ${filledCount === totalCount ? 'complete' : ''}">${filledCount}/${totalCount}</span>
        </div>
        <div class="group-fields">
          ${group.fields.map(field => this.renderFieldRow(field)).join('')}
        </div>
      </div>
    `;
  }

  renderFieldRow(field) {
    const value = this.getFieldValue(field);
    const hasValue = !!value;
    const inputType = field.type === 'datetime' ? 'datetime-local' : 'date';
    const formattedValue = this.formatForInput(value, field.type);
    
    // Relative date text
    let relativeText = '';
    let relativeClass = '';
    if (hasValue) {
      const daysUntil = this.getDaysUntil(new Date(value));
      relativeText = this.getRelativeDate(value);
      if (daysUntil < 0) relativeClass = 'past';
      else if (daysUntil <= 3) relativeClass = 'urgent';
      else if (daysUntil <= 7) relativeClass = 'soon';
    }

    return `
      <div class="field-row ${hasValue ? 'has-value' : ''}" data-field="${field.field}">
        <div class="field-label">
          ${field.label}
          ${field.isPrimary ? '<span class="badge badge-primary">Deadline</span>' : ''}
          ${field.isInternal ? '<span class="badge badge-internal">Intern</span>' : ''}
        </div>
        
        <div class="field-input-wrapper">
          <input 
            type="${inputType}" 
            class="field-date-input" 
            data-field="${field.field}"
            data-type="${field.type}"
            value="${formattedValue}"
            title="${field.hint || ''}"
            placeholder="Selecteer datum"
          />
          ${hasValue ? `<span class="field-relative ${relativeClass}">${relativeText}</span>` : ''}
        </div>
        
        <div class="field-actions">
          ${hasValue ? `
            <button class="btn-clear" data-action="clear-field" data-field="${field.field}" title="Wissen">
              ${this.getIcon('x', 14)}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  formatForInput(value, type) {
    if (!value) return '';
    
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';

    if (type === 'datetime') {
      return date.toISOString().slice(0, 16);
    } else {
      return date.toISOString().slice(0, 10);
    }
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getDaysUntil(dateObj) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateObj);
    target.setHours(0, 0, 0, 0);
    const diffTime = target - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  getRelativeDate(dateString) {
    const daysUntil = this.getDaysUntil(new Date(dateString));
    
    if (daysUntil < -1) return `${Math.abs(daysUntil)}d geleden`;
    if (daysUntil === -1) return 'Gisteren';
    if (daysUntil === 0) return 'Vandaag';
    if (daysUntil === 1) return 'Morgen';
    if (daysUntil <= 7) return `Over ${daysUntil}d`;
    if (daysUntil <= 30) return `Over ${Math.ceil(daysUntil / 7)}w`;
    return `Over ${Math.ceil(daysUntil / 30)}m`;
  }

  attachEventListeners() {
    // Date input changes - auto-save
    this.container.querySelectorAll('.field-date-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const field = e.target.dataset.field;
        const value = e.target.value || null;
        this.saveField(field, value);
      });
    });

    // Clear field buttons
    this.container.querySelectorAll('[data-action="clear-field"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const field = e.currentTarget.dataset.field;
        this.clearField(field);
      });
    });

    // Export button
    const exportBtn = this.container.querySelector('[data-action="export-planning"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.handleExport());
    }
  }

  async saveField(fieldName, value) {
    try {
      await apiService.updateTender(this.tenderId, {
        [fieldName]: value
      });

      this.tender[fieldName] = value;
      showToast('Datum opgeslagen', 'success');
      
      // Re-render to update relative dates and stats
      this.render();

    } catch (error) {
      console.error('Error saving field:', error);
      showToast('Fout bij opslaan', 'error');
    }
  }

  async clearField(fieldName) {
    const input = this.container.querySelector(`[data-field="${fieldName}"].field-date-input`);
    if (input) {
      input.value = '';
    }
    await this.saveField(fieldName, null);
  }

  handleExport() {
    if (!this.tender) {
      showToast('Geen planning om te exporteren', 'warning');
      return;
    }

    const tenderName = this.tender.naam || this.tender.title || 'Tender';
    const groups = this.getPlanningFieldsConfig();

    let text = `TENDERPLANNING: ${tenderName}\n`;
    text += `${'='.repeat(50)}\n\n`;

    for (const group of groups) {
      text += `${group.groupLabel.toUpperCase()}\n`;
      text += `${'-'.repeat(30)}\n`;

      for (const field of group.fields) {
        const value = this.getFieldValue(field);
        const dateStr = value ? new Date(value).toLocaleDateString('nl-NL') : '[ - ]';
        text += `${field.label}: ${dateStr}\n`;
      }
      text += '\n';
    }

    text += `\nGeëxporteerd op ${new Date().toLocaleDateString('nl-NL')}`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Planning gekopieerd naar clipboard', 'success');
    }).catch(() => {
      showToast('Kopiëren mislukt', 'error');
    });
  }

  destroy() {
    // Cleanup
  }
}