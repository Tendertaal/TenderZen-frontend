// supabase/functions/complete-onboarding/index.ts
//
// Complete onboarding na wachtwoord instellen:
// 1. Maak public.users record aan
// 2. Maak user_bureau_access record aan
// 3. Update bureau_invites status
// 4. Link team_member aan user
//
// Deploy met: supabase functions deploy complete-onboarding

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { userId, email, inviteToken } = await req.json()

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: 'userId and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🎫 Starting onboarding for:', email, userId)

    // Create Supabase admin client (uses service_role key)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // STAP 1: Zoek de uitnodiging
    let invitation = null

    if (inviteToken) {
      const { data, error } = await supabaseAdmin
        .from('bureau_invites')
        .select('*')
        .eq('invite_token', inviteToken)
        .single()

      if (!error && data) {
        invitation = data
        console.log('✅ Found invitation by token')
      }
    }

    // Fallback: zoek op email
    if (!invitation) {
      const { data, error } = await supabaseAdmin
        .from('bureau_invites')
        .select('*')
        .eq('email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!error && data) {
        invitation = data
        console.log('✅ Found invitation by email')
      }
    }

    if (!invitation) {
      console.log('⚠️ No invitation found')
      return new Response(
        JSON.stringify({ error: 'No pending invitation found', success: false }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📋 Invitation:', invitation.id, invitation.tenderbureau_id)

    // STAP 2: Maak public.users record aan
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()

    if (!existingUser) {
      const userName = email.split('@')[0]
      
      const { error: insertUserError } = await supabaseAdmin
        .from('users')
        .insert({
          id: userId,
          email: email,
          naam: userName,
          is_active: true,
          is_super_admin: false,
          last_bureau_id: invitation.tenderbureau_id
        })

      if (insertUserError) {
        console.error('❌ Error creating user:', insertUserError)
        return new Response(
          JSON.stringify({ error: 'Failed to create user record', details: insertUserError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('✅ Public user created')
    } else {
      console.log('✅ Public user already exists')
    }

    // STAP 3: Maak user_bureau_access record aan
    const { data: existingAccess } = await supabaseAdmin
      .from('user_bureau_access')
      .select('id')
      .eq('user_id', userId)
      .eq('tenderbureau_id', invitation.tenderbureau_id)
      .single()

    if (!existingAccess) {
      const { error: accessError } = await supabaseAdmin
        .from('user_bureau_access')
        .insert({
          user_id: userId,
          tenderbureau_id: invitation.tenderbureau_id,
          role: invitation.role || 'schrijver',
          is_active: true,
          invited_by: invitation.invited_by,
          accepted_at: new Date().toISOString()
        })

      if (accessError) {
        console.error('❌ Error creating access:', accessError)
        return new Response(
          JSON.stringify({ error: 'Failed to create bureau access', details: accessError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      console.log('✅ User bureau access created')
    } else {
      console.log('✅ User bureau access already exists')
    }

    // STAP 4: Update invitation status
    await supabaseAdmin
      .from('bureau_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', invitation.id)

    console.log('✅ Invitation status updated')

    // STAP 5: Link user to team_member
    if (invitation.team_member_id) {
      await supabaseAdmin
        .from('team_members')
        .update({
          user_id: userId,
          invitation_status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', invitation.team_member_id)

      console.log('✅ Team member linked')
    }

    console.log('🎉 Onboarding complete!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Onboarding completed successfully',
        tenderbureau_id: invitation.tenderbureau_id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})