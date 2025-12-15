/**
 * TimelineCell Component
 * Toont een deadline of milestone in de timeline
 */

export class TimelineCell {
    constructor(deadline = null) {
        this.deadline = deadline;
    }

    calculateDaysUntil(dateString) {
        if (!dateString) return null;
        
        const deadlineDate = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = deadlineDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    formatDate(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        const months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 
                       'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
        
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
    }

    formatTime(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    getDeadlineStatus(daysUntil) {
        if (daysUntil === null) return 'empty';
        if (daysUntil < 0) return 'completed';
        if (daysUntil <= 3) return 'critical';
        if (daysUntil <= 7) return 'warning';
        return 'normal';
    }

    render() {
        const cell = document.createElement('div');
        cell.className = 'timeline-cell';
        cell.style.cssText = `
            width: 160px;
            min-width: 160px;
            padding: 20px 12px;
            border-right: 2px solid #e8eaed;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
        `;

        const wrapper = document.createElement('div');
        wrapper.style.width = '100%';

        if (!this.deadline || !this.deadline.date) {
            // Empty state
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'date-display empty';
            emptyDiv.textContent = '+ Datum toevoegen';
            emptyDiv.style.cssText = `
                width: 100%;
                padding: 10px;
                background: #f8f9fa;
                border: 2px dashed #d1d5db;
                color: #718096;
                border-radius: 8px;
                text-align: center;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
            `;

            emptyDiv.addEventListener('mouseenter', () => {
                emptyDiv.style.borderColor = '#94a3b8';
                emptyDiv.style.background = '#f1f5f9';
            });
            emptyDiv.addEventListener('mouseleave', () => {
                emptyDiv.style.borderColor = '#d1d5db';
                emptyDiv.style.background = '#f8f9fa';
            });

            wrapper.appendChild(emptyDiv);
        } else {
            // Has deadline
            const daysUntil = this.calculateDaysUntil(this.deadline.date);
            const status = this.getDeadlineStatus(daysUntil);

            const dateDiv = document.createElement('div');
            dateDiv.className = `date-display ${status}`;

            // Status styling
            const styles = {
                'normal': { bg: 'white', border: '#3498db', color: '#2c3e50' },
                'warning': { bg: '#fff7ed', border: '#fb923c', color: '#c2410c' },
                'critical': { bg: '#fff5f5', border: '#e74c3c', color: '#c62828' },
                'completed': { bg: '#f8fafc', border: '#cbd5e1', color: '#64748b' }
            };

            const style = styles[status] || styles['normal'];
            
            dateDiv.style.cssText = `
                width: 100%;
                padding: 10px;
                border: 2px solid ${style.border};
                border-radius: 8px;
                text-align: center;
                font-size: 13px;
                color: ${style.color};
                font-weight: 600;
                background: ${style.bg};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
            `;

            if (status === 'critical') {
                dateDiv.style.animation = 'pulse 2s infinite';
            }

            // Date text
            dateDiv.textContent = this.formatDate(this.deadline.date);

            // Time
            const timeSpan = document.createElement('span');
            timeSpan.className = 'date-time';
            timeSpan.textContent = this.formatTime(this.deadline.date);
            timeSpan.style.cssText = `
                display: block;
                font-size: 11px;
                margin-top: 4px;
                opacity: 0.8;
            `;
            dateDiv.appendChild(timeSpan);

            wrapper.appendChild(dateDiv);

            // Days until deadline
            if (daysUntil !== null) {
                const daysDiv = document.createElement('div');
                daysDiv.className = `days-to-deadline ${status}`;
                
                let text;
                if (daysUntil < 0) {
                    text = `${Math.abs(daysUntil)} dagen geleden`;
                } else if (daysUntil === 0) {
                    text = 'Vandaag!';
                } else if (daysUntil === 1) {
                    text = '1 dag';
                } else {
                    text = `${daysUntil} dagen`;
                }

                daysDiv.textContent = text;
                daysDiv.style.cssText = `
                    margin-top: 8px;
                    padding: 4px 8px;
                    background: #f8fafc;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: 600;
                    color: ${style.color};
                    text-align: center;
                `;

                wrapper.appendChild(daysDiv);
            }
        }

        cell.appendChild(wrapper);
        return cell;
    }
}