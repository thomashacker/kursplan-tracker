-- 033_storage_hardening.sql
--
-- Follow-up audit closed three gaps in the Storage layer that migration
-- 032 left open:
--
--   1. session-media INSERT RLS didn't check plan.can_upload_files, so a
--      free-plan trainer could upload a file directly via Storage API.
--      The DB trigger (enforce_can_upload_files on session_media) still
--      blocks the DB row insert, but the raw file lands in Storage as
--      an orphan.
--
--   2. session-media bucket had no file_size_limit → a rogue authenticated
--      client could push arbitrarily large blobs.
--
--   3. session-media bucket had no allowed_mime_types → arbitrary content
--      types accepted (executables, HTML with XSS, …).
--
-- Also: retires the dead enforce_storage_bytes_limit trigger + function.
-- That path is unused because storage caps are now expressed via the
-- can_upload_files boolean (either "not allowed to upload at all" or "no
-- cap" — there's no middle tier yet).

-- ── 1. Storage bucket configuration ─────────────────────────────────────

UPDATE storage.buckets
   SET file_size_limit = 10485760,  -- 10 MB
       allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/webp',
         'application/pdf'
       ]
 WHERE id = 'session-media';

-- ── 2. Rewrite session-media INSERT policy to check can_upload_files ────
-- The old policy checked only club membership + role. New policy adds a
-- join to plan_config so the club's plan must have can_upload_files=true.

DROP POLICY IF EXISTS "trainers upload session-media" ON storage.objects;

CREATE POLICY "trainers upload session-media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'session-media'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT cm.club_id
      FROM public.club_memberships cm
      JOIN public.clubs c        ON c.id = cm.club_id
      JOIN public.plan_config pc ON pc.plan = c.plan
      WHERE cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('admin','trainer')
        AND pc.can_upload_files = true
    )
  );

-- ── 3. Retire dead code from an earlier 032 iteration ───────────────────
-- enforce_storage_bytes_limit was written when we thought free plans
-- would have a numeric storage cap. Post-can_upload_files, storage caps
-- are boolean, and the trigger short-circuits on NULL for every plan.
-- Dead code, drop it.

DROP TRIGGER IF EXISTS enforce_storage_bytes_limit ON public.session_media;
DROP FUNCTION IF EXISTS public.enforce_storage_bytes_limit();
