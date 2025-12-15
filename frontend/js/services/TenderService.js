/**
 * TeamService - API service voor teamleden
 * TenderZen v2.0
 * 
 * Handles CRUD operations for team members.
 * Row Level Security (RLS) in Supabase ensures users only see
 * team members from their own tenderbureau.
 * 
 * CHANGELOG:
 * - Initial version with full CRUD
 * - Multi-tenancy via tenderbureau_id
 */

import { supabase } from '../config.js';

class TeamService {
    constructor() {
        this.tableName = 'team_members';
    }

    /**
     * Get all team members for current user's tenderbureau
     * RLS automatically filters by tenderbureau_id
     */
    async getAllTeamMembers() {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
                    *,
                    user:users(email, naam),
                    tenderbureau:tenderbureaus(naam)
                `)
                .eq('is_active', true)
                .order('naam', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Error fetching team members:', error);
            throw error;
        }
    }

    /**
     * Get team member by ID
     */
    async getTeamMemberById(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
                    *,
                    user:users(email, naam),
                    tenderbureau:tenderbureaus(naam)
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('❌ Error fetching team member:', error);
            throw error;
        }
    }

    /**
     * Get team members by role
     */
    async getTeamMembersByRole(rol) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('rol', rol)
                .eq('is_active', true)
                .order('naam', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Error fetching team members by role:', error);
            throw error;
        }
    }

    /**
     * Create new team member
     * tenderbureau_id is automatically set based on current user's bureau
     */
    async createTeamMember(teamMemberData) {
        try {
            // Get current user's tenderbureau_id
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('tenderbureau_id')
                .eq('id', (await supabase.auth.getUser()).data.user?.id)
                .single();

            if (userError) throw userError;

            const newMember = {
                ...teamMemberData,
                tenderbureau_id: userData.tenderbureau_id,
                is_active: true,
                created_at: new Date().toISOString()
            };

            // Generate initialen if not provided
            if (!newMember.initialen && newMember.naam) {
                newMember.initialen = this.generateInitials(newMember.naam);
            }

            const { data, error } = await supabase
                .from(this.tableName)
                .insert([newMember])
                .select()
                .single();

            if (error) throw error;
            
            console.log('✅ Team member created:', data);
            return data;
        } catch (error) {
            console.error('❌ Error creating team member:', error);
            throw error;
        }
    }

    /**
     * Update team member
     */
    async updateTeamMember(id, updates) {
        try {
            // Regenerate initialen if naam changed
            if (updates.naam && !updates.initialen) {
                updates.initialen = this.generateInitials(updates.naam);
            }

            const { data, error } = await supabase
                .from(this.tableName)
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            
            console.log('✅ Team member updated:', data);
            return data;
        } catch (error) {
            console.error('❌ Error updating team member:', error);
            throw error;
        }
    }

    /**
     * Soft delete team member (set is_active = false)
     * We don't hard delete to preserve history
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
            
            console.log('✅ Team member deactivated:', data);
            return data;
        } catch (error) {
            console.error('❌ Error deleting team member:', error);
            throw error;
        }
    }

    /**
     * Hard delete team member (permanent)
     * Use with caution - only for cleanup
     */
    async permanentDeleteTeamMember(id) {
        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            console.log('✅ Team member permanently deleted');
            return true;
        } catch (error) {
            console.error('❌ Error permanently deleting team member:', error);
            throw error;
        }
    }

    /**
     * Get team member statistics
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
                totalCapacity
            };
        } catch (error) {
            console.error('❌ Error getting team stats:', error);
            throw error;
        }
    }

    /**
     * Get team workload for a specific week
     */
    async getTeamWorkload(weekStart) {
        try {
            const { data, error } = await supabase
                .from('tender_team_assignments')
                .select(`
                    *,
                    team_member:team_members(naam, initialen, avatar_kleur, capaciteit_uren_per_week),
                    tender:tenders(naam, fase)
                `)
                .eq('week_start', weekStart);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('❌ Error getting team workload:', error);
            throw error;
        }
    }

    /**
     * Generate initials from name
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
     * Available roles
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
}

// Export singleton instance
export const teamService = new TeamService();
export default teamService;