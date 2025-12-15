/**
 * TenderPlanner v2.0 - Main Entry Point
 * Clean bootstrap file
 */

import { App } from './App.js';

// ========================================
// BOOTSTRAP
// ========================================

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting TenderPlanner...');

    // Create and initialize app
    const app = new App();
    app.init();

    // Make available globally for debugging
    window.app = app;
});