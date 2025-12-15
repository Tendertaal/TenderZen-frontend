/**
 * TabNavigation Component
 * 4 hoofdtabs: Totaaloverzicht, Acquisitie, Inschrijvingen, Ingediend
 */

import { Component } from './Component.js';

export class TabNavigation extends Component {
    constructor(props = {}) {
        super(props);
        this.activeTab = props.activeTab || 'totaal';
        this.onTabChange = props.onTabChange || (() => {});
        this.tabs = [
            { id: 'totaal', label: 'Totaaloverzicht', count: 0 },
            { id: 'acquisitie', label: 'Acquisitie', count: 0 },
            { id: 'inschrijvingen', label: 'Inschrijvingen', count: 0 },
            { id: 'ingediend', label: 'Ingediend', count: 0 }
        ];
    }

    /**
     * Update tab counts
     */
    updateCounts(counts) {
        this.tabs = this.tabs.map(tab => ({
            ...tab,
            count: counts[tab.id] || 0
        }));
        
        if (this.element) {
            this.render();
        }
    }

    /**
     * Render tabs
     */
    render() {
        const nav = document.createElement('nav');
        nav.className = 'tab-navigation';
        
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'tabs-container';
        
        this.tabs.forEach(tab => {
            const tabBtn = document.createElement('button');
            tabBtn.className = `main-tab ${tab.id === this.activeTab ? 'active' : ''}`;
            tabBtn.dataset.tab = tab.id;
            
            tabBtn.innerHTML = `
                <span class="tab-label">${tab.label}</span>
                <span class="tab-count">${tab.count}</span>
            `;
            
            tabBtn.addEventListener('click', () => {
                this.switchTab(tab.id);
            });
            
            tabsContainer.appendChild(tabBtn);
        });
        
        nav.appendChild(tabsContainer);
        
        // If element already exists, replace content
        if (this.element) {
            this.element.replaceWith(nav);
        }
        
        this.element = nav;
        return nav;
    }

    /**
     * Switch active tab
     */
    switchTab(tabId) {
        if (this.activeTab === tabId) return;
        
        this.activeTab = tabId;
        
        // Update UI
        if (this.element) {
            const tabs = this.element.querySelectorAll('.main-tab');
            tabs.forEach(tab => {
                if (tab.dataset.tab === tabId) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
        }
        
        // Emit event
        this.emit('tab-change', tabId);
        this.onTabChange(tabId);
    }

    /**
     * Get active tab
     */
    getActiveTab() {
        return this.activeTab;
    }
}

export default TabNavigation;