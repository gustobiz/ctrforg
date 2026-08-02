import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { evaluateFollowUpRules, executeScheduledFollowUps } from '@/lib/gmail/followups';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // List pending follow-ups
    const { data: followups, error } = await (await supabase)
      .from('followup_sequences')
      .select('*, email_campaigns(subject, to_email, status, lead_id)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, followups: followups || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Evaluate and execute due follow-ups
    const result = await executeScheduledFollowUps(user.id);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error('Follow-up execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
