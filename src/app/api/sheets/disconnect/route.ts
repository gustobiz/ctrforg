import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    let { connectionId, sheetId, deleteLeads = true } = body;

    // If connectionId is provided but sheetId is missing, resolve sheetId from sheets_connections
    if (connectionId && !sheetId) {
      const { data: conn } = await supabase
        .from('sheets_connections')
        .select('sheet_id')
        .eq('id', connectionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (conn?.sheet_id) {
        sheetId = conn.sheet_id;
      }
    }

    // If sheetId is provided but connectionId is missing, resolve connectionId
    if (sheetId && !connectionId) {
      const { data: conn } = await supabase
        .from('sheets_connections')
        .select('id')
        .eq('sheet_id', sheetId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (conn?.id) {
        connectionId = conn.id;
      }
    }

    // Fallback: If neither connectionId nor sheetId was supplied, target the most recent active connection
    if (!connectionId && !sheetId) {
      const { data: activeConns } = await supabase
        .from('sheets_connections')
        .select('id, sheet_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (activeConns && activeConns.length > 0) {
        connectionId = activeConns[0].id;
        sheetId = activeConns[0].sheet_id;
      }
    }

    if (!connectionId && !sheetId) {
      return NextResponse.json({ error: 'No connection found to disconnect' }, { status: 404 });
    }

    // Delete connection from sheets_connections
    let connQuery = supabase
      .from('sheets_connections')
      .delete()
      .eq('user_id', user.id);

    if (connectionId) {
      connQuery = connQuery.eq('id', connectionId);
    } else if (sheetId) {
      connQuery = connQuery.eq('sheet_id', sheetId);
    }

    const { error: connDeleteError } = await connQuery;
    if (connDeleteError) throw connDeleteError;

    // Perform cascading delete on crm_leads for this sheet
    let deletedLeadsCount = 0;
    const targetSheetId = sheetId;
    if (deleteLeads && targetSheetId) {
      // 1. Fetch leads associated with sheet to clean up campaign_leads links
      const { data: sheetLeads } = await supabase
        .from('crm_leads')
        .select('id')
        .eq('user_id', user.id)
        .eq('sheet_id', targetSheetId);

      if (sheetLeads && sheetLeads.length > 0) {
        const leadIds = sheetLeads.map(l => l.id);
        // Delete campaign_leads references
        await supabase
          .from('campaign_leads')
          .delete()
          .in('lead_id', leadIds);
      }

      // 2. Delete leads from crm_leads
      const { count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('sheet_id', targetSheetId);

      deletedLeadsCount = count || 0;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Google Sheet disconnected and ${deletedLeadsCount} imported lead(s) removed!`,
      deletedLeadsCount
    });
  } catch (error: any) {
    console.error('Sheets disconnect error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

