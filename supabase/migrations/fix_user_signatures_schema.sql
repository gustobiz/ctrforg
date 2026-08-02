-- Migration: Fix user_signatures schema compatibility for Gmail-style Email Signature Builder

-- Make role, display_name, and portfolio_url nullable to prevent NOT NULL constraint errors
ALTER TABLE public.user_signatures
ALTER COLUMN role DROP NOT NULL;

ALTER TABLE public.user_signatures
ALTER COLUMN display_name DROP NOT NULL;

ALTER TABLE public.user_signatures
ALTER COLUMN portfolio_url DROP NOT NULL;

-- Add new Gmail-style signature builder columns if they do not exist
ALTER TABLE public.user_signatures
ADD COLUMN IF NOT EXISTS signature_name TEXT DEFAULT 'Main Outreach',
ADD COLUMN IF NOT EXISTS content_html TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]'::jsonb;
