// frontend/js/components/TemplateCard.js

import { PromptBox } from './PromptBox.js';
import { SaveResultModal } from './SaveResultModal.js';
import { AITemplateService } from '../services/AITemplateService.js';
import { showToast } from '../utils/toast.js';

export class TemplateCard {
  constructor(container, template, tenderId) {
    this.container = container;
    this.template = template;
    this.tenderId = tenderId;
    this.promptBox = null;
    this.service = new AITemplateService();
    this.element = null;
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
    console.warn(`Icon '${name}' not found`);
    return '';
  }

  async render() {
    const card = document.createElement('div');
    card.className = `template-card template-card--${this.template.color}`;
    card.innerHTML = `
      <!-- Card Header -->
      <div class="ai-template-card-top">
        <div class="ai-template-flow-number ai-template-flow-number--${this.template.color}">
          ${this.template.priority}
        </div>
        <div class="ai-template-card-header">
          <h3 class="ai-template-card-title">${this.template.template_name}</h3>
          <p class="ai-template-card-description">${this.template.beschrijving}</p>
        </div>
      </div>

      <!-- Prompt Section -->
      <div class="ai-template-prompt-section">
        <div class="ai-template-prompt-header">
          <div class="ai-template-prompt-title">
            <span class="prompt-title-icon">${this.getIcon('ai', 18)}</span>
            <span>AI Prompt (Claude.ai)</span>
          </div>
          <span class="ai-template-prompt-version">v${this.template.version || '1'}</span>
        </div>
        
        <!-- PromptBox will be rendered here -->
        <div class="prompt-box-container"></div>
      </div>

      <!-- Instructions Section -->
      <div class="ai-template-instructions">
        <div class="ai-template-instructions-title">
          <span class="instructions-icon">${this.getIcon('lightbulb', 18)}</span>
          <span>Hoe te gebruiken:</span>
        </div>
        <ol class="ai-template-instructions-list">
          <li>Klik op "Copy Prompt" om de prompt te kopiëren</li>
          <li>Klik op "Open Claude.ai" en log in met je Pro account</li>
          <li>Upload je brondocumenten (${this.getRecommendedDocsText()})</li>
          <li>Paste de prompt en druk op Enter</li>
          <li>Wacht ~${this.template.estimated_time_minutes || 5} minuten tot Claude klaar is</li>
          <li>Copy het resultaat en paste het terug in TenderZen</li>
        </ol>
      </div>

      <!-- Actions -->
      <div class="ai-template-card-actions">
        <button class="ai-template-btn ai-template-btn-secondary" data-action="copy-prompt">
          Copy Prompt
        </button>
        <button class="ai-template-btn ai-template-btn-secondary" data-action="open-claude">
          Open Claude.ai
        </button>
        <button class="ai-template-btn ai-template-btn-primary" data-action="save-result">
          Resultaat Opslaan
        </button>
      </div>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(card);
    this.element = card;

    await this.renderPromptBox();
    this.attachEventListeners();
  }

  async renderPromptBox() {
    try {
      if (!this.element) {
        console.warn('⚠️ Card element not found');
        return;
      }

      const promptContainer = this.element.querySelector('.prompt-box-container');
      if (!promptContainer) {
        console.warn(`⚠️ Prompt container not found for template: ${this.template.template_key}`);
        return;
      }

      console.log('📋 Rendering prompt box for:', this.template.template_key);

      // Get filled prompt from backend
      let prompt = 'Loading...';
      let promptInfo = null;
      try {
        const filled = await this.service.fillPromptVariables(
          this.template.template_key,
          this.tenderId
        );
        prompt = filled.filledPrompt || filled.filled_prompt || filled.prompt || this.template.prompt_template || 'Placeholder prompt...';
        promptInfo = filled.prompt_info || null;
      } catch (error) {
        console.error('Could not fill variables:', error);
        prompt = this.template.prompt_template || 'Placeholder prompt...';
      }

      // Create and render PromptBox
      this.promptBox = new PromptBox(
        promptContainer,
        this.template,
        prompt,
        promptInfo
      );
      await this.promptBox.render();
      console.log('✅ Prompt box rendered successfully');

    } catch (error) {
      console.error('❌ Error in renderPromptBox:', error);
      if (this.element) {
        const promptContainer = this.element.querySelector('.prompt-box-container');
        if (promptContainer) {
          promptContainer.innerHTML = `
            <div class="prompt-error-message">
              <span class="error-icon">${this.getIcon('alertCircle', 18)}</span>
              <div>
                <strong>Kon prompt niet laden</strong><br>
                <span style="opacity: 0.8;">${error.message}</span>
              </div>
            </div>
          `;
        }
      }
    }
  }

  getRecommendedDocsText() {
    if (!this.template.recommended_documents || this.template.recommended_documents.length === 0) {
      return 'relevante documenten';
    }
    return this.template.recommended_documents.join(', ');
  }

  attachEventListeners() {
    if (!this.element) return;

    // Copy Prompt button
    const copyBtn = this.element.querySelector('[data-action="copy-prompt"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyPrompt());
    }

    // Open Claude.ai button
    const openButton = this.element.querySelector('[data-action="open-claude"]');
    if (openButton) {
      openButton.addEventListener('click', () => this.openClaudeAI());
    }

    // Save Result button
    const saveButton = this.element.querySelector('[data-action="save-result"]');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.openSaveModal());
    }
  }

  async copyPrompt() {
    try {
      const prompt = this.promptBox ? this.promptBox.getCurrentPrompt() : '';
      if (!prompt) {
        showToast('Geen prompt beschikbaar', 'warning');
        return;
      }
      await navigator.clipboard.writeText(prompt);
      showToast('Prompt gekopieerd naar clipboard', 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      showToast('Kopiëren mislukt', 'error');
    }
  }

  openClaudeAI() {
    window.open('https://claude.ai/new', '_blank');
    showToast('Claude.ai geopend in nieuw tabblad', 'info');
  }

  openSaveModal() {
    const modal = new SaveResultModal(
      this.template,
      this.tenderId,
      this.promptBox ? this.promptBox.getCurrentPrompt() : ''
    );
    modal.show();
  }

  destroy() {
    if (this.promptBox) {
      this.promptBox.destroy();
    }
    this.element = null;
  }
}