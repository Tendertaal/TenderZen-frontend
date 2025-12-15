/* ============================================
   TENDERZEN ICON LIBRARY - ICONS.JS
   Versie 1.2
   
   37 SVG iconen in Lucide-stijl met consistente kleurlogica
   
   CHANGELOG:
   v1.2 - ⭐ IconConfig toegevoegd (centrale icon mapping)
   v1.1 - hardhat & landmark iconen toegevoegd
   ============================================ */

// ============================================
// ICON KLEUREN (volgens kleurlogica)
// ============================================

const IconColors = {
    blue: '#2563eb',      // Info, Bedrijven, Neutraal
    indigo: '#4f46e5',    // Security, Systeem, Documenten
    green: '#16a34a',     // Positief, Team, Toevoegen
    red: '#dc2626',       // Negatief, Verwijderen, Sluiten
    amber: '#d97706',     // Speciale status, Alerts, Admin
    orange: '#ea580c',    // Twijfel, Waarschuwing
    purple: '#9333ea',    // Analytics, Rapporten
    pink: '#db2777',      // Export
    teal: '#0d9488',      // Import
    slate: '#334155',     // UI elementen
    white: '#ffffff',     // Voor donkere achtergronden
    current: 'currentColor' // Inherit kleur
};

// ============================================
// ICON DEFAULTS
// ============================================

const defaultSize = 24;
const defaultStrokeWidth = 1.75;

// ============================================
// HELPER FUNCTIE
// ============================================

/**
 * Creëert een SVG icon string
 * @param {string} paths - SVG path content
 * @param {Object} options - Opties voor het icoon
 * @param {number} options.size - Grootte van het icoon (default: 24)
 * @param {string} options.color - Kleur van het icoon
 * @param {number} options.strokeWidth - Dikte van de lijnen (default: 1.75)
 * @param {string} options.fill - Fill kleur (default: none)
 * @param {string} options.className - Extra CSS class
 * @returns {string} SVG string
 */
function createIcon(paths, options = {}) {
    const {
        size = defaultSize,
        color = 'currentColor',
        strokeWidth = defaultStrokeWidth,
        fill = 'none',
        className = ''
    } = options;
    
    return `<svg 
        width="${size}" 
        height="${size}" 
        viewBox="0 0 24 24" 
        fill="${fill}" 
        stroke="${color}" 
        stroke-width="${strokeWidth}" 
        stroke-linecap="round" 
        stroke-linejoin="round"
        ${className ? `class="${className}"` : ''}
        role="img"
        aria-hidden="true"
    >${paths}</svg>`;
}

// ============================================
// 1. HEADER & NAVIGATIE ICONEN (7)
// ============================================

/**
 * Zoeken icoon - Blauw (informatie opzoeken)
 */
function iconSearch(options = {}) {
    return createIcon(
        `<circle cx="11" cy="11" r="8"/>
         <path d="m21 21-4.3-4.3"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Team Filter icoon - Groen (team gerelateerd)
 */
function iconTeamFilter(options = {}) {
    return createIcon(
        `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
         <circle cx="9" cy="7" r="4"/>
         <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
         <path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Status Filter icoon - Paars (analytics/status overzicht)
 */
function iconStatusFilter(options = {}) {
    return createIcon(
        `<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>`,
        { color: IconColors.purple, ...options }
    );
}

/**
 * Totaaloverzicht icoon - Paars (dashboard/analytics)
 */
function iconDashboard(options = {}) {
    return createIcon(
        `<rect width="7" height="9" x="3" y="3" rx="1"/>
         <rect width="7" height="5" x="14" y="3" rx="1"/>
         <rect width="7" height="9" x="14" y="12" rx="1"/>
         <rect width="7" height="5" x="3" y="16" rx="1"/>`,
        { color: IconColors.purple, ...options }
    );
}

/**
 * Lijst View icoon - Indigo (document/systeem weergave)
 */
function iconListView(options = {}) {
    return createIcon(
        `<line x1="8" x2="21" y1="6" y2="6"/>
         <line x1="8" x2="21" y1="12" y2="12"/>
         <line x1="8" x2="21" y1="18" y2="18"/>
         <line x1="3" x2="3.01" y1="6" y2="6"/>
         <line x1="3" x2="3.01" y1="12" y2="12"/>
         <line x1="3" x2="3.01" y1="18" y2="18"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Planning/Kalender View icoon - Blauw (kalender/planning)
 */
function iconCalendarView(options = {}) {
    return createIcon(
        `<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
         <line x1="16" x2="16" y1="2" y2="6"/>
         <line x1="8" x2="8" y1="2" y2="6"/>
         <line x1="3" x2="21" y1="10" y2="10"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Dropdown Pijl icoon - Slate (UI element, dikkere stroke)
 */
function iconChevronDown(options = {}) {
    return createIcon(
        `<path d="m6 9 6 6 6-6"/>`,
        { color: IconColors.slate, strokeWidth: 2.5, ...options }
    );
}

/**
 * Chevron Up icoon - Slate
 */
function iconChevronUp(options = {}) {
    return createIcon(
        `<path d="m18 15-6-6-6 6"/>`,
        { color: IconColors.slate, strokeWidth: 2.5, ...options }
    );
}

/**
 * Chevron Right icoon - Slate
 */
function iconChevronRight(options = {}) {
    return createIcon(
        `<path d="m9 18 6-6-6-6"/>`,
        { color: IconColors.slate, strokeWidth: 2.5, ...options }
    );
}

/**
 * Chevron Left icoon - Slate
 */
function iconChevronLeft(options = {}) {
    return createIcon(
        `<path d="m15 18-6-6 6-6"/>`,
        { color: IconColors.slate, strokeWidth: 2.5, ...options }
    );
}

// ============================================
// 2. APPS GRID - MODULE ICONEN (8)
// ============================================

/**
 * Bedrijven icoon - Blauw (bedrijven/klanten module)
 */
function iconBuilding(options = {}) {
    return createIcon(
        `<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
         <path d="M9 22v-4h6v4"/>
         <path d="M8 6h.01"/>
         <path d="M16 6h.01"/>
         <path d="M12 6h.01"/>
         <path d="M12 10h.01"/>
         <path d="M12 14h.01"/>
         <path d="M16 10h.01"/>
         <path d="M16 14h.01"/>
         <path d="M8 10h.01"/>
         <path d="M8 14h.01"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Tenderbureaus icoon - Amber (super-admin module, speciale status)
 */
function iconBriefcase(options = {}) {
    return createIcon(
        `<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
         <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>`,
        { color: IconColors.amber, ...options }
    );
}

/**
 * Templates icoon - Indigo (documenten/systeem)
 */
function iconFileText(options = {}) {
    return createIcon(
        `<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
         <polyline points="14 2 14 8 20 8"/>
         <line x1="16" x2="8" y1="13" y2="13"/>
         <line x1="16" x2="8" y1="17" y2="17"/>
         <line x1="10" x2="8" y1="9" y2="9"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Team icoon - Groen (mensen/team)
 */
function iconUsers(options = {}) {
    return createIcon(
        `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
         <circle cx="9" cy="7" r="4"/>
         <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
         <path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Rapporten icoon - Paars (analytics)
 */
function iconBarChart(options = {}) {
    return createIcon(
        `<line x1="12" x2="12" y1="20" y2="10"/>
         <line x1="18" x2="18" y1="20" y2="4"/>
         <line x1="6" x2="6" y1="20" y2="14"/>`,
        { color: IconColors.purple, ...options }
    );
}

/**
 * Export icoon - Roze (data uit systeem)
 */
function iconExport(options = {}) {
    return createIcon(
        `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
         <polyline points="17 8 12 3 7 8"/>
         <line x1="12" x2="12" y1="3" y2="15"/>`,
        { color: IconColors.pink, ...options }
    );
}

/**
 * Import icoon - Teal (data in systeem)
 */
function iconImport(options = {}) {
    return createIcon(
        `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
         <polyline points="7 10 12 15 17 10"/>
         <line x1="12" x2="12" y1="15" y2="3"/>`,
        { color: IconColors.teal, ...options }
    );
}

/**
 * Instellingen icoon - Indigo (systeem configuratie)
 */
function iconSettings(options = {}) {
    return createIcon(
        `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
         <circle cx="12" cy="12" r="3"/>`,
        { color: IconColors.indigo, ...options }
    );
}

// ============================================
// 3. PROFIEL MENU ICONEN (6)
// ============================================

/**
 * Mijn Profiel icoon - Blauw (persoonlijke informatie)
 */
function iconUser(options = {}) {
    return createIcon(
        `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
         <circle cx="12" cy="7" r="4"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Gebruiker Toevoegen icoon - Groen (teamlid toevoegen)
 */
function iconUserPlus(options = {}) {
    return createIcon(
        `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
         <circle cx="9" cy="7" r="4"/>
         <line x1="19" x2="19" y1="8" y2="14"/>
         <line x1="22" x2="16" y1="11" y2="11"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Beveiliging icoon - Indigo (security gerelateerd)
 */
function iconShieldCheck(options = {}) {
    return createIcon(
        `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
         <path d="m9 12 2 2 4-4"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Notificaties icoon - Amber (alerts/meldingen)
 */
function iconBell(options = {}) {
    return createIcon(
        `<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
         <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>`,
        { color: IconColors.amber, ...options }
    );
}

/**
 * Voorkeuren icoon - Indigo (systeem instellingen)
 */
function iconSliders(options = {}) {
    return createIcon(
        `<line x1="4" x2="4" y1="21" y2="14"/>
         <line x1="4" x2="4" y1="10" y2="3"/>
         <line x1="12" x2="12" y1="21" y2="12"/>
         <line x1="12" x2="12" y1="8" y2="3"/>
         <line x1="20" x2="20" y1="21" y2="16"/>
         <line x1="20" x2="20" y1="12" y2="3"/>
         <line x1="2" x2="6" y1="14" y2="14"/>
         <line x1="10" x2="14" y1="8" y2="8"/>
         <line x1="18" x2="22" y1="16" y2="16"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Uitloggen icoon - Rood (exit/negatieve actie)
 */
function iconLogOut(options = {}) {
    return createIcon(
        `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
         <polyline points="16 17 21 12 16 7"/>
         <line x1="21" x2="9" y1="12" y2="12"/>`,
        { color: IconColors.red, ...options }
    );
}

/**
 * Super-Admin Badge icoon - Amber (speciale status)
 */
function iconCrown(options = {}) {
    return createIcon(
        `<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/>`,
        { color: IconColors.amber, ...options }
    );
}

// ============================================
// 4. TENDER STATUS ICONEN (4)
// ============================================

/**
 * Go Status icoon - Groen (positief besluit)
 */
function iconStatusGo(options = {}) {
    return createIcon(
        `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
         <polyline points="22 4 12 14.01 9 11.01"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * No-Go Status icoon - Rood (negatief besluit)
 */
function iconStatusNoGo(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <path d="m15 9-6 6"/>
         <path d="m9 9 6 6"/>`,
        { color: IconColors.red, ...options }
    );
}

/**
 * Maybe Status icoon - Oranje (twijfel/onzeker)
 */
function iconStatusMaybe(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
         <path d="M12 17h.01"/>`,
        { color: IconColors.orange, ...options }
    );
}

/**
 * Pending Status icoon - Indigo (wachtend, neutraal systeem status)
 */
function iconStatusPending(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <polyline points="12 6 12 12 16 14"/>`,
        { color: IconColors.indigo, ...options }
    );
}

// ============================================
// 5. ACTIE ICONEN (7)
// ============================================

/**
 * Toevoegen/Plus icoon - Groen (positieve actie - creëren)
 */
function iconPlus(options = {}) {
    return createIcon(
        `<line x1="12" x2="12" y1="5" y2="19"/>
         <line x1="5" x2="19" y1="12" y2="12"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Toevoegen met cirkel icoon - Groen
 */
function iconPlusCircle(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <path d="M8 12h8"/>
         <path d="M12 8v8"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Bewerken/Edit icoon - Blauw (neutrale actie - wijzigen)
 */
function iconEdit(options = {}) {
    return createIcon(
        `<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
         <path d="m15 5 4 4"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Verwijderen/Trash icoon - Rood (negatieve actie - destructief)
 */
function iconTrash(options = {}) {
    return createIcon(
        `<path d="M3 6h18"/>
         <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
         <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
         <line x1="10" x2="10" y1="11" y2="17"/>
         <line x1="14" x2="14" y1="11" y2="17"/>`,
        { color: IconColors.red, ...options }
    );
}

/**
 * Opslaan/Save icoon - Groen (positieve actie - bewaren)
 */
function iconSave(options = {}) {
    return createIcon(
        `<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
         <polyline points="17 21 17 13 7 13 7 21"/>
         <polyline points="7 3 7 8 15 8"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Kopiëren/Copy icoon - Blauw (neutrale actie)
 */
function iconCopy(options = {}) {
    return createIcon(
        `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
         <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Refresh/Vernieuwen icoon - Blauw (neutrale actie)
 */
function iconRefresh(options = {}) {
    return createIcon(
        `<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
         <path d="M21 3v5h-5"/>
         <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
         <path d="M8 16H3v5"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Sluiten/Close icoon - Rood (exit/annuleer actie)
 */
function iconClose(options = {}) {
    return createIcon(
        `<path d="M18 6 6 18"/>
         <path d="m6 6 12 12"/>`,
        { color: IconColors.red, ...options }
    );
}

/**
 * Sluiten met cirkel icoon - Rood
 */
function iconXCircle(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <path d="m15 9-6 6"/>
         <path d="m9 9 6 6"/>`,
        { color: IconColors.red, ...options }
    );
}

// ============================================
// 6. FEEDBACK ICONEN (4)
// ============================================

/**
 * Success/Check icoon - Groen (positieve feedback)
 */
function iconCheck(options = {}) {
    return createIcon(
        `<polyline points="20 6 9 17 4 12"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Success met cirkel icoon - Groen
 */
function iconCheckCircle(options = {}) {
    return createIcon(
        `<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
         <polyline points="22 4 12 14.01 9 11.01"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Error/X icoon - Rood (negatieve feedback)
 */
function iconX(options = {}) {
    return createIcon(
        `<path d="M18 6 6 18"/>
         <path d="m6 6 12 12"/>`,
        { color: IconColors.red, ...options }
    );
}

/**
 * Warning/Driehoek icoon - Oranje (waarschuwing)
 */
function iconWarning(options = {}) {
    return createIcon(
        `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
         <path d="M12 9v4"/>
         <path d="M12 17h.01"/>`,
        { color: IconColors.orange, ...options }
    );
}

/**
 * Urgent/Alert icoon - Rood (kritieke situatie)
 */
function iconAlertCircle(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <line x1="12" x2="12" y1="8" y2="12"/>
         <line x1="12" x2="12.01" y1="16" y2="16"/>`,
        { color: IconColors.red, ...options }
    );
}

/**
 * Info icoon - Blauw
 */
function iconInfo(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <path d="M12 16v-4"/>
         <path d="M12 8h.01"/>`,
        { color: IconColors.blue, ...options }
    );
}

// ============================================
// 7. MFA & SECURITY ICONEN (6)
// ============================================

/**
 * 2FA / Lock icoon - Indigo (security feature)
 */
function iconLock(options = {}) {
    return createIcon(
        `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
         <path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Beschermd/Shield icoon - Groen (positief - veilig)
 */
function iconShield(options = {}) {
    return createIcon(
        `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Unlocked icoon - Indigo
 */
function iconUnlock(options = {}) {
    return createIcon(
        `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
         <path d="M7 11V7a5 5 0 0 1 9.9-1"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Smartphone icoon - Paars (device/app)
 */
function iconSmartphone(options = {}) {
    return createIcon(
        `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/>
         <path d="M12 18h.01"/>`,
        { color: IconColors.purple, ...options }
    );
}

/**
 * Snel/Bliksem icoon - Amber (energie/snelheid)
 */
function iconZap(options = {}) {
    return createIcon(
        `<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>`,
        { color: IconColors.amber, ...options }
    );
}

/**
 * Key/Sleutel icoon - Indigo (security/toegang)
 */
function iconKey(options = {}) {
    return createIcon(
        `<circle cx="7.5" cy="15.5" r="5.5"/>
         <path d="m21 2-9.6 9.6"/>
         <path d="m15.5 7.5 3 3L22 7l-3-3"/>`,
        { color: IconColors.indigo, ...options }
    );
}

// ============================================
// 8. OVERIGE ICONEN
// ============================================

/**
 * Klant/Bedrijf icoon - Blauw (bedrijven gerelateerd)
 */
function iconBuildingOffice(options = {}) {
    return createIcon(
        `<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/>
         <path d="M9 22v-4h6v4"/>
         <path d="M8 6h.01"/>
         <path d="M16 6h.01"/>
         <path d="M12 6h.01"/>
         <path d="M12 10h.01"/>
         <path d="M12 14h.01"/>
         <path d="M16 10h.01"/>
         <path d="M16 14h.01"/>
         <path d="M8 10h.01"/>
         <path d="M8 14h.01"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Deadline/Klok icoon - Amber (tijd-gevoelig alert)
 */
function iconClock(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="10"/>
         <polyline points="12 6 12 12 16 14"/>`,
        { color: IconColors.amber, ...options }
    );
}

/**
 * Deadline met alert icoon - Amber
 */
function iconClockAlert(options = {}) {
    return createIcon(
        `<path d="M12 6v6l4 2"/>
         <circle cx="12" cy="12" r="10"/>
         <path d="M12 2v2"/>
         <path d="m4.93 4.93 1.41 1.41"/>`,
        { color: IconColors.amber, ...options }
    );
}

/**
 * Lijst/Tenders icoon - Indigo (document weergave)
 */
function iconClipboardList(options = {}) {
    return createIcon(
        `<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
         <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
         <path d="M12 11h4"/>
         <path d="M12 16h4"/>
         <path d="M8 11h.01"/>
         <path d="M8 16h.01"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Menu/Hamburger icoon - Indigo (systeem navigatie)
 */
function iconMenu(options = {}) {
    return createIcon(
        `<line x1="4" x2="20" y1="12" y2="12"/>
         <line x1="4" x2="20" y1="6" y2="6"/>
         <line x1="4" x2="20" y1="18" y2="18"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Apps Grid icoon - Indigo
 */
function iconGrid(options = {}) {
    return createIcon(
        `<rect width="7" height="7" x="3" y="3" rx="1"/>
         <rect width="7" height="7" x="14" y="3" rx="1"/>
         <rect width="7" height="7" x="14" y="14" rx="1"/>
         <rect width="7" height="7" x="3" y="14" rx="1"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * External Link icoon - Blauw
 */
function iconExternalLink(options = {}) {
    return createIcon(
        `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
         <polyline points="15 3 21 3 21 9"/>
         <line x1="10" x2="21" y1="14" y2="3"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Download icoon - Blauw
 */
function iconDownload(options = {}) {
    return createIcon(
        `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
         <polyline points="7 10 12 15 17 10"/>
         <line x1="12" x2="12" y1="15" y2="3"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Upload icoon - Blauw
 */
function iconUpload(options = {}) {
    return createIcon(
        `<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
         <polyline points="17 8 12 3 7 8"/>
         <line x1="12" x2="12" y1="3" y2="15"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Eye/Bekijken icoon - Blauw
 */
function iconEye(options = {}) {
    return createIcon(
        `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
         <circle cx="12" cy="12" r="3"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Eye Off/Verbergen icoon - Slate
 */
function iconEyeOff(options = {}) {
    return createIcon(
        `<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
         <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
         <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
         <line x1="2" x2="22" y1="2" y2="22"/>`,
        { color: IconColors.slate, ...options }
    );
}

/**
 * Mail icoon - Blauw
 */
function iconMail(options = {}) {
    return createIcon(
        `<rect width="20" height="16" x="2" y="4" rx="2"/>
         <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Phone icoon - Blauw
 */
function iconPhone(options = {}) {
    return createIcon(
        `<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>`,
        { color: IconColors.blue, ...options }
    );
}

/**
 * Calendar met Plus icoon - Groen
 */
function iconCalendarPlus(options = {}) {
    return createIcon(
        `<path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/>
         <line x1="16" x2="16" y1="2" y2="6"/>
         <line x1="8" x2="8" y1="2" y2="6"/>
         <line x1="3" x2="21" y1="10" y2="10"/>
         <line x1="19" x2="19" y1="16" y2="22"/>
         <line x1="16" x2="22" y1="19" y2="19"/>`,
        { color: IconColors.green, ...options }
    );
}

/**
 * Filter icoon - Indigo
 */
function iconFilter(options = {}) {
    return createIcon(
        `<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>`,
        { color: IconColors.indigo, ...options }
    );
}

/**
 * Sort icoon - Slate
 */
function iconSort(options = {}) {
    return createIcon(
        `<path d="m3 16 4 4 4-4"/>
         <path d="M7 20V4"/>
         <path d="m21 8-4-4-4 4"/>
         <path d="M17 4v16"/>`,
        { color: IconColors.slate, ...options }
    );
}

/**
 * More Horizontal (drie puntjes) icoon - Slate
 */
function iconMoreHorizontal(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="1"/>
         <circle cx="19" cy="12" r="1"/>
         <circle cx="5" cy="12" r="1"/>`,
        { color: IconColors.slate, ...options }
    );
}

/**
 * More Vertical icoon - Slate
 */
function iconMoreVertical(options = {}) {
    return createIcon(
        `<circle cx="12" cy="12" r="1"/>
         <circle cx="12" cy="5" r="1"/>
         <circle cx="12" cy="19" r="1"/>`,
        { color: IconColors.slate, ...options }
    );
}

// ============================================
// 9. TENDER SPECIFIEKE ICONEN (NIEUW)
// ============================================

/**
 * Hardhat/Helm icoon - Amber (Inschrijver/Aannemer)
 * Bouwhelm voor de partij die inschrijft
 */
function iconHardhat(options = {}) {
    return createIcon(
        `<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/>
         <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/>
         <path d="M4 15v-3a6 6 0 0 1 6-6"/>
         <path d="M14 6a6 6 0 0 1 6 6v3"/>`,
        { color: IconColors.amber, ...options }
    );
}

/**
 * Landmark icoon - Blauw (Aanbestedende dienst/Overheid)
 * Overheidsgebouw met zuilen
 */
function iconLandmark(options = {}) {
    return createIcon(
        `<line x1="3" x2="21" y1="22" y2="22"/>
         <line x1="6" x2="6" y1="18" y2="11"/>
         <line x1="10" x2="10" y1="18" y2="11"/>
         <line x1="14" x2="14" y1="18" y2="11"/>
         <line x1="18" x2="18" y1="18" y2="11"/>
         <polygon points="12 2 20 7 4 7"/>`,
        { color: IconColors.blue, ...options }
    );
}

// ============================================
// 10. TENDERZEN LOGO ICON
// ============================================

/**
 * TenderZen Logo Beeldmerk (Zen Stenen)
 */
function iconTenderZenLogo(options = {}) {
    const { size = 48, className = '' } = options;
    const height = Math.round(size * 1.08); // Aspect ratio behouden
    
    return `<svg 
        width="${size}" 
        height="${height}" 
        viewBox="0 0 48 52" 
        fill="none"
        ${className ? `class="${className}"` : ''}
        role="img"
        aria-label="TenderZen Logo"
    >
        <defs>
            <linearGradient id="tzGradient" x1="24" y1="5" x2="24" y2="49" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stop-color="#c084fc"/>
                <stop offset="50%" stop-color="#818cf8"/>
                <stop offset="100%" stop-color="#667eea"/>
            </linearGradient>
        </defs>
        <ellipse cx="24" cy="10" rx="9" ry="5.5" fill="url(#tzGradient)" opacity="0.6"/>
        <ellipse cx="24" cy="25" rx="12" ry="6.5" fill="url(#tzGradient)" opacity="0.8"/>
        <ellipse cx="24" cy="42" rx="15" ry="7" fill="url(#tzGradient)"/>
    </svg>`;
}

/**
 * TenderZen Logo Beeldmerk - Wit (voor donkere achtergronden)
 */
function iconTenderZenLogoWhite(options = {}) {
    const { size = 48, className = '' } = options;
    const height = Math.round(size * 1.08);
    
    return `<svg 
        width="${size}" 
        height="${height}" 
        viewBox="0 0 48 52" 
        fill="none"
        ${className ? `class="${className}"` : ''}
        role="img"
        aria-label="TenderZen Logo"
    >
        <ellipse cx="24" cy="10" rx="9" ry="5.5" fill="white" opacity="0.5"/>
        <ellipse cx="24" cy="25" rx="12" ry="6.5" fill="white" opacity="0.7"/>
        <ellipse cx="24" cy="42" rx="15" ry="7" fill="white"/>
    </svg>`;
}

// ============================================
// 11. ICON CONFIGURATIE - CENTRALE MAPPING
// ============================================

/**
 * IconConfig - Centrale configuratie voor alle iconen in de applicatie
 * 
 * Wijzig hier het icoon en het verandert overal in de app!
 * 
 * Gebruik: IconConfig.tenderCard.inschrijver → 'hardhat'
 */
const IconConfig = {
    
    // ==========================================
    // TENDER KAART - Iconen op de tender card
    // ==========================================
    tenderCard: {
        aanbestedendeDienst: 'landmark',     // Opdrachtgever/overheid
        inschrijver: 'hardhat',               // Uitvoerend bedrijf (was: 'users')
        tenderbureau: 'edit',                 // Bureau dat de tender begeleidt
        documenten: 'fileText',               // Document knop
        deadline: 'calendar',                 // Deadline indicator
        workload: 'clock',                    // Geschatte uren
        teamToevoegen: 'plus',                // Team avatar toevoegen
        leegState: 'clipboardList'            // Lege tenderlijst
    },
    
    // ==========================================
    // TENDER FORMULIER - Sectie iconen
    // ==========================================
    tenderForm: {
        basisgegevens: 'fileText',            // Sectie: Basisgegevens
        partijen: 'hardhat',                  // Sectie: Partijen (was: 'users')
        teamsamenstelling: 'users',           // Sectie: Team
        planning: 'calendarView',             // Sectie: Planning & Deadlines
        kwalificatie: 'filter',               // Sectie: Kwalificatie
        financieel: 'barChart',               // Sectie: Financieel
        documenten: 'fileText',               // Sectie: Documenten
        gunningscriteria: 'checkCircle',      // Sectie: Gunningscriteria
        risicos: 'alertCircle',               // Sectie: Risico's
        opslaan: 'save',                      // Opslaan knop
        sluiten: 'close',                     // Sluiten knop
        bewerken: 'edit',                     // Bewerk modus
        aanmaken: 'plus'                      // Aanmaak modus
    },
    
    // ==========================================
    // HEADER & NAVIGATIE
    // ==========================================
    header: {
        zoeken: 'search',
        menu: 'grid',
        chevronDown: 'chevronDown',
        chevronUp: 'chevronUp',
        chevronRight: 'chevronRight',
        chevronLeft: 'chevronLeft'
    },
    
    // ==========================================
    // VIEWS - Weergave toggles
    // ==========================================
    views: {
        dashboard: 'dashboard',
        lijst: 'listView',
        kalender: 'calendarView',
        grid: 'grid'
    },
    
    // ==========================================
    // MODULES - Apps menu
    // ==========================================
    modules: {
        tenders: 'clipboardList',
        bedrijven: 'building',
        tenderbureaus: 'briefcase',
        templates: 'copy',
        teamleden: 'users',
        rapporten: 'barChart',
        instellingen: 'settings'
    },
    
    // ==========================================
    // PROFIEL MENU
    // ==========================================
    profiel: {
        mijnProfiel: 'user',
        beveiliging: 'shieldCheck',
        notificaties: 'bell',
        voorkeuren: 'sliders',
        uitloggen: 'logOut',
        superAdmin: 'crown'
    },
    
    // ==========================================
    // ACTIES - Knoppen
    // ==========================================
    acties: {
        toevoegen: 'plus',
        toevoegenCircle: 'plusCircle',
        bewerken: 'edit',
        verwijderen: 'trash',
        opslaan: 'save',
        kopieren: 'copy',
        vernieuwen: 'refresh',
        sluiten: 'close',
        annuleren: 'xCircle'
    },
    
    // ==========================================
    // FEEDBACK - Status berichten
    // ==========================================
    feedback: {
        success: 'check',
        successCircle: 'checkCircle',
        error: 'x',
        errorCircle: 'xCircle',
        warning: 'warning',
        alert: 'alertCircle',
        info: 'info'
    },
    
    // ==========================================
    // TENDER STATUS
    // ==========================================
    tenderStatus: {
        go: 'statusGo',
        noGo: 'statusNoGo',
        maybe: 'statusMaybe',
        pending: 'statusPending'
    },
    
    // ==========================================
    // BEDRIJVEN VIEW
    // ==========================================
    bedrijven: {
        bedrijf: 'building',
        klant: 'buildingOffice',
        contactpersoon: 'user',
        tenders: 'fileText',
        bewerken: 'edit',
        verwijderen: 'trash',
        leegState: 'building'
    },
    
    // ==========================================
    // TEAMLEDEN VIEW
    // ==========================================
    teamleden: {
        team: 'users',
        persoon: 'user',
        email: 'mail',
        telefoon: 'phone',
        rol: 'briefcase',
        actief: 'clock',
        toevoegen: 'userPlus',
        bewerken: 'edit',
        verwijderen: 'trash',
        leegState: 'users'
    },
    
    // ==========================================
    // SECURITY & MFA
    // ==========================================
    security: {
        lock: 'lock',
        unlock: 'unlock',
        shield: 'shield',
        shieldCheck: 'shieldCheck',
        key: 'key',
        smartphone: 'smartphone',
        zap: 'zap'
    },
    
    // ==========================================
    // OVERIG
    // ==========================================
    overig: {
        externalLink: 'externalLink',
        download: 'download',
        upload: 'upload',
        bekijken: 'eye',
        verbergen: 'eyeOff',
        filter: 'filter',
        sorteren: 'sort',
        meerOpties: 'moreHorizontal',
        meerOptiesVertical: 'moreVertical'
    }
};

// ============================================
// EXPORT - Alle iconen beschikbaar maken
// ============================================

// Icon kleuren exporteren
window.IconColors = IconColors;

// ⭐ Icon configuratie exporteren
window.IconConfig = IconConfig;

// Alle iconen als object
window.Icons = {
    // Header & Navigatie
    search: iconSearch,
    teamFilter: iconTeamFilter,
    statusFilter: iconStatusFilter,
    dashboard: iconDashboard,
    listView: iconListView,
    calendarView: iconCalendarView,
    chevronDown: iconChevronDown,
    chevronUp: iconChevronUp,
    chevronRight: iconChevronRight,
    chevronLeft: iconChevronLeft,
    
    // Apps Grid - Modules
    building: iconBuilding,
    briefcase: iconBriefcase,
    fileText: iconFileText,
    users: iconUsers,
    barChart: iconBarChart,
    export: iconExport,
    import: iconImport,
    settings: iconSettings,
    
    // Profiel Menu
    user: iconUser,
    userPlus: iconUserPlus,               // ⭐ Teamlid toevoegen
    shieldCheck: iconShieldCheck,
    bell: iconBell,
    sliders: iconSliders,
    logOut: iconLogOut,
    crown: iconCrown,
    
    // Tender Status
    statusGo: iconStatusGo,
    statusNoGo: iconStatusNoGo,
    statusMaybe: iconStatusMaybe,
    statusPending: iconStatusPending,
    
    // Actie Iconen
    plus: iconPlus,
    plusCircle: iconPlusCircle,
    edit: iconEdit,
    trash: iconTrash,
    save: iconSave,
    copy: iconCopy,
    refresh: iconRefresh,
    close: iconClose,
    xCircle: iconXCircle,
    
    // Feedback Iconen
    check: iconCheck,
    checkCircle: iconCheckCircle,
    x: iconX,
    warning: iconWarning,
    alertCircle: iconAlertCircle,
    info: iconInfo,
    
    // MFA & Security
    lock: iconLock,
    shield: iconShield,
    unlock: iconUnlock,
    smartphone: iconSmartphone,
    zap: iconZap,
    key: iconKey,
    
    // Overige
    buildingOffice: iconBuildingOffice,
    clock: iconClock,
    clockAlert: iconClockAlert,
    clipboardList: iconClipboardList,
    menu: iconMenu,
    grid: iconGrid,
    externalLink: iconExternalLink,
    download: iconDownload,
    upload: iconUpload,
    eye: iconEye,
    eyeOff: iconEyeOff,
    mail: iconMail,
    phone: iconPhone,
    calendarPlus: iconCalendarPlus,
    calendar: iconCalendarView,           // ⭐ Alias voor deadline indicator op tender cards
    filter: iconFilter,
    sort: iconSort,
    moreHorizontal: iconMoreHorizontal,
    moreVertical: iconMoreVertical,
    
    // ⭐ Tender Specifiek
    hardhat: iconHardhat,
    landmark: iconLandmark,
    
    // TenderZen Logo
    logo: iconTenderZenLogo,
    logoWhite: iconTenderZenLogoWhite
};

// Helper functie ook exporteren
window.createIcon = createIcon;

// ============================================
// USAGE EXAMPLES
// ============================================

/*
ICONCONFIG GEBRUIK:

1. In TenderListView.js (of elk ander bestand):
   
   // Oud (hardcoded):
   ${this.getIcon('users', 14)}
   
   // Nieuw (via config):
   ${this.getIcon(IconConfig.tenderCard.inschrijver, 14)}

2. Icoon wijzigen voor hele app:
   
   // In icons.js, wijzig alleen:
   tenderCard: {
       inschrijver: 'hardhat',  // Verander naar bijv. 'briefcase'
   }
   
   // Klaar! Overal waar IconConfig.tenderCard.inschrijver 
   // wordt gebruikt, verandert het icoon automatisch.

3. Beschikbare config categorieën:
   - IconConfig.tenderCard      → Tender kaart iconen
   - IconConfig.tenderForm      → Formulier sectie iconen  
   - IconConfig.header          → Header navigatie
   - IconConfig.views           → View toggles
   - IconConfig.modules         → Apps menu
   - IconConfig.profiel         → Profiel dropdown
   - IconConfig.acties          → Actie knoppen
   - IconConfig.feedback        → Status/feedback
   - IconConfig.tenderStatus    → Go/No-Go etc.
   - IconConfig.bedrijven       → Bedrijven view
   - IconConfig.teamleden       → Teamleden view
   - IconConfig.security        → MFA & beveiliging
   - IconConfig.overig          → Overige iconen
*/