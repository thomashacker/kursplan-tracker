-- 010_extend_recurring_sessions_cron.sql
-- Adds a PL/pgSQL function that extends recurring sessions whose horizon
-- (generated_through) is within 2 weeks of the current date, then schedules
-- it via pg_cron to run every Monday at 05:00 UTC.
--
-- PREREQUISITE: pg_cron must be enabled.
--   Supabase Dashboard → Database → Extensions → enable "pg_cron"

-- ── auto_extend flag on templates ────────────────────────────
-- Controls whether the cron job should keep rolling this template forward.
-- Defaults to true so existing templates keep working.

ALTER TABLE public.session_templates
  ADD COLUMN IF NOT EXISTS auto_extend boolean NOT NULL DEFAULT true;

-- ── Core function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.extend_recurring_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- bypasses RLS; runs as the function owner
SET search_path = public  -- prevents search_path injection
AS $$
DECLARE
  tpl            RECORD;
  new_from       date;
  new_through    date;
  i              integer;
  wk_start       date;
  wk_id          uuid;
  sess_id        uuid;
  trainer_uid    uuid;
BEGIN
  -- Only templates with auto_extend=true whose horizon is within 2 weeks
  FOR tpl IN
    SELECT
      id, club_id, day_of_week,
      time_start, time_end, location_id,
      COALESCE(topics,        '{}') AS topics,
      COALESCE(session_types, '{}') AS session_types,
      description,
      default_trainer_id,
      COALESCE(trainer_ids,   '{}') AS trainer_ids,
      COALESCE(is_cancelled, false) AS is_cancelled,
      generated_through
    FROM public.session_templates
    WHERE auto_extend = true
      AND generated_through IS NOT NULL
      AND generated_through <= (CURRENT_DATE + interval '2 weeks')
  LOOP
    -- The next un-generated week starts one week after the current horizon
    new_from    := tpl.generated_through + interval '1 week';
    new_through := tpl.generated_through + interval '8 weeks';

    FOR i IN 0..7 LOOP
      wk_start := new_from + (i * interval '1 week');

      -- Find existing week row, or create one (always a Monday — generated_through
      -- is always a Monday and we add whole-week intervals)
      SELECT id INTO wk_id
      FROM public.training_weeks
      WHERE club_id = tpl.club_id AND week_start = wk_start;

      IF wk_id IS NULL THEN
        INSERT INTO public.training_weeks (club_id, week_start, is_published)
        VALUES (tpl.club_id, wk_start, true)  -- auto-publish cron-generated weeks
        RETURNING id INTO wk_id;
      END IF;

      -- Idempotent: skip if this template already has a session in this week
      IF EXISTS (
        SELECT 1 FROM public.training_sessions
        WHERE template_id = tpl.id AND week_id = wk_id
      ) THEN
        CONTINUE;
      END IF;

      -- Insert the session
      INSERT INTO public.training_sessions (
        week_id, day_of_week,
        time_start, time_end, location_id,
        topics, session_types, description,
        trainer_id, is_cancelled,
        template_id, is_modified,
        tags, topic
      )
      VALUES (
        wk_id, tpl.day_of_week,
        tpl.time_start, tpl.time_end, tpl.location_id,
        tpl.topics, tpl.session_types, tpl.description,
        tpl.default_trainer_id, tpl.is_cancelled,
        tpl.id, false,
        '{}', NULL
      )
      RETURNING id INTO sess_id;

      -- Insert session_trainers for every trainer in the template's array
      IF array_length(tpl.trainer_ids, 1) > 0 THEN
        FOREACH trainer_uid IN ARRAY tpl.trainer_ids LOOP
          INSERT INTO public.session_trainers (session_id, user_id)
          VALUES (sess_id, trainer_uid)
          ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;

    END LOOP;

    -- Advance the horizon by 8 weeks
    UPDATE public.session_templates
    SET generated_through = new_through
    WHERE id = tpl.id;

  END LOOP;
END;
$$;

-- ── pg_cron schedule ──────────────────────────────────────────
-- Runs every Monday at 05:00 UTC — well before any club opens.
-- Safe to re-run: unschedules first if job already exists.

SELECT cron.unschedule('extend-recurring-sessions')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'extend-recurring-sessions'
);

SELECT cron.schedule(
  'extend-recurring-sessions',   -- job name
  '0 5 * * 1',                   -- every Monday 05:00 UTC
  'SELECT public.extend_recurring_sessions()'
);
