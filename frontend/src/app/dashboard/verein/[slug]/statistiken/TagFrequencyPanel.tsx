"use client";

import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, Clock } from "lucide-react";

export type TagStat = {
  name: string;
  color: string | null;
  count: number;
  /** ISO date of the most recent training that included this tag, or null. */
  lastISO: string | null;
};

type SortMode = "frequency" | "staleness";

/**
 * Days between two ISO dates (YYYY-MM-DD), ignoring intra-day. Positive
 * when `laterISO` is after `earlierISO`.
 */
function daysBetween(earlierISO: string, laterMs: number): number {
  const earlier = new Date(earlierISO).getTime();
  return Math.max(0, Math.floor((laterMs - earlier) / (24 * 60 * 60 * 1000)));
}

function agoLabel(iso: string | null, nowMs: number): string {
  if (!iso) return "nie";
  const days = daysBetween(iso, nowMs);
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  if (days < 14) return "vor 1 Woche";
  if (days < 30) return `vor ${Math.floor(days / 7)} Wochen`;
  if (days < 60) return "vor 1 Monat";
  return `vor ${Math.floor(days / 30)} Monaten`;
}

function TagRow({
  stat,
  maxCount,
  nowMs,
}: {
  stat: TagStat;
  maxCount: number;
  nowMs: number;
}) {
  const isNever = stat.count === 0;
  const daysSince = stat.lastISO ? daysBetween(stat.lastISO, nowMs) : Infinity;
  const isStale = !isNever && daysSince >= 21;
  const dot = stat.color ?? "var(--muted-foreground)";
  const barPct = maxCount > 0 ? Math.max(4, (stat.count / maxCount) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-3 py-1.5 px-1 rounded-md transition-colors ${
        isStale ? "bg-amber-500/[0.04]" : "hover:bg-secondary/40"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${isNever ? "opacity-30" : ""}`}
        style={{ backgroundColor: dot }}
      />
      <span
        className={`text-sm shrink-0 min-w-0 truncate max-w-[10rem] ${
          isNever ? "text-muted-foreground/50 italic" : "text-foreground"
        }`}
        title={stat.name}
      >
        {stat.name}
      </span>
      <div className="flex-1 min-w-0">
        {!isNever && (
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full"
              style={{ width: `${barPct}%` }}
            />
          </div>
        )}
      </div>
      <span
        className={`text-xs tabular-nums w-8 text-right shrink-0 ${
          isNever ? "text-muted-foreground/40" : "text-foreground font-medium"
        }`}
      >
        {isNever ? "—" : stat.count}
      </span>
      <span
        className={`text-[11px] tabular-nums w-24 text-right shrink-0 ${
          isNever
            ? "text-muted-foreground/40 italic"
            : isStale
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
        }`}
      >
        {agoLabel(stat.lastISO, nowMs)}
      </span>
    </div>
  );
}

function TagList({
  title,
  stats,
  sortMode,
  nowMs,
}: {
  title: string;
  stats: TagStat[];
  sortMode: SortMode;
  nowMs: number;
}) {
  const sorted = useMemo(() => {
    const trained = stats.filter((s) => s.count > 0);
    const never   = stats.filter((s) => s.count === 0);
    if (sortMode === "frequency") {
      trained.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    } else {
      // staleness: oldest lastISO first
      trained.sort((a, b) => {
        const ai = a.lastISO ?? "";
        const bi = b.lastISO ?? "";
        return ai.localeCompare(bi) || a.name.localeCompare(b.name);
      });
    }
    never.sort((a, b) => a.name.localeCompare(b.name));
    return [...trained, ...never];
  }, [stats, sortMode]);

  const maxCount = sorted.reduce((m, s) => Math.max(m, s.count), 0);
  const trainedCount = sorted.filter((s) => s.count > 0).length;

  if (sorted.length === 0) {
    return (
      <div>
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Noch keine Einträge im ausgewählten Zeitraum.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </p>
        <span className="text-[10px] font-semibold text-muted-foreground/60 tabular-nums">
          {trainedCount}
        </span>
      </div>
      <div className="space-y-0.5">
        {sorted.map((s) => (
          <TagRow key={s.name} stat={s} maxCount={maxCount} nowMs={nowMs} />
        ))}
      </div>
    </div>
  );
}

export function TagFrequencyPanel({
  topics,
  types,
  nowMs,
}: {
  topics: TagStat[];
  types: TagStat[];
  nowMs: number;
}) {
  const [sortMode, setSortMode] = useState<SortMode>("frequency");

  if (topics.length === 0 && types.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Inhalte · Themen und Arten
          </p>
        </div>
        <div className="inline-flex rounded-md ring-1 ring-foreground/10 p-0.5 bg-card">
          <button
            type="button"
            onClick={() => setSortMode("frequency")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider rounded-sm transition-colors ${
              sortMode === "frequency"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ArrowDownWideNarrow size={12} />
            Häufigkeit
          </button>
          <button
            type="button"
            onClick={() => setSortMode("staleness")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider rounded-sm transition-colors ${
              sortMode === "staleness"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock size={12} />
            Zuletzt
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TagList title="Trainingsthemen" stats={topics} sortMode={sortMode} nowMs={nowMs} />
        <TagList title="Trainingsarten"  stats={types}  sortMode={sortMode} nowMs={nowMs} />
      </div>
    </section>
  );
}
