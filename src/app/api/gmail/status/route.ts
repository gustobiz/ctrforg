import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
      return NextResponse.json({ connected: false, email: null, status: 'unauthorized' });
    }

    const { data: connection, error } = await (await supabase)
      .from('gmail_connections')
      .select('email, status, connected_at, token_expiry')
      .eq('user_id', user.id)
      .single();

    if (error || !connection) {
      return NextResponse.json({ connected: false, email: null, status: 'disconnected' });
    }

    // Check if token is still valid
    const isExpired = new Date(connection.token_expiry) < new Date();

    return NextResponse.json({
      connected: connection.status === 'active' && !isExpired,
      email: connection.email,
      status: isExpired ? 'expired' : connection.status,
      connectedAt: connection.connected_at,
    });
  } catch (error: any) {
    console.error('Gmail status check error:', error);
    return NextResponse.json({ connected: false, email: null, status: 'error' });
  }
}
