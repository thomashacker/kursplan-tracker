-- 019_teilnehmer.sql
-- Attendance tracking: participants (Teilnehmer), groups, session check-ins.
-- Purely additive — no existing tables are dropped or destructively altered.

-- ── 1. Teilnehmer ────────────────────────────────────────────────────────────
-- Physical participants (kids, club members without app accounts).
-- Managed by trainers/admins, identified by UUID.

CREATE TABLE public.teilnehmer (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.teilnehmer ENABLE ROW LEVEL SECURITY;

-- Active members can read
CREATE POLICY "members can read teilnehmer"
  ON public.teilnehmer FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins and trainers can insert / update / delete
CREATE POLICY "trainers can manage teilnehmer"
  ON public.teilnehmer FOR ALL
  USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'trainer')
    )
  );

-- ── 2. Teilnehmer groups ─────────────────────────────────────────────────────

CREATE TABLE public.teilnehmer_groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text,                      -- optional hex, e.g. "#6366f1"
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, name)
);

ALTER TABLE public.teilnehmer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read teilnehmer_groups"
  ON public.teilnehmer_groups FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "trainers can manage teilnehmer_groups"
  ON public.teilnehmer_groups FOR ALL
  USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
        AND role IN ('admin', 'trainer')
    )
  );

-- ── 3. Group memberships (many-to-many) ──────────────────────────────────────

CREATE TABLE public.teilnehmer_group_members (
  group_id      uuid NOT NULL REFERENCES public.teilnehmer_groups(id) ON DELETE CASCADE,
  teilnehmer_id uuid NOT NULL REFERENCES public.teilnehmer(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, teilnehmer_id)
);

ALTER TABLE public.teilnehmer_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read group memberships"
  ON public.teilnehmer_group_members FOR SELECT
  USING (
    group_id IN (
      SELECT tg.id FROM public.teilnehmer_groups tg
      WHERE tg.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "trainers can manage group memberships"
  ON public.teilnehmer_group_members FOR ALL
  USING (
    group_id IN (
      SELECT tg.id FROM public.teilnehmer_groups tg
      WHERE tg.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('admin', 'trainer')
      )
    )
  );

-- ── 4. Expected attendance per session ───────────────────────────────────────
-- Add a mode column to training_sessions (non-destructive, defaults to 'open')

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS expected_attendance text
  CHECK (expected_attendance IN ('everyone', 'groups', 'open'))
  DEFAULT 'open';

-- Which groups are expected for sessions in 'groups' mode
CREATE TABLE public.session_expected_groups (
  session_id uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  group_id   uuid NOT NULL REFERENCES public.teilnehmer_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, group_id)
);

ALTER TABLE public.session_expected_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read session expected groups"
  ON public.session_expected_groups FOR SELECT
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE tw.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "trainers can manage session expected groups"
  ON public.session_expected_groups FOR ALL
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE tw.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('admin', 'trainer')
      )
    )
  );

-- ── 5. Session attendance records ────────────────────────────────────────────
-- Actual check-ins: who showed up, who was excused, who was absent.
-- Retroactive editing is intentionally allowed (no time-lock).

CREATE TABLE public.session_attendance (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  teilnehmer_id uuid        NOT NULL REFERENCES public.teilnehmer(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'present'
                            CHECK (status IN ('present', 'absent', 'excused')),
  checked_in_at timestamptz DEFAULT now(),
  checked_in_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  method        text        DEFAULT 'manual'
                            CHECK (method IN ('qr', 'manual')),
  UNIQUE(session_id, teilnehmer_id)
);

ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can read session attendance"
  ON public.session_attendance FOR SELECT
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE tw.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

CREATE POLICY "trainers can manage session attendance"
  ON public.session_attendance FOR ALL
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE tw.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('admin', 'trainer')
      )
    )
  );
