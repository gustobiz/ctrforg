import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { updateBulkCampaignStats } from '@/lib/gmail/campaign-engine';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const encodedCid = searchParams.get('cid');
  const rawUrl = searchParams.get('url');

  let destinationUrl = '/';
  if (rawUrl) {
    try {
      destinationUrl = decodeURIComponent(rawUrl);
    } catch {
      destinationUrl = rawUrl;
    }
  }

  // Ensure absolute protocol for external URLs so relative path resolution doesn't break
  if (destinationUrl && !/^https?:\/\//i.test(destinationUrl) && !destinationUrl.startsWith('/')) {
    destinationUrl = `https://${destinationUrl}`;
  }

  try {
    if (encodedCid) {
      const campaignId = Buffer.from(encodedCid, 'base64url').toString();

      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get() { return undefined; } } }
      );

      // Get campaign info
      const { data: campaign } = await supabase
        .from('email_campaigns')
        .select('id, user_id, lead_id, total_clicks, parent_campaign_id')
        .eq('id', campaignId)
        .single();

      if (campaign) {
        // Log the click event
        await supabase.from('email_events').insert({
          campaign_id: campaign.id,
          user_id: campaign.user_id,
          lead_id: campaign.lead_id,
          event_type: 'click',
          url: destinationUrl,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '',
          user_agent: request.headers.get('user-agent') || '',
        });

        // Update campaign click stats
        const newTotalClicks = (campaign.total_clicks || 0) + 1;
        const updatePayload: any = {
          total_clicks: newTotalClicks,
        };

        // Set clicked_at and status on first click
        if (!campaign.total_clicks || campaign.total_clicks === 0) {
          updatePayload.clicked_at = new Date().toISOString();
          // Only upgrade status (don't downgrade from 'replied')
          updatePayload.status = 'clicked';
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
          // Only upgrade status to 'clicked' if it's currently 'sent' or 'opened'
          if (['sent', 'opened'].includes(campaignLead.status)) {
            await supabase
              .from('campaign_leads')
              .update({ status: 'clicked' })
              .eq('email_campaign_id', targetCampaignId);
            
            // Recalculate parent bulk campaign statistics
            await updateBulkCampaignStats(supabase, campaignLead.campaign_id);
          }
        }
      }
    }
  } catch (err) {
    console.error('Click tracking error:', err);
  }

  // Always perform 302 redirect to target destination
  try {
    const target = new URL(destinationUrl, request.url).toString();
    return NextResponse.redirect(target, { status: 302 });
  } catch (err) {
    console.error('Redirect URL error:', err);
    return NextResponse.redirect(destinationUrl, { status: 302 });
  }
}
