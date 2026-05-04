/**
 * BedrijvenSuperAdminView — Globale bedrijvenlijst voor super-admin
 * TenderZen v1.0
 *
 * Interface: mount(container) / unmount()
 * Laadt bedrijven via BedrijvenService.getAlleBedrijvenSuperAdmin() (RPC).
 * Ondersteunt zoeken, branche-filter, niet-gekoppeld, niet-verrijkt, paginering.
 */

class BedrijvenSuperAdminView {

    constructor() {
        this.container = null;
        this._saState = {
            q:             '',
            branche:       '',
            nietGekoppeld: false,
            nietVerrijkt:  false,
            pagina:        1,
            perPagina:     50,
            totaal:        0,
            laden:         false,
        };
        this._searchTimer = null;
    }

    // ── App.js interface ──────────────────────────────────────────────────

    mount(container) {
        this.container = container;
        container.innerHTML = this._renderSkeleton();
        this._bindEvents();
        this._laadBedrijven();
    }

    unmount() {
        clearTimeout(this._searchTimer);
        if (this.container) this.container.innerHTML = '';
        this.container = null;
    }

    // ── Skeleton HTML ─────────────────────────────────────────────────────

    _renderSkeleton() {
        return `
        <div class="bv-sa-container">
            <!-- Header -->
            <div class="bv-sa-header">
                <h1 class="bv-sa-title">Bedrijven</h1>
                <button class="bv-sa-import-btn" id="bv-import-btn">
                    ${this._icon('upload', 15)} Importeren
                </button>
            </div>

            <!-- Stats strip -->
            <div class="bv-sa-stats" id="bv-stats">
                <div class="bv-stat-card">
                    <div class="bv-stat-value" id="bv-stat-totaal">—</div>
                    <div class="bv-stat-label">Totaal bedrijven</div>
                </div>
                <div class="bv-stat-card">
                    <div class="bv-stat-value" id="bv-stat-gekoppeld">—</div>
                    <div class="bv-stat-label">Gekoppeld aan bureau</div>
                </div>
                <div class="bv-stat-card">
                    <div class="bv-stat-value" id="bv-stat-verrijkt">—</div>
                    <div class="bv-stat-label">KvK verrijkt</div>
                </div>
            </div>

            <!-- Zoek & filter bar -->
            <div class="bv-sa-toolbar">
                <div class="bv-search-wrap">
                    ${this._icon('search', 15, '#94a3b8')}
                    <input
                        type="text"
                        id="bv-search"
                        class="bv-search-input"
                        placeholder="Zoek op naam, KvK, plaats..."
                        autocomplete="off"
                    >
                </div>
                <select id="bv-filter-branche" class="bv-filter-select">
                    <option value="">Alle branches</option>
                    <option value="Bouw &amp; Infra">Bouw &amp; Infra</option>
                    <option value="IT &amp; Software">IT &amp; Software</option>
                    <option value="Zorg &amp; Gezondheid">Zorg &amp; Gezondheid</option>
                    <option value="Groen &amp; Milieu">Groen &amp; Milieu</option>
                    <option value="Energie &amp; Utiliteit">Energie &amp; Utiliteit</option>
                    <option value="Logistiek &amp; Transport">Logistiek &amp; Transport</option>
                    <option value="Beveiliging &amp; Veiligheid">Beveiliging &amp; Veiligheid</option>
                    <option value="Facilitair &amp; Services">Facilitair &amp; Services</option>
                    <option value="Onderwijs &amp; Training">Onderwijs &amp; Training</option>
                    <option value="HR &amp; Recruitment">HR &amp; Recruitment</option>
                    <option value="Advies &amp; Consultancy">Advies &amp; Consultancy</option>
                    <option value="Financieel &amp; Juridisch">Financieel &amp; Juridisch</option>
                    <option value="Industrie &amp; Productie">Industrie &amp; Productie</option>
                    <option value="Handel &amp; Retail">Handel &amp; Retail</option>
                    <option value="Overheid &amp; Non-profit">Overheid &amp; Non-profit</option>
                </select>
                <label class="bv-filter-check">
                    <input type="checkbox" id="bv-filter-niet-gekoppeld">
                    Niet gekoppeld
                </label>
                <label class="bv-filter-check">
                    <input type="checkbox" id="bv-filter-niet-verrijkt">
                    Niet verrijkt
                </label>
            </div>

            <!-- Tabel -->
            <div class="bv-sa-table-wrap">
                <table class="bv-sa-table">
                    <thead>
                        <tr>
                            <th>Naam &amp; Plaats</th>
                            <th>Branche</th>
                            <th>KvK</th>
                            <th>Bureaus</th>
                            <th>Referenties</th>
                            <th>Verrijkt</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="bv-table-body">
                        <tr><td colspan="7" class="bv-loading-row">Laden...</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- Paginering -->
            <div class="bv-sa-pagination" id="bv-pagination">
                <button class="bv-pag-btn" id="bv-pag-prev" disabled>
                    ${this._icon('chevronLeft', 15)} Vorige
                </button>
                <span class="bv-pag-info" id="bv-pag-info">Pagina 1</span>
                <button class="bv-pag-btn" id="bv-pag-next">
                    Volgende ${this._icon('chevronRight', 15)}
                </button>
            </div>
        </div>`;
    }

    // ── Events ────────────────────────────────────────────────────────────

    _bindEvents() {
        const c = this.container;

        // Zoeken — debounced 400ms
        c.querySelector('#bv-search')?.addEventListener('input', (e) => {
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => {
                this._saState.q = e.target.value.trim();
                this._saState.pagina = 1;
                this._laadBedrijven();
            }, 400);
        });

        // Branche filter
        c.querySelector('#bv-filter-branche')?.addEventListener('change', (e) => {
            this._saState.branche = e.target.value;
            this._saState.pagina = 1;
            this._laadBedrijven();
        });

        // Checkboxes
        c.querySelector('#bv-filter-niet-gekoppeld')?.addEventListener('change', (e) => {
            this._saState.nietGekoppeld = e.target.checked;
            this._saState.pagina = 1;
            this._laadBedrijven();
        });

        c.querySelector('#bv-filter-niet-verrijkt')?.addEventListener('change', (e) => {
            this._saState.nietVerrijkt = e.target.checked;
            this._saState.pagina = 1;
            this._laadBedrijven();
        });

        // Paginering
        c.querySelector('#bv-pag-prev')?.addEventListener('click', () => {
            if (this._saState.pagina > 1) {
                this._saState.pagina--;
                this._laadBedrijven();
            }
        });

        c.querySelector('#bv-pag-next')?.addEventListener('click', () => {
            const maxPagina = Math.ceil(this._saState.totaal / this._saState.perPagina);
            if (this._saState.pagina < maxPagina) {
                this._saState.pagina++;
                this._laadBedrijven();
            }
        });

        // Actie knoppen — event delegation op tbody
        c.querySelector('#bv-table-body')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-actie]');
            if (!btn) return;
            const actie = btn.dataset.actie;
            const id    = btn.dataset.id;
            if (actie === 'profiel')  this._openProfiel(id);
            if (actie === 'koppelen') this._openKoppelenModal(id);
            if (actie === 'kvk')      this._kvkOpzoeken(id, btn.dataset.naam, btn.dataset.plaats);
        });

        // Import knop
        c.querySelector('#bv-import-btn')?.addEventListener('click', () => {
            this._openImportModal();
        });
    }

    // ── Laden ─────────────────────────────────────────────────────────────

    async _laadBedrijven() {
        if (this._saState.laden) return;
        this._saState.laden = true;

        const tbody = this.container?.querySelector('#bv-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" class="bv-loading-row">Laden...</td></tr>';
        }

        try {
            const { bedrijvenService } = await import('../services/Bedrijvenservice.js');
            const offset = (this._saState.pagina - 1) * this._saState.perPagina;

            const result = await bedrijvenService.getAlleBedrijvenSuperAdmin({
                q:             this._saState.q,
                branche:       this._saState.branche,
                nietGekoppeld: this._saState.nietGekoppeld,
                nietVerrijkt:  this._saState.nietVerrijkt,
                limit:         this._saState.perPagina,
                offset,
            });

            this._saState.totaal = result.totaal || 0;
            this._updateStats(result);
            this._renderTabel(result.bedrijven || []);
            this._updatePaginering();

        } catch (err) {
            console.error('[BedrijvenSuperAdminView] Fout laden:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="7" class="bv-error-row">
                    Fout bij laden: ${this._esc(err.message)}. Probeer opnieuw.
                </td></tr>`;
            }
        } finally {
            this._saState.laden = false;
        }
    }

    // ── Render helpers ────────────────────────────────────────────────────

    _updateStats(result) {
        const totaalEl    = this.container?.querySelector('#bv-stat-totaal');
        const gekoppeldEl = this.container?.querySelector('#bv-stat-gekoppeld');
        const verrijktEl  = this.container?.querySelector('#bv-stat-verrijkt');

        if (totaalEl) totaalEl.textContent = this._formatGetal(result.totaal || 0);

        // Gekoppeld en verrijkt: bereken uit huidige pagina (benadering bij paginering)
        // Voor exacte cijfers: aparte query bij eerste load zonder filters
        const rijen = result.bedrijven || [];
        if (gekoppeldEl && !this._statsGeladen) {
            const gekoppeld = rijen.filter(b => (b.gekoppelde_bureaus_count || 0) > 0).length;
            gekoppeldEl.textContent = this._saState.totaal === rijen.length
                ? this._formatGetal(gekoppeld)
                : '—';
        }
        if (verrijktEl && !this._statsGeladen) {
            const verrijkt = rijen.filter(b => !!b.kvk_verrijkt_op).length;
            verrijktEl.textContent = this._saState.totaal === rijen.length
                ? this._formatGetal(verrijkt)
                : '—';
        }

        // Bij initieel laden zonder filters: sla stats op als definitief
        if (!this._saState.q && !this._saState.branche
                && !this._saState.nietGekoppeld && !this._saState.nietVerrijkt
                && this._saState.pagina === 1 && !this._statsGeladen) {
            this._statsGeladen = true;
        }
    }

    _renderTabel(bedrijven) {
        const tbody = this.container?.querySelector('#bv-table-body');
        if (!tbody) return;

        if (!bedrijven.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="bv-loading-row">
                Geen bedrijven gevonden voor de huidige filters.
            </td></tr>`;
            return;
        }

        tbody.innerHTML = bedrijven.map(b => this._renderRij(b)).join('');
    }

    _renderRij(b) {
        const kvkStatus = b.kvk_nummer
            ? `<span class="bv-kvk-ok">${this._icon('check', 13, '#16a34a')} ${this._esc(b.kvk_nummer)}</span>`
            : `<span class="bv-kvk-leeg">—</span>`;

        const verrijktDatum = b.kvk_verrijkt_op
            ? `<span class="bv-verrijkt-datum">${this._formatDatum(b.kvk_verrijkt_op)}</span>`
            : `<span class="bv-niet-verrijkt">Niet verrijkt</span>`;

        const bureaus = Number(b.gekoppelde_bureaus_count) || 0;
        const refs    = Number(b.referenties_count)        || 0;

        return `
        <tr class="bv-table-row" data-id="${this._esc(b.id)}">
            <td class="bv-td-naam">
                <div class="bv-bedrijf-naam">${this._esc(b.bedrijfsnaam)}</div>
                ${b.plaats ? `<div class="bv-bedrijf-plaats">${this._esc(b.plaats)}</div>` : ''}
            </td>
            <td>
                ${b.branche
                    ? `<span class="bv-branche-tag">${this._esc(b.branche)}</span>`
                    : '<span class="bv-leeg">—</span>'}
            </td>
            <td>${kvkStatus}</td>
            <td>
                <span class="bv-count ${bureaus > 0 ? 'bv-count-actief' : 'bv-count-leeg'}">
                    ${bureaus}
                </span>
            </td>
            <td>
                <span class="bv-count ${refs > 0 ? 'bv-count-actief' : 'bv-count-leeg'}">
                    ${refs}
                </span>
            </td>
            <td>${verrijktDatum}</td>
            <td class="bv-td-acties">
                <div class="bv-acties-wrap">
                    <button class="bv-actie-btn" data-actie="koppelen" data-id="${this._esc(b.id)}" title="Koppelen aan bureau">
                        ${this._icon('link', 13)} Koppelen
                    </button>
                    <button class="bv-actie-btn" data-actie="kvk" data-id="${this._esc(b.id)}"
                            data-naam="${this._esc(b.bedrijfsnaam)}" data-plaats="${this._esc(b.plaats || '')}" title="KvK opzoeken">
                        ${this._icon('search', 13)} KvK
                    </button>
                    <button class="bv-actie-btn bv-actie-primary" data-actie="profiel" data-id="${this._esc(b.id)}" title="Bedrijfsprofiel">
                        ${this._icon('building', 13)} Profiel
                    </button>
                </div>
            </td>
        </tr>`;
    }

    _updatePaginering() {
        const { pagina, perPagina, totaal } = this._saState;
        const maxPagina = Math.max(1, Math.ceil(totaal / perPagina));

        const infoEl = this.container?.querySelector('#bv-pag-info');
        const prevBtn = this.container?.querySelector('#bv-pag-prev');
        const nextBtn = this.container?.querySelector('#bv-pag-next');

        if (infoEl) {
            infoEl.textContent = totaal > 0
                ? `Pagina ${pagina} van ${maxPagina} (${this._formatGetal(totaal)} bedrijven)`
                : 'Geen resultaten';
        }
        if (prevBtn) prevBtn.disabled = pagina <= 1;
        if (nextBtn) nextBtn.disabled = pagina >= maxPagina;
    }

    // ── Stub methodes (prioriteit 2-5) ────────────────────────────────────

    _openProfiel(bedrijfId) {
        window.BedrijfsprofielModal.open(bedrijfId);
    }

    _openKoppelenModal(bedrijfId) {
        console.log('[BedrijvenSuperAdminView] Koppelen modal:', bedrijfId);
        window.ConfirmDialog?.show({
            titel: 'Binnenkort beschikbaar',
            bericht: 'Bureau koppelen wordt in een volgende release toegevoegd.',
            bevestigTekst: 'OK',
            annuleerTekst: null,
            type: 'info',
        });
    }

    _kvkOpzoeken(bedrijfId, naam, plaats) {
        console.log('[BedrijvenSuperAdminView] KvK opzoeken:', naam, plaats);
        window.ConfirmDialog?.show({
            titel: 'Binnenkort beschikbaar',
            bericht: 'KvK-verrijking wordt in een volgende release toegevoegd.',
            bevestigTekst: 'OK',
            annuleerTekst: null,
            type: 'info',
        });
    }

    _openImportModal() {
        // Verwijder eventueel oud modal
        document.getElementById('bv-import-modal')?.remove();

        const modal = document.createElement('div');
        modal.id = 'bv-import-modal';
        modal.className = 'bv-import-overlay';
        modal.innerHTML = this._renderImportModal();
        document.body.appendChild(modal);

        // Sluit op overlay-klik
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this._sluitImportModal();
        });

        // Sluit-knop
        modal.querySelector('#bv-imp-sluit')?.addEventListener('click', () => {
            this._sluitImportModal();
        });

        // Bestand kiezen
        modal.querySelector('#bv-imp-file-input')?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) this._leesImportBestand(file);
        });

        // Drop zone
        const dropZone = modal.querySelector('#bv-imp-drop');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('bv-imp-drop-over');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('bv-imp-drop-over');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('bv-imp-drop-over');
                const file = e.dataTransfer.files?.[0];
                if (file) this._leesImportBestand(file);
            });
            dropZone.addEventListener('click', () => {
                modal.querySelector('#bv-imp-file-input')?.click();
            });
        }

        // Start-knop
        modal.querySelector('#bv-imp-start')?.addEventListener('click', () => {
            this._startImport();
        });
    }

    _renderImportModal() {
        return `
        <div class="bv-import-modal">
            <div class="bv-import-modal-header">
                <h2 class="bv-import-modal-title">${this._icon('upload', 18)} Bedrijven importeren</h2>
                <button class="bv-import-modal-sluit" id="bv-imp-sluit" title="Sluiten">
                    ${this._icon('x', 18)}
                </button>
            </div>

            <div class="bv-import-modal-body">
                <!-- Stap 1: Bestand selecteren -->
                <div id="bv-imp-stap-bestand">
                    <p class="bv-imp-uitleg">
                        Upload een JSON-bestand met bedrijven. Elk object heeft de compacte sleutels:
                        <code>n</code> (naam), <code>s</code> (stad), <code>c</code> (branche),
                        <code>r</code> (tags-array), <code>t</code> (aantal referenties).
                    </p>

                    <div class="bv-imp-drop-zone" id="bv-imp-drop">
                        <input type="file" id="bv-imp-file-input" accept=".json" style="display:none">
                        <div class="bv-imp-drop-icoon">${this._icon('upload', 32, '#94a3b8')}</div>
                        <div class="bv-imp-drop-tekst">Sleep een JSON-bestand hierheen of klik om te kiezen</div>
                        <div class="bv-imp-drop-sub">Maximaal 50.000 records per import</div>
                    </div>

                    <div id="bv-imp-preview" class="bv-imp-preview" style="display:none">
                        <div class="bv-imp-preview-rij">
                            <span class="bv-imp-preview-label">Bestand:</span>
                            <span id="bv-imp-preview-naam" class="bv-imp-preview-waarde">—</span>
                        </div>
                        <div class="bv-imp-preview-rij">
                            <span class="bv-imp-preview-label">Aantal records:</span>
                            <span id="bv-imp-preview-count" class="bv-imp-preview-waarde">—</span>
                        </div>
                        <div class="bv-imp-preview-rij">
                            <span class="bv-imp-preview-label">Voorbeeld:</span>
                            <span id="bv-imp-preview-voorbeeld" class="bv-imp-preview-waarde bv-imp-voorbeeld-tekst">—</span>
                        </div>
                    </div>

                    <div id="bv-imp-fout" class="bv-imp-fout" style="display:none"></div>
                </div>

                <!-- Stap 2: Voortgang -->
                <div id="bv-imp-stap-voortgang" style="display:none">
                    <div class="bv-imp-voortgang-wrap">
                        <div class="bv-imp-voortgang-label">
                            <span id="bv-imp-vg-bericht">Bezig met importeren...</span>
                            <span id="bv-imp-vg-pct">0%</span>
                        </div>
                        <div class="bv-imp-progress-bar">
                            <div class="bv-imp-progress-fill" id="bv-imp-vg-bar" style="width:0%"></div>
                        </div>
                        <div class="bv-imp-vg-stats">
                            <span>${this._icon('check', 13, '#16a34a')} <span id="bv-imp-vg-aangemaakt">0</span> aangemaakt</span>
                            <span>${this._icon('skip', 13, '#94a3b8')} <span id="bv-imp-vg-overgeslagen">0</span> overgeslagen</span>
                            <span>${this._icon('alertTriangle', 13, '#ef4444')} <span id="bv-imp-vg-fouten">0</span> fouten</span>
                        </div>
                    </div>
                </div>

                <!-- Stap 3: Klaar -->
                <div id="bv-imp-stap-klaar" style="display:none">
                    <div class="bv-imp-klaar-wrap">
                        <div class="bv-imp-klaar-icoon">${this._icon('checkCircle', 48, '#16a34a')}</div>
                        <h3 class="bv-imp-klaar-titel">Import voltooid</h3>
                        <div class="bv-imp-klaar-stats">
                            <div class="bv-imp-klaar-stat">
                                <span class="bv-imp-klaar-waarde bv-klaar-groen" id="bv-imp-klaar-aangemaakt">0</span>
                                <span class="bv-imp-klaar-label">Aangemaakt</span>
                            </div>
                            <div class="bv-imp-klaar-stat">
                                <span class="bv-imp-klaar-waarde bv-klaar-grijs" id="bv-imp-klaar-overgeslagen">0</span>
                                <span class="bv-imp-klaar-label">Overgeslagen</span>
                            </div>
                            <div class="bv-imp-klaar-stat">
                                <span class="bv-imp-klaar-waarde bv-klaar-rood" id="bv-imp-klaar-fouten">0</span>
                                <span class="bv-imp-klaar-label">Fouten</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="bv-import-modal-footer">
                <button class="bv-imp-annuleer-btn" id="bv-imp-sluit-footer">Annuleren</button>
                <button class="bv-imp-start-btn" id="bv-imp-start" disabled>
                    ${this._icon('upload', 15)} Importeren starten
                </button>
            </div>
        </div>`;
    }

    _leesImportBestand(file) {
        const modal = document.getElementById('bv-import-modal');
        const foutEl = modal?.querySelector('#bv-imp-fout');
        const previewEl = modal?.querySelector('#bv-imp-preview');
        const startBtn = modal?.querySelector('#bv-imp-start');

        if (foutEl) { foutEl.style.display = 'none'; foutEl.textContent = ''; }
        if (previewEl) previewEl.style.display = 'none';
        if (startBtn) startBtn.disabled = true;

        if (!file.name.endsWith('.json')) {
            if (foutEl) { foutEl.textContent = 'Alleen .json bestanden zijn toegestaan.'; foutEl.style.display = 'block'; }
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!Array.isArray(data)) throw new Error('JSON moet een array zijn.');
                if (data.length === 0) throw new Error('Array is leeg.');
                if (data.length > 50000) throw new Error(`Te veel records: ${data.length} (max 50.000).`);

                this._importData = data;

                // Preview
                const voorbeeld = data[0];
                const voorbeeldTekst = `${voorbeeld.n || '?'} — ${voorbeeld.s || '?'} (${voorbeeld.c || '?'})`;
                if (modal) {
                    modal.querySelector('#bv-imp-preview-naam').textContent = file.name;
                    modal.querySelector('#bv-imp-preview-count').textContent = `${data.length.toLocaleString('nl-NL')} records`;
                    modal.querySelector('#bv-imp-preview-voorbeeld').textContent = voorbeeldTekst;
                    previewEl.style.display = 'block';
                }
                if (startBtn) startBtn.disabled = false;

            } catch (err) {
                this._importData = null;
                if (foutEl) { foutEl.textContent = `Fout bij lezen: ${err.message}`; foutEl.style.display = 'block'; }
            }
        };
        reader.readAsText(file, 'utf-8');
    }

    async _startImport() {
        if (!this._importData || !this._importData.length) return;

        const modal = document.getElementById('bv-import-modal');
        if (!modal) return;

        // Schakel naar voortgangsstap
        modal.querySelector('#bv-imp-stap-bestand').style.display = 'none';
        modal.querySelector('#bv-imp-stap-voortgang').style.display = 'block';
        modal.querySelector('#bv-imp-start').disabled = true;
        const sluitFooter = modal.querySelector('#bv-imp-sluit-footer');
        if (sluitFooter) sluitFooter.textContent = 'Wacht...';

        const supabase = window.supabaseClient || window.supabase;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        try {
            const resp = await fetch('/api/v1/bedrijven/import/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(this._importData),
            });

            if (!resp.ok) {
                const fout = await resp.json().catch(() => ({ detail: resp.statusText }));
                throw new Error(fout.detail || `HTTP ${resp.status}`);
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const regels = buffer.split('\n');
                buffer = regels.pop(); // Bewaar onvolledige regel
                for (const regel of regels) {
                    if (regel.startsWith('data: ')) {
                        try {
                            const evt = JSON.parse(regel.slice(6));
                            this._verwerkImportEvent(evt, modal);
                        } catch (_) { /* ignore parse fout */ }
                    }
                }
            }

        } catch (err) {
            console.error('[BedrijvenSuperAdminView] Import fout:', err);
            modal.querySelector('#bv-imp-stap-voortgang').style.display = 'none';
            modal.querySelector('#bv-imp-stap-bestand').style.display = 'block';
            const foutEl = modal.querySelector('#bv-imp-fout');
            if (foutEl) { foutEl.textContent = `Import mislukt: ${err.message}`; foutEl.style.display = 'block'; }
            if (sluitFooter) sluitFooter.textContent = 'Annuleren';
            modal.querySelector('#bv-imp-start').disabled = false;
        }
    }

    _verwerkImportEvent(evt, modal) {
        if (!modal) return;

        const totaal = evt.totaal || 1;
        const verwerkt = evt.verwerkt || 0;
        const pct = Math.round((verwerkt / totaal) * 100);

        if (evt.type === 'voortgang' || evt.type === 'start') {
            modal.querySelector('#bv-imp-vg-bericht').textContent = evt.bericht || '';
            modal.querySelector('#bv-imp-vg-pct').textContent = `${pct}%`;
            modal.querySelector('#bv-imp-vg-bar').style.width = `${pct}%`;
            modal.querySelector('#bv-imp-vg-aangemaakt').textContent = (evt.aangemaakt || 0).toLocaleString('nl-NL');
            modal.querySelector('#bv-imp-vg-overgeslagen').textContent = (evt.overgeslagen || 0).toLocaleString('nl-NL');
            modal.querySelector('#bv-imp-vg-fouten').textContent = (evt.fouten || 0).toLocaleString('nl-NL');
        }

        if (evt.type === 'klaar') {
            // Toon klaar-stap
            modal.querySelector('#bv-imp-stap-voortgang').style.display = 'none';
            modal.querySelector('#bv-imp-stap-klaar').style.display = 'block';
            modal.querySelector('#bv-imp-klaar-aangemaakt').textContent = (evt.aangemaakt || 0).toLocaleString('nl-NL');
            modal.querySelector('#bv-imp-klaar-overgeslagen').textContent = (evt.overgeslagen || 0).toLocaleString('nl-NL');
            modal.querySelector('#bv-imp-klaar-fouten').textContent = (evt.fouten || 0).toLocaleString('nl-NL');

            const sluitFooter = modal.querySelector('#bv-imp-sluit-footer');
            if (sluitFooter) sluitFooter.textContent = 'Sluiten';
            modal.querySelector('#bv-imp-sluit-footer')?.addEventListener('click', () => {
                this._sluitImportModal();
                // Herlaad de tabel om nieuwe bedrijven te zien
                this._saState.pagina = 1;
                this._statsGeladen = false;
                this._laadBedrijven();
            }, { once: true });
        }

        if (evt.type === 'error') {
            modal.querySelector('#bv-imp-stap-voortgang').style.display = 'none';
            modal.querySelector('#bv-imp-stap-bestand').style.display = 'block';
            const foutEl = modal.querySelector('#bv-imp-fout');
            if (foutEl) { foutEl.textContent = evt.bericht || 'Onbekende fout'; foutEl.style.display = 'block'; }
            const sluitFooter = modal.querySelector('#bv-imp-sluit-footer');
            if (sluitFooter) sluitFooter.textContent = 'Annuleren';
        }
    }

    _sluitImportModal() {
        document.getElementById('bv-import-modal')?.remove();
        this._importData = null;
    }

    // ── Utilities ─────────────────────────────────────────────────────────

    _esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    _icon(name, size = 14, color = null) {
        const Icons = window.Icons || {};
        if (typeof Icons[name] === 'function') {
            return Icons[name]({ size, ...(color ? { color } : {}) });
        }
        return '';
    }

    _formatDatum(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    _formatGetal(n) {
        return Number(n).toLocaleString('nl-NL');
    }
}

window.BedrijvenSuperAdminView = BedrijvenSuperAdminView;
