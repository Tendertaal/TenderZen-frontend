// frontend/js/components/PlanningPromptBox.js
// VERSIE: 20250129_0930 - Actieknoppen verwijderd (staan in PlanningExtractorCard)

import { showToast } from '../utils/toast.js';
import { UserService } from '../services/UserService.js';

export class PlanningPromptBox {
  constructor(container, prompt, version = 1) {
    this.container = container;
    this.prompt = prompt;
    this.version = version;
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

  async canEdit() {
    try {
      const user = await UserService.getMe();
      if (!user) return false;
      return user.role === 'super_admin' || user.is_super_admin === true;
    } catch (e) {
      return false;
    }
  }

  async render() {
    const canEditPrompt = await this.canEdit();
    this.container.innerHTML = `
      <div class="ai-template-prompt-description">
        Dit is de prompt voor de planning-extractor. Pas deze aan indien nodig.
        ${canEditPrompt ? '<span class="superuser-badge">Superuser</span>' : ''}
      </div>
      
      ${canEditPrompt ? `
        <button class="ai-template-prompt-edit-btn" data-action="toggle-edit">
          <span id="edit-btn-text-planning">Prompt Bewerken</span>
        </button>
      ` : ''}
      
      <div class="ai-template-prompt-content" style="display: none;">
        <textarea class="ai-template-prompt-textarea" rows="10" ${canEditPrompt ? '' : 'readonly'}>${this.prompt}</textarea>
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
        <span class="ai-template-tip-text">Tip: De planning prompt wordt gebruikt in alle AI-documenten.</span>
      </div>
    `;
    this.attachEventListeners();
  }

  attachEventListeners() {
    const toggleBtn = this.container.querySelector('[data-action="toggle-edit"]');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleEdit());
    }

    const cancelBtn = this.container.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelEdit());
    }

    const saveBtn = this.container.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.savePrompt());
    }
  }

  toggleEdit() {
    const content = this.container.querySelector('.ai-template-prompt-content');
    if (content) {
      const isHidden = content.style.display === 'none';
      content.style.display = isHidden ? 'block' : 'none';
      const btn = this.container.querySelector('#edit-btn-text-planning');
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
    const btn = this.container.querySelector('#edit-btn-text-planning');
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
      const apiBaseUrl = window.CONFIG?.api || 'http://localhost:3000';
      showToast('Opslaan...', 'info');

      const response = await fetch(`${apiBaseUrl}/api/v1/ai-documents/prompts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          template_key: 'planning_extractor',
          prompt_title: `Planning Extractor - v${this.version + 1}`,
          prompt_content: newPrompt,
          tenderbureau_id: null,
          description: 'Aangepast via superuser interface (planning prompt)'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create prompt version');
      }

      showToast('Prompt opgeslagen en geactiveerd', 'success');
      this.cancelEdit();
      this.prompt = newPrompt;
      this.version += 1;
      await this.render();
    } catch (error) {
      showToast('Fout bij opslaan: ' + error.message, 'error');
    }
  }

  getCurrentPrompt() {
    const textarea = this.container.querySelector('.ai-template-prompt-textarea');
    if (textarea) {
      return textarea.value;
    }
    return this.prompt;
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}