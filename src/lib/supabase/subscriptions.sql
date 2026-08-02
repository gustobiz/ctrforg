-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL, -- References auth.users or public.users
    provider VARCHAR(50) NOT NULL, -- 'razorpay' or 'paddle'
    provider_customer_id VARCHAR(255),
    provider_subscription_id VARCHAR(255),
    plan_id VARCHAR(100) NOT NULL, -- 'pro_monthly', 'pro_yearly', 'agency_monthly', 'agency_yearly'
    plan_name VARCHAR(100) NOT NULL, -- 'Pro Creator', 'Agency'
    status VARCHAR(50) NOT NULL, -- 'active', 'past_due', 'canceled', 'unpaid', 'trialing'
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    usage_video_analyses INT DEFAULT 0,
    usage_outreach_generations INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: Depending on your exact Supabase setup, you might want to add a foreign key:
-- ALTER TABLE public.subscriptions ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create an index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- Users can only view their own subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Only service role (server API) can insert/update/delete subscriptions securely
-- Note: It is assumed that your API routes will use the Service Role Key to manage these.
