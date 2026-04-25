-- 020_fix_club_creation_policy.sql
-- Replace JWT-based can_create_club check with a SECURITY DEFINER function
-- that reads directly from auth.users.raw_app_meta_data.
--
-- auth.jwt() embeds app_metadata at login time and can be stale or absent
-- depending on Supabase version / JWT cache.  Reading auth.users directly
-- is always current and does not require a re-login to pick up changes.

CREATE OR REPLACE FUNCTION public.can_create_club()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (raw_app_meta_data ->> 'can_create_club')::boolean,
    false
  )
  FROM auth.users
  WHERE id = auth.uid();
$$;

DROP POLICY IF EXISTS "clubs_insert" ON public.clubs;

CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND public.can_create_club()
  );
