-- ============================================================
-- CTRForge Outreach Platform Upgrade Migration
-- Adds campaign management, variables, inbox, warmup, deliverability
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Bulk Campaigns (campaign container for multi-lead sends)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bulk_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    subject_override TEXT,
    html_body_override TEXT,
    send_rate INT DEFAULT 20,
    random_delay_min INT DEFAULT 30,
    random_delay_max INT DEFAULT 120,
    total_leads INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    opened_count INT DEFAULT 0,
    clicked_count INT DEFAULT 0,
    replied_count INT DEFAULT 0,
    bounced_count INT DEFAULT 0,
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bulk_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own bulk campaigns"
    ON public.bulk_campaigns FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_user_id ON public.bulk_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status ON public.bulk_campaigns(status);

-- ============================================================
-- 2. Campaign Leads (junction: which leads are in which campaign)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL,
    lead_email TEXT,
    lead_name TEXT,
    status TEXT DEFAULT 'pending',
    variables JSONB DEFAULT '{}',
    email_campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaign leads"
    ON public.campaign_leads FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.bulk_campaigns
        WHERE id = campaign_leads.campaign_id AND user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.bulk_campaigns
        WHERE id = campaign_leads.campaign_id AND user_id = auth.uid()
    ));

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status ON public.campaign_leads(status);

-- ============================================================
-- 3. Custom Variables (user-defined template variables)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.custom_variables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_value TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE public.custom_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own variables"
    ON public.custom_variables FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. Add category and sharing to email_templates
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'category'
    ) THEN
        ALTER TABLE public.email_templates ADD COLUMN category TEXT DEFAULT 'custom';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'email_templates' AND column_name = 'is_shared'
    ) THEN
        ALTER TABLE public.email_templates ADD COLUMN is_shared BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================================
-- 5. Campaign Follow-up Rules (per-campaign follow-up config)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_followup_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
    step_number INT NOT NULL DEFAULT 1,
    delay_days INT NOT NULL DEFAULT 3,
    rule_type TEXT NOT NULL DEFAULT 'not_opened',
    template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    use_ai_generation BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_followup_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own followup rules"
    ON public.campaign_followup_rules FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.bulk_campaigns
        WHERE id = campaign_followup_rules.campaign_id AND user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.bulk_campaigns
        WHERE id = campaign_followup_rules.campaign_id AND user_id = auth.uid()
    ));

-- ============================================================
-- 6. Inbox Messages (for inbox view)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inbox_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    lead_id UUID,
    gmail_message_id TEXT,
    gmail_thread_id TEXT,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT,
    snippet TEXT,
    body_preview TEXT,
    is_inbound BOOLEAN DEFAULT true,
    is_read BOOLEAN DEFAULT false,
    category TEXT DEFAULT 'unread',
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own inbox"
    ON public.inbox_messages FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_user_id ON public.inbox_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_category ON public.inbox_messages(category);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread_id ON public.inbox_messages(gmail_thread_id);

-- ============================================================
-- 7. Gmail Warmup Tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gmail_warmup (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    emails_sent INT DEFAULT 0,
    daily_limit INT DEFAULT 20,
    warmup_score INT DEFAULT 0,
    suggested_volume INT DEFAULT 20,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

ALTER TABLE public.gmail_warmup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own warmup"
    ON public.gmail_warmup FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 8. Deliverability Checks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deliverability_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.bulk_campaigns(id) ON DELETE SET NULL,
    subject_text TEXT,
    spam_score NUMERIC(3,1) DEFAULT 0,
    spam_words TEXT[] DEFAULT '{}',
    link_count INT DEFAULT 0,
    has_unsubscribe BOOLEAN DEFAULT false,
    health_score INT DEFAULT 100,
    recommendations JSONB DEFAULT '[]',
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deliverability_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own checks"
    ON public.deliverability_checks FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 9. Google Sheets Connections
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sheets_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sheet_url TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    sheet_name TEXT DEFAULT 'Sheet1',
    column_mapping JSONB DEFAULT '{}',
    last_synced_at TIMESTAMPTZ,
    auto_sync BOOLEAN DEFAULT true,
    sync_interval_minutes INT DEFAULT 15,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sheets_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sheets"
    ON public.sheets_connections FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
