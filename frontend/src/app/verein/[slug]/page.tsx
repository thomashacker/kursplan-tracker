import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { TrainingWeek, Club, Profile } from "@/types";
import { DAY_NAMES, ROLE_LABELS } from "@/types";
import { getCurrentMonday } from "@/lib/utils/date";
import { formatWeekRange, formatTime } from "@/lib/utils/date";
import { Badge } from "@/components/ui/badge";
import { WeekNav } from "@/components/plan/WeekNav";
import { exportIcal } from "@/lib/api";

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

  // For private clubs, only show if the user is a member
  if (!club.is_public) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    .select("*, training_sessions(*, locations(*), profiles!trainer_id(id, full_name))")
    .eq("club_id", club.id)
    .eq("week_start", weekStart)
    .eq("is_published", true)
    .single<TrainingWeek>();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{club.name}</h1>
          {club.description && (
            <p className="text-muted-foreground text-sm mt-1">{club.description}</p>
          )}
        </div>
      </header>

      <main className="container max-w-5xl mx-auto px-4 py-8">
        {/* Week navigation */}
        <div className="flex items-center justify-between mb-6">
          <WeekNav weekStart={weekStart} />
          {week && (
            <a
              href={exportIcal(week.id)}
              download
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              iCal herunterladen
            </a>
          )}
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
                  <h3 className="font-semibold text-lg border-b pb-2 mb-3">
                    {dayName}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {daySessions.map((session) => (
                      <div
                        key={session.id}
                        className="border rounded-lg p-4 bg-card"
                      >
                        <div className="text-sm text-muted-foreground mb-1">
                          {formatTime(session.time_start)} –{" "}
                          {formatTime(session.time_end)}
                        </div>
                        <p className="font-semibold">{session.topic}</p>
                        {session.profiles && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {session.profiles.full_name}
                          </p>
                        )}
                        {session.locations && (
                          <p className="text-sm text-muted-foreground">
                            {session.locations.name}
                          </p>
                        )}
                        {session.description && (
                          <p className="text-sm mt-2">{session.description}</p>
                        )}
                        {session.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {session.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="text-xs"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
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
