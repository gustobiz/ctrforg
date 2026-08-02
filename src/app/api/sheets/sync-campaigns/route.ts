import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncCampaignStatusesToSheet } from '@/lib/gmail/sheets-sync';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await syncCampaignStatusesToSheet(user.id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to sync campaign statuses to Google Sheet. Make sure you have connected a Google Sheet.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Campaign statuses synchronized to Google Sheet!' });
  } catch (error: any) {
    console.error('Sync campaigns error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
