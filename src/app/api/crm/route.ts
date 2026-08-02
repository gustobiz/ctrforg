import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeCRMLead } from '@/lib/supabase/db';

// GET: Query leads with search, filters, pagination, sorting
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const source = searchParams.get('source') || '';
    const sourceType = searchParams.get('sourceType') || '';
    const sheetId = searchParams.get('sheetId') || '';
    const csvBatchId = searchParams.get('csvBatchId') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? true : false;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '500', 10);
    const includeArchived = searchParams.get('includeArchived') === 'true';

    let query = supabase
      .from('crm_leads')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id);

    // Source-Isolated Filtering
    if (sheetId) {
      query = query.eq('sheet_id', sheetId);
    } else if (csvBatchId) {
      query = query.eq('csv_batch_id', csvBatchId);
    } else if (sourceType === 'google_sheets') {
      query = query.eq('contact_source', 'google_sheets');
    } else if (sourceType === 'csv') {
      query = query.eq('contact_source', 'csv_import');
    } else if (sourceType === 'crm') {
      query = query.or('contact_source.eq.manual,contact_source.eq.youtube_scraping,contact_source.is.null');
    }

    // Default to excluding archived leads unless specifically filtering for archived or requesting includeArchived
    if (status && status !== 'all') {
      query = query.eq('status', status);
    } else if (!includeArchived && status !== 'archived') {
      query = query.neq('status', 'archived');
    }

    if (source && source !== 'all') {
      query = query.eq('contact_source', source);
    }

    if (search) {
      query = query.or(`creator_name.ilike.%${search}%,channel_name.ilike.%${search}%,email.ilike.%${search}%,contact_email.ilike.%${search}%,notes.ilike.%${search}%`);
    }

    query = query.order(sortBy, { ascending: sortOrder });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: leads, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      leads: leads || [],
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  } catch (error: any) {
    console.error('CRM GET error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// POST: Create lead, Duplicate lead, Merge duplicates, Find duplicates
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, leadId, targetLeadId, duplicateLeadIds, ...rawPayload } = body;

    // Find Duplicate Leads action
    if (action === 'find_duplicates') {
      const { data: allLeads, error } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const emailMap = new Map<string, any[]>();
      const nameMap = new Map<string, any[]>();

      (allLeads || []).forEach(lead => {
        const email = (lead.email || lead.contact_email || '').toLowerCase().trim();
        const name = (lead.creator_name || '').toLowerCase().trim();
        if (email && email.includes('@')) {
          const list = emailMap.get(email) || [];
          list.push(lead);
          emailMap.set(email, list);
        }
        if (name) {
          const list = nameMap.get(name) || [];
          list.push(lead);
          nameMap.set(name, list);
        }
      });

      const duplicateGroups: any[] = [];
      emailMap.forEach((group, email) => {
        if (group.length > 1) {
          duplicateGroups.push({ reason: `Matching Email: ${email}`, leads: group });
        }
      });
      nameMap.forEach((group, name) => {
        if (group.length > 1) {
          const alreadyAdded = duplicateGroups.some(g => g.leads.some((l: any) => l.id === group[0].id));
          if (!alreadyAdded) {
            duplicateGroups.push({ reason: `Matching Name: ${name}`, leads: group });
          }
        }
      });

      return NextResponse.json({ success: true, duplicateGroups });
    }

    // Merge Duplicates action
    if (action === 'merge' && targetLeadId && Array.isArray(duplicateLeadIds)) {
      const { data: targetLead, error: fetchTargetErr } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('id', targetLeadId)
        .eq('user_id', user.id)
        .single();

      if (fetchTargetErr || !targetLead) {
        return NextResponse.json({ error: 'Target lead not found' }, { status: 404 });
      }

      const { data: dupLeads } = await supabase
        .from('crm_leads')
        .select('*')
        .in('id', duplicateLeadIds)
        .eq('user_id', user.id);

      // Merge fields cleanly
      let mergedNotes = targetLead.notes || '';
      let mergedEmail = targetLead.email || targetLead.contact_email || '';
      let maxScore = targetLead.lead_score || 50;

      (dupLeads || []).forEach(d => {
        if (d.notes && !mergedNotes.includes(d.notes)) {
          mergedNotes += `\n[Merged Note]: ${d.notes}`;
        }
        if (!mergedEmail && (d.email || d.contact_email)) {
          mergedEmail = d.email || d.contact_email;
        }
        if (d.lead_score && d.lead_score > maxScore) {
          maxScore = d.lead_score;
        }
      });

      const updatedPayload = sanitizeCRMLead({
        ...targetLead,
        email: mergedEmail || targetLead.email,
        contact_email: mergedEmail || targetLead.contact_email,
        notes: mergedNotes,
        lead_score: maxScore,
        last_updated: new Date().toISOString(),
      });

      const { data: mergedLead, error: updateErr } = await supabase
        .from('crm_leads')
        .update(updatedPayload)
        .eq('id', targetLeadId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Delete merged duplicate leads
      await supabase
        .from('crm_leads')
        .delete()
        .in('id', duplicateLeadIds)
        .eq('user_id', user.id);

      return NextResponse.json({
        success: true,
        message: `Merged ${duplicateLeadIds.length} duplicate leads into primary lead!`,
        lead: mergedLead,
      });
    }

    // Duplicate Lead action
    if (action === 'duplicate' && leadId) {
      const { data: original, error: fetchErr } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', user.id)
        .single();

      if (fetchErr || !original) {
        return NextResponse.json({ error: 'Original lead not found' }, { status: 404 });
      }

      const copyPayload = sanitizeCRMLead({
        ...original,
        id: undefined,
        creator_name: `${original.creator_name} (Copy)`,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      });

      const { data: duplicated, error: dupErr } = await supabase
        .from('crm_leads')
        .insert(copyPayload)
        .select()
        .single();

      if (dupErr) throw dupErr;

      return NextResponse.json({
        success: true,
        message: 'Lead duplicated successfully!',
        lead: duplicated,
      });
    }

    // Create New Lead
    const creatorName = rawPayload.creator_name || rawPayload.name;
    if (!creatorName) {
      return NextResponse.json({ error: 'Creator name is required' }, { status: 400 });
    }

    const payload = sanitizeCRMLead({
      ...rawPayload,
      user_id: user.id,
      creator_name: creatorName,
      channel_name: rawPayload.channel_name || creatorName,
      status: rawPayload.status || 'new',
      contact_source: rawPayload.contact_source || 'manual',
      last_updated: new Date().toISOString(),
    });

    const { data: newLead, error } = await supabase
      .from('crm_leads')
      .insert(payload)
      .select()
      .single();

    if (error) {
      // If unique constraint triggers, fallback to update
      const { data: existing } = await supabase
        .from('crm_leads')
        .select('id')
        .eq('user_id', user.id)
        .eq('creator_name', creatorName)
        .maybeSingle();

      if (existing) {
        const { data: updated, error: updateErr } = await supabase
          .from('crm_leads')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        return NextResponse.json({
          success: true,
          message: 'Lead updated successfully!',
          lead: updated,
        });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Lead created successfully!',
      lead: newLead,
    });
  } catch (error: any) {
    console.error('CRM POST error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Edit lead details, Archive, Restore, Bulk update
export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ids, action, ...updateData } = body;

    // Soft delete / Archive action
    if (action === 'soft_delete' && Array.isArray(ids) && ids.length > 0) {
      const { data: updatedList, error: archiveErr } = await supabase
        .from('crm_leads')
        .update({ status: 'archived', last_updated: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', user.id)
        .select();

      if (archiveErr) throw archiveErr;

      return NextResponse.json({
        success: true,
        message: `Archived ${ids.length} lead(s) successfully!`,
        leads: updatedList,
      });
    }

    // Restore archived leads action
    if (action === 'restore' && Array.isArray(ids) && ids.length > 0) {
      const { data: updatedList, error: restoreErr } = await supabase
        .from('crm_leads')
        .update({ status: 'new', last_updated: new Date().toISOString() })
        .in('id', ids)
        .eq('user_id', user.id)
        .select();

      if (restoreErr) throw restoreErr;

      return NextResponse.json({
        success: true,
        message: `Restored ${ids.length} lead(s) successfully!`,
        leads: updatedList,
      });
    }

    // Bulk action (e.g. bulk status update)
    if (action === 'bulk_update' && Array.isArray(ids) && ids.length > 0) {
      const payload = {
        ...updateData,
        last_updated: new Date().toISOString(),
      };

      const { data: updatedList, error: bulkErr } = await supabase
        .from('crm_leads')
        .update(payload)
        .in('id', ids)
        .eq('user_id', user.id)
        .select();

      if (bulkErr) throw bulkErr;

      return NextResponse.json({
        success: true,
        message: `Updated ${ids.length} leads successfully!`,
        leads: updatedList,
      });
    }

    if (!id) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    const payload = sanitizeCRMLead({
      ...updateData,
      last_updated: new Date().toISOString(),
    });

    const { data: updatedLead, error } = await supabase
      .from('crm_leads')
      .update(payload)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully!',
      lead: updatedLead,
    });
  } catch (error: any) {
    console.error('CRM PUT error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Single, Bulk, Delete by Source, Delete by Spreadsheet, Delete All
export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const sourceParam = searchParams.get('source');
    const actionParam = searchParams.get('action');
    const sheetId = searchParams.get('sheetId');
    const csvBatchId = searchParams.get('csvBatchId');

    const body = await req.json().catch(() => ({}));
    const action = body.action || actionParam;
    const source = body.source || sourceParam;
    const targetSheetId = body.sheetId || sheetId;
    const targetCsvBatchId = body.csvBatchId || csvBatchId;
    const idsToDelete = body.ids || (id ? [id] : []);

    // 1. Delete All leads
    if (action === 'delete_all') {
      const { error, count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Deleted all leads successfully!`,
        count,
      });
    }

    // 2. Delete Specific Spreadsheet Batch
    if ((action === 'delete_by_sheet_id' || action === 'delete_spreadsheet') && targetSheetId) {
      const { error, count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('sheet_id', targetSheetId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Deleted all imported leads from Google Sheet '${targetSheetId}'!`,
        count,
      });
    }

    // 3. Delete Specific CSV Batch
    if (action === 'delete_csv_batch' && targetCsvBatchId) {
      const { error, count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('csv_batch_id', targetCsvBatchId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Deleted CSV import batch successfully!`,
        count,
      });
    }

    // 4. Delete CRM Leads (manual / youtube_scraping only, keeping Sheets & CSV intact)
    if (action === 'delete_crm') {
      const { error, count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .or('contact_source.eq.manual,contact_source.eq.youtube_scraping,contact_source.is.null');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Deleted CRM manual leads successfully!`,
        count,
      });
    }

    // 5. Delete by Source (e.g., google_sheets, csv_import, manual)
    if (action === 'delete_by_source' && source) {
      const { error, count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('contact_source', source);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Deleted leads from source '${source}' successfully!`,
        count,
      });
    }

    // 3. Delete by Spreadsheet
    if (action === 'delete_by_spreadsheet') {
      const { error, count } = await supabase
        .from('crm_leads')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .eq('contact_source', 'google_sheets');

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: `Deleted all Google Sheets imported leads successfully!`,
        count,
      });
    }

    // 4. Single or Bulk Delete by IDs
    if (idsToDelete.length === 0) {
      return NextResponse.json({ error: 'No lead IDs or delete criteria provided' }, { status: 400 });
    }

    const { error } = await supabase
      .from('crm_leads')
      .delete()
      .in('id', idsToDelete)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Deleted ${idsToDelete.length} lead(s) successfully!`,
      deletedIds: idsToDelete,
    });
  } catch (error: any) {
    console.error('CRM DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
