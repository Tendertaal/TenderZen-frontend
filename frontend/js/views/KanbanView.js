/**
 * KanbanView — Kanban board voor tender fase management
 * TenderZen v2.7 — Dropdown portal naar document.body
 *
 * DOEL-PAD: Frontend/js/views/KanbanView.js
 *
 * CHANGELOG:
 * - v2.7: FIX — Dropdown menu wordt bij openen naar document.body verplaatst (portal)
 *         Dit omzeilt ALLE overflow clipping van parent containers
 *         Bij sluiten wordt het menu terug in de DOM geplaatst
 * - v2.6: position:fixed poging (werkt niet in alle browsers bij nested overflow)
 * - v2.5: DYNAMISCH — kolommen uit faseConfig (fase_config DB tabel)
 * - v2.4: Fase "evaluatie" toegevoegd → 5 kolommen
 * - v2.3: SVG iconen uit icons.js voor kolom headers
 * - v2.2: Solid color bar header op kaarten, voortgangsbalk fix
 * - v2.0: TenderCard componenten (Header, Body, Footer)
 * - v1.0: Initiële versie
 */

import { evalueerTransitie, TRANSITIE } from '../utils/FaseTransitieRules.js';
import { FaseTransitieModal } from '../modals/FaseTransitieModal.js';
import { TenderCardHeader } from '../components/TenderCardHeader.js';
import { TenderCardBody } from '../components/TenderCardBody.js';
import { TenderCardFooter } from '../components/TenderCardFooter.js';

// ============================================
// KLEUR UTILITIES
// ============================================

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 100, g: 116, b: 139 };
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

function maakBgKleur(hex) {
    const { r, g, b } = hexToRgb(hex);
    const mix = 0.93;
    return rgbToHex(r + (255 - r) * mix, g + (255 - g) * mix, b + (255 - b) * mix);
}

function maakDonkerder(hex, factor = 0.15) {
    const { r, g, b } = hexToRgb(hex);
    return rgbToHex(r * (1 - factor), g * (1 - factor), b * (1 - factor));
}

// ============================================
// ICON MAPPING
// ============================================

const ICON_MAP = {
    'search': 'search', 'edit': 'edit', 'upload': 'upload',
    'clock': 'clock', 'fileText': 'fileText', 'checkCircle': 'checkCircle',
    'archive': 'fileText',
    '\u{1F3AF}': 'search', '\u{270D}\u{FE0F}': 'edit', '\u{1F4EC}': 'upload',
    '\u{231B}': 'clock', '\u{23F3}': 'clock',
    '\u{1F4DD}': 'edit', '\u{1F4E4}': 'upload', '\u{1F4C1}': 'fileText', '\u{1F50D}': 'search',
};

function mapIcon(dbIcon) {
    return ICON_MAP[dbIcon] || ICON_MAP[dbIcon?.trim()] || 'fileText';
}

// ============================================
// DYNAMISCHE FASE META BOUWER
// ============================================

function buildFaseMeta(faseConfig) {
    const meta = {};
    faseConfig.forEach(fc => {
        const kleur = fc.kleur || '#64748b';
        meta[fc.fase] = {
            label: fc.naam_display || fc.fase,
            kleur: kleur,
            bgKleur: maakBgKleur(kleur),
            iconFn: mapIcon(fc.icon || 'fileText'),
            statusLabel: fc.beschrijving || '',
            gradientStart: maakDonkerder(kleur),
            gradientEnd: kleur
        };
    });
    return meta;
}

// ============================================
// KANBAN VIEW CLASS
// ============================================

export class KanbanView {
    constructor(options = {}) {
        this.container = null;
        this.tenders = [];
        this.draggedCard = null;
        this.draggedTenderId = null;
        this.allFaseStatussen = options.allFaseStatussen || {};

        const faseConfig = (options.faseConfig || []).sort((a, b) => a.volgorde - b.volgorde);
        this.kanbanFases = faseConfig.map(fc => fc.fase);
        this.faseMeta = buildFaseMeta(faseConfig);

        if (this.kanbanFases.length === 0) {
            console.warn('KanbanView: geen faseConfig meegegeven, fallback naar defaults');
            this.kanbanFases = ['acquisitie', 'inschrijvingen', 'ingediend', 'archief'];
            this.faseMeta = {
                acquisitie:    { label: 'Acquisitie', kleur: '#ea580c', bgKleur: '#fff7ed', iconFn: 'search',   statusLabel: 'In verkenning',    gradientStart: '#d97706', gradientEnd: '#e5921a' },
                inschrijvingen:{ label: 'Lopend',     kleur: '#7c3aed', bgKleur: '#f5f3ff', iconFn: 'edit',     statusLabel: 'Actief',           gradientStart: '#6d5ccd', gradientEnd: '#7c6fe0' },
                ingediend:     { label: 'Ingediend',  kleur: '#16a34a', bgKleur: '#f0fdf4', iconFn: 'upload',   statusLabel: 'Wacht op gunning', gradientStart: '#0d9263', gradientEnd: '#10b981' },
                archief:       { label: 'Archief',    kleur: '#64748b', bgKleur: '#f8fafc', iconFn: 'fileText', statusLabel: 'Afgerond',         gradientStart: '#475569', gradientEnd: '#5a6b80' }
            };
        }

        this.transitieModal = new FaseTransitieModal();

        this.onTenderClick = options.onTenderClick || null;
        this.onFaseChange = options.onFaseChange || null;
        this.onCreateTender = options.onCreateTender || null;

        // v2.7: Portal dropdown state
        this._globalClickHandler = null;
        this._containerClickHandler = null;  // ⚠️ Voorkomt dubbele handlers
        this._activePortalMenu = null;       // Het menu element dat naar body is verplaatst
        this._activePortalPlaceholder = null; // Placeholder in originele positie
        this._activeDropdown = null;          // De dropdown container (.tch-status-dropdown)
        this._scrollHandler = null;

        console.log(`KanbanView v2.7 constructed (${this.kanbanFases.length} dynamische kolommen)`);
    }

    // ============================================
    // MOUNT / UNMOUNT
    // ============================================

    mount(container) {
        this.container = container;
        this.render();
        console.log('KanbanView mounted');
    }

    unmount() {
        this._closeAllDropdowns();
        if (this._containerClickHandler) {
            this.container?.removeEventListener('click', this._containerClickHandler);
            this._containerClickHandler = null;
        }
        if (this._globalClickHandler) {
            document.removeEventListener('click', this._globalClickHandler);
            this._globalClickHandler = null;
        }
        if (this._scrollHandler) {
            document.removeEventListener('scroll', this._scrollHandler, true);
            this._scrollHandler = null;
        }
        if (this.container) this.container.innerHTML = '';
        this.container = null;
    }

    setTenders(tenders) {
        this.tenders = tenders || [];
        if (this.container) this.render();
    }

    setFaseStatussen(faseStatussen) {
        this.allFaseStatussen = faseStatussen || {};
    }

    _getTendersForFase(fase) {
        return this.tenders
            .filter(t => t.fase === fase)
            .sort((a, b) => {
                const dA = a.deadline_indiening ? new Date(a.deadline_indiening) : null;
                const dB = b.deadline_indiening ? new Date(b.deadline_indiening) : null;
                if (!dA && !dB) return 0;
                if (!dA) return 1;
                if (!dB) return -1;
                return dA - dB;
            });
    }

    _getIcon(iconName, options = {}) {
        if (window.Icons && typeof window.Icons[iconName] === 'function') {
            return window.Icons[iconName](options);
        }
        return '';
    }

    // ============================================
    // RENDER
    // ============================================

    render() {
        if (!this.container) return;

        // Sluit eventueel open portal dropdown voordat DOM wordt vervangen
        this._closeAllDropdowns();

        const html = `
            <div class="kanban-board">
                ${this.kanbanFases.map(fase => this._renderKolom(fase)).join('')}
            </div>
        `;

        this.container.innerHTML = html;
        this._attachDragListeners();
        this._attachClickListeners();
    }

    _renderKolom(fase) {
        const meta = this.faseMeta[fase];
        if (!meta) return '';

        const tenders = this._getTendersForFase(fase);
        const headerIcon = this._getIcon(meta.iconFn, { size: 18, color: meta.kleur, strokeWidth: 2 });
        const emptyIcon = this._getIcon(meta.iconFn, { size: 32, color: '#cbd5e1', strokeWidth: 1.5 });
        const plusIcon = this._getIcon('plus', { size: 16, color: 'currentColor', strokeWidth: 2 });

        return `
            <div class="kanban-kolom" data-fase="${fase}">
                <div class="kanban-kolom-header" style="--fase-kleur: ${meta.kleur}; --fase-bg: ${meta.bgKleur}">
                    <div class="kanban-kolom-titel">
                        <span class="kanban-kolom-icon-wrap" style="--icon-kleur: ${meta.kleur}">
                            ${headerIcon}
                        </span>
                        <span class="kanban-kolom-label">${meta.label.toUpperCase()}</span>
                        <span class="kanban-kolom-count">${tenders.length}</span>
                    </div>
                    <span class="kanban-kolom-status">${meta.statusLabel}</span>
                </div>

                <div class="kanban-kolom-body" data-fase="${fase}">
                    ${tenders.length > 0
                        ? tenders.map(t => this._renderKaart(t, fase)).join('')
                        : `<div class="kanban-empty">
                            <span class="kanban-empty-icon">${emptyIcon}</span>
                            <span>Geen tenders</span>
                           </div>`
                    }
                </div>

                <button class="kanban-add-btn" data-fase="${fase}">
                    ${plusIcon}
                    Nieuwe tender
                </button>
            </div>
        `;
    }

    // ============================================
    // KAART RENDERING
    // ============================================

    _renderKaart(tender, fase) {
        const meta = this.faseMeta[fase] || this.faseMeta[Object.keys(this.faseMeta)[0]];
        const deadline = tender.deadline_indiening;
        const urgentie = this._getUrgentie(deadline);
        const planning = tender._planningCounts || { done: 0, total: 0 };
        const checklist = tender._checklistCounts || { done: 0, total: 0 };
        const voortgang = planning.total > 0 ? Math.round((planning.done / planning.total) * 100) : 0;

        const header = new TenderCardHeader({
            tender, allFaseStatussen: this.allFaseStatussen,
            size: 'compact', showActions: true, showStatusDropdown: true
        });

        const body = new TenderCardBody({
            tender, size: 'compact', showBureau: true
        });

        const footer = new TenderCardFooter({
            tenderId: tender.id,
            teamAssignments: tender.team_assignments || [],
            planningCounts: planning, checklistCounts: checklist,
            size: 'compact'
        });

        const waarde = tender.geraamde_waarde
            ? `\u20AC${Number(tender.geraamde_waarde).toLocaleString('nl-NL')}`
            : '';

        return `
            <div class="kanban-kaart"
                 draggable="true"
                 data-tender-id="${tender.id}"
                 data-fase="${fase}"
                 style="--kaart-accent: ${meta.kleur}">

                <div class="kanban-kaart-header-wrap"
                     style="background: linear-gradient(135deg, ${meta.gradientStart}, ${meta.gradientEnd})">
                    ${header.render()}
                </div>

                ${waarde ? `<div class="kanban-kaart-waarde">${waarde}</div>` : ''}

                ${body.render()}

                ${deadline ? `
                    <div class="kanban-deadline ${urgentie.class}">
                        ${this._getIcon('clock', { size: 14, color: 'currentColor', strokeWidth: 2 })}
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

                ${footer.render()}
            </div>
        `;
    }

    // ============================================
    // URGENTIE
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

    // ============================================
    // DRAG & DROP
    // ============================================

    _attachDragListeners() {
        const kaarten = this.container.querySelectorAll('.kanban-kaart');
        const bodies = this.container.querySelectorAll('.kanban-kolom-body');

        kaarten.forEach(kaart => {
            kaart.addEventListener('dragstart', (e) => {
                this.draggedCard = kaart;
                this.draggedTenderId = kaart.dataset.tenderId;
                kaart.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => kaart.style.opacity = '0.4', 0);
            });

            kaart.addEventListener('dragend', () => {
                kaart.classList.remove('dragging');
                kaart.style.opacity = '';
                this.draggedCard = null;
                this.draggedTenderId = null;
                bodies.forEach(b => b.classList.remove('drag-over'));
            });
        });

        bodies.forEach(body => {
            body.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                body.classList.add('drag-over');
            });

            body.addEventListener('dragleave', (e) => {
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

                await this._handleFaseTransitie(tender, oldFase, newFase);
            });
        });
    }

    async _handleFaseTransitie(tender, oldFase, newFase) {
        const transitie = evalueerTransitie(oldFase, newFase, tender);
        console.log(`Transitie ${oldFase} -> ${newFase}:`, transitie.type);

        if (transitie.type === TRANSITIE.VRIJ) {
            this._executeTransitie(tender, oldFase, newFase);
            return;
        }

        if (transitie.type === TRANSITIE.BEVESTIG || transitie.type === TRANSITIE.WAARSCHUW) {
            const confirmed = await this.transitieModal.show(transitie);
            if (confirmed) {
                this._executeTransitie(tender, oldFase, newFase);
            } else {
                this.render();
            }
            return;
        }

        if (transitie.skip) return;
    }

    _executeTransitie(tender, oldFase, newFase) {
        tender.fase = newFase;
        this.render();
        if (this.onFaseChange) {
            this.onFaseChange(tender.id, newFase, oldFase);
        }
    }

    // ============================================
    // v2.7: DROPDOWN PORTAL — Menu naar document.body
    //
    // Hoe het werkt:
    // 1. Bij openen: menu element wordt uit de kaart gehaald
    //    en aan document.body geappend met position:fixed
    // 2. Een onzichtbare placeholder behoudt de originele positie
    // 3. Bij sluiten: menu wordt teruggeplaatst in de dropdown
    // 4. Scroll listener herpositioneert het menu live
    // ============================================

    _openDropdown(dropdown) {
        // Sluit eventueel andere open dropdown
        this._closeAllDropdowns();

        const trigger = dropdown.querySelector('.tch-status-trigger');
        const menu = dropdown.querySelector('.tch-status-menu');
        if (!trigger || !menu) {
            console.warn('⚠️ Dropdown open: trigger of menu niet gevonden', { trigger: !!trigger, menu: !!menu });
            return;
        }

        console.log('📂 Dropdown openen voor tender:', dropdown.dataset.tenderId);

        // Markeer dropdown als open
        dropdown.classList.add('is-open');

        // Bewaar referenties
        this._activeDropdown = dropdown;
        this._activePortalMenu = menu;

        // Maak placeholder (zodat we menu later kunnen terugplaatsen)
        this._activePortalPlaceholder = document.createComment('portal-placeholder');
        menu.parentNode.insertBefore(this._activePortalPlaceholder, menu);

        // Verplaats menu naar document.body + portal class voor display:block
        menu.classList.add('tch-menu-portal');
        document.body.appendChild(menu);

        // Positioneer het menu
        this._positionPortalMenu(trigger, menu);

        // Scroll handler: herpositioneer bij scrollen
        this._scrollHandler = () => {
            if (this._activePortalMenu && this._activeDropdown) {
                const t = this._activeDropdown.querySelector('.tch-status-trigger');
                if (t) this._positionPortalMenu(t, this._activePortalMenu);
            }
        };
        document.addEventListener('scroll', this._scrollHandler, true);
    }

    _positionPortalMenu(trigger, menu) {
        const rect = trigger.getBoundingClientRect();

        // Reset styles
        menu.style.position = 'fixed';
        menu.style.display = 'block';
        menu.style.zIndex = '99999';
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.left = `${rect.left}px`;
        menu.style.right = 'auto';
        menu.style.bottom = 'auto';
        menu.style.minWidth = `${Math.max(rect.width, 200)}px`;
        menu.style.maxWidth = '280px';

        // Check rechterrand
        requestAnimationFrame(() => {
            const menuRect = menu.getBoundingClientRect();

            // Past het niet rechts?
            if (menuRect.right > window.innerWidth - 8) {
                menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
            }

            // Past het niet onder? Open naar boven
            if (menuRect.bottom > window.innerHeight - 8) {
                menu.style.top = `${rect.top - menuRect.height - 4}px`;
            }
        });
    }

    _closeDropdown(dropdown) {
        if (!dropdown) return;

        console.log('📁 Dropdown sluiten');

        dropdown.classList.remove('is-open');

        // Verplaats menu terug naar originele positie
        if (this._activePortalMenu && this._activePortalPlaceholder) {
            // Verwijder portal class en reset inline styles
            this._activePortalMenu.classList.remove('tch-menu-portal');
            this._activePortalMenu.style.cssText = '';

            // Plaats terug in DOM op originele positie
            if (this._activePortalPlaceholder.parentNode) {
                this._activePortalPlaceholder.parentNode.insertBefore(
                    this._activePortalMenu,
                    this._activePortalPlaceholder
                );
                this._activePortalPlaceholder.remove();
            } else {
                // Fallback: als placeholder weg is, append terug in dropdown
                const dropdownEl = this._activeDropdown || dropdown;
                dropdownEl.appendChild(this._activePortalMenu);
            }
        }

        // Verwijder scroll handler
        if (this._scrollHandler) {
            document.removeEventListener('scroll', this._scrollHandler, true);
            this._scrollHandler = null;
        }

        // Reset state
        this._activePortalMenu = null;
        this._activePortalPlaceholder = null;
        this._activeDropdown = null;
    }

    _closeAllDropdowns() {
        if (this._activeDropdown) {
            this._closeDropdown(this._activeDropdown);
        }
        // Cleanup: verwijder portaled menus die in body zijn achtergebleven
        document.querySelectorAll('body > .tch-status-menu, body > .tch-menu-portal').forEach(orphan => {
            orphan.classList.remove('tch-menu-portal');
            orphan.style.cssText = '';
            orphan.remove();
        });
        this.container?.querySelectorAll('.tch-status-dropdown.is-open').forEach(d => {
            d.classList.remove('is-open');
        });
    }

    // ============================================
    // CLICK LISTENERS — Event Delegation
    // ============================================

    _attachClickListeners() {
        if (!this.container) return;

        // ⚠️ v2.7 FIX: Verwijder oude handler vóór toevoegen
        // Zonder dit wordt bij elke render() een EXTRA listener toegevoegd,
        // waardoor 1 klik meerdere keren afvuurt (open→close→open→close)
        if (this._containerClickHandler) {
            this.container.removeEventListener('click', this._containerClickHandler);
        }

        this._containerClickHandler = (e) => {
            if (this.draggedCard) return;

            const target = e.target;

            // ── Status trigger click ──
            const statusTrigger = target.closest('.tch-status-trigger');
            if (statusTrigger) {
                e.stopPropagation();
                e.preventDefault();
                console.log('🔽 Status trigger geklikt');
                const dropdown = statusTrigger.closest('.tch-status-dropdown');
                if (dropdown) {
                    if (dropdown.classList.contains('is-open')) {
                        this._closeDropdown(dropdown);
                    } else {
                        this._openDropdown(dropdown);
                    }
                }
                return;
            }

            // ── Action buttons ──
            const actionEl = target.closest('[data-action]');
            if (actionEl) {
                e.stopPropagation();
                const action = actionEl.dataset.action;
                const tenderId = actionEl.dataset.tenderId;

                switch (action) {
                    case 'open-ai':
                    case 'open-ai-docs':
                        console.log('Open AI voor tender:', tenderId);
                        break;
                    case 'open-settings':
                        console.log('Open settings voor tender:', tenderId);
                        break;
                    case 'open-planning':
                    case 'open-checklist':
                    case 'edit-team':
                        if (this.onTenderClick) this.onTenderClick(tenderId);
                        break;
                }
                return;
            }

            // ── Add button ──
            const addBtn = target.closest('.kanban-add-btn');
            if (addBtn) {
                const fase = addBtn.dataset.fase;
                if (this.onCreateTender) this.onCreateTender(fase);
                return;
            }

            // ── Kaart click (open tender) ──
            const kaart = target.closest('.kanban-kaart');
            if (kaart) {
                const tenderId = kaart.dataset.tenderId;
                if (this.onTenderClick) this.onTenderClick(tenderId);
                return;
            }
        };

        this.container.addEventListener('click', this._containerClickHandler);

        // v2.7: Globale click handler — dropdown opties + buiten klikken
        if (this._globalClickHandler) {
            document.removeEventListener('click', this._globalClickHandler);
        }
        this._globalClickHandler = (e) => {
            const target = e.target;

            // ── Dropdown option click (menu zit nu in body) ──
            const dropdownOption = target.closest('.tch-dropdown-option');
            if (dropdownOption && this._activeDropdown) {
                e.stopPropagation();
                const newStatus = dropdownOption.dataset.value;
                const newFase = dropdownOption.dataset.fase;
                const tenderId = this._activeDropdown.dataset.tenderId;

                if (tenderId && newStatus) {
                    const tender = this.tenders.find(t => t.id === tenderId);
                    if (tender) {
                        const oldFase = tender.fase;
                        tender.fase_status = newStatus;

                        this._closeAllDropdowns();

                        if (newFase && newFase !== oldFase) {
                            this._handleFaseTransitie(tender, oldFase, newFase);
                        } else {
                            this.render();
                            if (this.onFaseChange) {
                                this.onFaseChange(tender.id, newFase || oldFase, oldFase);
                            }
                        }
                    }
                } else {
                    this._closeAllDropdowns();
                }
                return;
            }

            // ── Klik buiten dropdown/menu → sluiten ──
            if (!target.closest('.tch-status-dropdown') && !target.closest('.tch-status-menu')) {
                this._closeAllDropdowns();
            }
        };
        document.addEventListener('click', this._globalClickHandler);
    }
}