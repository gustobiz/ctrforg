const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log('🔍 Checking crm_leads table schema in Supabase...');

  const { error: testErr } = await supabase.from('crm_leads').select('sheet_id').limit(1);

  if (testErr) {
    console.error('\n❌ SCHEMA ERROR DETECTED:');
    console.error('Code:', testErr.code);
    console.error('Message:', testErr.message);
    console.error('Details:', testErr.details);
    console.error('Hint:', testErr.hint);
    console.log('\n======================================================');
    console.log('CONFIRMED: The column "sheet_id" does NOT exist in the remote Supabase PostgreSQL database.');
    console.log('======================================================');
  } else {
    console.log('✅ Column "sheet_id" ALREADY exists in public.crm_leads table!');
  }
}

run();
