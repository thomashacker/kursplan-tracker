export function StatusTile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: string;
}) {
  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 px-5 py-4">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="text-3xl font-bold text-foreground tabular-nums leading-none"
          style={{ fontFamily: "var(--font-syne, system-ui)" }}
        >
          {value}
        </span>
        {delta && (
          <span className="text-xs font-semibold text-primary tabular-nums">
            {delta}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
          {hint}
        </div>
      )}
    </div>
  );
}
