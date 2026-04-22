import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { ClubMembership } from "@/types";
import { ClubNavTabs } from "@/components/layout/ClubNavTabs";

export default async function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!club) notFound();

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    // User is not a member of this club
    redirect("/dashboard");
  }

  const role = membership.role as "admin" | "trainer" | "member";

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/dashboard" className="hover:text-foreground">
            Meine Vereine
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{club.name}</span>
        </div>
        <ClubNavTabs slug={slug} role={role} />
      </div>
      {children}
    </div>
  );
}
