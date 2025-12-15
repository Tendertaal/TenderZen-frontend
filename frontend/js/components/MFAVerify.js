/**
 * MFAVerify Component
 * TenderZen Design System v2.0 - SVG Icons
 * Scherm voor het invoeren van MFA code bij login
 */

// Gebruik de globale Supabase client (window.supabase)
const supabase = window.supabase;

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

export class MFAVerify {
    constructor() {
        this.container = null;
        this.factors = [];
        this.selectedFactorId = null;
        this.challengeId = null;

        // Callbacks
        this.onSuccess = null;
        this.onCancel = null;
    }

    /**
     * Mount component
     */
    async mount(container) {
        this.container = container;
        await this.loadFactors();
    }

    /**
     * Load user's MFA factors
     */
    async loadFactors() {
        this.render('loading');

        try {
            const { data, error } = await supabase.auth.mfa.listFactors();

            if (error) throw error;

            // Get verified TOTP factors
            this.factors = [...(data.totp || []), ...(data.phone || [])]
                .filter(f => f.status === 'verified');

            if (this.factors.length === 0) {
                throw new Error('Geen MFA factors gevonden');
            }

            // Use first factor by default
            this.selectedFactorId = this.factors[0].id;

            // Create challenge
            await this.createChallenge();

            this.render('verify');

        } catch (error) {
            console.error('❌ Load factors error:', error);
            this.render('error', error.message);
        }
    }

    /**
     * Create MFA challenge
     */
    async createChallenge() {
        try {
            const { data, error } = await supabase.auth.mfa.challenge({
                factorId: this.selectedFactorId
            });

            if (error) throw error;

            this.challengeId = data.id;
            console.log('✅ MFA challenge created');

        } catch (error) {
            console.error('❌ Challenge error:', error);
            throw error;
        }
    }

    /**
     * Verify the TOTP code
     */
    async verifyCode(code) {
        if (!code || code.length !== 6) {
            this.showError('Voer een 6-cijferige code in');
            return;
        }

        this.setLoading(true);

        try {
            const { data, error } = await supabase.auth.mfa.verify({
                factorId: this.selectedFactorId,
                challengeId: this.challengeId,
                code: code
            });

            if (error) throw error;

            console.log('✅ MFA verification successful!');

            // Log audit
            await this.logAudit('mfa_verified', true);

            // Callback
            if (this.onSuccess) {
                this.onSuccess(data);
            }

        } catch (error) {
            console.error('❌ MFA verify error:', error);

            // Log failed attempt
            await this.logAudit('mfa_verify_failed', false);

            this.showError('Ongeldige code. Probeer opnieuw.');
            this.setLoading(false);

            // Create new challenge for retry
            await this.createChallenge();

            // Clear input
            const input = this.container.querySelector('#mfa-verify-input');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    /**
     * Log audit event
     */
    async logAudit(action, success) {
        try {
            await supabase.rpc('log_audit', {
                p_action: action,
                p_resource_type: 'mfa',
                p_details: { factor_id: this.selectedFactorId },
                p_success: success
            });
        } catch (e) {
            console.warn('Audit log failed:', e);
        }
    }

    /**
     * Cancel verification (logout)
     */
    async cancel() {
        await supabase.auth.signOut();

        if (this.onCancel) {
            this.onCancel();
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
            case 'verify':
                this.container.innerHTML = this.renderVerify();
                this.attachEventListeners();
                break;
            case 'error':
                this.container.innerHTML = this.renderError(errorMessage);
                break;
        }
    }

    /**
     * Render loading state
     */
    renderLoading() {
        return `
            <div class="mfa-verify-container">
                <div class="mfa-loading">
                    <div class="spinner"></div>
                    <p>Even geduld...</p>
                </div>
            </div>
        `;
    }

    /**
     * Render verify form
     */
    renderVerify() {
        const factor = this.factors.find(f => f.id === this.selectedFactorId);
        const factorName = factor?.friendly_name || 'Authenticator';

        return `
            <div class="mfa-verify-container">
                <div class="mfa-verify-card">
                    <div class="mfa-verify-header">
                        <div class="mfa-verify-icon">
                            ${Icons.shieldCheck ? Icons.shieldCheck({ size: 32, color: '#8b5cf6' }) : ''}
                        </div>
                        <h2>Twee-Factor Verificatie</h2>
                        <p>Voer de code in van je authenticator app</p>
                    </div>

                    <div class="mfa-verify-body">
                        ${this.factors.length > 1 ? this.renderFactorSelector() : ''}
                        
                        <div class="mfa-verify-input-group">
                            <label for="mfa-verify-input">
                                Voer je 6-cijferige code in
                            </label>
                            <input 
                                type="text" 
                                id="mfa-verify-input" 
                                class="mfa-verify-input"
                                placeholder="000000"
                                maxlength="6"
                                pattern="[0-9]*"
                                inputmode="numeric"
                                autocomplete="one-time-code"
                                autofocus
                            />
                            <div class="mfa-verify-error" id="mfa-verify-error"></div>
                        </div>

                        <div class="mfa-verify-hint">
                            <span class="hint-icon">
                                ${Icons.lightbulb ? Icons.lightbulb({ size: 16, color: '#f59e0b' }) : ''}
                            </span>
                            <span>Open ${factorName} en voer de huidige code in</span>
                        </div>
                    </div>

                    <div class="mfa-verify-footer">
                        <button class="btn btn-secondary btn-sm" id="btn-mfa-cancel">
                            Uitloggen
                        </button>
                        <button class="btn btn-primary" id="btn-mfa-verify">
                            Verifiëren
                        </button>
                    </div>
                </div>

                <div class="mfa-verify-help">
                    <p>Problemen met inloggen?</p>
                    <a href="#" id="link-mfa-help">Hulp nodig?</a>
                </div>
            </div>
        `;
    }

    /**
     * Render factor selector (if multiple factors)
     */
    renderFactorSelector() {
        return `
            <div class="factor-selector">
                <label>Kies je authenticator:</label>
                <select id="factor-select" class="factor-select">
                    ${this.factors.map(f => `
                        <option value="${f.id}" ${f.id === this.selectedFactorId ? 'selected' : ''}>
                            ${f.friendly_name || 'Authenticator'} 
                            (${f.factor_type === 'totp' ? 'App' : 'Telefoon'})
                        </option>
                    `).join('')}
                </select>
            </div>
        `;
    }

    /**
     * Render error state
     */
    renderError(message) {
        return `
            <div class="mfa-verify-container">
                <div class="mfa-verify-card">
                    <div class="mfa-error">
                        <div class="error-icon">
                            ${Icons.xCircle ? Icons.xCircle({ size: 40, color: '#ef4444' }) : ''}
                        </div>
                        <h2>Verificatie Mislukt</h2>
                        <p>${message}</p>
                        <button class="btn btn-primary" id="btn-mfa-retry">
                            Opnieuw proberen
                        </button>
                        <button class="btn btn-secondary" id="btn-mfa-logout">
                            Uitloggen
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Verify button
        const verifyBtn = this.container.querySelector('#btn-mfa-verify');
        verifyBtn?.addEventListener('click', () => {
            const code = this.container.querySelector('#mfa-verify-input').value;
            this.verifyCode(code);
        });

        // Cancel button
        const cancelBtn = this.container.querySelector('#btn-mfa-cancel');
        cancelBtn?.addEventListener('click', () => {
            this.cancel();
        });

        // Code input
        const codeInput = this.container.querySelector('#mfa-verify-input');

        codeInput?.addEventListener('input', (e) => {
            // Only allow numbers
            e.target.value = e.target.value.replace(/[^0-9]/g, '');

            // Clear error
            this.clearError();

            // Auto-submit when 6 digits
            if (e.target.value.length === 6) {
                this.verifyCode(e.target.value);
            }
        });

        codeInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyCode(codeInput.value);
            }
        });

        // Factor selector
        const factorSelect = this.container.querySelector('#factor-select');
        factorSelect?.addEventListener('change', async (e) => {
            this.selectedFactorId = e.target.value;
            await this.createChallenge();
        });

        // Help link
        const helpLink = this.container.querySelector('#link-mfa-help');
        helpLink?.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Als je geen toegang meer hebt tot je authenticator app, neem contact op met de beheerder.');
        });

        // Retry button
        const retryBtn = this.container.querySelector('#btn-mfa-retry');
        retryBtn?.addEventListener('click', () => {
            this.loadFactors();
        });

        // Logout button
        const logoutBtn = this.container.querySelector('#btn-mfa-logout');
        logoutBtn?.addEventListener('click', () => {
            this.cancel();
        });

        // Focus input
        setTimeout(() => codeInput?.focus(), 100);
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = this.container.querySelector('#mfa-verify-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
    }

    /**
     * Clear error message
     */
    clearError() {
        const errorEl = this.container.querySelector('#mfa-verify-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('show');
        }
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        const verifyBtn = this.container.querySelector('#btn-mfa-verify');
        const codeInput = this.container.querySelector('#mfa-verify-input');

        if (verifyBtn) {
            verifyBtn.disabled = loading;
            verifyBtn.textContent = loading ? 'Verifiëren...' : 'Verifiëren';
        }

        if (codeInput) {
            codeInput.disabled = loading;
        }
    }
}

export default MFAVerify;