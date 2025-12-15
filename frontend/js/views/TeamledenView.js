/**
 * TeamledenView - Overzicht en beheer van teamleden
 * TenderZen v3.1 - Refactored naar externe CSS (table-view.css)
 * 
 * CSS: Gebruikt /css/table-view.css voor styling
 * Geen inline getStyles() - alle styling via externe CSS
 * 
 * CHANGELOG:
 * - v3.1: Refactored naar externe CSS met BEM naming (consistent met BedrijvenView)
 * - v3.0: Account Status badges toegevoegd
 */

import { BaseView } from './BaseView.js';
import { teamService } from '../services/TeamService.js';

const Icons = window.Icons || {};

export class TeamledenView extends BaseView {
    constructor(options = {}) {
        super(options);
        this.teamMembers = [];
        this.filteredMembers = [];
        this.filters = {
            search: '',
            role: null
        };
        this.sortColumn = 'naam';
        this.sortDirection = 'asc';

        this.roles = teamService.getRoles();

        // Callbacks
        this.onCreateMember = null;
        this.onEditMember = null;
        this.onDeleteMember = null;
        this.onInviteMember = null;
        this.onResendInvite = null;
    }

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    async setTeamMembers(members) {
        this.teamMembers = members || [];
        this.applyFilters();
        this.updateHeaderContext();
        if (this.container) {
            this.render();
        }
    }

    async reload() {
        try {
            const members = await teamService.getAllTeamMembers();
            await this.setTeamMembers(members);
        } catch (error) {
            console.error('Error reloading team members:', error);
        }
    }

    updateHeaderContext() {
        if (window.app?.header) {
            window.app.header.setContext('team', {
                count: this.filteredMembers.length,
                filters: this.filters,
                filterOptions: { roles: this.roles },
                onAdd: () => { if (this.onCreateMember) this.onCreateMember(); },
                onFilterChange: (filterType, value) => {
                    if (filterType === 'search') this.setSearch(value);
                    else if (filterType === 'filter1') this.setRoleFilter(value || null);
                },
                onResetFilters: () => this.resetFilters()
            });
        }
    }

    applyFilters() {
        let filtered = [...this.teamMembers];

        if (this.filters.search) {
            const query = this.filters.search.toLowerCase();
            filtered = filtered.filter(m =>
                m.naam?.toLowerCase().includes(query) ||
                m.email?.toLowerCase().includes(query) ||
                m.rol?.toLowerCase().includes(query) ||
                m.functie?.toLowerCase().includes(query)
            );
        }

        if (this.filters.role) {
            filtered = filtered.filter(m => m.rol === this.filters.role);
        }

        filtered.sort((a, b) => {
            let valA = a[this.sortColumn] || '';
            let valB = b[this.sortColumn] || '';
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            let result = valA < valB ? -1 : valA > valB ? 1 : 0;
            return this.sortDirection === 'desc' ? -result : result;
        });

        this.filteredMembers = filtered;
    }

    setSearch(query) {
        this.filters.search = query;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    setRoleFilter(role) {
        this.filters.role = role;
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    resetFilters() {
        this.filters = { search: '', role: null };
        this.applyFilters();
        this.updateHeaderContext();
        this.render();
    }

    sortBy(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.applyFilters();
        this.render();
    }

    /**
     * Main render - Gebruikt externe CSS classes (table-view.css)
     */
    render() {
        if (!this.container) return;

        const sortIcon = (col) => {
            if (this.sortColumn !== col) return '';
            return this.sortDirection === 'asc'
                ? this.getIcon('chevronUp', 12)
                : this.getIcon('chevronDown', 12);
        };

        const sortableClass = (col) => {
            let classes = 'table-view__col table-view__col--sortable';
            if (this.sortColumn === col) classes += ' table-view__col--sorted';
            return classes;
        };

        this.container.innerHTML = `
            <div class="table-view teamleden-view">
                <div class="table-view__headers">
                    <div class="${sortableClass('naam')} table-view__col--main" data-sort="naam">
                        ${this.getIcon('user', 14)}
                        <span>Teamlid</span>
                        ${sortIcon('naam')}
                    </div>
                    <div class="${sortableClass('functie')} table-view__col--md" data-sort="functie">
                        <span>Functie</span>
                        ${sortIcon('functie')}
                    </div>
                    <div class="${sortableClass('rol')} table-view__col--sm" data-sort="rol">
                        <span>Rol</span>
                        ${sortIcon('rol')}
                    </div>
                    <div class="${sortableClass('bureau_naam')} table-view__col--md" data-sort="bureau_naam">
                        ${this.getIcon('building', 14)}
                        <span>Tenderbureau</span>
                        ${sortIcon('bureau_naam')}
                    </div>
                    <div class="table-view__col table-view__col--sm">
                        ${this.getIcon('clock', 14)}
                        <span>Capaciteit</span>
                    </div>
                    <div class="table-view__col table-view__col--sm">
                        <span>Gebruiker</span>
                    </div>
                    <div class="table-view__col table-view__col--md">
                        ${this.getIcon('userCheck', 14)}
                        <span>Account Status</span>
                    </div>
                </div>
                <div class="table-view__body">
                    ${this.filteredMembers.length > 0
                ? this.filteredMembers.map(m => this.renderDataRow(m)).join('')
                : this.renderEmptyState()}
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    renderDataRow(member) {
        const roleConfig = this.roles.find(r => r.key === member.rol) || { label: member.rol || 'Onbekend', color: '#64748b' };
        const avatarColor = member.avatar_kleur || roleConfig.color;
        const initials = member.initialen || this.generateInitials(member.naam);
        const capaciteit = member.capaciteit_uren_per_week || 0;
        const invitationStatus = member.invitation_status || 'not_invited';
        const bureauNaam = member.bureau_naam || member.tenderbureau?.naam || '-';

        // Add inactive class if member is not active
        const inactiveClass = member.is_active === false ? ' teamlid--inactive' : '';

        return `
            <div class="table-view__row${inactiveClass}" data-member-id="${member.id}">
                <div class="table-view__col table-view__col--main">
                    <div class="table-view__avatar" style="background: ${avatarColor}">
                        ${initials}
                    </div>
                    <div class="table-view__info">
                        <div class="table-view__name">${member.naam || 'Onbekend'}</div>
                        <div class="table-view__meta">${member.email || ''}</div>
                    </div>
                </div>
                <div class="table-view__col table-view__col--md">
                    <span class="table-view__text">${member.functie || '-'}</span>
                </div>
                <div class="table-view__col table-view__col--sm">
                    <span class="table-view__tag" style="background: ${roleConfig.color}15; color: ${roleConfig.color}; border: 1px solid ${roleConfig.color}30">
                        ${roleConfig.label}
                    </span>
                </div>
                <div class="table-view__col table-view__col--md">
                    <span class="table-view__text table-view__text--bold">${bureauNaam}</span>
                </div>
                <div class="table-view__col table-view__col--sm">
                    <span class="table-view__text">${capaciteit} uur</span>
                </div>
                <div class="table-view__col table-view__col--sm">
                    <span class="table-view__badge table-view__badge--toggle ${member.is_active === false ? 'table-view__badge--inactive' : 'table-view__badge--active'}" data-action="toggle" data-member-id="${member.id}" title="Klik om status te wijzigen">
                        ${member.is_active === false ? 'Inactief' : 'Actief'}
                    </span>
                </div>
                <div class="table-view__col table-view__col--md">
                    ${this.renderAccountStatusBadge(member, invitationStatus)}
                </div>
            </div>
        `;
    }

    renderAccountStatusBadge(member, status) {
        if (!member.email) {
            return `
                <span class="table-view__badge table-view__badge--muted">
                    ${this.getIcon('mailX', 14)}
                    <span>Geen email</span>
                </span>
            `;
        }

        switch (status) {
            case 'accepted':
                return `
                    <span class="table-view__badge table-view__badge--active">
                        ${this.getIcon('checkCircle', 14)}
                        <span>Actief</span>
                    </span>
                `;

            case 'pending':
                return `
                    <span class="table-view__badge table-view__badge--pending" data-member-id="${member.id}" title="Klik om opnieuw te versturen">
                        ${this.getIcon('clock', 14)}
                        <span>Uitnodiging verstuurd</span>
                        <span class="resend-icon">${this.getIcon('refreshCw', 12)}</span>
                    </span>
                `;

            case 'expired':
                return `
                    <span class="table-view__badge table-view__badge--expired" data-member-id="${member.id}" title="Klik om opnieuw uit te nodigen">
                        ${this.getIcon('alertCircle', 14)}
                        <span>Verlopen</span>
                        <span class="resend-icon">${this.getIcon('refreshCw', 12)}</span>
                    </span>
                `;

            default:
                return `
                    <span class="table-view__badge table-view__badge--inactive">
                        ${this.getIcon('userX', 14)}
                        <span>Niet uitgenodigd</span>
                    </span>
                `;
        }
    }

    renderEmptyState() {
        const hasFilters = this.filters.search || this.filters.role;

        return `
            <div class="table-view__empty">
                <div class="table-view__empty-icon">
                    ${this.getIcon('users', 48, '#94a3b8')}
                </div>
                <h3 class="table-view__empty-title">${hasFilters ? 'Geen resultaten' : 'Nog geen teamleden'}</h3>
                <p class="table-view__empty-text">${hasFilters
                ? 'Probeer andere zoektermen of filters.'
                : 'Voeg je eerste teamlid toe om te beginnen.'}</p>
                ${!hasFilters ? `
                    <button class="table-view__empty-btn" id="btn-create-empty">
                        ${this.getIcon('userPlus', 16)}
                        <span>Eerste teamlid toevoegen</span>
                    </button>
                ` : ''}
            </div>
        `;
    }

    generateInitials(naam) {
        if (!naam) return '??';
        const parts = naam.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Toggle team member active/inactive status
     */
    async toggleMemberStatus(member) {
        try {
            // Optimistic update (update UI immediately)
            const newStatus = !member.is_active;
            member.is_active = newStatus;

            // Find and update the row in DOM
            const row = this.container.querySelector(`[data-member-id="${member.id}"]`);
            if (row) {
                if (newStatus) {
                    row.classList.remove('teamlid--inactive');
                } else {
                    row.classList.add('teamlid--inactive');
                }
            }

            // Update the toggle badge
            const toggleBadge = this.container.querySelector(`.table-view__badge--toggle[data-member-id="${member.id}"]`);
            if (toggleBadge) {
                // Update classes
                if (newStatus) {
                    toggleBadge.classList.remove('table-view__badge--inactive');
                    toggleBadge.classList.add('table-view__badge--active');
                    toggleBadge.textContent = 'Actief';
                } else {
                    toggleBadge.classList.remove('table-view__badge--active');
                    toggleBadge.classList.add('table-view__badge--inactive');
                    toggleBadge.textContent = 'Inactief';
                }
            }

            // Call API to persist
            const statusText = newStatus ? 'geactiveerd' : 'gedeactiveerd';
            console.log(`🔄 ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}: ${member.naam}`);

            await teamService.updateTeamMember(member.id, { is_active: newStatus });
            console.log(`✅ ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}: ${member.naam}`);

        } catch (error) {
            console.error('❌ Error toggling member status:', error);
            // Revert optimistic update on error
            member.is_active = !member.is_active;
            alert('Fout bij updaten van status. Probeer opnieuw.');
            this.render();
        }
    }

    attachEventListeners() {
        // Sort headers
        this.container.querySelectorAll('.table-view__col--sortable').forEach(col => {
            col.addEventListener('click', () => {
                const column = col.dataset.sort;
                if (column) this.sortBy(column);
            });
        });

        // Empty state create button
        const createBtn = this.container.querySelector('#btn-create-empty');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (this.onCreateMember) this.onCreateMember();
            });
        }

        // Toggle status badges (in "Actief" column)
        this.container.querySelectorAll('.table-view__badge--toggle').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const memberId = badge.dataset.memberId;
                const member = this.teamMembers.find(m => m.id === memberId);
                if (member) {
                    this.toggleMemberStatus(member);
                }
            });
        });


        // Pending/Expired badge clicks (resend)
        this.container.querySelectorAll('.table-view__badge--pending, .table-view__badge--expired').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                const memberId = badge.dataset.memberId;
                const member = this.teamMembers.find(m => m.id === memberId);

                if (member && this.onResendInvite) {
                    this.onResendInvite(member);
                }
            });
        });

        // Row click = open edit modal
        this.container.querySelectorAll('.table-view__row').forEach(row => {
            row.addEventListener('click', (e) => {
                // Don't open modal if clicking on badges or special elements
                if (e.target.closest('.table-view__badge--toggle')) return;
                if (e.target.closest('.table-view__badge--pending')) return;
                if (e.target.closest('.table-view__badge--expired')) return;

                const memberId = row.dataset.memberId;
                const member = this.teamMembers.find(m => m.id === memberId);

                if (member && this.onEditMember) {
                    this.onEditMember(member);
                }
            });
        });
    }
}

export default TeamledenView;