-- 032_close_plan_enforcement_gaps.sql
--
-- Two goals:
--
--   1. Restrict file uploads (image/pdf) to plans that explicitly allow
--      them via a new can_upload_files boolean on plan_config. Free plan
--      gets `false`, unlimited gets `true`. This removes Storage as a
--      cost/security vector for free users — they can still add `link`
--      attachments (external URLs) but not upload bytes to our bucket.
--      A single DB trigger enforces it; the frontend hides upload UI when
--      the flag is false.
--
--   2. Rebalance free-plan limits to values that fit real-world clubs
--      observed in production (100+ teilnehmer, 10+ staff).
--
-- We DON'T add the per-byte storage / per-count media triggers that were
-- originally planned — they become moot once free plans can't upload at
-- all, and unlimited plans deliberately have no caps.

-- ── plan_config: can_upload_files ────────────────────────────────────────

ALTER TABLE public.plan_config
  ADD COLUMN IF NOT EXISTS can_upload_files boolean NOT NULL DEFAULT false;

-- Existing rows: free stays false (default), unlimited gets true.
UPDATE public.plan_config SET can_upload_files = false WHERE plan = 'free';
UPDATE public.plan_config SET can_upload_files = true  WHERE plan = 'unlimited';

-- Storage-bytes cap becomes meaningless for free plans (they can't upload
-- anything to Storage) — clear it so the UI doesn't show a phantom "0 MB
-- of X MB" bar. Unlimited stays NULL (no cap).
UPDATE public.plan_config SET max_storage_bytes = NULL WHERE plan = 'free';

-- ── Helper RPC: club_can_upload_files(club_id) ──────────────────────────
-- Frontend calls this to decide whether to show upload UI. Consistent
-- pattern with plan_limit() but returns boolean for a boolean flag.

CREATE OR REPLACE FUNCTION public.club_can_upload_files(p_club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(pc.can_upload_files, false)
    FROM public.clubs c
    JOIN public.plan_config pc ON pc.plan = c.plan
   WHERE c.id = p_club_id;
$$;

REVOKE ALL ON FUNCTION public.club_can_upload_files(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.club_can_upload_files(uuid)
  TO authenticated, service_role;

-- ── Trigger: reject image/pdf uploads on plans without can_upload_files ──

CREATE OR REPLACE FUNCTION public.enforce_can_upload_files()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id uuid;
  v_allowed boolean;
BEGIN
  -- Links are always allowed — they point to external URLs and consume
  -- no Storage bytes.
  IF NEW.kind = 'link' THEN
    RETURN NEW;
  END IF;

  -- Resolve the session's club_id.
  SELECT tw.club_id INTO v_club_id
    FROM public.training_sessions ts
    JOIN public.training_weeks tw ON tw.id = ts.week_id
   WHERE ts.id = NEW.session_id;
  IF v_club_id IS NULL THEN
    RETURN NEW; -- FK will reject anyway
  END IF;

  SELECT pc.can_upload_files INTO v_allowed
    FROM public.clubs c
    JOIN public.plan_config pc ON pc.plan = c.plan
   WHERE c.id = v_club_id;

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'Datei-Uploads sind im aktuellen Tarif nicht verfügbar. Nur externe Links (URLs) sind erlaubt.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_can_upload_files ON public.session_media;
CREATE TRIGGER enforce_can_upload_files
  BEFORE INSERT ON public.session_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_can_upload_files();

-- ── Trigger: keep max_media_per_session honest at the DB layer ───────────
-- Client-side count checks are bypassable via direct API. This closes
-- that hole. Applies to ALL kinds (image, pdf, link) — max_media caps
-- how many attachments in total, not just uploaded bytes.

CREATE OR REPLACE FUNCTION public.enforce_media_per_session_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_club_id uuid;
  v_limit bigint;
  v_count int;
BEGIN
  SELECT tw.club_id INTO v_club_id
    FROM public.training_sessions ts
    JOIN public.training_weeks tw ON tw.id = ts.week_id
   WHERE ts.id = NEW.session_id;
  IF v_club_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := plan_limit(v_club_id, 'media_per_session');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO v_count
    FROM public.session_media
   WHERE session_id = NEW.session_id
     AND (id IS DISTINCT FROM NEW.id);

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Medien-Grenze erreicht (% von % pro Session im aktuellen Tarif).', v_count, v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_media_per_session_limit ON public.session_media;
CREATE TRIGGER enforce_media_per_session_limit
  BEFORE INSERT ON public.session_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_media_per_session_limit();

-- ── Rebalance free-plan limits ───────────────────────────────────────────
-- Values chosen to match real-world Verein sizes observed in production.
-- Storage cap already cleared above (uploads are gated by can_upload_files).

UPDATE public.plan_config
   SET max_teilnehmer        = 200,
       max_staff             = 20,
       max_media_per_session = 1,   -- 1 link per session on free (upgrade-nudge)
       updated_at            = now()
 WHERE plan = 'free';
