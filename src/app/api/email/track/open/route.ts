import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateBulkCampaignStats } from '@/lib/gmail/campaign-engine';

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const encodedCid = searchParams.get('cid');

    if (encodedCid) {
      const campaignId = Buffer.from(encodedCid, 'base64url').toString();

      // Use service-level client (no cookies needed for tracking pixels)
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get() { return undefined; } } }
      );

      // Get campaign info
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select('id, user_id, lead_id, total_opens, parent_campaign_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        // Log the open event
        await supabase.from('email_events').insert({
          campaign_id: campaign.id,
          user_id: campaign.user_id,
          lead_id: campaign.lead_id,
          event_type: 'open',
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          user_agent: request.headers.get('user-agent') || '',
        });

        // Update campaign open stats
        const newTotalOpens = (campaign.total_opens || 0) + 1;
        const updatePayload: any = {
          total_opens: newTotalOpens,
        };

        // Only set opened_at and status on first open
        if (!campaign.total_opens || campaign.total_opens === 0) {
          updatePayload.opened_at = new Date().toISOString();
          updatePayload.status = 'opened';
        }

        await supabase
          .from('email_campaigns')
          .update(updatePayload)
          .eq('id', campaign.id);

        // Update campaign_leads if part of a bulk campaign (check either self or parent)
        const targetCampaignId = campaign.parent_campaign_id || campaign.id;
        const { data: campaignLead } = await supabase
          .from('campaign_leads')
          .select('campaign_id, status')
          .eq('email_campaign_id', targetCampaignId)
          .maybeSingle();

        if (campaignLead) {
          // Only upgrade status to 'opened' if it's currently 'sent'
          if (campaignLead.status === 'sent') {
            await supabase
              .from('campaign_leads')
              .update({ status: 'opened' })
              .eq('email_campaign_id', targetCampaignId);
            
            // Recalculate parent bulk campaign statistics
            await updateBulkCampaignStats(supabase, campaignLead.campaign_id);
          }
        }
      }
    }
  } catch (err) {
    console.error('Open tracking error:', err);
  }

  // Always return the pixel regardless of tracking success
  return new NextResponse(TRACKING_PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': TRACKING_PIXEL.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
