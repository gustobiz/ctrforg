-- ============================================================
-- CTRForge Email Outreach Infrastructure
-- New tables only. Does NOT modify existing crm_leads or subscriptions.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Gmail Connections (OAuth tokens per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gmail_connections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE,
    scopes TEXT DEFAULT '',
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_gmail_user UNIQUE (user_id)
);

ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own gmail connections"
ON public.gmail_connections
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);

-- ============================================================
-- 2. Email Templates (reusable outreach templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL DEFAULT '',
    html_body TEXT NOT NULL DEFAULT '',
    text_body TEXT DEFAULT '',
    variables JSONB DEFAULT '["creator_name","channel_name","latest_video"]'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON public.email_templates(user_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email templates"
ON public.email_templates
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. Email Campaigns (each sent email is a campaign record)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID, -- references crm_leads.id but no FK to avoid coupling
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    gmail_message_id TEXT, -- Gmail API message ID for thread matching
    gmail_thread_id TEXT, -- Gmail thread ID for reply detection
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    html_body TEXT NOT NULL DEFAULT '',
    text_body TEXT DEFAULT '',
    status TEXT DEFAULT 'sent', -- 'draft', 'sent', 'opened', 'clicked', 'replied', 'bounced'
    is_followup BOOLEAN DEFAULT false,
    followup_number INT DEFAULT 0, -- 0 = initial, 1 = first followup, etc.
    parent_campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    total_opens INT DEFAULT 0,
    total_clicks INT DEFAULT 0,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_lead_id ON public.email_campaigns(lead_id);
CREATE INDEX IF NOT EXISTS idx_email_campaigns_thread_id ON public.email_campaigns(gmail_thread_id);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email campaigns"
ON public.email_campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. Email Events (granular open/click event log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID,
    event_type TEXT NOT NULL, -- 'open', 'click', 'reply', 'bounce'
    url TEXT, -- clicked URL (for click events)
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_campaign_id ON public.email_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_events_user_id ON public.email_events(user_id);

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own email events"
ON public.email_events
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. Follow-up Sequences (scheduled follow-ups per lead)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.followup_sequences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL,
    campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL, -- 'not_opened', 'opened_not_clicked', 'clicked_not_replied'
    delay_days INT NOT NULL DEFAULT 3, -- days to wait before follow-up
    followup_number INT NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'cancelled', 'skipped'
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    generated_content TEXT, -- AI-generated follow-up content
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followup_sequences_user_id ON public.followup_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_followup_sequences_lead_id ON public.followup_sequences(lead_id);
CREATE INDEX IF NOT EXISTS idx_followup_sequences_status ON public.followup_sequences(status);

ALTER TABLE public.followup_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own followup sequences"
ON public.followup_sequences
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
