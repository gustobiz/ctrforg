import { NextResponse } from 'next/server';

/**
 * One-shot migration runner — applies fix_email_templates_schema.sql
 * DELETE THIS FILE after the migration is confirmed applied.
 * 
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 * Visit: http://localhost:3000/api/admin/run-migration
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey === 'your_service_role_key_here') {
    return NextResponse.json({
      error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.',
      action: 'Add your service_role key to .env.local, then restart next dev and visit this URL again.',
      where: 'Supabase Dashboard → Project Settings → API → service_role (secret)',
      dashboard: 'https://supabase.com/dashboard/project/evgsdlaskqrlzjfpmfbx/settings/api',
    }, { status: 500 });
  }

  // Extract project ref from URL: https://[ref].supabase.co
  const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

  const statements = [
    // 1. category
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='category') THEN ALTER TABLE public.email_templates ADD COLUMN category TEXT NOT NULL DEFAULT 'custom'; END IF; END $$`,
    // 2. is_shared
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='is_shared') THEN ALTER TABLE public.email_templates ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false; END IF; END $$`,
    // 3. variables
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='variables') THEN ALTER TABLE public.email_templates ADD COLUMN variables JSONB NOT NULL DEFAULT '["creator_name","channel_name","latest_video"]'; END IF; END $$`,
    // 4. text_body
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='text_body') THEN ALTER TABLE public.email_templates ADD COLUMN text_body TEXT NOT NULL DEFAULT ''; END IF; END $$`,
    // 5. is_default
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='is_default') THEN ALTER TABLE public.email_templates ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false; END IF; END $$`,
    // 6. custom_variables table
    `CREATE TABLE IF NOT EXISTS public.custom_variables (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, name TEXT NOT NULL, default_value TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id, name))`,
    `ALTER TABLE public.custom_variables ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_variables' AND policyname='Users manage own variables') THEN CREATE POLICY "Users manage own variables" ON public.custom_variables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); END IF; END $$`,
    // 7. PostgREST cache reload
    `NOTIFY pgrst, 'reload schema'`,
  ];

  const results: any[] = [];
  const errors: any[] = [];

  for (const sql of statements) {
    try {
      // Use the Supabase Management API to run arbitrary SQL
      const res = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ query: sql }),
        }
      );

      const data = await res.json().catch(() => ({ raw: res.status }));

      if (!res.ok) {
        // Some statements (like NOTIFY) may return non-200 but still succeed
        errors.push({ sql: sql.slice(0, 80), status: res.status, error: data });
      } else {
        results.push({ sql: sql.slice(0, 80), ok: true });
      }
    } catch (err: any) {
      errors.push({ sql: sql.slice(0, 80), error: err.message });
    }
  }

  // Verify: check which columns now exist
  let schemaCheck: any = null;
  try {
    const verifyRes = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' ORDER BY ordinal_position`,
        }),
      }
    );
    schemaCheck = await verifyRes.json();
  } catch {}

  return NextResponse.json({
    success: errors.length === 0,
    applied: results.length,
    errors,
    results,
    schema_after: schemaCheck,
  });
}
