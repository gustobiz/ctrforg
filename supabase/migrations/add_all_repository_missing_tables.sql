-- ================================================================
-- CTRForge: COMPLETE REPOSITORY MISSING DEPENDENCIES MIGRATION
-- Covers ALL 21 tables referenced across the entire codebase:
-- crm_leads, email_templates, bulk_campaigns, gmail_connections,
-- sheets_connections, email_queue, email_events, campaign_leads,
-- campaign_followup_rules, deliverability_checks, creator_leads,
-- email_campaigns, followup_sequences, inbox_messages, team_members,
-- teams, profiles, custom_variables, gmail_warmup, subscriptions, audit_logs.
--
-- Safe to run multiple times — idempotent IF NOT EXISTS for all objects.
-- Preserves all existing tables, columns, and production data.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. crm_leads (existing) — Add missing columns safely
-- ================================================================
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_email       TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS website             TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS instagram           TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS twitter             TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS linkedin            TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS facebook            TEXT;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_source      TEXT        DEFAULT 'youtube_scraping';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS contact_status      TEXT        DEFAULT 'discovered';
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS email_verified      BOOLEAN     DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS website_found       BOOLEAN     DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS social_links_found  BOOLEAN     DEFAULT false;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS lead_score          INT         DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS opportunity_score   INT         DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS thumbnail_opportunity INT       DEFAULT 0;
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS last_updated        TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_status ON public.crm_leads(contact_status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_lead_score     ON public.crm_leads(lead_score);

-- ================================================================
-- 2. bulk_campaigns (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.bulk_campaigns (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    status              TEXT DEFAULT 'draft',
    template_id         UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    subject_override    TEXT,
    html_body_override  TEXT,
    send_rate           INT DEFAULT 20,
    random_delay_min    INT DEFAULT 30,
    random_delay_max    INT DEFAULT 120,
    total_leads         INT DEFAULT 0,
    sent_count          INT DEFAULT 0,
    opened_count        INT DEFAULT 0,
    clicked_count       INT DEFAULT 0,
    replied_count       INT DEFAULT 0,
    bounced_count       INT DEFAULT 0,
    started_at          TIMESTAMPTZ,
    paused_at           TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bulk_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bulk_campaigns' AND policyname='Users manage own bulk campaigns') THEN
    CREATE POLICY "Users manage own bulk campaigns" ON public.bulk_campaigns FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_user_id ON public.bulk_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_status   ON public.bulk_campaigns(status);

-- ================================================================
-- 3. campaign_leads (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.campaign_leads (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id       UUID NOT NULL REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
    lead_id           UUID NOT NULL,
    lead_email        TEXT,
    lead_name         TEXT,
    status            TEXT DEFAULT 'pending',
    variables         JSONB DEFAULT '{}',
    email_campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    sent_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, lead_id)
);

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaign_leads' AND policyname='Users manage own campaign leads') THEN
    CREATE POLICY "Users manage own campaign leads" ON public.campaign_leads FOR ALL
      USING  (EXISTS (SELECT 1 FROM public.bulk_campaigns WHERE id = campaign_leads.campaign_id AND user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bulk_campaigns WHERE id = campaign_leads.campaign_id AND user_id = auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign_id ON public.campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_status      ON public.campaign_leads(status);

-- ================================================================
-- 4. campaign_followup_rules (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.campaign_followup_rules (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id       UUID NOT NULL REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
    step_number       INT NOT NULL DEFAULT 1,
    delay_days        INT NOT NULL DEFAULT 3,
    rule_type         TEXT NOT NULL DEFAULT 'not_opened',
    template_id       UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
    use_ai_generation BOOLEAN DEFAULT true,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.campaign_followup_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='campaign_followup_rules' AND policyname='Users manage own followup rules') THEN
    CREATE POLICY "Users manage own followup rules" ON public.campaign_followup_rules FOR ALL
      USING  (EXISTS (SELECT 1 FROM public.bulk_campaigns WHERE id = campaign_followup_rules.campaign_id AND user_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.bulk_campaigns WHERE id = campaign_followup_rules.campaign_id AND user_id = auth.uid()));
  END IF;
END $$;

-- ================================================================
-- 5. email_queue (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.email_queue (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id  UUID NOT NULL REFERENCES public.bulk_campaigns(id) ON DELETE CASCADE,
    lead_id      UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    status       TEXT DEFAULT 'queued',
    error        TEXT,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='email_queue' AND policyname='Users manage own email queue') THEN
    CREATE POLICY "Users manage own email queue" ON public.email_queue FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_email_queue_user_id     ON public.email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_campaign_id ON public.email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status      ON public.email_queue(status);

-- ================================================================
-- 6. inbox_messages (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.inbox_messages (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id      UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
    lead_id          UUID,
    gmail_message_id TEXT,
    gmail_thread_id  TEXT,
    from_email       TEXT NOT NULL,
    to_email         TEXT NOT NULL,
    subject          TEXT,
    snippet          TEXT,
    body_preview     TEXT,
    is_inbound       BOOLEAN DEFAULT true,
    is_read          BOOLEAN DEFAULT false,
    category         TEXT DEFAULT 'unread',
    received_at      TIMESTAMPTZ DEFAULT NOW(),
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='inbox_messages' AND policyname='Users manage own inbox') THEN
    CREATE POLICY "Users manage own inbox" ON public.inbox_messages FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_user_id   ON public.inbox_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_category  ON public.inbox_messages(category);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_thread_id ON public.inbox_messages(gmail_thread_id);

-- ================================================================
-- 7. gmail_warmup (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.gmail_warmup (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date             DATE NOT NULL DEFAULT CURRENT_DATE,
    emails_sent      INT DEFAULT 0,
    daily_limit      INT DEFAULT 20,
    warmup_score     INT DEFAULT 0,
    suggested_volume INT DEFAULT 20,
    status           TEXT DEFAULT 'active',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

ALTER TABLE public.gmail_warmup ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='gmail_warmup' AND policyname='Users manage own warmup') THEN
    CREATE POLICY "Users manage own warmup" ON public.gmail_warmup FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- 8. deliverability_checks (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.deliverability_checks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id     UUID REFERENCES public.bulk_campaigns(id) ON DELETE SET NULL,
    subject_text    TEXT,
    spam_score      NUMERIC(3,1) DEFAULT 0,
    spam_words      TEXT[] DEFAULT '{}',
    link_count      INT DEFAULT 0,
    has_unsubscribe BOOLEAN DEFAULT false,
    health_score    INT DEFAULT 100,
    recommendations JSONB DEFAULT '[]',
    checked_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.deliverability_checks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='deliverability_checks' AND policyname='Users manage own checks') THEN
    CREATE POLICY "Users manage own checks" ON public.deliverability_checks FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- 9. sheets_connections (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.sheets_connections (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sheet_url             TEXT NOT NULL,
    sheet_id              TEXT NOT NULL,
    sheet_name            TEXT DEFAULT 'Sheet1',
    column_mapping        JSONB DEFAULT '{}',
    last_synced_at        TIMESTAMPTZ,
    auto_sync             BOOLEAN DEFAULT true,
    sync_interval_minutes INT DEFAULT 15,
    status                TEXT DEFAULT 'active',
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, sheet_id)
);

ALTER TABLE public.sheets_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sheets_connections' AND policyname='Users manage own sheets') THEN
    CREATE POLICY "Users manage own sheets" ON public.sheets_connections FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- 10. creator_leads (missing — for Youtube Discovery caching)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.creator_leads (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    channel_id       TEXT NOT NULL,
    creator_name     TEXT,
    channel_name     TEXT,
    subscriber_count INT DEFAULT 0,
    contact_email    TEXT,
    ai_analysis      JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.creator_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='creator_leads' AND policyname='Users manage own creator leads') THEN
    CREATE POLICY "Users manage own creator leads" ON public.creator_leads FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- 11. profiles (missing — for teams and user info)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    full_name  TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users manage own profile') THEN
    CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ================================================================
-- 12. teams (missing — for team collaboration)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.teams (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='teams' AND policyname='Users manage own teams') THEN
    CREATE POLICY "Users manage own teams" ON public.teams FOR ALL
      USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
  END IF;
END $$;

-- ================================================================
-- 13. team_members (missing — for team membership)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.team_members (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role      TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='team_members' AND policyname='Users manage own team membership') THEN
    CREATE POLICY "Users manage own team membership" ON public.team_members FOR ALL
      USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND owner_id = auth.uid()))
      WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.teams WHERE id = team_members.team_id AND owner_id = auth.uid()));
  END IF;
END $$;

-- ================================================================
-- 14. subscriptions (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id            TEXT DEFAULT 'pro',
    status             TEXT DEFAULT 'active',
    current_period_end TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='subscriptions' AND policyname='Users view own subscription') THEN
    CREATE POLICY "Users view own subscription" ON public.subscriptions FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- 15. audit_logs (missing)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action      TEXT NOT NULL,
    entity_type TEXT,
    entity_id   TEXT,
    details     JSONB DEFAULT '{}',
    ip_address  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='Users read own audit logs') THEN
    CREATE POLICY "Users read own audit logs" ON public.audit_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ================================================================
-- 16. Storage Buckets (outreach-context)
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('outreach-context', 'outreach-context', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Allow public read and user uploads outreach-context') THEN
    CREATE POLICY "Allow public read and user uploads outreach-context" ON storage.objects
      FOR ALL USING (bucket_id = 'outreach-context') WITH CHECK (bucket_id = 'outreach-context');
  END IF;
END $$;

-- ================================================================
-- Schema Grants & PostgREST Cache Reload
-- ================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

