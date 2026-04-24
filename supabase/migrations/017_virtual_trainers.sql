-- Virtual trainers: named trainer pool per club, no login required.
-- Admins create them; they appear in the trainer picker alongside real members.

CREATE TABLE public.virtual_trainers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id    uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name       text NOT NULL,
  avatar_url text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.virtual_trainers ENABLE ROW LEVEL SECURITY;

-- Active members can read
CREATE POLICY "members can read virtual trainers" ON public.virtual_trainers
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Admins can insert / update / delete
CREATE POLICY "admins can manage virtual trainers" ON public.virtual_trainers
  FOR ALL USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- Extend session_trainers to support both real users and virtual trainers.
-- session_trainers has a composite PK (session_id, user_id), so we must:
--   1. Add a surrogate id column (auto-fills existing rows via DEFAULT)
--   2. Swap the PK to the surrogate id (freeing user_id from PK constraints)
--   3. Make user_id nullable and add virtual_trainer_id
--   4. Enforce that at least one of the two is always set

ALTER TABLE public.session_trainers
  ADD COLUMN id uuid DEFAULT gen_random_uuid();

ALTER TABLE public.session_trainers
  DROP CONSTRAINT session_trainers_pkey;

ALTER TABLE public.session_trainers
  ADD PRIMARY KEY (id);

ALTER TABLE public.session_trainers
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN virtual_trainer_id uuid REFERENCES public.virtual_trainers(id) ON DELETE CASCADE,
  ADD CONSTRAINT session_trainers_has_one
    CHECK (user_id IS NOT NULL OR virtual_trainer_id IS NOT NULL);

-- Let session_templates also remember virtual trainers for recurring generation.
ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS virtual_trainer_ids uuid[] DEFAULT '{}';
