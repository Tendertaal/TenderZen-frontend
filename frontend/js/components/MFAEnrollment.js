/**
 * MFAEnrollment Component
 * TenderZen Design System v2.0 - SVG Icons
 * Toont QR code voor authenticator app setup
 */

// Gebruik de globale Supabase client (window.supabase)
const supabase = window.supabase;

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

export class MFAEnrollment {
    constructor() {
        this.container = null;
        this.factorId = null;
        this.qrCode = null;
        this.secret = null;

        // Callbacks
        this.onSuccess = null;
        this.onCancel = null;
    }

    /**
     * Mount component
     */
    mount(container) {
        this.container = container;
        this.startEnrollment();
    }

    /**
     * Start MFA enrollment process
     */
    async startEnrollment() {
        this.render('loading');

        try {
            // Start enrollment met Supabase
            const { data, error } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: 'TenderPlanner Authenticator'
            });

            if (error) throw error;

            this.factorId = data.id;
            this.qrCode = data.totp.qr_code;
            this.secret = data.totp.secret;

            console.log('✅ MFA enrollment started, factor ID:', this.factorId);

            this.render('qr');

        } catch (error) {
            console.error('❌ MFA enrollment error:', error);
            this.render('error', error.message);
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
            // Create challenge and verify
            const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
                factorId: this.factorId
            });

            if (challengeError) throw challengeError;

            const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
                factorId: this.factorId,
                challengeId: challengeData.id,
                code: code
            });

            if (verifyError) throw verifyError;

            console.log('✅ MFA enrollment verified successfully!');

            // Log audit
            await this.logAudit('mfa_enrolled', true);

            // Show success
            this.render('success');

            // Callback
            setTimeout(() => {
                if (this.onSuccess) {
                    this.onSuccess();
                }
            }, 2000);

        } catch (error) {
            console.error('❌ MFA verify error:', error);
            this.showError('Ongeldige code. Probeer opnieuw.');
            this.setLoading(false);
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
                p_details: { factor_id: this.factorId },
                p_success: success
            });
        } catch (e) {
            console.warn('Audit log failed:', e);
        }
    }

    /**
     * Cancel enrollment
     */
    async cancelEnrollment() {
        if (this.factorId) {
            try {
                await supabase.auth.mfa.unenroll({ factorId: this.factorId });
            } catch (e) {
                console.warn('Unenroll failed:', e);
            }
        }

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
            case 'qr':
                this.container.innerHTML = this.renderQRCode();
                this.attachEventListeners();
                break;
            case 'success':
                this.container.innerHTML = this.renderSuccess();
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
            <div class="mfa-enrollment">
                <div class="mfa-loading">
                    <div class="spinner"></div>
                    <p>MFA wordt voorbereid...</p>
                </div>
            </div>
        `;
    }

    /**
     * Render QR code
     */
    renderQRCode() {
        return `
            <div class="mfa-enrollment">
                <div class="mfa-header">
                    <div class="mfa-icon">
                        ${Icons.shieldCheck ? Icons.shieldCheck({ size: 40, color: '#8b5cf6' }) : ''}
                    </div>
                    <h2>Twee-Factor Authenticatie Instellen</h2>
                    <p class="mfa-subtitle">Beveilig je account met een extra laag beveiliging</p>
                </div>

                <div class="mfa-steps">
                    <div class="mfa-step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <h3>Download een Authenticator App</h3>
                            <p>Gebruik Google Authenticator, Authy, of een andere TOTP app</p>
                            <div class="app-badges">
                                <span class="app-badge">
                                    ${Icons.smartphone ? Icons.smartphone({ size: 14, color: '#6366f1' }) : ''}
                                    Google Authenticator
                                </span>
                                <span class="app-badge">
                                    ${Icons.smartphone ? Icons.smartphone({ size: 14, color: '#6366f1' }) : ''}
                                    Authy
                                </span>
                                <span class="app-badge">
                                    ${Icons.smartphone ? Icons.smartphone({ size: 14, color: '#6366f1' }) : ''}
                                    Microsoft Authenticator
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="mfa-step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <h3>Scan de QR Code</h3>
                            <p>Open je authenticator app en scan deze code</p>
                            <div class="qr-container">
                                <img src="${this.qrCode}" alt="QR Code" class="qr-code" />
                            </div>
                            <div class="secret-container">
                                <p class="secret-label">Of voer deze code handmatig in:</p>
                                <code class="secret-code">${this.formatSecret(this.secret)}</code>
                                <button class="btn-copy" id="btn-copy-secret" title="Kopieer code">
                                    ${Icons.clipboard ? Icons.clipboard({ size: 16, color: 'currentColor' }) : ''}
                                    Kopieer
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mfa-step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <h3>Voer de Code In</h3>
                            <p>Voer de 6-cijferige code in die je app toont</p>
                            <div class="code-input-container">
                                <input 
                                    type="text" 
                                    id="mfa-code-input" 
                                    class="mfa-code-input"
                                    placeholder="000000"
                                    maxlength="6"
                                    pattern="[0-9]*"
                                    inputmode="numeric"
                                    autocomplete="one-time-code"
                                />
                                <div class="code-error" id="code-error"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mfa-actions">
                    <button class="btn btn-secondary" id="btn-cancel-mfa">
                        Annuleren
                    </button>
                    <button class="btn btn-primary" id="btn-verify-mfa">
                        ${Icons.checkCircle ? Icons.checkCircle({ size: 18, color: '#ffffff' }) : ''}
                        Verifiëren & Activeren
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render success state
     */
    renderSuccess() {
        return `
            <div class="mfa-enrollment">
                <div class="mfa-success">
                    <div class="success-icon">
                        ${Icons.checkCircle ? Icons.checkCircle({ size: 40, color: '#10b981' }) : ''}
                    </div>
                    <h2>MFA Succesvol Geactiveerd!</h2>
                    <p>Je account is nu beveiligd met twee-factor authenticatie.</p>
                    <p class="success-note">
                        Vanaf nu moet je bij elke login een code invoeren uit je authenticator app.
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Render error state
     */
    renderError(message) {
        return `
            <div class="mfa-enrollment">
                <div class="mfa-error">
                    <div class="error-icon">
                        ${Icons.xCircle ? Icons.xCircle({ size: 40, color: '#ef4444' }) : ''}
                    </div>
                    <h2>Er ging iets fout</h2>
                    <p>${message}</p>
                    <button class="btn btn-primary" id="btn-retry-mfa">
                        Opnieuw proberen
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Format secret for display
     */
    formatSecret(secret) {
        if (!secret) return '';
        // Add spaces every 4 characters for readability
        return secret.match(/.{1,4}/g).join(' ');
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Verify button
        const verifyBtn = this.container.querySelector('#btn-verify-mfa');
        verifyBtn?.addEventListener('click', () => {
            const code = this.container.querySelector('#mfa-code-input').value;
            this.verifyCode(code);
        });

        // Cancel button
        const cancelBtn = this.container.querySelector('#btn-cancel-mfa');
        cancelBtn?.addEventListener('click', () => {
            this.cancelEnrollment();
        });

        // Copy secret button
        const copyBtn = this.container.querySelector('#btn-copy-secret');
        copyBtn?.addEventListener('click', () => {
            navigator.clipboard.writeText(this.secret);
            copyBtn.innerHTML = `
                ${Icons.check ? Icons.check({ size: 16, color: '#10b981' }) : ''}
                Gekopieerd!
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    ${Icons.clipboard ? Icons.clipboard({ size: 16, color: 'currentColor' }) : ''}
                    Kopieer
                `;
            }, 2000);
        });

        // Code input - auto submit on 6 digits
        const codeInput = this.container.querySelector('#mfa-code-input');
        codeInput?.addEventListener('input', (e) => {
            // Only allow numbers
            e.target.value = e.target.value.replace(/[^0-9]/g, '');

            // Clear error
            this.clearError();

            // Auto-submit when 6 digits entered
            if (e.target.value.length === 6) {
                this.verifyCode(e.target.value);
            }
        });

        // Enter key
        codeInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.verifyCode(codeInput.value);
            }
        });

        // Focus input
        setTimeout(() => codeInput?.focus(), 100);

        // Retry button (for error state)
        const retryBtn = this.container.querySelector('#btn-retry-mfa');
        retryBtn?.addEventListener('click', () => {
            this.startEnrollment();
        });
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorEl = this.container.querySelector('#code-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('show');
        }
    }

    /**
     * Clear error message
     */
    clearError() {
        const errorEl = this.container.querySelector('#code-error');
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.remove('show');
        }
    }

    /**
     * Set loading state
     */
    setLoading(loading) {
        const verifyBtn = this.container.querySelector('#btn-verify-mfa');
        const codeInput = this.container.querySelector('#mfa-code-input');

        if (verifyBtn) {
            verifyBtn.disabled = loading;
            verifyBtn.innerHTML = loading
                ? 'Verifiëren...'
                : `${Icons.checkCircle ? Icons.checkCircle({ size: 18, color: '#ffffff' }) : ''} Verifiëren & Activeren`;
        }

        if (codeInput) {
            codeInput.disabled = loading;
        }
    }
}

export default MFAEnrollment;