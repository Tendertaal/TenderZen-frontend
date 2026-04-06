/**
 * Topbar.js — Bovenste navigatiebalk voor TenderZen
 *
 * Gebruik:
 *   const topbar = new Topbar();
 *   document.getElementById('app-topbar').appendChild(topbar.render());
 *
 * Events (op document):
 *   'topbar:viewChange'   { detail: { view: 'lijst'|'planning'|'kanban' } }
 *   'topbar:smartImport'  {}
 *   'topbar:addBedrijf'   {}
 *   'topbar:addTeamlid'   {}
 *
 * Publieke API:
 *   topbar.setActiveView(view)       — activeer een view-pill
 *   topbar.showViewSwitcher(visible) — verberg/toon view pills
 *   topbar.setContext(view)          — pas actieknop aan per view
 */

class Topbar {
    constructor() {
        this._activeView = 'lijst';
        this._element = null;
        this._actionContainer = null;
    }

    // ─── Render ─────────────────────────────────────────────

    render() {
        const div = document.createElement('div');
        div.className = 'tz-topbar';
        div.innerHTML = this._buildHTML();
        this._element = div;

        // Bewaar referentie naar de actie-container voor setContext()
        this._actionContainer = div.querySelector('.tz-topbar-action');

        this._attachHandlers();
        return div;
    }

    _icon(name, size, color) {
        if (window.Icons && typeof window.Icons[name] === 'function') {
            return window.Icons[name]({ size: size || 16, color: color || 'currentColor' });
        }
        return '';
    }

    _buildHTML() {
        return `
            <div class="tz-topbar-left">
                <div id="tz-topbar-bureau-slot"></div>
            </div>

            <div class="tz-topbar-center">
                <div class="tz-topbar-view-pills">
                    <button class="tz-topbar-pill${this._activeView === 'lijst' ? ' active' : ''}" data-view="lijst">
                        ${this._icon('listView')}<span>Lijst</span>
                    </button>
                    <button class="tz-topbar-pill${this._activeView === 'planning' ? ' active' : ''}" data-view="planning">
                        ${this._icon('calendarView')}<span>Planning</span>
                    </button>
                    <button class="tz-topbar-pill${this._activeView === 'kalender' ? ' active' : ''}" data-view="kalender">
                        ${this._icon('calendar')}<span>Kalender</span>
                    </button>
                    <button class="tz-topbar-pill${this._activeView === 'gantt' ? ' active' : ''}" data-view="gantt">
                        ${this._icon('barChart')}<span>Gantt</span>
                    </button>
                    <button class="tz-topbar-pill${this._activeView === 'kanban' ? ' active' : ''}" data-view="kanban">
                        ${this._icon('grid')}<span>Kanban</span>
                    </button>
                </div>
            </div>

            <div class="tz-topbar-right">
                <div class="tz-topbar-action"></div>
            </div>
        `;
    }

    // ─── Event handlers ─────────────────────────────────────

    _attachHandlers() {
        if (!this._element) return;

        // View pills
        this._element.querySelectorAll('.tz-topbar-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.setActiveView(view);
                document.dispatchEvent(new CustomEvent('topbar:viewChange', {
                    detail: { view }
                }));
            });
        });
    }

    // ─── Publieke API ────────────────────────────────────────

    setActiveView(view) {
        this._activeView = view;
        if (!this._element) return;
        this._element.querySelectorAll('.tz-topbar-pill').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }

    showViewSwitcher(visible) {
        if (!this._element) return;
        const pills = this._element.querySelector('.tz-topbar-view-pills');
        if (pills) pills.style.display = visible ? '' : 'none';
    }

    /**
     * Pas de actieknop aan op basis van de actieve view.
     * @param {string} view — 'tenders' | 'bedrijven' | 'team' | andere (= geen knop)
     */
    setContext(view) {
        if (!this._actionContainer) return;

        // Knop-configuraties per view
        const configs = {
            tenders: {
                label: 'Smart Import',
                iconName: 'import',
                cls: 'tz-topbar-btn--purple',
                event: 'topbar:smartImport',
            },
            bedrijven: {
                label: '+ Bedrijf',
                iconName: 'building',
                cls: 'tz-topbar-btn--green',
                event: 'topbar:addBedrijf',
            },
            team: {
                label: '+ Teamlid',
                iconName: 'plus',
                cls: 'tz-topbar-btn--blue',
                event: 'topbar:addTeamlid',
            },
        };

        const config = configs[view] || null;

        // Vervang de inhoud van de container
        this._actionContainer.innerHTML = '';
        if (!config) return;

        const btn = document.createElement('button');
        btn.className = `tz-topbar-action-btn ${config.cls}`;
        btn.title = config.label;

        const iconHtml = this._icon(config.iconName, 14, '#ffffff');
        btn.innerHTML = `${iconHtml}<span>${config.label}</span>`;

        btn.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent(config.event));
        });

        this._actionContainer.appendChild(btn);
    }
}

window.Topbar = Topbar;
