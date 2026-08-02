import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Fetch CRM Leads total count
    const { count: crmLeadsCount } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true });

    // 2. Fetch Email Templates count
    const { count: templatesCount } = await supabase
      .from('email_templates')
      .select('*', { count: 'exact', head: true });

    // 3. Fetch Bulk Campaigns list & counts
    const { data: campaigns } = await supabase
      .from('bulk_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    // 4. Fetch Gmail Connections
    const { data: gmailConnections } = await supabase
      .from('gmail_connections')
      .select('*');

    // 5. Fetch Sheets Connections
    const { data: sheetsConnections } = await supabase
      .from('sheets_connections')
      .select('*');

    // 6. Fetch Email Queue metrics
    const { data: queueItems } = await supabase
      .from('email_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // 7. Fetch Recent Email Events
    const { data: emailEvents } = await supabase
      .from('email_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // Calculate queue status summary
    const queueStats = {
      queued: queueItems?.filter(i => i.status === 'queued').length || 0,
      sending: queueItems?.filter(i => i.status === 'sending').length || 0,
      sent: queueItems?.filter(i => i.status === 'sent').length || 0,
      failed: queueItems?.filter(i => i.status === 'failed').length || 0,
      total: queueItems?.length || 0,
    };

    // Calculate campaign summary
    const campaignSummary = {
      totalCampaigns: campaigns?.length || 0,
      activeCampaigns: campaigns?.filter(c => c.status === 'running').length || 0,
      totalLeads: campaigns?.reduce((acc, c) => acc + (c.total_leads || 0), 0) || 0,
      sentCount: campaigns?.reduce((acc, c) => acc + (c.sent_count || 0), 0) || 0,
      openedCount: campaigns?.reduce((acc, c) => acc + (c.opened_count || 0), 0) || 0,
      clickedCount: campaigns?.reduce((acc, c) => acc + (c.clicked_count || 0), 0) || 0,
      repliedCount: campaigns?.reduce((acc, c) => acc + (c.replied_count || 0), 0) || 0,
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats: {
        crmLeadsCount: crmLeadsCount || 0,
        templatesCount: templatesCount || 0,
        campaigns: campaigns || [],
        campaignSummary,
        gmailConnections: gmailConnections || [],
        sheetsConnections: sheetsConnections || [],
        queueStats,
        queueItems: queueItems || [],
        emailEvents: emailEvents || [],
        systemHealth: {
          database: 'Healthy (Supabase PostgreSQL)',
          auth: 'Operational (Supabase SSR Auth)',
          postgrest: 'Active',
          youtubeApi: process.env.YOUTUBE_API_KEY ? 'Configured' : 'Missing Key',
          geminiApi: process.env.GEMINI_API_KEY ? 'Configured' : 'Missing Key',
        }
      }
    });
  } catch (error: any) {
    console.error('Admin stats API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
