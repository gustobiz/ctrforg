import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { autoSync } = await req.json();

    const { data, error } = await supabase
      .from('sheets_connections')
      .update({ auto_sync: autoSync })
      .eq('user_id', user.id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Sheets toggle sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
