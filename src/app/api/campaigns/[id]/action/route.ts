import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCampaignSettings, saveCampaignSettings } from '@/lib/campaigns/settings';
import { isInsideSendWindow, processNextBatch } from '@/lib/gmail/campaign-engine';
import { calculateNextEligibleSendTime } from '@/lib/gmail/schedule-utils';

// POST /api/campaigns/[id]/action — Campaign actions
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    // Verify campaign belongs to user
    const { data: campaign, error: fetchError } = await supabase
      .from('bulk_campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const settings = await getCampaignSettings(params.id);

    switch (action) {
      case 'start':
      case 'resume': {
        if (campaign.status === 'completed' || campaign.status === 'cancelled') {
          return NextResponse.json({ error: `Cannot start campaign with status "${campaign.status}"` }, { status: 400 });
        }

        const nowIso = new Date().toISOString();

        // 1. Resume any paused or queued entries in the queue, resetting scheduled_at to NOW for immediate processing
        await adminSupabase
          .from('email_queue')
          .update({ status: 'queued', scheduled_at: nowIso })
          .eq('campaign_id', params.id)
          .in('status', ['paused', 'queued']);

        // 2. Create queue entries for any pending leads that don't have queue records
        const { data: pendingLeads } = await supabase
          .from('campaign_leads')
          .select('lead_id, lead_email')
          .eq('campaign_id', params.id)
          .eq('status', 'pending');

        if (pendingLeads && pendingLeads.length > 0) {
          const { data: existingQueue } = await adminSupabase
            .from('email_queue')
            .select('lead_id')
            .eq('campaign_id', params.id);

          const existingLeadIds = new Set(existingQueue?.map((q: any) => q.lead_id) || []);

          const newQueueItems = pendingLeads
            .filter((l: any) => l.lead_email && !existingLeadIds.has(l.lead_id))
            .map((l: any) => ({
              user_id: user.id,
              campaign_id: params.id,
              lead_id: l.lead_id,
              email: l.lead_email,
              status: 'queued',
              scheduled_at: nowIso,
            }));

          if (newQueueItems.length > 0) {
            await adminSupabase.from('email_queue').insert(newQueueItems);
          }
        }

        const { error } = await supabase
          .from('bulk_campaigns')
          .update({
            status: 'running',
            started_at: campaign.started_at || nowIso,
            paused_at: null,
            updated_at: nowIso,
          })
          .eq('id', params.id);

        if (error) throw error;

        // Immediately execute a batch for the manually started/resumed campaign
        let batchResult = null;
        try {
          batchResult = await processNextBatch(params.id, user.id, adminSupabase, { bypassWindow: true });
          console.log(`[CampaignAction] Manual run/resume result for campaign ${params.id}:`, batchResult);
        } catch (e: any) {
          console.error('[CampaignAction] Immediate batch error on resume/start:', e);
        }


        return NextResponse.json({
          success: true,
          status: 'running',
          batchResult,
        });
      }


      case 'pause': {
        if (campaign.status !== 'running' && campaign.status !== 'queued') {
          return NextResponse.json({ error: 'Can only pause running or queued campaigns' }, { status: 400 });
        }

        // Pause all queued entries in the queue
        await adminSupabase
          .from('email_queue')
          .update({ status: 'paused' })
          .eq('campaign_id', params.id)
          .eq('status', 'queued');

        const { error } = await supabase
          .from('bulk_campaigns')
          .update({
            status: 'paused',
            paused_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true, status: 'paused' });
      }

      case 'stop': {
        if (campaign.status !== 'running' && campaign.status !== 'paused' && campaign.status !== 'queued') {
          return NextResponse.json({ error: 'Can only stop active or paused campaigns' }, { status: 400 });
        }

        // Set queue items to failed / campaign stopped
        await adminSupabase
          .from('email_queue')
          .update({ status: 'failed', error: 'Campaign stopped by user' })
          .eq('campaign_id', params.id)
          .in('status', ['queued', 'paused', 'sending']);

        const { error } = await supabase
          .from('bulk_campaigns')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        if (error) throw error;

        // Cancel pending leads
        await adminSupabase
          .from('campaign_leads')
          .update({ status: 'skipped' })
          .eq('campaign_id', params.id)
          .eq('status', 'pending');

        return NextResponse.json({ success: true, status: 'cancelled' });
      }

      case 'duplicate': {
        // Clone campaign
        const { data: newCampaign, error: cloneError } = await supabase
          .from('bulk_campaigns')
          .insert({
            user_id: user.id,
            name: `${campaign.name} (Copy)`,
            status: 'draft',
            template_id: campaign.template_id,
            subject_override: campaign.subject_override,
            html_body_override: campaign.html_body_override,
            send_rate: campaign.send_rate,
            random_delay_min: campaign.random_delay_min,
            random_delay_max: campaign.random_delay_max,
            total_leads: campaign.total_leads,
          })
          .select()
          .single();

        if (cloneError) throw cloneError;

        // Clone settings
        await saveCampaignSettings(newCampaign.id, settings, user.id);

        // Clone leads
        const { data: existingLeads } = await supabase
          .from('campaign_leads')
          .select('lead_id, lead_email, lead_name, variables')
          .eq('campaign_id', params.id);

        if (existingLeads && existingLeads.length > 0) {
          await supabase.from('campaign_leads').insert(
            existingLeads.map((l: any) => ({
              campaign_id: newCampaign.id,
              lead_id: l.lead_id,
              lead_email: l.lead_email,
              lead_name: l.lead_name,
              variables: l.variables,
              status: 'pending',
            }))
          );
        }

        // Clone follow-up rules
        const { data: existingRules } = await supabase
          .from('campaign_followup_rules')
          .select('step_number, delay_days, rule_type, template_id, use_ai_generation')
          .eq('campaign_id', params.id);

        if (existingRules && existingRules.length > 0) {
          await supabase.from('campaign_followup_rules').insert(
            existingRules.map((r: any) => ({
              campaign_id: newCampaign.id,
              ...r,
            }))
          );
        }

        return NextResponse.json({ success: true, campaign: newCampaign });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Campaign action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
