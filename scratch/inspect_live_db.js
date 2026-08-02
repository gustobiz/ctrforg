const { createClient } = require('@supabase/supabase-js');

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(url, serviceRoleKey);

const candidateTables = [
  'crm_leads',
  'email_templates',
  'email_campaigns',
  'email_events',
  'followup_sequences',
  'gmail_connections',
  'custom_variables',
  'bulk_campaigns',
  'campaign_leads',
  'campaign_followup_rules',
  'email_queue',
  'inbox_messages',
  'gmail_warmup',
  'deliverability_checks',
  'sheets_connections',
  'subscriptions',
  'audit_logs'
];

async function inspectLiveDb() {
  console.log('=== COMPREHENSIVE LIVE DATABASE INSPECTION ===\n');

  const liveState = {};

  for (const t of candidateTables) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      if (error) {
        liveState[t] = { exists: false, error: error.message, code: error.code };
      } else {
        const sampleRow = data && data.length > 0 ? data[0] : null;
        const columns = sampleRow ? Object.keys(sampleRow) : [];
        liveState[t] = { exists: true, sampleCount: data.length, columns };
      }
    } catch (e) {
      liveState[t] = { exists: false, error: e.message };
    }
  }

  console.log(JSON.stringify(liveState, null, 2));
}

inspectLiveDb().catch(console.error);
