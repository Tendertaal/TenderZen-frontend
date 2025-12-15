/**
 * StatusBadge Component
 * TenderZen v2.0
 * 
 * CHANGELOG:
 * - CSS variables toegepast (geen inline styles meer)
 * - Icon support toegevoegd
 * - Nieuwe badge types
 * - Static helpers voor snelle creatie
 * 
 * VEREIST: icons.js moet geladen zijn VOOR dit bestand
 */

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

export class StatusBadge {
    constructor(status, type = 'default', options = {}) {
        this.status = status;
        this.type = type; // 'default', 'go', 'no-go', 'maybe', 'pending'
        this.options = {
            showIcon: true,
            size: 'default', // 'xs', 'sm', 'default', 'lg', 'xl'
            interactive: false,
            ...options
        };
    }

    /**
     * Get configuration for status type
     */
    getStatusConfig() {
        // Go/No-go/Maybe/Pending status configuration
        const typeConfig = {
            'go': { 
                cssClass: 'badge-go',
                label: 'Go',
                icon: () => Icons.statusGo({ size: this.getIconSize() })
            },
            'no-go': { 
                cssClass: 'badge-no-go',
                label: 'No-Go',
                icon: () => Icons.statusNoGo({ size: this.getIconSize() })
            },
            'maybe': { 
                cssClass: 'badge-maybe',
                label: 'Maybe',
                icon: () => Icons.statusMaybe({ size: this.getIconSize() })
            },
            'pending': { 
                cssClass: 'badge-pending',
                label: 'Pending',
                icon: () => Icons.statusPending({ size: this.getIconSize() })
            }
        };

        // Workflow status configuration
        const workflowConfig = {
            'Zoeken bedrijf': { 
                cssClass: 'badge-zoeken-bedrijf',
                label: 'Zoeken bedrijf',
                icon: () => Icons.search({ size: this.getIconSize() })
            },
            'Opstellen offerte': { 
                cssClass: 'badge-opstellen-offerte',
                label: 'Opstellen offerte',
                icon: () => Icons.edit({ size: this.getIconSize() })
            },
            'Offerte akkoord': { 
                cssClass: 'badge-offerte-akkoord',
                label: 'Offerte akkoord',
                icon: () => Icons.check({ size: this.getIconSize() })
            },
            'Inplannen': { 
                cssClass: 'badge-inplannen',
                label: 'Inplannen',
                icon: () => Icons.calendarView({ size: this.getIconSize() })
            },
            'Uitvoeren': { 
                cssClass: 'badge-uitvoeren',
                label: 'Uitvoeren',
                icon: () => Icons.clock({ size: this.getIconSize() })
            },
            'Ingediend': { 
                cssClass: 'badge-ingediend-status',
                label: 'Ingediend',
                icon: () => Icons.checkCircle({ size: this.getIconSize() })
            },
            'Evalueren': { 
                cssClass: 'badge-evalueren',
                label: 'Evalueren',
                icon: () => Icons.clipboardList({ size: this.getIconSize() })
            },
            'Afgerond': { 
                cssClass: 'badge-afgerond',
                label: 'Afgerond',
                icon: () => Icons.check({ size: this.getIconSize() })
            }
        };

        // Return appropriate config
        if (this.type !== 'default' && typeConfig[this.type]) {
            return typeConfig[this.type];
        }

        if (workflowConfig[this.status]) {
            return workflowConfig[this.status];
        }

        // Fallback
        return { 
            cssClass: 'badge-neutral',
            label: this.status,
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
            'lg': 16,
            'xl': 18
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
            'lg': 'badge-lg',
            'xl': 'badge-xl'
        };
        return sizeClasses[this.options.size] || '';
    }

    /**
     * Render the badge
     */
    render() {
        const config = this.getStatusConfig();
        const sizeClass = this.getSizeClass();
        const interactiveClass = this.options.interactive ? 'badge-interactive' : '';

        const badge = document.createElement('span');
        badge.className = `status-badge ${config.cssClass} ${sizeClass} ${interactiveClass}`.trim();

        // Build inner HTML
        let innerHTML = '';
        
        if (this.options.showIcon && config.icon) {
            innerHTML += `<span class="badge-icon">${config.icon()}</span>`;
        }
        
        innerHTML += `<span class="badge-label">${config.label}</span>`;
        
        badge.innerHTML = innerHTML;

        return badge;
    }

    /**
     * Render as HTML string (for template literals)
     */
    toHTML() {
        const config = this.getStatusConfig();
        const sizeClass = this.getSizeClass();
        const interactiveClass = this.options.interactive ? 'badge-interactive' : '';

        let innerHTML = '';
        
        if (this.options.showIcon && config.icon) {
            innerHTML += `<span class="badge-icon">${config.icon()}</span>`;
        }
        
        innerHTML += `<span class="badge-label">${config.label}</span>`;

        return `<span class="status-badge ${config.cssClass} ${sizeClass} ${interactiveClass}">${innerHTML}</span>`;
    }

    // ============================================
    // STATIC HELPERS
    // ============================================

    /**
     * Create a badge element
     */
    static create(status, type = 'default', options = {}) {
        const badge = new StatusBadge(status, type, options);
        return badge.render();
    }

    /**
     * Create badge as HTML string
     */
    static html(status, type = 'default', options = {}) {
        const badge = new StatusBadge(status, type, options);
        return badge.toHTML();
    }

    /**
     * Create a Go badge
     */
    static go(options = {}) {
        return StatusBadge.create('Go', 'go', options);
    }

    /**
     * Create a No-Go badge
     */
    static noGo(options = {}) {
        return StatusBadge.create('No-Go', 'no-go', options);
    }

    /**
     * Create a Maybe badge
     */
    static maybe(options = {}) {
        return StatusBadge.create('Maybe', 'maybe', options);
    }

    /**
     * Create a Pending badge
     */
    static pending(options = {}) {
        return StatusBadge.create('Pending', 'pending', options);
    }

    /**
     * Create badge HTML for Go status
     */
    static goHTML(options = {}) {
        return StatusBadge.html('Go', 'go', options);
    }

    /**
     * Create badge HTML for No-Go status
     */
    static noGoHTML(options = {}) {
        return StatusBadge.html('No-Go', 'no-go', options);
    }

    /**
     * Create badge HTML for Maybe status
     */
    static maybeHTML(options = {}) {
        return StatusBadge.html('Maybe', 'maybe', options);
    }

    /**
     * Create badge HTML for Pending status
     */
    static pendingHTML(options = {}) {
        return StatusBadge.html('Pending', 'pending', options);
    }
}

/**
 * PhaseBadge Component
 * For displaying tender phases: Acquisitie, Inschrijvingen, Ingediend
 */
export class PhaseBadge {
    constructor(phase, options = {}) {
        this.phase = phase;
        this.options = {
            showIcon: false,
            size: 'default',
            ...options
        };
    }

    /**
     * Get phase configuration
     */
    getPhaseConfig() {
        const phaseConfig = {
            'acquisitie': {
                cssClass: 'badge-acquisitie',
                label: 'Acquisitie',
                icon: () => Icons.briefcase({ size: this.getIconSize() })
            },
            'inschrijvingen': {
                cssClass: 'badge-inschrijvingen',
                label: 'Inschrijvingen',
                icon: () => Icons.edit({ size: this.getIconSize() })
            },
            'ingediend': {
                cssClass: 'badge-ingediend',
                label: 'Ingediend',
                icon: () => Icons.checkCircle({ size: this.getIconSize() })
            }
        };

        const key = this.phase.toLowerCase();
        return phaseConfig[key] || {
            cssClass: 'badge-neutral',
            label: this.phase,
            icon: null
        };
    }

    /**
     * Get icon size
     */
    getIconSize() {
        const sizes = {
            'xs': 10,
            'sm': 12,
            'default': 14,
            'lg': 16,
            'xl': 18
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
            'lg': 'badge-lg',
            'xl': 'badge-xl'
        };
        return sizeClasses[this.options.size] || '';
    }

    /**
     * Render the badge
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

    // Static helpers
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

export default StatusBadge;