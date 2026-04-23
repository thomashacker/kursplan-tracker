-- 008_location_fk_set_null.sql
-- Change location FK on training_sessions and session_templates to SET NULL
-- so deleting a location gracefully removes the reference instead of blocking.

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_location_id_fkey;
ALTER TABLE public.training_sessions
  ADD CONSTRAINT training_sessions_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;

ALTER TABLE public.session_templates
  DROP CONSTRAINT IF EXISTS session_templates_location_id_fkey;
ALTER TABLE public.session_templates
  ADD CONSTRAINT session_templates_location_id_fkey
  FOREIGN KEY (location_id) REFERENCES public.locations(id) ON DELETE SET NULL;
