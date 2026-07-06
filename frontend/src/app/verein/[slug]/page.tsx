import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { TrainingSession, TrainingWeek, Club, Location } from "@/types";
import { DAY_NAMES } from "@/types";
import { getCurrentMonday, getCurrentDayOfWeek, offsetWeek, toISODate, getSessionDate } from "@/lib/utils/date";
import PublicPlanClient from "./PublicPlanClient";
import type { PublicSession, ColorMap } from "./PublicPlanClient";
import { SiteFooter } from "@/components/layout/SiteFooter";

// ── Date label helpers ────────────────────────────────────────

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fullLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return "Heute";
  if (d.getTime() === tomorrow.getTime()) return "Morgen";
  return `${DAY_NAMES[d.getDay() === 0 ? 6 : d.getDay() - 1]}, ${d.getDate()}. ${
    ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"][d.getMonth()]
  }`;
}

function shortLabel(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return "Heute";
  if (d.getTime() === tomorrow.getTime()) return "Morgen";
  const dayShort = ["Mo","Di","Mi","Do","Fr","Sa","So"][d.getDay() === 0 ? 6 : d.getDay() - 1];
  return `${dayShort} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

// ── Page ──────────────────────────────────────────────────────

export default async function PublicPlanPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: club } = await supabase
    .from("clubs").select("*").eq("slug", slug).single<Club>();
  if (!club) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  if (!club.is_public) {
    if (!user) notFound();
    const { data: membership } = await supabase
      .from("club_memberships").select("id")
      .eq("club_id", club.id).eq("user_id", user.id).eq("status", "active").single();
    if (!membership) notFound();
  }

  // Check if the authenticated user is a member of this club (for the dashboard button)
  const { data: userMembership } = user
    ? await supabase
        .from("club_memberships").select("role")
        .eq("club_id", club.id).eq("user_id", user.id).eq("status", "active").single()
    : { data: null };
  const dashboardHref = userMembership ? `/dashboard/verein/${slug}` : null;

  const showTrainers = (club.settings?.show_trainers_public as boolean | undefined) ?? true;
  const showGroups = (club.settings?.show_groups_public as boolean | undefined) ?? false;

  const monday = getCurrentMonday();
  const until  = offsetWeek(monday, 9);

  const { data: weeks } = await supabase
    .from("training_weeks")
    .select("*, training_sessions(*, locations(*), session_trainers(user_id, virtual_trainer_id))")
    .eq("club_id", club.id)
    .eq("is_published", true)
    .gte("week_start", monday)
    .lte("week_start", until)
    .order("week_start", { ascending: true })
    .returns<TrainingWeek[]>();

  // Resolve trainer names (skip entirely when admin has hidden trainers from public view)
  const allSessions = (weeks ?? []).flatMap((w) => w.training_sessions ?? []);

  type RawST = { user_id: string | null; virtual_trainer_id: string | null };

  let profileMap: Record<string, { name: string; avatarUrl: string | null }> = {};
  let virtualProfileMap: Record<string, { name: string; avatarUrl: string | null }> = {};

  if (showTrainers) {
    const allTrainerIds = [...new Set(
      allSessions.flatMap((s) =>
        s.session_trainers
          ? (s.session_trainers as RawST[]).filter((st) => st.user_id).map((st) => st.user_id!)
          : (s.trainer_id ? [s.trainer_id] : [])
      )
    )];
    const allVirtualTrainerIds = [...new Set(
      allSessions.flatMap((s) =>
        (s.session_trainers as RawST[] | undefined ?? []).filter((st) => st.virtual_trainer_id).map((st) => st.virtual_trainer_id!)
      )
    )];

    const [{ data: trainerProfiles }, { data: virtualTrainerProfiles }] = await Promise.all([
      allTrainerIds.length
        ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", allTrainerIds)
        : Promise.resolve({ data: [] }),
      allVirtualTrainerIds.length
        ? supabase.from("virtual_trainers").select("id, name, avatar_url").in("id", allVirtualTrainerIds)
        : Promise.resolve({ data: [] }),
    ]);

    profileMap = Object.fromEntries(
      (trainerProfiles ?? []).map((p) => [p.id, { name: p.full_name as string, avatarUrl: p.avatar_url as string | null }])
    );
    virtualProfileMap = Object.fromEntries(
      (virtualTrainerProfiles ?? []).map((vt) => [vt.id, { name: vt.name as string, avatarUrl: vt.avatar_url as string | null }])
    );
  }

  const [{ data: clubTopics }, { data: clubSessionTypes }] = await Promise.all([
    supabase.from("club_topics").select("name, color").eq("club_id", club.id),
    supabase.from("club_session_types").select("name, color").eq("club_id", club.id),
  ]);

  // ── Expected groups per session (public toggle) ────────────
  const groupsBySession = new Map<
    string,
    { id: string; name: string; color: string | null }[]
  >();
  if (showGroups) {
    const allSessionIds = allSessions.map((s) => s.id);
    if (allSessionIds.length) {
      const { data: expectedRows } = await supabase
        .from("session_expected_groups")
        .select("session_id, teilnehmer_groups(id, name, color)")
        .in("session_id", allSessionIds);
      // Supabase types the joined row as an array even for many-to-one FKs;
      // in practice the payload is either a single object or a one-element
      // array. Handle both shapes.
      type JoinedGroup = { id: string; name: string; color: string | null };
      type Row = {
        session_id: string;
        teilnehmer_groups: JoinedGroup | JoinedGroup[] | null;
      };
      for (const row of (expectedRows ?? []) as unknown as Row[]) {
        const tg = row.teilnehmer_groups;
        const g = Array.isArray(tg) ? tg[0] : tg;
        if (!g) continue;
        if (!groupsBySession.has(row.session_id))
          groupsBySession.set(row.session_id, []);
        groupsBySession
          .get(row.session_id)!
          .push({ id: g.id, name: g.name, color: g.color });
      }
      // Stable order per session
      for (const arr of groupsBySession.values())
        arr.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  const topicColors: ColorMap = Object.fromEntries(
    (clubTopics ?? []).map((t: { name: string; color: string | null }) => [t.name, t.color ?? null])
  );
  const typeColors: ColorMap = Object.fromEntries(
    (clubSessionTypes ?? []).map((t: { name: string; color: string | null }) => [t.name, t.color ?? null])
  );

  // Build serializable flat list
  const now = new Date();
  const todayStr = toISODate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const sessions: PublicSession[] = [];

  for (const week of weeks ?? []) {
    for (const session of (week.training_sessions ?? []) as (TrainingSession & { locations?: Location })[]) {
      const date = getSessionDate(week.week_start, session.day_of_week);
      const dateKey = toISODate(date);
      if (dateKey < todayStr) continue;
      if (dateKey === todayStr && timeToMin(session.time_start) < nowMin) continue;

      const rawSTs = (session.session_trainers ?? []) as RawST[];
      const trainerIds = rawSTs.length
        ? rawSTs.filter((st) => st.user_id).map((st) => st.user_id!)
        : session.trainer_id ? [session.trainer_id] : [];
      const virtualTrainerIds = rawSTs.filter((st) => st.virtual_trainer_id).map((st) => st.virtual_trainer_id!);
      const registeredTrainers = trainerIds
        .map((id) => profileMap[id])
        .filter((p): p is { name: string; avatarUrl: string | null } => Boolean(p));
      const virtualTrainers = virtualTrainerIds
        .map((id) => virtualProfileMap[id])
        .filter((p): p is { name: string; avatarUrl: string | null } => Boolean(p));
      const trainers = [...registeredTrainers, ...virtualTrainers];
      const trainerNames = trainers.map((t) => t.name);

      sessions.push({
        id: session.id,
        dateKey,
        shortLabel: shortLabel(date),
        fullLabel: fullLabel(date),
        timeStart: session.time_start,
        timeEnd: session.time_end,
        isCancelled: session.is_cancelled ?? false,
        sessionTypes: session.session_types ?? [],
        topics: session.topics ?? [],
        description: session.description ?? null,
        location: session.locations
          ? { name: session.locations.name, mapsUrl: session.locations.maps_url ?? null }
          : null,
        trainerNames,
        trainers,
        color: session.color ?? null,
        sortOrder: session.sort_order ?? null,
        groups: showGroups
          ? (groupsBySession.get(session.id) ?? []).map((g) => ({
              name: g.name,
              color: g.color,
            }))
          : [],
      });
    }
  }

  sessions.sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey) || a.timeStart.localeCompare(b.timeStart)
  );

  // Show the current week's note as a banner — but only on the weekdays the
  // trainer selected for it. Default (all 7 days) preserves the previous
  // "any note = always show" behavior for pre-migration weeks.
  const currentWeek = (weeks ?? []).find((w) => w.week_start === monday);
  const todayDow = getCurrentDayOfWeek();
  const visibleDow = currentWeek?.notes_visible_dow ?? [0, 1, 2, 3, 4, 5, 6];
  const currentWeekNote =
    currentWeek?.notes && visibleDow.includes(todayDow) ? currentWeek.notes : null;

  // Extract unique filter options (only from non-cancelled sessions)
  const active = sessions.filter((s) => !s.isCancelled);
  const filterOptions = {
    types:     [...new Set(active.flatMap((s) => s.sessionTypes))].sort(),
    topics:    [...new Set(active.flatMap((s) => s.topics))].sort(),
    // Omit trainer filter when trainers are hidden on the public view
    trainers:  showTrainers ? [...new Set(active.flatMap((s) => s.trainerNames))].sort() : [],
    locations: [...new Set(active.flatMap((s) => s.location ? [s.location.name] : []))].sort(),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background">
        <div className="container max-w-2xl mx-auto px-4 py-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              {club.name}
            </h1>
            {club.description && (
              <p className="text-muted-foreground text-sm mt-1">{club.description}</p>
            )}
          </div>
          {dashboardHref && (
            <a
              href={dashboardHref}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              Dashboard
            </a>
          )}
        </div>
      </header>
      <div className="flex-1">
        <PublicPlanClient sessions={sessions} filterOptions={filterOptions} weekNote={currentWeekNote} topicColors={topicColors} typeColors={typeColors} />
      </div>
      <SiteFooter />
    </div>
  );
}
