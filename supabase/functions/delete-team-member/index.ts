// supabase/functions/delete-team-member/index.ts
// 
// Complete delete van een teamlid inclusief:
// - auth.users (Supabase Auth)
// - public.users
// - user_bureau_access
// - bureau_invites
// - team_members
//
// Deploy met: supabase functions deploy delete-team-member

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
    // Get request body
    const { teamMemberId, deleteAuthUser = false } = await req.json()

    if (!teamMemberId) {
      return new Response(
        JSON.stringify({ error: 'teamMemberId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🗑️ Starting complete delete for team member:', teamMemberId)
    console.log('🗑️ Delete auth user:', deleteAuthUser)

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

    // Step 1: Get team member details
    const { data: member, error: fetchError } = await supabaseAdmin
      .from('team_members')
      .select('id, email, user_id, tenderbureau_id, naam')
      .eq('id', teamMemberId)
      .single()

    if (fetchError) {
      console.error('❌ Could not fetch team member:', fetchError)
      return new Response(
        JSON.stringify({ error: 'Team member not found', details: fetchError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('📋 Team member found:', member)

    const results = {
      teamMember: null,
      bureauInvites: null,
      userBureauAccess: null,
      publicUser: null,
      authUser: null
    }

    // Step 2: Delete bureau_invites by team_member_id
    const { error: inviteError1 } = await supabaseAdmin
      .from('bureau_invites')
      .delete()
      .eq('team_member_id', teamMemberId)

    if (inviteError1) {
      console.warn('⚠️ Error deleting bureau_invites by team_member_id:', inviteError1)
    } else {
      console.log('✅ Bureau invites deleted by team_member_id')
      results.bureauInvites = 'deleted by team_member_id'
    }

    // Step 3: Delete bureau_invites by email
    if (member.email) {
      const { error: inviteError2 } = await supabaseAdmin
        .from('bureau_invites')
        .delete()
        .eq('email', member.email)

      if (inviteError2) {
        console.warn('⚠️ Error deleting bureau_invites by email:', inviteError2)
      } else {
        console.log('✅ Bureau invites deleted by email')
        results.bureauInvites = 'deleted by email'
      }
    }

    // Step 4: Delete user_bureau_access (if user_id exists)
    if (member.user_id) {
      const { error: accessError } = await supabaseAdmin
        .from('user_bureau_access')
        .delete()
        .eq('user_id', member.user_id)

      if (accessError) {
        console.warn('⚠️ Error deleting user_bureau_access:', accessError)
      } else {
        console.log('✅ User bureau access deleted')
        results.userBureauAccess = 'deleted'
      }

      // Step 5: Delete public.users (if user_id exists)
      const { error: publicUserError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', member.user_id)

      if (publicUserError) {
        console.warn('⚠️ Error deleting public.users:', publicUserError)
      } else {
        console.log('✅ Public user deleted')
        results.publicUser = 'deleted'
      }

      // Step 6: Delete auth.users (if requested and user_id exists)
      if (deleteAuthUser) {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
          member.user_id
        )

        if (authError) {
          console.warn('⚠️ Error deleting auth.users:', authError)
        } else {
          console.log('✅ Auth user deleted')
          results.authUser = 'deleted'
        }
      }
    }

    // Step 7: Delete team_members record
    const { error: deleteError } = await supabaseAdmin
      .from('team_members')
      .delete()
      .eq('id', teamMemberId)

    if (deleteError) {
      console.error('❌ Error deleting team_members:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete team member', details: deleteError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Team member deleted')
    results.teamMember = 'deleted'

    console.log('🎉 Complete delete successful for:', member.naam)

    return new Response(
      JSON.stringify({
        success: true,
        message: `${member.naam} is volledig verwijderd`,
        deletedMember: member,
        results
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