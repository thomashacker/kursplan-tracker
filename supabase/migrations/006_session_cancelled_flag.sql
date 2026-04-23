-- ─────────────────────────────────────────────────────────────
-- 006 – Add is_cancelled flag to training_sessions
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;
