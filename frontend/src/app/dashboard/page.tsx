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
  const canCreateClub = (user?.app_metadata?.can_create_club as boolean | undefined) === true;

  return <ClubList memberships={memberships ?? []} userName={userName} userEmail={userEmail} canCreateClub={canCreateClub} />;
}
