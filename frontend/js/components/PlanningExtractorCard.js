// frontend/js/components/PlanningExtractorCard.js
// VERSIE: 20250201_1230 - Bugfix: event listeners + error handling

import { showToast } from '../utils/toast.js';
import { PromptBox } from './PromptBox.js';

export class PlanningExtractorCard {
  constructor(container, tenderId, options = {}) {
    this.container = container;
    this.tenderId = tenderId;
    this.element = null;
    this.promptBox = null;
    this.onPlanningSaved = options.onPlanningSaved || (() => {});
    
    // Template configuratie voor PromptBox
    this.template = {
      id: 'planning_extractor',
      template_key: 'planning_extractor',
      template_name: 'Planning Extractor',
      beschrijving: 'Analyseert aanbestedingsdocumenten en extraheert alle belangrijke deadlines en mijlpalen.',
      version: 1,
      priority: 0,
      color: 'planning'
    };
    
    console.log('🔧 PlanningExtractorCard constructor', { tenderId, container: !!container });
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
    return `Analyseer de aanbestedingsdocumenten en extraheer alle belangrijke deadlines en mijlpalen.

Zoek specifiek naar de volgende datums en geef ze terug in het exacte format hieronder:

## PLANNING OVERZICHT

**Publicatie:**
- Publicatiedatum: [YYYY-MM-DD of "Niet gevonden"]

**Schouw & Locatiebezoek:**
- Schouw/Locatiebezoek: [YYYY-MM-DD of "Niet gevonden"]

**Nota van Inlichtingen:**
- NVI 1 - Vragen indienen: [YYYY-MM-DD HH:MM of "Niet gevonden"]
- NVI 1 - Publicatie antwoorden: [YYYY-MM-DD of "Niet gevonden"]
- NVI 2 - Vragen indienen: [YYYY-MM-DD HH:MM of "Niet gevonden"]
- NVI 2 - Publicatie antwoorden: [YYYY-MM-DD of "Niet gevonden"]

**Indiening:**
- Deadline indiening: [YYYY-MM-DD HH:MM of "Niet gevonden"]

**Beoordeling:**
- Presentatie/Interview: [YYYY-MM-DD of "Niet gevonden"]

**Gunning:**
- Voorlopige gunning: [YYYY-MM-DD of "Niet gevonden"]
- Definitieve gunning: [YYYY-MM-DD of "Niet gevonden"]

**Contract:**
- Start uitvoering: [YYYY-MM-DD of "Niet gevonden"]
- Einde contract: [YYYY-MM-DD of "Niet gevonden"]

Let op:
- Gebruik altijd het format YYYY-MM-DD voor datums
- Voeg HH:MM toe als een specifiek tijdstip is vermeld
- Schrijf "Niet gevonden" als een datum niet in de documenten staat
- Controleer zowel de leidraad als eventuele bijlagen`;
  }

  async render() {
    console.log('🔧 PlanningExtractorCard.render() start');
    
    const card = document.createElement('div');
    card.className = 'template-card template-card--planning';
    card.innerHTML = `
      <div class="ai-template-card-top">
        <div class="ai-template-flow-number ai-template-flow-number--planning">0</div>
        <div class="ai-template-card-header">
          <h3 class="ai-template-card-title">Stap 0: Tenderplanning</h3>
          <p class="ai-template-card-description">Laat AI de aanbestedingsdocumenten analyseren om alle belangrijke deadlines en mijlpalen te extraheren.</p>
        </div>
      </div>

      <div class="ai-template-prompt-section">
        <div class="ai-template-prompt-header">
          <div class="ai-template-prompt-title">
            <span class="prompt-title-icon">${this.getIcon('calendar', 18)}</span>
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
          <li>Upload de aanbestedingsdocumenten (leidraad, planning bijlage)</li>
          <li>Paste de prompt en druk op Enter</li>
          <li>Wacht tot Claude de planning heeft geëxtraheerd</li>
          <li>Copy het resultaat en klik op "Resultaat Opslaan"</li>
        </ol>
      </div>

      <!-- ACTIEKNOPPEN -->
      <div class="ai-template-card-actions">
        <button class="ai-template-btn ai-template-btn-secondary" data-action="copy-prompt">Copy Prompt</button>
        <button class="ai-template-btn ai-template-btn-secondary" data-action="open-claude">Open Claude.ai</button>
        <button class="ai-template-btn ai-template-btn-primary" data-action="save-result">Resultaat Opslaan</button>
      </div>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(card);
    this.element = card;
    
    console.log('🔧 PlanningExtractorCard element created', { element: !!this.element });

    // ⭐ BUGFIX: Eerst event listeners koppelen, DAARNA async PromptBox laden
    this.attachEventListeners();
    
    // PromptBox laden in try-catch zodat errors de rest niet blokkeren
    try {
      await this.renderPromptBox();
    } catch (error) {
      console.error('⚠️ PromptBox laden mislukt (niet kritiek):', error);
    }
    
    console.log('🔧 PlanningExtractorCard.render() complete');
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
        console.log('Using default planning prompt');
      }

      // Gebruik PromptBox voor consistente styling en superuser editing
      this.promptBox = new PromptBox(promptContainer, this.template, prompt, promptInfo);
      await this.promptBox.render();

    } catch (error) {
      console.error('Error in renderPromptBox:', error);
    }
  }

  attachEventListeners() {
    if (!this.element) {
      console.error('❌ attachEventListeners: this.element is null!');
      return;
    }
    
    console.log('🔧 Attaching event listeners...');

    // Copy prompt
    const copyBtn = this.element.querySelector('[data-action="copy-prompt"]');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        console.log('📋 Copy prompt clicked');
        this.copyPrompt();
      });
    } else {
      console.warn('⚠️ Copy button not found');
    }

    // Open Claude.ai
    const openBtn = this.element.querySelector('[data-action="open-claude"]');
    if (openBtn) {
      openBtn.addEventListener('click', () => {
        console.log('🌐 Open Claude clicked');
        this.openClaudeAI();
      });
    } else {
      console.warn('⚠️ Open Claude button not found');
    }

    // Save result
    const saveBtn = this.element.querySelector('[data-action="save-result"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        console.log('💾 Save result clicked');
        this.openSaveModal();
      });
      console.log('✅ Save button event listener attached');
    } else {
      console.error('❌ Save button not found!');
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
      console.error('Copy error:', error);
      showToast('Kopiëren mislukt', 'error');
    }
  }

  openClaudeAI() {
    window.open('https://claude.ai/new', '_blank');
    showToast('Claude.ai geopend in nieuw tabblad', 'info');
  }

  openSaveModal() {
    console.log('💾 openSaveModal() called');
    
    // Maak modal voor planning resultaat
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'planning-save-modal';
    overlay.innerHTML = `
      <div class="modal-content" style="max-width: 700px;">
        <div class="modal-header">
          <div class="modal-title">
            <span>${this.getIcon('calendar', 20)}</span>
            <span>Planning Resultaat Opslaan</span>
          </div>
          <button class="modal-close" data-action="close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="planning-content">Plak hier het AI resultaat</label>
            <textarea 
              id="planning-content" 
              class="form-textarea"
              rows="15"
              style="width: 100%; font-family: monospace; font-size: 13px;"
              placeholder="Plak hier de output van Claude.ai...

Verwacht format:
## PLANNING OVERZICHT

**Publicatie:**
- Publicatiedatum: 2025-02-01

**Nota van Inlichtingen:**
- NVI 1 - Vragen indienen: 2025-02-10 12:00
..."
            ></textarea>
          </div>
          <div class="planning-preview" id="planning-preview">
            <p class="preview-placeholder">De gedetecteerde planning items verschijnen hier...</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" data-action="close">Annuleren</button>
          <button class="btn btn-primary" data-action="save" id="save-planning-btn" disabled>Planning Opslaan</button>
        </div>
      </div>
      <style>
        #planning-save-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }
        #planning-save-modal .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-height: 90vh;
          overflow-y: auto;
        }
        #planning-save-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid #e2e8f0;
        }
        #planning-save-modal .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
        }
        #planning-save-modal .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          color: #64748b;
          cursor: pointer;
          padding: 4px 8px;
          line-height: 1;
        }
        #planning-save-modal .modal-close:hover {
          color: #1e293b;
        }
        #planning-save-modal .modal-body {
          padding: 24px;
        }
        #planning-save-modal .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 0 0 12px 12px;
        }
        #planning-save-modal .form-group {
          margin-bottom: 16px;
        }
        #planning-save-modal .form-group label {
          display: block;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
        }
        #planning-save-modal .form-textarea {
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          resize: vertical;
        }
        #planning-save-modal .form-textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .planning-preview {
          margin-top: 16px;
          padding: 16px;
          background: #eff6ff;
          border: 1px solid #93c5fd;
          border-radius: 8px;
          max-height: 200px;
          overflow-y: auto;
        }
        .preview-placeholder {
          color: #64748b;
          font-size: 13px;
          margin: 0;
        }
        .preview-section {
          margin-bottom: 12px;
        }
        .preview-section-title {
          font-size: 12px;
          font-weight: 600;
          color: #1e40af;
          text-transform: uppercase;
          margin-bottom: 6px;
          padding-bottom: 4px;
          border-bottom: 1px solid #bfdbfe;
        }
        .preview-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 13px;
          color: #334155;
        }
        .preview-item-label {
          color: #64748b;
        }
        .preview-item-value {
          font-weight: 500;
          color: #1e40af;
        }
        .preview-item-value.not-found {
          color: #94a3b8;
          font-style: italic;
        }
        .preview-count {
          font-size: 12px;
          color: #1e40af;
          font-weight: 500;
          margin-bottom: 12px;
        }
        #planning-save-modal .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }
        #planning-save-modal .btn-secondary {
          background: #f1f5f9;
          color: #475569;
        }
        #planning-save-modal .btn-secondary:hover {
          background: #e2e8f0;
        }
        #planning-save-modal .btn-primary {
          background: #3b82f6;
          color: white;
        }
        #planning-save-modal .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }
        #planning-save-modal .btn-primary:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
      </style>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    
    console.log('💾 Modal appended to body');

    // Store extracted planning data
    let extractedPlanning = {};

    // Event listeners
    const closeModal = () => {
      console.log('💾 Closing modal');
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
    const textarea = overlay.querySelector('#planning-content');
    const preview = overlay.querySelector('#planning-preview');
    const saveBtn = overlay.querySelector('#save-planning-btn');

    textarea.addEventListener('input', () => {
      extractedPlanning = this.parsePlanningText(textarea.value);
      this.updatePreview(preview, extractedPlanning);
      const hasData = Object.values(extractedPlanning).some(v => v !== null);
      saveBtn.disabled = !hasData;
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
      const hasData = Object.values(extractedPlanning).some(v => v !== null);
      if (!hasData) {
        showToast('Geen planning data gedetecteerd', 'warning');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Opslaan...';

      try {
        // Voeg extracted timestamp toe
        extractedPlanning.planning_extracted_at = new Date().toISOString();
        
        // Import apiService dynamisch als het niet globaal is
        let apiService;
        try {
          const module = await import('../services/ApiService.js');
          apiService = module.apiService || module.default;
        } catch (e) {
          // Fallback: probeer window.apiService
          apiService = window.apiService;
        }
        
        if (!apiService) {
          throw new Error('ApiService niet beschikbaar');
        }
        
        console.log('💾 Saving planning data:', extractedPlanning);
        await apiService.updateTender(this.tenderId, extractedPlanning);

        const count = Object.values(extractedPlanning).filter(v => v !== null && v !== undefined).length;
        showToast(`Planning opgeslagen! (${count} velden)`, 'success');
        this.onPlanningSaved(extractedPlanning);
        closeModal();

      } catch (error) {
        console.error('Error saving planning:', error);
        showToast('Fout bij opslaan: ' + error.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Planning Opslaan';
      }
    });

    // Focus textarea
    setTimeout(() => textarea.focus(), 100);
  }

  parsePlanningText(text) {
    const planning = {
      publicatie_datum: null,
      schouw_datum: null,
      nvi1_datum: null,
      nvi_1_publicatie: null,
      nvi2_datum: null,
      nvi_2_publicatie: null,
      deadline_indiening: null,
      presentatie_datum: null,
      voorlopige_gunning: null,
      definitieve_gunning: null,
      start_uitvoering: null,
      einde_contract: null
    };

    // Field mapping: text patterns → field names
    const fieldPatterns = [
      { pattern: /publicatiedatum[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'publicatie_datum' },
      { pattern: /schouw[\/\s]?(?:locatiebezoek)?[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'schouw_datum' },
      { pattern: /nvi\s*1[^:]*vragen[^:]*[:\s]+(\d{4}-\d{2}-\d{2}(?:[\sT]?\d{2}:\d{2})?)/i, field: 'nvi1_datum' },
      { pattern: /nvi\s*1[^:]*publicatie[^:]*[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'nvi_1_publicatie' },
      { pattern: /nvi\s*2[^:]*vragen[^:]*[:\s]+(\d{4}-\d{2}-\d{2}(?:[\sT]?\d{2}:\d{2})?)/i, field: 'nvi2_datum' },
      { pattern: /nvi\s*2[^:]*publicatie[^:]*[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'nvi_2_publicatie' },
      { pattern: /deadline\s*indiening[:\s]+(\d{4}-\d{2}-\d{2}(?:[\sT]?\d{2}:\d{2})?)/i, field: 'deadline_indiening' },
      { pattern: /presentatie[\/\s]?(?:interview)?[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'presentatie_datum' },
      { pattern: /voorlopige\s*gunning[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'voorlopige_gunning' },
      { pattern: /definitieve\s*gunning[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'definitieve_gunning' },
      { pattern: /start\s*uitvoering[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'start_uitvoering' },
      { pattern: /einde\s*contract[:\s]+(\d{4}-\d{2}-\d{2})/i, field: 'einde_contract' }
    ];

    for (const { pattern, field } of fieldPatterns) {
      const match = text.match(pattern);
      if (match && match[1] && !match[1].toLowerCase().includes('niet')) {
        planning[field] = match[1].trim();
      }
    }

    return planning;
  }

  updatePreview(container, planning) {
    const fieldLabels = {
      publicatie_datum: 'Publicatiedatum',
      schouw_datum: 'Schouw/Locatiebezoek',
      nvi1_datum: 'NVI 1 - Vragen',
      nvi_1_publicatie: 'NVI 1 - Publicatie',
      nvi2_datum: 'NVI 2 - Vragen',
      nvi_2_publicatie: 'NVI 2 - Publicatie',
      deadline_indiening: 'Deadline indiening',
      presentatie_datum: 'Presentatie',
      voorlopige_gunning: 'Voorlopige gunning',
      definitieve_gunning: 'Definitieve gunning',
      start_uitvoering: 'Start uitvoering',
      einde_contract: 'Einde contract'
    };

    const sections = {
      'Publicatie & Schouw': ['publicatie_datum', 'schouw_datum'],
      'Nota van Inlichtingen': ['nvi1_datum', 'nvi_1_publicatie', 'nvi2_datum', 'nvi_2_publicatie'],
      'Indiening & Beoordeling': ['deadline_indiening', 'presentatie_datum'],
      'Gunning & Contract': ['voorlopige_gunning', 'definitieve_gunning', 'start_uitvoering', 'einde_contract']
    };

    const foundCount = Object.values(planning).filter(v => v !== null).length;

    if (foundCount === 0) {
      container.innerHTML = '<p class="preview-placeholder">De gedetecteerde planning items verschijnen hier...</p>';
      return;
    }

    let html = `<p class="preview-count">✅ ${foundCount} datums gedetecteerd</p>`;

    for (const [sectionTitle, fields] of Object.entries(sections)) {
      const sectionHasData = fields.some(f => planning[f] !== null);
      if (!sectionHasData) continue;

      html += `
        <div class="preview-section">
          <div class="preview-section-title">${sectionTitle}</div>
          ${fields.map(field => {
            const value = planning[field];
            const label = fieldLabels[field];
            return `
              <div class="preview-item">
                <span class="preview-item-label">${label}:</span>
                <span class="preview-item-value ${value ? '' : 'not-found'}">${value || 'Niet gevonden'}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
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

export default PlanningExtractorCard;