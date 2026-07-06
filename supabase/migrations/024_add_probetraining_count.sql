-- 024_add_probetraining_count.sql
--
-- Adds a per-session counter for "Probetrainings" (external trial visitors)
-- that trainers tick up/down in the attendance modal. Anonymous — no per-
-- person records. Zero on existing rows.

ALTER TABLE public.training_sessions
  ADD COLUMN probetraining_count integer NOT NULL DEFAULT 0
  CHECK (probetraining_count >= 0);
