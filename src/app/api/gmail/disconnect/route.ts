import { NextResponse } from 'next/server';
import { revokeToken } from '@/lib/gmail/oauth';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current connection
    const { data: connection } = await (await supabase)
      .from('gmail_connections')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .single();

    if (connection) {
      // Revoke token with Google
      try {
        await revokeToken(connection.access_token);
      } catch (err) {
        console.warn('Token revocation failed (may already be revoked):', err);
      }

      // Delete from database
      await (await supabase)
        .from('gmail_connections')
        .delete()
        .eq('user_id', user.id);
    }

    return NextResponse.json({ success: true, message: 'Gmail disconnected successfully' });
  } catch (error: any) {
    console.error('Gmail disconnect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
