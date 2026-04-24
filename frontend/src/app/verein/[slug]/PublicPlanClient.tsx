"use client";

import { useState, useMemo } from "react";
import { formatTime } from "@/lib/utils/date";
import type { SessionColor } from "@/types";
import { SESSION_COLORS } from "@/types";

// ── Types ─────────────────────────────────────────────────────

export type TrainerInfo = {
  name: string;
  avatarUrl: string | null;
  isGuest: boolean;
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
  trainerNames: string[];   // for filter logic
  trainers: TrainerInfo[];  // for display (with avatars)
  color: string | null;
};

export type FilterOptions = {
  types: string[];
  topics: string[];
  trainers: string[];
  locations: string[];
};

// ── Helpers ───────────────────────────────────────────────────

const MONTH_NAMES = ["Jänner","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DAY_SHORT   = ["Mo","Di","Mi","Do","Fr","Sa","So"];

function toISODate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(toISODate(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// ── Sub-components ────────────────────────────────────────────

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

function SessionRow({ s }: { s: PublicSession }) {
  const cancelled = s.isCancelled;
  const colorKey = (s.color ?? "neutral") as SessionColor;
  const colorCfg = SESSION_COLORS[colorKey] ?? SESSION_COLORS.neutral;
  const hasColor = colorKey !== "neutral" && !cancelled;
  return (
    <div className={`flex items-stretch transition-colors ${cancelled ? "bg-destructive/3" : "hover:bg-secondary/20"}`}>
      {/* Color accent bar */}
      <div
        className="w-1 shrink-0 rounded-l-sm"
        style={{ backgroundColor: hasColor ? colorCfg.border : "transparent" }}
      />
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
          {s.sessionTypes.map((t) => (
            <span key={t} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cancelled ? "bg-muted/40 text-muted-foreground/50 border-border/50 line-through" : "bg-primary/10 text-primary border-primary/20"}`}>{t}</span>
          ))}
          {s.topics.map((t) => (
            <span key={t} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${cancelled ? "bg-muted/40 text-muted-foreground/50 line-through" : "bg-secondary text-secondary-foreground"}`}>{t}</span>
          ))}
          {!cancelled && s.sessionTypes.length === 0 && s.topics.length === 0 && (
            <span className="text-xs text-muted-foreground">Training</span>
          )}
        </div>
        {!cancelled && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {s.location && (
              <span className="flex items-center gap-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {s.location.mapsUrl
                  ? <a href={s.location.mapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.location.name}</a>
                  : s.location.name}
              </span>
            )}
            {s.trainers.length > 0 && (
              <span className="flex flex-wrap items-center gap-1.5">
                {s.trainers.map((t) => (
                  <span key={t.name} className={`inline-flex items-center gap-1 ${t.isGuest ? "text-amber-700 dark:text-amber-400" : ""}`}>
                    {t.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.avatarUrl} alt={t.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                        t.isGuest
                          ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400"
                          : "bg-primary/15 text-primary"
                      }`}>
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
      </div>
      </div>
    </div>
  );
}

// ── Calendar view ─────────────────────────────────────────────

function CalendarView({ sessions }: { sessions: PublicSession[] }) {
  const today = new Date();
  const todayKey = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const [calYear, setCalYear]   = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, PublicSession[]>();
    for (const s of sessions) {
      const list = map.get(s.dateKey) ?? [];
      list.push(s);
      map.set(s.dateKey, list);
    }
    return map;
  }, [sessions]);

  const grid = useMemo(() => getCalendarGrid(calYear, calMonth), [calYear, calMonth]);

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
    setSelectedDay(null);
  }

  const selectedSessions = selectedDay ? (sessionsByDate.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <button type="button" onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <p className="text-sm font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            {MONTH_NAMES[calMonth]} {calYear}
          </p>
          <button type="button" onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_SHORT.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 p-2 gap-1">
          {grid.map((dateKey, i) => {
            if (!dateKey) return <div key={i} />;
            const daySessions = sessionsByDate.get(dateKey) ?? [];
            const hasAny      = daySessions.length > 0;
            const isToday     = dateKey === todayKey;
            const isPast      = dateKey < todayKey;
            const isSelected  = dateKey === selectedDay;
            const dayNum      = parseInt(dateKey.split("-")[2]);
            const nonCancelled = daySessions.filter(s => !s.isCancelled);
            const hasCancelled = daySessions.some(s => s.isCancelled);

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                disabled={!hasAny}
                className={`
                  relative flex flex-col items-center justify-start pt-2 pb-2 rounded-xl min-h-[52px] transition-colors
                  ${isSelected ? "bg-primary text-primary-foreground" : ""}
                  ${!isSelected && isToday ? "ring-1 ring-primary ring-inset" : ""}
                  ${!isSelected && hasAny && !isPast ? "hover:bg-secondary/70 cursor-pointer" : ""}
                  ${isPast ? "opacity-40" : ""}
                  ${!hasAny ? "cursor-default" : ""}
                `}
              >
                <span className={`text-xs font-semibold leading-none ${isToday && !isSelected ? "text-primary" : ""}`}>
                  {dayNum}
                </span>
                {hasAny && (
                  <div className="flex gap-0.5 mt-1.5 flex-wrap justify-center px-1">
                    {nonCancelled.slice(0, 3).map((_, di) => (
                      <span key={di} className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`} />
                    ))}
                    {hasCancelled && (
                      <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-primary-foreground/50" : "bg-destructive/60"}`} />
                    )}
                    {nonCancelled.length > 3 && (
                      <span className={`text-[8px] font-bold leading-none ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                        +{nonCancelled.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day sessions */}
      {selectedDay && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {selectedSessions[0]?.shortLabel ?? selectedDay}
            </p>
          </div>
          {selectedSessions.length > 0
            ? <div className="divide-y divide-border">{selectedSessions.map(s => <SessionRow key={s.id} s={s} />)}</div>
            : <p className="px-5 py-4 text-sm text-muted-foreground">Kein Training an diesem Tag.</p>
          }
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-1">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary" /> Training
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-destructive/60" /> Abgesagt
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function PublicPlanClient({
  sessions,
  filterOptions,
}: {
  sessions: PublicSession[];
  filterOptions: FilterOptions;
}) {
  const [viewMode, setViewMode]       = useState<"list" | "calendar">("list");
  const [filterOpen, setFilterOpen]   = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
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
      if (activeTypes.size > 0    && !s.sessionTypes.some((t) => activeTypes.has(t)))   return false;
      if (activeTopics.size > 0   && !s.topics.some((t) => activeTopics.has(t)))        return false;
      if (activeTrainers.size > 0 && !s.trainerNames.some((t) => activeTrainers.has(t))) return false;
      if (activeLocations.size > 0 && !(s.location && activeLocations.has(s.location.name))) return false;
      return true;
    });
  }, [sessions, activeTypes, activeTopics, activeTrainers, activeLocations, activeCount]);

  const next            = filtered.find((s) => !s.isCancelled) ?? null;
  const nextConcurrent  = next
    ? filtered.filter((s) => !s.isCancelled && s.dateKey === next.dateKey && s.timeStart === next.timeStart)
    : [];
  const nextIds         = new Set(nextConcurrent.map((s) => s.id));
  const upcoming        = filtered.filter((s) => !nextIds.has(s.id));

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

      {/* ── Toolbar: filter + view toggle ───────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Filter button */}
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
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-1.5 px-3 h-9 text-xs font-medium transition-colors ${
              viewMode === "calendar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Kalender
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

      {/* ── Calendar view ────────────────────────────────────── */}
      {viewMode === "calendar" && <CalendarView sessions={filtered} />}

      {/* ── List view ────────────────────────────────────────── */}
      {viewMode === "list" && (
        <div className="space-y-10">
          {/* Next training */}
          {next ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
                Nächstes Training{nextConcurrent.length > 1 && <span className="ml-2 font-normal normal-case tracking-normal text-primary/60">· {nextConcurrent.length} gleichzeitig</span>}
              </p>
              <div className="rounded-2xl border border-primary/25 bg-primary/5 p-7">
                {/* Shared date + start time */}
                <p className="text-xs font-semibold uppercase tracking-widest text-primary/70 mb-1">{next.fullLabel}</p>
                <p className="font-mono font-medium text-sm text-foreground mb-5">{formatTime(next.timeStart)}</p>

                <div className={nextConcurrent.length > 1 ? "space-y-5 divide-y divide-primary/15" : ""}>
                  {nextConcurrent.map((s, i) => (
                    <div key={s.id} className={i > 0 ? "pt-5" : ""}>
                      <p className={`font-bold leading-tight mb-2 ${nextConcurrent.length > 1 ? "text-lg" : "text-2xl mb-3"}`} style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                        {[...s.sessionTypes, ...s.topics].join(" · ") || "Training"}
                      </p>
                      {(s.sessionTypes.length > 0 || s.topics.length > 0) && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {s.sessionTypes.map((t) => <span key={t} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/20">{t}</span>)}
                          {s.topics.map((t) => <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground">{t}</span>)}
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
                              <span key={t.name} className={`inline-flex items-center gap-1 ${t.isGuest ? "text-amber-700 dark:text-amber-400" : ""}`}>
                                {t.avatarUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={t.avatarUrl} alt={t.name} className="w-4 h-4 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 ${
                                    t.isGuest ? "bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400" : "bg-primary/15 text-primary"
                                  }`}>
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
                  ))}
                </div>
              </div>
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

          {/* Upcoming timetable */}
          {grouped.size > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Kommende Trainings</p>
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                {[...grouped.entries()].map(([dateKey, items]) => (
                  <div key={dateKey}>
                    <div className="px-5 py-2.5 bg-secondary/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{items[0].shortLabel}</p>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((s) => <SessionRow key={s.id} s={s} />)}
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
