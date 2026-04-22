-- ─────────────────────────────────────────────────────────────
-- 003 – Locations maps_url + invite RPC + creator backfill
-- ─────────────────────────────────────────────────────────────

-- ── Add maps_url to locations ─────────────────────────────────
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS maps_url text;

-- ── Backfill: ensure every club's creator has an admin membership
-- (fixes clubs created before the trigger was applied)
INSERT INTO public.club_memberships (club_id, user_id, role, status)
SELECT c.id, c.created_by, 'admin', 'active'
FROM   public.clubs c
WHERE  c.created_by IS NOT NULL
  AND  NOT EXISTS (
         SELECT 1 FROM public.club_memberships cm
         WHERE  cm.club_id = c.id AND cm.user_id = c.created_by
       )
ON CONFLICT (club_id, user_id) DO NOTHING;

-- ── RPC: accept an invitation (SECURITY DEFINER → bypasses RLS) ──
-- Called from the browser when a user clicks "Einladung annehmen".
-- Validates the token, inserts / upserts the membership, marks the
-- invitation as used, and returns the club_id for redirect.
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
  -- Require authentication
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;

  -- Lock and fetch the invitation row
  SELECT * INTO v_invite
  FROM   public.invitations
  WHERE  token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Einladung nicht gefunden';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Einladung ist abgelaufen';
  END IF;

  IF v_invite.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Einladung wurde bereits verwendet';
  END IF;

  -- Insert membership (or re-activate if user was previously suspended)
  INSERT INTO public.club_memberships (club_id, user_id, role, status, invited_by)
  VALUES (v_invite.club_id, v_user_id, v_invite.role, 'active', v_invite.created_by)
  ON CONFLICT (club_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = 'active', invited_by = EXCLUDED.invited_by;

  -- Mark invitation as consumed
  UPDATE public.invitations
  SET    used_at = now(), used_by = v_user_id
  WHERE  id = v_invite.id;

  RETURN v_invite.club_id;
END;
$$;

-- Allow any authenticated user to call the RPC
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
