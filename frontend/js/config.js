// frontend/js/config.js
// Configuration voor TenderPlanner v2.0

// Supabase is pre-initialized in index.html as window.supabase
export const supabase = window.supabase || (() => {
    console.error('❌ Supabase not available - check index.html initialization');
    return null;
})();// Make globally available
if (typeof window !== 'undefined') {
    window.supabase = supabase;
}

// ========================================
// API CONFIGURATIE
// ========================================
export const API_CONFIG = {
    baseURL: 'http://localhost:3000',
    timeout: 10000,
    endpoints: {
        tenders: '/api/v1/tenders',
        health: '/health'
    }
};

// ========================================
// APP CONFIGURATIE
// ========================================
export const APP_CONFIG = {
    name: 'TenderPlanner',
    version: '2.0',
    environment: 'development',
    loginPage: '/login.html'
};

// ========================================
// MOCK MODE (voor development zonder backend)
// ========================================
export const MOCK_MODE = false;

export const MOCK_TOKEN = 'mock-jwt-token-for-development';

export const MOCK_USER = {
    id: 'mock-user-id',
    email: 'dev@tenderplanner.nl',
    name: 'Development User'
};

// ========================================
// HELPER FUNCTIES
// ========================================
export function getApiUrl(endpoint) {
    return `${API_CONFIG.baseURL}${endpoint}`;
}

export function isProduction() {
    return APP_CONFIG.environment === 'production';
}

export function isDevelopment() {
    return APP_CONFIG.environment === 'development';
}

// ========================================
// LOGGING
// ========================================
console.log('🔧 Config loaded:', {
    api: API_CONFIG.baseURL,
    supabase: 'https://ayamyedredynntdaldlu.supabase.co',
    environment: APP_CONFIG.environment
});