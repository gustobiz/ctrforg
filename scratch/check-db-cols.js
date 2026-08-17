const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY']);

async function checkColumns() {
  const testCampaign = {
    user_id: '86ac27b6-9c49-41fd-b90b-28de6e6c8c48',
    name: 'Schema Test Campaign',
    status: 'draft',
    scheduled_at: new Date().toISOString(),
    send_window_start: '09:00',
    send_window_end: '17:00',
    send_window_tz: 'America/New_York',
    send_window_days: [1, 2, 3, 4, 5]
  };

  const { data, error } = await supabase.from('bulk_campaigns').insert(testCampaign).select();
  console.log('Insert test with scheduling fields:', { data, error });

  if (data && data[0]) {
    await supabase.from('bulk_campaigns').delete().eq('id', data[0].id);
    console.log('Cleaned up test campaign.');
  }

  // Also test campaign_followup_rules columns
  const testRule = {
    campaign_id: 'aad2fd1b-0cdd-419e-9caf-109c0b8932db',
    step_number: 999,
    delay_days: 3,
    rule_type: 'not_opened',
    send_time: '10:00',
    send_time_tz: 'America/New_York',
    thread_mode: 'reply',
    subject_override: 'Test Subject',
    html_body_override: 'Test Body'
  };
  const { data: ruleData, error: ruleError } = await supabase.from('campaign_followup_rules').insert(testRule).select();
  console.log('Insert test with followup rule fields:', { ruleData, ruleError });

  if (ruleData && ruleData[0]) {
    await supabase.from('campaign_followup_rules').delete().eq('id', ruleData[0].id);
  }
}

checkColumns().catch(console.error);
