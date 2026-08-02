import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, interpolateVariables, injectTrackingPixel, rewriteLinksForTracking, htmlToPlainText } from '@/lib/gmail/sender';
import { GmailLabelService } from '@/lib/gmail/label-service';
import { appendSignatureToEmail, normalizeSignatureFromDb } from '@/lib/email/signature';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      leadId,
      toEmail,
      subject,
      htmlBody,
      textBody,
      templateId,
      variables,
      threadId, // For follow-ups
      isFollowup = false,
      followupNumber = 0,
      parentCampaignId,
      disableSignature = false,
    } = body;

    if (!toEmail || !subject || !htmlBody) {
      return NextResponse.json({ error: 'Missing required fields: toEmail, subject, htmlBody' }, { status: 400 });
    }

    // Fetch lead details if leadId is provided
    let crmLead: any = null;
    if (leadId) {
      const { data: lead } = await supabase
        .from('crm_leads')
        .select('*')
        .eq('id', leadId)
        .maybeSingle();
      crmLead = lead;
    }

    const leadName = crmLead?.creator_name || toEmail?.split('@')[0] || '';
    const firstName = leadName.split(' ')[0] || '';
    const lastName = leadName.split(' ').slice(1).join(' ') || '';
    const resolvedEmail = toEmail || crmLead?.email || crmLead?.contact_email || '';

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
      email: resolvedEmail,
      Email: resolvedEmail,
      contact_email: resolvedEmail,
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
      ...(variables || {}),
    };

    const processedSubject = interpolateVariables(subject, vars);
    let processedHtml = interpolateVariables(htmlBody, vars);
    let processedText = textBody
      ? interpolateVariables(textBody, vars)
      : htmlToPlainText(processedHtml);

    // Fetch user signature and append automatically if enabled
    if (!disableSignature) {
      const { data: sigRow } = await supabase
        .from('user_signatures')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (sigRow) {
        const signature = normalizeSignatureFromDb(sigRow);
        const appended = appendSignatureToEmail({
          htmlBody: processedHtml,
          textBody: processedText,
          signature,
          disableSignature,
        });
        processedHtml = appended.html;
        if (appended.text) {
          processedText = appended.text;
        }
      }
    }

    // Create campaign record first (to get ID for tracking)
    const { data: campaign, error: campaignError } = await supabase
      .from('email_campaigns')
      .insert({
        user_id: user.id,
        lead_id: leadId || null,
        template_id: templateId || null,
        to_email: toEmail,
        subject: processedSubject,
        html_body: processedHtml,
        text_body: processedText,
        status: 'draft',
        is_followup: isFollowup,
        followup_number: followupNumber,
        parent_campaign_id: parentCampaignId || null,
      })
      .select()
      .single();

    if (campaignError || !campaign) {
      console.error('Failed to create campaign record:', campaignError);
      return NextResponse.json({ error: 'Failed to create email campaign record' }, { status: 500 });
    }

    // Inject tracking pixel and rewrite links
    processedHtml = injectTrackingPixel(processedHtml, campaign.id);
    processedHtml = rewriteLinksForTracking(processedHtml, campaign.id);

    let parentGmailMessageId: string | undefined;
    if (parentCampaignId) {
      const { data: parentCampaign } = await supabase
        .from('email_campaigns')
        .select('gmail_message_id')
        .eq('id', parentCampaignId)
        .maybeSingle();
      if (parentCampaign) {
        parentGmailMessageId = parentCampaign.gmail_message_id;
      }
    }

    // Send via Gmail API
    const result = await sendEmail({
      userId: user.id,
      to: toEmail,
      subject: processedSubject,
      htmlBody: processedHtml,
      textBody: processedText,
      threadId,
      parentGmailMessageId,
    });

    // Update campaign with Gmail IDs and status
    await supabase
      .from('email_campaigns')
      .update({
        gmail_message_id: result.messageId,
        gmail_thread_id: result.threadId,
        status: 'sent',
        sent_at: new Date().toISOString(),
        html_body: processedHtml, // Update with tracked version
      })
      .eq('id', campaign.id);

    // Apply automatic Gmail labels
    try {
      const labelIds = await GmailLabelService.ensureCampaignLabels(user.id, 'Outreach');
      if (labelIds.length > 0) {
        if (result.messageId) {
          await GmailLabelService.applyLabelToMessage(user.id, result.messageId, labelIds);
        }
        if (result.threadId) {
          await GmailLabelService.applyLabelToThread(user.id, result.threadId, labelIds);
        }
      }
    } catch (labelErr) {
      console.error('Email send labeling error (non-blocking):', labelErr);
    }

    // Create follow-up sequences for the initial send
    if (!isFollowup) {
      const now = new Date();
      const followupRules = [
        {
          rule_type: 'not_opened',
          delay_days: 3,
          followup_number: 1,
          scheduled_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          rule_type: 'opened_not_clicked',
          delay_days: 4,
          followup_number: 2,
          scheduled_at: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          rule_type: 'clicked_not_replied',
          delay_days: 5,
          followup_number: 3,
          scheduled_at: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ];

      await supabase.from('followup_sequences').insert(
        followupRules.map((rule) => ({
          user_id: user.id,
          lead_id: leadId,
          campaign_id: campaign.id,
          ...rule,
          status: 'pending',
        }))
      );
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      messageId: result.messageId,
      threadId: result.threadId,
    });
  } catch (error: any) {
    console.error('Email send error:', error);
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 });
  }
}
