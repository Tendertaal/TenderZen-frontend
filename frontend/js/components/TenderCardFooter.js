/**
 * TenderCardFooter â€” Herbruikbaar footer component voor tender kaarten
 * TenderZen v1.0
 *
 * EÃ©n component, drie plekken: TenderCard (lijst), KanbanView, PlanningsView
 * Garandeert consistent uiterlijk en gedrag overal.
 *
 * Features:
 * - Team avatars met rol-sortering, rol-kleuren, overflow indicator
 * - Planning shortcut knop met count (paars)
 * - Checklist shortcut knop met count (groen)
 * - "Team bewerken" add-knop
 * - Twee formaten: 'default' (lijstweergave) en 'compact' (kanban)
 * - Alle iconen via Icons library (icons.js)
 * - Click handling via data-action attributen (event delegation in parent)
 *
 * Gebruik:
 *   import { TenderCardFooter } from './TenderCardFooter.js';
 *
 *   const footer = new TenderCardFooter({
 *       tenderId: tender.id,
 *       teamAssignments: tender.team_assignments,
 *       planningCounts: { done: 3, total: 12 },
 *       checklistCounts: { done: 1, total: 7 },
 *       size: 'default'  // of 'compact'
 *   });
 *
 *   html += footer.render();
 */

// ============================================
// ROL CONFIGURATIE (exporteerbaar voor hergebruik)
// ============================================

export const ROL_KLEUREN = {
    manager:       '#ec4899',
    coordinator:   '#8b5cf6',
    schrijver:     '#3b82f6',
    designer:      '#10b981',
    calculator:    '#6366f1',
    reviewer:      '#84cc16',
    sales:         '#f59e0b',
    klant_contact: '#06b6d4'
};

export const ROL_LABELS = {
    manager:       'Manager',
    coordinator:   'CoÃ¶rdinator',
    schrijver:     'Schrijver',
    designer:      'Designer',
    calculator:    'Calculator',
    reviewer:      'Reviewer',
    sales:         'Sales',
    klant_contact: 'Klant contact'
};

export const ROL_VOLGORDE = [
    'manager', 'coordinator', 'schrijver', 'designer',
    'calculator', 'reviewer', 'sales', 'klant_contact'
];

// ============================================
// ICON HELPER
// ============================================

function getIcon(name, size = 14, color = null) {
    if (window.Icons && typeof window.Icons[name] === 'function') {
        const opts = { size };
        if (color) opts.color = color;
        return window.Icons[name](opts);
    }
    return '';
}

// ============================================
// TENDER CARD FOOTER CLASS
// ============================================

export class TenderCardFooter {
    /**
     * @param {Object} options
     * @param {string}  options.tenderId         - Tender ID voor data-attributes
     * @param {Array}   options.teamAssignments  - Array van teamleden
     * @param {Object}  options.planningCounts   - { done: number, total: number }
     * @param {Object}  options.checklistCounts  - { done: number, total: number }
     * @param {string}  options.size             - 'default' of 'compact'
     * @param {number}  options.maxAvatars       - Max zichtbare avatars (auto per size)
     */
    constructor(options = {}) {
        this.tenderId = options.tenderId || '';
        this.teamAssignments = options.teamAssignments || [];
        this.planningCounts = options.planningCounts || { done: 0, total: 0 };
        this.checklistCounts = options.checklistCounts || { done: 0, total: 0 };
        this.size = options.size || 'default';
        this.maxAvatars = options.maxAvatars || (this.size === 'compact' ? 3 : 5);
    }

    // ============================================
    // MAIN RENDER
    // ============================================

    render() {
        const sizeClass = this.size === 'compact' ? 'tcf--compact' : '';

        return `
            <div class="tcf ${sizeClass}" data-tender-id="${this.tenderId}">
                <div class="tcf-team">
                    ${this._renderTeamAvatars()}
                </div>
                <div class="tcf-shortcuts">
                    <button class="tcf-shortcut tcf-shortcut--planning" 
                            data-action="open-planning"
                            data-tender-id="${this.tenderId}" 
                            title="Projectplanning openen">
                        ${getIcon('calendar', this.size === 'compact' ? 12 : 13, 'currentColor')}
                        <span class="tcf-shortcut-count">${this.planningCounts.done}/${this.planningCounts.total}</span>
                    </button>
                    <button class="tcf-shortcut tcf-shortcut--checklist" 
                            data-action="open-checklist"
                            data-tender-id="${this.tenderId}" 
                            title="Indieningschecklist openen">
                        ${getIcon('check', this.size === 'compact' ? 12 : 13, 'currentColor')}
                        <span class="tcf-shortcut-count">${this.checklistCounts.done}/${this.checklistCounts.total}</span>
                    </button>
                </div>
            </div>
        `;
    }

    // ============================================
    // TEAM AVATARS
    // ============================================

    _renderTeamAvatars() {
        const sorted = this._getSortedTeam();
        const visible = sorted.slice(0, this.maxAvatars);
        const overflow = sorted.length - this.maxAvatars;

        let html = visible.map(member => {
            const rolLabel = ROL_LABELS[member.rol] || member.rol || 'Teamlid';
            const kleur = member.avatar_kleur || ROL_KLEUREN[member.rol] || '#94a3b8';
            const initialen = this._getInitials(member);
            const urenText = member.uren ? ` - ${member.uren}u` : '';

            return `
                <span class="tcf-avatar" 
                      style="background: ${kleur}"
                      title="${this._esc(member.naam || '')} (${rolLabel}${urenText})"
                      data-member-id="${member.team_member_id || ''}">
                    ${initialen}
                </span>
            `;
        }).join('');

        if (overflow > 0) {
            html += `
                <span class="tcf-avatar tcf-avatar--overflow" 
                      title="${overflow} meer teamleden">
                    +${overflow}
                </span>
            `;
        }

        // Add-knop
        html += `
            <button class="tcf-avatar tcf-avatar--add" 
                    data-action="edit-team"
                    data-tender-id="${this.tenderId}"
                    title="Team bewerken">
                ${getIcon('plus', this.size === 'compact' ? 10 : 12, 'currentColor')}
            </button>
        `;

        return html;
    }

    // ============================================
    // HELPERS
    // ============================================

    _getSortedTeam() {
        if (!this.teamAssignments || this.teamAssignments.length === 0) return [];

        return [...this.teamAssignments].sort((a, b) => {
            const indexA = ROL_VOLGORDE.indexOf(a.rol) !== -1 ? ROL_VOLGORDE.indexOf(a.rol) : 99;
            const indexB = ROL_VOLGORDE.indexOf(b.rol) !== -1 ? ROL_VOLGORDE.indexOf(b.rol) : 99;
            return indexA - indexB;
        });
    }

    _getInitials(member) {
        if (member.initialen) return member.initialen.toUpperCase();
        const naam = member.naam || '';
        if (!naam) return '??';
        const parts = naam.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    _esc(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
}