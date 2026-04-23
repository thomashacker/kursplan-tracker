import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Club, ClubMembership } from "@/types";
import { getCurrentMonday, offsetWeek, formatDate } from "@/lib/utils/date";

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

// ── page ──────────────────────────────────────────────────────

export default async function StatistikenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  // Fetch all past weeks with sessions + session_trainers
  const { data: pastWeeks } = await supabase
    .from("training_weeks")
    .select("week_start, training_sessions(id, time_start, time_end, is_cancelled, session_trainers(user_id))")
    .eq("club_id", club.id)
    .lt("week_start", currentMonday)
    .order("week_start", { ascending: false });

  // ── Aggregate ────────────────────────────────────────────────

  type TrainerStat = { sessions: number; minutes: number; lastWeek: string };
  const trainerMap = new Map<string, TrainerStat>();
  const weekCountMap = new Map<string, number>(); // week_start → session count

  let totalSessions = 0;
  let totalMinutes  = 0;

  for (const week of pastWeeks ?? []) {
    const sessions = (week.training_sessions as {
      id: string; time_start: string; time_end: string;
      is_cancelled: boolean; session_trainers: { user_id: string }[];
    }[]).filter((s) => !s.is_cancelled);

    weekCountMap.set(week.week_start, sessions.length);
    totalSessions += sessions.length;

    for (const s of sessions) {
      const dur = durationMin(s.time_start, s.time_end);
      totalMinutes += dur;

      for (const st of s.session_trainers ?? []) {
        const prev = trainerMap.get(st.user_id) ?? { sessions: 0, minutes: 0, lastWeek: "" };
        trainerMap.set(st.user_id, {
          sessions: prev.sessions + 1,
          minutes:  prev.minutes + dur,
          lastWeek: prev.lastWeek < week.week_start ? week.week_start : prev.lastWeek,
        });
      }
    }
  }

  // Fetch trainer profiles
  const trainerIds = [...trainerMap.keys()];
  const { data: profiles } = trainerIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", trainerIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name as string]));

  // Sort trainers by session count desc
  const trainerRows = [...trainerMap.entries()]
    .map(([id, stat]) => ({ id, name: profileMap[id] ?? "Unbekannt", ...stat }))
    .sort((a, b) => b.sessions - a.sessions);

  const maxSessions = trainerRows[0]?.sessions ?? 1;

  // Last 12 weeks chart data (most recent right)
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const ws = offsetWeek(currentMonday, -(11 - i));
    return { ws, count: weekCountMap.get(ws) ?? 0 };
  });
  const maxWeekCount = Math.max(...last12.map((w) => w.count), 1);

  const weeksTracked = (pastWeeks ?? []).filter(
    (w) => (w.training_sessions as unknown[]).length > 0
  ).length;

  return (
    <div className="space-y-10 pb-10">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          Statistiken
        </h1>
        <p className="text-sm text-muted-foreground">Vergangene Trainingseinheiten von {club.name}</p>
      </div>

      {/* ── KPI cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Trainings", value: totalSessions },
          { label: "Trainingsstunden", value: fmtHours(totalMinutes) },
          { label: "Aktive Trainer", value: trainerIds.length },
          { label: "Wochen mit Training", value: weeksTracked },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
            <p className="text-3xl font-bold leading-none" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {totalSessions === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-border">
          <p className="font-semibold text-base mb-1">Noch keine vergangenen Trainings</p>
          <p className="text-sm text-muted-foreground">Hier erscheinen Statistiken, sobald vergangene Wochen vorhanden sind.</p>
        </div>
      ) : (
        <>
          {/* ── Weekly activity chart ───────────────────────── */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Wöchentliche Aktivität — letzte 12 Wochen
            </p>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-end gap-1.5 h-28">
                {last12.map(({ ws, count }) => (
                  <div key={ws} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                      {count > 0 ? count : ""}
                    </span>
                    <div
                      className={`w-full rounded-t-md transition-colors ${count > 0 ? "bg-primary/70 group-hover:bg-primary" : "bg-secondary"}`}
                      style={{ height: `${Math.max((count / maxWeekCount) * 80, count > 0 ? 6 : 2)}px` }}
                    />
                    <span className="text-[9px] text-muted-foreground leading-none">{shortWeek(ws)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Trainer breakdown ───────────────────────────── */}
          {trainerRows.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Trainer-Übersicht
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
                {trainerRows.map((t, i) => (
                  <div key={t.id} className="px-5 py-4 flex items-center gap-4">
                    {/* Rank */}
                    <span className="text-xs font-bold text-muted-foreground/40 w-5 shrink-0 text-right">
                      {i + 1}
                    </span>

                    {/* Avatar placeholder */}
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    {/* Name + last session */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{t.name}</p>
                      {t.lastWeek && (
                        <p className="text-xs text-muted-foreground">
                          Zuletzt: {formatDate(t.lastWeek)}
                        </p>
                      )}
                    </div>

                    {/* Bar */}
                    <div className="hidden sm:block flex-1 max-w-[180px]">
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${(t.sessions / maxSessions) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats */}
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

          {/* ── Per-week breakdown table ─────────────────────── */}
          {(pastWeeks ?? []).length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Verlauf nach Wochen
              </p>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-secondary/30">
                    <tr>
                      <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Woche</th>
                      <th className="text-right px-5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Trainings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(pastWeeks ?? [])
                      .filter((w) => weekCountMap.get(w.week_start)! > 0)
                      .map((w) => {
                        const count = weekCountMap.get(w.week_start) ?? 0;
                        return (
                          <tr key={w.week_start} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-5 py-3 font-mono text-xs">{formatDate(w.week_start)}</td>
                            <td className="px-5 py-3 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <div className="h-1.5 w-24 bg-secondary rounded-full overflow-hidden hidden sm:block">
                                  <div
                                    className="h-full bg-primary/60 rounded-full"
                                    style={{ width: `${(count / (Math.max(...[...(weekCountMap.values())]) || 1)) * 100}%` }}
                                  />
                                </div>
                                <span className="font-semibold w-4 text-right">{count}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
