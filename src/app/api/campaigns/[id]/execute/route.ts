import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processNextBatch } from '@/lib/gmail/campaign-engine';

// POST /api/campaigns/[id]/execute — Execute next batch of campaign emails
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await processNextBatch(params.id, user.id);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Campaign execution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
