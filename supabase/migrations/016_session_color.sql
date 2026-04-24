-- Add optional color label to training sessions and templates
-- NULL / 'neutral' = default styling (no change to existing rows)

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL;

ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS color text DEFAULT NULL;
