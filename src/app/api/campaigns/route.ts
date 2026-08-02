import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GmailLabelService } from '@/lib/gmail/label-service';

function getLeadEmail(lead: any): string {
  if (!lead) return '';
  let email = lead.email || lead.contact_email || '';
  if (!email && lead.ai_analysis) {
    let ai = lead.ai_analysis;
    if (typeof ai === 'string') {
      try { ai = JSON.parse(ai); } catch (e) {}
    }
    if (ai && typeof ai === 'object') {
      email = ai.contact_email || ai.email || '';
    }
  }
  return typeof email === 'string' ? email.trim() : '';
}

// GET /api/campaigns — List all campaigns
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaigns, error } = await supabase
      .from('bulk_campaigns')
      .select('*, email_templates(name, subject)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedCampaigns = (campaigns || []).map((c: any) => {
      const labelName = `CTRForge/Campaigns/${c.name}`;
      
      // Async backfill in background for existing campaigns missing labels
      if (!c.gmail_label_id) {
        GmailLabelService.syncCampaignLabels(user.id, c.id).catch((err) => {
          console.error('Async syncCampaignLabels error:', err);
        });
      }

      return {
        ...c,
        gmail_label_name: labelName,
      };
    });

    return NextResponse.json({ success: true, campaigns: formattedCampaigns });
  } catch (error: any) {
    console.error('Campaigns list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/campaigns — Create a new campaign
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      templateId,
      subjectOverride,
      htmlBodyOverride,
      sendRate = 20,
      randomDelayMin = 30,
      randomDelayMax = 120,
      leadIds = [],
      followupRules = [],
      leadSourceType = 'crm',
      leadSourceId = null,
      scheduledAt = null,
      sendWindowStart = '09:00',
      sendWindowEnd = '17:00',
      sendWindowTz = 'UTC',
      sendWindowDays = [1, 2, 3, 4, 5],
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Campaign name is required' }, { status: 400 });
    }

    // Fetch and validate selected leads
    let fetchedLeads: any[] = [];
    let validLeadsCount = 0;
    if (leadIds.length > 0) {
      let query = supabase
        .from('crm_leads')
        .select('id, creator_name, email, contact_email, ai_analysis')
        .in('id', leadIds);

      if ((leadSourceType === 'sheets' || leadSourceType === 'google_sheets') && leadSourceId) {
        query = query.eq('sheet_id', leadSourceId);
      } else if (leadSourceType === 'csv' && leadSourceId) {
        query = query.eq('csv_batch_id', leadSourceId);
      } else if (leadSourceType === 'csv' && !leadSourceId) {
        query = query.eq('contact_source', 'csv_import');
      } else if (leadSourceType === 'crm') {
        query = query.or('contact_source.eq.manual,contact_source.eq.youtube_scraping,contact_source.is.null');
      }

      const { data: leads, error: fetchLeadsError } = await query;

      if (fetchLeadsError) throw fetchLeadsError;

      if (leads) {
        fetchedLeads = leads;
        const validLeads = leads.filter((lead: any) => {
          const email = getLeadEmail(lead);
          return email !== '' && email.includes('@');
        });
        validLeadsCount = validLeads.length;
      }
    }

    if (validLeadsCount === 0) {
      return NextResponse.json({ error: 'No valid email addresses found in the selected lead source.' }, { status: 400 });
    }

    // Create bulk campaign payload (omitting non-existent lead_source_id / lead_source_type columns)
    const initialStatus = scheduledAt && new Date(scheduledAt) > new Date() ? 'scheduled' : 'draft';

    const insertObj: Record<string, any> = {
      user_id: user.id,
      name,
      template_id: templateId || null,
      subject_override: subjectOverride || null,
      html_body_override: htmlBodyOverride || null,
      send_rate: sendRate,
      random_delay_min: randomDelayMin,
      random_delay_max: randomDelayMax,
      total_leads: validLeadsCount,
      status: initialStatus,
    };

    // Pre-create Gmail labels
    let createdLabelObj: any = null;
    try {
      await GmailLabelService.ensureCampaignLabels(user.id, name);
      createdLabelObj = await GmailLabelService.getOrCreateLabel(user.id, `CTRForge/Campaigns/${name}`);
    } catch (labelErr) {
      console.error('Pre-create Gmail label error (non-blocking):', labelErr);
    }

    if (createdLabelObj?.id) {
      insertObj.gmail_label_id = createdLabelObj.id;
    }

    const { data: campaign, error: campaignError } = await supabase
      .from('bulk_campaigns')
      .insert(insertObj)
      .select()
      .single();

    if (campaignError) throw campaignError;

    // Add leads to campaign
    if (fetchedLeads.length > 0) {
      const campaignLeads = fetchedLeads.map((lead: any) => ({
        campaign_id: campaign.id,
        lead_id: lead.id,
        lead_name: lead.creator_name,
        lead_email: getLeadEmail(lead),
        status: 'pending',
        variables: {},
      }));

      await supabase.from('campaign_leads').insert(campaignLeads);
    }

    // Add follow-up rules
    if (followupRules.length > 0) {
      const rules = followupRules.map((rule: any, i: number) => {
        const r: Record<string, any> = {
          campaign_id: campaign.id,
          step_number: i + 1,
          delay_days: rule.delayDays || 3,
          rule_type: rule.ruleType || 'not_opened',
          template_id: rule.templateId || null,
          use_ai_generation: rule.useAiGeneration !== false,
        };
        if (rule.threadMode) {
          r.thread_mode = rule.threadMode;
        }
        return r;
      });

      await supabase.from('campaign_followup_rules').insert(rules);
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Campaign create error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
