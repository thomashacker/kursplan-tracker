import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Club, ClubMembership, ClubTopic, ClubSessionType, Location } from "@/types";
import { ThemenManager } from "./ThemenManager";

export default async function ThemenPage({
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

  const [{ data: topics }, { data: sessionTypes }, { data: locations }] = await Promise.all([
    supabase.from("club_topics").select("*").eq("club_id", club.id).order("name").returns<ClubTopic[]>(),
    supabase.from("club_session_types").select("*").eq("club_id", club.id).order("name").returns<ClubSessionType[]>(),
    supabase.from("locations").select("*").eq("club_id", club.id).order("name").returns<Location[]>(),
  ]);

  return (
    <div className="max-w-xl">
      <h1
        className="font-bold tracking-tight mb-8"
        style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.75rem, 6vw, 2.25rem)" }}
      >
        Themen & Orte
      </h1>
      <ThemenManager
        clubId={club.id}
        initialTopics={topics ?? []}
        initialSessionTypes={sessionTypes ?? []}
        initialLocations={locations ?? []}
      />
    </div>
  );
}
