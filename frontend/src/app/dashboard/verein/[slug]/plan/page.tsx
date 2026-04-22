import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Club, ClubMembership, TrainingWeek, Location, Profile, ClubTopic, ClubSessionType } from "@/types";
import { getCurrentMonday } from "@/lib/utils/date";
import { WeeklyPlanEditor } from "@/components/plan/WeeklyPlanEditor";

export default async function PlanPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ woche?: string }>;
}) {
  const { slug } = await params;
  const { woche } = await searchParams;
  const weekStart = woche ?? getCurrentMonday();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single<Club>();

  if (!club) notFound();

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", club.id)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single<ClubMembership>();

  const canEdit = membership?.role === "admin" || membership?.role === "trainer";
  const isAdmin = membership?.role === "admin";

  // Fetch week with sessions, locations, and session_trainers
  const { data: week } = await supabase
    .from("training_weeks")
    .select("*, training_sessions(*, locations(*), session_trainers(session_id, user_id))")
    .eq("club_id", club.id)
    .eq("week_start", weekStart)
    .single<TrainingWeek>();

  // Fetch locations, club trainers/admins, topics, and session types in parallel
  const [{ data: locations }, { data: clubMembers }, { data: topics }, { data: sessionTypes }] = await Promise.all([
    supabase.from("locations").select("*").eq("club_id", club.id).returns<Location[]>(),
    supabase
      .from("club_memberships")
      .select("user_id, role, profiles(id, full_name)")
      .eq("club_id", club.id)
      .eq("status", "active")
      .in("role", ["admin", "trainer"]),
    supabase
      .from("club_topics")
      .select("*")
      .eq("club_id", club.id)
      .order("name")
      .returns<ClubTopic[]>(),
    supabase
      .from("club_session_types")
      .select("*")
      .eq("club_id", club.id)
      .order("name")
      .returns<ClubSessionType[]>(),
  ]);

  type MemberWithProfile = { user_id: string; role: string; profiles: Profile | null };
  const trainers: Profile[] = ((clubMembers ?? []) as unknown as MemberWithProfile[])
    .map((m) => m.profiles)
    .filter((p): p is Profile => p !== null);

  return (
    <WeeklyPlanEditor
      club={club}
      week={week ?? null}
      weekStart={weekStart}
      canEdit={canEdit}
      isAdmin={isAdmin}
      locations={locations ?? []}
      trainers={trainers}
      topics={topics ?? []}
      sessionTypes={sessionTypes ?? []}
    />
  );
}
