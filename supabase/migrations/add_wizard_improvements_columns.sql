-- Migration: Add wizard improvement columns for scheduled sending, sending windows, and followup thread mode
ALTER TABLE public.bulk_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS send_window_start TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS send_window_end TEXT DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS send_window_tz TEXT DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS send_window_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb;

ALTER TABLE public.campaign_followup_rules
  ADD COLUMN IF NOT EXISTS thread_mode TEXT DEFAULT 'reply';
