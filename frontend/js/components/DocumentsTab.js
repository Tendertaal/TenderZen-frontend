// frontend/js/components/DocumentsTab.js
// VERSIE: 20250129_1400 - UI/UX consistent met Planning en Checklist tabs
// Drag-and-drop upload, compacte document lijst

import apiService from '../services/ApiService.js';
import { showToast } from '../utils/toast.js';

export class DocumentsTab {
  constructor(container, tenderId) {
    this.container = container;
    this.tenderId = tenderId;
    this.uploadedFiles = [];
    this.isLoading = false;
    this.isDragging = false;
    this.apiService = apiService;
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

  async render() {
    await this.loadDocuments();

    const fileCount = this.uploadedFiles.length;

    this.container.innerHTML = `
      <div class="documents-tab documents-tab--compact">
        <style>${this.getStyles()}</style>
        
        <div class="content-card">
          <!-- Header -->
          <div class="documents-header">
            <div class="documents-header-left">
              <div class="documents-icon">
                ${this.getIcon('folderOpen', 32)}
              </div>
              <div>
                <h3 class="documents-title">Aanbestedingsstukken</h3>
                <p class="documents-subtitle">Upload alle relevante documenten voor deze tender.</p>
              </div>
            </div>
            <div class="documents-header-right">
              <div class="documents-badge ${fileCount > 0 ? 'has-files' : ''}">
                <span class="badge-dot"></span>
                <span>${fileCount} ${fileCount === 1 ? 'document' : 'documenten'}</span>
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
      .documents-tab--compact .documents-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 20px 24px;
        border-bottom: 1px solid #e2e8f0;
        margin: -24px -24px 24px -24px;
        background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
        border-radius: 12px 12px 0 0;
      }
      
      .documents-header-left {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .documents-icon {
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .documents-icon svg {
        stroke: #2563eb;
      }
      
      .documents-title {
        font-size: 18px;
        font-weight: 600;
        color: #1e40af;
        margin: 0 0 4px 0;
      }
      
      .documents-subtitle {
        font-size: 14px;
        color: #3b82f6;
        margin: 0;
      }
      
      .documents-badge {
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
      
      .documents-badge.has-files {
        background: #1e40af;
        color: #fff;
      }
      
      .badge-dot {
        width: 8px;
        height: 8px;
        background: #3b82f6;
        border-radius: 50%;
      }
      
      .documents-badge.has-files .badge-dot {
        background: #93c5fd;
      }
      
      /* Upload Zone */
      .upload-zone {
        border: 2px dashed #cbd5e1;
        border-radius: 12px;
        padding: 40px 20px;
        text-align: center;
        background: #f8fafc;
        transition: all 0.2s;
        cursor: pointer;
        margin-bottom: 24px;
      }
      
      .upload-zone:hover {
        border-color: #3b82f6;
        background: #eff6ff;
      }
      
      .upload-zone.dragging {
        border-color: #3b82f6;
        background: #dbeafe;
        border-style: solid;
      }
      
      .upload-zone-icon {
        width: 64px;
        height: 64px;
        background: #e0e7ff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
      }
      
      .upload-zone-icon svg {
        stroke: #4f46e5;
      }
      
      .upload-zone-title {
        font-size: 16px;
        font-weight: 600;
        color: #334155;
        margin: 0 0 8px 0;
      }
      
      .upload-zone-text {
        font-size: 14px;
        color: #64748b;
        margin: 0 0 4px 0;
      }
      
      .upload-zone-formats {
        font-size: 12px;
        color: #94a3b8;
      }
      
      /* Document List */
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
        padding: 14px 16px;
        border-bottom: 1px solid #f1f5f9;
        gap: 12px;
        transition: background-color 0.15s;
      }
      
      .document-item:last-child {
        border-bottom: none;
      }
      
      .document-item:hover {
        background: #f8fafc;
      }
      
      .document-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .document-icon.pdf { background: #fee2e2; }
      .document-icon.pdf svg { stroke: #dc2626; }
      
      .document-icon.doc { background: #dbeafe; }
      .document-icon.doc svg { stroke: #2563eb; }
      
      .document-icon.xls { background: #dcfce7; }
      .document-icon.xls svg { stroke: #16a34a; }
      
      .document-icon.default { background: #f1f5f9; }
      .document-icon.default svg { stroke: #64748b; }
      
      .document-info {
        flex: 1;
        min-width: 0;
      }
      
      .document-name {
        font-size: 14px;
        font-weight: 500;
        color: #1e293b;
        margin: 0 0 2px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .document-meta {
        font-size: 12px;
        color: #94a3b8;
        display: flex;
        gap: 8px;
      }
      
      .document-actions {
        display: flex;
        gap: 4px;
        opacity: 0;
        transition: opacity 0.15s;
      }
      
      .document-item:hover .document-actions {
        opacity: 1;
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
      
      .btn-doc-action.delete:hover {
        background: #fee2e2;
        color: #dc2626;
      }
      
      /* Empty State */
      .documents-empty {
        text-align: center;
        padding: 20px;
        color: #64748b;
      }
      
      .documents-empty p {
        margin: 0;
        font-size: 14px;
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
      .documents-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        padding-top: 16px;
        border-top: 1px solid #e2e8f0;
      }
      
      .btn-continue {
        display: flex;
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
      
      .btn-continue:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }
      
      .btn-continue:disabled {
        background: #e2e8f0;
        color: #94a3b8;
        cursor: not-allowed;
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
      
      const response = await this.apiService.request(
        `/api/v1/ai-documents/tenders/${this.tenderId}/documents`,
        { method: 'GET' }
      );

      if (response.success && response.documents) {
        this.uploadedFiles = response.documents;
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      this.uploadedFiles = [];
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
    const hasFiles = this.uploadedFiles.length > 0;

    return `
      <!-- Upload Zone -->
      <div class="upload-zone" id="upload-zone">
        <input 
          type="file" 
          id="file-upload-input" 
          accept=".pdf,.doc,.docx,.xlsx,.xls"
          multiple
          style="display: none;"
        />
        <div class="upload-zone-icon">
          ${this.getIcon('upload', 28)}
        </div>
        <p class="upload-zone-title">Sleep bestanden hierheen of klik om te uploaden</p>
        <p class="upload-zone-text">Upload de aanbestedingsleidraad en andere relevante documenten</p>
        <p class="upload-zone-formats">PDF, Word, Excel • Max 10MB per bestand</p>
      </div>

      <!-- Document List -->
      ${hasFiles ? `
        <div class="documents-list-header">
          <span class="documents-list-title">Geüploade documenten</span>
        </div>
        <div class="documents-list">
          ${this.uploadedFiles.map(file => this.renderDocumentItem(file)).join('')}
        </div>
      ` : `
        <div class="documents-empty">
          <p>Nog geen documenten geüpload</p>
        </div>
      `}

      <!-- Tip Box -->
      <div class="tip-box">
        <div class="tip-box-icon">
          ${this.getIcon('lightbulb', 20)}
        </div>
        <div class="tip-box-content">
          <strong>Tip:</strong> Upload minimaal de Aanbestedingsleidraad. 
          Hoe meer documenten je upload, hoe beter de AI je kan helpen met het genereren van documenten.
        </div>
      </div>

      <!-- Footer -->
      <div class="documents-footer">
        <button class="btn-continue" data-action="continue" ${!hasFiles ? 'disabled' : ''}>
          Doorgaan naar AI Workflow
          ${this.getIcon('chevronRight', 18)}
        </button>
      </div>
    `;
  }

  renderDocumentItem(file) {
    const ext = this.getFileExtension(file.original_file_name);
    const iconClass = this.getIconClass(ext);

    return `
      <div class="document-item" data-file-id="${file.id}">
        <div class="document-icon ${iconClass}">
          ${this.getIcon('fileText', 20)}
        </div>
        <div class="document-info">
          <p class="document-name" title="${file.original_file_name}">${file.original_file_name}</p>
          <div class="document-meta">
            <span>${this.formatFileSize(file.file_size)}</span>
            <span>•</span>
            <span>${this.formatDate(file.uploaded_at)}</span>
          </div>
        </div>
        <div class="document-actions">
          <button class="btn-doc-action" data-action="preview" data-file-id="${file.id}" title="Preview">
            ${this.getIcon('eye', 16)}
          </button>
          <button class="btn-doc-action delete" data-action="remove" data-file-id="${file.id}" title="Verwijderen">
            ${this.getIcon('trash', 16)}
          </button>
        </div>
      </div>
    `;
  }

  getFileExtension(filename) {
    return filename.split('.').pop().toLowerCase();
  }

  getIconClass(ext) {
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    if (['xls', 'xlsx'].includes(ext)) return 'xls';
    return 'default';
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
  }

  formatDate(dateString) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  attachEventListeners() {
    const uploadZone = this.container.querySelector('#upload-zone');
    const fileInput = this.container.querySelector('#file-upload-input');

    // Click to upload
    if (uploadZone && fileInput) {
      uploadZone.addEventListener('click', () => fileInput.click());
      
      // Drag and drop
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragging');
      });

      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragging');
      });

      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragging');
        const files = Array.from(e.dataTransfer.files);
        this.handleFiles(files);
      });

      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        this.handleFiles(files);
        e.target.value = '';
      });
    }

    // Remove buttons
    this.container.querySelectorAll('[data-action="remove"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleRemoveFile(e);
      });
    });

    // Preview buttons
    this.container.querySelectorAll('[data-action="preview"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handlePreviewFile(e);
      });
    });

    // Continue button
    const continueBtn = this.container.querySelector('[data-action="continue"]');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => this.handleContinue());
    }
  }

  async handleFiles(files) {
    if (files.length === 0) return;

    showToast(`${files.length} bestand(en) uploaden...`, 'info');

    for (const file of files) {
      await this.uploadFile(file);
    }

    await this.loadDocuments();
    await this.render();
  }

  async uploadFile(file) {
    try {
      const maxSize = 10485760; // 10MB
      if (file.size > maxSize) {
        showToast(`"${file.name}" is te groot (max 10MB)`, 'error');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', this.guessDocumentType(file.name));

      const token = await this.apiService.getAuthToken();
      const url = `${this.apiService.baseURL}/api/v1/ai-documents/tenders/${this.tenderId}/documents/upload`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
      }

      const result = await response.json();
      if (result.success) {
        showToast(`"${file.name}" geüpload`, 'success');
      }

    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
      showToast(`Fout bij uploaden: ${error.message}`, 'error');
    }
  }

  async handleRemoveFile(event) {
    const fileId = event.target.closest('[data-file-id]').dataset.fileId;
    const file = this.uploadedFiles.find(f => f.id === fileId);

    if (!file || !confirm(`"${file.original_file_name}" verwijderen?`)) {
      return;
    }

    try {
      await this.apiService.request(
        `/api/v1/ai-documents/tenders/${this.tenderId}/documents/${fileId}`,
        { method: 'DELETE' }
      );

      showToast('Document verwijderd', 'success');
      await this.loadDocuments();
      await this.render();

    } catch (error) {
      console.error('Error deleting file:', error);
      showToast('Fout bij verwijderen', 'error');
    }
  }

  handlePreviewFile(event) {
    const fileId = event.target.closest('[data-file-id]').dataset.fileId;
    const file = this.uploadedFiles.find(f => f.id === fileId);

    if (file) {
      showToast('Preview komt binnenkort beschikbaar', 'info');
    }
  }

  handleContinue() {
    if (this.uploadedFiles.length === 0) {
      showToast('Upload minimaal één document', 'warning');
      return;
    }

    const event = new CustomEvent('switchTab', { detail: { tab: 'ai-workflow' } });
    this.container.dispatchEvent(event);
  }

  guessDocumentType(filename) {
    const lower = filename.toLowerCase();
    if (lower.includes('aanbesteding') || lower.includes('leidraad')) return 'aanbestedingsleidraad';
    if (lower.includes('eisen') || lower.includes('pve')) return 'pve';
    if (lower.includes('gunning')) return 'gunningscriteria';
    return 'bijlagen';
  }

  destroy() {
    // Cleanup
  }
}