-- ============================================================
-- CTRForge Contact Discovery & Lead Scoring Upgrade
-- Adds fields for email/social contacts and lead/opportunity scoring
-- ============================================================

-- 1. Add contact info columns to crm_leads table
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS instagram TEXT,
ADD COLUMN IF NOT EXISTS twitter TEXT,
ADD COLUMN IF NOT EXISTS linkedin TEXT,
ADD COLUMN IF NOT EXISTS facebook TEXT,
ADD COLUMN IF NOT EXISTS contact_source TEXT DEFAULT 'youtube_scraping',
ADD COLUMN IF NOT EXISTS contact_status TEXT DEFAULT 'discovered';

-- 2. Add verification and link flags
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS website_found BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS social_links_found BOOLEAN DEFAULT false;

-- 3. Add scoring metrics
ALTER TABLE public.crm_leads 
ADD COLUMN IF NOT EXISTS lead_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS opportunity_score INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS thumbnail_opportunity INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_status ON public.crm_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email_verified ON public.crm_leads(email_verified);
CREATE INDEX IF NOT EXISTS idx_crm_leads_lead_score ON public.crm_leads(lead_score);
