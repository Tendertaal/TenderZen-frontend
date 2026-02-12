/**
 * ProfielView — Mijn Profiel pagina
 * TenderZen v1.0
 * Datum: 2026-02-11
 * 
 * Toont: persoonlijke gegevens, bureau-toegang, beveiliging,
 * systeembeheer (super-admin), recente activiteit.
 */

import { BaseView } from './BaseView.js';
import { apiService } from '../services/ApiService.js';

const Icons = window.Icons || {};

export class ProfielView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.profile = null;
        this.platformStats = null;
        this.isEditing = false;
        this.editData = {};
    }

    // ════════════════════════════════════════════════
    // ICON HELPER
    // ════════════════════════════════════════════════

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const opts = { size };
            if (color) opts.color = color;
            return Icons[name](opts);
        }
        return '';
    }

    // ════════════════════════════════════════════════
    // DATA LOADING
    // ════════════════════════════════════════════════

    async loadProfile() {
        try {
            const result = await apiService.request('/api/v1/profile');
            this.profile = result.data;
        } catch (error) {
            console.error('❌ Profiel laden mislukt:', error);
            this.profile = null;
        }
    }

    async loadPlatformStats() {
        if (!this.profile?.is_super_admin) return;
        try {
            const result = await apiService.request('/api/v1/profile/stats');
            this.platformStats = result.data;
        } catch (error) {
            console.warn('Platform stats niet beschikbaar:', error);
        }
    }

    async saveProfile() {
        try {
            const result = await apiService.request('/api/v1/profile', {
                method: 'PUT',
                body: JSON.stringify(this.editData)
            });

            // Update lokale data
            Object.assign(this.profile, result.data);
            this.isEditing = false;
            this.editData = {};
            this.render();

            // Update header avatar als naam is gewijzigd
            if (window.app?.header?.updateProfile) {
                window.app.header.updateProfile(this.profile);
            } else if (window.app?.header?.setUserProfile) {
                window.app.header.setUserProfile({
                    naam: this.profile.naam,
                    email: this.profile.email,
                    role: this.profile.role || 'member',
                    is_super_admin: this.profile.is_super_admin
                });
            }

            this._showNotification('Profiel bijgewerkt', 'success');
        } catch (error) {
            console.error('❌ Profiel opslaan mislukt:', error);
            this._showNotification('Opslaan mislukt', 'error');
        }
    }

    // ════════════════════════════════════════════════
    // MAIN RENDER
    // ════════════════════════════════════════════════

    async render(container) {
        if (container) this.container = container;
        if (!this.container) return;

        // Loading state
        this.container.innerHTML = `
            <div class="profiel-page">
                <div class="profiel-loading">
                    <div class="profiel-loading-spinner"></div>
                    <span>Profiel laden...</span>
                </div>
            </div>
        `;

        // Load data
        await this.loadProfile();
        await this.loadPlatformStats();

        if (!this.profile) {
            this.container.innerHTML = `
                <div class="profiel-page">
                    <div class="profiel-error">
                        ${this.getIcon('alertCircle', 24, '#dc2626')}
                        <p>Profiel kon niet worden geladen.</p>
                        <button class="pv-btn pv-btn--primary" id="pv-retry">Opnieuw proberen</button>
                    </div>
                </div>
            `;
            this.container.querySelector('#pv-retry')?.addEventListener('click', () => this.render());
            return;
        }

        // Update header context
        this.updateHeaderContext();

        // Render full page
        const p = this.profile;
        const isSuper = p.is_super_admin === true;
        const initialen = p.initialen || this._generateInitials(p.naam || p.email);

        this.container.innerHTML = `
            <div class="profiel-page">
                <div class="profiel-page-header">
                    <h1 class="profiel-page-title">Mijn Profiel</h1>
                    <p class="profiel-page-subtitle">Beheer je account, beveiliging en systeemtoegang</p>
                </div>

                <div class="profiel-grid">
                    <!-- LEFT: Identity Card -->
                    ${this._renderIdentityCard(p, initialen, isSuper)}

                    <!-- RIGHT: Sections -->
                    <div class="profiel-sections">
                        ${this._renderPersonalSection(p)}
                        ${this._renderBureauSection(p, isSuper)}
                        ${this._renderSecuritySection(p)}
                        ${isSuper ? this._renderSystemSection() : ''}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    updateHeaderContext() {
        if (window.app?.header) {
            window.app.header.setContext('profiel', {
                title: 'Mijn Profiel'
            });
        }
    }

    // ════════════════════════════════════════════════
    // IDENTITY CARD (LEFT SIDEBAR)
    // ════════════════════════════════════════════════

    _renderIdentityCard(p, initialen, isSuper) {
        const avatarKleur = p.avatar_kleur || 'linear-gradient(135deg, #3b82f6, #6366f1)';
        const avatarStyle = avatarKleur.includes('gradient')
            ? `background: ${avatarKleur}`
            : `background: ${avatarKleur}`;

        return `
            <aside class="pv-identity">
                <div class="pv-identity-banner">
                    <div class="pv-identity-avatar-wrap">
                        <div class="pv-identity-avatar" style="${avatarStyle}" title="Avatar">
                            ${initialen}
                        </div>
                    </div>
                </div>

                <div class="pv-identity-body">
                    <div class="pv-identity-name">${p.naam || 'Geen naam'}</div>
                    <div class="pv-identity-email">${p.email || ''}</div>
                    ${p.organisatie ? `<div class="pv-identity-org">${p.organisatie}</div>` : ''}

                    <div class="pv-identity-badges">
                        ${isSuper ? `
                            <span class="pv-badge pv-badge--super-admin">
                                ${this.getIcon('crown', 12)}
                                Super-Admin
                            </span>
                        ` : ''}
                        <span class="pv-badge ${p.mfa_active ? 'pv-badge--mfa-active' : 'pv-badge--mfa-inactive'}">
                            ${this.getIcon('shieldCheck', 10)}
                            MFA ${p.mfa_active ? 'Actief' : 'Inactief'}
                        </span>
                    </div>
                </div>

                <div class="pv-identity-stats">
                    <div class="pv-identity-stat">
                        <div class="pv-identity-stat-value">${p.bureau_count || 0}</div>
                        <div class="pv-identity-stat-label">Bureaus</div>
                    </div>
                    <div class="pv-identity-stat">
                        <div class="pv-identity-stat-value">${p.total_tenders || 0}</div>
                        <div class="pv-identity-stat-label">Tenders</div>
                    </div>
                </div>

                <div class="pv-identity-actions">
                    <button class="pv-identity-action" data-action="scroll-security">
                        ${this.getIcon('key', 16)}
                        Wachtwoord wijzigen
                    </button>
                    <button class="pv-identity-action" data-action="scroll-mfa">
                        ${this.getIcon('smartphone', 16)}
                        MFA Instellingen
                    </button>
                    <button class="pv-identity-action pv-identity-action--danger" data-action="logout">
                        ${this.getIcon('logOut', 16)}
                        Uitloggen
                    </button>
                </div>
            </aside>
        `;
    }

    // ════════════════════════════════════════════════
    // SECTION 1: Persoonlijke Gegevens
    // ════════════════════════════════════════════════

    _renderPersonalSection(p) {
        if (this.isEditing) {
            return this._renderPersonalEditMode(p);
        }

        return `
            <section class="pv-section" id="pv-section-personal">
                <div class="pv-section-header">
                    <div class="pv-section-title">
                        ${this.getIcon('user', 16, '#3b82f6')}
                        Persoonlijke Gegevens
                    </div>
                    <button class="pv-section-action" data-action="edit-personal">Bewerken</button>
                </div>
                <div class="pv-section-body">
                    <div class="pv-field-grid">
                        ${this._renderField('Volledige naam', p.naam)}
                        ${this._renderField('E-mailadres', p.email)}
                        ${this._renderField('Organisatie', p.organisatie)}
                        ${this._renderField('Functie', p.functie)}
                        ${this._renderField('Telefoonnummer', p.telefoon)}
                    </div>
                </div>
            </section>
        `;
    }

    _renderPersonalEditMode(p) {
        return `
            <section class="pv-section" id="pv-section-personal">
                <div class="pv-section-header">
                    <div class="pv-section-title">
                        ${this.getIcon('user', 16, '#3b82f6')}
                        Persoonlijke Gegevens
                    </div>
                    <button class="pv-section-action" data-action="cancel-edit">Annuleren</button>
                </div>
                <div class="pv-section-body">
                    <div class="pv-field-grid">
                        <div class="pv-field">
                            <label class="pv-field-label">Volledige naam</label>
                            <input class="pv-field-input" type="text" 
                                   data-field="naam" value="${p.naam || ''}" />
                        </div>
                        <div class="pv-field">
                            <label class="pv-field-label">E-mailadres</label>
                            <input class="pv-field-input" type="email" 
                                   data-field="email" value="${p.email || ''}" />
                        </div>
                        <div class="pv-field">
                            <label class="pv-field-label">Organisatie</label>
                            <input class="pv-field-input" type="text" 
                                   data-field="organisatie" value="${p.organisatie || ''}" />
                        </div>
                        <div class="pv-field">
                            <label class="pv-field-label">Functie</label>
                            <input class="pv-field-input" type="text" 
                                   data-field="functie" value="${p.functie || ''}" />
                        </div>
                        <div class="pv-field">
                            <label class="pv-field-label">Telefoonnummer</label>
                            <input class="pv-field-input" type="tel" 
                                   data-field="telefoon" value="${p.telefoon || ''}" 
                                   placeholder="+31 6 1234 5678" />
                        </div>
                    </div>
                    <div class="pv-form-actions">
                        <button class="pv-btn pv-btn--ghost" data-action="cancel-edit">Annuleren</button>
                        <button class="pv-btn pv-btn--primary" data-action="save-profile">
                            ${this.getIcon('save', 14)}
                            Opslaan
                        </button>
                    </div>
                </div>
            </section>
        `;
    }

    // ════════════════════════════════════════════════
    // SECTION 2: Bureau Toegang
    // ════════════════════════════════════════════════

    _renderBureauSection(p, isSuper) {
        const bureaus = p.bureaus || [];

        const bureauRows = bureaus.map(b => `
            <tr>
                <td>
                    <div class="pv-bureau-name">
                        ${b.role === 'super-admin' || isSuper
                            ? `<span class="pv-bureau-dot" title="Toegankelijk"></span>`
                            : (b.is_active ? `<span class="pv-bureau-dot" title="Actief"></span>` : '')}
                        ${b.bureau_naam || 'Onbekend'}
                    </div>
                </td>
                <td>
                    <span class="pv-bureau-role ${isSuper ? 'pv-bureau-role--super' : 'pv-bureau-role--' + b.role}">
                        ${isSuper ? 'Super-Admin' : this._formatRole(b.role)}
                    </span>
                </td>
                <td class="pv-bureau-count">${b.team_count ?? '-'} leden</td>
                <td class="pv-bureau-count">${b.tender_count ?? 0} tenders</td>
            </tr>
        `).join('');

        return `
            <section class="pv-section" id="pv-section-bureau">
                <div class="pv-section-header">
                    <div class="pv-section-title">
                        ${this.getIcon('buildingOffice', 16, '#d97706')}
                        Bureau Toegang
                    </div>
                </div>
                <div class="pv-section-body" style="padding: 0;">
                    <table class="pv-bureau-table">
                        <thead>
                            <tr>
                                <th style="padding-top:16px;">Bureau</th>
                                <th style="padding-top:16px;">Rol</th>
                                <th style="padding-top:16px;">Teamleden</th>
                                <th style="padding-top:16px;">Tenders</th>
                            </tr>
                        </thead>
                        <tbody>${bureauRows}</tbody>
                    </table>
                    ${isSuper ? `
                        <div style="padding: 12px 20px 16px;">
                            <div class="pv-notice pv-notice--amber">
                                ${this.getIcon('crown', 18, '#d97706')}
                                <div class="pv-notice-text">
                                    <strong>Super-Admin Account</strong> — Je hebt systeembrede toegang tot alle tenderbureaus. 
                                    Je account is niet gekoppeld aan een specifiek bureau. 
                                    Gebruik de Bureau Switcher in de header om tussen bureaus te wisselen.
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </section>
        `;
    }

    // ════════════════════════════════════════════════
    // SECTION 3: Beveiliging
    // ════════════════════════════════════════════════

    _renderSecuritySection(p) {
        return `
            <section class="pv-section" id="pv-section-security">
                <div class="pv-section-header">
                    <div class="pv-section-title">
                        ${this.getIcon('shieldCheck', 16, '#6366f1')}
                        Beveiliging
                    </div>
                </div>
                <div class="pv-section-body">
                    <div class="pv-security-grid">
                        <!-- MFA -->
                        <div class="pv-security-item" id="pv-section-mfa">
                            <div class="pv-security-left">
                                <div class="pv-security-icon pv-security-icon--${p.mfa_active ? 'green' : 'red'}">
                                    ${this.getIcon('smartphone', 18, p.mfa_active ? '#16a34a' : '#dc2626')}
                                </div>
                                <div>
                                    <div class="pv-security-title">Twee-Factor Authenticatie (MFA)</div>
                                    <div class="pv-security-desc">
                                        ${p.mfa_active ? 'TOTP authenticator app gekoppeld' : 'Niet ingesteld'}
                                    </div>
                                </div>
                            </div>
                            ${p.mfa_active
                                ? `<span class="pv-security-status pv-security-status--active">
                                       ${this.getIcon('check', 14)} Actief
                                   </span>`
                                : `<button class="pv-security-btn" data-action="setup-mfa">Instellen</button>`
                            }
                        </div>

                        <!-- Wachtwoord -->
                        <div class="pv-security-item">
                            <div class="pv-security-left">
                                <div class="pv-security-icon pv-security-icon--indigo">
                                    ${this.getIcon('key', 18, '#6366f1')}
                                </div>
                                <div>
                                    <div class="pv-security-title">Wachtwoord</div>
                                    <div class="pv-security-desc">
                                        ${p.updated_at
                                            ? 'Laatst gewijzigd: ' + this._formatDate(p.updated_at)
                                            : 'Nog nooit gewijzigd'}
                                    </div>
                                </div>
                            </div>
                            <button class="pv-security-btn" data-action="change-password">Wijzigen</button>
                        </div>

                        <!-- Wachtwoord hergebruik -->
                        <div class="pv-security-item">
                            <div class="pv-security-left">
                                <div class="pv-security-icon pv-security-icon--indigo">
                                    ${this.getIcon('shield', 18, '#6366f1')}
                                </div>
                                <div>
                                    <div class="pv-security-title">Wachtwoord Hergebruik</div>
                                    <div class="pv-security-desc">Laatste 5 wachtwoorden worden bewaard</div>
                                </div>
                            </div>
                            <span class="pv-security-status pv-security-status--active">
                                ${this.getIcon('check', 14)} Beschermd
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    // ════════════════════════════════════════════════
    // SECTION 4: Systeembeheer (Super-Admin)
    // ════════════════════════════════════════════════

    _renderSystemSection() {
        const stats = this.platformStats || {};

        return `
            <section class="pv-section" id="pv-section-system">
                <div class="pv-section-header">
                    <div class="pv-section-title">
                        ${this.getIcon('crown', 16, '#d97706')}
                        Systeembeheer
                        <span class="pv-badge pv-badge--super-admin" style="margin-left: 4px;">
                            Super-Admin
                        </span>
                    </div>
                </div>
                <div class="pv-section-body">
                    <div class="pv-system-stats">
                        <div class="pv-system-stat">
                            <div class="pv-system-stat-icon">
                                ${this.getIcon('buildingOffice', 20, '#d97706')}
                            </div>
                            <div class="pv-system-stat-value">${stats.bureaus ?? '-'}</div>
                            <div class="pv-system-stat-label">Bureaus</div>
                        </div>
                        <div class="pv-system-stat">
                            <div class="pv-system-stat-icon">
                                ${this.getIcon('users', 20, '#3b82f6')}
                            </div>
                            <div class="pv-system-stat-value">${stats.users ?? '-'}</div>
                            <div class="pv-system-stat-label">Gebruikers</div>
                        </div>
                        <div class="pv-system-stat">
                            <div class="pv-system-stat-icon">
                                ${this.getIcon('fileText', 20, '#6366f1')}
                            </div>
                            <div class="pv-system-stat-value">${stats.tenders ?? '-'}</div>
                            <div class="pv-system-stat-label">Tenders</div>
                        </div>
                    </div>

                    <div class="pv-notice pv-notice--amber" style="margin-top: 16px;">
                        ${this.getIcon('info', 18, '#d97706')}
                        <div class="pv-notice-text">
                            <strong>Architectuur v3.4</strong> — Je super-admin account is losgekoppeld van 
                            individuele bureaus. Bureau-context wordt bepaald door de Bureau Switcher of 
                            door de tender die je bekijkt. Data-isolatie is gegarandeerd op database-niveau 
                            via Row Level Security.
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    // ════════════════════════════════════════════════
    // FIELD HELPERS
    // ════════════════════════════════════════════════

    _renderField(label, value) {
        return `
            <div class="pv-field">
                <span class="pv-field-label">${label}</span>
                <span class="pv-field-value ${!value ? 'pv-field-value--muted' : ''}">
                    ${value || 'Niet ingesteld'}
                </span>
            </div>
        `;
    }

    _formatRole(role) {
        const labels = {
            'admin': 'Admin',
            'manager': 'Manager',
            'schrijver': 'Schrijver',
            'reviewer': 'Reviewer',
            'designer': 'Designer',
            'calculator': 'Calculator',
            'viewer': 'Viewer',
            'sales': 'Sales'
        };
        return labels[role] || role;
    }

    _formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('nl-NL', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    }

    _generateInitials(naam) {
        if (!naam) return '??';
        const parts = naam.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        return parts[0].substring(0, 2).toUpperCase();
    }

    _showNotification(message, type = 'info') {
        // Gebruik bestaande notification systeem als beschikbaar
        if (window.app?.showNotification) {
            window.app.showNotification(message, type);
            return;
        }
        // Fallback
        console.log(`[${type}] ${message}`);
    }

    // ════════════════════════════════════════════════
    // EVENT LISTENERS
    // ════════════════════════════════════════════════

    attachEventListeners() {
        if (!this.container) return;

        // Delegated click handler
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'edit-personal':
                    this.isEditing = true;
                    this.render();
                    break;

                case 'cancel-edit':
                    this.isEditing = false;
                    this.editData = {};
                    this.render();
                    break;

                case 'save-profile':
                    this._collectEditData();
                    this.saveProfile();
                    break;

                case 'change-password':
                    this._handleChangePassword();
                    break;

                case 'setup-mfa':
                    this._handleSetupMFA();
                    break;

                case 'scroll-security':
                    this._scrollToSection('security');
                    break;

                case 'scroll-mfa':
                    this._scrollToSection('mfa');
                    break;

                case 'logout':
                    this._handleLogout();
                    break;
            }
        });
    }

    _collectEditData() {
        const inputs = this.container.querySelectorAll('.pv-field-input[data-field]');
        this.editData = {};
        inputs.forEach(input => {
            const field = input.dataset.field;
            const value = input.value.trim();
            if (value !== (this.profile[field] || '')) {
                this.editData[field] = value || null;
            }
        });
    }

    _scrollToSection(id) {
        const el = this.container.querySelector(`#pv-section-${id}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.boxShadow = '0 0 0 2px #3b82f6';
            setTimeout(() => { el.style.boxShadow = ''; }, 2000);
        }
    }

    _handleChangePassword() {
        // Navigeer naar wachtwoord wijzigen of open modal
        if (window.app?.openPasswordChange) {
            window.app.openPasswordChange();
        } else {
            // Fallback: Supabase wachtwoord reset
            window.location.href = '/pages/reset-password.html';
        }
    }

    _handleSetupMFA() {
        // Navigeer naar MFA setup
        if (window.app?.openMFASetup) {
            window.app.openMFASetup();
        } else {
            this._showNotification('MFA setup wordt binnenkort beschikbaar', 'info');
        }
    }

    async _handleLogout() {
        try {
            if (window.supabase?.auth) {
                await window.supabase.auth.signOut();
            }
            window.location.href = '/pages/login.html';
        } catch (error) {
            console.error('Uitloggen mislukt:', error);
            window.location.href = '/pages/login.html';
        }
    }

    // ════════════════════════════════════════════════
    // CLEANUP
    // ════════════════════════════════════════════════

    cleanup() {
        this.profile = null;
        this.platformStats = null;
        this.isEditing = false;
        this.editData = {};
    }
}

export default ProfielView;