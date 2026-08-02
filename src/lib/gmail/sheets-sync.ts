import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from './oauth';

export async function syncCampaignStatusesToSheet(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Retrieve active connection
    const { data: connections, error: connError } = await supabase
      .from('sheets_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1);

    if (connError || !connections || connections.length === 0) {
      return false;
    }

    const conn = connections[0];
    const { sheet_id: sheetId } = conn;

    const tokenData = await getValidAccessToken(userId);
    if (!tokenData) return false;

    // Fetch user campaigns
    const { data: campaigns, error: campError } = await supabase
      .from('bulk_campaigns')
      .select('*, email_templates(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (campError) throw campError;

    // Check if the "Campaign Statuses" sheet exists, if not create it
    const metadataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      }
    );

    let hasCampaignsTab = false;
    const tabName = 'Campaign Statuses';
    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json();
      const sheetsList = metadata.sheets || [];
      hasCampaignsTab = sheetsList.some((s: any) => s.properties?.title === tabName);
    }

    // If tab doesn't exist, add it
    if (!hasCampaignsTab) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: { title: tabName },
              },
            },
          ],
        }),
      });
    }

    // Prepare header + rows
    const headers = [
      'Campaign Name',
      'Status',
      'Send Rate (per hour)',
      'Total Leads',
      'Sent Count',
      'Opened Count',
      'Clicked Count',
      'Replied Count',
      'Bounced Count',
      'Created At',
      'Completed At',
    ];

    const rows = [
      headers,
      ...(campaigns || []).map((c: any) => [
        c.name || '',
        c.status || '',
        c.send_rate || 20,
        c.total_leads || 0,
        c.sent_count || 0,
        c.opened_count || 0,
        c.clicked_count || 0,
        c.replied_count || 0,
        c.bounced_count || 0,
        c.created_at ? new Date(c.created_at).toLocaleString() : '',
        c.completed_at ? new Date(c.completed_at).toLocaleString() : '',
      ]),
    ];

    // Clear existing data in Campaigns tab
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName + '!A1:Z1000')}:clear`;
    await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenData.accessToken}` },
    });

    // Write new values
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(tabName + '!A1')}?valueInputOption=USER_ENTERED`;
    await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    });

    return true;
  } catch (error) {
    console.error('syncCampaignStatusesToSheet error:', error);
    return false;
  }
}
