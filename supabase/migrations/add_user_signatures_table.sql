-- Migration: Create user_signatures table for reusable Email Signatures
CREATE TABLE IF NOT EXISTS public.user_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signature_name TEXT DEFAULT 'Main Outreach',
    display_name TEXT,
    role TEXT,
    content_html TEXT DEFAULT '',
    portfolio_url TEXT,
    website_url TEXT,
    linkedin_url TEXT,
    twitter_url TEXT,
    social_links JSONB DEFAULT '[]'::jsonb,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_signature UNIQUE (user_id)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_signatures_user_id ON public.user_signatures(user_id);

-- Enable RLS
ALTER TABLE public.user_signatures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own signature" ON public.user_signatures;

-- RLS Policy
CREATE POLICY "Users can manage their own signature"
ON public.user_signatures
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
