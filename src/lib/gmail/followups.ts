import { createClient } from '@/lib/supabase/server';
import { sendEmail, interpolateVariables, injectTrackingPixel, rewriteLinksForTracking, htmlToPlainText } from './sender';
import { GmailLabelService } from './label-service';
import { appendSignatureToEmail, normalizeSignatureFromDb } from '../email/signature';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MAX_FOLLOWUPS = 3;

/**
 * Evaluate follow-up rules and find due follow-ups
 */
export async function evaluateFollowUpRules(userId: string): Promise<{
  dueFollowUps: any[];
  cancelledCount: number;
}> {
  const supabase = await createClient();

  const now = new Date();
  let cancelledCount = 0;

  // Get all pending follow-ups that are due
  const { data: pendingFollowUps } = await supabase
    .from('followup_sequences')
    .select('*, email_campaigns(*)')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lte('scheduled_at', now.toISOString())
    .order('scheduled_at', { ascending: true });

  if (!pendingFollowUps || pendingFollowUps.length === 0) {
    return { dueFollowUps: [], cancelledCount: 0 };
  }

  const dueFollowUps: any[] = [];

  for (const followup of pendingFollowUps) {
    const campaign = followup.email_campaigns;
    if (!campaign) continue;

    // Rule D: Replied → stop all automation
    if (campaign.status === 'replied') {
      await supabase
        .from('followup_sequences')
        .update({ status: 'cancelled' })
        .eq('id', followup.id);
      cancelledCount++;
      continue;
    }

    // Check if max follow-ups exceeded
    if (followup.followup_number > MAX_FOLLOWUPS) {
      await supabase
        .from('followup_sequences')
        .update({ status: 'skipped' })
        .eq('id', followup.id);
      continue;
    }

    // Evaluate rules based on current campaign state
    let shouldSend = false;

    switch (followup.rule_type) {
      case 'not_opened':
        // Rule A: Sent but not opened → send after 3 days
        shouldSend = campaign.status === 'sent' && campaign.total_opens === 0;
        break;

      case 'opened_not_clicked':
        // Rule B: Opened but not clicked → send after 4 days
        shouldSend = campaign.status === 'opened' && campaign.total_clicks === 0;
        break;

      case 'clicked_not_replied':
        // Rule C: Clicked but not replied → send after 5 days
        shouldSend = campaign.status === 'clicked';
        break;
    }

    if (shouldSend) {
      dueFollowUps.push(followup);
    } else {
      // Condition no longer applies (e.g., they opened so 'not_opened' rule is skipped)
      await supabase
        .from('followup_sequences')
        .update({ status: 'skipped' })
        .eq('id', followup.id);
    }
  }

  return { dueFollowUps, cancelledCount };
}

/**
 * Generate AI-powered follow-up content using Gemini
 */
export async function generateFollowUpContent(params: {
  creatorName: string;
  previousSubject: string;
  previousBody: string;
  channelInfo?: string;
  leadNotes?: string;
  ruleType: string;
  followupNumber: number;
}): Promise<{ subject: string; htmlBody: string }> {
  const ruleContext = {
    not_opened: 'The original email was not opened. Write a shorter, more intriguing subject line and a brief follow-up.',
    opened_not_clicked: 'They opened the email but didn\'t click any links. Reference the value proposition more directly.',
    clicked_not_replied: 'They clicked links but haven\'t replied. They\'re interested — make the ask very clear and easy.',
  };

  const prompt = `You are an elite outreach copywriter for a YouTube thumbnail and title optimization agency called CTRForge.

Write a follow-up email (follow-up #${params.followupNumber}) for a creator named "${params.creatorName}".

Context:
- ${ruleContext[params.ruleType as keyof typeof ruleContext] || 'Follow up on previous outreach.'}
- Previous email subject: "${params.previousSubject}"
- Channel info: ${params.channelInfo || 'YouTube creator'}
- Notes: ${params.leadNotes || 'No additional notes'}

Rules:
- Keep it concise (under 120 words)
- Don't be pushy or salesy
- Reference the previous email naturally
- Include a clear call-to-action
- Sound human, not automated
- Use a conversational, professional tone

Return a JSON object with:
{
  "subject": "Re: <follow-up subject line>",
  "htmlBody": "<html email body with basic formatting>"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Gemini API request failed');
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text);

    return {
      subject: parsed.subject || `Re: ${params.previousSubject}`,
      htmlBody: parsed.htmlBody || `<p>Hi ${params.creatorName},</p><p>Just following up on my previous email about optimizing your YouTube thumbnails and titles. Would love to hear your thoughts!</p><p>Best,<br/>CTRForge Team</p>`,
    };
  } catch (err) {
    console.error('AI follow-up generation error:', err);
    // Fallback template
    const fallbacks: Record<string, string> = {
      not_opened: `<p>Hi ${params.creatorName},</p><p>I wanted to make sure my previous email didn't get buried. I spotted some opportunities to boost your click-through rates that I'd love to share.</p><p>Would a quick look at two thumbnail concepts be useful?</p><p>Best,<br/>CTRForge Team</p>`,
      opened_not_clicked: `<p>Hi ${params.creatorName},</p><p>Thanks for reading my previous note! I put together a quick visual showing the specific CTR improvements I had in mind for your channel.</p><p>Here's the direct link — takes 30 seconds to review. Let me know what you think!</p><p>Best,<br/>CTRForge Team</p>`,
      clicked_not_replied: `<p>Hi ${params.creatorName},</p><p>Glad you had a chance to check out the concepts! If any of them resonated, I'd love to jump on a quick 10-minute call to walk through how we'd implement them.</p><p>What does your schedule look like this week?</p><p>Best,<br/>CTRForge Team</p>`,
    };

    return {
      subject: `Re: ${params.previousSubject}`,
      htmlBody: fallbacks[params.ruleType] || fallbacks.not_opened,
    };
  }
}

/**
 * Execute all due follow-ups for a user
 */
export async function executeScheduledFollowUps(userId: string): Promise<{
  sent: number;
  errors: string[];
}> {
  const supabase = await createClient();

  const { dueFollowUps } = await evaluateFollowUpRules(userId);
  let sent = 0;
  const errors: string[] = [];

  for (const followup of dueFollowUps) {
    const campaign = followup.email_campaigns;

    try {
      // Generate AI follow-up content
      const content = await generateFollowUpContent({
        creatorName: campaign.to_email.split('@')[0], // Fallback name
        previousSubject: campaign.subject,
        previousBody: campaign.html_body,
        ruleType: followup.rule_type,
        followupNumber: followup.followup_number,
      });

      // Inject tracking
      let trackedHtml = injectTrackingPixel(content.htmlBody, followup.id);
      trackedHtml = rewriteLinksForTracking(trackedHtml, followup.id);

      // Fetch and append the user's latest active signature
      const { data: sigRow } = await supabase
        .from('user_signatures')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (sigRow) {
        const normalizedSig = normalizeSignatureFromDb(sigRow);
        const appended = appendSignatureToEmail({
          htmlBody: trackedHtml,
          textBody: htmlToPlainText(content.htmlBody),
          signature: normalizedSig,
        });
        trackedHtml = appended.html;
      }

      // Send the follow-up
      const result = await sendEmail({
        userId,
        to: campaign.to_email,
        subject: content.subject,
        htmlBody: trackedHtml,
        textBody: htmlToPlainText(content.htmlBody),
        threadId: campaign.gmail_thread_id, // Continue in same thread
        parentGmailMessageId: campaign.gmail_message_id,
      });

      // Apply Gmail labels to follow-up message & thread
      try {
        const campaignName = followup.email_campaigns?.bulk_campaigns?.name || 'Outreach';
        const labelIds = await GmailLabelService.ensureCampaignLabels(userId, campaignName);
        if (labelIds.length > 0) {
          if (result.messageId) {
            await GmailLabelService.applyLabelToMessage(userId, result.messageId, labelIds);
          }
          if (result.threadId || campaign.gmail_thread_id) {
            await GmailLabelService.applyLabelToThread(userId, result.threadId || campaign.gmail_thread_id, labelIds);
          }
        }
      } catch (labelErr) {
        console.error('Follow-up labeling error (non-blocking):', labelErr);
      }

      // Create campaign record for the follow-up
      await supabase.from('email_campaigns').insert({
        user_id: userId,
        lead_id: campaign.lead_id,
        gmail_message_id: result.messageId,
        gmail_thread_id: result.threadId,
        to_email: campaign.to_email,
        subject: content.subject,
        html_body: trackedHtml,
        text_body: htmlToPlainText(content.htmlBody),
        status: 'sent',
        is_followup: true,
        followup_number: followup.followup_number,
        parent_campaign_id: campaign.id,
        sent_at: new Date().toISOString(),
      });

      // Update follow-up sequence status
      await supabase
        .from('followup_sequences')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          generated_content: content.htmlBody,
        })
        .eq('id', followup.id);

      sent++;
    } catch (err: any) {
      console.error(`Follow-up error for sequence ${followup.id}:`, err);
      errors.push(`Follow-up ${followup.id}: ${err.message}`);
    }
  }

  return { sent, errors };
}
