/**
 * MFASettings Component
 * TenderZen Design System v2.0 - SVG Icons
 * Settings pagina voor MFA beheer
 */

import { supabase } from '/js/config.js';
import { MFAEnrollment } from '/js/components/MFAEnrollment.js';

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

export class MFASettings {
    constructor() {
        this.container = null;
        this.factors = [];
        this.mfaRequired = false;
        this.isSuperAdmin = false;
        this.enrollmentComponent = null;
        this.showingEnrollment = false;
    }

    /**
     * Mount component
     */
    async mount(container) {
        this.container = container;
        await this.loadData();
    }

    /**
     * Load MFA data
     */
    async loadData() {
        this.render('loading');
        
        try {
            // Get current user info
            const { data: { user } } = await supabase.auth.getUser();
            
            // Get user profile
            const { data: profile } = await supabase
                .from('users')
                .select('is_super_admin, mfa_required')
                .eq('id', user.id)
                .single();
            
            this.isSuperAdmin = profile?.is_super_admin || false;
            this.mfaRequired = profile?.mfa_required || false;

            // Get MFA factors
            const { data: factorsData, error } = await supabase.auth.mfa.listFactors();
            
            if (error) throw error;

            this.factors = [...(factorsData.totp || []), ...(factorsData.phone || [])]
                .filter(f => f.status === 'verified');

            this.render('settings');

        } catch (error) {
            console.error('❌ Load MFA data error:', error);
            this.render('error', error.message);
        }
    }

    /**
     * Render component
     */
    render(state = 'loading', errorMessage = '') {
        if (!this.container) return;

        switch (state) {
            case 'loading':
                this.container.innerHTML = this.renderLoading();
                break;
            case 'settings':
                this.container.innerHTML = this.renderSettings();
                this.attachEventListeners();
                break;
            case 'enrollment':
                this.container.innerHTML = this.renderEnrollmentContainer();
                this.startEnrollment();
                break;
            case 'error':
                this.container.innerHTML = this.renderError(errorMessage);
                break;
        }
    }

    /**
     * Render loading
     */
    renderLoading() {
        return `
            <div class="mfa-settings">
                <div class="mfa-loading">
                    <div class="spinner"></div>
                    <p>Laden...</p>
                </div>
            </div>
        `;
    }

    /**
     * Render settings
     */
    renderSettings() {
        const hasMFA = this.factors.length > 0;
        
        return `
            <div class="mfa-settings">
                <div class="settings-section">
                    <div class="settings-header">
                        <h2>
                            <span class="header-icon">
                                ${Icons.shieldCheck ? Icons.shieldCheck({ size: 20, color: '#8b5cf6' }) : ''}
                            </span>
                            Twee-Factor Authenticatie (2FA)
                        </h2>
                        <p class="settings-description">
                            Voeg een extra beveiligingslaag toe aan je account door een 
                            authenticator app te gebruiken.
                        </p>
                    </div>

                    <div class="mfa-status-card ${hasMFA ? 'enabled' : 'disabled'}">
                        <div class="status-icon">
                            ${hasMFA 
                                ? (Icons.checkCircle ? Icons.checkCircle({ size: 24, color: '#10b981' }) : '')
                                : (Icons.alertTriangle ? Icons.alertTriangle({ size: 24, color: '#f59e0b' }) : '')
                            }
                        </div>
                        <div class="status-content">
                            <h3>${hasMFA ? '2FA is ingeschakeld' : '2FA is uitgeschakeld'}</h3>
                            <p>${hasMFA 
                                ? 'Je account is beveiligd met twee-factor authenticatie.' 
                                : 'Je account is nog niet beveiligd met 2FA.'
                            }</p>
                        </div>
                        ${this.mfaRequired ? `
                            <div class="status-badge required">
                                ${Icons.lock ? Icons.lock({ size: 12, color: '#ffffff' }) : ''}
                                Verplicht
                            </div>
                        ` : ''}
                    </div>

                    ${hasMFA ? this.renderFactorsList() : this.renderSetupPrompt()}
                </div>

                ${hasMFA ? this.renderSecurityTips() : ''}
            </div>
        `;
    }

    /**
     * Render factors list
     */
    renderFactorsList() {
        return `
            <div class="factors-section">
                <h3>Ingestelde Authenticators</h3>
                <div class="factors-list">
                    ${this.factors.map(factor => `
                        <div class="factor-item">
                            <div class="factor-icon">
                                ${factor.factor_type === 'totp' 
                                    ? (Icons.smartphone ? Icons.smartphone({ size: 20, color: '#3b82f6' }) : '')
                                    : (Icons.phone ? Icons.phone({ size: 20, color: '#3b82f6' }) : '')
                                }
                            </div>
                            <div class="factor-info">
                                <div class="factor-name">
                                    ${factor.friendly_name || 'Authenticator App'}
                                </div>
                                <div class="factor-meta">
                                    ${factor.factor_type === 'totp' ? 'App Authenticator' : 'Telefoon'}
                                    · Toegevoegd op ${this.formatDate(factor.created_at)}
                                </div>
                            </div>
                            <div class="factor-actions">
                                ${!this.mfaRequired || this.factors.length > 1 ? `
                                    <button class="btn btn-danger btn-sm" 
                                            data-factor-id="${factor.id}"
                                            data-action="remove">
                                        ${Icons.trash ? Icons.trash({ size: 14, color: '#ffffff' }) : ''}
                                        Verwijderen
                                    </button>
                                ` : `
                                    <span class="factor-required-note">
                                        2FA is verplicht
                                    </span>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="factors-actions">
                    <button class="btn btn-secondary" id="btn-add-factor">
                        ${Icons.plus ? Icons.plus({ size: 16, color: 'currentColor' }) : ''}
                        Voeg extra authenticator toe
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render setup prompt (when no MFA)
     */
    renderSetupPrompt() {
        return `
            <div class="setup-prompt">
                <div class="setup-benefits">
                    <h3>Waarom 2FA gebruiken?</h3>
                    <ul class="benefits-list">
                        <li>
                            <span class="benefit-icon">
                                ${Icons.shield ? Icons.shield({ size: 16, color: '#8b5cf6' }) : ''}
                            </span>
                            <span>Beschermt tegen gehackte wachtwoorden</span>
                        </li>
                        <li>
                            <span class="benefit-icon">
                                ${Icons.lock ? Icons.lock({ size: 16, color: '#8b5cf6' }) : ''}
                            </span>
                            <span>Extra verificatie bij elke login</span>
                        </li>
                        <li>
                            <span class="benefit-icon">
                                ${Icons.smartphone ? Icons.smartphone({ size: 16, color: '#8b5cf6' }) : ''}
                            </span>
                            <span>Werkt met gratis authenticator apps</span>
                        </li>
                        <li>
                            <span class="benefit-icon">
                                ${Icons.zap ? Icons.zap({ size: 16, color: '#8b5cf6' }) : ''}
                            </span>
                            <span>Snel en makkelijk in te stellen</span>
                        </li>
                    </ul>
                </div>

                <button class="btn btn-primary btn-lg" id="btn-setup-mfa">
                    ${Icons.shieldCheck ? Icons.shieldCheck({ size: 20, color: '#ffffff' }) : ''}
                    2FA Instellen
                </button>

                ${this.mfaRequired ? `
                    <div class="mfa-required-warning">
                        <span class="warning-icon">
                            ${Icons.alertTriangle ? Icons.alertTriangle({ size: 18, color: '#92400e' }) : ''}
                        </span>
                        <span>2FA is verplicht voor je account. Stel het nu in om door te gaan.</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render security tips
     */
    renderSecurityTips() {
        return `
            <div class="settings-section security-tips">
                <h3>
                    ${Icons.lightbulb ? Icons.lightbulb({ size: 18, color: '#f59e0b' }) : ''}
                    Beveiligingstips
                </h3>
                <ul class="tips-list">
                    <li>Bewaar een backup van je authenticator (export in de app)</li>
                    <li>Voeg eventueel een tweede authenticator toe als backup</li>
                    <li>Deel je codes nooit met anderen</li>
                    <li>Gebruik een wachtwoordmanager voor je wachtwoorden</li>
                </ul>
            </div>
        `;
    }

    /**
     * Render enrollment container
     */
    renderEnrollmentContainer() {
        return `
            <div class="mfa-settings">
                <div class="enrollment-wrapper" id="enrollment-container"></div>
            </div>
        `;
    }

    /**
     * Render error
     */
    renderError(message) {
        return `
            <div class="mfa-settings">
                <div class="mfa-error">
                    <div class="error-icon">
                        ${Icons.xCircle ? Icons.xCircle({ size: 40, color: '#ef4444' }) : ''}
                    </div>
                    <h2>Er ging iets fout</h2>
                    <p>${message}</p>
                    <button class="btn btn-primary" id="btn-retry">
                        Opnieuw proberen
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Start enrollment flow
     */
    startEnrollment() {
        const enrollmentContainer = this.container.querySelector('#enrollment-container');
        
        this.enrollmentComponent = new MFAEnrollment();
        
        this.enrollmentComponent.onSuccess = () => {
            this.showingEnrollment = false;
            this.loadData();
        };
        
        this.enrollmentComponent.onCancel = () => {
            this.showingEnrollment = false;
            this.render('settings');
            this.attachEventListeners();
        };
        
        this.enrollmentComponent.mount(enrollmentContainer);
    }

    /**
     * Remove factor
     */
    async removeFactor(factorId) {
        const factor = this.factors.find(f => f.id === factorId);
        const name = factor?.friendly_name || 'deze authenticator';
        
        const confirmed = confirm(
            `Weet je zeker dat je ${name} wilt verwijderen?\n\n` +
            `Je zult deze authenticator niet meer kunnen gebruiken om in te loggen.`
        );
        
        if (!confirmed) return;

        try {
            const { error } = await supabase.auth.mfa.unenroll({
                factorId: factorId
            });

            if (error) throw error;

            console.log('✅ Factor removed');
            
            // Log audit
            await supabase.rpc('log_audit', {
                p_action: 'mfa_unenrolled',
                p_resource_type: 'mfa',
                p_details: { factor_id: factorId },
                p_success: true
            });

            // Reload data
            await this.loadData();

        } catch (error) {
            console.error('❌ Remove factor error:', error);
            alert('Kon authenticator niet verwijderen: ' + error.message);
        }
    }

    /**
     * Format date
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('nl-NL', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Setup MFA button
        const setupBtn = this.container.querySelector('#btn-setup-mfa');
        setupBtn?.addEventListener('click', () => {
            this.showingEnrollment = true;
            this.render('enrollment');
        });

        // Add factor button
        const addBtn = this.container.querySelector('#btn-add-factor');
        addBtn?.addEventListener('click', () => {
            this.showingEnrollment = true;
            this.render('enrollment');
        });

        // Remove factor buttons
        this.container.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const factorId = btn.getAttribute('data-factor-id');
                this.removeFactor(factorId);
            });
        });

        // Retry button
        const retryBtn = this.container.querySelector('#btn-retry');
        retryBtn?.addEventListener('click', () => {
            this.loadData();
        });
    }

    /**
     * Unmount
     */
    unmount() {
        this.container = null;
        this.enrollmentComponent = null;
    }
}

export default MFASettings;