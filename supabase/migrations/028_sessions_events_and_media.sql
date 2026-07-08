-- Sessions gain a "kind" discriminator so events and trainings share one
-- table, one edit modal, one realtime channel. Event-specific fields are
-- nullable / defaulted so existing rows keep working unchanged. Media
-- (images / PDFs / links) attaches to any session via a small side table
-- backed by a new Storage bucket.
--
-- Design notes:
--   • kind = 'training' → uses week_id + day_of_week (unchanged).
--   • kind = 'event'    → uses event_date (arbitrary calendar day); can
--     still live inside a training week for realtime grouping, but its
--     display date comes from event_date.
--   • is_pinned lets a "training" pretend to be an event (always visible
--     in public view). Defaults false; events are effectively pinned.
--   • title is required for events, nullable for trainings.
--   • metadata jsonb absorbs future ad-hoc event fields (capacity,
--     signup_url, cost, age_range, …) without a schema change per field.

-- ── Schema ────────────────────────────────────────────────────────────

ALTER TABLE public.training_sessions
  ADD COLUMN kind        text        NOT NULL DEFAULT 'training'
                                     CHECK (kind IN ('training','event')),
  ADD COLUMN title       text,
  ADD COLUMN is_pinned   boolean     NOT NULL DEFAULT false,
  ADD COLUMN event_date  date,
  ADD COLUMN metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT training_sessions_event_shape CHECK (
    (kind = 'training' AND event_date IS NULL) OR
    (kind = 'event'    AND event_date IS NOT NULL AND title IS NOT NULL AND length(btrim(title)) > 0)
  );

-- Public-view sorts by "when it happens"; index the union of both date
-- axes so the timeline query stays cheap.
CREATE INDEX training_sessions_pinned_idx
  ON public.training_sessions (week_id, kind, is_pinned)
  WHERE kind = 'event' OR is_pinned = true;

CREATE INDEX training_sessions_event_date_idx
  ON public.training_sessions (event_date)
  WHERE kind = 'event';

-- ── session_media ─────────────────────────────────────────────────────

CREATE TABLE public.session_media (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('image','pdf','link')),
  url         text NOT NULL,
  caption     text,
  sort_order  int  NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_media_session_idx
  ON public.session_media (session_id, sort_order);

ALTER TABLE public.session_media ENABLE ROW LEVEL SECURITY;

-- Read: any active member of the session's club
CREATE POLICY "members can read session media"
  ON public.session_media FOR SELECT
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE tw.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Write: admin or trainer in the session's club
CREATE POLICY "trainers manage session media"
  ON public.session_media FOR ALL
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_weeks tw ON tw.id = ts.week_id
      WHERE tw.club_id IN (
        SELECT club_id FROM public.club_memberships
        WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin','trainer')
      )
    )
  );

-- ── Storage bucket ────────────────────────────────────────────────────
-- Public bucket so getPublicUrl works in the read-only public view.
-- Writes are gated by the Storage RLS policies below.

INSERT INTO storage.buckets (id, name, public)
  VALUES ('session-media', 'session-media', true)
  ON CONFLICT (id) DO NOTHING;

-- Paths look like: {club_id}/{session_id}/{filename}
-- Storage policies read the club_id from the first path segment.

CREATE POLICY "public can read session-media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'session-media');

CREATE POLICY "trainers upload session-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-media'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin','trainer')
    )
  );

CREATE POLICY "trainers delete session-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'session-media'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT club_id FROM public.club_memberships
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('admin','trainer')
    )
  );
