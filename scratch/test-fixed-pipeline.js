const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';
const supabase = createClient(supabaseUrl, supabaseKey);

const ALLOWED_CRM_FIELDS = [
  'id', 'user_id', 'creator_name', 'channel_name', 'video_title', 'video_url',
  'thumbnail_url', 'subscriber_count', 'view_count', 'like_count', 'published_at',
  'status', 'created_at', 'generated_outreach', 'notes', 'ai_analysis', 'email',
  'contact_email', 'website', 'instagram', 'twitter', 'linkedin', 'facebook',
  'contact_source', 'contact_status', 'email_verified', 'website_found',
  'social_links_found', 'lead_score', 'opportunity_score', 'thumbnail_opportunity', 'last_updated'
];
const ALLOWED_SET = new Set(ALLOWED_CRM_FIELDS);

function sanitizeCRMLead(payload) {
  if (!payload || typeof payload !== 'object') return {};
  const sanitized = {};
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_SET.has(key)) continue;
    const val = payload[key];
    if (val === undefined) continue;
    if (val === null) { sanitized[key] = null; continue; }
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

async function runFixedPipeline() {
  console.log('=== STEP 1: Google Sheets API ===');
  const rows = [
    ["FirstName", "ChannelName", "Email", "VideoTitle", "VideoLink", "Niche", "SpecificThing"],
    ["Sarah Jenkins", "Sarah Tech", "sarah@example.com", "Mastering Next.js 15", "https://youtube.com/watch?v=next15demo", "Software Development", "Loved the practical code examples"]
  ];
  console.log('• rows received:', rows.length);

  console.log('\n=== STEP 2: /api/sheets/connect ===');
  const user_id = '48a612d9-d0ac-4c86-ad0a-75bb2f727001';

  console.log('\n=== STEP 3: /api/sheets/sync ===');

  console.log('\n=== STEP 4: Spreadsheet Parser ===');
  const headers = rows[0].map(h => (h ? h.toString().trim().toLowerCase() : ''));
  console.log('• parsed headers:', headers);
  console.log('• parsed values:', rows[1]);

  console.log('\n=== STEP 5: Column Mapper ===');
  const mapping = { name: 'Name', email: 'Email', channel: 'Channel', subscribers: 'Subscribers', notes: 'Notes' };

  const getIndex = (key, defaultName) => {
    const preferred = (mapping[key] || defaultName).toLowerCase();
    let idx = headers.indexOf(preferred);
    if (idx !== -1) return idx;
    idx = headers.findIndex(h => h && (h.includes(preferred) || preferred.includes(h)));
    if (idx !== -1) return idx;

    if (key === 'name') {
      return headers.findIndex(h => h.includes('firstname') || h.includes('first_name') || h.includes('first name') || h.includes('name') || h.includes('creator') || h.includes('lead') || h.includes('contact'));
    }
    if (key === 'email') {
      return headers.findIndex(h => h.includes('email') || h.includes('mail'));
    }
    if (key === 'channel') {
      return headers.findIndex(h => h.includes('channel') || h.includes('youtube') || h.includes('account') || h.includes('company'));
    }
    if (key === 'video_title') {
      return headers.findIndex(h => h.includes('videotitle') || h.includes('video_title') || h.includes('video title') || (h.includes('video') && h.includes('title')) || h.includes('title'));
    }
    if (key === 'video_url') {
      return headers.findIndex(h => h.includes('videolink') || h.includes('video_link') || h.includes('video link') || h.includes('videourl') || h.includes('video_url') || h.includes('video url') || (h.includes('video') && (h.includes('link') || h.includes('url'))));
    }
    if (key === 'niche') {
      return headers.findIndex(h => h.includes('niche') || h.includes('category') || h.includes('topic') || h.includes('industry'));
    }
    if (key === 'specific_thing' || key === 'notes') {
      return headers.findIndex(h => h.includes('specificthing') || h.includes('specific_thing') || h.includes('specific thing') || h.includes('specific') || h.includes('note') || h.includes('info') || h.includes('desc') || h.includes('comment'));
    }
    if (key === 'subscribers') {
      return headers.findIndex(h => h.includes('subscriber') || h.includes('subs') || h.includes('count') || h.includes('followers'));
    }
    if (key === 'website') {
      return headers.findIndex(h => (h.includes('website') || h.includes('site')) && !h.includes('video'));
    }
    return -1;
  };

  const nameIdx = getIndex('name', 'Name');
  const emailIdx = getIndex('email', 'Email');
  const channelIdx = getIndex('channel', 'Channel');
  const videoTitleIdx = getIndex('video_title', 'VideoTitle');
  const videoUrlIdx = getIndex('video_url', 'VideoLink');
  const nicheIdx = getIndex('niche', 'Niche');
  const specificThingIdx = getIndex('specific_thing', 'SpecificThing');
  const subIdx = getIndex('subscribers', 'Subscribers');
  const notesIdx = getIndex('notes', 'Notes');
  const websiteIdx = getIndex('website', 'Website');

  const row = rows[1];
  const creatorName = (nameIdx !== -1 && row[nameIdx]) ? row[nameIdx].toString().trim() : (channelIdx !== -1 && row[channelIdx] ? row[channelIdx].toString().trim() : (emailIdx !== -1 && row[emailIdx] ? row[emailIdx].toString().split('@')[0].trim() : ''));
  const emailVal = emailIdx !== -1 && row[emailIdx] ? row[emailIdx].toString().trim() : '';
  const channelVal = channelIdx !== -1 && row[channelIdx] ? row[channelIdx].toString().trim() : creatorName;
  const videoTitleVal = videoTitleIdx !== -1 && row[videoTitleIdx] ? row[videoTitleIdx].toString().trim() : '';
  const videoUrlVal = videoUrlIdx !== -1 && row[videoUrlIdx] ? row[videoUrlIdx].toString().trim() : '';
  const nicheVal = nicheIdx !== -1 && row[nicheIdx] ? row[nicheIdx].toString().trim() : '';
  const specificThingVal = specificThingIdx !== -1 && row[specificThingIdx] ? row[specificThingIdx].toString().trim() : (notesIdx !== -1 && row[notesIdx] ? row[notesIdx].toString().trim() : '');

  const mappedObject = {
    creatorName,
    channelName: channelVal,
    email: emailVal,
    videoTitle: videoTitleVal,
    videoUrl: videoUrlVal,
    niche: nicheVal,
    specificThing: specificThingVal,
  };
  console.log('• mapped object:', mappedObject);

  console.log('\n=== STEP 6: crm_leads insert/upsert ===');
  const rawPayload = {
    user_id: user_id,
    creator_name: creatorName,
    channel_name: channelVal || creatorName,
    video_title: videoTitleVal || null,
    video_url: videoUrlVal || null,
    subscriber_count: 0,
    notes: specificThingVal || '',
    email: emailVal || null,
    contact_email: emailVal || null,
    website: (websiteIdx !== -1 && row[websiteIdx]) ? row[websiteIdx].toString().trim() : null,
    status: 'new',
    contact_source: 'google_sheets',
    contact_status: 'imported',
    email_verified: Boolean(emailVal && emailVal.includes('@')),
    website_found: false,
    ai_analysis: {
      contact_email: emailVal,
      platform: 'email',
      creator_niche: nicheVal || '',
      notes: specificThingVal || '',
      specific_thing: specificThingVal || '',
    },
  };
  const safePayload = sanitizeCRMLead(rawPayload);
  console.log('• SQL insert payload:', safePayload);

  const { data: upsertData, error: upsertError } = await supabase
    .from('crm_leads')
    .upsert(safePayload, { onConflict: 'user_id,creator_name' })
    .select();

  console.log('• rows inserted:', upsertData ? upsertData.length : 0);

  console.log('\n=== STEP 7: Campaign Wizard query ===');
  const { data: wizardLeads } = await supabase
    .from('crm_leads')
    .select('*')
    .order('created_at', { ascending: false });

  const importedLead = wizardLeads?.find(l => l.creator_name === creatorName);
  console.log('• rows returned:', wizardLeads?.length);
  console.log('• final CRM query lead:', importedLead);
}

runFixedPipeline();
