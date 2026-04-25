-- 021_club_creator_whitelist.sql
-- Replace the SECURITY DEFINER can_create_club() approach with a simple
-- public whitelist table.  The authenticated role can read this table
-- directly, so no SECURITY DEFINER / auth.uid()-inside-function tricks are
-- needed and there is no risk of NULL propagating through the WITH CHECK.

-- 1. Create the whitelist table
CREATE TABLE IF NOT EXISTS public.club_creator_whitelist (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Seed it from the existing raw_app_meta_data flag
INSERT INTO public.club_creator_whitelist (user_id)
SELECT id
FROM auth.users
WHERE (raw_app_meta_data ->> 'can_create_club')::boolean = true
ON CONFLICT (user_id) DO NOTHING;

-- 3. RLS on the whitelist: anyone authenticated can read; nobody can write
--    (changes must go through a service-role migration or manual SQL)
ALTER TABLE public.club_creator_whitelist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whitelist_select" ON public.club_creator_whitelist;
CREATE POLICY "whitelist_select" ON public.club_creator_whitelist
  FOR SELECT USING (true);

-- 4. Replace the clubs_insert policy to use the whitelist instead of the
--    SECURITY DEFINER function
DROP POLICY IF EXISTS "clubs_insert" ON public.clubs;

CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.club_creator_whitelist
      WHERE user_id = auth.uid()
    )
  );

-- 5. Keep can_create_club() working (e.g. for future use) but fix it too
--    so it reads from the whitelist instead of auth.users
CREATE OR REPLACE FUNCTION public.can_create_club()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_creator_whitelist
    WHERE user_id = auth.uid()
  );
$$;
