const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://evgsdlaskqrlzjfpmfbx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z3NkbGFza3FybHpqZnBtZmJ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTI0MTcxNCwiZXhwIjoyMDk0ODE3NzE0fQ.jthyus-4JvdW848pa1De4iGL6aErQqx5L_3F3srGrI4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulatePipeline() {
  console.log('=== STEP 1: Google Sheets API ===');
  // Simulated row data from Google Sheets API
  const apiResponse = {
    range: "Sheet1!A1:Z500",
    majorDimension: "ROWS",
    values: [
      ["FirstName", "ChannelName", "Email", "VideoTitle", "VideoLink", "Niche", "SpecificThing"],
      ["Sarah Jenkins", "Sarah Tech", "sarah@example.com", "Mastering Next.js 15", "https://youtube.com/watch?v=next15demo", "Software Development", "Loved the practical code examples"]
    ]
  };
  const rows = apiResponse.values;
  console.log('• rows received:', rows.length);

  console.log('\n=== STEP 2: /api/sheets/connect ===');
  const user_id = '48a612d9-d0ac-4c86-ad0a-75bb2f727001';
  console.log('• Connection target user_id:', user_id);

  console.log('\n=== STEP 3: /api/sheets/sync ===');
  console.log('• Processing rows...');

  console.log('\n=== STEP 4: Spreadsheet Parser ===');
  const headers = rows[0].map(h => (h ? h.toString().trim().toLowerCase() : ''));
  console.log('• parsed headers:', headers);
  console.log('• parsed values:', rows[1]);

  console.log('\n=== STEP 5: Column Mapper ===');
  const mapping = { name: 'Name', email: 'Email', channel: 'Channel', subscribers: 'Subscribers', notes: 'Notes' };

  // Current getIndex implementation in route.ts:
  const getIndex = (key, defaultName) => {
    const preferred = (mapping[key] || defaultName).toLowerCase();
    let idx = headers.indexOf(preferred);
    if (idx !== -1) return idx;
    idx = headers.findIndex(h => h && (h.includes(preferred) || preferred.includes(h)));
    if (idx !== -1) return idx;
    if (key === 'name') {
      return headers.findIndex(h => h.includes('name') || h.includes('creator') || h.includes('lead') || h.includes('contact') || h.includes('title'));
    }
    if (key === 'email') {
      return headers.findIndex(h => h.includes('email') || h.includes('mail') || h.includes('contact'));
    }
    if (key === 'channel') {
      return headers.findIndex(h => h.includes('channel') || h.includes('youtube') || h.includes('account') || h.includes('company'));
    }
    if (key === 'subscribers') {
      return headers.findIndex(h => h.includes('subscriber') || h.includes('subs') || h.includes('count') || h.includes('followers'));
    }
    if (key === 'notes') {
      return headers.findIndex(h => h.includes('note') || h.includes('info') || h.includes('desc') || h.includes('comment'));
    }
    if (key === 'website') {
      return headers.findIndex(h => h.includes('website') || h.includes('url') || h.includes('link') || h.includes('site'));
    }
    return -1;
  };

  const nameIdx = getIndex('name', 'Name');
  const emailIdx = getIndex('email', 'Email');
  const channelIdx = getIndex('channel', 'Channel');
  const subIdx = getIndex('subscribers', 'Subscribers');
  const notesIdx = getIndex('notes', 'Notes');
  const websiteIdx = getIndex('website', 'Website');

  console.log('• Column Indices:', { nameIdx, emailIdx, channelIdx, subIdx, notesIdx, websiteIdx });
  console.log('• Mapped Values with current route.ts code:');
  console.log('  - creatorName:', nameIdx !== -1 ? rows[1][nameIdx] : undefined);
  console.log('  - channelName:', channelIdx !== -1 ? rows[1][channelIdx] : undefined);
  console.log('  - email:', emailIdx !== -1 ? rows[1][emailIdx] : undefined);
  console.log('  - website:', websiteIdx !== -1 ? rows[1][websiteIdx] : undefined);
  console.log('  - notes:', notesIdx !== -1 ? rows[1][notesIdx] : undefined);
  console.log('  - videoTitle:', 'NOT MAPPED');
  console.log('  - videoUrl:', 'NOT MAPPED');
  console.log('  - niche:', 'NOT MAPPED');
  console.log('  - specificThing:', 'NOT MAPPED');

  console.log('\n=== STEP 6: crm_leads insert/upsert ===');
  const rawPayload = {
    user_id: user_id,
    creator_name: rows[1][nameIdx],
    channel_name: rows[1][channelIdx],
    subscriber_count: 0,
    notes: notesIdx !== -1 ? rows[1][notesIdx] : '',
    email: rows[1][emailIdx],
    contact_email: rows[1][emailIdx],
    website: websiteIdx !== -1 ? rows[1][websiteIdx] : null,
    status: 'new',
    contact_source: 'google_sheets',
    contact_status: 'imported',
    email_verified: Boolean(rows[1][emailIdx] && rows[1][emailIdx].includes('@')),
    website_found: Boolean(websiteIdx !== -1),
    ai_analysis: {
      contact_email: rows[1][emailIdx],
      website: websiteIdx !== -1 ? rows[1][websiteIdx] : null,
      platform: 'email',
    },
  };
  console.log('• SQL insert payload:', rawPayload);

  const { data: upsertData, error: upsertError } = await supabase
    .from('crm_leads')
    .upsert(rawPayload, { onConflict: 'user_id,creator_name' })
    .select();

  console.log('• rows inserted:', upsertData ? upsertData.length : 0);
  if (upsertError) console.error('  DB Error:', upsertError);

  console.log('\n=== STEP 7: Campaign Wizard query ===');
  const { data: wizardLeads, error: queryError } = await supabase
    .from('crm_leads')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('• rows returned:', wizardLeads?.length);
  const found = wizardLeads?.find(l => l.creator_name === 'Sarah Jenkins');
  console.log('• Imported lead in Campaign Wizard query:', found);
}

simulatePipeline();
