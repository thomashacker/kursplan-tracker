-- 023_reset_training_session_sort_order.sql
--
-- Resets the per-session lane preference on the day timetable.
--
-- Background: training_sessions.sort_order was originally a "preferred lane"
-- consumed by a backtracking layout solver. Earlier swap attempts left the
-- column in an inconsistent state (e.g. multiple overlapping sessions pinned
-- to the same lane), which forced the solver into a soft-pin fallback and
-- made the on-screen lanes disagree with the stored sort_order values.
--
-- The app now treats sort_order as the literal lane number (no solver, no
-- preference fuzz) and falls back to first-fit when null. This migration
-- clears the legacy values so first-fit lays everything out from scratch.
--
-- Optional safety net: a snapshot table is created first so the prior values
-- can be restored if needed. Drop it once you're happy with the reset:
--
--   DROP TABLE public.training_sessions_sort_order_backup;
--
-- To restore from the snapshot:
--
--   UPDATE public.training_sessions ts
--   SET sort_order = b.sort_order
--   FROM public.training_sessions_sort_order_backup b
--   WHERE ts.id = b.id;

CREATE TABLE IF NOT EXISTS public.training_sessions_sort_order_backup AS
SELECT id, sort_order
FROM public.training_sessions
WHERE sort_order IS NOT NULL;

UPDATE public.training_sessions
SET sort_order = NULL
WHERE sort_order IS NOT NULL;
