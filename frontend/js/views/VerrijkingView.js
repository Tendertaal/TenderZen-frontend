/**
 * VerrijkingView.js — Website Verrijking Dashboard
 * Non-module global (window.VerrijkingView), mount/unmount interface.
 */

class VerrijkingView {
    constructor() {
        this._container = null;
        this._pollTimer = null;
        this._page = 1;
        this._perPage = 50;
        this._statusFilter = '';
        this._zoek = '';
        this._totaalBedrijven = 0;
        this._baseUrl = window.API_CONFIG?.BASE_URL || window.CONFIG?.api || '';
    }

    // ── Lifecycle ────────────────────────────────────────────

    mount(container) {
        this._container = container;
        container.innerHTML = '';
        container.appendChild(this._render());
        this._laadStats();
        this._laadBedrijven();
        this._laadBulkStatus();
        this._startPoll();
    }

    unmount() {
        this._stopPoll();
        if (this._container) {
            this._container.innerHTML = '';
            this._container = null;
        }
    }

    // ── Polling ──────────────────────────────────────────────

    _startPoll() {
        this._stopPoll();
        this._pollTimer = setInterval(() => {
            this._laadBulkStatus();
            this._laadStats();
        }, 3000);
    }

    _stopPoll() {
        if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
        }
    }

    // ── Render ───────────────────────────────────────────────

    _render() {
        const div = document.createElement('div');
        div.className = 'vv-container';
        div.innerHTML = `
            <div class="vv-header">
                <h1 class="vv-title">Website Verrijking</h1>
                <div class="vv-header-actions">
                    <button class="vv-btn vv-btn-primary" id="vv-bulk-start">
                        Bulk starten
                    </button>
                    <button class="vv-btn vv-btn-danger" id="vv-bulk-stop" disabled>
                        Stop
                    </button>
                    <button class="vv-btn vv-btn-secondary" id="vv-refresh">
                        Verversen
                    </button>
                </div>
            </div>

            <!-- Stats -->
            <div class="vv-stats-grid" id="vv-stats-grid">
                <div class="vv-stat-card">
                    <span class="vv-stat-label">Totaal bedrijven</span>
                    <span class="vv-stat-value" id="vv-stat-totaal">—</span>
                </div>
                <div class="vv-stat-card accent-green">
                    <span class="vv-stat-label">Verrijkt</span>
                    <span class="vv-stat-value" id="vv-stat-verrijkt">—</span>
                </div>
                <div class="vv-stat-card accent-red">
                    <span class="vv-stat-label">Geen website</span>
                    <span class="vv-stat-value" id="vv-stat-geen">—</span>
                </div>
                <div class="vv-stat-card accent-amber">
                    <span class="vv-stat-label">Scrape mislukt</span>
                    <span class="vv-stat-value" id="vv-stat-mislukt">—</span>
                </div>
                <div class="vv-stat-card">
                    <span class="vv-stat-label">Niet verrijkt</span>
                    <span class="vv-stat-value" id="vv-stat-onverrijkt">—</span>
                </div>
            </div>

            <!-- Bulk job progress -->
            <div class="vv-bulk-panel" id="vv-bulk-panel" style="display:none">
                <div class="vv-bulk-title">
                    <span class="vv-spinner" id="vv-bulk-spinner"></span>
                    <span id="vv-bulk-label">Bulk job actief</span>
                </div>
                <div class="vv-bulk-meta" id="vv-bulk-meta"></div>
                <div class="vv-progress-bar-bg">
                    <div class="vv-progress-bar-fill" id="vv-progress-fill" style="width:0%"></div>
                </div>
                <div class="vv-log-panel">
                    <div class="vv-log-title">Logboek</div>
                    <div class="vv-log-body" id="vv-log-body"></div>
                </div>
            </div>

            <!-- Filters -->
            <div class="vv-filter-bar">
                <select id="vv-filter-status">
                    <option value="">Alle statussen</option>
                    <option value="niet_verrijkt">Niet verrijkt</option>
                    <option value="verrijkt">Verrijkt</option>
                    <option value="geen_website">Geen website</option>
                    <option value="scrape_mislukt">Scrape mislukt</option>
                </select>
                <input type="text" id="vv-zoek" placeholder="Zoek op naam of stad..." />
                <button class="vv-btn vv-btn-secondary" id="vv-zoek-btn">Zoeken</button>
            </div>

            <!-- Table -->
            <div class="vv-table-wrap">
                <table class="vv-table">
                    <thead>
                        <tr>
                            <th>Bedrijfsnaam</th>
                            <th>Stad</th>
                            <th>Branche</th>
                            <th>Website</th>
                            <th>Status</th>
                            <th>Verrijkt op</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="vv-tbody"></tbody>
                </table>
                <div class="vv-pagination" id="vv-pagination"></div>
            </div>
        `;

        // Events
        // Naam-link delegatie op de statische table-wrap (één keer per mount)
        div.querySelector('.vv-table-wrap').addEventListener('click', (e) => {
            const naamLink = e.target.closest('.vv-naam-link');
            if (naamLink) {
                const bedrijfId = naamLink.dataset.bedrijfId;
                if (bedrijfId && window.BedrijfsprofielModal) {
                    window.BedrijfsprofielModal.open(bedrijfId);
                }
            }
        });

        div.querySelector('#vv-bulk-start').addEventListener('click', () => this._bulkStart());
        div.querySelector('#vv-bulk-stop').addEventListener('click',  () => this._bulkStop());
        div.querySelector('#vv-refresh').addEventListener('click',    () => {
            this._laadStats();
            this._laadBedrijven();
            this._laadBulkStatus();
        });
        div.querySelector('#vv-filter-status').addEventListener('change', (e) => {
            this._statusFilter = e.target.value;
            this._page = 1;
            this._laadBedrijven();
        });
        div.querySelector('#vv-zoek-btn').addEventListener('click', () => {
            this._zoek = div.querySelector('#vv-zoek').value.trim();
            this._page = 1;
            this._laadBedrijven();
        });
        div.querySelector('#vv-zoek').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this._zoek = e.target.value.trim();
                this._page = 1;
                this._laadBedrijven();
            }
        });

        return div;
    }

    // ── API calls ────────────────────────────────────────────

    async _fetch(path, opts = {}) {
        const token = await this._getToken();
        const res = await fetch(`${this._baseUrl}${path}`, {
            ...opts,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                ...(opts.headers || {}),
            },
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`${res.status}: ${text}`);
        }
        return res.json();
    }

    async _getToken() {
        try {
            const supabase = window.supabase?.createClient
                ? null
                : window._supabaseClient;
            // Try window.getSupabase() (config.js export)
            if (window.getSupabase) {
                const sb = window.getSupabase();
                const { data: { session } } = await sb.auth.getSession();
                return session?.access_token || '';
            }
        } catch (e) { /* fall through */ }
        return '';
    }

    async _laadStats() {
        try {
            const data = await this._fetch('/api/v1/verrijking/statistieken');
            this._setText('vv-stat-totaal',    data.totaal     ?? '—');
            this._setText('vv-stat-verrijkt',   data.verrijkt   ?? '—');
            this._setText('vv-stat-geen',       data.geen_website ?? '—');
            this._setText('vv-stat-mislukt',    data.scrape_mislukt ?? '—');
            this._setText('vv-stat-onverrijkt', data.niet_verrijkt ?? '—');
        } catch (e) {
            console.error('[VerrijkingView] stats fout:', e);
        }
    }

    async _laadBedrijven() {
        const params = new URLSearchParams({
            pagina: this._page,
            per_pagina: this._perPage,
        });
        if (this._statusFilter) params.set('status', this._statusFilter);
        if (this._zoek)         params.set('zoek', this._zoek);

        const tbody = document.getElementById('vv-tbody');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7" class="vv-empty">Laden...</td></tr>';

        try {
            const data = await this._fetch(`/api/v1/verrijking/bedrijven?${params}`);
            this._totaalBedrijven = data.totaal || 0;
            this._renderTabel(data.bedrijven || []);
            this._renderPaginatie(data.totaal || 0, data.pagina || 1);
        } catch (e) {
            console.error('[VerrijkingView] bedrijven fout:', e);
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="vv-empty">Fout: ${e.message}</td></tr>`;
        }
    }

    async _laadBulkStatus() {
        try {
            const data = await this._fetch('/api/v1/verrijking/bulk-status');
            this._updateBulkUI(data);
        } catch (e) {
            // Silently ignore — may be 403 if not super-admin
        }
    }

    async _bulkStart() {
        const bevestig = confirm('Bulk verrijking starten voor alle niet-verrijkte bedrijven?');
        if (!bevestig) return;
        try {
            await this._fetch('/api/v1/verrijking/bulk-start', {
                method: 'POST',
                body: JSON.stringify({ alleen_niet_verrijkt: true, ook_mislukte: false }),
            });
            this._laadBulkStatus();
        } catch (e) {
            alert(`Fout bij starten: ${e.message}`);
        }
    }

    async _bulkStop() {
        try {
            await this._fetch('/api/v1/verrijking/bulk-stop', { method: 'POST' });
            this._laadBulkStatus();
        } catch (e) {
            alert(`Fout bij stoppen: ${e.message}`);
        }
    }

    async _verrijkEen(bedrijfId, btn) {
        btn.disabled = true;
        btn.textContent = '...';
        try {
            await this._fetch(`/api/v1/verrijking/bedrijf/${bedrijfId}`, { method: 'POST' });
            this._laadBedrijven();
            this._laadStats();
        } catch (e) {
            alert(`Verrijking mislukt: ${e.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Verrijk';
        }
    }

    // ── Render helpers ───────────────────────────────────────

    _renderTabel(bedrijven) {
        const tbody = document.getElementById('vv-tbody');
        if (!tbody) return;

        if (!bedrijven.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="vv-empty">Geen bedrijven gevonden.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        bedrijven.forEach(b => {
            const tr = document.createElement('tr');
            const statusKlasse = (b.website_status || 'niet_verrijkt').replace(/_/g, '_');
            const datumStr = b.website_verrijkt_op
                ? new Date(b.website_verrijkt_op).toLocaleDateString('nl-NL')
                : '—';
            const websiteLink = b.website
                ? `<a class="vv-website-link" href="${b.website}" target="_blank" rel="noopener">${b.website}</a>`
                : '<span style="color:#94a3b8">—</span>';

            tr.innerHTML = `
                <td><span class="vv-naam-link" data-bedrijf-id="${b.id}">${this._esc(b.bedrijfsnaam || '')}</span></td>
                <td>${this._esc(b.plaats || '')}</td>
                <td>${this._esc(b.branche || '')}</td>
                <td>${websiteLink}</td>
                <td><span class="vv-badge ${statusKlasse}">${this._statusLabel(b.website_status)}</span></td>
                <td>${datumStr}</td>
                <td><button class="vv-btn-verrijk" data-id="${b.id}">Verrijk</button></td>
            `;
            tr.querySelector('.vv-btn-verrijk').addEventListener('click', (e) => {
                this._verrijkEen(b.id, e.target);
            });
            tbody.appendChild(tr);
        });

    }

    _renderPaginatie(totaal, huidigePagina) {
        const el = document.getElementById('vv-pagination');
        if (!el) return;
        const aantalPaginas = Math.ceil(totaal / this._perPage);
        el.innerHTML = `
            <span>${totaal} bedrijven — pagina ${huidigePagina} van ${Math.max(1, aantalPaginas)}</span>
            <div class="vv-pagination-btns">
                <button id="vv-prev" ${huidigePagina <= 1 ? 'disabled' : ''}>&laquo; Vorige</button>
                <button id="vv-next" ${huidigePagina >= aantalPaginas ? 'disabled' : ''}>Volgende &raquo;</button>
            </div>
        `;
        el.querySelector('#vv-prev')?.addEventListener('click', () => {
            if (this._page > 1) { this._page--; this._laadBedrijven(); }
        });
        el.querySelector('#vv-next')?.addEventListener('click', () => {
            if (this._page < aantalPaginas) { this._page++; this._laadBedrijven(); }
        });
    }

    _updateBulkUI(data) {
        const panel   = document.getElementById('vv-bulk-panel');
        const startBtn = document.getElementById('vv-bulk-start');
        const stopBtn  = document.getElementById('vv-bulk-stop');
        const fill     = document.getElementById('vv-progress-fill');
        const meta     = document.getElementById('vv-bulk-meta');
        const label    = document.getElementById('vv-bulk-label');
        const logBody  = document.getElementById('vv-log-body');
        const spinner  = document.getElementById('vv-bulk-spinner');

        if (!panel) return;

        const actief = data.actief;
        panel.style.display = (actief || data.verwerkt > 0) ? '' : 'none';

        if (startBtn) startBtn.disabled = actief;
        if (stopBtn)  stopBtn.disabled  = !actief;
        if (spinner)  spinner.style.display = actief ? '' : 'none';

        const pct = data.totaal > 0 ? Math.round(data.verwerkt / data.totaal * 100) : 0;
        if (fill) fill.style.width = `${pct}%`;

        if (label) label.textContent = actief
            ? `Bulk job actief — ${pct}%`
            : `Bulk job voltooid — ${pct}%`;

        if (meta) {
            const eta = data.eta_seconden > 0
                ? ` — ETA: ~${Math.round(data.eta_seconden)}s`
                : '';
            meta.textContent = `${data.verwerkt}/${data.totaal} verwerkt · `
                + `${data.verrijkt} verrijkt · ${data.mislukt} mislukt${eta}`;
        }

        if (logBody && Array.isArray(data.log)) {
            const wasBottom = logBody.scrollHeight - logBody.scrollTop <= logBody.clientHeight + 5;
            logBody.innerHTML = data.log.map(line => {
                const cls = line.startsWith('[OK]')  ? 'ok'
                          : line.startsWith('[ERR]') ? 'err'
                          : line.startsWith('[WARN]') ? 'warn'
                          : '';
                return `<div class="vv-log-line ${cls}">${this._esc(line)}</div>`;
            }).join('');
            if (wasBottom) logBody.scrollTop = logBody.scrollHeight;
        }
    }

    // ── Utils ────────────────────────────────────────────────

    _setText(id, val) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    _esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _statusLabel(status) {
        const labels = {
            verrijkt:      'Verrijkt',
            niet_verrijkt: 'Niet verrijkt',
            geen_website:  'Geen website',
            scrape_mislukt:'Scrape mislukt',
            bezig:         'Bezig',
        };
        return labels[status] || status || 'Niet verrijkt';
    }
}

window.VerrijkingView = VerrijkingView;
