// frontend/js/services/ApiService.js
// API Service voor communicatie met backend
// v1.2 - Fix voor supabaseClient global

import { MOCK_MODE, MOCK_TOKEN, MOCK_USER, API_CONFIG, getSupabase } from '../config.js';

class ApiService {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        
        if (MOCK_MODE) {
            console.log('🔧 ApiService: Running in MOCK MODE');
            console.log('👤 Mock User:', MOCK_USER);
        } else {
            console.log('🔧 ApiService: Running in PRODUCTION MODE');
        }
    }

    // ========================================
    // HELPER: Get Supabase Client
    // ========================================
    
    /**
     * Get the Supabase client instance
     * @returns {object|null} Supabase client
     */
    getSupabaseClient() {
        // Probeer eerst de getSupabase functie uit config
        const client = getSupabase();
        if (client) return client;
        
        // Fallback naar window.supabaseClient
        if (window.supabaseClient && window.supabaseClient.auth) {
            return window.supabaseClient;
        }
        
        console.error('❌ No Supabase client available');
        return null;
    }

    // ========================================
    // AUTHENTICATION
    // ========================================
    
    /**
     * Get authentication token
     * @returns {string|null} JWT token
     */
    async getAuthToken() {
        // MOCK MODE: Return hardcoded test token
        if (MOCK_MODE) {
            console.log('🔑 Using mock token for authentication');
            return MOCK_TOKEN;
        }

        // PRODUCTION MODE: Get real Supabase token
        try {
            const supabase = this.getSupabaseClient();
            
            if (!supabase) {
                console.error('❌ Supabase client not available');
                return null;
            }
            
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                console.warn('⚠️ No active session found');
                return null;
            }

            console.log('🔑 Got Supabase auth token');
            return session.access_token;
        } catch (error) {
            console.error('❌ Error getting auth token:', error);
            return null;
        }
    }

    /**
     * Get current user info
     * @returns {object} User object
     */
    async getCurrentUser() {
        // MOCK MODE: Return mock user
        if (MOCK_MODE) {
            return MOCK_USER;
        }

        // PRODUCTION MODE: Get real user from Supabase
        try {
            const supabase = this.getSupabaseClient();
            
            if (!supabase) {
                console.error('❌ Supabase client not available');
                return null;
            }
            
            const { data: { user } } = await supabase.auth.getUser();
            return user;
        } catch (error) {
            console.error('❌ Error getting current user:', error);
            return null;
        }
    }

    // ========================================
    // HTTP REQUEST HANDLER
    // ========================================
    
    /**
     * Generic request handler
     * @param {string} endpoint - API endpoint
     * @param {object} options - Fetch options
     * @returns {Promise<object>} Response data
     */
    async request(endpoint, options = {}) {
        try {
            // Get auth token
            const token = await this.getAuthToken();
            
            // Build full URL
            const url = `${this.baseURL}${endpoint}`;
            
            // Build headers
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            // Add authorization header if token exists
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
                console.log('🔑 Added Authorization header');
            } else {
                console.warn('⚠️ No token available - request may fail if auth required');
            }

            // Build fetch config
            const config = {
                ...options,
                headers
            };

            console.log('📡 API Request:', {
                url,
                method: options.method || 'GET',
                hasAuth: !!token
            });

            // Make request
            const response = await fetch(url, config);

            // Handle response
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = await response.text();
                }
                
                console.error('❌ API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                
                // Throw with detailed error
                const errorMessage = typeof errorData === 'object' 
                    ? JSON.stringify(errorData, null, 2)
                    : errorData;
                    
                throw new Error(`HTTP ${response.status}: ${errorMessage}`);
            }

            // ⭐ v1.1 FIX: Handle empty responses (204 No Content)
            // DELETE requests often return empty body
            const text = await response.text();
            const data = text ? JSON.parse(text) : { success: true };
            
            console.log('✅ API Success:', data);
            
            return data;

        } catch (error) {
            console.error('❌ API request error:', error);
            throw error;
        }
    }

    // ========================================
    // TENDER ENDPOINTS
    // ========================================
    
    /**
     * Get all tenders with optional filters
     * @param {object} filters - Query filters (optional)
     * @returns {Promise<array>} List of tenders
     */
    async getTenders(filters = {}) {
        let endpoint = API_CONFIG.endpoints.tenders + '/';
        
        // Only add query parameters if we have actual filter values
        // IMPORTANT: Skip empty strings, null, undefined
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '' && value !== false) {
                params.append(key, value);
            }
        });
        
        // Only append params if there are actual filters
        const queryString = params.toString();
        if (queryString) {
            endpoint += '?' + queryString;
            console.log('📡 getTenders with filters:', queryString);
        } else {
            console.log('📡 getTenders without filters (ALL tenders)');
        }

        return await this.request(endpoint, {
            method: 'GET'
        });
    }

    /**
     * Get single tender by ID
     * @param {number} id - Tender ID
     * @returns {Promise<object>} Tender object
     */
    async getTender(id) {
        return await this.request(`${API_CONFIG.endpoints.tenders}/${id}`, {
            method: 'GET'
        });
    }

    /**
     * Create new tender
     * @param {object} tenderData - Tender data
     * @returns {Promise<object>} Created tender
     */
    async createTender(tenderData) {
        console.log('📝 Creating tender:', tenderData);
        
        // Sanitize data: convert empty strings to null
        const sanitized = {};
        Object.keys(tenderData).forEach(key => {
            const value = tenderData[key];
            // Convert empty strings, undefined, and 'null' string to actual null
            if (value === '' || value === undefined || value === 'null') {
                sanitized[key] = null;
            } else {
                sanitized[key] = value;
            }
        });
        
        console.log('🧹 Sanitized data:', sanitized);
        
        return await this.request(API_CONFIG.endpoints.tenders + '/', {
            method: 'POST',
            body: JSON.stringify(sanitized)
        });
    }

    /**
     * Update existing tender
     * @param {number} id - Tender ID
     * @param {object} updates - Fields to update
     * @returns {Promise<object>} Updated tender
     */
    async updateTender(id, updates) {
        console.log(`📝 Updating tender ${id}:`, updates);
        
        return await this.request(`${API_CONFIG.endpoints.tenders}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    /**
     * Delete tender
     * @param {number} id - Tender ID
     * @returns {Promise<object>} Success response
     */
    async deleteTender(id) {
        console.log(`🗑️ Deleting tender ${id}`);
        
        return await this.request(`${API_CONFIG.endpoints.tenders}/${id}`, {
            method: 'DELETE'
        });
    }

    // ========================================
    // HEALTH CHECK
    // ========================================
    
    /**
     * Check API health
     * @returns {Promise<object>} Health status
     */
    async healthCheck() {
        return await this.request(API_CONFIG.endpoints.health, {
            method: 'GET'
        });
    }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;