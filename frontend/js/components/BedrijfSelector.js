/**
 * BedrijfSelector Component v3.3
 * TenderZen Design System
 * 
 * CHANGELOG v3.3:
 * - ⭐ FIX: validateForm() toegevoegd voor TenderAanmaken compatibiliteit
 * - ⭐ FIX: getFormData() alias toegevoegd
 * - ⭐ FIX: validateFieldRealtime() gebruikt nu bedrijvenService.validateField()
 * - ⭐ FIX: checkDuplicates → checkDuplicaat
 * 
 * CHANGELOG v3.2:
 * - ⭐ setMode() methode toegevoegd voor backward compatibility
 * 
 * CHANGELOG v3.1:
 * - ⭐ Edit functie toegevoegd: bewerk bestaand bedrijf
 * - ⭐ Dezelfde form layout als nieuw bedrijf
 * - ⭐ "Bewerken" en "Ander bedrijf" knoppen in header
 * - ⭐ Wijzigingen worden opgeslagen naar database
 * 
 * CHANGELOG v3.0:
 * - ⭐ Volledig herontwerp: geen toggle meer, zoekbalk als primaire interface
 * - ⭐ Na selectie: alle velden zichtbaar met "Wijzig selectie" optie
 * - ⭐ "Nieuw bedrijf" als optie in dropdown (onderaan)
 * - ⭐ Readonly velden met edit mogelijkheid
 * - ⭐ Cleaner, intuïtievere UX
 */

import { bedrijvenService } from '/js/services/BedrijvenService.js';

// Icons reference (loaded globally)
const Icons = window.Icons || {};

export class BedrijfSelector {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = null;
        this.mode = 'search'; // 'search', 'selected', 'nieuw'
        this.selectedBedrijf = null;
        this.isEditing = false;
        this.searchTimer = null;

        // Callbacks
        this.onSelect = options.onSelect || null;
        this.onChange = options.onChange || null;
    }

    /**
     * Render the component
     */
    async render() {
        // Altijd bedrijvenlijst verversen bij render
        await bedrijvenService.loadBedrijven();
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('BedrijfSelector container not found:', this.containerId);
            return;
        }
        this.container = container;

        container.innerHTML = `
            <div class="bedrijf-selector bedrijf-selector--fullwidth">
                <!-- SEARCH STATE: Zoekbalk -->
                <div class="selector-search" id="selector-search-${this.containerId}">
                    <div class="search-wrapper">
                        <div class="search-input-container">
                            <span class="search-icon">${Icons.search ? Icons.search({ size: 18, color: '#94a3b8' }) : '🔍'}</span>
                            <input type="text" 
                                   id="bedrijf-search-${this.containerId}" 
                                   class="form-control bedrijf-search" 
                                   placeholder="Zoek bedrijf of maak nieuw aan..."
                                   autocomplete="off">
                        </div>
                        <div class="search-results" id="bedrijf-results-${this.containerId}"></div>
                    </div>
                </div>

                <!-- SELECTED STATE: Geselecteerd bedrijf met alle details -->
                <div class="selector-selected" id="selector-selected-${this.containerId}" style="display: none;">
                    <div class="selected-header">
                        <div class="selected-title">
                            <div class="selected-avatar" id="selected-avatar-${this.containerId}"></div>
                            <div class="selected-name-wrapper">
                                <h4 id="selected-naam-${this.containerId}"></h4>
                                <span class="selected-badge">${Icons.checkCircle ? Icons.checkCircle({ size: 14, color: '#16a34a' }) : '✓'} Geselecteerd</span>
                            </div>
                        </div>
                        <div class="selected-actions">
                            <button type="button" class="btn-edit" id="btn-edit-${this.containerId}" title="Gegevens bewerken">
                                ${Icons.edit ? Icons.edit({ size: 14 }) : '✎'} Bewerken
                            </button>
                            <button type="button" class="btn-change" id="btn-change-${this.containerId}">
                                ${Icons.refreshCw ? Icons.refreshCw({ size: 14 }) : '↻'} Ander bedrijf
                            </button>
                        </div>
                    </div>
                    
                    <div class="selected-details" id="selected-details-${this.containerId}">
                        <div class="detail-grid">
                            <div class="detail-group">
                                <label>KvK nummer</label>
                                <span class="detail-value" id="detail-kvk-${this.containerId}">-</span>
                            </div>
                            <div class="detail-group">
                                <label>BTW nummer</label>
                                <span class="detail-value" id="detail-btw-${this.containerId}">-</span>
                            </div>
                            <div class="detail-group">
                                <label>Contactpersoon</label>
                                <span class="detail-value" id="detail-contact-${this.containerId}">-</span>
                            </div>
                            <div class="detail-group">
                                <label>E-mail</label>
                                <span class="detail-value" id="detail-email-${this.containerId}">-</span>
                            </div>
                            <div class="detail-group">
                                <label>Telefoon</label>
                                <span class="detail-value" id="detail-telefoon-${this.containerId}">-</span>
                            </div>
                            <div class="detail-group">
                                <label>Plaats</label>
                                <span class="detail-value" id="detail-plaats-${this.containerId}">-</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- EDIT STATE: Bewerk bestaand bedrijf -->
                <div class="selector-edit" id="selector-edit-${this.containerId}" style="display: none;">
                    <div class="edit-header">
                        <div class="edit-title">
                            <span class="edit-icon">${Icons.edit ? Icons.edit({ size: 20, color: '#3b82f6' }) : '✎'}</span>
                            <h4>Bedrijfsgegevens bewerken</h4>
                        </div>
                        <button type="button" class="btn-cancel-edit" id="btn-cancel-edit-${this.containerId}">
                            ${Icons.x ? Icons.x({ size: 14 }) : '×'} Annuleren
                        </button>
                    </div>

                    <div class="edit-form">
                        <!-- Bedrijfsnaam -->
                        <div class="form-group form-group--full">
                            <label for="edit-bedrijfsnaam-${this.containerId}">
                                Bedrijfsnaam <span class="required">*</span>
                            </label>
                            <input type="text" 
                                   id="edit-bedrijfsnaam-${this.containerId}" 
                                   class="form-control"
                                   placeholder="Bijv. Bouwbedrijf De Groot B.V.">
                        </div>

                        <!-- KvK en BTW -->
                        <div class="form-group">
                            <label for="edit-kvk-${this.containerId}">KvK nummer</label>
                            <input type="text" 
                                   id="edit-kvk-${this.containerId}" 
                                   class="form-control"
                                   placeholder="12345678"
                                   maxlength="8">
                        </div>
                        <div class="form-group">
                            <label for="edit-btw-${this.containerId}">BTW nummer</label>
                            <input type="text" 
                                   id="edit-btw-${this.containerId}" 
                                   class="form-control"
                                   placeholder="NL123456789B01"
                                   maxlength="14">
                        </div>

                        <!-- Contact -->
                        <div class="form-group">
                            <label for="edit-contactpersoon-${this.containerId}">Contactpersoon</label>
                            <input type="text" 
                                   id="edit-contactpersoon-${this.containerId}" 
                                   class="form-control"
                                   placeholder="Naam contactpersoon">
                        </div>
                        <div class="form-group">
                            <label for="edit-email-${this.containerId}">E-mail</label>
                            <input type="email" 
                                   id="edit-email-${this.containerId}" 
                                   class="form-control"
                                   placeholder="info@bedrijf.nl">
                        </div>

                        <!-- Telefoon en Plaats -->
                        <div class="form-group">
                            <label for="edit-telefoon-${this.containerId}">Telefoon</label>
                            <input type="tel" 
                                   id="edit-telefoon-${this.containerId}" 
                                   class="form-control"
                                   placeholder="020-1234567">
                        </div>
                        <div class="form-group">
                            <label for="edit-plaats-${this.containerId}">Plaats</label>
                            <input type="text" 
                                   id="edit-plaats-${this.containerId}" 
                                   class="form-control"
                                   placeholder="Bijv. Amsterdam">
                        </div>

                        <!-- Save button -->
                        <div class="form-group form-group--full form-group--actions">
                            <button type="button" class="btn-save-edit" id="btn-save-edit-${this.containerId}">
                                ${Icons.save ? Icons.save({ size: 16 }) : '💾'} Wijzigingen opslaan
                            </button>
                        </div>
                    </div>
                </div>

                <!-- NIEUW STATE: Nieuw bedrijf formulier -->
                <div class="selector-nieuw" id="selector-nieuw-${this.containerId}" style="display: none;">
                    <div class="nieuw-header">
                        <div class="nieuw-title">
                            <span class="nieuw-icon">${Icons.plus ? Icons.plus({ size: 20, color: '#16a34a' }) : '+'}</span>
                            <h4>Nieuw bedrijf aanmaken</h4>
                        </div>
                        <button type="button" class="btn-cancel-nieuw" id="btn-cancel-nieuw-${this.containerId}">
                            ${Icons.x ? Icons.x({ size: 14 }) : '×'} Annuleren
                        </button>
                    </div>

                    <div class="nieuw-form">
                        <!-- Bedrijfsnaam -->
                        <div class="form-group form-group--full">
                            <label for="nieuw-bedrijfsnaam-${this.containerId}">
                                Bedrijfsnaam <span class="required">*</span>
                            </label>
                            <input type="text" 
                                   id="nieuw-bedrijfsnaam-${this.containerId}" 
                                   class="form-control"
                                   placeholder="Bijv. Bouwbedrijf De Groot B.V.">
                            <div class="validation-feedback" id="feedback-bedrijfsnaam-${this.containerId}"></div>
                        </div>

                        <!-- KvK en BTW -->
                        <div class="form-group">
                            <label for="nieuw-kvk-${this.containerId}">KvK nummer</label>
                            <input type="text" 
                                   id="nieuw-kvk-${this.containerId}" 
                                   class="form-control"
                                   placeholder="12345678"
                                   maxlength="8">
                            <div class="validation-feedback" id="feedback-kvk-${this.containerId}"></div>
                        </div>
                        <div class="form-group">
                            <label for="nieuw-btw-${this.containerId}">BTW nummer</label>
                            <input type="text" 
                                   id="nieuw-btw-${this.containerId}" 
                                   class="form-control"
                                   placeholder="NL123456789B01"
                                   maxlength="14">
                            <div class="validation-feedback" id="feedback-btw-${this.containerId}"></div>
                        </div>

                        <!-- Contact -->
                        <div class="form-group">
                            <label for="nieuw-contactpersoon-${this.containerId}">Contactpersoon</label>
                            <input type="text" 
                                   id="nieuw-contactpersoon-${this.containerId}" 
                                   class="form-control"
                                   placeholder="Naam contactpersoon">
                        </div>
                        <div class="form-group">
                            <label for="nieuw-email-${this.containerId}">E-mail</label>
                            <input type="email" 
                                   id="nieuw-email-${this.containerId}" 
                                   class="form-control"
                                   placeholder="info@bedrijf.nl">
                        </div>

                        <!-- Telefoon en Plaats -->
                        <div class="form-group">
                            <label for="nieuw-telefoon-${this.containerId}">Telefoon</label>
                            <input type="tel" 
                                   id="nieuw-telefoon-${this.containerId}" 
                                   class="form-control"
                                   placeholder="020-1234567">
                        </div>
                        <div class="form-group">
                            <label for="nieuw-plaats-${this.containerId}">Plaats</label>
                            <input type="text" 
                                   id="nieuw-plaats-${this.containerId}" 
                                   class="form-control"
                                   placeholder="Bijv. Amsterdam">
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachStyles();
        this.attachEventListeners();
        this.container = container;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        // Search input
        const searchInput = document.getElementById(`bedrijf-search-${this.containerId}`);
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.handleSearch(e.target.value);
                }, 150);
            });

            searchInput.addEventListener('focus', () => {
                this.showDropdown();
            });
        }

        // Change selection button
        const changeBtn = document.getElementById(`btn-change-${this.containerId}`);
        if (changeBtn) {
            changeBtn.addEventListener('click', () => this.changeSelection());
        }

        // Edit bedrijf button
        const editBtn = document.getElementById(`btn-edit-${this.containerId}`);
        if (editBtn) {
            editBtn.addEventListener('click', () => this.startEdit());
        }

        // Cancel edit button
        const cancelEditBtn = document.getElementById(`btn-cancel-edit-${this.containerId}`);
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => this.cancelEdit());
        }

        // Save edit button
        const saveEditBtn = document.getElementById(`btn-save-edit-${this.containerId}`);
        if (saveEditBtn) {
            saveEditBtn.addEventListener('click', () => this.saveEdit());
        }

        // Cancel nieuw button
        const cancelNieuwBtn = document.getElementById(`btn-cancel-nieuw-${this.containerId}`);
        if (cancelNieuwBtn) {
            cancelNieuwBtn.addEventListener('click', () => this.cancelNieuw());
        }

        // Validation listeners for nieuw form
        this.attachValidationListeners();

        // Click outside to close dropdown
        document.addEventListener('click', (e) => {
            const selector = container.querySelector('.bedrijf-selector');
            if (selector && !selector.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    /**
     * Show dropdown with all options
     */
    showDropdown() {
        const searchInput = document.getElementById(`bedrijf-search-${this.containerId}`);
        const query = searchInput?.value || '';

        if (query.length >= 2) {
            this.handleSearch(query);
        } else {
            this.showAllOptions();
        }
    }

    /**
     * Show all bedrijven + nieuw aanmaken optie
     */
    showAllOptions() {
        const resultsDiv = document.getElementById(`bedrijf-results-${this.containerId}`);
        if (!resultsDiv) return;

        const allBedrijven = bedrijvenService.getAllBedrijven();

        let html = '';

        // Nieuw aanmaken optie BOVENAAN
        html += `
            <div class="result-item result-item--create" data-action="create-new">
                <div class="result-icon-wrapper result-icon--green">
                    ${Icons.plus ? Icons.plus({ size: 18, color: '#16a34a' }) : '+'}
                </div>
                <div class="result-info">
                    <div class="result-naam">Nieuw bedrijf aanmaken</div>
                    <div class="result-meta">Voeg een nieuw bedrijf toe aan het systeem</div>
                </div>
                <span class="result-arrow">${Icons.chevronRight ? Icons.chevronRight({ size: 16, color: '#94a3b8' }) : '→'}</span>
            </div>
        `;

        if (allBedrijven.length > 0) {
            html += `<div class="results-divider"><span>of selecteer bestaand bedrijf</span></div>`;

            html += allBedrijven.slice(0, 20).map(bedrijf => this.renderBedrijfItem(bedrijf)).join('');

            if (allBedrijven.length > 20) {
                html += `
                    <div class="results-footer">
                        <span>Typ om te zoeken in ${allBedrijven.length - 20} meer bedrijven...</span>
                    </div>
                `;
            }
        }

        resultsDiv.innerHTML = html;
        this.attachResultListeners(resultsDiv, allBedrijven);
        resultsDiv.style.display = 'block';
    }

    /**
     * Handle search
     */
    handleSearch(query) {
        const resultsDiv = document.getElementById(`bedrijf-results-${this.containerId}`);
        if (!resultsDiv) return;

        if (!query || query.length < 2) {
            this.showAllOptions();
            return;
        }

        const results = bedrijvenService.searchBedrijven(query);

        let html = '';

        // Nieuw aanmaken optie met query
        html += `
            <div class="result-item result-item--create" data-action="create-new" data-query="${query}">
                <div class="result-icon-wrapper result-icon--green">
                    ${Icons.plus ? Icons.plus({ size: 18, color: '#16a34a' }) : '+'}
                </div>
                <div class="result-info">
                    <div class="result-naam">"${query}" als nieuw bedrijf aanmaken</div>
                    <div class="result-meta">Klik om toe te voegen</div>
                </div>
                <span class="result-arrow">${Icons.chevronRight ? Icons.chevronRight({ size: 16, color: '#94a3b8' }) : '→'}</span>
            </div>
        `;

        if (results.length > 0) {
            html += `<div class="results-divider"><span>${results.length} bedrijf${results.length !== 1 ? 'en' : ''} gevonden</span></div>`;
            html += results.map(bedrijf => this.renderBedrijfItem(bedrijf, query)).join('');
        }

        resultsDiv.innerHTML = html;
        this.attachResultListeners(resultsDiv, results);
        resultsDiv.style.display = 'block';
    }

    /**
     * Render a single bedrijf item
     */
    renderBedrijfItem(bedrijf, query = '') {
        const naam = query ? this.highlightMatch(bedrijf.bedrijfsnaam, query) : bedrijf.bedrijfsnaam;
        const meta = [
            bedrijf.kvk_nummer ? `KvK: ${bedrijf.kvk_nummer}` : '',
            bedrijf.plaats || ''
        ].filter(Boolean).join(' • ');

        return `
            <div class="result-item" data-bedrijf-id="${bedrijf.id}">
                <div class="result-avatar" style="background: ${this.getAvatarColor(bedrijf.bedrijfsnaam)}">
                    ${this.getInitials(bedrijf.bedrijfsnaam)}
                </div>
                <div class="result-info">
                    <div class="result-naam">${naam}</div>
                    <div class="result-meta">${meta || 'Geen extra gegevens'}</div>
                </div>
            </div>
        `;
    }

    /**
     * Attach click listeners to results
     */
    attachResultListeners(resultsDiv, bedrijven) {
        // Create new handler
        const createNewItem = resultsDiv.querySelector('[data-action="create-new"]');
        if (createNewItem) {
            createNewItem.addEventListener('click', () => {
                const query = createNewItem.getAttribute('data-query') || '';
                this.startNieuwBedrijf(query);
            });
        }

        // Bedrijf selection handlers
        resultsDiv.querySelectorAll('.result-item:not([data-action])').forEach(item => {
            item.addEventListener('click', () => {
                const bedrijfId = item.getAttribute('data-bedrijf-id');
                const bedrijf = bedrijven.find(b => b.id === bedrijfId);
                if (bedrijf) {
                    this.selectBedrijf(bedrijf);
                }
            });
        });
    }

    /**
     * Select a bedrijf and show details
     */
    selectBedrijf(bedrijf) {
        this.selectedBedrijf = bedrijf;
        this.mode = 'selected';

        // Update avatar
        const avatar = document.getElementById(`selected-avatar-${this.containerId}`);
        if (avatar) {
            avatar.style.background = this.getAvatarColor(bedrijf.bedrijfsnaam);
            avatar.textContent = this.getInitials(bedrijf.bedrijfsnaam);
        }

        // Update name
        document.getElementById(`selected-naam-${this.containerId}`).textContent = bedrijf.bedrijfsnaam;

        // Update all detail fields
        document.getElementById(`detail-kvk-${this.containerId}`).textContent = bedrijf.kvk_nummer || '-';
        document.getElementById(`detail-btw-${this.containerId}`).textContent = bedrijf.btw_nummer || '-';
        document.getElementById(`detail-contact-${this.containerId}`).textContent = bedrijf.contactpersoon || '-';
        document.getElementById(`detail-email-${this.containerId}`).textContent = bedrijf.contact_email || '-';
        document.getElementById(`detail-telefoon-${this.containerId}`).textContent = bedrijf.contact_telefoon || '-';
        document.getElementById(`detail-plaats-${this.containerId}`).textContent = bedrijf.plaats || '-';

        // Show selected state, hide others
        document.getElementById(`selector-search-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-nieuw-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-selected-${this.containerId}`).style.display = 'block';

        this.hideDropdown();

        // Callbacks
        if (this.onSelect) {
            this.onSelect(bedrijf);
        }
        if (this.onChange) {
            this.onChange('selected', bedrijf);
        }
    }

    /**
     * Change selection - go back to search
     */
    changeSelection() {
        this.selectedBedrijf = null;
        this.mode = 'search';

        // Show search state
        document.getElementById(`selector-selected-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-nieuw-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-search-${this.containerId}`).style.display = 'block';

        // Clear and focus search
        const searchInput = document.getElementById(`bedrijf-search-${this.containerId}`);
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }

        if (this.onChange) {
            this.onChange('search', null);
        }
    }

    /**
     * Start nieuw bedrijf form
     */
    startNieuwBedrijf(prefillName = '') {
        this.mode = 'nieuw';
        this.selectedBedrijf = null;

        // Show nieuw form
        document.getElementById(`selector-search-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-selected-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-nieuw-${this.containerId}`).style.display = 'block';

        this.hideDropdown();

        // Prefill name if provided
        if (prefillName) {
            const nameInput = document.getElementById(`nieuw-bedrijfsnaam-${this.containerId}`);
            if (nameInput) {
                nameInput.value = prefillName;
                this.validateFieldRealtime('bedrijfsnaam', prefillName);
            }
        }

        if (this.onChange) {
            this.onChange('nieuw', null);
        }
    }

    /**
     * Cancel nieuw bedrijf
     */
    cancelNieuw() {
        this.mode = 'search';

        // Clear form
        this.clearNieuwForm();

        // Show search
        document.getElementById(`selector-nieuw-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-search-${this.containerId}`).style.display = 'block';

        const searchInput = document.getElementById(`bedrijf-search-${this.containerId}`);
        if (searchInput) {
            searchInput.focus();
        }

        if (this.onChange) {
            this.onChange('search', null);
        }
    }

    /**
     * Clear nieuw form
     */
    clearNieuwForm() {
        const fields = ['bedrijfsnaam', 'kvk', 'btw', 'contactpersoon', 'email', 'telefoon', 'plaats'];
        fields.forEach(field => {
            const input = document.getElementById(`nieuw-${field}-${this.containerId}`);
            if (input) input.value = '';

            const feedback = document.getElementById(`feedback-${field}-${this.containerId}`);
            if (feedback) feedback.innerHTML = '';
        });
    }

    // ============================================
    // EDIT FUNCTIONS
    // ============================================

    /**
     * Start editing the selected bedrijf
     */
    startEdit() {
        if (!this.selectedBedrijf) return;

        this.mode = 'edit';
        this.isEditing = true;

        // Prefill edit form with current values
        const bedrijf = this.selectedBedrijf;
        document.getElementById(`edit-bedrijfsnaam-${this.containerId}`).value = bedrijf.bedrijfsnaam || '';
        document.getElementById(`edit-kvk-${this.containerId}`).value = bedrijf.kvk_nummer || '';
        document.getElementById(`edit-btw-${this.containerId}`).value = bedrijf.btw_nummer || '';
        document.getElementById(`edit-contactpersoon-${this.containerId}`).value = bedrijf.contactpersoon || '';
        document.getElementById(`edit-email-${this.containerId}`).value = bedrijf.contact_email || '';
        document.getElementById(`edit-telefoon-${this.containerId}`).value = bedrijf.contact_telefoon || '';
        document.getElementById(`edit-plaats-${this.containerId}`).value = bedrijf.plaats || '';

        // Show edit form, hide selected view
        document.getElementById(`selector-selected-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-edit-${this.containerId}`).style.display = 'block';

        // Focus on first field
        document.getElementById(`edit-bedrijfsnaam-${this.containerId}`).focus();

        if (this.onChange) {
            this.onChange('edit', bedrijf);
        }
    }

    /**
     * Cancel editing and return to selected view
     */
    cancelEdit() {
        this.mode = 'selected';
        this.isEditing = false;

        // Show selected view, hide edit form
        document.getElementById(`selector-edit-${this.containerId}`).style.display = 'none';
        document.getElementById(`selector-selected-${this.containerId}`).style.display = 'block';

        if (this.onChange) {
            this.onChange('selected', this.selectedBedrijf);
        }
    }

    /**
     * Save edit changes
     */
    async saveEdit() {
        if (!this.selectedBedrijf) return;

        const saveBtn = document.getElementById(`btn-save-edit-${this.containerId}`);
        const originalText = saveBtn.innerHTML;

        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.innerHTML = `${Icons.loader ? Icons.loader({ size: 16, color: '#fff' }) : '⏳'} Opslaan...`;

            // Collect form data
            const updatedData = {
                bedrijfsnaam: document.getElementById(`edit-bedrijfsnaam-${this.containerId}`).value.trim(),
                kvk_nummer: document.getElementById(`edit-kvk-${this.containerId}`).value.trim() || null,
                btw_nummer: document.getElementById(`edit-btw-${this.containerId}`).value.trim() || null,
                contactpersoon: document.getElementById(`edit-contactpersoon-${this.containerId}`).value.trim() || null,
                contact_email: document.getElementById(`edit-email-${this.containerId}`).value.trim() || null,
                contact_telefoon: document.getElementById(`edit-telefoon-${this.containerId}`).value.trim() || null,
                plaats: document.getElementById(`edit-plaats-${this.containerId}`).value.trim() || null
            };

            // Validate required fields
            if (!updatedData.bedrijfsnaam) {
                alert('Bedrijfsnaam is verplicht');
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalText;
                return;
            }

            // Update via service
            const updatedBedrijf = await bedrijvenService.updateBedrijf(this.selectedBedrijf.id, updatedData);

            // Update local reference
            this.selectedBedrijf = { ...this.selectedBedrijf, ...updatedData };

            // Update selected view display
            this.updateSelectedDisplay();

            // Switch back to selected view
            this.mode = 'selected';
            this.isEditing = false;
            document.getElementById(`selector-edit-${this.containerId}`).style.display = 'none';
            document.getElementById(`selector-selected-${this.containerId}`).style.display = 'block';

            // Notify parent
            if (this.onSelect) {
                this.onSelect(this.selectedBedrijf);
            }
            if (this.onChange) {
                this.onChange('selected', this.selectedBedrijf);
            }

            console.log('✅ Bedrijf bijgewerkt:', this.selectedBedrijf.bedrijfsnaam);

        } catch (error) {
            console.error('❌ Error saving bedrijf:', error);
            alert('Fout bij opslaan: ' + (error.message || 'Onbekende fout'));
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    }

    /**
     * Update the selected display with current values
     */
    updateSelectedDisplay() {
        const bedrijf = this.selectedBedrijf;
        if (!bedrijf) return;

        // Update avatar
        const avatar = document.getElementById(`selected-avatar-${this.containerId}`);
        if (avatar) {
            avatar.style.background = this.getAvatarColor(bedrijf.bedrijfsnaam);
            avatar.textContent = this.getInitials(bedrijf.bedrijfsnaam);
        }

        // Update name
        document.getElementById(`selected-naam-${this.containerId}`).textContent = bedrijf.bedrijfsnaam;

        // Update all detail fields
        document.getElementById(`detail-kvk-${this.containerId}`).textContent = bedrijf.kvk_nummer || '-';
        document.getElementById(`detail-btw-${this.containerId}`).textContent = bedrijf.btw_nummer || '-';
        document.getElementById(`detail-contact-${this.containerId}`).textContent = bedrijf.contactpersoon || '-';
        document.getElementById(`detail-email-${this.containerId}`).textContent = bedrijf.contact_email || '-';
        document.getElementById(`detail-telefoon-${this.containerId}`).textContent = bedrijf.contact_telefoon || '-';
        document.getElementById(`detail-plaats-${this.containerId}`).textContent = bedrijf.plaats || '-';
    }

    /**
     * Hide dropdown
     */
    hideDropdown() {
        const resultsDiv = document.getElementById(`bedrijf-results-${this.containerId}`);
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
    }

    /**
     * Attach validation listeners
     */
    attachValidationListeners() {
        const fields = [
            { id: `nieuw-bedrijfsnaam-${this.containerId}`, field: 'bedrijfsnaam' },
            { id: `nieuw-kvk-${this.containerId}`, field: 'kvk_nummer' },
            { id: `nieuw-btw-${this.containerId}`, field: 'btw_nummer' }
        ];

        fields.forEach(({ id, field }) => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('blur', () => {
                    if (input.value.trim()) {
                        this.validateFieldRealtime(field, input.value.trim());
                    }
                });

                input.addEventListener('input', () => {
                    // Trigger onChange for form updates
                    if (this.onChange && this.mode === 'nieuw') {
                        this.onChange('nieuw', this.getNieuwFormData());
                    }
                });
            }
        });
    }

    /**
     * Validate field realtime
     */
    validateFieldRealtime(field, value) {
        const feedbackEl = document.getElementById(`feedback-${field.replace('_', '-')}-${this.containerId}`) ||
            document.getElementById(`feedback-${field.split('_')[0]}-${this.containerId}`);

        if (!feedbackEl) return;

        try {
            // Gebruik validateField voor individuele veld validatie
            const result = bedrijvenService.validateField(field, value);

            if (!result.isValid && result.error) {
                feedbackEl.innerHTML = `
                    <span class="feedback-error">
                        ${Icons.xCircle ? Icons.xCircle({ size: 14, color: '#dc2626' }) : '✗'}
                        ${result.error}
                    </span>
                `;
            } else if (result.warning) {
                feedbackEl.innerHTML = `
                    <span class="feedback-warning">
                        ${Icons.alertTriangle ? Icons.alertTriangle({ size: 14, color: '#f59e0b' }) : '⚠'}
                        ${result.warning}
                    </span>
                `;
            } else if (value && value.trim().length > 0) {
                feedbackEl.innerHTML = `
                    <span class="feedback-success">
                        ${Icons.checkCircle ? Icons.checkCircle({ size: 14, color: '#16a34a' }) : '✓'}
                        Beschikbaar
                    </span>
                `;
            } else {
                feedbackEl.innerHTML = '';
            }
        } catch (error) {
            console.error('Validation error:', error);
            feedbackEl.innerHTML = '';
        }
    }

    /**
     * Get nieuw form data
     */
    getNieuwFormData() {
        return {
            bedrijfsnaam: document.getElementById(`nieuw-bedrijfsnaam-${this.containerId}`)?.value || '',
            kvk_nummer: document.getElementById(`nieuw-kvk-${this.containerId}`)?.value || '',
            btw_nummer: document.getElementById(`nieuw-btw-${this.containerId}`)?.value || '',
            contactpersoon: document.getElementById(`nieuw-contactpersoon-${this.containerId}`)?.value || '',
            contact_email: document.getElementById(`nieuw-email-${this.containerId}`)?.value || '',
            contact_telefoon: document.getElementById(`nieuw-telefoon-${this.containerId}`)?.value || '',
            plaats: document.getElementById(`nieuw-plaats-${this.containerId}`)?.value || ''
        };
    }

    /**
     * Public: Set value programmatically
     */
    setValue(bedrijf) {
        if (bedrijf) {
            this.selectBedrijf(bedrijf);
        } else {
            this.changeSelection();
        }
    }

    /**
     * Public: Get current value
     */
    getValue() {
        if (this.mode === 'selected' && this.selectedBedrijf) {
            return { mode: 'selected', bedrijf: this.selectedBedrijf };
        } else if (this.mode === 'nieuw') {
            return { mode: 'nieuw', data: this.getNieuwFormData() };
        }
        return { mode: 'search', bedrijf: null };
    }

    /**
     * Public: Get mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Public: Set mode programmatically
     */
    setMode(mode) {
        if (mode === 'nieuw') {
            this.startNieuwBedrijf();
        } else if (mode === 'search') {
            this.changeSelection();
        } else if (mode === 'edit' && this.selectedBedrijf) {
            this.startEdit();
        }
        // 'selected' mode kan alleen via setValue()
    }

    /**
     * Public: Check if valid
     */
    isValid() {
        if (this.mode === 'selected' && this.selectedBedrijf) {
            return true;
        }
        if (this.mode === 'nieuw') {
            const data = this.getNieuwFormData();
            return data.bedrijfsnaam.trim().length > 0;
        }
        return false;
    }

    /**
     * Public: Validate form (for nieuw bedrijf mode)
     * Returns {isValid: boolean, error?: string}
     */
    validateForm() {
        if (this.mode !== 'nieuw') {
            return { isValid: true };
        }

        const data = this.getNieuwFormData();

        // Bedrijfsnaam is verplicht
        if (!data.bedrijfsnaam || data.bedrijfsnaam.trim().length === 0) {
            return {
                isValid: false,
                error: 'Bedrijfsnaam is verplicht'
            };
        }

        // Check duplicaten
        const duplicateCheck = bedrijvenService.checkDuplicaat(data);
        if (!duplicateCheck.isValid) {
            const errorMsg = duplicateCheck.errors.map(e => e.message).join(', ');
            return {
                isValid: false,
                error: errorMsg
            };
        }

        return { isValid: true };
    }

    /**
     * Public: Get form data (for nieuw bedrijf mode)
     * Alias for getNieuwFormData for TenderAanmaken compatibility
     */
    getFormData() {
        return this.getNieuwFormData();
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    getInitials(name) {
        if (!name) return '?';
        return name.split(' ')
            .filter(word => word.length > 0)
            .slice(0, 2)
            .map(word => word[0].toUpperCase())
            .join('');
    }

    getAvatarColor(name) {
        if (!name) return '#94a3b8';
        const colors = [
            '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
            '#ef4444', '#ec4899', '#6366f1', '#14b8a6'
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    highlightMatch(text, query) {
        if (!query || !text) return text;
        const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // ============================================
    // STYLES
    // ============================================

    attachStyles() {
        if (document.getElementById('bedrijf-selector-styles-v3')) return;

        const style = document.createElement('style');
        style.id = 'bedrijf-selector-styles-v3';
        style.textContent = `
            .bedrijf-selector {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            /* ================================
               SEARCH STATE
               ================================ */
            .search-wrapper {
                position: relative;
            }

            .search-input-container {
                position: relative;
                display: flex;
                align-items: center;
            }

            .search-icon {
                position: absolute;
                left: 14px;
                pointer-events: none;
                display: flex;
            }

            .bedrijf-search {
                width: 100%;
                padding: 14px 14px 14px 44px !important;
                font-size: 15px !important;
                border: 2px solid #e2e8f0 !important;
                border-radius: 12px !important;
                transition: all 0.2s ease !important;
                background: #f8fafc !important;
            }

            .bedrijf-search:focus {
                background: white !important;
                border-color: #8b5cf6 !important;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1) !important;
                outline: none !important;
            }

            .bedrijf-search::placeholder {
                color: #94a3b8;
            }

            /* ================================
               DROPDOWN RESULTS
               ================================ */
            .search-results {
                display: none;
                position: absolute;
                top: calc(100% + 6px);
                left: 0;
                right: 0;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
                max-height: 400px;
                overflow-y: auto;
                z-index: 1000;
            }

            .result-item {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 18px;
                cursor: pointer;
                transition: background 0.1s ease;
                border-bottom: 1px solid #f1f5f9;
            }

            .result-item:last-child {
                border-bottom: none;
            }

            .result-item:hover {
                background: #f8fafc;
            }

            .result-item--create {
                background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
                border-bottom: 2px solid #d1fae5 !important;
            }

            .result-item--create:hover {
                background: linear-gradient(135deg, #dcfce7 0%, #d1fae5 100%);
            }

            .result-icon-wrapper {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .result-icon--green {
                background: #dcfce7;
                border: 2px solid #bbf7d0;
            }

            .result-avatar {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 600;
                font-size: 15px;
                flex-shrink: 0;
            }

            .result-info {
                flex: 1;
                min-width: 0;
            }

            .result-naam {
                font-weight: 600;
                font-size: 15px;
                color: #0f172a;
            }

            .result-naam mark {
                background: #fef08a;
                color: inherit;
                padding: 0 3px;
                border-radius: 3px;
            }

            .result-meta {
                font-size: 13px;
                color: #64748b;
                margin-top: 3px;
            }

            .result-arrow {
                opacity: 0.5;
            }

            .results-divider {
                padding: 10px 18px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }

            .results-divider span {
                font-size: 12px;
                color: #64748b;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .results-footer {
                padding: 12px 18px;
                background: #f8fafc;
                text-align: center;
            }

            .results-footer span {
                font-size: 13px;
                color: #94a3b8;
            }

            /* ================================
               SELECTED STATE
               ================================ */
            .selector-selected {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 2px solid #e2e8f0;
                border-radius: 16px;
                overflow: hidden;
            }

            .selected-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: white;
                border-bottom: 1px solid #e2e8f0;
            }

            .selected-title {
                display: flex;
                align-items: center;
                gap: 14px;
            }

            .selected-avatar {
                width: 48px;
                height: 48px;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 700;
                font-size: 16px;
            }

            .selected-name-wrapper h4 {
                margin: 0;
                font-size: 17px;
                font-weight: 600;
                color: #0f172a;
            }

            .selected-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                margin-top: 4px;
                font-size: 12px;
                color: #16a34a;
                font-weight: 500;
            }

            .btn-change {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                color: #64748b;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .btn-change:hover {
                background: #f8fafc;
                border-color: #cbd5e1;
                color: #0f172a;
            }

            .selected-details {
                padding: 20px;
            }

            .detail-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
            }

            .detail-group {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .detail-group label {
                font-size: 12px;
                font-weight: 500;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .detail-value {
                font-size: 15px;
                color: #0f172a;
                font-weight: 500;
            }

            .selected-actions {
                display: flex;
                gap: 8px;
            }

            .btn-edit {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                background: #eff6ff;
                border: 1px solid #bfdbfe;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                color: #2563eb;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .btn-edit:hover {
                background: #dbeafe;
                border-color: #93c5fd;
            }

            /* ================================
               EDIT STATE
               ================================ */
            .selector-edit {
                background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
                border: 2px solid #93c5fd;
                border-radius: 16px;
                overflow: hidden;
            }

            .edit-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: white;
                border-bottom: 1px solid #bfdbfe;
            }

            .edit-title {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .edit-icon {
                width: 40px;
                height: 40px;
                background: #dbeafe;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .edit-title h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #1e40af;
            }

            .btn-cancel-edit {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                background: white;
                border: 1px solid #fecaca;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                color: #dc2626;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .btn-cancel-edit:hover {
                background: #fef2f2;
            }

            .edit-form {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
                padding: 20px;
                background: white;
            }

            .edit-form .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .edit-form .form-group--full {
                grid-column: span 2;
            }

            .edit-form .form-group--actions {
                display: flex;
                justify-content: flex-end;
                padding-top: 8px;
            }

            .edit-form label {
                font-size: 13px;
                font-weight: 500;
                color: #374151;
            }

            .edit-form .required {
                color: #dc2626;
            }

            .edit-form .form-control {
                padding: 12px 14px;
                font-size: 15px;
                border: 2px solid #e2e8f0;
                border-radius: 10px;
                transition: all 0.2s ease;
            }

            .edit-form .form-control:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                outline: none;
            }

            .btn-save-edit {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 12px 24px;
                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                border: none;
                border-radius: 10px;
                font-size: 15px;
                font-weight: 600;
                color: white;
                cursor: pointer;
                transition: all 0.15s ease;
                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
            }

            .btn-save-edit:hover {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
            }

            .btn-save-edit:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                transform: none;
            }

            /* ================================
               NIEUW STATE
               ================================ */
            .selector-nieuw {
                background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
                border: 2px solid #bbf7d0;
                border-radius: 16px;
                overflow: hidden;
            }

            .nieuw-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 20px;
                background: white;
                border-bottom: 1px solid #d1fae5;
            }

            .nieuw-title {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .nieuw-icon {
                width: 40px;
                height: 40px;
                background: #dcfce7;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .nieuw-title h4 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: #166534;
            }

            .btn-cancel-nieuw {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                background: white;
                border: 1px solid #fecaca;
                border-radius: 10px;
                font-size: 14px;
                font-weight: 500;
                color: #dc2626;
                cursor: pointer;
                transition: all 0.15s ease;
            }

            .btn-cancel-nieuw:hover {
                background: #fef2f2;
            }

            .nieuw-form {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
                padding: 20px;
                background: white;
            }

            .nieuw-form .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .nieuw-form .form-group--full {
                grid-column: span 2;
            }

            .nieuw-form label {
                font-size: 13px;
                font-weight: 500;
                color: #374151;
            }

            .nieuw-form .required {
                color: #dc2626;
            }

            .nieuw-form .form-control {
                padding: 12px 14px;
                font-size: 15px;
                border: 2px solid #e2e8f0;
                border-radius: 10px;
                transition: all 0.2s ease;
            }

            .nieuw-form .form-control:focus {
                border-color: #16a34a;
                box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
                outline: none;
            }

            .validation-feedback {
                min-height: 20px;
            }

            .feedback-success {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #16a34a;
            }

            .feedback-warning {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #f59e0b;
            }

            .feedback-error {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                color: #dc2626;
            }

            /* ================================
               RESPONSIVE
               ================================ */
            @media (max-width: 640px) {
                .detail-grid {
                    grid-template-columns: 1fr;
                }
                
                .nieuw-form,
                .edit-form {
                    grid-template-columns: 1fr;
                }
                
                .nieuw-form .form-group--full,
                .edit-form .form-group--full {
                    grid-column: span 1;
                }

                .selected-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 12px;
                }

                .selected-actions {
                    width: 100%;
                }

                .selected-actions .btn-edit,
                .selected-actions .btn-change {
                    flex: 1;
                    justify-content: center;
                }
            }

            /* Scrollbar styling */
            .search-results::-webkit-scrollbar {
                width: 8px;
            }

            .search-results::-webkit-scrollbar-track {
                background: #f1f5f9;
            }

            .search-results::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 4px;
            }

            .search-results::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }
        `;

        document.head.appendChild(style);
    }
}

export default BedrijfSelector;