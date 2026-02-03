// frontend/js/components/SaveResultModal.js

import { AIDocumentService } from '../services/AIDocumentService.js';
import { showToast } from '../utils/toast.js';

export class SaveResultModal {
  constructor(template, tenderId, promptUsed) {
    this.template = template;
    this.tenderId = tenderId;
    this.promptUsed = promptUsed;
    this.modal = null;
    this.service = new AIDocumentService();
  }

  show() {
    this.render();
    document.body.style.overflow = 'hidden';
  }

  render() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'save-result-modal';
    overlay.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <div class="modal-title">
                        <span>${this.template.template_icon}</span>
                        <span>Resultaat Opslaan - ${this.template.template_name}</span>
                    </div>
                    <button class="modal-close" data-action="close">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="doc-title">Document Titel</label>
                        <input 
                            type="text" 
                            id="doc-title" 
                            class="form-input"
                            value="${this.template.template_name} - ${this.getTenderName()}"
                            placeholder="Geef het document een titel"
                        />
                    </div>
                    <div class="form-group">
                        <label for="doc-content">Gegenereerde Content</label>
                        <textarea 
                            id="doc-content" 
                            class="form-textarea"
                            rows="15"
                            placeholder="Paste hier de output van Claude.ai..."
                        ></textarea>
                        <div class="form-help">
                            💡 Tip: Copy de hele output van Claude.ai (Ctrl+A, Ctrl+C) 
                            en paste het hier (Ctrl+V)
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Metadata (optioneel)</label>
                        <div class="metadata-inputs">
                            <label class="checkbox-label">
                                <input type="checkbox" id="meta-user-edited" />
                                <span>Ik heb de prompt aangepast</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-action="close">
                        Annuleren
                    </button>
                    <button class="btn btn-primary" data-action="save">
                        <span>💾</span>
                        <span>Opslaan</span>
                    </button>
                </div>
            </div>
        `;
    document.body.appendChild(overlay);
    this.modal = overlay;
    this.attachEventListeners();
    setTimeout(() => {
      document.getElementById('doc-content').focus();
    }, 100);
  }

  attachEventListeners() {
    this.modal.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escHandler);
    const saveBtn = this.modal.querySelector('[data-action="save"]');
    saveBtn.addEventListener('click', () => this.save());
  }

  async save() {
    const title = document.getElementById('doc-title').value.trim();
    const content = document.getElementById('doc-content').value.trim();
    const userEdited = document.getElementById('meta-user-edited').checked;
    if (!title) {
      showToast('❌ Vul een titel in', 'error');
      return;
    }
    if (!content) {
      showToast('❌ Paste de gegenereerde content', 'error');
      return;
    }
    const saveBtn = this.modal.querySelector('[data-action="save"]');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳</span><span>Opslaan...</span>';
    try {
      const docData = {
        template_key: this.template.template_key,
        document_title: title,
        document_content: content,
        prompt_used: this.promptUsed,
        metadata: {
          generation_info: {
            method: 'manual',
            claude_model: 'opus-4.5',
            user_edited_prompt: userEdited
          }
        }
      };
      await this.service.saveDocument(this.tenderId, docData);
      showToast('✅ Document opgeslagen!', 'success');
      this.close();
      window.dispatchEvent(new CustomEvent('ai-document-saved', {
        detail: { template_key: this.template.template_key }
      }));
    } catch (error) {
      console.error('Error saving document:', error);
      showToast('❌ Fout bij opslaan: ' + error.message, 'error');
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾</span><span>Opslaan</span>';
    }
  }

  close() {
    document.removeEventListener('keydown', this.escHandler);
    document.body.style.overflow = 'auto';
    this.modal.remove();
  }

  getTenderName() {
    // TODO: Get actual tender name from state/props
    return 'Tender'; // Placeholder
  }
}
