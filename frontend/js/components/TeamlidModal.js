/**
 * TeamlidModal - Modal voor teamlid Create/Edit
 * TenderZen v3.0 - COMPLETE REWRITE
 * 
 * Pattern: Exact same as BedrijfModal & TenderAanmaken
 * - Simple modal-overlay + modal-container structure
 * - Direct style.display control
 * - External CSS only (no inline styles)
 * - Clean form-section pattern
 */

import { teamService } from '../services/TeamService.js';

const Icons = window.Icons || {};

export class TeamlidModal {
    constructor() {
        this.isOpen = false;
        this.modal = null;
        this.mode = 'create'; // 'create', 'edit'
        this.teamMember = null;
        this.onSave = null;

        // Avatar kleuren
        this.avatarColors = [
            { key: '#8b5cf6', label: 'Paars' },
            { key: '#3b82f6', label: 'Blauw' },
            { key: '#10b981', label: 'Groen' },
            { key: '#f59e0b', label: 'Oranje' },
            { key: '#ec4899', label: 'Roze' },
            { key: '#06b6d4', label: 'Cyan' },
            { key: '#6366f1', label: 'Indigo' },
            { key: '#84cc16', label: 'Lime' }
        ];

        // Rollen
        this.roles = teamService.getRoles();
    }

    getIcon(name, size = 14, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    /**
     * Render modal
     */
    render() {
        console.log('🔧 TeamlidModal.render() started, mode:', this.mode);

        this.modal = document.createElement('div');
        this.modal.className = 'teamlid-modal';
        this.modal.id = 'teamlid-modal';
        this.modal.style.display = 'none';

        const title = this.mode === 'create' ? 'Nieuw Teamlid' : 'Teamlid Bewerken';
        const iconName = this.mode === 'create' ? 'userPlus' : 'edit';

        this.modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-container">
                <!-- Header -->
                <div class="modal-header">
                    <div class="modal-header-content">
                        <span class="modal-icon">
                            ${this.getIcon(iconName, 24, '#8b5cf6')}
                        </span>
                        <h2 class="modal-title">${title}</h2>
                    </div>
                    <button class="modal-close" id="teamlid-modal-close" type="button">
                        ${this.getIcon('x', 20)}
                    </button>
                </div>

                <!-- Content -->
                <div class="modal-content">
                    <form id="teamlid-form">
                        ${this.renderPersoonlijkeGegevens()}
                        ${this.renderRolCapaciteit()}
                        ${this.renderAvatar()}
                    </form>
                </div>

                <!-- Footer -->
                <div class="modal-footer">
                    <div class="modal-footer-left">
                        ${this.mode === 'edit' ? `
                            <button type="button" class="btn btn-danger" id="teamlid-btn-delete">
                                ${this.getIcon('trash', 16)}
                                <span>Verwijderen</span>
                            </button>
                        ` : ''}
                    </div>
                    <div class="modal-footer-right">
                        <button type="button" class="btn btn-secondary" id="teamlid-btn-cancel">
                            Annuleren
                        </button>
                        <button type="button" class="btn btn-primary" id="teamlid-btn-save">
                            ${this.getIcon('check', 16, '#ffffff')}
                            ${this.mode === 'create' ? 'Teamlid toevoegen' : 'Wijzigingen opslaan'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.attachEventListeners();
    }

    /**
     * Render persoonlijke gegevens
     */
    renderPersoonlijkeGegevens() {
        const m = this.teamMember || {};

        return `
            <div class="form-section form-section--primary">
                <h4 class="section-title">Persoonlijke Gegevens</h4>

                <div class="form-row">
                    <div class="form-group">
                        <label for="teamlid-naam">
                            Naam
                            <span class="required">*</span>
                        </label>
                        <input type="text" id="teamlid-naam" class="form-control form-control--prominent" 
                               value="${m.naam || ''}" placeholder="Bijv. Jan de Vries" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="teamlid-email">E-mailadres</label>
                        <input type="email" id="teamlid-email" class="form-control" 
                               value="${m.email || ''}" placeholder="jan@bedrijf.nl">
                    </div>
                    
                    <div class="form-group">
                        <label for="teamlid-telefoon">Telefoonnummer</label>
                        <input type="tel" id="teamlid-telefoon" class="form-control" 
                               value="${m.telefoon || ''}" placeholder="+31 6 12345678">
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render rol & capaciteit
     */
    renderRolCapaciteit() {
        const m = this.teamMember || {};

        const roleOptions = this.roles.map(r =>
            `<option value="${r.key}" ${m.rol === r.key ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        const bureauRoles = [
            { key: 'admin', label: 'Bureau Admin' },
            { key: 'manager', label: 'Tender Manager' },
            { key: 'schrijver', label: 'Teamlid' },
            { key: 'viewer', label: 'Viewer' }
        ];

        const bureauRoleOptions = bureauRoles.map(r =>
            `<option value="${r.key}" ${m.bureau_rol === r.key ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        return `
            <div class="form-section">
                <h4 class="section-title">Rol & Capaciteit</h4>

                <div class="form-row">
                    <div class="form-group">
                        <label for="teamlid-bureau-rol">
                            Bureau Toegang
                            <span class="required">*</span>
                        </label>
                        <select id="teamlid-bureau-rol" class="form-control" required>
                            <option value="">-- Selecteer toegangsniveau --</option>
                            ${bureauRoleOptions}
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="teamlid-rol">
                            Functie/Expertise
                            <span class="required">*</span>
                        </label>
                        <select id="teamlid-rol" class="form-control" required>
                            <option value="">-- Selecteer functie --</option>
                            ${roleOptions}
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="teamlid-functie">Functietitel</label>
                        <input type="text" id="teamlid-functie" class="form-control" 
                               value="${m.functie || ''}" placeholder="Bijv. Senior Tender Schrijver">
                    </div>
                    
                    <div class="form-group">
                        <label for="teamlid-capaciteit">Capaciteit (uren/week)</label>
                        <input type="number" id="teamlid-capaciteit" class="form-control" 
                               value="${m.capaciteit_uren_per_week || 40}" min="0" max="60">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="teamlid-is-actief" ${m.is_active !== false ? 'checked' : ''}>
                            <span class="checkbox-custom"></span>
                            <span class="checkbox-text">Actief</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render avatar
     */
    renderAvatar() {
        const m = this.teamMember || {};
        const initialen = m.initialen || '??';
        const color = m.avatar_kleur || this.avatarColors[0].key;

        const colorButtons = this.avatarColors.map((c, i) => `
            <button type="button" class="color-btn ${c.key === color ? 'active' : ''}" 
                    data-color="${c.key}" title="${c.label}">
                <span class="color-preview" style="background: ${c.key}"></span>
            </button>
        `).join('');

        return `
            <div class="form-section">
                <h4 class="section-title">Avatar</h4>

                <div class="avatar-section">
                    <div class="avatar-preview-container">
                        <div class="avatar-preview" id="teamlid-avatar-preview" style="background: ${color}">
                            <span id="teamlid-avatar-initialen">${initialen}</span>
                        </div>
                        <div class="avatar-preview-name" id="teamlid-avatar-name">${m.naam || 'Naam'}</div>
                    </div>
                    
                    <div class="avatar-settings">
                        <div class="form-group">
                            <label for="teamlid-initialen">Initialen</label>
                            <input type="text" id="teamlid-initialen" class="form-control" 
                                   value="${initialen}" maxlength="3">
                        </div>
                        
                        <div class="form-group">
                            <label>Avatar kleur</label>
                            <div class="color-picker">
                                ${colorButtons}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Helper: Get icon
     */
    getIcon(name, size = 16, color = null) {
        if (Icons && typeof Icons[name] === 'function') {
            const options = { size };
            if (color) options.color = color;
            return Icons[name](options);
        }
        return '';
    }

    /**
     * Generate initials from name
     */
    generateInitials(naam) {
        if (!naam) return '??';
        const parts = naam.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        const closeBtn = this.modal.querySelector('#teamlid-modal-close');
        const cancelBtn = this.modal.querySelector('#teamlid-btn-cancel');
        const saveBtn = this.modal.querySelector('#teamlid-btn-save');
        const deleteBtn = this.modal.querySelector('#teamlid-btn-delete');
        const overlay = this.modal.querySelector('.modal-overlay');

        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
        if (overlay) overlay.addEventListener('click', () => this.close());

        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveTeamMember();
            });
        }

        // Delete button
        if (deleteBtn && this.mode === 'edit' && this.teamMember) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm(`Weet je zeker dat je "${this.teamMember.naam}" wilt verwijderen?`)) {
                    try {
                        console.log('🗑️ Deleting teamlid:', this.teamMember.id);
                        await teamService.deleteTeamMember(this.teamMember.id);
                        console.log('✅ Teamlid deleted');

                        if (this.onSave) {
                            this.onSave();
                        }

                        this.close();
                    } catch (error) {
                        console.error('Error deleting teamlid:', error);
                        alert('Fout bij verwijderen: ' + error.message);
                    }
                }
            });
        }

        // Naam input -> update initialen en preview
        const naamInput = this.modal.querySelector('#teamlid-naam');
        const initialenInput = this.modal.querySelector('#teamlid-initialen');
        const avatarPreview = this.modal.querySelector('#teamlid-avatar-initialen');
        const namePreview = this.modal.querySelector('#teamlid-avatar-name');

        if (naamInput) {
            naamInput.addEventListener('input', () => {
                const naam = naamInput.value;
                namePreview.textContent = naam || 'Naam';

                if (!initialenInput.dataset.manual) {
                    const initialen = this.generateInitials(naam);
                    initialenInput.value = initialen;
                    avatarPreview.textContent = initialen || '??';
                }
            });
        }

        if (initialenInput) {
            initialenInput.addEventListener('input', () => {
                initialenInput.dataset.manual = 'true';
                avatarPreview.textContent = initialenInput.value || '??';
            });
        }

        // Color picker
        this.modal.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.modal.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const color = btn.dataset.color;
                this.modal.querySelector('#teamlid-avatar-preview').style.background = color;
            });
        });

        // ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Generate initials from name
     */
    generateInitials(naam) {
        if (!naam) return '??';
        const parts = naam.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Open modal
     */
    open(teamMember = null) {
        console.log('🔧 TeamlidModal.open() called', { teamMember: teamMember?.naam });

        if (teamMember) {
            this.mode = 'edit';
            this.teamMember = teamMember;
        } else {
            this.mode = 'create';
            this.teamMember = null;
        }

        this.render();
        console.log('🔧 Rendered modal, appending to DOM');

        if (!document.body.contains(this.modal)) {
            document.body.appendChild(this.modal);
            console.log('✅ Modal appended to DOM');
        }

        // Show modal (SIMPLE: direct style.display)
        this.modal.style.display = 'flex';
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
        console.log('✅ Modal displayed (style.display = flex)');
    }

    /**
     * Close modal
     */
    close() {
        if (this.modal) {
            this.modal.style.display = 'none';
            this.isOpen = false;
            document.body.style.overflow = '';
        }
    }

    /**
     * Fill form with member data
     */
    fillForm(member) {
        this.modal.querySelector('#teamlid-naam').value = member.naam || '';
        this.modal.querySelector('#teamlid-email').value = member.email || '';
        this.modal.querySelector('#teamlid-telefoon').value = member.telefoon || '';
        this.modal.querySelector('#teamlid-bureau-rol').value = member.bureau_rol || 'schrijver';
        this.modal.querySelector('#teamlid-rol').value = member.rol || '';
        this.modal.querySelector('#teamlid-functie').value = member.functie || '';
        this.modal.querySelector('#teamlid-capaciteit').value = member.capaciteit_uren_per_week || 40;
        this.modal.querySelector('#teamlid-is-actief').checked = member.is_active !== false;

        const initialen = member.initialen || this.generateInitials(member.naam);
        this.modal.querySelector('#teamlid-initialen').value = initialen;
        this.modal.querySelector('#teamlid-avatar-initialen').textContent = initialen;
        this.modal.querySelector('#teamlid-avatar-name').textContent = member.naam || 'Naam';

        // Set color
        const color = member.avatar_kleur || this.avatarColors[0].key;
        this.modal.querySelector('#teamlid-avatar-preview').style.background = color;
        this.modal.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });
    }

    /**
     * Reset form
     */
    resetForm() {
        this.modal.querySelector('#teamlid-form').reset();
        this.modal.querySelector('#teamlid-initialen').dataset.manual = '';
        this.modal.querySelector('#teamlid-avatar-initialen').textContent = '??';
        this.modal.querySelector('#teamlid-avatar-name').textContent = 'Naam';
        this.modal.querySelector('#teamlid-avatar-preview').style.background = this.avatarColors[0].key;
        this.modal.querySelector('#teamlid-capaciteit').value = 40;
        this.modal.querySelector('#teamlid-is-actief').checked = true;
        this.modal.querySelector('#teamlid-bureau-rol').value = 'schrijver'; // Default

        // Reset color selection
        this.modal.querySelectorAll('.color-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === 0);
        });
    }

    /**
     * Save teamlid
     */
    async saveTeamMember() {
        console.log('🔧 saveTeamMember() called');
        const form = this.modal.querySelector('#teamlid-form');

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        // Validatie
        const naam = this.modal.querySelector('#teamlid-naam').value.trim();
        const bureauRol = this.modal.querySelector('#teamlid-bureau-rol').value;
        const rol = this.modal.querySelector('#teamlid-rol').value;

        if (!naam) {
            alert('Vul een naam in');
            return;
        }

        if (!bureauRol) {
            alert('Selecteer een toegangsniveau');
            return;
        }

        if (!rol) {
            alert('Selecteer een functie/expertise');
            return;
        }

        // Get selected color
        const activeColorBtn = this.modal.querySelector('.color-btn.active');
        const avatarKleur = activeColorBtn ? activeColorBtn.dataset.color : this.avatarColors[0].key;

        const data = {
            naam: naam,
            email: this.modal.querySelector('#teamlid-email').value.trim(),
            telefoon: this.modal.querySelector('#teamlid-telefoon').value.trim(),
            bureau_rol: bureauRol,
            rol: rol,
            functie: this.modal.querySelector('#teamlid-functie').value.trim(),
            capaciteit_uren_per_week: parseInt(this.modal.querySelector('#teamlid-capaciteit').value) || 40,
            is_active: this.modal.querySelector('#teamlid-is-actief').checked,
            initialen: this.modal.querySelector('#teamlid-initialen').value.trim() || this.generateInitials(naam),
            avatar_kleur: avatarKleur
        };

        try {
            console.log('💾 Saving teamlid:', data);

            if (this.mode === 'create') {
                await teamService.createTeamMember(data);
                console.log('✅ Teamlid created');
            } else {
                data.id = this.teamMember.id;
                await teamService.updateTeamMember(this.teamMember.id, data);
                console.log('✅ Teamlid updated');
            }

            if (this.onSave) {
                this.onSave();
            }

            this.close();
        } catch (error) {
            console.error('Error saving teamlid:', error);
            alert('Fout bij opslaan: ' + error.message);
        }
    }


}

export default TeamlidModal;
