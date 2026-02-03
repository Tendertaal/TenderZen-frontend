// frontend/js/components/SmartImportBadge.js
// Smart Import Badge - Toont AI-import status op tender kaarten
// TenderZen v1.0
// Datum: 2025-02-02
//
// Functie:
// - Badge/icoon op tender kaart als tender via Smart Import is aangemaakt
// - Klikbaar om details te bekijken
// - Toont model type (Haiku/Sonnet) en confidence

export class SmartImportBadge {
    constructor(options = {}) {
        this.tenderId = options.tenderId;
        this.smartImportId = options.smartImportId;
        this.modelUsed = options.modelUsed || 'haiku';
        this.confidence = options.confidence || null;
        this.onClick = options.onClick || (() => {});
        
        this.element = null;
    }
    
    /**
     * Render de badge
     */
    render() {
        if (!this.smartImportId) {
            return ''; // Geen badge als geen smart import
        }
        
        const isPro = this.modelUsed === 'sonnet' || 
                      (this.modelUsed && this.modelUsed.includes('sonnet'));
        
        const badgeClass = isPro ? 'smart-import-badge pro' : 'smart-import-badge';
        const icon = isPro ? '⚡' : '✨';
        const tooltip = isPro 
            ? 'AI Pro Import - Klik voor details' 
            : 'AI Import - Klik voor details';
        
        return `
            <button class="${badgeClass}" 
                    data-tender-id="${this.tenderId}"
                    data-smart-import-id="${this.smartImportId}"
                    title="${tooltip}">
                <span class="badge-icon">${icon}</span>
                <span class="badge-label">AI${isPro ? ' Pro' : ''}</span>
            </button>
        `;
    }
    
    /**
     * Attach event listener na DOM insert
     */
    attachEvents(container) {
        const badge = container.querySelector(`[data-smart-import-id="${this.smartImportId}"]`);
        if (badge) {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onClick(this.smartImportId, this.tenderId);
            });
        }
    }
    
    /**
     * Get CSS styles voor de badge
     */
    static getStyles() {
        return `
            /* Smart Import Badge */
            .smart-import-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
                border: 1px solid #7dd3fc;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 600;
                color: #0369a1;
                cursor: pointer;
                transition: all 0.2s ease;
                margin-left: 8px;
            }
            
            .smart-import-badge:hover {
                background: linear-gradient(135deg, #bae6fd 0%, #7dd3fc 100%);
                transform: scale(1.05);
                box-shadow: 0 2px 8px rgba(3, 105, 161, 0.3);
            }
            
            .smart-import-badge.pro {
                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                border-color: #fbbf24;
                color: #92400e;
            }
            
            .smart-import-badge.pro:hover {
                background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
                box-shadow: 0 2px 8px rgba(251, 191, 36, 0.4);
            }
            
            .smart-import-badge .badge-icon {
                font-size: 12px;
            }
            
            .smart-import-badge .badge-label {
                letter-spacing: 0.3px;
            }
        `;
    }
}

export default SmartImportBadge;