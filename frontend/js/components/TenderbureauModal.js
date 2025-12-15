/**
 * TenderbureauModal - Create/Edit modal voor tenderbureaus
 * TenderZen v2.0 - Past bij TenderbureauModal.css
 * 
 * FIXES:
 * - CSS classes matchen nu met TenderbureauModal.css (.tenderbureau-modal-overlay, .tenderbureau-modal)
 * - Labels worden correct getoond
 * - "Bureau is actief" staat standaard aan
 * - Edit mode toont "Opslaan" knop
 * - visibility/opacity worden geforceerd voor zichtbaarheid
 */

import { tenderbureausService } from '/js/services/TenderbureausService.js';

export class TenderbureauModal {
    constructor() {
        this.modal = null;
        this.mode = 'create';
        this.bureau = null;
        this.onSave = null;
        this.onClose = null;
        this.escHandler = null;
        
        // Direct bij constructie: maak modal container aan in DOM
        this.createModalContainer();
    }

    /**
     * Maak een persistente modal container in de DOM
     */
    createModalContainer() {
        // Check of modal al bestaat
        if (document.getElementById('tenderbureau-modal')) {
            this.modal = document.getElementById('tenderbureau-modal');
            return;
        }

        // Maak modal HTML - PAST BIJ TenderbureauModal.css!
        const modalDiv = document.createElement('div');
        modalDiv.id = 'tenderbureau-modal';
        modalDiv.className = 'tenderbureau-modal-overlay';
        modalDiv.style.display = 'none';
        
        // Voeg inline styles toe voor betrouwbaarheid (fallback voor CSS)
        modalDiv.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
            box-sizing: border-box;
        `;
        
        modalDiv.innerHTML = `
            <div class="tenderbureau-modal" style="
                background: white;
                border-radius: 12px;
                width: 100%;
                max-width: 600px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
                overflow: hidden;
            ">
                <!-- Content wordt dynamisch gevuld -->
            </div>
        `;

        // Voeg toe aan body
        document.body.appendChild(modalDiv);
        this.modal = modalDiv;
        
        // Backdrop click sluit modal
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
        
        console.log('✅ TenderbureauModal container created in DOM');
    }

    /**
     * Open modal
     */
    open(bureau = null) {
        console.log('📝 TenderbureauModal.open() called with:', bureau);
        
        if (bureau) {
            this.mode = 'edit';
            this.bureau = bureau;
        } else {
            this.mode = 'create';
            this.bureau = null;
        }
        
        this.renderContent();
        this.show();
    }

    /**
     * Render de modal content
     */
    renderContent() {
        const container = this.modal.querySelector('.tenderbureau-modal');
        if (!container) return;

        const isEdit = this.mode === 'edit';
        const b = this.bureau || {}; // Shorthand voor bureau data

        container.innerHTML = `
            <!-- Header -->
            <div class="modal-header" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                border-bottom: 1px solid #e5e7eb;
                background: #f9fafb;
                flex-shrink: 0;
            ">
                <h2 class="modal-title" style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                    color: #1f2937;
                ">
                    ${isEdit ? '✏️ Bewerk Tenderbureau' : '🏢 Nieuw Tenderbureau'}
                </h2>
                <button class="modal-close" type="button" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    border: none;
                    background: transparent;
                    border-radius: 6px;
                    cursor: pointer;
                    color: #6b7280;
                    font-size: 20px;
                ">&times;</button>
            </div>

            <!-- Body -->
            <div class="modal-body" style="
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            ">
                <form id="tenderbureau-form">
                    ${this.renderFormSection('Basis Informatie', `
                        <div style="display: flex; gap: 16px;">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    Bedrijfsnaam <span style="color: #ef4444;">*</span>
                                </label>
                                <input type="text" id="tb-naam" name="naam" 
                                       placeholder="Bijv. TenderBureau Amsterdam BV"
                                       value="${this.escapeHtml(b.naam || '')}" 
                                       required
                                       style="${this.inputStyle}">
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    Slug <span style="color: #ef4444;">*</span>
                                </label>
                                <input type="text" id="tb-slug" name="slug"
                                       placeholder="bijv. tenderbureau-amsterdam"
                                       value="${this.escapeHtml(b.slug || '')}"
                                       pattern="[a-z0-9-]+" required
                                       style="${this.inputStyle}">
                                <span style="display: block; font-size: 12px; color: #9ca3af; margin-top: 4px;">
                                    Voor URLs (lowercase, geen spaties)
                                </span>
                                <button type="button" id="btn-generate-slug" style="
                                    background: none;
                                    border: none;
                                    color: #667eea;
                                    font-size: 12px;
                                    cursor: pointer;
                                    padding: 4px 0;
                                    margin-top: 4px;
                                ">Genereer uit naam</button>
                            </div>
                        </div>
                    `)}

                    ${this.renderFormSection('Contact Informatie', `
                        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Email</label>
                                <input type="email" id="tb-email" name="email"
                                       placeholder="info@bureau.nl"
                                       value="${this.escapeHtml(b.email || '')}"
                                       style="${this.inputStyle}">
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Telefoon</label>
                                <input type="tel" id="tb-telefoon" name="telefoon"
                                       placeholder="020-1234567"
                                       value="${this.escapeHtml(b.telefoon || '')}"
                                       style="${this.inputStyle}">
                            </div>
                        </div>
                        <div>
                            <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Website</label>
                            <input type="url" id="tb-website" name="website"
                                   placeholder="https://bureau.nl"
                                   value="${this.escapeHtml(b.website || '')}"
                                   style="${this.inputStyle}">
                        </div>
                    `)}

                    ${this.renderFormSection('Adres', `
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Straat + Nummer</label>
                            <input type="text" id="tb-adres" name="adres"
                                   placeholder="Voorbeeldstraat 123"
                                   value="${this.escapeHtml(b.adres || '')}"
                                   style="${this.inputStyle}">
                        </div>
                        <div style="display: flex; gap: 16px;">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Postcode</label>
                                <input type="text" id="tb-postcode" name="postcode"
                                       placeholder="1234 AB"
                                       value="${this.escapeHtml(b.postcode || '')}"
                                       style="${this.inputStyle}">
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Plaats</label>
                                <input type="text" id="tb-plaats" name="plaats"
                                       placeholder="Amsterdam"
                                       value="${this.escapeHtml(b.plaats || '')}"
                                       style="${this.inputStyle}">
                            </div>
                        </div>
                    `)}

                    ${this.renderFormSection('Subscription', `
                        <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    Tier <span style="color: #ef4444;">*</span>
                                </label>
                                <select id="tb-tier" name="subscription_tier" required style="${this.inputStyle}">
                                    <option value="free" ${b.subscription_tier === 'free' ? 'selected' : ''}>Free (max 2 users)</option>
                                    <option value="basic" ${b.subscription_tier === 'basic' ? 'selected' : ''}>Basic (max 5 users)</option>
                                    <option value="professional" ${b.subscription_tier === 'professional' ? 'selected' : ''}>Professional (max 15 users)</option>
                                    <option value="enterprise" ${b.subscription_tier === 'enterprise' ? 'selected' : ''}>Enterprise (unlimited)</option>
                                </select>
                            </div>
                            <div style="flex: 1;">
                                <label style="display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">Max Users</label>
                                <input type="number" id="tb-max-users" name="max_users"
                                       min="1" value="${b.max_users || 2}"
                                       style="${this.inputStyle}">
                            </div>
                        </div>
                        <div>
                            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                                <input type="checkbox" id="tb-active" name="is_active"
                                       ${b.is_active !== false ? 'checked' : ''}
                                       style="width: 18px; height: 18px; accent-color: #667eea;">
                                <span style="font-size: 14px; color: #374151;">Bureau is actief</span>
                            </label>
                        </div>
                    `)}
                </form>
            </div>

            <!-- Footer -->
            <div class="modal-footer" style="
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                padding: 16px 20px;
                border-top: 1px solid #e5e7eb;
                background: #f9fafb;
                flex-shrink: 0;
            ">
                <button type="button" id="btn-cancel" style="
                    display: inline-flex;
                    align-items: center;
                    padding: 10px 20px;
                    background: white;
                    border: 1px solid #d1d5db;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #374151;
                    cursor: pointer;
                ">Annuleren</button>
                <button type="submit" form="tenderbureau-form" id="btn-save" style="
                    display: inline-flex;
                    align-items: center;
                    padding: 10px 20px;
                    background: #667eea;
                    border: 1px solid #667eea;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 500;
                    color: white;
                    cursor: pointer;
                ">${isEdit ? 'Opslaan' : 'Aanmaken'}</button>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Helper: Render a form section with title
     */
    renderFormSection(title, content) {
        return `
            <div style="margin-bottom: 24px; padding: 20px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
                <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 16px 0;">${title}</h3>
                ${content}
            </div>
        `;
    }

    /**
     * Common input style
     */
    get inputStyle() {
        return `
            width: 100%;
            padding: 10px 12px;
            border: 1px solid #d1d5db;
            border-radius: 8px;
            font-size: 14px;
            color: #1f2937;
            background: white;
            box-sizing: border-box;
        `;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close button
        this.modal.querySelector('.modal-close')?.addEventListener('click', () => this.close());
        
        // Cancel button
        this.modal.querySelector('#btn-cancel')?.addEventListener('click', () => this.close());

        // ESC key
        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
        }
        this.escHandler = (e) => {
            if (e.key === 'Escape' && this.modal.style.display !== 'none') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.escHandler);

        // Generate slug
        this.modal.querySelector('#btn-generate-slug')?.addEventListener('click', () => {
            const naam = this.modal.querySelector('#tb-naam')?.value;
            if (naam) {
                const slug = naam.toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');
                this.modal.querySelector('#tb-slug').value = slug;
            }
        });

        // Tier change updates max_users
        this.modal.querySelector('#tb-tier')?.addEventListener('change', (e) => {
            const maxUsers = { 'free': 2, 'basic': 5, 'professional': 15, 'enterprise': 100 };
            this.modal.querySelector('#tb-max-users').value = maxUsers[e.target.value] || 2;
        });

        // Form submit
        this.modal.querySelector('#tenderbureau-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    /**
     * Handle form submit
     */
    async handleSubmit() {
        const form = this.modal.querySelector('#tenderbureau-form');
        const formData = new FormData(form);
        
        const bureauData = {
            naam: formData.get('naam')?.trim(),
            slug: formData.get('slug')?.trim(),
            email: formData.get('email')?.trim() || null,
            telefoon: formData.get('telefoon')?.trim() || null,
            website: formData.get('website')?.trim() || null,
            adres: formData.get('adres')?.trim() || null,
            postcode: formData.get('postcode')?.trim() || null,
            plaats: formData.get('plaats')?.trim() || null,
            subscription_tier: formData.get('subscription_tier'),
            max_users: parseInt(formData.get('max_users')) || 2,
            is_active: this.modal.querySelector('#tb-active')?.checked ?? true
        };

        // Validate
        if (!bureauData.naam || !bureauData.slug) {
            alert('Naam en Slug zijn verplicht');
            return;
        }

        if (!/^[a-z0-9-]+$/.test(bureauData.slug)) {
            alert('Slug mag alleen lowercase letters, cijfers en streepjes bevatten');
            return;
        }

        // Disable button
        const saveBtn = this.modal.querySelector('#btn-save');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Bezig...';

        try {
            let result;
            
            if (this.mode === 'create') {
                result = await tenderbureausService.createBureau(bureauData);
                console.log('✅ Bureau created:', result);
            } else {
                result = await tenderbureausService.updateBureau(this.bureau.id, bureauData);
                console.log('✅ Bureau updated:', result);
            }

            if (this.onSave) {
                await this.onSave(result, this.mode);
            }

            this.close();

        } catch (error) {
            console.error('❌ Error saving bureau:', error);
            alert('Fout bij opslaan: ' + (error.message || 'Onbekende fout'));
            
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    /**
     * Show modal
     */
    show() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            // FIX: Forceer visibility en opacity (CSS animatie kan deze op hidden/0 zetten)
            this.modal.style.visibility = 'visible';
            this.modal.style.opacity = '1';
            document.body.style.overflow = 'hidden';
            
            // Focus first input
            setTimeout(() => {
                this.modal.querySelector('#tb-naam')?.focus();
            }, 100);
            
            console.log('✅ TenderbureauModal shown');
        }
    }

    /**
     * Close modal
     */
    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }

        if (this.escHandler) {
            document.removeEventListener('keydown', this.escHandler);
            this.escHandler = null;
        }

        if (this.onClose) {
            this.onClose();
        }
    }
}

export default TenderbureauModal;