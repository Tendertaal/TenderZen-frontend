/* ============================================
   TENDERZEN - ICON HELPERS
   ============================================
   
   Helper functies voor het renderen van iconen
   in de TenderZen applicatie.
   
   VEREIST: icons.js moet geladen zijn VOOR dit bestand
   ============================================ */

// Referentie naar globale Icons en IconColors
const Icons = window.Icons || {};
const IconColors = window.IconColors || {};

// ============================================
// ICON MAPPING TABEL (voor referentie)
// ============================================
// 
// HEADER & NAVIGATIE:
// ------------------------------------------
// Zoeken (magnifying glass)    -> Icons.search()
// Totaaloverzicht/Dashboard    -> Icons.dashboard()
// Lijst/Aanbestedingen         -> Icons.clipboardList()
// Planning/Kalender            -> Icons.calendarView()
// Kanban view                  -> Icons.grid()
// Dropdown pijl omlaag         -> Icons.chevronDown()
// Dropdown pijl omhoog         -> Icons.chevronUp()
// 
// APPS GRID / MODULES:
// ------------------------------------------
// Bedrijven                    -> Icons.building()
// Tenderbureaus/Leads          -> Icons.briefcase()
// Templates/Documenten         -> Icons.fileText()
// Team                         -> Icons.users()
// Rapporten/Statistieken       -> Icons.barChart()
// Export                       -> Icons.export()
// Import                       -> Icons.import()
// Instellingen                 -> Icons.settings()
// 
// PROFIEL MENU:
// ------------------------------------------
// Mijn Profiel                 -> Icons.user()
// Beveiliging                  -> Icons.shieldCheck()
// Notificaties                 -> Icons.bell()
// Voorkeuren                   -> Icons.sliders()
// Uitloggen                    -> Icons.logOut()
// Super-Admin                  -> Icons.crown()
// 
// TENDER STATUS:
// ------------------------------------------
// Go (positief)                -> Icons.statusGo()
// No-Go (negatief)             -> Icons.statusNoGo()
// Maybe (twijfel)              -> Icons.statusMaybe()
// Pending (wachtend)           -> Icons.statusPending()
// 
// ACTIE ICONEN:
// ------------------------------------------
// Toevoegen/Plus               -> Icons.plus()
// Bewerken/Edit                -> Icons.edit()
// Verwijderen/Trash            -> Icons.trash()
// Opslaan/Save                 -> Icons.save()
// Kopiëren/Copy                -> Icons.copy()
// Vernieuwen/Refresh           -> Icons.refresh()
// Sluiten/Close                -> Icons.close()
// 
// FEEDBACK:
// ------------------------------------------
// Success/Check                -> Icons.check()
// Error/X                      -> Icons.x()
// Warning                      -> Icons.warning()
// Info                         -> Icons.info()
// Alert/Urgent                 -> Icons.alertCircle()


// ============================================
// HELPER FUNCTIES
// ============================================

/**
 * Render het TenderZen logo (beeldmerk + tekst)
 * @param {number} size - Grootte van het logo (default: 32)
 * @returns {string} HTML string
 */
function renderLogo(size = 32) {
    const logoSvg = Icons.logo({ size: size });
    const fontSize = Math.round(size * 0.6);
    
    return `
        <div class="logo-container" style="display: flex; align-items: center; gap: 12px;">
            ${logoSvg}
            <span class="tz-logo-text" style="font-size: ${fontSize}px;">TenderZen</span>
        </div>
    `;
}

/**
 * Render een menu item met icoon
 * @param {string} iconName - Naam van het icoon (bijv. 'search', 'user')
 * @param {string} label - Tekst label
 * @param {Object} options - Extra opties voor het icoon
 * @returns {string} HTML string
 */
function renderMenuItem(iconName, label, options = {}) {
    const iconFn = Icons[iconName];
    if (!iconFn) {
        console.warn(`Icon niet gevonden: ${iconName}`);
        return `<span class="menu-icon">?</span><span>${label}</span>`;
    }
    
    const iconHtml = iconFn({ size: 20, ...options });
    
    return `
        <span class="menu-icon">${iconHtml}</span>
        <span>${label}</span>
    `;
}

/**
 * Render een status badge met icoon
 * @param {string} status - Status type: 'go', 'no-go', 'maybe', 'pending'
 * @returns {string} HTML string
 */
function renderStatusBadge(status) {
    const statusMap = {
        'go': { 
            icon: 'statusGo', 
            cssClass: 'badge-go', 
            label: 'Go' 
        },
        'no-go': { 
            icon: 'statusNoGo', 
            cssClass: 'badge-no-go', 
            label: 'No-Go' 
        },
        'maybe': { 
            icon: 'statusMaybe', 
            cssClass: 'badge-maybe', 
            label: 'Maybe' 
        },
        'pending': { 
            icon: 'statusPending', 
            cssClass: 'badge-pending', 
            label: 'Pending' 
        }
    };
    
    const config = statusMap[status.toLowerCase()] || statusMap['pending'];
    const iconHtml = Icons[config.icon]({ size: 14 });
    
    return `
        <span class="badge ${config.cssClass}">
            ${iconHtml}
            ${config.label}
        </span>
    `;
}

/**
 * Render een actie button met icoon
 * @param {string} iconName - Naam van het icoon
 * @param {string} label - Button tekst (optioneel)
 * @param {string} variant - Button variant: 'primary', 'secondary', 'danger', 'ghost'
 * @param {string} size - Button grootte: 'small', 'default', 'large'
 * @returns {string} HTML string
 */
function renderActionButton(iconName, label = '', variant = 'secondary', size = 'default') {
    const iconFn = Icons[iconName];
    const sizeClass = size === 'small' ? 'btn-sm' : size === 'large' ? 'btn-lg' : '';
    const iconSize = size === 'small' ? 14 : size === 'large' ? 20 : 16;
    
    const iconHtml = iconFn ? iconFn({ size: iconSize, color: 'currentColor' }) : '';
    const labelHtml = label ? `<span>${label}</span>` : '';
    
    return `
        <button class="btn btn-${variant} ${sizeClass}">
            ${iconHtml}
            ${labelHtml}
        </button>
    `;
}

/**
 * Render een navigatie tab met icoon
 * @param {string} iconName - Naam van het icoon
 * @param {string} label - Tab tekst
 * @param {string} route - Route identifier
 * @param {boolean} isActive - Is de tab actief
 * @param {number} badge - Badge nummer (optioneel)
 * @returns {string} HTML string
 */
function renderNavTab(iconName, label, route, isActive = false, badge = null) {
    const iconFn = Icons[iconName];
    const iconHtml = iconFn ? iconFn({ size: 18 }) : '';
    const activeClass = isActive ? 'active' : '';
    const badgeHtml = badge ? `<span class="nav-tab-badge">${badge}</span>` : '';
    
    return `
        <button class="nav-tab ${activeClass}" data-route="${route}">
            <span class="nav-tab-icon">${iconHtml}</span>
            <span>${label}</span>
            ${badgeHtml}
        </button>
    `;
}

/**
 * Render een icon box (gekleurde achtergrond met icoon)
 * @param {string} iconName - Naam van het icoon
 * @param {string} colorClass - Kleur class: 'blue', 'green', 'red', 'amber', etc.
 * @param {string} size - Grootte: 'small', 'default', 'large'
 * @returns {string} HTML string
 */
function renderIconBox(iconName, colorClass = 'blue', size = 'default') {
    const iconFn = Icons[iconName];
    const sizeClass = size === 'small' ? 'icon-box-sm' : size === 'large' ? 'icon-box-lg' : '';
    const iconSize = size === 'small' ? 16 : size === 'large' ? 24 : 20;
    
    // Bepaal de icon kleur op basis van de box kleur
    const colorMap = {
        'blue': IconColors.blue,
        'indigo': IconColors.indigo,
        'green': IconColors.green,
        'red': IconColors.red,
        'amber': IconColors.amber,
        'orange': IconColors.orange,
        'purple': IconColors.purple,
        'pink': IconColors.pink,
        'teal': IconColors.teal,
        'gray': IconColors.slate
    };
    
    const iconColor = colorMap[colorClass] || IconColors.blue;
    const iconHtml = iconFn ? iconFn({ size: iconSize, color: iconColor }) : '';
    
    return `
        <div class="icon-box icon-box-${colorClass} ${sizeClass}">
            ${iconHtml}
        </div>
    `;
}

/**
 * Render een toast/notification
 * @param {string} type - Type: 'success', 'error', 'warning', 'info'
 * @param {string} title - Titel van de toast
 * @param {string} message - Bericht
 * @returns {string} HTML string
 */
function renderToast(type, title, message) {
    const typeMap = {
        'success': { icon: 'checkCircle', cssClass: 'toast-success' },
        'error': { icon: 'alertCircle', cssClass: 'toast-error' },
        'warning': { icon: 'warning', cssClass: 'toast-warning' },
        'info': { icon: 'info', cssClass: 'toast-info' }
    };
    
    const config = typeMap[type] || typeMap['info'];
    const iconHtml = Icons[config.icon]({ size: 24 });
    
    return `
        <div class="toast ${config.cssClass}">
            <div class="toast-icon">${iconHtml}</div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">${Icons.close({ size: 16 })}</button>
        </div>
    `;
}

// ============================================
// APPS GRID CONFIGURATIE
// ============================================

const AppsGridConfig = [
    { 
        id: 'bedrijven',
        icon: 'building', 
        label: 'Bedrijven', 
        color: 'blue',
        route: '/bedrijven'
    },
    { 
        id: 'tenderbureaus',
        icon: 'briefcase', 
        label: 'Tenderbureaus', 
        color: 'amber',
        route: '/tenderbureaus',
        adminOnly: true
    },
    { 
        id: 'templates',
        icon: 'fileText', 
        label: 'Templates', 
        color: 'indigo',
        route: '/templates'
    },
    { 
        id: 'team',
        icon: 'users', 
        label: 'Team', 
        color: 'green',
        route: '/team'
    },
    { 
        id: 'rapporten',
        icon: 'barChart', 
        label: 'Rapporten', 
        color: 'purple',
        route: '/rapporten'
    },
    { 
        id: 'export',
        icon: 'export', 
        label: 'Export', 
        color: 'pink',
        route: '/export'
    },
    { 
        id: 'import',
        icon: 'import', 
        label: 'Import', 
        color: 'teal',
        route: '/import'
    },
    { 
        id: 'instellingen',
        icon: 'settings', 
        label: 'Instellingen', 
        color: 'indigo',
        route: '/instellingen'
    }
];

/**
 * Render de complete apps grid
 * @param {boolean} showAdminItems - Toon admin-only items
 * @returns {string} HTML string
 */
function renderAppsGrid(showAdminItems = false) {
    const items = AppsGridConfig.filter(item => {
        if (item.adminOnly && !showAdminItems) return false;
        return true;
    });
    
    const itemsHtml = items.map(item => {
        const iconBox = renderIconBox(item.icon, item.color);
        return `
            <div class="app-item" data-route="${item.route}">
                ${iconBox}
                <span class="app-label">${item.label}</span>
            </div>
        `;
    }).join('');
    
    return `
        <div class="apps-grid">
            ${itemsHtml}
        </div>
    `;
}

// ============================================
// NAVIGATION CONFIGURATIE
// ============================================

const NavTabsConfig = [
    { 
        icon: 'dashboard', 
        label: 'Totaaloverzicht', 
        route: 'totaal' 
    },
    { 
        icon: 'briefcase', 
        label: 'Acquisitie', 
        route: 'acquisitie',
        badge: 5
    },
    { 
        icon: 'edit', 
        label: 'Inschrijvingen', 
        route: 'inschrijvingen' 
    },
    { 
        icon: 'checkCircle', 
        label: 'Ingediend', 
        route: 'ingediend' 
    },
    { 
        icon: 'settings', 
        label: 'Admin', 
        route: 'admin',
        adminOnly: true
    }
];

/**
 * Render de complete navigatie
 * @param {string} activeRoute - Huidige actieve route
 * @param {boolean} showAdminItems - Toon admin-only items
 * @returns {string} HTML string
 */
function renderNavigation(activeRoute = 'totaal', showAdminItems = false) {
    const tabs = NavTabsConfig.filter(tab => {
        if (tab.adminOnly && !showAdminItems) return false;
        return true;
    });
    
    const tabsHtml = tabs.map(tab => {
        const isActive = tab.route === activeRoute;
        return renderNavTab(tab.icon, tab.label, tab.route, isActive, tab.badge);
    }).join('');
    
    return `
        <nav class="app-nav">
            ${tabsHtml}
        </nav>
    `;
}

// ============================================
// EXPORT
// ============================================

window.renderLogo = renderLogo;
window.renderMenuItem = renderMenuItem;
window.renderStatusBadge = renderStatusBadge;
window.renderActionButton = renderActionButton;
window.renderNavTab = renderNavTab;
window.renderIconBox = renderIconBox;
window.renderToast = renderToast;
window.renderAppsGrid = renderAppsGrid;
window.renderNavigation = renderNavigation;
window.AppsGridConfig = AppsGridConfig;
window.NavTabsConfig = NavTabsConfig;