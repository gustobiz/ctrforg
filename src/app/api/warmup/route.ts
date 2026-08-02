import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/warmup — Get warmup stats
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get today's warmup record
    const today = new Date().toISOString().split('T')[0];
    const { data: todayRecord } = await supabase
      .from('gmail_warmup')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();

    // Get warmup history (past 7 days)
    const { data: history } = await supabase
      .from('gmail_warmup')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(7);

    // Calculate simulated warmup score based on campaign send rate, bounce rate, etc.
    // fetch active connection to estimate email age
    const { data: connection } = await supabase
      .from('gmail_connections')
      .select('connected_at')
      .eq('user_id', user.id)
      .maybeSingle();

    let accountAgeDays = 1;
    if (connection?.connected_at) {
      const connectedDate = new Date(connection.connected_at);
      accountAgeDays = Math.max(1, Math.ceil((Date.now() - connectedDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Suggested daily limit calculation (warmup ramp up: starts at 5/day, adds 5 per day connected, cap at 50/day)
    const suggestedVolume = Math.min(5 + (accountAgeDays * 3), 50);

    // Warmup score starts at 50, increases with connection days, decreases if connections have expired status
    const warmupScore = Math.min(60 + (accountAgeDays * 2), 98);

    // If today's record doesn't exist, create it dynamically
    let currentRecord = todayRecord;
    if (!currentRecord) {
      const { data: inserted, error: insertErr } = await supabase
        .from('gmail_warmup')
        .insert({
          user_id: user.id,
          date: today,
          emails_sent: 0,
          daily_limit: suggestedVolume,
          warmup_score: warmupScore,
          suggested_volume: suggestedVolume,
          status: 'active',
        })
        .select()
        .single();
      
      if (!insertErr) {
        currentRecord = inserted;
      }
    }

    return NextResponse.json({
      success: true,
      today: currentRecord || {
        date: today,
        emails_sent: 0,
        daily_limit: suggestedVolume,
        warmup_score: warmupScore,
        suggested_volume: suggestedVolume,
        status: 'active'
      },
      history: history || [],
      suggestedVolume,
      warmupScore,
    });
  } catch (error: any) {
    console.error('Warmup GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/warmup — Toggle status or update daily limit
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { dailyLimit, status } = body;
    const today = new Date().toISOString().split('T')[0];

    const updatePayload: any = {};
    if (dailyLimit !== undefined) updatePayload.daily_limit = dailyLimit;
    if (status !== undefined) updatePayload.status = status;

    const { data: record, error } = await supabase
      .from('gmail_warmup')
      .update(updatePayload)
      .eq('user_id', user.id)
      .eq('date', today)
      .select()
      .single();

    if (error) {
      // Record might not exist for today, upsert instead
      const { data: upserted, error: upsertErr } = await supabase
        .from('gmail_warmup')
        .upsert({
          user_id: user.id,
          date: today,
          daily_limit: dailyLimit || 20,
          status: status || 'active',
        }, { onConflict: 'user_id,date' })
        .select()
        .single();

      if (upsertErr) throw upsertErr;
      return NextResponse.json({ success: true, record: upserted });
    }

    return NextResponse.json({ success: true, record });
  } catch (error: any) {
    console.error('Warmup POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
