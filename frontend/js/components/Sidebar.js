/**
 * Sidebar.js — Inklapbare zijbalk voor TenderZen
 *
 * Gebruik:
 *   const sidebar = new Sidebar();
 *   document.body.appendChild(sidebar.render());
 *
 * Events (op document):
 *   'sidebar:navigate'  { detail: { view: itemId } }
 *
 * localStorage key: 'tz_sidebar_open'
 */

class Sidebar {
    constructor() {
        this._isOpen = localStorage.getItem('tz_sidebar_open') === 'true';
        this._activeItem = 'tenders';
        this._element = null;
        this.onToggle = null; // callback(isOpen) — aangeroepen na elke toggle
    }

    // ─── Helpers ────────────────────────────────────────────

    _icon(name, size, color) {
        const opts = { size: size || 20 };
        if (color) opts.color = color;
        if (window.Icons && typeof window.Icons[name] === 'function') {
            return window.Icons[name](opts);
        }
        return '';
    }

    _isAdmin() {
        return window.app?.currentUser?.role === 'super_admin';
    }

    _tenderCount() {
        return window.app?.tenders?.length || 0;
    }

    _userData() {
        const user = window.app?.currentUser || {};
        const naam = user.naam || user.name || user.email || 'Gebruiker';
        const initialen = naam
            .split(/\s+/)
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
        return {
            naam,
            initialen,
            avatarKleur: user.avatar_kleur || '#7c3aed',
            bureauNaam: window.app?.currentBureau?.naam || '',
        };
    }

    // ─── Render ─────────────────────────────────────────────

    render() {
        const aside = document.createElement('aside');
        aside.className = 'tz-sidebar' + (this._isOpen ? ' open' : '');

        aside.innerHTML = this._buildInnerHTML();

        this._element = aside;
        this._attachHandlers();
        return aside;
    }

    _buildInnerHTML() {
        // Gebruikersdata ophalen
        const count = this._tenderCount();
        const user = window.app?.currentUser || {};
        const naam = user.naam || user.name || user.email || 'Gebruiker';
        const initialen = user.initialen || naam.charAt(0).toUpperCase();
        const avatarKleur = user.avatar_kleur || '#7c3aed';
        const bureauNaam = window.app?.currentBureau?.naam || '';
        const isAdmin = this._isAdmin();
        const badgePurple = count > 0
            ? `<span class="tz-sidebar-badge purple">${count}</span>`
            : '';
        const adminBadge = `<span class="tz-sidebar-badge amber">ADMIN</span>`;
        const beheerItems = isAdmin ? `
            <div class="tz-sidebar-section-label">Beheer</div>
            <button class="tz-sidebar-item" data-id="templatebeheer">
                <span class="tz-sidebar-icon">${this._icon('fileText', 20, 'currentColor')}</span>
                <span class="tz-sidebar-label">Templatebeheer</span>
                ${adminBadge}
                <span class="tz-sidebar-tooltip">Templatebeheer</span>
            </button>
            <button class="tz-sidebar-item" data-id="tenderbureaus">
                <span class="tz-sidebar-icon">${this._icon('buildingOffice', 20, 'currentColor')}</span>
                <span class="tz-sidebar-label">Tenderbureaus</span>
                ${adminBadge}
                <span class="tz-sidebar-tooltip">Tenderbureaus</span>
            </button>
            <button class="tz-sidebar-item" data-id="iconenbeheer">
                <span class="tz-sidebar-icon">${this._icon('grid', 20, 'currentColor')}</span>
                <span class="tz-sidebar-label">Iconen beheer</span>
                ${adminBadge}
                <span class="tz-sidebar-tooltip">Iconen beheer</span>
            </button>
            <div class="tz-sidebar-divider"></div>
        ` : '';
        const chevronIcon = this._isOpen
            ? this._icon('chevronLeft', 18, 'currentColor')
            : this._icon('chevronRight', 18, 'currentColor');
        const userHTML = `
          <button class="tz-sidebar-user" data-id="profiel" title="Mijn profiel">
            <div class="tz-sidebar-avatar" style="background: ${avatarKleur}">${initialen}</div>
            <div class="tz-sidebar-user-info">
              <div class="tz-sidebar-user-name">${naam}</div>
              <div class="tz-sidebar-user-bureau">${bureauNaam}</div>
            </div>
            <span class="tz-sidebar-tooltip">Mijn profiel</span>
          </button>
        `;
        return `
            <div class="tz-sidebar-logo">
                ${this._icon('logoWhite', 28)}
                <span>TenderZen</span>
            </div>
            <nav class="tz-sidebar-nav">
                <div class="tz-sidebar-section-label">Hoofdmenu</div>
                <button class="tz-sidebar-item${this._activeItem === 'tenders' ? ' active' : ''}" data-id="tenders">
                    <span class="tz-sidebar-icon">${this._icon('dashboard', 20, 'currentColor')}</span>
                    <span class="tz-sidebar-label">Tenders</span>
                    ${badgePurple}
                    <span class="tz-sidebar-tooltip">Tenders</span>
                </button>
                <button class="tz-sidebar-item${this._activeItem === 'bedrijven' ? ' active' : ''}" data-id="bedrijven">
                    <span class="tz-sidebar-icon">${this._icon('building', 20, 'currentColor')}</span>
                    <span class="tz-sidebar-label">Bedrijven</span>
                    <span class="tz-sidebar-tooltip">Bedrijven</span>
                </button>
                <button class="tz-sidebar-item${this._activeItem === 'team' ? ' active' : ''}" data-id="team">
                    <span class="tz-sidebar-icon">${this._icon('users', 20, 'currentColor')}</span>
                    <span class="tz-sidebar-label">Team</span>
                    <span class="tz-sidebar-tooltip">Team</span>
                </button>
                <button class="tz-sidebar-item${this._activeItem === 'rapportages' ? ' active' : ''}" data-id="rapportages">
                    <span class="tz-sidebar-icon">${this._icon('barChart', 20, 'currentColor')}</span>
                    <span class="tz-sidebar-label">Rapportages</span>
                    <span class="tz-sidebar-tooltip">Rapportages</span>
                </button>
                <button class="tz-sidebar-item${this._activeItem === 'exporteren' ? ' active' : ''}" data-id="exporteren">
                    <span class="tz-sidebar-icon">${this._icon('download', 20, 'currentColor')}</span>
                    <span class="tz-sidebar-label">Exporteren</span>
                    <span class="tz-sidebar-tooltip">Exporteren</span>
                </button>
                <div class="tz-sidebar-divider"></div>
                ${beheerItems}
                <button class="tz-sidebar-item${this._activeItem === 'instellingen' ? ' active' : ''}" data-id="instellingen">
                    <span class="tz-sidebar-icon">${this._icon('settings', 20, 'currentColor')}</span>
                    <span class="tz-sidebar-label">Instellingen</span>
                    <span class="tz-sidebar-tooltip">Instellingen</span>
                </button>
            </nav>
            ${userHTML}
            <button class="tz-sidebar-toggle" title="Zijbalk in-/uitklappen">
                ${chevronIcon}
            </button>
        `;
    }

    // ─── Event handlers ─────────────────────────────────────

    _attachHandlers() {
        if (!this._element) return;

        // Nav item clicks
        this._element.querySelectorAll('.tz-sidebar-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.setActive(id);
                document.dispatchEvent(new CustomEvent('sidebar:navigate', {
                    detail: { view: id }
                }));
            });
        });

        // Toggle button
        const toggleBtn = this._element.querySelector('.tz-sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle();
            });
        }

        // Gebruikersblok → navigeer naar profiel
        const userBtn = this._element.querySelector('.tz-sidebar-user');
        if (userBtn) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setActive('profiel');
                document.dispatchEvent(new CustomEvent('sidebar:navigate', {
                    detail: { view: 'profiel' }
                }));
            });
        }
    }

    // ─── Public API ──────────────────────────────────────────

    toggle() {
        this._isOpen = !this._isOpen;
        localStorage.setItem('tz_sidebar_open', String(this._isOpen));

        if (!this._element) return;
        this._element.classList.toggle('open', this._isOpen);

        // Update chevron richting
        const toggleBtn = this._element.querySelector('.tz-sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.innerHTML = this._isOpen
                ? this._icon('chevronLeft', 18, 'currentColor')
                : this._icon('chevronRight', 18, 'currentColor');
        }

        // Informeer App.js zodat de main margin gesynchroniseerd kan worden
        if (typeof this.onToggle === 'function') {
            this.onToggle(this._isOpen);
        }
    }

    setActive(itemId) {
        this._activeItem = itemId;
        if (!this._element) return;
        // Reset alle sidebar items
        this._element.querySelectorAll('.tz-sidebar-item').forEach(item => {
            item.classList.remove('active');
        });
        // Reset user button
        const userBtn = this._element.querySelector('.tz-sidebar-user');
        userBtn?.classList.remove('active');

        if (itemId === 'profiel') {
            userBtn?.classList.add('active');
        } else {
            const target = this._element.querySelector(`.tz-sidebar-item[data-id="${itemId}"]`);
            target?.classList.add('active');
        }
    }

    /**
     * Herrender de badge na het laden van tender data
     */
    updateTenderCount() {
        if (!this._element) return;
        const count = this._tenderCount();
        const tenderBtn = this._element.querySelector('[data-id="tenders"] .tz-sidebar-badge');
        if (tenderBtn) {
            tenderBtn.textContent = count;
            tenderBtn.style.display = count > 0 ? '' : 'none';
        }
    }
}

window.Sidebar = Sidebar;
