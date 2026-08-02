// Phase 2: Determine which tables PHYSICALLY EXIST vs are just missing GRANTs
// PGRST205 = table not in schema cache (either doesn't exist OR exists but no GRANT)
// Strategy: probe all known tables from migrations to see what PostgREST can see
// Also use the Supabase management API if service key is available

const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const anonKey = 'sb_publishable_3AeNb3z5aIllOWQ6JdZUZA_ZAshHQgQ';

// All tables that should exist per migrations
const allTables = [
  'crm_leads',              // known to exist (reference)
  'email_templates',        // known to exist (reference)
  'email_campaigns',        // from email_outreach_tables.sql
  'email_events',           // from email_outreach_tables.sql
  'followup_sequences',     // from email_outreach_tables.sql
  'gmail_connections',      // from email_outreach_tables.sql
  'custom_variables',       // from campaign_platform_migration.sql
  // THE 8 UNDER TEST:
  'bulk_campaigns',
  'campaign_leads',
  'campaign_followup_rules',
  'email_queue',
  'inbox_messages',
  'gmail_warmup',
  'deliverability_checks',
  'sheets_connections'
];

async function fullProbe() {
  console.log('=== PHASE 2: FULL TABLE EXISTENCE PROBE ===\n');
  console.log('Hint from PGRST205 errors reveals which tables PostgREST CAN see:');
  console.log('  bulk_campaigns    => hint: email_campaigns (EXISTS in schema cache)');
  console.log('  campaign_leads    => hint: crm_leads (EXISTS in schema cache)');
  console.log('  campaign_followup_rules => hint: followup_sequences (EXISTS in schema cache)');
  console.log('  email_queue       => hint: email_events (EXISTS in schema cache)');
  console.log('  inbox_messages    => hint: email_templates (EXISTS in schema cache)');
  console.log('  gmail_warmup      => hint: email_events (EXISTS in schema cache)');
  console.log('  deliverability_checks => hint: email_events (EXISTS in schema cache)');
  console.log('  sheets_connections => hint: gmail_connections (EXISTS in schema cache)');
  console.log('');
  console.log('CONCLUSION: PostgREST knows about email_campaigns, crm_leads,');
  console.log('            followup_sequences, email_events, email_templates,');
  console.log('            gmail_connections — but NOT the 8 target tables.');
  console.log('');

  console.log('--- Probing ALL tables for PostgREST visibility ---\n');
  
  const visible = [];
  const missing = [];
  
  for (const t of allTables) {
    const r = await fetch(url + '/rest/v1/' + t + '?limit=0', {
      headers: { 'apikey': anonKey, 'Authorization': 'Bearer ' + anonKey }
    });
    const body = await r.text();
    let code = '';
    try { code = JSON.parse(body)?.code || ''; } catch(e){}
    
    const accessible = r.status === 200 || r.status === 206;
    if (accessible) visible.push(t);
    else missing.push({ table: t, code, status: r.status });
    
    console.log(`${t.padEnd(30)} HTTP ${r.status}  ${accessible ? '✓ VISIBLE' : '✗ ' + code}`);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log(`\nTables VISIBLE to PostgREST (${visible.length}):`, visible);
  console.log(`\nTables NOT VISIBLE (${missing.length}):`, missing.map(m => m.table));
  
  console.log('\n=== ROOT CAUSE ANALYSIS ===');
  console.log('PGRST205 = "Could not find the table in the schema cache"');
  console.log('This error means ONE of two things:');
  console.log('  A) Table does not physically exist in PostgreSQL');
  console.log('  B) Table exists but is not GRANTed to anon/authenticated roles');
  console.log('');
  console.log('The HINTS in the PGRST205 error are crucial:');
  console.log('  - PostgreSQL suggests similar table names ONLY from the schema cache');
  console.log('  - If "bulk_campaigns" does not exist, PG would not suggest "email_campaigns"');
  console.log('  - The hints confirm those alternative tables ARE in the cache');
  console.log('  - But the 8 target tables are NOT in cache => they are NOT GRANTED');
  console.log('    OR they do not physically exist.');
  console.log('');
  console.log('Since Supabase PostgREST schema cache = tables with GRANT to anon role,');
  console.log('PGRST205 does NOT definitively tell us if the table physically exists.');
  console.log('A table can exist in pg_tables but not appear to PostgREST.');
  console.log('');
  console.log('To know for CERTAIN, we need to query pg_tables directly,');
  console.log('which requires the service role key (not available in .env.local).');
}

fullProbe().catch(console.error);
