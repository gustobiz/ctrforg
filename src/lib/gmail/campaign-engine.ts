import { createClient, createAdminClient } from '@/lib/supabase/server';
import { sendEmail, interpolateVariables, injectTrackingPixel, rewriteLinksForTracking, htmlToPlainText } from './sender';
import { GmailLabelService } from './label-service';
import { appendSignatureToEmail, normalizeSignatureFromDb } from '../email/signature';
import { isDateInsideSendWindow, calculateFollowupScheduledTime } from './schedule-utils';
import { getCampaignSettings, CampaignSettings } from '@/lib/campaigns/settings';

/**
 * Check if the current time in the target timezone falls within the campaign's allowed sending window and allowed days of week.
 */
export function isInsideSendWindow(campaign: any, settings?: Partial<CampaignSettings>): boolean {
  if (!campaign && !settings) return true;
  return isDateInsideSendWindow(new Date(), {
    sendWindowStart: settings?.sendWindowStart || campaign?.send_window_start || '09:00',
    sendWindowEnd: settings?.sendWindowEnd || campaign?.send_window_end || '17:00',
    sendWindowTz: settings?.sendWindowTz || campaign?.send_window_tz || 'UTC',
    sendWindowDays: settings?.sendWindowDays || campaign?.send_window_days || [1, 2, 3, 4, 5],
  });
}

/**
 * Recalculate all campaign stats and update the bulk_campaigns table.
 * Preserves campaign lifecycle accurately (does not prematurely complete if queue items or follow-ups are pending).
 */
export async function updateBulkCampaignStats(supabase: any, campaignId: string): Promise<void> {
  const { data: stats } = await supabase
    .from('campaign_leads')
    .select('status')
    .eq('campaign_id', campaignId);

  if (stats) {
    const sentCount = stats.filter((s: any) => ['sent', 'opened', 'clicked', 'replied'].includes(s.status)).length;
    const openedCount = stats.filter((s: any) => ['opened', 'clicked', 'replied'].includes(s.status)).length;
    const clickedCount = stats.filter((s: any) => ['clicked', 'replied'].includes(s.status)).length;
    const repliedCount = stats.filter((s: any) => s.status === 'replied').length;
    const bouncedCount = stats.filter((s: any) => s.status === 'bounced').length;
    const pendingLeads = stats.filter((s: any) => s.status === 'pending').length;

    // Check if any queue items or followups remain
    const { count: queueCount } = await supabase
      .from('email_queue')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'sending']);

    const remainingQueue = queueCount || 0;
    const isFullyFinished = pendingLeads === 0 && remainingQueue === 0;

    await supabase
      .from('bulk_campaigns')
      .update({
        sent_count: sentCount,
        opened_count: openedCount,
        clicked_count: clickedCount,
        replied_count: repliedCount,
        bounced_count: bouncedCount,
        updated_at: new Date().toISOString(),
        ...(isFullyFinished ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', campaignId);
  }
}

/**
 * Process the next batch of emails for a running or due campaign.
 * Returns how many were sent in this batch.
 */
export async function processNextBatch(
  campaignId: string,
  userId: string,
  passedSupabase?: any,
  options?: { bypassWindow?: boolean }
): Promise<{
  sent: number;
  remaining: number;
  completed: boolean;
  errors: string[];
}> {
  // Use admin client to ensure background worker & cron execution bypasses cookie RLS
  const supabase = passedSupabase || createAdminClient();

  console.log(`[CampaignEngine] Starting batch processing for campaign: ${campaignId}, user: ${userId}`);

  // Fetch campaign with template
  const { data: campaign, error: campError } = await supabase
    .from('bulk_campaigns')
    .select('*, email_templates(subject, html_body, text_body)')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single();

  if (campError || !campaign) {
    console.error(`[CampaignEngine] Campaign ${campaignId} not found:`, campError);
    throw new Error('Campaign not found');
  }

  // Load merged settings (sending window, timezone, allowed days, scheduleMode)
  const settings = await getCampaignSettings(campaignId);

  // If campaign is 'paused', 'draft', or 'cancelled', check if it's eligible to run
  if (['draft', 'paused', 'cancelled'].includes(campaign.status)) {
    console.log(`[CampaignEngine] Campaign ${campaignId} is in status "${campaign.status}", skipping.`);
    return { sent: 0, remaining: 0, completed: false, errors: [`Campaign is ${campaign.status}`] };
  }

  // Check Sending Window:
  // Immediate launches and manual runs explicitly start immediately at current time.
  const isImmediate = Boolean(options?.bypassWindow || settings?.scheduleMode === 'immediate' || campaign.schedule_mode === 'immediate');
  const inWindow = isImmediate || isInsideSendWindow(campaign, settings);

  if (!inWindow) {
    const tz = settings.sendWindowTz || campaign.send_window_tz || 'UTC';
    const start = settings.sendWindowStart || campaign.send_window_start || '09:00';
    const end = settings.sendWindowEnd || campaign.send_window_end || '17:00';
    const msg = `Current time is outside the allowed sending window (${start} - ${end} ${tz}).`;
    console.log(`[CampaignEngine] Campaign ${campaignId}: ${msg}`);
    return {
      sent: 0,
      remaining: 0,
      completed: false,
      errors: [msg],
    };
  }

  // If campaign was 'queued' or 'scheduled' and is now executing, promote to 'running'
  if (campaign.status === 'scheduled' || campaign.status === 'queued') {
    await supabase
      .from('bulk_campaigns')
      .update({
        status: 'running',
        started_at: campaign.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);
    campaign.status = 'running';
  }

  // Respect Gmail daily limits (limit to 500 sends per day across all campaigns)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count: sentToday } = await supabase
    .from('email_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('sent_at', startOfDay.toISOString());

  const GMAIL_DAILY_LIMIT = 500;
  const currentSentToday = sentToday || 0;

  if (currentSentToday >= GMAIL_DAILY_LIMIT) {
    const limitErr = `Gmail daily sending limit of ${GMAIL_DAILY_LIMIT} reached for today.`;
    console.warn(`[CampaignEngine] User ${userId}: ${limitErr}`);
    return {
      sent: 0,
      remaining: 0,
      completed: false,
      errors: [limitErr],
    };
  }

  const maxAllowedInBatch = Math.max(0, GMAIL_DAILY_LIMIT - currentSentToday);
  const baseBatchSize = Math.min(Math.ceil((campaign.send_rate || 20) / 6), 10);
  const batchSize = Math.min(baseBatchSize, maxAllowedInBatch);

  if (batchSize === 0) {
    return { sent: 0, remaining: 0, completed: false, errors: ['Gmail daily limit exceeded for this batch.'] };
  }

  // Get pending entries from email_queue due for sending
  const nowIso = new Date().toISOString();
  let queueQuery = supabase
    .from('email_queue')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued');

  if (!isImmediate) {
    queueQuery = queueQuery.lte('scheduled_at', nowIso);
  }

  const { data: queueItems, error: queueError } = await queueQuery
    .order('scheduled_at', { ascending: true })
    .limit(batchSize);


  if (queueError) {
    console.error(`[CampaignEngine] Error fetching queue for campaign ${campaignId}:`, queueError);
    throw queueError;
  }

  if (!queueItems || queueItems.length === 0) {
    // Check if there are any remaining queued or sending items in the queue
    const { count: pendingQueueCount } = await supabase
      .from('email_queue')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'sending']);

    const pendingTotal = pendingQueueCount || 0;
    if (pendingTotal > 0) {
      console.log(`[CampaignEngine] Campaign ${campaignId} has ${pendingTotal} future queued items. Waiting for schedule.`);
      return { sent: 0, remaining: pendingTotal, completed: false, errors: [] };
    }

    // Check if there are pending leads that haven't been queued yet
    const { data: unqueuedLeads } = await supabase
      .from('campaign_leads')
      .select('lead_id, lead_email')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(10);

    if (unqueuedLeads && unqueuedLeads.length > 0) {
      console.log(`[CampaignEngine] Enqueuing ${unqueuedLeads.length} unqueued pending leads for campaign ${campaignId}`);
      const newQueueRows = unqueuedLeads
        .filter((l: any) => l.lead_email && l.lead_email.includes('@'))
        .map((l: any) => ({
          user_id: userId,
          campaign_id: campaignId,
          lead_id: l.lead_id,
          email: l.lead_email,
          status: 'queued',
          scheduled_at: new Date().toISOString(),
        }));

      if (newQueueRows.length > 0) {
        await supabase.from('email_queue').insert(newQueueRows);
        // Process next batch immediately with newly queued leads
        return processNextBatch(campaignId, userId, supabase);
      }
    }

    await supabase
      .from('bulk_campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    console.log(`[CampaignEngine] Campaign ${campaignId} completed! All items dispatched.`);
    return { sent: 0, remaining: 0, completed: true, errors: [] };
  }

  const leadIds = (queueItems as any[]).map((q: any) => q.lead_id);
  const { data: crmLeads } = await supabase
    .from('crm_leads')
    .select('*')
    .in('id', leadIds);
  const crmLeadsMap = new Map((crmLeads as any[] | null)?.map((l: any) => [l.id, l]) || []);

  // Fetch user signature for automatic appending
  const { data: userSig } = await supabase
    .from('user_signatures')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const subject = campaign.subject_override || campaign.email_templates?.subject || 'Hello';
  const htmlBody = campaign.html_body_override || campaign.email_templates?.html_body || '';
  const textBody = campaign.email_templates?.text_body || '';

  let sent = 0;
  const errors: string[] = [];

  for (const queueItem of queueItems) {
    try {
      // 1. ATOMIC LOCKING: Claim queue item to prevent duplicate execution from parallel workers
      const { data: claimedRows, error: claimErr } = await supabase
        .from('email_queue')
        .update({ status: 'sending' })
        .eq('id', queueItem.id)
        .eq('status', 'queued')
        .select();

      if (claimErr || !claimedRows || claimedRows.length === 0) {
        console.log(`[CampaignEngine] Queue item ${queueItem.id} already claimed by another worker. Skipping.`);
        continue;
      }

      // 2. IDEMPOTENCY CHECK: Verify this lead has not already been sent this campaign email
      const { data: existingLeadRecord } = await supabase
        .from('campaign_leads')
        .select('status, email_campaign_id')
        .eq('campaign_id', campaignId)
        .eq('lead_id', queueItem.lead_id)
        .maybeSingle();

      if (existingLeadRecord && ['sent', 'opened', 'clicked', 'replied'].includes(existingLeadRecord.status)) {
        console.warn(`[CampaignEngine] Lead ${queueItem.lead_id} already has status "${existingLeadRecord.status}". Skipping duplicate send.`);
        await supabase
          .from('email_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', queueItem.id);
        continue;
      }

      const crmLead = crmLeadsMap.get(queueItem.lead_id);
      const leadName = crmLead?.creator_name || queueItem.email?.split('@')[0] || '';
      const firstName = leadName.split(' ')[0] || '';
      const lastName = leadName.split(' ').slice(1).join(' ') || '';
      const leadEmail = queueItem.email || crmLead?.email || crmLead?.contact_email || crmLead?.ai_analysis?.contact_email || '';

      const vars: Record<string, any> = {
        name: leadName,
        creator_name: leadName,
        creatorname: leadName,
        Name: leadName,
        first_name: firstName,
        firstname: firstName,
        FirstName: firstName,
        last_name: lastName,
        lastname: lastName,
        LastName: lastName,
        email: leadEmail,
        Email: leadEmail,
        contact_email: leadEmail,
        channel_name: crmLead?.channel_name || '',
        channelname: crmLead?.channel_name || '',
        ChannelName: crmLead?.channel_name || '',
        subscriber_count: String(crmLead?.subscriber_count ?? '0'),
        subscribercount: String(crmLead?.subscriber_count ?? '0'),
        SubscriberCount: String(crmLead?.subscriber_count ?? '0'),
        video_title: crmLead?.video_title || '',
        videotitle: crmLead?.video_title || '',
        VideoTitle: crmLead?.video_title || '',
        latest_video: crmLead?.video_title || '',
        latestvideo: crmLead?.video_title || '',
        LatestVideo: crmLead?.video_title || '',
        video_url: crmLead?.video_url || '',
        videourl: crmLead?.video_url || '',
        VideoUrl: crmLead?.video_url || '',
        niche: crmLead?.ai_analysis?.creator_niche || crmLead?.creator_niche || '',
        Niche: crmLead?.ai_analysis?.creator_niche || crmLead?.creator_niche || '',
        notes: crmLead?.notes || crmLead?.ai_analysis?.notes || '',
        ...(crmLead || {}),
        ...(crmLead?.ai_analysis && typeof crmLead.ai_analysis === 'object' ? crmLead.ai_analysis : {}),
      };

      const processedSubject = interpolateVariables(subject, vars);
      let processedHtml = interpolateVariables(htmlBody, vars);
      let processedText = textBody
        ? interpolateVariables(textBody, vars)
        : htmlToPlainText(processedHtml);

      if (userSig) {
        const normalizedSig = normalizeSignatureFromDb(userSig);
        const appended = appendSignatureToEmail({
          htmlBody: processedHtml,
          textBody: processedText,
          signature: normalizedSig,
        });
        processedHtml = appended.html;
        if (appended.text) {
          processedText = appended.text;
        }
      }

      console.log(`[CampaignEngine] Attempting send to ${queueItem.email} for campaign ${campaignId}`);

      const { data: emailCampaign, error: ecError } = await supabase
        .from('email_campaigns')
        .insert({
          user_id: userId,
          lead_id: queueItem.lead_id,
          template_id: campaign.template_id,
          to_email: queueItem.email,
          subject: processedSubject,
          html_body: processedHtml,
          text_body: processedText,
          status: 'draft',
          is_followup: false,
          followup_number: 0,
        })
        .select()
        .single();

      if (ecError || !emailCampaign) {
        throw new Error(`Failed to create email campaign record: ${ecError?.message}`);
      }

      processedHtml = injectTrackingPixel(processedHtml, emailCampaign.id);
      processedHtml = rewriteLinksForTracking(processedHtml, emailCampaign.id);

      const result = await sendEmail({
        userId,
        to: queueItem.email,
        subject: processedSubject,
        htmlBody: processedHtml,
        textBody: processedText,
      });

      console.log(`[CampaignEngine] Send SUCCESS to ${queueItem.email}. MessageId: ${result.messageId}, ThreadId: ${result.threadId}`);

      await supabase
        .from('email_campaigns')
        .update({
          gmail_message_id: result.messageId,
          gmail_thread_id: result.threadId,
          status: 'sent',
          sent_at: new Date().toISOString(),
          html_body: processedHtml,
        })
        .eq('id', emailCampaign.id);

      // Apply automatic Gmail labels (CTRForge, CTRForge/Campaigns, CTRForge/Campaigns/{Campaign Name})
      try {
        const campaignName = campaign.name || 'Outreach';
        const labelIds = await GmailLabelService.ensureCampaignLabels(userId, campaignName);
        if (labelIds.length > 0) {
          if (result.messageId) {
            await GmailLabelService.applyLabelToMessage(userId, result.messageId, labelIds);
          }
          if (result.threadId) {
            await GmailLabelService.applyLabelToThread(userId, result.threadId, labelIds);
          }
        }
        if (!campaign.gmail_label_id) {
          const campaignLabelObj = await GmailLabelService.getOrCreateLabel(userId, `CTRForge/Campaigns/${campaignName}`);
          if (campaignLabelObj?.id) {
            await supabase
              .from('bulk_campaigns')
              .update({
                gmail_label_id: campaignLabelObj.id,
              })
              .eq('id', campaignId);
          }
        }
      } catch (labelErr) {
        console.error('[CampaignEngine] Gmail labeling failed (non-blocking):', labelErr);
      }

      await supabase
        .from('campaign_leads')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          email_campaign_id: emailCampaign.id,
        })
        .eq('campaign_id', campaignId)
        .eq('lead_id', queueItem.lead_id);

      await supabase
        .from('crm_leads')
        .update({
          status: 'contacted',
        })
        .eq('id', queueItem.lead_id);

      // Create follow-up sequence rules
      const { data: rules } = await supabase
        .from('campaign_followup_rules')
        .select('*')
        .eq('campaign_id', campaignId);

      const followupRulesList = (rules && rules.length > 0) ? rules : (settings.followupRules || []);

      if (followupRulesList && followupRulesList.length > 0) {
        const windowConfig = {
          sendWindowStart: settings.sendWindowStart || campaign.send_window_start || '09:00',
          sendWindowEnd: settings.sendWindowEnd || campaign.send_window_end || '17:00',
          sendWindowTz: settings.sendWindowTz || campaign.send_window_tz || 'UTC',
          sendWindowDays: settings.sendWindowDays || campaign.send_window_days || [1, 2, 3, 4, 5],
        };

        const followupItems = followupRulesList.map((rule: any, idx: number) => {
          const scheduledAtDate = calculateFollowupScheduledTime({
            previousStepSentAt: new Date(),
            delayDays: rule.delay_days || rule.delayDays || 3,
            sendTime: rule.send_time || rule.sendTime || '10:00',
            sendTimeTz: rule.send_time_tz || rule.sendTimeTz || windowConfig.sendWindowTz,
            campaignWindowConfig: windowConfig,
          });

          return {
            user_id: userId,
            lead_id: queueItem.lead_id,
            campaign_id: emailCampaign.id,
            rule_type: rule.rule_type || rule.ruleType || 'not_opened',
            delay_days: rule.delay_days || rule.delayDays || 3,
            followup_number: rule.step_number || rule.stepNumber || (idx + 1),
            status: 'pending',
            scheduled_at: scheduledAtDate.toISOString(),
          };
        });

        await supabase.from('followup_sequences').insert(followupItems);
        console.log(`[CampaignEngine] Created ${followupItems.length} follow-up steps for lead ${queueItem.lead_id}`);
      }

      await supabase
        .from('email_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', queueItem.id);

      sent++;

      if (campaign.random_delay_min > 0 && sent < queueItems.length) {
        const minSec = campaign.random_delay_min || 30;
        const maxSec = campaign.random_delay_max || 120;
        const delayMs = (minSec + Math.random() * (maxSec - minSec)) * 1000;
        await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 5000)));
      }
    } catch (err: any) {
      console.error(`[CampaignEngine] Failed to send to ${queueItem.email}:`, err);
      errors.push(`${queueItem.email}: ${err.message}`);

      await supabase
        .from('email_queue')
        .update({
          status: 'failed',
          error: err.message,
        })
        .eq('id', queueItem.id);

      await supabase
        .from('campaign_leads')
        .update({ status: 'bounced' })
        .eq('campaign_id', campaignId)
        .eq('lead_id', queueItem.lead_id);
    }
  }

  await updateBulkCampaignStats(supabase, campaignId);

  const { count: remainingCount } = await supabase
    .from('email_queue')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('status', 'queued');

  const remaining = remainingCount || 0;

  console.log(`[CampaignEngine] Batch finished for campaign ${campaignId}. Sent: ${sent}, Remaining: ${remaining}, Errors: ${errors.length}`);

  return {
    sent,
    remaining,
    completed: remaining === 0,
    errors,
  };
}
