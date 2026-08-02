import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST /api/campaigns/[id]/action — Campaign actions
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

    switch (action) {
      case 'start': {
        if (campaign.status !== 'draft' && campaign.status !== 'paused') {
          return NextResponse.json({ error: `Cannot start campaign with status "${campaign.status}"` }, { status: 400 });
        }

        // Create queue entries for all pending leads in the campaign if they don't exist
        const { data: campaignLeads } = await supabase
          .from('campaign_leads')
          .select('lead_id, lead_email')
          .eq('campaign_id', params.id)
          .eq('status', 'pending');

        if (campaignLeads && campaignLeads.length > 0) {
          // Fetch existing queue items for this campaign to avoid duplicates
          const { data: existingQueue } = await supabase
            .from('email_queue')
            .select('lead_id')
            .eq('campaign_id', params.id);

          const existingLeadIds = new Set(existingQueue?.map((q: any) => q.lead_id) || []);

          const newQueueItems = campaignLeads
            .filter((l: any) => l.lead_email && !existingLeadIds.has(l.lead_id))
            .map((l: any) => ({
              user_id: user.id,
              campaign_id: params.id,
              lead_id: l.lead_id,
              email: l.lead_email,
              status: 'queued',
              scheduled_at: new Date().toISOString(),
            }));

          if (newQueueItems.length > 0) {
            const { error: queueInsertError } = await supabase
              .from('email_queue')
              .insert(newQueueItems);
            
            if (queueInsertError) throw queueInsertError;
          }
        }

        // Also resume any paused entries
        await supabase
          .from('email_queue')
          .update({ status: 'queued' })
          .eq('campaign_id', params.id)
          .eq('status', 'paused');

        const { error } = await supabase
          .from('bulk_campaigns')
          .update({
            status: 'running',
            started_at: campaign.started_at || new Date().toISOString(),
            paused_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true, status: 'running' });
      }

      case 'pause': {
        if (campaign.status !== 'running') {
          return NextResponse.json({ error: 'Can only pause running campaigns' }, { status: 400 });
        }

        // Pause all queued entries in the queue
        await supabase
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

      case 'resume': {
        if (campaign.status !== 'paused') {
          return NextResponse.json({ error: 'Can only resume paused campaigns' }, { status: 400 });
        }

        // Set all paused queue entries back to queued
        await supabase
          .from('email_queue')
          .update({ status: 'queued' })
          .eq('campaign_id', params.id)
          .eq('status', 'paused');

        const { error } = await supabase
          .from('bulk_campaigns')
          .update({
            status: 'running',
            paused_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);

        if (error) throw error;
        return NextResponse.json({ success: true, status: 'running' });
      }

      case 'stop': {
        if (campaign.status !== 'running' && campaign.status !== 'paused') {
          return NextResponse.json({ error: 'Can only stop running or paused campaigns' }, { status: 400 });
        }

        // Set queue items to failed / campaign stopped
        await supabase
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
        await supabase
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
