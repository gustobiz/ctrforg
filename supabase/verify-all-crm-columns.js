const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const requiredColumns = [
  'id',
  'user_id',
  'creator_name',
  'channel_name',
  'video_title',
  'video_url',
  'subscriber_count',
  'status',
  'created_at',
  'sheet_id',
  'csv_batch_id',
  'email',
  'contact_email',
  'website',
  'contact_source',
  'contact_status',
  'email_verified',
  'website_found',
  'social_links_found',
  'lead_score',
  'opportunity_score',
  'thumbnail_opportunity',
  'last_updated'
];

async function checkColumns() {
  console.log('📊 Auditing columns on public.crm_leads table in Supabase...\n');
  const missing = [];
  const existing = [];

  for (const col of requiredColumns) {
    const { error } = await supabase.from('crm_leads').select(col).limit(1);
    if (error && error.code === '42703') {
      missing.push(col);
      console.log(`❌ Column "${col}": MISSING in DB`);
    } else if (error) {
      console.log(`⚠️ Column "${col}": Query Error (${error.message})`);
    } else {
      existing.push(col);
      console.log(`✅ Column "${col}": EXISTS in DB`);
    }
  }

  console.log('\n======================================================');
  console.log(`SUMMARY: ${existing.length} columns exist, ${missing.length} columns MISSING.`);
  console.log('Missing columns:', missing);
  console.log('======================================================');
}

checkColumns();
