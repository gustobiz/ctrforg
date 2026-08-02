import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processNextBatch } from '@/lib/gmail/campaign-engine';
import { executeScheduledFollowUps } from '@/lib/gmail/followups';
import { syncReplies } from '@/lib/gmail/replies';
import { syncCampaignStatusesToSheet } from '@/lib/gmail/sheets-sync';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Process running bulk campaigns
    const { data: activeCampaigns, error: campaignErr } = await supabase
      .from('bulk_campaigns')
      .select('id, user_id')
      .eq('status', 'running');

    if (campaignErr) throw campaignErr;

    const campaignResults: any[] = [];
    if (activeCampaigns && activeCampaigns.length > 0) {
      for (const campaign of activeCampaigns) {
        try {
          const res = await processNextBatch(campaign.id, campaign.user_id);
          campaignResults.push({ campaignId: campaign.id, ...res });
        } catch (err: any) {
          console.error(`Error processing batch for campaign ${campaign.id}:`, err);
          campaignResults.push({ campaignId: campaign.id, error: err.message });
        }
      }
    }

    // 2. Resolve unique active users for replies, follow-ups, and sheets sync
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
      // Execute followups
      try {
        const res = await executeScheduledFollowUps(userId);
        if (res.sent > 0) {
          followUpResults.push({ userId, ...res });
        }
      } catch (err: any) {
        console.error(`Error executing followups for user ${userId}:`, err);
      }

      // Sync replies
      try {
        const res = await syncReplies(userId);
        if (res.newReplies.length > 0) {
          replyResults.push({ userId, repliesCount: res.newReplies.length });
        }
      } catch (err: any) {
        console.error(`Error syncing replies for user ${userId}:`, err);
      }

      // Sync campaign status to Google Sheet
      try {
        const synced = await syncCampaignStatusesToSheet(userId);
        if (synced) {
          sheetSyncResults.push({ userId, synced: true });
        }
      } catch (err: any) {
        console.error(`Error syncing campaign status to sheet for user ${userId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processedCampaigns: campaignResults,
      executedFollowUps: followUpResults,
      syncedReplies: replyResults,
      syncedSheets: sheetSyncResults
    });
  } catch (error: any) {
    console.error('Fatal error in process-all outreach job:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
