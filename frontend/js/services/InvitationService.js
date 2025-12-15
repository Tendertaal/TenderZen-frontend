/**
 * InvitationService - Handles team member invitations
 * 
 * Versie 3: Direct Supabase - geen Python backend nodig
 * 
 * Gebruikt door: TeamledenView.js, TeamlidModal.js
 */

class InvitationService {
    constructor() {
        // Supabase Edge Function URL
        this.supabaseUrl = window.CONFIG?.SUPABASE_URL || 'https://ayamyedredynntdaldlu.supabase.co';
        this.edgeFunctionUrl = `${this.supabaseUrl}/functions/v1/send-invite-email`;
        
        // Accept invitation page URL
        this.acceptInvitationBaseUrl = window.location.origin + '/accept-invitation.html';
    }

    /**
     * Get auth token from Supabase
     */
    async getAuthToken() {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    }

    /**
     * Get current user info
     */
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    }

    // =====================================================
    // EDGE FUNCTION CALL - EMAIL VERZENDING
    // =====================================================

    /**
     * Call Supabase Edge Function to send invite email
     * @param {Object} payload - Email data
     * @returns {Promise<Object>} Response from Edge Function
     */
    async callEdgeFunction(payload) {
        const token = await this.getAuthToken();
        
        if (!token) {
            throw new Error('Not authenticated');
        }

        console.log('📧 Calling Edge Function:', this.edgeFunctionUrl);
        console.log('📧 Payload:', payload);

        try {
            const response = await fetch(this.edgeFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Edge Function error:', data);
                throw new Error(data.error || `Edge Function failed: ${response.status}`);
            }

            console.log('✅ Edge Function success:', data);
            return data;

        } catch (error) {
            console.error('❌ Edge Function call failed:', error);
            throw error;
        }
    }

    // =====================================================
    // INVITATION METHODS - DIRECT SUPABASE
    // =====================================================

    /**
     * Send invitation to a team member
     * Creates bureau_invites record + sends email via Edge Function
     * 
     * @param {string} teamMemberId - UUID of team member
     * @param {string} email - Email address
     * @param {string} role - Role for the invitation (default: schrijver)
     * @param {string} personalMessage - Optional personal message
     * @param {Object} extraInfo - Extra info like bureau_name, member_name, tenderbureau_id
     * @returns {Promise<Object>} Created invitation
     */
    async sendInvitation(teamMemberId, email, role = 'schrijver', personalMessage = null, extraInfo = {}) {
        console.log('📧 Sending invitation to:', email, 'as', role);
        console.log('📧 teamMemberId:', teamMemberId);
        console.log('📧 extraInfo:', extraInfo);
        
        // Get current user
        const currentUser = await this.getCurrentUser();
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        // Get team member details if not provided
        let tenderbureauId = extraInfo.tenderbureauId || extraInfo.tenderbureau_id;
        let bureauName = extraInfo.bureauName || extraInfo.bureau_name;
        let memberName = extraInfo.memberName || extraInfo.member_name;

        console.log('📧 Initial tenderbureauId from extraInfo:', tenderbureauId);

        // Als we geen tenderbureau_id hebben, haal het op van het teamlid
        if (!tenderbureauId && teamMemberId) {
            console.log('📧 Fetching team member details for:', teamMemberId);
            
            const { data: member, error } = await supabase
                .from('team_members')
                .select('naam, tenderbureau_id, tenderbureaus(naam)')
                .eq('id', teamMemberId)
                .single();

            if (error) {
                console.error('❌ Could not fetch team member:', error);
                throw new Error('Team member not found: ' + error.message);
            }

            console.log('📧 Team member found:', member);

            tenderbureauId = member.tenderbureau_id;
            bureauName = member.tenderbureaus?.naam || '';
            memberName = member.naam || '';
        }

        // CRITICAL: Check of we een tenderbureau_id hebben
        if (!tenderbureauId) {
            console.error('❌ No tenderbureau_id available!');
            throw new Error('Geen tenderbureau gekoppeld aan dit teamlid. Controleer of het teamlid correct is aangemaakt.');
        }

        console.log('📧 Final tenderbureauId:', tenderbureauId);

        // Generate token
        const inviteToken = crypto.randomUUID();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        // Step 1: Create bureau_invites record
        console.log('📧 Creating bureau_invites record...');
        const { data: invitation, error: insertError } = await supabase
            .from('bureau_invites')
            .insert({
                tenderbureau_id: tenderbureauId,
                team_member_id: teamMemberId,
                email: email,
                role: role,
                invite_token: inviteToken,
                status: 'pending',
                invited_by: currentUser.id,
                expires_at: expiresAt.toISOString(),
                personal_message: personalMessage
            })
            .select()
            .single();

        if (insertError) {
            console.error('❌ Failed to create invitation:', insertError);
            throw insertError;
        }

        console.log('✅ Invitation record created:', invitation);

        // Step 2: Update team_members status
        if (teamMemberId) {
            const { error: updateError } = await supabase
                .from('team_members')
                .update({
                    invitation_status: 'pending',
                    invited_at: new Date().toISOString()
                })
                .eq('id', teamMemberId);

            if (updateError) {
                console.warn('⚠️ Failed to update team member status:', updateError);
            }
        }

        // Step 3: Send email via Edge Function
        try {
            const inviteUrl = `${this.acceptInvitationBaseUrl}?token=${inviteToken}`;
            const inviterName = currentUser?.user_metadata?.full_name || 
                               currentUser?.email || 
                               'Een beheerder';

            await this.callEdgeFunction({
                email: email,
                name: memberName || '',
                bureau_name: bureauName || '',
                invited_by: inviterName,
                role: role,
                invite_url: inviteUrl
            });

            console.log('✅ Email sent successfully');

        } catch (emailError) {
            console.warn('⚠️ Email sending failed, but invitation was created:', emailError);
            // We don't throw here - invitation is created, email just failed
            // User can resend later
        }

        return invitation;
    }

    /**
     * Send invitations to multiple team members
     * @param {string[]} teamMemberIds - Array of team member UUIDs
     * @param {string} role - Role for all invitations (default: schrijver)
     * @returns {Promise<Object>} Results with sent, skipped, failed
     */
    async sendBulkInvitations(teamMemberIds, role = 'schrijver') {
        console.log('📧 Sending bulk invitations to:', teamMemberIds.length, 'members as', role);
        
        const results = {
            sent: [],
            skipped: [],
            failed: []
        };

        for (const teamMemberId of teamMemberIds) {
            try {
                // Get team member
                const { data: member, error } = await supabase
                    .from('team_members')
                    .select('id, naam, email, tenderbureau_id, invitation_status, tenderbureaus(naam)')
                    .eq('id', teamMemberId)
                    .single();

                if (error || !member) {
                    results.failed.push({ id: teamMemberId, reason: 'Not found' });
                    continue;
                }

                // Skip if no email
                if (!member.email) {
                    results.failed.push({ id: teamMemberId, naam: member.naam, reason: 'No email' });
                    continue;
                }

                // Skip if already invited or accepted
                if (member.invitation_status === 'pending' || member.invitation_status === 'accepted') {
                    results.skipped.push({ id: teamMemberId, naam: member.naam, reason: `Already ${member.invitation_status}` });
                    continue;
                }

                // Send invitation
                const invitation = await this.sendInvitation(
                    teamMemberId,
                    member.email,
                    role,
                    null,
                    {
                        tenderbureauId: member.tenderbureau_id,
                        bureauName: member.tenderbureaus?.naam,
                        memberName: member.naam
                    }
                );

                results.sent.push({
                    id: teamMemberId,
                    naam: member.naam,
                    email: member.email,
                    invite_token: invitation.invite_token
                });

            } catch (error) {
                results.failed.push({ id: teamMemberId, reason: error.message });
            }
        }

        return results;
    }

    /**
     * Get pending invitations for a tenderbureau
     * @param {string} tenderbureauId - UUID of tenderbureau
     * @returns {Promise<Array>} List of pending invitations
     */
    async getPendingInvitations(tenderbureauId) {
        if (!tenderbureauId) {
            console.warn('⚠️ getPendingInvitations called without tenderbureauId');
            return [];
        }

        const { data, error } = await supabase
            .from('bureau_invites')
            .select(`
                *,
                team_members(naam, email),
                users:invited_by(naam)
            `)
            .eq('tenderbureau_id', tenderbureauId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Failed to get pending invitations:', error);
            throw error;
        }

        return data || [];
    }

    /**
     * Verify an invitation token (public)
     * @param {string} token - Invitation token
     * @returns {Promise<Object>} Invitation details if valid
     */
    async verifyInvitation(token) {
        const { data, error } = await supabase
            .from('bureau_invites')
            .select(`
                *,
                team_members(naam),
                tenderbureaus(naam),
                users:invited_by(naam)
            `)
            .eq('invite_token', token)
            .single();

        if (error || !data) {
            throw new Error('Invalid or expired invitation token');
        }

        // Check if expired
        if (new Date(data.expires_at) < new Date()) {
            // Update status to expired
            await supabase
                .from('bureau_invites')
                .update({ status: 'expired' })
                .eq('id', data.id);

            if (data.team_member_id) {
                await supabase
                    .from('team_members')
                    .update({ invitation_status: 'expired' })
                    .eq('id', data.team_member_id);
            }

            throw new Error('Invitation has expired');
        }

        if (data.status === 'accepted') {
            throw new Error('Invitation already accepted');
        }

        if (data.status === 'cancelled') {
            throw new Error('Invitation was cancelled');
        }

        return {
            valid: true,
            email: data.email,
            role: data.role,
            team_member_name: data.team_members?.naam,
            bureau_name: data.tenderbureaus?.naam,
            invited_by: data.users?.naam || 'Unknown',
            personal_message: data.personal_message,
            expires_at: data.expires_at
        };
    }

    /**
     * Accept an invitation (requires auth)
     * @param {string} token - Invitation token
     * @returns {Promise<Object>} Success response
     */
    async acceptInvitation(token) {
        const currentUser = await this.getCurrentUser();
        if (!currentUser) {
            throw new Error('Not authenticated');
        }

        // Get invitation
        const { data: invitation, error } = await supabase
            .from('bureau_invites')
            .select('*')
            .eq('invite_token', token)
            .eq('status', 'pending')
            .single();

        if (error || !invitation) {
            throw new Error('Invalid or expired invitation');
        }

        // Update invitation status
        await supabase
            .from('bureau_invites')
            .update({
                status: 'accepted',
                accepted_at: new Date().toISOString()
            })
            .eq('id', invitation.id);

        // Link user to team member
        if (invitation.team_member_id) {
            await supabase
                .from('team_members')
                .update({
                    user_id: currentUser.id,
                    invitation_status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('id', invitation.team_member_id);
        }

        // Create or update user_bureau_access
        const { data: existingAccess } = await supabase
            .from('user_bureau_access')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('tenderbureau_id', invitation.tenderbureau_id)
            .single();

        if (existingAccess) {
            await supabase
                .from('user_bureau_access')
                .update({
                    role: invitation.role,
                    is_active: true,
                    accepted_at: new Date().toISOString()
                })
                .eq('id', existingAccess.id);
        } else {
            await supabase
                .from('user_bureau_access')
                .insert({
                    user_id: currentUser.id,
                    tenderbureau_id: invitation.tenderbureau_id,
                    role: invitation.role,
                    is_active: true,
                    invited_by: invitation.invited_by,
                    accepted_at: new Date().toISOString()
                });
        }

        console.log('✅ Invitation accepted');

        return {
            success: true,
            message: 'Invitation accepted successfully',
            tenderbureau_id: invitation.tenderbureau_id,
            role: invitation.role
        };
    }

    /**
     * Resend an invitation
     * @param {string} invitationId - UUID of invitation
     * @param {Object} memberInfo - Info about the team member
     * @returns {Promise<Object>} Success response with new token
     */
    async resendInvitation(invitationId, memberInfo = {}) {
        console.log('📧 Resending invitation:', invitationId);
        
        // Get existing invitation
        const { data: invitation, error } = await supabase
            .from('bureau_invites')
            .select(`
                *,
                team_members(naam),
                tenderbureaus(naam)
            `)
            .eq('id', invitationId)
            .single();

        if (error || !invitation) {
            throw new Error('Invitation not found');
        }

        // Generate new token and extend expiry
        const newToken = crypto.randomUUID();
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + 7);

        // Update invitation
        const { error: updateError } = await supabase
            .from('bureau_invites')
            .update({
                invite_token: newToken,
                expires_at: newExpiry.toISOString(),
                status: 'pending'
            })
            .eq('id', invitationId);

        if (updateError) {
            throw updateError;
        }

        // Update team member status
        if (invitation.team_member_id) {
            await supabase
                .from('team_members')
                .update({
                    invitation_status: 'pending',
                    invited_at: new Date().toISOString()
                })
                .eq('id', invitation.team_member_id);
        }

        // Send new email
        try {
            const currentUser = await this.getCurrentUser();
            const inviteUrl = `${this.acceptInvitationBaseUrl}?token=${newToken}`;
            const inviterName = currentUser?.user_metadata?.full_name || 
                               currentUser?.email || 
                               'Een beheerder';

            await this.callEdgeFunction({
                email: invitation.email,
                name: memberInfo.naam || invitation.team_members?.naam || '',
                bureau_name: memberInfo.bureauName || invitation.tenderbureaus?.naam || '',
                invited_by: inviterName,
                role: invitation.role,
                invite_url: inviteUrl
            });

            console.log('✅ Resend email sent');

        } catch (emailError) {
            console.warn('⚠️ Resend email failed:', emailError);
        }

        return {
            success: true,
            message: 'Invitation resent successfully',
            new_token: newToken
        };
    }

    /**
     * Cancel an invitation
     * @param {string} invitationId - UUID of invitation
     * @returns {Promise<Object>} Success response
     */
    async cancelInvitation(invitationId) {
        console.log('❌ Cancelling invitation:', invitationId);
        
        // Get invitation
        const { data: invitation, error } = await supabase
            .from('bureau_invites')
            .select('team_member_id')
            .eq('id', invitationId)
            .single();

        if (error) {
            throw new Error('Invitation not found');
        }

        // Update invitation status
        await supabase
            .from('bureau_invites')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString()
            })
            .eq('id', invitationId);

        // Update team member status
        if (invitation.team_member_id) {
            await supabase
                .from('team_members')
                .update({ invitation_status: 'not_invited' })
                .eq('id', invitation.team_member_id);
        }

        return { success: true, message: 'Invitation cancelled' };
    }

    // =====================================================
    // HELPER METHODS
    // =====================================================

    /**
     * Get invitation status badge HTML
     * @param {string} status - Invitation status
     * @returns {string} HTML for status badge
     */
    getStatusBadge(status) {
        const badges = {
            'not_invited': '<span class="badge badge-secondary">Niet uitgenodigd</span>',
            'pending': '<span class="badge badge-warning">Uitnodiging verstuurd</span>',
            'accepted': '<span class="badge badge-success">Actief</span>',
            'expired': '<span class="badge badge-danger">Verlopen</span>'
        };
        
        return badges[status] || badges['not_invited'];
    }

    /**
     * Get action buttons based on invitation status
     * @param {Object} member - Team member object
     * @returns {string} HTML for action buttons
     */
    getActionButtons(member) {
        const status = member.invitation_status || 'not_invited';
        
        switch (status) {
            case 'not_invited':
                return `
                    <button class="btn btn-sm btn-primary invite-btn" 
                            data-member-id="${member.id}" 
                            data-email="${member.email}">
                        <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                        </svg>
                        Uitnodigen
                    </button>
                `;
            
            case 'pending':
                return `
                    <button class="btn btn-sm btn-outline resend-btn" 
                            data-member-id="${member.id}"
                            data-invitation-id="${member.invitation_id || ''}">
                        <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                        Opnieuw versturen
                    </button>
                `;
            
            case 'accepted':
                return `
                    <span class="text-success">
                        <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                            <polyline points="22 4 12 14.01 9 11.01"/>
                        </svg>
                        Account actief
                    </span>
                `;
            
            case 'expired':
                return `
                    <button class="btn btn-sm btn-warning resend-btn" 
                            data-member-id="${member.id}">
                        <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="23 4 23 10 17 10"/>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                        </svg>
                        Opnieuw uitnodigen
                    </button>
                `;
            
            default:
                return '';
        }
    }

    /**
     * Format time since invitation was sent
     * @param {string} invitedAt - ISO date string
     * @returns {string} Human readable time
     */
    formatTimeSince(invitedAt) {
        if (!invitedAt) return '';
        
        const now = new Date();
        const invited = new Date(invitedAt);
        const diffMs = now - invited;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffDays > 0) {
            return `${diffDays} dag${diffDays > 1 ? 'en' : ''} geleden`;
        } else if (diffHours > 0) {
            return `${diffHours} uur geleden`;
        } else if (diffMinutes > 0) {
            return `${diffMinutes} minuten geleden`;
        } else {
            return 'Zojuist';
        }
    }

    /**
     * Check if current user can invite members
     * @param {string} tenderbureauId - Bureau ID to check for
     * @returns {Promise<boolean>}
     */
    async canUserInvite(tenderbureauId) {
        try {
            const currentUser = await this.getCurrentUser();
            if (!currentUser) return false;

            // Check user_bureau_access for role
            const { data, error } = await supabase
                .from('user_bureau_access')
                .select('role')
                .eq('user_id', currentUser.id)
                .eq('tenderbureau_id', tenderbureauId)
                .eq('is_active', true)
                .single();

            if (error || !data) {
                // Check if super_admin
                const { data: userData } = await supabase
                    .from('users')
                    .select('is_super_admin')
                    .eq('id', currentUser.id)
                    .single();

                return userData?.is_super_admin || false;
            }

            return ['admin', 'manager'].includes(data.role);
        } catch (error) {
            console.error('Error checking invite permission:', error);
            return false;
        }
    }
}

// Create and export instance
const invitationService = new InvitationService();

// Also make available globally for backward compatibility
window.invitationService = invitationService;

// ES Module exports
export { InvitationService, invitationService };