// frontend/js/components/ChecklistTab.js
// VERSIE: 20250129_1330 - Inlever Checklist met compacte UI
// Toont alle in te dienen documenten met status tracking

import apiService from '../services/ApiService.js';
import { showToast } from '../utils/toast.js';

export class ChecklistTab {
  constructor(container, tenderId, options = {}) {
    this.container = container;
    this.tenderId = tenderId;
    this.onNavigateToWorkflow = options.onNavigateToWorkflow || (() => {});
    this.tender = null;
    this.checklistItems = [];
    this.isLoading = true;
  }

  getIcon(name, size = 18, color = null) {
    const Icons = window.Icons;
    if (Icons && typeof Icons[name] === 'function') {
      const options = { size };
      if (color) options.color = color;
      return Icons[name](options);
    }
    return '';
  }

  getStatusConfig() {
    return {
      'niet_gestart': { label: 'Niet gestart', color: '#94a3b8', bgColor: '#f1f5f9', icon: 'circle' },
      'in_bewerking': { label: 'In bewerking', color: '#f59e0b', bgColor: '#fef3c7', icon: 'clock' },
      'review': { label: 'Review', color: '#8b5cf6', bgColor: '#f3e8ff', icon: 'eye' },
      'gereed': { label: 'Gereed', color: '#10b981', bgColor: '#dcfce7', icon: 'checkCircle' }
    };
  }

  getCategoryConfig() {
    return {
      'Administratief': { icon: 'fileText', color: '#3b82f6' },
      'Technisch': { icon: 'settings', color: '#8b5cf6' },
      'Financieel': { icon: 'barChart', color: '#10b981' },
      'Overig': { icon: 'folderOpen', color: '#64748b' }
    };
  }

  async render() {
    await this.loadData();

    this.container.innerHTML = `
      <div class="checklist-tab checklist-tab--compact">
        <style>${this.getStyles()}</style>
        
        <div class="content-card">
          ${this.isLoading ? this.renderLoading() : this.renderContent()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  getStyles() {
    return `
      .checklist-tab--compact .checklist-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 24px;
        border-bottom: 1px solid #e2e8f0;
        margin: -24px -24px 24px -24px;
        background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        border-radius: 12px 12px 0 0;
      }
      
      .checklist-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .checklist-icon {
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #bbf7d0 0%, #86efac 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .checklist-icon svg {
        stroke: #16a34a;
      }
      
      .checklist-title {
        font-size: 18px;
        font-weight: 600;
        color: #166534;
        margin: 0 0 4px 0;
      }
      
      .checklist-subtitle {
        font-size: 14px;
        color: #15803d;
        margin: 0;
      }
      
      .checklist-stats {
        display: flex;
        gap: 12px;
      }
      
      .stat-badge {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: #fff;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      
      .stat-badge.complete {
        background: #166534;
        color: #fff;
      }
      
      .stat-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      
      .stat-dot.green { background: #10b981; }
      .stat-dot.amber { background: #f59e0b; }
      .stat-dot.gray { background: #94a3b8; }
      
      /* Empty State */
      .checklist-empty {
        padding: 60px 40px;
        text-align: center;
      }
      
      .empty-icon {
        width: 80px;
        height: 80px;
        background: #f1f5f9;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      }
      
      .empty-icon svg {
        stroke: #94a3b8;
      }
      
      .empty-title {
        font-size: 18px;
        font-weight: 600;
        color: #334155;
        margin: 0 0 8px 0;
      }
      
      .empty-text {
        font-size: 14px;
        color: #64748b;
        margin: 0 0 24px 0;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }
      
      .btn-generate {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-generate:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
      
      /* Category Groups */
      .checklist-category {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        margin-bottom: 16px;
        overflow: hidden;
      }
      
      .category-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 20px;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
      }
      
      .category-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .category-title {
        font-size: 15px;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
        flex: 1;
      }
      
      .category-progress {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .progress-bar {
        width: 60px;
        height: 6px;
        background: #e2e8f0;
        border-radius: 3px;
        overflow: hidden;
      }
      
      .progress-fill {
        height: 100%;
        background: #10b981;
        border-radius: 3px;
        transition: width 0.3s;
      }
      
      .progress-text {
        font-size: 12px;
        color: #64748b;
      }
      
      /* Checklist Items */
      .checklist-item {
        display: flex;
        align-items: center;
        padding: 12px 20px;
        border-bottom: 1px solid #f1f5f9;
        gap: 12px;
        transition: background-color 0.15s;
      }
      
      .checklist-item:last-child {
        border-bottom: none;
      }
      
      .checklist-item:hover {
        background: #fafbfc;
      }
      
      .checklist-item.completed {
        background: #f0fdf4;
      }
      
      .item-checkbox {
        width: 22px;
        height: 22px;
        border: 2px solid #cbd5e1;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        flex-shrink: 0;
      }
      
      .item-checkbox:hover {
        border-color: #10b981;
      }
      
      .item-checkbox.checked {
        background: #10b981;
        border-color: #10b981;
      }
      
      .item-checkbox.checked svg {
        stroke: #fff;
      }
      
      .item-content {
        flex: 1;
        min-width: 0;
      }
      
      .item-name {
        font-size: 14px;
        color: #1e293b;
        margin: 0 0 2px 0;
      }
      
      .item-name.completed {
        text-decoration: line-through;
        color: #64748b;
      }
      
      .item-notes {
        font-size: 12px;
        color: #94a3b8;
      }
      
      .item-badges {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
      }
      
      .item-badge {
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .item-badge.required {
        background: #fee2e2;
        color: #dc2626;
      }
      
      .item-badge.optional {
        background: #f1f5f9;
        color: #64748b;
      }
      
      .item-status {
        flex-shrink: 0;
      }
      
      .status-select {
        padding: 6px 28px 6px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        font-size: 12px;
        color: #334155;
        background: #fff url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e") right 6px center no-repeat;
        background-size: 16px;
        cursor: pointer;
        appearance: none;
        transition: all 0.15s;
      }
      
      .status-select:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      
      .item-actions {
        opacity: 0;
        transition: opacity 0.15s;
      }
      
      .checklist-item:hover .item-actions {
        opacity: 1;
      }
      
      .btn-delete-item {
        padding: 6px;
        border: none;
        background: transparent;
        color: #94a3b8;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-delete-item:hover {
        background: #fee2e2;
        color: #dc2626;
      }
      
      /* Footer */
      .checklist-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      
      .footer-actions {
        display: flex;
        gap: 8px;
      }
      
      .btn-action {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        border: 1px solid #e2e8f0;
        background: #fff;
        color: #374151;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-action:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
      }
      
      .btn-action.primary {
        background: #10b981;
        border-color: #10b981;
        color: #fff;
      }
      
      .btn-action.primary:hover {
        background: #059669;
      }
      
      .checklist-meta {
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

  async loadData() {
    try {
      this.isLoading = true;
      const response = await apiService.getTender(this.tenderId);
      
      if (response) {
        this.tender = response;
        
        // Parse checklist items from JSON
        if (this.tender.checklist_items) {
          try {
            this.checklistItems = JSON.parse(this.tender.checklist_items);
          } catch (e) {
            this.checklistItems = [];
          }
        }
      }
    } catch (error) {
      console.error('Error loading checklist:', error);
      showToast('Fout bij laden van checklist', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  renderLoading() {
    return `
      <div class="loading-state">
        <p>Checklist laden...</p>
      </div>
    `;
  }

  renderContent() {
    const stats = this.calculateStats();
    const hasItems = this.checklistItems.length > 0;

    return `
      <!-- Header - ALTIJD TONEN -->
      <div class="checklist-header">
        <div class="checklist-header-left">
          <div class="checklist-icon">
            ${this.getIcon('checkSquare', 32)}
          </div>
          <div>
            <h3 class="checklist-title">Inlever Checklist</h3>
            <p class="checklist-subtitle">Documenten voor indiening van deze tender</p>
          </div>
        </div>
        <div class="checklist-stats">
          <div class="stat-badge ${hasItems && stats.completed === stats.total ? 'complete' : ''}">
            <span class="stat-dot ${hasItems ? 'green' : 'gray'}"></span>
            <span>${hasItems ? `${stats.completed}/${stats.total} gereed` : '0 items'}</span>
          </div>
        </div>
      </div>

      ${hasItems ? this.renderChecklist() : this.renderEmptyState()}
    `;
  }

  renderEmptyState() {
    return `
      <div class="checklist-empty">
        <div class="empty-icon">
          ${this.getIcon('checkSquare', 40)}
        </div>
        <h3 class="empty-title">Nog geen checklist</h3>
        <p class="empty-text">
          Er is nog geen inlever checklist voor deze tender. 
          Gebruik de AI Workflow om automatisch een checklist te genereren op basis van de aanbestedingsdocumenten.
        </p>
        <button class="btn-generate" data-action="go-to-workflow">
          ${this.getIcon('sparkles', 18)}
          Checklist Genereren
        </button>
      </div>
    `;
  }

  renderChecklist() {
    const stats = this.calculateStats();
    const grouped = this.groupByCategory();
    const categoryConfig = this.getCategoryConfig();
    const categoryOrder = ['Administratief', 'Technisch', 'Financieel', 'Overig'];

    return `
      <!-- Categories -->
      <div class="checklist-categories">
        ${categoryOrder.map(category => {
          const items = grouped[category];
          if (!items || items.length === 0) return '';
          
          const config = categoryConfig[category] || categoryConfig['Overig'];
          const completedInCategory = items.filter(i => i.status === 'gereed').length;
          const progress = Math.round((completedInCategory / items.length) * 100);
          
          return `
            <div class="checklist-category" data-category="${category}">
              <div class="category-header">
                <div class="category-icon" style="background-color: ${config.color}15; color: ${config.color}">
                  ${this.getIcon(config.icon, 18)}
                </div>
                <h4 class="category-title">${category}</h4>
                <div class="category-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                  </div>
                  <span class="progress-text">${completedInCategory}/${items.length}</span>
                </div>
              </div>
              <div class="category-items">
                ${items.map((item, index) => this.renderItem(item, index)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Footer -->
      <div class="checklist-footer">
        <div class="footer-actions">
          <button class="btn-action" data-action="add-item">
            ${this.getIcon('plus', 16)}
            Item Toevoegen
          </button>
          <button class="btn-action" data-action="export-checklist">
            ${this.getIcon('download', 16)}
            Exporteren
          </button>
        </div>
        ${this.tender?.checklist_extracted_at ? `
          <span class="checklist-meta">
            ${this.getIcon('sparkles', 14)}
            Gegenereerd: ${this.formatDate(this.tender.checklist_extracted_at)}
          </span>
        ` : ''}
      </div>
    `;
  }

  renderItem(item, index) {
    const statusConfig = this.getStatusConfig();
    const isCompleted = item.status === 'gereed';

    return `
      <div class="checklist-item ${isCompleted ? 'completed' : ''}" data-index="${index}">
        <div class="item-checkbox ${isCompleted ? 'checked' : ''}" data-action="toggle-complete" data-index="${index}">
          ${isCompleted ? this.getIcon('check', 14) : ''}
        </div>
        
        <div class="item-content">
          <p class="item-name ${isCompleted ? 'completed' : ''}">${this.escapeHtml(item.name)}</p>
          ${item.notes ? `<p class="item-notes">${this.escapeHtml(item.notes)}</p>` : ''}
        </div>
        
        <div class="item-badges">
          <span class="item-badge ${item.required ? 'required' : 'optional'}">
            ${item.required ? 'Verplicht' : 'Optioneel'}
          </span>
        </div>
        
        <div class="item-status">
          <select class="status-select" data-action="change-status" data-index="${index}">
            ${Object.entries(statusConfig).map(([key, config]) => `
              <option value="${key}" ${item.status === key ? 'selected' : ''}>${config.label}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="item-actions">
          <button class="btn-delete-item" data-action="delete-item" data-index="${index}" title="Verwijderen">
            ${this.getIcon('trash', 14)}
          </button>
        </div>
      </div>
    `;
  }

  calculateStats() {
    const total = this.checklistItems.length;
    const completed = this.checklistItems.filter(i => i.status === 'gereed').length;
    const inProgress = this.checklistItems.filter(i => i.status === 'in_bewerking' || i.status === 'review').length;
    
    return { total, completed, inProgress };
  }

  groupByCategory() {
    const grouped = {};
    for (const item of this.checklistItems) {
      const category = item.category || 'Overig';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(item);
    }
    return grouped;
  }

  formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  attachEventListeners() {
    // Go to workflow
    this.container.querySelectorAll('[data-action="go-to-workflow"]').forEach(btn => {
      btn.addEventListener('click', () => this.onNavigateToWorkflow());
    });

    // Toggle complete
    this.container.querySelectorAll('[data-action="toggle-complete"]').forEach(el => {
      el.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.toggleComplete(index);
      });
    });

    // Change status
    this.container.querySelectorAll('[data-action="change-status"]').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const newStatus = e.target.value;
        this.updateStatus(index, newStatus);
      });
    });

    // Delete item
    this.container.querySelectorAll('[data-action="delete-item"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.deleteItem(index);
      });
    });

    // Add item
    const addBtn = this.container.querySelector('[data-action="add-item"]');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addItem());
    }

    // Export
    const exportBtn = this.container.querySelector('[data-action="export-checklist"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportChecklist());
    }
  }

  toggleComplete(index) {
    const item = this.checklistItems[index];
    if (!item) return;
    
    item.status = item.status === 'gereed' ? 'niet_gestart' : 'gereed';
    this.saveAndRender();
  }

  updateStatus(index, newStatus) {
    const item = this.checklistItems[index];
    if (!item) return;
    
    item.status = newStatus;
    this.saveAndRender();
  }

  async deleteItem(index) {
    if (!confirm('Weet je zeker dat je dit item wilt verwijderen?')) return;
    
    this.checklistItems.splice(index, 1);
    this.saveAndRender();
  }

  addItem() {
    const name = prompt('Documentnaam:');
    if (!name || !name.trim()) return;
    
    const category = prompt('Categorie (Administratief/Technisch/Financieel/Overig):', 'Overig');
    const required = confirm('Is dit document verplicht?');
    
    this.checklistItems.push({
      name: name.trim(),
      category: category || 'Overig',
      required,
      notes: '',
      status: 'niet_gestart'
    });
    
    this.saveAndRender();
  }

  async saveAndRender() {
    try {
      await apiService.updateTender(this.tenderId, {
        checklist_items: JSON.stringify(this.checklistItems)
      });
      this.render();
    } catch (error) {
      console.error('Error saving checklist:', error);
      showToast('Fout bij opslaan', 'error');
    }
  }

  exportChecklist() {
    const tenderName = this.tender?.naam || this.tender?.title || 'Tender';
    const grouped = this.groupByCategory();
    const statusConfig = this.getStatusConfig();

    let text = `INLEVER CHECKLIST: ${tenderName}\n`;
    text += `${'='.repeat(50)}\n\n`;

    const categoryOrder = ['Administratief', 'Technisch', 'Financieel', 'Overig'];
    
    for (const category of categoryOrder) {
      const items = grouped[category];
      if (!items || items.length === 0) continue;
      
      text += `${category.toUpperCase()}\n`;
      text += `${'-'.repeat(30)}\n`;
      
      for (const item of items) {
        const checkbox = item.status === 'gereed' ? '[✓]' : '[ ]';
        const status = statusConfig[item.status]?.label || 'Onbekend';
        const required = item.required ? '(Verplicht)' : '(Optioneel)';
        text += `${checkbox} ${item.name} ${required} - ${status}\n`;
      }
      text += '\n';
    }

    const stats = this.calculateStats();
    text += `${'='.repeat(50)}\n`;
    text += `Voortgang: ${stats.completed}/${stats.total} gereed\n`;
    text += `Geëxporteerd op ${new Date().toLocaleDateString('nl-NL')}`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('Checklist gekopieerd naar clipboard', 'success');
    }).catch(() => {
      showToast('Kopiëren mislukt', 'error');
    });
  }

  destroy() {
    // Cleanup
  }
}