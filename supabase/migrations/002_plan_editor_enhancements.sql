-- ─────────────────────────────────────────────────────────────
-- 002 – Plan editor enhancements
--   • club_topics    – predefined topics per club
--   • session_trainers – multiple trainers per session
-- ─────────────────────────────────────────────────────────────

-- ── club_topics ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS club_topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (club_id, name)
);

ALTER TABLE club_topics ENABLE ROW LEVEL SECURITY;

-- Active members can read their club's topics
CREATE POLICY "members_read_topics" ON club_topics
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins can add / update / delete topics
CREATE POLICY "admins_manage_topics" ON club_topics
  FOR ALL USING (
    club_id IN (
      SELECT club_id FROM club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  ) WITH CHECK (
    club_id IN (
      SELECT club_id FROM club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- ── session_trainers ──────────────────────────────────────────
-- Junction table: a session can have multiple trainers
CREATE TABLE IF NOT EXISTS session_trainers (
  session_id uuid REFERENCES training_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (session_id, user_id)
);

ALTER TABLE session_trainers ENABLE ROW LEVEL SECURITY;

-- Any active club member can read (needed for viewing the plan)
CREATE POLICY "members_read_session_trainers" ON session_trainers
  FOR SELECT USING (
    session_id IN (
      SELECT ts.id
      FROM   training_sessions ts
      JOIN   training_weeks tw ON ts.week_id = tw.id
      WHERE  tw.club_id IN (
        SELECT club_id FROM club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Also allow reads for public clubs (no-auth visitors can view published plans)
CREATE POLICY "public_read_session_trainers" ON session_trainers
  FOR SELECT USING (
    session_id IN (
      SELECT ts.id
      FROM   training_sessions ts
      JOIN   training_weeks tw ON ts.week_id = tw.id
      JOIN   clubs c ON tw.club_id = c.id
      WHERE  c.is_public = true AND tw.is_published = true
    )
  );

-- Admins and trainers can manage session_trainers
CREATE POLICY "trainers_manage_session_trainers" ON session_trainers
  FOR ALL USING (
    session_id IN (
      SELECT ts.id
      FROM   training_sessions ts
      JOIN   training_weeks tw ON ts.week_id = tw.id
      WHERE  tw.club_id IN (
        SELECT club_id FROM club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('admin', 'trainer')
      )
    )
  ) WITH CHECK (
    session_id IN (
      SELECT ts.id
      FROM   training_sessions ts
      JOIN   training_weeks tw ON ts.week_id = tw.id
      WHERE  tw.club_id IN (
        SELECT club_id FROM club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
          AND role IN ('admin', 'trainer')
      )
    )
  );
