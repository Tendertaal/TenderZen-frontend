// frontend/js/services/ApiService.js
// API Service voor communicatie met backend

import { MOCK_MODE, MOCK_TOKEN, MOCK_USER, API_CONFIG } from '../config.js';

class ApiService {
    constructor() {
        this.baseURL = API_CONFIG.baseURL;
        this.supabase = null;

        if (MOCK_MODE) {
            console.log('🔧 ApiService: Running in MOCK MODE');
            console.log('👤 Mock User:', MOCK_USER);
        } else {
            console.log('🔧 ApiService: Running in PRODUCTION MODE');
        }
    }

    // ========================================
    // AUTHENTICATION
    // ========================================

    /**
     * Get authentication token
     * @returns {string|null} JWT token
     */
    async getAuthToken() {
        // Temporary fix: bypass auth
        if (!window.supabase?.auth) {
            console.warn('⚠️ Supabase not initialized, using empty token');
            return '';
        }
        try {
            const { data: { session } } = await window.supabase.auth.getSession();
            return session?.access_token || '';
        } catch (error) {
            console.warn('⚠️ Auth error, using empty token');
            return '';
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
            const { data: { user } } = await window.supabase.auth.getUser();
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
                const errorText = await response.text();
                console.error('❌ API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
            }

            // Parse JSON response
            const data = await response.json();
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

        return await this.request(API_CONFIG.endpoints.tenders + '/', {
            method: 'POST',
            body: JSON.stringify(tenderData)
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
     * @returns {Promise<void>}
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

// Losse async functie export voor compatibiliteit met services
export async function getAuthToken() {
    return await apiService.getAuthToken();
}