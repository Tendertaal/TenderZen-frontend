// frontend/js/services/AITemplateService.js

import { API_CONFIG } from '../config.js';
import { supabase } from '../config.js';

export class AITemplateService {
  constructor() {
    this.baseUrl = `${API_CONFIG.BASE_URL}/api/v1/ai-documents/templates`;
    console.log('✅ AITemplateService initialized:', this.baseUrl);
  }

  /**
   * Get authentication token from Supabase session
   * @returns {Promise<string|null>} Access token or null
   */
  async getAuthToken() {
    try {
      if (!supabase || !supabase.auth) {
        console.warn('⚠️ Supabase not initialized');
        return null;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Auth error:', error);
        return null;
      }

      if (!session || !session.access_token) {
        console.warn('⚠️ No active session');
        return null;
      }

      return session.access_token;
    } catch (error) {
      console.error('❌ Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Build headers for API requests
   * @param {boolean} includeAuth - Whether to include authorization header
   * @returns {Promise<Object>} Headers object
   */
  async getHeaders(includeAuth = false) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (includeAuth) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Get all available templates
   * @param {boolean} onlyActive - Filter for active templates only
   * @returns {Promise<Array>} List of templates
   */
  async getTemplates(onlyActive = true) {
    try {
      const url = onlyActive ? `${this.baseUrl}?only_active=true` : this.baseUrl;
      const headers = await this.getHeaders(false);

      console.log('📡 Fetching templates from:', url);

      const response = await fetch(url, { 
        method: 'GET',
        headers 
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Templates fetch failed:', response.status, errorText);
        throw new Error(`Failed to fetch templates: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Templates loaded:', data);

      if (data.templates && Array.isArray(data.templates)) {
        return data.templates;
      }
      
      if (Array.isArray(data)) {
        return data;
      }

      console.warn('⚠️ Unexpected response format:', data);
      return [];

    } catch (error) {
      console.error('❌ Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get specific template by key
   * @param {string} templateKey - Template identifier
   * @returns {Promise<Object>} Template data
   */
  async getTemplate(templateKey) {
    try {
      const url = `${this.baseUrl}/${templateKey}`;
      const headers = await this.getHeaders(true);

      console.log('📡 Fetching template:', templateKey);

      const response = await fetch(url, { 
        method: 'GET',
        headers 
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authenticatie vereist. Log opnieuw in.');
        }
        if (response.status === 404) {
          throw new Error('Template niet gevonden.');
        }
        throw new Error(`Failed to fetch template: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Template loaded:', templateKey);
      
      return data;

    } catch (error) {
      console.error('❌ Error fetching template:', error);
      throw error;
    }
  }

  /**
   * Fill prompt variables with tender data - DIRECT FROM SUPABASE
   * @param {string} templateKey - Template identifier
   * @param {string} tenderId - Tender ID
   * @returns {Promise<Object>} Filled prompt data
   */
  async fillPromptVariables(templateKey, tenderId) {
    try {
      console.log('📝 Filling prompt variables:', { templateKey, tenderId });

      // 1. Get tender data from Supabase
      const { data: tender, error: tenderError } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', tenderId)
        .single();

      if (tenderError || !tender) {
        throw new Error('Tender niet gevonden');
      }

      // 2. Get active prompt from Supabase
      const { data: prompts, error: promptError } = await supabase
        .from('ai_prompts')
        .select('*')
        .eq('template_key', templateKey)
        .eq('status', 'active')
        .or(`tenderbureau_id.eq.${tender.tenderbureau_id},tenderbureau_id.is.null`)
        .order('tenderbureau_id', { ascending: true }) // Bureau-specific first
        .limit(1);

      if (promptError || !prompts || prompts.length === 0) {
        throw new Error(`Geen actieve prompt gevonden voor ${templateKey}`);
      }

      const prompt = prompts[0];
      console.log(`✅ Using prompt: ${prompt.prompt_title} (v${prompt.version})`);

      // 3. Get uploaded documents
      const { data: documents } = await supabase
        .from('tender_documents')
        .select('*')
        .eq('tender_id', tenderId)
        .eq('is_deleted', false)
        .order('uploaded_at', { ascending: false });

      // 4. Build variables dictionary
      const variables = {
        tender_naam: tender.naam || 'Onbekende tender',
        tender_nummer: tender.tender_nummer || 'Geen nummer',
        opdrachtgever: tender.opdrachtgever || 'Onbekende opdrachtgever',
        aanbestedende_dienst: tender.aanbestedende_dienst || tender.opdrachtgever || 'Onbekend',
        locatie: tender.locatie || 'Niet opgegeven',
        tender_waarde: tender.tender_waarde ? `€ ${tender.tender_waarde.toLocaleString('nl-NL')}` : 'Niet opgegeven',
        deadline: tender.deadline_indiening || 'Niet opgegeven',
        omschrijving: tender.omschrijving || 'Geen beschrijving',
        fase: tender.fase || 'onbekend',
        status: tender.status || 'onbekend'
      };

      // 5. Build documents list
      if (documents && documents.length > 0) {
        const docTypes = {
          'aanbestedingsleidraad': 'Aanbestedingsleidraad',
          'pve': 'Programma van Eisen',
          'gunningscriteria': 'Gunningscriteria',
          'bijlagen': 'Bijlagen',
          'referenties': 'Referenties'
        };

        const docList = documents.map(doc => 
          `- ${docTypes[doc.document_type] || 'Document'}: ${doc.original_file_name}`
        );

        variables.documenten_lijst = docList.join('\n');
        variables.aantal_documenten = String(documents.length);
      } else {
        variables.documenten_lijst = '(Nog geen documenten geüpload)';
        variables.aantal_documenten = '0';
      }

      // 6. Fill template with variables
      let filledPrompt = prompt.prompt_content;
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        filledPrompt = filledPrompt.replace(new RegExp(placeholder, 'g'), String(value));
      }

      console.log('✅ Prompt filled successfully');

      return {
        success: true,
        filledPrompt: filledPrompt,
        prompt: filledPrompt,
        variables: variables,
        prompt_info: {
          id: prompt.id,
          title: prompt.prompt_title,
          version: prompt.version,
          is_bureau_specific: prompt.tenderbureau_id !== null
        },
        template_key: templateKey,
        tender_id: tenderId
      };

    } catch (error) {
      console.error('❌ Error filling prompt variables:', error);
      
      // Fallback to placeholder
      console.warn('⚠️ Using placeholder prompt due to error');
      return {
        success: false,
        filledPrompt: this._getPlaceholderPrompt(templateKey, tenderId),
        prompt: this._getPlaceholderPrompt(templateKey, tenderId),
        variables: {
          templateKey,
          tenderId,
          error: error.message
        },
        prompt_info: null,
        isPlaceholder: true
      };
    }
  }

  /**
   * Generate placeholder prompt for fallback
   * @private
   */
  _getPlaceholderPrompt(templateKey, tenderId) {
    const prompts = {
      'rode_draad': `Analyseer de rode draad van deze tender en identificeer de kernwaarden en verwachtingen van de opdrachtgever.

Tender ID: ${tenderId}

[Kon prompt niet laden - gebruik fallback]`,
      
      'offerte': `Genereer een offerte op basis van de tendereisen en voorwaarden.

Tender ID: ${tenderId}

[Kon prompt niet laden - gebruik fallback]`,
      
      'versie1_inschrijving': `Schrijf een eerste versie van de inschrijving op basis van de tenderinformatie.

Tender ID: ${tenderId}

[Kon prompt niet laden - gebruik fallback]`,
      
      'samenvatting': `Maak een samenvatting van de tender met de belangrijkste punten en eisen.

Tender ID: ${tenderId}

[Kon prompt niet laden - gebruik fallback]`,
      
      'win_check': `Beoordeel de winkans van deze tender.

Tender ID: ${tenderId}

[Kon prompt niet laden - gebruik fallback]`
    };

    return prompts[templateKey] || `Template: ${templateKey}\nTender: ${tenderId}\n\n[Prompt wordt gegenereerd]`;
  }
}