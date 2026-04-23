-- 014_guest_trainers.sql
-- Add guest_trainers text[] to sessions and templates.
-- Guest trainers are free-text names (not linked to user accounts),
-- stored as plain strings and displayed alongside regular trainers.

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS guest_trainers text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS guest_trainers text[] NOT NULL DEFAULT '{}';
