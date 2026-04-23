-- Restrict club creation to users with can_create_club = true in app_metadata.
-- Set this flag per user in Supabase Dashboard → Authentication → Users → app_metadata:
--   {"can_create_club": true}

DROP POLICY IF EXISTS "clubs_insert" ON public.clubs;

CREATE POLICY "clubs_insert" ON public.clubs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
    AND (auth.jwt() -> 'app_metadata' ->> 'can_create_club')::boolean = true
  );
