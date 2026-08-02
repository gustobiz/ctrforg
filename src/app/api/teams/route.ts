import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/teams — Retrieve active team details and member list
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find teams this user is in
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ success: true, team: null, members: [] });
    }

    // Get team details
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('id', membership.team_id)
      .single();

    // Get all team members (Wait: we can query auth.users if we have permissions, or we query profiles. But profiles might not exist, so we retrieve user emails from team_members if stored, or mock details. Let's select from team_members.)
    const { data: members, error: membersErr } = await supabase
      .from('team_members')
      .select('id, user_id, role, joined_at')
      .eq('team_id', membership.team_id);

    if (membersErr) throw membersErr;

    return NextResponse.json({
      success: true,
      team,
      role: membership.role,
      members: members || [],
    });
  } catch (error: any) {
    console.error('Teams GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/teams — Create a team or invite a member
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, teamName, memberEmail, role = 'member' } = body;

    if (action === 'create') {
      if (!teamName) {
        return NextResponse.json({ error: 'Team name is required' }, { status: 400 });
      }

      // Check if user already owns or is in a team
      const { data: existingMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json({ error: 'You are already in a team. Disconnect first.' }, { status: 400 });
      }

      // Create team
      const { data: team, error: teamErr } = await supabase
        .from('teams')
        .insert({
          name: teamName,
          owner_id: user.id,
        })
        .select()
        .single();

      if (teamErr) throw teamErr;

      // Add owner as member
      await supabase.from('team_members').insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
      });

      return NextResponse.json({ success: true, team });
    }

    if (action === 'invite') {
      if (!memberEmail) {
        return NextResponse.json({ error: 'Member email is required' }, { status: 400 });
      }

      // Verify current user is owner or admin of their team
      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return NextResponse.json({ error: 'Only owners or admins can invite members' }, { status: 403 });
      }

      // For security & isolation on Supabase, look up email in public user profiles or auth.users.
      // Since direct query of auth.users from client code is restricted to admin keys, we can insert into team_members 
      // by first inserting invitation or finding the user ID in the auth.users if available, 
      // or we can allow the user to join using a direct team invitation code, or search the profile table if it exists.
      // Let's check if there is a profile table or if we can mock it by adding them via their UUID if we have it, 
      // or we query public profiles.
      // To keep it robust, let's look up public profiles or user list.
      // If we don't have public profiles, we can simulate invitations by creating an invitation record or using their email as user_id or mapping it when they sign in.
      // Alternatively, let's fetch profiles matching the email.
      let profile = null;
      try {
        const { data } = await supabase
          .from('profiles') // Check if profiles exists
          .select('id')
          .eq('email', memberEmail)
          .maybeSingle();
        profile = data;
      } catch (err) {
        // Safe fallback if no profile table
      }

      let targetUserId = profile?.id;

      // If profiles doesn't exist, we can fallback to searching by user's raw email or checking if they can join by code.
      // For this MVP, we can insert into team_members with a placeholder or look up in auth.users.
      // Let's check if we can insert directly:
      if (!targetUserId) {
        // Fallback: invite by matching email prefix or dummy user ID for testing, or return error that user must sign up first
        return NextResponse.json({ 
          error: `User with email "${memberEmail}" must sign up on CTRForge before they can be added to a team.` 
        }, { status: 400 });
      }

      // Add user to team
      const { data: newMember, error: inviteErr } = await supabase
        .from('team_members')
        .insert({
          team_id: membership.team_id,
          user_id: targetUserId,
          role: role,
        })
        .select()
        .single();

      if (inviteErr) throw inviteErr;

      return NextResponse.json({ success: true, member: newMember });
    }

    return NextResponse.json({ error: 'Invalid team action' }, { status: 400 });
  } catch (error: any) {
    console.error('Teams POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/teams — Remove member from team
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    // Verify current user is owner of their team
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return NextResponse.json({ error: 'Only owners or admins can remove members' }, { status: 403 });
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('team_id', membership.team_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Teams DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
