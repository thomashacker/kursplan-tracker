import { createClient } from "@/lib/supabase/server";
import type { ClubMembership } from "@/types";
import { ClubList } from "@/components/dashboard/ClubList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberships } = await supabase
    .from("club_memberships")
    .select("*, clubs(*)")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .returns<ClubMembership[]>();

  const userName = (user?.user_metadata?.full_name as string | undefined) ?? "";

  return <ClubList memberships={memberships ?? []} userName={userName} />;
}
