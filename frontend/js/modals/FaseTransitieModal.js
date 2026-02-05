/**
 * FaseTransitieModal - Bevestigings/waarschuwingsmodal voor Kanban fase transities
 * TenderZen v1.0
 *
 * Gebruik:
 *   const modal = new FaseTransitieModal();
 *   const confirmed = await modal.show(transitieResult);
  *   if (confirmed) { // voer transitie uit }
 */

export class FaseTransitieModal {
    constructor() {
        this.overlay = null;
        this._resolve = null;
        this._createDOM();
    }

    // ============================================
    // DOM OPBOUW
    // ============================================

    _createDOM() {
        // Overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'fase-transitie-overlay';
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this._close(false);
        });

        // Modal
        this.modal = document.createElement('div');
        this.modal.className = 'fase-transitie-modal';

        // Header
        this.header = document.createElement('div');
        this.header.className = 'fase-transitie-header';

        this.iconEl = document.createElement('div');
        this.iconEl.className = 'fase-transitie-icon';

        this.titleEl = document.createElement('h3');
        this.titleEl.className = 'fase-transitie-title';

        this.header.appendChild(this.iconEl);
        this.header.appendChild(this.titleEl);

        // Transitie indicator (Van â†’ Naar)
        this.transitieBar = document.createElement('div');
        this.transitieBar.className = 'fase-transitie-bar';

        // Bericht
        this.berichtEl = document.createElement('p');
        this.berichtEl.className = 'fase-transitie-bericht';

        // Waarschuwingen container
        this.warningsEl = document.createElement('div');
        this.warningsEl.className = 'fase-transitie-warnings';

        // Buttons
        this.buttonsEl = document.createElement('div');
        this.buttonsEl.className = 'fase-transitie-buttons';

        this.cancelBtn = document.createElement('button');
        this.cancelBtn.className = 'fase-transitie-btn cancel';
        this.cancelBtn.textContent = 'Annuleren';
        this.cancelBtn.addEventListener('click', () => this._close(false));

        this.confirmBtn = document.createElement('button');
        this.confirmBtn.className = 'fase-transitie-btn confirm';
        this.confirmBtn.textContent = 'Toch verplaatsen';
        this.confirmBtn.addEventListener('click', () => this._close(true));

        this.buttonsEl.appendChild(this.cancelBtn);
        this.buttonsEl.appendChild(this.confirmBtn);

        // Assemble
        this.modal.appendChild(this.header);
        this.modal.appendChild(this.transitieBar);
        this.modal.appendChild(this.berichtEl);
        this.modal.appendChild(this.warningsEl);
        this.modal.appendChild(this.buttonsEl);
        this.overlay.appendChild(this.modal);
    }

    // ============================================
    // FASE KLEUREN & ICONEN
    // ============================================

    _getFaseConfig(fase) {
        const configs = {
            acquisitie: { kleur: '#ea580c', label: 'Acquisitie', icon: '\uD83D\uDD0D' }, // 🔍
            inschrijvingen: { kleur: '#2563eb', label: 'Lopend', icon: '\u270F\uFE0F' }, // ✏️
            ingediend: { kleur: '#16a34a', label: 'Ingediend', icon: '\uD83D\uDCE4' }, // 📤
            archief: { kleur: '#64748b', label: 'Archief', icon: '\uD83D\uDCC1' } // 📁
        };
        return configs[fase] || { kleur: '#94a3b8', label: fase, icon: '\uD83D\uDCCB' }; // 📋
    }

    // ============================================
    // TONEN
    // ============================================

    /**
     * Toon de modal en wacht op bevestiging.
     * @param {Object} transitie â€” Resultaat van evalueerTransitie()
     * @returns {Promise<boolean>} true als bevestigd, false als geannuleerd
     */
    show(transitie) {
        return new Promise((resolve) => {
            this._resolve = resolve;

            const isWaarschuwing = transitie.type === 'waarschuw';

            // Icon
            this.iconEl.innerHTML = isWaarschuwing
                ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
                : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

            this.iconEl.className = `fase-transitie-icon ${isWaarschuwing ? 'warning' : 'confirm'}`;

            // Titel
            this.titleEl.textContent = transitie.titel || 'Fase wijzigen';

            // Transitie bar (Van â†’ Naar)
            const vanConfig = this._getFaseConfig(transitie.vanLabel?.toLowerCase() === 'lopend' ? 'inschrijvingen' : transitie.vanLabel?.toLowerCase());
            const naarConfig = this._getFaseConfig(transitie.naarLabel?.toLowerCase() === 'lopend' ? 'inschrijvingen' : transitie.naarLabel?.toLowerCase());

            // Lookup by label instead
            const vanFaseKey = Object.entries({
                acquisitie: 'Acquisitie',
                inschrijvingen: 'Lopend',
                ingediend: 'Ingediend',
                archief: 'Archief'
            }).find(([k, v]) => v === transitie.vanLabel)?.[0] || 'acquisitie';

            const naarFaseKey = Object.entries({
                acquisitie: 'Acquisitie',
                inschrijvingen: 'Lopend',
                ingediend: 'Ingediend',
                archief: 'Archief'
            }).find(([k, v]) => v === transitie.naarLabel)?.[0] || 'acquisitie';

            const vanCfg = this._getFaseConfig(vanFaseKey);
            const naarCfg = this._getFaseConfig(naarFaseKey);

            this.transitieBar.innerHTML = `
                <span class="fase-badge" style="--fase-kleur: ${vanCfg.kleur}">
                    ${vanCfg.icon} ${transitie.vanLabel}
                </span>
                <span class="fase-arrow">&#8594;</span>
                <span class="fase-badge" style="--fase-kleur: ${naarCfg.kleur}">
                    ${naarCfg.icon} ${transitie.naarLabel}
                </span>
            `;

            // Bericht
            this.berichtEl.textContent = transitie.bericht || '';

            // Waarschuwingen
            if (transitie.warnings && transitie.warnings.length > 0) {
                this.warningsEl.style.display = 'block';
                this.warningsEl.innerHTML = transitie.warnings.map(w => `
                    <div class="fase-warning-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>${w}</span>
                    </div>
                `).join('');
            } else {
                this.warningsEl.style.display = 'none';
            }

            // Button styling
            this.modal.className = `fase-transitie-modal ${isWaarschuwing ? 'is-warning' : 'is-confirm'}`;
            this.confirmBtn.textContent = isWaarschuwing ? 'Toch verplaatsen' : 'Bevestigen';

            // Mount en animeer
            document.body.appendChild(this.overlay);

            // Force reflow voor animatie
            this.overlay.offsetHeight;
            requestAnimationFrame(() => {
                this.overlay.classList.add('visible');
            });

            // Focus op annuleren (veiligste keuze)
            this.cancelBtn.focus();

            // Escape key
            this._escHandler = (e) => {
                if (e.key === 'Escape') this._close(false);
            };
            document.addEventListener('keydown', this._escHandler);
        });
    }

    // ============================================
    // SLUITEN
    // ============================================

    _close(confirmed) {
        this.overlay.classList.remove('visible');

        // Wacht op fade-out animatie
        setTimeout(() => {
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
            document.removeEventListener('keydown', this._escHandler);

            if (this._resolve) {
                this._resolve(confirmed);
                this._resolve = null;
            }
        }, 200);
    }
}