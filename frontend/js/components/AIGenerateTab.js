// frontend/js/components/AIGenerateTab.js
// VERSIE: 20250129_1330 - Met ChecklistExtractorCard toegevoegd
// Stap 0: Planning, Stap 1: Checklist, Stap 2+: Document templates

import { AITemplateService } from '../services/AITemplateService.js';
import { TemplateCard } from './TemplateCard.js';
import { PlanningExtractorCard } from './PlanningExtractorCard.js';
import { ChecklistExtractorCard } from './ChecklistExtractorCard.js';
import { showToast } from '../utils/toast.js';

export class AIGenerateTab {
  constructor(container, tenderId) {
    this.container = container;
    this.tenderId = tenderId;
    this.templates = [];
    this.templateCards = [];
    this.service = new AITemplateService();
  }

  async render() {
    this.container.innerHTML = '<div class="loading">Templates laden...</div>';

    try {
      this.templates = await this.service.getTemplates();

      const wrapper = document.createElement('div');
      wrapper.className = 'ai-generate-tab';
      wrapper.innerHTML = `
        <div class="templates-grid" id="template-flow"></div>
      `;

      this.container.innerHTML = '';
      this.container.appendChild(wrapper);

      await this.renderTemplates();

    } catch (error) {
      console.error('Error loading templates:', error);
      showToast('Fout bij laden van templates', 'error');
      this.container.innerHTML = `
        <div class="error-state">
          <p>Kon templates niet laden</p>
          <button onclick="location.reload()">Opnieuw proberen</button>
        </div>
      `;
    }
  }

  async renderTemplates() {
    const flowContainer = document.getElementById('template-flow');

    // ============================================
    // Dynamische Document Templates (alles gelijkwaardig)
    // ============================================
    const skipTemplates = [];

    for (let i = 0; i < this.templates.length; i++) {
      const template = this.templates[i];

      // Skip speciale extractors
      if (skipTemplates.includes(template.template_key)) {
        continue;
      }

      const cardContainer = document.createElement('div');
      const card = new TemplateCard(
        cardContainer,
        template,
        this.tenderId
      );
      await card.render();
      flowContainer.appendChild(cardContainer);
      this.templateCards.push(card);
    }
  }

  destroy() {
    this.templateCards.forEach(card => card.destroy());
    this.templateCards = [];
  }
}