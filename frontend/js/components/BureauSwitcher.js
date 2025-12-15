/**
 * BureauSwitcher Component
 * TenderZen v2.0
 * 
 * Dropdown component waarmee users kunnen wisselen tussen bureaus.
 * Wordt getoond in de header naast het logo.
 * 
 * Features:
 * - Toon huidige bureau
 * - Dropdown met alle beschikbare bureaus
 * - Snelle switch met keyboard support
 * - Rol indicatie per bureau
 * 
 * CHANGELOG:
 * - v1.0: Initial version
 */

import { bureauAccessService } from '/js/services/BureauAccessService.js';

export class BureauSwitcher {
    constructor() {
        this.element = null;
        this.isOpen = false;
        this.bureaus = [];
        this.currentBureau = null;
        
        // Callback
        this.onBureauChange = null;
        
        // Bind methods
        this._handleClickOutside = this._handleClickOutside.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    /**
     * Initialize en laad data
     */
    async init() {
        try {
            // Laad bureaus
            this.bureaus = await bureauAccessService.getUserBureaus();
            this.currentBureau = bureauAccessService.getCurrentBureau();
            
            // Als nog geen bureau geselecteerd, initialiseer
            if (!this.currentBureau && this.bureaus.length > 0) {
                this.currentBureau = await bureauAccessService.initializeBureauContext();
            }
            
            // Listen voor changes
            bureauAccessService.onBureauChange((event, data) => {
                if (event === 'bureauChanged') {
                    this.currentBureau = data;
                    this._updateDisplay();
                }
            });
            
            return this;
        } catch (error) {
            console.error('❌ Error initializing BureauSwitcher:', error);
            throw error;
        }
    }

    /**
     * Render de component
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'bureau-switcher';
        this.element.innerHTML = this._getHTML();
        
        this._bindEvents();
        return this.element;
    }

    /**
     * Genereer HTML
     */
    _getHTML() {
        const current = this.currentBureau;
        const hasMutipleBureaus = this.bureaus.length > 1;
        
        // Als geen bureau of maar 1 bureau, toon alleen de naam
        if (!current) {
            return `
                <div class="bureau-switcher__current bureau-switcher__current--empty">
                    <span class="bureau-switcher__name">Geen bureau</span>
                </div>
            `;
        }
        
        if (!hasMutipleBureaus) {
            return `
                <div class="bureau-switcher__current bureau-switcher__current--single">
                    ${this._getBureauIcon(current)}
                    <span class="bureau-switcher__name">${this._escapeHtml(current.bureau_naam)}</span>
                </div>
            `;
        }
        
        // Multiple bureaus: toon dropdown
        return `
            <button 
                class="bureau-switcher__trigger" 
                aria-haspopup="listbox" 
                aria-expanded="false"
                title="Wissel van bureau"
            >
                ${this._getBureauIcon(current)}
                <span class="bureau-switcher__name">${this._escapeHtml(current.bureau_naam)}</span>
                <svg class="bureau-switcher__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            
            <div class="bureau-switcher__dropdown" role="listbox" hidden>
                <div class="bureau-switcher__dropdown-header">
                    Wissel bureau
                </div>
                <div class="bureau-switcher__list">
                    ${this.bureaus.map(bureau => this._getBureauOption(bureau)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Genereer bureau icoon (eerste letter of logo)
     */
    _getBureauIcon(bureau) {
        if (bureau.bureau_logo) {
            return `<img src="${bureau.bureau_logo}" alt="" class="bureau-switcher__logo">`;
        }
        
        const initial = bureau.bureau_naam?.charAt(0)?.toUpperCase() || '?';
        const color = this._stringToColor(bureau.bureau_naam || '');
        
        return `
            <div class="bureau-switcher__icon" style="background-color: ${color}">
                ${initial}
            </div>
        `;
    }

    /**
     * Genereer bureau optie voor dropdown
     */
    _getBureauOption(bureau) {
        const isCurrent = bureau.bureau_id === this.currentBureau?.bureau_id;
        const roleInfo = this._getRoleInfo(bureau.user_role);
        
        return `
            <button 
                class="bureau-switcher__option ${isCurrent ? 'bureau-switcher__option--active' : ''}"
                data-bureau-id="${bureau.bureau_id}"
                role="option"
                aria-selected="${isCurrent}"
            >
                ${this._getBureauIcon(bureau)}
                <div class="bureau-switcher__option-info">
                    <span class="bureau-switcher__option-name">${this._escapeHtml(bureau.bureau_naam)}</span>
                    <span class="bureau-switcher__option-role" style="color: ${roleInfo.color}">
                        ${roleInfo.label}
                    </span>
                </div>
                ${isCurrent ? `
                    <svg class="bureau-switcher__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                ` : ''}
            </button>
        `;
    }

    /**
     * Bind event listeners
     */
    _bindEvents() {
        // Trigger click
        const trigger = this.element.querySelector('.bureau-switcher__trigger');
        if (trigger) {
            trigger.addEventListener('click', () => this._toggleDropdown());
        }
        
        // Option clicks
        this.element.querySelectorAll('.bureau-switcher__option').forEach(option => {
            option.addEventListener('click', (e) => {
                const bureauId = e.currentTarget.dataset.bureauId;
                this._selectBureau(bureauId);
            });
        });
        
        // Click outside
        document.addEventListener('click', this._handleClickOutside);
        
        // Keyboard
        this.element.addEventListener('keydown', this._handleKeyDown);
    }

    /**
     * Toggle dropdown open/closed
     */
    _toggleDropdown() {
        this.isOpen = !this.isOpen;
        
        const trigger = this.element.querySelector('.bureau-switcher__trigger');
        const dropdown = this.element.querySelector('.bureau-switcher__dropdown');
        
        if (trigger) {
            trigger.setAttribute('aria-expanded', this.isOpen);
        }
        
        if (dropdown) {
            dropdown.hidden = !this.isOpen;
            
            if (this.isOpen) {
                // Focus eerste optie
                const firstOption = dropdown.querySelector('.bureau-switcher__option');
                if (firstOption) firstOption.focus();
            }
        }
    }

    /**
     * Sluit dropdown
     */
    _closeDropdown() {
        this.isOpen = false;
        
        const trigger = this.element.querySelector('.bureau-switcher__trigger');
        const dropdown = this.element.querySelector('.bureau-switcher__dropdown');
        
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
        
        if (dropdown) {
            dropdown.hidden = true;
        }
    }

    /**
     * Handle click outside
     */
    _handleClickOutside(e) {
        if (this.isOpen && !this.element.contains(e.target)) {
            this._closeDropdown();
        }
    }

    /**
     * Handle keyboard navigation
     */
    _handleKeyDown(e) {
        if (!this.isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                this._toggleDropdown();
            }
            return;
        }
        
        const options = Array.from(this.element.querySelectorAll('.bureau-switcher__option'));
        const currentIndex = options.findIndex(opt => opt === document.activeElement);
        
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this._closeDropdown();
                this.element.querySelector('.bureau-switcher__trigger')?.focus();
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
                options[nextIndex]?.focus();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
                options[prevIndex]?.focus();
                break;
                
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (document.activeElement?.classList.contains('bureau-switcher__option')) {
                    const bureauId = document.activeElement.dataset.bureauId;
                    this._selectBureau(bureauId);
                }
                break;
        }
    }

    /**
     * Selecteer een bureau
     */
    async _selectBureau(bureauId) {
        if (bureauId === this.currentBureau?.bureau_id) {
            this._closeDropdown();
            return;
        }
        
        try {
            // Toon loading state
            this.element.classList.add('bureau-switcher--loading');
            
            // Switch bureau
            const newBureau = await bureauAccessService.switchBureau(bureauId);
            this.currentBureau = newBureau;
            
            // Update display
            this._updateDisplay();
            
            // Close dropdown
            this._closeDropdown();
            
            // Notify parent
            if (this.onBureauChange) {
                this.onBureauChange(newBureau);
            }
            
        } catch (error) {
            console.error('❌ Error switching bureau:', error);
            alert('Er ging iets fout bij het wisselen van bureau.');
        } finally {
            this.element.classList.remove('bureau-switcher--loading');
        }
    }

    /**
     * Update de display na bureau change
     */
    _updateDisplay() {
        if (!this.element) return;
        
        // Re-render
        this.element.innerHTML = this._getHTML();
        this._bindEvents();
    }

    /**
     * Haal rol info op
     */
    _getRoleInfo(role) {
        const roles = {
            'admin': { label: 'Admin', color: '#ef4444' },
            'manager': { label: 'Manager', color: '#f59e0b' },
            'schrijver': { label: 'Schrijver', color: '#3b82f6' },
            'reviewer': { label: 'Reviewer', color: '#8b5cf6' },
            'viewer': { label: 'Viewer', color: '#6b7280' }
        };
        return roles[role] || { label: role, color: '#6b7280' };
    }

    /**
     * Genereer consistente kleur van string
     */
    _stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
            '#f59e0b', '#10b981', '#06b6d4', '#6366f1'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }

    /**
     * Escape HTML
     */
    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Cleanup
     */
    destroy() {
        document.removeEventListener('click', this._handleClickOutside);
        if (this.element) {
            this.element.remove();
        }
    }
}

export default BureauSwitcher;