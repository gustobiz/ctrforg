-- ============================================================
-- CTRForge Database Migration: Add sheet_id and batch columns to crm_leads
-- File: supabase/migrations/add_sheet_id_and_batch_columns_to_crm_leads.sql
-- ============================================================

-- 1. Ensure sheet_id and batch tracking columns exist on crm_leads
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS sheet_id TEXT,
ADD COLUMN IF NOT EXISTS csv_batch_id TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS contact_source TEXT DEFAULT 'google_sheets',
ADD COLUMN IF NOT EXISTS contact_status TEXT DEFAULT 'imported';

-- 2. Ensure scoring and verification columns exist
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS website_found BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS social_links_found BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS opportunity_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS thumbnail_opportunity INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Create indexes on sheet_id and batch_id for high-performance isolated queries
CREATE INDEX IF NOT EXISTS idx_crm_leads_sheet_id ON public.crm_leads(sheet_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_csv_batch_id ON public.crm_leads(csv_batch_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_user_sheet ON public.crm_leads(user_id, sheet_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_source ON public.crm_leads(contact_source);

-- 4. Verify RLS policy permits full access for authenticated users to their own leads
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'crm_leads' 
        AND policyname = 'Users can manage their own crm leads'
    ) THEN
        CREATE POLICY "Users can manage their own crm leads"
        ON public.crm_leads
        FOR ALL
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
