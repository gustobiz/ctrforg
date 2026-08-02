-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the crm_leads table
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_name TEXT NOT NULL,
    channel_name TEXT,
    video_title TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    subscriber_count TEXT,
    view_count TEXT,
    like_count TEXT,
    published_at TEXT,
    transcript_snippets JSONB DEFAULT '[]'::jsonb,
    emotional_tone TEXT,
    repeated_phrases JSONB DEFAULT '[]'::jsonb,
    ctr_weaknesses JSONB DEFAULT '[]'::jsonb,
    optimized_titles JSONB DEFAULT '[]'::jsonb,
    audience_positioning TEXT,
    generated_outreach TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Additional deep intelligence fields
    exact_hook TEXT DEFAULT '',
    top_emotional_words JSONB DEFAULT '[]'::jsonb,
    most_repeated_phrases JSONB DEFAULT '[]'::jsonb,
    curiosity_loops JSONB DEFAULT '[]'::jsonb,
    audience_type TEXT DEFAULT '',
    retention_style TEXT DEFAULT '',
    cta_style TEXT DEFAULT '',
    high_converting_phrases JSONB DEFAULT '[]'::jsonb,
    
    -- Unique constraint per user/creator to prevent duplicate entries
    CONSTRAINT unique_user_creator UNIQUE (user_id, creator_name)
);

-- Create an index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_crm_leads_user_id ON public.crm_leads(user_id);

-- Enable Row Level Security
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can manage their own crm leads"
ON public.crm_leads
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Storage bucket configuration for uploaded PDF / screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('outreach-context', 'outreach-context', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for public access to uploaded context files
CREATE POLICY "Public access to outreach context"
ON storage.objects
FOR SELECT
USING (bucket_id = 'outreach-context');

-- Policies to allow authenticated users to upload and manage context files
CREATE POLICY "Authenticated users can upload context"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'outreach-context' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own uploaded context"
ON storage.objects
FOR DELETE
USING (bucket_id = 'outreach-context' AND auth.uid() = owner);
