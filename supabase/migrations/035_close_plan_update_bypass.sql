-- 035_close_plan_update_bypass.sql
--
-- Follow-up to 031/032: the five plan-enforcement triggers fired only on
-- INSERT, so a client with API access could UPDATE past every cap:
--
--   • enforce_can_upload_files       — insert a kind='link' row (allowed),
--                                       then UPDATE to kind='image' → files
--                                       uploaded on a free plan.
--   • enforce_media_per_session_limit — INSERT into low-usage session,
--                                       then UPDATE session_id to move it
--                                       into a full one.
--   • enforce_teilnehmer_limit       — soft-delete rows to free budget,
--                                       then UPDATE left_on=NULL to
--                                       re-activate past the cap.
--   • enforce_sessions_limit         — UPDATE week_id to move sessions
--                                       into a full week.
--   • enforce_staff_limit            — UPDATE role member→admin past
--                                       the staff cap.
--
-- Fix: extend each trigger to also fire on UPDATE, scoped to the columns
-- that actually change the count. Trigger bodies are unchanged — they
-- already exclude the current row from their counts via
-- `id IS DISTINCT FROM NEW.id`, which is correct for both INSERT and
-- UPDATE. Only the trigger *scope* needs widening.
--
-- Also: add allowed_mime_types to the `avatars` and `logos` buckets so
-- an authenticated client can't upload HTML/executables under image
-- content-types. `session-media` already had this from 033; the other
-- two buckets slipped through.

-- ── Widen enforcement triggers to fire on the columns that affect counts ─

-- teilnehmer: reactivating a soft-deleted row (left_on NULL) or moving
-- one to a different club changes the count. Name/notes edits don't.
DROP TRIGGER IF EXISTS enforce_teilnehmer_limit ON public.teilnehmer;
CREATE TRIGGER enforce_teilnehmer_limit
  BEFORE INSERT OR UPDATE OF left_on, club_id
  ON public.teilnehmer
  FOR EACH ROW EXECUTE FUNCTION public.enforce_teilnehmer_limit();

-- club_memberships: role/status changes are the only counted transitions.
-- Firing on UPDATE OF role, status covers member→admin promotions and
-- suspended→active reactivations. user_id shouldn't be mutable in
-- practice, but include it for safety.
DROP TRIGGER IF EXISTS enforce_staff_limit ON public.club_memberships;
CREATE TRIGGER enforce_staff_limit
  BEFORE INSERT OR UPDATE OF role, status, user_id
  ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_limit();

-- training_sessions: moving a session between weeks or flipping the kind
-- from 'event' → 'training' changes the counted set.
DROP TRIGGER IF EXISTS enforce_sessions_limit ON public.training_sessions;
CREATE TRIGGER enforce_sessions_limit
  BEFORE INSERT OR UPDATE OF week_id, kind
  ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_sessions_limit();

-- session_media: two triggers on the same table.
-- (a) can_upload_files — a kind flip from 'link' → 'image'/'pdf'
--     is the specific bypass we're closing. session_id change would
--     also move the row into a different plan context.
DROP TRIGGER IF EXISTS enforce_can_upload_files ON public.session_media;
CREATE TRIGGER enforce_can_upload_files
  BEFORE INSERT OR UPDATE OF kind, session_id
  ON public.session_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_can_upload_files();

-- (b) media_per_session_limit — only session_id change moves the row
--     between counted sets. kind doesn't affect the cap (all attachment
--     kinds count together).
DROP TRIGGER IF EXISTS enforce_media_per_session_limit ON public.session_media;
CREATE TRIGGER enforce_media_per_session_limit
  BEFORE INSERT OR UPDATE OF session_id
  ON public.session_media
  FOR EACH ROW EXECUTE FUNCTION public.enforce_media_per_session_limit();

-- ── Bucket MIME allowlist for avatars + logos ────────────────────────────
-- 033 hardened session-media (10 MB, image/pdf whitelist). The other two
-- buckets already have file_size_limit=10485760 (10 MB) but no
-- allowed_mime_types, so an authenticated client can upload text/html
-- or binaries there. Public buckets serve these files, so the reflected-
-- XSS surface is real. Restrict to images.

-- Deliberately NO image/svg+xml — SVG can contain <script>, and Supabase
-- Storage serves files with their declared Content-Type, so navigating to
-- a .svg URL directly executes embedded JS. Existing SVG uploads keep
-- rendering; only new SVG uploads are blocked.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'image/jpeg',
         'image/png',
         'image/webp'
       ]
 WHERE id IN ('avatars', 'logos');
