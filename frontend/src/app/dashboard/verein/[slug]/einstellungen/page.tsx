import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Club, ClubMembership } from "@/types";
import { ClubSettingsForm } from "./ClubSettingsForm";

export default async function EinstellungenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single<Club>();

  if (!club) redirect("/dashboard");

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", club.id)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single<ClubMembership>();

  if (membership?.role !== "admin") redirect(`/dashboard/verein/${slug}/plan`);

  return (
    <div className="max-w-xl">
      <h1
        className="font-bold tracking-tight mb-8"
        style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.75rem, 6vw, 2.25rem)" }}
      >
        Vereinseinstellungen
      </h1>
      <ClubSettingsForm club={club} />
    </div>
  );
}
