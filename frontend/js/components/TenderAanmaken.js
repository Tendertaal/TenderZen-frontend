/**
 * TenderAanmaken Component v3.4.1
 * TenderZen Design System
 * 
 * CHANGELOG v3.4.1:
 * - ⭐ FIX: URL velden type="url" → type="text" (voorkomt browser validatie blokkade)
 * 
 * CHANGELOG v3.4.0:
 * - ⭐ Tenderbureau als apart inklapbaar blok direct onder Tender Informatie
 * - ⭐ "Inschrijvend bedrijf" hernoemd (was "Inschrijver & Bureau")
 * - ⭐ Verbeterde logische volgorde: Info → Bureau → Go-No-Go → Bedrijf → Team → ...
 * 
 * CHANGELOG v3.3.0:
 * - ⭐ BedrijfSelector integratie met autocomplete en nieuw bedrijf aanmaken
 * - ⭐ Real-time duplicaat validatie (KvK, BTW, bedrijfsnaam)
 * - ⭐ Bedrijf wordt nu gekoppeld via bedrijf_id i.p.v. losse velden
 * - ⭐ Bestaand bedrijf selecteren OF nieuw aanmaken in één flow
 * 
 * CHANGELOG v3.2.1:
 * - ⭐ FIX: Secties uitklappen vóór validatie (browser kan hidden required velden niet focussen)
 * 
 * CHANGELOG v3.2:
 * - ⭐ Alle secties inklapbaar behalve "Tender Informatie"
 * - ⭐ Secties standaard ingeklapt voor compacte weergave
 * 
 * CHANGELOG v3.1:
 * - ⭐ Super-admin kan tenderbureau wijzigen via dropdown
 * - ⭐ Normale users zien readonly veld met actief bureau
 * 
 * CHANGELOG v3.0:
 * - ⭐ Nieuwe volgorde secties (belangrijkste eerst)
 * - ⭐ Tenderbureau veld toegevoegd
 * - ⭐ "Aanbestedende dienst" → "Opdrachtgever"
 * - ⭐ Bedrijfsgegevens vereenvoudigd en collapsible
 * - ⭐ Styling consistent met minimaal card design
 * - ⭐ Verbeterde UX met betere groepering
 * - ⭐ Tender ID zichtbaar bij bewerken (klikbaar om te kopiëren)
 */

import { faseService } from '../services/FaseService.js';
import { BedrijfSelector } from './BedrijfSelector.js';
import { bedrijvenService } from '../services/Bedrijvenservice.js';

// Referentie naar globale Icons (geladen via icons.js)
const Icons = window.Icons || {};

export class TenderAanmaken {
    constructor() {
        this.isOpen = false;
        this.modal = null;

        // Edit mode state
        this.editMode = false;
        this.currentTender = null;

        // State
        this.currentFase = 'acquisitie';
        this.isConcept = false;

        // ⭐ Super admin state - kan bureau wijzigen
        this.isSuperAdmin = false;
        this.allBureaus = [];

        // ⭐ v3.3: BedrijfSelector instance
        this.bedrijfSelector = null;
        this.selectedBedrijfId = null;

        // ⭐ v3.4: Alle secties standaard ingeklapt (tenderbureau toegevoegd)
        this.collapsedSections = {
            'tenderbureau': true,  // ⭐ v3.4: NIEUW
            'gonogo': true,
            'partijen': true,
            'team': true,
            'timeline': true,
            'classificatie': true,
            'financieel': true,
            'documenten': true,
            'eisen': true,
            'risico': true,
            'bedrijfsgegevens-extra': true
        };

        // Callbacks
        this.onSave = null;    // Voor nieuwe tenders
        this.onUpdate = null;  // Voor bestaande tenders
    }

    /**
     * ⭐ Set super admin status - enables bureau selection
     */
    setSuperAdmin(isSuperAdmin) {
        this.isSuperAdmin = isSuperAdmin;
        console.log('🔑 TenderAanmaken super-admin mode:', isSuperAdmin);
    }

    /**
     * Render the modal
     */
    render() {
        this.modal = document.createElement('div');
        this.modal.className = 'tender-modal';
        this.modal.id = 'tender-aanmaken-modal';
        this.modal.style.display = 'none';

        this.modal.innerHTML = `
            <div class="modal-overlay" id="modal-overlay"></div>
            <div class="modal-container">
                <!-- Header -->
                <div class="modal-header">
                    <div class="modal-header-content">
                        <span class="modal-icon" id="modal-title-icon">
                            ${Icons.edit ? Icons.edit({ size: 24, color: '#8b5cf6' }) : '✏️'}
                        </span>
                        <span id="modal-title-text">Nieuwe Tender</span>
                    </div>
                    <button class="modal-close" id="modal-close" type="button">
                        ${Icons.close ? Icons.close({ size: 20 }) : '×'}
                    </button>
                </div>

                <!-- Content -->
                <div class="modal-content">
                    <form id="tender-form">
                        ${this.renderTenderKern()}
                        ${this.renderTenderbureau()}
                        ${this.renderGoNoGo()}
                        ${this.renderInschrijvendBedrijf()}
                        ${this.renderTeamWorkload()}
                        ${this.renderTimeline()}
                        ${this.renderClassificatie()}
                        ${this.renderFinancieel()}
                        ${this.renderDocumenten()}
                        ${this.renderEisen()}
                        ${this.renderRisicoStrategie()}
                    </form>
                </div>

                <!-- Footer -->
                <div class="modal-footer">
                    <div class="footer-left">
                        <button type="button" class="btn btn-danger" id="btn-delete" style="display: none;">
                            ${Icons.trash ? Icons.trash({ size: 16, color: '#ffffff' }) : ''} 
                            <span>Verwijderen</span>
                        </button>
                    </div>
                    <div class="footer-right">
                        <button type="button" class="btn btn-secondary" id="btn-cancel">
                            Annuleren
                        </button>
                        <button type="button" class="btn btn-primary" id="btn-save">
                            ${Icons.check ? Icons.check({ size: 16, color: '#ffffff' }) : ''} 
                            <span id="btn-save-text">Opslaan</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.attachStyles();
        this.attachEventListeners();
        return this.modal;
    }

    /**
     * Sectie 1: Tender Kern (belangrijkste info) - NIET INKLAPBAAR
     */
    renderTenderKern() {
        return `
            <div class="form-section form-section--primary">
                <h3 class="section-title">
                    <span class="section-icon">
                        ${Icons.fileText ? Icons.fileText({ size: 18, color: '#8b5cf6' }) : ''}
                    </span>
                    Tender Informatie
                    <span id="tender-id-display" style="margin-left: auto; font-size: 12px; font-weight: normal; color: #9ca3af; font-family: monospace;"></span>
                </h3>
                
                <div class="form-row">
                    <div class="form-group form-group--large">
                        <label for="tender-naam">
                            Tender naam
                            <span class="required">*</span>
                        </label>
                        <input type="text" id="tender-naam" class="form-control form-control--prominent" 
                               placeholder="Bijv. Renovatie Gemeentehuis Utrecht" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="tender-aanbestedende-dienst">
                            Aanbestedende dienst
                            <span class="required">*</span>
                        </label>
                        <input type="text" id="tender-aanbestedende-dienst" class="form-control" 
                               placeholder="Bijv. Gemeente Utrecht" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="tender-locatie">Locatie project</label>
                        <input type="text" id="tender-locatie" class="form-control" 
                               placeholder="Bijv. Utrecht Centrum">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="tender-fase">
                            Fase
                            <span class="required">*</span>
                        </label>
                        <select id="tender-fase" class="form-control" required>
                            <option value="acquisitie">Acquisitie</option>
                            <option value="inschrijvingen">Inschrijvingen</option>
                            <option value="ingediend">Ingediend</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="tender-fase-status">Status</label>
                        <select id="tender-fase-status" class="form-control">
                            <option value="">-- Selecteer status --</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label for="tender-omschrijving">Korte omschrijving</label>
                    <textarea id="tender-omschrijving" class="form-control" rows="2" 
                              placeholder="Korte samenvatting van de tender..."></textarea>
                </div>
            </div>
        `;
    }

    /**
     * ⭐ v3.4 NIEUW: Sectie 2: Tenderbureau (INKLAPBAAR)
     * Bureau dat deze tender begeleidt
     */
    renderTenderbureau() {
        // ⭐ Super-admin krijgt dropdown, anderen readonly veld
        const bureauField = this.isSuperAdmin
            ? `
                <select id="tender-tenderbureau-select" class="form-control">
                    <option value="">Laden...</option>
                </select>
                <span class="form-hint">Als super-admin kun je het bureau wijzigen</span>
            `
            : `
                <div class="form-control form-control--readonly" id="tender-tenderbureau-display">
                    <span id="active-bureau-name">Laden...</span>
                </div>
                <span class="form-hint">Automatisch gekoppeld aan het actieve bureau</span>
            `;

        return `
            <div class="form-section form-section--collapsible" id="section-tenderbureau">
                <button type="button" class="section-toggle" data-target="tenderbureau-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.building ? Icons.building({ size: 18, color: '#8b5cf6' }) : '🏢'}
                        </span>
                        Tenderbureau
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="tenderbureau-content">
                    <div class="form-group">
                        <label for="tender-tenderbureau-select">Bureau dat deze tender begeleidt</label>
                        ${bureauField}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie: Go/No-Go Beslissing (INKLAPBAAR)
     */
    renderGoNoGo() {
        return `
            <div class="form-section form-section--collapsible form-section--decision" id="section-gonogo">
                <button type="button" class="section-toggle" data-target="gonogo-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.shieldCheck ? Icons.shieldCheck({ size: 18, color: '#10b981' }) : Icons.check ? Icons.check({ size: 18, color: '#10b981' }) : ''}
                        </span>
                        Go/No-Go Beslissing
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="gonogo-content">
                    <div class="form-group">
                        <div class="status-buttons" id="status-buttons">
                            <button type="button" class="status-btn status-btn--pending active" data-value="pending">
                                ${Icons.clock ? Icons.clock({ size: 16 }) : ''}
                                <span>Pending</span>
                            </button>
                            <button type="button" class="status-btn status-btn--go" data-value="go">
                                ${Icons.check ? Icons.check({ size: 16 }) : ''}
                                <span>Go</span>
                            </button>
                            <button type="button" class="status-btn status-btn--maybe" data-value="maybe">
                                ${Icons.alertCircle ? Icons.alertCircle({ size: 16 }) : ''}
                                <span>Maybe</span>
                            </button>
                            <button type="button" class="status-btn status-btn--nogo" data-value="no-go">
                                ${Icons.x ? Icons.x({ size: 16 }) : ''}
                                <span>No-Go</span>
                            </button>
                        </div>
                        <input type="hidden" id="tender-status" value="pending">
                    </div>
                    
                    <div class="form-group">
                        <label for="tender-go-nogo-opmerkingen">Opmerkingen</label>
                        <textarea id="tender-go-nogo-opmerkingen" class="form-control" rows="2" 
                                  placeholder="Onderbouwing van de beslissing..."></textarea>
                        <span class="form-hint">Waarom wel/niet inschrijven? Belangrijke overwegingen.</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * ⭐ v3.4: Sectie 4: Inschrijvend bedrijf (was "Inschrijver & Bureau")
     * Alleen het inschrijvend bedrijf, tenderbureau is nu apart
     */
    renderInschrijvendBedrijf() {
        return `
            <div class="form-section form-section--collapsible" id="section-partijen">
                <button type="button" class="section-toggle" data-target="partijen-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.hardhat ? Icons.hardhat({ size: 18, color: '#f59e0b' }) : Icons.users ? Icons.users({ size: 18, color: '#f59e0b' }) : ''}
                        </span>
                        Inschrijvend bedrijf
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="partijen-content">
                    <div class="form-row">
                        <!-- ⭐ v3.3: BedrijfSelector container -->
                        <div class="form-group form-group--full">
                            <label>
                                Inschrijvend bedrijf
                                <span class="required">*</span>
                            </label>
                            <div id="bedrijf-selector-container"></div>
                            <input type="hidden" id="tender-bedrijf-id" value="">
                        </div>
                    </div>


                    <!-- Hidden fields for form data (populated from BedrijfSelector) -->
                    <input type="hidden" id="tender-bedrijfsnaam" value="">
                    <input type="hidden" id="tender-kvk-nummer" value="">
                    <input type="hidden" id="tender-btw-nummer" value="">
                    <input type="hidden" id="tender-contactpersoon" value="">
                    <input type="hidden" id="tender-contact-email" value="">
                    <input type="hidden" id="tender-contact-telefoon" value="">
                    <input type="hidden" id="tender-bedrijfs-plaats" value="">
                </div>
            </div>
        `;
    }

    /**
     * Sectie 3: Team & Workload (INKLAPBAAR)
     */
    renderTeamWorkload() {
        return `
            <div class="form-section form-section--collapsible" id="section-team">
                <button type="button" class="section-toggle" data-target="team-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.users ? Icons.users({ size: 18, color: '#3b82f6' }) : ''}
                        </span>
                        Team & Workload
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="team-content">
                    <!-- Team Builder -->
                    <div class="team-builder">
                        <div class="team-builder-header">
                            <span class="col-functie">Functie</span>
                            <span class="col-naam">Teamlid</span>
                            <span class="col-uren">Uren</span>
                            <span class="col-actie"></span>
                        </div>
                        <div class="team-builder-rows" id="team-rows">
                            <!-- Dynamisch gevuld -->
                        </div>
                        <div class="team-builder-footer">
                            <button type="button" class="btn-add-row" id="btn-add-team-row">
                                ${Icons.plus ? Icons.plus({ size: 16 }) : '+'}
                                <span>Teamlid toevoegen</span>
                            </button>
                            <div class="team-totaal">
                                <span>Totaal:</span>
                                <strong id="team-totaal-uren">0</strong>
                                <span>uur</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie 4: Timeline (INKLAPBAAR)
     */
    renderTimeline() {
        return `
            <div class="form-section form-section--collapsible" id="section-timeline">
                <button type="button" class="section-toggle" data-target="timeline-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.calendarView ? Icons.calendarView({ size: 18, color: '#ef4444' }) : ''}
                        </span>
                        Timeline
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="timeline-content">
                    <!-- Belangrijkste deadline prominent -->
                    <div class="form-row">
                        <div class="form-group form-group--deadline">
                            <label for="tender-deadline-indiening">
                                ${Icons.zap ? Icons.zap({ size: 14, color: '#dc2626' }) : ''}
                                Deadline Indiening
                                <span class="required">*</span>
                            </label>
                            <input type="date" id="tender-deadline-indiening" class="form-control form-control--deadline" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="tender-interne-deadline">Interne Deadline</label>
                            <input type="date" id="tender-interne-deadline" class="form-control">
                        </div>
                    </div>

                    <div class="timeline-grid">
                        <div class="timeline-item">
                            <label for="tender-publicatie-datum">Publicatie</label>
                            <input type="date" id="tender-publicatie-datum" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-schouw-datum">Schouw</label>
                            <input type="date" id="tender-schouw-datum" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-nvi1-datum">NVI 1</label>
                            <input type="date" id="tender-nvi1-datum" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-nvi2-datum">NVI 2</label>
                            <input type="date" id="tender-nvi2-datum" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-presentatie-datum">Presentatie</label>
                            <input type="date" id="tender-presentatie-datum" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-voorlopige-gunning">Voorl. Gunning</label>
                            <input type="date" id="tender-voorlopige-gunning" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-definitieve-gunning">Def. Gunning</label>
                            <input type="date" id="tender-definitieve-gunning" class="form-control">
                        </div>
                        
                        <div class="timeline-item">
                            <label for="tender-start-uitvoering">Start Uitvoering</label>
                            <input type="date" id="tender-start-uitvoering" class="form-control">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie 5: Classificatie (INKLAPBAAR)
     */
    renderClassificatie() {
        return `
            <div class="form-section form-section--collapsible" id="section-classificatie">
                <button type="button" class="section-toggle" data-target="classificatie-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.filter ? Icons.filter({ size: 18, color: '#f59e0b' }) : ''}
                        </span>
                        Classificatie
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="classificatie-content">
                    <div class="form-row form-row--three">
                        <div class="form-group">
                            <label for="tender-type">Type</label>
                            <select id="tender-type" class="form-control">
                                <option value="">-- Selecteer --</option>
                                <option value="bouw">Bouw</option>
                                <option value="infra">Infrastructuur</option>
                                <option value="onderhoud">Onderhoud</option>
                                <option value="ict">ICT</option>
                                <option value="advies">Advies</option>
                                <option value="overig">Overig</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="tender-aanbestedingsprocedure">Procedure</label>
                            <select id="tender-aanbestedingsprocedure" class="form-control">
                                <option value="">-- Selecteer --</option>
                                <option value="europees_openbaar">Europees Openbaar</option>
                                <option value="nationaal_openbaar">Nationaal Openbaar</option>
                                <option value="niet_openbaar">Niet-openbaar</option>
                                <option value="meervoudig_onderhands">Meervoudig Onderhands</option>
                                <option value="enkelvoudig_onderhands">Enkelvoudig Onderhands</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="tender-tender-nummer">Tender nummer</label>
                            <input type="text" id="tender-tender-nummer" class="form-control" 
                                   placeholder="Auto of handmatig">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="tender-cpv-codes">CPV code(s)</label>
                        <input type="text" id="tender-cpv-codes" class="form-control" 
                               placeholder="45000000, 45111200">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie 6: Financieel (INKLAPBAAR)
     */
    renderFinancieel() {
        return `
            <div class="form-section form-section--collapsible" id="section-financieel">
                <button type="button" class="section-toggle" data-target="financieel-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.barChart ? Icons.barChart({ size: 18, color: '#10b981' }) : ''}
                        </span>
                        Financieel
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="financieel-content">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tender-geraamde-waarde">Geraamde waarde</label>
                            <div class="input-with-prefix">
                                <span class="input-prefix">€</span>
                                <input type="number" id="tender-geraamde-waarde" class="form-control" 
                                       placeholder="160.000" step="1000" min="0">
                            </div>
                            <span class="form-hint">Geschatte opdrachtwaarde</span>
                        </div>
                        
                        <div class="form-group">
                            <label for="tender-opdracht-duur">Duur opdracht</label>
                            <div class="input-with-suffix">
                                <input type="number" id="tender-opdracht-duur" class="form-control" 
                                       placeholder="12" min="0">
                                <select id="tender-opdracht-duur-eenheid" class="input-suffix-select">
                                    <option value="maanden">maanden</option>
                                    <option value="jaren">jaren</option>
                                    <option value="weken">weken</option>
                                </select>
                            </div>
                            <span class="form-hint">Looptijd van het contract</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie 7: Documenten & Links (INKLAPBAAR)
     * ⭐ v3.4.1 FIX: type="url" → type="text" (voorkomt browser validatie blokkade)
     */
    renderDocumenten() {
        return `
            <div class="form-section form-section--collapsible" id="section-documenten">
                <button type="button" class="section-toggle" data-target="documenten-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.fileText ? Icons.fileText({ size: 18, color: '#6366f1' }) : ''}
                        </span>
                        Documenten & Links
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="documenten-content">
                    <div class="form-row">
                        <div class="form-group">
                            <label for="tender-platform-naam">Platform</label>
                            <select id="tender-platform-naam" class="form-control">
                                <option value="">-- Selecteer --</option>
                                <option value="TenderNed">TenderNed</option>
                                <option value="Negometrix">Negometrix</option>
                                <option value="Mercell">Mercell</option>
                                <option value="CTM">CTM</option>
                                <option value="Overig">Overig</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label for="tender-tenderned-url">Platform URL</label>
                            <input type="text" id="tender-tenderned-url" class="form-control" 
                                   placeholder="https://www.tenderned.nl/...">
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="tender-documenten-link">Tender documenten</label>
                            <input type="text" id="tender-documenten-link" class="form-control" 
                                   placeholder="Link naar documenten">
                        </div>
                        
                        <div class="form-group">
                            <label for="tender-interne-map-link">Interne map</label>
                            <input type="text" id="tender-interne-map-link" class="form-control" 
                                   placeholder="SharePoint / Google Drive">
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie 8: Eisen (INKLAPBAAR - was al)
     */
    renderEisen() {
        return `
            <div class="form-section form-section--collapsible" id="section-eisen">
                <button type="button" class="section-toggle" data-target="eisen-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.checkCircle ? Icons.checkCircle({ size: 18, color: '#06b6d4' }) : ''}
                        </span>
                        Inschrijvingseisen
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="eisen-content">
                    <div class="form-group">
                        <label>Vereiste certificeringen</label>
                        <div class="checkbox-grid">
                            <label class="checkbox-label">
                                <input type="checkbox" name="certificering" value="ISO9001">
                                <span>ISO 9001</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="certificering" value="ISO14001">
                                <span>ISO 14001</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="certificering" value="VCA">
                                <span>VCA</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="certificering" value="CO2">
                                <span>CO2 Ladder</span>
                            </label>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label for="tender-minimale-omzet">Min. omzet (€)</label>
                            <input type="number" id="tender-minimale-omzet" class="form-control" 
                                   placeholder="1.000.000" step="10000">
                        </div>
                        
                        <div class="form-group">
                            <label for="tender-aantal-referenties">Referenties vereist</label>
                            <input type="number" id="tender-aantal-referenties" class="form-control" 
                                   placeholder="3" min="0">
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="tender-eisen-notities">Overige eisen</label>
                        <textarea id="tender-eisen-notities" class="form-control" rows="2" 
                                  placeholder="Eventuele extra eisen..."></textarea>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Sectie 9: Risico & Strategie (INKLAPBAAR - was al)
     */
    renderRisicoStrategie() {
        return `
            <div class="form-section form-section--collapsible" id="section-risico">
                <button type="button" class="section-toggle" data-target="risico-content">
                    <h3 class="section-title">
                        <span class="section-icon">
                            ${Icons.alertCircle ? Icons.alertCircle({ size: 18, color: '#f97316' }) : ''}
                        </span>
                        Risico & Strategie
                    </h3>
                    <span class="toggle-icon">
                        ${Icons.chevronDown ? Icons.chevronDown({ size: 20 }) : '▼'}
                    </span>
                </button>
                
                <div class="section-content collapsed" id="risico-content">
                    <div class="form-group">
                        <label for="tender-risicos">Belangrijkste risico's</label>
                        <textarea id="tender-risicos" class="form-control" rows="2" 
                                  placeholder="Korte deadline, veel concurrentie..."></textarea>
                    </div>

                    <div class="form-group">
                        <label for="tender-concurrentie-analyse">Concurrentie</label>
                        <textarea id="tender-concurrentie-analyse" class="form-control" rows="2" 
                                  placeholder="Wie zijn de concurrenten?"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="tender-usps">USP's (Waarom wij?)</label>
                        <textarea id="tender-usps" class="form-control" rows="2" 
                                  placeholder="Onze sterke punten..."></textarea>
                    </div>

                    <div class="form-group">
                        <label for="tender-strategie-notities">Strategie notities</label>
                        <textarea id="tender-strategie-notities" class="form-control" rows="2" 
                                  placeholder="Algemene strategie..."></textarea>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Attach inline styles (voor modal-specifieke styling)
     */
    attachStyles() {
        if (document.getElementById('tender-modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'tender-modal-styles';
        styles.textContent = `
            /* ============================================
               TENDER MODAL - BASE
               ============================================ */
            
            .tender-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(4px);
            }
            
            .modal-container {
                position: relative;
                background: white;
                border-radius: 16px;
                width: 90%;
                max-width: 800px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }
            
            /* ============================================
               MODAL HEADER
               ============================================ */
            
            .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 20px 24px;
                border-bottom: 1px solid #e2e8f0;
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border-radius: 16px 16px 0 0;
            }
            
            .modal-header-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .modal-icon {
                width: 44px;
                height: 44px;
                border-radius: 12px;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
            }
            
            #modal-title-text {
                font-size: 20px;
                font-weight: 600;
                color: #0f172a;
            }
            
            .modal-close {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                border: none;
                background: transparent;
                color: #64748b;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
            }
            
            .modal-close:hover {
                background: #fee2e2;
                color: #dc2626;
            }
            
            /* ============================================
               MODAL CONTENT
               ============================================ */
            
            .modal-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }
            
            /* ============================================
               FORM SECTIONS
               ============================================ */
            
            .form-section {
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 16px;
            }
            
            .form-section--primary {
                border-color: #c7d2fe;
                background: linear-gradient(135deg, #faf5ff 0%, #f5f3ff 100%);
            }
            
            .form-section--decision {
                border-color: #bbf7d0;
            }
            
            .form-section--decision .section-toggle:hover {
                background: #f0fdf4;
            }
            
            .form-section--collapsible {
                padding: 0;
            }
            
            .section-title {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 15px;
                font-weight: 600;
                color: #1e293b;
                margin: 0 0 16px 0;
            }
            
            .form-section--collapsible .section-title {
                margin: 0;
            }
            
            .section-icon {
                width: 32px;
                height: 32px;
                border-radius: 8px;
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            }
            
            /* ============================================
               FORM ELEMENTS
               ============================================ */
            
            .form-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 16px;
            }
            
            .form-row:last-child {
                margin-bottom: 0;
            }
            
            .form-row--three {
                grid-template-columns: 1fr 1fr 1fr;
            }
            
            /* Select with inline add button */
            .select-with-add {
                display: flex;
                gap: 8px;
                align-items: stretch;
            }
            
            .select-with-add select {
                flex: 1;
            }
            
            .btn-add-inline {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 42px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                color: #64748b;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .btn-add-inline:hover {
                background: #8b5cf6;
                border-color: #8b5cf6;
                color: white;
            }
            
            .btn-add-inline svg {
                width: 16px;
                height: 16px;
            }
            
            /* Team Builder Styles */
            .team-builder {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                overflow: hidden;
            }
            
            .team-builder-header {
                display: grid;
                grid-template-columns: 160px 1fr 100px 50px;
                gap: 12px;
                padding: 12px 16px;
                background: #f1f5f9;
                border-bottom: 1px solid #e2e8f0;
                font-size: 12px;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .team-builder-rows {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .team-row {
                display: grid;
                grid-template-columns: 160px 1fr 100px 50px;
                gap: 12px;
                padding: 12px 16px;
                border-bottom: 1px solid #e2e8f0;
                align-items: center;
                background: white;
                transition: background 0.15s ease;
            }
            
            .team-row:hover {
                background: #fafbfc;
            }
            
            .team-row:last-child {
                border-bottom: none;
            }
            
            .team-row select,
            .team-row input {
                padding: 8px 10px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                font-size: 14px;
                transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            
            .team-row select:focus,
            .team-row input:focus {
                outline: none;
                border-color: #8b5cf6;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
            }
            
            .team-row select {
                cursor: pointer;
                background: white;
            }
            
            .team-row input[type="number"] {
                text-align: center;
            }
            
            .team-row .select-wrapper {
                display: flex;
                gap: 6px;
                align-items: center;
            }
            
            .team-row .select-wrapper select {
                flex: 1;
                min-width: 0;
            }
            
            .team-row .btn-quick-add {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                color: #64748b;
                cursor: pointer;
                transition: all 0.15s ease;
                flex-shrink: 0;
            }
            
            .team-row .btn-quick-add:hover {
                background: #8b5cf6;
                border-color: #8b5cf6;
                color: white;
            }
            
            .team-row .btn-remove {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                background: transparent;
                border: none;
                border-radius: 6px;
                color: #94a3b8;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .team-row .btn-remove:hover {
                background: #fee2e2;
                color: #dc2626;
            }
            
            .team-builder-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #f8fafc;
                border-top: 1px solid #e2e8f0;
            }
            
            .btn-add-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                background: white;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                color: #64748b;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .btn-add-row:hover {
                background: #8b5cf6;
                border-color: #8b5cf6;
                border-style: solid;
                color: white;
            }
            
            .team-totaal {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 14px;
                color: #64748b;
            }
            
            .team-totaal strong {
                font-size: 18px;
                color: #8b5cf6;
                font-weight: 600;
            }
            
            .team-builder-empty {
                padding: 32px 16px;
                text-align: center;
                color: #94a3b8;
                font-size: 14px;
            }
            
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            
            .form-group--large {
                grid-column: 1 / -1;
            }
            
            .form-group label {
                font-size: 13px;
                font-weight: 500;
                color: #475569;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            
            .required {
                color: #dc2626;
            }
            
            .form-hint {
                font-size: 11px;
                color: #94a3b8;
                font-weight: 400;
            }
            
            /* Input with prefix (e.g. € symbol) */
            .input-with-prefix {
                display: flex;
                align-items: stretch;
            }
            
            .input-prefix {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0 14px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-right: none;
                border-radius: 8px 0 0 8px;
                font-size: 14px;
                font-weight: 600;
                color: #64748b;
            }
            
            .input-with-prefix .form-control {
                border-radius: 0 8px 8px 0;
                flex: 1;
            }
            
            /* Input with suffix (e.g. dropdown for unit) */
            .input-with-suffix {
                display: flex;
                align-items: stretch;
            }
            
            .input-with-suffix .form-control {
                border-radius: 8px 0 0 8px;
                border-right: none;
                flex: 1;
                min-width: 80px;
            }
            
            .input-suffix-select {
                padding: 10px 12px;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 0 8px 8px 0;
                font-size: 14px;
                color: #475569;
                cursor: pointer;
                min-width: 100px;
            }
            
            .input-suffix-select:focus {
                outline: none;
                border-color: #8b5cf6;
                background: #f8fafc;
            }
            
            .form-control {
                padding: 10px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                font-size: 14px;
                color: #1e293b;
                background: white;
                transition: all 0.15s ease;
            }
            
            .form-control:focus {
                outline: none;
                border-color: #8b5cf6;
                box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
            }
            
            .form-control::placeholder {
                color: #94a3b8;
            }
            
            .form-control--readonly {
                background: #f1f5f9;
                border-color: #e2e8f0;
                cursor: default;
                display: flex;
                align-items: center;
                min-height: 42px;
            }
            
            .form-control--readonly span {
                font-weight: 500;
            }
            
            .form-control--prominent {
                font-size: 16px;
                font-weight: 500;
                padding: 12px 14px;
            }
            
            .form-control--deadline {
                border-color: #fecaca;
                background: #fef2f2;
            }
            
            .form-control--deadline:focus {
                border-color: #dc2626;
                box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
            }
            
            .form-group--deadline label {
                color: #dc2626;
                font-weight: 600;
            }
            
            /* ============================================
               TIMELINE GRID
               ============================================ */
            
            .timeline-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-top: 16px;
            }
            
            .timeline-item {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .timeline-item label {
                font-size: 11px;
                font-weight: 500;
                color: #64748b;
            }
            
            .timeline-item .form-control {
                padding: 8px;
                font-size: 13px;
            }
            
            /* ============================================
               STATUS BUTTONS
               ============================================ */
            
            .status-buttons {
                display: flex;
                gap: 8px;
            }
            
            .status-btn {
                flex: 1;
                padding: 10px 12px;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                background: white;
                color: #64748b;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                transition: all 0.15s ease;
            }
            
            .status-btn:hover {
                border-color: #cbd5e1;
                background: #f8fafc;
            }
            
            .status-btn.active {
                color: white;
            }
            
            .status-btn--pending.active {
                background: #64748b;
                border-color: #64748b;
            }
            
            .status-btn--go.active {
                background: #10b981;
                border-color: #10b981;
            }
            
            .status-btn--maybe.active {
                background: #f59e0b;
                border-color: #f59e0b;
            }
            
            .status-btn--nogo.active {
                background: #ef4444;
                border-color: #ef4444;
            }
            
            /* ============================================
               COLLAPSIBLE SECTIONS
               ============================================ */
            
            .section-toggle {
                width: 100%;
                padding: 16px 20px;
                border: none;
                background: transparent;
                display: flex;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                transition: background 0.15s ease;
            }
            
            .section-toggle:hover {
                background: #f8fafc;
            }
            
            .section-toggle .section-title {
                margin: 0;
            }
            
            .toggle-icon {
                color: #94a3b8;
                transition: transform 0.2s ease;
            }
            
            .section-toggle.expanded .toggle-icon {
                transform: rotate(180deg);
            }
            
            .section-content {
                padding: 0 20px 20px 20px;
            }
            
            .section-content.collapsed {
                display: none;
            }
            
            /* ⭐ v2.1: Highlight animatie voor scroll-to-section */
            .section-content.section-highlight {
                animation: sectionPulse 1.5s ease-out;
            }
            
            @keyframes sectionPulse {
                0% {
                    background-color: rgba(102, 126, 234, 0.15);
                    box-shadow: inset 0 0 0 2px rgba(102, 126, 234, 0.3);
                }
                100% {
                    background-color: transparent;
                    box-shadow: none;
                }
            }
            
            /* Subsection collapse */
            .form-subsection.collapsible {
                margin-top: 16px;
                border-top: 1px solid #e2e8f0;
                padding-top: 16px;
            }
            
            .collapse-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                background: #f8fafc;
                color: #64748b;
                font-size: 13px;
                cursor: pointer;
                width: 100%;
                transition: all 0.15s ease;
            }
            
            .collapse-toggle:hover {
                border-color: #94a3b8;
                background: #f1f5f9;
            }
            
            .collapse-icon {
                transition: transform 0.2s ease;
            }
            
            .collapse-toggle.expanded .collapse-icon {
                transform: rotate(90deg);
            }
            
            .collapse-hint {
                margin-left: auto;
                font-size: 11px;
                color: #94a3b8;
            }
            
            .collapse-content {
                display: none;
                padding-top: 16px;
            }
            
            .collapse-content.expanded {
                display: block;
            }
            
            /* ============================================
               CHECKBOX GRID
               ============================================ */
            
            .checkbox-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                font-size: 13px;
                color: #475569;
                cursor: pointer;
                transition: all 0.15s ease;
            }
            
            .checkbox-label:hover {
                border-color: #cbd5e1;
                background: #f8fafc;
            }
            
            .checkbox-label input:checked + span {
                color: #8b5cf6;
                font-weight: 500;
            }
            
            .checkbox-label:has(input:checked) {
                border-color: #c4b5fd;
                background: #f5f3ff;
            }
            
            /* ============================================
               MODAL FOOTER
               ============================================ */
            
            .modal-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 16px 24px;
                border-top: 1px solid #e2e8f0;
                background: #f8fafc;
                border-radius: 0 0 16px 16px;
            }
            
            .footer-left {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .footer-right {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .btn {
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.15s ease;
                border: none;
            }
            
            .btn-secondary {
                background: white;
                color: #475569;
                border: 1px solid #e2e8f0;
            }
            
            .btn-secondary:hover {
                background: #f1f5f9;
                border-color: #cbd5e1;
            }
            
            .btn-danger {
                background: #dc2626;
                color: white;
            }
            
            .btn-danger:hover {
                background: #b91c1c;
            }
            
            .btn-primary {
                background: #8b5cf6;
                color: white;
            }
            
            .btn-primary:hover {
                background: #7c3aed;
            }

            /* ============================================
               v3.3: BEDRIJF SELECTOR INTEGRATION
               ============================================ */
            
            .form-group--wide {
                grid-column: span 2;
            }
            
            @media (max-width: 768px) {
                .form-group--wide {
                    grid-column: span 1;
                }
            }

            .bedrijf-info-card {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 16px;
                margin-top: 12px;
            }

            .info-card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }

            .info-card-title {
                font-size: 13px;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .btn-edit-bedrijf {
                width: 28px;
                height: 28px;
                border: none;
                background: transparent;
                border-radius: 6px;
                cursor: pointer;
                color: #94a3b8;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s;
            }

            .btn-edit-bedrijf:hover {
                background: #e2e8f0;
                color: #64748b;
            }

            .info-card-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
            }

            @media (max-width: 768px) {
                .info-card-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }

            .info-item {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }

            .info-label {
                font-size: 10px;
                font-weight: 600;
                color: #94a3b8;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .info-value {
                font-size: 13px;
                color: #0f172a;
            }
            
            /* ============================================
               RESPONSIVE
               ============================================ */
            
            @media (max-width: 768px) {
                .form-row,
                .form-row--three {
                    grid-template-columns: 1fr;
                }
                
                .timeline-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .status-buttons {
                    flex-wrap: wrap;
                }
                
                .status-btn {
                    flex: 1 1 45%;
                }
                
                .modal-footer {
                    flex-wrap: wrap;
                }
                
                .btn {
                    flex: 1;
                    justify-content: center;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Close buttons
        this.modal.querySelector('#modal-close').addEventListener('click', () => this.close());
        this.modal.querySelector('#btn-cancel').addEventListener('click', () => this.close());
        this.modal.querySelector('#modal-overlay').addEventListener('click', () => this.close());

        // Save button
        this.modal.querySelector('#btn-save').addEventListener('click', () => this.save(false));

        // Delete button
        this.modal.querySelector('#btn-delete').addEventListener('click', () => this.confirmDelete());

        // Fase change → update fase status dropdown
        this.modal.querySelector('#tender-fase').addEventListener('change', (e) => {
            this.handleFaseChange(e.target.value);
        });

        // Status buttons
        this.modal.querySelectorAll('.status-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleStatusClick(btn);
            });
        });

        // Collapsible sections
        this.modal.querySelectorAll('.section-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                this.toggleSection(toggle);
            });
        });

        // Collapsible subsections
        this.modal.querySelectorAll('.collapse-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                this.toggleCollapse(toggle);
            });
        });

        // Team builder - add row button
        const btnAddTeamRow = this.modal.querySelector('#btn-add-team-row');
        if (btnAddTeamRow) {
            btnAddTeamRow.addEventListener('click', () => {
                this.addTeamRow();
            });
        }

        // Initialize fase status dropdown
        this.handleFaseChange('acquisitie');

        // Load tenderbureaus
        this.loadTenderbureaus();

        // Load team members and initialize team builder
        this.initTeamBuilder();

        // ⭐ v3.3: Initialize BedrijfSelector
        this.initBedrijfSelector();
    }

    /**
     * Handle status button click
     */
    handleStatusClick(clickedBtn) {
        // Remove active from all
        this.modal.querySelectorAll('.status-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active to clicked
        clickedBtn.classList.add('active');

        // Update hidden input
        this.modal.querySelector('#tender-status').value = clickedBtn.dataset.value;
    }

    /**
     * Toggle collapsible section
     */
    toggleSection(toggle) {
        const targetId = toggle.dataset.target;
        const content = this.modal.querySelector(`#${targetId}`);

        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            toggle.classList.add('expanded');
        } else {
            content.classList.add('collapsed');
            toggle.classList.remove('expanded');
        }
    }

    /**
     * Toggle collapsible subsection
     */
    toggleCollapse(toggle) {
        const targetId = toggle.dataset.target;
        const content = this.modal.querySelector(`#${targetId}`);

        if (content.classList.contains('expanded')) {
            content.classList.remove('expanded');
            toggle.classList.remove('expanded');
        } else {
            content.classList.add('expanded');
            toggle.classList.add('expanded');
        }
    }

    /**
     * ⭐ v3.3: Initialize BedrijfSelector component
     */
    async initBedrijfSelector() {
        const container = this.modal.querySelector('#bedrijf-selector-container');
        if (!container) {
            console.warn('BedrijfSelector container niet gevonden');
            return;
        }

        try {
            // Create selector instance (render laadt nu altijd bedrijvenlijst)
            this.bedrijfSelector = new BedrijfSelector('bedrijf-selector-container', {
                editingBedrijfId: this.editMode ? this.currentTender?.bedrijf_id : null,
                onSelect: (bedrijf) => this.handleBedrijfSelect(bedrijf),
                onChange: (mode, data) => this.handleBedrijfChange(mode, data),
                onModeChange: (mode) => this.handleBedrijfModeChange(mode)
            });

            // Render de selector (async)
            await this.bedrijfSelector.render();

            // Als edit mode en er is een bedrijf_id, laad het bedrijf
            if (this.editMode && this.currentTender?.bedrijf_id) {
                const bedrijf = await bedrijvenService.getBedrijf(this.currentTender.bedrijf_id);
                if (bedrijf) {
                    this.bedrijfSelector.setValue(bedrijf);
                }
            } else if (this.editMode && this.currentTender?.bedrijfsnaam) {
                // Legacy: er is wel een bedrijfsnaam maar geen bedrijf_id
                // Zoek of dit bedrijf al bestaat
                const matches = bedrijvenService.searchBedrijven(this.currentTender.bedrijfsnaam);
                const exactMatch = matches.find(b =>
                    b.bedrijfsnaam.toLowerCase() === this.currentTender.bedrijfsnaam.toLowerCase()
                );

                if (exactMatch) {
                    this.bedrijfSelector.setValue(exactMatch);
                } else {
                    // Switch to nieuw mode en vul gegevens in
                    this.bedrijfSelector.setMode('nieuw');
                    this.prefillNieuwBedrijfFromTender();
                }
            }

            console.log('✅ BedrijfSelector geïnitialiseerd');

        } catch (error) {
            console.error('❌ Error initializing BedrijfSelector:', error);
            // Fallback: toon gewoon een tekstveld
            container.innerHTML = `
                <input type="text" id="tender-bedrijfsnaam-fallback" class="form-control" 
                       placeholder="Bedrijfsnaam" required>
                <span class="form-hint" style="color: #f59e0b;">
                    ⚠️ BedrijfSelector kon niet worden geladen
                </span>
            `;
        }
    }

    /**
     * ⭐ v3.3: Prefill nieuw bedrijf velden vanuit tender data (legacy support)
     */
    prefillNieuwBedrijfFromTender() {
        if (!this.currentTender) return;

        const fieldMap = {
            'nieuw-bedrijfsnaam-bedrijf-selector-container': 'bedrijfsnaam',
            'nieuw-kvk-bedrijf-selector-container': 'kvk_nummer',
            'nieuw-btw-bedrijf-selector-container': 'btw_nummer',
            'nieuw-contactpersoon-bedrijf-selector-container': 'contactpersoon',
            'nieuw-email-bedrijf-selector-container': 'contact_email',
            'nieuw-plaats-bedrijf-selector-container': 'bedrijfs_plaats'
        };

        for (const [elementId, field] of Object.entries(fieldMap)) {
            const el = this.modal.querySelector(`#${elementId}`);
            if (el && this.currentTender[field]) {
                el.value = this.currentTender[field];
            }
        }
    }

    /**
     * ⭐ v3.3: Handle bedrijf selection
     */
    handleBedrijfSelect(bedrijf) {
        console.log('📋 Bedrijf geselecteerd:', bedrijf?.bedrijfsnaam);

        if (bedrijf) {
            this.selectedBedrijfId = bedrijf.id;

            // Update hidden fields
            this.modal.querySelector('#tender-bedrijf-id').value = bedrijf.id;
            this.modal.querySelector('#tender-bedrijfsnaam').value = bedrijf.bedrijfsnaam || '';
            this.modal.querySelector('#tender-kvk-nummer').value = bedrijf.kvk_nummer || '';
            this.modal.querySelector('#tender-btw-nummer').value = bedrijf.btw_nummer || '';
            this.modal.querySelector('#tender-contactpersoon').value = bedrijf.contactpersoon || '';
            this.modal.querySelector('#tender-contact-email').value = bedrijf.contact_email || '';
            this.modal.querySelector('#tender-contact-telefoon').value = bedrijf.contact_telefoon || '';
            this.modal.querySelector('#tender-bedrijfs-plaats').value = bedrijf.plaats || '';

            // Update readonly display
            this.updateBedrijfDisplay(bedrijf);
        } else {
            this.selectedBedrijfId = null;
            this.clearBedrijfFields();
        }
    }

    /**
     * ⭐ v3.3: Handle bedrijf change (mode or data)
     */
    handleBedrijfChange(mode, data) {
        console.log('🔄 Bedrijf change:', mode, data);

        if (mode === 'nieuw' && data) {
            // Update hidden fields from nieuw form data
            this.modal.querySelector('#tender-bedrijf-id').value = '';
            this.modal.querySelector('#tender-bedrijfsnaam').value = data.bedrijfsnaam || '';
            this.modal.querySelector('#tender-kvk-nummer').value = data.kvk_nummer || '';
            this.modal.querySelector('#tender-btw-nummer').value = data.btw_nummer || '';
            this.modal.querySelector('#tender-contactpersoon').value = data.contactpersoon || '';
            this.modal.querySelector('#tender-contact-email').value = data.contact_email || '';
            this.modal.querySelector('#tender-bedrijfs-plaats').value = data.plaats || '';
        }
    }

    /**
     * ⭐ v3.3: Handle bedrijf mode change
     */
    handleBedrijfModeChange(mode) {
        const readonlyDisplay = this.modal.querySelector('#bedrijfsgegevens-readonly');

        if (mode === 'bestaand' && this.selectedBedrijfId) {
            readonlyDisplay.style.display = 'block';
        } else {
            readonlyDisplay.style.display = 'none';
        }
    }

    /**
     * ⭐ v3.3: Update bedrijf display card
     */
    updateBedrijfDisplay(bedrijf) {
        const displaySection = this.modal.querySelector('#bedrijfsgegevens-readonly');
        if (!displaySection) return;

        this.modal.querySelector('#display-bedrijfsnaam').textContent = bedrijf.bedrijfsnaam || '-';
        this.modal.querySelector('#display-kvk').textContent = bedrijf.kvk_nummer || '-';
        this.modal.querySelector('#display-btw').textContent = bedrijf.btw_nummer || '-';
        this.modal.querySelector('#display-plaats').textContent = bedrijf.plaats || '-';
        this.modal.querySelector('#display-contact').textContent = bedrijf.contactpersoon || '-';
        this.modal.querySelector('#display-email').textContent = bedrijf.contact_email || '-';

        displaySection.style.display = 'block';
    }

    /**
     * ⭐ v3.3: Clear bedrijf fields
     */
    clearBedrijfFields() {
        this.modal.querySelector('#tender-bedrijf-id').value = '';
        this.modal.querySelector('#tender-bedrijfsnaam').value = '';
        this.modal.querySelector('#tender-kvk-nummer').value = '';
        this.modal.querySelector('#tender-btw-nummer').value = '';
        this.modal.querySelector('#tender-contactpersoon').value = '';
        this.modal.querySelector('#tender-contact-email').value = '';
        this.modal.querySelector('#tender-contact-telefoon').value = '';
        this.modal.querySelector('#tender-bedrijfs-plaats').value = '';

        const displaySection = this.modal.querySelector('#bedrijfsgegevens-readonly');
        if (displaySection) {
            displaySection.style.display = 'none';
        }
    }


    /**
     * Load en toon actief tenderbureau
     */
    async loadTenderbureaus() {
        try {
            // Import supabase
            const { supabase } = await import('/js/config.js');

            // Get active bureau ID from localStorage
            const activeBureauId = localStorage.getItem('tenderzen_current_bureau');

            if (this.isSuperAdmin) {
                // ⭐ Super-admin: laad ALLE bureaus voor dropdown
                const selectEl = this.modal.querySelector('#tender-tenderbureau-select');

                if (!selectEl) {
                    console.warn('tender-tenderbureau-select element not found');
                    return;
                }

                // Load all bureaus
                const { data: bureaus, error } = await supabase
                    .from('tenderbureaus')
                    .select('id, naam')
                    .order('naam', { ascending: true });

                if (error) {
                    console.error('Error loading bureaus:', error);
                    selectEl.innerHTML = '<option value="">⚠️ Fout bij laden</option>';
                    return;
                }

                this.allBureaus = bureaus || [];

                // Build dropdown options
                selectEl.innerHTML = this.allBureaus.map(b =>
                    `<option value="${b.id}" ${b.id === activeBureauId ? 'selected' : ''}>${b.naam}</option>`
                ).join('');

                console.log('✅ Loaded', this.allBureaus.length, 'bureaus for super-admin dropdown');

            } else {
                // Normale user: toon readonly veld met actief bureau
                const displayEl = this.modal.querySelector('#active-bureau-name');

                if (!displayEl) {
                    console.warn('active-bureau-name element not found');
                    return;
                }

                if (!activeBureauId) {
                    displayEl.textContent = '⚠️ Geen bureau geselecteerd';
                    displayEl.style.color = '#dc2626';
                    return;
                }

                // Load bureau name
                const { data: bureau, error } = await supabase
                    .from('tenderbureaus')
                    .select('id, naam')
                    .eq('id', activeBureauId)
                    .single();

                if (error || !bureau) {
                    console.error('Error loading bureau:', error);
                    displayEl.textContent = '⚠️ Bureau niet gevonden';
                    displayEl.style.color = '#dc2626';
                    return;
                }

                displayEl.textContent = bureau.naam;
                displayEl.style.color = '#10b981';
                displayEl.style.fontWeight = '500';

                console.log('✅ Active bureau:', bureau.naam);
            }
        } catch (error) {
            console.error('Error in loadTenderbureaus:', error);
        }
    }

    // =========================================================
    // TEAM BUILDER
    // =========================================================

    /**
     * Initialize team builder - load members and add first row
     */
    async initTeamBuilder() {
        try {
            // Get active bureau ID
            const activeBureauId = localStorage.getItem('tenderzen_current_bureau');

            if (!activeBureauId) {
                console.warn('No active bureau for loading team members');
                return;
            }

            // Import supabase
            const { supabase } = await import('/js/config.js');

            // Load team members for this bureau
            const { data: members, error } = await supabase
                .from('team_members')
                .select('id, naam, rol, initialen')
                .eq('tenderbureau_id', activeBureauId)
                .eq('is_active', true)
                .order('naam', { ascending: true });

            if (error) {
                console.error('Error loading team members:', error);
                return;
            }

            // Store members for later use
            this.teamMembers = members || [];
            this.teamRows = [];
            this.teamRowCounter = 0;

            console.log('Loaded', this.teamMembers.length, 'team members for team builder');

            // Add first empty row
            this.addTeamRow();

        } catch (error) {
            console.error('Error in initTeamBuilder:', error);
        }
    }

    /**
     * Get available roles
     */
    getAvailableRoles() {
        return [
            { key: 'manager', label: 'Manager' },
            { key: 'schrijver', label: 'Schrijver' },
            { key: 'coordinator', label: 'Coordinator' },
            { key: 'designer', label: 'Designer' },
            { key: 'reviewer', label: 'Reviewer' },
            { key: 'sales', label: 'Sales' },
            { key: 'calculator', label: 'Calculator' },
            { key: 'klant_contact', label: 'Klant contact' }
        ];
    }

    /**
     * Add a new team row
     */
    addTeamRow(presetData = null) {
        const container = this.modal.querySelector('#team-rows');
        if (!container) return;

        const rowId = ++this.teamRowCounter;
        const row = document.createElement('div');
        row.className = 'team-row';
        row.dataset.rowId = rowId;

        // Build role options
        const roleOptions = this.getAvailableRoles()
            .map(r => '<option value="' + r.key + '"' + (presetData && presetData.rol === r.key ? ' selected' : '') + '>' + r.label + '</option>')
            .join('');

        const plusIcon = Icons.plus ? Icons.plus({ size: 14 }) : '+';
        const trashIcon = Icons.trash ? Icons.trash({ size: 16 }) : 'x';

        row.innerHTML =
            '<select class="team-role-select" data-row-id="' + rowId + '">' +
            '<option value="">-- Functie --</option>' +
            roleOptions +
            '</select>' +
            '<div class="select-wrapper">' +
            '<select class="team-member-select" data-row-id="' + rowId + '">' +
            '<option value="">-- Selecteer teamlid --</option>' +
            '</select>' +
            '<button type="button" class="btn-quick-add" data-row-id="' + rowId + '" title="Nieuw teamlid toevoegen">' +
            plusIcon +
            '</button>' +
            '</div>' +
            '<input type="number" class="team-uren-input" data-row-id="' + rowId + '" placeholder="0" min="0" value="' + (presetData && presetData.uren ? presetData.uren : '') + '">' +
            '<button type="button" class="btn-remove" data-row-id="' + rowId + '" title="Verwijderen">' +
            trashIcon +
            '</button>';

        container.appendChild(row);

        // Bind events for this row
        this.bindTeamRowEvents(row, rowId);

        // Populate member dropdown based on selected role (or all)
        this.updateMemberDropdown(rowId, presetData ? presetData.rol : '');

        // If preset data, set member value after dropdown is populated
        if (presetData && presetData.member_id) {
            setTimeout(() => {
                const memberSelect = row.querySelector('.team-member-select');
                if (memberSelect) memberSelect.value = presetData.member_id;
            }, 50);
        }

        // Store row reference
        this.teamRows.push({ rowId: rowId, element: row });

        // Update totals
        this.updateTeamTotals();
    }

    /**
     * Bind events for a team row
     */
    bindTeamRowEvents(row, rowId) {
        const self = this;

        // Role change -> update member dropdown
        const roleSelect = row.querySelector('.team-role-select');
        if (roleSelect) {
            roleSelect.addEventListener('change', function (e) {
                self.updateMemberDropdown(rowId, e.target.value);
            });
        }

        // Uren change -> update totals
        const urenInput = row.querySelector('.team-uren-input');
        if (urenInput) {
            urenInput.addEventListener('input', function () {
                self.updateTeamTotals();
            });
        }

        // Quick add button
        const btnQuickAdd = row.querySelector('.btn-quick-add');
        if (btnQuickAdd) {
            btnQuickAdd.addEventListener('click', function () {
                const selectedRole = roleSelect ? roleSelect.value : null;
                self.openAddTeamMember(selectedRole, rowId);
            });
        }

        // Remove button
        const btnRemove = row.querySelector('.btn-remove');
        if (btnRemove) {
            btnRemove.addEventListener('click', function () {
                self.removeTeamRow(rowId);
            });
        }
    }

    /**
     * Update member dropdown based on selected role
     */
    updateMemberDropdown(rowId, selectedRole) {
        const row = this.modal.querySelector('.team-row[data-row-id="' + rowId + '"]');
        if (!row) return;

        const memberSelect = row.querySelector('.team-member-select');
        if (!memberSelect) return;

        const currentValue = memberSelect.value;

        // Filter members by role if selected
        var filteredMembers = this.teamMembers || [];
        var self = this;

        if (selectedRole) {
            // Show matching role first, then others
            var matching = filteredMembers.filter(function (m) { return m.rol === selectedRole; });
            var others = filteredMembers.filter(function (m) { return m.rol !== selectedRole; });

            memberSelect.innerHTML = '<option value="">-- Selecteer teamlid --</option>';

            if (matching.length > 0) {
                var optgroup = document.createElement('optgroup');
                optgroup.label = self.getRoleLabel(selectedRole);
                matching.forEach(function (m) {
                    var opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.naam;
                    opt.dataset.naam = m.naam;
                    optgroup.appendChild(opt);
                });
                memberSelect.appendChild(optgroup);
            }

            if (others.length > 0) {
                var optgroup2 = document.createElement('optgroup');
                optgroup2.label = 'Overige';
                others.forEach(function (m) {
                    var opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.naam + ' (' + self.getRoleLabel(m.rol) + ')';
                    opt.dataset.naam = m.naam;
                    optgroup2.appendChild(opt);
                });
                memberSelect.appendChild(optgroup2);
            }
        } else {
            // Show all members
            memberSelect.innerHTML = '<option value="">-- Selecteer teamlid --</option>';
            filteredMembers.forEach(function (m) {
                var opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.rol ? m.naam + ' (' + self.getRoleLabel(m.rol) + ')' : m.naam;
                opt.dataset.naam = m.naam;
                memberSelect.appendChild(opt);
            });
        }

        // Restore value if it still exists
        if (currentValue) {
            memberSelect.value = currentValue;
        }
    }

    /**
     * Get display label for role
     */
    getRoleLabel(role) {
        var labels = {
            'manager': 'Manager',
            'schrijver': 'Schrijver',
            'coordinator': 'Coordinator',
            'designer': 'Designer',
            'reviewer': 'Reviewer',
            'sales': 'Sales',
            'calculator': 'Calculator',
            'klant_contact': 'Klant contact'
        };
        return labels[role] || role || '';
    }

    /**
     * Remove a team row
     */
    removeTeamRow(rowId) {
        var row = this.modal.querySelector('.team-row[data-row-id="' + rowId + '"]');
        if (row) {
            row.remove();
            this.teamRows = this.teamRows.filter(function (r) { return r.rowId !== rowId; });
            this.updateTeamTotals();
        }
    }

    /**
     * Update team totals
     */
    updateTeamTotals() {
        var totalEl = this.modal.querySelector('#team-totaal-uren');
        if (!totalEl) return;

        var total = 0;
        this.modal.querySelectorAll('.team-uren-input').forEach(function (input) {
            var val = parseInt(input.value) || 0;
            total += val;
        });

        totalEl.textContent = total;
    }

    /**
     * Get team data from builder
     */
    getTeamData() {
        var teamData = [];
        var self = this;

        this.modal.querySelectorAll('.team-row').forEach(function (row) {
            var roleSelect = row.querySelector('.team-role-select');
            var memberSelect = row.querySelector('.team-member-select');
            var urenInput = row.querySelector('.team-uren-input');

            var memberId = memberSelect ? memberSelect.value : '';
            var memberNaam = (memberSelect && memberSelect.selectedOptions[0] && memberSelect.selectedOptions[0].dataset) ? memberSelect.selectedOptions[0].dataset.naam : '';
            var rol = roleSelect ? roleSelect.value : '';
            var uren = parseInt(urenInput ? urenInput.value : 0) || 0;

            // Only include if member is selected
            if (memberId) {
                teamData.push({
                    team_member_id: memberId,
                    naam: memberNaam,
                    rol: rol,
                    uren: uren
                });
            }
        });

        return teamData;
    }

    /**
     * Calculate total workload from team builder
     */
    calculateTotalWorkload() {
        var total = 0;
        this.modal.querySelectorAll('.team-uren-input').forEach(function (input) {
            var val = parseInt(input.value) || 0;
            total += val;
        });
        return total || null;
    }

    /**
     * Set team data in builder (for edit mode)
     */
    setTeamData(teamData) {
        // Clear existing rows
        var container = this.modal.querySelector('#team-rows');
        if (container) container.innerHTML = '';
        this.teamRows = [];
        this.teamRowCounter = 0;

        var self = this;

        if (teamData && teamData.length > 0) {
            teamData.forEach(function (member) {
                self.addTeamRow({
                    rol: member.rol,
                    member_id: member.team_member_id,
                    uren: member.uren
                });
            });
        } else {
            // Add empty row
            this.addTeamRow();
        }
    }

    /**
     * Open TeamlidModal to add new member, then refresh dropdowns
     */
    async openAddTeamMember(presetRole, rowId) {
        var self = this;

        // Check if TeamlidModal is available globally
        if (window.app && window.app.teamlidModal) {
            // Set callback to refresh dropdowns after adding
            var originalOnSave = window.app.teamlidModal.onSave;
            window.app.teamlidModal.onSave = async function (memberData) {
                if (originalOnSave) await originalOnSave(memberData);
                // Reload team members
                await self.reloadTeamMembers();
                // Update the specific row dropdown if rowId provided
                if (rowId) {
                    self.updateMemberDropdown(rowId, presetRole);
                }
            };

            // Open modal with preset role if provided
            window.app.teamlidModal.open(null, presetRole);
        } else {
            alert('TeamlidModal is niet beschikbaar. Ga naar Teamleden in het menu om een nieuw teamlid toe te voegen.');
        }
    }

    /**
     * Reload team members (after adding new one)
     */
    async reloadTeamMembers() {
        var self = this;

        try {
            var activeBureauId = localStorage.getItem('tenderzen_current_bureau');
            if (!activeBureauId) return;

            var { supabase } = await import('/js/config.js');

            var { data: members, error } = await supabase
                .from('team_members')
                .select('id, naam, rol, initialen')
                .eq('tenderbureau_id', activeBureauId)
                .eq('is_active', true)
                .order('naam', { ascending: true });

            if (!error) {
                self.teamMembers = members || [];
                // Update all dropdowns
                self.modal.querySelectorAll('.team-row').forEach(function (row) {
                    var rowId = row.dataset.rowId;
                    var roleSelect = row.querySelector('.team-role-select');
                    self.updateMemberDropdown(rowId, roleSelect ? roleSelect.value : '');
                });
            }
        } catch (error) {
            console.error('Error reloading team members:', error);
        }
    }


    /**
     * Handle fase change → update fase status options
     */
    async handleFaseChange(fase) {
        this.currentFase = fase;
        const faseStatusSelect = this.modal.querySelector('#tender-fase-status');

        try {
            const statussen = await faseService.getStatussenVoorFase(fase);

            faseStatusSelect.innerHTML = '<option value="">-- Selecteer status --</option>' +
                statussen.map(s => `
                    <option value="${s.status_key}">
                        ${s.status_display}
                    </option>
                `).join('');

            // Select first option as default (only in create mode)
            if (!this.editMode && statussen.length > 0) {
                faseStatusSelect.value = statussen[0].status_key;
            }

            // In edit mode, select the current value if it exists
            if (this.editMode && this.currentTender?.fase_status) {
                faseStatusSelect.value = this.currentTender.fase_status;
            }
        } catch (error) {
            console.error('Error loading fase statussen:', error);
        }
    }

    /**
     * Populate form with existing tender data
     */
    populateForm(tender) {
        if (!tender) return;

        // Helper function to set value
        const setValue = (id, value) => {
            const el = this.modal.querySelector(`#${id}`);
            if (el && value !== null && value !== undefined) {
                // ⭐ v3.4.1 FIX: Strip tijd-component voor date inputs
                // Database timestamps ("2026-01-30T00:00:00Z") matchen niet
                // met het vereiste "yyyy-MM-dd" formaat van <input type="date">
                if (el.type === 'date' && typeof value === 'string' && value.includes('T')) {
                    value = value.split('T')[0];
                }
                el.value = value;
            }
        };

        // Tender kern
        setValue('tender-naam', tender.naam);
        setValue('tender-aanbestedende-dienst', tender.aanbestedende_dienst || tender.opdrachtgever);
        setValue('tender-locatie', tender.locatie);
        setValue('tender-fase', tender.fase);
        setValue('tender-omschrijving', tender.omschrijving);

        // Partijen
        setValue('tender-bedrijfsnaam', tender.bedrijfsnaam);

        // ⭐ Tenderbureau: voor super-admin selecteer in dropdown
        if (this.isSuperAdmin && tender.tenderbureau_id) {
            const selectEl = this.modal.querySelector('#tender-tenderbureau-select');
            if (selectEl) {
                selectEl.value = tender.tenderbureau_id;
            }
        }
        // Voor normale users wordt dit via loadTenderbureaus() gedaan

        setValue('tender-kvk-nummer', tender.kvk_nummer);
        setValue('tender-btw-nummer', tender.btw_nummer);
        setValue('tender-contactpersoon', tender.contactpersoon);
        setValue('tender-contact-email', tender.contact_email);
        setValue('tender-contact-telefoon', tender.contact_telefoon);
        setValue('tender-bedrijfs-plaats', tender.bedrijfs_plaats);

        // Team & Workload
        // Load team assignments into team builder
        if (tender.team_assignments && tender.team_assignments.length > 0) {
            this.setTeamData(tender.team_assignments);
        }

        // Go/No-Go
        setValue('tender-go-nogo-opmerkingen', tender.go_nogo_opmerkingen);

        // Status buttons
        if (tender.status) {
            const statusBtn = this.modal.querySelector(`.status-btn[data-value="${tender.status}"]`);
            if (statusBtn) {
                this.handleStatusClick(statusBtn);
            }
        }

        // Timeline
        setValue('tender-deadline-indiening', tender.deadline_indiening);
        setValue('tender-interne-deadline', tender.interne_deadline);
        setValue('tender-publicatie-datum', tender.publicatie_datum);
        setValue('tender-schouw-datum', tender.schouw_datum);
        setValue('tender-nvi1-datum', tender.nvi1_datum);
        setValue('tender-nvi2-datum', tender.nvi2_datum);
        setValue('tender-presentatie-datum', tender.presentatie_datum);
        setValue('tender-voorlopige-gunning', tender.voorlopige_gunning);
        setValue('tender-definitieve-gunning', tender.definitieve_gunning);
        setValue('tender-start-uitvoering', tender.start_uitvoering);

        // Classificatie
        setValue('tender-type', tender.type);
        setValue('tender-aanbestedingsprocedure', tender.aanbestedingsprocedure);
        setValue('tender-tender-nummer', tender.tender_nummer);

        if (tender.cpv_codes && Array.isArray(tender.cpv_codes)) {
            setValue('tender-cpv-codes', tender.cpv_codes.join(', '));
        }

        // Financieel
        setValue('tender-geraamde-waarde', tender.geraamde_waarde);
        setValue('tender-opdracht-duur', tender.opdracht_duur);
        setValue('tender-opdracht-duur-eenheid', tender.opdracht_duur_eenheid || 'maanden');

        // Documenten
        setValue('tender-platform-naam', tender.platform_naam);
        setValue('tender-tenderned-url', tender.tenderned_url);
        setValue('tender-documenten-link', tender.documenten_link);
        setValue('tender-interne-map-link', tender.interne_map_link);

        // Eisen
        if (tender.certificeringen_vereist && Array.isArray(tender.certificeringen_vereist)) {
            tender.certificeringen_vereist.forEach(cert => {
                const checkbox = this.modal.querySelector(`input[name="certificering"][value="${cert}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
        setValue('tender-minimale-omzet', tender.minimale_omzet);
        setValue('tender-aantal-referenties', tender.aantal_referenties_vereist);
        setValue('tender-eisen-notities', tender.eisen_notities);

        // Risico & Strategie
        if (tender.risicos?.beschrijving) {
            setValue('tender-risicos', tender.risicos.beschrijving);
        }
        setValue('tender-concurrentie-analyse', tender.concurrentie_analyse);
        setValue('tender-usps', tender.usps);
        setValue('tender-strategie-notities', tender.strategie_notities);

        // Update fase status dropdown after setting fase
        if (tender.fase) {
            this.handleFaseChange(tender.fase);
        }
    }

    /**
     * Update modal UI for edit/create mode
     */
    updateModalUI() {
        const titleText = this.modal.querySelector('#modal-title-text');
        const titleIcon = this.modal.querySelector('#modal-title-icon');
        const saveBtn = this.modal.querySelector('#btn-save-text');
        const deleteBtn = this.modal.querySelector('#btn-delete');
        const tenderIdDisplay = this.modal.querySelector('#tender-id-display');

        if (this.editMode) {
            titleText.textContent = 'Tender Bewerken';
            titleIcon.innerHTML = Icons.edit ? Icons.edit({ size: 24, color: '#8b5cf6' }) : '✏️';
            saveBtn.textContent = 'Wijzigingen opslaan';
            if (deleteBtn) deleteBtn.style.display = 'flex';

            // Toon Tender ID bij bewerken
            if (tenderIdDisplay && this.currentTender?.id) {
                tenderIdDisplay.textContent = `ID: ${this.currentTender.id}`;
                tenderIdDisplay.style.cursor = 'pointer';
                tenderIdDisplay.title = 'Klik om te kopiëren';
                tenderIdDisplay.onclick = () => {
                    navigator.clipboard.writeText(this.currentTender.id);
                    const original = tenderIdDisplay.textContent;
                    tenderIdDisplay.textContent = '✓ Gekopieerd!';
                    setTimeout(() => {
                        tenderIdDisplay.textContent = original;
                    }, 1500);
                };
            }
        } else {
            titleText.textContent = 'Nieuwe Tender';
            titleIcon.innerHTML = Icons.plus ? Icons.plus({ size: 24, color: '#10b981' }) : '+';
            saveBtn.textContent = 'Tender aanmaken';
            if (deleteBtn) deleteBtn.style.display = 'none';

            // Verberg ID bij nieuwe tender
            if (tenderIdDisplay) {
                tenderIdDisplay.textContent = '';
                tenderIdDisplay.onclick = null;
            }
        }
    }

    /**
     * Get form data
     */
    getFormData() {
        const certificeringen = Array.from(
            this.modal.querySelectorAll('input[name="certificering"]:checked')
        ).map(cb => cb.value);

        const cpvCodesRaw = this.modal.querySelector('#tender-cpv-codes')?.value || '';
        const cpvCodes = cpvCodesRaw ? cpvCodesRaw.split(',').map(c => c.trim()).filter(c => c) : null;

        const risicosText = this.modal.querySelector('#tender-risicos')?.value;
        const risicos = risicosText ? { beschrijving: risicosText } : null;

        const formData = {
            // Tender kern
            naam: this.modal.querySelector('#tender-naam')?.value || null,
            aanbestedende_dienst: this.modal.querySelector('#tender-aanbestedende-dienst')?.value || null,
            // Alias voor backwards compatibility
            opdrachtgever: this.modal.querySelector('#tender-aanbestedende-dienst')?.value || null,
            locatie: this.modal.querySelector('#tender-locatie')?.value || null,
            fase: this.modal.querySelector('#tender-fase')?.value || 'acquisitie',
            fase_status: this.modal.querySelector('#tender-fase-status')?.value || null,
            omschrijving: this.modal.querySelector('#tender-omschrijving')?.value || null,

            // Partijen - ⭐ v3.3: bedrijf_id toegevoegd
            bedrijf_id: this.modal.querySelector('#tender-bedrijf-id')?.value || null,
            bedrijfsnaam: this.modal.querySelector('#tender-bedrijfsnaam')?.value || null,
            // tenderbureau_id wordt automatisch gezet vanuit actief bureau (zie getActiveBureauId)
            kvk_nummer: this.modal.querySelector('#tender-kvk-nummer')?.value || null,
            btw_nummer: this.modal.querySelector('#tender-btw-nummer')?.value || null,
            contactpersoon: this.modal.querySelector('#tender-contactpersoon')?.value || null,
            contact_email: this.modal.querySelector('#tender-contact-email')?.value || null,
            contact_telefoon: this.modal.querySelector('#tender-contact-telefoon')?.value || null,
            bedrijfs_plaats: this.modal.querySelector('#tender-bedrijfs-plaats')?.value || null,

            // Team & Workload - from team builder
            team_assignments: this.getTeamData(),
            geschatte_workload: this.calculateTotalWorkload(),

            // Go/No-Go
            status: this.modal.querySelector('#tender-status')?.value || 'pending',
            go_nogo_opmerkingen: this.modal.querySelector('#tender-go-nogo-opmerkingen')?.value || null,

            // Timeline
            deadline_indiening: this.modal.querySelector('#tender-deadline-indiening')?.value || null,
            interne_deadline: this.modal.querySelector('#tender-interne-deadline')?.value || null,
            publicatie_datum: this.modal.querySelector('#tender-publicatie-datum')?.value || null,
            schouw_datum: this.modal.querySelector('#tender-schouw-datum')?.value || null,
            nvi1_datum: this.modal.querySelector('#tender-nvi1-datum')?.value || null,
            nvi2_datum: this.modal.querySelector('#tender-nvi2-datum')?.value || null,
            presentatie_datum: this.modal.querySelector('#tender-presentatie-datum')?.value || null,
            voorlopige_gunning: this.modal.querySelector('#tender-voorlopige-gunning')?.value || null,
            definitieve_gunning: this.modal.querySelector('#tender-definitieve-gunning')?.value || null,
            start_uitvoering: this.modal.querySelector('#tender-start-uitvoering')?.value || null,

            // Classificatie
            type: this.modal.querySelector('#tender-type')?.value || null,
            aanbestedingsprocedure: this.modal.querySelector('#tender-aanbestedingsprocedure')?.value || null,
            tender_nummer: this.modal.querySelector('#tender-tender-nummer')?.value || null,
            cpv_codes: cpvCodes,

            // Financieel
            geraamde_waarde: parseFloat(this.modal.querySelector('#tender-geraamde-waarde')?.value) || null,
            opdracht_duur: parseInt(this.modal.querySelector('#tender-opdracht-duur')?.value) || null,
            opdracht_duur_eenheid: this.modal.querySelector('#tender-opdracht-duur-eenheid')?.value || 'maanden',

            // Documenten
            platform_naam: this.modal.querySelector('#tender-platform-naam')?.value || null,
            tenderned_url: this.modal.querySelector('#tender-tenderned-url')?.value || null,
            documenten_link: this.modal.querySelector('#tender-documenten-link')?.value || null,
            interne_map_link: this.modal.querySelector('#tender-interne-map-link')?.value || null,

            // Eisen
            certificeringen_vereist: certificeringen.length > 0 ? certificeringen : null,
            minimale_omzet: parseFloat(this.modal.querySelector('#tender-minimale-omzet')?.value) || null,
            aantal_referenties_vereist: parseInt(this.modal.querySelector('#tender-aantal-referenties')?.value) || null,
            eisen_notities: this.modal.querySelector('#tender-eisen-notities')?.value || null,

            // Risico & Strategie
            risicos: risicos,
            concurrentie_analyse: this.modal.querySelector('#tender-concurrentie-analyse')?.value || null,
            usps: this.modal.querySelector('#tender-usps')?.value || null,
            strategie_notities: this.modal.querySelector('#tender-strategie-notities')?.value || null,

            // Metadata
            is_concept: this.isConcept
        };

        return formData;
    }

    /**
     * Get active bureau ID from BureauSwitcher (localStorage) or dropdown (super-admin)
     */
    getActiveBureauId() {
        // ⭐ Super-admin: gebruik de geselecteerde waarde uit dropdown
        if (this.isSuperAdmin) {
            const selectEl = this.modal.querySelector('#tender-tenderbureau-select');
            if (selectEl && selectEl.value) {
                console.log('📍 Using bureau from super-admin dropdown:', selectEl.value);
                return selectEl.value;
            }
        }

        // Normale users: gebruik localStorage (BureauSwitcher)
        const storedBureauId = localStorage.getItem('tenderzen_current_bureau');
        if (storedBureauId) {
            console.log('📍 Using bureau from BureauSwitcher:', storedBureauId);
            return storedBureauId;
        }
        console.warn('⚠️ No active bureau selected in BureauSwitcher');
        return null;
    }

    /**
     * Save tender
     * ⭐ v3.2.1 FIX: Expand collapsed sections before validation
     */
    async save(isConcept = false) {
        this.isConcept = isConcept;

        const form = this.modal.querySelector('#tender-form');

        // ⭐ FIX: Expand all collapsed sections before validation
        // (browser can't focus hidden required fields)
        const collapsedSections = this.modal.querySelectorAll('.section-content.collapsed');
        const toggleButtons = this.modal.querySelectorAll('.section-toggle');

        collapsedSections.forEach(section => {
            section.classList.remove('collapsed');
        });
        toggleButtons.forEach(btn => {
            btn.classList.add('expanded');
        });

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // ⭐ v3.3: Check of we een nieuw bedrijf moeten aanmaken
        if (this.bedrijfSelector && this.bedrijfSelector.getMode() === 'nieuw') {
            // Valideer het nieuw bedrijf formulier
            const validation = this.bedrijfSelector.validateForm();
            if (!validation.isValid) {
                alert(validation.error || 'Vul alle verplichte bedrijfsvelden in');

                // Open de partijen sectie
                const partijenContent = this.modal.querySelector('#partijen-content');
                if (partijenContent?.classList.contains('collapsed')) {
                    partijenContent.classList.remove('collapsed');
                    this.modal.querySelector('[data-target="partijen-content"]')?.classList.add('expanded');
                }
                return;
            }

            // Maak nieuw bedrijf aan
            try {
                const bedrijfData = this.bedrijfSelector.getFormData();
                console.log('📝 Creating new bedrijf:', bedrijfData);

                const nieuwBedrijf = await bedrijvenService.createBedrijf(bedrijfData);
                console.log('✅ Bedrijf created:', nieuwBedrijf);

                // Update hidden fields met nieuwe bedrijf ID
                this.modal.querySelector('#tender-bedrijf-id').value = nieuwBedrijf.id;
                this.modal.querySelector('#tender-bedrijfsnaam').value = nieuwBedrijf.bedrijfsnaam;
                this.selectedBedrijfId = nieuwBedrijf.id;

            } catch (error) {
                console.error('❌ Error creating bedrijf:', error);
                alert('Kon bedrijf niet aanmaken: ' + error.message);
                return;
            }
        }

        const formData = this.getFormData();

        // Automatisch tenderbureau_id toevoegen uit BureauSwitcher
        const activeBureauId = this.getActiveBureauId();
        if (!activeBureauId) {
            alert('Geen actief bureau geselecteerd. Selecteer eerst een bureau via de BureauSwitcher in de header.');
            return;
        }
        formData.tenderbureau_id = activeBureauId;

        console.log('💾 ' + (this.editMode ? 'Updating' : 'Creating') + ' tender:', formData);

        if (this.editMode) {
            if (this.onUpdate) {
                await this.onUpdate(this.currentTender.id, formData, isConcept);
            }
        } else {
            if (this.onSave) {
                await this.onSave(formData, isConcept);
            }
        }

        this.close();
    }

    /**
     * Confirm and delete tender
     */
    async confirmDelete() {
        if (!this.editMode || !this.currentTender) {
            return;
        }

        const tenderNaam = this.currentTender.naam || 'deze tender';
        const confirmed = confirm(`Weet je zeker dat je "${tenderNaam}" wilt verwijderen?\n\nDit kan niet ongedaan worden gemaakt.`);

        if (confirmed) {
            console.log('🗑️ Deleting tender:', this.currentTender.id);

            if (this.onDelete) {
                await this.onDelete(this.currentTender.id);
            }

            this.close();
        }
    }

    /**
     * Open modal
     * @param {Object} tender - Tender data voor edit mode (optioneel)
     * @param {Object} options - Extra opties zoals {scrollToSection: 'team'}
     */
    open(tender = null, options = {}) {
        // Reset form first
        this.modal.querySelector('#tender-form').reset();

        // Reset all checkboxes
        this.modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset status buttons
        this.modal.querySelectorAll('.status-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        this.modal.querySelector('.status-btn--pending').classList.add('active');
        this.modal.querySelector('#tender-status').value = 'pending';

        // Set mode
        this.editMode = tender !== null;
        this.currentTender = tender;

        // Update UI based on mode
        this.updateModalUI();

        // Populate form if editing
        if (this.editMode && tender) {
            this.populateForm(tender);
        } else {
            this.handleFaseChange('acquisitie');
        }

        // Show modal
        this.isOpen = true;
        this.modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';

        // ⭐ v2.1: Scroll naar specifieke sectie indien gewenst
        if (options.scrollToSection) {
            this.scrollToSection(options.scrollToSection);
        } else {
            // Scroll to top
            this.modal.querySelector('.modal-content').scrollTop = 0;
        }
    }

    /**
     * ⭐ v2.1: Scroll naar een specifieke sectie en expand deze
     * @param {string} sectionName - Sectie naam (bijv. 'team', 'partijen', 'timeline')
     */
    scrollToSection(sectionName) {
        // Mapping van sectie namen naar content ID's
        const sectionMapping = {
            'team': 'team-content',
            'partijen': 'partijen-content',
            'tenderbureau': 'tenderbureau-content',
            'gonogo': 'gonogo-content',
            'timeline': 'timeline-content',
            'classificatie': 'classificatie-content',
            'financieel': 'financieel-content',
            'documenten': 'documenten-content',
            'eisen': 'eisen-content',
            'risico': 'risico-content'
        };

        const contentId = sectionMapping[sectionName];
        if (!contentId) {
            console.warn(`Section '${sectionName}' not found`);
            this.modal.querySelector('.modal-content').scrollTop = 0;
            return;
        }

        const sectionContent = this.modal.querySelector(`#${contentId}`);
        if (!sectionContent) {
            console.warn(`Section content '#${contentId}' not found in DOM`);
            this.modal.querySelector('.modal-content').scrollTop = 0;
            return;
        }

        // Expand de sectie als deze collapsed is
        if (sectionContent.classList.contains('collapsed')) {
            sectionContent.classList.remove('collapsed');
            const toggleBtn = this.modal.querySelector(`[data-target="${contentId}"]`);
            if (toggleBtn) {
                toggleBtn.classList.add('expanded');
            }
        }

        // Wacht even tot DOM is bijgewerkt, dan scroll
        setTimeout(() => {
            const sectionHeader = sectionContent.previousElementSibling;
            const scrollTarget = sectionHeader || sectionContent;

            scrollTarget.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            // Flash effect om aandacht te trekken
            sectionContent.classList.add('section-highlight');
            setTimeout(() => {
                sectionContent.classList.remove('section-highlight');
            }, 1500);

            console.log(`📍 Scrolled to section: ${sectionName}`);
        }, 100);
    }

    /**
     * Close modal
     */
    close() {
        this.isOpen = false;
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto';

        this.editMode = false;
        this.currentTender = null;

        this.modal.querySelector('#tender-form').reset();
    }
}

export default TenderAanmaken;