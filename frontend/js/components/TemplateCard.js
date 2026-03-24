// frontend/js/components/TemplateCard.js
// VERSIE: 20260305_1630 - Download .docx knop toegevoegd

import { PromptBox } from './PromptBox.js';
import { SaveResultModal } from './SaveResultModal.js';
import { AITemplateService } from '../services/AITemplateService.js';
import { AIDocumentService } from '../services/AIDocumentService.js';
import { showToast } from '../utils/toast.js';

export class TemplateCard {
  constructor(container, template, tenderId) {
    this.container = container;
    this.template = template;
    this.tenderId = tenderId;
    this.promptBox = null;
    this.service = new AITemplateService();
    this.docService = new AIDocumentService();
    this.element = null;
    this.isGenerating = false;
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
    const card = document.createElement('div');
    card.className = `template-card template-card--${this.template.color}`;
    card.innerHTML = `
      <div class="ai-template-card-top">
        <div class="ai-template-flow-number ai-template-flow-number--${this.template.color}">
          ${this.template.priority}
        </div>
        <div class="ai-template-card-header">
          <h3 class="ai-template-card-title">${this.template.template_name}</h3>
          <p class="ai-template-card-description">${this.template.beschrijving}</p>
        </div>
      </div>

      <div class="ai-template-prompt-section">
        <div class="ai-template-prompt-header">
          <div class="ai-template-prompt-title">
            <span class="prompt-title-icon">${this.getIcon('ai', 18)}</span>
            <span>AI Prompt (Claude.ai)</span>
          </div>
          <span class="ai-template-prompt-version">v${this.template.version || '1'}</span>
        </div>
        <div class="prompt-box-container"></div>
      </div>

      <div class="ai-template-instructions">
        <div class="ai-template-instructions-title">
          <span class="instructions-icon">${this.getIcon('lightbulb', 18)}</span>
          <span>Hoe te gebruiken:</span>
        </div>
        <ol class="ai-template-instructions-list">
          <li>Klik op "Genereer met AI" voor automatische generatie</li>
          <li>Of kopieer de prompt en gebruik Claude.ai handmatig</li>
          <li>Upload je brondocumenten (${this.getRecommendedDocsText()})</li>
          <li>Sla het resultaat op in TenderZen</li>
        </ol>
      </div>

      <div class="ai-generatie-status" id="generatie-status-${this.template.template_key}" style="display:none;">
        <div class="ai-generatie-progress">
          <div class="ai-generatie-spinner"></div>
          <span class="ai-generatie-tekst">Document wordt gegenereerd...</span>
        </div>
      </div>

      <div class="ai-generatie-resultaat" id="generatie-resultaat-${this.template.template_key}" style="display:none;">
        <div class="ai-generatie-resultaat-header">
          <span>${this.getIcon('check', 16)}</span>
          <span>Gegenereerd document</span>
          <span class="ai-generatie-model" id="generatie-model-${this.template.template_key}"></span>
        </div>
        <div class="ai-generatie-preview" id="generatie-preview-${this.template.template_key}"></div>
      </div>

      <div class="ai-template-card-actions">
        <button class="ai-template-btn ai-template-btn-secondary" data-action="copy-prompt">
          Copy Prompt
        </button>
        <button class="ai-template-btn ai-template-btn-secondary" data-action="open-claude">
          Open Claude.ai
        </button>
        <button class="ai-template-btn ai-template-btn-primary" data-action="genereer-ai" id="genereer-btn-${this.template.template_key}">
          ✨ Genereer met AI
        </button>
        <button class="ai-template-btn ai-template-btn-secondary" data-action="save-result">
          Resultaat Opslaan
        </button>
      </div>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(card);
    this.element = card;

    await this.renderPromptBox();
    this.attachEventListeners();
    await this.checkBestaandDocument();
  }

  async renderPromptBox() {
    try {
      if (!this.element) return;
      const promptContainer = this.element.querySelector('.prompt-box-container');
      if (!promptContainer) return;

      let prompt = 'Loading...';
      let promptInfo = null;
      try {
        const filled = await this.service.fillPromptVariables(
          this.template.template_key,
          this.tenderId
        );
        prompt = filled.filledPrompt || filled.filled_prompt || filled.prompt
          || this.template.prompt_template || 'Placeholder prompt...';
        promptInfo = filled.prompt_info || null;
      } catch (error) {
        prompt = this.template.prompt_template || 'Placeholder prompt...';
      }

      this.promptBox = new PromptBox(promptContainer, this.template, prompt, promptInfo);
      await this.promptBox.render();
    } catch (error) {
      console.error('Error in renderPromptBox:', error);
    }
  }

  async checkBestaandDocument() {
    try {
      const docs = await this.docService.getDocuments(this.tenderId, {
        template_key: this.template.template_key,
        latest_only: true
      });
      if (docs && docs.length > 0) {
        const doc = docs[0];
        this.toonResultaat(
          doc.document_content || doc.inhoud_tekst || '',
          doc.claude_model_used || doc.ai_model || '',
          doc.id  // ← documentId meegeven voor download knop
        );
        if (this.template.template_key === 'rode_draad' && doc.id) {
          this.toonDownstreamOptie(doc.id);
        }
      }
    } catch (e) {
      // Geen bestaand document
    }
  }

  getRecommendedDocsText() {
    if (!this.template.recommended_documents?.length) return 'relevante documenten';
    return this.template.recommended_documents.join(', ');
  }

  attachEventListeners() {
    if (!this.element) return;
    this.element.querySelector('[data-action="copy-prompt"]')
      ?.addEventListener('click', () => this.copyPrompt());
    this.element.querySelector('[data-action="open-claude"]')
      ?.addEventListener('click', () => this.openClaudeAI());
    this.element.querySelector('[data-action="genereer-ai"]')
      ?.addEventListener('click', () => this.genereerMetAI());
    this.element.querySelector('[data-action="save-result"]')
      ?.addEventListener('click', () => this.openSaveModal());
  }

  async genereerMetAI() {
    if (this.isGenerating) return;
    this.isGenerating = true;

    const btn = this.element.querySelector(`#genereer-btn-${this.template.template_key}`);
    const statusEl = this.element.querySelector(`#generatie-status-${this.template.template_key}`);
    const resultaatEl = this.element.querySelector(`#generatie-resultaat-${this.template.template_key}`);

    btn.disabled = true;
    btn.innerHTML = `⏳ Bezig...`;
    statusEl.style.display = 'block';
    resultaatEl.style.display = 'none';

    try {
      const result = await this.docService.generateDocument(
        this.tenderId,
        this.template.template_key
      );

      const content = result.document_content || result.inhoud_tekst || '';
      const model = result.claude_model_used || result.ai_model || 'claude';

      // ← documentId meegeven voor download knop
      this.toonResultaat(content, model, result.id);
      showToast(`✅ ${this.template.template_name} gegenereerd`, 'success');

      window.dispatchEvent(new CustomEvent('ai-document-saved', {
        detail: { template_key: this.template.template_key }
      }));

      if (this.template.template_key === 'rode_draad' && result.id) {
        this.toonDownstreamOptie(result.id);
      }

    } catch (error) {
      console.error('Generatie mislukt:', error);
      showToast(`❌ Generatie mislukt: ${error.message}`, 'error');
      statusEl.style.display = 'none';
    } finally {
      this.isGenerating = false;
      btn.disabled = false;
      btn.innerHTML = `✨ Opnieuw genereren`;
      statusEl.style.display = 'none';
    }
  }

  toonResultaat(content, model, documentId = null) {
    const resultaatEl = this.element?.querySelector(`#generatie-resultaat-${this.template.template_key}`);
    const previewEl = this.element?.querySelector(`#generatie-preview-${this.template.template_key}`);
    const modelEl = this.element?.querySelector(`#generatie-model-${this.template.template_key}`);
    if (!resultaatEl || !previewEl) return;

    const preview = content.length > 400 ? content.substring(0, 400) + '...' : content;
    previewEl.textContent = preview;
    if (modelEl) modelEl.textContent = model;

    // Bewaar document ID voor download
    if (documentId) {
      resultaatEl.dataset.documentId = documentId;
    }

    resultaatEl.style.display = 'block';

    // Download knop tonen/updaten
    this._updateDownloadButton(documentId);
  }

  _updateDownloadButton(documentId) {
    if (!documentId || !this.element) return;

    // Verwijder eventuele bestaande download knop
    this.element.querySelector('[data-action="download-docx"]')?.remove();

    const actiesEl = this.element.querySelector('.ai-template-card-actions');
    if (!actiesEl) return;

    const btn = document.createElement('button');
    btn.className = 'ai-template-btn ai-template-btn-secondary';
    btn.dataset.action = 'download-docx';
    btn.dataset.documentId = documentId;
    btn.innerHTML = `${this.getIcon('download', 16)}  Download .docx`;
    btn.addEventListener('click', () => this.downloadAsDocx(documentId));

    // Voeg in vóór "Resultaat Opslaan" knop
    const saveBtn = actiesEl.querySelector('[data-action="save-result"]');
    if (saveBtn) {
      actiesEl.insertBefore(btn, saveBtn);
    } else {
      actiesEl.appendChild(btn);
    }
  }

  async downloadAsDocx(documentId) {
    const btn = this.element?.querySelector('[data-action="download-docx"]');
    const origHtml = btn?.innerHTML;

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `${this.getIcon('refresh', 16)}  Bezig...`;
      }

      const token = localStorage.getItem('access_token');
      const baseUrl = window.CONFIG?.API_BASE_URL || '/api/v1';
      const url = `${baseUrl}/ai-documents/documents/${documentId}/download-docx`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Download mislukt (${response.status})`);
      }

      // Bestandsnaam uit Content-Disposition header
      const disposition = response.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
      const filename = filenameMatch ? filenameMatch[1] : `TenderZen_document.docx`;

      // Blob downloaden en browser-download triggeren
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      showToast(`✅ ${filename} gedownload`, 'success');

    } catch (error) {
      console.error('Download mislukt:', error);
      showToast(`❌ Download mislukt: ${error.message}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  toonDownstreamOptie(documentId) {
    const actiesEl = this.element?.querySelector('.ai-template-card-actions');
    if (!actiesEl) return;
    this.element.querySelector('[data-action="downstream"]')?.remove();
    const btn = document.createElement('button');
    btn.className = 'ai-template-btn ai-template-btn-primary';
    btn.dataset.action = 'downstream';
    btn.style.cssText = 'width:100%; margin-top:8px;';
    btn.innerHTML = `🔗 Tabs vullen met Rode Draad data`;
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('rode-draad-akkoord', {
        detail: { documentId, tenderId: this.tenderId }
      }));
    });
    actiesEl.appendChild(btn);
  }

  async copyPrompt() {
    try {
      const prompt = this.promptBox ? this.promptBox.getCurrentPrompt() : '';
      if (!prompt) { showToast('Geen prompt beschikbaar', 'warning'); return; }
      await navigator.clipboard.writeText(prompt);
      showToast('Prompt gekopieerd naar clipboard', 'success');
    } catch { showToast('Kopiëren mislukt', 'error'); }
  }

  openClaudeAI() {
    window.open('https://claude.ai/new', '_blank');
    showToast('Claude.ai geopend in nieuw tabblad', 'info');
  }

  openSaveModal() {
    const modal = new SaveResultModal(
      this.template, this.tenderId,
      this.promptBox ? this.promptBox.getCurrentPrompt() : ''
    );
    modal.show();
  }

  destroy() {
    if (this.promptBox) this.promptBox.destroy();
    this.element = null;
  }
}