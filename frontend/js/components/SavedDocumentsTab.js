// frontend/js/components/SavedDocumentsTab.js
// VERSIE: 20250129_1430 - Gegenereerde Documenten tab
// Toont AI-gegenereerde documenten met download/edit opties

import apiService from '../services/ApiService.js';
import { showToast } from '../utils/toast.js';

export class SavedDocumentsTab {
  constructor(container, tenderId, options = {}) {
    this.container = container;
    this.tenderId = tenderId;
    this.onNavigateToWorkflow = options.onNavigateToWorkflow || (() => {});
    this.documents = [];
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
      'concept': { label: 'Concept', color: '#f59e0b', bgColor: '#fef3c7' },
      'review': { label: 'Review', color: '#8b5cf6', bgColor: '#f3e8ff' },
      'definitief': { label: 'Definitief', color: '#10b981', bgColor: '#dcfce7' }
    };
  }

  async render() {
    await this.loadDocuments();

    const docCount = this.documents.length;

    this.container.innerHTML = `
      <div class="saved-documents-tab saved-documents-tab--compact">
        <style>${this.getStyles()}</style>
        
        <div class="content-card">
          <!-- Header - ALTIJD TONEN -->
          <div class="saved-header">
            <div class="saved-header-left">
              <div class="saved-icon">
                ${this.getIcon('fileCheck', 32)}
              </div>
              <div>
                <h3 class="saved-title">Gegenereerde Documenten</h3>
                <p class="saved-subtitle">Documenten gegenereerd met AI voor deze tender</p>
              </div>
            </div>
            <div class="saved-header-right">
              <div class="saved-badge ${docCount > 0 ? 'has-docs' : ''}">
                <span class="badge-dot"></span>
                <span>${docCount} ${docCount === 1 ? 'document' : 'documenten'}</span>
              </div>
            </div>
          </div>

          ${this.isLoading ? this.renderLoading() : this.renderContent()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  getStyles() {
    return `
      .saved-documents-tab--compact .saved-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 24px;
        border-bottom: 1px solid #e2e8f0;
        margin: -24px -24px 24px -24px;
        background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
        border-radius: 12px 12px 0 0;
      }
      
      .saved-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .saved-icon {
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .saved-icon svg {
        stroke: #7c3aed;
      }
      
      .saved-title {
        font-size: 18px;
        font-weight: 600;
        color: #5b21b6;
        margin: 0 0 4px 0;
      }
      
      .saved-subtitle {
        font-size: 14px;
        color: #7c3aed;
        margin: 0;
      }
      
      .saved-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: #fff;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 500;
        color: #64748b;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      }
      
      .saved-badge.has-docs {
        background: #5b21b6;
        color: #fff;
      }
      
      .saved-badge .badge-dot {
        width: 8px;
        height: 8px;
        background: #8b5cf6;
        border-radius: 50%;
      }
      
      .saved-badge.has-docs .badge-dot {
        background: #c4b5fd;
      }
      
      /* Empty State */
      .saved-empty {
        padding: 60px 40px;
        text-align: center;
      }
      
      .empty-icon {
        width: 80px;
        height: 80px;
        background: #f3e8ff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
      }
      
      .empty-icon svg {
        stroke: #a78bfa;
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
      
      .btn-to-workflow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-to-workflow:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      }
      
      /* Documents List */
      .documents-list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      
      .documents-list-title {
        font-size: 13px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .documents-list {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        overflow: hidden;
        margin-bottom: 20px;
      }
      
      .document-item {
        display: flex;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #f1f5f9;
        gap: 14px;
        transition: background-color 0.15s;
      }
      
      .document-item:last-child {
        border-bottom: none;
      }
      
      .document-item:hover {
        background: #faf5ff;
      }
      
      .document-icon {
        width: 44px;
        height: 44px;
        background: #f3e8ff;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .document-icon svg {
        stroke: #8b5cf6;
      }
      
      .document-info {
        flex: 1;
        min-width: 0;
      }
      
      .document-name {
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .document-meta {
        font-size: 12px;
        color: #64748b;
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      
      .document-template {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .document-template svg {
        stroke: #94a3b8;
      }
      
      .document-status {
        flex-shrink: 0;
      }
      
      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.3px;
      }
      
      .status-badge.concept {
        background: #fef3c7;
        color: #b45309;
      }
      
      .status-badge.review {
        background: #f3e8ff;
        color: #7c3aed;
      }
      
      .status-badge.definitief {
        background: #dcfce7;
        color: #15803d;
      }
      
      .document-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
      }
      
      .btn-doc-action {
        padding: 8px;
        border: none;
        background: transparent;
        color: #94a3b8;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-doc-action:hover {
        background: #f1f5f9;
        color: #475569;
      }
      
      .btn-doc-action.download:hover {
        background: #dcfce7;
        color: #16a34a;
      }
      
      .btn-doc-action.edit:hover {
        background: #dbeafe;
        color: #2563eb;
      }
      
      .btn-doc-action.delete:hover {
        background: #fee2e2;
        color: #dc2626;
      }
      
      /* Tip Box */
      .tip-box {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 16px;
        background: #fefce8;
        border: 1px solid #fde047;
        border-radius: 10px;
        margin-bottom: 20px;
      }
      
      .tip-box-icon {
        flex-shrink: 0;
        color: #ca8a04;
      }
      
      .tip-box-content {
        font-size: 13px;
        color: #854d0e;
        line-height: 1.5;
      }
      
      .tip-box-content strong {
        font-weight: 600;
      }
      
      /* Footer */
      .saved-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      
      .btn-workflow {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s;
      }
      
      .btn-workflow:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      }
      
      /* Loading */
      .loading-state {
        padding: 40px 20px;
        text-align: center;
        color: #64748b;
      }
    `;
  }

  async loadDocuments() {
    try {
      this.isLoading = true;
      
      // Laad gegenereerde documenten van API
      const response = await apiService.request(
        `/api/v1/ai-documents/tenders/${this.tenderId}/generated`,
        { method: 'GET' }
      );

      if (response.success && response.documents) {
        this.documents = response.documents;
      }
    } catch (error) {
      console.error('Error loading generated documents:', error);
      this.documents = [];
    } finally {
      this.isLoading = false;
    }
  }

  renderLoading() {
    return `
      <div class="loading-state">
        <p>Documenten laden...</p>
      </div>
    `;
  }

  renderContent() {
    const hasDocuments = this.documents.length > 0;

    if (!hasDocuments) {
      return this.renderEmptyState();
    }

    return this.renderDocumentsList();
  }

  renderEmptyState() {
    return `
      <div class="saved-empty">
        <div class="empty-icon">
          ${this.getIcon('fileCheck', 40)}
        </div>
        <h3 class="empty-title">Nog geen documenten gegenereerd</h3>
        <p class="empty-text">
          Je hebt nog geen documenten gegenereerd met AI. 
          Ga naar de AI Workflow om documenten te genereren op basis van je templates.
        </p>
        <button class="btn-to-workflow" data-action="go-to-workflow">
          ${this.getIcon('sparkles', 18)}
          Naar AI Workflow
        </button>
      </div>
    `;
  }

  renderDocumentsList() {
    return `
      <!-- Documents List -->
      <div class="documents-list-header">
        <span class="documents-list-title">Gegenereerde documenten</span>
      </div>
      <div class="documents-list">
        ${this.documents.map(doc => this.renderDocumentItem(doc)).join('')}
      </div>

      <!-- Tip Box -->
      <div class="tip-box">
        <div class="tip-box-icon">
          ${this.getIcon('lightbulb', 20)}
        </div>
        <div class="tip-box-content">
          <strong>Tip:</strong> Controleer gegenereerde documenten altijd voordat je ze indient. 
          Gebruik de bewerk-functie om aanpassingen te maken.
        </div>
      </div>

      <!-- Footer -->
      <div class="saved-footer">
        <button class="btn-workflow" data-action="go-to-workflow">
          ${this.getIcon('sparkles', 16)}
          Naar AI Workflow
        </button>
      </div>
    `;
  }

  renderDocumentItem(doc) {
    const statusConfig = this.getStatusConfig();
    const status = doc.status || 'concept';
    const statusInfo = statusConfig[status] || statusConfig['concept'];

    return `
      <div class="document-item" data-doc-id="${doc.id}">
        <div class="document-icon">
          ${this.getIcon('fileText', 22)}
        </div>
        <div class="document-info">
          <p class="document-name" title="${this.escapeHtml(doc.name)}">${this.escapeHtml(doc.name)}</p>
          <div class="document-meta">
            <span class="document-template">
              ${this.getIcon('sparkles', 12)}
              ${this.escapeHtml(doc.template_name || 'Onbekende template')}
            </span>
            <span>•</span>
            <span>${this.formatDate(doc.created_at)}</span>
          </div>
        </div>
        <div class="document-status">
          <span class="status-badge ${status}">${statusInfo.label}</span>
        </div>
        <div class="document-actions">
          <button class="btn-doc-action download" data-action="download" data-doc-id="${doc.id}" title="Downloaden">
            ${this.getIcon('download', 16)}
          </button>
          <button class="btn-doc-action edit" data-action="edit" data-doc-id="${doc.id}" title="Bewerken">
            ${this.getIcon('edit', 16)}
          </button>
          <button class="btn-doc-action copy" data-action="copy" data-doc-id="${doc.id}" title="Kopiëren">
            ${this.getIcon('copy', 16)}
          </button>
          <button class="btn-doc-action delete" data-action="delete" data-doc-id="${doc.id}" title="Verwijderen">
            ${this.getIcon('trash', 16)}
          </button>
        </div>
      </div>
    `;
  }

  formatDate(dateString) {
    if (!dateString) return '';
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
    // Go to workflow buttons
    this.container.querySelectorAll('[data-action="go-to-workflow"]').forEach(btn => {
      btn.addEventListener('click', () => this.onNavigateToWorkflow());
    });

    // Download buttons
    this.container.querySelectorAll('[data-action="download"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = e.currentTarget.dataset.docId;
        this.handleDownload(docId);
      });
    });

    // Edit buttons
    this.container.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = e.currentTarget.dataset.docId;
        this.handleEdit(docId);
      });
    });

    // Copy buttons
    this.container.querySelectorAll('[data-action="copy"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = e.currentTarget.dataset.docId;
        this.handleCopy(docId);
      });
    });

    // Delete buttons
    this.container.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const docId = e.currentTarget.dataset.docId;
        this.handleDelete(docId);
      });
    });
  }

  async handleDownload(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    try {
      showToast('Document downloaden...', 'info');
      
      // TODO: Implementeer echte download via API
      // const response = await apiService.request(`/api/v1/ai-documents/generated/${docId}/download`);
      
      showToast('Download functie komt binnenkort', 'info');
    } catch (error) {
      console.error('Error downloading document:', error);
      showToast('Fout bij downloaden', 'error');
    }
  }

  handleEdit(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    // TODO: Open document editor
    showToast('Bewerken functie komt binnenkort', 'info');
  }

  async handleCopy(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    try {
      // TODO: Kopieer document content naar clipboard
      if (doc.content) {
        await navigator.clipboard.writeText(doc.content);
        showToast('Document gekopieerd naar clipboard', 'success');
      } else {
        showToast('Geen content om te kopiëren', 'warning');
      }
    } catch (error) {
      console.error('Error copying document:', error);
      showToast('Kopiëren mislukt', 'error');
    }
  }

  async handleDelete(docId) {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return;

    if (!confirm(`"${doc.name}" verwijderen?`)) return;

    try {
      await apiService.request(
        `/api/v1/ai-documents/generated/${docId}`,
        { method: 'DELETE' }
      );

      showToast('Document verwijderd', 'success');
      await this.loadDocuments();
      await this.render();
    } catch (error) {
      console.error('Error deleting document:', error);
      showToast('Fout bij verwijderen', 'error');
    }
  }

  destroy() {
    // Cleanup
  }
}