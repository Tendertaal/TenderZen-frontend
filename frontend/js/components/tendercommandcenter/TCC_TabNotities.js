/* ============================================================
   TCC_TabNotities.js
   TenderZen — Notities Zijpaneel Component
   Versie 1.0 — 20260323_1900

   Verantwoordelijkheden:
   - Renderen van het notities zijpaneel (naast TCC body)
   - Notities ophalen en tonen per tender
   - Notitie plaatsen (label + @mention + bijlage + bold/bullets)
   - Actie-label koppeling: automatisch Projectplanning taak aanmaken
   - Footer-knop met badge in TCC

   Afhankelijkheden:
   - window.Icons (icons.js)
   - window.supabaseClient || window.supabase
   - window.CONFIG.apiBaseUrl
   ============================================================ */

class TCC_TabNotities {

    // ── Kleuren per gebruiker (deterministisch o.b.v. naam) ──────────────
    static AVATAR_COLORS = [
        'purple', 'green', 'orange', 'blue', 'teal', 'pink'
    ];

    // ── Teamleden voor @mention (wordt geladen vanuit DB) ────────────────
    _teamleden = [];

    // ── State ────────────────────────────────────────────────────────────
    _tenderId       = null;
    _tenderbueau    = null;
    _notities       = [];
    _activeLabel    = null;   // null | 'intern' | 'klant' | 'actie'
    _boldActive     = false;
    _bulletsActive  = false;
    _mentionQuery   = '';
    _mentionOpen    = false;
    _mentionStart   = null;   // cursor positie waar @ begon
    _currentUserId  = null;
    _currentUser    = null;

    // ── DOM referenties ──────────────────────────────────────────────────
    _paneel         = null;
    _feed           = null;
    _textarea       = null;
    _mentionDropdown = null;
    _actieHint      = null;
    _countBadge     = null;  // in paneel header
    _toggleBadge    = null;  // in footer knop

    // ────────────────────────────────────────────────────────────────────
    // INIT
    // ────────────────────────────────────────────────────────────────────

    // ────────────────────────────────────────────────────────────────────
    // PUBLIEKE API — aangeroepen door TCC_Core
    // ────────────────────────────────────────────────────────────────────

    /**
     * Initialiseer het paneel voor een specifieke tender.
     * @param {string} tenderId
     * @param {HTMLElement} tccBody      — .tcc-body element
     * @param {HTMLElement} tccFooter    — .tcc-footer element
     * @param {object}      tenderData   — tender record (voor context)
     */
    async init(tenderId, tccBody, tccFooter, tenderData = {}) {
        this._tenderId    = tenderId;
        this._tenderData  = tenderData;
        this._tccBody     = tccBody;
        this._tccFooter   = tccFooter;

        // Huidige gebruiker ophalen
        try {
            const sb = window.supabaseClient || window.supabase;
            const { data: { user } } = await sb.auth.getUser();
            this._currentUserId = user?.id || null;

            // Laad ook public.users profiel voor naam/initialen/kleur
            if (this._currentUserId) {
                const { data: profiel } = await sb
                    .from('users')
                    .select('id, naam, email, initialen, avatar_kleur')
                    .eq('id', this._currentUserId)
                    .single();
                this._currentUser = profiel || user?.user_metadata || {};
            }
        } catch {}

        // Footer knop toevoegen
        this._renderFooterKnop();

        // Paneel bouwen en aan body hangen
        this._renderPaneel(tccBody);

        // Data laden
        await Promise.all([
            this._loadNotities(),
            this._loadTeamleden()
        ]);

        this._updateTextareaPlaceholder();
    }

    /** Sluit en verwijder alles (bij TCC sluiten) */
    destroy() {
        this._paneel?.remove();
        this._toggleBtn?.remove();
        this._tccBody?.classList.remove('notities-open');
    }

    /** Herlaad teamleden en update placeholder — aanroepen na teamwijziging */
    async refreshTeamleden() {
        await this._loadTeamleden();
        this._updateTextareaPlaceholder();
    }

    // ────────────────────────────────────────────────────────────────────
    // FOOTER KNOP
    // ────────────────────────────────────────────────────────────────────

    _renderFooterKnop() {
        const btn = document.createElement('button');
        btn.className = 'tcc-btn tcc-btn--notities';
        btn.id = 'tcc-notities-toggle';
        btn.innerHTML = `
            ${this._icon('clipboardList', '#ffffff', 15)}
            Notities
            <span class="tcc-notities-badge" id="tcc-notities-toggle-badge" style="display:none">0</span>
        `;
        btn.addEventListener('click', () => this._togglePaneel());
        this._toggleBtn  = btn;
        this._toggleBadge = btn.querySelector('#tcc-notities-toggle-badge');

        // Plaatsen in de linker footer-kolom
        this._tccFooter.querySelector('.tcc-footer-right')?.appendChild(btn);
    }

    // ────────────────────────────────────────────────────────────────────
    // PANEEL BOUWEN
    // ────────────────────────────────────────────────────────────────────

    _renderPaneel(container) {
        const paneel = document.createElement('div');
        paneel.className = 'tcc-notities-paneel';
        paneel.id = 'tcc-notities-paneel';
        paneel.innerHTML = `
            <!-- Header -->
            <div class="tcc-np-header">
                <div class="tcc-np-header-icon">
                    ${this._icon('clipboardList', '#7c3aed', 18)}
                </div>
                <span class="tcc-np-title">Notities</span>
                <span class="tcc-np-count-badge" id="tcc-np-count">0</span>
                <button class="tcc-np-close" id="tcc-np-close" title="Sluiten">
                    ${this._icon('close', '#94a3b8', 16)}
                </button>
            </div>

            <!-- Feed -->
            <div class="tcc-np-feed" id="tcc-np-feed">
                <div class="tcc-np-empty">
                    <div class="tcc-np-empty-icon">${this._icon('clipboardList', '#94a3b8', 36)}</div>
                    <div class="tcc-np-empty-title">Nog geen notities</div>
                    <div class="tcc-np-empty-desc">Voeg een notitie toe om de samenwerking bij te houden.</div>
                </div>
            </div>

            <!-- Invoer -->
            <div class="tcc-np-invoer">

                <!-- Actie-hint (verborgen tenzij actief) -->
                <div class="tcc-np-actie-hint" id="tcc-np-actie-hint">
                    ${this._icon('warning', '#d97706', 13)}
                    <span>Tag iemand met <strong>@naam</strong> om automatisch een taak aan te maken.</span>
                </div>

                <!-- Textarea met paperclip rechtsonder -->
                <div class="tcc-np-textarea-wrapper">
                    <div class="tcc-np-mention-dropdown" id="tcc-np-mention-dropdown"></div>
                    <textarea
                        class="tcc-np-textarea"
                        id="tcc-np-textarea"
                        placeholder="Schrijf een notitie… typ @ om iemand te taggen"
                        rows="3"
                    ></textarea>
                    <button class="tcc-np-paperclip-btn" id="tcc-np-btn-paperclip" title="Bijlage toevoegen">
                        ${this._icon('fileText', '#94a3b8', 14)}
                    </button>
                </div>

                <!-- Onderste balk -->
                <div class="tcc-np-invoer-balk">
                    <button class="tcc-np-actie-pill" id="tcc-np-actie-toggle">
                        ${this._icon('checkCircle', 'currentColor', 13)} Actie
                    </button>
                    <div style="flex:1"></div>
                    <button class="tcc-np-toolbar-btn" id="tcc-np-btn-bold" title="Vet">
                        <strong>B</strong>
                    </button>
                    <button class="tcc-np-send-btn" id="tcc-np-send" disabled>
                        ${this._icon('export', '#fff', 15)}
                    </button>
                </div>

                <!-- Verborgen file input -->
                <input type="file" id="tcc-np-file-input" style="display:none"
                    multiple accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg">
            </div>
        `;

        // Zorg dat tcc-body relatief gepositioneerd is
        container.style.position = 'relative';
        container.style.overflow = 'hidden';

        container.appendChild(paneel);

        this._paneel          = paneel;
        this._feed            = paneel.querySelector('#tcc-np-feed');
        this._textarea        = paneel.querySelector('#tcc-np-textarea');
        this._mentionDropdown = paneel.querySelector('#tcc-np-mention-dropdown');
        this._actieHint       = paneel.querySelector('#tcc-np-actie-hint');
        this._countBadge      = paneel.querySelector('#tcc-np-count');

        this._bindEvents();
    }

    // ────────────────────────────────────────────────────────────────────
    // EVENTS
    // ────────────────────────────────────────────────────────────────────

    _bindEvents() {
        // Sluiten
        this._paneel.querySelector('#tcc-np-close')
            .addEventListener('click', () => this._sluitPaneel());

        // Actie toggle pill
        this._paneel.querySelector('#tcc-np-actie-toggle')
            .addEventListener('click', () => {
                const wasActief = this._activeLabel === 'actie';
                this._activeLabel = wasActief ? null : 'actie';
                this._paneel.querySelector('#tcc-np-actie-toggle')
                    .classList.toggle('is-active', !wasActief);
                this._actieHint.classList.toggle('is-visible', !wasActief);
            });

        // Bold
        this._paneel.querySelector('#tcc-np-btn-bold')
            .addEventListener('click', () => this._toggleBold());

        // Paperclip
        this._paneel.querySelector('#tcc-np-btn-paperclip')
            .addEventListener('click', () => this._paneel.querySelector('#tcc-np-file-input').click());

        // Textarea
        this._textarea.addEventListener('input', () => this._onTextareaInput());
        this._textarea.addEventListener('keydown', (e) => this._onTextareaKeydown(e));

        // Verzenden
        this._paneel.querySelector('#tcc-np-send')
            .addEventListener('click', () => this._verzendNotitie());

        // File input
        this._paneel.querySelector('#tcc-np-file-input')
            .addEventListener('change', (e) => this._onFileSelect(e));

        // Klik buiten mention dropdown / contextmenu
        document.addEventListener('click', (e) => {
            if (!this._paneel.contains(e.target)) this._sluitMentionDropdown();
        });

        // Contextmenu acties (event delegation op feed)
        this._feed.addEventListener('click', (e) => {
            const item = e.target.closest('.tcc-np-menu-item');
            if (!item) return;
            e.stopPropagation();
            const { action, id } = item.dataset;
            if (action === 'np-kopieren')  this._kopierenNotitie(id);
            if (action === 'np-markeer')   showTccToast('Binnenkort beschikbaar', 'info');
            if (action === 'np-verwijder') this._verwijderNotitie(id);
        });
    }

    // ────────────────────────────────────────────────────────────────────
    // OPEN / SLUIT PANEEL
    // ────────────────────────────────────────────────────────────────────

    _togglePaneel() {
        if (this._paneel.classList.contains('is-open')) {
            this._sluitPaneel();
        } else {
            this._openPaneel();
        }
    }

    _openPaneel() {
        this._paneel.classList.add('is-open');
        this._toggleBtn.classList.add('is-active');
        this._tccBody.classList.add('notities-open');
        // Scrollen naar onder in feed
        setTimeout(() => this._scrollFeedToBottom(), 50);
    }

    _sluitPaneel() {
        this._paneel.classList.remove('is-open');
        this._toggleBtn.classList.remove('is-active');
        this._tccBody.classList.remove('notities-open');
    }

    // ────────────────────────────────────────────────────────────────────
    // LABEL SELECTIE
    // ────────────────────────────────────────────────────────────────────

    _toggleLabel(btn) {
        const label = btn.dataset.label;
        const wasActive = btn.classList.contains(`is-active--${label}`);

        // Deactiveer alle
        this._paneel.querySelectorAll('.tcc-np-label-btn').forEach(b => {
            b.className = 'tcc-np-label-btn';
        });

        if (wasActive) {
            this._activeLabel = null;
        } else {
            btn.classList.add(`is-active--${label}`);
            this._activeLabel = label;
        }

        // Actie-hint tonen/verbergen
        this._actieHint.classList.toggle('is-visible', this._activeLabel === 'actie');
    }

    // ────────────────────────────────────────────────────────────────────
    // TOOLBAR
    // ────────────────────────────────────────────────────────────────────

    _toggleBold() {
        this._boldActive = !this._boldActive;
        this._paneel.querySelector('#tcc-np-btn-bold')
            .classList.toggle('is-active', this._boldActive);
        // Voeg **...** markdown-hint toe in textarea op cursor
        if (this._boldActive) {
            this._insertTextAtCursor('**', '**');
        }
    }

    _toggleBullets() {
        this._bulletsActive = !this._bulletsActive;
        this._paneel.querySelector('#tcc-np-btn-bullets')
            .classList.toggle('is-active', this._bulletsActive);
        if (this._bulletsActive) {
            this._insertTextAtCursor('\n- ', '');
        }
    }

    _insertTextAtCursor(before, after) {
        const ta = this._textarea;
        const start = ta.selectionStart;
        const end   = ta.selectionEnd;
        const val   = ta.value;
        ta.value = val.substring(0, start) + before + val.substring(start, end) + after + val.substring(end);
        ta.selectionStart = ta.selectionEnd = start + before.length;
        ta.focus();
        this._onTextareaInput();
    }

    // ────────────────────────────────────────────────────────────────────
    // TEXTAREA — input & keydown
    // ────────────────────────────────────────────────────────────────────

    _onTextareaInput() {
        const val = this._textarea.value;
        const sendBtn = this._paneel.querySelector('#tcc-np-send');
        sendBtn.disabled = val.trim().length === 0;

        // Auto-resize
        this._textarea.style.height = 'auto';
        this._textarea.style.height = Math.min(this._textarea.scrollHeight, 120) + 'px';

        // @mention detectie
        const cursor = this._textarea.selectionStart;
        const textToCursor = val.substring(0, cursor);
        const mentionMatch = textToCursor.match(/@(\w*)$/);

        if (mentionMatch) {
            this._mentionQuery = mentionMatch[1].toLowerCase();
            this._mentionStart = cursor - mentionMatch[0].length;
            this._openMentionDropdown();
        } else {
            this._sluitMentionDropdown();
        }
    }

    _onTextareaKeydown(e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this._verzendNotitie();
            return;
        }

        // Enter zonder Shift verstuurt de notitie (tenzij mention dropdown open is)
        if (e.key === 'Enter' && !e.shiftKey && !this._mentionOpen) {
            e.preventDefault();
            this._verzendNotitie();
            return;
        }

        // Navigeer mention dropdown met pijltjes
        if (this._mentionOpen) {
            const items = this._mentionDropdown.querySelectorAll('.tcc-np-mention-item');
            const active = this._mentionDropdown.querySelector('.tcc-np-mention-item.is-selected');
            const idx    = active ? Array.from(items).indexOf(active) : -1;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = items[(idx + 1) % items.length];
                active?.classList.remove('is-selected');
                next?.classList.add('is-selected');
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = items[(idx - 1 + items.length) % items.length];
                active?.classList.remove('is-selected');
                prev?.classList.add('is-selected');
            } else if (e.key === 'Enter' || e.key === 'Tab') {
                const sel = this._mentionDropdown.querySelector('.tcc-np-mention-item.is-selected')
                         || items[0];
                if (sel) {
                    e.preventDefault();
                    this._selectMention(sel.dataset.naam, sel.dataset.userId);
                }
            } else if (e.key === 'Escape') {
                this._sluitMentionDropdown();
            }
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // @MENTION DROPDOWN
    // ────────────────────────────────────────────────────────────────────

    _openMentionDropdown() {
        const gefilterd = this._teamleden.filter(t =>
            t.naam.toLowerCase().includes(this._mentionQuery)
        );

        if (gefilterd.length === 0) {
            this._mentionDropdown.innerHTML = `
                <div class="tcc-np-mention-empty">
                    ${this._teamleden.length === 0
                        ? 'Geen teamleden gekoppeld aan deze tender. Voeg eerst teamleden toe via de Team tab.'
                        : 'Geen teamleden gevonden voor "' + this._mentionQuery + '".'
                    }
                </div>
            `;
            this._mentionDropdown.classList.add('is-open');
            this._mentionOpen = true;
            return;
        }

        this._mentionDropdown.innerHTML = gefilterd.map(t => `
            <div class="tcc-np-mention-item"
                 data-naam="${t.naam}"
                 data-user-id="${t.userId}">
                <div class="tcc-np-avatar" style="background:${this._avatarKleurHex(t.naam)}">
                    ${this._initialen(t.naam)}
                </div>
                <span>${t.naam}</span>
            </div>
        `).join('');

        this._mentionDropdown.querySelectorAll('.tcc-np-mention-item').forEach(item => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._selectMention(item.dataset.naam, item.dataset.userId);
            });
        });

        this._mentionDropdown.classList.add('is-open');
        this._mentionOpen = true;
    }

    _sluitMentionDropdown() {
        this._mentionDropdown.classList.remove('is-open');
        this._mentionOpen = false;
    }

    _selectMention(naam, userId) {
        const ta  = this._textarea;
        const val = ta.value;
        // Vervang @query door @Naam
        const voor  = val.substring(0, this._mentionStart);
        const na    = val.substring(ta.selectionStart);
        ta.value    = voor + `@${naam} ` + na;
        const pos   = voor.length + naam.length + 2;
        ta.selectionStart = ta.selectionEnd = pos;
        this._sluitMentionDropdown();
        ta.focus();
        this._onTextareaInput();

        // Bewaar mention voor verzenden
        if (!this._pendingMentions) this._pendingMentions = [];
        this._pendingMentions.push({ naam, userId });
    }

    // ────────────────────────────────────────────────────────────────────
    // BIJLAGE
    // ────────────────────────────────────────────────────────────────────

    _onFileSelect(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        // Sla tijdelijk op voor bij verzenden
        this._pendingBijlagen = files;

        // Toon preview in textarea placeholder
        const namen = files.map(f => f.name).join(', ');
        this._textarea.placeholder = `📎 ${namen}`;
        this._paneel.querySelector('#tcc-np-send').disabled = false;
    }

    // ────────────────────────────────────────────────────────────────────
    // NOTITIE VERZENDEN
    // ────────────────────────────────────────────────────────────────────

    async _verzendNotitie() {
        const inhoud = this._textarea.value.trim();
        if (!inhoud && !this._pendingBijlagen?.length) return;

        const sendBtn = this._paneel.querySelector('#tcc-np-send');
        sendBtn.disabled = true;

        // Mentions extraheren uit tekst
        const mentionMatches = [...inhoud.matchAll(/@(\w+)/g)];
        const mentions = this._pendingMentions?.filter(m =>
            mentionMatches.some(match => match[1] === m.naam.split(' ')[0])
        ) || [];

        // Bijlagen uploaden via Supabase Storage
        let bijlagen = [];
        if (this._pendingBijlagen?.length) {
            bijlagen = await this._uploadBijlagen(this._pendingBijlagen);
        }

        // Notitie opslaan in DB
        const notitie = await this._slaNotitieOp({
            inhoud,
            label: this._activeLabel || 'notitie',
            mentions,
            bijlagen
        });

        if (notitie) {
            // Als label = actie EN er zijn mentions → taak aanmaken
            if (this._activeLabel === 'actie' && mentions.length > 0) {
                await this._maakProjectplanningTaak(notitie, mentions, inhoud);
            }

            // UI updaten
            this._notities.push(notitie);
            this._renderNotitie(notitie);
            this._updateBadges();
            this._scrollFeedToBottom();
        }

        // Invoer resetten
        this._resetInvoer();
    }

    async _slaNotitieOp({ inhoud, label, mentions, bijlagen }) {
        try {
            const sb = window.supabaseClient || window.supabase;
            const { data, error } = await sb
                .from('tender_notities')
                .insert({
                    tender_id:       this._tenderId,
                    tenderbureau_id: this._tenderData?.tenderbureau_id,
                    auteur_id:       this._currentUserId,
                    inhoud,
                    label,
                    mentions:  JSON.stringify(mentions),
                    bijlagen:  JSON.stringify(bijlagen)
                })
                .select('*')
                .single();

            if (error) throw error;

            const naam = this._currentUser?.naam
                || this._currentUser?.full_name
                || (this._currentUser?.email ? this._currentUser.email.split('@')[0] : 'Ik');

            return this._enrichNotitieMetUser(data, {
                naam,
                email: this._currentUser?.email || '',
                initialen: this._currentUser?.initialen || this._initialen(naam),
                avatar_kleur: this._currentUser?.avatar_kleur || '#667eea'
            });
        } catch (err) {
            console.error('[TCC_TabNotities] Fout bij opslaan notitie:', err);
            // Optimistische UI: toon toch lokaal
            const email = this._currentUser?.email || '';
            const naam  = this._currentUser?.naam
                || this._currentUser?.full_name
                || (email ? email.split('@')[0] : 'Ik');
            return {
                id: crypto.randomUUID(),
                inhoud,
                label,
                mentions,
                bijlagen,
                created_at: new Date().toISOString(),
                auteur_naam: naam,
                auteur_initialen: this._currentUser?.initialen || this._initialen(naam),
                auteur_kleur: 'purple',
                _lokaal: true
            };
        }
    }

    async _uploadBijlagen(files) {
        const sb = window.supabaseClient || window.supabase;
        const bijlagen = [];
        for (const file of files) {
            try {
                const pad = `notities/${this._tenderId}/${Date.now()}_${file.name}`;
                const { data, error } = await sb.storage
                    .from('tender-documenten')
                    .upload(pad, file, { upsert: false });
                if (!error) {
                    bijlagen.push({
                        pad,
                        naam: file.name,
                        grootte: file.size,
                        type: file.type
                    });
                }
            } catch {}
        }
        return bijlagen;
    }

    // ────────────────────────────────────────────────────────────────────
    // ACTIE → PROJECTPLANNING TAAK
    // ────────────────────────────────────────────────────────────────────

    async _maakProjectplanningTaak(notitie, mentions, inhoud) {
        try {
            // Eerste gementionde persoon wordt verantwoordelijke
            const verantwoordelijke = mentions[0];

            // Taaknaam = eerste 80 tekens van notitietekst (zonder @mentions)
            const taaknaam = (inhoud
                .replace(/@\S+/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .substring(0, 80) || 'Actie uit notitie')
                + (inhoud.length > 80 ? '…' : '');

            const sb = window.supabaseClient || window.supabase;
            const { data: taak, error } = await sb
                .from('planning_taken')
                .insert({
                    tender_id:       this._tenderId,
                    tenderbureau_id: this._tenderData?.tenderbureau_id,
                    taak_naam:       taaknaam,
                    categorie:       'notitie',
                    status:          'todo',
                    toegewezen_aan:  verantwoordelijke?.userId ? [verantwoordelijke.userId] : [],
                    volgorde:        0,
                    is_milestone:    false
                })
                .select()
                .single();

            if (error) throw error;

            // Notitie updaten met taak-koppeling
            await sb
                .from('tender_notities')
                .update({ actie_taak_id: taak.id })
                .eq('id', notitie.id);

            notitie.actie_taak_id  = taak.id;
            notitie.actie_taak_naam = taaknaam;
            notitie.actie_taak_persoon = verantwoordelijke.naam;

            console.log('[TCC_TabNotities] Projectplanning taak aangemaakt:', taak.id);

            console.log('[TCC_TabNotities] refresh aanroepen:', typeof _refreshNaDownstream);
            if (typeof window._refreshNaDownstream === 'function') {
                await window._refreshNaDownstream(['projectplanning']);
            }
        } catch (err) {
            console.error('[TCC_TabNotities] Fout bij aanmaken taak:', err);
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // DATA LADEN
    // ────────────────────────────────────────────────────────────────────

    async _loadNotities() {
        try {
            const sb = window.supabaseClient || window.supabase;

            // Stap 1: notities ophalen zonder auteur join
            const { data, error } = await sb
                .from('tender_notities')
                .select('*')
                .eq('tender_id', this._tenderId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Stap 2: unieke auteur_ids verzamelen
            const auteurIds = [...new Set((data || []).map(n => n.auteur_id))];

            // Stap 3: gebruikersdata ophalen uit public.users
            let gebruikers = {};
            if (auteurIds.length > 0) {
                const { data: users } = await sb
                    .from('users')
                    .select('id, naam, email, initialen, avatar_kleur')
                    .in('id', auteurIds);

                (users || []).forEach(u => { gebruikers[u.id] = u; });
            }

            this._notities = (data || []).map(n =>
                this._enrichNotitieMetUser(n, gebruikers[n.auteur_id])
            );

        } catch (err) {
            console.error('[TCC_TabNotities] Fout bij laden notities:', err);
            this._notities = [];
        }

        this._renderFeed();
        this._updateBadges();
    }

    async _loadTeamleden() {
        try {
            const sb = window.supabaseClient || window.supabase;
            const { data, error } = await sb
                .from('tender_team_assignments')
                .select('user_id, users(id, naam, email, initialen)')
                .eq('tender_id', this._tenderId);

            if (error) throw error;

            this._teamleden = (data || [])
                .filter(t => t.users)
                .map(t => ({
                    userId: t.user_id,
                    naam:   t.users?.naam
                        || (t.users?.email ? t.users.email.split('@')[0] : 'Onbekend')
                }))
                .filter(t => t.userId !== this._currentUserId);

        } catch {
            this._teamleden = [];
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // RENDER
    // ────────────────────────────────────────────────────────────────────

    _renderFeed() {
        if (this._notities.length === 0) {
            this._feed.innerHTML = `
                <div class="tcc-np-empty">
                    <div class="tcc-np-empty-icon">${this._icon('clipboardList', '#94a3b8', 36)}</div>
                    <div class="tcc-np-empty-title">Nog geen notities</div>
                    <div class="tcc-np-empty-desc">Voeg een notitie toe om de samenwerking bij te houden.</div>
                </div>`;
            return;
        }

        this._feed.innerHTML = '';
        let vorigeDatumKey = null;
        this._notities.forEach(n => {
            const datumKey = n.created_at
                ? new Date(n.created_at).toDateString()
                : null;
            if (datumKey && datumKey !== vorigeDatumKey) {
                this._renderDatumScheiding(n.created_at);
                vorigeDatumKey = datumKey;
            }
            this._renderNotitie(n);
        });
    }

    _renderNotitie(notitie) {
        this._feed.querySelector('.tcc-np-empty')?.remove();

        const isEigen = notitie.auteur_id === this._currentUserId;
        const isActie = notitie.label === 'actie';
        const naamLabel = isEigen ? 'Jij' : (notitie.auteur_naam || 'Onbekend');

        const row = document.createElement('div');
        row.className = 'tcc-np-row' + (isEigen ? ' tcc-np-row--own' : '');
        row.dataset.id = notitie.id;

        // ── Contextmenu items ──
        const verwijderMenuHtml = isEigen ? `
            <div class="tcc-np-menu-sep"></div>
            <div class="tcc-np-menu-item tcc-np-menu-item--danger"
                 data-action="np-verwijder" data-id="${notitie.id}">
                ${tccIcon('trash', 13)} Verwijderen
            </div>` : '';

        // ── Bijlagen ──
        const bijlagenHtml = (notitie.bijlagen || []).map(b => `
            <div class="tcc-np-bijlage">
                <div class="tcc-np-bijlage-icon">${tccIcon('fileText', 14)}</div>
                <div class="tcc-np-bijlage-info">
                    <div class="tcc-np-bijlage-naam">${this._esc(b.naam)}</div>
                    <div class="tcc-np-bijlage-grootte">${this._formatBestandsgrootte(b.grootte)}</div>
                </div>
            </div>
        `).join('');

        const taakBadgeHtml = notitie.actie_taak_id ? `
            <div class="tcc-np-taak-badge">
                ${tccIcon('checkCircle', 11, '#16a34a')}
                Taak aangemaakt voor ${this._esc(notitie.actie_taak_persoon || 'teamlid')}
            </div>` : '';

        const actieBadgeHtml = isActie
            ? `<span class="tcc-np-actie-badge">Actie</span>` : '';

        row.innerHTML = `
            <div class="tcc-np-av-wrap">
                <div class="tcc-np-av" style="background:${notitie.auteur_kleur}">
                    ${notitie.auteur_initialen}
                </div>
                <div class="tcc-np-menu">
                    <div class="tcc-np-menu-item" data-action="np-kopieren" data-id="${notitie.id}">
                        ${tccIcon('copy', 13)} Kopiëren
                    </div>
                    <div class="tcc-np-menu-item tcc-np-menu-item--star"
                         data-action="np-markeer" data-id="${notitie.id}">
                        ${tccIcon('star', 13)} Markeer als belangrijk
                    </div>
                    ${verwijderMenuHtml}
                </div>
            </div>
            <div class="tcc-np-bubble">
                <div class="tcc-np-meta">
                    <span class="tcc-np-naam">${this._esc(naamLabel)}</span>
                    <span class="tcc-np-tijd">${this._formatTijd(notitie.created_at)}</span>
                    ${actieBadgeHtml}
                </div>
                <div class="tcc-np-card ${isEigen ? 'tcc-np-card--own' : 'tcc-np-card--other'}">
                    ${this._renderInhoud(notitie.inhoud)}
                    ${bijlagenHtml}
                    ${taakBadgeHtml}
                </div>
            </div>
        `;

        this._feed.appendChild(row);
    }

    /** Render notitietekst: @mentions → paars, **bold** → <strong> */
    _renderInhoud(tekst) {
        if (!tekst) return '';
        return this._esc(tekst)
            // @mentions
            .replace(/@(\w+)/g, '<span class="tcc-np-mention">@$1</span>')
            // **bold**
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Bullets: regels die beginnen met "- "
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            // Newlines naar <br>
            .replace(/\n/g, '<br>');
    }

    // ────────────────────────────────────────────────────────────────────
    // BADGES UPDATEN
    // ────────────────────────────────────────────────────────────────────

    _updateBadges() {
        const count = this._notities.length;

        if (this._countBadge) {
            this._countBadge.textContent = count;
        }
        if (this._toggleBadge) {
            this._toggleBadge.textContent = count;
            this._toggleBadge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // RESET INVOER
    // ────────────────────────────────────────────────────────────────────

    _resetInvoer() {
        this._textarea.value     = '';
        this._textarea.style.height = 'auto';
        this._updateTextareaPlaceholder();
        this._pendingMentions    = [];
        this._pendingBijlagen    = null;
        this._boldActive         = false;
        this._bulletsActive      = false;
        this._activeLabel        = null;
        this._actieHint.classList.remove('is-visible');

        this._paneel.querySelector('#tcc-np-actie-toggle').classList.remove('is-active');
        this._paneel.querySelector('#tcc-np-btn-bold').classList.remove('is-active');
        this._paneel.querySelector('#tcc-np-send').disabled = true;

        // File input resetten
        this._paneel.querySelector('#tcc-np-file-input').value = '';
    }

    // ────────────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────────────

    _updateTextareaPlaceholder() {
        if (!this._textarea) return;
        if (this._pendingBijlagen?.length) return; // bijlage preview actief — niet overschrijven
        this._textarea.placeholder = this._teamleden.length > 0
            ? 'Schrijf een notitie… typ @ om iemand te taggen'
            : 'Schrijf een notitie… (voeg teamleden toe via Team tab om @ te gebruiken)';
    }

    _enrichNotitieMetUser(n, user) {
        const naam = user?.naam
            || (user?.email ? user.email.split('@')[0] : null)
            || 'Onbekend';
        const initialen = user?.initialen || this._initialen(naam);
        const kleur = user?.avatar_kleur || this._avatarKleurHex(naam);

        return {
            ...n,
            bijlagen: typeof n.bijlagen === 'string' ? JSON.parse(n.bijlagen) : (n.bijlagen || []),
            mentions: typeof n.mentions === 'string' ? JSON.parse(n.mentions) : (n.mentions || []),
            auteur_naam:      naam,
            auteur_initialen: initialen,
            auteur_kleur:     kleur   // hex waarde voor inline style
        };
    }

    _cssKleurNaarNaam(hex) {
        const map = {
            '#667eea': 'purple', '#7c3aed': 'purple',
            '#16a34a': 'green',  '#0d9488': 'teal',
            '#2563eb': 'blue',   '#ea580c': 'orange',
            '#db2777': 'pink'
        };
        return map[hex] || this._avatarKleur('');
    }

    _initialen(naam) {
        if (!naam) return '?';
        return naam.split(' ')
            .slice(0, 2)
            .map(w => w[0]?.toUpperCase() || '')
            .join('');
    }

    _avatarKleur(naam) {
        const colors = TCC_TabNotities.AVATAR_COLORS;
        let hash = 0;
        for (let i = 0; i < (naam || '').length; i++) {
            hash = naam.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    }

    _avatarKleurHex(naam) {
        const hexColors = ['#7c3aed', '#16a34a', '#ea580c', '#2563eb', '#0d9488', '#db2777'];
        let hash = 0;
        for (let i = 0; i < (naam || '').length; i++) {
            hash = naam.charCodeAt(i) + ((hash << 5) - hash);
        }
        return hexColors[Math.abs(hash) % hexColors.length];
    }

    _labelNaam(label) {
        const map = { intern: 'Intern', klant: 'Klant', actie: 'Actie' };
        return map[label] || label;
    }

    _formatTijd(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    }

    _datumLabel(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        const nu = new Date();
        const vandaag   = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
        const gisteren  = new Date(vandaag);
        gisteren.setDate(gisteren.getDate() - 1);
        const dag = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (dag.getTime() === vandaag.getTime())  return 'Vandaag';
        if (dag.getTime() === gisteren.getTime()) return 'Gisteren';
        const maanden = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
        return `${d.getDate()} ${maanden[d.getMonth()]} ${d.getFullYear()}`;
    }

    _renderDatumScheiding(iso) {
        const label = this._datumLabel(iso);
        console.log('[TCC_TabNotities] datumscheiding:', label);
        const el = document.createElement('div');
        el.className = 'tcc-np-datum-scheiding';
        el.innerHTML = `<span>${this._esc(label)}</span>`;
        this._feed.appendChild(el);
    }

    _kopierenNotitie(id) {
        const notitie = this._notities.find(n => n.id === id);
        if (!notitie?.inhoud) return;
        navigator.clipboard.writeText(notitie.inhoud)
            .then(() => showTccToast('Gekopieerd', 'success'))
            .catch(() => showTccToast('Kopiëren mislukt', 'error'));
    }

    async _verwijderNotitie(id) {
        const notitie = this._notities.find(n => n.id === id);
        if (!notitie) return;

        const bevestiging = notitie.actie_taak_id
            ? 'Notitie verwijderen?\n\nLet op: de bijbehorende taak in de projectplanning blijft bestaan.'
            : 'Notitie verwijderen?';

        if (!confirm(bevestiging)) return;

        try {
            const sb = window.supabaseClient || window.supabase;
            const { error } = await sb
                .from('tender_notities')
                .delete()
                .eq('id', id);
            if (error) throw error;

            this._notities = this._notities.filter(n => n.id !== id);
            this._renderFeed();
            this._updateBadges();
        } catch (err) {
            console.error('[TCC_TabNotities] Fout bij verwijderen notitie:', err);
        }
    }

    _formatBestandsgrootte(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    _scrollFeedToBottom() {
        if (this._feed) {
            this._feed.scrollTop = this._feed.scrollHeight;
        }
    }

    _esc(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _icon(naam, kleur = 'currentColor', grootte = 16) {
        const fn = window.Icons?.[naam];
        if (typeof fn === 'function') return fn({ color: kleur, size: grootte });
        // Fallback: generieke SVG dot
        return `<svg width="${grootte}" height="${grootte}" viewBox="0 0 24 24"
            fill="none" stroke="${kleur}" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/></svg>`;
    }
}

// ── Exporteer voor gebruik in TCC_Core ───────────────────────────────────
window.TCC_TabNotities = TCC_TabNotities;