/**
 * TenderbureausService
 * Service voor het beheren van tenderbureaus (multi-tenant management)
 * 
 * v1.1 FIX: updated_at is nu optioneel (wordt door database trigger gezet indien aanwezig)
 */

import { supabase } from '../config.js';

class TenderbureausService {
    constructor() {
        this.bureaus = [];
        this.loaded = false;
        this._superAdminCache = null;
        this._superAdminCacheTime = null;
    }

    /**
     * Get all tenderbureaus with statistics
     */
    async getAllBureaus() {
        try {
            console.log('🏢 Loading all tenderbureaus...');

            const { data: bureaus, error } = await supabase
                .from('tenderbureaus')
                .select('*')
                .order('naam');

            if (error) throw error;

            // Get statistics for each bureau
            const bureausWithStats = await Promise.all(
                bureaus.map(async (bureau) => {
                    const stats = await this.getBureauStats(bureau.id);
                    return { ...bureau, ...stats };
                })
            );

            this.bureaus = bureausWithStats;
            this.loaded = true;

            console.log(`✅ ${bureausWithStats.length} tenderbureaus geladen`);
            return bureausWithStats;

        } catch (error) {
            console.error('❌ Error loading tenderbureaus:', error);
            throw error;
        }
    }

    /**
     * Get statistics for a bureau
     */
    async getBureauStats(bureauId) {
        try {
            // Count users
            const { count: usersCount } = await supabase
                .from('users')
                .select('*', { count: 'exact', head: true })
                .eq('tenderbureau_id', bureauId)
                .eq('is_active', true);

            // Count tenders
            const { count: tendersCount } = await supabase
                .from('tenders')
                .select('*', { count: 'exact', head: true })
                .eq('tenderbureau_id', bureauId);

            // Count bedrijven
            const { count: bedrijvenCount } = await supabase
                .from('bedrijven')
                .select('*', { count: 'exact', head: true })
                .eq('tenderbureau_id', bureauId)
                .eq('is_actief', true);

            return {
                users_count: usersCount || 0,
                tenders_count: tendersCount || 0,
                bedrijven_count: bedrijvenCount || 0
            };

        } catch (error) {
            console.warn('Could not get bureau stats:', error);
            return {
                users_count: 0,
                tenders_count: 0,
                bedrijven_count: 0
            };
        }
    }

    /**
     * Get a single bureau by ID
     */
    async getBureau(id) {
        try {
            const { data, error } = await supabase
                .from('tenderbureaus')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            const stats = await this.getBureauStats(id);
            return { ...data, ...stats };

        } catch (error) {
            console.error('❌ Error loading bureau:', error);
            throw error;
        }
    }

    /**
     * Create a new tenderbureau
     */
    async createBureau(bureauData) {
        try {
            console.log('🏢 Creating new tenderbureau:', bureauData.naam);

            // Check if slug is unique
            const slugExists = await this.checkSlugExists(bureauData.slug);
            if (slugExists) {
                throw new Error(`Slug "${bureauData.slug}" is al in gebruik`);
            }

            const { data, error } = await supabase
                .from('tenderbureaus')
                .insert([{
                    naam: bureauData.naam,
                    slug: bureauData.slug,
                    email: bureauData.email || null,
                    telefoon: bureauData.telefoon || null,
                    website: bureauData.website || null,
                    adres: bureauData.adres || null,
                    postcode: bureauData.postcode || null,
                    plaats: bureauData.plaats || null,
                    subscription_tier: bureauData.subscription_tier || 'free',
                    max_users: bureauData.max_users || 5,
                    is_active: bureauData.is_active !== false,
                    settings: bureauData.settings || {}
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Tenderbureau created:', data.naam);
            
            // Refresh cache
            this.loaded = false;
            
            return data;

        } catch (error) {
            console.error('❌ Error creating bureau:', error);
            throw error;
        }
    }

    /**
     * Update a tenderbureau
     * FIX v1.1: updated_at wordt niet meer expliciet meegegeven (database trigger handelt dit af)
     */
    async updateBureau(id, bureauData) {
        try {
            console.log('🏢 Updating tenderbureau:', id);

            // Check if slug is unique (excluding current bureau)
            if (bureauData.slug) {
                const slugExists = await this.checkSlugExists(bureauData.slug, id);
                if (slugExists) {
                    throw new Error(`Slug "${bureauData.slug}" is al in gebruik`);
                }
            }

            // Build update object - only include fields that are provided
            const updateData = {};
            
            if (bureauData.naam !== undefined) updateData.naam = bureauData.naam;
            if (bureauData.slug !== undefined) updateData.slug = bureauData.slug;
            if (bureauData.email !== undefined) updateData.email = bureauData.email || null;
            if (bureauData.telefoon !== undefined) updateData.telefoon = bureauData.telefoon || null;
            if (bureauData.website !== undefined) updateData.website = bureauData.website || null;
            if (bureauData.adres !== undefined) updateData.adres = bureauData.adres || null;
            if (bureauData.postcode !== undefined) updateData.postcode = bureauData.postcode || null;
            if (bureauData.plaats !== undefined) updateData.plaats = bureauData.plaats || null;
            if (bureauData.subscription_tier !== undefined) updateData.subscription_tier = bureauData.subscription_tier;
            if (bureauData.max_users !== undefined) updateData.max_users = bureauData.max_users;
            if (bureauData.is_active !== undefined) updateData.is_active = bureauData.is_active;
            if (bureauData.settings !== undefined) updateData.settings = bureauData.settings || {};

            // NOTE: updated_at is NOT included - let the database trigger handle it
            // If you don't have a trigger, run this SQL in Supabase:
            // ALTER TABLE tenderbureaus ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

            const { data, error } = await supabase
                .from('tenderbureaus')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Tenderbureau updated:', data.naam);
            
            // Refresh cache
            this.loaded = false;
            
            return data;

        } catch (error) {
            console.error('❌ Error updating bureau:', error);
            throw error;
        }
    }

    /**
     * Soft delete (deactivate) a tenderbureau
     */
    async deactivateBureau(id) {
        try {
            console.log('🏢 Deactivating tenderbureau:', id);

            const { error } = await supabase
                .from('tenderbureaus')
                .update({ is_active: false })
                .eq('id', id);

            if (error) throw error;

            console.log('✅ Tenderbureau deactivated');
            
            // Refresh cache
            this.loaded = false;
            
            return true;

        } catch (error) {
            console.error('❌ Error deactivating bureau:', error);
            throw error;
        }
    }

    /**
     * Alias for backwards compatibility
     */
    async deleteBureau(id) {
        return this.deactivateBureau(id);
    }

    /**
     * Check if slug exists
     */
    async checkSlugExists(slug, excludeId = null) {
        try {
            let query = supabase
                .from('tenderbureaus')
                .select('id')
                .eq('slug', slug);

            if (excludeId) {
                query = query.neq('id', excludeId);
            }

            const { data, error } = await query;

            if (error) throw error;

            return data && data.length > 0;

        } catch (error) {
            console.error('Error checking slug:', error);
            return false;
        }
    }

    /**
     * Get users for a bureau
     */
    async getUsersForBureau(bureauId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('tenderbureau_id', bureauId)
                .order('naam');

            if (error) throw error;

            return data;

        } catch (error) {
            console.error('❌ Error loading bureau users:', error);
            throw error;
        }
    }

    /**
     * Validate slug format
     */
    validateSlug(slug) {
        const slugRegex = /^[a-z0-9-]+$/;
        return slugRegex.test(slug);
    }

    /**
     * Validate email format
     */
    validateEmail(email) {
        if (!email) return true; // Email is optional
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Generate slug from name
     */
    generateSlug(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
    }

    /**
     * Get subscription tiers
     */
    getSubscriptionTiers() {
        return [
            { value: 'free', label: 'Free', maxUsers: 2 },
            { value: 'basic', label: 'Basic', maxUsers: 5 },
            { value: 'professional', label: 'Professional', maxUsers: 10 },
            { value: 'enterprise', label: 'Enterprise', maxUsers: 999 }
        ];
    }

    /**
     * Check if current user is super-admin
     * Super-admin = platform eigenaar, kan alle tenderbureaus beheren
     */
    async isSuperAdmin() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('🔐 No user logged in');
                return false;
            }

            // Use maybeSingle() instead of single() to avoid error when no rows
            const { data: userData, error } = await supabase
                .from('users')
                .select('is_super_admin')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('❌ Error checking super-admin:', error);
                return false;
            }

            // If no user record found, or is_super_admin is not set
            if (!userData) {
                console.log('🔐 No user record found in users table');
                return false;
            }

            const isSuperAdmin = userData.is_super_admin === true;
            console.log('🔐 Super-admin check:', isSuperAdmin);
            return isSuperAdmin;

        } catch (error) {
            console.error('❌ Error checking super-admin:', error);
            return false;
        }
    }

    /**
     * Check super-admin with caching (5 minutes)
     */
    async isSuperAdminCached() {
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minuten
        
        if (this._superAdminCache !== null && 
            this._superAdminCacheTime && 
            Date.now() - this._superAdminCacheTime < CACHE_DURATION) {
            return this._superAdminCache;
        }

        this._superAdminCache = await this.isSuperAdmin();
        this._superAdminCacheTime = Date.now();
        return this._superAdminCache;
    }

    /**
     * Clear super-admin cache (bij logout etc)
     */
    clearSuperAdminCache() {
        this._superAdminCache = null;
        this._superAdminCacheTime = null;
    }

    /**
     * Get current user's tenderbureau ID
     */
    async getCurrentTenderbureauId() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data, error } = await supabase
                .from('users')
                .select('tenderbureau_id')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error getting tenderbureau_id:', error);
                return null;
            }

            return data?.tenderbureau_id || null;

        } catch (error) {
            console.error('Error getting current tenderbureau:', error);
            return null;
        }
    }
}

// Export singleton instance
export const tenderbureausService = new TenderbureausService();
export default tenderbureausService;