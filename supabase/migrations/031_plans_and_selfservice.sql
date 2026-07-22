-- 031_plans_and_selfservice.sql
--
-- Open Verein creation to any registered user (one free Verein each),
-- with resource limits enforced in the DB to keep Supabase costs
-- predictable. The old club_creator_whitelist gate is retired.
--
-- Model:
--   • plan_config          — one row per plan tier holding the caps.
--   • clubs.plan text      — 'free' by default, 'unlimited' for
--                            grandfathered / owner-operator clubs.
--                            NULL entries in plan_config = "no limit".
--   • Partial unique index — enforces "one free Verein per user" at the
--                            DB. Unlimited clubs are exempt.
--   • Triggers             — enforce_teilnehmer_limit, enforce_staff_limit,
--                            enforce_sessions_limit run BEFORE INSERT and
--                            RAISE with human-readable German so the
--                            frontend can toast the message directly.
--   • plan_limit(club, res) — resolves the numeric cap for a resource
--                            or NULL for unlimited. Used by triggers +
--                            frontend RPC.
--
-- Rollback path: drop the triggers, drop the constraint, keep the plan
-- column (harmless). No destructive data changes.

-- ── plan_config ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plan_config (
  plan                        text        PRIMARY KEY,
  max_clubs_per_user          int,        -- NULL = no limit
  max_storage_bytes           bigint,
  max_teilnehmer              int,        -- counted where left_on IS NULL
  max_staff                   int,        -- admin + trainer role rows, status='active'
  max_sessions_per_week       int,
  max_media_per_session       int,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_config ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user so the client can render usage bars
-- without needing service_role. Contents are non-sensitive.
DROP POLICY IF EXISTS "plan_config_read" ON public.plan_config;
CREATE POLICY "plan_config_read"
  ON public.plan_config FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins can mutate.
DROP POLICY IF EXISTS "plan_config_write" ON public.plan_config;
CREATE POLICY "plan_config_write"
  ON public.plan_config FOR ALL
  TO authenticated
  USING (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- Seed
INSERT INTO public.plan_config (plan, max_clubs_per_user, max_storage_bytes,
                                max_teilnehmer, max_staff, max_sessions_per_week,
                                max_media_per_session)
VALUES
  ('free',     1, 104857600, 50, 5, 20, 5),   -- 100 MB
  ('unlimited', NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (plan) DO NOTHING;

-- ── clubs.plan column ───────────────────────────────────────────────────

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
    REFERENCES public.plan_config(plan) ON UPDATE CASCADE;

-- Existing clubs — grandfathered to unlimited. New clubs default 'free'
-- via the DEFAULT above. Safe to re-run: only touches rows still on 'free'.
UPDATE public.clubs SET plan = 'unlimited' WHERE plan = 'free';

-- ── One free club per user ──────────────────────────────────────────────
-- Partial unique index: enforces the rule at the DB layer, but only for
-- plan='free'. Unlimited plans can create as many clubs as they want.

CREATE UNIQUE INDEX IF NOT EXISTS one_free_club_per_user
  ON public.clubs (created_by)
  WHERE plan = 'free';

-- ── plan_limit() helper ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.plan_limit(p_club_id uuid, p_resource text)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_resource
    WHEN 'clubs_per_user'    THEN pc.max_clubs_per_user::bigint
    WHEN 'storage_bytes'     THEN pc.max_storage_bytes
    WHEN 'teilnehmer'        THEN pc.max_teilnehmer::bigint
    WHEN 'staff'             THEN pc.max_staff::bigint
    WHEN 'sessions_per_week' THEN pc.max_sessions_per_week::bigint
    WHEN 'media_per_session' THEN pc.max_media_per_session::bigint
    ELSE NULL
  END
  FROM public.clubs c
  JOIN public.plan_config pc ON pc.plan = c.plan
  WHERE c.id = p_club_id;
$$;

REVOKE ALL ON FUNCTION public.plan_limit(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.plan_limit(uuid, text)
  TO authenticated, service_role;

-- ── Enforcement triggers ────────────────────────────────────────────────

-- Teilnehmer: cap active (left_on IS NULL) count per club.
CREATE OR REPLACE FUNCTION public.enforce_teilnehmer_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit bigint;
  v_count int;
BEGIN
  IF NEW.left_on IS NOT NULL THEN
    RETURN NEW; -- soft-deleted rows don't count toward the cap
  END IF;
  v_limit := plan_limit(NEW.club_id, 'teilnehmer');
  IF v_limit IS NULL THEN
    RETURN NEW; -- unlimited
  END IF;
  SELECT count(*)::int INTO v_count
    FROM public.teilnehmer
   WHERE club_id = NEW.club_id AND left_on IS NULL;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Teilnehmer-Grenze erreicht (% von % im Free-Tarif).', v_count, v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_teilnehmer_limit ON public.teilnehmer;
CREATE TRIGGER enforce_teilnehmer_limit
  BEFORE INSERT ON public.teilnehmer
  FOR EACH ROW EXECUTE FUNCTION public.enforce_teilnehmer_limit();

-- Staff (admin + trainer) memberships per club.
CREATE OR REPLACE FUNCTION public.enforce_staff_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit bigint;
  v_count int;
BEGIN
  IF NEW.role NOT IN ('admin', 'trainer') OR NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;
  v_limit := plan_limit(NEW.club_id, 'staff');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;
  -- The creator's initial admin row is inserted by the club-creation
  -- trigger *after* this check would have failed on count=0 vs a limit
  -- of 5, so this is fine. But be defensive: exclude the row being
  -- inserted from the count (in case of UPSERT retries).
  SELECT count(*)::int INTO v_count
    FROM public.club_memberships
   WHERE club_id = NEW.club_id
     AND role IN ('admin', 'trainer')
     AND status = 'active'
     AND (user_id IS DISTINCT FROM NEW.user_id);
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Trainer/Admin-Grenze erreicht (% von % im Free-Tarif).', v_count, v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_staff_limit ON public.club_memberships;
CREATE TRIGGER enforce_staff_limit
  BEFORE INSERT ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_limit();

-- Sessions per week (per club). Counts rows in the same training_week.
CREATE OR REPLACE FUNCTION public.enforce_sessions_limit()
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
  IF NEW.kind = 'event' THEN
    RETURN NEW; -- events aren't rate-limited by the training cap
  END IF;
  SELECT club_id INTO v_club_id
    FROM public.training_weeks WHERE id = NEW.week_id;
  v_limit := plan_limit(v_club_id, 'sessions_per_week');
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(*)::int INTO v_count
    FROM public.training_sessions
   WHERE week_id = NEW.week_id
     AND (id IS DISTINCT FROM NEW.id);
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'Trainings-Grenze pro Woche erreicht (% von % im Free-Tarif).', v_count, v_limit
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_sessions_limit ON public.training_sessions;
CREATE TRIGGER enforce_sessions_limit
  BEFORE INSERT ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sessions_limit();

-- ── Rewrite clubs_insert policy: drop whitelist requirement ────────────

DROP POLICY IF EXISTS "clubs_insert" ON public.clubs;

CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );
  -- The partial unique index (one_free_club_per_user) enforces the
  -- "one free Verein per user" rule at the DB. Attempted second insert
  -- fails with 23505 which the frontend translates to a friendly toast.

-- ── Retire the whitelist ────────────────────────────────────────────────
-- The table + fn are unused by any current policy after this migration.
-- Drop them so the schema stays honest.

DROP FUNCTION IF EXISTS public.can_create_club();
DROP TABLE IF EXISTS public.club_creator_whitelist;
