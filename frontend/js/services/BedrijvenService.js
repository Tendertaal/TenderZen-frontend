/**
 * BedrijvenService - CRM functionaliteit voor bedrijvenbeheer
 * TenderZen v3.2 - Async Duplicate Check Migration
 * 
 * ✅ Multi-tenancy ready: RLS automatically filters by tenderbureau_id
 * ✅ Multi-bureau support: Uses current selected bureau for create operations
 * ✅ Duplicaat detectie: Database-based async checks (KvK, BTW)
 * 
 * DEPRECATION NOTICE v3.2:
 * - checkDuplicaatKvK() → Use checkDuplicaat({ kvk_nummer })
 * - checkDuplicaatBTW() → Use checkDuplicaat({ btw_nummer })
 * - checkDuplicaatNaamExact() → Not available (returns null)
 * - findSimilarBedrijven() → Not available (returns [])
 * 
 * Deprecated methods will be removed in v4.0
 * 
 * CHANGELOG:
 * - v3.2: ⭐ Async duplicate check with database queries
 *         ⭐ Deprecated client-side checks
 *         ⭐ Backward compatibility wrappers
 * - v3.1: Bureau switch fix
 * - v3.0: Initial duplicate detection
 */

import { supabase } from '/js/config.js';

class BedrijvenService {
    constructor() {
        this.bedrijven = [];
        this.loaded = false;
    }

    // ============================================
    // LOADING & SEARCHING
    // ============================================

    /**
     * Load bedrijven for current tenderbureau
     * Super-admins can optionally load all bedrijven
     */
    async loadBedrijven(options = {}) {
        try {
            const tenderbureauId = options.tenderbureauId || this._getActiveBureauIdSync();
            const loadAll = options.loadAll === true;

            console.log('🔍 Loading bedrijven...', { tenderbureauId, loadAll });

            let query = supabase
                .from('bedrijven')
                .select('*, tenderbureau:tenderbureaus(id, bureau_naam)')
                .eq('is_actief', true)
                .order('bedrijfsnaam');

            // Filter op tenderbureau tenzij loadAll = true
            if (!loadAll && tenderbureauId) {
                query = query.eq('tenderbureau_id', tenderbureauId);
            }

            const { data, error } = await query;

            if (error) throw error;

            this.bedrijven = data || [];
            this.loaded = true;

            console.log(`✅ ${this.bedrijven.length} bedrijven geladen${tenderbureauId ? ` voor bureau ${tenderbureauId}` : ' (alle bureaus)'}`);
            return this.bedrijven;

        } catch (error) {
            console.error('❌ Error loading bedrijven:', error);
            throw error;
        }
    }

    /**
     * Get current tenderbureau ID (synchronous)
     * ⭐ v3.2: Simplified - BureauAccessService as single source of truth
     */
    _getActiveBureauIdSync() {
        try {
            // Import may not be available, try window fallback
            const bas = window.bureauAccessService
                || (typeof bureauAccessService !== 'undefined' ? bureauAccessService : null);
            if (bas) {
                const currentBureau = bas.getCurrentBureau();
                // null = "Alle bureau's" (super-admin) → geen filter
                return currentBureau?.bureau_id || null;
            }
        } catch (e) {
            console.warn('⚠️ BureauAccessService niet beschikbaar');
        }
        return null;
    }

    /**
     * Search bedrijven (client-side filtering)
     */
    searchBedrijven(query) {
        if (!query || query.length < 2) {
            return this.bedrijven.slice(0, 20);
        }

        const lowerQuery = query.toLowerCase();

        return this.bedrijven.filter(b =>
            b.bedrijfsnaam?.toLowerCase().includes(lowerQuery) ||
            b.kvk_nummer?.includes(query) ||
            b.plaats?.toLowerCase().includes(lowerQuery) ||
            b.contactpersoon?.toLowerCase().includes(lowerQuery)
        ).slice(0, 20);
    }

    /**
     * Get bedrijf by ID
     */
    async getBedrijf(id) {
        try {
            const { data, error } = await supabase
                .from('bedrijven')
                .select('*, tenderbureau:tenderbureaus(id, bureau_naam)')
                .eq('id', id)
                .single();

            if (error) throw error;
            return data;

        } catch (error) {
            console.error('❌ Error getting bedrijf:', error);
            throw error;
        }
    }

    /**
     * Get all bedrijven (voor dropdown)
     */
    getAllBedrijven() {
        return this.bedrijven;
    }

    // ============================================
    // DUPLICAAT DETECTIE
    // ============================================

    // ════════════════════════════════════════════════════════════
    // DEPRECATED METHODS (Backward Compatibility)
    // These methods are kept for backward compatibility but wrap
    // the new async checkDuplicaat() method. They will be removed in v4.0.
    // For new code, use checkDuplicaat() directly.
    // ════════════════════════════════════════════════════════════

    /**
     * @deprecated Since v3.2 - Use checkDuplicaat({ kvk_nummer }) instead
     */
    async checkDuplicaatKvK(kvkNummer, excludeId = null) {
        console.warn('⚠️ checkDuplicaatKvK() is deprecated. Use checkDuplicaat({ kvk_nummer }) instead.');
        if (!kvkNummer || kvkNummer.trim() === '') return null;
        const result = await this.checkDuplicaat({ kvk_nummer: kvkNummer }, excludeId);
        if (result.isDuplicate && result.field === 'kvk_nummer') {
            const bedrijfsnaam = result.message.match(/"([^"]+)"/)?.[1] || 'Unknown';
            return { bedrijfsnaam, kvk_nummer: kvkNummer };
        }
        return null;
    }

    /**
     * @deprecated Since v3.2 - Use checkDuplicaat({ btw_nummer }) instead
     */
    async checkDuplicaatBTW(btwNummer, excludeId = null) {
        console.warn('⚠️ checkDuplicaatBTW() is deprecated. Use checkDuplicaat({ btw_nummer }) instead.');
        if (!btwNummer || btwNummer.trim() === '') return null;
        const result = await this.checkDuplicaat({ btw_nummer: btwNummer }, excludeId);
        if (result.isDuplicate && result.field === 'btw_nummer') {
            const bedrijfsnaam = result.message.match(/"([^"]+)"/)?.[1] || 'Unknown';
            return { bedrijfsnaam, btw_nummer: btwNummer };
        }
        return null;
    }

    /**
     * @deprecated Since v3.2 - Naam duplicate check not supported in async version
     */
    checkDuplicaatNaamExact(naam, excludeId = null) {
        console.warn('⚠️ checkDuplicaatNaamExact() is deprecated. Naam duplicate check not available in database-based validation.');
        return null;
    }

    /**
     * @deprecated Since v3.2 - Fuzzy matching removed
     */
    findSimilarBedrijven(naam, excludeId = null, threshold = 0.7) {
        console.warn('⚠️ findSimilarBedrijven() is deprecated. Fuzzy matching not available in database-based check.');
        return [];
    }

    // ════════════════════════════════════════════════════════════
    // PRIMARY DUPLICATE CHECK (Database-based, Async)
    // ════════════════════════════════════════════════════════════

    // ════════════════════════════════════════════════════════════
    // PRIMARY DUPLICATE CHECK (Database-based, Async)
    // ════════════════════════════════════════════════════════════

    /**
     * Check for duplicate KVK/BTW numbers (async, Supabase)
     * 
     * @param {Object} bedrijfData - Must contain { kvk_nummer?, btw_nummer? }
     * @param {string|null} excludeId - ID to exclude from check (for updates)
     * @returns {Promise<Object>} { isDuplicate, message, skipped, field }
     */
    async checkDuplicaat(bedrijfData, excludeId = null) {
        console.log('🔍 checkDuplicaat called with:', { bedrijfData, excludeId });
        // Validate input
        if (!bedrijfData || typeof bedrijfData !== 'object') {
            console.error('❌ checkDuplicaat: bedrijfData is not an object!', bedrijfData);
            return {
                isDuplicate: false,
                message: 'Validatie overgeslagen: geen data',
                skipped: true,
                field: null
            };
        }

        const skippedChecks = [];

        // KVK Number Check
        if (bedrijfData.kvk_nummer && bedrijfData.kvk_nummer.trim()) {
            console.log('🔍 Checking KVK:', bedrijfData.kvk_nummer);
            const { data: existingKvk, error } = await supabase
                .from('bedrijven')
                .select('id, bedrijfsnaam, kvk_nummer')
                .eq('kvk_nummer', bedrijfData.kvk_nummer.trim())
                .neq('id', excludeId || '00000000-0000-0000-0000-000000000000')
                .maybeSingle();
            if (error) {
                console.error('❌ KVK duplicate check error:', error);
            }
            if (existingKvk) {
                console.log('⚠️ KVK duplicate found:', existingKvk);
                return {
                    isDuplicate: true,
                    field: 'kvk_nummer',
                    message: `KVK-nummer ${bedrijfData.kvk_nummer} is al in gebruik bij "${existingKvk.bedrijfsnaam}"`,
                    skipped: false
                };
            }
        } else {
            skippedChecks.push('KVK-nummer');
        }

        // BTW Number Check
        if (bedrijfData.btw_nummer && bedrijfData.btw_nummer.trim()) {
            console.log('🔍 Checking BTW:', bedrijfData.btw_nummer);
            const { data: existingBtw, error } = await supabase
                .from('bedrijven')
                .select('id, bedrijfsnaam, btw_nummer')
                .eq('btw_nummer', bedrijfData.btw_nummer.trim())
                .neq('id', excludeId || '00000000-0000-0000-0000-000000000000')
                .maybeSingle();
            if (error) {
                console.error('❌ BTW duplicate check error:', error);
            }
            if (existingBtw) {
                console.log('⚠️ BTW duplicate found:', existingBtw);
                return {
                    isDuplicate: true,
                    field: 'btw_nummer',
                    message: `BTW-nummer ${bedrijfData.btw_nummer} is al in gebruik bij "${existingBtw.bedrijfsnaam}"`,
                    skipped: false
                };
            }
        } else {
            skippedChecks.push('BTW-nummer');
        }

        // No Duplicates Found
        console.log('✅ No duplicates found, skipped:', skippedChecks);
        return {
            isDuplicate: false,
            message: skippedChecks.length > 0
                ? `Niet gecontroleerd: ${skippedChecks.join(', ')}`
                : 'Alle controles geslaagd',
            skipped: skippedChecks.length > 0,
            field: null
        };
    }

    /**
     * Real-time validatie voor een specifiek veld
     * Updated to use new async checkDuplicaat()
     * 
     * @param {string} field - 'kvk_nummer' or 'btw_nummer'
     * @param {string} value - Value to validate
     * @param {string|null} excludeId - ID to exclude from duplicate check
     * @returns {Promise<Object>} { isValid, error, warning }
     */
    async validateField(field, value, excludeId = null) {
        const result = {
            isValid: true,
            error: null,
            warning: null
        };

        if (!value || value.trim() === '') {
            return result;
        }

        // Build data object for checkDuplicaat
        const bedrijfData = {};

        switch (field) {
            case 'kvk_nummer':
                // Format validation (warning only, not blocking)
                if (!this.validateKvK(value)) {
                    result.warning = 'KvK nummer is meestal 8 cijfers';
                }
                bedrijfData.kvk_nummer = value;
                break;

            case 'btw_nummer':
                // Format validation (blocking)
                if (!this.validateBTW(value)) {
                    result.isValid = false;
                    result.error = 'BTW nummer moet formaat NL123456789B01 hebben';
                    return result;
                }
                bedrijfData.btw_nummer = value;
                break;

            case 'bedrijfsnaam':
                // Naam duplicate check not implemented in async version
                console.warn('⚠️ Bedrijfsnaam duplicate check not available in database-based validation');
                return result;

            default:
                // Unknown field - no validation
                return result;
        }

        // Perform async duplicate check
        try {
            const duplicateCheck = await this.checkDuplicaat(bedrijfData, excludeId);

            if (duplicateCheck.isDuplicate) {
                result.isValid = false;
                result.error = duplicateCheck.message;
            }
        } catch (error) {
            console.error('❌ validateField error:', error);
            // Don't block on validation errors
        }

        return result;
    }

    // ============================================
    // HELPER METHODS VOOR FUZZY MATCHING
    // ============================================

    /**
     * Normaliseer bedrijfsnaam voor vergelijking
     * Verwijdert B.V., BV, rechtsvormvarianten, etc.
     */
    _normalizeBedrijfsnaam(naam) {
        if (!naam) return '';

        return naam
            .toLowerCase()
            .trim()
            // Verwijder rechtsvorm varianten
            .replace(/\s*(b\.?v\.?|n\.?v\.?|v\.?o\.?f\.?|c\.?v\.?|holding|group|groep)\s*$/gi, '')
            // Verwijder speciale tekens
            .replace(/[.,\-_&'"()]/g, ' ')
            // Normaliseer whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Bereken similarity score tussen twee strings
     * Gebruikt Levenshtein distance
     * @returns {number} Score tussen 0 en 1
     */
    _calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;

        const len1 = str1.length;
        const len2 = str2.length;

        // Als een van beide leeg is
        if (len1 === 0) return 0;
        if (len2 === 0) return 0;

        // Levenshtein distance matrix
        const matrix = [];

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }

        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);

        return 1 - (distance / maxLen);
    }

    // ============================================
    // CRUD OPERATIONS
    // ============================================

    /**
     * Get current tenderbureau_id
     * @private
     */
    async _getCurrentTenderbureauId(userId) {
        // 1. Try BureauAccessService first (for multi-bureau users)
        if (window.bureauAccessService) {
            const currentBureau = window.bureauAccessService.getCurrentBureau();
            if (currentBureau?.bureau_id) {
                console.log('📍 Using bureau from BureauAccessService:', currentBureau.bureau_naam);
                return currentBureau.bureau_id;
            }
        }

        // 2. Fallback: Get from users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenderbureau_id')
            .eq('id', userId)
            .single();

        if (userError || !userData?.tenderbureau_id) {
            throw new Error('Geen tenderbureau gevonden. Neem contact op met support.');
        }

        console.log('📍 Using bureau from users table');
        return userData.tenderbureau_id;
    }

    /**
     * Create new bedrijf
     * ✅ Met duplicaat validatie
     */
    async createBedrijf(bedrijfData) {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Niet ingelogd');

            // Nieuwe async duplicaat check
            const duplicateCheck = await this.checkDuplicaat(bedrijfData, null);
            if (duplicateCheck.isDuplicate) {
                throw new Error(duplicateCheck.message);
            }
            if (duplicateCheck.skipped) {
                console.warn('⚠️ Duplicate check skipped:', duplicateCheck.message);
            }

            // ⭐ Gebruik doorgegeven tenderbureau_id, of probeer zelf te bepalen
            let tenderbureauId = bedrijfData.tenderbureau_id;
            if (!tenderbureauId) {
                tenderbureauId = await this._getCurrentTenderbureauId(user.id);
            }

            // Add tenderbureau_id to bedrijf data
            const dataWithTenderbureau = {
                ...bedrijfData,
                tenderbureau_id: tenderbureauId,
                created_by: user.id
            };

            // Sanitize: lege strings → null (voorkomt unique constraint conflicts)
            for (const key of Object.keys(dataWithTenderbureau)) {
                if (dataWithTenderbureau[key] === '') {
                    dataWithTenderbureau[key] = null;
                }
            }

            console.log('📝 Creating bedrijf for tenderbureau:', tenderbureauId);

            const { data, error } = await supabase
                .from('bedrijven')
                .insert([dataWithTenderbureau])
                .select('*, tenderbureau:tenderbureaus(id, bureau_naam)')
                .single();

            if (error) {
                // Handle database unique constraint errors
                if (error.code === '23505') {
                    if (error.message.includes('kvk')) {
                        throw new Error('KvK nummer bestaat al binnen dit bureau');
                    }
                    if (error.message.includes('btw')) {
                        throw new Error('BTW nummer bestaat al binnen dit bureau');
                    }
                    throw new Error('Dit bedrijf bestaat al');
                }
                throw error;
            }

            // Add to cache
            this.bedrijven.push(data);
            this.bedrijven.sort((a, b) =>
                a.bedrijfsnaam.localeCompare(b.bedrijfsnaam)
            );

            console.log('✅ Bedrijf created:', data);
            return {
                success: true,
                data: data,
                warning: duplicateCheck.skipped ? duplicateCheck.message : null
            };

        } catch (error) {
            console.error('❌ Error creating bedrijf:', error);
            throw error;
        }
    }

    /**
     * Update bedrijf
     * ✅ Met duplicaat validatie
     */
    async updateBedrijf(id, updates) {
        try {
            // ════════════════════════════════════════════════════════════
            // Input Validation
            // ════════════════════════════════════════════════════════════
            if (!id || typeof id !== 'string') {
                throw new Error(`Invalid id parameter: expected string UUID, got ${typeof id}`);
            }
            if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
                throw new Error(`Invalid updates parameter: expected object, got ${typeof updates}`);
            }
            console.log('🔄 Updating bedrijf:', id, 'with updates:', updates);

            // Nieuwe async duplicaat check
            const duplicateCheck = await this.checkDuplicaat(updates, id);
            if (duplicateCheck.isDuplicate) {
                throw new Error(duplicateCheck.message);
            }
            if (duplicateCheck.skipped) {
                console.warn('⚠️ Duplicate check skipped:', duplicateCheck.message);
            }


            // Remove fields that shouldn't be updated
            const cleanUpdates = { ...updates };
            delete cleanUpdates.id;
            delete cleanUpdates.tenderbureau_id;
            delete cleanUpdates.created_by;
            delete cleanUpdates.created_at;
            delete cleanUpdates.tenderbureau;

            // Sanitize: lege strings → null (voorkomt unique constraint conflicts)
            for (const key of Object.keys(cleanUpdates)) {
                if (cleanUpdates[key] === '') {
                    cleanUpdates[key] = null;
                }
            }

            const { data, error } = await supabase
                .from('bedrijven')
                .update(cleanUpdates)
                .eq('id', id)
                .select('*, tenderbureau:tenderbureaus(id, bureau_naam)')
                .single();

            if (error) throw error;

            // Update cache
            const idx = this.bedrijven.findIndex(b => b.id === id);
            if (idx !== -1) {
                this.bedrijven[idx] = data;
            }

            console.log('✅ Bedrijf updated:', data);
            return {
                success: true,
                data: data,
                warning: duplicateCheck.skipped ? duplicateCheck.message : null
            };

        } catch (error) {
            console.error('❌ Error updating bedrijf:', error);
            throw error;
        }
    }

    /**
     * Delete bedrijf (soft delete)
     */
    async deleteBedrijf(id) {
        try {
            const { error } = await supabase
                .from('bedrijven')
                .update({ is_actief: false })
                .eq('id', id);

            if (error) throw error;

            this.bedrijven = this.bedrijven.filter(b => b.id !== id);
            console.log('✅ Bedrijf deleted:', id);

        } catch (error) {
            console.error('❌ Error deleting bedrijf:', error);
            throw error;
        }
    }

    // ============================================
    // VALIDATION HELPERS
    // ============================================

    /**
     * Validate KvK nummer format (8 cijfers)
     */
    validateKvK(kvkNummer) {
        if (!kvkNummer) return true; // Niet verplicht
        const regex = /^\d{8}$/;
        return regex.test(kvkNummer.trim());
    }

    /**
     * Validate BTW nummer format (NL + 9 cijfers + B + 2 cijfers)
     */
    validateBTW(btwNummer) {
        if (!btwNummer) return true; // Niet verplicht
        const regex = /^NL\d{9}B\d{2}$/i;
        return regex.test(btwNummer.trim());
    }

    /**
     * Format bedrijf display text
     */
    formatBedrijfDisplay(bedrijf) {
        let display = bedrijf.bedrijfsnaam;
        if (bedrijf.plaats) display += ` (${bedrijf.plaats})`;
        if (bedrijf.kvk_nummer) display += ` - KvK: ${bedrijf.kvk_nummer}`;
        return display;
    }

    // ============================================
    // TENDER RELATIONS
    // ============================================

    /**
     * Get tenders for bedrijf
     */
    async getTendersForBedrijf(bedrijfId) {
        try {
            const { data, error } = await supabase
                .from('tenders')
                .select('*')
                .eq('bedrijf_id', bedrijfId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('❌ Error getting tenders for bedrijf:', error);
            throw error;
        }
    }

    /**
     * Get tender count per bedrijf
     */
    async getTenderCounts() {
        try {
            const { data, error } = await supabase
                .from('tenders')
                .select('bedrijf_id');

            if (error) throw error;

            const counts = {};
            (data || []).forEach(tender => {
                if (tender.bedrijf_id) {
                    counts[tender.bedrijf_id] = (counts[tender.bedrijf_id] || 0) + 1;
                }
            });

            return counts;

        } catch (error) {
            console.error('❌ Error getting tender counts:', error);
            return {};
        }
    }

    // ============================================
    // CACHE MANAGEMENT
    // ============================================

    /**
     * Refresh bedrijven lijst
     */
    async refresh() {
        this.loaded = false;
        return await this.loadBedrijven();
    }

    /**
     * Clear cache (for logout or bureau switch)
     */
    clearCache() {
        this.bedrijven = [];
        this.loaded = false;
    }
}

// Export singleton
export const bedrijvenService = new BedrijvenService();
export default bedrijvenService;