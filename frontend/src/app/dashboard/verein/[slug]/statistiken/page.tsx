import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Club, ClubMembership } from "@/types";
import { formatDate, getSessionDate, toISODate } from "@/lib/utils/date";
import TimeWindowPicker, { type TimeWindow } from "./TimeWindowPicker";
import { GroupAttendanceAccordion } from "./GroupAttendanceAccordion";
import { ActivityChart, type DailyPoint, type WeekdayPoint } from "./ActivityChart";
import { CollapsibleSection } from "./CollapsibleSection";
import { windowRange, mondayOnOrBefore } from "./dateRange";

// ── helpers ───────────────────────────────────────────────────

function durationMin(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const WINDOW_LABELS: Record<TimeWindow, string> = {
  current_month: "dieser Monat",
  last_month:    "letzter Monat",
  "6m":          "letzte 6 Monate",
  "1y":          "letztes Jahr",
};

// ── page ──────────────────────────────────────────────────────

export default async function StatistikenPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  const { slug } = await params;
  const { window: windowParam } = await searchParams;

  const activeWindow: TimeWindow =
    windowParam && windowParam in WINDOW_LABELS
      ? (windowParam as TimeWindow)
      : "current_month";

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

  if (!membership || membership.role === "member") notFound();

  const { from, to } = windowRange(activeWindow);
  const fromMondayISO = mondayOnOrBefore(from);
  const toMondayISO   = mondayOnOrBefore(to);
  // `to` is set when the window is computed (start of request); sessions
  // ending after this point are excluded. Sufficient cutoff in all cases:
  // for "current_month"/"6m"/"1y", `to === new Date()` at request start;
  // for "last_month", `to` is the end of the previous calendar month.
  const cutoffMs = to.getTime();
  const fromMs   = from.getTime();

  // Fetch weeks that could contain in-range sessions. Session-level filtering
  // narrows down to those whose end-time falls within [from, to].
  const { data: pastWeeks } = await supabase
    .from("training_weeks")
    .select(
      "week_start, training_sessions(id, time_start, time_end, is_cancelled, day_of_week, topics, session_types, session_trainers(user_id, virtual_trainer_id))",
    )
    .eq("club_id", club.id)
    .gte("week_start", fromMondayISO)
    .lte("week_start", toMondayISO)
    .order("week_start", { ascending: false });

  function isInRange(weekStart: string, dayOfWeek: number, timeEnd: string): boolean {
    const d = getSessionDate(weekStart, dayOfWeek);
    const [h, m] = timeEnd.split(":").map(Number);
    d.setHours(h, m, 0, 0);
    const t = d.getTime();
    return t >= fromMs && t <= cutoffMs;
  }

  // ── Aggregate ────────────────────────────────────────────────

  type TrainerStat = { sessions: number; minutes: number; lastWeek: string };
  const trainerMap = new Map<string, TrainerStat>(); // real user ids
  const virtualTrainerMap = new Map<string, TrainerStat>(); // virtual trainer ids

  let totalSessions = 0;
  let totalMinutes = 0;

  type SessionMeta = {
    id: string;
    time_start: string;
    time_end: string;
    is_cancelled: boolean;
    day_of_week: number;
    topics: string[];
    session_types: string[];
    week_start: string;
  };

  const allSessions: SessionMeta[] = [];

  for (const week of pastWeeks ?? []) {
    const sessions = (
      week.training_sessions as (SessionMeta & {
        session_trainers: {
          user_id: string | null;
          virtual_trainer_id: string | null;
        }[];
      })[]
    ).filter(
      (s) =>
        !s.is_cancelled &&
        isInRange(week.week_start, s.day_of_week, s.time_end),
    );

    totalSessions += sessions.length;

    for (const s of sessions) {
      allSessions.push({ ...s, week_start: week.week_start });
      const dur = durationMin(s.time_start, s.time_end);
      totalMinutes += dur;

      for (const st of (
        s as unknown as {
          session_trainers: {
            user_id: string | null;
            virtual_trainer_id: string | null;
          }[];
        }
      ).session_trainers ?? []) {
        if (st.user_id) {
          const prev = trainerMap.get(st.user_id) ?? {
            sessions: 0,
            minutes: 0,
            lastWeek: "",
          };
          trainerMap.set(st.user_id, {
            sessions: prev.sessions + 1,
            minutes: prev.minutes + dur,
            lastWeek:
              prev.lastWeek < week.week_start ? week.week_start : prev.lastWeek,
          });
        } else if (st.virtual_trainer_id) {
          const prev = virtualTrainerMap.get(st.virtual_trainer_id) ?? {
            sessions: 0,
            minutes: 0,
            lastWeek: "",
          };
          virtualTrainerMap.set(st.virtual_trainer_id, {
            sessions: prev.sessions + 1,
            minutes: prev.minutes + dur,
            lastWeek:
              prev.lastWeek < week.week_start ? week.week_start : prev.lastWeek,
          });
        }
      }
    }
  }

  const pastSessionIds = allSessions.map((s) => s.id);

  // Fetch real trainer profiles + virtual trainer names in parallel
  const trainerIds = [...trainerMap.keys()];
  const virtualTrainerIds = [...virtualTrainerMap.keys()];

  const [{ data: profiles }, { data: virtualTrainers }] = await Promise.all([
    trainerIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", trainerIds)
      : Promise.resolve({ data: [] }),
    virtualTrainerIds.length
      ? supabase
          .from("virtual_trainers")
          .select("id, name")
          .in("id", virtualTrainerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.full_name as string]),
  );
  const virtualProfileMap = Object.fromEntries(
    (virtualTrainers ?? []).map((vt) => [vt.id, vt.name as string]),
  );

  const trainerRows = [
    ...[...trainerMap.entries()].map(([id, stat]) => ({
      id,
      name: profileMap[id] ?? "Unbekannt",
      ...stat,
    })),
    ...[...virtualTrainerMap.entries()].map(([id, stat]) => ({
      id,
      name: virtualProfileMap[id] ?? "Unbekannt",
      ...stat,
    })),
  ].sort((a, b) => b.sessions - a.sessions);

  const maxSessions = trainerRows[0]?.sessions ?? 1;

  // ── Attendance data ──────────────────────────────────────────

  const { data: attendanceRows } = pastSessionIds.length
    ? await supabase
        .from("session_attendance")
        .select("session_id, status, teilnehmer_id")
        .in("session_id", pastSessionIds)
    : { data: [] };

  const presentRows = (attendanceRows ?? []).filter(
    (a) => a.status === "present",
  );
  const totalCheckIns = presentRows.length;
  const uniqueParticipants = new Set(presentRows.map((a) => a.teilnehmer_id))
    .size;
  const totalExcused = (attendanceRows ?? []).filter(
    (a) => a.status === "excused",
  ).length;

  const sessionsWithAttendance = new Set(
    (attendanceRows ?? []).map((a) => a.session_id),
  ).size;
  const avgCheckIns =
    sessionsWithAttendance > 0
      ? (totalCheckIns / sessionsWithAttendance).toFixed(1)
      : null;

  const hasAttendanceData = totalCheckIns > 0 || totalExcused > 0;

  // Check-ins per session
  const sessionCheckInMap = new Map<string, number>();
  for (const a of attendanceRows ?? []) {
    if (a.status === "present") {
      sessionCheckInMap.set(
        a.session_id,
        (sessionCheckInMap.get(a.session_id) ?? 0) + 1,
      );
    }
  }

  // ── Activity chart series (daily timeline + weekday bucket) ──
  const dailyAggMap = new Map<string, { sessions: number; checkIns: number }>();
  const dayCheckIns = new Array(7).fill(0) as number[];
  const daySessionCount = new Array(7).fill(0) as number[];

  for (const s of allSessions) {
    const dow = s.day_of_week ?? 0;
    const sCheckIns = sessionCheckInMap.get(s.id) ?? 0;
    daySessionCount[dow]++;
    dayCheckIns[dow] += sCheckIns;

    const iso = toISODate(getSessionDate(s.week_start, s.day_of_week));
    const prev = dailyAggMap.get(iso) ?? { sessions: 0, checkIns: 0 };
    dailyAggMap.set(iso, {
      sessions: prev.sessions + 1,
      checkIns: prev.checkIns + sCheckIns,
    });
  }

  // Zero-fill the daily series from `from` to the cutoff (inclusive, date-only)
  const dailySeries: DailyPoint[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endDateOnly = new Date(cutoffMs);
  endDateOnly.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= endDateOnly.getTime()) {
    const iso = toISODate(cursor);
    const v = dailyAggMap.get(iso) ?? { sessions: 0, checkIns: 0 };
    dailySeries.push({ dateISO: iso, ...v });
    cursor.setDate(cursor.getDate() + 1);
  }

  const weekdaySeries: WeekdayPoint[] = Array.from({ length: 7 }, (_, dow) => ({
    dow,
    sessions: daySessionCount[dow],
    checkIns: dayCheckIns[dow],
  }));

  // ── Topic & Trainingsart attendance ──────────────────────────
  type TagStat = { sessions: number; checkIns: number };
  const topicMap = new Map<string, TagStat>();
  const typeMap = new Map<string, TagStat>();

  for (const s of allSessions) {
    const checkIns = sessionCheckInMap.get(s.id) ?? 0;

    const topics: string[] = Array.isArray(s.topics) ? s.topics : [];
    const types: string[] = Array.isArray(s.session_types)
      ? s.session_types
      : [];

    for (const t of topics) {
      const prev = topicMap.get(t) ?? { sessions: 0, checkIns: 0 };
      topicMap.set(t, {
        sessions: prev.sessions + 1,
        checkIns: prev.checkIns + checkIns,
      });
    }
    for (const t of types) {
      const prev = typeMap.get(t) ?? { sessions: 0, checkIns: 0 };
      typeMap.set(t, {
        sessions: prev.sessions + 1,
        checkIns: prev.checkIns + checkIns,
      });
    }
  }

  const topicRows = [...topicMap.entries()]
    .map(([label, stat]) => ({
      label,
      ...stat,
      avg: stat.sessions > 0 ? stat.checkIns / stat.sessions : 0,
    }))
    .filter((row) => row.checkIns > 0)
    .sort((a, b) => b.checkIns - a.checkIns);

  const typeRows = [...typeMap.entries()]
    .map(([label, stat]) => ({
      label,
      ...stat,
      avg: stat.sessions > 0 ? stat.checkIns / stat.sessions : 0,
    }))
    .filter((row) => row.checkIns > 0)
    .sort((a, b) => b.checkIns - a.checkIns);

  const maxTopicCheckIns = topicRows[0]?.checkIns ?? 1;
  const maxTypeCheckIns = typeRows[0]?.checkIns ?? 1;

  // ── Group attendance rates ────────────────────────────────────
  const { data: teilnehmerGroups } = await supabase
    .from("teilnehmer_groups")
    .select("id, name, color")
    .eq("club_id", club.id);

  const { data: groupMembers } = teilnehmerGroups?.length
    ? await supabase
        .from("teilnehmer_group_members")
        .select("group_id, teilnehmer_id")
        .in(
          "group_id",
          (teilnehmerGroups ?? []).map((g) => g.id),
        )
    : { data: [] };

  const { data: expectedGroupRows } = pastSessionIds.length
    ? await supabase
        .from("session_expected_groups")
        .select("session_id, group_id")
        .in("session_id", pastSessionIds)
    : { data: [] };

  // Build lookup structures
  const groupMemberMap = new Map<string, Set<string>>(); // group_id → Set<teilnehmer_id>
  for (const gm of groupMembers ?? []) {
    if (!groupMemberMap.has(gm.group_id))
      groupMemberMap.set(gm.group_id, new Set());
    groupMemberMap.get(gm.group_id)!.add(gm.teilnehmer_id);
  }

  const sessionGroupMap = new Map<string, Set<string>>(); // session_id → Set<group_id>
  for (const eg of expectedGroupRows ?? []) {
    if (!sessionGroupMap.has(eg.session_id))
      sessionGroupMap.set(eg.session_id, new Set());
    sessionGroupMap.get(eg.session_id)!.add(eg.group_id);
  }

  const sessionPresentMap = new Map<string, Set<string>>(); // session_id → Set<teilnehmer_id present>
  const sessionExcusedMap = new Map<string, Set<string>>(); // session_id → Set<teilnehmer_id excused>
  for (const a of attendanceRows ?? []) {
    if (a.status === "present") {
      if (!sessionPresentMap.has(a.session_id))
        sessionPresentMap.set(a.session_id, new Set());
      sessionPresentMap.get(a.session_id)!.add(a.teilnehmer_id);
    } else if (a.status === "excused") {
      if (!sessionExcusedMap.has(a.session_id))
        sessionExcusedMap.set(a.session_id, new Set());
      sessionExcusedMap.get(a.session_id)!.add(a.teilnehmer_id);
    }
  }

  type GroupStat = {
    id: string;
    name: string;
    color: string | null;
    rate: number;
    actual: number;
    excused: number;
    unexcused: number;
    expected: number;
    sessionCount: number;
  };
  const groupStats: GroupStat[] = [];

  for (const g of teilnehmerGroups ?? []) {
    const members = groupMemberMap.get(g.id) ?? new Set<string>();
    if (members.size === 0) continue;

    // Sessions where this group was expected
    const expectedSessions = allSessions.filter((s) =>
      sessionGroupMap.get(s.id)?.has(g.id),
    );
    if (expectedSessions.length === 0) continue;

    const expectedTotal = expectedSessions.length * members.size;
    let actualPresent = 0;
    let actualExcused = 0;
    for (const s of expectedSessions) {
      const presentSet = sessionPresentMap.get(s.id) ?? new Set<string>();
      const excusedSet = sessionExcusedMap.get(s.id) ?? new Set<string>();
      for (const memberId of members) {
        if (presentSet.has(memberId)) actualPresent++;
        else if (excusedSet.has(memberId)) actualExcused++;
      }
    }

    groupStats.push({
      id: g.id,
      name: g.name,
      color: g.color ?? null,
      rate: expectedTotal > 0 ? actualPresent / expectedTotal : 0,
      actual: actualPresent,
      excused: actualExcused,
      unexcused: expectedTotal - actualPresent - actualExcused,
      expected: expectedTotal,
      sessionCount: expectedSessions.length,
    });
  }

  groupStats.sort((a, b) => b.rate - a.rate);
  const hasGroupStats = groupStats.length > 0;

  // ── Club-wide totals (independent of the time window) ────────
  const { count: totalTeilnehmer } = await supabase
    .from("teilnehmer")
    .select("*", { count: "exact", head: true })
    .eq("club_id", club.id);
  const groupCount = teilnehmerGroups?.length ?? 0;

  const hasAttendanceDetail =
    hasAttendanceData &&
    (hasGroupStats || topicRows.length > 0 || typeRows.length > 0);
  const hasTrainerDetail = trainerRows.length > 0;

  const kpis: {
    label: string;
    value: React.ReactNode;
    accent?: string;
  }[] = [
    { label: "Trainings", value: totalSessions },
    { label: "Stunden", value: fmtHours(totalMinutes) },
    {
      label: "Check-ins",
      value: totalCheckIns,
      accent: hasAttendanceData ? "text-green-600 dark:text-green-400" : "",
    },
    { label: "Unique Check-ins", value: uniqueParticipants },
    { label: "Ø pro Training", value: avgCheckIns ?? "—" },
    { label: "Teilnehmer", value: totalTeilnehmer ?? 0 },
    { label: "Gruppen", value: groupCount },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* ── Header + time window picker ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            Statistiken
          </h1>
          <p className="text-sm text-muted-foreground">
            {club.name} — {WINDOW_LABELS[activeWindow]}
          </p>
        </div>
        <Suspense>
          <TimeWindowPicker current={activeWindow} />
        </Suspense>
      </div>

      {/* ── KPI grid (7 cards) ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {kpis.map((k, i, arr) => (
          <div
            key={k.label}
            className={`rounded-2xl border border-border bg-card p-4 sm:p-5 ${
              i === arr.length - 1 ? "col-span-2 md:col-span-1" : ""
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5 leading-tight">
              {k.label}
            </p>
            <p
              className={`text-2xl sm:text-3xl font-bold leading-none tabular-nums ${k.accent ?? ""}`}
              style={{ fontFamily: "var(--font-syne, system-ui)" }}
            >
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Activity chart (trainings + check-ins) ─────────── */}
      <ActivityChart
        daily={dailySeries}
        weekday={weekdaySeries}
        hasAttendance={hasAttendanceData}
      />

      {/* ── Attendance details (collapsible) ────────────────── */}
      {hasAttendanceDetail && (
        <CollapsibleSection title="Anwesenheit · Details" defaultOpen={true}>
          {hasGroupStats && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">
                Anwesenheitsquote nach Gruppe
              </p>
              <GroupAttendanceAccordion
                groups={groupStats}
                sessionIds={pastSessionIds}
              />
            </div>
          )}

          {topicRows.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">
                Anwesenheit nach Thema
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-y-auto max-h-64 divide-y divide-border">
                  {topicRows.map((t) => (
                    <div
                      key={t.label}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {t.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.sessions} Session{t.sessions !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="hidden sm:block w-32">
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{
                              width: `${(t.checkIns / maxTopicCheckIns) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-green-600">
                          {t.checkIns}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Check-ins
                        </p>
                      </div>
                      <div className="text-right shrink-0 w-12">
                        <p className="text-sm font-bold">{t.avg.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Ø
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {typeRows.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">
                Anwesenheit nach Trainingsart
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-y-auto max-h-64 divide-y divide-border">
                  {typeRows.map((t) => (
                    <div
                      key={t.label}
                      className="px-5 py-4 flex items-center gap-4"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {t.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.sessions} Session{t.sessions !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="hidden sm:block w-32">
                        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/60 rounded-full"
                            style={{
                              width: `${(t.checkIns / maxTypeCheckIns) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-green-600">
                          {t.checkIns}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Check-ins
                        </p>
                      </div>
                      <div className="text-right shrink-0 w-12">
                        <p className="text-sm font-bold">{t.avg.toFixed(1)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Ø
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {/* ── Trainer details (collapsible) ──────────────────── */}
      {hasTrainerDetail && (
        <CollapsibleSection
          title="Trainer · Details"
          count={trainerRows.length}
          defaultOpen={false}
        >
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-y-auto max-h-96 divide-y divide-border">
              {trainerRows.map((t, i) => (
                <div
                  key={t.id}
                  className="px-5 py-4 flex items-center gap-4"
                >
                  <span className="text-xs font-bold text-muted-foreground/40 w-5 shrink-0 text-right">
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">
                      {t.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight truncate">
                      {t.name}
                    </p>
                    {t.lastWeek && (
                      <p className="text-xs text-muted-foreground">
                        Zuletzt: {formatDate(t.lastWeek)}
                      </p>
                    )}
                  </div>
                  <div className="hidden sm:block flex-1 max-w-[180px]">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{
                          width: `${(t.sessions / maxSessions) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 shrink-0 text-right">
                    <div>
                      <p className="text-sm font-bold">{t.sessions}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Sessions
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">
                        {fmtHours(t.minutes)}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        Stunden
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
