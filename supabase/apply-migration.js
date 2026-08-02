#!/usr/bin/env node
/**
 * One-shot migration script for CTRForge email_templates fix.
 * 
 * Usage:
 *   $env:PGPASSWORD="your-db-password"; node supabase/apply-migration.js
 * 
 * Or set DB_URL directly:
 *   $env:DB_URL="postgresql://postgres:[PASSWORD]@db.evgsdlaskqrlzjfpmfbx.supabase.co:5432/postgres"
 *   node supabase/apply-migration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SQL = `
-- 1. Add 'category' column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='category') THEN
    ALTER TABLE public.email_templates ADD COLUMN category TEXT NOT NULL DEFAULT 'custom';
    RAISE NOTICE 'Added: category';
  ELSE
    RAISE NOTICE 'Already exists: category';
  END IF;
END $$;

-- 2. Add 'is_shared' column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='is_shared') THEN
    ALTER TABLE public.email_templates ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added: is_shared';
  ELSE
    RAISE NOTICE 'Already exists: is_shared';
  END IF;
END $$;

-- 3. Add 'variables' column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='variables') THEN
    ALTER TABLE public.email_templates ADD COLUMN variables JSONB NOT NULL DEFAULT '["creator_name","channel_name","latest_video"]'::jsonb;
    RAISE NOTICE 'Added: variables';
  ELSE
    RAISE NOTICE 'Already exists: variables';
  END IF;
END $$;

-- 4. Add 'text_body' column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='text_body') THEN
    ALTER TABLE public.email_templates ADD COLUMN text_body TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added: text_body';
  ELSE
    RAISE NOTICE 'Already exists: text_body';
  END IF;
END $$;

-- 5. Add 'is_default' column if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='email_templates' AND column_name='is_default') THEN
    ALTER TABLE public.email_templates ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added: is_default';
  ELSE
    RAISE NOTICE 'Already exists: is_default';
  END IF;
END $$;

-- 6. Ensure custom_variables table exists
CREATE TABLE IF NOT EXISTS public.custom_variables (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_value TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.custom_variables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='custom_variables' AND policyname='Users manage own variables') THEN
    CREATE POLICY "Users manage own variables" ON public.custom_variables FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 7. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- 8. Confirm final schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'email_templates'
ORDER BY ordinal_position;
`;

async function main() {
  // Try using @supabase/supabase-js with service role
  const dbUrl = process.env.DB_URL;
  
  if (!dbUrl) {
    console.error('\n❌ ERROR: DB_URL environment variable is not set.\n');
    console.log('To apply this migration:\n');
    console.log('Option A: Set your Supabase DB password and run:');
    console.log('  $env:DB_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"');
    console.log('  node supabase/apply-migration.js\n');
    console.log('Option B: Copy the SQL below and run it in the Supabase SQL Editor:');
    console.log('  https://supabase.com/dashboard/project/evgsdlaskqrlzjfpmfbx/sql/new\n');
    console.log('--- SQL TO RUN ---');
    console.log(SQL);
    console.log('-----------------\n');
    process.exit(1);
  }

  try {
    const { Client } = require('pg');
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    console.log('✅ Connected to database');
    const result = await client.query(SQL);
    console.log('✅ Migration applied successfully');
    await client.end();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

main();
