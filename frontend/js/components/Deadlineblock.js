/**
 * DeadlineBlock Component
 * Toont deadline datum met kleurcodering (rood/oranje/groen)
 */

import { Component } from './Component.js';

export class DeadlineBlock extends Component {
    constructor(deadline) {
        super({ deadline });
        this.datum = deadline?.datum || null;
        this.naam = deadline?.naam || '';
        this.tijd = deadline?.tijd || null;
        this.clickable = deadline?.clickable !== false; // Default true
    }

    /**
     * Parse datum string naar Date object
     */
    parseDate(dateString) {
        if (!dateString) return null;
        return new Date(dateString);
    }

    /**
     * Format datum voor display
     */
    formatDate(date) {
        if (!date) return '';
        
        const day = date.getDate();
        const month = date.toLocaleString('nl-NL', { month: 'short' });
        const year = date.getFullYear();
        
        return `${day} ${month} ${year}`;
    }

    /**
     * Format tijd voor display
     */
    formatTime(timeString) {
        if (!timeString) return '';
        return timeString.substring(0, 5); // HH:MM
    }

    /**
     * Bepaal urgentie kleur
     */
    getUrgencyClass() {
        if (!this.datum) return 'deadline-block--future';
        
        const date = this.parseDate(this.datum);
        if (!date) return 'deadline-block--future';
        
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            // Overdue
            return 'deadline-block--overdue';
        } else if (diffDays <= 7) {
            // Deze week (urgent)
            return 'deadline-block--urgent';
        } else if (diffDays <= 14) {
            // Binnen 2 weken (binnenkort)
            return 'deadline-block--soon';
        } else {
            // Ver weg
            return 'deadline-block--future';
        }
    }

    /**
     * Get dagen tot deadline
     */
    getDaysUntil() {
        if (!this.datum) return null;
        
        const date = this.parseDate(this.datum);
        if (!date) return null;
        
        const now = new Date();
        const diffTime = date.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    /**
     * Get urgentie text
     */
    getUrgencyText() {
        const days = this.getDaysUntil();
        if (days === null) return '';
        
        if (days < 0) {
            return `${Math.abs(days)} dagen te laat`;
        } else if (days === 0) {
            return 'Vandaag!';
        } else if (days === 1) {
            return 'Morgen';
        } else if (days <= 7) {
            return `Over ${days} dagen`;
        } else {
            return '';
        }
    }

    /**
     * Render deadline block
     */
    render() {
        const block = document.createElement('div');
        block.className = `deadline-block ${this.getUrgencyClass()}`;
        
        if (this.clickable) {
            block.classList.add('deadline-block--clickable');
            block.style.cursor = 'pointer';
        }
        
        // Als geen datum, toon placeholder
        if (!this.datum) {
            block.innerHTML = `
                <div class="deadline-placeholder">
                    + Datum toevoegen
                </div>
            `;
        } else {
            const date = this.parseDate(this.datum);
            const formattedDate = this.formatDate(date);
            const formattedTime = this.formatTime(this.tijd);
            const urgencyText = this.getUrgencyText();
            
            block.innerHTML = `
                <div class="deadline-content">
                    <div class="deadline-date">${formattedDate}</div>
                    ${formattedTime ? `<div class="deadline-time">${formattedTime}</div>` : ''}
                    ${urgencyText ? `<div class="deadline-urgency">${urgencyText}</div>` : ''}
                    ${this.naam ? `<div class="deadline-label">${this.naam}</div>` : ''}
                </div>
            `;
        }
        
        // Click event
        if (this.clickable) {
            block.addEventListener('click', (e) => {
                e.stopPropagation();
                this.emit('click', {
                    datum: this.datum,
                    naam: this.naam,
                    tijd: this.tijd
                });
            });
        }
        
        this.element = block;
        return block;
    }

    /**
     * Update deadline
     */
    update(deadline) {
        this.datum = deadline?.datum || null;
        this.naam = deadline?.naam || '';
        this.tijd = deadline?.tijd || null;
        
        if (this.element) {
            const newBlock = this.render();
            this.element.replaceWith(newBlock);
            this.element = newBlock;
        }
    }
}

export default DeadlineBlock;