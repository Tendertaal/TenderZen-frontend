/**
 * TeamAvatar Component
 * Toont initialen van een teamlid in een gekleurde cirkel
 */

export class TeamAvatar {
    constructor(name, colorClass = 'purple') {
        this.name = name;
        this.colorClass = colorClass;
        this.initials = this.getInitials(name);
    }

    getInitials(name) {
        if (!name) return '??';
        
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    getColorStyle(colorClass) {
        const colors = {
            'purple': '#9c27b0',
            'pink': '#e91e63',
            'blue': '#2196f3',
            'green': '#4caf50',
            'orange': '#ff9800',
            'red': '#f44336',
            'teal': '#009688',
            'indigo': '#3f51b5'
        };

        return colors[colorClass] || colors['purple'];
    }

    render() {
        const avatar = document.createElement('div');
        avatar.className = `avatar-small avatar-${this.colorClass}`;
        avatar.textContent = this.initials;
        avatar.title = this.name;
        
        avatar.style.cssText = `
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: 600;
            color: white;
            background: ${this.getColorStyle(this.colorClass)};
            flex-shrink: 0;
        `;

        return avatar;
    }

    // Static method voor het toewijzen van kleuren op basis van index
    static getColorForIndex(index) {
        const colors = ['purple', 'pink', 'blue', 'green', 'orange', 'teal', 'indigo', 'red'];
        return colors[index % colors.length];
    }
}