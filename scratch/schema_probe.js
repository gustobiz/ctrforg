const url = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const key = 'sb_publishable_3AeNb3z5aIllOWQ6JdZUZA_ZAshHQgQ';
const tables = [
  'bulk_campaigns',
  'campaign_leads',
  'campaign_followup_rules',
  'email_queue',
  'inbox_messages',
  'gmail_warmup',
  'deliverability_checks',
  'sheets_connections'
];

async function probe() {
  console.log('=== LIVE DATABASE SCHEMA PROBE ===\n');
  
  const results = {};

  // 1. PostgREST visibility check — try HEAD request on each table
  for (const t of tables) {
    try {
      const r = await fetch(url + '/rest/v1/' + t + '?limit=0', {
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key,
          'Prefer': 'count=none'
        }
      });
      const body = await r.text();
      results[t] = { status: r.status, body: body.substring(0, 300) };
    } catch (e) {
      results[t] = { status: 'ERROR', body: e.message };
    }
  }

  console.log('--- PostgREST HTTP Status for each table ---');
  for (const [t, v] of Object.entries(results)) {
    let accessible = v.status === 200 || v.status === 206;
    let exists = !(v.body && v.body.includes('PGRST205'));
    let notFound = v.body && v.body.includes('PGRST116');
    let code = '';
    try { code = JSON.parse(v.body)?.code || ''; } catch(e){}
    
    console.log(`\nTable: ${t}`);
    console.log(`  HTTP Status: ${v.status}`);
    console.log(`  PostgREST Code: ${code}`);
    console.log(`  PostgREST Accessible: ${accessible ? 'YES' : 'NO'}`);
    console.log(`  Body: ${v.body}`);
  }

  // 2. Try to use information_schema via RPC (if available)
  console.log('\n--- Trying information_schema check via RPC ---');
  try {
    const rpcResp = await fetch(url + '/rest/v1/rpc/check_schema', {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    console.log('RPC status:', rpcResp.status, await rpcResp.text());
  } catch(e) {
    console.log('RPC not available:', e.message);
  }

  // 3. Check email_templates (known table) for comparison
  console.log('\n--- Reference: email_templates (should be accessible) ---');
  try {
    const r = await fetch(url + '/rest/v1/email_templates?limit=1', {
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    console.log('email_templates HTTP:', r.status, (await r.text()).substring(0, 200));
  } catch(e) {
    console.log('email_templates error:', e.message);
  }

  // 4. Check crm_leads (expected to exist)
  console.log('\n--- Reference: crm_leads (should be accessible) ---');
  try {
    const r = await fetch(url + '/rest/v1/crm_leads?limit=1', {
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    });
    console.log('crm_leads HTTP:', r.status, (await r.text()).substring(0, 200));
  } catch(e) {
    console.log('crm_leads error:', e.message);
  }
}

probe().catch(console.error);
