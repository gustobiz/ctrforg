-- ============================================================
-- CTRForge: GRANT FIX — PostgREST schema visibility
-- ============================================================
-- WHY THIS IS NEEDED:
--   Tables created via raw SQL (CREATE TABLE) in Supabase are NOT
--   automatically visible to PostgREST. PostgREST only exposes
--   tables that have been GRANTed to the 'anon' and 'authenticated'
--   roles. Without these grants, PostgREST returns PGRST205
--   ("Could not find the table in the schema cache") even though
--   the table physically exists in Postgres.
--
--   Tables created via the Supabase Dashboard Table Editor auto-
--   apply these grants. Raw SQL migrations do not.
--
-- WHAT THIS DOES:
--   Grants schema usage + table access to all 8 missing tables.
--   Then sends NOTIFY to force PostgREST to reload its cache.
--   No tables are dropped or recreated.
-- ============================================================

-- 1. Ensure the anon and authenticated roles can use the public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant access to the 8 tables that exist but are invisible to PostgREST
GRANT ALL ON TABLE public.bulk_campaigns          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.campaign_leads          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.campaign_followup_rules TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.email_queue             TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.inbox_messages          TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gmail_warmup            TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.deliverability_checks   TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sheets_connections      TO anon, authenticated, service_role;

-- 3. Also grant sequence access for auto-generated UUIDs (belt-and-suspenders)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Also fix crm_leads missing columns while we're here
--    (these are needed for email fallback and campaign engine)
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email               TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_email       TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS website             TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS instagram           TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS twitter             TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS linkedin            TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS facebook            TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_source      TEXT    DEFAULT 'youtube_scraping';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_status      TEXT    DEFAULT 'discovered';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email_verified      BOOLEAN DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS website_found       BOOLEAN DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS social_links_found  BOOLEAN DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS lead_score          INT     DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS opportunity_score   INT     DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS thumbnail_opportunity INT   DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS last_updated        TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_status ON public.crm_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_lead_score     ON public.crm_leads(lead_score);

-- 5. Force PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION — Run this after to confirm all tables visible
-- Expected: exactly 15 table names returned
-- ============================================================
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'email_templates','custom_variables','bulk_campaigns','campaign_leads',
    'campaign_followup_rules','email_queue','inbox_messages','gmail_warmup',
    'deliverability_checks','sheets_connections','gmail_connections',
    'crm_leads','email_campaigns','email_events','followup_sequences'
  )
ORDER BY table_name;
