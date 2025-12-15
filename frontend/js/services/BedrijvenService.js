/**
 * BedrijvenService - CRM functionaliteit voor bedrijvenbeheer
 * TenderZen v3.1 - Met Bureau Switch Fix
 * 
 * ✅ Multi-tenancy ready: RLS automatically filters by tenderbureau_id
 * ✅ Multi-bureau support: Uses current selected bureau for create operations
 * ✅ Duplicaat detectie: KvK, BTW, en fuzzy naam matching
 * 
 * CHANGELOG:
 * - v1.0: Initial version
 * - v2.0: Multi-tenancy via RLS
 * - v2.1: Multi-bureau support via BureauAccessService
 * - v3.0: Duplicaat detectie (KvK, BTW, fuzzy naam matching)
 * - v3.1: ⭐ FIX: _getActiveBureauIdSync() gebruikt nu correcte localStorage key
 *         ⭐ FIX: BureauAccessService integratie verbeterd
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
                .select('*')
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
     * Get current tenderbureau ID from BureauSwitcher (synchronous)
     * ⭐ v3.1: Fixed localStorage key mismatch en BureauAccessService integratie
     */
    _getActiveBureauIdSync() {
        // 1. Try window.currentTenderbureauId (set by BureauSwitcher)
        if (window.currentTenderbureauId) {
            return window.currentTenderbureauId;
        }
        
        // 2. ⭐ Try BureauAccessService (most reliable)
        if (window.bureauAccessService) {
            const currentBureau = window.bureauAccessService.getCurrentBureau();
            if (currentBureau?.bureau_id) {
                console.log('📍 Bureau from BureauAccessService:', currentBureau.bureau_naam);
                return currentBureau.bureau_id;
            }
        }
        
        // 3. ⭐ FIXED: Use correct localStorage key
        const stored = localStorage.getItem('tenderzen_current_bureau');
        if (stored) {
            console.log('📍 Bureau from localStorage');
            return stored;
        }
        
        // 4. Fallback: old localStorage key for backwards compatibility
        const oldStored = localStorage.getItem('activeBureauId');
        if (oldStored) {
            console.log('📍 Bureau from old localStorage key');
            return oldStored;
        }
        
        // 5. Try to get from BureauSwitcher component
        const bureauSwitcher = window.bureauSwitcher;
        if (bureauSwitcher?.currentBureau?.bureau_id) {
            console.log('📍 Bureau from BureauSwitcher component');
            return bureauSwitcher.currentBureau.bureau_id;
        }
        
        console.warn('⚠️ Kon tenderbureau_id niet bepalen');
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
                .select('*')
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

    /**
     * Check of KvK nummer al bestaat binnen dit bureau
     * @param {string} kvkNummer - Het te checken KvK nummer
     * @param {string|null} excludeId - Bedrijf ID om uit te sluiten (bij bewerken)
     * @returns {Object|null} - Bestaand bedrijf of null
     */
    checkDuplicaatKvK(kvkNummer, excludeId = null) {
        if (!kvkNummer || kvkNummer.trim() === '') return null;
        
        const cleanKvK = kvkNummer.trim();
        
        return this.bedrijven.find(b => 
            b.kvk_nummer === cleanKvK && 
            b.id !== excludeId
        ) || null;
    }

    /**
     * Check of BTW nummer al bestaat binnen dit bureau
     * @param {string} btwNummer - Het te checken BTW nummer
     * @param {string|null} excludeId - Bedrijf ID om uit te sluiten (bij bewerken)
     * @returns {Object|null} - Bestaand bedrijf of null
     */
    checkDuplicaatBTW(btwNummer, excludeId = null) {
        if (!btwNummer || btwNummer.trim() === '') return null;
        
        const cleanBTW = btwNummer.trim().toUpperCase();
        
        return this.bedrijven.find(b => 
            b.btw_nummer?.toUpperCase() === cleanBTW && 
            b.id !== excludeId
        ) || null;
    }

    /**
     * Check of bedrijfsnaam al bestaat (exact match)
     * @param {string} naam - De te checken bedrijfsnaam
     * @param {string|null} excludeId - Bedrijf ID om uit te sluiten (bij bewerken)
     * @returns {Object|null} - Bestaand bedrijf of null
     */
    checkDuplicaatNaamExact(naam, excludeId = null) {
        if (!naam || naam.trim() === '') return null;
        
        const cleanNaam = this._normalizeBedrijfsnaam(naam);
        
        return this.bedrijven.find(b => 
            this._normalizeBedrijfsnaam(b.bedrijfsnaam) === cleanNaam && 
            b.id !== excludeId
        ) || null;
    }

    /**
     * Vind vergelijkbare bedrijfsnamen (fuzzy matching)
     * @param {string} naam - De te checken bedrijfsnaam
     * @param {string|null} excludeId - Bedrijf ID om uit te sluiten
     * @param {number} threshold - Minimum similarity score (0-1), default 0.7
     * @returns {Array} - Array van {bedrijf, score} objecten
     */
    findSimilarBedrijven(naam, excludeId = null, threshold = 0.7) {
        if (!naam || naam.trim().length < 3) return [];
        
        const cleanNaam = this._normalizeBedrijfsnaam(naam);
        const results = [];
        
        for (const bedrijf of this.bedrijven) {
            if (bedrijf.id === excludeId) continue;
            
            const bedrijfNaam = this._normalizeBedrijfsnaam(bedrijf.bedrijfsnaam);
            const score = this._calculateSimilarity(cleanNaam, bedrijfNaam);
            
            if (score >= threshold) {
                results.push({
                    bedrijf,
                    score,
                    percentage: Math.round(score * 100)
                });
            }
        }
        
        // Sorteer op score (hoogste eerst)
        return results.sort((a, b) => b.score - a.score).slice(0, 5);
    }

    /**
     * Volledige duplicaat check
     * @param {Object} data - {bedrijfsnaam, kvk_nummer, btw_nummer}
     * @param {string|null} excludeId - Bedrijf ID om uit te sluiten
     * @returns {Object} - {isValid, errors[], warnings[]}
     */
    checkDuplicaat(data, excludeId = null) {
        const result = {
            isValid: true,
            errors: [],      // Blokkerend (KvK, BTW, exacte naam)
            warnings: [],    // Waarschuwing (fuzzy match)
            duplicates: {
                kvk: null,
                btw: null,
                exactNaam: null,
                similarNamen: []
            }
        };

        // 1. Check KvK (blokkerend)
        if (data.kvk_nummer) {
            const kvkDup = this.checkDuplicaatKvK(data.kvk_nummer, excludeId);
            if (kvkDup) {
                result.isValid = false;
                result.errors.push({
                    field: 'kvk_nummer',
                    message: `KvK nummer bestaat al: "${kvkDup.bedrijfsnaam}"`,
                    existingBedrijf: kvkDup
                });
                result.duplicates.kvk = kvkDup;
            }
        }

        // 2. Check BTW (blokkerend)
        if (data.btw_nummer) {
            const btwDup = this.checkDuplicaatBTW(data.btw_nummer, excludeId);
            if (btwDup) {
                result.isValid = false;
                result.errors.push({
                    field: 'btw_nummer',
                    message: `BTW nummer bestaat al: "${btwDup.bedrijfsnaam}"`,
                    existingBedrijf: btwDup
                });
                result.duplicates.btw = btwDup;
            }
        }

        // 3. Check exacte naam (blokkerend)
        if (data.bedrijfsnaam) {
            const naamDup = this.checkDuplicaatNaamExact(data.bedrijfsnaam, excludeId);
            if (naamDup) {
                result.isValid = false;
                result.errors.push({
                    field: 'bedrijfsnaam',
                    message: `Bedrijfsnaam bestaat al: "${naamDup.bedrijfsnaam}"`,
                    existingBedrijf: naamDup
                });
                result.duplicates.exactNaam = naamDup;
            }
        }

        // 4. Check fuzzy naam match (waarschuwing - alleen als geen exacte match)
        if (data.bedrijfsnaam && !result.duplicates.exactNaam) {
            const similar = this.findSimilarBedrijven(data.bedrijfsnaam, excludeId, 0.7);
            if (similar.length > 0) {
                result.warnings.push({
                    field: 'bedrijfsnaam',
                    message: `Vergelijkbaar bedrijf gevonden: "${similar[0].bedrijf.bedrijfsnaam}" (${similar[0].percentage}% match)`,
                    similarBedrijven: similar
                });
                result.duplicates.similarNamen = similar;
            }
        }

        return result;
    }

    /**
     * Real-time validatie voor een specifiek veld
     * @param {string} field - 'kvk_nummer', 'btw_nummer', of 'bedrijfsnaam'
     * @param {string} value - De waarde om te checken
     * @param {string|null} excludeId - Bedrijf ID om uit te sluiten
     * @returns {Object} - {isValid, error, warning, existingBedrijf}
     */
    validateField(field, value, excludeId = null) {
        const result = {
            isValid: true,
            error: null,
            warning: null,
            existingBedrijf: null,
            similarBedrijven: []
        };

        if (!value || value.trim() === '') {
            return result;
        }

        switch (field) {
            case 'kvk_nummer':
                // Format validatie
                if (!this.validateKvK(value)) {
                    result.isValid = false;
                    result.error = 'KvK nummer moet 8 cijfers bevatten';
                    return result;
                }
                // Duplicaat check
                const kvkDup = this.checkDuplicaatKvK(value, excludeId);
                if (kvkDup) {
                    result.isValid = false;
                    result.error = `KvK nummer bestaat al: "${kvkDup.bedrijfsnaam}"`;
                    result.existingBedrijf = kvkDup;
                }
                break;

            case 'btw_nummer':
                // Format validatie
                if (!this.validateBTW(value)) {
                    result.isValid = false;
                    result.error = 'BTW nummer moet formaat NL123456789B01 hebben';
                    return result;
                }
                // Duplicaat check
                const btwDup = this.checkDuplicaatBTW(value, excludeId);
                if (btwDup) {
                    result.isValid = false;
                    result.error = `BTW nummer bestaat al: "${btwDup.bedrijfsnaam}"`;
                    result.existingBedrijf = btwDup;
                }
                break;

            case 'bedrijfsnaam':
                // Exacte match check
                const naamDup = this.checkDuplicaatNaamExact(value, excludeId);
                if (naamDup) {
                    result.isValid = false;
                    result.error = `Bedrijfsnaam bestaat al`;
                    result.existingBedrijf = naamDup;
                    return result;
                }
                // Fuzzy match check (alleen waarschuwing)
                const similar = this.findSimilarBedrijven(value, excludeId, 0.7);
                if (similar.length > 0) {
                    result.warning = `Vergelijkbaar: "${similar[0].bedrijf.bedrijfsnaam}" (${similar[0].percentage}%)`;
                    result.similarBedrijven = similar;
                }
                break;
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

            // Valideer op duplicaten EERST
            const validation = this.checkDuplicaat(bedrijfData);
            if (!validation.isValid) {
                const errorMessages = validation.errors.map(e => e.message).join(', ');
                throw new Error(`Duplicaat gevonden: ${errorMessages}`);
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

            console.log('📝 Creating bedrijf for tenderbureau:', tenderbureauId);

            const { data, error } = await supabase
                .from('bedrijven')
                .insert([dataWithTenderbureau])
                .select()
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
            return data;

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
            // Valideer op duplicaten (exclude current bedrijf)
            const validation = this.checkDuplicaat(updates, id);
            if (!validation.isValid) {
                const errorMessages = validation.errors.map(e => e.message).join(', ');
                throw new Error(`Duplicaat gevonden: ${errorMessages}`);
            }

            // Remove fields that shouldn't be updated
            const cleanUpdates = { ...updates };
            delete cleanUpdates.id;
            delete cleanUpdates.tenderbureau_id;
            delete cleanUpdates.created_by;
            delete cleanUpdates.created_at;

            const { data, error } = await supabase
                .from('bedrijven')
                .update(cleanUpdates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // Update cache
            const index = this.bedrijven.findIndex(b => b.id === id);
            if (index !== -1) {
                this.bedrijven[index] = data;
            }

            console.log('✅ Bedrijf updated:', data);
            return data;

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