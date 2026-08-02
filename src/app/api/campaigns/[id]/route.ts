import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/campaigns/[id] — Get single campaign with leads and rules
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign, error } = await supabase
      .from('bulk_campaigns')
      .select('*, email_templates(name, subject, html_body, text_body, category)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch campaign leads
    const { data: leads } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: true });

    // Fetch follow-up rules
    const { data: followupRules } = await supabase
      .from('campaign_followup_rules')
      .select('*')
      .eq('campaign_id', params.id)
      .order('step_number', { ascending: true });

    return NextResponse.json({
      success: true,
      campaign,
      leads: leads || [],
      followupRules: followupRules || [],
    });
  } catch (error: any) {
    console.error('Campaign detail error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/campaigns/[id] — Update campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      templateId,
      subjectOverride,
      htmlBodyOverride,
      sendRate,
      randomDelayMin,
      randomDelayMax,
      leadIds,
      followupRules,
    } = body;

    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (templateId !== undefined) updateData.template_id = templateId;
    if (subjectOverride !== undefined) updateData.subject_override = subjectOverride;
    if (htmlBodyOverride !== undefined) updateData.html_body_override = htmlBodyOverride;
    if (sendRate !== undefined) updateData.send_rate = sendRate;
    if (randomDelayMin !== undefined) updateData.random_delay_min = randomDelayMin;
    if (randomDelayMax !== undefined) updateData.random_delay_max = randomDelayMax;

    const { data: campaign, error } = await supabase
      .from('bulk_campaigns')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    // Handle lead IDs updates
    if (leadIds !== undefined) {
      let fetchedLeads: any[] = [];
      if (leadIds.length > 0) {
        const { data: leads, error: fetchLeadsError } = await supabase
          .from('crm_leads')
          .select('id, creator_name, email, contact_email, ai_analysis')
          .in('id', leadIds);

        if (fetchLeadsError) throw fetchLeadsError;
        if (leads) {
          fetchedLeads = leads;
        }
      }

      await supabase.from('campaign_leads').delete().eq('campaign_id', params.id);

      if (fetchedLeads.length > 0) {
        const campaignLeads = fetchedLeads.map((lead: any) => ({
          campaign_id: params.id,
          lead_id: lead.id,
          lead_name: lead.creator_name,
          lead_email: lead.email || lead.contact_email || lead.ai_analysis?.contact_email || '',
          status: 'pending',
          variables: {},
        }));

        const { error: insertLeadsError } = await supabase.from('campaign_leads').insert(campaignLeads);
        if (insertLeadsError) throw insertLeadsError;
      }
      
      // Update total_leads count in bulk_campaigns
      await supabase
        .from('bulk_campaigns')
        .update({ total_leads: fetchedLeads.length })
        .eq('id', params.id);
    }

    // Handle follow-up rules updates
    if (followupRules !== undefined) {
      await supabase.from('campaign_followup_rules').delete().eq('campaign_id', params.id);

      if (followupRules.length > 0) {
        const rules = followupRules.map((rule: any, i: number) => ({
          campaign_id: params.id,
          step_number: i + 1,
          delay_days: rule.delayDays || 3,
          rule_type: rule.ruleType || 'not_opened',
          template_id: rule.templateId || null,
          use_ai_generation: rule.useAiGeneration !== false,
        }));

        const { error: insertRulesError } = await supabase.from('campaign_followup_rules').insert(rules);
        if (insertRulesError) throw insertRulesError;
      }
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error('Campaign update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/campaigns/[id] — Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('bulk_campaigns')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Campaign delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
