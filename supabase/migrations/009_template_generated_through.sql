-- 009_template_generated_through.sql
-- Track how far ahead recurring sessions have been generated.
-- When the current week approaches this date, the frontend silently extends.

ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS generated_through date;
