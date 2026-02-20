/**
 * UserResolutionHelper.js
 * 
 * Hulpfuncties voor het resolven van user IDs naar user details.
 * Gebruikt door PlanningModal, KanbanView, AgendaView voor consistent user display.
 * 
 * PHILOSOPHY: User IDs in database, user details resolved client-side.
 * Dit voorkomt stale data en duplicate storage.
 */

export class UserResolutionHelper {
    constructor(teamMembers = []) {
        this.teamMembers = teamMembers;
        this.userCache = new Map();
        this._buildCache();
    }

    /**
     * Build internal cache voor snelle lookups
     */
    _buildCache() {
        this.userCache.clear();
        for (const member of this.teamMembers) {
            if (member.id) {
                this.userCache.set(member.id, member);
            }
        }
    }

    /**
     * Update team members lijst en rebuild cache
     */
    updateTeamMembers(teamMembers) {
        this.teamMembers = teamMembers;
        this._buildCache();
    }

    /**
     * Resolve single user ID naar user object
     * 
     * @param {string} userId - User UUID
     * @returns {Object|null} User object of null als niet gevonden
     */
    getUserById(userId) {
        if (!userId) return null;
        return this.userCache.get(userId) || null;
    }

    /**
     * Resolve array van user IDs naar array van user objects
     * 
     * @param {Array<string>} userIds - Array van user UUIDs
     * @returns {Array<Object>} Array van user objects (skips niet-gevonden IDs)
     */
    getUsersByIds(userIds) {
        if (!Array.isArray(userIds)) return [];
        return userIds
            .map(id => this.getUserById(id))
            .filter(Boolean);
    }

    /**
     * Get user display naam
     * 
     * @param {string} userId - User UUID
     * @returns {string} User naam of fallback
     */
    getUserName(userId) {
        const user = this.getUserById(userId);
        return user ? user.naam : 'Niet toegewezen';
    }

    /**
     * Get user initialen voor avatar
     * 
     * @param {string} userId - User UUID
     * @returns {string} Initialen (bijv. "JD") of "?"
     */
    getUserInitials(userId) {
        const user = this.getUserById(userId);
        if (!user) return '?';
        
        if (user.initialen) return user.initialen;
        
        // Fallback: genereer uit naam
        const parts = (user.naam || '').split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return (user.naam || '?')[0].toUpperCase();
    }

    /**
     * Get user avatar kleur
     * 
     * @param {string} userId - User UUID
     * @returns {string} Hex kleur code
     */
    getUserColor(userId) {
        const user = this.getUserById(userId);
        return user?.avatar_kleur || '#6b7280'; // Gray fallback
    }

    /**
     * Format user(s) voor display in UI
     * 
     * @param {Array<string>|string} userIds - Single ID of array van IDs
     * @returns {string} Formatted string (bijv. "Rick, Nathalie" of "Rick +2")
     */
    formatUserNames(userIds) {
        if (!userIds) return 'Niet toegewezen';
        
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        if (ids.length === 0) return 'Niet toegewezen';
        
        const users = this.getUsersByIds(ids);
        if (users.length === 0) return 'Onbekende gebruiker';
        
        if (users.length === 1) {
            return users[0].naam;
        }
        
        if (users.length === 2) {
            return `${users[0].naam}, ${users[1].naam}`;
        }
        
        // 3+ users: "Eerste +2"
        return `${users[0].naam} +${users.length - 1}`;
    }

    /**
     * Render avatar HTML voor single user
     * 
     * @param {string} userId - User UUID
     * @param {string} size - 'sm' | 'md' | 'lg'
     * @returns {string} HTML string
     */
    renderAvatar(userId, size = 'md') {
        const user = this.getUserById(userId);
        const initialen = this.getUserInitials(userId);
        const color = this.getUserColor(userId);
        const naam = this.getUserName(userId);
        
        const sizeClasses = {
            sm: 'w-6 h-6 text-xs',
            md: 'w-8 h-8 text-sm',
            lg: 'w-10 h-10 text-base'
        };
        
        return `
            <div 
                class="inline-flex items-center justify-center rounded-full font-medium text-white ${sizeClasses[size]}"
                style="background-color: ${color}"
                title="${naam}"
            >
                ${initialen}
            </div>
        `;
    }

    /**
     * Render avatar stack voor multiple users
     * 
     * @param {Array<string>} userIds - Array van user UUIDs
     * @param {number} maxVisible - Maximum aantal visible avatars
     * @returns {string} HTML string
     */
    renderAvatarStack(userIds, maxVisible = 3) {
        if (!Array.isArray(userIds) || userIds.length === 0) {
            return '<span class="text-gray-500 text-sm">Niet toegewezen</span>';
        }
        
        const visibleIds = userIds.slice(0, maxVisible);
        const remaining = Math.max(0, userIds.length - maxVisible);
        
        let html = '<div class="flex -space-x-2">';
        
        for (const userId of visibleIds) {
            const initialen = this.getUserInitials(userId);
            const color = this.getUserColor(userId);
            const naam = this.getUserName(userId);
            
            html += `
                <div 
                    class="inline-flex items-center justify-center w-8 h-8 rounded-full font-medium text-white text-sm border-2 border-white"
                    style="background-color: ${color}"
                    title="${naam}"
                >
                    ${initialen}
                </div>
            `;
        }
        
        if (remaining > 0) {
            html += `
                <div 
                    class="inline-flex items-center justify-center w-8 h-8 rounded-full font-medium text-gray-700 text-sm border-2 border-white bg-gray-200"
                    title="${remaining} meer"
                >
                    +${remaining}
                </div>
            `;
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Check of een user bestaat in de team lijst
     * 
     * @param {string} userId - User UUID
     * @returns {boolean}
     */
    userExists(userId) {
        return this.userCache.has(userId);
    }

    /**
     * Get alle users met een specifieke rol (uit categorie mapping)
     * 
     * @param {string} rol - Rol naam (bijv. 'schrijver', 'calculator')
     * @returns {Array<Object>} Array van users
     */
    getUsersByRole(rol) {
        // Dit vereist dat teamMembers een rol_in_tender field heeft
        return this.teamMembers.filter(m => m.rol_in_tender === rol);
    }
}

// Singleton pattern voor global access
let globalUserResolver = null;

export function initUserResolver(teamMembers) {
    globalUserResolver = new UserResolutionHelper(teamMembers);
    return globalUserResolver;
}

export function getUserResolver() {
    if (!globalUserResolver) {
        console.warn('UserResolver not initialized, creating empty instance');
        globalUserResolver = new UserResolutionHelper([]);
    }
    return globalUserResolver;
}

// Convenience exports voor direct gebruik
export function getUserName(userId) {
    return getUserResolver().getUserName(userId);
}

export function renderAvatar(userId, size = 'md') {
    return getUserResolver().renderAvatar(userId, size);
}

export function renderAvatarStack(userIds, maxVisible = 3) {
    return getUserResolver().renderAvatarStack(userIds, maxVisible);
}