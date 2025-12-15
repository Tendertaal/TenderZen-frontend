/**
 * BedrijfSelector - Searchable dropdown met quick-create
 * TenderZen v1.0
 * 
 * FEATURES:
 * - Zoeken in bestaande bedrijven
 * - Quick-create nieuw bedrijf (alleen naam verplicht)
 * - Visuele feedback bij selectie
 * - Keyboard navigatie
 * 
 * USAGE:
 * const selector = new BedrijfSelector({
 *     container: document.getElementById('bedrijf-selector'),
 *     onSelect: (bedrijf) => console.log('Selected:', bedrijf),
 *     onCreate: (bedrijf) => console.log('Created:', bedrijf)
 * });
 */

import { bedrijvenService } from '/js/services/BedrijvenService.js';

const Icons = window.Icons || {};

export class BedrijfSelector {
    constructor(options = {}) {
        this.container = options.container;
        this.onSelect = options.onSelect || (() => { });
        this.onCreate = options.onCreate || (() => { });

        // State
        this.isOpen = false;
        this.searchQuery = '';
        this.results = [];
        this.selectedIndex = -1;
        this.selectedBedrijf = null;

        // Elements
        this.inputEl = null;
        this.dropdownEl = null;
        this.selectedEl = null;

        // Debounce timer
        this.searchTimer = null;

        if (this.container) {
            this.render();
        }
    }

    /**
     * Render the component
     */
    async render() {
        // Altijd bedrijvenlijst verversen bij render
        await bedrijvenService.loadBedrijven();
        this.container.innerHTML = `
            <div class="bedrijf-selector">
                <!-- Search Input -->
                <div class="selector-input-wrapper">
                    <span class="selector-icon">
                        ${Icons.search ? Icons.search({ size: 16, color: '#94a3b8' }) : '🔍'}
                    </span>
                    <input 
                        type="text" 
                        class="selector-input" 
                        placeholder="Zoek of maak bedrijf..."
                        autocomplete="off"
                    >
                    <span class="selector-chevron">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 16, color: '#94a3b8' }) : '▼'}
                    </span>
                </div>
                
                <!-- Dropdown -->
                <div class="selector-dropdown" style="display: none;">
                    <div class="dropdown-results"></div>
                </div>
                
                <!-- Selected Display -->
                <div class="selector-selected" style="display: none;">
                    <div class="selected-content">
                        <div class="selected-avatar"></div>
                        <div class="selected-info">
                            <div class="selected-name"></div>
                            <div class="selected-meta"></div>
                        </div>
                    </div>
                    <button type="button" class="selected-clear" title="Verwijderen">
                        ${Icons.x ? Icons.x({ size: 14 }) : '×'}
                    </button>
                </div>
            </div>
        `;

        this.inputEl = this.container.querySelector('.selector-input');
        this.dropdownEl = this.container.querySelector('.selector-dropdown');
        this.selectedEl = this.container.querySelector('.selector-selected');

        this.attachStyles();
        this.attachEventListeners();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Input events
        this.inputEl.addEventListener('focus', () => this.openDropdown());
        this.inputEl.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.inputEl.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Clear selection
        this.container.querySelector('.selected-clear').addEventListener('click', () => {
            this.clearSelection();
        });
    }

    /**
     * Handle search input
     */
    handleSearch(query) {
        this.searchQuery = query;

        // Debounce
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
            this.performSearch(query);
        }, 150);
    }

    /**
     * Perform search
     */
    async performSearch(query) {
        // Get matching bedrijven
        this.results = bedrijvenService.searchBedrijven(query);
        this.selectedIndex = -1;
        this.renderResults();
    }

    /**
     * Render search results
     */
    renderResults() {
        const resultsEl = this.dropdownEl.querySelector('.dropdown-results');

        let html = '';

        // Show results
        if (this.results.length > 0) {
            html += this.results.map((bedrijf, index) => `
                <div class="dropdown-item ${index === this.selectedIndex ? 'highlighted' : ''}" 
                     data-index="${index}" data-id="${bedrijf.id}">
                    <div class="item-avatar" style="background: ${this.getAvatarColor(bedrijf.bedrijfsnaam)}">
                        ${this.getInitials(bedrijf.bedrijfsnaam)}
                    </div>
                    <div class="item-info">
                        <div class="item-name">${this.highlightMatch(bedrijf.bedrijfsnaam, this.searchQuery)}</div>
                        <div class="item-meta">
                            ${bedrijf.kvk_nummer ? `KvK: ${bedrijf.kvk_nummer}` : ''}
                            ${bedrijf.kvk_nummer && bedrijf.plaats ? ' · ' : ''}
                            ${bedrijf.plaats || ''}
                        </div>
                    </div>
                </div>
            `).join('');
        } else if (this.searchQuery.length >= 2) {
            html += `
                <div class="dropdown-empty">
                    <span class="empty-icon">
                        ${Icons.search ? Icons.search({ size: 20, color: '#94a3b8' }) : ''}
                    </span>
                    <span>Geen bedrijf gevonden voor "${this.searchQuery}"</span>
                </div>
            `;
        }

        // Always show "create new" option if there's a search query
        if (this.searchQuery.length >= 2) {
            html += `
                <div class="dropdown-item dropdown-item--create" data-action="create">
                    <div class="item-icon">
                        ${Icons.plus ? Icons.plus({ size: 18, color: '#10b981' }) : '+'}
                    </div>
                    <div class="item-info">
                        <div class="item-name">"${this.searchQuery}" als nieuw bedrijf toevoegen</div>
                        <div class="item-meta">Klik om aan te maken</div>
                    </div>
                </div>
            `;
        }

        // Show hint if no search query
        if (this.searchQuery.length < 2 && this.results.length === 0) {
            html = `
                <div class="dropdown-hint">
                    <span class="hint-icon">
                        ${Icons.info ? Icons.info({ size: 16, color: '#94a3b8' }) : 'ℹ'}
                    </span>
                    <span>Typ minimaal 2 tekens om te zoeken</span>
                </div>
            `;
        }

        resultsEl.innerHTML = html;

        // Attach click handlers
        resultsEl.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.action === 'create') {
                    this.createNewBedrijf();
                } else {
                    const index = parseInt(item.dataset.index);
                    this.selectBedrijf(this.results[index]);
                }
            });
        });
    }

    /**
     * Handle keyboard navigation
     */
    handleKeydown(e) {
        if (!this.isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                this.openDropdown();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.results.length);
                this.renderResults();
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.renderResults();
                break;

            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0 && this.selectedIndex < this.results.length) {
                    this.selectBedrijf(this.results[this.selectedIndex]);
                } else if (this.searchQuery.length >= 2) {
                    this.createNewBedrijf();
                }
                break;

            case 'Escape':
                this.closeDropdown();
                break;
        }
    }

    /**
     * Select a bedrijf
     */
    selectBedrijf(bedrijf) {
        this.selectedBedrijf = bedrijf;
        this.closeDropdown();
        this.showSelected(bedrijf);
        this.onSelect(bedrijf);
    }

    /**
     * Create new bedrijf (quick-create with just name)
     */
    async createNewBedrijf() {
        const naam = this.searchQuery.trim();

        if (!naam) return;

        try {
            // Show loading state
            this.inputEl.disabled = true;
            this.inputEl.placeholder = 'Aanmaken...';

            // Create bedrijf with just the name
            const nieuwBedrijf = await bedrijvenService.createBedrijf({
                bedrijfsnaam: naam
            });
            // Na create altijd bedrijvenlijst verversen
            await bedrijvenService.loadBedrijven();
            console.log('✅ Nieuw bedrijf aangemaakt:', nieuwBedrijf);
            // Select the new bedrijf
            this.selectBedrijf(nieuwBedrijf);
            this.onCreate(nieuwBedrijf);

        } catch (error) {
            console.error('❌ Error creating bedrijf:', error);
            alert('Kon bedrijf niet aanmaken: ' + error.message);
        } finally {
            this.inputEl.disabled = false;
            this.inputEl.placeholder = 'Zoek of maak bedrijf...';
        }
    }

    /**
     * Show selected bedrijf
     */
    showSelected(bedrijf) {
        const inputWrapper = this.container.querySelector('.selector-input-wrapper');
        inputWrapper.style.display = 'none';

        this.selectedEl.style.display = 'flex';
        this.selectedEl.querySelector('.selected-avatar').style.background = this.getAvatarColor(bedrijf.bedrijfsnaam);
        this.selectedEl.querySelector('.selected-avatar').textContent = this.getInitials(bedrijf.bedrijfsnaam);
        this.selectedEl.querySelector('.selected-name').textContent = bedrijf.bedrijfsnaam;

        let meta = '';
        if (bedrijf.kvk_nummer) meta += `KvK: ${bedrijf.kvk_nummer}`;
        if (bedrijf.kvk_nummer && bedrijf.plaats) meta += ' · ';
        if (bedrijf.plaats) meta += bedrijf.plaats;
        if (bedrijf.rating) meta += ` · ${'⭐'.repeat(bedrijf.rating)}`;

        this.selectedEl.querySelector('.selected-meta').textContent = meta || 'Geen extra gegevens';
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.selectedBedrijf = null;
        this.searchQuery = '';
        this.inputEl.value = '';

        const inputWrapper = this.container.querySelector('.selector-input-wrapper');
        inputWrapper.style.display = 'flex';
        this.selectedEl.style.display = 'none';

        this.onSelect(null);
    }

    /**
     * Open dropdown
     */
    openDropdown() {
        this.isOpen = true;
        this.dropdownEl.style.display = 'block';
        this.performSearch(this.searchQuery);
    }

    /**
     * Close dropdown
     */
    closeDropdown() {
        this.isOpen = false;
        this.dropdownEl.style.display = 'none';
        this.selectedIndex = -1;
    }

    /**
     * Set value programmatically
     */
    setValue(bedrijf) {
        if (bedrijf) {
            this.selectBedrijf(bedrijf);
        } else {
            this.clearSelection();
        }
    }

    /**
     * Get current value
     */
    getValue() {
        return this.selectedBedrijf;
    }

    /**
     * Highlight matching text
     */
    highlightMatch(text, query) {
        if (!query || query.length < 2) return text;

        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Get initials from name
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].charAt(0).toUpperCase();
        }
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    /**
     * Get avatar color based on name
     */
    getAvatarColor(name) {
        const colors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
            '#10b981', '#06b6d4', '#6366f1', '#ef4444'
        ];

        if (!name) return colors[0];

        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }

        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Attach styles
     */
    attachStyles() {
        if (document.getElementById('bedrijf-selector-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'bedrijf-selector-styles';
        styles.textContent = `
            .bedrijf-selector {
                position: relative;
                width: 100%;
            }
            
            .selector-input-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 10px 12px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                transition: all 0.15s ease;
            }
            
            .selector-input-wrapper:focus-within {
                border-color: #8b5cf6;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
            }
            
            .selector-icon {
                flex-shrink: 0;
            }
            
            .selector-input {
                flex: 1;
                border: none;
                outline: none;
                font-size: 14px;
                background: transparent;
            }
            
            .selector-input::placeholder {
                color: #94a3b8;
            }
            
            .selector-chevron {
                flex-shrink: 0;
                transition: transform 0.2s ease;
            }
            
            .selector-input-wrapper:focus-within .selector-chevron {
                transform: rotate(180deg);
            }
            
            /* Dropdown */
            .selector-dropdown {
                position: absolute;
                top: calc(100% + 4px);
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                max-height: 300px;
                overflow-y: auto;
                z-index: 100;
            }
            
            .dropdown-results {
                padding: 4px;
            }
            
            .dropdown-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 10px 12px;
                border-radius: 8px;
                cursor: pointer;
                transition: background 0.1s ease;
            }
            
            .dropdown-item:hover,
            .dropdown-item.highlighted {
                background: #f1f5f9;
            }
            
            .dropdown-item--create {
                border-top: 1px solid #e2e8f0;
                margin-top: 4px;
                padding-top: 12px;
            }
            
            .dropdown-item--create:hover {
                background: #ecfdf5;
            }
            
            .dropdown-item--create .item-name {
                color: #10b981;
                font-weight: 500;
            }
            
            .item-avatar {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 14px;
                flex-shrink: 0;
            }
            
            .item-icon {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #d1fae5;
                flex-shrink: 0;
            }
            
            .item-info {
                flex: 1;
                min-width: 0;
            }
            
            .item-name {
                font-size: 14px;
                font-weight: 500;
                color: #0f172a;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .item-name mark {
                background: #fef08a;
                color: inherit;
                padding: 0 2px;
                border-radius: 2px;
            }
            
            .item-meta {
                font-size: 12px;
                color: #64748b;
                margin-top: 2px;
            }
            
            .dropdown-empty,
            .dropdown-hint {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 16px;
                color: #64748b;
                font-size: 13px;
            }
            
            /* Selected Display */
            .selector-selected {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
            }
            
            .selected-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .selected-avatar {
                width: 40px;
                height: 40px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 16px;
            }
            
            .selected-name {
                font-size: 14px;
                font-weight: 600;
                color: #0f172a;
            }
            
            .selected-meta {
                font-size: 12px;
                color: #64748b;
                margin-top: 2px;
            }
            
            .selected-clear {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                border-radius: 6px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #94a3b8;
                transition: all 0.15s ease;
            }
            
            .selected-clear:hover {
                background: #fef2f2;
                color: #dc2626;
            }
            
            /* Scrollbar */
            .selector-dropdown::-webkit-scrollbar {
                width: 6px;
            }
            
            .selector-dropdown::-webkit-scrollbar-track {
                background: transparent;
            }
            
            .selector-dropdown::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 3px;
            }
        `;

        document.head.appendChild(styles);
    }
}

export default BedrijfSelector;