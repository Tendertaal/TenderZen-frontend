/**
 * OfferteCalculatorView.js — TenderZen
 * Berekent uren en factuurbedragen voor het schrijven van een aanbesteding.
 * Gebaseerd op Excel-model Tendertaal.
 * Non-module global: window.OfferteCalculatorView
 */

const OCV_STATUS_KLEUREN = {
    concept:      { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
    verzonden:    { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    geaccepteerd: { bg: '#d1fae5', text: '#065f46', border: '#6ee7b7' },
    afgewezen:    { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

const OCV_CLAUDE_MODELLEN = [
    { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5',  badge: 'Snel' },
    { id: 'claude-sonnet-4-6',         label: 'Sonnet 4.6', badge: 'Aanbevolen' },
    { id: 'claude-opus-4-6',           label: 'Opus 4.6',   badge: 'Pro' },
    { id: 'claude-opus-4-7',           label: 'Opus 4.7',   badge: 'Nieuwst' },
];

class OfferteCalculatorView {
    constructor() {
        this._container  = null;
        this._offerte    = null;
        this._tenderId   = null;
        this._dirty      = false;
        this._baseUrl    = window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';
        this._bedrijven  = [];
        this._teamleden  = [];
        this._activiteiten = [];
        this._aiModel    = 'claude-sonnet-4-6';
        this._rechterBreedte = parseInt(localStorage.getItem('ocv-rechter-breedte') || '340', 10);

        // Debounced opslaan (800ms) — gebruikt door kwaliteitsweging-listener
        let _debTimer = null;
        this._debouncedSlaOp = () => {
            clearTimeout(_debTimer);
            _debTimer = setTimeout(() => this._slaOp(), 800);
        };
    }

    // -----------------------------------------------------------------------
    // Bedrijven laden (via Supabase direct — geen backend list-endpoint)
    // -----------------------------------------------------------------------

    async _laadBedrijven() {
        const bureauId = this._offerte?.tenderbureau_id;
        if (!bureauId || !window.getSupabase) { this._bedrijven = []; return; }
        try {
            const sb = window.getSupabase();

            // Stap 1: bedrijf-IDs ophalen via koppeltabel (zelfde patroon als BedrijvenService.js)
            const { data: relaties } = await sb
                .from('bureau_bedrijf_relaties')
                .select('bedrijf_id')
                .eq('tenderbureau_id', bureauId)
                .eq('status', 'actief');

            const ids = (relaties || []).map(r => r.bedrijf_id).filter(Boolean);
            if (!ids.length) { this._bedrijven = []; return; }

            // Stap 2: bedrijven ophalen op naam gesorteerd
            const { data: bedrijven } = await sb
                .from('bedrijven')
                .select('id,bedrijfsnaam')
                .in('id', ids)
                .eq('is_actief', true)
                .order('bedrijfsnaam');

            this._bedrijven = bedrijven || [];
        } catch (e) {
            console.warn('Bedrijven laden mislukt:', e);
            this._bedrijven = [];
        }
    }

    // -----------------------------------------------------------------------
    // Teamleden laden (via Supabase direct — v_bureau_team view)
    // -----------------------------------------------------------------------

    async _laadTeamleden() {
        const bureauId = this._offerte?.tenderbureau_id
            || window.app?.currentBureau?.bureau_id;
        if (!bureauId || !window.getSupabase) { this._teamleden = []; return; }
        try {
            const sb = window.getSupabase();
            const { data } = await sb
                .from('v_bureau_team')
                .select('id, naam, email')
                .eq('tenderbureau_id', bureauId)
                .order('naam', { ascending: true });
            this._teamleden = data || [];
        } catch (e) {
            console.warn('Teamleden laden mislukt:', e);
            this._teamleden = [];
        }
    }

    // -----------------------------------------------------------------------
    // Urenmodel — zelfde logica als backend (realtime, geen API-call)
    // -----------------------------------------------------------------------

    _ACTIVITEITEN = [
        { naam: 'Verkoop gerelateerde activiteiten',           uren: 2,    comp: 'percelen' },
        { naam: 'Voorbereiding: inlezen aanbestedingsstukken', uren: 2,    comp: 'percelen' },
        { naam: 'Strategische sessie/Kick-off',                uren: 2,    comp: 'percelen' },
        { naam: 'Vragen NvI formuleren',                       uren: 0.25, comp: 'vragen_nvi' },
        { naam: 'Interview(s) per gunningscriterium',          uren: 1,    comp: 'sub_criteria' },
        { naam: 'Reviewsessies met klant (3 versies)',         uren: 1,    comp: 'fixed_3' },
        { naam: 'Tussentijds overleg/communicatie',            uren: 1,    comp: 'percelen' },
        { naam: 'Doornemen NvI stukken',                       uren: 1,    comp: 'percelen' },
        { naam: 'Teksten versie 1 per pagina',                 uren: 2,    comp: 'paginas' },
        { naam: 'Teksten versie 2 per pagina',                 uren: 1,    comp: 'paginas' },
        { naam: 'Teksten versie 3 per pagina',                 uren: 1,    comp: 'paginas' },
        { naam: 'Bijlagen redigeren per pagina',               uren: 1,    comp: 'bijlagen_redigeren' },
        { naam: 'Presentatie support',                         uren: 2,    comp: 'presentatie' },
    ];

    _berekenUren(data) {
        const v = {
            percelen:          data.percelen || 1,
            sub_criteria:      data.sub_criteria || 0,
            paginas:           data.paginas || 0,
            bijlagen_redigeren:data.bijlagen_redigeren || 0,
            vragen_nvi:        data.vragen_nvi || 0,
            presentatie:       data.presentatie ? 1 : 0,
            fixed_3:           3, // altijd 3 reviewsessies
            fixed_1:           1, // aangepaste activiteiten met vaste ×1
        };

        // Gebruik bewerkbare _activiteiten zodat aangepaste uren_indicatie en multiple_override effect hebben
        const bron = this._activiteiten.length ? this._activiteiten : this._ACTIVITEITEN.map(a => ({ naam: a.naam, uren: a.uren, comp: a.comp }));
        let totaal = 0;
        const detail = bron.map(a => {
            const multiple = (a.multiple_override !== undefined && a.multiple_override !== null)
                ? a.multiple_override
                : (v[a.comp] || 0);
            const uren = a.uren * multiple;
            totaal += uren;
            return { naam: a.naam, uren_indicatie: a.uren, component: a.comp, multiple, uren };
        });

        const korting = ((data.bekende_klant_pct || 0) + (data.zittende_partij_pct || 0)) / 100;
        const uren_in_mindering = totaal * korting;
        const uren_netto = totaal - uren_in_mindering;
        const uurtarief = data.uurtarief || 130;
        const bedrag_berekend = uren_netto * uurtarief;

        return {
            uren_berekend:     Math.round(totaal * 100) / 100,
            uren_in_mindering: Math.round(uren_in_mindering * 100) / 100,
            uren_netto:        Math.round(uren_netto * 100) / 100,
            bedrag_berekend:   Math.round(bedrag_berekend * 100) / 100,
            activiteiten_detail: detail,
        };
    }

    _berekenFactuur(data) {
        const schrijven   = parseFloat(data.factuur_tenderschrijven)   || 0;
        const management  = parseFloat(data.factuur_tendermanagement)  || 0;
        const documenten  = parseFloat(data.factuur_tendercdocumenten) || 0;
        const grafisch    = parseFloat(data.factuur_grafisch_ontwerp)  || 0;
        const totaal      = schrijven + management + documenten + grafisch;
        const comm_pct    = (data.commissie_pct || 10) / 100;
        const commissie   = schrijven * comm_pct;
        const netto       = totaal - commissie;
        return {
            factuur_totaal:   Math.round(totaal * 100) / 100,
            commissie_bedrag: Math.round(commissie * 100) / 100,
            netto_tendertaal: Math.round(netto * 100) / 100,
        };
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    _initialiseerActiviteiten(offerte) {
        // Bouw bewerkbare kopie van de ACTIVITEITEN array.
        // Als de offerte opgeslagen activiteiten_detail heeft, gebruik die uren_indicatie en multiple_override als startpunt.
        const opgeslagen = offerte?.activiteiten_detail || [];
        this._activiteiten = this._ACTIVITEITEN.map(a => {
            const match = opgeslagen.find(o => o.naam === a.naam);
            const act = { naam: a.naam, uren: match?.uren_indicatie ?? a.uren, comp: a.comp };
            if (match?.multiple_override !== undefined && match?.multiple_override !== null) {
                act.multiple_override = match.multiple_override;
            }
            return act;
        });
    }

    mount(container, params = {}) {
        this._container = container;
        this._tenderId  = params.tenderId || null;
        const offerteId = params.offerteId || null;
        window._ocv = this;

        this._container.innerHTML = '<div class="ocv-root"><div class="ocv-laden">Laden…</div></div>';

        if (offerteId) {
            this._laadOfferte(offerteId);
        } else if (this._tenderId) {
            this._nieuwOfferteVanTender(this._tenderId);
        } else {
            this._nieuwLegeOfferte();
        }
    }

    unmount() {
        if (this._dirty && !confirm('Er zijn onopgeslagen wijzigingen. Toch weggaan?')) return;
        this._container  = null;
        this._offerte    = null;
        this._dirty      = false;
        if (window._ocv === this) window._ocv = null;
    }

    // -----------------------------------------------------------------------
    // Data
    // -----------------------------------------------------------------------

    async _laadOfferte(offerteId) {
        try {
            const res = await this._fetch(`/api/v1/offerte-calculator/${offerteId}`);
            this._offerte = res.offerte;
            this._tenderId = this._offerte.tender_id || null;
            this._initialiseerActiviteiten(res);
            await this._laadBedrijven();
            await this._laadTeamleden();
            this._render();
        } catch (e) {
            this._toonFout('Laden mislukt: ' + e.message);
        }
    }

    async _nieuwOfferteVanTender(tenderId) {
        try {
            const res = await this._fetch(`/api/v1/offerte-calculator/tender/${tenderId}/nieuw`, { method: 'POST' });
            this._offerte  = res.offerte;
            this._tenderId = tenderId;
            this._initialiseerActiviteiten(res);
            await this._laadBedrijven();
            await this._laadTeamleden();
            this._render();
        } catch (e) {
            this._toonFout('Aanmaken mislukt: ' + e.message);
        }
    }

    async _nieuwLegeOfferte() {
        try {
            const res = await this._fetch('/api/v1/offerte-calculator', {
                method: 'POST',
                body: JSON.stringify({}),
            });
            this._offerte = res.offerte;
            this._initialiseerActiviteiten(res);
            await this._laadBedrijven();
            await this._laadTeamleden();
            this._render();
        } catch (e) {
            this._toonFout('Aanmaken mislukt: ' + e.message);
        }
    }

    handleUrenIndicatieWijziging(input) {
        const naam = input.dataset.activiteit;
        const nieuweWaarde = parseFloat(input.value) || 0;
        const act = this._activiteiten.find(a => a.naam === naam);
        if (act) act.uren = nieuweWaarde;
        this._herbereken();
    }

    handleVermenigvuldigerWijziging(input) {
        const naam = input.dataset.activiteit;
        const val = parseFloat(input.value);
        const act = this._activiteiten.find(a => a.naam === naam);
        if (act) act.multiple_override = (isNaN(val) || val < 0) ? 0 : val;
        this._herbereken();
    }

    handleVerwijderActiviteit(btn) {
        const index = parseInt(btn.dataset.index);
        if (isNaN(index) || index < 0 || index >= this._activiteiten.length) return;
        this._activiteiten.splice(index, 1);
        this._renderUrentabel();
        this._herbereken();
    }

    handleVoegActiviteitToe() {
        const naamEl  = document.getElementById('oc-nieuwe-activiteit-naam');
        const urenEl  = document.getElementById('oc-nieuwe-activiteit-uren');
        const compEl  = document.getElementById('oc-nieuwe-activiteit-comp');
        const naam = naamEl?.value?.trim();
        if (!naam) { naamEl?.focus(); return; }
        const uren = parseFloat(urenEl?.value) || 1;
        const comp = compEl?.value || 'fixed_1';

        this._activiteiten.push({ naam, uren, comp });

        if (naamEl) naamEl.value = '';
        if (urenEl) urenEl.value = '1';

        this._renderUrentabel();
        this._herbereken();
    }

    async _slaOp() {
        if (!this._offerte?.id) return;
        const data = this._leesFormulier();
        // Aangepaste uren_indicaties en multiple_overrides meesturen zodat de backend ze kan opslaan
        if (this._activiteiten.length) {
            data.activiteiten_detail = this._activiteiten.map(a => {
                const obj = { naam: a.naam, uren_indicatie: a.uren, component: a.comp };
                if (a.multiple_override !== undefined && a.multiple_override !== null) {
                    obj.multiple_override = a.multiple_override;
                }
                return obj;
            });
        }
        const btn  = this._container?.querySelector('[data-action="ocv-opslaan"]');
        if (btn) { btn.disabled = true; btn.innerHTML = `${window.Icons.refresh({ size: 14 })} Opslaan…`; }

        try {
            const res = await this._fetch(`/api/v1/offerte-calculator/${this._offerte.id}`, {
                method: 'PUT',
                body: JSON.stringify(data),
            });
            this._offerte = res.offerte;
            this._dirty   = false;
            this._toast('Opgeslagen', 'ok');
            this._herbereken();
            this._dirty = false;
        } catch (e) {
            this._toast('Opslaan mislukt: ' + e.message, 'fout');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `${window.Icons.save({ size: 14 })} Opslaan`; }
        }
    }

    // -----------------------------------------------------------------------
    // Teamlid dropdown helper
    // -----------------------------------------------------------------------

    _htmlTeamlidSelect(id, huidigUserId, extraOpties = []) {
        const opties = this._teamleden.map(lid => {
            const naam = lid.naam || lid.email || '—';
            return `<option value="${lid.id}" ${lid.id === huidigUserId ? 'selected' : ''}>${naam}</option>`;
        }).join('');
        const extraHtml = extraOpties.map(o =>
            `<option value="${o.value}">${o.label}</option>`
        ).join('');
        return `<select class="ocv-k" id="${id}"
                        style="width:150px;text-align:left"
                        onchange="window._ocv?._herbereken()">
            <option value="">— Selecteer —</option>
            ${opties}
            ${extraHtml}
        </select>`;
    }

    // -----------------------------------------------------------------------
    // Schrijver type toggle handler
    // -----------------------------------------------------------------------

    _onSchrijverTypeChange() {
        const type = document.getElementById('ocv-schrijver-type')?.value;
        const externBlok = document.getElementById('ocv-extern-schrijver-blok');
        if (externBlok) externBlok.style.display = type === 'extern' ? 'block' : 'none';
        const inhuurToggle = document.getElementById('ocv-nc-inhuur-toggle');
        if (inhuurToggle) {
            inhuurToggle.disabled = type !== 'extern';
            if (type !== 'extern') inhuurToggle.checked = false;
        }
        this._herbereken();
    }

    // -----------------------------------------------------------------------
    // Herberekening (realtime, geen API-call)
    // -----------------------------------------------------------------------

    _herbereken() {
        const data = this._leesFormulier();
        const uren = this._berekenUren(data);

        // Urentabel bijwerken
        this._updateUrentabel(uren.activiteiten_detail);

        const nettoUren      = uren.uren_netto || 0;
        const paginas        = data.paginas || 0;
        const opdrachtwaarde = data.waarde_max || data.waarde_min || data.waarde || 0;

        // Tarieven en kortingen (direct van DOM)
        const tariefS   = parseFloat(document.getElementById('ocv-tarief-s')?.value)   || 130;
        const tariefGO  = parseFloat(document.getElementById('ocv-go-tarief')?.value)  || 75;
        const kortingS  = parseFloat(document.getElementById('ocv-ts-korting')?.value) || 0;
        const kortingM  = parseFloat(document.getElementById('ocv-tm-korting')?.value) || 0;
        const kortingGO = parseFloat(document.getElementById('ocv-go-korting')?.value) || 0;

        // Berekende richtlijnen (na korting)
        const berekendS           = Math.round(nettoUren * tariefS);
        const berekendNaKortingS  = Math.round(berekendS * (1 - kortingS / 100));
        const berekendGO          = Math.round(paginas * tariefGO);
        const berekendNaKortingGO = Math.round(berekendGO * (1 - kortingGO / 100));

        // Auto-vul "Doorbelasten aan klant" als het veld nog niet handmatig is ingevuld
        const tsInput = document.getElementById('ocv-f-schrijven');
        if (tsInput && !tsInput.dataset.handmatig) tsInput.value = berekendNaKortingS;
        const tsBedrag = parseFloat(tsInput?.value) || 0;

        const tmRichtlijn = Math.round((tsBedrag / 3) * (1 - kortingM / 100));
        const tmInput = document.getElementById('ocv-f-management');
        if (tmInput && !tmInput.dataset.handmatig) tmInput.value = tmRichtlijn;
        const tmBedrag = parseFloat(tmInput?.value) || 0;

        const tdBedrag = parseFloat(document.getElementById('ocv-f-documenten')?.value) || 0;

        const goInput = document.getElementById('ocv-f-grafisch');
        if (goInput && !goInput.dataset.handmatig) goInput.value = berekendNaKortingGO;
        const goBedrag = parseFloat(goInput?.value) || 0;

        const totaal = tsBedrag + tmBedrag + tdBedrag + goBedrag;

        // Richtlijnen en uren-display
        this._setText('ocv-ts-berekend',       '€ ' + berekendS.toLocaleString('nl-NL'));
        this._setText('ocv-go-berekend',       '€ ' + berekendGO.toLocaleString('nl-NL'));
        this._setText('ocv-tm-richtlijn',      '€ ' + tmRichtlijn.toLocaleString('nl-NL'));
        this._setText('ocv-netto-uren-display', nettoUren + ' u');
        this._setText('ocv-go-paginas',        String(paginas));

        // Component header badges
        this._setText('ocv-ts-totaal', '€ ' + tsBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-tm-totaal', '€ ' + tmBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-td-totaal', '€ ' + tdBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-go-totaal', '€ ' + goBedrag.toLocaleString('nl-NL'));

        // Totaalkaart
        this._setText('ocv-sum-ts',  '€ ' + tsBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-sum-tm',  '€ ' + tmBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-sum-td',  '€ ' + tdBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-sum-go',  '€ ' + goBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-f-totaal','€ ' + totaal.toLocaleString('nl-NL'));

        // Check: uren per A4 schrijven
        const pill = document.getElementById('ocv-ts-a4-pill');
        if (paginas > 0 && pill) {
            const urenA4 = nettoUren / paginas;
            let pillKl, pillTxt;
            if      (urenA4 < 4)  { pillKl = 'ocv-pill-blauw';  pillTxt = urenA4.toFixed(1).replace('.', ',') + ' u — te goedkoop'; }
            else if (urenA4 <= 5) { pillKl = 'ocv-pill-groen';  pillTxt = urenA4.toFixed(1).replace('.', ',') + ' u — goed'; }
            else if (urenA4 <= 6) { pillKl = 'ocv-pill-oranje'; pillTxt = urenA4.toFixed(1).replace('.', ',') + ' u — let op'; }
            else                  { pillKl = 'ocv-pill-rood';   pillTxt = urenA4.toFixed(1).replace('.', ',') + ' u — te hoog'; }
            pill.className = 'ocv-check-pill ' + pillKl;
            this._setText('ocv-ts-a4-val', pillTxt);
        }

        // Check: kosten per A4 (klant)
        const kaCheck = document.getElementById('ocv-ka-check');
        if (paginas > 0 && kaCheck) {
            const kostenA4 = totaal / paginas;
            let kaKl, kaSub;
            if      (kostenA4 <= 1000) { kaKl = 'ocv-check-groen';  kaSub = 'Onder €1.000 — goed tarief'; }
            else if (kostenA4 <= 1200) { kaKl = 'ocv-check-oranje'; kaSub = '€1.000–€1.200 — aan de hoge kant'; }
            else                       { kaKl = 'ocv-check-rood';   kaSub = 'Boven €1.200 — te duur voor klant'; }
            kaCheck.className = 'ocv-ka-check ' + kaKl;
            this._setText('ocv-ka-val', '€ ' + Math.round(kostenA4).toLocaleString('nl-NL'));
            this._setText('ocv-ka-sub', kaSub);
            this._setText('ocv-ka-berekening', `€ ${totaal.toLocaleString('nl-NL')} ÷ ${paginas} pagina's`);
        }

        // Check: ratio offerte / opdrachtwaarde
        const ratioKaart = document.getElementById('ocv-ratio-kaart');
        if (opdrachtwaarde > 0 && ratioKaart) {
            const ratio = (totaal / opdrachtwaarde) * 100;
            let rKl, rSub;
            if      (ratio <= 1) { rKl = 'ocv-ratio-groen';  rSub = 'Uitstekend — makkelijk te verantwoorden'; }
            else if (ratio <= 2) { rKl = 'ocv-ratio-groen';  rSub = 'Goed — acceptabel tarief'; }
            else if (ratio <= 3) { rKl = 'ocv-ratio-oranje'; rSub = 'Aan de hoge kant — bespreek met klant'; }
            else                 { rKl = 'ocv-ratio-rood';   rSub = 'Te hoog — moeilijk te verantwoorden'; }
            ratioKaart.className = 'ocv-ratio-kaart ' + rKl;
            this._setText('ocv-ratio-pct', ratio.toFixed(2).replace('.', ',') + ' %');
            this._setText('ocv-ratio-sub', rSub);
            this._setText('ocv-ratio-berekening', `€ ${totaal.toLocaleString('nl-NL')} ÷ € ${Math.round(opdrachtwaarde).toLocaleString('nl-NL')} (max. waarde)`);
            const balk = document.getElementById('ocv-ratio-balk');
            if (balk) balk.style.width = Math.min(100, (ratio / 3) * 100) + '%';
        }

        // Commissie
        const commBasis   = document.getElementById('ocv-comm-basis')?.value || 'schrijven';
        const commPct     = parseFloat(document.getElementById('ocv-comm-pct')?.value) || 0;
        const basisBedrag = commBasis === 'schrijven'  ? tsBedrag
                          : commBasis === 'management' ? tmBedrag
                          : commBasis === 'documenten' ? tdBedrag
                          : commBasis === 'grafisch'   ? goBedrag
                          : totaal;
        const commissie   = Math.round(basisBedrag * commPct / 100);
        const netto       = totaal - commissie;
        const commNaam    = document.getElementById('ocv-comm-naam')?.textContent?.trim()
                          || window.app?.currentBureau?.bureau_naam
                          || '—';

        this._setText('ocv-comm-badge', '−€ ' + commissie.toLocaleString('nl-NL'));

        // Inhuurkosten berekenen
        const schrijverType  = document.getElementById('ocv-schrijver-type')?.value || 'intern';
        const inhuurTariefS  = parseFloat(document.getElementById('ocv-inhuur-tarief-s')?.value) || 0;
        const inhuurKostenS  = schrijverType === 'extern' ? Math.round(nettoUren * inhuurTariefS) : 0;
        const margeS         = tsBedrag - inhuurKostenS;

        this._setText('ocv-inhuur-kosten-s',  '€ ' + inhuurKostenS.toLocaleString('nl-NL'));
        this._setText('ocv-marge-schrijven',  '€ ' + margeS.toLocaleString('nl-NL'));
        this._setText('ocv-nc-inhuur-bedrag', '−€ ' + inhuurKostenS.toLocaleString('nl-NL'));

        // Netto config bedragen (readonly weergave)
        this._setText('ocv-nc-ts-bedrag',   '€ ' + tsBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-nc-tm-bedrag',   '€ ' + tmBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-nc-td-bedrag',   '€ ' + tdBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-nc-go-bedrag',   '€ ' + goBedrag.toLocaleString('nl-NL'));
        this._setText('ocv-nc-comm-bedrag', '−€ ' + commissie.toLocaleString('nl-NL'));

        // Netto Tendertaal berekening op basis van toggles
        const ncSchrijven  = document.getElementById('ocv-nc-schrijven')?.checked ?? true;
        const ncManagement = document.getElementById('ocv-nc-management')?.checked ?? false;
        const ncDocumenten = document.getElementById('ocv-nc-documenten')?.checked ?? false;
        const ncGrafisch   = document.getElementById('ocv-nc-grafisch')?.checked ?? false;
        const ncInhuur     = document.getElementById('ocv-nc-inhuur-toggle')?.checked ?? false;
        const ncCommissie  = document.getElementById('ocv-nc-commissie')?.checked ?? true;

        let nettoTendertaal = 0;
        const positief = [];
        const negatief = [];
        if (ncSchrijven)  { nettoTendertaal += tsBedrag;      positief.push('€ ' + tsBedrag.toLocaleString('nl-NL')); }
        if (ncManagement) { nettoTendertaal += tmBedrag;      positief.push('€ ' + tmBedrag.toLocaleString('nl-NL')); }
        if (ncDocumenten) { nettoTendertaal += tdBedrag;      positief.push('€ ' + tdBedrag.toLocaleString('nl-NL')); }
        if (ncGrafisch)   { nettoTendertaal += goBedrag;      positief.push('€ ' + goBedrag.toLocaleString('nl-NL')); }
        if (ncInhuur && inhuurKostenS > 0) {
            nettoTendertaal -= inhuurKostenS;
            negatief.push('€ ' + inhuurKostenS.toLocaleString('nl-NL') + ' inhuur');
        }
        if (ncCommissie)  { nettoTendertaal -= commissie;     negatief.push('€ ' + commissie.toLocaleString('nl-NL') + ' commissie'); }

        this._setText('ocv-netto-val', '€ ' + nettoTendertaal.toLocaleString('nl-NL'));
        const berekenStr = positief.join(' + ') + (negatief.length ? ' − ' + negatief.join(' − ') : '');
        this._setText('ocv-netto-berekening', berekenStr || '—');
        this._setText('ocv-netto-comm', `Commissie ${commNaam}: € ${commissie.toLocaleString('nl-NL')} (${commPct}% over ${commBasis})`);

        this._dirty = true;
    }

    _leesFormulier() {
        const g = id => this._container?.querySelector(`#${id}`);
        return {
            inschrijvende_partij:     g('ocv-partij')?.value?.trim()   || null,
            aanbestedende_dienst:     g('ocv-dienst')?.value?.trim()   || null,
            aanbesteding:             g('ocv-naam')?.value?.trim()     || null,
            type_aanbesteding:        g('ocv-type')?.value            || null,
            deadline:                 g('ocv-deadline')?.value        || null,
            kwaliteit_weging:         parseInt(g('ocv-kw-kwal')?.value) || 60,
            prijs_weging:             parseInt(g('ocv-kw-prijs')?.value) || 40,
            type_opdracht:            g('ocv-type-opdracht')?.value   || null,
            basisperiode:             parseFloat(g('ocv-basisperiode')?.value) || 1,
            verlengopties:            parseFloat(g('ocv-verlengopties')?.value) || 0,
            looptijd_jaar:            (parseFloat(g('ocv-basisperiode')?.value) || 1) + (parseFloat(g('ocv-verlengopties')?.value) || 0),
            waarde_min:               parseFloat(g('ocv-waarde-min')?.value) || null,
            waarde_max:               parseFloat(g('ocv-waarde-max')?.value) || null,
            waarde:                   parseFloat(g('ocv-waarde-max')?.value) || parseFloat(g('ocv-waarde-min')?.value) || null,
            percelen:                 parseInt(g('ocv-percelen')?.value) || 1,
            sub_criteria:             parseInt(g('ocv-sub-criteria')?.value) || 0,
            paginas:                  parseInt(g('ocv-paginas')?.value) || 0,
            bijlagen_redigeren:       parseInt(g('ocv-bijlagen-red')?.value) || 0,
            presentatie:              g('ocv-presentatie')?.checked || false,
            bekende_klant_pct:        parseInt(g('ocv-bekende-klant')?.value) || 0,
            zittende_partij_pct:      parseInt(g('ocv-zittende-partij')?.value) || 0,
            uurtarief:                parseFloat(g('ocv-tarief-s')?.value) || 130,
            factuur_tenderschrijven:  parseFloat(g('ocv-f-schrijven')?.value) || 0,
            factuur_tendermanagement: parseFloat(g('ocv-f-management')?.value) || 0,
            factuur_tendercdocumenten:parseFloat(g('ocv-f-documenten')?.value) || 0,
            factuur_grafisch_ontwerp: parseFloat(g('ocv-f-grafisch')?.value) || 0,
            commissie_naam:           window.app?.currentBureau?.bureau_naam
                                          || this._offerte?.commissie_naam
                                          || '',
            commissie_pct:            parseInt(g('ocv-comm-pct')?.value) || 10,
            tarief_tenderschrijven:   parseFloat(g('ocv-tarief-s')?.value) || 130,
            tarief_tendermanagement:  parseFloat(g('ocv-tarief-m')?.value) || 130,
            tarief_grafisch_per_pagina: parseFloat(g('ocv-go-tarief')?.value) || 75,
            korting_tenderschrijven:  parseInt(g('ocv-ts-korting')?.value) || 0,
            korting_tendermanagement: parseInt(g('ocv-tm-korting')?.value) || 0,
            korting_grafisch:         parseInt(g('ocv-go-korting')?.value) || 0,
            commissie_basis:          g('ocv-comm-basis')?.value || 'schrijven',
            status:                   g('ocv-status')?.value || 'concept',
            notities:                 g('ocv-notities')?.value?.trim() || null,
            schrijver_type:           g('ocv-schrijver-type')?.value || 'intern',
            schrijver_user_id:        g('ocv-schrijver-user')?.value || null,
            manager_user_id:          g('ocv-manager-user')?.value || null,
            grafisch_user_id:         g('ocv-grafisch-user')?.value || null,
            inhuur_tarief_schrijven:  parseFloat(g('ocv-inhuur-tarief-s')?.value) || 0,
            netto_include_schrijven:  g('ocv-nc-schrijven')?.checked ?? true,
            netto_include_management: g('ocv-nc-management')?.checked ?? false,
            netto_include_documenten: g('ocv-nc-documenten')?.checked ?? false,
            netto_include_grafisch:   g('ocv-nc-grafisch')?.checked ?? false,
            netto_include_inhuur:     g('ocv-nc-inhuur-toggle')?.checked ?? false,
            netto_include_commissie:  g('ocv-nc-commissie')?.checked ?? true,
        };
    }

    // -----------------------------------------------------------------------
    // AI Analyse
    // -----------------------------------------------------------------------

    async _analyseerMetAI() {
        if (!this._offerte?.id) return;
        const btn = this._container?.querySelector('[data-action="ocv-ai-analyse"]');
        if (btn) { btn.disabled = true; btn.innerHTML = `${window.Icons.refresh({ size: 14 })} Analyseren…`; }

        try {
            const res = await this._fetch(`/api/v1/offerte-calculator/${this._offerte.id}/analyseer`, {
                method: 'POST',
                body: JSON.stringify({ model: this._aiModel }),
            });

            // Offerte state bijwerken vanuit de analyse-response
            if (res.offerte) this._offerte = res.offerte;

            // Full re-render zodat info-buttons, basisperiode/verlengopties en banner correct zijn
            this._render();
            this._toast('AI-analyse klaar', 'ok');
        } catch (e) {
            this._toast('Analyse mislukt: ' + e.message, 'fout');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `${window.Icons.sparkles({ size: 14 })} AI-analyse starten`; }
        }
    }

    // -----------------------------------------------------------------------
    // Excel export
    // -----------------------------------------------------------------------

    async _exporteerExcel() {
        if (!this._offerte?.id) return;
        const btn = this._container?.querySelector('[data-action="ocv-export"]');
        if (btn) { btn.disabled = true; btn.innerHTML = `${window.Icons.refresh({ size: 14 })} Exporteren…`; }

        try {
            await this._slaOp(); // eerst opslaan
            const res = await this._fetch(`/api/v1/offerte-calculator/${this._offerte.id}/export-excel`, { method: 'POST' });

            // Trigger download
            const byteChars = atob(res.base64);
            const byteArr   = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
            const blob = new Blob([byteArr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = res.bestandsnaam;
            a.click();
            URL.revokeObjectURL(url);
            this._toast('Excel gedownload', 'ok');
        } catch (e) {
            this._toast('Export mislukt: ' + e.message, 'fout');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = `${window.Icons.download({ size: 14 })} Excel export`; }
        }
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    _render() {
        if (!this._container) return;
        const o = this._offerte || {};
        const uren = this._berekenUren(o);

        const root = document.createElement('div');
        root.className = 'ocv-root';
        root.innerHTML = `
            ${this._htmlHeader(o)}
            <div class="ocv-body">
                <div class="ocv-linker">
                    ${this._htmlAIBanner(o)}
                    ${this._htmlProjectgegevens(o)}
                    ${this._htmlDocumenten(o)}
                    ${this._htmlVariabelen(o)}
                    ${this._htmlUrentabel(uren.activiteiten_detail)}
                    ${this._htmlKortingen(o)}
                    ${this._htmlNotities(o)}
                </div>
                <div class="ocv-splitter" id="ocv-splitter"></div>
                <div class="ocv-rechter" id="ocv-rechter" style="width:${this._rechterBreedte}px">
                    <div id="ocv-resultaten-wrap">
                        ${this._htmlResultatenPanel()}
                    </div>
                    ${this._htmlPdfViewer()}
                </div>
            </div>`;

        this._container.innerHTML = '';
        this._container.appendChild(root);
        this._bindEvents(root);
        this._herbereken();
        this._updateStatusKleur();
        this._dirty = false;

        // PDF viewer sluit-knop
        root.querySelector('#ocv-pdf-sluit')?.addEventListener('click', () => this._sluitPdfViewer());

        // Laad documenten asynchroon (na render, niet blokkerend)
        this._laadDocumenten();
    }

    _statusBadgeHtml(status) {
        const k = OCV_STATUS_KLEUREN[status] || OCV_STATUS_KLEUREN.concept;
        const labels = { concept: 'Concept', verzonden: 'Verzonden', geaccepteerd: 'Geaccepteerd', afgewezen: 'Afgewezen' };
        return `<span style="background:${k.bg};color:${k.text};border:0.5px solid ${k.border};font-size:11px;padding:2px 8px;border-radius:4px;font-weight:500">${labels[status] || status}</span>`;
    }

    _updateStatusKleur() {
        const status = document.getElementById('ocv-status')?.value || 'concept';
        const k = OCV_STATUS_KLEUREN[status] || OCV_STATUS_KLEUREN.concept;
        const dot = document.getElementById('ocv-status-dot');
        const sel = document.getElementById('ocv-status');
        if (dot) dot.style.background = k.text;
        if (sel) {
            sel.style.borderColor = k.border;
            sel.style.background  = k.bg;
            sel.style.color       = k.text;
        }
        this._herbereken();
    }

    _htmlHeader(o) {
        const titel = o.aanbesteding || o.inschrijvende_partij || 'Nieuwe offerte';
        return `
        <div class="ocv-header">
            <button class="ocv-terug-btn" data-action="ocv-terug">
                ${window.Icons.chevronLeft({ size: 14 })} Terug naar overzicht
            </button>
            <div class="ocv-header-midden">
                <h1 class="ocv-header-titel">${window.Icons.barChart({ size: 18 })} Offerte Calculator</h1>
                <p class="ocv-header-sub">${this._esc(titel)}</p>
            </div>
            <div class="ocv-header-acties">
                ${this._statusBadgeHtml(o.status || 'concept')}
                <select class="ocv-model-select" id="ocv-model-select" title="AI model kiezen">
                    ${OCV_CLAUDE_MODELLEN.map(m =>
                        `<option value="${m.id}" ${m.id === this._aiModel ? 'selected' : ''}>${m.label} — ${m.badge}</option>`
                    ).join('')}
                </select>
                <button class="ocv-btn ocv-btn--ghost" data-action="ocv-ai-analyse"
                        ${!o.tender_id ? 'title="Koppel een tender voor AI-analyse"' : ''}>
                    ${window.Icons.sparkles({ size: 14 })} AI-analyse starten
                </button>
                <button class="ocv-btn ocv-btn--secondary" data-action="ocv-export">
                    ${window.Icons.download({ size: 14 })} Excel export
                </button>
                <button class="ocv-btn ocv-btn--primary" data-action="ocv-opslaan">
                    ${window.Icons.save({ size: 14 })} Opslaan
                </button>
            </div>
        </div>`;
    }

    _htmlAIBanner(o) {
        const zichtbaar = o.ai_geanalyseerd;
        const analyse = o.ai_analyse_json || {};
        return `
        <div class="ocv-ai-banner" id="ocv-ai-banner" style="display:${zichtbaar ? 'flex' : 'none'}">
            ${window.Icons.sparkles({ size: 14 })}
            <span>AI heeft de variabelen ingevuld op basis van de aanbesteding.
            ${analyse.toelichting ? `<em>${this._esc(analyse.toelichting)}</em>` : ''}
            Controleer en pas aan waar nodig.</span>
        </div>`;
    }

    _htmlProjectgegevens(o) {
        const types = ['Enkelvoudig onderhands', 'Meervoudig onderhands', 'Openbaar', 'Europees openbaar', 'Minicompetitie'];
        const typeOpts = types.map(t => `<option ${o.type_aanbesteding === t ? 'selected' : ''}>${t}</option>`).join('');
        const deadline = o.deadline ? String(o.deadline).split('T')[0] : '';

        const huidigPartij = o.inschrijvende_partij || '';
        const bedrijfOpties = this._bedrijven.map(b =>
            `<option value="${this._esc(b.bedrijfsnaam)}" ${huidigPartij === b.bedrijfsnaam ? 'selected' : ''}>${this._esc(b.bedrijfsnaam)}</option>`
        ).join('');

        const bureauNaam = window.app?.currentBureau?.bureau_naam || this._offerte?.tenderbureau_naam || '—';
        const kw = o.kwaliteit_weging ?? 60;
        const pw = 100 - kw;

        return `
        <div class="ocv-sectie">
            <h2 class="ocv-sectie-titel">${window.Icons.clipboardList({ size: 15 })} Projectgegevens</h2>
            <div class="ocv-pg-grid">

                <!-- Rij 1: Projectnaam (vol breed) -->
                <div class="ocv-veld ocv-pg-full">
                    <label>Aanbesteding / projectnaam</label>
                    <input type="text" id="ocv-naam" value="${this._esc(o.aanbesteding || '')}">
                </div>

                <!-- Rij 2: Tenderbureau · Kwaliteitsweging · Prijsweging -->
                <div class="ocv-veld">
                    <label>Tenderbureau</label>
                    <div class="ocv-readonly-veld">${this._esc(bureauNaam)}</div>
                </div>
                <div class="ocv-veld">
                    <label>Kwaliteitsweging (%)</label>
                    <input type="number" id="ocv-kw-kwal" min="0" max="100" value="${kw}">
                </div>
                <div class="ocv-veld">
                    <label>Prijsweging (%)</label>
                    <input type="number" id="ocv-kw-prijs" min="0" max="100" value="${pw}" readonly>
                </div>

                <!-- Rij 3: Aanbestedende dienst · Type aanbesteding (span 2) -->
                <div class="ocv-veld">
                    <label>Aanbestedende dienst</label>
                    <input type="text" id="ocv-dienst" value="${this._esc(o.aanbestedende_dienst || '')}">
                </div>
                <div class="ocv-veld ocv-pg-span2">
                    <label>Type aanbesteding</label>
                    <select id="ocv-type">
                        <option value="">— Kies —</option>
                        ${typeOpts}
                    </select>
                </div>

                <!-- Rij 4: Inschrijvende partij · Deadline · Status -->
                <div class="ocv-veld">
                    <label>Inschrijvende partij</label>
                    <select id="ocv-partij">
                        <option value="">— Selecteer bedrijf —</option>
                        ${bedrijfOpties}
                        ${huidigPartij && !this._bedrijven.some(b => b.bedrijfsnaam === huidigPartij)
                            ? `<option value="${this._esc(huidigPartij)}" selected>${this._esc(huidigPartij)}</option>`
                            : ''}
                    </select>
                </div>
                <div class="ocv-veld">
                    <label>Deadline indienen</label>
                    <input type="date" id="ocv-deadline" value="${deadline}">
                </div>
                <div class="ocv-veld">
                    <label>Status offerte</label>
                    <div class="ocv-status-wrap">
                        <div class="ocv-status-dot" id="ocv-status-dot"></div>
                        <select class="ocv-status-select" id="ocv-status"
                                onchange="window._ocv?._updateStatusKleur()">
                            <option value="concept"      ${(o.status||'concept') === 'concept'      ? 'selected' : ''}>Concept</option>
                            <option value="verzonden"    ${o.status === 'verzonden'    ? 'selected' : ''}>Verzonden</option>
                            <option value="geaccepteerd" ${o.status === 'geaccepteerd' ? 'selected' : ''}>Geaccepteerd</option>
                            <option value="afgewezen"    ${o.status === 'afgewezen'    ? 'selected' : ''}>Afgewezen</option>
                        </select>
                    </div>
                </div>

            </div>
        </div>`;
    }

    _htmlVariabelen(o) {
        const typOpts = ['Diensten', 'Leveringen', 'Werken'].map(t =>
            `<option ${o.type_opdracht === t ? 'selected' : ''}>${t}</option>`).join('');

        const toelichtingen = o.ai_toelichtingen || {};
        const infoBtn = veld => o.ai_geanalyseerd && toelichtingen[veld]
            ? `<button class="ocv-info-btn" data-action="ocv-info" data-veld="${veld}" title="Hoe berekend?">ℹ</button>`
            : '';

        const numVeld = (id, label, val, hint = '', veld = '') => `
            <div class="ocv-var-veld">
                <label>${label} ${infoBtn(veld)}</label>
                <input type="number" id="${id}" min="0" value="${val ?? 0}" class="ocv-var-input">
                ${hint ? `<span class="ocv-var-hint">${hint}</span>` : ''}
            </div>`;

        const basis   = o.basisperiode  ?? o.looptijd_jaar ?? 1;
        const verleng = o.verlengopties ?? 0;

        return `
        <div class="ocv-sectie">
            <h2 class="ocv-sectie-titel">${window.Icons.sliders({ size: 15 })} Variabelen
                <span class="ocv-sectie-sub">Wijzigingen worden direct herberekend</span>
            </h2>
            <div class="ocv-variabelen-grid">
                <div class="ocv-var-groep">
                    <h3 class="ocv-var-groep-titel">Aanbestedingsstructuur</h3>
                    ${numVeld('ocv-percelen',     'Percelen',              o.percelen ?? 1, 'Aantal percelen (default 1)', 'percelen')}
                    ${numVeld('ocv-sub-criteria', 'Sub-criteria / gunningscriteria', o.sub_criteria ?? 0, '', 'sub_criteria')}
                    ${numVeld('ocv-paginas',      "Pagina's inschrijving", o.paginas ?? 0, '', 'paginas')}
                    ${numVeld('ocv-bijlagen-red', 'Bijlagen redigeren',    o.bijlagen_redigeren ?? 0, 'Inhoudelijk uit te werken', 'bijlagen_redigeren')}
                </div>
                <div class="ocv-var-groep">
                    <h3 class="ocv-var-groep-titel">Opdrachtwaarde</h3>
                    <div class="ocv-var-veld">
                        <label>Type opdracht</label>
                        <select id="ocv-type-opdracht" class="ocv-var-select">
                            <option value="">— Kies —</option>
                            ${typOpts}
                        </select>
                    </div>
                    <div class="ocv-var-veld">
                        <label>Basisperiode (jaren) ${infoBtn('basisperiode')}</label>
                        <input type="number" id="ocv-basisperiode" min="0" step="0.5" value="${basis}" class="ocv-var-input">
                    </div>
                    <div class="ocv-var-veld">
                        <label>Verlengopties (jaren) ${infoBtn('verlengopties')}</label>
                        <input type="number" id="ocv-verlengopties" min="0" step="0.5" value="${verleng}" class="ocv-var-input">
                    </div>
                    <div class="ocv-var-veld">
                        <label>Totale looptijd</label>
                        <div class="ocv-var-readonly ocv-looptijd-totaal">${basis + verleng} jaar</div>
                    </div>
                    <div class="ocv-var-veld">
                        <label>Geraamde waarde minimaal (€) ${infoBtn('waarde_min')}</label>
                        <input type="number" id="ocv-waarde-min" min="0" value="${o.waarde_min ?? ''}" class="ocv-var-input" placeholder="0">
                        <span class="ocv-var-hint">Totale looptijd</span>
                    </div>
                    <div class="ocv-var-veld">
                        <label>Geraamde waarde maximaal (€) ${infoBtn('waarde_max')}</label>
                        <input type="number" id="ocv-waarde-max" min="0" value="${o.waarde_max ?? o.waarde ?? ''}" class="ocv-var-input" placeholder="0">
                        <span class="ocv-var-hint">Totale looptijd</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    _htmlUrentabel(detail) {
        if (!detail?.length) return '';
        const totaal = detail.reduce((s, a) => s + (a.uren || 0), 0);
        const rijen = detail.map((a, index) => {
            const kleur = a.uren > 0 ? 'actief' : 'nul';
            return `
            <tr class="ocv-tabel-rij ocv-tabel-rij--${kleur}">
                <td>${this._esc(a.naam)}</td>
                <td class="ocv-tabel-num">
                    <input type="number" class="oc-uren-indicatie-input"
                           value="${a.uren_indicatie}" min="0" max="20" step="0.25"
                           data-activiteit="${this._esc(a.naam)}"
                           oninput="window._ocv?.handleUrenIndicatieWijziging(this)">
                </td>
                <td><span class="ocv-comp-badge">${a.component}</span></td>
                <td class="ocv-tabel-num">
                    <input type="number" class="oc-uren-indicatie-input"
                           value="${a.multiple}" min="0" step="0.01"
                           data-activiteit="${this._esc(a.naam)}"
                           oninput="window._ocv?.handleVermenigvuldigerWijziging(this)">
                </td>
                <td class="ocv-tabel-num ocv-tabel-uren">${a.uren}</td>
                <td>
                    <button class="oc-verwijder-btn" data-index="${index}"
                            onclick="window._ocv?.handleVerwijderActiviteit(this)"
                            title="Verwijder activiteit">
                        ${window.Icons.x({ size: 12 })}
                    </button>
                </td>
            </tr>`;
        }).join('');

        return `
        <div class="ocv-sectie" id="ocv-urentabel-sectie">
            <h2 class="ocv-sectie-titel">${window.Icons.clock({ size: 15 })} Urenberekening</h2>
            <div class="ocv-tabel-wrap" id="ocv-urentabel-wrap">
                <table class="ocv-tabel">
                    <thead>
                        <tr>
                            <th>Activiteit</th>
                            <th class="ocv-tabel-num">Uren indicatie</th>
                            <th>Component</th>
                            <th class="ocv-tabel-num">×</th>
                            <th class="ocv-tabel-num">Uren</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="ocv-urentabel-body">${rijen}</tbody>
                    <tfoot>
                        <tr class="oc-totaal-rij">
                            <td>Totaal berekende uren</td>
                            <td></td><td></td><td></td>
                            <td class="oc-uren-totaal" id="oc-uren-totaal">${Math.round(totaal * 100) / 100}</td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <div class="oc-activiteit-toevoegen">
                <input type="text" id="oc-nieuwe-activiteit-naam"
                       placeholder="Naam nieuwe activiteit..."
                       class="oc-nieuwe-naam-input">
                <input type="number" id="oc-nieuwe-activiteit-uren"
                       placeholder="Uren" value="1" min="0.25" step="0.25"
                       class="oc-nieuwe-uren-input">
                <select id="oc-nieuwe-activiteit-comp" class="oc-nieuwe-comp-select">
                    <option value="percelen">percelen</option>
                    <option value="paginas">pagina's</option>
                    <option value="sub_criteria">sub-criteria</option>
                    <option value="vragen_nvi">vragen NvI</option>
                    <option value="bijlagen_redigeren">bijlagen</option>
                    <option value="fixed_1" selected>vast (×1)</option>
                </select>
                <button class="oc-btn-toevoegen"
                        onclick="window._ocv?.handleVoegActiviteitToe()">
                    ${window.Icons.plus({ size: 14 })} Toevoegen
                </button>
            </div>
        </div>`;
    }

    _htmlKortingen(o) {
        const numVeld = (id, label, val, hint = '') => `
            <div class="ocv-var-veld">
                <label>${label}</label>
                <input type="number" id="${id}" min="0" value="${val ?? 0}" class="ocv-var-input">
                ${hint ? `<span class="ocv-var-hint">${hint}</span>` : ''}
            </div>`;

        return `
        <div class="ocv-sectie">
            <h2 class="ocv-sectie-titel">${window.Icons.sliders({ size: 15 })} Kortingen</h2>
            <div class="ocv-variabelen-grid">
                <div class="ocv-var-groep">
                    ${numVeld('ocv-bekende-klant',   'Bekende klant (%)',   o.bekende_klant_pct ?? 0,   'Korting op berekend uren')}
                    ${numVeld('ocv-zittende-partij', 'Zittende partij (%)', o.zittende_partij_pct ?? 0, 'Korting op berekend uren')}
                </div>
                <div class="ocv-var-groep">
                    <div class="ocv-var-veld">
                        <label>${window.Icons.check({ size: 12 })} Presentatie</label>
                        <label class="ocv-toggle">
                            <input type="checkbox" id="ocv-presentatie" ${o.presentatie ? 'checked' : ''}>
                            <span class="ocv-toggle-slider"></span>
                            <span class="ocv-toggle-label">+2 uur presentatie support</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>`;
    }

    _htmlFactuurPanel(o) {
        const euro = val => val ? this._formatEuro(val) : '';
        return `
        <div class="ocv-sectie">
            <h2 class="ocv-sectie-titel">${window.Icons.barChart({ size: 15 })} Factuurbedragen klant</h2>
            <p class="ocv-sectie-hint">Voer de daadwerkelijke factuurbedragen in (kunnen afwijken van de berekende richtlijn).</p>
            <div class="ocv-factuur-grid">
                <div class="ocv-factuur-veld">
                    <label>Tenderschrijven</label>
                    <div class="ocv-euro-input"><span>€</span>
                        <input type="number" id="ocv-f-schrijven" min="0" value="${o.factuur_tenderschrijven ?? 0}">
                    </div>
                </div>
                <div class="ocv-factuur-veld">
                    <label>Tendermanagement</label>
                    <div class="ocv-euro-input"><span>€</span>
                        <input type="number" id="ocv-f-management" min="0" value="${o.factuur_tendermanagement ?? 0}">
                    </div>
                </div>
                <div class="ocv-factuur-veld">
                    <label>Tenderdocumenten</label>
                    <div class="ocv-euro-input"><span>€</span>
                        <input type="number" id="ocv-f-documenten" min="0" value="${o.factuur_tendercdocumenten ?? 0}">
                    </div>
                </div>
                <div class="ocv-factuur-veld">
                    <label>Grafisch ontwerp</label>
                    <div class="ocv-euro-input"><span>€</span>
                        <input type="number" id="ocv-f-grafisch" min="0" value="${o.factuur_grafisch_ontwerp ?? 0}">
                    </div>
                </div>
                <div class="ocv-factuur-veld">
                    <label>Commissie naam</label>
                    <input type="text" id="ocv-comm-naam" value="${this._esc(window.app?.currentBureau?.bureau_naam || o.commissie_naam || '')}">
                </div>
                <div class="ocv-factuur-veld">
                    <label>Commissie % (over schrijven)</label>
                    <input type="number" id="ocv-comm-pct" min="0" max="100" value="${o.commissie_pct ?? 10}">
                </div>
            </div>
        </div>`;
    }

    _htmlNotities(o) {
        return `
        <div class="ocv-sectie">
            <h2 class="ocv-sectie-titel">${window.Icons.fileText({ size: 15 })} Notities</h2>
            <textarea id="ocv-notities" class="ocv-notities" rows="4"
                      placeholder="Interne notities bij deze offerte…">${this._esc(o.notities || '')}</textarea>
        </div>`;
    }

    // -----------------------------------------------------------------------
    // Feature: Documenten sectie
    // -----------------------------------------------------------------------

    _htmlDocumenten(o) {
        return `
        <div class="ocv-sectie ocv-documenten-sectie">
            <h2 class="ocv-sectie-titel">
                ${window.Icons.fileText({ size: 15 })} Documenten
                <span class="ocv-doc-count" id="ocv-doc-count"></span>
            </h2>
            <div id="ocv-documenten-lijst" class="ocv-documenten-lijst">
                <span class="ocv-doc-leeg">Geen documenten geüpload</span>
            </div>
            <label class="ocv-upload-knop">
                ${window.Icons.upload({ size: 13 })} Document toevoegen
                <input type="file" id="ocv-doc-upload" accept=".pdf,.doc,.docx" multiple style="display:none;">
            </label>
        </div>`;
    }

    _htmlPdfViewer() {
        return `
        <div class="ocv-pdf-viewer" id="ocv-pdf-viewer">
            <div class="ocv-pdf-header">
                <span class="ocv-pdf-naam" id="ocv-pdf-naam"></span>
                <button class="ocv-pdf-sluit" id="ocv-pdf-sluit">${window.Icons.x({ size: 16 })}</button>
            </div>
            <iframe id="ocv-pdf-iframe" class="ocv-pdf-iframe" src="" title="Document preview"></iframe>
        </div>`;
    }

    async _laadDocumenten() {
        if (!this._offerte?.id) return;
        try {
            const docs = await this._fetch(`/api/v1/offerte-calculator/${this._offerte.id}/documenten`);
            const lijst = this._container?.querySelector('#ocv-documenten-lijst');
            const count = this._container?.querySelector('#ocv-doc-count');
            if (!lijst) return;

            if (!docs.length) {
                lijst.innerHTML = '<span class="ocv-doc-leeg">Geen documenten geüpload</span>';
                if (count) count.textContent = '';
                return;
            }

            if (count) count.textContent = `(${docs.length})`;
            lijst.innerHTML = docs.map(doc => {
                const isTender = doc.source === 'tender';
                return `
                <div class="ocv-document-rij" data-doc-id="${doc.id}">
                    ${window.Icons.fileText({ size: 14 })}
                    <span class="ocv-doc-naam">${this._esc(doc.original_file_name)}</span>
                    ${isTender ? `<span class="ocv-doc-bron-badge">Tender</span>` : ''}
                    <span class="ocv-doc-grootte">${this._formatBytes(doc.file_size)}</span>
                    <button class="ocv-doc-open-btn" data-action="ocv-doc-open"
                            data-doc-id="${doc.id}" data-source="${doc.source || 'offerte'}"
                            title="Openen in viewer">
                        ${window.Icons.externalLink({ size: 13 })}
                    </button>
                    ${!isTender ? `<button class="ocv-doc-del-btn" data-action="ocv-doc-del"
                            data-doc-id="${doc.id}" title="Verwijderen">
                        ${window.Icons.trash({ size: 13 })}
                    </button>` : ''}
                </div>`;
            }).join('');
        } catch (e) {
            console.warn('Documenten laden mislukt:', e);
        }
    }

    async _openDocumentPreview(docId, source = 'offerte') {
        const viewer     = this._container?.querySelector('#ocv-pdf-viewer');
        const iframe     = this._container?.querySelector('#ocv-pdf-iframe');
        const naam       = this._container?.querySelector('#ocv-pdf-naam');
        const resultaten = this._container?.querySelector('#ocv-resultaten-wrap');
        if (!viewer || !iframe) return;
        try {
            const res = await this._fetch(
                `/api/v1/offerte-calculator/${this._offerte.id}/documenten/${docId}/preview-url?source=${source}`
            );
            if (naam) naam.textContent = res.file_name || '';
            iframe.src = res.url;
            // Wissel rechterkolom: resultaten verbergen, viewer tonen
            if (resultaten) resultaten.style.display = 'none';
            viewer.classList.add('actief');
            const rechterEl = this._container?.querySelector('#ocv-rechter');
            if (rechterEl) {
                rechterEl.classList.add('ocv-rechter--viewer');
                rechterEl.style.width = Math.max(this._rechterBreedte, Math.round(window.innerWidth * 0.45)) + 'px';
            }
        } catch (e) {
            this._toast('Kan document niet openen: ' + e.message, 'fout');
        }
    }

    _sluitPdfViewer() {
        const viewer     = this._container?.querySelector('#ocv-pdf-viewer');
        const iframe     = this._container?.querySelector('#ocv-pdf-iframe');
        const resultaten = this._container?.querySelector('#ocv-resultaten-wrap');
        if (viewer) viewer.classList.remove('actief');
        if (iframe) iframe.src = '';
        if (resultaten) resultaten.style.display = '';
        const rechterEl = this._container?.querySelector('#ocv-rechter');
        if (rechterEl) {
            rechterEl.classList.remove('ocv-rechter--viewer');
            rechterEl.style.width = this._rechterBreedte + 'px';
        }
    }

    async _uploadDocumenten(files) {
        const knop = this._container?.querySelector('.ocv-upload-knop');
        if (knop) knop.style.opacity = '0.5';
        try {
            const token = await this._getToken();
            const formData = new FormData();
            for (const f of files) formData.append('bestanden', f);
            const resp = await fetch(`${this._baseUrl}/api/v1/offerte-calculator/${this._offerte.id}/documenten`, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });
            if (!resp.ok) {
                const err = await resp.json().catch(() => ({}));
                throw new Error(err.detail || `HTTP ${resp.status}`);
            }
            await this._laadDocumenten();
            this._toast(`${files.length} document(en) geüpload`, 'ok');
        } catch (e) {
            this._toast('Upload mislukt: ' + e.message, 'fout');
        } finally {
            if (knop) knop.style.opacity = '';
        }
    }

    async _verwijderDocument(docId) {
        if (!confirm('Document verwijderen uit deze offerte?')) return;
        try {
            await this._fetch(
                `/api/v1/offerte-calculator/${this._offerte.id}/documenten/${docId}`,
                { method: 'DELETE' }
            );
            await this._laadDocumenten();
        } catch (e) {
            this._toast('Verwijderen mislukt: ' + e.message, 'fout');
        }
    }

    _formatBytes(bytes) {
        if (!bytes) return '';
        if (bytes < 1024)        return bytes + ' B';
        if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // -----------------------------------------------------------------------
    // Feature: AI toelichting popover
    // -----------------------------------------------------------------------

    _toonToelichting(btn, tekst) {
        document.querySelector('.ocv-toelichting-popover')?.remove();
        const popover = document.createElement('div');
        popover.className = 'ocv-toelichting-popover';
        popover.innerHTML = `
            <div class="ocv-toelichting-header">${window.Icons.info({ size: 13 })} Hoe berekend?</div>
            <p class="ocv-toelichting-tekst">${this._esc(tekst)}</p>`;
        const rect = btn.getBoundingClientRect();
        popover.style.top  = (rect.bottom + 6) + 'px';
        popover.style.left = Math.max(8, rect.left - 40) + 'px';
        document.body.appendChild(popover);
        setTimeout(() => {
            document.addEventListener('click', () => popover.remove(), { once: true });
        }, 0);
    }

    // -----------------------------------------------------------------------
    // Feature: Looptijd auto-berekening
    // -----------------------------------------------------------------------

    _updateTotaleLooptijd() {
        const basis   = parseFloat(this._container?.querySelector('#ocv-basisperiode')?.value)  || 0;
        const verleng = parseFloat(this._container?.querySelector('#ocv-verlengopties')?.value) || 0;
        const el = this._container?.querySelector('.ocv-looptijd-totaal');
        if (el) el.textContent = (basis + verleng) + ' jaar';
    }

    _htmlNettoConfig() {
        const o = this._offerte || {};
        return `
        <div class="ocv-comp-kaart">
          <div class="ocv-comp-header">
            <div class="ocv-comp-header-links">
              <div class="ocv-comp-icon" style="background:#f0fdf4;color:#15803d">NT</div>
              <span class="ocv-comp-naam">Netto berekening Tendertaal</span>
            </div>
          </div>
          <div class="ocv-comp-body">
            <div style="font-size:11px;color:var(--color-text-secondary, #6b7280);margin-bottom:10px">
              Selecteer welke componenten meetellen voor het netto bedrag.
            </div>
            <div class="ocv-nc-rij">
              <span class="ocv-nc-lbl">Tenderschrijven</span>
              <span class="ocv-nc-bedrag" id="ocv-nc-ts-bedrag">€ 0</span>
              <label class="ocv-nc-toggle">
                <input type="checkbox" id="ocv-nc-schrijven"
                       ${o.netto_include_schrijven !== false ? 'checked' : ''}
                       onchange="window._ocv?._herbereken()">
                <span class="ocv-nc-slider"></span>
              </label>
            </div>
            <div class="ocv-nc-rij">
              <span class="ocv-nc-lbl">Tendermanagement</span>
              <span class="ocv-nc-bedrag" id="ocv-nc-tm-bedrag">€ 0</span>
              <label class="ocv-nc-toggle">
                <input type="checkbox" id="ocv-nc-management"
                       ${o.netto_include_management ? 'checked' : ''}
                       onchange="window._ocv?._herbereken()">
                <span class="ocv-nc-slider"></span>
              </label>
            </div>
            <div class="ocv-nc-rij">
              <span class="ocv-nc-lbl">Tenderdocumenten</span>
              <span class="ocv-nc-bedrag" id="ocv-nc-td-bedrag">€ 0</span>
              <label class="ocv-nc-toggle">
                <input type="checkbox" id="ocv-nc-documenten"
                       ${o.netto_include_documenten ? 'checked' : ''}
                       onchange="window._ocv?._herbereken()">
                <span class="ocv-nc-slider"></span>
              </label>
            </div>
            <div class="ocv-nc-rij">
              <span class="ocv-nc-lbl">Grafisch ontwerp</span>
              <span class="ocv-nc-bedrag" id="ocv-nc-go-bedrag">€ 0</span>
              <label class="ocv-nc-toggle">
                <input type="checkbox" id="ocv-nc-grafisch"
                       ${o.netto_include_grafisch ? 'checked' : ''}
                       onchange="window._ocv?._herbereken()">
                <span class="ocv-nc-slider"></span>
              </label>
            </div>
            <div class="ocv-nc-rij ocv-nc-aftrek">
              <span class="ocv-nc-lbl">Min: inhuurkosten externe schrijver</span>
              <span class="ocv-nc-bedrag ocv-oranje" id="ocv-nc-inhuur-bedrag">−€ 0</span>
              <label class="ocv-nc-toggle">
                <input type="checkbox" id="ocv-nc-inhuur-toggle"
                       ${o.netto_include_inhuur ? 'checked' : ''}
                       ${(o.schrijver_type || 'intern') !== 'extern' ? 'disabled' : ''}
                       onchange="window._ocv?._herbereken()">
                <span class="ocv-nc-slider"></span>
              </label>
            </div>
            <div class="ocv-nc-rij ocv-nc-aftrek">
              <span class="ocv-nc-lbl">Min: commissie tenderbureau</span>
              <span class="ocv-nc-bedrag ocv-rood" id="ocv-nc-comm-bedrag">−€ 0</span>
              <label class="ocv-nc-toggle">
                <input type="checkbox" id="ocv-nc-commissie"
                       ${o.netto_include_commissie !== false ? 'checked' : ''}
                       onchange="window._ocv?._herbereken()">
                <span class="ocv-nc-slider"></span>
              </label>
            </div>
          </div>
        </div>`;
    }

    _htmlResultatenPanel() {
        const o = this._offerte || {};
        const paginas = o.paginas || 0;
        const uren = this._berekenUren(o);
        const nettoUren = uren.uren_netto || 0;

        return `
        <div class="ocv-panel">

          <!-- FACTUUR TOTAAL -->
          <div class="ocv-factuur-totaal-kaart">
            <div class="ocv-ft-header">Totaal factuur klant</div>
            <div class="ocv-ft-body">
              <div class="ocv-ft-rij"><span>Tenderschrijven</span><span id="ocv-sum-ts">€ 0</span></div>
              <div class="ocv-ft-rij"><span>Tendermanagement</span><span id="ocv-sum-tm">€ 0</span></div>
              <div class="ocv-ft-rij"><span>Tenderdocumenten</span><span id="ocv-sum-td">€ 0</span></div>
              <div class="ocv-ft-rij"><span>Grafisch ontwerp</span><span id="ocv-sum-go">€ 0</span></div>
              <div class="ocv-ft-totaal">
                <span>Totaal</span>
                <span id="ocv-f-totaal">€ 0</span>
              </div>
            </div>
          </div>

          <!-- KWALITEITSCHECKS -->
          <div class="ocv-checks-kaart">
            <div class="ocv-checks-header">
              <span class="ocv-comp-icon">${window.Icons.checkCircle({ size: 16, color: 'currentColor' })}</span>
              Kwaliteitschecks
            </div>
            <div class="ocv-checks-body">
              <div class="ocv-ka-check" id="ocv-ka-check">
                <div class="ocv-ka-lbl">Kosten per A4 (klant)</div>
                <div class="ocv-ka-val" id="ocv-ka-val">—</div>
                <div class="ocv-ka-sub" id="ocv-ka-sub">—</div>
                <div class="ocv-check-berekening" id="ocv-ka-berekening">—</div>
              </div>

              <div class="ocv-ratio-kaart" id="ocv-ratio-kaart">
                <div class="ocv-ratio-lbl">Offerte / max. opdrachtwaarde</div>
                <div class="ocv-ratio-pct" id="ocv-ratio-pct">—</div>
                <div class="ocv-ratio-sub" id="ocv-ratio-sub">—</div>
                <div class="ocv-check-berekening" id="ocv-ratio-berekening">—</div>
                <div class="ocv-ratio-balk-wrap">
                  <div class="ocv-ratio-balk-fill" id="ocv-ratio-balk" style="width:0%"></div>
                </div>
                <div class="ocv-ratio-schaal"><span>0%</span><span>1%</span><span>2%</span><span>3%+</span></div>
              </div>
            </div>
          </div>

          <!-- NETTO VOOR TENDERTAAL -->
          <div class="ocv-netto-banner">
            <div class="ocv-netto-lbl">Netto voor Tendertaal</div>
            <div class="ocv-netto-val" id="ocv-netto-val">€ 0</div>
            <div class="ocv-netto-berekening" id="ocv-netto-berekening">—</div>
            <div class="ocv-netto-comm" id="ocv-netto-comm">—</div>
          </div>

          <!-- TENDERSCHRIJVEN -->
          <div class="ocv-comp-kaart">
            <div class="ocv-comp-header">
              <div class="ocv-comp-header-links">
                <div class="ocv-comp-icon" style="background:#ede9fe;color:#4c1d95">TS</div>
                <span class="ocv-comp-naam">Tenderschrijven</span>
              </div>
              <span class="ocv-comp-badge-euro" id="ocv-ts-totaal">€ 0</span>
            </div>
            <div class="ocv-comp-body">
              <div class="ocv-rij">
                <span class="ocv-lbl">Tenderschrijver</span>
                <select class="ocv-k" id="ocv-schrijver-type"
                        style="width:150px;text-align:left"
                        onchange="window._ocv?._onSchrijverTypeChange()">
                  <option value="intern" ${(o.schrijver_type||'intern')==='intern'?'selected':''}>Intern — Tendertaal</option>
                  <option value="extern" ${o.schrijver_type==='extern'?'selected':''}>Extern — inhuur</option>
                </select>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Wie schrijft</span>
                ${this._htmlTeamlidSelect('ocv-schrijver-user', o.schrijver_user_id)}
              </div>
              <div id="ocv-extern-schrijver-blok" style="display:${o.schrijver_type==='extern'?'block':'none'}">
                <div class="ocv-extern-blok">
                  <div class="ocv-extern-lbl">Inhuur externe schrijver</div>
                  <div class="ocv-rij">
                    <span class="ocv-lbl">Inhuurtarief per uur</span>
                    <div class="ocv-invoer-wrap">
                      <span>€</span>
                      <input class="ocv-k" type="number" id="ocv-inhuur-tarief-s"
                             value="${o.inhuur_tarief_schrijven ?? 0}"
                             oninput="window._ocv?._herbereken()">
                    </div>
                  </div>
                  <div class="ocv-rij">
                    <span class="ocv-lbl">Inhuurkosten (uren × tarief)</span>
                    <span class="ocv-hint" id="ocv-inhuur-kosten-s">€ 0</span>
                  </div>
                  <div class="ocv-rij">
                    <span class="ocv-lbl ocv-oranje">Marge schrijven</span>
                    <span style="font-weight:500;color:#d97706" id="ocv-marge-schrijven">€ 0</span>
                  </div>
                </div>
              </div>
              <div class="ocv-sep"></div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Netto uren (urenmodel)</span>
                <span class="ocv-waarde" id="ocv-netto-uren-display">${nettoUren} u</span>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Uurtarief</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-tarief-s"
                         value="${o.tarief_tenderschrijven ?? 130}"
                         oninput="window._ocv?._herbereken()">
                </div>
              </div>
              <div class="ocv-rij">
                <span class="ocv-hint">Berekend (${nettoUren}u × tarief)</span>
                <span class="ocv-hint" id="ocv-ts-berekend">€ 0</span>
              </div>
              <div class="ocv-sep"></div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Korting %</span>
                <div class="ocv-invoer-wrap">
                  <input class="ocv-k" type="number" id="ocv-ts-korting"
                         value="${o.korting_tenderschrijven ?? 0}"
                         style="width:50px" oninput="window._ocv?._herbereken()">
                  <span>%</span>
                </div>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Doorbelasten aan klant</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-f-schrijven"
                         value="${o.factuur_tenderschrijven ?? 0}"
                         oninput="this.dataset.handmatig='1'; window._ocv?._herbereken()">
                </div>
              </div>
              <div class="ocv-check-pill" id="ocv-ts-a4-pill">
                <span>Uren per A4 schrijven</span>
                <span id="ocv-ts-a4-val">—</span>
              </div>
            </div>
          </div>

          <!-- TENDERMANAGEMENT -->
          <div class="ocv-comp-kaart">
            <div class="ocv-comp-header">
              <div class="ocv-comp-header-links">
                <div class="ocv-comp-icon" style="background:#dbeafe;color:#1e40af">TM</div>
                <span class="ocv-comp-naam">Tendermanagement</span>
              </div>
              <span class="ocv-comp-badge-euro" id="ocv-tm-totaal">€ 0</span>
            </div>
            <div class="ocv-comp-body">
              <div class="ocv-rij">
                <span class="ocv-lbl">Tendermanager</span>
                ${this._htmlTeamlidSelect('ocv-manager-user', o.manager_user_id)}
              </div>
              <div class="ocv-rij">
                <span class="ocv-hint">Richtlijn: 1/3 van schrijven</span>
                <span class="ocv-hint" id="ocv-tm-richtlijn">€ 0</span>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Uurtarief</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-tarief-m"
                         value="${o.tarief_tendermanagement ?? 130}"
                         oninput="window._ocv?._herbereken()">
                </div>
              </div>
              <div class="ocv-sep"></div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Korting %</span>
                <div class="ocv-invoer-wrap">
                  <input class="ocv-k" type="number" id="ocv-tm-korting"
                         value="${o.korting_tendermanagement ?? 0}"
                         style="width:50px" oninput="window._ocv?._herbereken()">
                  <span>%</span>
                </div>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Doorbelasten aan klant</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-f-management"
                         value="${o.factuur_tendermanagement ?? 0}"
                         oninput="this.dataset.handmatig='1'; window._ocv?._herbereken()">
                </div>
              </div>
            </div>
          </div>

          <!-- TENDERDOCUMENTEN -->
          <div class="ocv-comp-kaart">
            <div class="ocv-comp-header">
              <div class="ocv-comp-header-links">
                <div class="ocv-comp-icon" style="background:#d1fae5;color:#065f46">TD</div>
                <span class="ocv-comp-naam">Tenderdocumenten</span>
              </div>
              <span class="ocv-comp-badge-euro" id="ocv-td-totaal">€ 0</span>
            </div>
            <div class="ocv-comp-body">
              <div class="ocv-rij"><span class="ocv-hint">Vaste vergoeding per project</span></div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Bedrag</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-f-documenten"
                         value="${o.factuur_tendercdocumenten ?? 0}"
                         oninput="window._ocv?._herbereken()">
                </div>
              </div>
            </div>
          </div>

          <!-- GRAFISCH ONTWERP -->
          <div class="ocv-comp-kaart">
            <div class="ocv-comp-header">
              <div class="ocv-comp-header-links">
                <div class="ocv-comp-icon" style="background:#fef3c7;color:#92400e">GO</div>
                <span class="ocv-comp-naam">Grafisch ontwerp</span>
              </div>
              <span class="ocv-comp-badge-euro" id="ocv-go-totaal">€ 0</span>
            </div>
            <div class="ocv-comp-body">
              <div class="ocv-rij">
                <span class="ocv-lbl">Grafisch ontwerper</span>
                ${this._htmlTeamlidSelect('ocv-grafisch-user', o.grafisch_user_id, [{ value: 'extern', label: 'Extern — inhuur' }])}
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Aantal pagina's (variabelen)</span>
                <span class="ocv-waarde" id="ocv-go-paginas">${paginas}</span>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Tarief per pagina</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-go-tarief"
                         value="${o.tarief_grafisch_per_pagina ?? 75}"
                         oninput="window._ocv?._herbereken()">
                </div>
              </div>
              <div class="ocv-rij">
                <span class="ocv-hint">Berekend (${paginas} × tarief)</span>
                <span class="ocv-hint" id="ocv-go-berekend">€ 0</span>
              </div>
              <div class="ocv-sep"></div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Korting %</span>
                <div class="ocv-invoer-wrap">
                  <input class="ocv-k" type="number" id="ocv-go-korting"
                         value="${o.korting_grafisch ?? 0}"
                         style="width:50px" oninput="window._ocv?._herbereken()">
                  <span>%</span>
                </div>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Doorbelasten aan klant</span>
                <div class="ocv-invoer-wrap">
                  <span>€</span>
                  <input class="ocv-k" type="number" id="ocv-f-grafisch"
                         value="${o.factuur_grafisch_ontwerp ?? 0}"
                         oninput="this.dataset.handmatig='1'; window._ocv?._herbereken()">
                </div>
              </div>
            </div>
          </div>

          <!-- COMMISSIE -->
          <div class="ocv-comp-kaart">
            <div class="ocv-comp-header">
              <div class="ocv-comp-header-links">
                <div class="ocv-comp-icon" style="background:#f3e8ff;color:#6b21a8">CM</div>
                <span class="ocv-comp-naam">Commissie</span>
              </div>
              <span class="ocv-comp-badge-euro ocv-rood" id="ocv-comm-badge">−€ 0</span>
            </div>
            <div class="ocv-comp-body">
              <div class="ocv-rij">
                <span class="ocv-lbl">Tenderbureau</span>
                <span class="ocv-waarde" id="ocv-comm-naam">${this._esc(window.app?.currentBureau?.bureau_naam || o.commissie_naam || '—')}</span>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Over welk bedrag</span>
                <select class="ocv-k" id="ocv-comm-basis" onchange="window._ocv?._herbereken()">
                  <option value="schrijven" ${(o.commissie_basis || 'schrijven') === 'schrijven' ? 'selected' : ''}>Tenderschrijven</option>
                  <option value="management" ${o.commissie_basis === 'management' ? 'selected' : ''}>Tendermanagement</option>
                  <option value="documenten" ${o.commissie_basis === 'documenten' ? 'selected' : ''}>Tenderdocumenten</option>
                  <option value="grafisch" ${o.commissie_basis === 'grafisch' ? 'selected' : ''}>Grafisch ontwerp</option>
                  <option value="totaal" ${o.commissie_basis === 'totaal' ? 'selected' : ''}>Totaal factuur</option>
                </select>
              </div>
              <div class="ocv-rij">
                <span class="ocv-lbl">Percentage</span>
                <div class="ocv-invoer-wrap">
                  <input class="ocv-k" type="number" id="ocv-comm-pct"
                         value="${o.commissie_pct ?? 10}"
                         style="width:50px" oninput="window._ocv?._herbereken()">
                  <span>%</span>
                </div>
              </div>
            </div>
          </div>

          ${this._htmlNettoConfig()}

        </div>`;
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    _setText(id, tekst) {
        const el = document.getElementById(id);
        if (el) el.textContent = tekst;
    }

    _updateUrentabel(detail) {
        const tbody = this._container?.querySelector('#ocv-urentabel-body');
        if (!tbody || !detail) return;
        tbody.innerHTML = detail.map((a, index) => `
            <tr class="ocv-tabel-rij ocv-tabel-rij--${a.uren > 0 ? 'actief' : 'nul'}">
                <td>${this._esc(a.naam)}</td>
                <td class="ocv-tabel-num">
                    <input type="number" class="oc-uren-indicatie-input"
                           value="${a.uren_indicatie}" min="0" max="20" step="0.25"
                           data-activiteit="${this._esc(a.naam)}"
                           oninput="window._ocv?.handleUrenIndicatieWijziging(this)">
                </td>
                <td><span class="ocv-comp-badge">${a.component}</span></td>
                <td class="ocv-tabel-num">
                    <input type="number" class="oc-uren-indicatie-input"
                           value="${a.multiple}" min="0" step="0.01"
                           data-activiteit="${this._esc(a.naam)}"
                           oninput="window._ocv?.handleVermenigvuldigerWijziging(this)">
                </td>
                <td class="ocv-tabel-num ocv-tabel-uren">${a.uren}</td>
                <td>
                    <button class="oc-verwijder-btn" data-index="${index}"
                            onclick="window._ocv?.handleVerwijderActiviteit(this)"
                            title="Verwijder activiteit">
                        ${window.Icons.x({ size: 12 })}
                    </button>
                </td>
            </tr>`).join('');

        // Totaalrij bijwerken
        const totaal = detail.reduce((s, a) => s + (a.uren || 0), 0);
        const totaalEl = this._container?.querySelector('#oc-uren-totaal');
        if (totaalEl) totaalEl.textContent = Math.round(totaal * 100) / 100;
    }

    _renderUrentabel() {
        const sectie = this._container?.querySelector('#ocv-urentabel-sectie');
        if (!sectie) return;
        const data  = this._leesFormulier();
        const uren  = this._berekenUren(data);
        const nieuw = document.createElement('div');
        nieuw.innerHTML = this._htmlUrentabel(uren.activiteiten_detail);
        sectie.replaceWith(nieuw.firstElementChild);
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    _bindEvents(root) {
        // Click delegation
        root.addEventListener('click', e => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;

            switch (action) {
                case 'ocv-terug':
                    if (this._dirty) {
                        if (!confirm('Onopgeslagen wijzigingen gaan verloren. Toch terug?')) return;
                    }
                    if (window.app) window.app.showView('offerte-overzicht');
                    else window.location.hash = '#offerte-overzicht';
                    break;
                case 'ocv-opslaan':      this._slaOp(); break;
                case 'ocv-ai-analyse':   this._analyseerMetAI(); break;
                case 'ocv-export':       this._exporteerExcel(); break;
            }
        });

        // Model-select
        root.querySelector('#ocv-model-select')?.addEventListener('change', e => {
            this._aiModel = e.target.value;
        });

        // Realtime herberekening bij elke variabele-input
        const varInputs = root.querySelectorAll(
            '#ocv-percelen, #ocv-sub-criteria, #ocv-paginas, ' +
            '#ocv-bijlagen-red, #ocv-waarde-min, #ocv-waarde-max, #ocv-bekende-klant, #ocv-zittende-partij, ' +
            '#ocv-presentatie, ' +
            '#ocv-tarief-s, #ocv-tarief-m, #ocv-go-tarief, ' +
            '#ocv-ts-korting, #ocv-tm-korting, #ocv-go-korting, ' +
            '#ocv-f-schrijven, #ocv-f-management, #ocv-f-documenten, #ocv-f-grafisch, ' +
            '#ocv-comm-pct, #ocv-comm-basis'
        );
        varInputs.forEach(el => {
            el.addEventListener('input',  () => this._herbereken());
            el.addEventListener('change', () => this._herbereken());
        });

        // Kwaliteitsweging → prijsweging automatisch
        root.querySelector('#ocv-kw-kwal')?.addEventListener('input', e => {
            const kw = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
            const pw = 100 - kw;
            const prijsEl = root.querySelector('#ocv-kw-prijs');
            if (prijsEl) prijsEl.value = pw;
            this._dirty = true;
            this._debouncedSlaOp();
        });

        // Looptijd auto-berekening: basisperiode + verlengopties → totale looptijd display
        ['#ocv-basisperiode', '#ocv-verlengopties'].forEach(id => {
            root.querySelector(id)?.addEventListener('input', () => {
                this._updateTotaleLooptijd();
                this._dirty = true;
                this._debouncedSlaOp();
            });
        });

        // AI toelichting info-buttons (event delegation op root)
        root.addEventListener('click', e => {
            const infoBtn = e.target.closest('[data-action="ocv-info"]');
            if (!infoBtn) return;
            e.stopPropagation();
            const veld  = infoBtn.dataset.veld;
            const tekst = (this._offerte?.ai_toelichtingen || {})[veld] || 'Geen toelichting beschikbaar.';
            this._toonToelichting(infoBtn, tekst);
        }, true);

        // Document acties: open preview + verwijderen
        root.addEventListener('click', e => {
            const openBtn = e.target.closest('[data-action="ocv-doc-open"]');
            const delBtn  = e.target.closest('[data-action="ocv-doc-del"]');
            if (openBtn) this._openDocumentPreview(openBtn.dataset.docId, openBtn.dataset.source || 'offerte');
            if (delBtn)  this._verwijderDocument(delBtn.dataset.docId);
        });

        // Document upload via file input
        root.querySelector('#ocv-doc-upload')?.addEventListener('change', async e => {
            const files = e.target.files;
            if (!files?.length || !this._offerte?.id) return;
            await this._uploadDocumenten(files);
            e.target.value = '';
        });

        // Splitter: sleep om linker/rechter kolom te resizen
        const splitter = root.querySelector('#ocv-splitter');
        if (splitter) {
            splitter.addEventListener('mousedown', e => {
                e.preventDefault();
                const rechter  = root.querySelector('#ocv-rechter');
                const body     = root.querySelector('.ocv-body');
                const startX   = e.clientX;
                const startB   = rechter.offsetWidth;

                splitter.classList.add('actief');
                document.body.style.cursor     = 'col-resize';
                document.body.style.userSelect = 'none';

                const onMove = ev => {
                    const delta   = startX - ev.clientX;
                    const maxB    = Math.round(body.offsetWidth * 0.65);
                    const nieuweB = Math.min(maxB, Math.max(240, startB + delta));
                    rechter.style.width    = nieuweB + 'px';
                    this._rechterBreedte   = nieuweB;
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup',   onUp);
                    document.body.style.cursor     = '';
                    document.body.style.userSelect = '';
                    splitter.classList.remove('actief');
                    localStorage.setItem('ocv-rechter-breedte', String(this._rechterBreedte));
                };
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup',   onUp);
            });
        }

        // Andere velden: dirty markering
        root.querySelectorAll('input, select, textarea').forEach(el => {
            el.addEventListener('input', () => { this._dirty = true; });
        });

        // Waarschuw bij pagina verlaten
        this._beforeUnload = e => {
            if (this._dirty) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', this._beforeUnload);
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
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        return { concept: 'Concept', verzonden: 'Verzonden', geaccepteerd: 'Geaccepteerd', afgewezen: 'Afgewezen' }[status] || status || 'Concept';
    }

    _formatEuro(bedrag) {
        if (bedrag === null || bedrag === undefined || bedrag === '') return '€0';
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(bedrag);
    }

    _esc(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _toast(bericht, type = 'ok') {
        document.getElementById('ocv-toast')?.remove();
        const el = document.createElement('div');
        el.id = 'ocv-toast';
        el.className = `ocv-toast ocv-toast--${type}`;
        el.textContent = bericht;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('is-zichtbaar'));
        setTimeout(() => { el.classList.remove('is-zichtbaar'); setTimeout(() => el.remove(), 250); }, 3000);
    }

    _toonFout(bericht) {
        if (this._container) {
            this._container.innerHTML = `<div class="ocv-root"><div class="ocv-fout">${this._esc(bericht)}</div></div>`;
        }
    }
}

window.OfferteCalculatorView = OfferteCalculatorView;
