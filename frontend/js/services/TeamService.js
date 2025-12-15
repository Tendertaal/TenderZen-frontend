/**
 * TeamService - API service voor teamleden
 * TenderZen v2.0 - Multi-Tenancy Support
 * 
 * Handles CRUD operations for team members.
 * Row Level Security (RLS) in Supabase ensures users only see
 * team members from their own tenderbureau.
 * 
 * MULTI-TENANCY:
 * - Alle queries worden gefilterd op tenderbureau_id via RLS
 * - Extra client-side filtering op huidig bureau (defense in depth)
 * - Bij CREATE wordt automatisch de juiste tenderbureau_id toegevoegd
 * 
 * CHANGELOG:
 * - v1.0: Initial version with full CRUD
 * - v2.0: Multi-tenancy fix - explicit bureau filtering + BureauAccessService
 */

import { supabase } from '/js/config.js';
import { bureauAccessService } from '/js/services/BureauAccessService.js';

class TeamService {
    constructor() {
        this.tableName = 'team_members';
        this._cache = null;
        this._cacheTimestamp = null;
        this._cacheDuration = 5 * 60 * 1000; // 5 minuten cache
    }

    // =========================================================
    // READ OPERATIONS
    // =========================================================

    /**
     * Get all team members for current user's tenderbureau
     * RLS automatically filters by tenderbureau_id
     * 
     * @param {boolean} forceRefresh - Skip cache
     * @returns {Promise<Array>}
     */
    async getAllTeamMembers(forceRefresh = false) {
        try {
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

            let query = supabase
                .from(this.tableName)
                .select(`
                    *,
                    user:users(email, naam, avatar_url),
                    tenderbureau:tenderbureaus(id, naam)
                `)
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

            console.log(`✅ Loaded ${this._cache.length} team members`);
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
     * Get team member by ID
     * @param {string} id - UUID
     * @returns {Promise<Object|null>}
     */
    async getTeamMemberById(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
                    *,
                    user:users(email, naam, avatar_url),
                    tenderbureau:tenderbureaus(id, naam)
                `)
                .eq('id', id)
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
     * @param {string} rol - Role name
     * @returns {Promise<Array>}
     */
    async getTeamMembersByRole(rol) {
        try {
            const currentBureau = bureauAccessService.getCurrentBureau();

            let query = supabase
                .from(this.tableName)
                .select('*')
                .eq('rol', rol)
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
                .or(`naam.ilike.${search},email.ilike.${search},rol.ilike.${search}`)
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
    // CREATE OPERATIONS
    // =========================================================

    /**
     * Create new team member
     * tenderbureau_id is automatically set based on current bureau
     * 
     * @param {Object} teamMemberData - Team member data
     * @returns {Promise<Object>}
     */
    async createTeamMember(teamMemberData) {
        try {
            // Get current user
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error('Niet ingelogd');

            // Get current bureau
            const currentBureau = bureauAccessService.getCurrentBureau();
            if (!currentBureau?.bureau_id) {
                throw new Error('Geen tenderbureau geselecteerd');
            }

            const newMember = {
                ...teamMemberData,
                tenderbureau_id: currentBureau.bureau_id,
                is_active: true,
                created_at: new Date().toISOString()
            };

            // Generate initialen if not provided
            if (!newMember.initialen && newMember.naam) {
                newMember.initialen = this.generateInitials(newMember.naam);
            }

            // Set default avatar color if not provided
            if (!newMember.avatar_kleur) {
                newMember.avatar_kleur = this.getRandomAvatarColor();
            }

            const { data, error } = await supabase
                .from(this.tableName)
                .insert([newMember])
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            this._cache = null;
            this._cacheTimestamp = null;

            console.log('✅ Team member created:', data.naam);
            return data;

        } catch (error) {
            console.error('❌ Error creating team member:', error);
            throw error;
        }
    }

    // =========================================================
    // UPDATE OPERATIONS
    // =========================================================

    /**
     * Update team member
     * @param {string} id - UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<Object>}
     */
    async updateTeamMember(id, updates) {
        try {
            // Regenerate initialen if naam changed
            if (updates.naam && !updates.initialen) {
                updates.initialen = this.generateInitials(updates.naam);
            }

            // Remove fields that shouldn't be updated
            const updateData = { ...updates };
            delete updateData.id;
            delete updateData.tenderbureau_id;
            delete updateData.created_at;

            const { data, error } = await supabase
                .from(this.tableName)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            this._cache = null;
            this._cacheTimestamp = null;

            console.log('✅ Team member updated:', data.naam);
            return data;

        } catch (error) {
            console.error('❌ Error updating team member:', error);
            throw error;
        }
    }

    // =========================================================
    // DELETE OPERATIONS
    // =========================================================

    /**
     * Soft delete team member (set is_active = false)
     * We don't hard delete to preserve history
     * 
     * @param {string} id - UUID
     * @returns {Promise<Object>}
     */
    async deleteTeamMember(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .update({ is_active: false })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            this._cache = null;
            this._cacheTimestamp = null;

            console.log('✅ Team member deactivated:', data.naam);
            return data;

        } catch (error) {
            console.error('❌ Error deleting team member:', error);
            throw error;
        }
    }

    /**
     * Hard delete team member (permanent)
     * Use with caution - only for cleanup
     * 
     * @param {string} id - UUID
     * @returns {Promise<boolean>}
     */
    async permanentDeleteTeamMember(id) {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) throw error;

            // Invalidate cache
            this._cache = null;
            this._cacheTimestamp = null;

            console.log('✅ Team member permanently deleted');
            return true;

        } catch (error) {
            console.error('❌ Error permanently deleting team member:', error);
            throw error;
        }
    }

    /**
     * Restore a deleted team member
     * @param {string} id - UUID
     * @returns {Promise<Object>}
     */
    async restoreTeamMember(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .update({ is_active: true })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Invalidate cache
            this._cache = null;
            this._cacheTimestamp = null;

            console.log('✅ Team member restored:', data.naam);
            return data;

        } catch (error) {
            console.error('❌ Error restoring team member:', error);
            throw error;
        }
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

            // Count by role
            const byRole = {};
            members.forEach(m => {
                const rol = m.rol || 'Onbekend';
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
     * @param {string} weekStart - ISO date string
     * @returns {Promise<Array>}
     */
    async getTeamWorkload(weekStart) {
        try {
            const currentBureau = bureauAccessService.getCurrentBureau();

            // Get assignments with tender info
            let query = supabase
                .from('tender_team_assignments')
                .select(`
                    *,
                    team_member:team_members(id, naam, initialen, avatar_kleur, capaciteit_uren_per_week, tenderbureau_id),
                    tender:tenders(id, naam, fase, tenderbureau_id)
                `)
                .eq('week_start', weekStart);

            const { data, error } = await query;

            if (error) throw error;

            // Filter on current bureau (via team_member's bureau)
            let filtered = data || [];
            if (currentBureau?.bureau_id) {
                filtered = filtered.filter(item =>
                    item.team_member?.tenderbureau_id === currentBureau.bureau_id
                );
            }

            return filtered;

        } catch (error) {
            console.error('❌ Error getting team workload:', error);
            throw error;
        }
    }

    /**
     * Get tender assignments for a team member
     * @param {string} teamMemberId - UUID
     * @returns {Promise<Array>}
     */
    async getTeamMemberAssignments(teamMemberId) {
        try {
            const { data, error } = await supabase
                .from('tender_team_assignments')
                .select(`
                    *,
                    tender:tenders(id, naam, fase, deadline_indiening)
                `)
                .eq('team_member_id', teamMemberId)
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

        // First letter of first name + first letter of last name
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