-- Trainer availability: track absence windows for registered users AND
-- virtual trainers via a single table. Exactly one of (user_id,
-- virtual_trainer_id) is set per row.
--
-- The picker greys out a trainer for sessions whose date falls inside any
-- window; multiple windows per trainer are supported so future vacations
-- can be scheduled while a trainer is currently sick.

CREATE TABLE public.trainer_availability (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id             uuid NOT NULL REFERENCES public.clubs(id)             ON DELETE CASCADE,
  user_id             uuid          REFERENCES public.profiles(id)          ON DELETE CASCADE,
  virtual_trainer_id  uuid          REFERENCES public.virtual_trainers(id)  ON DELETE CASCADE,
  start_date          date NOT NULL,
  end_date            date NOT NULL,
  reason              text NOT NULL DEFAULT 'other'
                        CHECK (reason IN ('sick', 'vacation', 'other')),
  note                text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trainer_availability_target_xor CHECK (
    (user_id IS NOT NULL AND virtual_trainer_id IS NULL) OR
    (user_id IS NULL     AND virtual_trainer_id IS NOT NULL)
  ),
  CONSTRAINT trainer_availability_range CHECK (end_date >= start_date)
);

-- Partial indexes let each lookup skip the "other kind" rows.
CREATE INDEX trainer_availability_user_idx
  ON public.trainer_availability (club_id, user_id, start_date, end_date)
  WHERE user_id IS NOT NULL;

CREATE INDEX trainer_availability_virtual_idx
  ON public.trainer_availability (club_id, virtual_trainer_id, start_date, end_date)
  WHERE virtual_trainer_id IS NOT NULL;

ALTER TABLE public.trainer_availability ENABLE ROW LEVEL SECURITY;

-- ── Read: any active member of the club can see windows. ────────────────────
CREATE POLICY "members can read trainer availability"
  ON public.trainer_availability
  FOR SELECT USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ── Write: registered-trainer rows — the trainer themself OR a club admin. ──
CREATE POLICY "user manages own availability"
  ON public.trainer_availability
  FOR ALL
  USING (
    user_id = auth.uid()
    AND club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- ── Write: any row in a club — club admin. Covers virtual trainers too. ─────
CREATE POLICY "admins manage trainer availability"
  ON public.trainer_availability
  FOR ALL
  USING (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  )
  WITH CHECK (
    club_id IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role = 'admin'
    )
  );

-- Keep updated_at fresh on edits.
CREATE OR REPLACE FUNCTION public.trainer_availability_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trainer_availability_touch_updated_at
  BEFORE UPDATE ON public.trainer_availability
  FOR EACH ROW EXECUTE FUNCTION public.trainer_availability_touch_updated_at();
