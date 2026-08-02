-- ============================================================
-- CTRForge: Fix email_templates missing columns
-- Safely adds: category, is_shared, variables (if missing)
-- Refreshes PostgREST schema cache
-- ============================================================

-- 1. Add 'category' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'email_templates'
          AND column_name = 'category'
    ) THEN
        ALTER TABLE public.email_templates ADD COLUMN category TEXT NOT NULL DEFAULT 'custom';
        RAISE NOTICE 'Added column: email_templates.category';
    ELSE
        RAISE NOTICE 'Column already exists: email_templates.category';
    END IF;
END $$;

-- 2. Add 'is_shared' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'email_templates'
          AND column_name = 'is_shared'
    ) THEN
        ALTER TABLE public.email_templates ADD COLUMN is_shared BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added column: email_templates.is_shared';
    ELSE
        RAISE NOTICE 'Column already exists: email_templates.is_shared';
    END IF;
END $$;

-- 3. Add 'variables' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'email_templates'
          AND column_name = 'variables'
    ) THEN
        ALTER TABLE public.email_templates
            ADD COLUMN variables JSONB NOT NULL DEFAULT '["creator_name","channel_name","latest_video"]'::jsonb;
        RAISE NOTICE 'Added column: email_templates.variables';
    ELSE
        RAISE NOTICE 'Column already exists: email_templates.variables';
    END IF;
END $$;

-- 4. Add 'text_body' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'email_templates'
          AND column_name = 'text_body'
    ) THEN
        ALTER TABLE public.email_templates ADD COLUMN text_body TEXT NOT NULL DEFAULT '';
        RAISE NOTICE 'Added column: email_templates.text_body';
    ELSE
        RAISE NOTICE 'Column already exists: email_templates.text_body';
    END IF;
END $$;

-- 5. Add 'is_default' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'email_templates'
          AND column_name = 'is_default'
    ) THEN
        ALTER TABLE public.email_templates ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;
        RAISE NOTICE 'Added column: email_templates.is_default';
    ELSE
        RAISE NOTICE 'Column already exists: email_templates.is_default';
    END IF;
END $$;

-- 6. Ensure custom_variables table exists (referenced by /api/variables)
CREATE TABLE IF NOT EXISTS public.custom_variables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    default_value TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

ALTER TABLE public.custom_variables ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'custom_variables'
          AND policyname = 'Users manage own variables'
    ) THEN
        CREATE POLICY "Users manage own variables"
            ON public.custom_variables FOR ALL
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- 7. Notify PostgREST to reload its schema cache
-- This is the standard way to flush the cache without a server restart.
NOTIFY pgrst, 'reload schema';
