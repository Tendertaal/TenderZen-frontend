/**
 * FaseTransitieModal — Bevestigings/waarschuwingsmodal voor Kanban fase transities
 * TenderZen v1.0
 *
 * Gebruikt Icons uit icons.js voor consistentie door de hele app.
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

        // Transitie indicator (Van → Naar)
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
    // FASE KLEUREN & ICONEN (via Icons library)
    // ============================================

    _getFaseConfig(fase) {
        const iconOpts = { size: 14, color: 'currentColor' };
        const configs = {
            acquisitie:     { kleur: '#ea580c', label: 'Acquisitie',  icon: Icons.search(iconOpts) },
            inschrijvingen: { kleur: '#2563eb', label: 'Lopend',      icon: Icons.edit(iconOpts) },
            ingediend:      { kleur: '#16a34a', label: 'Ingediend',   icon: Icons.checkCircle(iconOpts) },
            archief:        { kleur: '#64748b', label: 'Archief',     icon: Icons.archive(iconOpts) }
        };
        return configs[fase] || { kleur: '#94a3b8', label: fase, icon: Icons.clipboardList(iconOpts) };
    }

    // ============================================
    // TONEN
    // ============================================

    /**
     * Toon de modal en wacht op bevestiging.
     * @param {Object} transitie — Resultaat van evalueerTransitie()
     * @returns {Promise<boolean>} true als bevestigd, false als geannuleerd
     */
    show(transitie) {
        return new Promise((resolve) => {
            this._resolve = resolve;

            const isWaarschuwing = transitie.type === 'waarschuw';

            // Icon — via Icons library
            this.iconEl.innerHTML = isWaarschuwing
                ? Icons.warning({ size: 28, color: IconColors.amber })
                : Icons.helpCircle({ size: 28, color: IconColors.indigo });

            this.iconEl.className = `fase-transitie-icon ${isWaarschuwing ? 'warning' : 'confirm'}`;

            // Titel
            this.titleEl.textContent = transitie.titel || 'Fase wijzigen';

            // Transitie bar (Van → Naar)
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
                <span class="fase-arrow">→</span>
                <span class="fase-badge" style="--fase-kleur: ${naarCfg.kleur}">
                    ${naarCfg.icon} ${transitie.naarLabel}
                </span>
            `;

            // Bericht
            this.berichtEl.textContent = transitie.bericht || '';

            // Waarschuwingen — via Icons library
            if (transitie.warnings && transitie.warnings.length > 0) {
                this.warningsEl.style.display = 'block';
                const warningIcon = Icons.alertCircle({ size: 16, color: IconColors.amber });
                this.warningsEl.innerHTML = transitie.warnings.map(w => `
                    <div class="fase-warning-item">
                        ${warningIcon}
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