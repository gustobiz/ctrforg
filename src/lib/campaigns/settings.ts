import { createAdminClient } from '@/lib/supabase/server';

export interface CampaignSettings {
  sendWindowStart: string; // "09:00"
  sendWindowEnd: string;   // "17:00"
  sendWindowTz: string;    // "Asia/Calcutta", "America/New_York", etc.
  sendWindowDays: number[]; // [1, 2, 3, 4, 5]
  scheduleMode?: 'immediate' | 'scheduled';
  scheduledAt?: string | null;
  leadSourceType?: string;
  leadSourceId?: string | null;
  followupRules?: Array<{
    stepNumber?: number;
    delayDays: number;
    sendTime?: string;
    sendTimeTz?: string;
    ruleType: string;
    templateId?: string | null;
    useAiGeneration?: boolean;
    threadMode?: 'reply' | 'new_thread';
    subjectOverride?: string;
    htmlBodyOverride?: string;
  }>;
}

export const DEFAULT_CAMPAIGN_SETTINGS: CampaignSettings = {
  sendWindowStart: '09:00',
  sendWindowEnd: '17:00',
  sendWindowTz: 'UTC',
  sendWindowDays: [1, 2, 3, 4, 5],
  scheduleMode: 'immediate',
  scheduledAt: null,
};

/**
 * Save settings for a specific campaign into custom_variables using admin client.
 */
export async function saveCampaignSettings(
  campaignId: string,
  settings: Partial<CampaignSettings>,
  userId?: string
): Promise<void> {
  try {
    const supabase = createAdminClient();
    const varName = `campaign_meta_${campaignId}`;

    const existingSettings = await getCampaignSettings(campaignId);
    const mergedSettings: CampaignSettings = {
      ...existingSettings,
      ...settings,
      sendWindowDays: settings.sendWindowDays || existingSettings.sendWindowDays || [1, 2, 3, 4, 5],
    };

    // If userId not provided, fetch user_id from bulk_campaigns
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: camp } = await supabase
        .from('bulk_campaigns')
        .select('user_id')
        .eq('id', campaignId)
        .single();
      effectiveUserId = camp?.user_id;
    }

    if (!effectiveUserId) {
      console.warn(`[saveCampaignSettings] Cannot save settings for ${campaignId}: unknown userId`);
      return;
    }

    // Check if record already exists in custom_variables
    const { data: existingRow } = await supabase
      .from('custom_variables')
      .select('id')
      .eq('name', varName)
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    const jsonVal = JSON.stringify(mergedSettings);

    if (existingRow?.id) {
      await supabase
        .from('custom_variables')
        .update({
          default_value: jsonVal,
        })
        .eq('id', existingRow.id);
    } else {
      await supabase
        .from('custom_variables')
        .insert({
          user_id: effectiveUserId,
          name: varName,
          default_value: jsonVal,
        });
    }
  } catch (err) {
    console.error(`[saveCampaignSettings] Error saving settings for campaign ${campaignId}:`, err);
  }
}

/**
 * Retrieve settings for a specific campaign from custom_variables.
 */
export async function getCampaignSettings(campaignId: string): Promise<CampaignSettings> {
  try {
    const supabase = createAdminClient();
    const varName = `campaign_meta_${campaignId}`;

    const { data: row } = await supabase
      .from('custom_variables')
      .select('default_value')
      .eq('name', varName)
      .maybeSingle();

    if (row?.default_value) {
      const parsed = JSON.parse(row.default_value);
      return {
        sendWindowStart: parsed.sendWindowStart || '09:00',
        sendWindowEnd: parsed.sendWindowEnd || '17:00',
        sendWindowTz: parsed.sendWindowTz || 'UTC',
        sendWindowDays: Array.isArray(parsed.sendWindowDays) ? parsed.sendWindowDays.map(Number) : [1, 2, 3, 4, 5],
        scheduleMode: parsed.scheduleMode || 'immediate',
        scheduledAt: parsed.scheduledAt || null,
        leadSourceType: parsed.leadSourceType || 'crm',
        leadSourceId: parsed.leadSourceId || null,
        followupRules: parsed.followupRules || [],
      };
    }
  } catch (err) {
    console.error(`[getCampaignSettings] Error reading settings for campaign ${campaignId}:`, err);
  }

  return { ...DEFAULT_CAMPAIGN_SETTINGS };
}
