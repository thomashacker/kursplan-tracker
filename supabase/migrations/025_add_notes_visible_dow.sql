-- Add per-weekday visibility control for the Wochennotiz banner.
--
-- notes_visible_dow uses the same 0-indexed convention as
-- training_sessions.day_of_week: 0 = Monday, 6 = Sunday.
--
-- Default is ARRAY[0..6] so existing weeks keep their current behavior
-- (banner shows whenever `notes` is non-null).
ALTER TABLE public.training_weeks
  ADD COLUMN notes_visible_dow int[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]
  CHECK (
    notes_visible_dow <@ ARRAY[0,1,2,3,4,5,6]
    AND array_length(notes_visible_dow, 1) >= 1
  );
