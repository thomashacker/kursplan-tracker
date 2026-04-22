-- ─────────────────────────────────────────────────────────────
-- 005 – Club session types table + make topic nullable
-- ─────────────────────────────────────────────────────────────

-- ── club_session_types (same structure as club_topics) ────────
CREATE TABLE IF NOT EXISTS public.club_session_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (club_id, name)
);

ALTER TABLE public.club_session_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_session_types" ON public.club_session_types
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "admins_manage_session_types" ON public.club_session_types
  FOR ALL USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  ) WITH CHECK (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- ── Make topic nullable (no longer used as required title) ─────
ALTER TABLE public.training_sessions
  ALTER COLUMN topic DROP NOT NULL,
  ALTER COLUMN topic SET DEFAULT NULL;

-- Clear any placeholder empty-string topics left from previous saves
UPDATE public.training_sessions SET topic = NULL WHERE topic = '';
