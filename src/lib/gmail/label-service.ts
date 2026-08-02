import { getValidAccessToken } from './oauth';
import { createClient } from '@/lib/supabase/server';

// Memory cache for Gmail label IDs per user: key = `${userId}:${labelName}`, value = labelId
const labelCache = new Map<string, string>();

export class GmailLabelService {
  /**
   * Get or create a single Gmail label by name (e.g. "CTRForge/Campaigns/July Outreach").
   * Automatically handles label hierarchy creation if parents don't exist.
   * Caches label IDs to minimize Gmail API requests.
   */
  static async getOrCreateLabel(userId: string, labelName: string): Promise<{ id: string; name: string } | null> {
    if (!userId || !labelName) return null;

    const cacheKey = `${userId}:${labelName.toLowerCase()}`;
    if (labelCache.has(cacheKey)) {
      return { id: labelCache.get(cacheKey)!, name: labelName };
    }

    try {
      const tokenData = await getValidAccessToken(userId);
      if (!tokenData) return null;

      // 1. List existing labels
      const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        headers: { Authorization: `Bearer ${tokenData.accessToken}` },
      });

      if (!listRes.ok) {
        console.error('Failed to list Gmail labels:', await listRes.text());
        return null;
      }

      const listData = await listRes.json();
      const existingLabels: { id: string; name: string }[] = listData.labels || [];

      // Update local cache with all listed labels
      for (const l of existingLabels) {
        labelCache.set(`${userId}:${l.name.toLowerCase()}`, l.id);
      }

      const found = existingLabels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
      if (found) {
        labelCache.set(cacheKey, found.id);
        return found;
      }

      // If creating nested label, ensure parent parts exist
      const parts = labelName.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        const parentKey = `${userId}:${currentPath.toLowerCase()}`;
        if (!labelCache.has(parentKey)) {
          const parentFound = existingLabels.find(l => l.name.toLowerCase() === currentPath.toLowerCase());
          if (parentFound) {
            labelCache.set(parentKey, parentFound.id);
          } else {
            // Create parent label
            const createParentRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${tokenData.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: currentPath,
                labelListVisibility: 'labelShow',
                messageListVisibility: 'show',
              }),
            });
            if (createParentRes.ok) {
              const newParent = await createParentRes.json();
              labelCache.set(parentKey, newParent.id);
            }
          }
        }
      }

      // 2. Create the target label
      const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error(`Failed to create Gmail label '${labelName}':`, errText);
        return null;
      }

      const newLabel = await createRes.json();
      labelCache.set(cacheKey, newLabel.id);
      return { id: newLabel.id, name: newLabel.name };
    } catch (err) {
      console.error(`Error in getOrCreateLabel for '${labelName}':`, err);
      return null;
    }
  }

  /**
   * Get or create the full standard label hierarchy for a campaign:
   * - "CTRForge"
   * - "CTRForge/Campaigns"
   * - "CTRForge/Campaigns/{Campaign Name}"
   * - "CTRForge/Sent"
   */
  static async ensureCampaignLabels(userId: string, campaignName: string): Promise<string[]> {
    const labelNames = [
      'CTRForge',
      'CTRForge/Campaigns',
      `CTRForge/Campaigns/${campaignName}`,
      'CTRForge/Sent',
    ];

    const labelIds: string[] = [];
    for (const name of labelNames) {
      const labelObj = await this.getOrCreateLabel(userId, name);
      if (labelObj?.id) {
        labelIds.push(labelObj.id);
      }
    }
    return labelIds;
  }

  /**
   * Apply label IDs to a Gmail message via users.messages.modify endpoint.
   * Never blocks execution if labelling fails.
   */
  static async applyLabelToMessage(userId: string, messageId: string, labelIds: string[]): Promise<boolean> {
    if (!userId || !messageId || !labelIds || labelIds.length === 0) return false;
    try {
      const tokenData = await getValidAccessToken(userId);
      if (!tokenData) return false;

      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: labelIds,
        }),
      });

      if (!res.ok) {
        console.error(`Failed to apply labels to message ${messageId}:`, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error(`Error applying labels to message ${messageId}:`, err);
      return false;
    }
  }

  /**
   * Apply label IDs to an entire Gmail thread via users.threads.modify endpoint.
   * Ensures every message/reply in the thread inherits campaign labels.
   */
  static async applyLabelToThread(userId: string, threadId: string, labelIds: string[]): Promise<boolean> {
    if (!userId || !threadId || !labelIds || labelIds.length === 0) return false;
    try {
      const tokenData = await getValidAccessToken(userId);
      if (!tokenData) return false;

      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: labelIds,
        }),
      });

      if (!res.ok) {
        console.error(`Failed to apply labels to thread ${threadId}:`, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error(`Error applying labels to thread ${threadId}:`, err);
      return false;
    }
  }

  /**
   * Sync campaign labels for existing campaigns or backfills:
   * Creates labels if missing, labels all previous campaign messages/threads, and updates campaign DB.
   */
  static async syncCampaignLabels(userId: string, campaignId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Fetch campaign details
      const { data: campaign } = await supabase
        .from('bulk_campaigns')
        .select('*')
        .eq('id', campaignId)
        .maybeSingle();

      if (!campaign) return false;

      const campaignName = campaign.name || 'Outreach';
      const labelIds = await this.ensureCampaignLabels(userId, campaignName);

      const campaignLabelObj = await this.getOrCreateLabel(userId, `CTRForge/Campaigns/${campaignName}`);
      const campaignLabelId = campaignLabelObj?.id || (labelIds.length > 0 ? labelIds[labelIds.length - 1] : null);

      // Store gmail_label_id and gmail_label_name in DB safely
      try {
        await supabase
          .from('bulk_campaigns')
          .update({
            gmail_label_id: campaignLabelId,
          })
          .eq('id', campaignId);
      } catch (dbErr) {
        console.warn('Could not update bulk_campaigns label fields directly:', dbErr);
      }

      // Find all email_campaigns for this bulk campaign
      const { data: campaignLeads } = await supabase
        .from('campaign_leads')
        .select('lead_id')
        .eq('campaign_id', campaignId);

      const leadIds = campaignLeads?.map(cl => cl.lead_id) || [];
      if (leadIds.length > 0 && labelIds.length > 0) {
        const { data: emails } = await supabase
          .from('email_campaigns')
          .select('gmail_message_id, gmail_thread_id')
          .in('lead_id', leadIds)
          .not('gmail_message_id', 'is', null);

        if (emails && emails.length > 0) {
          for (const email of emails) {
            if (email.gmail_message_id) {
              await this.applyLabelToMessage(userId, email.gmail_message_id, labelIds);
            }
            if (email.gmail_thread_id) {
              await this.applyLabelToThread(userId, email.gmail_thread_id, labelIds);
            }
          }
        }
      }

      return true;
    } catch (err) {
      console.error(`Error in syncCampaignLabels for campaign ${campaignId}:`, err);
      return false;
    }
  }
}
