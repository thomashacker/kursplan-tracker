-- 018_security_fixes.sql
-- Fix two security/correctness issues:
--
-- 1. invitations_select_by_token used USING (true), exposing all invitation
--    rows (including invitee emails) to any caller.  Replace with a
--    SECURITY DEFINER RPC that only returns the single row matching a token.
--
-- 2. virtual_trainers had no public-read policy, so unauthenticated visitors
--    on public plan pages could not see virtual trainer names/avatars.

-- ── 1. Fix invitation exposure ────────────────────────────────────────────────

-- Drop the unsafe public policy if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invitations'
  ) THEN
    DROP POLICY IF EXISTS "invitations_select_by_token" ON public.invitations;
  END IF;
END;
$$;

-- Lookup a single invitation by token (safe: caller gets exactly one row
-- only if token matches; SECURITY DEFINER bypasses RLS as intended).
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id            uuid,
  club_id       uuid,
  email         text,
  role          text,
  token         text,
  created_by    uuid,
  expires_at    timestamptz,
  used_at       timestamptz,
  used_by       uuid,
  clubs         jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.club_id,
    i.email,
    i.role,
    i.token,
    i.created_by,
    i.expires_at,
    i.used_at,
    i.used_by,
    jsonb_build_object('name', c.name, 'slug', c.slug) AS clubs
  FROM public.invitations i
  JOIN public.clubs c ON c.id = i.club_id
  WHERE i.token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;


-- ── 2. Virtual trainers: allow public read for public clubs ───────────────────

-- Mirrors the logic in 015_profiles_public_trainer_read.sql.
-- Without this, unauthenticated visitors on /verein/[slug] see empty trainer
-- names whenever a session is assigned a virtual trainer.

CREATE POLICY "public can read virtual trainers of public clubs"
  ON public.virtual_trainers
  FOR SELECT
  USING (
    club_id IN (
      SELECT id FROM public.clubs WHERE is_public = true
    )
  );
