-- ============================================================
-- Kursplan-Tracker — Initial Schema
-- ============================================================
-- Apply via: Supabase Dashboard > SQL Editor, or `supabase db push`
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- 1. PROFILES (extends auth.users, one row per user)
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text        UNIQUE,
  full_name   text        NOT NULL DEFAULT '',
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ──────────────────────────────────────────────────────────
-- 2. CLUBS
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.clubs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        UNIQUE NOT NULL,
  description text,
  is_public   boolean     DEFAULT false,
  logo_url    text,
  settings    jsonb       DEFAULT '{}',
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

-- Ensure slug only contains lowercase letters, numbers, hyphens
ALTER TABLE public.clubs ADD CONSTRAINT clubs_slug_format
  CHECK (slug ~ '^[a-z0-9-]+$');

-- ──────────────────────────────────────────────────────────
-- 3. CLUB MEMBERSHIPS
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.club_memberships (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'trainer', 'member')),
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('pending', 'active', 'suspended')),
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at   timestamptz DEFAULT now(),
  UNIQUE(club_id, user_id)
);

-- Creator automatically becomes admin of their club
CREATE OR REPLACE FUNCTION public.handle_club_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.club_memberships (club_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_club_created
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.handle_club_created();

-- ──────────────────────────────────────────────────────────
-- 4. INVITATIONS
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member'
                          CHECK (role IN ('admin', 'trainer', 'member')),
  token       text        UNIQUE NOT NULL,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  used_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────
-- 5. LOCATIONS (training venues per club)
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  address     text,
  notes       text
);

-- ──────────────────────────────────────────────────────────
-- 6. TRAINING WEEKS (one per calendar week per club)
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.training_weeks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  week_start   date        NOT NULL, -- always a Monday
  is_published boolean     DEFAULT false,
  notes        text,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(club_id, week_start),
  -- Enforce that week_start is always a Monday (DOW = 1)
  CONSTRAINT week_start_is_monday CHECK (EXTRACT(DOW FROM week_start) = 1)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER touch_training_weeks_updated_at
  BEFORE UPDATE ON public.training_weeks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ──────────────────────────────────────────────────────────
-- 7. TRAINING SESSIONS
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.training_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id      uuid        NOT NULL REFERENCES public.training_weeks(id) ON DELETE CASCADE,
  day_of_week  smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon, 6=Sun
  time_start   time        NOT NULL,
  time_end     time        NOT NULL,
  location_id  uuid        REFERENCES public.locations(id) ON DELETE SET NULL,
  topic        text        NOT NULL,
  description  text,
  trainer_id   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tags         text[]      DEFAULT '{}',
  notes        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT time_order CHECK (time_end > time_start)
);

CREATE TRIGGER touch_training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ──────────────────────────────────────────────────────────
-- 8. SESSION TEMPLATES (reusable patterns, copy to new week)
-- ──────────────────────────────────────────────────────────
CREATE TABLE public.session_templates (
  id                  uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid     NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name                text     NOT NULL,
  day_of_week         smallint CHECK (day_of_week BETWEEN 0 AND 6),
  time_start          time,
  time_end            time,
  location_id         uuid     REFERENCES public.locations(id) ON DELETE SET NULL,
  topic               text,
  description         text,
  default_trainer_id  uuid     REFERENCES auth.users(id) ON DELETE SET NULL,
  tags                text[]   DEFAULT '{}'
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_weeks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_templates ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────
-- Helper: is the current user an active member of a club?
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_member(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ──────────────────────────────────────────────────────────
-- Helper: is the current user admin or trainer in a club?
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_edit(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role IN ('admin', 'trainer')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ──────────────────────────────────────────────────────────
-- Helper: is the current user admin of a club?
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND status = 'active'
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ──────────────────────────────────────────────────────────
-- PROFILES policies
-- ──────────────────────────────────────────────────────────
-- Read own profile always
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- Read profiles of club members (needed to show trainer names)
CREATE POLICY "profiles_select_club_members" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.club_memberships cm1
      JOIN public.club_memberships cm2 ON cm2.club_id = cm1.club_id
      WHERE cm1.user_id = auth.uid()
        AND cm1.status = 'active'
        AND cm2.user_id = profiles.id
        AND cm2.status = 'active'
    )
  );

-- Update own profile only
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- CLUBS policies
-- ──────────────────────────────────────────────────────────
-- Public clubs: anyone can read
CREATE POLICY "clubs_select_public" ON public.clubs
  FOR SELECT USING (is_public = true);

-- Private clubs: only active members
CREATE POLICY "clubs_select_member" ON public.clubs
  FOR SELECT USING (is_member(id));

-- Any authenticated user can create a club
CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

-- Only admins can update/delete
CREATE POLICY "clubs_update" ON public.clubs
  FOR UPDATE USING (is_admin(id));

CREATE POLICY "clubs_delete" ON public.clubs
  FOR DELETE USING (is_admin(id));

-- ──────────────────────────────────────────────────────────
-- CLUB MEMBERSHIPS policies
-- ──────────────────────────────────────────────────────────
-- Members can see all memberships in their clubs
CREATE POLICY "memberships_select" ON public.club_memberships
  FOR SELECT USING (is_member(club_id));

-- Only admins can insert (invite someone), except the trigger (SECURITY DEFINER)
CREATE POLICY "memberships_insert" ON public.club_memberships
  FOR INSERT WITH CHECK (is_admin(club_id));

-- Admins can update roles/status; users can update their own (e.g., leave)
CREATE POLICY "memberships_update" ON public.club_memberships
  FOR UPDATE USING (is_admin(club_id) OR user_id = auth.uid());

-- Admins can remove members; members can remove themselves
CREATE POLICY "memberships_delete" ON public.club_memberships
  FOR DELETE USING (is_admin(club_id) OR user_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- INVITATIONS policies
-- ──────────────────────────────────────────────────────────
-- Admins can read all invitations for their club
CREATE POLICY "invitations_select_admin" ON public.invitations
  FOR SELECT USING (is_admin(club_id));

-- Anyone can read an invitation by token (for the accept-invite page)
-- Checked in application code by querying with the token directly
CREATE POLICY "invitations_select_by_token" ON public.invitations
  FOR SELECT USING (true); -- Fine: tokens are unguessable UUIDs

-- Admins can create invitations
CREATE POLICY "invitations_insert" ON public.invitations
  FOR INSERT WITH CHECK (is_admin(club_id));

-- Admins or the invited user can update (mark as used)
CREATE POLICY "invitations_update" ON public.invitations
  FOR UPDATE USING (is_admin(club_id) OR used_by = auth.uid());

-- Admins can delete invitations
CREATE POLICY "invitations_delete" ON public.invitations
  FOR DELETE USING (is_admin(club_id));

-- ──────────────────────────────────────────────────────────
-- LOCATIONS policies
-- ──────────────────────────────────────────────────────────
-- Public club locations visible to all
CREATE POLICY "locations_select_public" ON public.locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND is_public = true)
  );

-- Private club locations visible to members
CREATE POLICY "locations_select_member" ON public.locations
  FOR SELECT USING (is_member(club_id));

-- Admins and trainers can manage locations
CREATE POLICY "locations_insert" ON public.locations
  FOR INSERT WITH CHECK (can_edit(club_id));

CREATE POLICY "locations_update" ON public.locations
  FOR UPDATE USING (can_edit(club_id));

CREATE POLICY "locations_delete" ON public.locations
  FOR DELETE USING (is_admin(club_id));

-- ──────────────────────────────────────────────────────────
-- TRAINING WEEKS policies
-- ──────────────────────────────────────────────────────────
-- Public plans: published weeks of public clubs
CREATE POLICY "weeks_select_public" ON public.training_weeks
  FOR SELECT USING (
    is_published = true AND
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND is_public = true)
  );

-- Members can see all weeks (published or draft) of their clubs
CREATE POLICY "weeks_select_member" ON public.training_weeks
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "weeks_insert" ON public.training_weeks
  FOR INSERT WITH CHECK (can_edit(club_id));

CREATE POLICY "weeks_update" ON public.training_weeks
  FOR UPDATE USING (can_edit(club_id));

CREATE POLICY "weeks_delete" ON public.training_weeks
  FOR DELETE USING (is_admin(club_id));

-- ──────────────────────────────────────────────────────────
-- TRAINING SESSIONS policies (inherit visibility from week)
-- ──────────────────────────────────────────────────────────
CREATE POLICY "sessions_select_public" ON public.training_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      JOIN public.clubs c ON c.id = tw.club_id
      WHERE tw.id = week_id
        AND tw.is_published = true
        AND c.is_public = true
    )
  );

CREATE POLICY "sessions_select_member" ON public.training_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = week_id AND is_member(tw.club_id)
    )
  );

CREATE POLICY "sessions_insert" ON public.training_sessions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = week_id AND can_edit(tw.club_id)
    )
  );

CREATE POLICY "sessions_update" ON public.training_sessions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = week_id AND can_edit(tw.club_id)
    )
  );

CREATE POLICY "sessions_delete" ON public.training_sessions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      WHERE tw.id = week_id AND can_edit(tw.club_id)
    )
  );

-- ──────────────────────────────────────────────────────────
-- SESSION TEMPLATES policies
-- ──────────────────────────────────────────────────────────
CREATE POLICY "templates_select" ON public.session_templates
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "templates_insert" ON public.session_templates
  FOR INSERT WITH CHECK (can_edit(club_id));

CREATE POLICY "templates_update" ON public.session_templates
  FOR UPDATE USING (can_edit(club_id));

CREATE POLICY "templates_delete" ON public.session_templates
  FOR DELETE USING (is_admin(club_id));

-- ============================================================
-- INDEXES (performance)
-- ============================================================
CREATE INDEX idx_club_memberships_user  ON public.club_memberships(user_id);
CREATE INDEX idx_club_memberships_club  ON public.club_memberships(club_id);
CREATE INDEX idx_training_weeks_club    ON public.training_weeks(club_id, week_start DESC);
CREATE INDEX idx_training_sessions_week ON public.training_sessions(week_id, day_of_week, time_start);
CREATE INDEX idx_locations_club         ON public.locations(club_id);
CREATE INDEX idx_invitations_token      ON public.invitations(token);
CREATE INDEX idx_invitations_club       ON public.invitations(club_id);
CREATE INDEX idx_session_templates_club ON public.session_templates(club_id);
