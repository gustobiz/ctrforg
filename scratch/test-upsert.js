const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';

const supabase = createClient(supabaseUrl, supabaseKey);

const ALLOWED_CRM_FIELDS = [
  'id',
  'user_id',
  'creator_name',
  'channel_name',
  'video_title',
  'video_url',
  'thumbnail_url',
  'subscriber_count',
  'view_count',
  'like_count',
  'published_at',
  'status',
  'created_at',
  'generated_outreach',
  'notes',
  'ai_analysis',
  'email',
  'contact_email',
  'website',
  'instagram',
  'twitter',
  'linkedin',
  'facebook',
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

const ALLOWED_SET = new Set(ALLOWED_CRM_FIELDS);

function sanitizeCRMLead(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const sanitized = {};
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_SET.has(key)) continue;
    const val = payload[key];
    if (val === undefined) continue;
    if (val === null) {
      sanitized[key] = null;
      continue;
    }
    if (['subscriber_count', 'view_count', 'like_count'].includes(key)) {
      sanitized[key] = typeof val === 'number' ? val : parseInt(val, 10) || 0;
      continue;
    }
    if (['email_verified', 'website_found', 'social_links_found'].includes(key)) {
      sanitized[key] = val === true || val === 'true';
      continue;
    }
    if (['lead_score', 'opportunity_score', 'thumbnail_opportunity'].includes(key)) {
      sanitized[key] = parseInt(val, 10) || 0;
      continue;
    }
    if (key === 'ai_analysis') {
      sanitized[key] = typeof val === 'object' ? val : {};
      continue;
    }
    sanitized[key] = val.toString();
  }
  return sanitized;
}

async function testUpsert() {
  const user_id = '48a612d9-d0ac-4c86-ad0a-75bb2f727001';
  
  const rawPayload = {
    user_id: user_id,
    creator_name: 'Test Creator',
    channel_name: 'Test Channel',
    subscriber_count: 1000,
    notes: 'Great hook',
    email: 'test@example.com',
    contact_email: 'test@example.com',
    website: null,
    status: 'new',
    contact_source: 'google_sheets',
    contact_status: 'imported',
    email_verified: true,
    website_found: false,
    ai_analysis: {
      contact_email: 'test@example.com',
      platform: 'email',
    },
  };

  console.log('--- Testing sanitizeCRMLead ---');
  const safePayload = sanitizeCRMLead(rawPayload);
  console.log('safePayload:', safePayload);

  console.log('--- Testing Supabase Upsert ---');
  const { data, error } = await supabase
    .from('crm_leads')
    .upsert(safePayload, { onConflict: 'user_id,creator_name' })
    .select();

  console.log('Upsert result:', { data, error });
}

testUpsert();
