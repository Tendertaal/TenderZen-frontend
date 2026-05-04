/**
 * BedrijfsProfielView.js — TenderZen
 * Volledig bedrijfsprofiel beheer: basis, competenties, CPV, referenties, signalering.
 * Non-module global view: window.BedrijfsProfielView
 */
class BedrijfsProfielView {
    constructor() {
        this._container  = null;
        this._bedrijfId  = null;
        this._bedrijf    = null;
        this._referenties = [];
        this._kwaliteit  = 0;
        this._actieveTab = 'profiel';
        this._editRefId  = null;   // null = nieuw, string = bewerken
        this._dirty      = false;
        this._bezig      = false;
        this._baseUrl    = window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    mount(container, params = {}) {
        this._container = container;
        this._bedrijfId = params.bedrijfId || null;
        this._render('<div class="bpv-loading"><div class="bpv-spinner"></div> Laden…</div>');
        this._laadData();
    }

    unmount() {
        this._container = null;
    }

    // -----------------------------------------------------------------------
    // Data
    // -----------------------------------------------------------------------

    async _laadData() {
        if (!this._bedrijfId) {
            this._render('<div class="bpv-fout">Geen bedrijf geselecteerd.</div>');
            return;
        }
        try {
            const data = await this._fetch(`/api/v1/bedrijfsprofiel/${this._bedrijfId}`);
            this._bedrijf     = data.bedrijf;
            this._referenties = data.referenties || [];
            this._kwaliteit   = data.kwaliteit || 0;
            this._renderVolledig();
        } catch (e) {
            this._render(`<div class="bpv-fout">Laden mislukt: ${e.message}</div>`);
        }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    _render(html) {
        if (this._container) this._container.innerHTML = `<div class="bpv-root">${html}</div>`;
    }

    _renderVolledig() {
        if (!this._container) return;
        const root = document.createElement('div');
        root.className = 'bpv-root';
        root.innerHTML = this._htmlHeader() + this._htmlTabs() + `<div class="bpv-body" id="bpv-body"></div>`;
        this._container.innerHTML = '';
        this._container.appendChild(root);
        this._renderTabBody();
        this._bindEvents(root);
    }

    _htmlHeader() {
        const b = this._bedrijf || {};
        const actief = b.signalering_actief || false;

        // Kwaliteitsring berekening
        const r     = 22;
        const omtrek = 2 * Math.PI * r;
        const offset = omtrek - (this._kwaliteit / 100) * omtrek;

        return `
        <div class="bpv-header">
            <button class="bpv-header-terug" id="bpv-terug">
                ${window.Icons.chevronLeft({ size: 16 })} Terug
            </button>
            <div class="bpv-header-info">
                <h1 class="bpv-header-naam">${this._esc(b.bedrijfsnaam || 'Bedrijf')}</h1>
                <p class="bpv-header-sub">${this._esc(b.branche || b.plaats || '—')}</p>
            </div>

            <div class="bpv-kwaliteit-wrap" title="Profielkwaliteit">
                <svg class="bpv-kwaliteit-ring" viewBox="0 0 52 52">
                    <circle class="ring-bg" cx="26" cy="26" r="${r}" />
                    <circle class="ring-fg" cx="26" cy="26" r="${r}"
                        stroke-dasharray="${omtrek.toFixed(1)}"
                        stroke-dashoffset="${offset.toFixed(1)}"
                        transform="rotate(-90 26 26)" />
                    <text x="26" y="30" text-anchor="middle"
                          font-size="11" font-weight="700" fill="#1e1b4b">${this._kwaliteit}%</text>
                </svg>
                <div>
                    <div class="bpv-kwaliteit-score">${this._kwaliteitsLabel(this._kwaliteit)}</div>
                    <div class="bpv-kwaliteit-label">Profielkwaliteit</div>
                </div>
            </div>

            <div class="bpv-signalering-toggle">
                <label>Signalering</label>
                <label class="bpv-toggle-switch">
                    <input type="checkbox" id="bpv-signalering-toggle"
                           ${actief ? 'checked' : ''}>
                    <span class="bpv-toggle-slider"></span>
                </label>
            </div>
        </div>`;
    }

    _kwaliteitsLabel(score) {
        if (score >= 80) return 'Uitstekend';
        if (score >= 60) return 'Goed';
        if (score >= 40) return 'Matig';
        return 'Onvolledig';
    }

    _htmlTabs() {
        const tabs = [
            { id: 'profiel',     label: 'Profiel' },
            { id: 'referenties', label: `Referenties (${this._referenties.length})` },
            { id: 'signalering', label: 'Signalering' },
        ];
        return `<div class="bpv-tabs">
            ${tabs.map(t => `
                <button class="bpv-tab ${this._actieveTab === t.id ? 'is-actief' : ''}"
                        data-tab="${t.id}">${t.label}</button>
            `).join('')}
        </div>`;
    }

    _renderTabBody() {
        const body = this._container?.querySelector('#bpv-body');
        if (!body) return;
        switch (this._actieveTab) {
            case 'profiel':     body.innerHTML = this._htmlProfielTab();     break;
            case 'referenties': body.innerHTML = this._htmlReferentiesTab(); break;
            case 'signalering': body.innerHTML = this._htmlSignaleringTab(); break;
        }
    }

    // -- Tab: Profiel --
    _htmlProfielTab() {
        const b = this._bedrijf || {};
        return `
        <div class="bpv-card">
            <div class="bpv-card-titel">Basisgegevens</div>
            <div class="bpv-rij">
                ${this._veld('Bedrijfsnaam', 'bedrijfsnaam', b.bedrijfsnaam, { required: true })}
                ${this._veld('Branche', 'branche', b.branche)}
            </div>
            <div class="bpv-rij">
                ${this._veld('Adres', 'adres', b.adres)}
                ${this._veld('Plaats', 'plaats', b.plaats)}
            </div>
            <div class="bpv-rij">
                ${this._veld('E-mail', 'email', b.email, { type: 'email' })}
                ${this._veld('Contactpersoon', 'contactpersoon', b.contactpersoon)}
            </div>
            <div class="bpv-rij">
                ${this._veld('KVK-nummer', 'kvk_nummer', b.kvk_nummer)}
                ${this._veld('Website', 'website', b.website)}
            </div>
            <div class="bpv-rij">
                ${this._selectVeld('Omzetcategorie', 'omzet_categorie', b.omzet_categorie, [
                    '< €500k', '€500k – €2M', '€2M – €10M', '€10M – €50M', '> €50M'
                ])}
                ${this._veld('Aantal werknemers', 'aantal_werknemers', b.aantal_werknemers, { type: 'number' })}
            </div>
            <div class="bpv-rij bpv-rij--vol">
                <label class="bpv-label">Notities</label>
                <textarea class="bpv-textarea" id="bpv-notities" rows="3">${this._esc(b.notities || '')}</textarea>
            </div>
        </div>

        <div class="bpv-card">
            <div class="bpv-card-titel">
                Competentieprofiel
                <button class="bpv-genereer-btn" id="bpv-genereer-comp">
                    ${window.Icons.zap({ size: 14 })} AI genereren
                </button>
            </div>
            <textarea class="bpv-comp-textarea" id="bpv-competentieprofiel"
                      placeholder="Beschrijf de kerncompetenties van het bedrijf…">${this._esc(b.competentieprofiel || '')}</textarea>
        </div>

        <div class="bpv-card">
            <div class="bpv-card-titel">CPV-codes</div>
            <div class="bpv-cpv-wrap" id="bpv-cpv-tags">
                ${this._htmlCpvTags(b.cpv_codes || [])}
            </div>
            <div class="bpv-cpv-input-row">
                <input type="text" id="bpv-cpv-input" placeholder="CPV-code toevoegen (bijv. 71000000)">
                <button id="bpv-cpv-toevoeg">
                    ${window.Icons.plus({ size: 14 })} Toevoegen
                </button>
            </div>
        </div>

        <div class="bpv-actie-rij">
            <button class="bpv-btn bpv-btn--secundair" id="bpv-annuleer">Annuleer</button>
            <button class="bpv-btn bpv-btn--primair" id="bpv-opslaan">Opslaan</button>
        </div>`;
    }

    _veld(label, id, waarde, opts = {}) {
        const type = opts.type || 'text';
        const req  = opts.required ? 'required' : '';
        return `<div>
            <label class="bpv-label">${label}</label>
            <input class="bpv-input" type="${type}" id="bpv-${id}"
                   value="${this._esc(String(waarde ?? ''))}" ${req}>
        </div>`;
    }

    _selectVeld(label, id, waarde, opties) {
        return `<div>
            <label class="bpv-label">${label}</label>
            <select class="bpv-select" id="bpv-${id}">
                <option value="">— Kies —</option>
                ${opties.map(o => `<option value="${this._esc(o)}" ${waarde === o ? 'selected' : ''}>${this._esc(o)}</option>`).join('')}
            </select>
        </div>`;
    }

    _htmlCpvTags(codes) {
        if (!codes?.length) return '<span style="font-size:12px;color:#9ca3af;">Nog geen CPV-codes</span>';
        return codes.map(c => `
            <span class="bpv-cpv-tag">
                ${this._esc(c)}
                <button class="bpv-cpv-tag-verwijder" data-cpv="${this._esc(c)}" title="Verwijderen">
                    ${window.Icons.x({ size: 12 })}
                </button>
            </span>`).join('');
    }

    // -- Tab: Referenties --
    _htmlReferentiesTab() {
        const refs = this._referenties;
        return `
        <div class="bpv-card">
            <div class="bpv-card-titel">
                Referentieprojecten
                <button class="bpv-btn bpv-btn--primair" id="bpv-ref-nieuw"
                        style="padding:6px 14px;font-size:12px;">
                    ${window.Icons.plus({ size: 14 })} Nieuw
                </button>
            </div>
            ${!refs.length
                ? '<p style="color:#9ca3af;font-size:13px;text-align:center;padding:20px 0;">Nog geen referenties</p>'
                : `<div class="bpv-ref-lijst">${refs.map(r => this._htmlRefKaart(r)).join('')}</div>`
            }
        </div>`;
    }

    _htmlRefKaart(r) {
        const badge = r.gewonnen === true
            ? `<span class="bpv-ref-badge bpv-ref-badge--gewonnen">${window.Icons.check({ size: 14 })} Gewonnen</span>`
            : r.gewonnen === false
                ? `<span class="bpv-ref-badge bpv-ref-badge--verloren">${window.Icons.x({ size: 14 })} Verloren</span>`
                : '';
        const waarde = r.waarde ? ` · €${Number(r.waarde).toLocaleString('nl-NL')}` : '';
        const jaar   = r.jaar ? ` · ${r.jaar}` : '';
        return `
        <div class="bpv-ref-kaart">
            <div style="flex:1;">
                <div class="bpv-ref-naam">${this._esc(r.tender_naam)}</div>
                <div class="bpv-ref-meta">
                    ${badge}
                    ${r.opdrachtgever ? `<span>${this._esc(r.opdrachtgever)}</span>` : ''}
                    ${r.sector ? `<span>${this._esc(r.sector)}</span>` : ''}
                    <span>${jaar}${waarde}</span>
                </div>
                ${r.omschrijving ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">${this._esc(r.omschrijving)}</div>` : ''}
            </div>
            <div class="bpv-ref-acties">
                <button data-ref-edit="${r.id}" title="Bewerken">${window.Icons.edit({ size: 16 })}</button>
                <button class="bpv-btn-delete" data-ref-del="${r.id}" title="Verwijderen">${window.Icons.trash({ size: 16 })}</button>
            </div>
        </div>`;
    }

    // -- Tab: Signalering --
    _htmlSignaleringTab() {
        const b = this._bedrijf || {};
        const geoFocus = b.geografische_focus || [];
        const diensten = b.aanbestedende_diensten || [];
        const minVal   = b.min_contractwaarde ?? '';
        const maxVal   = b.max_contractwaarde ?? '';

        return `
        <div class="bpv-card">
            <div class="bpv-card-titel">Contractwaarde-filter</div>
            <p style="font-size:13px;color:#6b7280;margin-bottom:14px;">
                Geef aan welke contractwaardes voor dit bedrijf interessant zijn.
                Tenders buiten dit bereik krijgen een lagere matchscore.
            </p>
            <div class="bpv-range-groep">
                <div>
                    <div class="bpv-range-label">Minimumwaarde (€)</div>
                    <input class="bpv-input" type="number" id="bpv-min-waarde"
                           value="${this._esc(String(minVal))}" placeholder="0" step="10000">
                </div>
                <div>
                    <div class="bpv-range-label">Maximumwaarde (€)</div>
                    <input class="bpv-input" type="number" id="bpv-max-waarde"
                           value="${this._esc(String(maxVal))}" placeholder="Geen limiet" step="10000">
                </div>
            </div>
        </div>

        <div class="bpv-card">
            <div class="bpv-card-titel">Geografische focus</div>
            <div class="bpv-focus-wrap" id="bpv-geo-tags">
                ${geoFocus.map(g => this._htmlFocusTag(g, 'bpv-geo-del')).join('')
                    || '<span style="font-size:12px;color:#9ca3af;">Heel Nederland</span>'}
            </div>
            <div class="bpv-cpv-input-row">
                <input type="text" id="bpv-geo-input" placeholder="Provincie of gemeente toevoegen">
                <button id="bpv-geo-toevoeg">
                    ${window.Icons.plus({ size: 14 })} Toevoegen
                </button>
            </div>
        </div>

        <div class="bpv-card">
            <div class="bpv-card-titel">Aanbestedende diensten (voorkeur)</div>
            <div class="bpv-focus-wrap" id="bpv-dienst-tags">
                ${diensten.map(d => this._htmlFocusTag(d, 'bpv-dienst-del')).join('')
                    || '<span style="font-size:12px;color:#9ca3af;">Geen filter</span>'}
            </div>
            <div class="bpv-cpv-input-row">
                <input type="text" id="bpv-dienst-input" placeholder="Aanbestedende dienst toevoegen">
                <button id="bpv-dienst-toevoeg">
                    ${window.Icons.plus({ size: 14 })} Toevoegen
                </button>
            </div>
        </div>

        <div class="bpv-actie-rij">
            <button class="bpv-btn bpv-btn--secundair" id="bpv-annuleer">Annuleer</button>
            <button class="bpv-btn bpv-btn--primair" id="bpv-signalering-opslaan">Opslaan</button>
        </div>`;
    }

    _htmlFocusTag(waarde, delAction) {
        return `<span class="bpv-focus-tag">
            ${this._esc(waarde)}
            <button data-${delAction}="${this._esc(waarde)}" title="Verwijderen">
                ${window.Icons.x({ size: 12 })}
            </button>
        </span>`;
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    _bindEvents(root) {
        // Tab-switching
        root.querySelectorAll('.bpv-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._actieveTab = btn.dataset.tab;
                root.querySelectorAll('.bpv-tab').forEach(b => b.classList.remove('is-actief'));
                btn.classList.add('is-actief');
                // Update tab label voor referenties
                const refTab = root.querySelector('[data-tab="referenties"]');
                if (refTab) refTab.textContent = `Referenties (${this._referenties.length})`;
                this._renderTabBody();
                this._bindTabEvents();
            });
        });

        // Signalering toggle
        const toggle = root.querySelector('#bpv-signalering-toggle');
        if (toggle) toggle.addEventListener('change', () => this._toggleSignalering());

        // Terug
        root.querySelector('#bpv-terug')?.addEventListener('click', () => {
            if (window.app) window.app.showView('bedrijven');
        });

        this._bindTabEvents();
    }

    _bindTabEvents() {
        const body = this._container?.querySelector('#bpv-body');
        if (!body) return;

        switch (this._actieveTab) {
            case 'profiel':     this._bindProfielEvents(body); break;
            case 'referenties': this._bindRefEvents(body);     break;
            case 'signalering': this._bindSignEvents(body);    break;
        }
    }

    // -- Profiel events --
    _bindProfielEvents(body) {
        body.querySelector('#bpv-opslaan')?.addEventListener('click', () => this._opslaanProfiel(body));
        body.querySelector('#bpv-annuleer')?.addEventListener('click', () => this._laadData());
        body.querySelector('#bpv-genereer-comp')?.addEventListener('click', () => this._genererenCompetentie(body));

        // CPV
        body.querySelector('#bpv-cpv-toevoeg')?.addEventListener('click', () => this._cpvToevoegen(body));
        body.querySelector('#bpv-cpv-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._cpvToevoegen(body);
        });
        body.addEventListener('click', e => {
            const btn = e.target.closest('[data-cpv]');
            if (btn) this._cpvVerwijderen(btn.dataset.cpv, body);
        });
    }

    _cpvToevoegen(body) {
        const input = body.querySelector('#bpv-cpv-input');
        const code  = (input?.value || '').trim();
        if (!code) return;
        const cpv = this._bedrijf.cpv_codes || [];
        if (!cpv.includes(code)) {
            cpv.push(code);
            this._bedrijf.cpv_codes = cpv;
        }
        if (input) input.value = '';
        const wrap = body.querySelector('#bpv-cpv-tags');
        if (wrap) wrap.innerHTML = this._htmlCpvTags(cpv);
        this._herBindCpvTags(body);
    }

    _cpvVerwijderen(code, body) {
        this._bedrijf.cpv_codes = (this._bedrijf.cpv_codes || []).filter(c => c !== code);
        const wrap = body.querySelector('#bpv-cpv-tags');
        if (wrap) wrap.innerHTML = this._htmlCpvTags(this._bedrijf.cpv_codes);
        this._herBindCpvTags(body);
    }

    _herBindCpvTags(body) {
        body.querySelectorAll('[data-cpv]').forEach(btn => {
            btn.addEventListener('click', () => this._cpvVerwijderen(btn.dataset.cpv, body));
        });
    }

    async _opslaanProfiel(body) {
        if (this._bezig) return;
        const data = {
            bedrijfsnaam:       body.querySelector('#bpv-bedrijfsnaam')?.value.trim(),
            branche:            body.querySelector('#bpv-branche')?.value.trim(),
            adres:              body.querySelector('#bpv-adres')?.value.trim(),
            email:              body.querySelector('#bpv-email')?.value.trim(),
            contactpersoon:     body.querySelector('#bpv-contactpersoon')?.value.trim(),
            kvk_nummer:         body.querySelector('#bpv-kvk_nummer')?.value.trim(),
            website:            body.querySelector('#bpv-website')?.value.trim(),
            omzet_categorie:    body.querySelector('#bpv-omzet_categorie')?.value || undefined,
            aantal_werknemers:  parseInt(body.querySelector('#bpv-aantal_werknemers')?.value) || undefined,
            notities:           body.querySelector('#bpv-notities')?.value.trim(),
            competentieprofiel: body.querySelector('#bpv-competentieprofiel')?.value.trim(),
            cpv_codes:          this._bedrijf?.cpv_codes || [],
        };
        // Verwijder lege strings
        Object.keys(data).forEach(k => { if (data[k] === '') data[k] = null; });

        await this._slaOp(data, '#bpv-opslaan', body);
    }

    async _genererenCompetentie(body) {
        const btn = body.querySelector('#bpv-genereer-comp');
        if (btn) { btn.disabled = true; btn.innerHTML = `${window.Icons.zap({ size: 14 })} Bezig…`; }
        try {
            const res = await this._fetch(`/api/v1/bedrijfsprofiel/${this._bedrijfId}/competentie-genereren`, { method: 'POST' });
            const ta  = body.querySelector('#bpv-competentieprofiel');
            if (ta) ta.value = res.competentieprofiel || '';
            if (this._bedrijf) this._bedrijf.competentieprofiel = res.competentieprofiel;
            this._toast('Competentieprofiel gegenereerd', 'ok');
        } catch (e) {
            this._toast('Genereren mislukt: ' + e.message, 'fout');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `${window.Icons.zap({ size: 14 })} AI genereren`; }
        }
    }

    // -- Referentie events --
    _bindRefEvents(body) {
        body.querySelector('#bpv-ref-nieuw')?.addEventListener('click', () => this._toonRefModal(null));

        body.addEventListener('click', e => {
            const editBtn = e.target.closest('[data-ref-edit]');
            if (editBtn) {
                const ref = this._referenties.find(r => r.id === editBtn.dataset.refEdit);
                if (ref) this._toonRefModal(ref);
                return;
            }
            const delBtn = e.target.closest('[data-ref-del]');
            if (delBtn) this._verwijderRef(delBtn.dataset.refDel);
        });
    }

    _toonRefModal(ref) {
        const root = this._container?.querySelector('.bpv-root');
        if (!root) return;
        document.getElementById('bpv-modal-overlay')?.remove();

        const isNieuw = !ref;
        const r = ref || {};

        const overlay = document.createElement('div');
        overlay.className = 'bpv-modal-overlay';
        overlay.id = 'bpv-modal-overlay';
        overlay.innerHTML = `
        <div class="bpv-modal">
            <div class="bpv-modal-header">
                <span class="bpv-modal-titel">${isNieuw ? 'Referentie toevoegen' : 'Referentie bewerken'}</span>
                <button class="bpv-modal-sluit" id="bpv-modal-sluit" title="Sluiten">
                    ${window.Icons.x({ size: 16 })}
                </button>
            </div>
            <div class="bpv-modal-body">
                <div class="bpv-rij bpv-rij--vol">
                    <label class="bpv-label">Projectnaam *</label>
                    <input class="bpv-input" id="bpv-ref-naam" value="${this._esc(r.tender_naam || '')}" required>
                </div>
                <div class="bpv-rij">
                    <div>
                        <label class="bpv-label">Opdrachtgever</label>
                        <input class="bpv-input" id="bpv-ref-opdrachtgever" value="${this._esc(r.opdrachtgever || '')}">
                    </div>
                    <div>
                        <label class="bpv-label">Jaar</label>
                        <input class="bpv-input" type="number" id="bpv-ref-jaar" value="${r.jaar || ''}">
                    </div>
                </div>
                <div class="bpv-rij">
                    <div>
                        <label class="bpv-label">Waarde (€)</label>
                        <input class="bpv-input" type="number" id="bpv-ref-waarde" value="${r.waarde || ''}">
                    </div>
                    <div>
                        <label class="bpv-label">Sector</label>
                        <input class="bpv-input" id="bpv-ref-sector" value="${this._esc(r.sector || '')}">
                    </div>
                </div>
                <div class="bpv-rij bpv-rij--vol">
                    <label class="bpv-label">Gewonnen?</label>
                    <select class="bpv-select" id="bpv-ref-gewonnen">
                        <option value="">— Onbekend —</option>
                        <option value="true"  ${r.gewonnen === true ? 'selected' : ''}>Ja, gewonnen</option>
                        <option value="false" ${r.gewonnen === false ? 'selected' : ''}>Nee, verloren</option>
                    </select>
                </div>
                <div class="bpv-rij bpv-rij--vol">
                    <label class="bpv-label">Omschrijving</label>
                    <textarea class="bpv-textarea" id="bpv-ref-omschrijving" rows="3">${this._esc(r.omschrijving || '')}</textarea>
                </div>
            </div>
            <div class="bpv-modal-footer">
                <button class="bpv-btn bpv-btn--secundair" id="bpv-modal-annuleer">Annuleer</button>
                <button class="bpv-btn bpv-btn--primair" id="bpv-modal-opslaan">
                    ${isNieuw ? 'Toevoegen' : 'Opslaan'}
                </button>
            </div>
        </div>`;

        root.appendChild(overlay);

        overlay.querySelector('#bpv-modal-sluit').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#bpv-modal-annuleer').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#bpv-modal-opslaan').addEventListener('click', () => this._slaanRefOp(overlay, ref?.id));

        setTimeout(() => overlay.querySelector('#bpv-ref-naam')?.focus(), 50);
    }

    async _slaanRefOp(overlay, refId) {
        const naam = overlay.querySelector('#bpv-ref-naam')?.value.trim();
        if (!naam) { this._toast('Projectnaam is verplicht', 'fout'); return; }

        const gewonnenVal = overlay.querySelector('#bpv-ref-gewonnen')?.value;
        const body = {
            tender_naam:   naam,
            opdrachtgever: overlay.querySelector('#bpv-ref-opdrachtgever')?.value.trim() || null,
            jaar:          parseInt(overlay.querySelector('#bpv-ref-jaar')?.value) || null,
            waarde:        parseFloat(overlay.querySelector('#bpv-ref-waarde')?.value) || null,
            sector:        overlay.querySelector('#bpv-ref-sector')?.value.trim() || null,
            omschrijving:  overlay.querySelector('#bpv-ref-omschrijving')?.value.trim() || null,
            gewonnen:      gewonnenVal === 'true' ? true : gewonnenVal === 'false' ? false : null,
        };

        try {
            const slaanBtn = overlay.querySelector('#bpv-modal-opslaan');
            if (slaanBtn) { slaanBtn.disabled = true; slaanBtn.textContent = 'Bezig…'; }

            if (refId) {
                await this._fetch(`/api/v1/bedrijfsprofiel/${this._bedrijfId}/referenties/${refId}`, {
                    method: 'PUT', body: JSON.stringify(body)
                });
            } else {
                await this._fetch(`/api/v1/bedrijfsprofiel/${this._bedrijfId}/referenties`, {
                    method: 'POST', body: JSON.stringify(body)
                });
            }
            overlay.remove();
            this._toast(refId ? 'Referentie bijgewerkt' : 'Referentie toegevoegd', 'ok');
            await this._laadData();
            this._actieveTab = 'referenties';
            this._renderVolledig();
            this._bindEvents(this._container?.querySelector('.bpv-root'));
        } catch (e) {
            this._toast('Opslaan mislukt: ' + e.message, 'fout');
            const slaanBtn = overlay.querySelector('#bpv-modal-opslaan');
            if (slaanBtn) { slaanBtn.disabled = false; slaanBtn.textContent = 'Opslaan'; }
        }
    }

    async _verwijderRef(refId) {
        if (!confirm('Referentie definitief verwijderen?')) return;
        try {
            await this._fetch(`/api/v1/bedrijfsprofiel/${this._bedrijfId}/referenties/${refId}`, { method: 'DELETE' });
            this._toast('Referentie verwijderd', 'ok');
            await this._laadData();
            this._actieveTab = 'referenties';
            this._renderVolledig();
            this._bindEvents(this._container?.querySelector('.bpv-root'));
        } catch (e) {
            this._toast('Verwijderen mislukt: ' + e.message, 'fout');
        }
    }

    // -- Signalering events --
    _bindSignEvents(body) {
        body.querySelector('#bpv-signalering-opslaan')?.addEventListener('click', () => this._opslaanSignalering(body));
        body.querySelector('#bpv-annuleer')?.addEventListener('click', () => {
            this._renderTabBody(); this._bindTabEvents();
        });

        // Geografische focus
        body.querySelector('#bpv-geo-toevoeg')?.addEventListener('click', () => this._focusToevoegen('geo', body));
        body.querySelector('#bpv-geo-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._focusToevoegen('geo', body);
        });

        // Aanbestedende diensten
        body.querySelector('#bpv-dienst-toevoeg')?.addEventListener('click', () => this._focusToevoegen('dienst', body));
        body.querySelector('#bpv-dienst-input')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') this._focusToevoegen('dienst', body);
        });

        // Verwijder knoppen (event delegation)
        body.addEventListener('click', e => {
            const geoBtn = e.target.closest('[data-bpv-geo-del]');
            if (geoBtn) {
                this._bedrijf.geografische_focus = (this._bedrijf.geografische_focus || [])
                    .filter(g => g !== geoBtn.dataset.bpvGeoDel);
                const wrap = body.querySelector('#bpv-geo-tags');
                if (wrap) wrap.innerHTML = (this._bedrijf.geografische_focus || [])
                    .map(g => this._htmlFocusTag(g, 'bpv-geo-del')).join('')
                    || '<span style="font-size:12px;color:#9ca3af;">Heel Nederland</span>';
                return;
            }
            const dBtn = e.target.closest('[data-bpv-dienst-del]');
            if (dBtn) {
                this._bedrijf.aanbestedende_diensten = (this._bedrijf.aanbestedende_diensten || [])
                    .filter(d => d !== dBtn.dataset.bpvDienstDel);
                const wrap = body.querySelector('#bpv-dienst-tags');
                if (wrap) wrap.innerHTML = (this._bedrijf.aanbestedende_diensten || [])
                    .map(d => this._htmlFocusTag(d, 'bpv-dienst-del')).join('')
                    || '<span style="font-size:12px;color:#9ca3af;">Geen filter</span>';
            }
        });
    }

    _focusToevoegen(type, body) {
        const inputId = type === 'geo' ? '#bpv-geo-input' : '#bpv-dienst-input';
        const tagId   = type === 'geo' ? '#bpv-geo-tags' : '#bpv-dienst-tags';
        const veld    = type === 'geo' ? 'geografische_focus' : 'aanbestedende_diensten';
        const delAct  = type === 'geo' ? 'bpv-geo-del' : 'bpv-dienst-del';
        const leeg    = type === 'geo' ? 'Heel Nederland' : 'Geen filter';

        const input  = body.querySelector(inputId);
        const waarde = (input?.value || '').trim();
        if (!waarde) return;

        const lijst = this._bedrijf[veld] || [];
        if (!lijst.includes(waarde)) {
            lijst.push(waarde);
            this._bedrijf[veld] = lijst;
        }
        if (input) input.value = '';

        const wrap = body.querySelector(tagId);
        if (wrap) wrap.innerHTML = lijst.map(g => this._htmlFocusTag(g, delAct)).join('')
            || `<span style="font-size:12px;color:#9ca3af;">${leeg}</span>`;
    }

    async _opslaanSignalering(body) {
        const data = {
            min_contractwaarde:     parseFloat(body.querySelector('#bpv-min-waarde')?.value) || null,
            max_contractwaarde:     parseFloat(body.querySelector('#bpv-max-waarde')?.value) || null,
            geografische_focus:     this._bedrijf?.geografische_focus || [],
            aanbestedende_diensten: this._bedrijf?.aanbestedende_diensten || [],
        };
        await this._slaOp(data, '#bpv-signalering-opslaan', body);
    }

    async _toggleSignalering() {
        try {
            const res = await this._fetch(`/api/v1/tendersignalering/activeer/${this._bedrijfId}`, { method: 'PUT' });
            if (this._bedrijf) this._bedrijf.signalering_actief = res.signalering_actief;
            this._toast(res.signalering_actief ? 'Signalering ingeschakeld' : 'Signalering uitgeschakeld', 'ok');
        } catch (e) {
            this._toast('Toggle mislukt: ' + e.message, 'fout');
            // Zet checkbox terug
            const chk = this._container?.querySelector('#bpv-signalering-toggle');
            if (chk) chk.checked = this._bedrijf?.signalering_actief || false;
        }
    }

    // -----------------------------------------------------------------------
    // Generieke opslaan helper
    // -----------------------------------------------------------------------

    async _slaOp(data, btnSelector, body) {
        if (this._bezig) return;
        this._bezig = true;
        const btn = body?.querySelector(btnSelector);
        const origText = btn?.textContent;
        if (btn) { btn.disabled = true; btn.textContent = 'Bezig…'; }
        try {
            const res = await this._fetch(`/api/v1/bedrijfsprofiel/${this._bedrijfId}`, {
                method: 'PUT',
                body:   JSON.stringify(data),
            });
            if (res.bedrijf) this._bedrijf = { ...this._bedrijf, ...res.bedrijf };
            if (res.kwaliteit !== undefined) this._kwaliteit = res.kwaliteit;
            this._toast('Opgeslagen', 'ok');
            this._renderVolledig();
            this._bindEvents(this._container?.querySelector('.bpv-root'));
        } catch (e) {
            this._toast('Opslaan mislukt: ' + e.message, 'fout');
            if (btn) { btn.disabled = false; btn.textContent = origText; }
        } finally {
            this._bezig = false;
        }
    }

    // -----------------------------------------------------------------------
    // API fetch helper
    // -----------------------------------------------------------------------

    async _getToken() {
        if (window.getSupabase) {
            const sb = window.getSupabase();
            const { data: { session } } = await sb.auth.getSession();
            return session?.access_token || '';
        }
        return '';
    }

    async _fetch(path, opts = {}) {
        const token = await this._getToken();
        const resp  = await fetch(`${this._baseUrl}${path}`, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                ...(opts.headers || {}),
            },
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${resp.status}`);
        }
        return resp.json();
    }

    // -----------------------------------------------------------------------
    // Toast
    // -----------------------------------------------------------------------

    _toast(bericht, type = 'ok') {
        document.getElementById('bpv-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'bpv-toast';
        el.className = `bpv-toast bpv-toast--${type}`;
        el.textContent = bericht;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-zichtbaar'));
        setTimeout(() => { el.classList.remove('is-zichtbaar'); setTimeout(() => el.remove(), 250); }, 3000);
    }

    // -----------------------------------------------------------------------
    // Utils
    // -----------------------------------------------------------------------

    _esc(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}

window.BedrijfsProfielView = BedrijfsProfielView;
