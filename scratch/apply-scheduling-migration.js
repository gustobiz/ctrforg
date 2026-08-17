const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

const statements = [
  // 1. Add scheduled_at, send_window_start, send_window_end, send_window_tz, send_window_days to bulk_campaigns
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='scheduled_at') THEN ALTER TABLE public.bulk_campaigns ADD COLUMN scheduled_at TIMESTAMPTZ; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_start') THEN ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_start TEXT DEFAULT '09:00'; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_end') THEN ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_end TEXT DEFAULT '17:00'; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_tz') THEN ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_tz TEXT DEFAULT 'UTC'; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_days') THEN ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb; END IF; END $$;`,

  // 2. Add send_time, send_time_tz, thread_mode, subject_override, html_body_override to campaign_followup_rules
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaign_followup_rules' AND column_name='send_time') THEN ALTER TABLE public.campaign_followup_rules ADD COLUMN send_time TEXT DEFAULT '10:00'; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaign_followup_rules' AND column_name='send_time_tz') THEN ALTER TABLE public.campaign_followup_rules ADD COLUMN send_time_tz TEXT DEFAULT 'UTC'; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaign_followup_rules' AND column_name='thread_mode') THEN ALTER TABLE public.campaign_followup_rules ADD COLUMN thread_mode TEXT DEFAULT 'reply'; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaign_followup_rules' AND column_name='subject_override') THEN ALTER TABLE public.campaign_followup_rules ADD COLUMN subject_override TEXT; END IF; END $$;`,
  `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='campaign_followup_rules' AND column_name='html_body_override') THEN ALTER TABLE public.campaign_followup_rules ADD COLUMN html_body_override TEXT; END IF; END $$;`,

  // 3. Ensure email_queue table exists with necessary columns
  `CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    campaign_id UUID NOT NULL,
    lead_id UUID,
    email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,
  `CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_status ON public.email_queue(campaign_id, status);`,
  `CREATE INDEX IF NOT EXISTS idx_email_queue_scheduled_at ON public.email_queue(scheduled_at);`,

  // 4. Ensure followup_sequences table has necessary columns
  `CREATE TABLE IF NOT EXISTS public.followup_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    lead_id UUID,
    campaign_id UUID,
    rule_type TEXT,
    delay_days INT DEFAULT 3,
    followup_number INT DEFAULT 1,
    status TEXT DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    generated_content TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );`,

  // 5. PostgREST reload
  `NOTIFY pgrst, 'reload schema';`
];

async function run() {
  console.log(`Running migration against project ${projectRef}...`);
  for (const sql of statements) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ query: sql }),
      });
      const data = await res.json();
      console.log('Result for:', sql.slice(0, 60), '->', res.status, data);
    } catch (err) {
      console.error('Error running SQL:', err);
    }
  }
}

run().catch(console.error);
