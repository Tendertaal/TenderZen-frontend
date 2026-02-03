// Frontend/js/components/PromptBox.js
// VERSIE: 20250129_0930 - Knoppen zonder iconen

import { showToast } from '../utils/toast.js';
import { UserService } from '../services/UserService.js';

export class PromptBox {
  constructor(container, template, prompt, promptInfo = null) {
    this.container = container;
    this.template = template;
    this.prompt = prompt;
    this.promptInfo = promptInfo;
  }

  getIcon(name, size = 16, color = null) {
    const Icons = window.Icons;
    if (Icons && typeof Icons[name] === 'function') {
      const options = { size };
      if (color) options.color = color;
      return Icons[name](options);
    }
    return '';
  }

  async render() {
    const canEditPrompt = await this.canEdit();

    this.container.innerHTML = `
      <div class="ai-template-prompt-description">
        ${this.getPromptDescription()}
        ${canEditPrompt ? '<span class="superuser-badge">Superuser</span>' : ''}
      </div>
      
      ${canEditPrompt ? `
        <button class="ai-template-prompt-edit-btn" data-action="toggle-edit">
          <span id="edit-btn-text-${this.template.id || 'default'}">Prompt Bewerken</span>
        </button>
      ` : ''}
      
      <div class="ai-template-prompt-content" style="display: none;">
        <textarea class="ai-template-prompt-textarea" rows="12" ${canEditPrompt ? '' : 'readonly'}>${this.prompt}</textarea>
        ${canEditPrompt ? `
          <div class="ai-template-prompt-actions">
            <button class="ai-template-btn ai-template-btn-secondary ai-template-btn-sm" data-action="cancel">Annuleren</button>
            <button class="ai-template-btn ai-template-btn-primary ai-template-btn-sm" data-action="save">Nieuwe Versie Opslaan</button>
          </div>
          <p class="prompt-save-note">
            <span class="note-icon">${this.getIcon('lightbulb', 14)}</span>
            Opslaan maakt een nieuwe versie en archiveert de huidige.
          </p>
        ` : ''}
      </div>
      
      <div class="ai-template-prompt-tip">
        <span class="ai-template-tip-icon">${this.getIcon('lightbulb', 16)}</span>
        <span class="ai-template-tip-text">Tip: Tender naam, opdrachtgever en deadline worden automatisch ingevuld uit je tender data.</span>
      </div>
    `;

    this.attachEventListeners();
  }

  getPromptDescription() {
    const descriptions = {
      'tender_samenvatting': 'Deze prompt genereert een beknopte samenvatting van de tender met alle kernpunten, belangrijkste eisen en relevante deadlines. De output is gestructureerd met bullets voor overzicht.',
      'tender_offerte': 'Genereert een professionele offerte op basis van je tender data en pricing strategieën. Inclusief kostenopbouw, voorwaarden en commerciële teksten.',
      'win_themes': 'Identificeert de winnende thema\'s en unique selling points voor deze tender. Analyseert concurrentievoordelen en positioneringsstrategieën.',
      'win_check': 'Voert een uitgebreide win/no-go analyse uit op basis van tender criteria, capaciteit, risico\'s en winstkansen.'
    };

    const key = this.template.template_key || this.template.key;
    return descriptions[key] || this.template.beschrijving || 'AI prompt voor document generatie.';
  }

  async canEdit() {
    try {
      const user = await UserService.getMe();
      if (!user) return false;
      return user.role === 'super_admin' || user.is_super_admin === true;
    } catch (error) {
      return false;
    }
  }

  attachEventListeners() {
    const container = this.container;

    const toggleBtn = container.querySelector('[data-action="toggle-edit"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleEdit());
    }

    const cancelBtn = container.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelEdit());
    }

    const saveBtn = container.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.savePrompt());
    }
  }

  toggleEdit() {
    const content = this.container.querySelector('.ai-template-prompt-content');
    if (content) {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';

      const templateId = this.template.id || 'default';
      const btn = this.container.querySelector(`#edit-btn-text-${templateId}`);
      if (btn) {
        btn.textContent = isHidden ? 'Sluiten' : 'Prompt Bewerken';
      }
    }
  }

  cancelEdit() {
    const content = this.container.querySelector('.ai-template-prompt-content');
    if (content) {
      content.style.display = 'none';
    }

    const templateId = this.template.id || 'default';
    const btn = this.container.querySelector(`#edit-btn-text-${templateId}`);
    if (btn) {
      btn.textContent = 'Prompt Bewerken';
    }
  }

  async savePrompt() {
    const textarea = this.container.querySelector('.ai-template-prompt-textarea');
    const newPrompt = textarea.value;

    if (!newPrompt.trim()) {
      showToast('Prompt mag niet leeg zijn', 'warning');
      return;
    }

    try {
      const templateKey = this.template.template_key;
      const nextVersion = (this.template.version || 1) + 1;

      const apiBaseUrl = window.CONFIG?.api || 'http://localhost:3000';
      showToast('Opslaan...', 'info');

      const createResponse = await fetch(`${apiBaseUrl}/api/v1/ai-documents/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_key: templateKey,
          prompt_title: `${this.template.template_name} - v${nextVersion}`,
          prompt_content: newPrompt,
          tenderbureau_id: null,
          description: 'Aangepast via superuser interface'
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.detail || 'Failed to create prompt version');
      }

      const createData = await createResponse.json();
      const newPromptId = createData.prompt.id;
      const newVersionNumber = createData.prompt.version;

      const activateResponse = await fetch(`${apiBaseUrl}/api/v1/ai-documents/prompts/${newPromptId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!activateResponse.ok) {
        const activateError = await activateResponse.json();
        throw new Error(activateError.detail || 'Failed to activate new prompt version');
      }

      this.prompt = newPrompt;
      this.template.version = newVersionNumber;

      showToast(`Prompt opgeslagen en geactiveerd (v${newVersionNumber})`, 'success');

      this.cancelEdit();
      await this.render();

    } catch (error) {
      showToast('Fout bij opslaan: ' + error.message, 'error');
    }
  }

  getCurrentPrompt() {
    return this.prompt;
  }

  destroy() {
    // Cleanup if needed
  }
}