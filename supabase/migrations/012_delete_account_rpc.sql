-- 012_delete_account_rpc.sql
-- Allows a user to delete their own account from the client side.
-- Uses SECURITY DEFINER to call auth.users delete (requires superuser in pg).
-- In Supabase, deleting from auth.users is restricted — we use the admin API
-- instead, but provide a cleanup RPC that removes the profile row so the
-- cascade handles the rest. The actual auth.users deletion happens via the
-- Next.js /api/delete-account route with the service_role key.

-- Nothing needed here — the Next.js route handles deletion via admin API.
-- This migration is a placeholder to document the design decision.

-- If you want to add pre-deletion cleanup (e.g. anonymise data), add it here:
-- CREATE OR REPLACE FUNCTION public.delete_own_account() ...
