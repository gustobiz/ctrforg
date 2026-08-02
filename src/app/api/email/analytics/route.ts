import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all campaigns for this user
    const { data: campaigns } = await supabase
      .from('email_campaigns')
      .select('id, status, is_followup, total_opens, total_clicks, sent_at, opened_at, clicked_at, replied_at, lead_id')
      .eq('user_id', user.id);

    const allCampaigns = campaigns || [];

    // Calculate analytics
    const totalSent = allCampaigns.filter(c => c.status !== 'draft').length;
    const initialEmails = allCampaigns.filter(c => !c.is_followup && c.status !== 'draft');
    const followUpsSent = allCampaigns.filter(c => c.is_followup && c.status !== 'draft').length;

    const opened = allCampaigns.filter(c => c.total_opens > 0).length;
    const clicked = allCampaigns.filter(c => c.total_clicks > 0).length;
    const replied = allCampaigns.filter(c => c.status === 'replied').length;

    // Get unique leads that replied (interested leads)
    const repliedLeadIds = new Set(
      allCampaigns
        .filter(c => c.status === 'replied' && c.lead_id)
        .map(c => c.lead_id)
    );
    const interestedLeads = repliedLeadIds.size;

    // Unique leads that were contacted
    const contactedLeadIds = new Set(
      initialEmails
        .filter(c => c.lead_id)
        .map(c => c.lead_id)
    );
    const totalContacted = contactedLeadIds.size;

    // Calculate rates
    const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0;
    const clickRate = totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0;
    const replyRate = totalSent > 0 ? Math.round((replied / totalSent) * 100) : 0;
    const conversionRate = totalContacted > 0 ? Math.round((interestedLeads / totalContacted) * 100) : 0;

    // Get follow-up stats
    const { data: pendingFollowUps } = await supabase
      .from('followup_sequences')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    return NextResponse.json({
      success: true,
      analytics: {
        emailsSent: totalSent,
        openRate,
        clickRate,
        replyRate,
        followUpsSent,
        interestedLeads,
        conversionRate,
        // Raw counts for detailed views
        totalOpened: opened,
        totalClicked: clicked,
        totalReplied: replied,
        totalContacted,
        pendingFollowUps: pendingFollowUps?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
