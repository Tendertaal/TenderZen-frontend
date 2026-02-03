// frontend/js/views/AIDocumentenView.js
// VERSIE: 20250129_1550 - Header met tender naam, bedrijf en opdrachtgever

import { AIDocumentenTabs } from '../components/AIDocumentenTabs.js';
import { AIGenerateTab } from '../components/AIGenerateTab.js';
import { DocumentsTab } from '../components/DocumentsTab.js';
import { PlanningTab } from '../components/PlanningTab.js';
import { ChecklistTab } from '../components/ChecklistTab.js';
import { SavedDocumentsTab } from '../components/SavedDocumentsTab.js';
import apiService from '../services/ApiService.js';

export class AIDocumentenView {
  constructor(container, tenderId) {
    this.container = container;
    this.tenderId = tenderId;
    this.currentTab = 'generate';
    this.tabs = null;
    this.currentTabView = null;
    this.tender = null;
  }

  /**
   * Get icon HTML from window.Icons
   */
  getIcon(name, size = 20, color = null) {
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
    // Laad eerst tender data
    await this.loadTenderData();

    const tenderNaam = this.tender?.naam || this.tender?.title || 'Onbekende tender';
    const opdrachtgever = this.tender?.opdrachtgever || this.tender?.aanbestedende_dienst || '';
    const bedrijfNaam = this.tender?.bedrijf?.bedrijfsnaam || '';

    const wrapper = document.createElement('div');
    wrapper.className = 'ai-documenten-view';
    wrapper.innerHTML = `
      <div class="ai-sticky-header-wrapper">
        <div class="ai-modal-header">
          <div class="ai-modal-header-content">
            <div class="ai-modal-icon">
              ${this.getIcon('robot', 24)}
            </div>
            <div class="ai-modal-header-text">
              <h2 class="ai-modal-title">AI Document Generatie</h2>
              <div class="ai-modal-tender-name">${this.escapeHtml(tenderNaam)}</div>
              <div class="ai-modal-tender-info">
                ${bedrijfNaam ? `<span class="tender-info-item"><span class="info-label">Inschrijver:</span> <span class="info-value">${this.escapeHtml(bedrijfNaam)}</span></span>` : ''}
                ${bedrijfNaam && opdrachtgever ? `<span class="tender-divider">•</span>` : ''}
                ${opdrachtgever ? `<span class="tender-info-item"><span class="info-label">Opdrachtgever:</span> <span class="info-value">${this.escapeHtml(opdrachtgever)}</span></span>` : ''}
              </div>
            </div>
          </div>
          <button class="ai-modal-close" title="Sluiten">&times;</button>
        </div>
        <div id="ai-tabs-navigation"></div>
      </div>
      <div id="ai-tab-content"></div>
      <style>
        .ai-modal-header-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .ai-modal-tender-name {
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          max-width: 500px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ai-modal-tender-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #64748b;
          margin-top: 2px;
        }
        .tender-info-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .info-label {
          color: #64748b !important;
          text-transform: none !important;
          font-weight: 400 !important;
          font-size: 13px !important;
          letter-spacing: normal !important;
        }
        .info-value {
          color: #7c3aed !important;
          text-transform: none !important;
          font-weight: 600 !important;
          font-size: 13px !important;
        }
        .tender-divider {
          color: #cbd5e1;
        }
      </style>
    `;

    this.container.innerHTML = '';
    this.container.appendChild(wrapper);

    await this.initializeTabs();
    await this.loadTab(this.currentTab);
  }

  async loadTenderData() {
    try {
      this.tender = await apiService.getTender(this.tenderId);
      console.log('📋 Tender loaded for header:', this.tender?.naam);
      console.log('📋 Tender bedrijf_id:', this.tender?.bedrijf_id);
      
      // Laad bedrijf data als er een bedrijf_id is
      if (this.tender?.bedrijf_id) {
        try {
          // Direct via Supabase query (bypass BedrijvenService filtering)
          const supabase = window.supabaseClient;
          
          if (supabase && typeof supabase.from === 'function') {
            const { data, error } = await supabase
              .from('bedrijven')
              .select('id, bedrijfsnaam')
              .eq('id', this.tender.bedrijf_id)
              .single();
            
            if (data && !error) {
              this.tender.bedrijf = data;
              console.log('🏢 Bedrijf found:', data.bedrijfsnaam);
            } else {
              console.log('⚠️ Bedrijf query error:', error);
            }
          } else {
            console.log('⚠️ No Supabase client available');
          }
        } catch (e) {
          console.warn('⚠️ Could not load bedrijf data:', e);
        }
      } else {
        console.log('ℹ️ No bedrijf_id on tender');
      }
    } catch (error) {
      console.error('Error loading tender:', error);
      this.tender = null;
    }
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

      case 'planning':
        this.currentTabView = new PlanningTab(contentContainer, this.tenderId, {
          onNavigateToWorkflow: () => {
            this.tabs.setActiveTab('generate');
            this.loadTab('generate');
          }
        });
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
        this.currentTabView = new ChecklistTab(contentContainer, this.tenderId, {
          onNavigateToWorkflow: () => {
            this.tabs.setActiveTab('generate');
            this.loadTab('generate');
          }
        });
        break;

      case 'saved':
        this.currentTabView = new SavedDocumentsTab(contentContainer, this.tenderId, {
          onNavigateToWorkflow: () => {
            this.tabs.setActiveTab('generate');
            this.loadTab('generate');
          }
        });
        break;

      default:
        console.error(`❌ Unknown tab: ${tabKey}`);
        contentContainer.innerHTML = `
          <div class="placeholder-tab">
            <div class="placeholder-banner placeholder-banner--default">
              <div class="placeholder-icon">${this.getIcon('alertCircle', 32)}</div>
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
              <div class="placeholder-icon">${this.getIcon('alertCircle', 32)}</div>
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