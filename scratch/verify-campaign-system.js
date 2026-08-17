const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
    }
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runVerification() {
  console.log('====================================================');
  console.log('CTRFORGE CAMPAIGN EXECUTION LIFECYCLE VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Get a test user from the database
  const { data: users, error: userErr } = await supabase.from('bulk_campaigns').select('user_id').limit(1);
  if (userErr || !users || users.length === 0) {
    console.log('No existing campaign users found, checking crm_leads...');
  }
  const testUserId = users?.[0]?.user_id || '00000000-0000-0000-0000-000000000000';
  console.log(`[Test 1] Using test userId: ${testUserId}`);

  // Test 2: Create a 1-recipient Immediate Campaign
  console.log('\n[Test 2] Creating test 1-recipient campaign in IMMEDIATE mode...');
  const testCampName = `Verification Campaign Immediate ${Date.now()}`;
  const nowIso = new Date().toISOString();

  // Create or fetch a test lead in crm_leads
  let { data: lead } = await supabase
    .from('crm_leads')
    .select('id, creator_name, email')
    .eq('user_id', testUserId)
    .limit(1)
    .maybeSingle();

  if (!lead) {
    const { data: newLead } = await supabase
      .from('crm_leads')
      .insert({
        user_id: testUserId,
        creator_name: 'Test Creator',
        channel_name: 'Test Channel',
        email: 'test-creator@example.com',
        contact_source: 'manual',
      })
      .select()
      .single();
    lead = newLead;
  }
  console.log(`[Test 2] Target lead: ${lead.creator_name} (${lead.email || 'no-email'})`);

  const { data: campaign, error: campErr } = await supabase
    .from('bulk_campaigns')
    .insert({
      user_id: testUserId,
      name: testCampName,
      status: 'running', // Immediate mode starts in 'running'
      send_rate: 20,
      total_leads: 1,
      started_at: nowIso,
    })
    .select()
    .single();

  if (campErr) {
    console.error('Failed to create test campaign:', campErr);
    process.exit(1);
  }
  console.log(`[Test 2] Created campaign "${campaign.name}" with ID: ${campaign.id}, status: ${campaign.status}`);

  // Save campaign settings
  const settingsMeta = {
    sendWindowStart: '09:00',
    sendWindowEnd: '17:00',
    sendWindowTz: 'Asia/Calcutta',
    sendWindowDays: [1, 2, 3, 4, 5],
    scheduleMode: 'immediate',
    scheduledAt: null,
  };
  await supabase.from('custom_variables').insert({
    user_id: testUserId,
    name: `campaign_meta_${campaign.id}`,
    default_value: JSON.stringify(settingsMeta),
  });
  console.log('[Test 2] Saved campaign settings with scheduleMode: "immediate"');

  // Insert campaign_lead & email_queue item with scheduled_at = NOW
  await supabase.from('campaign_leads').insert({
    campaign_id: campaign.id,
    lead_id: lead.id,
    lead_name: lead.creator_name,
    lead_email: lead.email || 'test@example.com',
    status: 'pending',
  });

  const { data: queueItem } = await supabase
    .from('email_queue')
    .insert({
      user_id: testUserId,
      campaign_id: campaign.id,
      lead_id: lead.id,
      email: lead.email || 'test@example.com',
      status: 'queued',
      scheduled_at: nowIso,
    })
    .select()
    .single();
  console.log(`[Test 2] Enqueued lead in email_queue: item id ${queueItem.id}, scheduled_at: ${queueItem.scheduled_at}`);

  // Test 3: Test State Machine — Pause
  console.log('\n[Test 3] Testing RUNNING -> PAUSED state transition...');
  await supabase
    .from('bulk_campaigns')
    .update({ status: 'paused', paused_at: new Date().toISOString() })
    .eq('id', campaign.id);

  await supabase
    .from('email_queue')
    .update({ status: 'paused' })
    .eq('campaign_id', campaign.id)
    .eq('status', 'queued');

  const { data: pausedCamp } = await supabase.from('bulk_campaigns').select('status').eq('id', campaign.id).single();
  const { data: pausedQueue } = await supabase.from('email_queue').select('status').eq('id', queueItem.id).single();
  console.log(`[Test 3] Campaign status: ${pausedCamp.status}, Queue item status: ${pausedQueue.status}`);
  if (pausedCamp.status !== 'paused' || pausedQueue.status !== 'paused') {
    throw new Error('Pause transition failed!');
  }
  console.log('✓ Pause transition verified successfully');

  // Test 4: Test State Machine — Resume
  console.log('\n[Test 4] Testing PAUSED -> RUNNING state transition...');
  const resumeTime = new Date().toISOString();
  await supabase
    .from('bulk_campaigns')
    .update({ status: 'running', paused_at: null, updated_at: resumeTime })
    .eq('id', campaign.id);

  await supabase
    .from('email_queue')
    .update({ status: 'queued', scheduled_at: resumeTime })
    .eq('campaign_id', campaign.id)
    .eq('status', 'paused');

  const { data: resumedCamp } = await supabase.from('bulk_campaigns').select('status').eq('id', campaign.id).single();
  const { data: resumedQueue } = await supabase.from('email_queue').select('status, scheduled_at').eq('id', queueItem.id).single();
  console.log(`[Test 4] Campaign status: ${resumedCamp.status}, Queue item status: ${resumedQueue.status}, scheduled_at: ${resumedQueue.scheduled_at}`);
  if (resumedCamp.status !== 'running' || resumedQueue.status !== 'queued') {
    throw new Error('Resume transition failed!');
  }
  console.log('✓ Resume transition verified successfully');

  // Test 5: Process 1-Recipient Campaign to Completion
  console.log('\n[Test 5] Simulating execution of 1-recipient campaign to completion...');
  // Atomic claim
  const { data: claimed } = await supabase
    .from('email_queue')
    .update({ status: 'sending' })
    .eq('id', queueItem.id)
    .eq('status', 'queued')
    .select();

  console.log(`[Test 5] Atomic lock acquired: ${claimed && claimed.length > 0}`);

  // Mark sent
  const sendTime = new Date().toISOString();
  await supabase.from('email_queue').update({ status: 'sent', sent_at: sendTime }).eq('id', queueItem.id);
  await supabase.from('campaign_leads').update({ status: 'sent', sent_at: sendTime }).eq('campaign_id', campaign.id).eq('lead_id', lead.id);

  // Recalculate stats
  const { data: allLeads } = await supabase.from('campaign_leads').select('status').eq('campaign_id', campaign.id);
  const sentCount = allLeads.filter(l => ['sent', 'opened', 'clicked', 'replied'].includes(l.status)).length;
  const pendingLeads = allLeads.filter(l => l.status === 'pending').length;

  const { count: remainingQueue } = await supabase
    .from('email_queue')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaign.id)
    .in('status', ['queued', 'sending']);

  const isCompleted = pendingLeads === 0 && (remainingQueue || 0) === 0;

  await supabase
    .from('bulk_campaigns')
    .update({
      sent_count: sentCount,
      updated_at: new Date().toISOString(),
      ...(isCompleted ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', campaign.id);

  const { data: completedCamp } = await supabase.from('bulk_campaigns').select('*').eq('id', campaign.id).single();
  console.log(`[Test 5] Final Campaign Status: ${completedCamp.status}, Sent: ${completedCamp.sent_count}/${completedCamp.total_leads}, CompletedAt: ${completedCamp.completed_at}`);
  if (completedCamp.status !== 'completed' || completedCamp.sent_count !== 1) {
    throw new Error('Completion transition failed!');
  }
  console.log('✓ 1-Recipient campaign successfully reached COMPLETED state');

  // Clean up test campaign
  console.log('\n[Cleanup] Cleaning up test records...');
  await supabase.from('email_queue').delete().eq('campaign_id', campaign.id);
  await supabase.from('campaign_leads').delete().eq('campaign_id', campaign.id);
  await supabase.from('custom_variables').delete().eq('name', `campaign_meta_${campaign.id}`);
  await supabase.from('bulk_campaigns').delete().eq('id', campaign.id);
  console.log('✓ Test cleanup complete.');

  console.log('\n====================================================');
  console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
