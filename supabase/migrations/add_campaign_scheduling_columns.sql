-- Migration: Add all campaign scheduling and sending window columns to bulk_campaigns together
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='scheduled_at') THEN
    ALTER TABLE public.bulk_campaigns ADD COLUMN scheduled_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_start') THEN
    ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_start TEXT DEFAULT '09:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_end') THEN
    ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_end TEXT DEFAULT '17:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_tz') THEN
    ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_tz TEXT DEFAULT 'UTC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bulk_campaigns' AND column_name='send_window_days') THEN
    ALTER TABLE public.bulk_campaigns ADD COLUMN send_window_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
