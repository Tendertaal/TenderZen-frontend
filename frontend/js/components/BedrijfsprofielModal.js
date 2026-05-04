/**
 * BedrijfsprofielModal — TenderZen
 * Fullscreen overlay met bedrijfsprofiel, bewerkbare velden,
 * referenties en bureau-koppelingen.
 *
 * Gebruik: window.BedrijfsprofielModal.open(bedrijfId)
 *
 * Iconen: alleen uit window.Icons — geen mapPin (gebruik flag),
 *         geen alertTriangle (gebruik warning).
 */

(function () {

    const BP = {
        _bedrijfId:      null,
        _data:           null,
        _actieveTab:     0,
        _bewerkenActief: false,

        // ── Publieke API ──────────────────────────────────────────────────

        async open(bedrijfId) {
            this._bedrijfId      = bedrijfId;
            this._actieveTab     = 0;
            this._bewerkenActief = false;
            this._data           = null;

            document.getElementById('bp-overlay')?.remove();
            document.body.insertAdjacentHTML('beforeend', this._skeletonOverlay());
            document.body.style.overflow = 'hidden';

            this._bindOverlayEvents();
            await this._laadData();
        },

        sluit() {
            document.getElementById('bp-overlay')?.remove();
            document.body.style.overflow = '';
        },

        // ── Data laden ────────────────────────────────────────────────────

        async _laadData() {
            this._setBp('bp-body', '<div class="bp-laden">Laden...</div>');
            try {
                const supabase = window.supabaseClient || window.supabase;
                const { data: { session } } = await supabase.auth.getSession();
                const token = session?.access_token || '';

                const resp = await fetch(`${this._baseUrl()}/api/v1/bedrijven/${this._bedrijfId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!resp.ok) {
                    const fout = await resp.json().catch(() => ({ detail: resp.statusText }));
                    throw new Error(fout.detail || `HTTP ${resp.status}`);
                }
                this._data = await resp.json();
                this._render();
            } catch (err) {
                console.error('[BedrijfsprofielModal] Laden mislukt:', err);
                this._setBp('bp-body',
                    `<div class="bp-fout">Fout bij laden: ${this._esc(err.message)}. Probeer opnieuw.</div>`
                );
            }
        },

        // ── Overlay shell ─────────────────────────────────────────────────

        _skeletonOverlay() {
            return `
<div id="bp-overlay" class="bp-overlay">
    <div id="bp-modal" class="bp-modal">
        <div id="bp-breadcrumb" class="bp-breadcrumb">
            <button class="bp-breadcrumb-terug" onclick="window.BedrijfsprofielModal.sluit()">
                ${this._icon('chevronLeft', 13)} Bedrijven
            </button>
            <span class="bp-breadcrumb-sep">›</span>
            <span id="bp-breadcrumb-naam" class="bp-breadcrumb-naam">Laden...</span>
        </div>
        <div id="bp-header" class="bp-header-wrap"></div>
        <div id="bp-tabs"   class="bp-tabs-wrap"></div>
        <div id="bp-body"   class="bp-body-wrap"></div>
    </div>
</div>`;
        },

        // ── Hoofd render ──────────────────────────────────────────────────

        _render() {
            const b         = this._data.bedrijf;
            const stats     = this._data.statistieken;
            const relaties  = this._data.bureau_relaties  || [];
            const refs      = this._data.referenties      || [];

            this._setBp('bp-breadcrumb-naam', this._esc(b.bedrijfsnaam));
            this._setBp('bp-header', this._renderHeader(b, relaties));
            this._setBp('bp-tabs',   this._renderTabs(refs, relaties));
            this._setBp('bp-body',   this._renderBody(b, stats, relaties, refs));

            this._bindBodyEvents();
        },

        // ── Header ────────────────────────────────────────────────────────

        _renderHeader(b, relaties) {
            const initialen = (b.bedrijfsnaam || '??')
                .split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();

            const bureauPills = relaties.slice(0, 3).map(r =>
                `<button class="bp-bureau-pill">${this._esc(r.bureau_naam || 'Bureau')}</button>`
            ).join('');

            return `
<div class="bp-header">
    <div class="bp-header-avatar">${initialen}</div>
    <div class="bp-header-info">
        <div class="bp-header-naam">${this._esc(b.bedrijfsnaam)}</div>
        <div class="bp-header-meta">
            ${b.plaats    ? `<span class="bp-meta-item">${this._icon('flag', 13)} ${this._esc(b.plaats)}</span>`       : ''}
            ${b.kvk_nummer? `<span class="bp-meta-item">${this._icon('building', 13)} KvK ${this._esc(b.kvk_nummer)}</span>` : ''}
            ${b.website   ? `<span class="bp-meta-item">${this._icon('externalLink', 13)} ${this._esc(b.website)}</span>` : ''}
            ${b.branche   ? `<span class="bp-branche-badge">${this._esc(b.branche)}</span>`                             : ''}
        </div>
    </div>
    <div class="bp-header-acties">
        <div class="bp-header-knoppen">
            <button id="bp-btn-bewerken" class="bp-header-btn">
                ${this._icon('edit', 14)} Bewerken
            </button>
            <button id="bp-btn-koppelen" class="bp-header-btn bp-header-btn-primary">
                ${this._icon('link', 14)} Koppelen aan bureau
            </button>
        </div>
        <div class="bp-header-pills">${bureauPills}</div>
    </div>
</div>`;
        },

        // ── Tabs ──────────────────────────────────────────────────────────

        _renderTabs(refs, relaties) {
            const tabs = [
                { label: 'Profiel',      count: null           },
                { label: 'Referenties',  count: refs.length    },
                { label: 'Documenten',   count: null           },
                { label: 'Bureaus',      count: relaties.length },
            ];
            const tabItems = tabs.map((t, i) => `
<button class="bp-tab ${i === this._actieveTab ? 'bp-tab-actief' : ''}" data-tab="${i}">
    ${t.label}
    ${t.count !== null ? `<span class="bp-tab-count">${t.count}</span>` : ''}
</button>`).join('');

            return `<div class="bp-tabs">${tabItems}</div>`;
        },

        // ── Body ──────────────────────────────────────────────────────────

        _renderBody(b, stats, relaties, refs) {
            return `
<div class="bp-body-left" id="bp-tab-inhoud">
    ${this._renderTabInhoud(b, stats, refs)}
</div>
<div class="bp-body-right">
    ${this._renderZijbalk(b, stats, relaties)}
</div>`;
        },

        // ── Tab inhoud ────────────────────────────────────────────────────

        _renderTabInhoud(b, stats, refs) {
            switch (this._actieveTab) {
                case 0: return this._renderProfielTab(b, refs);
                case 1: return this._renderReferentiesTab(refs);
                case 2: return this._renderDocumentenTab();
                case 3: return this._renderBureausTab();
                default: return '';
            }
        },

        // TAB 0 — Profiel
        _renderProfielTab(b, refs) {
            const recenteRefs = refs.slice(0, 4);
            return `
<div class="bp-sectie">
    <div class="bp-sectie-header">
        <div class="bp-sectie-titel">BEDRIJFSGEGEVENS</div>
        <button class="bp-sectie-edit" id="bp-edit-toggle">Bewerken</button>
    </div>
    <div class="bp-velden-grid" id="bp-velden">
        ${this._renderVeld('Bedrijfsnaam',    b.bedrijfsnaam,     'bedrijfsnaam')}
        ${this._renderVeld('KvK nummer',      b.kvk_nummer,       'kvk_nummer',
            b.kvk_nummer
                ? `<span class="bp-kvk-ok">${this._icon('check', 12)} ${this._esc(b.kvk_nummer)}</span>`
                : null
        )}
        ${this._renderVeld('Adres',           b.adres,            'adres')}
        ${this._renderVeld('Website',         b.website,          'website',
            b.website
                ? `<a href="https://${this._esc(b.website)}" class="bp-link" target="_blank" rel="noopener">${this._esc(b.website)} →</a>`
                : null
        )}
        ${this._renderVeld('Contactpersoon',  b.contactpersoon,   'contactpersoon')}
        ${this._renderVeld('E-mail',          b.email,            'email',
            b.email
                ? `<a href="mailto:${this._esc(b.email)}" class="bp-link">${this._esc(b.email)}</a>`
                : null
        )}
        ${this._renderVeld('Omzet categorie', b.omzet_categorie,  'omzet_categorie')}
        ${this._renderVeld('Werknemers',      b.aantal_werknemers, 'aantal_werknemers')}
    </div>
    <div id="bp-edit-footer" class="bp-edit-footer" style="display:none;">
        <button class="bp-btn-annuleer" id="bp-edit-annuleer">Annuleren</button>
        <button class="bp-btn-opslaan"  id="bp-edit-opslaan">Opslaan</button>
    </div>
</div>

${this._renderVerrijkingBlok(b)}

<div class="bp-sectie">
    <div class="bp-sectie-header">
        <div class="bp-sectie-titel">CERTIFICERINGEN &amp; CPV CODES</div>
    </div>
    <div style="margin-bottom:12px;">
        <div class="bp-sub-titel">Certificeringen</div>
        <div class="bp-tags-rij">
            ${(b.certificeringen || []).map(c => `<span class="bp-cert-tag">${this._esc(c)}</span>`).join('')
              || '<span class="bp-leeg-tekst">Geen certificeringen bekend</span>'}
        </div>
    </div>
    <div>
        <div class="bp-sub-titel">CPV codes</div>
        <div class="bp-tags-rij">
            ${(b.cpv_codes || []).map(c => `<span class="bp-cpv-tag">${this._esc(c)}</span>`).join('')
              || '<span class="bp-leeg-tekst">Geen CPV codes bekend</span>'}
        </div>
    </div>
</div>

<div class="bp-sectie">
    <div class="bp-sectie-header">
        <div class="bp-sectie-titel">RECENTE REFERENTIES</div>
        <button class="bp-sectie-edit" id="bp-ref-add">+ Toevoegen</button>
    </div>
    ${recenteRefs.length === 0
        ? '<div class="bp-leeg-tekst" style="padding:8px 0;">Geen referenties bekend</div>'
        : recenteRefs.map(r => this._renderReferentieRij(r)).join('')
    }
    ${refs.length > 4
        ? `<button class="bp-meer-btn" id="bp-naar-referenties">Alle ${refs.length} referenties →</button>`
        : ''}
</div>

<div class="bp-sectie">
    <div class="bp-sectie-header">
        <div class="bp-sectie-titel">DOCUMENTEN</div>
        <button class="bp-sectie-edit">+ Uploaden</button>
    </div>
    <div class="bp-leeg-tekst" style="padding:8px 0;">Documentbeheer komt binnenkort beschikbaar.</div>
</div>`;
        },

        _renderVeld(label, waarde, veldnaam, weergave = null) {
            const getoond = weergave
                || (waarde != null && waarde !== ''
                    ? `<span class="bp-veld-tekst">${this._esc(String(waarde))}</span>`
                    : '<span class="bp-leeg-tekst">—</span>');

            return `
<div class="bp-veld">
    <div class="bp-veld-label">${label}</div>
    <div class="bp-veld-waarde">${getoond}</div>
    <input class="bp-veld-input" data-veld="${veldnaam}"
           value="${this._esc(String(waarde ?? ''))}" style="display:none;">
</div>`;
        },

        _renderReferentieRij(r) {
            const status = r.gewonnen === true
                ? { bg: '#dcfce7', kleur: '#166534', label: 'Gewonnen' }
                : r.gewonnen === false
                ? { bg: '#fee2e2', kleur: '#991b1b', label: 'Verloren' }
                : { bg: '#f1f5f9', kleur: '#475569', label: 'Onbekend' };

            return `
<div class="bp-ref-rij">
    <div class="bp-ref-jaar">${r.jaar || '—'}</div>
    <div class="bp-ref-info">
        <div class="bp-ref-naam">${this._esc(r.tender_naam || r.omschrijving || '—')}</div>
        <div class="bp-ref-sub">${this._esc(r.opdrachtgever || '')}${r.waarde ? ' · €' + Number(r.waarde).toLocaleString('nl-NL') : ''}</div>
    </div>
    <span class="bp-ref-status" style="background:${status.bg};color:${status.kleur};">${status.label}</span>
</div>`;
        },

        // ── Website verrijking blok ────────────────────────────────────────

        _renderVerrijkingBlok(b) {
            const status   = b.website_status || 'niet_verrijkt';
            const verrijkt = status === 'verrijkt';
            const json     = b.ai_omschrijving_json || null;

            const knopLabel   = verrijkt ? 'Herverrijk' : 'Verrijk';
            const knopKlasse  = verrijkt ? 'bp-sectie-edit bp-verrijk-herverrijk' : 'bp-sectie-edit';

            let inhoud;
            if (!verrijkt) {
                const statusTekst = {
                    niet_verrijkt:  'Nog niet verrijkt',
                    geen_website:   'Geen website gevonden',
                    scrape_mislukt: 'Scraping mislukt — klik Verrijk om opnieuw te proberen',
                    ai_fout:        'AI-analyse mislukt — klik Verrijk om opnieuw te proberen',
                }[status] || 'Nog niet verrijkt';

                inhoud = `<div class="bp-leeg-tekst">${statusTekst}</div>`;
            } else if (!json) {
                // Verrijkt maar geen JSON — fallback naar platte tekst
                inhoud = `<div class="bp-verrijking-kernactiviteit">${this._esc(b.ai_omschrijving || '—')}</div>`;
            } else {
                const sectoren = Array.isArray(json.sectoren) ? json.sectoren.join(', ') : (json.sectoren || '—');
                const trefPills = Array.isArray(json.trefwoorden)
                    ? json.trefwoorden.map(t => `<span class="bp-verrijking-pill">${this._esc(t)}</span>`).join('')
                    : '';
                const badgeKlasse = json.aanbestedingsrelevant ? 'bp-verrijking-badge--ja' : 'bp-verrijking-badge--nee';
                const badgeLabel  = json.aanbestedingsrelevant ? 'Aanbestedingsrelevant' : 'Niet aanbestedingsrelevant';
                const datum       = b.website_verrijkt_op ? this._formatDatum(b.website_verrijkt_op) : '—';

                inhoud = `
<div class="bp-verrijking-kernactiviteit">${this._esc(json.kernactiviteit || b.ai_omschrijving || '—')}</div>
<div class="bp-verrijking-grid">
    <div class="bp-verrijking-item">
        <span class="bp-verrijking-label">Sectoren</span>
        <span class="bp-verrijking-waarde">${this._esc(sectoren)}</span>
    </div>
    <div class="bp-verrijking-item">
        <span class="bp-verrijking-label">Klanten</span>
        <span class="bp-verrijking-waarde">${this._esc(json.klanten || '—')}</span>
    </div>
    <div class="bp-verrijking-item">
        <span class="bp-verrijking-label">Werkgebied</span>
        <span class="bp-verrijking-waarde">${this._esc(json.werkgebied || '—')}</span>
    </div>
    <div class="bp-verrijking-item">
        <span class="bp-verrijking-label">Organisatie</span>
        <span class="bp-verrijking-waarde">${this._esc(json.organisatiegrootte || '—')}</span>
    </div>
</div>
${trefPills ? `<div class="bp-verrijking-trefwoorden">${trefPills}</div>` : ''}
<div class="bp-verrijking-footer">
    <span class="bp-verrijking-badge ${badgeKlasse}">${badgeLabel}</span>
    <span class="bp-verrijking-datum">Verrijkt op ${datum}</span>
</div>`;
            }

            return `
<div class="bp-sectie">
    <div class="bp-sectie-header">
        <div class="bp-sectie-titel">WEBSITE VERRIJKING</div>
        <button class="${knopKlasse}" id="bp-verrijk-knop">${knopLabel}</button>
    </div>
    <div id="bp-verrijking-inhoud">${inhoud}</div>
</div>`;
        },

        async _triggerVerrijking() {
            const knop = document.getElementById('bp-verrijk-knop');
            const inhoud = document.getElementById('bp-verrijking-inhoud');

            if (knop) { knop.textContent = 'Bezig...'; knop.disabled = true; }
            if (inhoud) inhoud.innerHTML = '<div class="bp-leeg-tekst">Website wordt opgezocht en geanalyseerd...</div>';

            try {
                const token = await this._getToken();
                const resp = await fetch(`${this._baseUrl()}/api/v1/verrijking/bedrijf/${this._bedrijfId}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });

                const result = await resp.json();

                if (result.status === 'verrijkt') {
                    this._toast('Verrijking geslaagd', 'success');
                    await this._laadData();
                } else {
                    const foutTekst = result.fout || result.status || 'onbekende fout';
                    this._toast(`Verrijking mislukt: ${foutTekst}`, 'error');
                    if (knop) { knop.textContent = 'Verrijk'; knop.disabled = false; }
                    if (inhoud) inhoud.innerHTML = `<div class="bp-leeg-tekst">${this._esc(foutTekst)}</div>`;
                }
            } catch (err) {
                console.error('[BedrijfsprofielModal] Verrijking fout:', err);
                this._toast('Verrijking mislukt — controleer de console', 'error');
                if (knop) { knop.textContent = 'Verrijk'; knop.disabled = false; }
            }
        },

        // TAB 1 — Alle referenties
        _renderReferentiesTab(refs) {
            if (!refs.length) {
                return '<div class="bp-leeg-blok">Nog geen referenties</div>';
            }
            return `
<div class="bp-sectie">
    <div class="bp-sectie-header">
        <div class="bp-sectie-titel">ALLE REFERENTIES (${refs.length})</div>
        <button class="bp-sectie-edit" id="bp-ref-add-2">+ Toevoegen</button>
    </div>
    ${refs.map(r => this._renderReferentieRij(r)).join('')}
</div>`;
        },

        // TAB 2 — Documenten
        _renderDocumentenTab() {
            const docs = this._data.documenten || [];

            const lijstHtml = docs.length > 0
                ? `<div class="bp-doc-lijst">${docs.map(d => `
                    <div class="bp-doc-item">
                        ${this._icon('fileText', 16, '#4f46e5')}
                        <span class="bp-doc-naam">${this._esc(d.bestandsnaam || d.naam || 'Onbekend')}</span>
                    </div>`).join('')}</div>`
                : `<p class="bp-doc-leeg">Nog geen documenten gekoppeld aan dit bedrijf.</p>`;

            return `
<div class="bp-sectie">
    <div class="bp-sectie-titel" style="margin-bottom:12px;">DOCUMENTEN</div>
    ${lijstHtml}
    <div class="doc-dropzone bp-doc-dropzone" id="bp-doc-dropzone">
        <div class="doc-dropzone-inner">
            ${this._icon('upload', 24, '#7c3aed')}
            <div class="doc-dropzone-tekst">
                <span class="doc-dropzone-hoofd">Sleep bestanden hierheen</span>
                <span class="doc-dropzone-sub">of <button class="doc-dropzone-knop" id="bp-upload-knop">klik om te uploaden</button></span>
            </div>
            <div class="doc-dropzone-hint">PDF, Word, Excel — documentbeheer wordt binnenkort geactiveerd</div>
        </div>
        <input type="file" id="bp-doc-input" multiple accept=".pdf,.doc,.docx,.xlsx,.xls" style="display:none">
    </div>
</div>`;
        },

        _bindDocumentenDropzone() {
            const zone  = document.getElementById('bp-doc-dropzone');
            const input = document.getElementById('bp-doc-input');
            const knop  = document.getElementById('bp-upload-knop');

            if (!zone || !input) return;
            if (zone.dataset.bound) return;
            zone.dataset.bound = '1';

            const toon = () => this._toast('Documentbeheer wordt binnenkort geactiveerd', 'info');

            knop?.addEventListener('click', (e) => { e.stopPropagation(); toon(); });
            zone.addEventListener('click', toon);

            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                zone.classList.add('doc-dropzone--actief');
            });
            zone.addEventListener('dragleave', (e) => {
                if (!zone.contains(e.relatedTarget)) zone.classList.remove('doc-dropzone--actief');
            });
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove('doc-dropzone--actief');
                toon();
            });
        },

        // TAB 3 — Bureaus
        _renderBureausTab() {
            const relaties = this._data.bureau_relaties || [];
            if (!relaties.length) {
                return '<div class="bp-leeg-blok">Dit bedrijf is nog niet gekoppeld aan een bureau.</div>';
            }
            return `
<div class="bp-sectie">
    <div class="bp-sectie-titel" style="margin-bottom:12px;">GEKOPPELDE BUREAUS</div>
    ${relaties.map(r => `
<div class="bp-bureau-kaart">
    <div class="bp-bureau-kaart-naam">${this._esc(r.bureau_naam || '—')}</div>
    <div class="bp-bureau-kaart-meta">${this._statusLabel(r.status)} · sinds ${this._formatDatum(r.gekoppeld_op)}</div>
</div>`).join('')}
</div>`;
        },

        // ── Zijbalk ───────────────────────────────────────────────────────

        _renderZijbalk(b, stats, relaties) {
            const verrijkt = b.kvk_verrijkt_op;
            return `
<div class="bp-zijbalk-blok">
    <div class="bp-zijbalk-titel">KVK VERRIJKING</div>
    ${verrijkt
        ? `<div class="bp-kvk-verrijkt">${this._icon('check', 13)} Verrijkt op ${this._formatDatum(verrijkt)}</div>`
        : `<div class="bp-kvk-niet">Nog niet verrijkt</div>`
    }
    <button class="bp-zijbalk-btn" id="bp-kvk-ophalen">Opnieuw ophalen</button>
</div>

<div class="bp-zijbalk-blok">
    <div class="bp-zijbalk-titel">STATISTIEKEN</div>
    <table class="bp-stats-tabel">
        <tr><td class="bp-stats-label">Tenders totaal</td><td class="bp-stats-waarde">${stats.totaal}</td></tr>
        <tr><td class="bp-stats-label">Gewonnen</td>      <td class="bp-stats-waarde bp-stats-groen">${stats.gewonnen}</td></tr>
        <tr><td class="bp-stats-label">Verloren</td>      <td class="bp-stats-waarde bp-stats-rood">${stats.verloren}</td></tr>
        <tr class="bp-stats-divider"><td class="bp-stats-label">Winratio</td><td class="bp-stats-waarde bp-stats-bold">${stats.winratio}%</td></tr>
    </table>
</div>

<div class="bp-zijbalk-blok">
    <div class="bp-zijbalk-titel">GEKOPPELDE BUREAUS</div>
    ${relaties.length === 0
        ? '<div class="bp-leeg-tekst">Nog geen koppelingen</div>'
        : relaties.map(r => `
<div class="bp-bureau-pill-zijbalk">
    <div class="bp-bureau-pill-naam">${this._esc(r.bureau_naam || '—')}</div>
    <div class="bp-bureau-pill-meta">${this._statusLabel(r.status)} · ${this._formatDatum(r.gekoppeld_op)}</div>
</div>`).join('')
    }
</div>

<div class="bp-zijbalk-blok bp-zijbalk-notities">
    <div class="bp-zijbalk-titel">NOTITIES</div>
    <textarea id="bp-notities" class="bp-notities-input" placeholder="Interne notitie over dit bedrijf...">${this._esc(b.notities || '')}</textarea>
    <button class="bp-zijbalk-btn" id="bp-notities-opslaan" style="margin-top:6px;">Opslaan</button>
</div>`;
        },

        // ── Events ────────────────────────────────────────────────────────

        _bindOverlayEvents() {
            document.getElementById('bp-overlay')?.addEventListener('click', (e) => {
                if (e.target.id === 'bp-overlay') this.sluit();
            });
        },

        _bindBodyEvents() {
            const get = (id) => document.getElementById(id);

            // ── Tabs ──
            document.querySelectorAll('.bp-tab').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._actieveTab = parseInt(btn.dataset.tab);
                    this._herlaadTabsEnInhoud();
                });
            });

            // "Alle referenties →" knop op profiel tab (ID om conflict met tab button te vermijden)
            document.getElementById('bp-naar-referenties')?.addEventListener('click', () => {
                this._actieveTab = 1;
                this._herlaadTabsEnInhoud();
            });

            // ── Bewerken (profiel tab) ──
            get('bp-edit-toggle')?.addEventListener('click', () => this._toggleBewerken());
            get('bp-edit-annuleer')?.addEventListener('click', () => this._toggleBewerken(false));
            get('bp-edit-opslaan')?.addEventListener('click', () => this._opslaanBedrijfsgegevens());

            // ── Header bewerken knop ──
            get('bp-btn-bewerken')?.addEventListener('click', () => {
                if (this._actieveTab !== 0) {
                    this._actieveTab = 0;
                    this._herlaadTabsEnInhoud();
                }
                this._toggleBewerken(true);
            });

            // ── Koppelen (stub) ──
            get('bp-btn-koppelen')?.addEventListener('click', () => {
                this._toast('Bureau koppelen komt binnenkort beschikbaar', 'info');
            });

            // ── Referentie toevoegen (stub) ──
            get('bp-ref-add')?.addEventListener('click', () => {
                this._toast('Referentie toevoegen komt binnenkort beschikbaar', 'info');
            });
            get('bp-ref-add-2')?.addEventListener('click', () => {
                this._toast('Referentie toevoegen komt binnenkort beschikbaar', 'info');
            });

            // ── Website verrijking ──
            get('bp-verrijk-knop')?.addEventListener('click', () => this._triggerVerrijking());

            // ── KvK ophalen (stub) ──
            get('bp-kvk-ophalen')?.addEventListener('click', () => {
                this._toast('KvK verrijking komt binnenkort beschikbaar', 'info');
            });

            // ── Notities opslaan ──
            get('bp-notities-opslaan')?.addEventListener('click', () => this._opslaanNotities());

            // ── Documenten tab dropzone ──
            if (this._actieveTab === 2) this._bindDocumentenDropzone();
        },

        _herlaadTabsEnInhoud() {
            const refs     = this._data.referenties     || [];
            const relaties = this._data.bureau_relaties || [];
            const b        = this._data.bedrijf;
            const stats    = this._data.statistieken;

            this._setBp('bp-tabs',       this._renderTabs(refs, relaties));
            this._setBp('bp-tab-inhoud', this._renderTabInhoud(b, stats, refs));
            this._bindBodyEvents();
        },

        _toggleBewerken(forceer = null) {
            this._bewerkenActief = forceer !== null ? forceer : !this._bewerkenActief;
            const aan = this._bewerkenActief;

            document.querySelectorAll('.bp-veld-waarde').forEach(el => {
                el.style.display = aan ? 'none' : '';
            });
            document.querySelectorAll('.bp-veld-input').forEach(el => {
                el.style.display = aan ? 'block' : 'none';
            });

            const footer = document.getElementById('bp-edit-footer');
            if (footer) footer.style.display = aan ? 'flex' : 'none';

            const btn = document.getElementById('bp-edit-toggle');
            if (btn) btn.textContent = aan ? 'Annuleren' : 'Bewerken';
        },

        async _opslaanBedrijfsgegevens() {
            const updates = {};
            document.querySelectorAll('.bp-veld-input').forEach(input => {
                const veld = input.dataset.veld;
                const nieuw = input.value.trim();
                const oud   = String(this._data.bedrijf[veld] ?? '');
                if (nieuw !== oud) {
                    updates[veld] = nieuw || null;
                }
            });

            if (!Object.keys(updates).length) {
                this._toggleBewerken(false);
                return;
            }

            try {
                const token = await this._getToken();
                const resp = await fetch(`${this._baseUrl()}/api/v1/bedrijven/${this._bedrijfId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization':  `Bearer ${token}`,
                        'Content-Type':   'application/json',
                    },
                    body: JSON.stringify(updates),
                });
                if (!resp.ok) throw new Error('Opslaan mislukt');
                Object.assign(this._data.bedrijf, updates);
                this._toast('Opgeslagen', 'success');
                this._toggleBewerken(false);
                this._render();
            } catch (err) {
                console.error('[BedrijfsprofielModal] Opslaan fout:', err);
                this._toast('Fout bij opslaan', 'error');
            }
        },

        async _opslaanNotities() {
            const notities = document.getElementById('bp-notities')?.value ?? '';
            try {
                const token = await this._getToken();
                const resp = await fetch(`${this._baseUrl()}/api/v1/bedrijven/${this._bedrijfId}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type':  'application/json',
                    },
                    body: JSON.stringify({ notities }),
                });
                if (!resp.ok) throw new Error('Opslaan mislukt');
                this._data.bedrijf.notities = notities;
                this._toast('Notities opgeslagen', 'success');
            } catch (err) {
                console.error('[BedrijfsprofielModal] Notities opslaan fout:', err);
                this._toast('Fout bij opslaan', 'error');
            }
        },

        // ── Helpers ───────────────────────────────────────────────────────

        async _getToken() {
            const supabase = window.supabaseClient || window.supabase;
            const { data: { session } } = await supabase.auth.getSession();
            return session?.access_token || '';
        },

        _baseUrl() {
            return window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';
        },

        _setBp(id, html) {
            const el = document.getElementById(id);
            if (el) el.innerHTML = html;
        },

        _icon(name, size = 14, color = null) {
            const Icons = window.Icons || {};
            if (typeof Icons[name] === 'function') {
                return Icons[name]({ size, ...(color ? { color } : {}) });
            }
            return '';
        },

        _esc(str) {
            return String(str || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        },

        _formatDatum(iso) {
            if (!iso) return '—';
            return new Date(iso).toLocaleDateString('nl-NL', {
                day: 'numeric', month: 'short', year: 'numeric'
            });
        },

        _statusLabel(status) {
            return ({ potential: 'Potentieel', actief: 'Actief', voormalig: 'Voormalig', geblokkeerd: 'Geblokkeerd' })[status]
                || status || '—';
        },

        _toast(bericht, type = 'info') {
            if (typeof window.showToast === 'function') {
                window.showToast(bericht, type);
            } else {
                console.info(`[BP toast] ${type}: ${bericht}`);
            }
        },
    };

    window.BedrijfsprofielModal = BP;

})();
