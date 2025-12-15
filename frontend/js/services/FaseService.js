/**
 * FaseService - Beheert fase configuratie en fase-specifieke statussen
 */

import { supabase } from '../config.js';

class FaseService {
    constructor() {
        this.fases = [];
        this.statussen = {};
        this.loaded = false;
    }

    /**
     * Load fase config en statussen van database
     */
    async loadConfig() {
        if (this.loaded) return;

        try {
            // Load fases
            const { data: fases, error: faseError } = await supabase
                .from('fase_config')
                .select('*')
                .order('volgorde');

            if (faseError) throw faseError;
            this.fases = fases;

            // Load statussen
            const { data: statussen, error: statusError } = await supabase
                .from('fase_statussen')
                .select('*')
                .eq('is_aktief', true)
                .order('fase, volgorde');

            if (statusError) throw statusError;

            // Groepeer statussen per fase
            this.statussen = {};
            statussen.forEach(status => {
                if (!this.statussen[status.fase]) {
                    this.statussen[status.fase] = [];
                }
                this.statussen[status.fase].push(status);
            });

            this.loaded = true;
            console.log('✅ Fase config loaded:', this.fases, this.statussen);

        } catch (error) {
            console.error('❌ Load fase config error:', error);
            throw error;
        }
    }

    /**
     * Get all fases
     */
    async getFases() {
        if (!this.loaded) await this.loadConfig();
        return this.fases;
    }

    /**
     * Get fase by key
     */
    async getFase(faseKey) {
        if (!this.loaded) await this.loadConfig();
        return this.fases.find(f => f.fase === faseKey);
    }

    /**
     * Get statussen voor een specifieke fase
     */
    async getStatussenVoorFase(faseKey) {
        if (!this.loaded) await this.loadConfig();
        return this.statussen[faseKey] || [];
    }

    /**
     * Get status display naam
     */
    async getStatusDisplay(faseKey, statusKey) {
        const statussen = await this.getStatussenVoorFase(faseKey);
        const status = statussen.find(s => s.status_key === statusKey);
        return status ? status.status_display : statusKey;
    }

    /**
     * Get status config
     */
    async getStatusConfig(faseKey, statusKey) {
        const statussen = await this.getStatussenVoorFase(faseKey);
        return statussen.find(s => s.status_key === statusKey);
    }

    /**
     * Validate fase_status voor fase
     */
    async isValidStatus(faseKey, statusKey) {
        const statussen = await this.getStatussenVoorFase(faseKey);
        return statussen.some(s => s.status_key === statusKey);
    }

    /**
     * Get default status voor fase
     */
    async getDefaultStatus(faseKey) {
        const statussen = await this.getStatussenVoorFase(faseKey);
        return statussen.length > 0 ? statussen[0].status_key : null;
    }

    /**
     * Refresh config (bijv. na admin wijzigingen)
     */
    async refresh() {
        this.loaded = false;
        await this.loadConfig();
    }
}

// Export singleton
export const faseService = new FaseService();
export default faseService;