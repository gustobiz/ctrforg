-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own crm leads" ON public.crm_leads;

-- Create or restructure the crm_leads table
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_name TEXT NOT NULL,
    channel_name TEXT,
    video_title TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    subscriber_count BIGINT DEFAULT 0,
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    published_at TEXT,
    transcript_snippets JSONB DEFAULT '[]'::jsonb,
    repeated_phrases JSONB DEFAULT '[]'::jsonb,
    ctr_weaknesses JSONB DEFAULT '[]'::jsonb,
    optimized_titles JSONB DEFAULT '[]'::jsonb,
    audience_positioning TEXT,
    generated_outreach TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ai_analysis JSONB DEFAULT '{}'::jsonb,
    
    -- Unique constraint per user/creator to prevent duplicate entries
    CONSTRAINT unique_user_creator UNIQUE (user_id, creator_name)
);

-- Safely restructure and convert counts if the table pre-existed
DO $$
BEGIN
    -- subscriber_count (convert text to bigint)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='subscriber_count' AND data_type='text') THEN
        ALTER TABLE public.crm_leads ALTER COLUMN subscriber_count TYPE BIGINT USING (NULLIF(regexp_replace(subscriber_count, '[^0-9]', '', 'g'), '')::BIGINT);
    END IF;

    -- view_count (convert text to bigint)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='view_count' AND data_type='text') THEN
        ALTER TABLE public.crm_leads ALTER COLUMN view_count TYPE BIGINT USING (NULLIF(regexp_replace(view_count, '[^0-9]', '', 'g'), '')::BIGINT);
    END IF;

    -- like_count (convert text to bigint)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='like_count' AND data_type='text') THEN
        ALTER TABLE public.crm_leads ALTER COLUMN like_count TYPE BIGINT USING (NULLIF(regexp_replace(like_count, '[^0-9]', '', 'g'), '')::BIGINT);
    END IF;

    -- Ensure ai_analysis JSONB exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crm_leads' AND column_name='ai_analysis') THEN
        ALTER TABLE public.crm_leads ADD COLUMN ai_analysis JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Create an index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_crm_leads_user_id ON public.crm_leads(user_id);

-- Enable Row Level Security
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Recreate Policies securely
CREATE POLICY "Users can manage their own crm leads"
ON public.crm_leads
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
