/**
 * TeamService - API service voor teamleden
 * TenderZen v3.0 - v_bureau_team Migration
 * 
 * CRITICAL UPDATE v3.0 (2026-02-20):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ✅ MIGRATIE: team_members tabel → v_bureau_team view
 * ✅ Single Source of Truth: user_bureau_access + users
 * ✅ Field mapping: id → user_id, rol → bureau_rol
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Row Level Security (RLS) in Supabase ensures users only see
 * team members from their own tenderbureau.
 * 
 * MULTI-TENANCY:
 * - Alle queries worden gefilterd op tenderbureau_id via RLS
 * - Extra client-side filtering op huidig bureau (defense in depth)
 * - v_bureau_team view filtert automatisch op is_active = true
 * 
 * CHANGELOG:
 * - v1.0: Initial version with full CRUD
 * - v2.0: Multi-tenancy fix - explicit bureau filtering
 * - v3.0: Migration to v_bureau_team view (team_members removed)
 */

import { supabase } from '/js/config.js';
import { bureauAccessService } from '/js/services/BureauAccessService.js';

class TeamService {
    constructor() {
        // ✅ v3.0: Use view instead of table
        this.tableName = 'v_bureau_team';
        this._cache = null;
        this._cacheTimestamp = null;
        this._cacheDuration = 5 * 60 * 1000; // 5 minuten cache
    }

    // =========================================================
    // READ OPERATIONS
    // =========================================================

    /**
     * Get all team members for current user's tenderbureau
     * Uses v_bureau_team view (automatically filters on is_active)
     * 
     * @param {boolean} forceRefresh - Skip cache
     * @returns {Promise<Array>}
     */
    async getAllTeamMembers(forceRefresh = false) {
        try {
            if (forceRefresh) {
                console.log('🚨 forceRefresh=true: Ignoring cache, fetching fresh team members');
            }
            // Check cache
            if (!forceRefresh && this._cache && this._cacheTimestamp) {
                const age = Date.now() - this._cacheTimestamp;
                if (age < this._cacheDuration) {
                    console.log('📦 Returning cached team members');
                    return this._cache;
                }
            }

            // Get current bureau for explicit filtering (defense in depth)
            const currentBureau = bureauAccessService.getCurrentBureau();

            // ✅ v3.0: Simplified query - view provides all needed data
            let query = supabase
                .from(this.tableName)
                .select('*')
                .order('naam', { ascending: true });

            // Extra filter op huidig bureau
            if (currentBureau?.bureau_id) {
                query = query.eq('tenderbureau_id', currentBureau.bureau_id);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Update cache
            this._cache = data || [];
            this._cacheTimestamp = Date.now();

            console.log(`✅ Loaded ${this._cache.length} team members from v_bureau_team`);
            return this._cache;

        } catch (error) {
            console.error('❌ Error fetching team members:', error);
            throw error;
        }
    }

    /**
     * Load team members into cache (call at app init)
     */
    async loadTeamMembers() {
        return this.getAllTeamMembers(true);
    }

    /**
     * Refresh cache
     */
    async refresh() {
        this._cache = null;
        this._cacheTimestamp = null;
        return this.getAllTeamMembers(true);
    }

    /**
     * Get team member by user_id
     * ✅ v3.0: Uses user_id instead of id
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<Object|null>}
     */
    async getTeamMemberById(userId) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('user_id', userId)  // ← Changed from 'id' to 'user_id'
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return null;
                }
                throw error;
            }
            return data;

        } catch (error) {
            console.error('❌ Error fetching team member:', error);
            throw error;
        }
    }

    /**
     * Get team members by role
     * ✅ v3.0: Uses bureau_rol instead of rol
     * 
     * @param {string} rol - Role name
     * @returns {Promise<Array>}
     */
    async getTeamMembersByRole(rol) {
        try {
            const currentBureau = bureauAccessService.getCurrentBureau();

            let query = supabase
                .from(this.tableName)
                .select('*')
                .eq('bureau_rol', rol)  // ← Changed from 'rol' to 'bureau_rol'
                .order('naam', { ascending: true });

            if (currentBureau?.bureau_id) {
                query = query.eq('tenderbureau_id', currentBureau.bureau_id);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('❌ Error fetching team members by role:', error);
            throw error;
        }
    }

    /**
     * Search team members
     * @param {string} searchQuery - Search query
     * @returns {Promise<Array>}
     */
    async searchTeamMembers(searchQuery) {
        try {
            if (!searchQuery || searchQuery.length < 2) {
                return this._cache || await this.getAllTeamMembers();
            }

            const currentBureau = bureauAccessService.getCurrentBureau();
            const search = `%${searchQuery.toLowerCase()}%`;

            let query = supabase
                .from(this.tableName)
                .select('*')
                .or(`naam.ilike.${search},email.ilike.${search},bureau_rol.ilike.${search}`)  // ← bureau_rol
                .order('naam', { ascending: true });

            if (currentBureau?.bureau_id) {
                query = query.eq('tenderbureau_id', currentBureau.bureau_id);
            }

            const { data, error } = await query;

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('❌ Error searching team members:', error);
            throw error;
        }
    }

    // =========================================================
    // CREATE OPERATIONS - NOT SUPPORTED via VIEW
    // =========================================================

    /**
     * Create new team member
     * ⚠️ v3.0: Use user_bureau_access table instead
     * This method is deprecated - use backend API or direct user_bureau_access insert
     */
    async createTeamMember(teamMemberData) {
        console.error('❌ createTeamMember is deprecated in v3.0');
        console.error('ℹ️ Use user_bureau_access table or backend API instead');
        throw new Error(
            'Creating team members via v_bureau_team view is not supported. ' +
            'Use user_bureau_access table or backend API.'
        );
    }

    // =========================================================
    // UPDATE OPERATIONS - NOT SUPPORTED via VIEW
    // =========================================================

    /**
     * Update team member
     * ⚠️ v3.0: Update user_bureau_access or users table instead
     */
    async updateTeamMember(id, updates) {
        console.error('❌ updateTeamMember is deprecated in v3.0');
        console.error('ℹ️ Update user_bureau_access or users table instead');
        throw new Error(
            'Updating team members via v_bureau_team view is not supported. ' +
            'Update user_bureau_access or users table directly.'
        );
    }

    // =========================================================
    // DELETE OPERATIONS - NOT SUPPORTED via VIEW
    // =========================================================

    /**
     * Soft delete team member
     * ⚠️ v3.0: Update user_bureau_access.is_active instead
     */
    async deleteTeamMember(id) {
        console.error('❌ deleteTeamMember is deprecated in v3.0');
        console.error('ℹ️ Set is_active = false in user_bureau_access instead');
        throw new Error(
            'Deleting team members via v_bureau_team view is not supported. ' +
            'Update user_bureau_access.is_active instead.'
        );
    }

    /**
     * Hard delete - NOT SUPPORTED
     */
    async permanentDeleteTeamMember(id) {
        throw new Error('Hard delete not supported via v_bureau_team view');
    }

    /**
     * Restore - NOT SUPPORTED
     */
    async restoreTeamMember(id) {
        throw new Error('Restore not supported via v_bureau_team view');
    }

    // =========================================================
    // STATISTICS
    // =========================================================

    /**
     * Get team member statistics
     * @returns {Promise<Object>}
     */
    async getTeamStats() {
        try {
            const members = await this.getAllTeamMembers();

            // Count by role (using bureau_rol)
            const byRole = {};
            members.forEach(m => {
                const rol = m.bureau_rol || 'Onbekend';
                byRole[rol] = (byRole[rol] || 0) + 1;
            });

            // Total capacity
            const totalCapacity = members.reduce((sum, m) => sum + (m.capaciteit_uren_per_week || 0), 0);

            return {
                total: members.length,
                byRole,
                totalCapacity,
                averageCapacity: members.length > 0
                    ? Math.round(totalCapacity / members.length)
                    : 0
            };

        } catch (error) {
            console.error('❌ Error getting team stats:', error);
            throw error;
        }
    }

    /**
     * Get team workload for a specific week
     * ✅ v3.0: Updated to use user_id
     * 
     * @param {string} weekStart - ISO date string
     * @returns {Promise<Array>}
     */
    async getTeamWorkload(weekStart) {
        try {
            const currentBureau = bureauAccessService.getCurrentBureau();

            // ✅ v3.0: Query tender_team_assignments with user info
            let query = supabase
                .from('tender_team_assignments')
                .select(`
                    *,
                    tender:tenders(id, naam, fase, tenderbureau_id)
                `)
                .eq('week_start', weekStart);

            const { data, error } = await query;

            if (error) throw error;

            // Get user IDs
            const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))];

            // Fetch user details separately
            let users = {};
            if (userIds.length > 0) {
                const { data: userData } = await supabase
                    .from('v_bureau_team')
                    .select('*')
                    .in('user_id', userIds);

                users = Object.fromEntries((userData || []).map(u => [u.user_id, u]));
            }

            // Combine data
            let enriched = (data || []).map(item => ({
                ...item,
                team_member: users[item.user_id] || null
            }));

            // Filter on current bureau
            if (currentBureau?.bureau_id) {
                enriched = enriched.filter(item =>
                    item.team_member?.tenderbureau_id === currentBureau.bureau_id
                );
            }

            return enriched;

        } catch (error) {
            console.error('❌ Error getting team workload:', error);
            throw error;
        }
    }

    /**
     * Get tender assignments for a team member
     * ✅ v3.0: Uses user_id
     * 
     * @param {string} userId - User UUID
     * @returns {Promise<Array>}
     */
    async getTeamMemberAssignments(userId) {
        try {
            const { data, error } = await supabase
                .from('tender_team_assignments')
                .select(`
                    *,
                    tender:tenders(id, naam, fase, deadline_indiening)
                `)
                .eq('user_id', userId)  // ← Changed from team_member_id to user_id
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('❌ Error getting team member assignments:', error);
            throw error;
        }
    }

    // =========================================================
    // HELPERS
    // =========================================================

    /**
     * Generate initials from name
     * @param {string} naam - Full name
     * @returns {string}
     */
    generateInitials(naam) {
        if (!naam) return '??';

        const parts = naam.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }

        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Get a random avatar color
     * @returns {string}
     */
    getRandomAvatarColor() {
        const colors = this.getAvatarColors();
        return colors[Math.floor(Math.random() * colors.length)].key;
    }

    /**
     * Available roles
     * @returns {Array}
     */
    getRoles() {
        return [
            { key: 'sales', label: 'Sales', color: '#f59e0b' },
            { key: 'manager', label: 'Manager', color: '#ec4899' },
            { key: 'coordinator', label: 'Coördinator', color: '#8b5cf6' },
            { key: 'schrijver', label: 'Schrijver', color: '#3b82f6' },
            { key: 'designer', label: 'Designer', color: '#10b981' },
            { key: 'klant_contact', label: 'Klant contact', color: '#06b6d4' },
            { key: 'calculator', label: 'Calculator', color: '#6366f1' },
            { key: 'reviewer', label: 'Reviewer', color: '#84cc16' }
        ];
    }

    /**
     * Available avatar colors
     * @returns {Array}
     */
    getAvatarColors() {
        return [
            { key: '#ec4899', label: 'Roze' },
            { key: '#3b82f6', label: 'Blauw' },
            { key: '#8b5cf6', label: 'Paars' },
            { key: '#10b981', label: 'Groen' },
            { key: '#f59e0b', label: 'Amber' },
            { key: '#06b6d4', label: 'Cyan' },
            { key: '#ef4444', label: 'Rood' },
            { key: '#6366f1', label: 'Indigo' }
        ];
    }

    /**
     * Clear cache (for logout or bureau switch)
     */
    clearCache() {
        this._cache = null;
        this._cacheTimestamp = null;
    }
}

// Export singleton instance
export const teamService = new TeamService();
export default teamService;