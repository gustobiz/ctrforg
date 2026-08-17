import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processNextBatch, isInsideSendWindow } from '@/lib/gmail/campaign-engine';
import { executeScheduledFollowUps } from '@/lib/gmail/followups';
import { syncReplies } from '@/lib/gmail/replies';
import { syncCampaignStatusesToSheet } from '@/lib/gmail/sheets-sync';
import { getCampaignSettings } from '@/lib/campaigns/settings';

async function handleProcessAll(req: Request) {
  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();
    
    console.log(`[ProcessAll] Worker triggered at ${nowIso}`);

    // 1. Promote scheduled or queued campaigns that are due to 'running'
    const { data: scheduledCampaigns } = await supabase
      .from('bulk_campaigns')
      .select('id, user_id, status, name')
      .in('status', ['scheduled', 'queued']);

    const promotedCampaigns: string[] = [];
    if (scheduledCampaigns && scheduledCampaigns.length > 0) {
      for (const sc of scheduledCampaigns) {
        const settings = await getCampaignSettings(sc.id);
        const isImmediate = settings.scheduleMode === 'immediate';
        const inWindow = isImmediate || isInsideSendWindow(sc, settings);

        // Check if there are any queue items due at or before now
        const { data: dueQueue } = await supabase
          .from('email_queue')
          .select('id')
          .eq('campaign_id', sc.id)
          .eq('status', 'queued')
          .lte('scheduled_at', nowIso)
          .limit(1);

        // Check if scheduled_at timestamp on settings has passed
        const scheduledTimePassed = settings.scheduledAt
          ? new Date(settings.scheduledAt).getTime() <= Date.now()
          : true;

        if (isImmediate || (inWindow && (scheduledTimePassed || (dueQueue && dueQueue.length > 0)))) {
          await supabase
            .from('bulk_campaigns')
            .update({
              status: 'running',
              started_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', sc.id);
          
          promotedCampaigns.push(sc.id);
          console.log(`[ProcessAll] Promoted campaign ${sc.name} (${sc.id}) from "${sc.status}" to "running"`);
        }
      }
    }


    // 2. Fetch all running bulk campaigns (including newly promoted ones)
    const { data: activeCampaigns, error: campaignErr } = await supabase
      .from('bulk_campaigns')
      .select('id, user_id, name')
      .eq('status', 'running');

    if (campaignErr) throw campaignErr;

    const campaignResults: any[] = [];
    if (activeCampaigns && activeCampaigns.length > 0) {
      for (const campaign of activeCampaigns) {
        try {
          const res = await processNextBatch(campaign.id, campaign.user_id, supabase);
          campaignResults.push({ campaignId: campaign.id, name: campaign.name, ...res });
        } catch (err: any) {
          console.error(`[ProcessAll] Error processing batch for campaign ${campaign.id}:`, err);
          campaignResults.push({ campaignId: campaign.id, name: campaign.name, error: err.message });
        }
      }
    }

    // 3. Resolve unique active users for replies, follow-ups, and sheets sync
    const { data: usersData } = await supabase
      .from('bulk_campaigns')
      .select('user_id');
    
    const userIds = new Set<string>();
    usersData?.forEach(u => userIds.add(u.user_id));

    // Also get user ids from sheets connections
    const { data: sheetsUsers } = await supabase
      .from('sheets_connections')
      .select('user_id');
    sheetsUsers?.forEach(u => userIds.add(u.user_id));

    const followUpResults: any[] = [];
    const replyResults: any[] = [];
    const sheetSyncResults: any[] = [];

    for (const userId of Array.from(userIds)) {
      // Execute scheduled followups
      try {
        const res = await executeScheduledFollowUps(userId, supabase);
        if (res.sent > 0) {
          followUpResults.push({ userId, ...res });
        }
      } catch (err: any) {
        console.error(`[ProcessAll] Error executing followups for user ${userId}:`, err);
      }

      // Sync replies
      try {
        const res = await syncReplies(userId);
        if (res.newReplies.length > 0) {
          replyResults.push({ userId, repliesCount: res.newReplies.length });
        }
      } catch (err: any) {
        console.error(`[ProcessAll] Error syncing replies for user ${userId}:`, err);
      }

      // Sync campaign status to Google Sheet
      try {
        const synced = await syncCampaignStatusesToSheet(userId);
        if (synced) {
          sheetSyncResults.push({ userId, synced: true });
        }
      } catch (err: any) {
        console.error(`[ProcessAll] Error syncing campaign status to sheet for user ${userId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      promotedFromScheduled: promotedCampaigns,
      processedCampaigns: campaignResults,
      executedFollowUps: followUpResults,
      syncedReplies: replyResults,
      syncedSheets: sheetSyncResults
    });
  } catch (error: any) {
    console.error('[ProcessAll] Fatal error in process-all outreach job:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return handleProcessAll(req);
}

export async function POST(req: Request) {
  return handleProcessAll(req);
}
