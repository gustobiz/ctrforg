import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/gmail/oauth';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokenData = await getValidAccessToken(user.id);
    if (!tokenData) {
      return NextResponse.json({ error: 'Google Account not connected or OAuth token expired.' }, { status: 400 });
    }

    // Call Google Drive v3 API to search for spreadsheets owned or accessible by user
    const driveUrl = 'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%27application%2Fvnd.google-apps.spreadsheet%27&fields=files(id%2Cname%2CwebViewLink%2CmodifiedTime)&pageSize=100&orderBy=modifiedTime%20desc';
    const response = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Google Drive API Error: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ files: data.files || [] });
  } catch (error: any) {
    console.error('Sheets list API error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
