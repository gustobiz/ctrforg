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

async function probeFollowupRules() {
  const possibleCols = ['id', 'campaign_id', 'step_number', 'delay_days', 'rule_type', 'template_id', 'use_ai_generation', 'thread_mode', 'send_time', 'send_time_tz', 'subject_override', 'html_body_override', 'created_at'];
  for (const col of possibleCols) {
    const { error } = await supabase.from('campaign_followup_rules').select(col).limit(1);
    console.log(`Column ${col}:`, error ? `MISSING (${error.message})` : 'EXISTS');
  }

  const campaignCols = ['id', 'user_id', 'name', 'status', 'template_id', 'subject_override', 'html_body_override', 'send_rate', 'random_delay_min', 'random_delay_max', 'total_leads', 'sent_count', 'opened_count', 'clicked_count', 'replied_count', 'bounced_count', 'started_at', 'paused_at', 'completed_at', 'created_at', 'updated_at', 'gmail_label_id', 'scheduled_at', 'send_window_start', 'send_window_end', 'send_window_tz', 'send_window_days'];
  for (const col of campaignCols) {
    const { error } = await supabase.from('bulk_campaigns').select(col).limit(1);
    console.log(`bulk_campaigns Column ${col}:`, error ? `MISSING (${error.message})` : 'EXISTS');
  }
}

probeFollowupRules().catch(console.error);
