-- Create creator_leads table
CREATE TABLE IF NOT EXISTS public.creator_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id TEXT NOT NULL UNIQUE,
    channel_url TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    handle TEXT,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    country TEXT,
    language TEXT,
    subscriber_count BIGINT DEFAULT 0,
    total_views BIGINT DEFAULT 0,
    video_count INT DEFAULT 0,
    average_views BIGINT DEFAULT 0,
    average_likes INT DEFAULT 0,
    average_comments INT DEFAULT 0,
    upload_frequency TEXT,
    last_upload TIMESTAMPTZ,
    channel_age TEXT,
    
    -- Status of pipeline enrichment
    status TEXT DEFAULT 'processing', -- 'processing', 'completed', 'failed'
    
    -- Contact & Socials
    email TEXT,
    website TEXT,
    instagram TEXT,
    linkedin TEXT,
    twitter TEXT,
    facebook TEXT,
    tiktok TEXT,
    discord TEXT,
    newsletter TEXT,
    podcast TEXT,
    store TEXT,
    affiliate_links JSONB DEFAULT '[]'::jsonb,
    course TEXT,
    community_enabled BOOLEAN DEFAULT false,
    monetized BOOLEAN DEFAULT false,
    
    -- Video Metrics
    latest_video_title TEXT,
    latest_video_url TEXT,
    latest_thumbnail_url TEXT,
    average_thumbnail_style TEXT,
    
    -- AI Intelligence Scores (Gemini)
    packaging_score INT DEFAULT 0,
    curiosity_score INT DEFAULT 0,
    opportunity_score INT DEFAULT 0,
    buying_score INT DEFAULT 0,
    growth_score INT DEFAULT 0,
    reply_probability INT DEFAULT 0,
    ctr_opportunity INT DEFAULT 0,
    growth_potential TEXT,
    brand_maturity TEXT,
    thumbnail_quality INT DEFAULT 0,
    title_quality INT DEFAULT 0,
    curiosity_gap TEXT,
    visual_hierarchy TEXT,
    estimated_budget TEXT,
    estimated_monthly_revenue TEXT,
    estimated_revenue_tier TEXT,
    ideal_outreach_angle TEXT,
    decision_maker_confidence INT DEFAULT 0,
    
    -- Audit Preview Details (backward compatibility with CRM layout)
    detected_weaknesses TEXT[] DEFAULT '{}',
    why_this_lead TEXT,
    audience_type TEXT,
    growth_trend TEXT, -- growing, stable, declining
    visual_analysis_preview JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    data_source TEXT DEFAULT 'youtube',
    verification_status TEXT DEFAULT 'unverified',
    scraped_details JSONB DEFAULT '{}'::jsonb,
    contact_source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and create policy for authenticated users
ALTER TABLE public.creator_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage creator leads" ON public.creator_leads;
CREATE POLICY "Users can manage creator leads"
ON public.creator_leads
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Indexes for advanced filters and performance sorting
CREATE INDEX IF NOT EXISTS idx_creator_leads_opportunity_score ON public.creator_leads(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_creator_leads_buying_score ON public.creator_leads(buying_score DESC);
CREATE INDEX IF NOT EXISTS idx_creator_leads_subscriber_count ON public.creator_leads(subscriber_count DESC);
CREATE INDEX IF NOT EXISTS idx_creator_leads_average_views ON public.creator_leads(average_views DESC);
CREATE INDEX IF NOT EXISTS idx_creator_leads_email ON public.creator_leads(email);
CREATE INDEX IF NOT EXISTS idx_creator_leads_country ON public.creator_leads(country);
CREATE INDEX IF NOT EXISTS idx_creator_leads_language ON public.creator_leads(language);
CREATE INDEX IF NOT EXISTS idx_creator_leads_status ON public.creator_leads(status);
