-- ============================================================
-- Add email column to crm_leads and create email_queue table
-- ============================================================

-- 1. Add email column to crm_leads if it doesn't exist
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Create the email_queue table for campaigns
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'queued', -- 'queued', 'sending', 'sent', 'failed', 'paused'
    error TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
DROP POLICY IF EXISTS "Users can manage their own email queue" ON public.email_queue;
CREATE POLICY "Users can manage their own email queue"
ON public.email_queue
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON public.email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_id ON public.email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON public.email_queue(status);
