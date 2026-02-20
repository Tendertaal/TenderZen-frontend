/**
 * PlanningService — Frontend API service voor Planning, Checklist & Templates
 * TenderZen v3.2 — getAgendaData + debug logging
 * 
 * Bevat alle API calls naar:
 * - /api/v1/tenders/{id}/planning
 * - /api/v1/tenders/{id}/checklist
 * - /api/v1/planning-counts
 * - /api/v1/planning/agenda                  (NIEUW v3.2)
 * - /api/v1/tenders/{id}/populate-templates
 * - /api/v1/planning-templates
 * - /api/v1/checklist-templates
 * - /api/v1/template-names
 * 
 * INSTALLATIE:
 * Kopieer naar Frontend/js/services/PlanningService.js
 */

// Import supabase client uit config.js — zelfde bron als ApiService
import { supabase, API_CONFIG } from '../config.js';

class PlanningServiceClass {
  constructor() {
    // Gebruik API_CONFIG uit config.js (zelfde als ApiService)
    this.baseUrl = API_CONFIG?.baseURL || 'http://localhost:3000';
    // Cache voor tellingen (vermijd herhaalde API calls)
    this._countsCache = null;
    this._countsCacheTime = 0;
    this._countsCacheTTL = 30000; // 30 seconden
  }

  /**
   * Haal de juiste Supabase client op
   * Probeert: 1) config.js import, 2) window.supabaseClient, 3) window.supabase met .auth check
   */
  _getSupabaseClient() {
    // Strategie 1: geïmporteerde supabase uit config.js (meest betrouwbaar)
    if (supabase?.auth) {
      return supabase;
    }
    // Strategie 2: sommige setups slaan client apart op
    if (window.supabaseClient?.auth) {
      return window.supabaseClient;
    }
    // Strategie 3: window.supabase als het de client is (niet de library)
    if (window.supabase?.auth) {
      return window.supabase;
    }
    return null;
  }

  /**
   * Helper: maak authenticated API request
   * Gebruikt zelfde supabase client als config.js / ApiService
   */
  async _fetch(url, options = {}) {
    let token = null;

    const client = this._getSupabaseClient();
    if (!client) {
      console.error('❌ PlanningService: geen Supabase client gevonden!', {
        configImport: !!supabase,
        configHasAuth: !!supabase?.auth,
        windowSupabase: !!window.supabase,
        windowSupabaseHasAuth: !!window.supabase?.auth,
        windowSupabaseClient: !!window.supabaseClient
      });
      throw new Error('Niet ingelogd - Supabase client niet beschikbaar');
    }

    try {
      const { data: { session } } = await client.auth.getSession();
      token = session?.access_token;
    } catch (error) {
      console.error('❌ PlanningService auth error:', error);
    }

    if (!token) {
      console.warn('⚠️ PlanningService: geen auth token. Session is leeg.');
      throw new Error('Niet ingelogd');
    }

    const response = await fetch(`${this.baseUrl}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // AGENDA — Cross-tender overzicht (AgendaView)
  // ============================================

  /**
   * Haal agenda-data op: alle taken over alle tenders voor het bureau binnen een datumbereik
   * Endpoint: GET /api/v1/planning/agenda?start_date=...&end_date=...
   * 
   * @param {string} startDate - ISO datum (bv. '2026-02-03')
   * @param {string} endDate - ISO datum (bv. '2026-02-09')
   * @param {string|null} teamMemberId - Optioneel: filter op teamlid UUID
   * @returns {Promise<object>} { taken, tenders, team_members }
   */
  async getAgendaData(startDate, endDate, userId = null) {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate
    });
    if (userId) params.append('user_id', userId);

    const url = `/api/v1/planning/agenda?${params.toString()}`;
    console.log('📡 PlanningService.getAgendaData() →', url);

    const result = await this._fetch(url);

    if (!result.success) {
      throw new Error(result.error || 'Agenda data ophalen mislukt');
    }

    const data = result.data || {};
    console.log('✅ getAgendaData response:', {
      taken: data?.taken?.length || 0,
      tenders: Object.keys(data?.tenders || {}).length,
      v_bureau_team: data?.v_bureau_team?.length || 0
    });

    return data;
  }

  // ============================================
  // PLANNING TAKEN
  // ============================================

  /**
   * Haal alle planning taken op voor een tender
   */
  async getPlanningTaken(tenderId) {
    const result = await this._fetch(`/api/v1/tenders/${tenderId}/planning`);
    return result.data || [];
  }

  /**
   * Maak een nieuwe planning taak
   */
  async createPlanningTaak(tenderId, taakData) {
    const result = await this._fetch(`/api/v1/tenders/${tenderId}/planning`, {
      method: 'POST',
      body: JSON.stringify({
        tender_id: tenderId,
        ...taakData
      })
    });
    this._invalidateCountsCache();
    return result.data;
  }

  /**
   * Update een planning taak
   */
  async updatePlanningTaak(taakId, updateData) {
    const result = await this._fetch(`/api/v1/planning/${taakId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
    this._invalidateCountsCache();
    return result.data;
  }

  /**
   * Verwijder een planning taak
   */
  async deletePlanningTaak(taakId) {
    await this._fetch(`/api/v1/planning/${taakId}`, {
      method: 'DELETE'
    });
    this._invalidateCountsCache();
    return true;
  }

  /**
   * Toggle taak status (todo ↔ done)
   */
  async togglePlanningTaakStatus(taakId, currentStatus) {
    const newStatus = currentStatus === 'done' ? 'todo' : 'done';
    return this.updatePlanningTaak(taakId, { status: newStatus });
  }

  // ============================================
  // CHECKLIST ITEMS
  // ============================================

  /**
   * Haal alle checklist items op voor een tender
   */
  async getChecklistItems(tenderId) {
    const result = await this._fetch(`/api/v1/tenders/${tenderId}/checklist`);
    return result.data || [];
  }

  /**
   * Maak een nieuw checklist item
   */
  async createChecklistItem(tenderId, itemData) {
    const result = await this._fetch(`/api/v1/tenders/${tenderId}/checklist`, {
      method: 'POST',
      body: JSON.stringify({
        tender_id: tenderId,
        ...itemData
      })
    });
    this._invalidateCountsCache();
    return result.data;
  }

  /**
   * Update een checklist item
   */
  async updateChecklistItem(itemId, updateData) {
    const result = await this._fetch(`/api/v1/checklist/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
    this._invalidateCountsCache();
    return result.data;
  }

  /**
   * Verwijder een checklist item
   */
  async deleteChecklistItem(itemId) {
    await this._fetch(`/api/v1/checklist/${itemId}`, {
      method: 'DELETE'
    });
    this._invalidateCountsCache();
    return true;
  }

  /**
   * Toggle checklist item status (pending ↔ completed)
   */
  async toggleChecklistItemStatus(itemId, currentStatus) {
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    return this.updateChecklistItem(itemId, { status: newStatus });
  }

  // ============================================
  // TELLINGEN (voor kaart badges)
  // ============================================

  /**
   * Haal tellingen op voor alle tenders (gebufferd)
   * Retourneert: { "tender-uuid": { planning_done: 7, planning_total: 12, checklist_done: 5, checklist_total: 7 } }
   */
  async getAllCounts() {
    const now = Date.now();
    if (this._countsCache && (now - this._countsCacheTime) < this._countsCacheTTL) {
      return this._countsCache;
    }

    try {
      const result = await this._fetch('/api/v1/planning-counts');
      this._countsCache = result.data || {};
      this._countsCacheTime = now;
      return this._countsCache;
    } catch (error) {
      console.warn('⚠️ Kon planning tellingen niet ophalen:', error.message);
      return this._countsCache || {};
    }
  }

  /**
   * Haal tellingen op voor één tender
   */
  async getTenderCounts(tenderId) {
    try {
      const result = await this._fetch(`/api/v1/tenders/${tenderId}/planning-counts`);
      return result.data || { planning_done: 0, planning_total: 0, checklist_done: 0, checklist_total: 0 };
    } catch (error) {
      console.warn(`⚠️ Kon tellingen niet ophalen voor tender ${tenderId}:`, error.message);
      return { planning_done: 0, planning_total: 0, checklist_done: 0, checklist_total: 0 };
    }
  }

  /**
   * Invalideer de cache (na create/update/delete)
   */
  _invalidateCountsCache() {
    this._countsCache = null;
    this._countsCacheTime = 0;
  }

  // ============================================
  // TEMPLATES
  // ============================================

  /**
   * Haal beschikbare template namen op (bijv. ['Standaard', 'Korte tender'])
   */
  async getTemplateNames() {
    try {
      const result = await this._fetch('/api/v1/template-names');
      return result.data || [];
    } catch (error) {
      console.warn('⚠️ Kon template namen niet ophalen:', error.message);
      return [];
    }
  }

  /**
   * Haal planning templates op voor preview
   */
  async getPlanningTemplates(templateNaam = 'Standaard') {
    try {
      const result = await this._fetch(`/api/v1/planning-templates?template_naam=${encodeURIComponent(templateNaam)}`);
      return result.data || [];
    } catch (error) {
      console.warn('⚠️ Kon planning templates niet ophalen:', error.message);
      return [];
    }
  }

  /**
   * Haal checklist templates op voor preview
   */
  async getChecklistTemplates(templateNaam = 'Standaard') {
    try {
      const result = await this._fetch(`/api/v1/checklist-templates?template_naam=${encodeURIComponent(templateNaam)}`);
      return result.data || [];
    } catch (error) {
      console.warn('⚠️ Kon checklist templates niet ophalen:', error.message);
      return [];
    }
  }

  /**
   * Pas templates toe op een tender (kopieer template taken naar tender)
   * @param {string} tenderId - Tender UUID
   * @param {string} templateNaam - Template naam (default: 'Standaard')
   * @param {boolean} overwrite - Verwijder bestaande items eerst
   * @returns {object} { planning_taken: N, checklist_items: N, skipped: bool }
   */
  async populateFromTemplates(tenderId, templateNaam = 'Standaard', overwrite = false) {
    const result = await this._fetch(`/api/v1/tenders/${tenderId}/populate-templates`, {
      method: 'POST',
      body: JSON.stringify({
        template_naam: templateNaam,
        overwrite: overwrite
      })
    });
    this._invalidateCountsCache();
    return result.data;
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Groepeer items per categorie/sectie
   * Input: array van items
   * Output: { "Voorbereiding": [...], "Schrijven & Review": [...] }
   */
  groupByCategorie(items, categorieField = 'categorie') {
    const groups = {};
    for (const item of items) {
      const cat = item[categorieField] || 'Algemeen';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }

  /**
   * Bereken voortgang
   * Returns: { done: 7, total: 12, percentage: 58 }
   */
  calculateProgress(items, doneStatus = 'done') {
    const total = items.length;
    const done = items.filter(i => i.status === doneStatus).length;
    const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
    return { done, total, percentage };
  }
}

// Singleton export
export const planningService = new PlanningServiceClass();
export default planningService;