/**
 * PlanningModal.js - Main Controller
 * Frontend/js/modals/PlanningModal/PlanningModal.js
 * 
 * Main controller voor planning modal
 * Coördineert tussen renderer, event handlers en data
 */

import { planningService } from '../../services/PlanningService.js';
import { initUserResolver } from '../../utils/UserResolutionHelper.js';
import { PlanningModalRenderer } from './PlanningModalRenderer.js';
import { PlanningEventHandlers } from './PlanningEventHandlers.js';

export class PlanningModal {
  constructor() {
    // State
    this.isOpen = false;
    this.modal = null;
    this.tender = null;
    this.activeTab = 'planning'; // 'planning' | 'tender' | 'checklist'

    // Data
    this.planningTaken = [];
    this.checklistItems = [];
    this.tenderMilestones = [];
    this.teamMembers = [];
    this.userResolver = null;
    this.isLoading = false;

    // Modules - initialize here so they're always available
    this.renderer = new PlanningModalRenderer(this);
    this.eventHandlers = new PlanningEventHandlers(this);

    // Callbacks
    this.onUpdate = null;
  }

  // ============================================
  // PUBLIC API
  // ============================================

  async open(tender, initialTab = 'planning') {
    console.log('📋 PlanningModal.open()', tender?.naam);

    this.tender = tender;
    this.activeTab = initialTab;

    // Create and mount modal (renderer already initialized in constructor)
    this.modal = this.renderer.createModal();

    if (!document.body.contains(this.modal)) {
      document.body.appendChild(this.modal);
    }

    this.modal.style.display = 'flex';
    this.isOpen = true;
    document.body.style.overflow = 'hidden';

    // Attach event listeners
    this.eventHandlers.attachMainListeners();

    // Load data
    await this.loadData();
  }

  close() {
    if (this.modal) {
      this.modal.style.display = 'none';
      this.isOpen = false;
      document.body.style.overflow = '';
    }
  }

  // ============================================
  // DATA MANAGEMENT
  // ============================================

  async loadData() {
    if (!this.tender?.id) return;

    this.isLoading = true;
    this.renderer.showLoading();

    try {
      const [taken, items] = await Promise.all([
        planningService.getPlanningTaken(this.tender.id),
        planningService.getChecklistItems(this.tender.id)
      ]);

      this.planningTaken = taken;
      this.checklistItems = items;
      this.tenderMilestones = this._buildTenderMilestones();

      console.log(`✅ Loaded: ${taken.length} taken, ${items.length} checklist, ${this.tenderMilestones.length} milestones`);
    } catch (error) {
      console.error('❌ Error loading planning data:', error);
      this.planningTaken = [];
      this.checklistItems = [];
      this.tenderMilestones = this._buildTenderMilestones();
    }

    this.isLoading = false;

    // Load team members
    await this._loadTeamMembers();

    // Render content
    this.refresh();
  }

  async _loadTeamMembers() {
    try {
      const supabase = window.supabaseClient;
      if (!supabase || !this.tender?.tenderbureau_id) return;

      const { data, error } = await supabase
        .from('v_bureau_team')
        .select('user_id, naam, email, initialen, avatar_kleur, bureau_rol, tenderbureau_id')
        .eq('tenderbureau_id', this.tender.tenderbureau_id)
        .order('naam');

      if (error) {
        console.warn('⚠️ Team members query error:', error.message);
        return;
      }

      this.teamMembers = data || [];
      console.log(`👥 Loaded ${this.teamMembers.length} team members`);

      // Initialize UserResolver
      this.userResolver = initUserResolver(this.teamMembers);

    } catch (error) {
      console.warn('⚠️ Team members niet geladen:', error.message);
      this.teamMembers = [];
    }
  }

  // ============================================
  // UI UPDATES
  // ============================================

  refresh() {
    this.renderer.updateBadges();
    this.renderer.renderActiveTab();
    this.renderer.updateFooter();
    this.eventHandlers.attachContentListeners();
  }

  // Backwards compatibility aliases for TCC bridge
  renderContent() {
    this.refresh();
  }

  updateBadges() {
    this.renderer.updateBadges();
  }

  updateFooter() {
    this.renderer.updateFooter();
  }

  attachContentListeners() {
    this.eventHandlers.attachContentListeners();
  }

  switchTab(tabName) {
    if (tabName === this.activeTab) return;

    this.activeTab = tabName;
    this.renderer.updateTabStyles(tabName);
    this.refresh();
  }

  notifyUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this.tender?.id);
    }
  }

  // ============================================
  // TENDER MILESTONES
  // ============================================

  _buildTenderMilestones() {
    if (!this.tender) return [];

    const now = new Date();
    const t = this.tender;

    const milestoneConfig = [
      { field: 'publicatie_datum', label: 'Publicatie Aanbesteding', sublabel: 'Gepubliceerd op TenderNed / Mercell', iconType: 'blue', iconName: 'calendar' },
      { field: 'schouw_datum', label: 'Schouw / Locatiebezoek', sublabel: 'Optioneel bezoekmoment', iconType: 'gray', iconName: 'eye' },
      { field: 'nvi1_datum', label: 'NVI 1 — Indiening vragen', sublabel: 'Nota van Inlichtingen ronde 1', iconType: 'blue', iconName: 'clock' },
      { field: 'nvi_1_publicatie', label: 'NVI 1 — Publicatie antwoorden', sublabel: 'Antwoorden op ingediende vragen', iconType: 'blue', iconName: 'clock' },
      { field: 'nvi2_datum', label: 'NVI 2 — Indiening vragen', sublabel: 'Nota van Inlichtingen ronde 2', iconType: 'blue', iconName: 'clock' },
      { field: 'nvi_2_publicatie', label: 'NVI 2 — Publicatie antwoorden', sublabel: 'Eventuele aanvullende vragen', iconType: 'blue', iconName: 'clock' },
      { field: 'presentatie_datum', label: 'Presentatie / Interview', sublabel: 'Mondelinge toelichting op inschrijving', iconType: 'orange', iconName: 'users' },
      { field: 'interne_deadline', label: 'Interne deadline', sublabel: 'Eigen streefdatum voor indieningsgereed', iconType: 'orange', iconName: 'shield' },
      { field: 'deadline_indiening', label: 'Deadline indienen Inschrijvingen', sublabel: 'Uiterste moment voor indiening', iconType: 'red', iconName: 'zap', isDeadline: true },
      { field: 'voorlopige_gunning', label: 'Voorlopige gunning', sublabel: 'Communicatie voorgenomen gunningsbeslissing', iconType: 'blue', iconName: 'checkCircle' },
      { field: 'definitieve_gunning', label: 'Definitieve gunning', sublabel: 'Na bezwaartermijn', iconType: 'blue', iconName: 'checkCircle' },
      { field: 'start_uitvoering', label: 'Start Raamovereenkomst', sublabel: 'Ingangsdatum overeenkomst', iconType: 'green', iconName: 'play' },
      { field: 'einde_contract', label: 'Einde Contract', sublabel: 'Einddatum overeenkomst', iconType: 'gray', iconName: 'clock' },
    ];

    const milestones = [];

    for (const config of milestoneConfig) {
      const rawDate = t[config.field];
      if (!rawDate) continue;

      const date = new Date(rawDate);
      if (isNaN(date.getTime())) continue;

      const isPassed = date < now;

      milestones.push({
        label: config.label,
        sublabel: config.sublabel,
        date: date,
        iconType: config.iconType,
        iconName: config.iconName,
        isDeadline: config.isDeadline || false,
        isPassed: isPassed,
        isNext: false,
        field: config.field
      });
    }

    // Sort chronologically
    milestones.sort((a, b) => a.date - b.date);

    // Mark next upcoming milestone
    const nextIdx = milestones.findIndex(m => !m.isPassed);
    if (nextIdx !== -1) {
      milestones[nextIdx].isNext = true;
    }

    return milestones;
  }
}

export default PlanningModal;