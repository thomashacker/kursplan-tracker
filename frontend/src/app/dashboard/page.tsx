import { createClient } from "@/lib/supabase/server";
import type { ClubMembership } from "@/types";
import { ClubList } from "@/components/dashboard/ClubList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Auto-accept any pending email invitations for this user (handles existing accounts)
  await supabase.rpc("accept_pending_invitations", { p_user_id: user!.id });

  const { data: memberships } = await supabase
    .from("club_memberships")
    .select("*, clubs(*)")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .returns<ClubMembership[]>();

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? "";
  const userEmail = user?.email ?? "";

  // Self-service: anyone can create ONE free Verein. The DB enforces the
  // rule via a partial unique index on clubs(created_by) WHERE plan='free'.
  // Hide the "erstellen" button if the user has already created one; their
  // unlimited-plan clubs (owner-operator grandfathered) don't count.
  const { count: ownedFreeCount } = await supabase
    .from("clubs")
    .select("id", { count: "exact", head: true })
    .eq("created_by", user!.id)
    .eq("plan", "free");
  const canCreateClub = (ownedFreeCount ?? 0) === 0;

  return <ClubList memberships={memberships ?? []} userName={userName} userEmail={userEmail} canCreateClub={canCreateClub} />;
}
