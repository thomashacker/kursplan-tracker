-- 022_teilnehmer_unique_name.sql
-- The UNIQUE(club_id, name) constraint was missing from the live DB
-- (migration 019 was likely applied before it was included).
-- Required for the bulk-import upsert to work (ON CONFLICT club_id,name).

ALTER TABLE public.teilnehmer
  ADD CONSTRAINT teilnehmer_club_id_name_key UNIQUE (club_id, name);
