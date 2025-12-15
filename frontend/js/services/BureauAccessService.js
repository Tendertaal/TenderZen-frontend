/**
 * BureauAccessService - Multi-Bureau Toegang Service
 * TenderZen v2.1
 * 
 * Beheert multi-bureau toegang voor users:
 * - Ophalen bureaus waar user toegang tot heeft
 * - Wisselen tussen bureaus
 * - Bureau-specifieke rol en instellingen
 * - Uitnodigingen versturen en accepteren
 * 
 * CHANGELOG:
 * - v1.0: Initial version met multi-bureau support
 * - v2.0: Improved bureau switching
 * - v2.1: ⭐ window.bureauAccessService toegevoegd voor cross-service toegang
 */

import { supabase } from '/js/config.js';

class BureauAccessService {
    constructor() {
        // Cache voor huidige bureau context
        this._currentBureau = null;
        this._userBureaus = null;
        this._userRole = null;
        
        // Event listeners
        this._listeners = new Set();
    }

    // =========================================================
    // BUREAU CONTEXT
    // =========================================================

    /**
     * Haal alle bureaus op waar de user toegang tot heeft
     * @returns {Promise<Array>} Lijst van bureaus met rol info
     */
    async getUserBureaus() {
        try {
            // Probeer eerst de database functie
            const { data, error } = await supabase
                .rpc('get_user_bureaus');

            if (error) {
                console.warn('RPC get_user_bureaus failed, falling back to query:', error);
                return await this._getUserBureauxFallback();
            }

            this._userBureaus = data || [];
            return this._userBureaus;
        } catch (error) {
            console.error('âŒ Error fetching user bureaus:', error);
            throw error;
        }
    }

    /**
     * Fallback methode als de RPC functie niet werkt
     * @private
     */
    async _getUserBureauxFallback() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Niet ingelogd');

        const { data, error } = await supabase
            .from('user_bureau_access')
            .select(`
                id,
                role,
                is_default,
                last_accessed_at,
                capaciteit_uren_per_week,
                avatar_kleur,
                tenderbureau:tenderbureaus (
                    id,
                    naam,
                    slug,
                    logo_url,
                    is_active
                )
            `)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('last_accessed_at', { ascending: false, nullsFirst: false });

        if (error) throw error;

        // Transform naar verwacht formaat
        this._userBureaus = (data || [])
            .filter(item => item.tenderbureau?.is_active)
            .map(item => ({
                bureau_id: item.tenderbureau.id,
                bureau_naam: item.tenderbureau.naam,
                bureau_slug: item.tenderbureau.slug,
                bureau_logo: item.tenderbureau.logo_url,
                user_role: item.role,
                is_default: item.is_default,
                last_accessed_at: item.last_accessed_at,
                capaciteit_uren_per_week: item.capaciteit_uren_per_week,
                avatar_kleur: item.avatar_kleur
            }));

        return this._userBureaus;
    }

    /**
     * Haal het huidige actieve bureau op
     * @returns {Object|null} Huidige bureau of null
     */
    getCurrentBureau() {
        return this._currentBureau;
    }

    /**
     * Haal de rol van de user in het huidige bureau
     * @returns {string|null} Rol of null
     */
    getCurrentRole() {
        return this._userRole;
    }

    /**
     * Wissel naar een ander bureau
     * @param {string} bureauId - UUID van het bureau
     * @returns {Promise<Object>} Het nieuwe actieve bureau
     */
    async switchBureau(bureauId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Niet ingelogd');

            // Controleer of user toegang heeft
            const bureaus = this._userBureaus || await this.getUserBureaus();
            const bureau = bureaus.find(b => b.bureau_id === bureauId);
            
            if (!bureau) {
                throw new Error('Geen toegang tot dit bureau');
            }

            // Update last_accessed_at in database
            const { error: updateError } = await supabase
                .from('user_bureau_access')
                .update({ 
                    last_accessed_at: new Date().toISOString() 
                })
                .eq('user_id', user.id)
                .eq('tenderbureau_id', bureauId);

            if (updateError) {
                console.warn('Could not update last_accessed_at:', updateError);
            }

            // Update last_bureau_id in users tabel
            await supabase
                .from('users')
                .update({ last_bureau_id: bureauId })
                .eq('id', user.id);

            // Update lokale state
            this._currentBureau = bureau;
            this._userRole = bureau.user_role;

            // Sla op in localStorage voor snelle access bij page reload
            localStorage.setItem('tenderzen_current_bureau', bureauId);

            // Notify listeners
            this._notifyListeners('bureauChanged', bureau);

            console.log('âœ… Gewisseld naar bureau:', bureau.bureau_naam);
            return bureau;

        } catch (error) {
            console.error('âŒ Error switching bureau:', error);
            throw error;
        }
    }

    /**
     * Initialiseer bureau context bij app start
     * Selecteert automatisch het juiste bureau
     * @returns {Promise<Object|null>} Geselecteerde bureau of null
     */
    async initializeBureauContext() {
        try {
            const bureaus = await this.getUserBureaus();
            
            if (bureaus.length === 0) {
                console.warn('âš ï¸ User heeft geen bureau toegang');
                this._currentBureau = null;
                this._userRole = null;
                return null;
            }

            // Bepaal welk bureau te selecteren
            let selectedBureau = null;

            // 1. Check localStorage voor eerder geselecteerd bureau
            const savedBureauId = localStorage.getItem('tenderzen_current_bureau');
            if (savedBureauId) {
                selectedBureau = bureaus.find(b => b.bureau_id === savedBureauId);
            }

            // 2. Anders: pak het laatst gebruikte bureau
            if (!selectedBureau) {
                selectedBureau = bureaus.find(b => b.last_accessed_at) || bureaus[0];
            }

            // 3. Anders: pak het default bureau
            if (!selectedBureau) {
                selectedBureau = bureaus.find(b => b.is_default) || bureaus[0];
            }

            // Set context
            this._currentBureau = selectedBureau;
            this._userRole = selectedBureau.user_role;
            localStorage.setItem('tenderzen_current_bureau', selectedBureau.bureau_id);

            console.log('âœ… Bureau context initialized:', selectedBureau.bureau_naam);
            return selectedBureau;

        } catch (error) {
            console.error('âŒ Error initializing bureau context:', error);
            throw error;
        }
    }

    /**
     * Check of user toegang heeft tot een specifiek bureau
     * @param {string} bureauId - UUID van het bureau
     * @returns {Promise<boolean>}
     */
    async hasAccessToBureau(bureauId) {
        const bureaus = this._userBureaus || await this.getUserBureaus();
        return bureaus.some(b => b.bureau_id === bureauId);
    }

    /**
     * Check of user een bepaalde rol heeft (of hoger)
     * @param {string} minimumRole - Minimaal vereiste rol
     * @returns {boolean}
     */
    hasMinimumRole(minimumRole) {
        const roleHierarchy = {
            'viewer': 1,
            'reviewer': 2,
            'schrijver': 3,
            'manager': 4,
            'admin': 5,
            'super_admin': 6
        };

        const currentLevel = roleHierarchy[this._userRole] || 0;
        const requiredLevel = roleHierarchy[minimumRole] || 0;

        return currentLevel >= requiredLevel;
    }

    /**
     * Check of user admin is in huidige bureau
     * @returns {boolean}
     */
    isAdmin() {
        return this._userRole === 'admin' || this._userRole === 'super_admin';
    }

    /**
     * Check of user manager of hoger is
     * @returns {boolean}
     */
    isManagerOrHigher() {
        return this.hasMinimumRole('manager');
    }

    // =========================================================
    // UITNODIGINGEN
    // =========================================================

    /**
     * Verstuur een uitnodiging voor het huidige bureau
     * @param {Object} inviteData - { email, role, personal_message, capaciteit_uren_per_week }
     * @returns {Promise<Object>} De aangemaakte invite
     */
    async sendInvite(inviteData) {
        try {
            if (!this.isManagerOrHigher()) {
                throw new Error('Geen rechten om uitnodigingen te versturen');
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Niet ingelogd');

            const currentBureauId = this._currentBureau?.bureau_id;
            if (!currentBureauId) throw new Error('Geen bureau geselecteerd');

            // Check of er al een pending invite is
            const { data: existingInvite } = await supabase
                .from('bureau_invites')
                .select('id')
                .eq('email', inviteData.email.toLowerCase())
                .eq('tenderbureau_id', currentBureauId)
                .eq('status', 'pending')
                .single();

            if (existingInvite) {
                throw new Error('Er staat al een uitnodiging open voor dit emailadres');
            }

            // Check of user al toegang heeft
            const { data: existingAccess } = await supabase
                .from('user_bureau_access')
                .select('id, users!inner(email)')
                .eq('tenderbureau_id', currentBureauId)
                .eq('is_active', true);

            const alreadyMember = existingAccess?.some(
                a => a.users?.email?.toLowerCase() === inviteData.email.toLowerCase()
            );

            if (alreadyMember) {
                throw new Error('Deze gebruiker is al lid van dit bureau');
            }

            // Maak invite aan
            const { data, error } = await supabase
                .from('bureau_invites')
                .insert({
                    tenderbureau_id: currentBureauId,
                    invited_by: user.id,
                    email: inviteData.email.toLowerCase(),
                    role: inviteData.role || 'schrijver',
                    personal_message: inviteData.personal_message,
                    capaciteit_uren_per_week: inviteData.capaciteit_uren_per_week || 40
                })
                .select(`
                    *,
                    tenderbureau:tenderbureaus(naam),
                    inviter:users!invited_by(naam, email)
                `)
                .single();

            if (error) throw error;

            console.log('âœ… Uitnodiging verstuurd naar:', inviteData.email);
            
            // TODO: Verstuur email via edge function
            // await this._sendInviteEmail(data);

            return data;

        } catch (error) {
            console.error('âŒ Error sending invite:', error);
            throw error;
        }
    }

    /**
     * Haal alle uitnodigingen op voor het huidige bureau
     * @returns {Promise<Array>}
     */
    async getInvites() {
        try {
            if (!this.isManagerOrHigher()) {
                throw new Error('Geen rechten om uitnodigingen te bekijken');
            }

            const currentBureauId = this._currentBureau?.bureau_id;
            if (!currentBureauId) throw new Error('Geen bureau geselecteerd');

            const { data, error } = await supabase
                .from('bureau_invites')
                .select(`
                    *,
                    inviter:users!invited_by(naam, email)
                `)
                .eq('tenderbureau_id', currentBureauId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];

        } catch (error) {
            console.error('âŒ Error fetching invites:', error);
            throw error;
        }
    }

    /**
     * Annuleer een uitnodiging
     * @param {string} inviteId - UUID van de invite
     */
    async cancelInvite(inviteId) {
        try {
            if (!this.isManagerOrHigher()) {
                throw new Error('Geen rechten om uitnodigingen te annuleren');
            }

            const { error } = await supabase
                .from('bureau_invites')
                .update({ 
                    status: 'cancelled',
                    cancelled_at: new Date().toISOString()
                })
                .eq('id', inviteId)
                .eq('status', 'pending');

            if (error) throw error;
            console.log('âœ… Uitnodiging geannuleerd');

        } catch (error) {
            console.error('âŒ Error cancelling invite:', error);
            throw error;
        }
    }

    /**
     * Verstuur uitnodiging opnieuw (reset expiry)
     * @param {string} inviteId - UUID van de invite
     */
    async resendInvite(inviteId) {
        try {
            if (!this.isManagerOrHigher()) {
                throw new Error('Geen rechten om uitnodigingen opnieuw te versturen');
            }

            const { data, error } = await supabase
                .from('bureau_invites')
                .update({ 
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    status: 'pending'
                })
                .eq('id', inviteId)
                .select()
                .single();

            if (error) throw error;

            // TODO: Verstuur email opnieuw
            console.log('âœ… Uitnodiging opnieuw verstuurd');
            return data;

        } catch (error) {
            console.error('âŒ Error resending invite:', error);
            throw error;
        }
    }

    /**
     * Accepteer een uitnodiging (via token)
     * @param {string} token - Invite token uit de URL
     * @returns {Promise<Object>} De nieuwe bureau access
     */
    async acceptInvite(token) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Je moet ingelogd zijn om een uitnodiging te accepteren');

            // Haal invite op
            const { data: invite, error: inviteError } = await supabase
                .from('bureau_invites')
                .select(`
                    *,
                    tenderbureau:tenderbureaus(id, naam)
                `)
                .eq('invite_token', token)
                .eq('status', 'pending')
                .single();

            if (inviteError || !invite) {
                throw new Error('Uitnodiging niet gevonden of verlopen');
            }

            // Check of invite niet verlopen is
            if (new Date(invite.expires_at) < new Date()) {
                await supabase
                    .from('bureau_invites')
                    .update({ status: 'expired' })
                    .eq('id', invite.id);
                throw new Error('Deze uitnodiging is verlopen');
            }

            // Check of email matcht
            if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
                throw new Error('Deze uitnodiging is voor een ander emailadres');
            }

            // Maak access record aan
            const { data: access, error: accessError } = await supabase
                .from('user_bureau_access')
                .insert({
                    user_id: user.id,
                    tenderbureau_id: invite.tenderbureau_id,
                    role: invite.role,
                    capaciteit_uren_per_week: invite.capaciteit_uren_per_week,
                    invited_by: invite.invited_by,
                    accepted_at: new Date().toISOString()
                })
                .select()
                .single();

            if (accessError) {
                // Mogelijk al lid?
                if (accessError.code === '23505') {
                    throw new Error('Je bent al lid van dit bureau');
                }
                throw accessError;
            }

            // Update invite status
            await supabase
                .from('bureau_invites')
                .update({ 
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', invite.id);

            // Refresh user bureaus
            this._userBureaus = null;
            await this.getUserBureaus();

            console.log('âœ… Uitnodiging geaccepteerd voor:', invite.tenderbureau.naam);
            return access;

        } catch (error) {
            console.error('âŒ Error accepting invite:', error);
            throw error;
        }
    }

    // =========================================================
    // TEAM BEHEER
    // =========================================================

    /**
     * Haal alle teamleden op van het huidige bureau
     * @returns {Promise<Array>}
     */
    async getTeamMembers() {
        try {
            const currentBureauId = this._currentBureau?.bureau_id;
            if (!currentBureauId) throw new Error('Geen bureau geselecteerd');

            const { data, error } = await supabase
                .from('user_bureau_access')
                .select(`
                    id,
                    role,
                    capaciteit_uren_per_week,
                    avatar_kleur,
                    functie_titel,
                    is_active,
                    last_accessed_at,
                    accepted_at,
                    user:users (
                        id,
                        email,
                        naam,
                        avatar_url
                    )
                `)
                .eq('tenderbureau_id', currentBureauId)
                .eq('is_active', true)
                .order('role', { ascending: true });

            if (error) throw error;

            // Transform naar bruikbaar formaat
            return (data || []).map(item => ({
                access_id: item.id,
                user_id: item.user?.id,
                email: item.user?.email,
                naam: item.user?.naam || item.user?.email?.split('@')[0],
                avatar_url: item.user?.avatar_url,
                avatar_kleur: item.avatar_kleur,
                role: item.role,
                functie_titel: item.functie_titel,
                capaciteit_uren_per_week: item.capaciteit_uren_per_week,
                last_accessed_at: item.last_accessed_at,
                accepted_at: item.accepted_at,
                initialen: this._generateInitials(item.user?.naam || item.user?.email)
            }));

        } catch (error) {
            console.error('âŒ Error fetching team members:', error);
            throw error;
        }
    }

    /**
     * Update rol of instellingen van een teamlid
     * @param {string} accessId - UUID van de user_bureau_access record
     * @param {Object} updates - { role, capaciteit_uren_per_week, avatar_kleur, functie_titel }
     */
    async updateTeamMember(accessId, updates) {
        try {
            if (!this.isAdmin()) {
                throw new Error('Alleen admins kunnen teamleden aanpassen');
            }

            // Voorkom dat admin zichzelf degradeert
            const { data: { user } } = await supabase.auth.getUser();
            const { data: access } = await supabase
                .from('user_bureau_access')
                .select('user_id, role')
                .eq('id', accessId)
                .single();

            if (access?.user_id === user.id && updates.role && updates.role !== 'admin') {
                throw new Error('Je kunt je eigen admin rol niet wijzigen');
            }

            const { data, error } = await supabase
                .from('user_bureau_access')
                .update(updates)
                .eq('id', accessId)
                .select()
                .single();

            if (error) throw error;

            console.log('âœ… Teamlid bijgewerkt');
            return data;

        } catch (error) {
            console.error('âŒ Error updating team member:', error);
            throw error;
        }
    }

    /**
     * Verwijder een teamlid uit het bureau (soft delete)
     * @param {string} accessId - UUID van de user_bureau_access record
     */
    async removeTeamMember(accessId) {
        try {
            if (!this.isAdmin()) {
                throw new Error('Alleen admins kunnen teamleden verwijderen');
            }

            // Voorkom dat admin zichzelf verwijdert
            const { data: { user } } = await supabase.auth.getUser();
            const { data: access } = await supabase
                .from('user_bureau_access')
                .select('user_id')
                .eq('id', accessId)
                .single();

            if (access?.user_id === user.id) {
                throw new Error('Je kunt jezelf niet uit het bureau verwijderen');
            }

            const { error } = await supabase
                .from('user_bureau_access')
                .update({ is_active: false })
                .eq('id', accessId);

            if (error) throw error;

            console.log('âœ… Teamlid verwijderd uit bureau');

        } catch (error) {
            console.error('âŒ Error removing team member:', error);
            throw error;
        }
    }

    // =========================================================
    // EVENT LISTENERS
    // =========================================================

    /**
     * Registreer een listener voor bureau changes
     * @param {Function} callback - Wordt aangeroepen met (event, data)
     * @returns {Function} Unsubscribe functie
     */
    onBureauChange(callback) {
        this._listeners.add(callback);
        return () => this._listeners.delete(callback);
    }

    /**
     * Notify all listeners
     * @private
     */
    _notifyListeners(event, data) {
        this._listeners.forEach(callback => {
            try {
                callback(event, data);
            } catch (error) {
                console.error('Error in bureau change listener:', error);
            }
        });
    }

    // =========================================================
    // HELPERS
    // =========================================================

    /**
     * Genereer initialen van een naam
     * @private
     */
    _generateInitials(naam) {
        if (!naam) return '??';
        const parts = naam.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Beschikbare rollen
     */
    getRoles() {
        return [
            { key: 'admin', label: 'Admin', color: '#ef4444', description: 'Volledige toegang, kan teamleden beheren' },
            { key: 'manager', label: 'Manager', color: '#f59e0b', description: 'Kan tenders aanmaken en toewijzen' },
            { key: 'schrijver', label: 'Schrijver', color: '#3b82f6', description: 'Kan tenders bewerken' },
            { key: 'reviewer', label: 'Reviewer', color: '#8b5cf6', description: 'Kan tenders bekijken en reviewen' },
            { key: 'viewer', label: 'Viewer', color: '#6b7280', description: 'Alleen lezen' }
        ];
    }

    /**
     * Beschikbare avatar kleuren
     */
    getAvatarColors() {
        return [
            { key: '#ec4899', label: 'Roze' },
            { key: '#3b82f6', label: 'Blauw' },
            { key: '#8b5cf6', label: 'Paars' },
            { key: '#10b981', label: 'Groen' },
            { key: '#f59e0b', label: 'Amber' },
            { key: '#06b6d4', label: 'Cyan' },
            { key: '#ef4444', label: 'Rood' },
            { key: '#6366f1', label: 'Indigo' }
        ];
    }

    /**
     * Reset alle cache (voor logout)
     */
    reset() {
        this._currentBureau = null;
        this._userBureaus = null;
        this._userRole = null;
        localStorage.removeItem('tenderzen_current_bureau');
        this._listeners.clear();
    }
}

// Export singleton instance
export const bureauAccessService = new BureauAccessService();

// ⭐ v2.1: Maak beschikbaar op window voor andere services
window.bureauAccessService = bureauAccessService;

export default bureauAccessService;