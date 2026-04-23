-- 015_profiles_public_trainer_read.sql
-- Allow unauthenticated users to read profiles of trainers who appear
-- in published sessions of public clubs.
-- Without this, the public plan view cannot resolve trainer names/avatars.

CREATE POLICY "profiles_select_public_trainers" ON public.profiles
  FOR SELECT USING (
    -- trainer referenced via session_trainers junction table
    EXISTS (
      SELECT 1 FROM public.session_trainers st
      JOIN public.training_sessions ts ON ts.id = st.session_id
      JOIN public.training_weeks    tw ON tw.id = ts.week_id
      JOIN public.clubs              c  ON c.id  = tw.club_id
      WHERE st.user_id       = profiles.id
        AND c.is_public      = true
        AND tw.is_published  = true
    )
    OR
    -- trainer referenced via legacy trainer_id column
    EXISTS (
      SELECT 1 FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      JOIN public.clubs           c  ON c.id  = tw.club_id
      WHERE ts.trainer_id    = profiles.id
        AND c.is_public      = true
        AND tw.is_published  = true
    )
  );
