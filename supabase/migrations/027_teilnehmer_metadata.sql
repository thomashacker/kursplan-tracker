-- Teilnehmer metadata: editable join date, soft-delete via left_on, notes,
-- and an open-ended metadata jsonb for future ad-hoc fields (t-shirt size,
-- phone, etc). Keep queryable fields as real columns; use jsonb only for
-- truly unstructured extensions.
--
-- Existing rows keep left_on NULL (still active) and get joined_on set to
-- the migration date via ADD COLUMN DEFAULT — no historic churn is invented
-- and no pre-existing member is silently marked ausgetreten.

ALTER TABLE public.teilnehmer
  ADD COLUMN joined_on date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN left_on   date,
  ADD COLUMN notes     text,
  ADD COLUMN metadata  jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT teilnehmer_left_after_joined
    CHECK (left_on IS NULL OR left_on >= joined_on);

-- Existing rows: Postgres fills them with the DEFAULT (CURRENT_DATE) as part
-- of ADD COLUMN. `left_on` stays NULL. So every pre-migration teilnehmer is
-- treated as "joined today, still active" — no accidental churn, no huge
-- historic influx skewing the growth KPI. Trainers can adjust individual
-- joined_on dates from the edit dialog when they know the real value.

-- Active-roster lookup ("everyone still in the club") is the hot query;
-- a partial index keeps it cheap even as former members accumulate.
CREATE INDEX teilnehmer_active_idx
  ON public.teilnehmer (club_id, joined_on)
  WHERE left_on IS NULL;
