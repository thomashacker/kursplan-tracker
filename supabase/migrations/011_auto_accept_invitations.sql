-- 011_auto_accept_invitations.sql
-- Auto-accept pending invitations by email when a user registers or logs in.
-- Admins add emails to the invitations table; no link sharing needed.
-- On signup: trigger fires → membership created automatically.
-- For existing users: call accept_pending_invitations() on dashboard load.

-- ── Core function ─────────────────────────────────────────────

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
    WHERE lower(email) = lower(user_email)
      AND used_at IS NULL
      AND expires_at > now()
  LOOP
    INSERT INTO public.club_memberships (club_id, user_id, role, status, invited_by)
    VALUES (inv.club_id, p_user_id, inv.role, 'active', inv.created_by)
    ON CONFLICT (club_id, user_id) DO NOTHING;

    UPDATE public.invitations
    SET used_at = now(), used_by = p_user_id
    WHERE id = inv.id;
  END LOOP;
END;
$$;

-- Grant execute to authenticated users so the dashboard can call it client-side
GRANT EXECUTE ON FUNCTION public.accept_pending_invitations(uuid) TO authenticated;

-- ── Trigger for new signups ───────────────────────────────────

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

DROP TRIGGER IF EXISTS auto_accept_on_signup ON public.profiles;
CREATE TRIGGER auto_accept_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public._trigger_accept_invitations();
