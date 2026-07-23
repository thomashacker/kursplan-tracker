-- 034_feedback.sql
--
-- Lightweight in-app feedback channel: users send bug reports / ideas /
-- other via a floating help button; superadmin (edward) triages them in
-- /admin/feedback. No email hookup, no attachments, no chat — the whole
-- feature is one-way write from users + read/update for the operator.
--
-- Security notes:
--   • Rate limit at 20 rows / hour / user via BEFORE INSERT trigger
--     to keep a hostile client from flooding the table.
--   • Message length capped at 2000 chars via CHECK constraint (typical
--     bug report is 50-200 chars).
--   • RLS: authors can INSERT their own row, superadmin has full access.
--     Authors cannot SELECT after submit — deliberately "send and forget"
--     to avoid building expectations of a reply channel.
--   • page_url + user_agent are auto-captured client-side (not user-typed)
--     to give the operator repro context. Considered non-sensitive.
--
-- Retention: no auto-purge in this migration; can be added later once we
-- know the volume.

-- ── Table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL
                 CHECK (kind IN ('bug','idea','other')),
  message      text NOT NULL
                 CHECK (length(btrim(message)) BETWEEN 3 AND 2000),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  club_id      uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  page_url     text,
  user_agent   text,
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','solved','archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_note   text
);

-- List query pattern: open rows first, then newest → oldest.
CREATE INDEX IF NOT EXISTS feedback_status_created_idx
  ON public.feedback (status, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- ── RLS ─────────────────────────────────────────────────────────────────

-- INSERT: any authenticated user, but only as themselves (user_id=auth.uid()).
DROP POLICY IF EXISTS "feedback_insert" ON public.feedback;
CREATE POLICY "feedback_insert"
  ON public.feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    -- Force status to 'open' on insert; author can't smuggle status changes
    AND status = 'open'
    AND resolved_at IS NULL
    AND resolved_by IS NULL
    AND admin_note IS NULL
  );

-- SELECT: only superadmin. Authors don't get to read their own; keeps the
-- feature send-and-forget and removes the "why hasn't he answered" surface.
DROP POLICY IF EXISTS "feedback_select_superadmin" ON public.feedback;
CREATE POLICY "feedback_select_superadmin"
  ON public.feedback FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- UPDATE + DELETE: superadmin only.
DROP POLICY IF EXISTS "feedback_update_superadmin" ON public.feedback;
CREATE POLICY "feedback_update_superadmin"
  ON public.feedback FOR UPDATE
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "feedback_delete_superadmin" ON public.feedback;
CREATE POLICY "feedback_delete_superadmin"
  ON public.feedback FOR DELETE
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- ── Rate-limit trigger ──────────────────────────────────────────────────
-- 20 rows / hour / user. Consistent style with the plan-limit triggers:
-- BEFORE INSERT, RAISE EXCEPTION with a German message on breach.

CREATE OR REPLACE FUNCTION public.enforce_feedback_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW; -- anonymous edge case, no user to attribute rate to
  END IF;
  SELECT count(*)::int INTO v_count
    FROM public.feedback
   WHERE user_id = NEW.user_id
     AND created_at > now() - interval '1 hour';
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Zu viele Meldungen. Bitte warte eine Stunde und versuche es erneut.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_feedback_rate_limit ON public.feedback;
CREATE TRIGGER enforce_feedback_rate_limit
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.enforce_feedback_rate_limit();
