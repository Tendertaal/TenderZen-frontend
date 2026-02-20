/**
 * TeamlidModal - Modal voor teamlid Create/Edit
 * TenderZen v3.1 - HYBRID SYSTEM (Resources + Users)
 * 
 * CHANGELOG v3.1 (2026-02-20):
 * - ✅ Hybrid system: Resources (geen login) + Users (met login)
 * - ✅ Toggle tussen resource en user type
 * - ✅ Resources: Direct aanmaken in users tabel
 * - ✅ Users: Via Supabase invite flow
 * - ✅ Clear visual distinction tussen beide types
 * 
 * Pattern: Clean modal with type selection
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
        this.userType = 'resource'; // 'resource' or 'user'

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
                        ${this.renderTypeSelector()}
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
     * ✅ NIEUW: Type selector (Resource vs User)
     */
    renderTypeSelector() {
        const m = this.teamMember || {};
        const isResource = m.is_resource !== false; // Default to resource

        // In edit mode: toon current type, maar maak niet wijzigbaar
        if (this.mode === 'edit') {
            return `
                <div class="form-section" style="background: #f8fafc; border: 2px solid #e2e8f0;">
                    <div style="display: flex; align-items: center; gap: 10px; padding: 4px 0;">
                        <span style="font-size: 20px;">${isResource ? '📋' : '👤'}</span>
                        <div>
                            <div style="font-weight: 600; color: #0f172a; font-size: 14px;">
                                ${isResource ? 'Resource (geen login)' : 'TenderZen Gebruiker'}
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                                Type kan niet gewijzigd worden na aanmaken
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        // In create mode: toon toggle
        return `
            <div class="form-section form-section--primary">
                <h4 class="section-title">Type Teamlid</h4>
                
                <div class="user-type-selector">
                    <button type="button" class="user-type-btn user-type-btn--resource active" data-type="resource">
                        <div class="user-type-icon">📋</div>
                        <div class="user-type-content">
                            <div class="user-type-title">Resource</div>
                            <div class="user-type-desc">Alleen voor planning</div>
                        </div>
                    </button>
                    
                    <button type="button" class="user-type-btn user-type-btn--user" data-type="user">
                        <div class="user-type-icon">👤</div>
                        <div class="user-type-content">
                            <div class="user-type-title">TenderZen Gebruiker</div>
                            <div class="user-type-desc">Kan inloggen</div>
                        </div>
                    </button>
                </div>

                <input type="hidden" id="teamlid-type" value="resource">

                <!-- Info boxes -->
                <div class="user-type-info" id="user-type-info-resource">
                    <div style="display: flex; gap: 10px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                        <span style="font-size: 16px;">💡</span>
                        <div style="font-size: 13px; color: #1e40af; line-height: 1.5;">
                            <strong>Resource:</strong> Voor externe freelancers, consultants of onderaannemers. 
                            Kan niet inloggen, alleen voor planning en toewijzing.
                        </div>
                    </div>
                </div>

                <div class="user-type-info" id="user-type-info-user" style="display: none;">
                    <div style="display: flex; gap: 10px; padding: 12px; background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px;">
                        <span style="font-size: 16px;">⚠️</span>
                        <div style="font-size: 13px; color: #78350f; line-height: 1.5;">
                            <strong>TenderZen Gebruiker:</strong> Voor intern team dat moet kunnen inloggen. 
                            Krijgt uitnodiging via email en kan zelfstandig in het systeem werken.
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render persoonlijke gegevens
     */
    renderPersoonlijkeGegevens() {
        const m = this.teamMember || {};

        return `
            <div class="form-section">
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
                               value="${m.email || ''}" placeholder="jan@extern.nl">
                        <small style="color: #64748b; font-size: 12px; margin-top: 4px; display: block;">
                            Optioneel voor resources, verplicht voor TenderZen gebruikers
                        </small>
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

        // ✅ NIEUW: Type selector toggle
        this.modal.querySelectorAll('.user-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const type = btn.dataset.type;

                // Update active state
                this.modal.querySelectorAll('.user-type-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update hidden input
                this.modal.querySelector('#teamlid-type').value = type;
                this.userType = type;

                // Toggle info boxes
                this.modal.querySelector('#user-type-info-resource').style.display =
                    type === 'resource' ? 'block' : 'none';
                this.modal.querySelector('#user-type-info-user').style.display =
                    type === 'user' ? 'block' : 'none';

                console.log('👤 User type changed to:', type);
            });
        });

        // Delete button
        if (deleteBtn && this.mode === 'edit' && this.teamMember) {
            deleteBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                if (confirm(`Weet je zeker dat je "${this.teamMember.naam}" wilt verwijderen?`)) {
                    try {
                        const supabase = window.supabaseClient || window.supabase;
                        const userId = this.teamMember.user_id || this.teamMember.id;
                        const bureauId = this._getActiveBureauId();

                        const { error } = await supabase
                            .from('user_bureau_access')
                            .update({ is_active: false })
                            .eq('user_id', userId)
                            .eq('tenderbureau_id', bureauId);

                        if (error) throw error;

                        // ✅ Close modal first
                        this.close();

                        // ✅ Clear cache (always use public clearCache if available)
                        if (window.teamService && typeof window.teamService.clearCache === 'function') {
                            console.log('🔄 [TeamlidModal] Calling window.teamService.clearCache()');
                            window.teamService.clearCache();
                        } else if (window.teamService) {
                            window.teamService.teamMembers = null;
                        }

                        // ✅ Trigger refresh event
                        window.dispatchEvent(new CustomEvent('team-updated', {
                            detail: { action: 'delete', teamMember: this.teamMember }
                        }));

                        // ✅ Success notification
                        if (typeof showNotification === 'function') {
                            showNotification(`✅ ${this.teamMember.naam} verwijderd uit team`, 'success');
                        }

                        // ✅ Callback
                        if (this.onSave) {
                            this.onSave();
                        }
                    } catch (error) {
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
     * Open modal
     */
    open(teamMember = null) {
        console.log('🔧 TeamlidModal.open() called', { teamMember: teamMember?.naam });

        if (teamMember) {
            this.mode = 'edit';
            this.teamMember = teamMember;
            this.userType = teamMember.is_resource ? 'resource' : 'user';
        } else {
            this.mode = 'create';
            this.teamMember = null;
            this.userType = 'resource'; // Default
        }

        this.render();

        if (!document.body.contains(this.modal)) {
            document.body.appendChild(this.modal);
        }

        this.modal.style.display = 'flex';
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
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
     * ✅ UPDATED: Save teamlid (Hybrid: Resource or User)
     */
    /**
     * ✅ UPDATED: Save teamlid (Hybrid: Resource or User) - WITH AUTO-REFRESH
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
        const email = this.modal.querySelector('#teamlid-email').value.trim();
        const bureauRol = this.modal.querySelector('#teamlid-bureau-rol').value;
        const rol = this.modal.querySelector('#teamlid-rol').value;
        const userType = this.modal.querySelector('#teamlid-type')?.value || 'resource';

        if (!naam) {
            alert('Vul een naam in');
            return;
        }

        // Email verplicht voor users, optioneel voor resources
        if (userType === 'user' && !email) {
            alert('E-mailadres is verplicht voor TenderZen gebruikers');
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
            email: email,
            telefoon: this.modal.querySelector('#teamlid-telefoon').value.trim(),
            bureau_rol: bureauRol,
            rol: rol,
            functie: this.modal.querySelector('#teamlid-functie').value.trim(),
            capaciteit_uren_per_week: parseInt(this.modal.querySelector('#teamlid-capaciteit').value) || 40,
            is_active: this.modal.querySelector('#teamlid-is-actief').checked,
            initialen: this.modal.querySelector('#teamlid-initialen').value.trim() || this.generateInitials(naam),
            avatar_kleur: avatarKleur,
            is_resource: userType === 'resource'
        };

        try {
            console.log('💾 Saving teamlid:', data);

            if (this.mode === 'create') {
                if (data.is_resource) {
                    await this._createResource(data);
                } else {
                    await this._createUser(data);
                }
            } else {
                await this._updateTeamMember(data);
            }

            // ✅ IMPROVED EVENT-DRIVEN SUCCESS FLOW

            // 1. Close modal first (better UX)
            this.close();

            // 2. Force clear TeamService cache (always use public clearCache if available)
            if (window.teamService && typeof window.teamService.clearCache === 'function') {
                console.log('🔄 [TeamlidModal] Calling window.teamService.clearCache()');
                window.teamService.clearCache();
            } else if (window.teamService) {
                window.teamService.teamMembers = null;
            }

            // 3. Trigger global refresh event
            console.log('📢 Dispatching team-updated event');
            window.dispatchEvent(new CustomEvent('team-updated', {
                detail: { action: this.mode, teamMember: data }
            }));

            // 4. Show success notification
            if (typeof showNotification === 'function') {
                showNotification(
                    `✅ ${data.naam} ${this.mode === 'create' ? 'toegevoegd aan team' : 'bijgewerkt'}`,
                    'success'
                );
            }

            // 5. Call onSave callback
            if (this.onSave) {
                this.onSave();
            }

        } catch (error) {
            console.error('Error saving teamlid:', error);
            this._showError(error.message);
        }
    }

    /**
     * ✅ IMPROVED: Create Resource with rollback
     */
    async _createResource(data) {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) {
            throw new Error('Supabase client niet beschikbaar');
        }

        console.log('🔧 _createResource called with data:', data);

        let userId;
        let userWasCreated = false;

        try {
            // Check of user al bestaat
            if (data.email) {
                const { data: existingUsers } = await supabase
                    .from('users')
                    .select('id, email, naam, is_resource')
                    .eq('email', data.email);

                if (existingUsers && existingUsers.length > 0) {
                    userId = existingUsers[0].id;
                    console.log('✅ User bestaat al, hergebruiken:', userId);

                    // Update user info
                    await supabase
                        .from('users')
                        .update({
                            naam: data.naam,
                            initialen: data.initialen,
                            avatar_kleur: data.avatar_kleur,
                            functie: data.functie,
                            is_resource: true
                        })
                        .eq('id', userId);
                } else {
                    // Maak nieuwe user
                    userId = crypto.randomUUID();
                    userWasCreated = true;

                    const { error: createError } = await supabase
                        .from('users')
                        .insert({
                            id: userId,
                            email: data.email,
                            naam: data.naam,
                            initialen: data.initialen,
                            avatar_kleur: data.avatar_kleur,
                            functie: data.functie,
                            is_resource: true,
                            created_at: new Date().toISOString()
                        });

                    if (createError) throw createError;
                    console.log('✅ User created:', userId);
                }
            } else {
                // Geen email - maak nieuwe resource
                userId = crypto.randomUUID();
                userWasCreated = true;

                const { error: createError } = await supabase
                    .from('users')
                    .insert({
                        id: userId,
                        email: null,
                        naam: data.naam,
                        initialen: data.initialen,
                        avatar_kleur: data.avatar_kleur,
                        functie: data.functie,
                        is_resource: true,
                        created_at: new Date().toISOString()
                    });

                if (createError) throw createError;
                console.log('✅ User created (no email):', userId);
            }

            // Get bureau ID
            const bureauId = this._getActiveBureauId();
            console.log('🔧 Bureau ID:', bureauId);

            // Insert into user_bureau_access
            console.log('🔧 Inserting bureau access:', {
                user_id: userId,
                tenderbureau_id: bureauId,
                role: data.bureau_rol,
                is_active: data.is_active
            });

            const { data: bureauAccess, error: bureauError } = await supabase
                .from('user_bureau_access')
                .upsert({
                    user_id: userId,
                    tenderbureau_id: bureauId,
                    role: data.bureau_rol,
                    is_active: data.is_active
                }, {
                    onConflict: 'user_id,tenderbureau_id'
                })
                .select()
                .single();

            if (bureauError) {
                console.error('❌ Bureau access error:', bureauError);
                throw bureauError;
            }

            console.log('✅ Bureau access created:', bureauAccess);

            // Refresh cache
            if (window.teamService) {
                await window.teamService.refresh();
            }

            console.log('✅ Resource complete!');

        } catch (error) {
            // ROLLBACK: Delete user if it was just created
            if (userWasCreated && userId) {
                console.warn('⚠️ Rolling back user creation:', userId);
                await supabase.from('users').delete().eq('id', userId);
            }

            throw error;
        }
    }

    /**
     * ✅ UPDATED: Create User (via Supabase invite)
     */
    async _createUser(data) {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) {
            throw new Error('Supabase client niet beschikbaar');
        }

        // Check of user al bestaat
        const { data: existingUsers } = await supabase
            .from('users')
            .select('id, email, naam, is_resource')
            .eq('email', data.email);

        let userId;

        if (existingUsers && existingUsers.length > 0) {
            // User bestaat al
            userId = existingUsers[0].id;

            // Update info
            await supabase
                .from('users')
                .update({
                    naam: data.naam,
                    initialen: data.initialen,
                    avatar_kleur: data.avatar_kleur,
                    functie: data.functie,
                    is_resource: false  // Nu een echte user
                })
                .eq('id', userId);

        } else {
            // User bestaat NIET - toon invite instructies
            const inviteUrl = this._getSupabaseInviteUrl();
            const errorMsg = this._buildInviteInstructions(data.email, data.naam, inviteUrl);
            throw new Error(errorMsg);
        }

        // Voeg toe aan bureau
        const bureauId = this._getActiveBureauId();

        const { error: bureauError } = await supabase
            .from('user_bureau_access')
            .upsert({
                user_id: userId,
                tenderbureau_id: bureauId,
                role: data.bureau_rol,
                is_active: data.is_active
            });

        if (bureauError) {
            throw new Error(`Bureau koppeling mislukt: ${bureauError.message}`);
        }

        console.log('✅ User added to bureau:', bureauId);

        if (window.teamService) {
            await window.teamService.refresh();
        }
    }

    /**
     * Update team member
     */
    async _updateTeamMember(data) {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) {
            throw new Error('Supabase client niet beschikbaar');
        }

        const userId = this.teamMember.user_id || this.teamMember.id;
        if (!userId) {
            throw new Error('User ID ontbreekt');
        }

        // Update users tabel
        const { error: usersError } = await supabase
            .from('users')
            .update({
                naam: data.naam,
                email: data.email || null,
                initialen: data.initialen,
                avatar_kleur: data.avatar_kleur,
                functie: data.functie
            })
            .eq('id', userId);

        if (usersError) {
            throw new Error(`Users update mislukt: ${usersError.message}`);
        }

        // Update user_bureau_access
        const bureauId = this._getActiveBureauId();

        const { error: bureauError } = await supabase
            .from('user_bureau_access')
            .update({
                role: data.bureau_rol,
                is_active: data.is_active
            })
            .eq('user_id', userId)
            .eq('tenderbureau_id', bureauId);

        if (bureauError) {
            console.warn('⚠️ Bureau update warning:', bureauError);
        }

        console.log('✅ User bijgewerkt:', userId);

        if (window.teamService) {
            await window.teamService.refresh();
        }
    }

    /**
 * ✅ IMPROVED: Create Resource with rollback and better error handling
 */
    async _createResource(data) {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) {
            throw new Error('Supabase client niet beschikbaar');
        }

        console.log('🔧 _createResource called with data:', data);

        let userId;
        let userWasCreated = false;

        try {
            // Check of user al bestaat (via email)
            if (data.email) {
                const { data: existingUsers, error: checkError } = await supabase
                    .from('users')
                    .select('id, email, naam, is_resource')
                    .eq('email', data.email);

                if (checkError) {
                    throw new Error(`Database check mislukt: ${checkError.message}`);
                }

                if (existingUsers && existingUsers.length > 0) {
                    // User bestaat al - hergebruik deze!
                    userId = existingUsers[0].id;
                    console.log('✅ User bestaat al, hergebruiken:', userId);

                    // Update user info
                    const { error: updateError } = await supabase
                        .from('users')
                        .update({
                            naam: data.naam,
                            initialen: data.initialen,
                            avatar_kleur: data.avatar_kleur,
                            functie: data.functie,
                            is_resource: true  // Mark as resource
                        })
                        .eq('id', userId);

                    if (updateError) {
                        console.warn('⚠️ User update warning:', updateError);
                    }
                } else {
                    // User bestaat niet - maak nieuwe aan
                    userId = crypto.randomUUID();
                    userWasCreated = true;
                    console.log('✅ Creating new user with ID:', userId);

                    const { error: createError } = await supabase
                        .from('users')
                        .insert({
                            id: userId,
                            email: data.email,
                            naam: data.naam,
                            initialen: data.initialen,
                            avatar_kleur: data.avatar_kleur,
                            functie: data.functie,
                            is_resource: true,
                            created_at: new Date().toISOString()
                        });

                    if (createError) {
                        console.error('❌ User creation error:', createError);
                        throw new Error(`User aanmaken mislukt: ${createError.message}`);
                    }

                    console.log('✅ User created in users table');
                }
            } else {
                // Geen email - maak nieuwe resource aan zonder email
                userId = crypto.randomUUID();
                userWasCreated = true;
                console.log('✅ Creating new resource (no email) with ID:', userId);

                const { error: createError } = await supabase
                    .from('users')
                    .insert({
                        id: userId,
                        email: null,
                        naam: data.naam,
                        initialen: data.initialen,
                        avatar_kleur: data.avatar_kleur,
                        functie: data.functie,
                        is_resource: true,
                        created_at: new Date().toISOString()
                    });

                if (createError) {
                    console.error('❌ User creation error:', createError);
                    throw new Error(`Resource aanmaken mislukt: ${createError.message}`);
                }

                console.log('✅ Resource created in users table (no email)');
            }

            // Get bureau ID - CRITICAL STEP
            const bureauId = this._getActiveBureauId();
            console.log('🔧 Active bureau_id:', bureauId);

            // Insert into user_bureau_access
            console.log('🔧 Inserting into user_bureau_access:', {
                user_id: userId,
                tenderbureau_id: bureauId,
                role: data.bureau_rol,
                is_active: data.is_active
            });

            const { data: bureauAccess, error: bureauError } = await supabase
                .from('user_bureau_access')
                .upsert({
                    user_id: userId,
                    tenderbureau_id: bureauId,
                    role: data.bureau_rol,
                    is_active: data.is_active
                }, {
                    onConflict: 'user_id,tenderbureau_id'
                })
                .select()
                .single();

            if (bureauError) {
                console.error('❌ user_bureau_access insert error:', bureauError);
                console.error('❌ Error details:', {
                    message: bureauError.message,
                    code: bureauError.code,
                    details: bureauError.details,
                    hint: bureauError.hint
                });
                throw bureauError;
            }

            console.log('✅ Bureau access created:', bureauAccess);

            // Refresh TeamService cache
            if (window.teamService) {
                await window.teamService.refresh();
            }

            console.log('✅ Resource aanmaken compleet!');

        } catch (error) {
            console.error('💥 Error in _createResource:', error);

            // ROLLBACK: Delete user if it was just created
            if (userWasCreated && userId) {
                console.warn('⚠️ Rolling back - deleting user:', userId);
                try {
                    await supabase.from('users').delete().eq('id', userId);
                    console.log('✅ Rollback successful');
                } catch (rollbackError) {
                    console.error('❌ Rollback failed:', rollbackError);
                }
            }

            // Re-throw original error
            throw error;
        }
    }

    /**
     * Get active bureau ID - IMPROVED with comprehensive fallbacks
     */
    _getActiveBureauId() {
        console.log('🔧 _getActiveBureauId() called');

        let bureauId = null;

        // Try multiple sources in order of priority

        // 1. Try bureauAccessService (if exists)
        if (window.bureauAccessService && typeof window.bureauAccessService.getActiveBureauId === 'function') {
            bureauId = window.bureauAccessService.getActiveBureauId();
            console.log('🔧 Bureau from bureauAccessService:', bureauId);
        }

        // 2. Try window.activeBureauId
        if (!bureauId && window.activeBureauId) {
            bureauId = window.activeBureauId;
            console.log('🔧 Bureau from window.activeBureauId:', bureauId);
        }

        // 3. Try localStorage
        if (!bureauId && localStorage.getItem('selectedBureauId')) {
            bureauId = localStorage.getItem('selectedBureauId');
            console.log('🔧 Bureau from localStorage:', bureauId);
        }

        // 4. Try to extract from DOM (bureau selector dropdown)
        if (!bureauId) {
            const bureauSelector = document.querySelector('[data-bureau-id]');
            if (bureauSelector) {
                bureauId = bureauSelector.dataset.bureauId;
                console.log('🔧 Bureau from DOM:', bureauId);
            }
        }

        // 5. Try App.js
        if (!bureauId && window.app && window.app.activeBureauId) {
            bureauId = window.app.activeBureauId;
            console.log('🔧 Bureau from app.activeBureauId:', bureauId);
        }

        console.log('🎯 Final bureau_id:', bureauId);

        // Validate
        if (!bureauId || bureauId === 'ALL_BUREAUS') {
            throw new Error('Selecteer eerst een bureau voordat je teamleden kunt toevoegen.\n\nGa naar de bureau selector bovenaan het scherm en selecteer een specifiek bureau.');
        }

        return bureauId;
    }

    /**
     * Get Supabase invite URL
     */
    _getSupabaseInviteUrl() {
        const supabaseUrl = window.API_CONFIG?.supabaseUrl || window.SUPABASE_URL || '';
        const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || 'your-project';

        return `https://supabase.com/dashboard/project/${projectRef}/auth/users`;
    }

    /**
     * Build invite instructions message
     */
    _buildInviteInstructions(email, naam, inviteUrl) {
        return `User "${naam}" (${email}) heeft nog geen account.

STAP-VOOR-STAP:

1. Klik op deze link (opent in nieuw tabblad):
   ${inviteUrl}

2. Klik op "Invite user" knop (rechtsboven)

3. Vul in:
   • Email: ${email}
   • Send invite email: ✓ (aangevinkt)
   
4. Klik "Send invitation"

5. Kom terug naar dit scherm en probeer opnieuw

TIP: De user krijgt dan een email met een link om een wachtwoord in te stellen.`;
    }

    /**
     * Show error in beautiful modal overlay
     */
    _showError(message) {
        const isInviteError = message.includes('STAP-VOOR-STAP');

        if (isInviteError) {
            this._showInviteInstructionsModal(message);
        } else {
            alert(`Fout bij opslaan:\n\n${message}`);
        }
    }

    /**
     * Show invite instructions in beautiful modal
     */
    _showInviteInstructionsModal(message) {
        // ... (zelfde implementatie als v3.0 - behouden)
        // Deze functie blijft hetzelfde voor de User invite flow

        const lines = message.split('\n');
        const userName = lines[0];
        const emailMatch = message.match(/\(([^)]+@[^)]+)\)/);
        const email = emailMatch ? emailMatch[1] : '';
        const urlMatch = message.match(/(https:\/\/supabase\.com\/dashboard\/project\/[^\s]+)/);
        const inviteUrl = urlMatch ? urlMatch[1] : '';

        const overlay = document.createElement('div');
        overlay.className = 'teamlid-invite-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(15, 23, 42, 0.75); display: flex;
            align-items: center; justify-content: center; z-index: 10001;
            backdrop-filter: blur(4px);
        `;

        overlay.innerHTML = `
            <div style="background: white; border-radius: 16px; padding: 0; width: 90%; max-width: 560px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); max-height: 90vh; overflow-y: auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px 28px; border-radius: 16px 16px 0 0;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <div style="width: 48px; height: 48px; background: rgba(255,255,255,0.2); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px;">👤</div>
                        <div>
                            <h3 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">Account aanmaken vereist</h3>
                            <p style="margin: 4px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Deze user moet eerst een Supabase account krijgen</p>
                        </div>
                    </div>
                </div>
                <div style="padding: 28px;">
                    <div style="background: #fef3c7; border: 2px solid #fcd34d; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                        <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">⚠️ Nog geen account</div>
                        <div style="color: #78350f; font-size: 14px;">${userName}</div>
                    </div>
                    <div style="margin-bottom: 24px;">
                        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 16px;">Stap-voor-stap instructies</h4>
                        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 28px; height: 28px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">1</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #334155; margin-bottom: 8px;">Open Supabase Dashboard</div>
                                <a href="${inviteUrl}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: #667eea; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 500;">🔗 Open Dashboard <span style="font-size: 11px;">↗</span></a>
                            </div>
                        </div>
                        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 28px; height: 28px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">2</div>
                            <div><div style="font-weight: 600; color: #334155; margin-bottom: 6px;">Klik op "Invite user" knop</div><div style="color: #64748b; font-size: 13px;">Je vindt deze rechtsboven in het scherm</div></div>
                        </div>
                        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 28px; height: 28px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">3</div>
                            <div><div style="font-weight: 600; color: #334155; margin-bottom: 6px;">Vul gegevens in</div><div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 12px;"><div style="margin-bottom: 6px;"><span style="color: #64748b;">Email:</span> <strong style="color: #0f172a;">${email}</strong></div><div><span style="color: #64748b;">Send invite:</span> <strong style="color: #16a34a;">✓ Aangevinkt</strong></div></div></div>
                        </div>
                        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                            <div style="width: 28px; height: 28px; background: #667eea; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">4</div>
                            <div><div style="font-weight: 600; color: #334155; margin-bottom: 6px;">Klik "Send invitation"</div><div style="color: #64748b; font-size: 13px;">De user krijgt een email met een link om wachtwoord in te stellen</div></div>
                        </div>
                        <div style="display: flex; gap: 12px;">
                            <div style="width: 28px; height: 28px; background: #16a34a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; flex-shrink: 0;">5</div>
                            <div><div style="font-weight: 600; color: #334155; margin-bottom: 6px;">Kom terug en probeer opnieuw</div><div style="color: #64748b; font-size: 13px;">De user staat nu in het systeem en kan toegevoegd worden</div></div>
                        </div>
                    </div>
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px 16px; display: flex; gap: 10px; align-items: flex-start;">
                        <span style="font-size: 18px; flex-shrink: 0;">💡</span>
                        <div style="font-size: 13px; color: #1e40af; line-height: 1.5;"><strong>Tip:</strong> Je hoeft niet te wachten tot de user de invite email heeft geaccepteerd. Zodra je op "Send invitation" hebt geklikt, kun je de user meteen toevoegen aan je team.</div>
                    </div>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding: 16px 28px; display: flex; justify-content: flex-end; gap: 12px;">
                    <button onclick="this.closest('.teamlid-invite-overlay').remove()" style="padding: 10px 20px; background: white; border: 2px solid #e2e8f0; border-radius: 8px; color: #475569; font-weight: 500; cursor: pointer; font-size: 14px;">Begrepen</button>
                </div>
            </div>
        `;

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        document.body.appendChild(overlay);
    }
}

export default TeamlidModal;