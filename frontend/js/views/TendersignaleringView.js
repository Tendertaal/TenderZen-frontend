/**
 * TendersignaleringView.js — TenderZen
 * Bureau-breed dashboard: matches van alle signalering-actieve bedrijven van het bureau.
 * Tabs: Matches | Tender archief | Instellingen
 * Non-module global view: window.TendersignaleringView
 */
class TendersignaleringView {
    constructor() {
        this._container    = null;
        this._matches      = [];
        this._stats        = {};
        this._actieveFilter = 'alle';
        this._minScore     = 0;
        this._actieveMatch = null;
        this._bezig        = false;
        this._bureauId     = null;
        this._isSuperAdmin = false;
        this._aantalActief = 0;
        this._actieveTab   = 'matches';
        this._baseUrl      = window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';
        this._escHandler        = null;
        this._tenderEscHandler  = null;
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    mount(container, params = {}) {
        this._container = container;

        this._bureauId     = params.bureauId
            || window.app?.currentBureau?.bureau_id
            || null;
        this._isSuperAdmin = window.app?.isSuperAdmin || false;

        if (this._isSuperAdmin && !this._bureauId) {
            this._renderGeenBureau();
            return;
        }

        this._render('<div class="tsv-loading"><div class="tsv-spinner"></div> Laden…</div>');
        this._laadData();
    }

    unmount() {
        this._container = null;
    }

    // -----------------------------------------------------------------------
    // Data
    // -----------------------------------------------------------------------

    async _laadData() {
        try {
            let url = '/api/v1/tendersignalering/bureau-dashboard?';
            if (this._bureauId)              url += `bureau_id=${encodeURIComponent(this._bureauId)}&`;
            if (this._actieveFilter !== 'alle') url += `status=${this._actieveFilter}&`;
            if (this._minScore > 0)          url += `min_score=${this._minScore}`;

            const data = await this._fetch(url);
            this._matches      = data.matches || [];
            this._stats        = data.stats   || {};
            this._aantalActief = data.signalering_actieve_bedrijven || 0;
            this._renderVolledig();
        } catch (e) {
            this._render(`<div class="tsv-fout">Laden mislukt: ${e.message}</div>`);
        }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    _render(html) {
        if (this._container) this._container.innerHTML = `<div class="tsv-root">${html}</div>`;
    }

    _renderGeenBureau() {
        this._render(`
            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;color:#6b7280;padding:40px;">
                <div style="opacity:0.4;">${window.Icons.buildingOffice({ size: 48 })}</div>
                <h2 style="color:#1e1b4b;font-size:18px;margin:0;">Bureau selecteren</h2>
                <p style="font-size:14px;text-align:center;max-width:360px;line-height:1.6;">
                    Tendersignalering werkt per bureau. Selecteer een specifiek bureau via de bureauselector
                    in de topbar om matches te bekijken.
                </p>
            </div>`);
    }

    _renderVolledig() {
        if (!this._container) return;
        const root = document.createElement('div');
        root.className = 'tsv-root';
        root.innerHTML = `
            ${this._htmlHeader()}
            ${this._htmlStats()}
            ${this._htmlTabs()}
            <div id="tsv-tab-content" class="tsv-tab-content">
                ${this._actieveTab === 'matches'    ? this._htmlMatchesTab() : ''}
                ${this._actieveTab === 'archief'    ? '<div class="tsv-tab-laden"><div class="tsv-spinner"></div> Laden…</div>' : ''}
                ${this._actieveTab === 'instellingen' ? '<div class="tsv-tab-laden"><div class="tsv-spinner"></div> Laden…</div>' : ''}
            </div>`;
        this._container.innerHTML = '';
        this._container.appendChild(root);
        this._bindEvents(root);

        // Async tabs laden
        if (this._actieveTab === 'archief')     this._laadEnRenderArchief(root);
        if (this._actieveTab === 'instellingen') this._laadEnRenderInstellingen(root);
    }

    _htmlHeader() {
        const bureauNaam = window.app?.currentBureau?.bureau_naam || 'Bureau';
        const subTekst   = `${this._aantalActief} actieve bedrijven · ${this._matches.length} matches`;
        return `
        <div class="tsv-header">
            <div class="tsv-header-info">
                <h1 class="tsv-header-titel">Tendersignalering</h1>
                <p class="tsv-header-sub">${this._esc(bureauNaam)} · ${subTekst}</p>
            </div>
            <div class="tsv-header-acties">
                <button class="tsv-btn-secondary" data-action="ts-handmatig-toevoegen">
                    ${window.Icons.plus({ size: 14 })} Tender invoeren
                </button>
                <button class="tsv-scan-btn" id="tsv-scan-btn" ${this._aantalActief === 0 ? 'disabled' : ''}>
                    ${window.Icons.refresh({ size: 16 })} Alle bedrijven scannen
                </button>
            </div>
        </div>`;
    }

    _htmlStats() {
        const s = this._stats;
        return `
        <div class="tsv-stats">
            <div class="tsv-stat-kaart">
                <div class="tsv-stat-waarde">${s.totaal || 0}</div>
                <div class="tsv-stat-label">Totaal matches</div>
            </div>
            <div class="tsv-stat-kaart tsv-stat-kaart--paars">
                <div class="tsv-stat-waarde">${s.nieuw || 0}</div>
                <div class="tsv-stat-label">Nieuw</div>
            </div>
            <div class="tsv-stat-kaart tsv-stat-kaart--groen">
                <div class="tsv-stat-waarde">${s.opgeslagen || 0}</div>
                <div class="tsv-stat-label">Opgeslagen</div>
            </div>
            <div class="tsv-stat-kaart tsv-stat-kaart--oranje">
                <div class="tsv-stat-waarde">${s.gem_score || 0}</div>
                <div class="tsv-stat-label">Gem. score</div>
            </div>
            <div class="tsv-stat-kaart tsv-stat-kaart--groen">
                <div class="tsv-stat-waarde">${s.hoog_pct || 0}%</div>
                <div class="tsv-stat-label">Score ≥75</div>
            </div>
            <div class="tsv-stat-kaart">
                <div class="tsv-stat-waarde">${this._aantalActief}</div>
                <div class="tsv-stat-label">Actieve bedrijven</div>
            </div>
        </div>`;
    }

    _htmlTabs() {
        const tabs = [
            { id: 'matches',      label: 'Matches' },
            { id: 'archief',      label: 'Tender archief' },
            { id: 'instellingen', label: 'Instellingen' },
        ];
        return `
        <div class="tsv-tabs">
            ${tabs.map(t => `
                <button class="tsv-tab-btn ${this._actieveTab === t.id ? 'is-actief' : ''}"
                        data-tab="${t.id}">${t.label}</button>
            `).join('')}
        </div>`;
    }

    // -----------------------------------------------------------------------
    // Tab: Matches
    // -----------------------------------------------------------------------

    _htmlMatchesTab() {
        return `
        ${this._htmlFilters()}
        <div class="tsv-body">
            <div class="tsv-match-lijst" id="tsv-match-lijst">
                ${this._htmlMatchLijst()}
            </div>
            <div class="tsv-detail" id="tsv-detail">
                ${this._htmlDetailLeeg()}
            </div>
        </div>`;
    }

    _htmlFilters() {
        const filters = [
            { id: 'alle',       label: 'Alle' },
            { id: 'nieuw',         label: 'Nieuw' },
            { id: 'benaderd',      label: 'Benaderd' },
            { id: 'geinteresseerd', label: 'Geïnteresseerd' },
            { id: 'offerte',       label: 'Offerte' },
            { id: 'afgewezen',     label: 'Afgewezen' },
            { id: 'niet_relevant', label: 'Niet relevant' },
        ];
        return `
        <div class="tsv-filters">
            ${filters.map(f => `
                <button class="tsv-filter-btn ${this._actieveFilter === f.id ? 'is-actief' : ''}"
                        data-filter="${f.id}">${f.label}</button>
            `).join('')}
            <div class="tsv-filter-scheider"></div>
            <div class="tsv-min-score">
                Minscore: <strong id="tsv-min-score-label">${this._minScore}</strong>
                <input type="range" id="tsv-min-score-slider"
                       min="0" max="90" step="5" value="${this._minScore}">
            </div>
        </div>`;
    }

    _htmlMatchLijst() {
        if (!this._aantalActief) {
            return `
            <div class="tsv-leeg-lijst" style="padding:32px 16px;text-align:center;">
                <div style="margin-bottom:12px;">${window.Icons.zap({ size: 32 })}</div>
                <div style="font-weight:600;color:#1e1b4b;margin-bottom:6px;">Geen actieve signalering</div>
                <div style="font-size:12px;color:#9ca3af;line-height:1.5;">
                    Schakel signalering in via het Bedrijfsprofiel<br>van minimaal één bedrijf.
                </div>
            </div>`;
        }
        if (!this._matches.length) {
            return `<div class="tsv-leeg-lijst">Geen matches gevonden<br><span style="font-size:11px;color:#9ca3af;">Pas de filters aan of start een nieuwe scan.</span></div>`;
        }
        return this._matches.map(m => this._htmlMatchKaart(m)).join('');
    }

    _htmlMatchKaart(m) {
        const bedrijfsnaam = m.bedrijven?.bedrijfsnaam || '';
        const isActief     = this._actieveMatch?.id === m.id;
        const deadline     = m.deadline ? this._formatDatum(m.deadline) : '';
        const waarde       = (m.waarde_min || m.waarde_max)
            ? `€${Number(m.waarde_min || m.waarde_max).toLocaleString('nl-NL')}` : '';

        const afwijsKnop = m.status !== 'afgewezen' && m.status !== 'niet_relevant'
            ? `<button class="tsv-status-knop tsv-status-knop--afwijzen"
                       data-match-id="${m.id}" data-nieuwe-status="afgewezen">
                   ${window.Icons.x({ size: 12 })} Afwijzen
               </button>`
            : '';

        return `
        <div class="tsv-match-kaart ${isActief ? 'is-actief' : ''} tsv-mk--${m.status || 'nieuw'}"
             data-match-id="${m.id}" data-open-match="${m.id}">
            <div class="tsv-mk-accent"></div>
            <div class="tsv-mk-inner">
                <div class="tsv-mk-top">
                    <div class="tsv-mk-naam">${this._esc(m.tender_titel || 'Onbekende tender')}</div>
                    ${this._htmlScoreBadge(m.match_score, m.score_kleur)}
                </div>
                <div class="tsv-mk-info">
                    ${m.aanbestedende_dienst ? `
                    <div class="tsv-mk-info-line">
                        ${window.Icons.building({ size: 13 })}
                        <span>${this._esc(m.aanbestedende_dienst)}</span>
                    </div>` : ''}
                    ${bedrijfsnaam ? `
                    <div class="tsv-mk-info-line tsv-mk-info-line--bedrijf">
                        ${window.Icons.hardhat({ size: 13 })}
                        <span>${this._esc(bedrijfsnaam)}</span>
                    </div>` : ''}
                    ${deadline ? `
                    <div class="tsv-mk-info-line">
                        ${window.Icons.clock({ size: 13 })}
                        <span>${deadline}</span>
                    </div>` : ''}
                    ${waarde ? `
                    <div class="tsv-mk-info-line">
                        ${window.Icons.barChart({ size: 13 })}
                        <span>${waarde}</span>
                    </div>` : ''}
                </div>
                <div class="tsv-mk-footer">
                    <span class="tsv-status-badge tsv-status-badge--${m.status}">${this._statusLabel(m.status)}</span>
                    ${afwijsKnop}
                </div>
            </div>
        </div>`;
    }

    _htmlScoreBadge(score, kleur) {
        const cls = `tsv-score-badge--${kleur || 'rood'}`;
        return `<div class="tsv-score-badge ${cls}">${Math.round(score)}</div>`;
    }

    _htmlDetailLeeg() {
        return `
        <div class="tsv-detail-leeg">
            <div class="tsv-detail-leeg-icon">${window.Icons.fileText({ size: 48 })}</div>
            <div class="tsv-detail-leeg-tekst">Selecteer een match om details te bekijken</div>
        </div>`;
    }

    _htmlDetail(m) {
        const bedrijfsnaam = m.bedrijven?.bedrijfsnaam || '';
        const breakdown    = m.score_breakdown || {};
        const toelichting  = breakdown.toelichting || '';

        const breakdownVelden = [
            { key: 'competentie_match',   label: 'Competentie match',   max: 25 },
            { key: 'cpv_overlap',         label: 'CPV / sectoroverlap', max: 25 },
            { key: 'waarde_fit',          label: 'Contractwaarde fit',  max: 25 },
            { key: 'ervaring_relevantie', label: 'Ervaring relevantie', max: 25 },
        ];

        const breakdownRows = breakdownVelden.map(v => {
            const waarde = Number(breakdown[v.key] || 0);
            const pct    = (waarde / v.max) * 100;
            const kleur  = pct >= 70 ? 'hoog' : pct >= 40 ? 'midden' : 'laag';
            return `
            <div class="tsv-breakdown-rij">
                <div class="tsv-breakdown-naam">${v.label}</div>
                <div class="tsv-breakdown-bar-wrap">
                    <div class="tsv-breakdown-bar tsv-breakdown-bar--${kleur}"
                         style="width:${pct.toFixed(0)}%"></div>
                </div>
                <div class="tsv-breakdown-waarde">${waarde}</div>
                <div class="tsv-breakdown-max">/${v.max}</div>
            </div>`;
        }).join('');

        const waarde = (m.waarde_min || m.waarde_max)
            ? `€${Number(m.waarde_min || m.waarde_max).toLocaleString('nl-NL')}` : null;

        const statussen = [
            { value: 'nieuw',          label: 'Nieuw' },
            { value: 'benaderd',       label: 'Benaderd' },
            { value: 'geinteresseerd', label: 'Geïnteresseerd' },
            { value: 'offerte',        label: 'Offerte gevraagd' },
            { value: 'afgewezen',      label: 'Afgewezen' },
            { value: 'niet_relevant',  label: 'Niet relevant' },
        ];

        return `
        <div class="tsv-detail-header">
            <h2 class="tsv-detail-naam">${this._esc(m.tender_titel || 'Onbekende tender')}</h2>
            ${m.aanbestedende_dienst ? `
            <div class="tsv-detail-meta-rij">
                ${window.Icons.building({ size: 13 })}
                <span>${this._esc(m.aanbestedende_dienst)}</span>
            </div>` : ''}
            ${bedrijfsnaam ? `
            <div class="tsv-detail-meta-rij tsv-detail-meta-rij--bedrijf">
                ${window.Icons.hardhat({ size: 13 })}
                <span>${this._esc(bedrijfsnaam)}</span>
            </div>` : ''}

            <div class="tsv-detail-status-rij">
                <label class="tsv-detail-label">Status</label>
                <select class="tsv-detail-status-select"
                        data-action="ts-status-wijzigen"
                        data-match-id="${m.id}">
                    ${statussen.map(s => `
                    <option value="${s.value}" ${m.status === s.value ? 'selected' : ''}>${s.label}</option>`
                    ).join('')}
                </select>
            </div>
        </div>

        <div class="tsv-score-kaart">
            <div class="tsv-score-kaart-titel">
                ${window.Icons.barChart({ size: 14 })} Matchscore
                <span class="tsv-totaal-score">${Math.round(m.match_score)}<span class="tsv-totaal-score-label">/100</span></span>
            </div>
            ${breakdownRows}
            ${toelichting ? `
            <div class="tsv-toelichting">
                ${window.Icons.fileText({ size: 13 })}
                <span>${this._esc(toelichting)}</span>
            </div>` : ''}
        </div>

        <div class="tsv-tender-info">
            <div class="tsv-tender-info-titel">
                ${window.Icons.clipboardList({ size: 14 })} Tenderinformatie
            </div>
            ${this._infoRij('Procedure', m.procedure)}
            ${m.deadline ? `
            <div class="tsv-info-rij">
                <span class="tsv-info-sleutel">${window.Icons.clock({ size: 13 })} Deadline</span>
                <span class="tsv-info-waarde">${this._formatDatum(m.deadline)}</span>
            </div>` : ''}
            ${waarde ? `
            <div class="tsv-info-rij">
                <span class="tsv-info-sleutel">${window.Icons.barChart({ size: 13 })} Waarde</span>
                <span class="tsv-info-waarde">${waarde}</span>
            </div>` : ''}
            ${m.regio ? `
            <div class="tsv-info-rij">
                <span class="tsv-info-sleutel">${window.Icons.search({ size: 13 })} Regio</span>
                <span class="tsv-info-waarde">${this._esc(m.regio)}</span>
            </div>` : ''}
            ${this._infoRij('Gevonden op', this._formatDatum(m.gevonden_op))}
            ${m.tenderned_url ? `
                <div class="tsv-info-rij">
                    <span class="tsv-info-sleutel">TenderNed</span>
                    <a href="${this._esc(m.tenderned_url)}" target="_blank" rel="noopener"
                       class="tsv-info-waarde" style="color:#7c3aed;">Bekijk op TenderNed ${window.Icons.externalLink({ size: 14 })}</a>
                </div>` : ''}
        </div>

        ${this._htmlTenderAanmakenKnop(m)}`;
    }

    _infoRij(sleutel, waarde) {
        if (!waarde) return '';
        return `<div class="tsv-info-rij">
            <span class="tsv-info-sleutel">${sleutel}</span>
            <span class="tsv-info-waarde">${this._esc(String(waarde))}</span>
        </div>`;
    }

    // -----------------------------------------------------------------------
    // Tab: Tender archief
    // -----------------------------------------------------------------------

    async _laadEnRenderArchief(root) {
        const content = root.querySelector('#tsv-tab-content');
        if (!content) return;
        try {
            let url = '/api/v1/tendersignalering/tenders';
            if (this._bureauId) url += `?bureau_id=${encodeURIComponent(this._bureauId)}`;
            const data = await this._fetch(url);
            content.innerHTML = this._htmlArchiefTab(data.tenders || []);
        } catch (e) {
            content.innerHTML = `<div class="tsv-fout">Archief laden mislukt: ${e.message}</div>`;
        }
    }

    _htmlArchiefTab(tenders) {
        if (!tenders.length) {
            return `
            <div class="tsv-archief-leeg">
                <div style="margin-bottom:12px;">${window.Icons.fileText({ size: 32 })}</div>
                <div style="font-weight:600;color:#1e1b4b;margin-bottom:6px;">Geen tenders in archief</div>
                <div style="font-size:12px;color:#9ca3af;line-height:1.5;">
                    Ingevoerde tenders verschijnen hier. Gebruik "+ Tender invoeren" om te beginnen.
                </div>
            </div>`;
        }

        const rijen = tenders.map(t => {
            const deadline = t.deadline ? this._formatDatum(t.deadline) : '—';
            const waarde   = t.waarde_max
                ? `€${Number(t.waarde_max).toLocaleString('nl-NL')}`
                : (t.waarde_min ? `€${Number(t.waarde_min).toLocaleString('nl-NL')}` : '—');
            const aangemaakt = this._formatDatum(t.created_at);

            return `
            <div class="tsv-archief-rij" data-archief-tender-id="${t.id}">
                <div class="tsv-archief-rij-hoofd">
                    <div class="tsv-archief-titel">${this._esc(t.tender_titel || 'Onbekend')}</div>
                    <div class="tsv-archief-meta">
                        ${t.aanbestedende_dienst ? `<span class="tsv-match-tag">${this._esc(t.aanbestedende_dienst)}</span>` : ''}
                        <span class="tsv-match-tag">${deadline}</span>
                        <span class="tsv-match-tag">${waarde}</span>
                        <span class="tsv-archief-badge">${t.matches_count || 0} matches</span>
                    </div>
                    <div class="tsv-archief-datum">Ingevoerd: ${aangemaakt}</div>
                </div>
                <div class="tsv-archief-rij-acties">
                    <button class="tsv-archief-btn tsv-archief-btn--hermatchen"
                            data-action="ts-hermatchen" data-tender-id="${t.id}">
                        ${window.Icons.refresh({ size: 14 })} Hermatchen
                    </button>
                    <button class="tsv-archief-btn tsv-archief-btn--verwijderen"
                            data-action="ts-tender-verwijderen" data-tender-id="${t.id}">
                        ${window.Icons.trash({ size: 14 })} Verwijderen
                    </button>
                </div>
            </div>`;
        }).join('');

        return `
        <div class="tsv-archief">
            <div class="tsv-archief-header">
                <h3>Tender archief <span style="font-weight:400;font-size:13px;color:#6b7280;">(${tenders.length} tenders)</span></h3>
                <p style="font-size:12px;color:#9ca3af;margin:4px 0 0;">
                    Alle handmatig ingevoerde tenders. Hermatchen herberekent scores met actuele instellingen.
                </p>
            </div>
            <div class="tsv-archief-lijst">${rijen}</div>
        </div>`;
    }

    async handleTsTenderHermatchen(tenderId) {
        if (!tenderId) return;
        const btn = document.querySelector(`[data-action="ts-hermatchen"][data-tender-id="${tenderId}"]`);
        if (btn) { btn.disabled = true; btn.innerHTML = `${window.Icons.refresh({ size: 14 })} Bezig…`; }

        try {
            const res = await this._fetch(`/api/v1/tendersignalering/tenders/${tenderId}/hermatchen`, {
                method: 'POST',
            });
            this._toast(`Hermatchen klaar: ${res.nieuwe_matches} nieuwe matches`, 'ok');
            // Reload archief tab
            const root = this._container?.querySelector('.tsv-root');
            if (root) await this._laadEnRenderArchief(root);
            // Reload matches tab data op de achtergrond
            const data = await this._fetch(
                `/api/v1/tendersignalering/bureau-dashboard?${this._bureauId ? 'bureau_id=' + encodeURIComponent(this._bureauId) : ''}`
            );
            this._matches      = data.matches || [];
            this._stats        = data.stats   || {};
            this._aantalActief = data.signalering_actieve_bedrijven || 0;
        } catch (e) {
            this._toast('Hermatchen mislukt: ' + e.message, 'fout');
            if (btn) { btn.disabled = false; btn.innerHTML = `${window.Icons.refresh({ size: 14 })} Hermatchen`; }
        }
    }

    async handleTsTenderVerwijderen(tenderId) {
        if (!tenderId) return;
        if (!confirm('Verwijder deze tender en alle bijbehorende matches?')) return;

        try {
            await this._fetch(`/api/v1/tendersignalering/tenders/${tenderId}`, { method: 'DELETE' });
            this._toast('Tender verwijderd', 'ok');
            const root = this._container?.querySelector('.tsv-root');
            if (root) await this._laadEnRenderArchief(root);
        } catch (e) {
            this._toast('Verwijderen mislukt: ' + e.message, 'fout');
        }
    }

    // -----------------------------------------------------------------------
    // Tab: Instellingen
    // -----------------------------------------------------------------------

    async _laadEnRenderInstellingen(root) {
        const content = root.querySelector('#tsv-tab-content');
        if (!content) return;
        try {
            let url = '/api/v1/tendersignalering/instellingen';
            if (this._bureauId) url += `?bureau_id=${encodeURIComponent(this._bureauId)}`;
            const data = await this._fetch(url);
            content.innerHTML = this._htmlInstellingenTab(data.instellingen || {});
            this._bindInstellingenSliders(content);
        } catch (e) {
            content.innerHTML = `<div class="tsv-fout">Instellingen laden mislukt: ${e.message}</div>`;
        }
    }

    _htmlInstellingenTab(inst) {
        const w = {
            vakinhoud:       inst.weging_vakinhoud       ?? 35,
            certificeringen: inst.weging_certificeringen ?? 25,
            regio:           inst.weging_regio           ?? 20,
            financieel:      inst.weging_financieel      ?? 12,
            ervaring:        inst.weging_ervaring        ?? 8,
        };
        const d = {
            opslaan:      inst.drempel_opslaan      ?? 0,
            hoog:         inst.drempel_hoog         ?? 75,
            notificatie:  inst.drempel_notificatie  ?? 80,
        };

        const wegingRij = (key, label, val) => `
        <div class="tsv-weging-rij">
            <label class="tsv-weging-label">${label}</label>
            <input type="range" class="tsv-weging-slider" id="tsv-w-${key}"
                   data-weging="${key}" min="0" max="100" step="1" value="${val}">
            <span class="tsv-weging-waarde" id="tsv-w-${key}-val">${val}</span>
            <span class="tsv-weging-pct">pt</span>
        </div>`;

        return `
        <div class="tsv-instellingen">
            <div class="tsv-inst-sectie">
                <h3 class="tsv-inst-titel">Wegingen matchscore</h3>
                <p class="tsv-inst-omschrijving">
                    Bepaal hoe zwaar elke categorie meetelt in de totale matchscore (0–100 punten).
                    De wegingen moeten samen optellen tot <strong>100</strong>.
                </p>
                <div class="tsv-weging-container">
                    ${wegingRij('vakinhoud',       'Vakinhoud / competenties', w.vakinhoud)}
                    ${wegingRij('certificeringen', 'Certificeringen',          w.certificeringen)}
                    ${wegingRij('regio',           'Regio / geografie',        w.regio)}
                    ${wegingRij('financieel',      'Financiële schaal',        w.financieel)}
                    ${wegingRij('ervaring',        'Ervaring / referenties',   w.ervaring)}
                </div>
                <div class="tsv-weging-totaal">
                    Totaal: <strong id="tsv-weging-totaal">${w.vakinhoud + w.certificeringen + w.regio + w.financieel + w.ervaring}</strong>
                    <span id="tsv-weging-totaal-status" class="tsv-weging-totaal-status ${
                        w.vakinhoud + w.certificeringen + w.regio + w.financieel + w.ervaring === 100
                        ? 'is-ok' : 'is-fout'
                    }">
                        ${w.vakinhoud + w.certificeringen + w.regio + w.financieel + w.ervaring === 100 ? `${window.Icons.check({ size: 12 })} Klopt` : `${window.Icons.x({ size: 12 })} Moet 100 zijn`}
                    </span>
                </div>
            </div>

            <div class="tsv-inst-sectie">
                <h3 class="tsv-inst-titel">Drempelwaarden</h3>
                <p class="tsv-inst-omschrijving">
                    Stel in vanaf welke score matches worden opgeslagen en wanneer een score als "hoog" wordt beschouwd.
                </p>
                <div class="tsv-drempel-grid">
                    <div class="tsv-drempel-veld">
                        <label>Minimale score om op te slaan</label>
                        <div class="tsv-drempel-input-wrap">
                            <input type="number" id="tsv-d-opslaan" class="tsv-drempel-input"
                                   min="0" max="99" value="${d.opslaan}" placeholder="0">
                            <span class="tsv-drempel-eenheid">/ 100</span>
                        </div>
                        <p class="tsv-drempel-hint">Matches onder deze score worden niet opgeslagen (0 = alles opslaan)</p>
                    </div>
                    <div class="tsv-drempel-veld">
                        <label>Drempel "hoge score"</label>
                        <div class="tsv-drempel-input-wrap">
                            <input type="number" id="tsv-d-hoog" class="tsv-drempel-input"
                                   min="1" max="100" value="${d.hoog}" placeholder="75">
                            <span class="tsv-drempel-eenheid">/ 100</span>
                        </div>
                        <p class="tsv-drempel-hint">Matches boven deze score krijgen de groene badge</p>
                    </div>
                    <div class="tsv-drempel-veld">
                        <label>Drempel notificatie</label>
                        <div class="tsv-drempel-input-wrap">
                            <input type="number" id="tsv-d-notificatie" class="tsv-drempel-input"
                                   min="1" max="100" value="${d.notificatie}" placeholder="80">
                            <span class="tsv-drempel-eenheid">/ 100</span>
                        </div>
                        <p class="tsv-drempel-hint">Matches boven deze score kunnen een notificatie triggeren</p>
                    </div>
                </div>
            </div>

            <div class="tsv-inst-footer">
                <button class="tsv-btn-ghost" data-action="ts-instellingen-reset">Standaard herstellen</button>
                <button class="tsv-btn-primary" data-action="ts-instellingen-opslaan">Instellingen opslaan</button>
            </div>
        </div>`;
    }

    _bindInstellingenSliders(container) {
        // Live update van weging-waarden en totaal
        container.querySelectorAll('.tsv-weging-slider').forEach(slider => {
            slider.addEventListener('input', () => {
                const key = slider.dataset.weging;
                const val = parseInt(slider.value);
                const label = container.querySelector(`#tsv-w-${key}-val`);
                if (label) label.textContent = val;

                // Herbereken totaal
                let totaal = 0;
                container.querySelectorAll('.tsv-weging-slider').forEach(s => {
                    totaal += parseInt(s.value);
                });
                const totaalEl = container.querySelector('#tsv-weging-totaal');
                const statusEl = container.querySelector('#tsv-weging-totaal-status');
                if (totaalEl) totaalEl.textContent = totaal;
                if (statusEl) {
                    statusEl.innerHTML = totaal === 100
                        ? `${window.Icons.check({ size: 12 })} Klopt`
                        : `${window.Icons.x({ size: 12 })} Moet 100 zijn`;
                    statusEl.className = `tsv-weging-totaal-status ${totaal === 100 ? 'is-ok' : 'is-fout'}`;
                }
            });
        });
    }

    async handleTsInstellingenOpslaan() {
        const container = this._container?.querySelector('#tsv-tab-content');
        if (!container) return;

        const wegingen = {};
        container.querySelectorAll('.tsv-weging-slider').forEach(s => {
            wegingen[s.dataset.weging] = parseInt(s.value);
        });

        const som = Object.values(wegingen).reduce((a, b) => a + b, 0);
        if (som !== 100) {
            this._toast(`Wegingen tellen op tot ${som}, moeten 100 zijn`, 'fout');
            return;
        }

        const body = {
            weging_vakinhoud:       wegingen.vakinhoud       ?? 35,
            weging_certificeringen: wegingen.certificeringen ?? 25,
            weging_regio:           wegingen.regio           ?? 20,
            weging_financieel:      wegingen.financieel      ?? 12,
            weging_ervaring:        wegingen.ervaring        ?? 8,
            drempel_opslaan:        parseInt(container.querySelector('#tsv-d-opslaan')?.value) || 0,
            drempel_hoog:           parseInt(container.querySelector('#tsv-d-hoog')?.value)    || 75,
            drempel_notificatie:    parseInt(container.querySelector('#tsv-d-notificatie')?.value) || 80,
        };

        const btn = container.querySelector('[data-action="ts-instellingen-opslaan"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Opslaan…'; }

        try {
            let url = '/api/v1/tendersignalering/instellingen';
            if (this._bureauId) url += `?bureau_id=${encodeURIComponent(this._bureauId)}`;
            await this._fetch(url, { method: 'PUT', body: JSON.stringify(body) });
            this._toast('Instellingen opgeslagen', 'ok');
        } catch (e) {
            this._toast('Opslaan mislukt: ' + e.message, 'fout');
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Instellingen opslaan'; }
        }
    }

    handleTsInstellingenReset() {
        const container = this._container?.querySelector('#tsv-tab-content');
        if (!container) return;

        const defaults = {
            vakinhoud: 35, certificeringen: 25, regio: 20, financieel: 12, ervaring: 8,
        };
        Object.entries(defaults).forEach(([key, val]) => {
            const slider = container.querySelector(`#tsv-w-${key}`);
            const label  = container.querySelector(`#tsv-w-${key}-val`);
            if (slider) slider.value = val;
            if (label)  label.textContent = val;
        });

        const totaalEl = container.querySelector('#tsv-weging-totaal');
        const statusEl = container.querySelector('#tsv-weging-totaal-status');
        if (totaalEl) totaalEl.textContent = 100;
        if (statusEl) { statusEl.innerHTML = `${window.Icons.check({ size: 12 })} Klopt`; statusEl.className = 'tsv-weging-totaal-status is-ok'; }

        const drempelDefaults = { 'tsv-d-opslaan': 0, 'tsv-d-hoog': 75, 'tsv-d-notificatie': 80 };
        Object.entries(drempelDefaults).forEach(([id, val]) => {
            const el = container.querySelector(`#${id}`);
            if (el) el.value = val;
        });

        this._toast('Standaardwaarden hersteld (nog niet opgeslagen)', 'ok');
    }

    // -----------------------------------------------------------------------
    // Tender aanmaken (AIDA flow)
    // -----------------------------------------------------------------------

    _htmlTenderAanmakenKnop(m) {
        const toonKnop = ['geinteresseerd', 'offerte'].includes(m.status);
        if (!toonKnop) return '';

        if (m.tenderzen_tender_id) {
            return `
            <div class="ts-tender-link">
                ${window.Icons.check({ size: 14 })}
                <span>Tender aangemaakt in TenderZen</span>
                <button class="ts-btn-link" data-action="ts-naar-tender"
                        data-tender-id="${m.tenderzen_tender_id}">
                    Bekijken ${window.Icons.externalLink({ size: 12 })}
                </button>
            </div>`;
        }

        return `
        <button class="ts-btn-tender-aanmaken" data-action="ts-tender-aanmaken"
                data-match-id="${m.id}">
            ${window.Icons.plus({ size: 16 })} Tender aanmaken in TenderZen
        </button>`;
    }

    _htmlTenderAanmakenModal(m) {
        const titel   = this._esc(m.tender_titel || 'Nieuwe tender');
        const dienst  = this._esc(m.aanbestedende_dienst || '');
        const deadline = m.deadline ? m.deadline.split('T')[0] : '';
        const bedrijfsnaam = m.bedrijven?.bedrijfsnaam || 'Onbekend';

        return `
        <div class="ts-modal-overlay" id="ts-tender-modal" role="dialog" aria-modal="true">
          <div class="ts-modal">
            <div class="ts-modal-header">
              <h3>${window.Icons.plus({ size: 16 })} Tender aanmaken in acquisitie funnel</h3>
              <button class="ts-modal-sluit-btn" data-action="ts-tender-modal-sluiten"
                      aria-label="Sluiten">${window.Icons.x({ size: 16 })}</button>
            </div>
            <div class="ts-modal-body">
              <div class="ts-aida-banner">
                  ${window.Icons.zap({ size: 14 })}
                  <span>Wordt aangemaakt in fase <b>Acquisitie</b> en is direct
                  zichtbaar in de Kanban en Tenderlijst.</span>
              </div>

              <div class="ts-form-grid">
                <div class="ts-form-veld ts-form-veld--full">
                  <label>Tendernaam <span class="ts-verplicht">*</span></label>
                  <input type="text" id="ts-ta-naam" value="${titel}">
                </div>
                <div class="ts-form-veld">
                  <label>Aanbestedende dienst</label>
                  <input type="text" id="ts-ta-dienst" value="${dienst}">
                </div>
                <div class="ts-form-veld">
                  <label>Deadline inschrijving</label>
                  <input type="date" id="ts-ta-deadline" value="${deadline}">
                </div>
                <div class="ts-form-veld">
                  <label>Waarde min (€)</label>
                  <input type="number" id="ts-ta-waarde-min"
                         value="${m.waarde_min || ''}">
                </div>
                <div class="ts-form-veld">
                  <label>Waarde max (€)</label>
                  <input type="number" id="ts-ta-waarde-max"
                         value="${m.waarde_max || ''}">
                </div>
                <div class="ts-form-veld ts-form-veld--full">
                  <label>Notities / omschrijving</label>
                  <textarea id="ts-ta-omschrijving" rows="3"
                    placeholder="Optionele toelichting...">${this._esc(m.score_breakdown?.toelichting || '')}</textarea>
                </div>
              </div>

              <div class="ts-fase-preview">
                  ${window.Icons.crown({ size: 14 })}
                  Fase: <b>Acquisitie</b> · Bedrijf: <b>${this._esc(bedrijfsnaam)}</b>
              </div>
            </div>
            <div class="ts-modal-footer">
              <button class="ts-btn-ghost" data-action="ts-tender-modal-sluiten">Annuleren</button>
              <button class="ts-btn-primary ts-btn-groen"
                      data-action="ts-tender-modal-bevestigen"
                      data-match-id="${m.id}">
                  ${window.Icons.check({ size: 14 })} Tender aanmaken
              </button>
            </div>
          </div>
        </div>`;
    }

    handleTsTenderAanmaken(matchId) {
        const match = this._matches.find(m => m.id === matchId);
        if (!match) return;
        if (document.getElementById('ts-tender-modal')) return;

        document.body.insertAdjacentHTML('beforeend', this._htmlTenderAanmakenModal(match));

        const modal = document.getElementById('ts-tender-modal');
        modal.addEventListener('click', e => {
            if (e.target === modal) this.handleTsTenderModalSluiten();
        });

        this._tenderEscHandler = e => {
            if (e.key === 'Escape') this.handleTsTenderModalSluiten();
        };
        document.addEventListener('keydown', this._tenderEscHandler);
        setTimeout(() => document.getElementById('ts-ta-naam')?.focus(), 50);
    }

    handleTsTenderModalSluiten() {
        document.getElementById('ts-tender-modal')?.remove();
        if (this._tenderEscHandler) {
            document.removeEventListener('keydown', this._tenderEscHandler);
            this._tenderEscHandler = null;
        }
    }

    async handleTsTenderModalBevestigen(btn) {
        const matchId = btn.dataset.matchId;
        const naam = document.getElementById('ts-ta-naam')?.value?.trim();
        if (!naam) {
            this._toast('Tendernaam is verplicht', 'fout');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = `${window.Icons.refresh({ size: 14 })} Aanmaken…`;

        const body = {
            tender_naam:          naam,
            aanbestedende_dienst: document.getElementById('ts-ta-dienst')?.value?.trim() || null,
            deadline:             document.getElementById('ts-ta-deadline')?.value || null,
            waarde_min:           parseFloat(document.getElementById('ts-ta-waarde-min')?.value) || null,
            waarde_max:           parseFloat(document.getElementById('ts-ta-waarde-max')?.value) || null,
            omschrijving:         document.getElementById('ts-ta-omschrijving')?.value?.trim() || null,
        };

        try {
            const res = await this._fetch(
                `/api/v1/tendersignalering/matches/${matchId}/tender-aanmaken`,
                { method: 'POST', body: JSON.stringify(body) }
            );
            this.handleTsTenderModalSluiten();
            this._toast(`Tender '${res.tender_naam}' aangemaakt in acquisitie!`, 'ok');
            await this._laadData();
        } catch (err) {
            this._toast('Aanmaken mislukt: ' + err.message, 'fout');
            btn.disabled = false;
            btn.innerHTML = `${window.Icons.check({ size: 14 })} Tender aanmaken`;
        }
    }

    handleTsNaarTender(tenderId) {
        if (!tenderId) return;
        if (window.app?.navigeerNaar) {
            window.app.navigeerNaar('tenders');
        } else {
            window.location.hash = '#tenders';
        }
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    _bindEvents(root) {
        // Centrale click delegation op root
        root.addEventListener('click', e => {
            // Tab wisselen
            const tabBtn = e.target.closest('.tsv-tab-btn[data-tab]');
            if (tabBtn) {
                this._actieveTab = tabBtn.dataset.tab;
                root.querySelectorAll('.tsv-tab-btn').forEach(b => {
                    b.classList.toggle('is-actief', b.dataset.tab === this._actieveTab);
                });
                const content = root.querySelector('#tsv-tab-content');
                if (!content) return;
                if (this._actieveTab === 'matches') {
                    content.innerHTML = this._htmlMatchesTab();
                    this._bindMatchesEvents(root, content);
                } else if (this._actieveTab === 'archief') {
                    content.innerHTML = '<div class="tsv-tab-laden"><div class="tsv-spinner"></div> Laden…</div>';
                    this._laadEnRenderArchief(root);
                } else if (this._actieveTab === 'instellingen') {
                    content.innerHTML = '<div class="tsv-tab-laden"><div class="tsv-spinner"></div> Laden…</div>';
                    this._laadEnRenderInstellingen(root);
                }
                return;
            }

            // Header acties
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'ts-handmatig-toevoegen') { this.handleTsHandmatigToevoegen(); return; }
            if (action === 'ts-handmatig-sluiten')   { this.handleTsHandmatigSluiten();   return; }
            if (action === 'ts-handmatig-matchen')   { this.handleTsHandmatigMatchen();    return; }

            // Archief acties
            if (action === 'ts-hermatchen') {
                this.handleTsTenderHermatchen(e.target.closest('[data-tender-id]')?.dataset.tenderId);
                return;
            }
            if (action === 'ts-tender-verwijderen') {
                this.handleTsTenderVerwijderen(e.target.closest('[data-tender-id]')?.dataset.tenderId);
                return;
            }

            // Instellingen acties
            if (action === 'ts-instellingen-opslaan') { this.handleTsInstellingenOpslaan(); return; }
            if (action === 'ts-instellingen-reset')   { this.handleTsInstellingenReset();   return; }

            // Tender aanmaken (AIDA flow)
            if (action === 'ts-tender-aanmaken') {
                this.handleTsTenderAanmaken(e.target.closest('[data-match-id]')?.dataset.matchId);
                return;
            }
            if (action === 'ts-tender-modal-sluiten')    { this.handleTsTenderModalSluiten(); return; }
            if (action === 'ts-tender-modal-bevestigen') {
                this.handleTsTenderModalBevestigen(e.target.closest('[data-action]'));
                return;
            }
            if (action === 'ts-naar-tender') {
                this.handleTsNaarTender(e.target.closest('[data-tender-id]')?.dataset.tenderId);
                return;
            }

            // Status knoppen in matches-tab
            const statusBtn = e.target.closest('[data-nieuwe-status]');
            if (statusBtn) {
                e.stopPropagation();
                this._updateStatus(statusBtn.dataset.matchId, statusBtn.dataset.nieuweStatus);
                return;
            }

            // Match-kaarten openen
            const kaart = e.target.closest('[data-open-match]');
            if (kaart) {
                const match = this._matches.find(m => m.id === kaart.dataset.openMatch);
                if (match) this._toonDetail(match, root);
            }

            // Scan-knop
            if (e.target.closest('#tsv-scan-btn')) {
                this._startBureauScan(root);
                return;
            }
        });

        // Filter en slider events (matches tab)
        if (this._actieveTab === 'matches') {
            this._bindMatchesEvents(root, root.querySelector('#tsv-tab-content'));
        }
    }

    _bindMatchesEvents(root, content) {
        if (!content) return;

        // Filter buttons
        content.querySelectorAll('.tsv-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._actieveFilter = btn.dataset.filter;
                this._actieveMatch  = null;
                this._laadData();
            });
        });

        // Min-score slider
        const slider = content.querySelector('#tsv-min-score-slider');
        if (slider) {
            slider.addEventListener('input', () => {
                this._minScore = parseInt(slider.value);
                const label = content.querySelector('#tsv-min-score-label');
                if (label) label.textContent = this._minScore;
            });
            slider.addEventListener('change', () => {
                this._actieveMatch = null;
                this._laadData();
            });
        }
    }

    _toonDetail(match, root) {
        this._actieveMatch = match;

        root.querySelectorAll('.tsv-match-kaart').forEach(k => {
            k.classList.toggle('is-actief', k.dataset.openMatch === match.id);
        });

        const detail = root.querySelector('#tsv-detail');
        if (detail) {
            detail.innerHTML = this._htmlDetail(match);
            this._bindDetailEvents(detail, match, root);
        }
    }

    _bindDetailEvents(detail, match, root) {
        const select = detail.querySelector('.tsv-detail-status-select');
        if (!select) return;

        select.addEventListener('change', async () => {
            const nieuweStatus = select.value;
            await this._updateStatus(match.id, nieuweStatus, false);

            // Update match object in local list
            const localMatch = this._matches.find(m => m.id === match.id);
            if (localMatch) localMatch.status = nieuweStatus;
            if (this._actieveMatch?.id === match.id) this._actieveMatch = localMatch || match;

            // Re-render match kaart in lijst (accent bar + badge kleur)
            const kaart = root.querySelector(`.tsv-match-kaart[data-match-id="${match.id}"]`);
            if (kaart && localMatch) {
                kaart.outerHTML = this._htmlMatchKaart(localMatch);
                // Heractiveer is-actief na vervanging
                const nieuweKaart = root.querySelector(`.tsv-match-kaart[data-match-id="${match.id}"]`);
                if (nieuweKaart) nieuweKaart.classList.add('is-actief');
            }

            // Re-render detail panel met nieuwe status
            const updatedMatch = this._matches.find(m => m.id === match.id) || match;
            detail.innerHTML = this._htmlDetail(updatedMatch);
            this._bindDetailEvents(detail, updatedMatch, root);
        });
    }

    async _updateStatus(matchId, nieuweStatus, herlaad = true) {
        const match = this._matches.find(m => m.id === matchId);
        if (!match) return;

        try {
            await this._fetch(`/api/v1/tendersignalering/matches/${matchId}/status`, {
                method: 'PATCH',
                body:   JSON.stringify({ status: nieuweStatus }),
            });
            match.status = nieuweStatus;
            if (this._actieveMatch?.id === matchId) this._actieveMatch = match;
            this._toast(`Status bijgewerkt: ${this._statusLabel(nieuweStatus)}`, 'ok');
            if (herlaad) await this._laadData();
        } catch (e) {
            this._toast('Status bijwerken mislukt: ' + e.message, 'fout');
        }
    }

    async _startBureauScan(root) {
        if (this._bezig) return;
        this._bezig = true;
        const btn = root.querySelector('#tsv-scan-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="tsv-spinner" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Scannen…';
        }

        try {
            let url = '/api/v1/tendersignalering/scan-bureau';
            if (this._bureauId) url += `?bureau_id=${encodeURIComponent(this._bureauId)}`;

            const res = await this._fetch(url, {
                method: 'POST',
                body:   JSON.stringify({ max_tenders_per_bedrijf: 20 }),
            });
            this._toast(
                `Scan klaar: ${res.gescande_bedrijven} bedrijven · ${res.totaal_nieuwe_matches} nieuwe matches`,
                'ok'
            );
            await this._laadData();
        } catch (e) {
            this._toast('Scan mislukt: ' + e.message, 'fout');
            if (btn) { btn.disabled = false; btn.innerHTML = `${window.Icons.refresh({ size: 16 })} Alle bedrijven scannen`; }
        } finally {
            this._bezig = false;
        }
    }

    // -----------------------------------------------------------------------
    // Handmatig invoer modal
    // -----------------------------------------------------------------------

    _renderHandmatigModal() {
        return `
        <div class="ts-modal-overlay" id="ts-handmatig-modal" role="dialog" aria-modal="true">
          <div class="ts-modal">
            <div class="ts-modal-header">
              <h3>Tender handmatig invoeren</h3>
              <button class="ts-modal-sluit-btn" data-action="ts-handmatig-sluiten" aria-label="Sluiten">${window.Icons.x({ size: 16 })}</button>
            </div>
            <div class="ts-modal-body">

              <div class="ts-form-rij">
                <label>Aanbesteding tekst <span class="ts-verplicht">*</span></label>
                <textarea id="ts-tender-tekst" rows="8"
                  placeholder="Plak hier de volledige aanbesteding omschrijving vanuit TenderNed...

Tip: kopieer minimaal de titel, omschrijving en eisen voor de beste match."></textarea>
              </div>

              <div class="ts-form-grid">
                <div class="ts-form-veld">
                  <label>Titel (optioneel)</label>
                  <input type="text" id="ts-tender-titel"
                         placeholder="Bijv: Renovatie kozijnen gemeente Amsterdam">
                </div>
                <div class="ts-form-veld">
                  <label>Aanbestedende dienst</label>
                  <input type="text" id="ts-tender-dienst"
                         placeholder="Bijv: Gemeente Amsterdam">
                </div>
                <div class="ts-form-veld">
                  <label>Deadline</label>
                  <input type="date" id="ts-tender-deadline">
                </div>
                <div class="ts-form-veld">
                  <label>Procedure</label>
                  <select id="ts-tender-procedure">
                    <option value="">— Kies —</option>
                    <option>Enkelvoudig onderhands</option>
                    <option>Meervoudig onderhands</option>
                    <option>Openbaar</option>
                    <option>Europees openbaar</option>
                    <option>Niet-openbaar</option>
                  </select>
                </div>
                <div class="ts-form-veld">
                  <label>Waarde min (€)</label>
                  <input type="number" id="ts-tender-waarde-min" placeholder="0">
                </div>
                <div class="ts-form-veld">
                  <label>Waarde max (€)</label>
                  <input type="number" id="ts-tender-waarde-max" placeholder="0">
                </div>
              </div>

              <div class="ts-form-veld">
                <label>TenderNed URL (optioneel)</label>
                <input type="url" id="ts-tender-url"
                       placeholder="https://www.tenderned.nl/aankondigingen/...">
              </div>

            </div>
            <div class="ts-modal-footer">
              <button class="ts-btn-ghost" data-action="ts-handmatig-sluiten">Annuleren</button>
              <button class="ts-btn-primary" data-action="ts-handmatig-matchen">
                Matchen met signaleringsklanten
              </button>
            </div>
          </div>
        </div>`;
    }

    handleTsHandmatigToevoegen() {
        if (document.getElementById('ts-handmatig-modal')) return;

        document.body.insertAdjacentHTML('beforeend', this._renderHandmatigModal());

        const modal = document.getElementById('ts-handmatig-modal');
        modal.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'ts-handmatig-sluiten') {
                this.handleTsHandmatigSluiten();
            } else if (action === 'ts-handmatig-matchen') {
                this.handleTsHandmatigMatchen();
            }
            if (e.target === modal) {
                this.handleTsHandmatigSluiten();
            }
        });

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.handleTsHandmatigSluiten();
        };
        document.addEventListener('keydown', this._escHandler);
        setTimeout(() => document.getElementById('ts-tender-tekst')?.focus(), 50);
    }

    handleTsHandmatigSluiten() {
        document.getElementById('ts-handmatig-modal')?.remove();
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
    }

    async handleTsHandmatigMatchen() {
        const tekst = document.getElementById('ts-tender-tekst')?.value?.trim();
        if (!tekst || tekst.length < 50) {
            document.getElementById('ts-tender-tekst')?.classList.add('ts-input-fout');
            this._toast('Voer minimaal 50 tekens in als aanbesteding tekst.', 'fout');
            return;
        }

        const body = {
            aanbesteding_tekst:   tekst,
            tender_titel:         document.getElementById('ts-tender-titel')?.value?.trim() || null,
            aanbestedende_dienst: document.getElementById('ts-tender-dienst')?.value?.trim() || null,
            deadline:             document.getElementById('ts-tender-deadline')?.value || null,
            procedure:            document.getElementById('ts-tender-procedure')?.value || null,
            waarde_min:           parseFloat(document.getElementById('ts-tender-waarde-min')?.value) || null,
            waarde_max:           parseFloat(document.getElementById('ts-tender-waarde-max')?.value) || null,
            tenderned_url:        document.getElementById('ts-tender-url')?.value?.trim() || null,
        };

        const btn = document.querySelector('[data-action="ts-handmatig-matchen"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Matchen…'; }

        try {
            let url = '/api/v1/tendersignalering/match-handmatig';
            if (this._bureauId) url += `?bureau_id=${encodeURIComponent(this._bureauId)}`;

            const res = await this._fetch(url, {
                method: 'POST',
                body:   JSON.stringify(body),
            });

            this.handleTsHandmatigSluiten();
            this._toast(
                `${res.matches_aangemaakt} matches gevonden voor ${res.bedrijven_gescand} bedrijven`,
                'ok'
            );
            await this._laadData();

        } catch (err) {
            if (btn) { btn.disabled = false; btn.textContent = 'Matchen met signaleringsklanten'; }
            this._toast('Match mislukt — ' + err.message, 'fout');
        }
    }

    // -----------------------------------------------------------------------
    // API
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
    // Helpers
    // -----------------------------------------------------------------------

    _statusLabel(status) {
        const labels = {
            nieuw:          'Nieuw',
            benaderd:       'Benaderd',
            geinteresseerd: 'Geïnteresseerd',
            offerte:        'Offerte',
            afgewezen:      'Afgewezen',
            niet_relevant:  'Niet relevant',
            bekeken:        'Bekeken',
            opgeslagen:     'Opgeslagen',
        };
        return labels[status] || status;
    }

    _formatDatum(iso) {
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d) ? iso : d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    _esc(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _toast(bericht, type = 'ok') {
        document.getElementById('tsv-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'tsv-toast';
        el.className = `tsv-toast tsv-toast--${type}`;
        el.textContent = bericht;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-zichtbaar'));
        setTimeout(() => { el.classList.remove('is-zichtbaar'); setTimeout(() => el.remove(), 250); }, 3000);
    }
}

window.TendersignaleringView = TendersignaleringView;
