-- 030_training_session_completion.sql
--
-- Explicit "Training abschließen" workflow. Statistics previously derived
-- "done" from time (end_time < now); this ties completion to a trainer's
-- deliberate action so phantom past-sessions no longer inflate the KPIs.
--
-- Design:
--   • completed_at NULL       = pending (past or future, needs closing)
--   • completed_at timestamptz = closed at that instant by completed_by
--   • is_cancelled stays a separate axis; a cancelled session is not
--     "abgeschlossen" and shouldn't be, so no conflict.
--   • completed_by is nullable (SET NULL on user delete) so audit info
--     stays even if the trainer's account is later removed.
--
-- Backfill: everything past-end-time AND not cancelled AND kind='training'
-- gets stamped as completed_at = now(). Future sessions stay pending —
-- they'll need to be closed via the new modal. Events are unaffected.

-- ── Schema ──────────────────────────────────────────────────────────────

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Partial index makes "gimme all completed trainings in [from, to]" a
-- pure index scan. Sub-indexed by completed_at for date-range filters.
CREATE INDEX IF NOT EXISTS training_sessions_completed_idx
  ON public.training_sessions (completed_at)
  WHERE kind = 'training' AND is_cancelled = false AND completed_at IS NOT NULL;

-- ── Backfill ────────────────────────────────────────────────────────────
-- Only touches rows where completed_at is still NULL — safe to re-run.

UPDATE public.training_sessions ts
SET completed_at = now()
FROM public.training_weeks tw
WHERE tw.id = ts.week_id
  AND ts.kind = 'training'
  AND ts.is_cancelled = false
  AND ts.completed_at IS NULL
  AND (
    tw.week_start::timestamp
    + (ts.day_of_week * interval '1 day')
    + ts.time_end::interval
  ) < now();
