/**
 * BaseView.js - Base class voor alle views
 * Bevat gemeenschappelijke functionaliteit
 */

export class BaseView {
    constructor(options = {}) {
        this.name = options.name || 'BaseView';
        this.container = null;
        this.tenders = []; // Tenders data - initialized as empty array
        this.bedrijven = []; // Bedrijven data - initialized as empty array
    }

    mount(container) {
        this.container = container;
        // Initialize tenders as empty array if not set
        if (!this.tenders) {
            this.tenders = [];
        }
        // Render immediately (will show loading/empty state)
        if (this.render) {
            this.render();
        }
    }

    unmount() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.container = null;
    }

    async reload() {
        if (this.render) {
            this.render();
        }
    }

    /**
     * Set tenders data (voor TenderListView compatibility)
     */
    setTenders(tenders) {
        this.tenders = tenders || [];
        if (this.render && this.container) {
            this.render();
        }
    }

    /**
     * Set bedrijven data (voor BedrijvenView compatibility)
     */
    async setBedrijven(bedrijven) {
        this.bedrijven = bedrijven || [];
        if (this.applyFilters) {
            this.applyFilters();
        } else if (this.render && this.container) {
            this.render();
        }
    }
}