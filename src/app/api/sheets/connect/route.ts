import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/gmail/oauth';

// Helper to extract spreadsheet ID from URL
function extractSpreadsheetId(url: string): string | null {
  const matches = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return matches ? matches[1] : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sheetUrl, sheetId: inputSheetId } = await req.json();
    let finalSheetUrl = sheetUrl;
    let sheetId = inputSheetId;

    if (!finalSheetUrl && sheetId) {
      finalSheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    }

    if (!finalSheetUrl) {
      return NextResponse.json({ error: 'Google Sheet URL or ID is required' }, { status: 400 });
    }

    if (!sheetId) {
      sheetId = extractSpreadsheetId(finalSheetUrl);
    }

    if (!sheetId) {
      return NextResponse.json({ error: 'Invalid Google Sheet URL format' }, { status: 400 });
    }

    // Get active Google token
    const tokenData = await getValidAccessToken(user.id);
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Google Account not connected. Please connect your Google account in Settings first.' 
      }, { status: 400 });
    }

    // Fetch sheet metadata to verify connection and read sheet names
    const metaResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          Accept: 'application/json',
        },
      }
    );

    if (!metaResponse.ok) {
      if (metaResponse.status === 404 || metaResponse.status === 403) {
        return NextResponse.json({ 
          error: 'This spreadsheet is no longer available. Please select another spreadsheet.',
          isNotFound: true 
        }, { status: metaResponse.status });
      }
      const errText = await metaResponse.text();
      return NextResponse.json({ 
        error: `Could not access Google Sheet. Details: ${errText}` 
      }, { status: 400 });
    }

    const metadata = await metaResponse.json();
    const spreadsheetTitle = metadata.properties?.title || metadata.sheets?.[0]?.properties?.title || 'Google Sheet';

    // Disconnect previous sheets & clear old Google Sheet leads to enforce single active sheet rule
    await supabase
      .from('sheets_connections')
      .delete()
      .eq('user_id', user.id)
      .neq('sheet_id', sheetId);

    await supabase
      .from('crm_leads')
      .delete()
      .eq('user_id', user.id)
      .eq('contact_source', 'google_sheets')
      .neq('sheet_id', sheetId);

    // Store Sheets Connection in Supabase
    const { data: connection, error } = await supabase
      .from('sheets_connections')
      .upsert({
        user_id: user.id,
        sheet_url: finalSheetUrl,
        sheet_id: sheetId,
        sheet_name: spreadsheetTitle,
        column_mapping: {
          name: 'Name',
          email: 'Email',
          channel: 'Channel',
          video_title: 'VideoTitle',
          subscribers: 'Subscribers',
          notes: 'Notes',
        },
        auto_sync: true,
        sync_interval_minutes: 15,
        status: 'active',
        last_synced_at: null,
      }, { onConflict: 'user_id,sheet_id' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Google Sheet connected successfully!',
      connection 
    });
  } catch (error: any) {
    console.error('Sheets connect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
