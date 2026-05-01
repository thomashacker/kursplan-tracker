"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import type { Club, TrainingWeek, TrainingSession, Location, Profile, ClubTopic, ClubSessionType, SessionColor, VirtualTrainer, TeilnehmerGroup } from "@/types";
import { DAY_NAMES, SESSION_COLORS } from "@/types";
import { formatTime, formatWeekRange, offsetWeek, getCurrentMonday, toISODate } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";
import { SessionCard, type AttendanceSummary } from "./SessionCard";
import { SessionEditModal, type SessionSaveData } from "./SessionEditModal";
import { AttendanceModal } from "./AttendanceModal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

const PX_PER_MIN_WEEK = 1.25; // 75px / hr  — timetable in week context
const PX_PER_MIN_DAY  = 3;    // 180px / hr — full-day drill-down

const MONTH_NAMES = [
  "Januar","Februar","März","April","Mai","Juni",
  "Juli","August","September","Oktober","November","Dezember",
];

interface Props {
  club: Club;
  week: TrainingWeek | null;
  weekStart: string;
  canEdit: boolean;
  isAdmin: boolean;
  locations: Location[];
  trainers: Profile[];
  virtualTrainers: VirtualTrainer[];
  topics: ClubTopic[];
  sessionTypes: ClubSessionType[];
}

type View = "week" | "month";

// ── pure helpers ──────────────────────────────────────────────

function todayDayIndexInWeek(weekStart: string): number {
  const msPerDay = 86_400_000;
  const mon = new Date(weekStart + "T00:00:00").getTime();
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((now.getTime() - mon) / msPerDay);
}

function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getCurrentMonday();
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function weekDayDate(weekStart: string, dayIndex: number): string {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + dayIndex);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function sessionLabel(s: TrainingSession): string {
  return [...(s.session_types ?? []), ...(s.topics ?? [])].join(" · ") || "Training";
}

function getOverlapLayout(
  daySessions: TrainingSession[]
): Map<string, { lane: number; totalLanes: number }> {
  const result = new Map<string, { lane: number; totalLanes: number }>();
  if (daySessions.length === 0) return result;

  // Greedy column packing — assign each session to the first column
  // whose last occupant has already ended, minimising wasted width.
  const sorted = [...daySessions].sort(
    (a, b) => a.time_start.localeCompare(b.time_start) || a.time_end.localeCompare(b.time_end)
  );
  const cols: TrainingSession[][] = [];
  const sessionCol = new Map<string, number>();

  for (const s of sorted) {
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      const last = cols[c][cols[c].length - 1];
      if (last.time_end <= s.time_start) {
        cols[c].push(s);
        sessionCol.set(s.id, c);
        placed = true;
        break;
      }
    }
    if (!placed) {
      cols.push([s]);
      sessionCol.set(s.id, cols.length - 1);
    }
  }

  // totalLanes for each session = widest overlap clique it participates in
  for (const s of sorted) {
    const overlapping = sorted.filter(o => o.time_start < s.time_end && o.time_end > s.time_start);
    const totalLanes = Math.max(...overlapping.map(o => (sessionCol.get(o.id) ?? 0))) + 1;
    result.set(s.id, { lane: sessionCol.get(s.id) ?? 0, totalLanes });
  }

  return result;
}

// ── Month view ────────────────────────────────────────────────

function MonthView({
  clubId,
  initialMonthDate,
  onDayClick,
}: {
  clubId: string;
  initialMonthDate: Date;
  onDayClick: (dayDate: Date) => void;
}) {
  const [year, setYear]   = useState(initialMonthDate.getFullYear());
  const [month, setMonth] = useState(initialMonthDate.getMonth());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    async function fetch() {
      const supabase = createClient();
      const monthStart = new Date(year, month, 1);
      const monthEnd   = new Date(year, month + 1, 0);

      // first Monday at or before month start
      const fd = monthStart.getDay();
      const gridStart = new Date(monthStart);
      gridStart.setDate(monthStart.getDate() - (fd === 0 ? 6 : fd - 1));

      // last Sunday at or after month end
      const ld = monthEnd.getDay();
      const gridEnd = new Date(monthEnd);
      gridEnd.setDate(monthEnd.getDate() + (ld === 0 ? 0 : 7 - ld));

      const { data: weeks } = await supabase
        .from("training_weeks")
        .select("week_start, training_sessions(day_of_week, is_cancelled)")
        .eq("club_id", clubId)
        .gte("week_start", toISODate(gridStart))
        .lte("week_start", toISODate(gridEnd));

      const map = new Map<string, number>();
      for (const w of weeks ?? []) {
        const weekDate = new Date(w.week_start + "T00:00:00");
        for (const s of (w.training_sessions as { day_of_week: number; is_cancelled: boolean }[]) ?? []) {
          if (s.is_cancelled) continue;
          const d = new Date(weekDate);
          d.setDate(weekDate.getDate() + s.day_of_week);
          const key = toISODate(d);
          map.set(key, (map.get(key) ?? 0) + 1);
        }
      }
      setCounts(map);
    }
    fetch();
  }, [year, month, clubId]);

  const today = new Date(); today.setHours(0,0,0,0);

  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  const fd = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - (fd === 0 ? 6 : fd - 1));

  const ld = monthEnd.getDay();
  const totalCells = (fd === 0 ? 6 : fd - 1) + monthEnd.getDate() + (ld === 0 ? 0 : 7 - ld);
  const cells: Date[] = Array.from({ length: totalCells }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  function prevMonth() { month === 0 ? (setYear(y => y-1), setMonth(11)) : setMonth(m => m-1); }
  function nextMonth() { month === 11 ? (setYear(y => y+1), setMonth(0)) : setMonth(m => m+1); }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      {/* Month navigation */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={prevMonth} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <span className="font-semibold flex-1 text-center" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={nextMonth} className="h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-secondary transition-colors">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-secondary/30">
          {DAY_NAMES.map((n) => (
            <div key={n} className="py-2 text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {n.slice(0,2)}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === month;
            const isToday = d.getTime() === today.getTime();
            const count = counts.get(toISODate(d)) ?? 0;

            return (
              <button
                key={i}
                onClick={() => onDayClick(d)}
                className={`min-h-[72px] sm:min-h-[80px] p-2 text-left transition-colors hover:bg-secondary/50 flex flex-col gap-1 ${!inMonth ? "opacity-25" : ""}`}
              >
                <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {d.getDate()}
                </span>
                {count > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {Array.from({ length: Math.min(count, 5) }).map((_, j) => (
                      <span key={j} className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                    ))}
                    {count > 5 && <span className="text-[9px] text-muted-foreground leading-none">+{count-5}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Day timetable (drill-down) ────────────────────────────────

function DayTimetable({
  dayIndex,
  weekStart,
  sessions,
  trainers,
  virtualTrainers,
  canEdit,
  onEdit,
  onDelete,
  onNewSession,
  onBack,
  onAttendance,
}: {
  dayIndex: number;
  weekStart: string;
  sessions: TrainingSession[];
  trainers: Profile[];
  virtualTrainers: VirtualTrainer[];
  canEdit: boolean;
  onEdit: (s: TrainingSession) => void;
  onDelete: (s: TrainingSession) => void;
  onNewSession: (day: number) => void;
  onBack: () => void;
  onAttendance: (s: TrainingSession) => void;
}) {
  const daySessions = sessions
    .filter((s) => s.day_of_week === dayIndex)
    .sort((a, b) => a.time_start.localeCompare(b.time_start));

  const layout = getOverlapLayout(daySessions);

  const allMins = daySessions.flatMap((s) => [timeToMin(s.time_start), timeToMin(s.time_end)]);
  const rangeStart = allMins.length ? Math.floor(Math.min(...allMins) / 60) * 60 : 8 * 60;
  const rangeEnd   = allMins.length ? Math.ceil(Math.max(...allMins) / 60) * 60   : 22 * 60;
  const gridH      = (rangeEnd - rangeStart) * PX_PER_MIN_DAY;

  const hours: number[] = [];
  for (let h = rangeStart / 60; h <= rangeEnd / 60; h++) hours.push(h);

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={spring}>
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Zur Woche
        </button>
        <h2 className="font-bold text-lg leading-tight" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          {DAY_NAMES[dayIndex]}
          <span className="block text-xs font-mono font-normal text-muted-foreground tracking-normal">
            {weekDayDate(weekStart, dayIndex)}
          </span>
        </h2>
        {canEdit && (
          <button
            onClick={() => onNewSession(dayIndex)}
            className="ml-auto h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            + Sitzung
          </button>
        )}
      </div>

      {daySessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-border">
          <p className="text-sm font-semibold mb-1">Kein Training</p>
          <p className="text-xs text-muted-foreground">Für diesen Tag ist noch kein Training geplant.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Horizontal scroll wrapper — lets sessions breathe on narrow screens */}
          <div className="overflow-x-auto overflow-y-clip">
          {(() => {
            const maxLanes = Math.max(...Array.from(layout.values()).map(v => v.totalLanes), 1);
            const MIN_LANE_PX = 160;
            const sessionAreaMinWidth = maxLanes * MIN_LANE_PX;
            return (
          <div className="flex" style={{ height: Math.max(gridH, 0), minHeight: "calc(100svh - 220px)" }}>
            {/* Time labels — sticky so they stay visible while grid scrolls */}
            <div className="w-14 shrink-0 relative border-r border-border sticky left-0 z-10 bg-background">
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 text-[10px] text-muted-foreground font-mono leading-none"
                  style={{ top: (h * 60 - rangeStart) * PX_PER_MIN_DAY - 6 }}
                >
                  {String(h).padStart(2,"0")}:00
                </div>
              ))}
            </div>

            {/* Session area */}
            <div className="relative" style={{ minWidth: sessionAreaMinWidth, flex: "1 0 auto" }}>
              {/* Hour lines */}
              {hours.map((h) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-border/50"
                  style={{ top: (h * 60 - rangeStart) * PX_PER_MIN_DAY }}
                />
              ))}

              {daySessions.map((s) => {
                const info   = layout.get(s.id)!;
                const top    = (timeToMin(s.time_start) - rangeStart) * PX_PER_MIN_DAY;
                const height = Math.max((timeToMin(s.time_end) - timeToMin(s.time_start)) * PX_PER_MIN_DAY, 32);
                const pct    = 100 / info.totalLanes;

                const trainerProfiles = (s.session_trainers?.length
                  ? s.session_trainers.filter((st) => st.user_id).map((st) => trainers.find((t) => t.id === st.user_id))
                  : trainers.filter((t) => t.id === s.trainer_id)
                ).filter((t): t is Profile => Boolean(t));
                const virtualTrainerDisplays = (s.session_trainers ?? [])
                  .filter((st) => st.virtual_trainer_id)
                  .map((st) => virtualTrainers.find((vt) => vt.id === st.virtual_trainer_id))
                  .filter((vt): vt is VirtualTrainer => Boolean(vt));
                const types  = s.session_types ?? [];
                const topics = s.topics ?? [];

                const colorKey = (s.color ?? "neutral") as SessionColor;
                const colorCfg = SESSION_COLORS[colorKey] ?? SESSION_COLORS.neutral;
                const hasColor = colorKey !== "neutral" && !s.is_cancelled;

                const isOverlapping = info.totalLanes > 1;

                return (
                  <div
                    key={s.id}
                    className={`absolute overflow-hidden group ${
                      isOverlapping ? "rounded-lg" : "rounded-xl"
                    } border ${
                      s.is_cancelled
                        ? "bg-destructive/8 border-destructive/30"
                        : hasColor ? "" : "bg-card border-primary/20"
                    } ${isOverlapping && !hasColor && !s.is_cancelled ? "shadow-sm" : ""}`}
                    style={{
                      top,
                      height,
                      width:  `calc(${pct}% - ${isOverlapping ? 6 : 8}px)`,
                      left:   `calc(${info.lane * pct}% + ${isOverlapping ? 3 : 4}px)`,
                      ...(hasColor ? { backgroundColor: colorCfg.bg, borderColor: colorCfg.border } : {}),
                    }}
                  >
                    {/* Left accent stripe for overlapping sessions */}
                    {isOverlapping && !s.is_cancelled && (
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                        style={{ backgroundColor: hasColor ? colorCfg.border : "var(--primary)", opacity: 0.7 }}
                      />
                    )}
                    <div className={`h-full px-3 py-2 ${isOverlapping ? "pl-3.5" : ""}`}>
                    {s.is_cancelled && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive mb-1">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                        Abgesagt
                      </span>
                    )}
                    <p className="text-[11px] font-mono text-muted-foreground leading-none mb-1">
                      {formatTime(s.time_start)} – {formatTime(s.time_end)}
                    </p>

                    {topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {topics.map((t) => (
                          <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">{t}</span>
                        ))}
                      </div>
                    )}
                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {types.map((t) => (
                          <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{t}</span>
                        ))}
                      </div>
                    )}

                    {height >= 80 && (trainerProfiles.length > 0 || virtualTrainerDisplays.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {trainerProfiles.map((t) => (
                          <span key={t.id} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            {t.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.avatar_url} alt={t.full_name} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[7px] font-bold shrink-0">
                                {t.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            {t.full_name}
                          </span>
                        ))}
                        {virtualTrainerDisplays.map((vt) => (
                          <span key={vt.id} className="inline-flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-400">
                            {vt.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={vt.avatar_url} alt={vt.name} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-[7px] font-bold shrink-0">
                                {vt.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                            )}
                            {vt.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {height >= 80 && s.locations && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {s.locations.name}
                      </p>
                    )}
                    {height >= 100 && s.description && (
                      <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{s.description}</p>
                    )}

                    {/* Attendance button in timetable */}
                    <button
                      type="button"
                      onClick={() => onAttendance(s)}
                      className="absolute bottom-1.5 left-1.5 right-1.5 md:hidden md:group-hover:flex hidden items-center justify-center gap-1 text-[9px] font-medium text-muted-foreground/70 hover:text-foreground border border-dashed border-border/50 rounded py-0.5 hover:bg-secondary/30 transition-colors"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <polyline points="16 11 18 13 22 9"/>
                      </svg>
                      Anwesenheit
                    </button>
                    {canEdit && (
                      <div className="absolute top-1.5 right-1.5 flex md:hidden md:group-hover:flex gap-0.5 bg-background/90 rounded-lg p-0.5 shadow-sm">
                        <button type="button" onClick={() => onEdit(s)}
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Bearbeiten">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button type="button" onClick={() => onDelete(s)}
                          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Löschen">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    )}
                    </div>{/* end inner content div */}
                  </div>
                );
              })}
            </div>
          </div>
          );
          })()}
          </div>{/* end overflow-x-auto */}
        </div>
      )}
    </motion.div>
  );
}

// ── Next Training view ────────────────────────────────────────

function NextTrainingView({
  sessions,
  trainers,
  virtualTrainers,
  weekStart,
}: {
  sessions: TrainingSession[];
  trainers: Profile[];
  virtualTrainers: VirtualTrainer[];
  weekStart: string;
}) {
  const todayIdx = todayDayIndexInWeek(weekStart);
  const nowTime  = new Date().toTimeString().slice(0, 5);

  const sorted = [...sessions].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.time_start.localeCompare(b.time_start)
  );

  const next = sorted.find(
    (s) => !s.is_cancelled && (
      s.day_of_week > todayIdx ||
      (s.day_of_week === todayIdx && s.time_start.slice(0, 5) >= nowTime)
    )
  );

  if (!next) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p className="font-semibold text-base mb-1" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          Kein bevorstehendes Training
        </p>
        <p className="text-sm text-muted-foreground">Diese Woche gibt es keine weiteren Trainingseinheiten.</p>
      </div>
    );
  }

  const trainerProfiles = (next.session_trainers?.length
    ? next.session_trainers.filter((st) => st.user_id).map((st) => trainers.find((t) => t.id === st.user_id))
    : trainers.filter((t) => t.id === next.trainer_id)
  ).filter((t): t is Profile => Boolean(t));
  const nextVirtualTrainers = (next.session_trainers ?? [])
    .filter((st) => st.virtual_trainer_id)
    .map((st) => virtualTrainers.find((vt) => vt.id === st.virtual_trainer_id))
    .filter((vt): vt is VirtualTrainer => Boolean(vt));

  const isToday = next.day_of_week === todayIdx;

  const remaining = sorted.filter(
    (s) => s.id !== next.id && !s.is_cancelled && (
      s.day_of_week > todayIdx ||
      (s.day_of_week === todayIdx && s.time_start.slice(0, 5) >= nowTime)
    )
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="space-y-4">
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
          {isToday ? "Heute" : DAY_NAMES[next.day_of_week]}
        </p>
        <p className="font-bold text-2xl leading-tight mb-2" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          {sessionLabel(next)}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-mono">{formatTime(next.time_start)} – {formatTime(next.time_end)}</span>
          {next.locations && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {next.locations.name}
            </span>
          )}
          {(trainerProfiles.length > 0 || nextVirtualTrainers.length > 0) && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {[...trainerProfiles.map((t) => t.full_name), ...nextVirtualTrainers.map((vt) => vt.name)].join(", ")}
            </span>
          )}
        </div>
        {next.description && <p className="text-sm text-muted-foreground mt-3 italic">{next.description}</p>}
      </div>

      {remaining.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Diese Woche noch</p>
          <div className="space-y-2">
            {remaining.map((s) => {
              const sp = (s.session_trainers?.length
                ? s.session_trainers.filter((st) => st.user_id).map((st) => trainers.find((t) => t.id === st.user_id))
                : trainers.filter((t) => t.id === s.trainer_id)
              ).filter((t): t is Profile => Boolean(t));
              const svt = (s.session_trainers ?? [])
                .filter((st) => st.virtual_trainer_id)
                .map((st) => virtualTrainers.find((vt) => vt.id === st.virtual_trainer_id))
                .filter((vt): vt is VirtualTrainer => Boolean(vt));
              const allNames = [...sp.map((t) => t.full_name), ...svt.map((vt) => vt.name)];
              return (
                <div key={s.id} className="flex items-start gap-4 p-3 rounded-xl border border-border bg-card">
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-medium text-muted-foreground">{DAY_NAMES[s.day_of_week].slice(0,2)}</p>
                    <p className="text-xs font-mono text-muted-foreground">{formatTime(s.time_start)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{sessionLabel(s)}</p>
                    {allNames.length > 0 && <p className="text-xs text-muted-foreground">{allNames.join(", ")}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────

export function WeeklyPlanEditor({
  club,
  week: initialWeek,
  weekStart,
  canEdit,
  isAdmin,
  locations,
  trainers,
  virtualTrainers,
  topics,
  sessionTypes,
}: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [week, setWeek] = useState(initialWeek);
  const [editingSession, setEditingSession] = useState<TrainingSession | null | "new">(null);
  const [newSessionDay, setNewSessionDay] = useState<number>(0);
  const [attendanceSession, setAttendanceSession] = useState<TrainingSession | null>(null);
  const [view, setView] = useState<View>("week");
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // drill-down
  const [hasChanges, setHasChanges] = useState(false);
  const [hasRemoteChanges, setHasRemoteChanges] = useState(false);
  const suppressRealtimeRef = useRef(false);
  const [isRefreshing, startTransition] = useTransition();

  // Delete confirm dialog state
  const [deleteTarget, setDeleteTarget] = useState<{ sessionId: string; templateId: string | null } | null>(null);
  const [deleteScope, setDeleteScope] = useState<"single" | "future">("single");
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [teilnehmerGroups, setTeilnehmerGroups] = useState<TeilnehmerGroup[]>([]);
  const [groupMemberCounts, setGroupMemberCounts] = useState<Record<string, number>>({});
  const [attendanceSummaries, setAttendanceSummaries] = useState<Map<string, AttendanceSummary>>(new Map());
  const [attendanceSummaryRevision, setAttendanceSummaryRevision] = useState(0);

  // Fetch teilnehmer groups + member counts for this club (used in session expected-group picker)
  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("teilnehmer_groups").select("*").eq("club_id", club.id).order("name"),
      supabase.from("teilnehmer_group_members").select("group_id").eq("club_id", club.id),
    ]).then(([{ data: groups }, { data: members }]) => {
      if (groups) setTeilnehmerGroups(groups);
      if (members) {
        const counts: Record<string, number> = {};
        for (const m of members) {
          counts[m.group_id] = (counts[m.group_id] ?? 0) + 1;
        }
        setGroupMemberCounts(counts);
      }
    });
  }, [club.id]);

  // Fetch attendance summaries for all sessions in the current week
  useEffect(() => {
    const sessionIds = (week?.training_sessions ?? []).map((s) => s.id);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (sessionIds.length === 0) { setAttendanceSummaries(new Map()); return; }
    /* eslint-enable react-hooks/set-state-in-effect */

    const supabase = createClient();
    (async () => {
      const [{ data: attendance }, { data: expectedGroups }] = await Promise.all([
        supabase.from("session_attendance").select("session_id, status").in("session_id", sessionIds).eq("status", "present"),
        supabase.from("session_expected_groups").select("session_id, group_id").in("session_id", sessionIds),
      ]);

      // Present count per session
      const presentCounts = new Map<string, number>();
      for (const a of attendance ?? []) presentCounts.set(a.session_id, (presentCounts.get(a.session_id) ?? 0) + 1);

      // Group IDs per session
      const sessionGroupIds = new Map<string, string[]>();
      for (const eg of expectedGroups ?? []) {
        const prev = sessionGroupIds.get(eg.session_id) ?? [];
        sessionGroupIds.set(eg.session_id, [...prev, eg.group_id]);
      }

      // Count unique expected members per session
      const memberCounts = new Map<string, number>();
      const allGroupIds = [...new Set((expectedGroups ?? []).map((eg) => eg.group_id))];
      if (allGroupIds.length > 0) {
        const { data: members } = await supabase
          .from("teilnehmer_group_members").select("group_id, teilnehmer_id").in("group_id", allGroupIds);
        for (const sid of sessionIds) {
          const gids = sessionGroupIds.get(sid) ?? [];
          if (gids.length === 0) continue;
          const memberSet = new Set<string>();
          for (const m of members ?? []) { if (gids.includes(m.group_id)) memberSet.add(m.teilnehmer_id); }
          memberCounts.set(sid, memberSet.size);
        }
      }

      const summary = new Map<string, AttendanceSummary>();
      for (const sid of sessionIds) {
        const present = presentCounts.get(sid) ?? 0;
        const hasGroups = (sessionGroupIds.get(sid) ?? []).length > 0;
        const expected = hasGroups ? (memberCounts.get(sid) ?? 0) : null;
        if (hasGroups || present > 0) summary.set(sid, { present, expected });
      }
      setAttendanceSummaries(summary);
    })();
  }, [week?.id, week?.training_sessions?.length, attendanceSummaryRevision]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setWeek(initialWeek);
    setHasChanges(false);
    setHasRemoteChanges(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    suppressRealtimeRef.current = false;
  }, [initialWeek]);

  // When week changes (URL nav), reset day drill-down
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSelectedDay(null); }, [weekStart]);

  // Realtime: watch for changes made by other users on the same week
  useEffect(() => {
    if (!week?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`week-${week.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "training_sessions", filter: `week_id=eq.${week.id}` },
        (payload) => {
          console.log("[Realtime] training_sessions change:", payload);
          if (!suppressRealtimeRef.current) setHasRemoteChanges(true);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "training_weeks", filter: `id=eq.${week.id}` },
        (payload) => {
          console.log("[Realtime] training_weeks change:", payload);
          if (!suppressRealtimeRef.current) setHasRemoteChanges(true);
        }
      )
      .subscribe((status, err) => {
        console.log("[Realtime] subscription status:", status, err ?? "");
      });
    return () => { supabase.removeChannel(channel); };
  }, [week?.id]);


  const sessions    = week?.training_sessions ?? [];
  const todayIdx    = todayDayIndexInWeek(weekStart);
  const currentWeek = isCurrentWeek(weekStart);

  function getSessionsForDay(day: number) {
    return sessions
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.time_start.localeCompare(b.time_start));
  }

  function navigate(offset: number) {
    router.push(`?woche=${offsetWeek(weekStart, offset)}`);
  }

  function goToToday() { router.push("?"); }

  async function ensureWeekExists(): Promise<string> {
    if (week?.id) return week.id;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("training_weeks")
      .insert({ club_id: club.id, week_start: weekStart, created_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setWeek({ ...data, training_sessions: [] });
    return data.id;
  }

  async function togglePublish(scope: "single" | "month" | "all" = "single") {
    if (!week) return;
    suppressRealtimeRef.current = true;
    const supabase = createClient();
    const newVal = !week.is_published;

    if (scope === "month") {
      const [y, m] = weekStart.split("-").map(Number);
      const monthStart = `${weekStart.slice(0, 7)}-01`;
      const monthEnd   = `${weekStart.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      const { error } = await supabase
        .from("training_weeks")
        .update({ is_published: newVal })
        .eq("club_id", club.id)
        .gte("week_start", monthStart)
        .lte("week_start", monthEnd);
      if (error) { toast.error(error.message); return; }
      setWeek({ ...week, is_published: newVal });
      toast.success(newVal ? `${MONTH_NAMES[m - 1]} veröffentlicht!` : `${MONTH_NAMES[m - 1]} unveröffentlicht.`);
    } else if (scope === "all") {
      const { error } = await supabase
        .from("training_weeks")
        .update({ is_published: newVal })
        .eq("club_id", club.id);
      if (error) { toast.error(error.message); return; }
      setWeek({ ...week, is_published: newVal });
      toast.success(newVal ? "Alle Wochen veröffentlicht!" : "Alle Wochen unveröffentlicht.");
    } else {
      const { error } = await supabase
        .from("training_weeks")
        .update({ is_published: newVal })
        .eq("id", week.id);
      if (error) { toast.error(error.message); return; }
      setWeek({ ...week, is_published: newVal });
      toast.success(newVal ? "Plan veröffentlicht!" : "Plan unveröffentlicht.");
    }
  }

  async function handleCopyFromLastWeek() {
    suppressRealtimeRef.current = true;
    const prevMonday = offsetWeek(weekStart, -1);
    const supabase   = createClient();
    const { data: prevWeek } = await supabase
      .from("training_weeks").select("id")
      .eq("club_id", club.id).eq("week_start", prevMonday).single();
    if (!prevWeek) { toast.error("Keine Vorwoche gefunden."); return; }
    try {
      const res = await fetch("/api/copy-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_week_id: prevWeek.id, target_week_start: weekStart }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Fehler beim Kopieren");
      }
      toast.success("Vorwoche kopiert!");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Kopieren");
    }
  }

  function handleDiscardChanges() {
    setWeek(initialWeek);
    setHasChanges(false);
    startTransition(() => router.refresh());
  }

  function openNewSession(day: number) {
    setNewSessionDay(day);
    setEditingSession("new");
  }

  // Helper: replace session_trainers for a single session (real + virtual)
  async function saveTrainers(
    supabase: ReturnType<typeof createClient>,
    sessionId: string,
    trainerIds: string[],
    virtualTrainerIds: string[],
  ) {
    await supabase.from("session_trainers").delete().eq("session_id", sessionId);
    const rows = [
      ...trainerIds.map((uid) => ({ session_id: sessionId, user_id: uid, virtual_trainer_id: null })),
      ...virtualTrainerIds.map((vid) => ({ session_id: sessionId, user_id: null, virtual_trainer_id: vid })),
    ];
    if (rows.length > 0) {
      await supabase.from("session_trainers").insert(rows);
    }
  }

  // Helper: batch-generate recurring sessions starting from a given week.
  // Skips weeks that already have a session from this template (idempotent).
  async function saveExpectedGroups(
    supabase: ReturnType<typeof createClient>,
    sessionId: string,
    groupIds: string[],
  ) {
    await supabase.from("session_expected_groups").delete().eq("session_id", sessionId);
    if (groupIds.length > 0) {
      await supabase.from("session_expected_groups").insert(
        groupIds.map((gid) => ({ session_id: sessionId, group_id: gid }))
      );
    }
  }

  async function generateRecurringSessions(
    supabase: ReturnType<typeof createClient>,
    templateId: string,
    data: {
      day_of_week: number; time_start: string; time_end: string;
      location_id: string | null; topics: string[]; session_types: string[];
      description: string | null; trainer_ids: string[]; virtual_trainer_ids: string[];
      is_cancelled: boolean; color: string | null; expected_group_ids: string[];
    },
    fromWeekStart: string,
    numWeeks: number,
  ) {
    const { data: { user } } = await supabase.auth.getUser();
    const weekStarts = Array.from({ length: numWeeks }, (_, i) => offsetWeek(fromWeekStart, i));

    // Fetch or create all needed training_weeks
    const { data: existingWeeks } = await supabase
      .from("training_weeks")
      .select("id, week_start")
      .eq("club_id", club.id)
      .in("week_start", weekStarts);

    const weekMap = new Map((existingWeeks ?? []).map((w) => [w.week_start, w.id]));

    const missing = weekStarts.filter((ws) => !weekMap.has(ws));
    if (missing.length > 0) {
      const { data: created } = await supabase
        .from("training_weeks")
        .insert(missing.map((ws) => ({ club_id: club.id, week_start: ws, created_by: user?.id, is_published: true })))
        .select("id, week_start");
      for (const w of created ?? []) weekMap.set(w.week_start, w.id);
    }

    // Skip weeks that already have a session from this template (prevents duplicates)
    const allWeekIds = weekStarts.map((ws) => weekMap.get(ws)!).filter(Boolean);
    const { data: alreadyExists } = await supabase
      .from("training_sessions")
      .select("week_id")
      .eq("template_id", templateId)
      .in("week_id", allWeekIds);
    const existingWeekIds = new Set((alreadyExists ?? []).map((s) => s.week_id));

    const sessionRows = weekStarts
      .filter((ws) => !existingWeekIds.has(weekMap.get(ws)!))
      .map((ws) => ({
        week_id: weekMap.get(ws)!,
        day_of_week: data.day_of_week,
        time_start: data.time_start,
        time_end: data.time_end,
        location_id: data.location_id,
        topics: data.topics,
        session_types: data.session_types,
        description: data.description,
        trainer_id: data.trainer_ids[0] ?? null,
        is_cancelled: data.is_cancelled,
        color: data.color,
        template_id: templateId,
        is_modified: false,
        tags: [],
        topic: null,
      }));

    if (sessionRows.length === 0) return;

    const { data: createdSessions } = await supabase
      .from("training_sessions")
      .insert(sessionRows)
      .select("id");

    if ((data.trainer_ids.length > 0 || data.virtual_trainer_ids.length > 0) && createdSessions) {
      const rows = createdSessions.flatMap((s) => [
        ...data.trainer_ids.map((uid) => ({ session_id: s.id, user_id: uid, virtual_trainer_id: null })),
        ...data.virtual_trainer_ids.map((vid) => ({ session_id: s.id, user_id: null, virtual_trainer_id: vid })),
      ]);
      if (rows.length > 0) await supabase.from("session_trainers").insert(rows);
    }

    if (data.expected_group_ids.length > 0 && createdSessions) {
      const groupRows = createdSessions.flatMap((s) =>
        data.expected_group_ids.map((gid) => ({ session_id: s.id, group_id: gid }))
      );
      if (groupRows.length > 0) await supabase.from("session_expected_groups").insert(groupRows);
    }
  }

  async function handleSaveSession(data: SessionSaveData) {
    suppressRealtimeRef.current = true;
    const supabase = createClient();
    const { trainer_ids, virtual_trainer_ids, is_recurring, edit_scope, auto_extend, expected_group_ids, ...sessionData } = data;
    const sessionFields = { ...sessionData, trainer_id: trainer_ids[0] ?? null };

    // ── Case 1: New one-off session ───────────────────────────
    if (editingSession === "new" && !is_recurring) {
      const weekId = await ensureWeekExists().catch((err) => { toast.error(err.message); return null; });
      if (!weekId) return;
      const { data: created, error } = await supabase
        .from("training_sessions")
        .insert({ ...sessionFields, week_id: weekId, template_id: null, is_modified: false })
        .select("id").single();
      if (error) { toast.error(error.message); return; }
      await saveTrainers(supabase, created.id, trainer_ids, virtual_trainer_ids);
      await saveExpectedGroups(supabase, created.id, expected_group_ids);
      toast.success("Sitzung erstellt.");
    }

    // ── Case 2: New recurring session ────────────────────────
    else if (editingSession === "new" && is_recurring) {
      // Create the template first
      const label = [...data.session_types, ...data.topics].join(" · ") || "Training";
      const generatedThrough = offsetWeek(weekStart, 7); // last of 8 weeks
      const { data: template, error: tErr } = await supabase
        .from("session_templates")
        .insert({
          club_id: club.id,
          name: label,
          day_of_week: data.day_of_week,
          time_start: data.time_start,
          time_end: data.time_end,
          location_id: data.location_id,
          topics: data.topics,
          session_types: data.session_types,
          description: data.description,
          default_trainer_id: trainer_ids[0] ?? null,
          trainer_ids,
          virtual_trainer_ids,
          is_cancelled: data.is_cancelled,
          color: data.color,
          generated_through: generatedThrough,
          auto_extend,
          tags: [],
          topic: null,
        })
        .select("id").single();
      if (tErr) { toast.error(tErr.message); return; }
      await generateRecurringSessions(supabase, template.id, data, weekStart, 8);
      toast.success("Wiederkehrende Sitzung erstellt (8 Wochen).");
    }

    // ── Case 3: Edit non-recurring session ───────────────────
    else if (editingSession !== "new" && !editingSession?.template_id) {
      const { error } = await supabase
        .from("training_sessions")
        .update(sessionFields).eq("id", editingSession!.id);
      if (error) { toast.error(error.message); return; }
      await saveTrainers(supabase, editingSession!.id, trainer_ids, virtual_trainer_ids);
      await saveExpectedGroups(supabase, editingSession!.id, expected_group_ids);
      toast.success("Gespeichert.");
    }

    // ── Case 4: Edit recurring — only this week ───────────────
    else if (editingSession !== "new" && edit_scope === "single") {
      const { error } = await supabase
        .from("training_sessions")
        .update({ ...sessionFields, is_modified: true }).eq("id", editingSession!.id);
      if (error) { toast.error(error.message); return; }
      await saveTrainers(supabase, editingSession!.id, trainer_ids, virtual_trainer_ids);
      await saveExpectedGroups(supabase, editingSession!.id, expected_group_ids);
      toast.success("Diese Woche aktualisiert.");
    }

    // ── Case 5: Edit recurring — this and all future ──────────
    else if (editingSession !== "new" && edit_scope === "future") {
      const templateId = editingSession!.template_id!;

      // Update the template itself; preserve generated_through (cron handles extension)
      await supabase.from("session_templates").update({
        time_start: data.time_start,
        time_end: data.time_end,
        location_id: data.location_id,
        topics: data.topics,
        session_types: data.session_types,
        description: data.description,
        default_trainer_id: trainer_ids[0] ?? null,
        trainer_ids,
        virtual_trainer_ids,
        is_cancelled: data.is_cancelled,
        color: data.color,
        auto_extend,
      }).eq("id", templateId);

      // Find future week IDs (current week onwards)
      const { data: futureWeeks } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("club_id", club.id)
        .gte("week_start", weekStart);
      const futureWeekIds = (futureWeeks ?? []).map((w) => w.id);

      if (futureWeekIds.length > 0) {
        // Get future unmodified session IDs for bulk trainer update
        const { data: futureSessions } = await supabase
          .from("training_sessions")
          .select("id")
          .eq("template_id", templateId)
          .eq("is_modified", false)
          .in("week_id", futureWeekIds);

        const futureIds = (futureSessions ?? []).map((s) => s.id);

        // Bulk update sessions
        await supabase.from("training_sessions")
          .update(sessionFields)
          .eq("template_id", templateId)
          .eq("is_modified", false)
          .in("week_id", futureWeekIds);

        // Replace session_trainers for all affected sessions
        if (futureIds.length > 0) {
          await supabase.from("session_trainers").delete().in("session_id", futureIds);
          const trainerRows = futureIds.flatMap((sid) => [
            ...trainer_ids.map((uid) => ({ session_id: sid, user_id: uid, virtual_trainer_id: null })),
            ...virtual_trainer_ids.map((vid) => ({ session_id: sid, user_id: null, virtual_trainer_id: vid })),
          ]);
          if (trainerRows.length > 0) {
            await supabase.from("session_trainers").insert(trainerRows);
          }

          // Replace session_expected_groups for all affected sessions
          await supabase.from("session_expected_groups").delete().in("session_id", futureIds);
          if (expected_group_ids.length > 0) {
            const groupRows = futureIds.flatMap((sid) =>
              expected_group_ids.map((gid) => ({ session_id: sid, group_id: gid }))
            );
            await supabase.from("session_expected_groups").insert(groupRows);
          }
        }
      }

      toast.success("Alle zukünftigen Sitzungen aktualisiert.");
    }

    setEditingSession(null);
    setHasChanges(true);
    startTransition(() => router.refresh());
  }

  function requestDelete(session: TrainingSession) {
    setDeleteScope("single");
    setDeleteTarget({ sessionId: session.id, templateId: session.template_id ?? null });
  }

  async function executeDelete() {
    if (!deleteTarget) return;
    suppressRealtimeRef.current = true;
    const { sessionId, templateId } = deleteTarget;
    const supabase = createClient();

    if (deleteScope === "future" && templateId) {
      // Delete all future unmodified sessions with this template
      const { data: futureWeeks } = await supabase
        .from("training_weeks")
        .select("id")
        .eq("club_id", club.id)
        .gte("week_start", weekStart);
      const futureWeekIds = (futureWeeks ?? []).map((w) => w.id);

      if (futureWeekIds.length > 0) {
        await supabase.from("training_sessions")
          .delete()
          .eq("template_id", templateId)
          .in("week_id", futureWeekIds);
      }
      // Delete the template itself (ON DELETE SET NULL keeps past sessions intact)
      await supabase.from("session_templates").delete().eq("id", templateId);

      toast.success("Alle zukünftigen Sitzungen gelöscht.");
    } else {
      const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
      if (error) { toast.error(error.message); return; }
      toast.success("Sitzung gelöscht.");
    }

    setWeek((w) =>
      w ? { ...w, training_sessions: (w.training_sessions ?? []).filter((s) => s.id !== sessionId) } : w
    );
    setHasChanges(true);
    setDeleteTarget(null);
  }

  // Month view: clicking a day navigates to that week and opens day drill-down
  function handleMonthDayClick(d: Date) {
    const dow = d.getDay();
    const daysBack = dow === 0 ? 6 : dow - 1;
    const monday = new Date(d);
    monday.setDate(d.getDate() - daysBack);
    const mondayIso = toISODate(monday);
    const dayIndex  = dow === 0 ? 6 : dow - 1; // 0=Mon ... 6=Sun

    setView("week");
    setSelectedDay(dayIndex);
    if (mondayIso !== weekStart) {
      router.push(`?woche=${mondayIso}`);
    }
  }

  return (
    <div className="relative">
      {/* ── Refresh progress bar ─────────────────────────── */}
      <div
        className={`absolute -top-2 left-0 right-0 h-0.5 bg-primary/20 rounded-full overflow-hidden transition-opacity duration-300 ${isRefreshing ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      >
        <div className="h-full w-1/3 bg-primary rounded-full animate-progress" />
      </div>

      {/* ── Remote changes banner ─────────────────────────── */}
      {hasRemoteChanges && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/8 px-4 py-3"
        >
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          <p className="text-sm font-medium flex-1">Plan wurde von jemand anderem aktualisiert.</p>
          <button
            onClick={() => { setHasRemoteChanges(false); startTransition(() => router.refresh()); }}
            className="text-xs font-semibold text-primary hover:opacity-75 transition-opacity whitespace-nowrap"
          >
            Neu laden →
          </button>
          <button
            onClick={() => setHasRemoteChanges(false)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Schließen"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </motion.div>
      )}

      {/* ── Navigation header ─────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => navigate(-1)} className="h-9 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="hidden sm:inline">Vorwoche</span>
          </button>

          <div className="flex-1 text-center">
            <p className="font-semibold text-sm sm:text-base leading-tight">{formatWeekRange(weekStart)}</p>
            {currentWeek && <p className="text-xs text-primary font-medium">Aktuelle Woche</p>}
          </div>

          {!currentWeek && (
            <button onClick={goToToday} className="h-9 px-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
              Heute
            </button>
          )}

          <button onClick={() => navigate(1)} className="h-9 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1">
            <span className="hidden sm:inline">Nächste Woche</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        {canEdit && (
          <div className="flex gap-2 flex-wrap items-center">
            {/* "Vorwoche kopieren" hidden — re-enable by uncommenting if needed.
                Handler: handleCopyFromLastWeek(), API route: /api/copy-week
            <button onClick={handleCopyFromLastWeek} className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors">
              Vorwoche kopieren
            </button>
            */}
            {week && isAdmin && (
              <>
                {/* On mobile these two buttons span the full toolbar width side-by-side;
                    on sm+ they shrink back to auto-sized inline buttons. */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setPublishModalOpen(true)}
                    className={`flex-1 sm:flex-none h-8 px-3 rounded-lg text-xs font-medium transition-colors inline-flex items-center justify-center gap-1.5 ${
                      week.is_published
                        ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/25 hover:bg-green-500/20"
                        : "bg-primary text-primary-foreground hover:opacity-90 font-semibold"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${week.is_published ? "bg-green-500" : "bg-primary-foreground/60"}`} />
                    {week.is_published ? "Veröffentlicht" : "Entwurf"}
                    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 shrink-0">
                      <path d="M2 4l4 4 4-4"/>
                    </svg>
                  </button>

                  <Link
                    href={`/verein/${club.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    Öffentliche Ansicht
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                  </Link>
                </div>

                <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen}>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                        {week.is_published ? "Unveröffentlichen" : "Veröffentlichen"}
                      </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground -mt-1">
                      {week.is_published
                        ? "Welche Wochen sollen versteckt werden?"
                        : "Welche Wochen sollen veröffentlicht werden?"}
                    </p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        onClick={() => { setPublishModalOpen(false); togglePublish("single"); }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors"
                      >
                        <p className="text-sm font-semibold">Nur diese Woche</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatWeekRange(weekStart)}</p>
                      </button>
                      <button
                        onClick={() => { setPublishModalOpen(false); togglePublish("month"); }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors"
                      >
                        <p className="text-sm font-semibold">Diesen Monat</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {MONTH_NAMES[Number(weekStart.split("-")[1]) - 1]} {weekStart.split("-")[0]}
                        </p>
                      </button>
                      <button
                        onClick={() => { setPublishModalOpen(false); togglePublish("all"); }}
                        className="w-full text-left px-4 py-3 rounded-xl border border-border hover:bg-secondary transition-colors"
                      >
                        <p className="text-sm font-semibold">Alle Wochen</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Gesamter Trainingsplan</p>
                      </button>
                    </div>
                    <button
                      onClick={() => setPublishModalOpen(false)}
                      className="w-full h-9 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors mt-1"
                    >
                      Abbrechen
                    </button>
                  </DialogContent>
                </Dialog>
              </>
            )}
            {hasChanges && (
              <button onClick={handleDiscardChanges} className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                Änderungen verwerfen
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── View tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {(["week", "month"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => { setView(v); if (v !== "week") setSelectedDay(null); }}
            className={`pb-2.5 px-1 mr-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
              view === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v === "week" ? "Wochenplan" : "Monatsansicht"}
          </button>
        ))}
      </div>

      {/* ── Month view ─────────────────────────────────────── */}
      {view === "month" && (
        <MonthView
          clubId={club.id}
          initialMonthDate={new Date(weekStart + "T00:00:00")}
          onDayClick={handleMonthDayClick}
        />
      )}


      {/* ── Week view ──────────────────────────────────────── */}
      {view === "week" && (
        <>
          {/* Day timetable drill-down */}
          {selectedDay !== null ? (
            <DayTimetable
              dayIndex={selectedDay}
              weekStart={weekStart}
              sessions={sessions}
              trainers={trainers}
              virtualTrainers={virtualTrainers}
              canEdit={canEdit}
              onEdit={(s) => setEditingSession(s)}
              onDelete={requestDelete}
              onNewSession={openNewSession}
              onBack={() => setSelectedDay(null)}
              onAttendance={(s) => setAttendanceSession(s)}
            />
          ) : (
            <>
              {/* Mobile: vertical list */}
              <div className="flex flex-col gap-4 md:hidden">
                {DAY_NAMES.map((dayName, dayIndex) => {
                  const daySessions = getSessionsForDay(dayIndex);
                  const isToday     = dayIndex === todayIdx && currentWeek;
                  if (!canEdit && daySessions.length === 0) return null;
                  return (
                    <motion.div key={dayIndex} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: dayIndex * 0.03 }}>
                      <div className={`rounded-xl border overflow-hidden ${isToday ? "border-primary/30" : "border-border"}`}>
                        <div className={`flex items-center ${isToday ? "bg-primary/8" : "bg-secondary/40"}`}>
                          {/* Full-width tappable row → drill-down */}
                          <button
                            onClick={() => setSelectedDay(dayIndex)}
                            className={`flex-1 flex items-center justify-between px-3 py-2.5 group/dayrow transition-colors hover:bg-black/5 active:bg-black/10`}
                          >
                            <span className={`flex items-baseline gap-2 text-xs font-semibold uppercase tracking-widest transition-colors ${isToday ? "text-primary" : "text-muted-foreground"} group-hover/dayrow:text-primary`}>
                              {dayName}
                              <span className="font-mono font-normal tracking-normal normal-case opacity-70 text-[10px]">
                                {weekDayDate(weekStart, dayIndex)}
                              </span>
                              {isToday && <span className="text-[10px] font-medium tracking-normal normal-case">Heute</span>}
                            </span>
                            {/* Chevron — universal "tap to expand" signal */}
                            <svg
                              width="12" height="12" viewBox="0 0 16 16" fill="none"
                              className={`shrink-0 transition-colors ${isToday ? "text-primary/50" : "text-muted-foreground/35"} group-hover/dayrow:text-primary/70`}
                            >
                              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          {/* + Hinzufügen separated so it doesn't trigger drill-down */}
                          {canEdit && (
                            <button
                              onClick={() => openNewSession(dayIndex)}
                              className="h-full px-3 border-l border-border/50 text-xs text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors font-medium shrink-0"
                            >
                              + Hinzufügen
                            </button>
                          )}
                        </div>
                        <div className="p-2 space-y-2">
                          {daySessions.length === 0 ? (
                            <p className="text-xs text-muted-foreground/50 py-1 px-1">Kein Training</p>
                          ) : (
                            daySessions.map((session) => (
                              <SessionCard key={session.id} session={session} trainers={trainers} virtualTrainers={virtualTrainers} canEdit={canEdit} isToday={isToday} attendanceSummary={attendanceSummaries.get(session.id)} onEdit={() => setEditingSession(session)} onDelete={() => requestDelete(session)} onAttendance={() => setAttendanceSession(session)} />
                            ))
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Desktop: 7-column grid */}
              <div className="hidden md:grid grid-cols-7 gap-2">
                {DAY_NAMES.map((dayName, dayIndex) => {
                  const daySessions = getSessionsForDay(dayIndex);
                  const isToday     = dayIndex === todayIdx && currentWeek;
                  return (
                    <div key={dayIndex} className="min-h-[180px] flex flex-col">
                      {/* Clickable day header → drill-down */}
                      <button
                        onClick={() => setSelectedDay(dayIndex)}
                        className={`relative text-xs font-semibold text-center py-2 mb-2 rounded-lg uppercase tracking-widest w-full transition-all hover:bg-primary/10 hover:text-primary active:scale-95 group/daycol ${
                          isToday ? "bg-primary/10 text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {dayName.slice(0,2)}
                        <span className="block text-[10px] font-mono font-normal tracking-normal normal-case opacity-60 -mt-0.5">
                          {weekDayDate(weekStart, dayIndex)}
                        </span>
                        {isToday && <span className="block text-[9px] font-medium tracking-normal normal-case text-primary -mt-0.5">Heute</span>}
                        <span className="block text-[9px] font-normal tracking-normal normal-case opacity-35 group-hover/daycol:opacity-70 transition-opacity mt-0.5">
                          Tagesansicht
                        </span>
                      </button>
                      <div className="flex-1 space-y-2">
                        {daySessions.map((session) => (
                          <SessionCard key={session.id} session={session} trainers={trainers} virtualTrainers={virtualTrainers} canEdit={canEdit} isToday={isToday} attendanceSummary={attendanceSummaries.get(session.id)} onEdit={() => setEditingSession(session)} onDelete={() => requestDelete(session)} onAttendance={() => setAttendanceSession(session)} />
                        ))}
                        {canEdit && (
                          <button onClick={() => openNewSession(dayIndex)} className="w-full text-xs text-muted-foreground/50 border border-dashed border-border rounded-xl py-2 hover:border-primary/40 hover:text-primary transition-colors">
                            +
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {sessions.length === 0 && !canEdit && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="font-semibold text-base mb-1">Keine Trainingseinheiten</p>
                  <p className="text-sm text-muted-foreground">Diese Woche ist noch kein Training geplant.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Edit Modal ─────────────────────────────────────── */}
      {editingSession !== null && (
        <SessionEditModal
          session={editingSession === "new" ? null : editingSession}
          defaultDay={editingSession === "new" ? newSessionDay : editingSession.day_of_week}
          locations={locations}
          trainers={trainers}
          virtualTrainers={virtualTrainers}
          topics={topics}
          sessionTypes={sessionTypes}
          teilnehmerGroups={teilnehmerGroups}
          groupMemberCounts={groupMemberCounts}
          onSave={handleSaveSession}
          onClose={() => setEditingSession(null)}
        />
      )}

      {/* ── Attendance Modal ───────────────────────────────── */}
      {attendanceSession && (
        <AttendanceModal
          session={attendanceSession}
          clubId={club.id}
          canEdit={canEdit}
          onClose={() => { setAttendanceSession(null); setAttendanceSummaryRevision((r) => r + 1); }}
        />
      )}

      {/* ── Delete confirm dialog ──────────────────────────── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Sitzung löschen?"
        confirmLabel="Löschen"
        destructive
        onConfirm={executeDelete}
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget?.templateId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Diese Sitzung ist Teil einer wöchentlichen Wiederholung. Was soll gelöscht werden?
            </p>
            <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
              {(["single", "future"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setDeleteScope(opt)}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    deleteScope === opt
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt === "single" ? "Nur diese Woche" : "Diese & alle zukünftigen"}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Diese Trainingseinheit wird endgültig gelöscht.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
