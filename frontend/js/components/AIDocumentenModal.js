// frontend/js/components/AIDocumentenModal.js

import { AIDocumentenView } from '../views/AIDocumentenView.js';

export class AIDocumentenModal {
  constructor(tenderId) {
    this.tenderId = tenderId;
    this.modal = null;
    this.view = null;
  }

  async show() {
    // Maak overlay
    this.modal = document.createElement('div');
    this.modal.className = 'ai-documenten-modal-overlay';
    this.modal.innerHTML = `
            <div class="ai-documenten-modal">
                <div id="ai-documenten-modal-content"></div>
            </div>
        `;
    document.body.appendChild(this.modal);
    // Render de AI Documenten view
    const content = this.modal.querySelector('#ai-documenten-modal-content');
    this.view = new AIDocumentenView(content, this.tenderId);
    await this.view.render();
    this.attachEvents();
  }

  attachEvents() {
    // Sluitknop event direct koppelen
    const closeBtn = this.modal.querySelector('.ai-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    document.addEventListener('keydown', this.handleEsc);
  }

  handleEsc = (e) => {
    if (e.key === 'Escape') this.close();
  }

  close() {
    if (this.view) this.view.destroy();
    if (this.modal) {
      document.body.removeChild(this.modal);
      this.modal = null;
    }
    document.removeEventListener('keydown', this.handleEsc);
  }
}
