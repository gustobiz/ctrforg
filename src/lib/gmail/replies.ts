import { getValidAccessToken } from './oauth';
import { createClient } from '@/lib/supabase/server';
import { updateBulkCampaignStats } from './campaign-engine';

/**
 * Classify a reply using Gemini, with a rule-based backup fallback.
 * Returns a UI-safe category string (lowercase_underscore) matching inbox_messages.category values.
 */
export async function classifyReply(snippet: string): Promise<'interested' | 'not_interested' | 'followup_needed'> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

  if (!GEMINI_API_KEY) {
    return fallbackClassify(snippet);
  }

  const prompt = `You are an automated CRM assistant. Classify the following email reply from a lead into exactly one of three categories:
- "interested" (the lead wants to talk, is open to a call, asks for more info, or shows positive interest).
- "not_interested" (the lead says no thanks, unsubscribes, asks not to be emailed, or shows clear negative/dismissive intent).
- "followup_needed" (neutral responses, out-of-office autoreplies, or any other response that doesn't fit the above two).

Reply text snippet:
"${snippet}"

Return a JSON object with:
{
  "category": "interested" | "not_interested" | "followup_needed"
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
            temperature: 0.1,
            maxOutputTokens: 50,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) throw new Error('Gemini API call failed');
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(text);
    const cat = parsed.category;
    if (['interested', 'not_interested', 'followup_needed'].includes(cat)) {
      return cat as 'interested' | 'not_interested' | 'followup_needed';
    }
  } catch (err) {
    console.warn('[INBOX SYNC] Gemini classification failed, using fallback:', err);
  }

  return fallbackClassify(snippet);
}

function fallbackClassify(snippet: string): 'interested' | 'not_interested' | 'followup_needed' {
  const text = snippet.toLowerCase();
  
  if (
    text.includes('interested') || 
    text.includes('yes') || 
    text.includes('sure') || 
    text.includes('talk') || 
    text.includes('call') || 
    text.includes('phone') || 
    text.includes('zoom') || 
    text.includes('meet') || 
    text.includes('calendar') ||
    text.includes('send over') ||
    text.includes('sounds good') ||
    text.includes('would love')
  ) {
    return 'interested';
  }

  if (
    text.includes('unsubscribe') || 
    text.includes('no thanks') || 
    text.includes('not interested') || 
    text.includes('stop') || 
    text.includes('don\'t email') || 
    text.includes('remove') ||
    text.includes('please delete') ||
    text.includes('not looking')
  ) {
    return 'not_interested';
  }

  return 'followup_needed';
}

/**
 * Maps classifyReply() output to the CRM lead status used in crm_leads.status.
 * Kept separate from inbox category values.
 */
function toCrmStatus(category: 'interested' | 'not_interested' | 'followup_needed'): string {
  const statusMap: Record<string, string> = {
    'interested': 'interested',
    'not_interested': 'closed',
    'followup_needed': 'follow_up',
  };
  return statusMap[category] || 'contacted';
}

/**
 * Fetch recent Gmail messages to detect replies to sent campaigns.
 * Inserts detected replies into inbox_messages with correct category values.
 */
export async function syncReplies(userId: string): Promise<{
  newReplies: Array<{ campaignId: string; leadId: string; snippet: string; receivedAt: string }>;
}> {
  const tokenData = await getValidAccessToken(userId);
  if (!tokenData) {
    throw new Error('Gmail is not connected');
  }

  const supabase = await createClient();

  // Get all sent campaigns with thread IDs that haven't been marked as replied
  const { data: campaigns, error: campaignFetchError } = await supabase
    .from('email_campaigns')
    .select('id, gmail_thread_id, lead_id, to_email, subject, parent_campaign_id')
    .eq('user_id', userId)
    .not('gmail_thread_id', 'is', null)
    .neq('status', 'replied')
    .order('sent_at', { ascending: false })
    .limit(50);

  if (campaignFetchError) {
    console.error('[INBOX SYNC] Failed to fetch campaigns:', campaignFetchError.message);
  }

  console.log(`[INBOX SYNC] Fetched threads: ${campaigns?.length ?? 0} campaigns with gmail_thread_ids`);

  if (!campaigns || campaigns.length === 0) {
    return { newReplies: [] };
  }

  const newReplies: Array<{ campaignId: string; leadId: string; snippet: string; receivedAt: string }> = [];

  // Check each thread for replies
  for (const campaign of campaigns) {
    if (!campaign.gmail_thread_id) continue;

    try {
      console.log(`[INBOX SYNC] Checking thread: ${campaign.gmail_thread_id} (campaign: ${campaign.id})`);

      const threadResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${campaign.gmail_thread_id}?format=metadata&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: { Authorization: `Bearer ${tokenData.accessToken}` },
        }
      );

      if (!threadResponse.ok) {
        console.warn(`[INBOX SYNC] Thread ${campaign.gmail_thread_id} fetch failed: HTTP ${threadResponse.status}`);
        continue;
      }

      const thread = await threadResponse.json();
      const messages = thread.messages || [];

      console.log(`[INBOX SYNC] Thread ${campaign.gmail_thread_id}: ${messages.length} message(s) found`);

      // If there are more messages than just our sent one, check for incoming replies
      if (messages.length <= 1) {
        console.log(`[INBOX SYNC] Thread ${campaign.gmail_thread_id}: only 1 message, no reply yet`);
        continue;
      }

      for (const message of messages) {
        // Skip our sent messages
        const fromHeader = message.payload?.headers?.find(
          (h: any) => h.name.toLowerCase() === 'from'
        );
        const fromEmail = fromHeader?.value || '';

        console.log(`[INBOX SYNC] Message ${message.id} — from: "${fromEmail}" (our email: "${tokenData.email}")`);

        // If the message is FROM someone else (not us), it's a reply
        if (fromEmail && !fromEmail.includes(tokenData.email)) {
          console.log(`[INBOX SYNC] Matched reply from "${fromEmail}" in thread ${campaign.gmail_thread_id}`);

          // Check if we already logged this reply in email_events
          const { data: existingEvent } = await supabase
            .from('email_events')
            .select('id')
            .eq('campaign_id', campaign.id)
            .eq('event_type', 'reply')
            .limit(1)
            .single();

          if (existingEvent) {
            console.log(`[INBOX SYNC] Reply event already exists for campaign ${campaign.id} — checking inbox_messages`);

            // Even if event exists, check if inbox_messages record is missing (partial failure recovery)
            const { data: existingInboxMsg } = await supabase
              .from('inbox_messages')
              .select('id')
              .eq('gmail_message_id', message.id)
              .limit(1)
              .single();

            if (existingInboxMsg) {
              console.log(`[INBOX SYNC] inbox_messages record already exists (id: ${existingInboxMsg.id}) — skipping`);
            } else {
              console.warn(`[INBOX SYNC] email_events has reply for campaign ${campaign.id} but inbox_messages is MISSING — recovering`);
              // Attempt recovery insert
              const classification = await classifyReply(message.snippet || '');
              console.log(`[INBOX SYNC] Recovery classified reply as: "${classification}"`);

              const { error: recoverInsertError } = await supabase.from('inbox_messages').insert({
                user_id: userId,
                campaign_id: campaign.id,
                lead_id: campaign.lead_id,
                gmail_message_id: message.id,
                gmail_thread_id: campaign.gmail_thread_id,
                from_email: fromEmail,
                to_email: campaign.to_email,
                subject: campaign.subject || 'Outreach Reply',
                snippet: message.snippet || '',
                body_preview: message.snippet || '',
                is_inbound: true,
                is_read: false,
                category: classification,
                received_at: new Date().toISOString(),
              });

              if (recoverInsertError) {
                console.error(`[INBOX SYNC] Recovery inbox_messages insert failed:`, recoverInsertError.message);
              } else {
                console.log(`[INBOX SYNC] Recovery: saved inbox_messages record for campaign ${campaign.id}`);
              }
            }

            break;
          }

          // Auto classify the reply — returns lowercase_underscore category
          const classification = await classifyReply(message.snippet || '');
          console.log(`[INBOX SYNC] Classified reply as: "${classification}" for campaign ${campaign.id}`);

          // Log the reply event in email_events
          const { error: eventInsertError } = await supabase.from('email_events').insert({
            campaign_id: campaign.id,
            user_id: userId,
            lead_id: campaign.lead_id,
            event_type: 'reply',
          });

          if (eventInsertError) {
            console.error(`[INBOX SYNC] email_events insert failed for campaign ${campaign.id}:`, eventInsertError.message);
          } else {
            console.log(`[INBOX SYNC] Saved email_events reply record for campaign ${campaign.id}`);
          }

          // Insert into inbox_messages — upsert on gmail_message_id to prevent duplicates
          const { error: inboxInsertError } = await supabase.from('inbox_messages').upsert(
            {
              user_id: userId,
              campaign_id: campaign.id,
              lead_id: campaign.lead_id,
              gmail_message_id: message.id,
              gmail_thread_id: campaign.gmail_thread_id,
              from_email: fromEmail,
              to_email: campaign.to_email,
              subject: campaign.subject || 'Outreach Reply',
              snippet: message.snippet || '',
              body_preview: message.snippet || '',
              is_inbound: true,
              is_read: false,
              category: classification, // ← Now correctly: 'interested' | 'not_interested' | 'followup_needed'
              received_at: new Date().toISOString(),
            },
            { onConflict: 'gmail_message_id', ignoreDuplicates: true }
          );

          if (inboxInsertError) {
            console.error(`[INBOX SYNC] inbox_messages insert FAILED for campaign ${campaign.id}:`, inboxInsertError.message, '— full error:', JSON.stringify(inboxInsertError));
          } else {
            console.log(`[INBOX SYNC] Saved reply to inbox_messages for campaign ${campaign.id} (category: "${classification}")`);
          }

          // Update campaign status to replied
          await supabase
            .from('email_campaigns')
            .update({
              status: 'replied',
              replied_at: new Date().toISOString(),
            })
            .eq('id', campaign.id);

          // Update corresponding CRM lead status based on classification
          if (campaign.lead_id) {
            const newCrmStatus = toCrmStatus(classification);
            console.log(`[INBOX SYNC] Updating CRM lead ${campaign.lead_id} status → "${newCrmStatus}"`);

            await supabase
              .from('crm_leads')
              .update({ status: newCrmStatus })
              .eq('id', campaign.lead_id);
          }

          // Update campaign_leads if part of a bulk campaign
          const targetCampaignId = campaign.parent_campaign_id || campaign.id;
          const { data: campaignLead } = await supabase
            .from('campaign_leads')
            .select('campaign_id')
            .eq('email_campaign_id', targetCampaignId)
            .maybeSingle();

          if (campaignLead) {
            console.log(`[INBOX SYNC] Updating campaign_leads for bulk campaign ${campaignLead.campaign_id}`);
            await supabase
              .from('campaign_leads')
              .update({ status: 'replied' })
              .eq('email_campaign_id', targetCampaignId);
            
            // Recalculate parent bulk campaign stats
            await updateBulkCampaignStats(supabase, campaignLead.campaign_id);
          }

          // Cancel all pending follow-ups for this lead
          if (campaign.lead_id) {
            console.log(`[INBOX SYNC] Cancelling pending follow-ups for lead ${campaign.lead_id}`);
            await supabase
              .from('followup_sequences')
              .update({ status: 'cancelled' })
              .eq('lead_id', campaign.lead_id)
              .eq('user_id', userId)
              .eq('status', 'pending');
          }

          newReplies.push({
            campaignId: campaign.id,
            leadId: campaign.lead_id || '',
            snippet: message.snippet || '',
            receivedAt: new Date().toISOString(),
          });

          console.log(`[INBOX SYNC] ✓ Reply fully processed for campaign ${campaign.id}`);
          break; // Only need to detect one reply per thread
        }
      }
    } catch (err) {
      console.error(`[INBOX SYNC] Error checking thread ${campaign.gmail_thread_id}:`, err);
    }
  }

  console.log(`[INBOX SYNC] Sync complete — ${newReplies.length} new reply(ies) processed`);
  return { newReplies };
}
