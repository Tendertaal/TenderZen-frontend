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
        this.shell           = null;
        this.isOpen          = false;
        this.currentTenderId = null;
        this.currentTenderNaam  = null;
        this.currentBureauId = null;
        this.notities        = [];
        this._currentUser    = null;
        this._loadSavedState();
    }

    // ── Publieke API ──────────────────────────────────────────────────────

    init(mountTarget) {
        this._injectStyles();

        this.shell = document.createElement('div');
        this.shell.id = 'np-shell';
        this.shell.className = 'np-shell' + (this.isOpen ? ' np-open' : '');
        this.shell.innerHTML = this._buildHTML();
        document.body.appendChild(this.shell);

        this._attachListeners();
        this._loadCurrentUser();
    }

    setTender(tenderId, tenderNaam, bureauId = null) {
        if (this.currentTenderId === tenderId) return;
        this.currentTenderId   = tenderId;
        this.currentTenderNaam = tenderNaam;
        this.currentBureauId   = bureauId;
        this.notities          = [];

        if (!this.isOpen) {
            this.isOpen = true;
            this._saveState();
            this.shell?.classList.add('np-open');
        }

        this._updatePanelContent();
        this._loadNotities();
    }

    clear() {
        this.currentTenderId   = null;
        this.currentTenderNaam = null;
        this.currentBureauId   = null;
        this.notities          = [];
        this._updatePanelContent();
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
                    .select('id, naam, email, initialen')
                    .in('id', auteurIds);
                (users || []).forEach(u => { gebruikers[u.id] = u; });
            }

            this.notities = (data || []).map(n => ({
                ...n,
                auteur_naam: gebruikers[n.auteur_id]?.naam
                    || (gebruikers[n.auteur_id]?.email?.split('@')[0])
                    || 'Gebruiker'
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
            const { error } = await sb
                .from('tender_notities')
                .insert({
                    tender_id:       this.currentTenderId,
                    tenderbureau_id: this.currentBureauId || this._currentUser?.tenderbureau_id || null,
                    auteur_id:       this._currentUser?.id || null,
                    inhoud:          inhoud.trim(),
                    label:           null,
                    mentions:        JSON.stringify([]),
                    bijlagen:        JSON.stringify([])
                });

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
        return `
            <div class="np-toggle-strip" id="np-toggle-strip">
                <div class="np-toggle-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                </div>
                <span class="np-badge" id="np-badge" style="display:none"></span>
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
                         stroke="#cbd5e1" stroke-width="1.5"
                         stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="np-empty-title">Notities</span>
                    <span class="np-empty-sub">Selecteer een tender<br>om notities te zien</span>
                </div>`;
        }

        return `
            <div class="np-header">
                <div class="np-header-info">
                    <div class="np-header-title">Notities</div>
                    <div class="np-header-tender" title="${this._esc(this.currentTenderNaam || '')}">${this._esc(this.currentTenderNaam || '')}</div>
                </div>
            </div>
            <div class="np-feed" id="np-feed">
                <div class="np-feed-loading">Notities laden…</div>
            </div>
            <div class="np-input-area">
                <textarea class="np-input" id="np-input"
                    placeholder="Schrijf een notitie… (Ctrl+Enter om op te slaan)"
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

    _renderFeed() {
        const feed = this.shell?.querySelector('#np-feed');
        if (!feed) return;

        if (this.notities.length === 0) {
            feed.innerHTML = `
                <div class="np-empty-notes">
                    Nog geen notities voor deze tender.
                </div>`;
            return;
        }

        feed.innerHTML = this.notities.map(n => `
            <div class="np-note${n.label ? ` np-note--${n.label}` : ''}">
                <div class="np-note-header">
                    <span class="np-note-author">${this._esc(n.auteur_naam || 'Gebruiker')}</span>
                    ${n.label ? `<span class="np-note-label np-note-label--${n.label}">${this._labelTekst(n.label)}</span>` : ''}
                </div>
                <div class="np-note-text">${this._renderInhoud(n.inhoud || '')}</div>
                <div class="np-note-time">${this._formatDate(n.created_at)}</div>
            </div>`).join('');

        feed.scrollTop = feed.scrollHeight;
    }

    _updateBadge() {
        const badge = this.shell?.querySelector('#np-badge');
        if (!badge) return;
        if (this.notities.length > 0) {
            badge.textContent = this.notities.length;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
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

        this.shell?.querySelector('#np-input')
            ?.addEventListener('keydown', e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    this._submitInput();
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
/* ── Shell: fixed aan de rechterkant ── */
#np-shell {
    position: fixed;
    right: 0;
    top: 0;
    height: 100vh;
    z-index: 500;
    display: flex;
    flex-direction: row;
    align-items: stretch;
    pointer-events: none;
}

/* ── Toggle strip (altijd zichtbaar) ── */
.np-toggle-strip {
    width: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 72px;
    cursor: pointer;
    background: #fff;
    border-left: 1px solid #e2e8f0;
    pointer-events: all;
    position: relative;
    flex-shrink: 0;
    transition: background .12s;
}
.np-toggle-strip:hover { background: #f8fafc; }
#np-shell.np-open .np-toggle-strip { border-left-color: #6366f1; }

.np-toggle-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: #94a3b8;
    transition: color .12s, background .12s;
}
.np-toggle-strip:hover .np-toggle-icon,
#np-shell.np-open .np-toggle-icon {
    color: #6366f1;
    background: #eef2ff;
}

.np-badge {
    min-width: 18px;
    height: 18px;
    background: #6366f1;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    margin-top: 4px;
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

/* ── Header ── */
.np-header {
    padding: 14px 14px 10px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    background: #fafbff;
}
.np-header-title {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    font-family: 'DM Sans', sans-serif;
}
.np-header-tender {
    font-size: 11px;
    color: #6366f1;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
    font-family: 'DM Sans', sans-serif;
}

/* ── Feed ── */
.np-feed {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
}
.np-feed::-webkit-scrollbar { width: 4px; }
.np-feed::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }
.np-feed-loading {
    font-size: 12px;
    color: #94a3b8;
    text-align: center;
    padding: 20px;
    font-family: 'DM Sans', sans-serif;
}

/* ── Notitie kaart ── */
.np-note {
    background: #f8fafc;
    border-radius: 8px;
    padding: 9px 11px;
    border-left: 3px solid #6366f1;
}
.np-note--intern { border-left-color: #6366f1; }
.np-note--klant  { border-left-color: #0891b2; }
.np-note--actie  { border-left-color: #d97706; }

.np-note-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
}
.np-note-author {
    font-size: 11px;
    font-weight: 600;
    color: #4338ca;
    font-family: 'DM Sans', sans-serif;
}
.np-note-label {
    font-size: 10px;
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
}
.np-note-label--intern { background: #eef2ff; color: #4338ca; }
.np-note-label--klant  { background: #ecfeff; color: #0e7490; }
.np-note-label--actie  { background: #fef3c7; color: #92400e; }

.np-note-text {
    font-size: 12px;
    color: #1e293b;
    line-height: 1.5;
    font-family: 'DM Sans', sans-serif;
    word-break: break-word;
}
.np-mention { color: #6366f1; font-weight: 600; }
.np-note-time {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 5px;
    font-family: 'DM Sans', sans-serif;
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
    padding: 24px 16px;
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
    color: #94a3b8;
    font-family: 'DM Sans', sans-serif;
}
.np-empty-sub {
    font-size: 12px;
    color: #cbd5e1;
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
