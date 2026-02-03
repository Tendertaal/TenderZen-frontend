// frontend/js/components/ChecklistExtractorCard.js
// VERSIE: 20250129_1500 - Consistente styling met TemplateCard + PromptBox voor superuser editing

import apiService from '../services/ApiService.js';
import { PromptBox } from './PromptBox.js';
import { showToast } from '../utils/toast.js';

export class ChecklistExtractorCard {
  constructor(container, tenderId, options = {}) {
    this.container = container;
    this.tenderId = tenderId;
    this.element = null;
    this.promptBox = null;
    this.onChecklistSaved = options.onChecklistSaved || (() => {});
    
    // Template configuratie voor PromptBox
    this.template = {
      id: 'checklist_extractor',
      template_key: 'checklist_extractor',
      template_name: 'Checklist Extractor',
      beschrijving: 'Analyseert aanbestedingsdocumenten en extraheert alle verplichte in te dienen documenten.',
      version: 1,
      priority: 1,
      color: 'green'
    };
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

  getDefaultPrompt() {
    return `Analyseer de aanbestedingsdocumenten en maak een complete checklist van alle documenten die moeten worden ingediend.

Geef voor elk document:
- Documentnaam
- Categorie (Administratief / Technisch / Financieel / Overig)
- Verplicht of Optioneel
- Eventuele specifieke eisen (format, aantal pagina's, etc.)

Structureer je antwoord als volgt:

## ADMINISTRATIEF
- [ ] Document naam | Verplicht | Specifieke eisen

## TECHNISCH  
- [ ] Document naam | Verplicht | Specifieke eisen

## FINANCIEEL
- [ ] Document naam | Optioneel | Specifieke eisen

## OVERIG
- [ ] Document naam | Verplicht | Specifieke eisen

Let specifiek op:
- Uniform Europees Aanbestedingsdocument (UEA)
- Eigen verklaringen
- Referenties
- Plan van Aanpak
- Prijzenblad / Inschrijvingsbiljet
- Certificaten en vergunningen
- Verzekeringseisen
- VOG / Gedragsverklaring`;
  }

  async render() {
    const card = document.createElement('div');
    card.className = 'template-card template-card--green';
    card.innerHTML = `
      <div class="ai-template-card-top">
        <div class="ai-template-flow-number ai-template-flow-number--green">1</div>
        <div class="ai-template-card-header">
          <h3 class="ai-template-card-title">Stap 1: Inlever Checklist</h3>
          <p class="ai-template-card-description">Laat AI de aanbestedingsdocumenten analyseren om een checklist te maken van alle in te dienen documenten.</p>
        </div>
      </div>

      <div class="ai-template-prompt-section">
        <div class="ai-template-prompt-header">
          <div class="ai-template-prompt-title">
            <span class="prompt-title-icon">${this.getIcon('checkSquare', 18)}</span>
            <span>AI Prompt (Claude.ai)</span>
          </div>
          <span class="ai-template-prompt-version">v${this.template.version}</span>
        </div>
        <div class="prompt-box-container"></div>
      </div>

      <div class="ai-template-instructions">
        <div class="ai-template-instructions-title">
          <span class="instructions-icon">${this.getIcon('lightbulb', 18)}</span>
          <span>Hoe te gebruiken:</span>
        </div>
        <ol class="ai-template-instructions-list">
          <li>Klik op "Copy Prompt" om de prompt te kopiëren</li>
          <li>Klik op "Open Claude.ai" en log in met je Pro account</li>
          <li>Upload de aanbestedingsdocumenten (leidraad, PvE)</li>
          <li>Paste de prompt en druk op Enter</li>
          <li>Wacht tot Claude de checklist heeft gegenereerd</li>
          <li>Copy het resultaat en klik op "Resultaat Opslaan"</li>
        </ol>
      </div>

      <!-- ACTIEKNOPPEN - ZONDER ICONEN, CONSISTENTE STYLING -->
      <div class="ai-template-card-actions">
        <button class="ai-template-btn ai-template-btn-secondary" data-action="copy-prompt">Copy Prompt</button>
        <button class="ai-template-btn ai-template-btn-secondary" data-action="open-claude">Open Claude.ai</button>
        <button class="ai-template-btn ai-template-btn-primary" data-action="save-result">Resultaat Opslaan</button>
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
      if (!this.element) return;

      const promptContainer = this.element.querySelector('.prompt-box-container');
      if (!promptContainer) return;

      // Haal prompt op van API of gebruik default
      let prompt = this.getDefaultPrompt();
      let promptInfo = null;

      try {
        const apiBaseUrl = window.CONFIG?.api || 'http://localhost:3000';
        const response = await fetch(
          `${apiBaseUrl}/api/v1/ai-documents/prompts/active/${this.template.template_key}`,
          {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.prompt && data.prompt.prompt_content) {
            prompt = data.prompt.prompt_content;
            this.template.version = data.prompt.version || 1;
            promptInfo = data.prompt;
          }
        }
      } catch (error) {
        console.log('Using default checklist prompt');
      }

      // Gebruik PromptBox voor consistente styling en superuser editing
      this.promptBox = new PromptBox(promptContainer, this.template, prompt, promptInfo);
      await this.promptBox.render();

    } catch (error) {
      console.error('Error in renderPromptBox:', error);
    }
  }

  attachEventListeners() {
    if (!this.element) return;

    // Copy prompt
    const copyBtn = this.element.querySelector('[data-action="copy-prompt"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyPrompt());
    }

    // Open Claude.ai
    const openBtn = this.element.querySelector('[data-action="open-claude"]');
    if (openBtn) {
      openBtn.addEventListener('click', () => this.openClaudeAI());
    }

    // Save result
    const saveBtn = this.element.querySelector('[data-action="save-result"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.openSaveModal());
    }
  }

  async copyPrompt() {
    try {
      const prompt = this.promptBox ? this.promptBox.getCurrentPrompt() : this.getDefaultPrompt();
      if (!prompt) {
        showToast('Geen prompt beschikbaar', 'warning');
        return;
      }
      await navigator.clipboard.writeText(prompt);
      showToast('Prompt gekopieerd naar clipboard', 'success');
    } catch (error) {
      showToast('Kopiëren mislukt', 'error');
    }
  }

  openClaudeAI() {
    window.open('https://claude.ai/new', '_blank');
    showToast('Claude.ai geopend in nieuw tabblad', 'info');
  }

  openSaveModal() {
    // Maak modal voor checklist resultaat
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'checklist-save-modal';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <div class="modal-title">
            <span>${this.getIcon('checkSquare', 20)}</span>
            <span>Checklist Resultaat Opslaan</span>
          </div>
          <button class="modal-close" data-action="close">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="checklist-content">Plak hier het AI resultaat</label>
            <textarea 
              id="checklist-content" 
              class="form-textarea"
              rows="15"
              placeholder="Plak hier de output van Claude.ai...

Verwacht format:
## ADMINISTRATIEF
- [ ] UEA | Verplicht | Origineel ondertekend
- [ ] Eigen verklaring | Verplicht | 

## TECHNISCH
- [ ] Plan van Aanpak | Verplicht | Max 20 pagina's
..."
            ></textarea>
          </div>
          <div class="checklist-preview" id="checklist-preview">
            <p class="preview-placeholder">De gedetecteerde checklist items verschijnen hier...</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close">Annuleren</button>
          <button class="btn btn-primary" data-action="save" id="save-checklist-btn" disabled>Checklist Opslaan</button>
        </div>
      </div>
      <style>
        .checklist-preview {
          margin-top: 16px;
          padding: 16px;
          background: #f0fdf4;
          border: 1px solid #86efac;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
        }
        .preview-placeholder {
          color: #64748b;
          font-size: 13px;
          margin: 0;
        }
        .preview-category {
          margin-bottom: 12px;
        }
        .preview-category-title {
          font-size: 12px;
          font-weight: 600;
          color: #166534;
          text-transform: uppercase;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #bbf7d0;
        }
        .preview-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 0;
          font-size: 13px;
          color: #334155;
        }
        .preview-item-check {
          width: 14px;
          height: 14px;
          border: 2px solid #22c55e;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .preview-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: auto;
        }
        .preview-badge.required {
          background: #fee2e2;
          color: #dc2626;
        }
        .preview-badge.optional {
          background: #f1f5f9;
          color: #64748b;
        }
        .preview-count {
          font-size: 12px;
          color: #166534;
          font-weight: 500;
          margin-bottom: 12px;
        }
      </style>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Store extracted items
    let extractedItems = [];

    // Event listeners
    const closeModal = () => {
      document.body.style.overflow = 'auto';
      overlay.remove();
    };

    overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Parse input on change
    const textarea = overlay.querySelector('#checklist-content');
    const preview = overlay.querySelector('#checklist-preview');
    const saveBtn = overlay.querySelector('#save-checklist-btn');

    textarea.addEventListener('input', () => {
      extractedItems = this.parseChecklistText(textarea.value);
      this.updatePreview(preview, extractedItems);
      saveBtn.disabled = extractedItems.length === 0;
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
      if (extractedItems.length === 0) {
        showToast('Geen checklist items gedetecteerd', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Opslaan...';

      try {
        await apiService.updateTender(this.tenderId, {
          checklist_items: JSON.stringify(extractedItems),
          checklist_extracted_at: new Date().toISOString()
        });

        showToast(`${extractedItems.length} checklist items opgeslagen!`, 'success');
        this.onChecklistSaved(extractedItems);
        closeModal();

      } catch (error) {
        console.error('Error saving checklist:', error);
        showToast('Fout bij opslaan: ' + error.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Checklist Opslaan';
      }
    });

    // Focus textarea
    setTimeout(() => textarea.focus(), 100);
  }

  parseChecklistText(text) {
    const items = [];
    let currentCategory = 'Overig';
    
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for category header
      if (trimmed.startsWith('##')) {
        const categoryMatch = trimmed.match(/##\s*(.+)/);
        if (categoryMatch) {
          currentCategory = categoryMatch[1].trim().toUpperCase();
          // Normalize category names
          if (currentCategory.includes('ADMIN')) currentCategory = 'Administratief';
          else if (currentCategory.includes('TECH')) currentCategory = 'Technisch';
          else if (currentCategory.includes('FINAN')) currentCategory = 'Financieel';
          else currentCategory = 'Overig';
        }
        continue;
      }
      
      // Check for checklist item
      const itemMatch = trimmed.match(/^-\s*\[[\sx]\]\s*(.+)/i);
      if (itemMatch) {
        const itemContent = itemMatch[1];
        const parts = itemContent.split('|').map(p => p.trim());
        
        const name = parts[0] || 'Onbekend document';
        const requiredText = (parts[1] || '').toLowerCase();
        const isRequired = requiredText.includes('verplicht') || !requiredText.includes('optioneel');
        const notes = parts[2] || '';
        
        items.push({
          name,
          category: currentCategory,
          required: isRequired,
          notes,
          status: 'niet_gestart'
        });
      }
    }
    
    return items;
  }

  updatePreview(container, items) {
    if (items.length === 0) {
      container.innerHTML = '<p class="preview-placeholder">De gedetecteerde checklist items verschijnen hier...</p>';
      return;
    }

    // Group by category
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.category]) {
        grouped[item.category] = [];
      }
      grouped[item.category].push(item);
    }

    const categoryOrder = ['Administratief', 'Technisch', 'Financieel', 'Overig'];
    
    let html = `<p class="preview-count">${items.length} items gedetecteerd</p>`;
    
    for (const category of categoryOrder) {
      const categoryItems = grouped[category];
      if (!categoryItems || categoryItems.length === 0) continue;
      
      html += `
        <div class="preview-category">
          <div class="preview-category-title">${category} (${categoryItems.length})</div>
          ${categoryItems.map(item => `
            <div class="preview-item">
              <div class="preview-item-check"></div>
              <span>${this.escapeHtml(item.name)}</span>
              <span class="preview-badge ${item.required ? 'required' : 'optional'}">
                ${item.required ? 'Verplicht' : 'Optioneel'}
              </span>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    container.innerHTML = html;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    if (this.promptBox) {
      this.promptBox.destroy();
    }
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
  }
}