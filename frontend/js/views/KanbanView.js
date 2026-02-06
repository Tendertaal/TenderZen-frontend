/**
 * KanbanView — Kanban board voor tender fase management
 * TenderZen v1.3 — Met FaseTransitieRules & bevestigingsmodal
 *
 * DOEL-PAD:  Frontend/js/views/KanbanView.js
 *
 * CHANGELOG:
 * - v1.3: Fase "evaluatie" toegevoegd (label: Afronden, kleur: teal), 5 kolommen
 * - v1.2: Emoji encoding fix, gelijke kolombreedtes
 * - v1.1: Business rules integratie (vrij/bevestig/waarschuw bij drag & drop)
 * - v1.0: Initiële versie met drag & drop, 4 kolommen
 *
 * Features:
 * - 5 kolommen: Acquisitie, Lopend, Ingediend, Afronden, Archief
 * - Drag & drop met business rules (waarschuw maar blokkeer niet)
 * - FaseTransitieModal voor bevestigingen
 * - Kaarten gesorteerd op deadline
 * - Voortgangsbalk, team avatars, urgentie-kleuring
 *
 * Callbacks:
 * - onTenderClick(tenderId) — Klik op kaart
 * - onFaseChange(tenderId, newFase, oldFase) — Bevestigde fase-wijziging
 * - onCreateTender(fase) — "+ Nieuwe tender" knop
 */

import { evalueerTransitie, TRANSITIE } from '../utils/FaseTransitieRules.js';
import { FaseTransitieModal } from '../modals/FaseTransitieModal.js';

// ============================================
// FASE CONFIGURATIE
// ============================================

const FASE_META = {
    acquisitie: {
        label: 'Acquisitie',
        kleur: '#ea580c',
        bgKleur: '#fff7ed',
        icon: '\uD83D\uDD0D',
        statusLabel: 'In verkenning'
    },
    inschrijvingen: {
        label: 'Lopend',
        kleur: '#2563eb',
        bgKleur: '#eff6ff',
        icon: '\u270F\uFE0F',
        statusLabel: 'Actief'
    },
    ingediend: {
        label: 'Ingediend',
        kleur: '#16a34a',
        bgKleur: '#f0fdf4',
        icon: '\uD83D\uDCE4',
        statusLabel: 'Wacht op gunning'
    },
    evaluatie: {
        label: 'Afronden',
        kleur: '#0d9488',
        bgKleur: '#f0fdfa',
        icon: '\u23F3',
        statusLabel: 'In evaluatie'
    },
    archief: {
        label: 'Archief',
        kleur: '#64748b',
        bgKleur: '#f8fafc',
        icon: '\uD83D\uDCC1',
        statusLabel: 'Afgerond'
    }
};

const KANBAN_FASES = ['acquisitie', 'inschrijvingen', 'ingediend', 'evaluatie', 'archief'];

// ============================================
// KANBAN VIEW CLASS
// ============================================

export class KanbanView {
    constructor(options = {}) {
        this.container = null;
        this.tenders = [];
        this.draggedCard = null;
        this.draggedTenderId = null;

        // Business rules modal
        this.transitieModal = new FaseTransitieModal();

        // Callbacks
        this.onTenderClick = options.onTenderClick || null;
        this.onFaseChange = options.onFaseChange || null;
        this.onCreateTender = options.onCreateTender || null;

        console.log('\uD83D\uDCCB KanbanView constructed');
    }

    // ============================================
    // MOUNT / UNMOUNT
    // ============================================

    mount(container) {
        this.container = container;
        this.render();
        console.log('\uD83D\uDCCB KanbanView mounted');
    }

    unmount() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.container = null;
        console.log('\uD83D\uDCCB KanbanView unmounted');
    }

    // ============================================
    // DATA
    // ============================================

    setTenders(tenders) {
        this.tenders = tenders || [];
        if (this.container) {
            this.render();
        }
    }

    _getTendersForFase(fase) {
        return this.tenders
            .filter(t => t.fase === fase)
            .sort((a, b) => {
                // Sorteer op deadline (dichtstbij eerst), null onderaan
                const dA = a.deadline_indiening ? new Date(a.deadline_indiening) : null;
                const dB = b.deadline_indiening ? new Date(b.deadline_indiening) : null;
                if (!dA && !dB) return 0;
                if (!dA) return 1;
                if (!dB) return -1;
                return dA - dB;
            });
    }

    // ============================================
    // RENDER
    // ============================================

    render() {
        if (!this.container) return;

        const html = `
            <div class="kanban-board">
                ${KANBAN_FASES.map(fase => this._renderKolom(fase)).join('')}
            </div>
        `;

        this.container.innerHTML = html;
        this._attachDragListeners();
        this._attachClickListeners();
    }

    _renderKolom(fase) {
        const meta = FASE_META[fase];
        const tenders = this._getTendersForFase(fase);

        return `
            <div class="kanban-kolom" data-fase="${fase}">
                <div class="kanban-kolom-header" style="--fase-kleur: ${meta.kleur}">
                    <div class="kanban-kolom-titel">
                        <span class="kanban-kolom-icon">${meta.icon}</span>
                        <span class="kanban-kolom-label">${meta.label}</span>
                        <span class="kanban-kolom-count">${tenders.length}</span>
                    </div>
                    <span class="kanban-kolom-status">${meta.statusLabel}</span>
                </div>

                <div class="kanban-kolom-body" data-fase="${fase}">
                    ${tenders.length > 0
                        ? tenders.map(t => this._renderKaart(t, fase)).join('')
                        : `<div class="kanban-empty">
                            <span class="kanban-empty-icon">${meta.icon}</span>
                            <span>Geen tenders</span>
                           </div>`
                    }
                </div>

                <button class="kanban-add-btn" data-fase="${fase}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    Nieuwe tender
                </button>
            </div>
        `;
    }

    _renderKaart(tender, fase) {
        const meta = FASE_META[fase];
        const deadline = tender.deadline_indiening;
        const urgentie = this._getUrgentie(deadline);
        const planning = tender._planningCounts || { done: 0, total: 0 };
        const voortgang = planning.total > 0 ? Math.round((planning.done / planning.total) * 100) : 0;

        // Team avatars (max 3 + overflow)
        const team = tender.team_assignments || [];
        const maxAvatars = 3;
        const visibleTeam = team.slice(0, maxAvatars);
        const overflow = team.length - maxAvatars;

        // Type tag
        const type = tender.type_opdracht || tender.sector || '';

        // Waarde formatting
        const waarde = tender.geraamde_waarde
            ? `\u20AC${Number(tender.geraamde_waarde).toLocaleString('nl-NL')}`
            : '';

        // Archief: gewonnen/verloren badge
        const faseStatus = tender.fase_status || '';
        let statusBadge = '';
        if (fase === 'archief' && faseStatus) {
            const isGewonnen = faseStatus === 'gewonnen';
            statusBadge = `
                <span class="kanban-status-badge ${isGewonnen ? 'gewonnen' : 'verloren'}">
                    ${isGewonnen ? '\uD83C\uDFC6 Gewonnen' : '\u2717 Verloren'}
                </span>
            `;
        }

        return `
            <div class="kanban-kaart" 
                 draggable="true" 
                 data-tender-id="${tender.id}"
                 data-fase="${fase}"
                 style="--kaart-accent: ${meta.kleur}">

                <div class="kanban-kaart-top">
                    ${type ? `<span class="kanban-type-tag" style="--tag-kleur: ${meta.kleur}">${this._escHtml(type)}</span>` : ''}
                    ${statusBadge}
                    ${waarde ? `<span class="kanban-waarde">${waarde}</span>` : ''}
                </div>

                <h4 class="kanban-kaart-naam">${this._escHtml(tender.naam || 'Naamloos')}</h4>
                <p class="kanban-kaart-opdrachtgever">${this._escHtml(tender.opdrachtgever || '')}</p>

                ${deadline ? `
                    <div class="kanban-deadline ${urgentie.class}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        <span>${this._formatDate(deadline)}</span>
                        ${urgentie.label ? `<span class="kanban-urgentie-label">${urgentie.label}</span>` : ''}
                    </div>
                ` : ''}

                ${planning.total > 0 ? `
                    <div class="kanban-voortgang">
                        <div class="kanban-voortgang-bar">
                            <div class="kanban-voortgang-fill" style="width: ${voortgang}%; background: ${meta.kleur}"></div>
                        </div>
                        <span class="kanban-voortgang-label">${planning.done}/${planning.total}</span>
                    </div>
                ` : ''}

                ${visibleTeam.length > 0 ? `
                    <div class="kanban-team">
                        ${visibleTeam.map(m => `
                            <span class="kanban-avatar" 
                                  style="background: ${m.avatar_kleur || '#94a3b8'}"
                                  title="${this._escHtml(m.naam || '')}">
                                ${(m.initialen || m.naam?.substring(0, 2) || '??').toUpperCase()}
                            </span>
                        `).join('')}
                        ${overflow > 0 ? `<span class="kanban-avatar overflow">+${overflow}</span>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ============================================
    // URGENTIE BEREKENING
    // ============================================

    _getUrgentie(deadline) {
        if (!deadline) return { class: '', label: '' };
        const now = new Date();
        const dl = new Date(deadline);
        const dagen = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));

        if (dagen < 0) return { class: 'verlopen', label: 'Verlopen' };
        if (dagen <= 3) return { class: 'kritiek', label: `${dagen}d` };
        if (dagen <= 7) return { class: 'urgent', label: `${dagen}d` };
        if (dagen <= 14) return { class: 'binnenkort', label: '' };
        return { class: '', label: '' };
    }

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    _escHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================
    // DRAG & DROP — MET BUSINESS RULES
    // ============================================

    _attachDragListeners() {
        const kaarten = this.container.querySelectorAll('.kanban-kaart');
        const bodies = this.container.querySelectorAll('.kanban-kolom-body');

        // Kaarten: drag start/end
        kaarten.forEach(kaart => {
            kaart.addEventListener('dragstart', (e) => {
                this.draggedCard = kaart;
                this.draggedTenderId = kaart.dataset.tenderId;
                kaart.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                // Kleine delay voor visuele feedback
                setTimeout(() => kaart.style.opacity = '0.4', 0);
            });

            kaart.addEventListener('dragend', () => {
                kaart.classList.remove('dragging');
                kaart.style.opacity = '';
                this.draggedCard = null;
                this.draggedTenderId = null;
                // Verwijder alle drop-indicators
                bodies.forEach(b => b.classList.remove('drag-over'));
            });
        });

        // Kolom bodies: drop zones
        bodies.forEach(body => {
            body.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                body.classList.add('drag-over');
            });

            body.addEventListener('dragleave', (e) => {
                // Alleen als we echt de zone verlaten (niet bij child elements)
                if (!body.contains(e.relatedTarget)) {
                    body.classList.remove('drag-over');
                }
            });

            body.addEventListener('drop', async (e) => {
                e.preventDefault();
                body.classList.remove('drag-over');

                const newFase = body.dataset.fase;
                const tenderId = this.draggedTenderId;
                if (!tenderId || !newFase) return;

                const tender = this.tenders.find(t => t.id === tenderId);
                if (!tender) return;

                const oldFase = tender.fase;
                if (oldFase === newFase) return;

                // BUSINESS RULES EVALUATIE
                await this._handleFaseTransitie(tender, oldFase, newFase);
            });
        });
    }

    /**
     * Evalueer de transitie, toon eventueel modal, en voer uit als bevestigd.
     */
    async _handleFaseTransitie(tender, oldFase, newFase) {
        const transitie = evalueerTransitie(oldFase, newFase, tender);

        console.log(`\uD83D\uDCCB Transitie ${oldFase} \u2192 ${newFase}:`, transitie.type);

        // VRIJ: direct uitvoeren
        if (transitie.type === TRANSITIE.VRIJ) {
            this._executeTransitie(tender, oldFase, newFase);
            return;
        }

        // BEVESTIG of WAARSCHUW: modal tonen
        if (transitie.type === TRANSITIE.BEVESTIG || transitie.type === TRANSITIE.WAARSCHUW) {
            const confirmed = await this.transitieModal.show(transitie);

            if (confirmed) {
                this._executeTransitie(tender, oldFase, newFase);
            } else {
                console.log('\u274C Transitie geannuleerd door gebruiker');
                // Re-render om kaart terug te plaatsen
                this.render();
            }
            return;
        }

        // Skip (zelfde fase)
        if (transitie.skip) return;
    }

    /**
     * Voer de bevestigde transitie uit: update lokaal + trigger callback.
     */
    _executeTransitie(tender, oldFase, newFase) {
        // Lokale update (directe visuele feedback)
        tender.fase = newFase;
        this.render();

        // Callback naar App.js voor server-update
        if (this.onFaseChange) {
            this.onFaseChange(tender.id, newFase, oldFase);
        }
    }

    // ============================================
    // CLICK LISTENERS
    // ============================================

    _attachClickListeners() {
        // Kaart klik → detail
        this.container.querySelectorAll('.kanban-kaart').forEach(kaart => {
            kaart.addEventListener('click', (e) => {
                // Niet triggeren bij drag
                if (this.draggedCard) return;
                const tenderId = kaart.dataset.tenderId;
                if (this.onTenderClick) {
                    this.onTenderClick(tenderId);
                }
            });
        });

        // "+ Nieuwe tender" knop
        this.container.querySelectorAll('.kanban-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const fase = btn.dataset.fase;
                if (this.onCreateTender) {
                    this.onCreateTender(fase);
                }
            });
        });
    }
}