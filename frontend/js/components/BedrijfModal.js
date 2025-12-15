/**
 * BedrijfModal - Modal voor bedrijf Create/Edit/View
 * TenderZen v3.0 - COMPLETE REWRITE
 * 
 * Pattern: Exact same as TenderAanmaken.js (that WORKS!)
 * - Simple modal-overlay + modal-container structure
 * - Direct style.display control
 * - External CSS only (no inline styles)
 * - Clean form-section pattern
 */

import { bedrijvenService } from '../services/Bedrijvenservice.js';

const Icons = window.Icons || {};

export class BedrijfModal {
    constructor() {
        this.isOpen = false;
        this.modal = null;
        this.mode = 'create'; // 'create', 'edit', 'view'
        this.bedrijf = null;
        this.onSave = null;
    }

    /**
     * Open modal
     */
    open(bedrijf = null, viewMode = false) {
        console.log('🔧 BedrijfModal.open() called', { bedrijf: bedrijf?.bedrijfsnaam, viewMode });

        if (bedrijf) {
            this.mode = viewMode ? 'view' : 'edit';
            this.bedrijf = bedrijf;
        } else {
            this.mode = 'create';
            this.bedrijf = null;
        }

        this.render();
        console.log('🔧 Rendered modal, appending to DOM');

        if (!document.body.contains(this.modal)) {
            document.body.appendChild(this.modal);
            console.log('✅ Modal appended to DOM');
        }

        // Show modal (SIMPLE: direct style.display)
        this.modal.style.display = 'flex';
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal displayed (style.display = flex)');
    }

    /**
     * Close modal
     */
    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    }

    /**
     * Render modal (SIMPLE: like TenderAanmaken)
     */
    render() {
        console.log('🔧 BedrijfModal.render() started, mode:', this.mode);

        this.modal = document.createElement('div');
        this.modal.className = 'bedrijf-modal';
        this.modal.id = 'bedrijf-modal';
        this.modal.style.display = 'none';

        const title = this.mode === 'create' ? 'Nieuw Bedrijf' :
            this.mode === 'view' ? 'Bedrijf Details' :
                'Bedrijf Bewerken';

        const iconName = this.mode === 'create' ? 'plus' :
            this.mode === 'view' ? 'eye' : 'edit';

        this.modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-container">
                <!-- Header -->
                <div class="modal-header">
                    <div class="modal-header-content">
                        <span class="modal-icon">
                            ${this.getIcon(iconName, 24, '#8b5cf6')}
                        </span>
                        <h2 class="modal-title">${title}</h2>
                    </div>
                    <button class="modal-close" id="bedrijf-modal-close" type="button">
                        ${this.getIcon('x', 20)}
                    </button>
                </div>

                <!-- Content -->
                <div class="modal-content">
                    ${this.mode === 'view' ? this.renderViewMode() : this.renderFormMode()}
                </div>

                <!-- Footer -->
                <div class="modal-footer">
                    <div class="modal-footer-left">
                        ${this.mode === 'edit' ? `
                            <button type="button" class="btn btn-danger" id="bedrijf-btn-delete">
                                ${this.getIcon('trash', 16)}
                                <span>Verwijderen</span>
                            </button>
                        ` : ''}
                    </div>
                    <div class="modal-footer-right">
                        <button type="button" class="btn btn-secondary" id="bedrijf-btn-cancel">
                            ${this.mode === 'view' ? 'Sluiten' : 'Annuleren'}
                        </button>
                        ${this.mode !== 'view' ? `
                            <button type="button" class="btn btn-primary" id="bedrijf-btn-save">
                                ${this.getIcon('check', 16, '#ffffff')}
                                Opslaan
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render view mode
     */
    renderViewMode() {
        const b = this.bedrijf || {};

        return `
            <form>
                <div class="form-section form-section--primary">
                    <div class="bedrijf-header-row">
                        <div>
                            <h3 class="bedrijf-naam">${b.bedrijfsnaam || 'Onbekend'}</h3>
                            <div class="bedrijf-rating">${this.renderRatingStars(b.rating || 0)}</div>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h4 class="section-title">Bedrijfsgegevens</h4>
                    <div class="info-list">
                        ${this.renderInfoItem('KvK nummer', b.kvk_nummer)}
                        ${this.renderInfoItem('BTW nummer', b.btw_nummer)}
                        ${this.renderInfoItem('Branche', b.branche)}
                        ${this.renderInfoItem('Website', b.website ? `<a href="${b.website}" target="_blank">${b.website}</a>` : '-')}
                    </div>
                </div>

                <div class="form-section">
                    <h4 class="section-title">Contactgegevens</h4>
                    <div class="info-list">
                        ${this.renderInfoItem('Contactpersoon', b.contactpersoon)}
                        ${this.renderInfoItem('Email', b.contact_email)}
                        ${this.renderInfoItem('Telefoon', b.contact_telefoon)}
                    </div>
                </div>

                <div class="form-section">
                    <h4 class="section-title">Adres</h4>
                    <div class="info-list">
                        ${this.renderInfoItem('Adres', b.adres)}
                        ${this.renderInfoItem('Postcode', b.postcode)}
                        ${this.renderInfoItem('Plaats', b.plaats)}
                        ${this.renderInfoItem('Land', b.land)}
                    </div>
                </div>
            </form>
        `;
    }

    /**
     * Render form mode (edit/create)
     */
    renderFormMode() {
        const b = this.bedrijf || {};

        return `
            <form id="bedrijf-form">
                <div class="form-section form-section--primary">
                    <h3 class="section-title">
                        ${this.getIcon('fileText', 16, '#8b5cf6')}
                        Bedrijfsgegevens
                    </h3>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="bedrijf-naam">
                                Bedrijfsnaam
                                <span class="required">*</span>
                            </label>
                            <input type="text" id="bedrijf-naam" class="form-control form-control--prominent" 
                                   value="${b.bedrijfsnaam || ''}" placeholder="Bijv. Acme B.V." required>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="bedrijf-kvk">KvK nummer</label>
                            <input type="text" id="bedrijf-kvk" class="form-control" 
                                   value="${b.kvk_nummer || ''}" maxlength="8" placeholder="12345678">
                        </div>
                        <div class="form-group">
                            <label for="bedrijf-btw">BTW nummer</label>
                            <input type="text" id="bedrijf-btw" class="form-control" 
                                   value="${b.btw_nummer || ''}" placeholder="NL123456789B01">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="bedrijf-branche">Branche</label>
                            <select id="bedrijf-branche" class="form-control">
                                <option value="">-- Selecteer branche --</option>
                                <option value="Bouw" ${b.branche === 'Bouw' ? 'selected' : ''}>Bouw</option>
                                <option value="Infrastructuur" ${b.branche === 'Infrastructuur' ? 'selected' : ''}>Infrastructuur</option>
                                <option value="Installatie" ${b.branche === 'Installatie' ? 'selected' : ''}>Installatie</option>
                                <option value="ICT" ${b.branche === 'ICT' ? 'selected' : ''}>ICT</option>
                                <option value="Advies" ${b.branche === 'Advies' ? 'selected' : ''}>Advies</option>
                                <option value="Overig" ${b.branche === 'Overig' ? 'selected' : ''}>Overig</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="bedrijf-website">Website</label>
                            <input type="url" id="bedrijf-website" class="form-control" 
                                   value="${b.website || ''}" placeholder="https://www.bedrijf.nl">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">
                        ${this.getIcon('user', 16, '#3b82f6')}
                        Contactgegevens
                    </h3>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="bedrijf-contactpersoon">Contactpersoon</label>
                            <input type="text" id="bedrijf-contactpersoon" class="form-control" 
                                   value="${b.contactpersoon || ''}" placeholder="Naam">
                        </div>
                        <div class="form-group">
                            <label for="bedrijf-email">Email</label>
                            <input type="email" id="bedrijf-email" class="form-control" 
                                   value="${b.contact_email || ''}" placeholder="email@bedrijf.nl">
                        </div>
                    </div>

                    <div class="form-row form-row--single">
                        <div class="form-group">
                            <label for="bedrijf-telefoon">Telefoon</label>
                            <input type="tel" id="bedrijf-telefoon" class="form-control" 
                                   value="${b.contact_telefoon || ''}" placeholder="+31 6 12345678">
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <h3 class="section-title">
                        ${this.getIcon('mapPin', 16, '#10b981')}
                        Adres
                    </h3>

                    <div class="form-row form-row--single">
                        <div class="form-group">
                            <label for="bedrijf-adres">Adres</label>
                            <input type="text" id="bedrijf-adres" class="form-control" 
                                   value="${b.adres || ''}" placeholder="Straatnaam 123">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="bedrijf-postcode">Postcode</label>
                            <input type="text" id="bedrijf-postcode" class="form-control" 
                                   value="${b.postcode || ''}" placeholder="1234 AB">
                        </div>
                        <div class="form-group">
                            <label for="bedrijf-plaats">Plaats</label>
                            <input type="text" id="bedrijf-plaats" class="form-control" 
                                   value="${b.plaats || ''}" placeholder="Utrecht">
                        </div>
                    </div>

                    <div class="form-row form-row--single">
                        <div class="form-group">
                            <label for="bedrijf-land">Land</label>
                            <input type="text" id="bedrijf-land" class="form-control" 
                                   value="${b.land || 'Nederland'}">
                        </div>
                    </div>
                </div>
            </form>
        `;
    }

    /**
     * Helper: Get icon
     */
    getIcon(name, size = 16, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    /**
     * Helper: Render info item
     */
    renderInfoItem(label, value) {
        if (!value) return '';
        return `
            <div class="info-item">
                <span class="info-label">${label}:</span>
                <span class="info-value">${value}</span>
            </div>
        `;
    }

    /**
     * Helper: Render rating stars
     */
    renderRatingStars(rating) {
        if (!rating) return '<span class="no-rating">Geen rating</span>';
        return '⭐'.repeat(rating);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const closeBtn = this.modal.querySelector('#bedrijf-modal-close');
        const cancelBtn = this.modal.querySelector('#bedrijf-btn-cancel');
        const saveBtn = this.modal.querySelector('#bedrijf-btn-save');
        const deleteBtn = this.modal.querySelector('#bedrijf-btn-delete');
        const overlay = this.modal.querySelector('.modal-overlay');

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
        if (overlay) overlay.addEventListener('click', () => this.close());

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveBedrijf();
            });
        }

        // Delete button
        if (deleteBtn && this.mode === 'edit' && this.bedrijf) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const bedrijfNaam = this.bedrijf.naam || this.bedrijf.bedrijfsnaam || 'dit bedrijf';
                if (confirm(`Weet je zeker dat je "${bedrijfNaam}" wilt verwijderen?`)) {
                    try {
                        console.log('🗑️ Deleting bedrijf:', this.bedrijf.id);
                        const { bedrijvenService } = await import('../services/Bedrijvenservice.js');
                        await bedrijvenService.deleteBedrijf(this.bedrijf.id);
                        console.log('✅ Bedrijf deleted');

                        if (this.onSave) {
                            this.onSave();
                        }

                        this.close();
                    } catch (error) {
                        console.error('Error deleting bedrijf:', error);
                        alert('Fout bij verwijderen: ' + error.message);
                    }
                }
            });
        }
    }

    /**
     * Save bedrijf
     */
    async saveBedrijf() {
        console.log('🔧 saveBedrijf() called');
        const form = this.modal.querySelector('#bedrijf-form');
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = {
            bedrijfsnaam: this.modal.querySelector('#bedrijf-naam').value,
            kvk_nummer: this.modal.querySelector('#bedrijf-kvk').value,
            btw_nummer: this.modal.querySelector('#bedrijf-btw').value,
            branche: this.modal.querySelector('#bedrijf-branche').value,
            website: this.modal.querySelector('#bedrijf-website').value,
            contactpersoon: this.modal.querySelector('#bedrijf-contactpersoon').value,
            contact_email: this.modal.querySelector('#bedrijf-email').value,
            contact_telefoon: this.modal.querySelector('#bedrijf-telefoon').value,
            adres: this.modal.querySelector('#bedrijf-adres').value,
            postcode: this.modal.querySelector('#bedrijf-postcode').value,
            plaats: this.modal.querySelector('#bedrijf-plaats').value,
            land: this.modal.querySelector('#bedrijf-land').value,
        };

        try {
            console.log('💾 Saving bedrijf:', data);
            if (this.mode === 'create') {
                await bedrijvenService.createBedrijf(data);
                // Na create altijd bedrijvenlijst verversen
                await bedrijvenService.loadBedrijven();
                console.log('✅ Bedrijf created');
            } else {
                data.id = this.bedrijf.id;
                await bedrijvenService.updateBedrijf(data);
                // Na update altijd bedrijvenlijst verversen
                await bedrijvenService.loadBedrijven();
                console.log('✅ Bedrijf updated');
            }

            if (this.onSave) {
                this.onSave();
            }

            this.close();
        } catch (error) {
            console.error('Error saving bedrijf:', error);
            alert('Fout bij opslaan: ' + error.message);
        }
    }
}
