"use client";

/**
 * Reusable "used / limit" transparency chip for plan caps.
 *
 * Renders three states based on the ratio:
 *   • < 80 %          → neutral (muted)
 *   • 80 % – 99 %     → warning (amber tint)
 *   • ≥ 100 %         → over (destructive tint)
 *
 * When `limit` is null (unlimited plan), the badge renders "∞" and never
 * warns.
 *
 * Prefer this component wherever a page shows a count that maps to a
 * plan limit, so free users see live headroom without hunting through
 * settings.
 */
export function LimitBadge({
  used,
  limit,
  label,
  compact,
}: {
  used: number;
  limit: number | null;
  label?: string;
  /** When true, drops the label suffix and renders as a small inline chip. */
  compact?: boolean;
}) {
  const unlimited = limit == null;
  const pct = unlimited || limit === 0 ? 0 : (used / limit) * 100;
  const state: "ok" | "warn" | "over" =
    unlimited ? "ok" : pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";

  const cls =
    state === "over"
      ? "bg-destructive/10 text-destructive ring-destructive/30"
      : state === "warn"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/25"
      : "bg-secondary text-muted-foreground ring-border";

  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${
        compact ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
      } rounded-full ring-1 font-medium ${cls}`}
      title={
        unlimited
          ? "Keine Grenze"
          : `${used} von ${limit}${state === "warn" ? " — Grenze naht" : state === "over" ? " — Grenze überschritten" : ""}`
      }
    >
      {unlimited ? (
        <>
          <span className="font-mono">∞</span>
          {label && !compact && <span className="text-muted-foreground/70">{label}</span>}
        </>
      ) : (
        <>
          <span className="font-semibold">{used}</span>
          <span className="opacity-60">/</span>
          <span>{limit}</span>
          {label && !compact && <span className="text-muted-foreground/70 ml-0.5">{label}</span>}
        </>
      )}
    </span>
  );
}
