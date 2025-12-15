/**
 * TeamSection Component
 * Toont team rollen en toegewezen personen
/**
 * TeamSection Component
 * Toont team rollen en toegewezen personen
 */

import { TeamAvatar } from './TeamAvatar.js';

export class TeamSection {
    constructor(teamMembers = []) {
        this.teamMembers = Array.isArray(teamMembers) ? teamMembers : [];
        
        // Standaard rollen (altijd tonen)
        this.defaultRoles = [
            'Sales',
            'Manager',
            'Coördinator',
            'Schrijver',
            'Designer',
            'Klant contact'
        ];
    }

    createRoleRow(role, person = null) {
        const row = document.createElement('div');
        row.className = 'team-role';
        row.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        `;

        // Role label
        const label = document.createElement('div');
        label.className = 'role-label';
        label.textContent = role;
        label.style.cssText = `
            font-size: 12px;
            font-weight: 600;
            color: #64748b;
            min-width: 80px;
        `;

        row.appendChild(label);

        // Person or unassigned
        if (person && person.name) {
            const assignedDiv = document.createElement('div');
            assignedDiv.className = 'assigned-person';
            assignedDiv.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                background: #f1f5f9;
                border-radius: 6px;
                font-size: 13px;
                color: #334155;
                flex: 1;
                cursor: pointer;
                transition: all 0.2s;
            `;

            // Hover effect
            assignedDiv.addEventListener('mouseenter', () => {
                assignedDiv.style.background = '#e2e8f0';
            });
            assignedDiv.addEventListener('mouseleave', () => {
                assignedDiv.style.background = '#f1f5f9';
            });

            try {
                // Avatar
                const avatar = new TeamAvatar(person.name, person.color || 'purple');
                assignedDiv.appendChild(avatar.render());
            } catch (error) {
                console.error('Error rendering avatar:', error);
                // Fallback: toon alleen initialen zonder avatar
                const initials = this.getInitials(person.name);
                const fallbackAvatar = document.createElement('div');
                fallbackAvatar.textContent = initials;
                fallbackAvatar.style.cssText = `
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: 600;
                    color: white;
                    background: #9c27b0;
                    flex-shrink: 0;
                `;
                assignedDiv.appendChild(fallbackAvatar);
            }

            // Name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = person.name;
            assignedDiv.appendChild(nameSpan);

            row.appendChild(assignedDiv);
        } else {
            // Unassigned
            const unassignedDiv = document.createElement('div');
            unassignedDiv.className = 'unassigned';
            unassignedDiv.textContent = '+ Toevoegen';
            unassignedDiv.style.cssText = `
                padding: 6px 10px;
                border: 2px dashed #cbd5e0;
                border-radius: 6px;
                font-size: 12px;
                color: #94a3b8;
                text-align: center;
                flex: 1;
                cursor: pointer;
                transition: all 0.2s;
            `;

            // Hover effect
            unassignedDiv.addEventListener('mouseenter', () => {
                unassignedDiv.style.borderColor = '#94a3b8';
                unassignedDiv.style.color = '#64748b';
            });
            unassignedDiv.addEventListener('mouseleave', () => {
                unassignedDiv.style.borderColor = '#cbd5e0';
                unassignedDiv.style.color = '#94a3b8';
            });

            row.appendChild(unassignedDiv);
        }

        return row;
    }

    getInitials(name) {
        if (!name) return '??';
        
        const parts = name.trim().split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    render() {
        const section = document.createElement('div');
        section.className = 'section-team';
        section.style.cssText = `
            width: 280px;
            min-width: 280px;
            padding: 20px 16px;
            border-right: 2px solid #e8eaed;
            background: white;
        `;

        try {
            // Maak een map van rollen naar personen
            const roleMap = {};
            this.teamMembers.forEach(member => {
                if (member && member.role) {
                    roleMap[member.role] = member;
                }
            });

            // Render alle standaard rollen
            this.defaultRoles.forEach(role => {
                const person = roleMap[role] || null;
                const row = this.createRoleRow(role, person);
                section.appendChild(row);
            });

            // Verwijder margin van laatste item
            const lastRole = section.lastElementChild;
            if (lastRole) {
                lastRole.style.marginBottom = '0';
            }
        } catch (error) {
            console.error('Error rendering TeamSection:', error);
            // Toon error message
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                padding: 10px;
                background: #fee2e2;
                color: #991b1b;
                border-radius: 6px;
                font-size: 12px;
            `;
            errorDiv.textContent = 'Error loading team section';
            section.appendChild(errorDiv);
        }

        return section;
    }
}