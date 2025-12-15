/**
 * Login met MFA Support
 * Handles login flow met twee-factor authenticatie
 */

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

// Create client using UMD global (window.supabase is de UMD bundle)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});
window.supabase = supabaseClient;
console.log('✅ Supabase initialized (UMD)');
import { MFAVerify } from '/js/components/MFAVerify.js';
import { MFAEnrollment } from '/js/components/MFAEnrollment.js';

class LoginApp {
    constructor() {
        this.container = document.getElementById('app') || document.body;
        this.mfaVerify = null;
        this.mfaEnrollment = null;
        this.currentUser = null;
    }

    /**
     * Initialize login app
     */
    async init() {
        console.log('🔐 Login app initializing...');

        // Check if already logged in
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
            // Check MFA status
            const needsMFA = await this.checkMFARequired(session);

            if (needsMFA) {
                this.showMFAVerify();
            } else {
                // Already fully authenticated
                this.redirectToDashboard();
            }
        } else {
            // Show login form
            this.showLoginForm();
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth event:', event);

            if (event === 'SIGNED_IN' && session) {
                await this.handleSignIn(session);
            }
        });
    }

    /**
     * Handle sign in event
     */
    async handleSignIn(session) {
        this.currentUser = session.user;

        // Check AAL level
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        console.log('AAL Data:', aalData);

        // If user has MFA factors but hasn't verified yet
        if (aalData.nextLevel === 'aal2' && aalData.currentLevel === 'aal1') {
            this.showMFAVerify();
            return;
        }

        // Check if MFA is required but not enrolled
        const mfaRequired = await this.checkMFARequiredForUser();
        const hasMFA = await this.checkUserHasMFA();

        if (mfaRequired && !hasMFA) {
            this.showMFAEnrollmentRequired();
            return;
        }

        // Fully authenticated
        this.redirectToDashboard();
    }

    /**
     * Check if MFA verification is needed
     */
    async checkMFARequired(session) {
        try {
            const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

            if (error) {
                console.error('AAL check error:', error);
                return false;
            }

            // Need MFA if next level is aal2 but current is aal1
            return data.nextLevel === 'aal2' && data.currentLevel === 'aal1';

        } catch (error) {
            console.error('MFA check error:', error);
            return false;
        }
    }

    /**
     * Check if user is required to have MFA (from users table)
     */
    async checkMFARequiredForUser() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;

            const { data, error } = await supabase
                .from('users')
                .select('mfa_required, is_super_admin')
                .eq('id', user.id)
                .single();

            if (error) {
                console.warn('Could not check mfa_required:', error);
                return false;
            }

            // Super-admins always require MFA
            return data?.mfa_required || data?.is_super_admin;

        } catch (error) {
            console.error('MFA required check error:', error);
            return false;
        }
    }

    /**
     * Check if user has MFA enrolled
     */
    async checkUserHasMFA() {
        try {
            const { data, error } = await supabase.auth.mfa.listFactors();

            if (error) return false;

            const verifiedFactors = [...(data.totp || []), ...(data.phone || [])]
                .filter(f => f.status === 'verified');

            return verifiedFactors.length > 0;

        } catch (error) {
            return false;
        }
    }

    /**
     * Show login form
     */
    showLoginForm() {
        this.container.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <div class="login-logo">📋</div>
                        <h1>TenderPlanner</h1>
                        <p>Log in op je account</p>
                    </div>

                    <form id="login-form" class="login-form">
                        <div class="form-group">
                            <label for="email">E-mailadres</label>
                            <input 
                                type="email" 
                                id="email" 
                                name="email" 
                                required 
                                autocomplete="email"
                                placeholder="naam@bedrijf.nl"
                            />
                        </div>

                        <div class="form-group">
                            <label for="password">Wachtwoord</label>
                            <input 
                                type="password" 
                                id="password" 
                                name="password" 
                                required 
                                autocomplete="current-password"
                                placeholder="••••••••"
                            />
                        </div>

                        <div class="form-error" id="login-error"></div>

                        <button type="submit" class="btn btn-primary btn-block" id="login-btn">
                            Inloggen
                        </button>
                    </form>

                    <div class="login-footer">
                        <a href="#" id="forgot-password">Wachtwoord vergeten?</a>
                    </div>
                </div>
            </div>
        `;

        this.attachLoginListeners();
    }

    /**
     * Attach login form listeners
     */
    attachLoginListeners() {
        const form = document.getElementById('login-form');
        const forgotLink = document.getElementById('forgot-password');

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleLogin();
        });

        forgotLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPassword();
        });
    }

    /**
     * Handle login submit
     */
    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');
        const btn = document.getElementById('login-btn');

        // Clear error
        errorEl.textContent = '';
        errorEl.classList.remove('show');

        // Set loading
        btn.disabled = true;
        btn.textContent = 'Inloggen...';

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            console.log('✅ Login successful');

            // Log audit
            await this.logAudit('login_success', true);

            // Auth state change will handle MFA check

        } catch (error) {
            console.error('❌ Login error:', error);

            // Log failed attempt
            await this.logAudit('login_failed', false, { email });

            errorEl.textContent = this.getErrorMessage(error);
            errorEl.classList.add('show');

            btn.disabled = false;
            btn.textContent = 'Inloggen';
        }
    }

    /**
     * Show MFA verify screen
     */
    showMFAVerify() {
        this.container.innerHTML = '<div id="mfa-container"></div>';

        this.mfaVerify = new MFAVerify();

        this.mfaVerify.onSuccess = () => {
            console.log('✅ MFA verified, redirecting...');
            this.redirectToDashboard();
        };

        this.mfaVerify.onCancel = () => {
            // Logged out, show login form
            this.showLoginForm();
        };

        this.mfaVerify.mount(document.getElementById('mfa-container'));
    }

    /**
     * Show MFA enrollment (required)
     */
    showMFAEnrollmentRequired() {
        this.container.innerHTML = `
            <div class="mfa-required-container">
                <div class="mfa-required-card">
                    <div class="mfa-required-header">
                        <div class="mfa-required-icon">🔐</div>
                        <h2>Twee-Factor Authenticatie Vereist</h2>
                        <p>Voor de beveiliging van je account moet je twee-factor authenticatie instellen voordat je verder kunt.</p>
                    </div>
                    <div id="mfa-enrollment-container"></div>
                </div>
            </div>
        `;

        this.mfaEnrollment = new MFAEnrollment();

        this.mfaEnrollment.onSuccess = () => {
            console.log('✅ MFA enrolled, redirecting...');
            // After enrollment, session is refreshed with aal2
            this.redirectToDashboard();
        };

        this.mfaEnrollment.onCancel = async () => {
            // Cannot cancel if MFA is required - sign out
            await supabase.auth.signOut();
            this.showLoginForm();
        };

        this.mfaEnrollment.mount(document.getElementById('mfa-enrollment-container'));
    }

    /**
     * Show forgot password form
     */
    showForgotPassword() {
        this.container.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <div class="login-logo">🔑</div>
                        <h1>Wachtwoord Resetten</h1>
                        <p>Voer je e-mailadres in om een reset link te ontvangen</p>
                    </div>

                    <form id="forgot-form" class="login-form">
                        <div class="form-group">
                            <label for="reset-email">E-mailadres</label>
                            <input 
                                type="email" 
                                id="reset-email" 
                                name="email" 
                                required 
                                autocomplete="email"
                                placeholder="naam@bedrijf.nl"
                            />
                        </div>

                        <div class="form-success" id="reset-success"></div>
                        <div class="form-error" id="reset-error"></div>

                        <button type="submit" class="btn btn-primary btn-block" id="reset-btn">
                            Verstuur Reset Link
                        </button>
                    </form>

                    <div class="login-footer">
                        <a href="#" id="back-to-login">← Terug naar inloggen</a>
                    </div>
                </div>
            </div>
        `;

        const form = document.getElementById('forgot-form');
        const backLink = document.getElementById('back-to-login');

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleForgotPassword();
        });

        backLink?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });
    }

    /**
     * Handle forgot password
     */
    async handleForgotPassword() {
        const email = document.getElementById('reset-email').value;
        const successEl = document.getElementById('reset-success');
        const errorEl = document.getElementById('reset-error');
        const btn = document.getElementById('reset-btn');

        // Clear messages
        successEl.textContent = '';
        successEl.classList.remove('show');
        errorEl.textContent = '';
        errorEl.classList.remove('show');

        btn.disabled = true;
        btn.textContent = 'Versturen...';

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password.html`
            });

            if (error) {
                // Toon Supabase foutmelding expliciet
                console.error('Supabase reset error:', error);
                errorEl.textContent = `Fout: ${error.message || error.description || error}`;
                errorEl.classList.add('show');
                btn.disabled = false;
                btn.textContent = 'Verstuur Reset Link';
                return;
            }

            successEl.textContent = 'Check je inbox voor de reset link!';
            successEl.classList.add('show');
            btn.textContent = 'Verstuurd!';
        } catch (error) {
            // Toon JS error expliciet
            console.error('Reset error (JS):', error);
            errorEl.textContent = `Onbekende fout: ${error.message || error}`;
            errorEl.classList.add('show');
            btn.disabled = false;
            btn.textContent = 'Verstuur Reset Link';
        }
    }

    /**
     * Log audit event
     */
    async logAudit(action, success, details = {}) {
        try {
            // For login attempts before auth, we can't use RPC
            // This is handled server-side or we skip it
            if (action === 'login_success') {
                await supabase.rpc('log_audit', {
                    p_action: action,
                    p_resource_type: 'auth',
                    p_details: details,
                    p_success: success
                });
            }
        } catch (e) {
            // Ignore audit errors on login page
            console.warn('Audit log skipped:', e.message);
        }
    }

    /**
     * Get user-friendly error message
     */
    getErrorMessage(error) {
        const message = error.message?.toLowerCase() || '';

        if (message.includes('invalid login credentials')) {
            return 'Onjuist e-mailadres of wachtwoord';
        }
        if (message.includes('email not confirmed')) {
            return 'Bevestig eerst je e-mailadres';
        }
        if (message.includes('too many requests')) {
            return 'Te veel pogingen. Probeer later opnieuw.';
        }

        return 'Er ging iets fout. Probeer opnieuw.';
    }

    /**
     * Redirect to dashboard
     */
    redirectToDashboard() {
        window.location.href = '/index.html';
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const loginApp = new LoginApp();
    loginApp.init();
});

export default LoginApp;