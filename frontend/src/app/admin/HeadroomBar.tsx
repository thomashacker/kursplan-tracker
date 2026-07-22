import { Sparkline } from "./Sparkline";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Linear extrapolation from the oldest to newest data point. Returns null
 * when the series is flat or shrinking (no exhaustion projected).
 */
function projectExhaustionDays(series: number[], limit: number, current: number): number | null {
  if (series.length < 2) return null;
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const span = series.length - 1;
  const deltaPerDay = (last - first) / span;
  if (deltaPerDay <= 0) return null;
  const remaining = limit - current;
  if (remaining <= 0) return 0;
  return Math.round(remaining / deltaPerDay);
}

export function HeadroomBar({
  label,
  used,
  limit,
  series,
}: {
  label: string;
  used: number;
  limit: number;
  series: number[];
}) {
  const pct = Math.min(100, (used / limit) * 100);
  const daysLeft = projectExhaustionDays(series, limit, used);
  const isDanger = pct >= 80;

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatBytes(used)} / {formatBytes(limit)}
        </span>
      </div>

      <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full ${isDanger ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
        {/* 80% danger tick */}
        <div className="absolute inset-y-0 left-[80%] w-px bg-destructive/40" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground tabular-nums">
          {pct.toFixed(2)}% belegt
          {daysLeft !== null && (
            <span className="ml-2 text-primary/80">
              · voll in ~{daysLeft.toLocaleString()}t
            </span>
          )}
        </span>
        <Sparkline data={series} />
      </div>
    </div>
  );
}
