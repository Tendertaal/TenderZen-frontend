/**
 * BureauSwitcher Component - FIXED & DEBUGGED
 * TenderZen v2.2 - Met "Alle bureau's" support + Debug Logging
 * 
 * FIXES in deze versie:
 * 1. ✅ isSuperAdmin wordt EERST geladen (voor render)
 * 2. ✅ localStorage check voor "ALL_BUREAUS"  
 * 3. ✅ Correcte initialisatie volgorde
 * 4. ✅ Uitgebreide debug logging
 * 5. ✅ Separate render methods voor super_admin vs regular
 */

import { bureauAccessService } from '/js/services/BureauAccessService.js';
import { UserService } from '/js/services/UserService.js';

export class BureauSwitcher {
    constructor() {
        this.element = null;
        this.isOpen = false;
        this.bureaus = [];
        this.currentBureau = null;
        this.isSuperAdmin = false;

        // Callback
        this.onBureauChange = null;

        // Bind methods
        this._handleClickOutside = this._handleClickOutside.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);

        console.log('🏗️ BureauSwitcher constructor called');
    }

    /**
     * Initialize en laad data
     * ============================================================
     * FIX: isSuperAdmin EERST laden, dan bureaus, dan render
     * ============================================================
     */
    async init() {
        console.log('🚀 BureauSwitcher.init() started');

        try {
            // ============================================================
            // STAP 1: Check super-admin status EERST (kritisch!)
            // ============================================================
            console.log('📊 STAP 1: Checking super-admin status...');
            try {
                const me = await UserService.getMe();
                this.isSuperAdmin = !!(me && me.is_super_admin);
                console.log('✅ UserService.getMe() result:', me);
                console.log('✅ is_super_admin from backend:', me?.is_super_admin);
                console.log('✅ this.isSuperAdmin set to:', this.isSuperAdmin);
            } catch (e) {
                console.error('❌ Could not determine super-admin status:', e);
                this.isSuperAdmin = false;
                console.log('⚠️ Defaulting this.isSuperAdmin to:', this.isSuperAdmin);
            }

            // ============================================================
            // STAP 2: Laad bureaus
            // ============================================================
            console.log('📊 STAP 2: Loading bureaus...');
            this.bureaus = await bureauAccessService.getUserBureaus();
            console.log('✅ Loaded bureaus:', this.bureaus.length, this.bureaus);

            // ============================================================
            // STAP 3: Bepaal current bureau (met localStorage check)
            // ============================================================
            console.log('📊 STAP 3: Determining current bureau...');
            const savedBureauId = localStorage.getItem('selectedBureauId');
            console.log('💾 localStorage.selectedBureauId:', savedBureauId);

            if (savedBureauId === 'ALL_BUREAUS') {
                if (this.isSuperAdmin) {
                    this.currentBureau = null;
                    console.log('⭐ Restored: Alle bureau\'s (super_admin with saved preference)');
                } else {
                    console.warn('⚠️ ALL_BUREAUS in localStorage but user is NOT super_admin!');
                    // Fall back to regular bureau
                    this.currentBureau = bureauAccessService.getCurrentBureau();
                    if (!this.currentBureau && this.bureaus.length > 0) {
                        this.currentBureau = await bureauAccessService.initializeBureauContext();
                    }
                }
            } else {
                // Regulier bureau selecteren
                this.currentBureau = bureauAccessService.getCurrentBureau();
                console.log('📋 getCurrentBureau() returned:', this.currentBureau);

                // Als nog geen bureau geselecteerd, initialiseer
                if (!this.currentBureau && this.bureaus.length > 0) {
                    console.log('🔄 No current bureau, initializing...');
                    this.currentBureau = await bureauAccessService.initializeBureauContext();
                    console.log('✅ Initialized to:', this.currentBureau);
                }
            }

            console.log('✅ Final currentBureau:', this.currentBureau);

            // ============================================================
            // STAP 4: Listen for bureau changes
            // ============================================================
            bureauAccessService.onBureauChange((event, data) => {
                if (event === 'bureauChanged') {
                    console.log('🔄 Bureau changed event:', data);
                    this.currentBureau = data;
                    this._updateDisplay();
                }
            });

            console.log('✅ BureauSwitcher.init() completed successfully');
            return this;

        } catch (error) {
            console.error('❌ Error initializing BureauSwitcher:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    /**
     * Render de component
     */
    render() {
        console.log('🎨 BureauSwitcher.render() called');
        console.log('   - isSuperAdmin:', this.isSuperAdmin);
        console.log('   - currentBureau:', this.currentBureau);
        console.log('   - bureaus count:', this.bureaus.length);

        this.element = document.createElement('div');
        this.element.className = 'bureau-switcher';
        this.element.innerHTML = this._getHTML();

        this._bindEvents();

        console.log('✅ Render complete');
        return this.element;
    }

    /**
     * Genereer HTML
     * ============================================================
     * FIX: Super_admins krijgen ALTIJD dropdown met "Alle bureau's"
     * ============================================================
     */
    _getHTML() {
        const current = this.currentBureau;

        console.log('🎨 _getHTML() generating markup:', {
            isSuperAdmin: this.isSuperAdmin,
            currentBureau: current?.bureau_naam || 'Alle bureau\'s (null)',
            bureauCount: this.bureaus.length
        });

        // ============================================================
        // Super_admins: Toon dropdown met "Alle bureau's" optie
        // ============================================================
        if (this.isSuperAdmin) {
            console.log('⭐ Rendering SUPER_ADMIN dropdown with "Alle bureau\'s"');
            return this._renderSuperAdminDropdown(current);
        }

        console.log('👤 Rendering REGULAR user dropdown (no "Alle bureau\'s")');

        // Niet super_admin: reguliere logica
        const hasMultipleBureaus = this.bureaus.length > 1;

        if (!current) {
            return `
                <div class="bureau-switcher__current bureau-switcher__current--empty">
                    <span class="bureau-switcher__name">Geen bureau</span>
                </div>
            `;
        }

        if (!hasMultipleBureaus) {
            return `
                <div class="bureau-switcher__current bureau-switcher__current--single">
                    ${this._getBureauIcon(current)}
                    <span class="bureau-switcher__name">${this._escapeHtml(current.bureau_naam)}</span>
                </div>
            `;
        }

        // Multiple bureaus: toon dropdown (zonder "Alle bureau's")
        return this._renderRegularDropdown(current);
    }

    /**
     * Render dropdown voor super_admins
     * ============================================================
     * INCLUSIEF "Alle bureau's" optie bovenaan
     * ============================================================
     */
    _renderSuperAdminDropdown(current) {
        console.log('⭐ _renderSuperAdminDropdown() - creating super admin view');

        // Check of "Alle bureau's" actief is
        const isAlleBureausActive = (current === null);
        console.log('   - isAlleBureausActive:', isAlleBureausActive);

        // "Alle bureau's" optie (ALTIJD bovenaan voor super_admins)
        const alleBureausOption = `
            <button 
                class="bureau-switcher__option bureau-switcher__option--all ${isAlleBureausActive ? 'bureau-switcher__option--active' : ''}"
                data-bureau-id="ALL_BUREAUS"
                role="option"
                aria-selected="${isAlleBureausActive}"
            >
                <div class="bureau-switcher__icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    ⭐
                </div>
                <div class="bureau-switcher__option-info">
                    <span class="bureau-switcher__option-name">Alle bureau's</span>
                    <span class="bureau-switcher__option-role" style="color: #667eea; font-weight: 600;">Super Admin</span>
                </div>
                ${isAlleBureausActive ? `
                    <svg class="bureau-switcher__check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                ` : ''}
            </button>
            <div class="bureau-switcher__separator" style="height: 1px; background: #e0e0e0; margin: 4px 16px;"></div>
        `;

        // Bepaal wat er in de button getoond moet worden
        const displayIcon = current
            ? this._getBureauIcon(current)
            : '<div class="bureau-switcher__icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">⭐</div>';

        const displayName = current
            ? this._escapeHtml(current.bureau_naam)
            : 'Alle bureau\'s';

        console.log('   - Display name:', displayName);
        console.log('   - Rendering', this.bureaus.length, 'regular bureau options');

        return `
            <button 
                class="bureau-switcher__trigger" 
                aria-haspopup="listbox" 
                aria-expanded="false"
                title="Wissel van bureau"
            >
                ${displayIcon}
                <span class="bureau-switcher__name">${displayName}</span>
                <svg class="bureau-switcher__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div class="bureau-switcher__dropdown" role="listbox" hidden>
                <div class="bureau-switcher__dropdown-header">
                    <strong>Wissel bureau</strong>
                    <span style="font-size: 12px; color: #667eea;">⭐ Super Admin</span>
                </div>
                <div class="bureau-switcher__list">
                    ${alleBureausOption}
                    ${this.bureaus.map(bureau => this._getBureauOption(bureau)).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render dropdown voor reguliere users
     * ============================================================
     * ZONDER "Alle bureau's" optie
     * ============================================================
     */
    _renderRegularDropdown(current) {
        console.log('👤 _renderRegularDropdown() - creating regular user view');

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
        console.log('🔗 Binding event listeners');

        // Trigger click
        const trigger = this.element.querySelector('.bureau-switcher__trigger');
        if (trigger) {
            trigger.addEventListener('click', () => this._toggleDropdown());
        }

        // Option clicks
        const options = this.element.querySelectorAll('.bureau-switcher__option');
        console.log('   - Found', options.length, 'bureau options');

        options.forEach(option => {
            option.addEventListener('click', (e) => {
                const bureauId = e.currentTarget.dataset.bureauId;
                console.log('🖱️ Bureau option clicked:', bureauId);

                if (bureauId === 'ALL_BUREAUS') {
                    this._selectAlleBureaus();
                } else {
                    this._selectBureau(bureauId);
                }
            });
        });

        // Click outside
        document.addEventListener('click', this._handleClickOutside);

        // Keyboard
        this.element.addEventListener('keydown', this._handleKeyDown);
    }

    /**
     * Selecteer "Alle bureau's" (super_admin only)
     * ============================================================
     * BELANGRIJK: Trigger data reload via callback
     * ============================================================
     */
    async _selectAlleBureaus() {
        console.log('⭐ _selectAlleBureaus() called');
        console.log('   - Setting currentBureau to null');

        // Zet currentBureau op null
        this.currentBureau = null;

        // Sla op in localStorage
        localStorage.setItem('selectedBureauId', 'ALL_BUREAUS');
        console.log('   - Saved to localStorage: ALL_BUREAUS');

        // Update display
        this._updateDisplay();

        // Close dropdown
        this._closeDropdown();

        // Trigger callback (KRITISCH voor data reload!)
        if (this.onBureauChange) {
            console.log('🔄 Triggering onBureauChange(null) callback');
            this.onBureauChange(null);
        } else {
            console.warn('⚠️ No onBureauChange callback registered!');
        }

        console.log('✅ _selectAlleBureaus() completed');
    }

    /**
     * Toggle dropdown open/closed
     */
    _toggleDropdown() {
        this.isOpen = !this.isOpen;
        console.log('🔽 Toggle dropdown:', this.isOpen ? 'OPEN' : 'CLOSED');

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
                    if (bureauId === 'ALL_BUREAUS') {
                        this._selectAlleBureaus();
                    } else {
                        this._selectBureau(bureauId);
                    }
                }
                break;
        }
    }

    /**
     * Selecteer een bureau
     */
    async _selectBureau(bureauId) {
        if (bureauId === this.currentBureau?.bureau_id) {
            console.log('ℹ️ Bureau already selected, just closing dropdown');
            this._closeDropdown();
            return;
        }

        try {
            console.log('🔄 _selectBureau() called with:', bureauId);

            // Toon loading state
            this.element.classList.add('bureau-switcher--loading');

            // Switch bureau
            const newBureau = await bureauAccessService.switchBureau(bureauId);
            this.currentBureau = newBureau;
            localStorage.setItem('selectedBureauId', bureauId);

            console.log('✅ Bureau switched to:', newBureau.bureau_naam);

            // Update display
            this._updateDisplay();

            // Close dropdown
            this._closeDropdown();

            // Notify parent
            if (this.onBureauChange) {
                console.log('🔄 Triggering onBureauChange(bureau) callback');
                this.onBureauChange(newBureau);
            } else {
                console.warn('⚠️ No onBureauChange callback registered!');
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
        console.log('🔄 _updateDisplay() called');
        if (!this.element) {
            console.warn('⚠️ No element to update!');
            return;
        }

        // Re-render
        this.element.innerHTML = this._getHTML();
        this._bindEvents();

        console.log('✅ Display updated');
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
        console.log('🗑️ BureauSwitcher.destroy() called');
        document.removeEventListener('click', this._handleClickOutside);
        if (this.element) {
            this.element.remove();
        }
    }
}

export default BureauSwitcher;