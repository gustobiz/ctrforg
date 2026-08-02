import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncReplies } from '@/lib/gmail/replies';

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncReplies(user.id);

    return NextResponse.json({
      success: true,
      newReplies: result.newReplies,
      count: result.newReplies.length,
    });
  } catch (error: any) {
    console.error('Reply sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
