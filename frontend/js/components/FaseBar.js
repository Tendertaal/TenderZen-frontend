/**
 * FaseBar.js — Multi-select fase filter balk voor TenderZen
 *
 * Events (op document):
 *   'fasebar:filterChange'  { detail: { fases: null | string[] } }
 *       null = alle fases tonen; string[] = alleen deze fases tonen
 *   'fasebar:search'        { detail: { query: string } }
 *
 * Publieke API:
 *   faseBar.updateCounts(counts)  — update badge-aantallen per fase
 */

class FaseBar {
    constructor() {
        this._selectedFases = new Set();
        this._counts = {};
        this._searchTimeout = null;
        this._element = null;
    }

    // ─── Fase definities ─────────────────────────────────────

    get _fases() {
        return [
            { id: 'acquisitie',     label: 'Acquisitie' },
            { id: 'inschrijvingen', label: 'Inschrijvingen' },
            { id: 'ingediend',      label: 'Ingediend' },
            { id: 'evaluatie',      label: 'Afronden' },
            { id: 'archief',        label: 'Archief' },
        ];
    }

    // Kleurpalet per fase — delegeert naar centrale FaseKleuren config
    _kleur(faseId) {
        const fk = window.FaseKleuren ? window.FaseKleuren.get(faseId) : null;
        if (fk) {
            return {
                tabBg:        fk.bg,
                tabText:      fk.kleur,
                badgeBg:      fk.badgeBg,
                badgeText:    fk.badgeTekst,
                activeBadgeBg: fk.badgeActiveBg,
            };
        }
        // Noodvallback als FaseKleuren nog niet geladen is
        return { tabBg: '#f8fafc', tabText: '#64748b', badgeBg: '#f8fafc', badgeText: '#64748b', activeBadgeBg: '#64748b' };
    }

    // ─── Render ─────────────────────────────────────────────

    render() {
        const bar = document.createElement('div');
        bar.className = 'tz-fasebar';
        bar.innerHTML = this._buildHTML();
        this._element = bar;
        this._attachHandlers();
        this._updateTabStates();
        return bar;
    }

    _datumHTML() {
        const now = new Date();
        const dagen   = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
        const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        const tekst = `${dagen[now.getDay()]} ${now.getDate()} ${maanden[now.getMonth()]}`;
        const icon = (window.Icons && typeof window.Icons.calendar === 'function')
            ? window.Icons.calendar({ size: 14, color: '#64748b' })
            : '';
        return `<div class="tz-fasebar-datum">${icon}<span class="tz-fasebar-datum-text">${tekst}</span></div>`;
    }

    _buildHTML() {
        const tabs = this._fases.map(f => {
            const count = this._counts[f.id] || 0;
            const isActive = this._selectedFases.has(f.id);
            const k = this._kleur(f.id);
            const badgeStyle = `background:${k.activeBadgeBg};color:#fff`;
            const badge = count > 0
                ? `<span class="tz-fasebar-count" style="${badgeStyle}">${count}</span>`
                : '';
            const activeStyle = isActive ? `background:${k.tabBg};color:${k.tabText};font-weight:500` : '';
            return `<button class="tz-fasebar-tab${isActive ? ' active' : ''}" data-fase="${f.id}" style="${activeStyle}">${f.label}${badge}</button>`;
        }).join('');

        return `
            ${this._datumHTML()}
            <div class="tz-fasebar-tabs">${tabs}</div>
            <div class="tz-fasebar-right">
                <div class="tz-fasebar-search">
                    <svg class="tz-fasebar-search-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    <input class="tz-fasebar-search-input" type="text" placeholder="Zoek tenders...">
                    <button class="tz-fasebar-search-clear" style="display:none" title="Zoekopdracht wissen">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // ─── Event handlers ─────────────────────────────────────

    _attachHandlers() {
        if (!this._element) return;

        // Fase tab clicks — multi-select toggle
        this._element.querySelectorAll('.tz-fasebar-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const fase = btn.dataset.fase;
                if (this._selectedFases.has(fase)) {
                    this._selectedFases.delete(fase);
                } else {
                    this._selectedFases.add(fase);
                    // Alle 5 geselecteerd → reset naar geen (= toon alles)
                    if (this._selectedFases.size === this._fases.length) {
                        this._selectedFases.clear();
                    }
                }
                this._updateTabStates();
                this._dispatchFilterChange();
            });
        });

        // Zoekveld — debounced 300ms
        const input = this._element.querySelector('.tz-fasebar-search-input');
        const clearBtn = this._element.querySelector('.tz-fasebar-search-clear');

        if (input) {
            input.addEventListener('input', () => {
                clearTimeout(this._searchTimeout);
                const query = input.value;
                if (clearBtn) clearBtn.style.display = query ? '' : 'none';
                this._searchTimeout = setTimeout(() => {
                    document.dispatchEvent(new CustomEvent('fasebar:search', {
                        detail: { query }
                    }));
                }, 300);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (input) input.value = '';
                clearBtn.style.display = 'none';
                document.dispatchEvent(new CustomEvent('fasebar:search', {
                    detail: { query: '' }
                }));
            });
        }
    }

    // ─── Private helpers ────────────────────────────────────

    _updateTabStates() {
        if (!this._element) return;
        this._element.querySelectorAll('.tz-fasebar-tab').forEach(btn => {
            const fase = btn.dataset.fase;
            const isActive = this._selectedFases.has(fase);
            btn.classList.toggle('active', isActive);

            const k = this._kleur(fase);
            if (isActive) {
                btn.style.background = k.tabBg;
                btn.style.color = k.tabText;
                btn.style.fontWeight = '500';
            } else {
                btn.style.background = '';
                btn.style.color = '';
                btn.style.fontWeight = '';
            }

            const countEl = btn.querySelector('.tz-fasebar-count');
            if (countEl) {
                countEl.style.background = k.activeBadgeBg;
                countEl.style.color = '#fff';
            }
        });
    }

    _dispatchFilterChange() {
        const fases = this._selectedFases.size > 0
            ? Array.from(this._selectedFases)
            : null;
        document.dispatchEvent(new CustomEvent('fasebar:filterChange', {
            detail: { fases }
        }));
    }

    // ─── Publieke API ────────────────────────────────────────

    /**
     * Update de count-badges per fase.
     * @param {Object} counts — { acquisitie: 3, inschrijvingen: 1, ... }
     */
    updateCounts(counts) {
        this._counts = counts || {};
        if (!this._element) return;
        this._fases.forEach(f => {
            const btn = this._element.querySelector(`.tz-fasebar-tab[data-fase="${f.id}"]`);
            if (!btn) return;
            const count = this._counts[f.id] || 0;
            const isActive = this._selectedFases.has(f.id);
            const k = this._kleur(f.id);
            let countEl = btn.querySelector('.tz-fasebar-count');
            if (count > 0) {
                if (!countEl) {
                    countEl = document.createElement('span');
                    countEl.className = 'tz-fasebar-count';
                    btn.appendChild(countEl);
                }
                countEl.textContent = count;
                countEl.style.background = k.activeBadgeBg;
                countEl.style.color = '#fff';
            } else if (countEl) {
                countEl.remove();
            }
        });
    }
}

window.FaseBar = FaseBar;
