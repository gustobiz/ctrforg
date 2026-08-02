import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
    
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).toISOString();
    
    const endOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59, 999).toISOString();
    const endOfNext7Days = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999).toISOString();

    // Execute parallel DB queries safely
    const [
      { data: bulkCampaigns },
      { data: inboxMessages },
      { data: crmLeads },
      { data: emailCampaigns },
      { data: emailEvents },
      { data: followups }
    ] = await Promise.all([
      supabase.from('bulk_campaigns').select('*').eq('user_id', user.id),
      supabase.from('inbox_messages').select('*').eq('user_id', user.id).order('received_at', { ascending: false }),
      supabase.from('crm_leads').select('*').eq('user_id', user.id),
      supabase.from('email_campaigns').select('*').eq('user_id', user.id),
      supabase.from('email_events').select('*').eq('user_id', user.id),
      supabase.from('followup_sequences').select('*').eq('user_id', user.id).order('scheduled_at', { ascending: true })
    ]);

    const campaigns = bulkCampaigns || [];
    const messages = inboxMessages || [];
    const leads = crmLeads || [];
    const emails = emailCampaigns || [];
    const events = emailEvents || [];
    const seqs = followups || [];

    // Pipeline Health Counts
    const interestedCount = messages.filter(m => m.category === 'interested').length + 
      leads.filter(l => l.status === 'interested' || l.status === 'qualified').length;
    
    const notInterestedCount = messages.filter(m => m.category === 'not_interested').length + 
      leads.filter(l => l.status === 'not_interested' || l.status === 'unqualified').length;
    
    const closedWonCount = messages.filter(m => m.category === 'closed').length + 
      leads.filter(l => l.status === 'closed' || l.status === 'won' || l.status === 'customer').length;

    const waitingReplyCount = emails.filter(e => e.status === 'sent' || e.status === 'opened' || e.status === 'clicked').length;

    const followupTodayCount = seqs.filter(s => s.status === 'pending' && s.scheduled_at >= startOfToday && s.scheduled_at <= endOfToday).length;
    
    const overdueFollowupCount = seqs.filter(s => s.status === 'pending' && s.scheduled_at < startOfToday).length;

    const pipelineHealth = {
      waitingReply: waitingReplyCount,
      followupToday: followupTodayCount,
      overdueFollowup: overdueFollowupCount,
      interested: interestedCount,
      closedWon: closedWonCount,
      notInterested: notInterestedCount,
    };

    // Timeline Data
    const todayOpens = events.filter(e => e.event_type === 'open' && e.created_at >= startOfToday).length || 
      emails.filter(e => e.opened_at && e.opened_at >= startOfToday).length;
    
    const todayClicks = events.filter(e => e.event_type === 'click' && e.created_at >= startOfToday).length || 
      emails.filter(e => e.clicked_at && e.clicked_at >= startOfToday).length;
    
    const todayReplies = events.filter(e => e.event_type === 'reply' && e.created_at >= startOfToday).length || 
      emails.filter(e => e.replied_at && e.replied_at >= startOfToday).length;

    const yesterdayOpens = events.filter(e => e.event_type === 'open' && e.created_at >= startOfYesterday && e.created_at <= endOfYesterday).length || 
      emails.filter(e => e.opened_at && e.opened_at >= startOfYesterday && e.opened_at <= endOfYesterday).length;
    
    const yesterdayReplies = events.filter(e => e.event_type === 'reply' && e.created_at >= startOfYesterday && e.created_at <= endOfYesterday).length || 
      emails.filter(e => e.replied_at && e.replied_at >= startOfYesterday && e.replied_at <= endOfYesterday).length;
    
    const yesterdayInterested = messages.filter(m => m.category === 'interested' && m.received_at >= startOfYesterday && m.received_at <= endOfYesterday).length;

    const timeline = {
      today: {
        opens: todayOpens,
        clicks: todayClicks,
        replies: todayReplies,
        followupsDue: followupTodayCount,
      },
      yesterday: {
        opens: yesterdayOpens,
        replies: yesterdayReplies,
        interested: yesterdayInterested,
      }
    };

    // Funnel Data
    const totalSent = emails.filter(e => e.status !== 'draft').length || campaigns.reduce((acc, c) => acc + (c.sent_count || 0), 0);
    const totalDelivered = Math.max(0, totalSent - (campaigns.reduce((acc, c) => acc + (c.bounced_count || 0), 0)));
    const totalOpened = emails.filter(e => e.opened_at || e.status === 'opened' || e.status === 'clicked' || e.status === 'replied').length || campaigns.reduce((acc, c) => acc + (c.opened_count || 0), 0);
    const totalClicked = emails.filter(e => e.clicked_at || e.status === 'clicked' || e.status === 'replied').length || campaigns.reduce((acc, c) => acc + (c.clicked_count || 0), 0);
    const totalReplied = emails.filter(e => e.replied_at || e.status === 'replied').length || campaigns.reduce((acc, c) => acc + (c.replied_count || 0), 0);

    const funnel = {
      sent: totalSent,
      delivered: totalDelivered,
      opened: totalOpened,
      clicked: totalClicked,
      replied: totalReplied,
      interested: interestedCount,
      closed: closedWonCount,
    };

    // Today's Tasks
    const todayTasks: Array<{ id: string; title: string; category: string; targetUrl: string; priority: 'high' | 'medium' | 'low' }> = [];
    
    messages.filter(m => !m.is_read || m.category === 'interested' || m.category === 'followup_needed').slice(0, 3).forEach(m => {
      todayTasks.push({
        id: `msg-${m.id}`,
        title: `Reply to ${m.sender_name || m.from_email || 'Lead'} (${m.subject || 'Outreach'})`,
        category: 'Inbox Reply',
        targetUrl: `/inbox?thread=${m.gmail_thread_id || ''}`,
        priority: m.category === 'interested' ? 'high' : 'medium',
      });
    });

    seqs.filter(s => s.status === 'pending' && s.scheduled_at <= endOfToday).slice(0, 3).forEach(s => {
      todayTasks.push({
        id: `seq-${s.id}`,
        title: `Follow-up sequence step #${s.followup_number} due`,
        category: 'Scheduled Follow-up',
        targetUrl: `/crm?leadId=${s.lead_id || ''}`,
        priority: s.scheduled_at < startOfToday ? 'high' : 'medium',
      });
    });

    campaigns.filter(c => c.status === 'completed').slice(0, 2).forEach(c => {
      todayTasks.push({
        id: `camp-${c.id}`,
        title: `Campaign "${c.name}" completed successfully`,
        category: 'Campaign Status',
        targetUrl: `/campaigns`,
        priority: 'low',
      });
    });

    // Upcoming Follow-ups Panel Data
    const upcomingFollowups = {
      today: seqs.filter(s => s.status === 'pending' && s.scheduled_at >= startOfToday && s.scheduled_at <= endOfToday).map(s => ({
        id: s.id,
        leadName: s.lead_name || 'Prospect Lead',
        campaignName: 'Outreach Sequence',
        scheduledTime: new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Due Today',
        targetUrl: `/inbox`,
      })),
      tomorrow: seqs.filter(s => s.status === 'pending' && s.scheduled_at > endOfToday && s.scheduled_at <= endOfTomorrow).map(s => ({
        id: s.id,
        leadName: s.lead_name || 'Prospect Lead',
        campaignName: 'Outreach Sequence',
        scheduledTime: new Date(s.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'Scheduled Tomorrow',
        targetUrl: `/inbox`,
      })),
      next7Days: seqs.filter(s => s.status === 'pending' && s.scheduled_at > endOfTomorrow && s.scheduled_at <= endOfNext7Days).map(s => ({
        id: s.id,
        leadName: s.lead_name || 'Prospect Lead',
        campaignName: 'Outreach Sequence',
        scheduledTime: new Date(s.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        status: 'Upcoming',
        targetUrl: `/inbox`,
      })),
    };

    // Notifications List
    const notifications: Array<{ id: string; message: string; timestamp: string; type: 'info' | 'success' | 'warning' }> = [];
    
    messages.slice(0, 3).forEach(m => {
      notifications.push({
        id: `notif-msg-${m.id}`,
        message: `${m.sender_name || m.from_email || 'Lead'} sent a new reply`,
        timestamp: new Date(m.received_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: m.category === 'interested' ? 'success' : 'info',
      });
    });

    if (overdueFollowupCount > 0) {
      notifications.push({
        id: 'notif-overdue',
        message: `${overdueFollowupCount} follow-up(s) require immediate action`,
        timestamp: 'Just now',
        type: 'warning',
      });
    }

    // Per Campaign Insights Map
    const campaignInsightsMap: Record<string, { healthScore: number; insights: string[]; breakdown: any }> = {};
    
    campaigns.forEach(c => {
      const openR = c.sent_count > 0 ? (c.opened_count / c.sent_count) * 100 : 0;
      const clickR = c.sent_count > 0 ? (c.clicked_count / c.sent_count) * 100 : 0;
      const replyR = c.sent_count > 0 ? (c.replied_count / c.sent_count) * 100 : 0;

      let score = 70;
      const insightsList: string[] = [];

      if (openR >= 40) {
        score += 15;
        insightsList.push('Excellent Open Rate (>40%)');
      } else if (openR >= 25) {
        score += 5;
        insightsList.push('Healthy Open Rate');
      } else if (c.sent_count > 10) {
        score -= 10;
        insightsList.push('Open rate below average target');
      }

      if (clickR >= 10) {
        score += 10;
        insightsList.push('CTR above industry average');
      }

      if (replyR >= 5) {
        score += 10;
        insightsList.push('Strong positive response rate');
      }

      if (overdueFollowupCount === 0) {
        insightsList.push('0 follow-ups overdue');
      } else {
        insightsList.push(`${overdueFollowupCount} follow-up(s) overdue`);
      }

      score = Math.min(99, Math.max(40, Math.round(score)));

      campaignInsightsMap[c.id] = {
        healthScore: score,
        insights: insightsList,
        breakdown: {
          recipients: c.total_leads || 0,
          delivered: Math.max(0, (c.sent_count || 0) - (c.bounced_count || 0)),
          opened: c.opened_count || 0,
          clicked: c.clicked_count || 0,
          replies: c.replied_count || 0,
          interested: Math.round((c.replied_count || 0) * 0.5),
          waitingReply: Math.max(0, (c.sent_count || 0) - (c.replied_count || 0)),
          todayFollowups: followupTodayCount,
          overdue: overdueFollowupCount,
          won: closedWonCount,
          lost: notInterestedCount,
        }
      };
    });

    // AI Summary
    const aiSummary = {
      summaryText: `Today's Summary: Sent ${totalSent} emails, recorded ${todayOpens} opens, ${todayClicks} clicks, and ${todayReplies} replies. ${interestedCount} interested lead(s) currently in pipeline.`,
      suggestedActions: messages.some(m => m.category === 'interested') 
        ? "Reply to your interested leads in the Unified Inbox first, then review scheduled follow-ups."
        : "Send today's scheduled follow-ups and monitor open rates across active campaigns."
    };

    return NextResponse.json({
      success: true,
      data: {
        pipelineHealth,
        timeline,
        funnel,
        todayTasks,
        upcomingFollowups,
        notifications,
        campaignInsightsMap,
        aiSummary,
      }
    });

  } catch (error: any) {
    console.error('Campaign Intelligence API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
