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

    const { title } = await req.json().catch(() => ({}));
    const sheetTitle = title || 'CTRForge Leads';

    const tokenData = await getValidAccessToken(user.id);
    if (!tokenData) {
      return NextResponse.json({ error: 'Google Account not connected or OAuth token expired.' }, { status: 400 });
    }

    // Check if a spreadsheet with the exact title already exists in user's Drive
    let existingSheetId = null;
    let existingSheetUrl = null;

    try {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`name='${sheetTitle}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`)}&fields=files(id,name,webViewLink)`;
      const searchResponse = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` }
      });
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const files = searchData.files || [];
        if (files.length > 0) {
          existingSheetId = files[0].id;
          existingSheetUrl = files[0].webViewLink || `https://docs.google.com/spreadsheets/d/${existingSheetId}/edit`;
          console.log(`[Google Sheets] Found existing sheet: ${sheetTitle} (ID: ${existingSheetId})`);
        }
      }
    } catch (searchErr) {
      console.warn('[Google Sheets] Failed to search for existing spreadsheet:', searchErr);
    }

    let sheetId = existingSheetId;
    let sheetUrl = existingSheetUrl;

    if (!sheetId) {
      // 1. Create spreadsheet in Drive via Sheets API
      const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: sheetTitle },
          sheets: [
            {
              properties: { title: 'Leads' }
            }
          ]
        }),
      });

      if (!createResponse.ok) {
        const errText = await createResponse.text();
        return NextResponse.json({ error: `Failed to create sheet: ${errText}` }, { status: createResponse.status });
      }

      const sheetData = await createResponse.json();
      sheetId = sheetData.spreadsheetId;
      sheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;

      // 2. Initialize sheet headers
      const headers = [
        'Channel Name',
        'Channel URL',
        'Handle',
        'Subscribers',
        'Avg Views',
        'Email',
        'Website',
        'Instagram',
        'Twitter',
        'LinkedIn',
        'Opportunity Score',
        'Buying Score',
        'Outreach Angle'
      ];

      const range = 'Leads!A1:M1';
      const initHeadersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
      
      const headersResponse = await fetch(initHeadersUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range,
          majorDimension: 'ROWS',
          values: [headers]
        }),
      });

      if (!headersResponse.ok) {
        const errText = await headersResponse.text();
        console.warn('Created sheet but failed to initialize headers:', errText);
      }
    }

    // 3. Save connection details in sheets_connections table
    const { data: connection, error: dbError } = await supabase
      .from('sheets_connections')
      .upsert({
        user_id: user.id,
        sheet_url: sheetUrl,
        sheet_id: sheetId,
        sheet_name: sheetTitle,
        column_mapping: {
          name: 'Channel Name',
          email: 'Email',
          channel: 'Channel Name',
          subscribers: 'Subscribers',
          notes: 'Outreach Angle',
        },
        auto_sync: true,
        sync_interval_minutes: 15,
        status: 'active',
        last_synced_at: new Date().toISOString(),
      }, { onConflict: 'user_id,sheet_id' })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      message: 'Created and connected sheet successfully!',
      connection
    });
  } catch (error: any) {
    console.error('Sheets create API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
