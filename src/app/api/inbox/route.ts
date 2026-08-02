import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncReplies } from '@/lib/gmail/replies';

// GET /api/inbox — Get all inbox messages with counts and thread grouping, optionally syncing first
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sync = searchParams.get('sync') === 'true';

    console.log(`[INBOX API] GET — user: ${user.id}, sync: ${sync}`);

    // If sync requested, pull from Gmail
    if (sync) {
      try {
        const result = await syncReplies(user.id);
        console.log(`[INBOX API] Sync complete — ${result.newReplies.length} new reply(ies) added`);
      } catch (err: any) {
        console.error('[INBOX API] Gmail reply sync error:', err.message);
      }
    }

    // Fetch inbox messages directly without PostgREST foreign key join
    const { data: rawMessages, error } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false });

    if (error) {
      console.error('[INBOX API] DB query error:', error.message, '| code:', error.code);
      throw error;
    }

    let messages = rawMessages || [];

    // Calculate count breakdown per category
    const counts = {
      all: messages.length,
      unread: messages.filter((m: any) => !m.is_read).length,
      interested: messages.filter((m: any) => m.category === 'interested').length,
      not_interested: messages.filter((m: any) => m.category === 'not_interested').length,
      followup_needed: messages.filter((m: any) => m.category === 'followup_needed').length,
      closed: messages.filter((m: any) => m.category === 'closed').length,
      archive: messages.filter((m: any) => m.category === 'archive').length,
    };

    // Calculate thread reply count per gmail_thread_id
    const threadCounts = new Map<string, number>();
    messages.forEach((m: any) => {
      if (m.gmail_thread_id) {
        threadCounts.set(m.gmail_thread_id, (threadCounts.get(m.gmail_thread_id) || 0) + 1);
      }
    });

    // Fetch corresponding CRM lead details separately (if lead_ids present)
    const leadIds = Array.from(
      new Set(messages.map((m: any) => m.lead_id).filter(Boolean))
    );

    if (leadIds.length > 0) {
      const { data: leads, error: leadsError } = await supabase
        .from('crm_leads')
        .select('id, creator_name, channel_name')
        .in('id', leadIds);

      if (leadsError) {
        console.warn('[INBOX API] Failed to fetch crm_leads:', leadsError.message);
      } else if (leads) {
        const leadMap = new Map<string, { creator_name: string; channel_name: string }>();
        leads.forEach((l: any) => {
          leadMap.set(l.id, {
            creator_name: l.creator_name || '',
            channel_name: l.channel_name || '',
          });
        });

        messages = messages.map((m: any) => ({
          ...m,
          crm_leads: m.lead_id ? leadMap.get(m.lead_id) || null : null,
          thread_message_count: m.gmail_thread_id ? (threadCounts.get(m.gmail_thread_id) || 1) : 1,
        }));
      }
    } else {
      messages = messages.map((m: any) => ({
        ...m,
        crm_leads: null,
        thread_message_count: m.gmail_thread_id ? (threadCounts.get(m.gmail_thread_id) || 1) : 1,
      }));
    }

    console.log(`[INBOX API] DB query result: ${messages.length} message(s) for user ${user.id}`);

    return NextResponse.json({ 
      success: true, 
      messages: messages,
      counts: counts
    });
  } catch (error: any) {
    console.error('[INBOX API] GET handler error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/inbox — Update message category/read status
export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, category, isRead } = body;

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    const updatePayload: any = {};
    if (category !== undefined) updatePayload.category = category;
    if (isRead !== undefined) updatePayload.is_read = isRead;

    console.log(`[INBOX API] PUT — updating message ${id}:`, JSON.stringify(updatePayload));

    const { data: message, error } = await supabase
      .from('inbox_messages')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('[INBOX API] PUT update error:', error.message);
      throw error;
    }

    console.log(`[INBOX API] PUT — message ${id} updated successfully`);
    return NextResponse.json({ success: true, message });
  } catch (error: any) {
    console.error('[INBOX API] PUT handler error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/inbox — Delete a message
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }

    console.log(`[INBOX API] DELETE — deleting message ${id} for user ${user.id}`);

    const { error } = await supabase
      .from('inbox_messages')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('[INBOX API] DELETE error:', error.message);
      throw error;
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error('[INBOX API] DELETE handler error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
