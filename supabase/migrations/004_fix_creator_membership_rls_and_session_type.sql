-- ─────────────────────────────────────────────────────────────
-- 004 – Fix creator membership RLS + multi-topic/type on sessions
-- ─────────────────────────────────────────────────────────────

-- ── Fix: creator can't insert their own admin membership
--    because memberships_insert requires is_admin() which returns
--    false on a brand-new club with zero rows.
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "memberships_insert_creator" ON public.club_memberships
  FOR INSERT WITH CHECK (
    user_id   = auth.uid()
    AND role   = 'admin'
    AND status = 'active'
    AND club_id IN (
      SELECT id FROM public.clubs WHERE created_by = auth.uid()
    )
  );

-- ── Re-ensure trigger (safe if already present) ───────────────
CREATE OR REPLACE FUNCTION public.handle_club_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.club_memberships (club_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active')
  ON CONFLICT (club_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_club_created ON public.clubs;
CREATE TRIGGER on_club_created
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.handle_club_created();

-- ── Backfill existing clubs ───────────────────────────────────
INSERT INTO public.club_memberships (club_id, user_id, role, status)
SELECT c.id, c.created_by, 'admin', 'active'
FROM   public.clubs c
WHERE  c.created_by IS NOT NULL
  AND  NOT EXISTS (
    SELECT 1 FROM public.club_memberships cm
    WHERE cm.club_id = c.id AND cm.user_id = c.created_by
  )
ON CONFLICT (club_id, user_id) DO NOTHING;

-- ── Multi-topic / multi-type arrays on sessions ───────────────
-- topics      : content topics pulled from club_topics (multi-select)
-- session_types: audience/level categories (Kindertraining, Anfänger, …)
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS topics       text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_types text[] DEFAULT '{}';
