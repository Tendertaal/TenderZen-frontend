/**
 * LogoutConfirmModal.js
 * Mooie uitlog bevestigingsmodal in TenderPlanner design
 */

// Gebruik globale Icons (geladen via icons.js)
const Icons = window.Icons || {};
const IconColors = window.IconColors || {};

export class LogoutConfirmModal {
    constructor() {
        this.overlay = null;
        this.onConfirm = null;
        this.onCancel = null;
    }

    /**
     * Toon de logout bevestigingsmodal
     * @returns {Promise<boolean>} - true als bevestigd, false als geannuleerd
     */
    show() {
        return new Promise((resolve) => {
            this.onConfirm = () => {
                this.hide();
                resolve(true);
            };
            this.onCancel = () => {
                this.hide();
                resolve(false);
            };

            this.render();
            this.attachEventListeners();

            // Focus op cancel knop (veiliger)
            setTimeout(() => {
                const cancelBtn = this.overlay?.querySelector('#logout-cancel-btn');
                cancelBtn?.focus();
            }, 100);
        });
    }

    /**
     * Verberg de modal
     */
    hide() {
        if (this.overlay) {
            this.overlay.classList.add('fade-out');
            setTimeout(() => {
                this.overlay?.remove();
                this.overlay = null;
            }, 200);
        }
    }

    /**
     * Render de modal
     */
    render() {
        // Verwijder bestaande modal
        document.getElementById('logout-confirm-modal')?.remove();

        // Maak overlay
        this.overlay = document.createElement('div');
        this.overlay.id = 'logout-confirm-modal';
        this.overlay.className = 'logout-modal-overlay';
        
        this.overlay.innerHTML = `
            <div class="logout-modal-container">
                <div class="logout-modal-card">
                    <!-- Header met icon -->
                    <div class="logout-modal-header">
                        <div class="logout-modal-icon">
                            ${Icons.logOut ? Icons.logOut({ size: 28, color: '#ffffff' }) : '→'}
                        </div>
                    </div>

                    <!-- Content -->
                    <div class="logout-modal-content">
                        <h2 class="logout-modal-title">Uitloggen?</h2>
                        <p class="logout-modal-message">
                            Weet je zeker dat je wilt uitloggen? Je moet opnieuw inloggen om verder te gaan.
                        </p>
                    </div>

                    <!-- Actions -->
                    <div class="logout-modal-actions">
                        <button type="button" class="logout-btn logout-btn-cancel" id="logout-cancel-btn">
                            ${Icons.x ? Icons.x({ size: 18, color: '#64748b' }) : ''}
                            <span>Annuleren</span>
                        </button>
                        <button type="button" class="logout-btn logout-btn-confirm" id="logout-confirm-btn">
                            ${Icons.logOut ? Icons.logOut({ size: 18, color: '#ffffff' }) : ''}
                            <span>Uitloggen</span>
                        </button>
                    </div>
                </div>
            </div>

            <style>
                .logout-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    animation: fadeIn 0.2s ease-out;
                }

                .logout-modal-overlay.fade-out {
                    animation: fadeOut 0.2s ease-out forwards;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }

                .logout-modal-container {
                    animation: slideIn 0.25s ease-out;
                }

                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }

                .logout-modal-card {
                    background: #ffffff;
                    border-radius: 16px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                    width: 100%;
                    max-width: 400px;
                    margin: 20px;
                    overflow: hidden;
                }

                .logout-modal-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    padding: 24px;
                    display: flex;
                    justify-content: center;
                }

                .logout-modal-icon {
                    width: 56px;
                    height: 56px;
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .logout-modal-content {
                    padding: 24px 24px 16px;
                    text-align: center;
                }

                .logout-modal-title {
                    font-size: 20px;
                    font-weight: 600;
                    color: #1e293b;
                    margin: 0 0 8px 0;
                }

                .logout-modal-message {
                    font-size: 14px;
                    color: #64748b;
                    margin: 0;
                    line-height: 1.5;
                }

                .logout-modal-actions {
                    display: flex;
                    gap: 12px;
                    padding: 16px 24px 24px;
                }

                .logout-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    border: none;
                    font-family: inherit;
                }

                .logout-btn-cancel {
                    background: #f1f5f9;
                    color: #64748b;
                }

                .logout-btn-cancel:hover {
                    background: #e2e8f0;
                    color: #475569;
                }

                .logout-btn-cancel:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.2);
                }

                .logout-btn-confirm {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: #ffffff;
                }

                .logout-btn-confirm:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
                }

                .logout-btn-confirm:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
                }

                .logout-btn svg {
                    flex-shrink: 0;
                }
            </style>
        `;

        document.body.appendChild(this.overlay);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Confirm button
        const confirmBtn = this.overlay?.querySelector('#logout-confirm-btn');
        confirmBtn?.addEventListener('click', () => this.onConfirm?.());

        // Cancel button
        const cancelBtn = this.overlay?.querySelector('#logout-cancel-btn');
        cancelBtn?.addEventListener('click', () => this.onCancel?.());

        // Click outside to cancel
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.onCancel?.();
            }
        });

        // Escape key to cancel
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this.onCancel?.();
                document.removeEventListener('keydown', handleKeydown);
            }
            if (e.key === 'Enter') {
                this.onConfirm?.();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }
}

// Singleton instance voor makkelijk gebruik
let modalInstance = null;

/**
 * Helper functie om logout te bevestigen
 * Gebruik: const confirmed = await confirmLogout();
 * @returns {Promise<boolean>}
 */
export async function confirmLogout() {
    if (!modalInstance) {
        modalInstance = new LogoutConfirmModal();
    }
    return modalInstance.show();
}

// Global export voor non-module scripts
window.LogoutConfirmModal = LogoutConfirmModal;
window.confirmLogout = confirmLogout;

export default LogoutConfirmModal;