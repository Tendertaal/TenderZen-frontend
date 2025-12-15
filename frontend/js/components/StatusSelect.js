/**
 * StatusSelect Component
 * Dropdown voor het selecteren van tender status
 */

export class StatusSelect {
    constructor(currentStatus = 'Opstellen offerte', onChange = null) {
        this.currentStatus = currentStatus;
        this.onChange = onChange;
        
        this.statuses = [
            'Zoeken bedrijf',
            'Opstellen offerte',
            'Offerte akkoord',
            'Inplannen',
            'Uitvoeren',
            'Ingediend',
            'Evalueren',
            'Afgerond'
        ];

        this.statusColors = {
            'Zoeken bedrijf': { bg: '#fef3c7', border: '#fde68a', text: '#92400e' },
            'Opstellen offerte': { bg: '#fef08a', border: '#eab308', text: '#ca8a04' },
            'Offerte akkoord': { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af' },
            'Inplannen': { bg: '#e0e7ff', border: '#c7d2fe', text: '#4338ca' },
            'Uitvoeren': { bg: '#ddd6fe', border: '#c4b5fd', text: '#6d28d9' },
            'Ingediend': { bg: '#dcfce7', border: '#bbf7d0', text: '#065f46' },
            'Evalueren': { bg: '#fed7aa', border: '#fdba74', text: '#9a3412' },
            'Afgerond': { bg: '#d1d5db', border: '#9ca3af', text: '#374151' }
        };
    }

    getStatusColor(status) {
        return this.statusColors[status] || this.statusColors['Opstellen offerte'];
    }

    render() {
        const section = document.createElement('div');
        section.className = 'section-status';
        section.style.cssText = `
            width: 180px;
            min-width: 180px;
            padding: 20px 16px;
            border-right: 2px solid #e8eaed;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            background: white;
        `;

        const select = document.createElement('select');
        select.className = 'status-select';
        
        const colors = this.getStatusColor(this.currentStatus);
        select.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            border: 2px solid ${colors.border};
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            background: ${colors.bg};
            color: ${colors.text};
            text-align: center;
            outline: none;
            transition: all 0.2s;
        `;

        // Voeg alle statuses toe
        this.statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status;
            option.textContent = status;
            option.selected = status === this.currentStatus;
            select.appendChild(option);
        });

        // Change handler
        select.addEventListener('change', (e) => {
            const newStatus = e.target.value;
            const newColors = this.getStatusColor(newStatus);
            
            // Update styling
            select.style.background = newColors.bg;
            select.style.borderColor = newColors.border;
            select.style.color = newColors.text;

            // Call callback
            if (this.onChange) {
                this.onChange(newStatus);
            }
        });

        // Hover effect
        select.addEventListener('mouseenter', () => {
            select.style.transform = 'scale(1.02)';
        });
        select.addEventListener('mouseleave', () => {
            select.style.transform = 'scale(1)';
        });

        section.appendChild(select);
        return section;
    }
}