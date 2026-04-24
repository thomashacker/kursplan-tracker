import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Club, ClubMembership, TrainingWeek, Location, Profile, ClubTopic, ClubSessionType, VirtualTrainer } from "@/types";
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
    .select("*, training_sessions(*, locations(*), session_trainers(session_id, user_id, virtual_trainer_id))")
    .eq("club_id", club.id)
    .eq("week_start", weekStart)
    .single<TrainingWeek>();

  // Fetch week's session_trainers including virtual_trainer_id
  // (already handled by the select string below via PostgREST)

  // Fetch locations, trainer user_ids, topics, session types, and virtual trainers in parallel
  const [{ data: locations }, { data: trainerMemberships }, { data: topics }, { data: sessionTypes }, { data: virtualTrainersRaw }] = await Promise.all([
    supabase.from("locations").select("*").eq("club_id", club.id).returns<Location[]>(),
    supabase
      .from("club_memberships")
      .select("user_id")
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
    supabase
      .from("virtual_trainers")
      .select("*")
      .eq("club_id", club.id)
      .order("name")
      .returns<VirtualTrainer[]>(),
  ]);

  // Fetch profiles separately to avoid the transitive FK join issue with PostgREST
  const trainerIds = (trainerMemberships ?? []).map((m) => m.user_id);
  const { data: trainerProfiles } = trainerIds.length
    ? await supabase.from("profiles").select("id, full_name, avatar_url, username, created_at").in("id", trainerIds).returns<Profile[]>()
    : { data: [] };

  const trainers: Profile[] = trainerProfiles ?? [];

  return (
    <WeeklyPlanEditor
      club={club}
      week={week ?? null}
      weekStart={weekStart}
      canEdit={canEdit}
      isAdmin={isAdmin}
      locations={locations ?? []}
      trainers={trainers}
      virtualTrainers={virtualTrainersRaw ?? []}
      topics={topics ?? []}
      sessionTypes={sessionTypes ?? []}
    />
  );
}
