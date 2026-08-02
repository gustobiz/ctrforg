import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/gmail/oauth';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { connectionId, creators } = body;

    let listToExport = creators;
    if (!listToExport || !Array.isArray(listToExport) || listToExport.length === 0) {
      const { data: leads, error: leadsError } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('user_id', user.id);
      
      if (leadsError) {
        console.error('Failed to fetch crm_leads for export:', leadsError);
        return NextResponse.json({ error: `Database Error: ${leadsError.message}` }, { status: 500 });
      }
      
      listToExport = leads || [];
    }

    if (listToExport.length === 0) {
      return NextResponse.json({ error: 'No leads found to export' }, { status: 400 });
    }

    // Retrieve active connection
    let query = supabase
      .from('sheets_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (connectionId) {
      query = query.eq('id', connectionId);
    }

    const { data: connections, error: connError } = await query;
    if (connError || !connections || connections.length === 0) {
      return NextResponse.json({ error: 'No active Google Sheet connection found. Please connect one first.' }, { status: 404 });
    }

    const conn = connections[0];
    const { sheet_id: sheetId, sheet_name: sheetName } = conn;

    const tokenData = await getValidAccessToken(user.id);
    if (!tokenData) {
      return NextResponse.json({ error: 'Google OAuth account unauthorized or token expired.' }, { status: 401 });
    }

    // Convert creators array into rows matching headers
    // Headers: Channel Name, Channel URL, Handle, Subscribers, Avg Views, Email, Website, Instagram, Twitter, LinkedIn, Opportunity Score, Buying Score, Outreach Angle
    const rows = listToExport.map((c: any) => [
      c.channelName || c.channel_name || c.creator_name || '',
      c.channelUrl || c.channel_url || c.video_url || '',
      c.handle || '',
      c.subsRaw || c.subscriber_count || 0,
      c.viewsRaw || c.view_count || c.average_views || 0,
      c.contact_email || c.email || (c.ai_analysis?.contact_email) || '',
      c.website || '',
      c.instagram || '',
      c.twitter || '',
      c.linkedin || '',
      c.opportunity_score || c.score || 0,
      c.buying_score || c.lead_score || 0,
      c.ideal_outreach_angle || c.notes || c.whyThisLead || ''
    ]);

    const range = `${sheetName || 'Sheet1'}!A2`; // Append below header (assumes row 1 has headers)
    const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

    const response = await fetch(appendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Google Sheets API append failed:`, errText);
      return NextResponse.json({ error: `Google Sheets API Error: ${errText}` }, { status: 500 });
    }

    // Update synced timestamp
    await supabase
      .from('sheets_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', conn.id);

    return NextResponse.json({
      success: true,
      message: `Successfully exported ${listToExport.length} creators to Google Sheet!`,
      sheetId,
      sheetName
    });

  } catch (error: any) {
    console.error('Sheets export API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
