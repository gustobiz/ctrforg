import { NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/gmail/oauth';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Encode user ID as state parameter for CSRF protection
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64url');
    const authUrl = getAuthUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('Gmail connect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
