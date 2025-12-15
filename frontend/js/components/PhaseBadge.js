/**
 * PhaseBadge Component
 * TenderZen v2.0
 * 
 * Voor het weergeven van tender fases:
 * - Acquisitie (blauw)
 * - Inschrijvingen (paars)
 * - Ingediend (teal)
 * 
 * VEREIST: icons.js moet geladen zijn VOOR dit bestand
 */

// Referentie naar globale Icons
const Icons = window.Icons || {};

export class PhaseBadge {
    constructor(phase, options = {}) {
        this.phase = phase;
        this.options = {
            showIcon: false,
            size: 'default', // 'xs', 'sm', 'default', 'lg'
            ...options
        };
    }

    /**
     * Get phase configuration
     */
    getPhaseConfig() {
        const phaseKey = this.phase?.toLowerCase() || '';
        
        const phaseConfig = {
            'acquisitie': {
                cssClass: 'phase-badge--acquisitie',
                label: 'Acquisitie',
                icon: () => Icons.briefcase ? Icons.briefcase({ size: this.getIconSize() }) : ''
            },
            'inschrijvingen': {
                cssClass: 'phase-badge--inschrijvingen',
                label: 'Inschrijvingen',
                icon: () => Icons.edit ? Icons.edit({ size: this.getIconSize() }) : ''
            },
            'schrijven': {
                cssClass: 'phase-badge--inschrijvingen',
                label: 'Schrijven',
                icon: () => Icons.edit ? Icons.edit({ size: this.getIconSize() }) : ''
            },
            'ingediend': {
                cssClass: 'phase-badge--ingediend',
                label: 'Ingediend',
                icon: () => Icons.checkCircle ? Icons.checkCircle({ size: this.getIconSize() }) : ''
            }
        };

        return phaseConfig[phaseKey] || {
            cssClass: 'phase-badge--default',
            label: this.phase || 'Onbekend',
            icon: null
        };
    }

    /**
     * Get icon size based on badge size
     */
    getIconSize() {
        const sizes = {
            'xs': 10,
            'sm': 12,
            'default': 14,
            'lg': 16
        };
        return sizes[this.options.size] || 14;
    }

    /**
     * Get size class
     */
    getSizeClass() {
        const sizeClasses = {
            'xs': 'badge-xs',
            'sm': 'badge-sm',
            'default': '',
            'lg': 'badge-lg'
        };
        return sizeClasses[this.options.size] || '';
    }

    /**
     * Render the badge as DOM element
     */
    render() {
        const config = this.getPhaseConfig();
        const sizeClass = this.getSizeClass();

        const badge = document.createElement('span');
        badge.className = `phase-badge ${config.cssClass} ${sizeClass}`.trim();

        let innerHTML = '';
        
        if (this.options.showIcon && config.icon) {
            innerHTML += `<span class="badge-icon">${config.icon()}</span>`;
        }
        
        innerHTML += `<span class="badge-label">${config.label}</span>`;
        
        badge.innerHTML = innerHTML;

        return badge;
    }

    /**
     * Render as HTML string
     */
    toHTML() {
        const config = this.getPhaseConfig();
        const sizeClass = this.getSizeClass();

        let innerHTML = '';
        
        if (this.options.showIcon && config.icon) {
            innerHTML += `<span class="badge-icon">${config.icon()}</span>`;
        }
        
        innerHTML += `<span class="badge-label">${config.label}</span>`;

        return `<span class="phase-badge ${config.cssClass} ${sizeClass}">${innerHTML}</span>`;
    }

    // ============================================
    // STATIC HELPERS
    // ============================================

    static create(phase, options = {}) {
        const badge = new PhaseBadge(phase, options);
        return badge.render();
    }

    static html(phase, options = {}) {
        const badge = new PhaseBadge(phase, options);
        return badge.toHTML();
    }

    static acquisitie(options = {}) {
        return PhaseBadge.create('acquisitie', options);
    }

    static inschrijvingen(options = {}) {
        return PhaseBadge.create('inschrijvingen', options);
    }

    static ingediend(options = {}) {
        return PhaseBadge.create('ingediend', options);
    }
}

export default PhaseBadge;