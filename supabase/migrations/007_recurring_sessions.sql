-- 007_recurring_sessions.sql
-- Add recurring session support: templates track the pattern,
-- training_sessions track individual occurrences.

-- Bring session_templates in line with the current session model
ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS topics        text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS session_types text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS trainer_ids   uuid[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_cancelled  boolean NOT NULL DEFAULT false;

-- Link individual sessions back to their template
ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.session_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_modified  boolean NOT NULL DEFAULT false;

-- Index for "give me all sessions from template X"
CREATE INDEX IF NOT EXISTS idx_training_sessions_template_id
  ON public.training_sessions(template_id);
