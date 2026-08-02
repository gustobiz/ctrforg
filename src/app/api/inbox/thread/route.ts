import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/inbox/thread?threadId=... — Fetch full message timeline for a thread
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get('threadId');
    const messageId = searchParams.get('messageId');

    if (!threadId && !messageId) {
      return NextResponse.json({ error: 'threadId or messageId is required' }, { status: 400 });
    }

    // 1. Query inbox_messages by gmail_thread_id or id
    let inboxQuery = supabase
      .from('inbox_messages')
      .select('*')
      .eq('user_id', user.id);

    if (threadId) {
      inboxQuery = inboxQuery.eq('gmail_thread_id', threadId);
    } else if (messageId) {
      inboxQuery = inboxQuery.eq('id', messageId);
    }

    const { data: rawInboxMsgs, error: inboxError } = await inboxQuery.order('received_at', { ascending: true });

    if (inboxError) {
      console.error('[INBOX THREAD API] Error fetching inbox_messages:', inboxError.message);
      throw inboxError;
    }

    const messages = rawInboxMsgs || [];

    // 2. Fetch initial sent email from email_campaigns if threadId exists
    let initialSentCampaign: any = null;
    if (threadId) {
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select('*')
        .eq('user_id', user.id)
        .eq('gmail_thread_id', threadId)
        .maybeSingle();

      if (campaign) {
        initialSentCampaign = campaign;
      }
    }

    // 3. Collect lead data if present
    const leadId = messages[0]?.lead_id || initialSentCampaign?.lead_id;
    let leadInfo: any = null;

    if (leadId) {
      const { data: lead } = await supabase
        .from('crm_leads')
        .select('id, creator_name, channel_name, email, status')
        .eq('id', leadId)
        .maybeSingle();
      if (lead) {
        leadInfo = lead;
      }
    }

    // 4. Construct unified timeline array
    const timeline: Array<{
      id: string;
      from_email: string;
      to_email: string;
      subject: string;
      body_html: string;
      body_preview: string;
      is_inbound: boolean;
      received_at: string;
      gmail_message_id?: string;
      gmail_thread_id?: string;
      category?: string;
    }> = [];

    // Add initial sent outreach email if it exists and isn't already duplicated in inbox_messages
    if (initialSentCampaign) {
      const hasDupe = messages.some(m => m.gmail_message_id === initialSentCampaign.gmail_message_id && !m.is_inbound);
      if (!hasDupe) {
        timeline.push({
          id: `campaign_${initialSentCampaign.id}`,
          from_email: user.email || 'You',
          to_email: initialSentCampaign.to_email || '',
          subject: initialSentCampaign.subject || 'Outreach',
          body_html: initialSentCampaign.html_body || initialSentCampaign.body || '',
          body_preview: initialSentCampaign.body || initialSentCampaign.subject || '',
          is_inbound: false,
          received_at: initialSentCampaign.sent_at || initialSentCampaign.created_at || new Date().toISOString(),
          gmail_message_id: initialSentCampaign.gmail_message_id,
          gmail_thread_id: initialSentCampaign.gmail_thread_id,
        });
      }
    }

    // Add inbox messages
    messages.forEach((m: any) => {
      timeline.push({
        id: m.id,
        from_email: m.from_email,
        to_email: m.to_email,
        subject: m.subject || '',
        body_html: m.body_preview || m.snippet || '',
        body_preview: m.snippet || '',
        is_inbound: m.is_inbound !== false,
        received_at: m.received_at || m.created_at,
        gmail_message_id: m.gmail_message_id,
        gmail_thread_id: m.gmail_thread_id,
        category: m.category,
      });
    });

    // Sort chronologically ascending (oldest first, newest at bottom)
    timeline.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

    return NextResponse.json({
      success: true,
      timeline,
      leadInfo,
    });
  } catch (error: any) {
    console.error('[INBOX THREAD API] GET handler error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
