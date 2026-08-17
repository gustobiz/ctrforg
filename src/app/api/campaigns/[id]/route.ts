import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getCampaignSettings, saveCampaignSettings, CampaignSettings } from '@/lib/campaigns/settings';
import { calculateNextEligibleSendTime, isDateInsideSendWindow } from '@/lib/gmail/schedule-utils';
import { updateBulkCampaignStats } from '@/lib/gmail/campaign-engine';

function getLeadEmail(lead: any): string {
  if (!lead) return '';
  let email = lead.email || lead.contact_email || '';
  if (!email && lead.ai_analysis) {
    let ai = lead.ai_analysis;
    if (typeof ai === 'string') {
      try { ai = JSON.parse(ai); } catch (e) {}
    }
    if (ai && typeof ai === 'object') {
      email = ai.contact_email || ai.email || '';
    }
  }
  return typeof email === 'string' ? email.trim() : '';
}

// GET /api/campaigns/[id] — Get single campaign with leads, rules, and settings
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign, error } = await supabase
      .from('bulk_campaigns')
      .select('*, email_templates(name, subject, html_body, text_body, category)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch campaign leads
    const { data: leads } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: true });

    // Fetch follow-up rules
    const { data: followupRules } = await supabase
      .from('campaign_followup_rules')
      .select('*')
      .eq('campaign_id', params.id)
      .order('step_number', { ascending: true });

    // Fetch merged campaign settings
    const settings = await getCampaignSettings(params.id);

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        send_window_start: settings.sendWindowStart,
        send_window_end: settings.sendWindowEnd,
        send_window_tz: settings.sendWindowTz,
        send_window_days: settings.sendWindowDays,
        schedule_mode: settings.scheduleMode,
        scheduled_at: settings.scheduledAt,
        lead_source_type: settings.leadSourceType,
        lead_source_id: settings.leadSourceId,
      },
      leads: leads || [],
      followupRules: (followupRules && followupRules.length > 0) ? followupRules : (settings.followupRules || []),
      settings,
    });
  } catch (error: any) {
    console.error('Campaign detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/campaigns/[id] — Safe Campaign Update
export async function PUT(
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

    const { data: currentCampaign, error: fetchErr } = await supabase
      .from('bulk_campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !currentCampaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Completed campaigns cannot have their history mutated
    if (currentCampaign.status === 'completed') {
      return NextResponse.json({
        error: 'Completed campaigns cannot be modified. You can duplicate this campaign to launch a new sequence.',
      }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      templateId,
      subjectOverride,
      htmlBodyOverride,
      sendRate,
      randomDelayMin,
      randomDelayMax,
      leadIds,
      followupRules,
      sendWindowStart,
      sendWindowEnd,
      sendWindowTz,
      sendWindowDays,
      scheduleMode,
      scheduledAt,
      leadSourceType,
      leadSourceId,
    } = body;

    console.log(`[CampaignEdit] Updating campaign ${params.id} (current status: ${currentCampaign.status})`);

    // 1. Update basic campaign configuration on bulk_campaigns
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (templateId !== undefined) updateData.template_id = templateId;
    if (subjectOverride !== undefined) updateData.subject_override = subjectOverride;
    if (htmlBodyOverride !== undefined) updateData.html_body_override = htmlBodyOverride;
    if (sendRate !== undefined) updateData.send_rate = sendRate;
    if (randomDelayMin !== undefined) updateData.random_delay_min = randomDelayMin;
    if (randomDelayMax !== undefined) updateData.random_delay_max = randomDelayMax;

    // 2. Persist updated campaign settings
    const existingSettings = await getCampaignSettings(params.id);
    const updatedSettings: Partial<CampaignSettings> = {
      ...existingSettings,
      ...(sendWindowStart !== undefined && { sendWindowStart }),
      ...(sendWindowEnd !== undefined && { sendWindowEnd }),
      ...(sendWindowTz !== undefined && { sendWindowTz }),
      ...(sendWindowDays !== undefined && { sendWindowDays: Array.isArray(sendWindowDays) ? sendWindowDays : [1, 2, 3, 4, 5] }),
      ...(scheduleMode !== undefined && { scheduleMode }),
      ...(scheduledAt !== undefined && { scheduledAt }),
      ...(leadSourceType !== undefined && { leadSourceType }),
      ...(leadSourceId !== undefined && { leadSourceId }),
      ...(followupRules !== undefined && { followupRules }),
    };

    await saveCampaignSettings(params.id, updatedSettings, user.id);

    const { data: updatedCampaign, error: updateError } = await supabase
      .from('bulk_campaigns')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 3. SAFE RECIPIENTS / LEADS EDITING:
    // Immutable historical sends: never delete leads that have already been sent, opened, clicked, or replied!
    if (leadIds !== undefined && Array.isArray(leadIds)) {
      // Fetch existing campaign leads
      const { data: existingLeads } = await supabase
        .from('campaign_leads')
        .select('*')
        .eq('campaign_id', params.id);

      const alreadySentLeadIds = new Set(
        (existingLeads || [])
          .filter(l => ['sent', 'opened', 'clicked', 'replied', 'bounced'].includes(l.status))
          .map(l => String(l.lead_id))
      );

      const pendingExistingLeadIds = new Set(
        (existingLeads || [])
          .filter(l => l.status === 'pending')
          .map(l => String(l.lead_id))
      );

      const requestedLeadIdsSet = new Set(leadIds.map(String));

      // Leads to remove: only pending leads that are no longer in requested list
      const leadsToRemove = Array.from(pendingExistingLeadIds).filter(id => !requestedLeadIdsSet.has(id));

      if (leadsToRemove.length > 0) {
        await supabase
          .from('campaign_leads')
          .delete()
          .eq('campaign_id', params.id)
          .eq('status', 'pending')
          .in('lead_id', leadsToRemove);

        await supabase
          .from('email_queue')
          .delete()
          .eq('campaign_id', params.id)
          .eq('status', 'queued')
          .in('lead_id', leadsToRemove);
      }

      // Leads to add: requested leads that are not in alreadySentLeadIds and not in pendingExistingLeadIds
      const newLeadIdsToAdd = Array.from(requestedLeadIdsSet).filter(
        id => !alreadySentLeadIds.has(id) && !pendingExistingLeadIds.has(id)
      );

      if (newLeadIdsToAdd.length > 0) {
        const { data: newLeadsData } = await supabase
          .from('crm_leads')
          .select('id, creator_name, email, contact_email, ai_analysis')
          .in('id', newLeadIdsToAdd);

        if (newLeadsData && newLeadsData.length > 0) {
          const validNewLeads = newLeadsData.filter(l => {
            const em = getLeadEmail(l);
            return em && em.includes('@');
          });

          const campaignLeadsToInsert = validNewLeads.map(l => ({
            campaign_id: params.id,
            lead_id: l.id,
            lead_name: l.creator_name,
            lead_email: getLeadEmail(l),
            status: 'pending',
            variables: {},
          }));

          await supabase.from('campaign_leads').insert(campaignLeadsToInsert);

          const windowConfig = {
            sendWindowStart: updatedSettings.sendWindowStart || '09:00',
            sendWindowEnd: updatedSettings.sendWindowEnd || '17:00',
            sendWindowTz: updatedSettings.sendWindowTz || 'UTC',
            sendWindowDays: updatedSettings.sendWindowDays || [1, 2, 3, 4, 5],
          };

          const nextSendTime = calculateNextEligibleSendTime(new Date(), windowConfig);

          const queueRowsToInsert = validNewLeads.map(l => ({
            user_id: user.id,
            campaign_id: params.id,
            lead_id: l.id,
            email: getLeadEmail(l),
            status: 'queued',
            scheduled_at: nextSendTime.toISOString(),
          }));

          await supabase.from('email_queue').insert(queueRowsToInsert);
        }
      }

      // Update total leads count
      const { count: totalCount } = await supabase
        .from('campaign_leads')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', params.id);

      await supabase
        .from('bulk_campaigns')
        .update({ total_leads: totalCount || 0 })
        .eq('id', params.id);
    }

    // 4. QUEUE RECALCULATION: If sending window or schedule was updated, recalculate queued items
    if (sendWindowStart || sendWindowEnd || sendWindowTz || sendWindowDays || scheduledAt) {
      const windowConfig = {
        sendWindowStart: updatedSettings.sendWindowStart || '09:00',
        sendWindowEnd: updatedSettings.sendWindowEnd || '17:00',
        sendWindowTz: updatedSettings.sendWindowTz || 'UTC',
        sendWindowDays: updatedSettings.sendWindowDays || [1, 2, 3, 4, 5],
      };

      const baseScheduleDate = (updatedSettings.scheduleMode === 'scheduled' && updatedSettings.scheduledAt)
        ? new Date(updatedSettings.scheduledAt)
        : new Date();

      const newQueueSendTime = calculateNextEligibleSendTime(baseScheduleDate, windowConfig);

      await supabase
        .from('email_queue')
        .update({
          scheduled_at: newQueueSendTime.toISOString(),
        })
        .eq('campaign_id', params.id)
        .eq('status', 'queued');
    }

    // 5. SAFE FOLLOW-UP RULES UPDATE
    if (followupRules !== undefined && Array.isArray(followupRules)) {
      await supabase.from('campaign_followup_rules').delete().eq('campaign_id', params.id);

      if (followupRules.length > 0) {
        const rules = followupRules.map((rule: any, i: number) => ({
          campaign_id: params.id,
          step_number: i + 1,
          delay_days: rule.delayDays || rule.delay_days || 3,
          rule_type: rule.ruleType || rule.rule_type || 'not_opened',
          template_id: rule.templateId || rule.template_id || null,
          use_ai_generation: rule.useAiGeneration !== false,
        }));

        await supabase.from('campaign_followup_rules').insert(rules);
      }
    }

    await updateBulkCampaignStats(adminSupabase, params.id);

    return NextResponse.json({
      success: true,
      campaign: {
        ...updatedCampaign,
        ...updatedSettings,
      },
    });
  } catch (error: any) {
    console.error('Campaign update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/campaigns/[id] — Delete campaign and cascade cleanups
export async function DELETE(
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

    // Clean up queues and associated records
    await adminSupabase.from('email_queue').delete().eq('campaign_id', params.id);
    await adminSupabase.from('campaign_leads').delete().eq('campaign_id', params.id);
    await adminSupabase.from('campaign_followup_rules').delete().eq('campaign_id', params.id);
    await adminSupabase.from('custom_variables').delete().eq('name', `campaign_meta_${params.id}`);

    const { error } = await supabase
      .from('bulk_campaigns')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Campaign delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
