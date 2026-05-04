/**
 * TendermatchView — Acquisitie matching pagina
 * TenderZen v2.0 — sessie management + tender aanmaken flow
 *
 * Drie-koloms layout:
 *   Sidebar (260px, sessie lijst) | Content area (nieuw match form / kandidaten)
 */

class TendermatchView {

    constructor() {
        this.container = null;
        this.sessies = [];
        this.activeSessieId = null;
        this.kandidaten = [];
        this.analyse = null;
        this.isLoading = false;
        this.isMatchLoading = false;
        this.showingNieuweMatch = true;
        this._modalEl = null;
        this.kandidaatStatussen = [];
    }

    // ── App.js interface ──────────────────────────────────────────────────

    mount(container) {
        this.container = container;
        this._renderSkeleton();
        this._laadSessies();
        this._laadKandidaatStatussen();
    }

    unmount() {
        this._sluitModal();
        if (this.container) this.container.innerHTML = '';
        this.container = null;
    }

    // ── Skeleton render ───────────────────────────────────────────────────

    _renderSkeleton() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="tm-layout">
                <div class="tm-sidebar">
                    <div class="tm-sb-header">
                        <span class="tm-sb-title">Sessies</span>
                        <button class="tm-sb-nieuw-btn" id="tm-nieuw-btn" title="Nieuwe match">
                            ${this._icon('plus', 14)}
                        </button>
                    </div>
                    <div class="tm-sb-list" id="tm-sb-list">
                        <div class="tm-sb-loading">
                            <div class="tm-spinner"></div>
                        </div>
                    </div>
                </div>

                <div class="tm-content" id="tm-content">
                    ${this._htmlNieuweMatch()}
                </div>
            </div>
        `;

        this.container.querySelector('#tm-nieuw-btn')
            ?.addEventListener('click', () => this._toonNieuweMatch());

        // Listeners voor de initieel gerenderde nieuw-match form
        this._attachMatchListeners();
    }

    // ── Sidebar: sessie lijst ─────────────────────────────────────────────

    async _laadSessies() {
        try {
            const bureauId = window.app?.currentBureau?.bureau_id || '';
            const qs = bureauId ? `?bureau_id=${encodeURIComponent(bureauId)}` : '';
            const data = await this._apiFetch(`/api/v1/tendermatch/sessies${qs}`);
            this.sessies = data || [];
        } catch (e) {
            console.warn('[TendermatchView] Sessies laden mislukt:', e);
            this.sessies = [];
        }
        this._renderSessieLijst();
    }

    _renderSessieLijst() {
        const list = this.container?.querySelector('#tm-sb-list');
        if (!list) return;

        if (!this.sessies.length) {
            list.innerHTML = `
                <div class="tm-sb-leeg">
                    Nog geen sessies.<br>Klik + voor een nieuwe match.
                </div>`;
            return;
        }

        list.innerHTML = this.sessies.map(s => {
            const isActief = s.id === this.activeSessieId;
            const datum = s.created_at
                ? new Date(s.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                : '';
            const trashIcon = this._icon('trash', 14, '#94a3b8');
            return `
                <div class="tm-sessie-item${isActief ? ' actief' : ''}" data-sessie-id="${s.id}">
                    <span class="tm-sessie-dot ${this._statusDotKlasse(s.status)}"></span>
                    <div class="tm-sessie-item-content">
                        <span class="tm-sessie-titel">${this._esc(s.titel || 'Naamloos')}</span>
                        <span class="tm-sessie-meta">${datum}${s.kandidaten_count ? ` · ${s.kandidaten_count} kandidaten` : ''}</span>
                    </div>
                    <button class="tm-sessie-delete" data-sessie-id="${s.id}" title="Verwijderen">
                        ${trashIcon}
                    </button>
                </div>`;
        }).join('');

        list.querySelectorAll('.tm-sessie-item').forEach(el => {
            el.addEventListener('click', () => {
                const sid = el.dataset.sessieId;
                console.log('[TendermatchView] Sessie geklikt:', sid);
                this._selecteerSessie(sid);
            });

            el.querySelector('.tm-sessie-delete')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const sid = e.currentTarget.dataset.sessieId;
                const sessie = this.sessies.find(s => s.id === sid);
                this._verwijderSessie(sid, sessie?.titel || 'Naamloos');
            });
        });
    }

    _statusDotKlasse(status) {
        if (status === 'geconverteerd') return 'tm-dot-groen';
        if (status === 'gesloten') return 'tm-dot-grijs';
        return 'tm-dot-blauw';
    }

    // ── Content area: nieuw match form ────────────────────────────────────

    _toonNieuweMatch() {
        this.activeSessieId = null;
        this.showingNieuweMatch = true;
        this.kandidaten = [];
        this.analyse = null;
        this._renderSessieLijst();

        const content = this.container?.querySelector('#tm-content');
        if (content) content.innerHTML = this._htmlNieuweMatch();
        this._attachMatchListeners();
    }

    _htmlNieuweMatch() {
        const zapIcon = this._icon('zap', 14, '#ffffff');
        return `
            <div class="tm-nieuw-wrap">
                <div class="tm-nieuw-header">
                    <span class="tm-nieuw-title">Nieuwe Tendermatch</span>
                    <span class="tm-nieuw-sub">Plak een aanbesteding — Claude analyseert en matcht met uw bedrijvendatabase</span>
                </div>

                <div class="tm-nieuw-body">
                    <textarea
                        id="tm-textarea"
                        class="tm-textarea"
                        placeholder="Plak hier de aanbesteding omschrijving vanuit TenderNed...&#10;&#10;Tip: kopieer minimaal de titel en omschrijving voor de beste match."
                    ></textarea>
                    <button id="tm-match-btn" class="tm-match-btn">
                        ${zapIcon}
                        Match deze tender
                    </button>
                    <span class="tm-hint">
                        Claude analyseert de tekst en zoekt passende bedrijven uit uw database
                    </span>

                    <div id="tm-analyse" class="tm-analyse" style="display:none"></div>

                    <div id="tm-resultaten-wrap" class="tm-resultaten-wrap" style="display:none">
                        <div class="tm-resultaten-header">
                            <span class="tm-resultaten-titel" id="tm-resultaten-titel">Kandidaten</span>
                            <span class="tm-resultaten-count" id="tm-resultaten-count"></span>
                        </div>
                        <div id="tm-resultaten-body" class="tm-resultaten-body"></div>
                    </div>
                </div>
            </div>
        `;
    }

    _attachMatchListeners() {
        this.container?.querySelector('#tm-match-btn')
            ?.addEventListener('click', () => this._startMatch());
    }

    // ── Matching ──────────────────────────────────────────────────────────

    async _startMatch() {
        console.log('[TendermatchView] _startMatch aangeroepen');
        const tekst = this.container?.querySelector('#tm-textarea')?.value?.trim();
        if (!tekst || tekst.length < 50) {
            this._toast('Vul minimaal een korte aanbestedingstekst in (50+ tekens).', 'warning');
            return;
        }

        this._setMatchLoading(true);

        try {
            const data = await this._apiFetch('/api/v1/tendermatch/match', {
                method: 'POST',
                body: JSON.stringify({
                    aanbesteding_tekst: tekst,
                    tenderbureau_id: window.app?.currentBureau?.bureau_id || null
                })
            });

            this.kandidaten = data.shortlist || [];
            this.analyse = data.analyse || {};
            const nieuweSessieId = data.sessie_id;

            // Voeg sessie toe aan sidebar (inclusief analyse_json voor de strip)
            if (nieuweSessieId && data.titel) {
                this.sessies.unshift({
                    id: nieuweSessieId,
                    titel: data.titel,
                    status: 'open',
                    kandidaten_count: this.kandidaten.length,
                    analyse_json: data.analyse || {},
                    aanbesteding_tekst: this.container?.querySelector('#tm-textarea')?.value?.trim() || '',
                    created_at: new Date().toISOString(),
                });
            }

            // Toon analyse
            this._renderAnalyse(this.analyse, data.bedrijven_in_database);

            // Toon resultaten in hetzelfde form-scherm
            const wrap = this.container?.querySelector('#tm-resultaten-wrap');
            if (wrap) {
                const titelEl = wrap.querySelector('#tm-resultaten-titel');
                const countEl = wrap.querySelector('#tm-resultaten-count');
                if (titelEl) titelEl.textContent = 'Kandidaten';
                if (countEl) countEl.textContent = this.kandidaten.length
                    ? `${this.kandidaten.length} gevonden`
                    : '';
                wrap.style.display = 'block';
                this._renderKandidaten(this.kandidaten, nieuweSessieId, '#tm-resultaten-body');
            }

            if (nieuweSessieId) {
                this.activeSessieId = nieuweSessieId;
                this.showingNieuweMatch = false;
            }

            this._renderSessieLijst();

            if (!this.kandidaten.length) {
                this._toast('Geen matches gevonden. Probeer een uitgebreidere omschrijving.', 'info');
            }

        } catch (e) {
            console.error('[TendermatchView] Match fout:', e);
            this._toast(`Fout: ${e.message}`, 'error');
        }

        this._setMatchLoading(false);
    }

    // ── Content area: sessie kandidaten ──────────────────────────────────

    async _selecteerSessie(sessieId) {
        // Guard verwijderd: was te strikt en blokkeerde herladen na _startMatch
        // (activeSessieId werd al gezet door _startMatch, dus klik daarna deed niets)

        this.activeSessieId = sessieId;
        this.showingNieuweMatch = false;
        this._renderSessieLijst();

        const content = this.container?.querySelector('#tm-content');
        if (!content) return;

        const sessie = this.sessies.find(s => s.id === sessieId);
        const analyse = sessie?.analyse_json || {};
        const analyseTags = [
            ...(analyse.sectoren || []).map(s =>
                `<span class="tm-tag tm-tag-sector">${this._esc(s)}</span>`),
            analyse.regio
                ? `<span class="tm-tag tm-tag-regio">${this._esc(analyse.regio)}</span>`
                : '',
            ...(analyse.certificeringen || []).map(c =>
                `<span class="tm-tag tm-tag-cert">${this._esc(c)}</span>`),
        ].join('');
        const metaVelden = [
            { label: 'Aanbestedende dienst', waarde: analyse.aanbestedende_dienst },
            { label: 'Deadline', waarde: analyse.deadline },
            { label: 'Type opdracht', waarde: analyse.type_opdracht },
            { label: 'Procedure', waarde: analyse.procedure },
            { label: 'Aard opdracht', waarde: analyse.aard_opdracht },
            { label: 'CPV-codes', waarde: Array.isArray(analyse.cpv_codes) ? analyse.cpv_codes.join(', ') : analyse.cpv_codes },
            { label: 'TenderNed kenmerk', waarde: analyse.tenderned_kenmerk },
            { label: 'Referentienummer', waarde: analyse.referentienummer },
        ].filter(r => r.waarde);
        const metaTabelHtml = metaVelden.length ? `
            <div class="tm-analyse-meta-tabel">
                ${metaVelden.map(r => `
                <div class="tm-analyse-meta-rij">
                    <span class="tm-analyse-meta-label">${this._esc(r.label)}</span>
                    <span class="tm-analyse-meta-waarde">${this._esc(String(r.waarde))}</span>
                </div>`).join('')}
            </div>` : '';
        const analyseHtml = (analyse.omschrijving || analyseTags || metaVelden.length) ? `
            <div class="tm-analyse-strip">
                <div class="tm-analyse-label">Analyse</div>
                <div class="tm-analyse-omschrijving">${this._esc(analyse.omschrijving || '')}</div>
                ${analyseTags ? `<div class="tm-tags">${analyseTags}</div>` : ''}
                ${metaTabelHtml}
                <div class="tm-analyse-meta">${sessie?.kandidaten_count || 0} kandidaten gevonden</div>
            </div>` : '';

        content.innerHTML = `
            <div class="tm-sessie-wrap">
                <div class="tm-sessie-topbar">
                    <div class="tm-sessie-topbar-links">
                        <span class="tm-sessie-topbar-titel">${this._esc(sessie?.titel || 'Sessie')}</span>
                    </div>
                    <div class="tm-sessie-topbar-rechts">
                        <button class="tm-actie-btn tm-actie-terug" title="Terug naar nieuwe match">
                            ${this._icon('arrow-left', 14)} Terug
                        </button>
                    </div>
                </div>
                ${analyseHtml}
                ${sessie?.aanbesteding_tekst ? `
                <details class="tm-aanbesteding-tekst">
                    <summary>Omschrijving tender</summary>
                    <div class="tm-aanbesteding-inhoud">${this._esc(sessie.aanbesteding_tekst)}</div>
                </details>` : ''}
                <div id="tm-kandlist-body" class="tm-kandlist-body">
                    <div class="tm-loading">
                        <div class="tm-spinner"></div>
                        <span>Kandidaten laden...</span>
                    </div>
                </div>
            </div>
        `;

        content.querySelector('.tm-actie-terug')?.addEventListener('click', () => {
            this._toonNieuweMatch();
        });

        try {
            const kandidaten = await this._apiFetch(`/api/v1/tendermatch/sessies/${sessieId}/kandidaten`);
            this.kandidaten = kandidaten || [];
            console.log('[TendermatchView] Kandidaten geladen:', this.kandidaten);
            this._renderKandidaten(this.kandidaten, sessieId, '#tm-kandlist-body');
        } catch (e) {
            console.error('[TendermatchView] Kandidaten laden mislukt:', e);
            const body = content.querySelector('#tm-kandlist-body');
            if (body) body.innerHTML = `<div class="tm-error">Fout bij laden: ${this._esc(e.message)}</div>`;
        }
    }

    // ── Kandidaat statussen laden ─────────────────────────────────────────

    async _laadKandidaatStatussen() {
        try {
            const data = await this._apiFetch('/api/v1/tendermatch/acquisitie-statussen');
            this.kandidaatStatussen = data || [];
        } catch (e) {
            console.error('[TendermatchView] Statussen laden fout:', e);
            this.kandidaatStatussen = [
                { status_key: 'zoeken_bedrijf', status_display: 'Zoeken bedrijf' },
                { status_key: 'afgewezen', status_display: 'Afgewezen' },
            ];
        }
    }

    // ── Score breakdown visualisatie ─────────────────────────────────────

    _renderScoreBreakdown(breakdown) {
        if (!breakdown || !Object.keys(breakdown).length) return '';

        const criteria = [
            { key: 'sector',          label: 'Sector',          max: 3 },
            { key: 'regio',           label: 'Regio',           max: 2 },
            { key: 'certificeringen', label: 'Certificeringen', max: 3 },
            { key: 'referenties',     label: 'Referenties',     max: 2 },
        ];

        const rijen = criteria.map(c => {
            const item = breakdown[c.key];
            if (!item) return '';
            const pct = Math.round((item.score / c.max) * 100);
            const kleur = pct >= 80 ? '#0F6E56' : pct >= 50 ? '#854F0B' : '#94a3b8';
            return `
                <div class="tm-breakdown-rij">
                    <span class="tm-breakdown-label">${c.label}</span>
                    <div class="tm-breakdown-bar-wrap">
                        <div class="tm-breakdown-bar" style="width:${pct}%;background:${kleur}"></div>
                    </div>
                    <span class="tm-breakdown-score" style="color:${kleur}">${item.score}/${c.max}</span>
                    <span class="tm-breakdown-reden">${this._esc(item.reden || '')}</span>
                </div>`;
        }).join('');

        return rijen ? `<div class="tm-breakdown">${rijen}</div>` : '';
    }

    // ── Kandidaten render ─────────────────────────────────────────────────

    _renderKandidaten(kandidaten, sessieId, bodySelector) {
        const body = this.container?.querySelector(bodySelector);
        if (!body) return;

        if (!kandidaten.length) {
            body.innerHTML = `
                <div class="tm-empty">
                    ${this._icon('users', 28, '#cbd5e1')}
                    <span>Geen kandidaten gevonden voor deze sessie</span>
                </div>`;
            return;
        }

        body.innerHTML = kandidaten.map((k, idx) => {
            const certs = k.certificeringen || [];
            const heeftTender = !!k.tender_id;
            const heeftSnapshot = !!k.tender_naam_snapshot;
            return `
            <div class="tm-kandidaat-card${heeftTender ? ' tm-card-geconverteerd' : ''}" data-idx="${idx}">
                <div class="tm-card-top">
                    <span class="tm-card-naam">${this._esc(k.bedrijfsnaam)}</span>
                    <div class="tm-card-top-rechts">
                        ${k.aanbevolen ? `<span class="tm-aanbevolen">Aanbevolen</span>` : ''}
                        <span class="tm-score-badge ${this._scoreKlasse(k.match_score)}">${k.match_score}/10</span>
                    </div>
                </div>
                <div class="tm-card-meta">
                    ${k.plaats ? `<span class="tm-meta-tag">${this._esc(k.plaats)}</span>` : ''}
                    ${k.branche ? `<span class="tm-meta-tag">${this._esc(k.branche)}</span>` : ''}
                    ${certs.length ? `<span class="tm-meta-tag tm-cert-ok">${this._icon('check', 11, '#0F6E56')} ${this._esc(certs[0])}</span>` : ''}
                    ${k.aantal_referenties ? `<span class="tm-meta-tag">${this._icon('fileText', 11, '#94a3b8')} ${k.aantal_referenties} referenties</span>` : ''}
                </div>
                <div class="tm-card-reden">${this._esc(k.match_reden || '')}</div>
                ${this._renderScoreBreakdown(k.score_breakdown)}
                ${k.matchingsadvies ? `
                <details class="tm-advies-details">
                    <summary class="tm-advies-summary">${this._icon('info', 12, '#4338ca')} Matchingsadvies</summary>
                    <div class="tm-advies-tekst">${this._esc(k.matchingsadvies)}</div>
                </details>` : ''}
                <div class="tm-card-footer">
                    <select class="tm-status-select" data-kandidaat-id="${k.id || ''}" data-idx="${idx}">
                        ${this.kandidaatStatussen.map(s => `
                        <option value="${this._esc(s.status_key)}"${k.status === s.status_key ? ' selected' : ''}>${this._esc(s.status_display)}</option>`).join('')}
                    </select>
                    <div class="tm-card-acties">
                        ${k.contact_email
                            ? `<a href="mailto:${this._esc(k.contact_email)}" class="tm-contact-link" title="${this._esc(k.contact_email)}">
                                   ${this._icon('mail', 12, '#4338ca')} Mail
                               </a>`
                            : ''}
                        ${heeftTender
                            ? `<span class="tm-tender-badge">${this._icon('check', 11, '#0F6E56')} Tender aangemaakt</span>`
                            : heeftSnapshot
                            ? `<span class="tm-tender-verwijderd">
                                   ${this._icon('alertCircle', 12, '#94a3b8')} Tender verwijderd: ${this._esc(k.tender_naam_snapshot)}
                               </span>`
                            : `<button class="tm-tender-btn" data-idx="${idx}" title="Toevoegen als tender">
                                   ${this._icon('plus', 12, '#ffffff')} Als tender
                               </button>`}
                    </div>
                </div>
            </div>`;
        }).join('');

        // Status select listeners
        body.querySelectorAll('.tm-status-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const kandidaatId = e.target.dataset.kandidaatId;
                this._updateKandidaatStatus(kandidaatId, e.target.value);
            });
        });

        // Tender aanmaken listeners
        body.querySelectorAll('.tm-tender-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                this._toonTenderModal(kandidaten[idx], sessieId);
            });
        });
    }

    // ── Tender aanmaken modal ─────────────────────────────────────────────

    _toonTenderModal(kandidaat, sessieId) {
        this._sluitModal();

        const sessie = this.sessies.find(s => s.id === sessieId);
        const analyse = sessie?.analyse_json || {};

        // Voorgestelde waarden uit Claude analyse
        const voorNaam     = analyse.tender_naam || sessie?.titel || '';
        const voorDienst   = analyse.aanbestedende_dienst || '';
        const voorDeadline = analyse.deadline || '';
        const voorCpv      = (analyse.cpv_codes || []).join(', ');
        const voorProcedure = analyse.procedure || '';
        const voorType     = analyse.type_opdracht || '';
        const voorKenmerk  = analyse.tenderned_kenmerk || '';
        const voorRef      = analyse.referentienummer || '';
        const heeftAI      = !!(analyse.tender_naam || analyse.aanbestedende_dienst);

        const opt = (val, label, cur) =>
            `<option value="${val}"${cur === val ? ' selected' : ''}>${label}</option>`;

        const overlay = document.createElement('div');
        overlay.className = 'tm-modal-overlay';
        overlay.innerHTML = `
            <div class="tm-modal tm-modal-breed">
                <div class="tm-modal-header">
                    <span class="tm-modal-titel">Tender aanmaken</span>
                    <button class="tm-modal-sluit" id="tm-modal-sluit">
                        ${this._icon('x', 16, '#64748b')}
                    </button>
                </div>
                <div class="tm-modal-body">
                    <div class="tm-modal-bedrijf">
                        <span class="tm-modal-bedrijf-naam">${this._esc(kandidaat.bedrijfsnaam)}</span>
                        <span class="tm-modal-bedrijf-meta">${[kandidaat.branche, kandidaat.plaats].filter(Boolean).join(' · ')}</span>
                    </div>

                    ${heeftAI ? `
                    <div class="tm-modal-ai-badge">
                        ${this._icon('zap', 11, '#6366f1')}
                        Automatisch ingevuld door Claude
                    </div>` : ''}

                    <div class="tm-form-group">
                        <label class="tm-form-label">Tendernaam <span class="tm-vereist">*</span></label>
                        <input type="text" id="tm-tender-naam" class="tm-form-input"
                               placeholder="Naam van de aanbesteding" maxlength="200"
                               value="${this._esc(voorNaam)}" />
                    </div>

                    <div class="tm-form-row">
                        <div class="tm-form-group">
                            <label class="tm-form-label">Aanbestedende dienst <span class="tm-vereist">*</span></label>
                            <input type="text" id="tm-tender-dienst" class="tm-form-input"
                                   placeholder="Bijv. Gemeente Amsterdam"
                                   value="${this._esc(voorDienst)}" />
                        </div>
                        <div class="tm-form-group">
                            <label class="tm-form-label">Deadline indiening</label>
                            <input type="date" id="tm-tender-deadline" class="tm-form-input"
                                   value="${this._esc(voorDeadline)}" />
                        </div>
                    </div>

                    <div class="tm-form-row">
                        <div class="tm-form-group">
                            <label class="tm-form-label">Type opdracht</label>
                            <select id="tm-tender-type" class="tm-form-input">
                                <option value="">— selecteer —</option>
                                ${opt('diensten',   'Diensten',   voorType)}
                                ${opt('leveringen', 'Leveringen', voorType)}
                                ${opt('werken',     'Werken',     voorType)}
                            </select>
                        </div>
                        <div class="tm-form-group">
                            <label class="tm-form-label">Procedure</label>
                            <select id="tm-tender-procedure" class="tm-form-input">
                                <option value="">— selecteer —</option>
                                ${opt('openbaar',             'Openbaar',             voorProcedure)}
                                ${opt('niet-openbaar',        'Niet-openbaar',        voorProcedure)}
                                ${opt('onderhandeling',       'Onderhandeling',       voorProcedure)}
                                ${opt('meervoudig onderhands','Meervoudig onderhands',voorProcedure)}
                            </select>
                        </div>
                    </div>

                    <div class="tm-form-row">
                        <div class="tm-form-group">
                            <label class="tm-form-label">TenderNed kenmerk</label>
                            <input type="text" id="tm-tender-kenmerk" class="tm-form-input"
                                   placeholder="Bijv. 585883"
                                   value="${this._esc(voorKenmerk)}" />
                        </div>
                        <div class="tm-form-group">
                            <label class="tm-form-label">Referentienummer</label>
                            <input type="text" id="tm-tender-ref" class="tm-form-input"
                                   placeholder="Bijv. 1019251"
                                   value="${this._esc(voorRef)}" />
                        </div>
                    </div>

                    <div class="tm-form-group">
                        <label class="tm-form-label">CPV codes</label>
                        <input type="text" id="tm-tender-cpv" class="tm-form-input"
                               placeholder="Bijv. 79600000-0, 79620000-6"
                               value="${this._esc(voorCpv)}" />
                    </div>

                    <div class="tm-modal-fout" id="tm-modal-fout" style="display:none"></div>
                </div>
                <div class="tm-modal-footer">
                    <button class="tm-modal-annuleer" id="tm-modal-annuleer">Annuleren</button>
                    <button class="tm-modal-opslaan" id="tm-modal-opslaan">
                        ${this._icon('plus', 14, '#ffffff')} Tender aanmaken
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this._modalEl = overlay;

        overlay.querySelector('#tm-modal-sluit')?.addEventListener('click', () => this._sluitModal());
        overlay.querySelector('#tm-modal-annuleer')?.addEventListener('click', () => this._sluitModal());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._sluitModal();
        });

        overlay.querySelector('#tm-modal-opslaan')?.addEventListener('click', () => {
            this._maakTenderAan(kandidaat, sessieId);
        });

        setTimeout(() => overlay.querySelector('#tm-tender-naam')?.focus(), 50);
    }

    async _maakTenderAan(kandidaat, sessieId) {
        const naam      = document.getElementById('tm-tender-naam')?.value?.trim();
        const dienst    = document.getElementById('tm-tender-dienst')?.value?.trim();
        const deadline  = document.getElementById('tm-tender-deadline')?.value || null;
        const type      = document.getElementById('tm-tender-type')?.value || null;
        const procedure = document.getElementById('tm-tender-procedure')?.value || null;
        const kenmerk   = document.getElementById('tm-tender-kenmerk')?.value?.trim() || null;
        const ref       = document.getElementById('tm-tender-ref')?.value?.trim() || null;
        const cpvTekst  = document.getElementById('tm-tender-cpv')?.value?.trim();
        const cpvCodes  = cpvTekst
            ? cpvTekst.split(',').map(c => c.trim()).filter(Boolean)
            : null;

        const foutEl = document.getElementById('tm-modal-fout');

        if (!naam) {
            if (foutEl) { foutEl.textContent = 'Vul een tendernaam in.'; foutEl.style.display = 'block'; }
            document.getElementById('tm-tender-naam')?.focus();
            return;
        }
        if (!dienst) {
            if (foutEl) { foutEl.textContent = 'Vul de aanbestedende dienst in.'; foutEl.style.display = 'block'; }
            document.getElementById('tm-tender-dienst')?.focus();
            return;
        }
        if (foutEl) foutEl.style.display = 'none';

        const opslaanBtn = document.getElementById('tm-modal-opslaan');
        if (opslaanBtn) { opslaanBtn.disabled = true; opslaanBtn.textContent = 'Aanmaken...'; }

        try {
            const activeBureauId = window.app?.currentBureau?.bureau_id || null;
            if (!activeBureauId) throw new Error('Geen actief bureau geselecteerd');

            const apiService = window.apiService || window.app?.apiService;
            if (!apiService) throw new Error('apiService niet beschikbaar');

            const sessie = this.sessies.find(s => s.id === sessieId);

            const tenderData = {
                naam: naam,                                          // correcte kolomnaam (was: tender_naam)
                aanbestedende_dienst: dienst || null,
                opdrachtgever: dienst || null,                       // beide velden syncroon houden
                fase: 'acquisitie',
                deadline_indiening: deadline || null,
                tenderbureau_id: activeBureauId,
                bedrijf_id: kandidaat.bedrijf_id || null,
                type: type || null,
                aanbestedingsprocedure: procedure || null,
                tender_nummer: kenmerk || null,
                referentie_nummer: ref || null,
                cpv_codes: cpvCodes,
                omschrijving: sessie?.analyse_json?.omschrijving || null,
                bron: 'tendermatch',
            };

            const nieuweTender = await apiService.createTender(tenderData);
            const tenderId = nieuweTender?.id || nieuweTender?.data?.id;

            // Koppel kandidaat aan tender als we een kandidaat-ID hebben
            if (tenderId && kandidaat.id) {
                try {
                    await this._apiFetch(`/api/v1/tendermatch/kandidaat/${kandidaat.id}/tender`, {
                        method: 'PATCH',
                        body: JSON.stringify({ tender_id: tenderId })
                    });

                    // Sla tendernaam op als snapshot zodat we "Tender verwijderd" kunnen tonen
                    const supabase = window.supabaseClient || window.supabase;
                    await supabase
                        .from('tendermatch_kandidaten')
                        .update({ tender_naam_snapshot: naam })
                        .eq('id', kandidaat.id);
                } catch (e) {
                    console.warn('[TendermatchView] Tender-kandidaat koppeling mislukt:', e);
                }

                // Sessie markeren als geconverteerd
                try {
                    await this._apiFetch(`/api/v1/tendermatch/sessies/${sessieId}/status`, {
                        method: 'PATCH',
                        body: JSON.stringify({ status: 'geconverteerd' })
                    });
                    const sessie = this.sessies.find(s => s.id === sessieId);
                    if (sessie) sessie.status = 'geconverteerd';
                    this._renderSessieLijst();
                } catch (e) {
                    console.warn('[TendermatchView] Sessie status update mislukt:', e);
                }
            }

            this._sluitModal();
            this._toast(`Tender "${naam}" aangemaakt in Acquisitie!`, 'success');

            // Herlaad kandidaten zodat de geconverteerde kaart bijgewerkt wordt
            if (sessieId) {
                await this._selecteerSessie(sessieId);
            }

        } catch (e) {
            console.error('[TendermatchView] Tender aanmaken mislukt:', e);
            if (foutEl) { foutEl.textContent = `Fout: ${e.message}`; foutEl.style.display = 'block'; }
            if (opslaanBtn) { opslaanBtn.disabled = false; opslaanBtn.innerHTML = `${this._icon('plus', 14, '#ffffff')} Tender aanmaken`; }
        }
    }

    _sluitModal() {
        if (this._modalEl) {
            this._modalEl.remove();
            this._modalEl = null;
        }
    }

    // ── Analyse render (in nieuw-match form) ─────────────────────────────

    _renderAnalyse(analyse, totaalBedrijven) {
        const el = this.container?.querySelector('#tm-analyse');
        if (!el || !analyse) return;

        const tags = [
            ...(analyse.sectoren || []).map(s =>
                `<span class="tm-tag tm-tag-sector">${this._esc(s)}</span>`),
            analyse.regio
                ? `<span class="tm-tag tm-tag-regio">${this._esc(analyse.regio)}</span>`
                : '',
            ...(analyse.certificeringen || []).map(c =>
                `<span class="tm-tag tm-tag-cert">${this._esc(c)}</span>`),
        ].join('');

        const metaVelden = [
            { label: 'Aanbestedende dienst', waarde: analyse.aanbestedende_dienst },
            { label: 'Deadline', waarde: analyse.deadline },
            { label: 'Type opdracht', waarde: analyse.type_opdracht },
            { label: 'Procedure', waarde: analyse.procedure },
            { label: 'Aard opdracht', waarde: analyse.aard_opdracht },
            { label: 'CPV-codes', waarde: Array.isArray(analyse.cpv_codes) ? analyse.cpv_codes.join(', ') : analyse.cpv_codes },
            { label: 'TenderNed kenmerk', waarde: analyse.tenderned_kenmerk },
            { label: 'Referentienummer', waarde: analyse.referentienummer },
        ].filter(r => r.waarde);
        const metaTabelHtml = metaVelden.length ? `
            <div class="tm-analyse-meta-tabel">
                ${metaVelden.map(r => `
                <div class="tm-analyse-meta-rij">
                    <span class="tm-analyse-meta-label">${this._esc(r.label)}</span>
                    <span class="tm-analyse-meta-waarde">${this._esc(String(r.waarde))}</span>
                </div>`).join('')}
            </div>` : '';

        el.innerHTML = `
            <div class="tm-analyse-label">Analyse</div>
            <div class="tm-analyse-tekst">${this._esc(analyse.omschrijving || '')}</div>
            <div class="tm-tags">${tags}</div>
            ${metaTabelHtml}
            <div class="tm-analyse-meta">${totaalBedrijven || 0} bedrijven doorzocht</div>
        `;
        el.style.display = 'block';
    }

    // ── API helpers ───────────────────────────────────────────────────────

    async _apiFetch(path, options = {}) {
        const supabase = window.supabaseClient || window.supabase;
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';
        const baseURL = window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';

        const res = await fetch(`${baseURL}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(options.headers || {}),
            }
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || `Server fout: ${res.status}`);
        }

        return res.json();
    }

    async _updateKandidaatStatus(kandidaatId, nieuweStatus) {
        if (!kandidaatId) return;
        try {
            await this._apiFetch(`/api/v1/tendermatch/kandidaat/${kandidaatId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: nieuweStatus })
            });
        } catch (e) {
            console.error('[TendermatchView] Status update fout:', e);
        }
    }

    async _verwijderSessie(id, titel) {
        const bevestigd = await window.ConfirmDialog.show({
            titel: 'Sessie verwijderen',
            bericht: `"${titel}" en alle bijbehorende kandidaten worden permanent verwijderd.`,
            bevestigTekst: 'Verwijderen',
            annuleerTekst: 'Annuleren',
            type: 'danger'
        });
        if (!bevestigd) return;

        try {
            const supabase = window.supabaseClient || window.supabase;

            // Verwijder kandidaten eerst (foreign key)
            await supabase
                .from('tendermatch_kandidaten')
                .delete()
                .eq('sessie_id', id);

            // Verwijder sessie
            await supabase
                .from('tendermatch_sessies')
                .delete()
                .eq('id', id);

            // Als actieve sessie verwijderd: terug naar nieuw scherm
            if (this.activeSessieId === id) {
                this.activeSessieId = null;
                this._toonNieuweMatch();
            }

            // Herlaad sessie lijst
            await this._laadSessies();
            this._toast('Sessie verwijderd.', 'info');

        } catch (e) {
            console.error('[TendermatchView] Verwijder fout:', e);
            this._toast('Fout bij verwijderen: ' + e.message, 'error');
        }
    }

    async _updateSessieStatus(sessieId, nieuweStatus) {
        try {
            await this._apiFetch(`/api/v1/tendermatch/sessies/${sessieId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: nieuweStatus })
            });
            const sessie = this.sessies.find(s => s.id === sessieId);
            if (sessie) sessie.status = nieuweStatus;
            this._renderSessieLijst();
            this._toast('Sessie gesloten.', 'info');
        } catch (e) {
            console.error('[TendermatchView] Sessie status update mislukt:', e);
        }
    }

    // ── Loading state ─────────────────────────────────────────────────────

    _setMatchLoading(active) {
        this.isMatchLoading = active;
        const btn = this.container?.querySelector('#tm-match-btn');
        if (!btn) return;

        if (active) {
            btn.disabled = true;
            btn.innerHTML = `<div class="tm-spinner"></div> Analyseren...`;
        } else {
            btn.disabled = false;
            btn.innerHTML = `${this._icon('zap', 14, '#ffffff')} Match deze tender`;
        }
    }

    // ── UI helpers ────────────────────────────────────────────────────────

    _scoreKlasse(score) {
        if (score >= 8) return 'tm-score-hoog';
        if (score >= 6) return 'tm-score-midden';
        return 'tm-score-laag';
    }

    _statusBadgeKlasse(status) {
        if (status === 'geconverteerd') return 'tm-badge-groen';
        if (status === 'gesloten') return 'tm-badge-grijs';
        return 'tm-badge-blauw';
    }

    _icon(name, size = 16, color = 'currentColor') {
        const Icons = window.Icons || {};
        if (Icons[name]) return Icons[name]({ size, color });
        return '';
    }

    _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _toast(bericht, type = 'info') {
        if (window.toast) window.toast(bericht, type);
        else if (window.showToast) window.showToast(bericht, type);
        else console.info(`[TendermatchView] ${type}: ${bericht}`);
    }
}

window.TendermatchView = TendermatchView;
