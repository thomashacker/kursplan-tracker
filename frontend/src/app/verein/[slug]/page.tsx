import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { TrainingWeek, Club } from "@/types";
import { DAY_NAMES } from "@/types";
import { getCurrentMonday, formatWeekRange, formatTime } from "@/lib/utils/date";
import { WeekNav } from "@/components/plan/WeekNav";

export default async function PublicPlanPage({
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

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single<Club>();

  if (!club) notFound();

  if (!club.is_public) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) notFound();
    const { data: membership } = await supabase
      .from("club_memberships")
      .select("id")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (!membership) notFound();
  }

  const { data: week } = await supabase
    .from("training_weeks")
    .select("*, training_sessions(*, locations(*), session_trainers(user_id))")
    .eq("club_id", club.id)
    .eq("week_start", weekStart)
    .eq("is_published", true)
    .single<TrainingWeek>();

  // Resolve trainer profiles separately to avoid transitive FK join issue
  const allTrainerIds = [
    ...new Set(
      (week?.training_sessions ?? []).flatMap(
        (s) => s.session_trainers?.map((st) => st.user_id) ?? (s.trainer_id ? [s.trainer_id] : [])
      )
    ),
  ];
  const { data: trainerProfiles } = allTrainerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", allTrainerIds)
    : { data: [] };
  const profileMap = Object.fromEntries((trainerProfiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{club.name}</h1>
          {club.description && (
            <p className="text-muted-foreground text-sm mt-1">{club.description}</p>
          )}
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <WeekNav weekStart={weekStart} />
        </div>

        <h2 className="text-xl font-semibold mb-4">{formatWeekRange(weekStart)}</h2>

        {!week ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Für diese Woche wurde noch kein Trainingsplan veröffentlicht.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const daySessions = (week.training_sessions ?? [])
                .filter((s) => s.day_of_week === dayIndex)
                .sort((a, b) => a.time_start.localeCompare(b.time_start));

              if (!daySessions.length) return null;

              return (
                <div key={dayIndex}>
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">{dayName}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {daySessions.map((session) => {
                      const trainerIds = session.session_trainers?.length
                        ? session.session_trainers.map((st) => st.user_id)
                        : session.trainer_id ? [session.trainer_id] : [];
                      const trainerNames = trainerIds.map((id) => profileMap[id]).filter(Boolean);

                      const types = session.session_types ?? [];
                      const topics = session.topics ?? [];

                      return (
                        <div key={session.id} className="border rounded-lg p-4 bg-card">
                          <div className="text-sm text-muted-foreground font-mono mb-2">
                            {formatTime(session.time_start)} – {formatTime(session.time_end)}
                          </div>

                          {types.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {types.map((t) => (
                                <span key={t} className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {topics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              {topics.map((t) => (
                                <span key={t} className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {trainerNames.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {trainerNames.join(", ")}
                            </p>
                          )}

                          {session.locations && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                              </svg>
                              {session.locations.maps_url ? (
                                <a href={session.locations.maps_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                  {session.locations.name}
                                </a>
                              ) : session.locations.name}
                            </p>
                          )}

                          {session.description && (
                            <p className="text-sm text-muted-foreground mt-2 italic">{session.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
