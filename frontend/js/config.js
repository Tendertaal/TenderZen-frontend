// SUPABASE CONFIGURATIE
export const SUPABASE_URL = 'https://ayamyedredynntdaldlu.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_BCXkUIXADb3fZLjic7X5OQ_hZA70iCF';
// frontend/js/config.js
// Configuration voor TenderPlanner v2.0


// API Configuration (ULTRA SHORT FIX)
const BACKEND_PORT = 3000;  // ← MATCHED TO BACKEND
export const API_CONFIG = {
    BASE_URL: `http://localhost:${BACKEND_PORT}`,
    endpoints: {
        tenders: '/api/v1/tenders',
        usersMe: '/api/v1/users/me',
        // voeg hier meer endpoints toe indien nodig
    }
};
console.log('✅ API Config:', API_CONFIG.BASE_URL);

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
    return `${API_CONFIG.BASE_URL}${endpoint}`;
}

export function isProduction() {
    return APP_CONFIG.environment === 'production';
}

export function isDevelopment() {
    return APP_CONFIG.environment === 'development';
}

// ========================================
// SUPABASE CLIENT
// ========================================
let supabaseClient = null;

// Bewaar referentie naar originele library
const supabaseLibrary = window.supabase;

// Check of er al een werkende supabase client is (heeft .auth property)
function isSupabaseClient(obj) {
    return obj && typeof obj.auth === 'object' && typeof obj.from === 'function';
}

// Check of het de UMD library is (heeft createClient functie)
function isSupabaseLibrary(obj) {
    return obj && typeof obj.createClient === 'function';
}

// Functie om supabase te initialiseren
export function getSupabase() {
    // Als we al een client hebben, return die
    if (supabaseClient) {
        return supabaseClient;
    }

    // Check of window.supabaseClient al bestaat (eerder geïnitialiseerd)
    if (window.supabaseClient && isSupabaseClient(window.supabaseClient)) {
        supabaseClient = window.supabaseClient;
        console.log('✅ Using existing Supabase client');
        return supabaseClient;
    }

    // Check of we de library hebben (origineel of window.supabase)
    const lib = supabaseLibrary || window.supabase;
    if (isSupabaseLibrary(lib)) {
        supabaseClient = lib.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
        // Sla client op in aparte global, NIET overschrijven van window.supabase
        window.supabaseClient = supabaseClient;
        console.log('✅ Supabase client initialized from UMD');
        return supabaseClient;
    }

    console.error('❌ Supabase library not loaded');
    return null;
}


// Initialiseer direct als library beschikbaar is, of wacht tot UMD geladen is
function ensureSupabaseClientInit() {
    if (supabaseClient) return;
    if (isSupabaseLibrary(window.supabase)) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
        window.supabaseClient = supabaseClient;
        console.log('✅ Supabase client initialized from window.supabase');
    } else {
        // Probeer opnieuw zodra de library geladen is
        setTimeout(ensureSupabaseClientInit, 200);
    }
}
ensureSupabaseClientInit();

// Export de client
export const supabase = supabaseClient;

// ========================================
// GLOBAL EXPORTS (voor non-module scripts)
// ========================================
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_PUBLISHABLE_KEY = SUPABASE_PUBLISHABLE_KEY;
window.API_CONFIG = API_CONFIG;
window.APP_CONFIG = APP_CONFIG;
window.MOCK_MODE = MOCK_MODE;
window.MOCK_TOKEN = MOCK_TOKEN;
window.MOCK_USER = MOCK_USER;
window.getApiUrl = getApiUrl;
window.isProduction = isProduction;
window.isDevelopment = isDevelopment;
window.getSupabase = getSupabase;

// ========================================
// LOGGING
// ========================================
console.log('🔧 Config loaded:', {
    api: API_CONFIG.BASE_URL,
    supabase: SUPABASE_URL,
    environment: APP_CONFIG.environment
});