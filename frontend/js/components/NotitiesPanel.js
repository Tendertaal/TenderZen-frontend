/* ============================================================
   NotitiesPanel.js — Globaal persistent notities paneel
   TenderZen v1.0 — 2026-04-16

   Staat rechts in de applicatie (position:fixed), zichtbaar
   in alle views. Toont notities van de actief geselecteerde tender.

   Data: direct via Supabase (geen REST endpoint voor notities).
   Tabel: tender_notities — veld: inhoud (niet tekst)

   Gebruik:
     window.notitiesPanel = new NotitiesPanel();
     window.notitiesPanel.init(document.body);
     window.notitiesPanel.setTender(tenderId, tenderNaam, tenderbureauid);
     window.notitiesPanel.clear();
   ============================================================ */

class NotitiesPanel {

    constructor() {
        this.shell                  = null;
        this.isOpen                 = false;
        this.currentTenderId        = null;
        this.currentTenderNaam      = null;
        this.currentBureauId        = null;
        this.currentBedrijfNaam     = null;
        this.currentOpdrachtgever   = null;
        this.currentTeamleden       = [];
        this.currentUserId          = null;
        this.notities               = [];
        this._currentUser           = null;
        this._loadSavedState();
    }

    // ── Publieke API ──────────────────────────────────────────────────────

    async init(mountTarget) {
        this._injectStyles();

        this.shell = document.createElement('div');
        this.shell.id = 'np-shell';
        this.shell.className = 'np-shell' + (this.isOpen ? ' np-open' : '');
        this.shell.innerHTML = this._buildHTML();
        (document.getElementById('tz-app-layout') || document.body).appendChild(this.shell);

        this._attachListeners();

        // Zet currentUserId synchroon via session (snel) zodat het beschikbaar is
        // voor de isEigen check nog vóór _loadCurrentUser() klaar is
        try {
            const sb = window.supabaseClient || window.supabase;
            const { data: { session } } = await sb.auth.getSession();
            if (session?.user?.id) this.currentUserId = session.user.id;
        } catch {}

        this._loadCurrentUser();
    }

    setTender(tenderId, tenderNaam, bureauId = null, bedrijfNaam = null, teamleden = [], opdrachtgever = null) {
        if (this.currentTenderId === tenderId) return;
        this.currentTenderId        = tenderId;
        this.currentTenderNaam      = tenderNaam;
        this.currentBureauId        = bureauId;
        this.currentBedrijfNaam     = bedrijfNaam;
        this.currentOpdrachtgever   = opdrachtgever;
        this.currentTeamleden       = teamleden;
        this.notities           = [];

        localStorage.setItem('tz_last_tender', JSON.stringify({
            tenderId, tenderNaam, bureauId, bedrijfNaam
        }));

        this._updatePanelContent();
        this._loadNotities();
    }

    restoreLastTender() {
        try {
            const saved = localStorage.getItem('tz_last_tender');
            if (!saved) return;
            const { tenderId, tenderNaam, bureauId, bedrijfNaam } = JSON.parse(saved);
            if (tenderId && tenderNaam) {
                this.setTender(tenderId, tenderNaam, bureauId, bedrijfNaam, []);
            }
        } catch (e) {
            console.warn('[NotitiesPanel] Kon laatste tender niet herstellen:', e);
        }
    }

    clear() {
        this.currentTenderId        = null;
        this.currentTenderNaam      = null;
        this.currentBureauId        = null;
        this.currentBedrijfNaam     = null;
        this.currentOpdrachtgever   = null;
        this.currentTeamleden       = [];
        this.notities               = [];
        this._updatePanelContent();
        this._updateBadge();
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this._saveState();
        this.shell?.classList.toggle('np-open', this.isOpen);
        if (this.isOpen && this.currentTenderId) {
            this._loadNotities();
        }
    }

    // ── Data ─────────────────────────────────────────────────────────────

    async _loadCurrentUser() {
        try {
            const sb = window.supabaseClient || window.supabase;
            const { data: { user } } = await sb.auth.getUser();
            if (!user) return;
            this.currentUserId = user.id;
            const { data } = await sb
                .from('users')
                .select('id, naam, email, initialen, avatar_kleur, tenderbureau_id')
                .eq('id', user.id)
                .single();
            this._currentUser = data || { id: user.id, email: user.email };
        } catch {}
    }

    async _loadNotities() {
        if (!this.currentTenderId) return;

        const feed = this.shell?.querySelector('#np-feed');
        if (feed) feed.innerHTML = '<div class="np-feed-loading">Notities laden…</div>';

        try {
            const sb = window.supabaseClient || window.supabase;

            const { data, error } = await sb
                .from('tender_notities')
                .select('*')
                .eq('tender_id', this.currentTenderId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Auteursnamen ophalen
            const auteurIds = [...new Set((data || []).map(n => n.auteur_id).filter(Boolean))];
            let gebruikers = {};
            if (auteurIds.length > 0) {
                const { data: users } = await sb
                    .from('users')
                    .select('id, naam, email, initialen, avatar_kleur')
                    .in('id', auteurIds);
                (users || []).forEach(u => { gebruikers[u.id] = u; });
            }

            this.notities = (data || []).map(n => ({
                ...n,
                auteur_naam: gebruikers[n.auteur_id]?.naam
                    || (gebruikers[n.auteur_id]?.email?.split('@')[0])
                    || 'Gebruiker',
                avatar_kleur: gebruikers[n.auteur_id]?.avatar_kleur || null
            }));

        } catch (e) {
            console.error('[NotitiesPanel] Laden mislukt:', e);
            this.notities = [];
        }

        this._renderFeed();
        this._updateBadge();
    }

    async _saveNotitie(inhoud) {
        if (!this.currentTenderId || !inhoud.trim()) return;

        const sendBtn = this.shell?.querySelector('#np-send');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const sb = window.supabaseClient || window.supabase;

            const payload = {
                tender_id:       this.currentTenderId,
                tenderbureau_id: this.currentBureauId || this._currentUser?.tenderbureau_id || null,
                auteur_id:       this.currentUserId || this._currentUser?.id || null,
                inhoud:          inhoud.trim(),
                label:           'notitie',
                mentions:        JSON.stringify([]),
                bijlagen:        JSON.stringify([])
            };
            const { error } = await sb
                .from('tender_notities')
                .insert(payload)
                .select('*')
                .single();

            if (error) throw error;
            await this._loadNotities();

        } catch (e) {
            console.error('[NotitiesPanel] Opslaan mislukt:', e);
        } finally {
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    // ── Render ───────────────────────────────────────────────────────────

    _buildHTML() {
        const toggleBadge = this.notities.length > 0
            ? `<span class="np-badge" id="np-badge">${this.notities.length}</span>`
            : `<span class="np-badge" id="np-badge" style="display:none"></span>`;
        return `
            <div class="np-toggle-strip" id="np-toggle-strip">
                <div class="np-toggle-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    ${toggleBadge}
                </div>
            </div>
            <div class="np-panel" id="np-panel">
                ${this._buildPanelContent()}
            </div>`;
    }

    _buildPanelContent() {
        if (!this.currentTenderId) {
            return `
                <div class="np-empty-state">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                         stroke="#6366f1" stroke-width="1.5"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="np-empty-title">Notities</span>
                    <span class="np-empty-sub">Selecteer een tender<br>om notities te zien</span>
                </div>`;
        }

        const badge = this.notities.length > 0
            ? `<span class="np-count-badge">${this.notities.length}</span>`
            : '';
        return `
            <div class="np-topbar">
                <span class="np-topbar-title">Notities</span>
                ${badge}
            </div>
            <div class="np-tender-block">
                <p class="np-tender-naam">${this._esc(this.currentTenderNaam || '')}</p>
                ${this.currentOpdrachtgever ? `
                <div class="np-tender-row">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="#94a3b8" stroke-width="1.75"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" x2="8" y1="13" y2="13"/>
                        <line x1="16" x2="8" y1="17" y2="17"/>
                        <line x1="10" x2="8" y1="9" y2="9"/>
                    </svg>
                    <span class="np-opdrachtgever">${this._esc(this.currentOpdrachtgever)}</span>
                </div>` : ''}
                ${this.currentBedrijfNaam ? `
                <div class="np-tender-row" style="margin-bottom:10px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="#6366f1" stroke-width="1.75"
                         stroke-linecap="round" stroke-linejoin="round">
                        <rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
                        <path d="M9 22v-4h6v4"/>
                        <path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/>
                        <path d="M12 10h.01"/><path d="M12 14h.01"/>
                        <path d="M16 10h.01"/><path d="M16 14h.01"/>
                        <path d="M8 10h.01"/><path d="M8 14h.01"/>
                    </svg>
                    <span class="np-inschrijver">${this._esc(this.currentBedrijfNaam)}</span>
                </div>` : ''}
                <div class="np-avatars">${this._renderAvatarsHTML()}</div>
            </div>
            <div class="np-notities" id="np-feed">
                <div class="np-feed-loading">Notities laden…</div>
            </div>
            <div class="np-input-area">
                <textarea class="np-input" id="np-input"
                    placeholder="Schrijf een notitie… (Shift+Enter voor nieuwe regel)"
                    rows="3"></textarea>
                <button class="np-send-btn" id="np-send">Toevoegen</button>
            </div>`;
    }

    _updatePanelContent() {
        const panel = this.shell?.querySelector('#np-panel');
        if (!panel) return;
        panel.innerHTML = this._buildPanelContent();
        this._attachInputListeners();
    }

    _renderAvatarsHTML() {
        if (!this.currentTeamleden || this.currentTeamleden.length === 0) return '';
        const paarsShades = ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'];
        return this.currentTeamleden.slice(0, 4).map((lid, i) => {
            const initialen = lid.initialen || (lid.naam || '??').substring(0, 2).toUpperCase();
            const kleur = lid.avatar_kleur || paarsShades[i % paarsShades.length];
            const marginLeft = i === 0 ? '0' : '-7px';
            const zIndex = 4 - i;
            return `<div class="np-avatar" title="${this._esc(lid.naam || '')}" style="background:${kleur};margin-left:${marginLeft};z-index:${zIndex};">${initialen}</div>`;
        }).join('');
    }

    _renderFeed() {
        const feed = this.shell?.querySelector('#np-feed');
        if (!feed) return;
        feed.innerHTML = this._renderNotitiesHTML();
        feed.scrollTop = feed.scrollHeight;
    }

    _renderNotitiesHTML() {
        if (this.notities.length === 0) {
            return `<div class="np-empty-notes"><span>Nog geen notities voor deze tender</span></div>`;
        }

        return this.notities.map(n => {
            const isEigen = n.auteur_id === this.currentUserId;

            const naam = n.auteur_naam || 'Gebruiker';
            const initialen = naam.substring(0, 2).toUpperCase();
            const avatarKleur = n.avatar_kleur || (isEigen ? '#6366f1' : '#64748b');

            const tijd = this._formatDate(n.created_at || '');
            const tekst = this._esc(n.inhoud || '').replace(/\n/g, '<br>');

            if (isEigen) {
                return `
                <div class="np-msg np-msg-eigen">
                    <div class="np-msg-avatar" style="background:${avatarKleur};">${initialen}</div>
                    <div class="np-msg-content-wrap np-msg-content-wrap-eigen">
                        <div class="np-msg-naam np-msg-naam-eigen">${this._esc(naam)}</div>
                        <div class="np-msg-bubbel np-msg-bubbel-eigen">
                            <div class="np-msg-tekst">${tekst}</div>
                            <div class="np-msg-tijd">${tijd}</div>
                        </div>
                    </div>
                </div>`;
            } else {
                return `
                <div class="np-msg np-msg-ander">
                    <div class="np-msg-avatar" style="background:${avatarKleur};">${initialen}</div>
                    <div class="np-msg-content-wrap">
                        <div class="np-msg-naam">${this._esc(naam)}</div>
                        <div class="np-msg-bubbel np-msg-bubbel-ander">
                            <div class="np-msg-tekst">${tekst}</div>
                            <div class="np-msg-tijd">${tijd}</div>
                        </div>
                    </div>
                </div>`;
            }
        }).join('');
    }

    _updateBadge() {
        const count = this.notities ? this.notities.length : 0;
        const label = count > 99 ? '99+' : count;

        const badge = this.shell?.querySelector('#np-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = label;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }

        const topbarBadge = this.shell?.querySelector('.np-count-badge');
        if (topbarBadge) {
            if (count > 0) {
                topbarBadge.textContent = label;
                topbarBadge.style.display = '';
            } else {
                topbarBadge.style.display = 'none';
            }
        }
    }

    // ── Event listeners ──────────────────────────────────────────────────

    _attachListeners() {
        this.shell?.querySelector('#np-toggle-strip')
            ?.addEventListener('click', () => this.toggle());
        this._attachInputListeners();
    }

    _attachInputListeners() {
        this.shell?.querySelector('#np-send')
            ?.addEventListener('click', () => this._submitInput());

        const textarea = this.shell?.querySelector('#np-input');
        textarea?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const tekst = textarea.value.trim();
                if (tekst) {
                    this._saveNotitie(tekst);
                    textarea.value = '';
                }
            }
        });
    }

    _submitInput() {
        const input = this.shell?.querySelector('#np-input');
        const val = input?.value?.trim();
        if (!val) return;
        input.value = '';
        this._saveNotitie(val);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    _labelTekst(label) {
        return { intern: 'Intern', klant: 'Klant', actie: 'Actie' }[label] || label;
    }

    _renderInhoud(tekst) {
        return this._esc(tekst)
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/@(\w+)/g, '<span class="np-mention">@$1</span>')
            .replace(/\n/g, '<br>');
    }

    _formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            if (isToday) {
                return `Vandaag ${d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
            }
            return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch { return dateStr; }
    }

    _esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _loadSavedState() {
        this.isOpen = localStorage.getItem('tz_notities_panel_open') === 'true';
    }

    _saveState() {
        localStorage.setItem('tz_notities_panel_open', this.isOpen);
    }

    // ── CSS ──────────────────────────────────────────────────────────────

    _injectStyles() {
        if (document.getElementById('np-styles')) return;
        const style = document.createElement('style');
        style.id = 'np-styles';
        style.textContent = `
/* ── Shell: flex-child aan de rechterkant ── */
#np-shell {
    flex-shrink: 0;
    height: 100%;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    pointer-events: none;
}

/* ── Toggle strip (altijd zichtbaar) ── */
.np-toggle-strip {
    width: 48px;
    min-width: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 12px;
    cursor: pointer;
    background: linear-gradient(180deg, #eef2ff 0%, #f5f3ff 100%);
    border-left: 1px solid #c7d2fe;
    pointer-events: all;
    position: relative;
    flex-shrink: 0;
    transition: background .12s;
}
.np-toggle-strip:hover { background: #e0e7ff; }
#np-shell.np-open .np-toggle-strip { border-left-color: #6366f1; }

.np-toggle-icon {
    position: relative;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    padding: 0;
    background: #6366f1;
    color: #ffffff;
    transition: color .12s, background .12s;
}
.np-toggle-strip svg { stroke: #ffffff; width: 16px; height: 16px; }
.np-toggle-strip:hover svg { stroke: #ffffff; }
.np-toggle-strip:hover .np-toggle-icon,
#np-shell.np-open .np-toggle-icon {
    background: #4f46e5;
    color: #ffffff;
}

.np-badge {
    position: absolute;
    top: -8px;
    right: -8px;
    min-width: 18px;
    height: 18px;
    background: #dc2626;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border-radius: 9px;
    border: 2px solid #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    line-height: 1;
    pointer-events: none;
    z-index: 10;
}

/* ── Panel (schuift open) ── */
.np-panel {
    width: 0;
    overflow: hidden;
    background: #fff;
    border-left: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    transition: width .22s cubic-bezier(.4,0,.2,1);
    pointer-events: none;
}
#np-shell.np-open .np-panel {
    width: 280px;
    pointer-events: all;
}

/* ── Topbar ── */
.np-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: linear-gradient(to bottom, #eef2ff, #f5f3ff);
    border-bottom: 0.5px solid #e0e7ff;
    flex-shrink: 0;
}
.np-topbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.np-chat-icon {
    width: 24px;
    height: 24px;
    background: #6366f1;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.np-topbar-title {
    font-size: 13px;
    font-weight: 500;
    color: #0f172a;
    font-family: 'DM Sans', sans-serif;
}
.np-count-badge {
    font-size: 11px;
    color: #6366f1;
    background: #eef2ff;
    border: 0.5px solid #c7d2fe;
    border-radius: 10px;
    padding: 2px 8px;
    font-weight: 500;
    font-family: 'DM Sans', sans-serif;
}

/* ── Tenderblok ── */
.np-tender-block {
    padding: 12px 14px;
    border-bottom: 0.5px solid #e2e8f0;
    flex-shrink: 0;
}
.np-tender-naam {
    font-size: 13px;
    font-weight: 500;
    color: #0f172a;
    margin: 0 0 8px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-family: 'DM Sans', sans-serif;
}
.np-tender-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
}
.np-opdrachtgever {
    font-size: 11px;
    color: #64748b;
    font-family: 'DM Sans', sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.np-inschrijver {
    font-size: 11px;
    font-weight: 500;
    color: #6366f1;
    font-family: 'DM Sans', sans-serif;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ── Avatars ── */
.np-avatars {
    display: flex;
    align-items: center;
}
.np-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 500;
    color: #ffffff;
    position: relative;
    font-family: 'DM Sans', sans-serif;
    flex-shrink: 0;
}

/* ── Notities feed (chat-stijl) ── */
.np-notities {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
}
.np-notities::-webkit-scrollbar { width: 4px; }
.np-notities::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
.np-feed-loading {
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
    padding: 20px;
    font-family: 'DM Sans', sans-serif;
}
.np-msg {
    display: flex;
    align-items: flex-start;
    gap: 7px;
}
.np-msg-eigen {
    flex-direction: row-reverse;
}
.np-msg-avatar {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 500;
    color: #ffffff;
    margin-top: 2px;
    font-family: 'DM Sans', sans-serif;
}
.np-msg-content-wrap {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}
.np-msg-content-wrap-eigen {
    align-items: flex-end;
}
.np-msg-naam {
    font-size: 10px;
    color: #94a3b8;
    margin-bottom: 3px;
    font-family: 'DM Sans', sans-serif;
}
.np-msg-naam-eigen {
    text-align: right;
}
.np-msg-bubbel {
    padding: 8px 10px;
    max-width: 100%;
}
.np-msg-bubbel-ander {
    background: #f1f5f9;
    border-radius: 0 8px 8px 8px;
}
.np-msg-bubbel-eigen {
    background: #eef2ff;
    border-radius: 8px 0 8px 8px;
}
.np-msg-tekst {
    font-size: 12px;
    color: #1e293b;
    line-height: 1.4;
    font-family: 'DM Sans', sans-serif;
    word-break: break-word;
}
.np-msg-bubbel-eigen .np-msg-tekst {
    color: #3730a3;
}
.np-msg-tijd {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 4px;
    font-family: 'DM Sans', sans-serif;
}
.np-msg-bubbel-eigen .np-msg-tijd {
    color: #818cf8;
}

/* ── Lege states ── */
.np-empty-notes {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    font-size: 12px;
    text-align: center;
    padding: 20px;
    font-family: 'DM Sans', sans-serif;
    line-height: 1.5;
}
.np-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 16px;
    text-align: center;
}
.np-empty-title {
    font-size: 13px;
    font-weight: 600;
    color: #4338ca;
    font-family: 'DM Sans', sans-serif;
}
.np-empty-sub {
    font-size: 12px;
    color: #6366f1;
    line-height: 1.6;
    font-family: 'DM Sans', sans-serif;
}

/* ── Input gebied ── */
.np-input-area {
    padding: 10px 12px;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
    background: #fafbff;
}
.np-input {
    width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    resize: none;
    outline: none;
    color: #1e293b;
    background: #fff;
    transition: border-color .12s;
    box-sizing: border-box;
}
.np-input:focus { border-color: #6366f1; }
.np-send-btn {
    width: 100%;
    margin-top: 6px;
    background: #6366f1;
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 7px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background .12s;
}
.np-send-btn:hover:not(:disabled) { background: #4f46e5; }
.np-send-btn:disabled { opacity: .6; cursor: default; }
        `;
        document.head.appendChild(style);
    }
}

window.NotitiesPanel = NotitiesPanel;
