// frontend/js/services/AIDocumentService.js

import { API_CONFIG } from '../config.js';

export class AIDocumentService {
  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL;
  }

  async saveDocument(tenderId, docData) {
    const token = await getAuthToken();
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
    const token = await getAuthToken();
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
    const token = await getAuthToken();
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
    const token = await getAuthToken();
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
