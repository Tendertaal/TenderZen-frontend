// frontend/js/components/AIDocumentenTabs.js
// VERSIE: 20250129_1520 - Tab volgorde aangepast: Aanbestedingsstukken voor Planning

export class AIDocumentenTabs {
  constructor(container, options = {}) {
    this.container = container;
    this.onTabChange = options.onTabChange || (() => {});
    this.activeTab = 'generate';
    
    // Tab configuratie - logische volgorde voor workflow
    this.tabs = [
      {
        key: 'generate',
        label: 'AI Workflow',
        icon: 'ai',
        description: 'Genereer AI documenten'
      },
      {
        key: 'documents',
        label: 'Aanbestedingsstukken',
        icon: 'folderOpen',
        description: 'Upload tenderdocumenten'
      },
      {
        key: 'planning',
        label: 'Planning',
        icon: 'calendar',
        description: 'Tenderplanning en deadlines'
      },
      {
        key: 'checklist',
        label: 'Checklist',
        icon: 'checkSquare',
        description: 'Inlever overzicht'
      },
      {
        key: 'saved',
        label: 'Gegenereerde Documenten',
        icon: 'fileCheck',
        description: 'Opgeslagen resultaten'
      }
    ];
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
    const wrapper = document.createElement('div');
    wrapper.className = 'ai-tabs-navigation';
    wrapper.innerHTML = `
      <div class="tabs-container">
        ${this.tabs.map(tab => `
          <button 
            class="tab-button ${tab.key === this.activeTab ? 'active' : ''}"
            data-tab="${tab.key}"
            title="${tab.description}">
            <span class="tab-icon">${this.getIcon(tab.icon, 18)}</span>
            <span class="tab-label">${tab.label}</span>
          </button>
        `).join('')}
      </div>
    `;
    
    this.container.innerHTML = '';
    this.container.appendChild(wrapper);
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.container.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const tabKey = button.dataset.tab;
        this.setActiveTab(tabKey);
        this.onTabChange(tabKey);
      });
    });
  }

  setActiveTab(tabKey) {
    this.activeTab = tabKey;
    this.container.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });
  }

  getActiveTab() {
    return this.activeTab;
  }
}