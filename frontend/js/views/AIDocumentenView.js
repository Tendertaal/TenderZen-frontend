// frontend/js/views/AIDocumentenView.js

import { AIDocumentenTabs } from '../components/AIDocumentenTabs.js';
import { AIGenerateTab } from '../components/AIGenerateTab.js';
import { DocumentsTab } from '../components/DocumentsTab.js';

export class AIDocumentenView {
  constructor(container, tenderId) {
    this.container = container;
    this.tenderId = tenderId;
    this.currentTab = 'generate';
    this.tabs = null;
    this.currentTabView = null;
  }

  async render() {
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-documenten-view';
    wrapper.innerHTML = `
      <div class="ai-sticky-header-wrapper">
        <div class="ai-modal-header">
          <div class="ai-modal-header-content">
            <div class="ai-modal-icon">
              <span>🤖</span>
            </div>
            <h2 class="ai-modal-title">AI Document Generatie</h2>
          </div>
        </div>
        <div id="ai-tabs-navigation"></div>
      </div>
      <div id="ai-tab-content"></div>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(wrapper);

    await this.initializeTabs();
    await this.loadTab(this.currentTab);
  }

  async initializeTabs() {
    const tabsContainer = document.getElementById('ai-tabs-navigation');
    this.tabs = new AIDocumentenTabs(tabsContainer, {
      onTabChange: (tabKey) => this.loadTab(tabKey)
    });
    await this.tabs.render();
  }

  async loadTab(tabKey) {
    console.log(`🔄 Loading tab: ${tabKey}`);

    this.currentTab = tabKey;
    const contentContainer = document.getElementById('ai-tab-content');

    if (!contentContainer) {
      console.error('❌ Tab content container not found');
      return;
    }

    // Destroy current tab view
    if (this.currentTabView && this.currentTabView.destroy) {
      this.currentTabView.destroy();
    }

    // Load appropriate tab
    switch (tabKey) {
      case 'generate':
        this.currentTabView = new AIGenerateTab(contentContainer, this.tenderId);
        break;

      case 'documents':
        this.currentTabView = new DocumentsTab(contentContainer, this.tenderId);

        // Listen for continue event to switch to generate tab
        contentContainer.addEventListener('switchTab', (e) => {
          if (e.detail.tab === 'ai-workflow') {
            this.tabs.setActiveTab('generate');
            this.loadTab('generate');
          }
        }, { once: true });
        break;

      case 'checklist':
        contentContainer.innerHTML = `
          <div class="placeholder-tab">
            <div class="placeholder-banner placeholder-banner--checklist">
              <div class="placeholder-icon">✅</div>
              <div class="placeholder-content">
                <h3>Inlever Checklist</h3>
                <p>Controleer hier alle vereiste documenten en stappen voordat je de tender indient. De checklist functionaliteit wordt binnenkort beschikbaar gesteld om je te helpen geen essentiële onderdelen te vergeten.</p>
              </div>
            </div>
          </div>
        `;
        this.currentTabView = null;
        break;

      case 'saved':
        contentContainer.innerHTML = `
          <div class="placeholder-tab">
            <div class="placeholder-banner placeholder-banner--saved">
              <div class="placeholder-icon">📊</div>
              <div class="placeholder-content">
                <h3>Gegenereerde Documenten</h3>
                <p>Hier vind je straks een overzicht van alle documenten die je met AI hebt gegenereerd. Je kunt ze downloaden, bewerken en direct gebruiken in je tender inschrijving.</p>
              </div>
            </div>
          </div>
        `;
        this.currentTabView = null;
        break;

      default:
        console.error(`❌ Unknown tab: ${tabKey}`);
        contentContainer.innerHTML = `
          <div class="placeholder-tab">
            <div class="placeholder-banner placeholder-banner--default">
              <div class="placeholder-icon">⚠️</div>
              <div class="placeholder-content">
                <h3>Tab niet gevonden</h3>
                <p>De opgevraagde tab bestaat niet. Selecteer een andere tab uit het menu hierboven.</p>
              </div>
            </div>
          </div>
        `;
        this.currentTabView = null;
        return;
    }

    // Render the tab
    if (this.currentTabView && this.currentTabView.render) {
      try {
        await this.currentTabView.render();
        console.log(`✅ Tab loaded: ${tabKey}`);
      } catch (error) {
        console.error(`❌ Error rendering tab ${tabKey}:`, error);
        contentContainer.innerHTML = `
          <div class="placeholder-tab">
            <div class="placeholder-banner placeholder-banner--default">
              <div class="placeholder-icon">⚠️</div>
              <div class="placeholder-content">
                <h3>Fout bij laden</h3>
                <p>Er is een fout opgetreden bij het laden van deze tab: ${error.message}</p>
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  destroy() {
    if (this.currentTabView && this.currentTabView.destroy) {
      this.currentTabView.destroy();
    }
    this.currentTabView = null;
  }
}