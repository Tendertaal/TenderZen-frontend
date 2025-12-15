import { Component } from './Component.js';

/**
 * LoadingSpinner Component
 * Displays a loading animation with optional message
 * 
 * Variants:
 * - inline: Small spinner for inline use
 * - overlay: Full-screen overlay spinner
 * - default: Standard centered spinner
 */
export class LoadingSpinner extends Component {
    constructor(options = {}) {
        super(options);
        this.message = options.message || 'Laden...';
        this.variant = options.variant || 'default'; // inline, overlay, default
        this.size = options.size || 'medium'; // small, medium, large
    }

    /**
     * Render the loading spinner
     */
    render() {
        const container = document.createElement('div');
        container.className = `loading-spinner variant-${this.variant} size-${this.size}`;

        if (this.variant === 'overlay') {
            container.innerHTML = `
                <div class="spinner-overlay">
                    <div class="spinner-content">
                        <div class="spinner-circle"></div>
                        ${this.message ? `<div class="spinner-message">${this.message}</div>` : ''}
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="spinner-circle"></div>
                ${this.message && this.variant !== 'inline' ? `
                    <div class="spinner-message">${this.message}</div>
                ` : ''}
            `;
        }

        this.element = container;
        return container;
    }

    /**
     * Update loading message
     */
    updateMessage(newMessage) {
        this.message = newMessage;
        
        if (this.element) {
            const messageEl = this.element.querySelector('.spinner-message');
            if (messageEl) {
                messageEl.textContent = newMessage;
            }
        }
    }

    /**
     * Remove the spinner
     */
    remove() {
        if (this.element && this.element.parentNode) {
            this.element.classList.add('fade-out');
            setTimeout(() => {
                if (this.element && this.element.parentNode) {
                    this.element.parentNode.removeChild(this.element);
                }
            }, 300);
        }
    }

    /**
     * Show spinner (if hidden)
     */
    show() {
        if (this.element) {
            this.element.classList.remove('hidden');
            this.element.classList.add('fade-in');
        }
    }

    /**
     * Hide spinner (without removing)
     */
    hide() {
        if (this.element) {
            this.element.classList.add('fade-out');
            setTimeout(() => {
                if (this.element) {
                    this.element.classList.add('hidden');
                    this.element.classList.remove('fade-out');
                }
            }, 300);
        }
    }
}
