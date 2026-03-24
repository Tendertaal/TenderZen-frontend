// frontend/js/services/AIDocumentService.js

import { API_CONFIG, supabase } from '../config.js';

export class AIDocumentService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  // NIEUW: Directe generatie via backend
  async generateDocument(tenderId, templateKey, model = 'sonnet') {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Geen geldige authenticatie. Log opnieuw in.');

    const response = await fetch(
      `${this.baseUrl}/api/v1/tenders/${tenderId}/generate-document`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          template_key: templateKey,
          model: model
        })
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Onbekende fout' }));
      throw new Error(error.detail || `Generatie mislukt (${response.status})`);
    }

    return await response.json();
  }

  // Vervang losse getAuthToken door class-methode
  async getAuthToken() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch {
      return null;
    }
  }

  async saveDocument(tenderId, docData) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Geen geldige authenticatie. Probeer opnieuw.');
    const response = await fetch(
      `${this.baseUrl}/tenders/${tenderId}/ai-documents`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(docData)
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to save document');
    }
    return await response.json();
  }

  async getDocuments(tenderId, options = {}) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Geen geldige authenticatie. Probeer opnieuw.');
    const params = new URLSearchParams();
    if (options.template_key) {
      params.append('template_key', options.template_key);
    }
    if (options.latest_only !== undefined) {
      params.append('latest_only', options.latest_only);
    }
    const url = `${this.baseUrl}/tenders/${tenderId}/ai-documents?${params}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    const data = await response.json();
    return data.documents;
  }

  async getDocument(documentId) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Geen geldige authenticatie. Probeer opnieuw.');
    const response = await fetch(
      `${this.baseUrl}/ai-documents/${documentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }
    return await response.json();
  }

  async deleteDocument(documentId) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Geen geldige authenticatie. Probeer opnieuw.');
    const response = await fetch(
      `${this.baseUrl}/ai-documents/${documentId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (!response.ok) {
      throw new Error('Failed to delete document');
    }
    return await response.json();
  }


}
