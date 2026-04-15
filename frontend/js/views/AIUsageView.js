/**
 * AIUsageView — Super Admin only
 * Toont AI token verbruik per bureau → tender → individuele calls
 * Huisstijl: DM Sans, #1e293b tekst, #6366f1 accenten, #e2e8f0 borders
 */
export class AIUsageView {

    constructor() {
        this.container = null;
        this.currentView = 'bureau';
        this.overzicht = [];
        this.expandedBureaus = new Set();
        this.expandedTenders = new Set();
    }

    // ── mount/unmount interface (compatibel met App.js views dict) ──

    mount(container) {
        this.container = container;
        this._loadData().then(() => this._render());
    }

    unmount() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    async init(container) {
        this.container = container;
        await this._loadData();
        this._render();
    }

    // ── Data ──

    async _loadData() {
        const baseURL = window.API_CONFIG?.BASE_URL || '';
        const token = await this._getToken();
        try {
            const res = await fetch(`${baseURL}/api/v1/ai-usage/overzicht`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            this.overzicht = json.data || [];
        } catch (e) {
            console.error('❌ AIUsageView: fout bij laden overzicht', e);
            this.overzicht = [];
        }
    }

    async _loadCalls(tenderId) {
        const baseURL = window.API_CONFIG?.BASE_URL || '';
        const token = await this._getToken();
        try {
            const res = await fetch(`${baseURL}/api/v1/ai-usage/calls?tender_id=${tenderId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return json.data || [];
        } catch (e) {
            console.error('❌ AIUsageView: fout bij laden calls', e);
            return [];
        }
    }

    async _loadAllCalls() {
        const baseURL = window.API_CONFIG?.BASE_URL || '';
        const token = await this._getToken();
        try {
            const res = await fetch(`${baseURL}/api/v1/ai-usage/calls`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            return json.data || [];
        } catch (e) {
            console.error('❌ AIUsageView: fout bij laden alle calls', e);
            return [];
        }
    }

    async _getToken() {
        try {
            const supabase = window.supabaseClient || window.supabase;
            const { data: { session } } = await supabase.auth.getSession();
            return session?.access_token || '';
        } catch (e) {
            console.error('❌ AIUsageView: kon token niet ophalen', e);
            return '';
        }
    }

    // ── Render ──

    _render() {
        if (!this.container) return;
        const byBureau = this._groupByBureau();
        const totals = this._calcTotals();
        this.container.innerHTML = `
            <div class="aiu-page">
                ${this._renderTopbar()}
                ${this._renderSummaryCards(totals)}
                <div id="aiu-view-bureau" class="${this.currentView === 'bureau' ? '' : 'aiu-hidden'}">
                    ${this._renderBureauView(byBureau)}
                </div>
                <div id="aiu-view-dag" class="${this.currentView === 'dag' ? '' : 'aiu-hidden'}">
                    <div class="aiu-dag-loading">Dag-overzicht laden...</div>
                </div>
            </div>
        `;
        this._attachListeners();

        if (this.currentView === 'dag') {
            this._loadAndRenderDagView();
        }
    }

    _renderTopbar() {
        return `
            <div class="aiu-topbar">
                <div class="aiu-title">
                    <div class="aiu-title-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                        </svg>
                    </div>
                    AI token verbruik
                </div>
                <div class="aiu-view-toggle">
                    <button class="aiu-vt-btn ${this.currentView === 'bureau' ? 'active' : ''}" data-view="bureau">Per bureau</button>
                    <button class="aiu-vt-btn ${this.currentView === 'dag' ? 'active' : ''}" data-view="dag">Per dag</button>
                </div>
            </div>
        `;
    }

    _renderSummaryCards(totals) {
        return `
            <div class="aiu-summary-grid">
                <div class="aiu-scard">
                    <div class="aiu-scard-label">Totaal input tokens</div>
                    <div class="aiu-scard-val">${totals.input_tokens.toLocaleString('nl-NL')}</div>
                    <div class="aiu-scard-sub">deze maand</div>
                </div>
                <div class="aiu-scard">
                    <div class="aiu-scard-label">Totaal output tokens</div>
                    <div class="aiu-scard-val">${totals.output_tokens.toLocaleString('nl-NL')}</div>
                    <div class="aiu-scard-sub">deze maand</div>
                </div>
                <div class="aiu-scard">
                    <div class="aiu-scard-label">AI calls</div>
                    <div class="aiu-scard-val">${totals.calls}</div>
                    <div class="aiu-scard-sub">deze maand</div>
                </div>
                <div class="aiu-scard">
                    <div class="aiu-scard-label">Geschatte kosten</div>
                    <div class="aiu-scard-val">€ ${totals.kosten.toFixed(2).replace('.', ',')}</div>
                    <div class="aiu-scard-sub">deze maand</div>
                </div>
            </div>
        `;
    }

    _renderBureauView(byBureau) {
        if (!byBureau || Object.keys(byBureau).length === 0) {
            return `<div class="aiu-empty">Geen AI calls gevonden.</div>`;
        }
        return Object.entries(byBureau).map(([bureauNaam, tenders]) => {
            const bureauId = tenders[0]?.bureau_id;
            const bureauTokens = tenders.reduce((s, t) => s + (t.totaal_input_tokens || 0) + (t.totaal_output_tokens || 0), 0);
            const bureauKosten = tenders.reduce((s, t) => s + parseFloat(t.totaal_kosten_eur || 0), 0);
            const isOpen = this.expandedBureaus.has(bureauId);
            return `
                <div class="aiu-bureau-block">
                    <div class="aiu-bureau-header" data-bureau-id="${bureauId}">
                        <svg class="aiu-chevron ${isOpen ? 'open' : ''}" viewBox="0 0 16 16" fill="none">
                            <path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="aiu-bureau-dot"></span>
                        <span class="aiu-bureau-name">${bureauNaam}</span>
                        <span class="aiu-bureau-meta">${tenders.length} tenders &nbsp;·&nbsp; ${bureauTokens.toLocaleString('nl-NL')} tokens &nbsp;·&nbsp; € ${bureauKosten.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="aiu-bureau-body ${isOpen ? '' : 'aiu-hidden'}">
                        <table class="aiu-tender-table">
                            <thead><tr>
                                <th>Tender</th><th>Bedrijf</th><th>Calls</th>
                                <th>Input tokens</th><th>Output tokens</th>
                                <th>Kosten</th><th>Laatste call</th>
                            </tr></thead>
                            <tbody>${tenders.map(t => this._renderTenderRow(t)).join('')}</tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }

    _renderTenderRow(tender) {
        const isOpen = this.expandedTenders.has(tender.tender_id);
        const datum = tender.laatste_call
            ? new Date(tender.laatste_call).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : '—';
        return `
            <tr class="aiu-tender-row ${isOpen ? 'active' : ''}" data-tender-id="${tender.tender_id}">
                <td>${tender.tender_naam || '—'}</td>
                <td class="aiu-muted">${tender.bedrijfsnaam || '—'}</td>
                <td>${tender.aantal_calls || 0}</td>
                <td class="aiu-mono">${(tender.totaal_input_tokens || 0).toLocaleString('nl-NL')}</td>
                <td class="aiu-mono">${(tender.totaal_output_tokens || 0).toLocaleString('nl-NL')}</td>
                <td>€ ${parseFloat(tender.totaal_kosten_eur || 0).toFixed(2).replace('.', ',')}</td>
                <td class="aiu-muted">${datum}</td>
            </tr>
            <tr class="${isOpen ? '' : 'aiu-hidden'}">
                <td colspan="7">
                    <div class="aiu-detail-panel" id="aiu-detail-panel-${tender.tender_id}">
                        <div class="aiu-detail-loading">Calls laden...</div>
                    </div>
                </td>
            </tr>
        `;
    }

    _renderCallList(calls) {
        if (!calls || calls.length === 0) return '<div class="aiu-empty">Geen calls gevonden.</div>';
        return `
            <div class="aiu-call-head">
                <span>Datum</span><span>Type</span><span>Model</span>
                <span>Input</span><span>Output</span><span>Kosten</span>
            </div>
            ${calls.map(c => {
                const datum = new Date(c.aangemaakt_op).toLocaleDateString('nl-NL', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                });
                return `
                    <div class="aiu-call-row">
                        <span class="aiu-muted">${datum}</span>
                        <span>${this._typeBadge(c.call_type)}</span>
                        <span>${this._modelBadge(c.model)}</span>
                        <span class="aiu-mono">${(c.input_tokens || 0).toLocaleString('nl-NL')}</span>
                        <span class="aiu-mono">${(c.output_tokens || 0).toLocaleString('nl-NL')}</span>
                        <span class="aiu-muted">€ ${parseFloat(c.kosten_eur || 0).toFixed(3).replace('.', ',')}</span>
                    </div>
                `;
            }).join('')}
        `;
    }

    async _loadAndRenderDagView() {
        const calls = await this._loadAllCalls();
        const byDag = {};
        for (const c of calls) {
            const dag = new Date(c.aangemaakt_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
            if (!byDag[dag]) byDag[dag] = [];
            byDag[dag].push(c);
        }

        const html = Object.entries(byDag).map(([dag, dagCalls]) => {
            const dagKosten = dagCalls.reduce((s, c) => s + parseFloat(c.kosten_eur || 0), 0);
            return `
                <div class="aiu-dag-block">
                    <div class="aiu-dag-header">
                        <span class="aiu-dag-label">${dag}</span>
                        <span class="aiu-dag-total">${dagCalls.length} calls &nbsp;·&nbsp; € ${dagKosten.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="aiu-dag-head">
                        <span>Tender</span><span>Bedrijf</span><span>Bureau</span><span>Type</span><span>Model</span><span>Output tokens</span><span>Kosten</span>
                    </div>
                    ${dagCalls.map(c => `
                        <div class="aiu-dag-row">
                            <span>${c.tender_naam || '—'}</span>
                            <span class="aiu-muted">${c.bedrijfsnaam || '—'}</span>
                            <span class="aiu-muted">${c.bureau_naam || '—'}</span>
                            <span>${this._typeBadge(c.call_type)}</span>
                            <span>${this._modelBadge(c.model)}</span>
                            <span class="aiu-mono">${(c.output_tokens || 0).toLocaleString('nl-NL')}</span>
                            <span class="aiu-muted">€ ${parseFloat(c.kosten_eur || 0).toFixed(3).replace('.', ',')}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }).join('');

        const dagContainer = this.container?.querySelector('#aiu-view-dag');
        if (dagContainer) dagContainer.innerHTML = html || '<div class="aiu-empty">Geen calls gevonden.</div>';
    }

    // ── Badges ──

    _typeBadge(type) {
        const map = {
            'smart_import': ['aiu-badge-import', 'Smart Import'],
            'ai_generatie': ['aiu-badge-gen',    'AI Generatie'],
            'backplanning': ['aiu-badge-plan',    'Backplanning'],
        };
        const [cls, label] = map[type] || ['aiu-badge-import', type || '—'];
        return `<span class="aiu-badge ${cls}">${label}</span>`;
    }

    _modelBadge(model) {
        const isHaiku  = model?.includes('haiku');
        const isSonnet = model?.includes('sonnet');
        const cls   = isHaiku ? 'aiu-badge-haiku' : 'aiu-badge-sonnet';
        const label = isHaiku ? 'Haiku' : isSonnet ? 'Sonnet' : (model || '—');
        return `<span class="aiu-badge ${cls}">${label}</span>`;
    }

    // ── Helpers ──

    _groupByBureau() {
        const grouped = {};
        for (const item of this.overzicht) {
            const naam = item.bureau_naam || item.bureau_id || 'Onbekend bureau';
            if (!grouped[naam]) grouped[naam] = [];
            grouped[naam].push(item);
        }
        return grouped;
    }

    _calcTotals() {
        return this.overzicht.reduce((acc, t) => ({
            input_tokens:  acc.input_tokens  + (t.totaal_input_tokens  || 0),
            output_tokens: acc.output_tokens + (t.totaal_output_tokens || 0),
            calls:         acc.calls         + (t.aantal_calls         || 0),
            kosten:        acc.kosten        + parseFloat(t.totaal_kosten_eur || 0),
        }), { input_tokens: 0, output_tokens: 0, calls: 0, kosten: 0 });
    }

    // ── Event listeners ──

    _attachListeners() {
        if (!this.container) return;

        this.container.querySelectorAll('.aiu-vt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentView = btn.dataset.view;
                this._render();
            });
        });

        this.container.querySelectorAll('.aiu-bureau-header').forEach(header => {
            header.addEventListener('click', () => {
                const id = header.dataset.bureauId;
                if (this.expandedBureaus.has(id)) this.expandedBureaus.delete(id);
                else this.expandedBureaus.add(id);
                this._render();
            });
        });

        this.container.querySelectorAll('.aiu-tender-row').forEach(row => {
            row.addEventListener('click', async () => {
                const tenderId = row.dataset.tenderId;
                if (this.expandedTenders.has(tenderId)) {
                    this.expandedTenders.delete(tenderId);
                    this._render();
                    return;
                }
                this.expandedTenders.add(tenderId);
                this._render();
                const panel = this.container.querySelector(`#aiu-detail-panel-${tenderId}`);
                if (panel) {
                    const calls = await this._loadCalls(tenderId);
                    panel.innerHTML = this._renderCallList(calls);
                }
            });
        });
    }
}
