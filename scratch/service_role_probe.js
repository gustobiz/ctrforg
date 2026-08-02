const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(url, serviceRoleKey);

const targetTables = [
  'bulk_campaigns',
  'campaign_leads',
  'campaign_followup_rules',
  'email_queue',
  'inbox_messages',
  'gmail_warmup',
  'deliverability_checks',
  'sheets_connections'
];

async function checkWithServiceRole() {
  console.log('=== SERVICE ROLE LIVE DATABASE PROBE ===\n');

  for (const t of targetTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table '${t}': ERROR ->`, error.code, error.message);
    } else {
      console.log(`Table '${t}': EXISTS & ACCESSIBLE VIA SERVICE ROLE! Count:`, data.length);
    }
  }

  // Also query known tables
  console.log('\n--- Checking Reference Tables ---');
  for (const t of ['crm_leads', 'email_templates', 'email_campaigns']) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table '${t}': ERROR ->`, error.code, error.message);
    } else {
      console.log(`Table '${t}': EXISTS & ACCESSIBLE! Count:`, data.length);
    }
  }
}

checkWithServiceRole().catch(console.error);
