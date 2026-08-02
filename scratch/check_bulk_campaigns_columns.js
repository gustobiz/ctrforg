const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(url, serviceRoleKey);

async function testFullLaunch() {
  const { data: leads } = await supabase.from('crm_leads').select('user_id').limit(1);
  if (!leads || leads.length === 0) {
    console.log('No leads available to test user_id');
    return;
  }
  const userId = leads[0].user_id;

  const insertObj = {
    user_id: userId,
    name: 'End-to-End Launch Test ' + Date.now(),
    send_rate: 20,
    random_delay_min: 30,
    random_delay_max: 120,
    total_leads: 1,
    status: 'draft',
  };

  const { data: campaign, error: campaignError } = await supabase
    .from('bulk_campaigns')
    .insert(insertObj)
    .select()
    .single();

  if (campaignError) {
    console.error('❌ LAUNCH ERROR:', campaignError);
  } else {
    console.log('✅ LAUNCH SUCCESS! Created bulk_campaign record:', campaign.id);
    await supabase.from('bulk_campaigns').delete().eq('id', campaign.id);
  }
}

testFullLaunch();
