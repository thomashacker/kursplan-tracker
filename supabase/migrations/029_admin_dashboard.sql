-- 029_admin_dashboard.sql
--
-- Superadmin-only ops dashboard: watch signups, per-Verein storage/DB
-- footprint, and cost trajectory so we can size free-tier headroom before
-- opening self-service Verein registration.
--
-- Design notes:
--   • admin_allowlist keyed by email so the SECURITY DEFINER helper can
--     match against auth.users.email regardless of user_id changes.
--   • is_superadmin() is SECURITY DEFINER so it can read admin_allowlist
--     even though that table denies all direct SELECTs.
--   • usage_snapshots is append-only. Dashboard queries the latest row per
--     club; older rows drive sparklines and 7d/30d growth calculations.
--   • snapshot_club_usage() is SECURITY DEFINER so pg_cron (running as
--     postgres) can insert without RLS trouble; it also needs read access
--     to auth.users and storage.objects, which SECURITY DEFINER grants.
--   • Storage attribution:
--       - logos             → path prefix {club_id}/
--       - session-media     → path prefix {club_id}/
--       - avatars (users)   → uploaded per user; split by active-membership
--                             count so a user in N clubs contributes 1/N
--                             of their avatar bytes to each club.
--       - avatars (virtual) → path prefix virtual_trainers/{vt_id}/…
--                             attributed via virtual_trainers.club_id.

-- ── admin_allowlist ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email      text        PRIMARY KEY,
  added_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  note       text
);

-- Deny-all RLS. Only SECURITY DEFINER helpers see rows.
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
-- (no policies = no access via API)

-- Seed with the initial superadmin so the dashboard works after migration.
INSERT INTO public.admin_allowlist (email, note)
  VALUES ('edwardschmuhl@web.de', 'initial superadmin')
  ON CONFLICT (email) DO NOTHING;

-- ── is_superadmin() ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_superadmin(uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_allowlist a
    JOIN auth.users u ON lower(u.email) = lower(a.email)
    WHERE u.id = uid
  );
$$;

REVOKE ALL ON FUNCTION public.is_superadmin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated, service_role;

-- ── usage_snapshots ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_snapshots (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id           uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  taken_at          timestamptz NOT NULL DEFAULT now(),
  db_bytes          bigint      NOT NULL DEFAULT 0,
  storage_bytes     bigint      NOT NULL DEFAULT 0,
  session_count     int         NOT NULL DEFAULT 0,
  teilnehmer_count  int         NOT NULL DEFAULT 0,
  media_count       int         NOT NULL DEFAULT 0,
  last_activity_at  timestamptz
);

CREATE INDEX IF NOT EXISTS usage_snapshots_club_time_idx
  ON public.usage_snapshots (club_id, taken_at DESC);

ALTER TABLE public.usage_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin_reads_usage_snapshots" ON public.usage_snapshots;
CREATE POLICY "superadmin_reads_usage_snapshots"
  ON public.usage_snapshots FOR SELECT
  TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- ── snapshot_club_usage() ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.snapshot_club_usage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.usage_snapshots
    (club_id, db_bytes, storage_bytes, session_count, teilnehmer_count, media_count, last_activity_at)
  SELECT
    c.id AS club_id,

    -- ── db_bytes: sum of pg_column_size across every club-scoped table ──
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.training_weeks x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.training_sessions x
                JOIN public.training_weeks tw ON tw.id = x.week_id
                WHERE tw.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.session_attendance x
                JOIN public.training_sessions ts ON ts.id = x.session_id
                JOIN public.training_weeks tw ON tw.id = ts.week_id
                WHERE tw.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.session_media x
                JOIN public.training_sessions ts ON ts.id = x.session_id
                JOIN public.training_weeks tw ON tw.id = ts.week_id
                WHERE tw.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.session_expected_groups x
                JOIN public.training_sessions ts ON ts.id = x.session_id
                JOIN public.training_weeks tw ON tw.id = ts.week_id
                WHERE tw.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.session_trainers x
                JOIN public.training_sessions ts ON ts.id = x.session_id
                JOIN public.training_weeks tw ON tw.id = ts.week_id
                WHERE tw.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.teilnehmer x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.teilnehmer_groups x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.teilnehmer_group_members x
                JOIN public.teilnehmer_groups tg ON tg.id = x.group_id
                WHERE tg.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.locations x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.club_topics x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.club_session_types x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.virtual_trainers x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.session_templates x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.trainer_availability x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.club_memberships x
                WHERE x.club_id = c.id), 0) +
    coalesce((SELECT sum(pg_column_size(x.*))::bigint FROM public.invitations x
                WHERE x.club_id = c.id), 0)
    AS db_bytes,

    -- ── storage_bytes: sum across logos, session-media, and avatars ──────
    coalesce((
      SELECT sum((o.metadata->>'size')::bigint)
      FROM storage.objects o
      WHERE o.bucket_id = 'logos'
        AND split_part(o.name, '/', 1) = c.id::text
    ), 0) +
    coalesce((
      SELECT sum((o.metadata->>'size')::bigint)
      FROM storage.objects o
      WHERE o.bucket_id = 'session-media'
        AND split_part(o.name, '/', 1) = c.id::text
    ), 0) +
    coalesce((
      -- Per-user avatar bytes, split evenly across all clubs the user is
      -- an active member of. First segment is the auth.users.id.
      SELECT sum(
        ((o.metadata->>'size')::bigint) / GREATEST(1, mc.membership_count)
      )
      FROM storage.objects o
      JOIN public.club_memberships cm
        ON cm.user_id::text = split_part(o.name, '/', 1)
       AND cm.status = 'active'
      JOIN (
        SELECT user_id, count(*)::int AS membership_count
        FROM public.club_memberships
        WHERE status = 'active'
        GROUP BY user_id
      ) mc ON mc.user_id = cm.user_id
      WHERE o.bucket_id = 'avatars'
        AND split_part(o.name, '/', 1) <> 'virtual_trainers'
        AND cm.club_id = c.id
    ), 0) +
    coalesce((
      -- Virtual-trainer avatars live under virtual_trainers/{vt_id}/…
      SELECT sum((o.metadata->>'size')::bigint)
      FROM storage.objects o
      JOIN public.virtual_trainers vt
        ON vt.id::text = split_part(o.name, '/', 2)
      WHERE o.bucket_id = 'avatars'
        AND split_part(o.name, '/', 1) = 'virtual_trainers'
        AND vt.club_id = c.id
    ), 0)
    AS storage_bytes,

    -- ── counts ──────────────────────────────────────────────────────────
    (SELECT count(*)::int FROM public.training_sessions ts
       JOIN public.training_weeks tw ON tw.id = ts.week_id
       WHERE tw.club_id = c.id)                                        AS session_count,
    (SELECT count(*)::int FROM public.teilnehmer
       WHERE club_id = c.id AND left_on IS NULL)                       AS teilnehmer_count,
    (SELECT count(*)::int FROM public.session_media sm
       JOIN public.training_sessions ts ON ts.id = sm.session_id
       JOIN public.training_weeks tw ON tw.id = ts.week_id
       WHERE tw.club_id = c.id)                                        AS media_count,

    -- ── last activity: newest write across any club-scoped table ────────
    GREATEST(
      c.created_at,
      (SELECT max(ts.updated_at) FROM public.training_sessions ts
         JOIN public.training_weeks tw ON tw.id = ts.week_id
         WHERE tw.club_id = c.id),
      (SELECT max(sa.checked_in_at) FROM public.session_attendance sa
         JOIN public.training_sessions ts ON ts.id = sa.session_id
         JOIN public.training_weeks tw ON tw.id = ts.week_id
         WHERE tw.club_id = c.id),
      (SELECT max(created_at) FROM public.teilnehmer WHERE club_id = c.id)
    )                                                                   AS last_activity_at
  FROM public.clubs c;
END;
$$;

REVOKE ALL ON FUNCTION public.snapshot_club_usage() FROM public;
GRANT EXECUTE ON FUNCTION public.snapshot_club_usage() TO service_role;

-- ── pg_cron nightly job ─────────────────────────────────────────────────
-- Idempotent: unschedule any existing job of the same name first.

SELECT cron.unschedule('nightly-usage-snapshot')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'nightly-usage-snapshot'
);

SELECT cron.schedule(
  'nightly-usage-snapshot',
  '0 3 * * *',   -- every day 03:00 UTC
  $$SELECT public.snapshot_club_usage()$$
);

-- Take an initial snapshot so the dashboard has data immediately.
SELECT public.snapshot_club_usage();
