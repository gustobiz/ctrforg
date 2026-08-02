import { createClient } from '@/lib/supabase/server';
import { sendEmail, interpolateVariables, injectTrackingPixel, rewriteLinksForTracking, htmlToPlainText } from './sender';
import { GmailLabelService } from './label-service';
import { appendSignatureToEmail, normalizeSignatureFromDb } from '../email/signature';

/**
 * Check if the current time in the target timezone falls within the campaign's allowed sending window and allowed days of week.
 */
export function isInsideSendWindow(campaign: any): boolean {
  if (!campaign.send_window_start || !campaign.send_window_end) return true;
  try {
    const tz = campaign.send_window_tz || 'UTC';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short'
    });
    const parts = formatter.formatToParts(now);
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const weekdayStr = parts.find(p => p.type === 'weekday')?.value || 'Mon';
    
    const dayMap: Record<string, number> = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
    const currentDay = dayMap[weekdayStr] || 1;

    let allowedDays = campaign.send_window_days || [1, 2, 3, 4, 5];
    if (typeof allowedDays === 'string') {
      try { allowedDays = JSON.parse(allowedDays); } catch (e) {}
    }
    if (Array.isArray(allowedDays) && !allowedDays.includes(currentDay)) {
      return false;
    }

    const currentTimeStr = `${hour}:${minute}`;
    if (currentTimeStr < campaign.send_window_start || currentTimeStr > campaign.send_window_end) {
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * Recalculate all campaign stats and update the bulk_campaigns table
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
    const remaining = stats.filter((s: any) => s.status === 'pending').length;

    await supabase
      .from('bulk_campaigns')
      .update({
        sent_count: sentCount,
        opened_count: openedCount,
        clicked_count: clickedCount,
        replied_count: repliedCount,
        bounced_count: bouncedCount,
        updated_at: new Date().toISOString(),
        ...(remaining === 0 ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', campaignId);
  }
}

/**
 * Process the next batch of emails for a running campaign.
 * Returns how many were sent in this batch.
 */
export async function processNextBatch(campaignId: string, userId: string): Promise<{
  sent: number;
  remaining: number;
  completed: boolean;
  errors: string[];
}> {
  const supabase = await createClient();

  // Get campaign with template
  const { data: campaign, error: campError } = await supabase
    .from('bulk_campaigns')
    .select('*, email_templates(subject, html_body, text_body)')
    .eq('id', campaignId)
    .eq('user_id', userId)
    .single();

  if (campError || !campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status !== 'running') {
    return { sent: 0, remaining: 0, completed: false, errors: ['Campaign is not running'] };
  }

  // Check Priority 4 Sending Window before processing batch
  if (!isInsideSendWindow(campaign)) {
    return {
      sent: 0,
      remaining: 0,
      completed: false,
      errors: [`Current time is outside the allowed sending window (${campaign.send_window_start} - ${campaign.send_window_end} ${campaign.send_window_tz || 'UTC'}).`]
    };
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
    return {
      sent: 0,
      remaining: 0,
      completed: false,
      errors: [`Gmail daily sending limit of ${GMAIL_DAILY_LIMIT} reached for today.`],
    };
  }

  const maxAllowedInBatch = Math.max(0, GMAIL_DAILY_LIMIT - currentSentToday);
  const baseBatchSize = Math.min(Math.ceil((campaign.send_rate || 20) / 6), 10);
  const batchSize = Math.min(baseBatchSize, maxAllowedInBatch);

  if (batchSize === 0) {
    return { sent: 0, remaining: 0, completed: false, errors: ['Gmail daily limit exceeded for this batch.'] };
  }

  // Get pending entries from email_queue
  const { data: queueItems, error: queueError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true })
    .limit(batchSize);

  if (queueError) throw queueError;

  if (!queueItems || queueItems.length === 0) {
    await supabase
      .from('bulk_campaigns')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    return { sent: 0, remaining: 0, completed: true, errors: [] };
  }

  const leadIds = queueItems.map(q => q.lead_id);
  const { data: crmLeads } = await supabase
    .from('crm_leads')
    .select('*')
    .in('id', leadIds);
  const crmLeadsMap = new Map(crmLeads?.map(l => [l.id, l]) || []);

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
      await supabase
        .from('email_queue')
        .update({ status: 'sending' })
        .eq('id', queueItem.id);

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
        throw new Error('Failed to create email campaign record');
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
        console.error('Gmail labeling failed (non-blocking):', labelErr);
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

      const { data: rules } = await supabase
        .from('campaign_followup_rules')
        .select('*')
        .eq('campaign_id', campaignId);

      if (rules && rules.length > 0) {
        const followupItems = rules.map((rule: any) => {
          const scheduledAt = new Date();
          scheduledAt.setDate(scheduledAt.getDate() + rule.delay_days);

          return {
            user_id: userId,
            lead_id: queueItem.lead_id,
            campaign_id: emailCampaign.id,
            rule_type: rule.rule_type,
            delay_days: rule.delay_days,
            followup_number: rule.step_number,
            status: 'pending',
            scheduled_at: scheduledAt.toISOString(),
          };
        });

        await supabase.from('followup_sequences').insert(followupItems);
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
      console.error(`Failed to send to ${queueItem.email}:`, err);
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

  return {
    sent,
    remaining,
    completed: remaining === 0,
    errors,
  };
}
