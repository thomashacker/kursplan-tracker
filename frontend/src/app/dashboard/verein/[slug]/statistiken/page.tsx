import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Club, ClubMembership } from "@/types";
import { getCurrentMonday, offsetWeek, formatDate } from "@/lib/utils/date";
import TimeWindowPicker, { type TimeWindow } from "./TimeWindowPicker";

// ── helpers ───────────────────────────────────────────────────

function durationMin(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function shortWeek(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}.${month}.`;
}

const DAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const WINDOW_WEEKS: Record<TimeWindow, number> = {
  "1w": 1,
  "1m": 4,
  "3m": 13,
  "6m": 26,
  "1y": 52,
};

const WINDOW_LABELS: Record<TimeWindow, string> = {
  "1w": "letzte Woche",
  "1m": "letzter Monat",
  "3m": "letzte 3 Monate",
  "6m": "letzte 6 Monate",
  "1y": "letztes Jahr",
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
    windowParam && windowParam in WINDOW_WEEKS
      ? (windowParam as TimeWindow)
      : "1m";

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: club } = await supabase.from("clubs").select("*").eq("slug", slug).single<Club>();
  if (!club) notFound();

  const { data: membership } = await supabase
    .from("club_memberships").select("role")
    .eq("club_id", club.id).eq("user_id", user!.id).eq("status", "active")
    .single<ClubMembership>();

  if (!membership || membership.role === "member") notFound();

  const currentMonday = getCurrentMonday();
  const fromMonday = offsetWeek(currentMonday, -WINDOW_WEEKS[activeWindow]);

  // Fetch weeks within the selected window, with extended session fields
  const { data: pastWeeks } = await supabase
    .from("training_weeks")
    .select("week_start, training_sessions(id, time_start, time_end, is_cancelled, day_of_week, topics, session_types, session_trainers(user_id))")
    .eq("club_id", club.id)
    .lt("week_start", currentMonday)
    .gte("week_start", fromMonday)
    .order("week_start", { ascending: false });

  // ── Aggregate ────────────────────────────────────────────────

  type TrainerStat = { sessions: number; minutes: number; lastWeek: string };
  const trainerMap = new Map<string, TrainerStat>();
  const weekCountMap = new Map<string, number>();

  let totalSessions = 0;
  let totalMinutes  = 0;

  type SessionMeta = {
    id: string; time_start: string; time_end: string;
    is_cancelled: boolean; day_of_week: number;
    topics: string[]; session_types: string[];
    week_start: string;
  };

  const allSessions: SessionMeta[] = [];

  for (const week of pastWeeks ?? []) {
    const sessions = (week.training_sessions as (SessionMeta & {
      session_trainers: { user_id: string }[];
    })[]).filter((s) => !s.is_cancelled);

    weekCountMap.set(week.week_start, sessions.length);
    totalSessions += sessions.length;

    for (const s of sessions) {
      allSessions.push({ ...s, week_start: week.week_start });
      const dur = durationMin(s.time_start, s.time_end);
      totalMinutes += dur;

      for (const st of (s as unknown as { session_trainers: { user_id: string }[] }).session_trainers ?? []) {
        const prev = trainerMap.get(st.user_id) ?? { sessions: 0, minutes: 0, lastWeek: "" };
        trainerMap.set(st.user_id, {
          sessions: prev.sessions + 1,
          minutes:  prev.minutes + dur,
          lastWeek: prev.lastWeek < week.week_start ? week.week_start : prev.lastWeek,
        });
      }
    }
  }

  const pastSessionIds = allSessions.map((s) => s.id);

  // Fetch trainer profiles
  const trainerIds = [...trainerMap.keys()];
  const { data: profiles } = trainerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", trainerIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name as string]));

  const trainerRows = [...trainerMap.entries()]
    .map(([id, stat]) => ({ id, name: profileMap[id] ?? "Unbekannt", ...stat }))
    .sort((a, b) => b.sessions - a.sessions);

  const maxSessions = trainerRows[0]?.sessions ?? 1;

  // Chart bars
  const numBars = WINDOW_WEEKS[activeWindow];
  const chartBars = Array.from({ length: numBars }, (_, i) => {
    const ws = offsetWeek(currentMonday, -(numBars - 1 - i));
    return { ws, count: weekCountMap.get(ws) ?? 0 };
  });
  const maxWeekCount = Math.max(...chartBars.map((w) => w.count), 1);
  const showChartLabels = numBars <= 13;

  // ── Attendance data ──────────────────────────────────────────

  const { data: attendanceRows } = pastSessionIds.length
    ? await supabase
        .from("session_attendance")
        .select("session_id, status, teilnehmer_id")
        .in("session_id", pastSessionIds)
    : { data: [] };

  const totalCheckIns = (attendanceRows ?? []).filter((a) => a.status === "present").length;
  const totalExcused  = (attendanceRows ?? []).filter((a) => a.status === "excused").length;

  const sessionsWithAttendance = new Set((attendanceRows ?? []).map((a) => a.session_id)).size;
  const avgCheckIns = sessionsWithAttendance > 0
    ? (totalCheckIns / sessionsWithAttendance).toFixed(1)
    : null;

  const hasAttendanceData = totalCheckIns > 0 || totalExcused > 0;

  // Check-ins per session
  const sessionCheckInMap = new Map<string, number>();
  for (const a of attendanceRows ?? []) {
    if (a.status === "present") {
      sessionCheckInMap.set(a.session_id, (sessionCheckInMap.get(a.session_id) ?? 0) + 1);
    }
  }

  // ── Day-of-week attendance chart ─────────────────────────────
  // 0=Mon … 6=Sun
  const dayCheckIns = new Array(7).fill(0);
  const daySessionCount = new Array(7).fill(0);
  for (const s of allSessions) {
    const dow = s.day_of_week ?? 0;
    daySessionCount[dow]++;
    dayCheckIns[dow] += sessionCheckInMap.get(s.id) ?? 0;
  }
  const maxDayCheckIns = Math.max(...dayCheckIns, 1);

  // ── Topic & Trainingsart attendance ──────────────────────────
  type TagStat = { sessions: number; checkIns: number };
  const topicMap = new Map<string, TagStat>();
  const typeMap  = new Map<string, TagStat>();

  for (const s of allSessions) {
    const checkIns = sessionCheckInMap.get(s.id) ?? 0;

    const topics: string[] = Array.isArray(s.topics) ? s.topics : [];
    const types:  string[] = Array.isArray(s.session_types) ? s.session_types : [];

    for (const t of topics) {
      const prev = topicMap.get(t) ?? { sessions: 0, checkIns: 0 };
      topicMap.set(t, { sessions: prev.sessions + 1, checkIns: prev.checkIns + checkIns });
    }
    for (const t of types) {
      const prev = typeMap.get(t) ?? { sessions: 0, checkIns: 0 };
      typeMap.set(t, { sessions: prev.sessions + 1, checkIns: prev.checkIns + checkIns });
    }
  }

  const topicRows = [...topicMap.entries()]
    .map(([label, stat]) => ({ label, ...stat, avg: stat.sessions > 0 ? stat.checkIns / stat.sessions : 0 }))
    .sort((a, b) => b.checkIns - a.checkIns);

  const typeRows = [...typeMap.entries()]
    .map(([label, stat]) => ({ label, ...stat, avg: stat.sessions > 0 ? stat.checkIns / stat.sessions : 0 }))
    .sort((a, b) => b.checkIns - a.checkIns);

  const maxTopicCheckIns = topicRows[0]?.checkIns ?? 1;
  const maxTypeCheckIns  = typeRows[0]?.checkIns  ?? 1;

  // ── Group attendance rates ────────────────────────────────────
  const { data: teilnehmerGroups } = await supabase
    .from("teilnehmer_groups")
    .select("id, name, color")
    .eq("club_id", club.id);

  const { data: groupMembers } = (teilnehmerGroups?.length)
    ? await supabase
        .from("teilnehmer_group_members")
        .select("group_id, teilnehmer_id")
        .in("group_id", (teilnehmerGroups ?? []).map((g) => g.id))
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
    if (!groupMemberMap.has(gm.group_id)) groupMemberMap.set(gm.group_id, new Set());
    groupMemberMap.get(gm.group_id)!.add(gm.teilnehmer_id);
  }

  const sessionGroupMap = new Map<string, Set<string>>(); // session_id → Set<group_id>
  for (const eg of expectedGroupRows ?? []) {
    if (!sessionGroupMap.has(eg.session_id)) sessionGroupMap.set(eg.session_id, new Set());
    sessionGroupMap.get(eg.session_id)!.add(eg.group_id);
  }

  const sessionPresentMap = new Map<string, Set<string>>(); // session_id → Set<teilnehmer_id present>
  for (const a of attendanceRows ?? []) {
    if (a.status === "present") {
      if (!sessionPresentMap.has(a.session_id)) sessionPresentMap.set(a.session_id, new Set());
      sessionPresentMap.get(a.session_id)!.add(a.teilnehmer_id);
    }
  }

  type GroupStat = { name: string; color: string | null; rate: number; actual: number; expected: number };
  const groupStats: GroupStat[] = [];

  for (const g of teilnehmerGroups ?? []) {
    const members = groupMemberMap.get(g.id) ?? new Set<string>();
    if (members.size === 0) continue;

    // Sessions where this group was expected
    const expectedSessions = allSessions.filter((s) => sessionGroupMap.get(s.id)?.has(g.id));
    if (expectedSessions.length === 0) continue;

    const expectedTotal = expectedSessions.length * members.size;
    let actualPresent = 0;
    for (const s of expectedSessions) {
      const presentSet = sessionPresentMap.get(s.id) ?? new Set<string>();
      for (const memberId of members) {
        if (presentSet.has(memberId)) actualPresent++;
      }
    }

    groupStats.push({
      name: g.name,
      color: g.color ?? null,
      rate: expectedTotal > 0 ? actualPresent / expectedTotal : 0,
      actual: actualPresent,
      expected: expectedTotal,
    });
  }

  groupStats.sort((a, b) => b.rate - a.rate);
  const hasGroupStats = groupStats.length > 0;

  return (
    <div className="space-y-10 pb-10">
      {/* ── Header + time window picker ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
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

      {/* ── KPI cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Trainings", value: totalSessions },
          { label: "Trainingsstunden", value: fmtHours(totalMinutes) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
            <p className="text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Attendance KPI cards ──────────────────────────────── */}
      {hasAttendanceData && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Anwesenheit
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Check-ins gesamt</p>
              <p className="text-3xl font-bold leading-none text-green-600" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                {totalCheckIns}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Ø pro Training</p>
              <p className="text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                {avgCheckIns ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Entschuldigungen</p>
              <p className="text-3xl font-bold leading-none text-amber-600" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                {totalExcused}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Group attendance rates ────────────────────────────── */}
      {hasGroupStats && (
        <section>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
            Anwesenheitsquote nach Gruppe
          </p>
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {groupStats.map((g) => {
              const pct = Math.round(g.rate * 100);
              return (
                <div key={g.name} className="px-5 py-4 flex items-center gap-4">
                  {/* Color dot */}
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: g.color ?? "#94a3b8" }}
                  />
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.actual} / {g.expected} erwartet</p>
                  </div>
                  {/* Bar */}
                  <div className="hidden sm:block w-36">
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: g.color ?? "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                  {/* Percentage */}
                  <span
                    className="text-lg font-bold w-12 text-right tabular-nums shrink-0"
                    style={{ color: g.color ?? "hsl(var(--primary))" }}
                  >
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {totalSessions === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-border">
          <p className="font-semibold text-base mb-1">Keine Trainings im gewählten Zeitraum</p>
          <p className="text-sm text-muted-foreground">Wähle einen längeren Zeitraum oder warte auf vergangene Wochen.</p>
        </div>
      ) : (
        <>
          {/* ── Day-of-week attendance chart ─────────────────── */}
          {hasAttendanceData && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Anwesenheit nach Wochentag
              </p>
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-end gap-2 h-28">
                  {DAY_SHORT.map((label, dow) => {
                    const count = dayCheckIns[dow];
                    const sessions = daySessionCount[dow];
                    return (
                      <div key={dow} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <span className="text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                          {count > 0 ? count : ""}
                        </span>
                        <div
                          title={`${count} Check-ins, ${sessions} Sessions`}
                          className={`w-full rounded-t-md transition-colors ${
                            count > 0 ? "bg-green-500/70 group-hover:bg-green-500" : "bg-secondary"
                          }`}
                          style={{ height: `${Math.max((count / maxDayCheckIns) * 80, count > 0 ? 6 : 2)}px` }}
                        />
                        <span className="text-[9px] text-muted-foreground leading-none">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ── Attendance by topic ───────────────────────────── */}
          {hasAttendanceData && topicRows.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Anwesenheit nach Thema
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {topicRows.map((t) => (
                  <div key={t.label} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.sessions} Session{t.sessions !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="hidden sm:block w-32">
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${(t.checkIns / maxTopicCheckIns) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">{t.checkIns}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Check-ins</p>
                    </div>
                    <div className="text-right shrink-0 w-12">
                      <p className="text-sm font-bold">{t.avg.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ø</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Attendance by Trainingsart ────────────────────── */}
          {hasAttendanceData && typeRows.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Anwesenheit nach Trainingsart
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {typeRows.map((t) => (
                  <div key={t.label} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.sessions} Session{t.sessions !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="hidden sm:block w-32">
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${(t.checkIns / maxTypeCheckIns) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-600">{t.checkIns}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Check-ins</p>
                    </div>
                    <div className="text-right shrink-0 w-12">
                      <p className="text-sm font-bold">{t.avg.toFixed(1)}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ø</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Weekly activity chart ─────────────────────────── */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Wöchentliche Aktivität
            </p>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-end gap-px sm:gap-1 h-28 overflow-hidden">
                {chartBars.map(({ ws, count }) => (
                  <div key={ws} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
                    <span className="text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity leading-none hidden sm:block">
                      {count > 0 ? count : ""}
                    </span>
                    <div
                      className={`w-full rounded-t-sm transition-colors ${count > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-secondary"}`}
                      style={{ height: `${Math.max((count / maxWeekCount) * 80, count > 0 ? 6 : 2)}px` }}
                    />
                    {showChartLabels && (
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground leading-none truncate w-full text-center">
                        {shortWeek(ws)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {!showChartLabels && (
                <p className="text-[10px] text-muted-foreground text-center mt-3">
                  {shortWeek(chartBars[0]?.ws ?? "")} – {shortWeek(chartBars[chartBars.length - 1]?.ws ?? "")}
                </p>
              )}
            </div>
          </section>

          {/* ── Trainer breakdown ─────────────────────────────── */}
          {trainerRows.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Trainer-Übersicht
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {trainerRows.map((t, i) => (
                  <div key={t.id} className="px-5 py-4 flex items-center gap-4">
                    <span className="text-xs font-bold text-muted-foreground/40 w-5 shrink-0 text-right">
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{t.name}</p>
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
                          style={{ width: `${(t.sessions / maxSessions) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 shrink-0 text-right">
                      <div>
                        <p className="text-sm font-bold">{t.sessions}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sessions</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold">{fmtHours(t.minutes)}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Stunden</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
