"use client";

import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatTime } from "@/lib/utils/date";
import type { SessionColor } from "@/types";
import { SESSION_COLORS } from "@/types";

// ── Types ─────────────────────────────────────────────────────

export type TrainerInfo = {
  name: string;
  avatarUrl: string | null;
};

export type PublicSession = {
  id: string;
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  timeStart: string;
  timeEnd: string;
  isCancelled: boolean;
  sessionTypes: string[];
  topics: string[];
  description: string | null;
  location: { name: string; mapsUrl: string | null } | null;
  trainerNames: string[];
  trainers: TrainerInfo[];
  color: string | null;
  sortOrder?: number | null;
};

export type FilterOptions = {
  types: string[];
  topics: string[];
  trainers: string[];
  locations: string[];
};

export type ColorMap = Record<string, string | null>;

function resolveColor(colorKey: string | null | undefined) {
  if (!colorKey) return null;
  return SESSION_COLORS[colorKey as SessionColor] ?? null;
}

// ── Day-view helpers ──────────────────────────────────────────

const PX_PER_MIN = 3; // 180px / hour
const MIN_LANE_PX = 130;

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getOverlapLayout(
  sessions: PublicSession[]
): Map<string, { lane: number; totalLanes: number }> {
  const result = new Map<string, { lane: number; totalLanes: number }>();
  if (!sessions.length) return result;

  const sorted = [...sessions].sort((a, b) => {
    const sa = a.sortOrder ?? Infinity;
    const sb = b.sortOrder ?? Infinity;
    if (sa !== sb) return sa - sb;
    return a.timeStart.localeCompare(b.timeStart) || a.timeEnd.localeCompare(b.timeEnd);
  });

  const cols: PublicSession[][] = [];
  const sessionCol = new Map<string, number>();

  for (const s of sorted) {
    let placed = false;
    for (let c = 0; c < cols.length; c++) {
      const last = cols[c][cols[c].length - 1];
      if (last.timeEnd <= s.timeStart) {
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

  for (const s of sorted) {
    const overlapping = sorted.filter(o => o.timeStart < s.timeEnd && o.timeEnd > s.timeStart);
    const totalLanes = Math.max(...overlapping.map(o => (sessionCol.get(o.id) ?? 0))) + 1;
    result.set(s.id, { lane: sessionCol.get(s.id) ?? 0, totalLanes });
  }

  return result;
}

// ── Sub-components ────────────────────────────────────────────

function WeekNoteBanner({ note }: { note: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-amber-50/70 dark:bg-amber-950/25 dark:border-amber-500/20"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-400 to-orange-500" />
      <div className="pl-5 pr-5 py-4 flex gap-3 items-start">
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 bg-amber-100 dark:bg-amber-900/50">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 dark:text-amber-400" stroke="currentColor">
            <path d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 13a3 3 0 0 0 0-6M5.436 13.683A4.001 4.001 0 0 1 7 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 0 1-1.564-.317z"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-700/75 dark:text-amber-400/60 mb-1.5">
            Hinweis der Woche
          </p>
          <p className="text-sm leading-relaxed text-amber-950 dark:text-amber-100 whitespace-pre-wrap">
            {note}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center h-8 px-3.5 rounded-full text-xs font-medium border transition-colors shrink-0 ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function SessionRow({
  s,
  topicColors,
  typeColors,
  onDayClick,
}: {
  s: PublicSession;
  topicColors: ColorMap;
  typeColors: ColorMap;
  onDayClick?: (dateKey: string) => void;
}) {
  const cancelled = s.isCancelled;
  const colorKey = (s.color ?? "neutral") as SessionColor;
  const colorCfg = SESSION_COLORS[colorKey] ?? SESSION_COLORS.neutral;
  const hasColor = colorKey !== "neutral" && !cancelled;
  return (
    <div
      className={`flex items-stretch transition-colors ${cancelled ? "bg-destructive/3" : !hasColor ? "hover:bg-secondary/20" : ""}`}
      style={hasColor ? { backgroundColor: colorCfg.bg } : undefined}
    >
      <div className="w-1.5 shrink-0" style={{ backgroundColor: hasColor ? colorCfg.border : "transparent" }} />
      <div className="flex-1 px-5 py-4 flex items-start gap-4">
        <div className="w-24 shrink-0">
          <p className={`text-xs font-mono ${cancelled ? "text-muted-foreground/50 line-through" : "text-muted-foreground"}`}>
            {formatTime(s.timeStart)} – {formatTime(s.timeEnd)}
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1">
            {cancelled && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 uppercase tracking-wide">Abgesagt</span>
            )}
            {s.topics.map((t) => {
              const cfg = cancelled ? null : resolveColor(topicColors[t]);
              return (
                <span key={t}
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cancelled ? "bg-muted/40 text-muted-foreground/50 border-border/50 line-through" : !cfg ? "bg-primary/10 text-primary border-primary/20" : ""}`}
                  style={cfg ? { backgroundColor: cfg.bg || `${cfg.hex}25`, borderColor: cfg.border || `${cfg.hex}60`, color: cfg.hex } : undefined}
                >{t}</span>
              );
            })}
            {s.sessionTypes.map((t) => {
              const cfg = cancelled ? null : resolveColor(typeColors[t]);
              return (
                <span key={t}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cancelled ? "bg-muted/40 text-muted-foreground/50 line-through border-transparent" : !cfg ? "bg-secondary text-secondary-foreground border-transparent" : ""}`}
                  style={cfg ? { backgroundColor: cfg.bg || `${cfg.hex}20`, borderColor: cfg.border || `${cfg.hex}50`, color: cfg.hex } : undefined}
                >{t}</span>
              );
            })}
            {!cancelled && s.sessionTypes.length === 0 && s.topics.length === 0 && (
              <span className="text-xs text-muted-foreground">Training</span>
            )}
          </div>
          {(s.location || s.trainers.length > 0) && (
            <div className={`flex flex-wrap gap-x-3 gap-y-1 text-xs ${cancelled ? "text-muted-foreground/50 line-through" : "text-muted-foreground"}`}>
              {s.location && (
                <span className="flex items-center gap-0.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  {!cancelled && s.location.mapsUrl
                    ? <a href={s.location.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.location.name}</a>
                    : s.location.name}
                </span>
              )}
              {s.trainers.length > 0 && (
                <span className={`flex flex-wrap items-center gap-1.5 ${cancelled ? "opacity-50" : ""}`}>
                  {s.trainers.map((t) => (
                    <span key={t.name} className="inline-flex items-center gap-1">
                      {t.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.avatarUrl} alt={t.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 bg-primary/15 text-primary">
                          {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      {t.name}
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}
          {s.description && (
            <p className={`text-xs mt-1.5 italic leading-relaxed ${cancelled ? "text-muted-foreground/40 line-through" : "text-muted-foreground"}`}>{s.description}</p>
          )}
        </div>
        {onDayClick && (
          <button
            type="button"
            onClick={() => onDayClick(s.dateKey)}
            className="shrink-0 self-center text-muted-foreground/40 hover:text-primary transition-colors"
            title="Tagesansicht"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Day timetable view ────────────────────────────────────────

function DayView({
  sessions,
  allDates,
  selectedDateKey,
  topicColors,
  typeColors,
  onSelectDate,
}: {
  sessions: PublicSession[];
  allDates: { dateKey: string; label: string; fullLabel: string }[];
  selectedDateKey: string;
  topicColors: ColorMap;
  typeColors: ColorMap;
  onSelectDate: (dateKey: string) => void;
}) {
  const pillsRef = useRef<HTMLDivElement>(null);
  const daySessions = sessions.filter((s) => s.dateKey === selectedDateKey);
  const layout = getOverlapLayout(daySessions);

  const allMins = daySessions.flatMap((s) => [timeToMin(s.timeStart), timeToMin(s.timeEnd)]);
  const rangeStart = allMins.length ? Math.floor(Math.min(...allMins) / 60) * 60 : 8 * 60;
  const rangeEnd   = allMins.length ? Math.ceil(Math.max(...allMins) / 60) * 60   : 22 * 60;
  const gridH      = (rangeEnd - rangeStart) * PX_PER_MIN;

  const hours: number[] = [];
  for (let h = rangeStart / 60; h <= rangeEnd / 60; h++) hours.push(h);

  const maxLanes = Math.max(...Array.from(layout.values()).map((v) => v.totalLanes), 1);
  const sessionAreaMinWidth = maxLanes * MIN_LANE_PX;

  const selected = allDates.find((d) => d.dateKey === selectedDateKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="space-y-4"
    >
      {/* Date pill strip */}
      <div
        ref={pillsRef}
        className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {allDates.map(({ dateKey, label }) => (
          <button
            key={dateKey}
            type="button"
            onClick={() => onSelectDate(dateKey)}
            className={`shrink-0 h-8 px-3.5 rounded-full text-xs font-medium border transition-colors ${
              dateKey === selectedDateKey
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Day title */}
      {selected && (
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-0.5">
          {selected.fullLabel}
        </p>
      )}

      {/* Timetable */}
      {daySessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-border text-center">
          <p className="text-sm font-semibold mb-1">Kein Training</p>
          <p className="text-xs text-muted-foreground">Für diesen Tag ist kein Training geplant.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-card">
          <div className="overflow-x-auto" style={{ overflowY: "clip" }}>
            <div className="flex" style={{ height: Math.max(gridH, 200) }}>
              {/* Time labels — sticky left */}
              <div className="w-12 shrink-0 relative border-r border-border sticky left-0 z-10 bg-card">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute right-2 text-[10px] text-muted-foreground font-mono leading-none"
                    style={{ top: (h * 60 - rangeStart) * PX_PER_MIN - 6 }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Session grid */}
              <div className="relative flex-1" style={{ minWidth: sessionAreaMinWidth }}>
                {/* Hour lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-border/40"
                    style={{ top: (h * 60 - rangeStart) * PX_PER_MIN }}
                  />
                ))}

                {/* Session blocks */}
                {daySessions.map((s) => {
                  const info = layout.get(s.id)!;
                  const top    = (timeToMin(s.timeStart) - rangeStart) * PX_PER_MIN;
                  const height = Math.max((timeToMin(s.timeEnd) - timeToMin(s.timeStart)) * PX_PER_MIN, 40);
                  const pct    = 100 / info.totalLanes;
                  const isOverlapping = info.totalLanes > 1;

                  const colorKey  = (s.color ?? "neutral") as SessionColor;
                  const colorCfg  = SESSION_COLORS[colorKey] ?? SESSION_COLORS.neutral;
                  const hasColor  = colorKey !== "neutral" && !s.isCancelled;

                  return (
                    <div
                      key={s.id}
                      className={`absolute overflow-hidden transition-shadow ${
                        isOverlapping ? "rounded-lg" : "rounded-xl"
                      } border ${
                        s.isCancelled
                          ? "bg-destructive/8 border-destructive/30"
                          : hasColor ? "" : "bg-card border-primary/20 shadow-sm"
                      }`}
                      style={{
                        top,
                        height,
                        width:  `calc(${pct}% - ${isOverlapping ? 6 : 8}px)`,
                        left:   `calc(${info.lane * pct}% + ${isOverlapping ? 3 : 4}px)`,
                        ...(hasColor ? { backgroundColor: colorCfg.bg, borderColor: colorCfg.border } : {}),
                      }}
                    >
                      {/* Left accent for overlapping */}
                      {isOverlapping && !s.isCancelled && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-lg"
                          style={{ backgroundColor: hasColor ? colorCfg.border : "hsl(var(--primary))", opacity: 0.8 }}
                        />
                      )}

                      <div className={`h-full px-2.5 py-2 flex flex-col gap-0.5 ${isOverlapping ? "pl-3" : ""}`}>
                        {s.isCancelled && (
                          <span className="text-[9px] font-bold text-destructive leading-none mb-0.5">Abgesagt</span>
                        )}
                        <p className="text-[10px] font-mono text-muted-foreground leading-none">
                          {formatTime(s.timeStart)}–{formatTime(s.timeEnd)}
                        </p>
                        {(s.topics.length > 0 || s.sessionTypes.length > 0) && height >= 52 && (
                          <div className="flex flex-wrap gap-0.5 mt-0.5">
                            {s.topics.map((t) => {
                              const cfg = s.isCancelled ? null : resolveColor(topicColors[t]);
                              return (
                                <span key={t}
                                  className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${!cfg ? "bg-primary/15 text-primary" : ""}`}
                                  style={cfg ? { backgroundColor: cfg.bg || `${cfg.hex}25`, color: cfg.hex } : undefined}
                                >{t}</span>
                              );
                            })}
                            {s.sessionTypes.map((t) => {
                              const cfg = s.isCancelled ? null : resolveColor(typeColors[t]);
                              return (
                                <span key={t}
                                  className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full leading-none ${!cfg ? "bg-secondary text-secondary-foreground" : ""}`}
                                  style={cfg ? { backgroundColor: cfg.bg || `${cfg.hex}20`, color: cfg.hex } : undefined}
                                >{t}</span>
                              );
                            })}
                          </div>
                        )}
                        {height >= 80 && s.trainers.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {s.trainers.slice(0, 2).map((t) => (
                              <span key={t.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                {t.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={t.avatarUrl} alt={t.name} className="w-3 h-3 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span className="w-3 h-3 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[6px] font-bold shrink-0">
                                    {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                  </span>
                                )}
                                <span className="truncate max-w-[80px]">{t.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {height >= 110 && s.location && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-muted-foreground shrink-0">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span className="text-[9px] text-muted-foreground truncate">{s.location.name}</span>
                          </div>
                        )}
                        {height >= 140 && s.description && (
                          <p className="text-[9px] text-muted-foreground italic mt-0.5 line-clamp-2 leading-relaxed">{s.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function PublicPlanClient({
  sessions,
  filterOptions,
  weekNote,
  topicColors = {},
  typeColors = {},
}: {
  sessions: PublicSession[];
  filterOptions: FilterOptions;
  weekNote?: string | null;
  topicColors?: ColorMap;
  typeColors?: ColorMap;
}) {
  const [viewMode, setViewMode]         = useState<"list" | "day">("list");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [filterOpen, setFilterOpen]     = useState(false);
  const [activeTypes, setActiveTypes]   = useState<Set<string>>(new Set());
  const [activeTopics, setActiveTopics] = useState<Set<string>>(new Set());
  const [activeTrainers, setActiveTrainers] = useState<Set<string>>(new Set());
  const [activeLocations, setActiveLocations] = useState<Set<string>>(new Set());

  const activeCount = activeTypes.size + activeTopics.size + activeTrainers.size + activeLocations.size;
  const hasFilters  = filterOptions.types.length > 0 || filterOptions.topics.length > 0 ||
    filterOptions.trainers.length > 0 || filterOptions.locations.length > 0;

  function toggle(set: Set<string>, setFn: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    setFn(next);
  }

  function clearAll() {
    setActiveTypes(new Set()); setActiveTopics(new Set());
    setActiveTrainers(new Set()); setActiveLocations(new Set());
  }

  const filtered = useMemo(() => {
    if (activeCount === 0) return sessions;
    return sessions.filter((s) => {
      if (activeTypes.size > 0    && !s.sessionTypes.some((t) => activeTypes.has(t)))    return false;
      if (activeTopics.size > 0   && !s.topics.some((t) => activeTopics.has(t)))         return false;
      if (activeTrainers.size > 0 && !s.trainerNames.some((t) => activeTrainers.has(t))) return false;
      if (activeLocations.size > 0 && !(s.location && activeLocations.has(s.location.name))) return false;
      return true;
    });
  }, [sessions, activeTypes, activeTopics, activeTrainers, activeLocations, activeCount]);

  // Unique ordered dates that have sessions
  const allDates = useMemo(() => {
    const seen = new Set<string>();
    const result: { dateKey: string; label: string; fullLabel: string }[] = [];
    for (const s of filtered) {
      if (!seen.has(s.dateKey)) {
        seen.add(s.dateKey);
        result.push({ dateKey: s.dateKey, label: s.shortLabel, fullLabel: s.fullLabel });
      }
    }
    return result;
  }, [filtered]);

  function openDayView(dateKey?: string) {
    const key = dateKey
      ?? filtered.find((s) => !s.isCancelled)?.dateKey
      ?? allDates[0]?.dateKey;
    if (!key) return;
    setSelectedDayKey(key);
    setViewMode("day");
  }

  const activeDayKey = selectedDayKey && allDates.some((d) => d.dateKey === selectedDayKey)
    ? selectedDayKey
    : allDates[0]?.dateKey ?? null;

  const next           = filtered.find((s) => !s.isCancelled) ?? null;
  const nextConcurrent = next
    ? filtered.filter((s) => !s.isCancelled && s.dateKey === next.dateKey && s.timeStart === next.timeStart)
    : [];
  const nextIds  = new Set(nextConcurrent.map((s) => s.id));
  const upcoming = filtered.filter((s) => !nextIds.has(s.id));

  const grouped = useMemo(() => {
    const map = new Map<string, PublicSession[]>();
    for (const s of upcoming) {
      const list = map.get(s.dateKey) ?? [];
      list.push(s);
      map.set(s.dateKey, list);
    }
    return map;
  }, [upcoming]);

  return (
    <main className="container max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Week note banner ─────────────────────────────────── */}
      <AnimatePresence>
        {weekNote && <WeekNoteBanner note={weekNote} />}
      </AnimatePresence>

      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasFilters && (
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-xl border text-sm font-medium transition-colors ${
              filterOpen || activeCount > 0
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            Filter
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </button>
        )}

        {activeCount > 0 && (
          <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Alle löschen
          </button>
        )}

        <div className="ml-auto flex items-center rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 h-9 text-xs font-medium transition-colors ${
              viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Liste
          </button>
          <div className="w-px h-5 bg-border" />
          <button
            type="button"
            onClick={() => openDayView()}
            className={`flex items-center gap-1.5 px-3 h-9 text-xs font-medium transition-colors ${
              viewMode === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Tagesplan
          </button>
        </div>
      </div>

      {/* ── Filter panel ────────────────────────────────────── */}
      {hasFilters && filterOpen && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4 -mt-2">
          {filterOptions.types.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Trainingstyp</p>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.types.map((t) => <Chip key={t} label={t} active={activeTypes.has(t)} onClick={() => toggle(activeTypes, setActiveTypes, t)} />)}
              </div>
            </div>
          )}
          {filterOptions.topics.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Thema</p>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.topics.map((t) => <Chip key={t} label={t} active={activeTopics.has(t)} onClick={() => toggle(activeTopics, setActiveTopics, t)} />)}
              </div>
            </div>
          )}
          {filterOptions.trainers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Trainer</p>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.trainers.map((t) => <Chip key={t} label={t} active={activeTrainers.has(t)} onClick={() => toggle(activeTrainers, setActiveTrainers, t)} />)}
              </div>
            </div>
          )}
          {filterOptions.locations.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Standort</p>
              <div className="flex flex-wrap gap-1.5">
                {filterOptions.locations.map((t) => <Chip key={t} label={t} active={activeLocations.has(t)} onClick={() => toggle(activeLocations, setActiveLocations, t)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Day view ─────────────────────────────────────────── */}
      {viewMode === "day" && activeDayKey && (
        <DayView
          sessions={filtered}
          allDates={allDates}
          selectedDateKey={activeDayKey}
          topicColors={topicColors}
          typeColors={typeColors}
          onSelectDate={setSelectedDayKey}
        />
      )}

      {/* ── List view ────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="space-y-10">
          {/* Next training */}
          {next ? (
            <section>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  Nächstes Training{nextConcurrent.length > 1 && <span className="ml-2 font-normal normal-case tracking-normal text-primary/60">· {nextConcurrent.length} gleichzeitig</span>}
                </p>
                <button
                  type="button"
                  onClick={() => openDayView(next.dateKey)}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  Tagesplan
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
              {(() => {
                const singleColor = nextConcurrent.length === 1
                  ? (SESSION_COLORS[(next.color ?? "neutral") as SessionColor] ?? SESSION_COLORS.neutral)
                  : null;
                const singleHasColor = singleColor && (next.color ?? "neutral") !== "neutral";
                return (
                  <div
                    className={`rounded-2xl border p-7 ${singleHasColor ? "" : "border-primary/25 bg-primary/5"}`}
                    style={singleHasColor ? { backgroundColor: singleColor!.bg, borderColor: singleColor!.border } : undefined}
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{next.fullLabel}</p>
                    <p className="font-mono font-medium text-sm text-foreground mb-5">{formatTime(next.timeStart)}</p>

                    <div className={nextConcurrent.length > 1 ? "space-y-5 divide-y divide-border/60" : ""}>
                      {nextConcurrent.map((s, i) => {
                        const ck = (s.color ?? "neutral") as SessionColor;
                        const cc = SESSION_COLORS[ck] ?? SESSION_COLORS.neutral;
                        const hc = ck !== "neutral" && nextConcurrent.length > 1;
                        return (
                          <div
                            key={s.id}
                            className={`${i > 0 ? "pt-5" : ""} ${hc ? "rounded-xl px-3 py-3 -mx-3" : ""}`}
                            style={hc ? { backgroundColor: cc.bg, borderLeft: `3px solid ${cc.border}`, paddingLeft: "12px" } : undefined}
                          >
                            <p className={`font-bold leading-tight mb-2 ${nextConcurrent.length > 1 ? "text-lg" : "text-2xl mb-3"}`} style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                              {[...s.topics, ...s.sessionTypes].join(" · ") || "Training"}
                            </p>
                            {s.topics.length > 0 && s.sessionTypes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {s.topics.map((t) => {
                                  const cfg = resolveColor(topicColors[t]);
                                  return (
                                    <span key={t}
                                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${!cfg ? "bg-primary/15 text-primary border-primary/20" : ""}`}
                                      style={cfg ? { backgroundColor: cfg.bg || `${cfg.hex}25`, borderColor: cfg.border || `${cfg.hex}60`, color: cfg.hex } : undefined}
                                    >{t}</span>
                                  );
                                })}
                                {s.sessionTypes.map((t) => {
                                  const cfg = resolveColor(typeColors[t]);
                                  return (
                                    <span key={t}
                                      className={`text-xs font-medium px-2.5 py-1 rounded-full border ${!cfg ? "bg-secondary text-secondary-foreground border-transparent" : ""}`}
                                      style={cfg ? { backgroundColor: cfg.bg || `${cfg.hex}20`, borderColor: cfg.border || `${cfg.hex}50`, color: cfg.hex } : undefined}
                                    >{t}</span>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                              <span className="font-mono text-muted-foreground">– {formatTime(s.timeEnd)}</span>
                              {s.location && (
                                <span className="flex items-center gap-1">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  {s.location.mapsUrl
                                    ? <a href={s.location.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.location.name}</a>
                                    : s.location.name}
                                </span>
                              )}
                              {s.trainers.length > 0 && (
                                <span className="flex flex-wrap items-center gap-1.5">
                                  {s.trainers.map((t) => (
                                    <span key={t.name} className="inline-flex items-center gap-1">
                                      {t.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={t.avatarUrl} alt={t.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
                                      ) : (
                                        <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 bg-primary/15 text-primary">
                                          {t.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                        </span>
                                      )}
                                      {t.name}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                            {s.description && <p className="text-sm text-muted-foreground mt-3 italic">{s.description}</p>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </section>
          ) : (
            <div className="text-center py-16">
              <p className="font-semibold text-base mb-1">
                {activeCount > 0 ? "Kein Training für diese Filter" : "Kein bevorstehendes Training"}
              </p>
              <p className="text-sm text-muted-foreground">
                {activeCount > 0 ? "Versuche andere Filter oder lösche alle Filter." : "In den nächsten Wochen ist kein Training geplant."}
              </p>
              {activeCount > 0 && (
                <button type="button" onClick={clearAll} className="mt-4 text-sm text-primary hover:underline">Filter löschen</button>
              )}
            </div>
          )}

          {/* Upcoming sessions grouped by day */}
          {grouped.size > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Kommende Trainings</p>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                {[...grouped.entries()].map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <button
                      type="button"
                      onClick={() => openDayView(dateKey)}
                      className="w-full px-5 py-2.5 bg-secondary/30 hover:bg-secondary/60 transition-colors flex items-center justify-between group"
                    >
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {items[0].shortLabel}
                      </p>
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="text-muted-foreground/30 group-hover:text-primary/60 transition-colors"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </button>
                    <div className="divide-y divide-border">
                      {items.map((s) => <SessionRow key={s.id} s={s} topicColors={topicColors} typeColors={typeColors} onDayClick={openDayView} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
