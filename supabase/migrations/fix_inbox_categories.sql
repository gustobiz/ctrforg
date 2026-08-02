-- ================================================================
-- CTRForge: Fix inbox_messages category values
--
-- Bug: replies.ts was inserting Pascal/Title Case category values
-- ('Interested', 'Not Interested', 'Follow Up Needed') into
-- inbox_messages.category, but the Inbox UI filters by
-- lowercase_underscore values ('interested', 'not_interested',
-- 'followup_needed').
--
-- This patch fixes ALL existing records with wrong category values.
-- Safe to run multiple times — uses WHERE clause to only touch bad records.
-- ================================================================

-- Fix: 'Interested' → 'interested'
UPDATE public.inbox_messages
SET category = 'interested'
WHERE category = 'Interested';

-- Fix: 'Not Interested' → 'not_interested'
UPDATE public.inbox_messages
SET category = 'not_interested'
WHERE category = 'Not Interested';

-- Fix: 'Follow Up Needed' → 'followup_needed'
UPDATE public.inbox_messages
SET category = 'followup_needed'
WHERE category = 'Follow Up Needed';

-- Fix: 'Follow-up Needed' variant (just in case)
UPDATE public.inbox_messages
SET category = 'followup_needed'
WHERE category = 'Follow-up Needed';

-- Verification: count records by category after fix
SELECT category, COUNT(*) AS count
FROM public.inbox_messages
GROUP BY category
ORDER BY count DESC;
