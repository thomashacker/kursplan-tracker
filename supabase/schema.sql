-- ============================================================
-- Kurs.Y — Complete Schema (merged from migrations 001–013)
-- ============================================================
-- Use this for a fresh Supabase project instead of running
-- all individual migrations. Paste into the SQL Editor or:
--   supabase db reset --linked  (with this file as seed)
--
-- Prerequisites:
--   • pg_cron enabled (Dashboard → Database → Extensions)
--     Required only for recurring session auto-extension.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- TABLES
-- ──────────────────────────────────────────────────────────

-- profiles (auto-created on signup via trigger)
CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text        UNIQUE,
  full_name   text        NOT NULL DEFAULT '',
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
);

-- clubs
CREATE TABLE public.clubs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  slug        text        UNIQUE NOT NULL,
  description text,
  is_public   boolean     DEFAULT false,
  logo_url    text,
  settings    jsonb       DEFAULT '{}',
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  CONSTRAINT clubs_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- club_memberships
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

-- invitations (email-based, no link sharing needed)
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

-- locations (training venues per club)
CREATE TABLE public.locations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  address     text,
  notes       text,
  maps_url    text
);

-- club_topics (predefined topic tags per club)
CREATE TABLE public.club_topics (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (club_id, name)
);

-- club_session_types (audience/level categories per club)
CREATE TABLE public.club_session_types (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (club_id, name)
);

-- training_weeks (one per calendar week per club)
CREATE TABLE public.training_weeks (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id      uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  week_start   date        NOT NULL,  -- always a Monday
  is_published boolean     DEFAULT false,
  notes        text,
  created_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(club_id, week_start),
  CONSTRAINT week_start_is_monday CHECK (EXTRACT(DOW FROM week_start) = 1)
);

-- session_templates (recurring session patterns)
CREATE TABLE public.session_templates (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid        NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  day_of_week         smallint    CHECK (day_of_week BETWEEN 0 AND 6),
  time_start          time,
  time_end            time,
  location_id         uuid        REFERENCES public.locations(id) ON DELETE SET NULL,
  topic               text,
  description         text,
  default_trainer_id  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tags                text[]      DEFAULT '{}',
  topics              text[]      NOT NULL DEFAULT '{}',
  session_types       text[]      NOT NULL DEFAULT '{}',
  trainer_ids         uuid[]      NOT NULL DEFAULT '{}',
  is_cancelled        boolean     NOT NULL DEFAULT false,
  generated_through   date,
  auto_extend         boolean     NOT NULL DEFAULT true
);

-- training_sessions (individual sessions within a week)
CREATE TABLE public.training_sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       uuid        NOT NULL REFERENCES public.training_weeks(id) ON DELETE CASCADE,
  day_of_week   smallint    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Mon, 6=Sun
  time_start    time        NOT NULL,
  time_end      time        NOT NULL,
  location_id   uuid        REFERENCES public.locations(id) ON DELETE SET NULL,
  topic         text        DEFAULT NULL,
  description   text,
  trainer_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tags          text[]      DEFAULT '{}',
  notes         text,
  topics        text[]      DEFAULT '{}',
  session_types text[]      DEFAULT '{}',
  is_cancelled  boolean     NOT NULL DEFAULT false,
  template_id   uuid        REFERENCES public.session_templates(id) ON DELETE SET NULL,
  is_modified   boolean     NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT time_order CHECK (time_end > time_start)
);

-- session_trainers (multiple trainers per session)
CREATE TABLE public.session_trainers (
  session_id  uuid  NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  user_id     uuid  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, user_id)
);

-- ──────────────────────────────────────────────────────────
-- INDEXES
-- ──────────────────────────────────────────────────────────

CREATE INDEX idx_club_memberships_user        ON public.club_memberships(user_id);
CREATE INDEX idx_club_memberships_club        ON public.club_memberships(club_id);
CREATE INDEX idx_training_weeks_club          ON public.training_weeks(club_id, week_start DESC);
CREATE INDEX idx_training_sessions_week       ON public.training_sessions(week_id, day_of_week, time_start);
CREATE INDEX idx_training_sessions_template   ON public.training_sessions(template_id);
CREATE INDEX idx_locations_club               ON public.locations(club_id);
CREATE INDEX idx_invitations_token            ON public.invitations(token);
CREATE INDEX idx_invitations_club             ON public.invitations(club_id);
CREATE INDEX idx_session_templates_club       ON public.session_templates(club_id);

-- ──────────────────────────────────────────────────────────
-- FUNCTIONS & TRIGGERS
-- ──────────────────────────────────────────────────────────

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Creator automatically becomes admin of their club (ON CONFLICT safe)
CREATE OR REPLACE FUNCTION public.handle_club_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.club_memberships (club_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_club_created
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.handle_club_created();

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

CREATE TRIGGER touch_training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ──────────────────────────────────────────────────────────
-- HELPER FUNCTIONS (used in RLS policies)
-- ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_member(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id AND user_id = auth.uid() AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.can_edit(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id AND user_id = auth.uid() AND status = 'active'
      AND role IN ('admin', 'trainer')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin(p_club_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_memberships
    WHERE club_id = p_club_id AND user_id = auth.uid() AND status = 'active'
      AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Accept a token-based invitation (called from the accept-invite page)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.invitations;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Nicht angemeldet'; END IF;

  SELECT * INTO v_invite FROM public.invitations WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Einladung nicht gefunden'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'Einladung ist abgelaufen'; END IF;
  IF v_invite.used_at IS NOT NULL THEN RAISE EXCEPTION 'Einladung wurde bereits verwendet'; END IF;

  INSERT INTO public.club_memberships (club_id, user_id, role, status, invited_by)
  VALUES (v_invite.club_id, v_user_id, v_invite.role, 'active', v_invite.created_by)
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by;

  UPDATE public.invitations SET used_at = now(), used_by = v_user_id WHERE id = v_invite.id;

  RETURN v_invite.club_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- Auto-accept pending email invitations when a user signs up or loads the dashboard
CREATE OR REPLACE FUNCTION public.accept_pending_invitations(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  inv        RECORD;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = p_user_id;
  IF user_email IS NULL THEN RETURN; END IF;

  FOR inv IN
    SELECT * FROM public.invitations
    WHERE lower(email) = lower(user_email) AND used_at IS NULL AND expires_at > now()
  LOOP
    INSERT INTO public.club_memberships (club_id, user_id, role, status, invited_by)
    VALUES (inv.club_id, p_user_id, inv.role, 'active', inv.created_by)
    ON CONFLICT (club_id, user_id) DO NOTHING;

    UPDATE public.invitations SET used_at = now(), used_by = p_user_id WHERE id = inv.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_pending_invitations(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public._trigger_accept_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.accept_pending_invitations(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_accept_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public._trigger_accept_invitations();

-- Extend recurring sessions whose horizon is within 2 weeks (called by pg_cron)
CREATE OR REPLACE FUNCTION public.extend_recurring_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl         RECORD;
  new_from    date;
  new_through date;
  i           integer;
  wk_start    date;
  wk_id       uuid;
  sess_id     uuid;
  trainer_uid uuid;
BEGIN
  FOR tpl IN
    SELECT id, club_id, day_of_week, time_start, time_end, location_id,
           COALESCE(topics, '{}') AS topics,
           COALESCE(session_types, '{}') AS session_types,
           description, default_trainer_id,
           COALESCE(trainer_ids, '{}') AS trainer_ids,
           COALESCE(is_cancelled, false) AS is_cancelled,
           generated_through
    FROM public.session_templates
    WHERE auto_extend = true
      AND generated_through IS NOT NULL
      AND generated_through <= (CURRENT_DATE + interval '2 weeks')
  LOOP
    new_from    := tpl.generated_through + interval '1 week';
    new_through := tpl.generated_through + interval '8 weeks';

    FOR i IN 0..7 LOOP
      wk_start := new_from + (i * interval '1 week');

      SELECT id INTO wk_id FROM public.training_weeks
      WHERE club_id = tpl.club_id AND week_start = wk_start;

      IF wk_id IS NULL THEN
        INSERT INTO public.training_weeks (club_id, week_start, is_published)
        VALUES (tpl.club_id, wk_start, true)
        RETURNING id INTO wk_id;
      END IF;

      IF EXISTS (SELECT 1 FROM public.training_sessions WHERE template_id = tpl.id AND week_id = wk_id) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.training_sessions (
        week_id, day_of_week, time_start, time_end, location_id,
        topics, session_types, description, trainer_id, is_cancelled,
        template_id, is_modified, tags, topic
      )
      VALUES (
        wk_id, tpl.day_of_week, tpl.time_start, tpl.time_end, tpl.location_id,
        tpl.topics, tpl.session_types, tpl.description, tpl.default_trainer_id, tpl.is_cancelled,
        tpl.id, false, '{}', NULL
      )
      RETURNING id INTO sess_id;

      IF array_length(tpl.trainer_ids, 1) > 0 THEN
        FOREACH trainer_uid IN ARRAY tpl.trainer_ids LOOP
          INSERT INTO public.session_trainers (session_id, user_id)
          VALUES (sess_id, trainer_uid)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;

    UPDATE public.session_templates SET generated_through = new_through WHERE id = tpl.id;
  END LOOP;
END;
$$;

-- Schedule recurring session extension every Monday at 05:00 UTC
-- Requires pg_cron extension (Dashboard → Database → Extensions → pg_cron)
SELECT cron.unschedule('extend-recurring-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'extend-recurring-sessions');

SELECT cron.schedule(
  'extend-recurring-sessions',
  '0 5 * * 1',
  'SELECT public.extend_recurring_sessions()'
);

-- ──────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_topics        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_session_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_weeks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_trainers   ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_club_members" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.club_memberships cm1
      JOIN public.club_memberships cm2 ON cm2.club_id = cm1.club_id
      WHERE cm1.user_id = auth.uid() AND cm1.status = 'active'
        AND cm2.user_id = profiles.id  AND cm2.status = 'active'
    )
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Allow unauthenticated users to read profiles of trainers in public published sessions
CREATE POLICY "profiles_select_public_trainers" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.session_trainers st
      JOIN public.training_sessions ts ON ts.id = st.session_id
      JOIN public.training_weeks    tw ON tw.id = ts.week_id
      JOIN public.clubs              c  ON c.id  = tw.club_id
      WHERE st.user_id = profiles.id AND c.is_public = true AND tw.is_published = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      JOIN public.clubs           c  ON c.id  = tw.club_id
      WHERE ts.trainer_id = profiles.id AND c.is_public = true AND tw.is_published = true
    )
  );

-- clubs
CREATE POLICY "clubs_select_public" ON public.clubs
  FOR SELECT USING (is_public = true);

CREATE POLICY "clubs_select_member" ON public.clubs
  FOR SELECT USING (is_member(id));

-- Club creation restricted to users with can_create_club = true in app_metadata.
-- Grant via SQL: UPDATE auth.users SET raw_app_meta_data =
--   jsonb_set(raw_app_meta_data, '{can_create_club}', 'true') WHERE email = '...';
CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND (auth.jwt() -> 'app_metadata' ->> 'can_create_club')::boolean = true
  );

CREATE POLICY "clubs_update" ON public.clubs
  FOR UPDATE USING (is_admin(id));

CREATE POLICY "clubs_delete" ON public.clubs
  FOR DELETE USING (is_admin(id));

-- club_memberships
CREATE POLICY "memberships_select" ON public.club_memberships
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "memberships_insert" ON public.club_memberships
  FOR INSERT WITH CHECK (is_admin(club_id));

-- Allows the on_club_created trigger to insert the creator's admin membership
CREATE POLICY "memberships_insert_creator" ON public.club_memberships
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND role = 'admin' AND status = 'active'
    AND club_id IN (SELECT id FROM public.clubs WHERE created_by = auth.uid())
  );

CREATE POLICY "memberships_update" ON public.club_memberships
  FOR UPDATE USING (is_admin(club_id) OR user_id = auth.uid());

CREATE POLICY "memberships_delete" ON public.club_memberships
  FOR DELETE USING (is_admin(club_id) OR user_id = auth.uid());

-- invitations
CREATE POLICY "invitations_select_admin" ON public.invitations
  FOR SELECT USING (is_admin(club_id));

CREATE POLICY "invitations_select_by_token" ON public.invitations
  FOR SELECT USING (true);  -- tokens are unguessable UUIDs

CREATE POLICY "invitations_insert" ON public.invitations
  FOR INSERT WITH CHECK (is_admin(club_id));

CREATE POLICY "invitations_update" ON public.invitations
  FOR UPDATE USING (is_admin(club_id) OR used_by = auth.uid());

CREATE POLICY "invitations_delete" ON public.invitations
  FOR DELETE USING (is_admin(club_id));

-- locations
CREATE POLICY "locations_select_public" ON public.locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND is_public = true)
  );

CREATE POLICY "locations_select_member" ON public.locations
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "locations_insert" ON public.locations
  FOR INSERT WITH CHECK (can_edit(club_id));

CREATE POLICY "locations_update" ON public.locations
  FOR UPDATE USING (can_edit(club_id));

CREATE POLICY "locations_delete" ON public.locations
  FOR DELETE USING (is_admin(club_id));

-- club_topics
CREATE POLICY "members_read_topics" ON public.club_topics
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "admins_manage_topics" ON public.club_topics
  FOR ALL USING (is_admin(club_id)) WITH CHECK (is_admin(club_id));

-- club_session_types
CREATE POLICY "members_read_session_types" ON public.club_session_types
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "admins_manage_session_types" ON public.club_session_types
  FOR ALL USING (is_admin(club_id)) WITH CHECK (is_admin(club_id));

-- training_weeks
CREATE POLICY "weeks_select_public" ON public.training_weeks
  FOR SELECT USING (
    is_published = true AND
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_id AND is_public = true)
  );

CREATE POLICY "weeks_select_member" ON public.training_weeks
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "weeks_insert" ON public.training_weeks
  FOR INSERT WITH CHECK (can_edit(club_id));

CREATE POLICY "weeks_update" ON public.training_weeks
  FOR UPDATE USING (can_edit(club_id));

CREATE POLICY "weeks_delete" ON public.training_weeks
  FOR DELETE USING (is_admin(club_id));

-- session_templates
CREATE POLICY "templates_select" ON public.session_templates
  FOR SELECT USING (is_member(club_id));

CREATE POLICY "templates_insert" ON public.session_templates
  FOR INSERT WITH CHECK (can_edit(club_id));

CREATE POLICY "templates_update" ON public.session_templates
  FOR UPDATE USING (can_edit(club_id));

CREATE POLICY "templates_delete" ON public.session_templates
  FOR DELETE USING (is_admin(club_id));

-- training_sessions
CREATE POLICY "sessions_select_public" ON public.training_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_weeks tw
      JOIN public.clubs c ON c.id = tw.club_id
      WHERE tw.id = week_id AND tw.is_published = true AND c.is_public = true
    )
  );

CREATE POLICY "sessions_select_member" ON public.training_sessions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.training_weeks tw WHERE tw.id = week_id AND is_member(tw.club_id))
  );

CREATE POLICY "sessions_insert" ON public.training_sessions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.training_weeks tw WHERE tw.id = week_id AND can_edit(tw.club_id))
  );

CREATE POLICY "sessions_update" ON public.training_sessions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.training_weeks tw WHERE tw.id = week_id AND can_edit(tw.club_id))
  );

CREATE POLICY "sessions_delete" ON public.training_sessions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.training_weeks tw WHERE tw.id = week_id AND can_edit(tw.club_id))
  );

-- session_trainers
CREATE POLICY "members_read_session_trainers" ON public.session_trainers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON ts.week_id = tw.id
      WHERE ts.id = session_id AND is_member(tw.club_id)
    )
  );

CREATE POLICY "public_read_session_trainers" ON public.session_trainers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON ts.week_id = tw.id
      JOIN public.clubs c ON tw.club_id = c.id
      WHERE ts.id = session_id AND c.is_public = true AND tw.is_published = true
    )
  );

CREATE POLICY "trainers_manage_session_trainers" ON public.session_trainers
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON ts.week_id = tw.id
      WHERE ts.id = session_id AND can_edit(tw.club_id)
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON ts.week_id = tw.id
      WHERE ts.id = session_id AND can_edit(tw.club_id)
    )
  );
