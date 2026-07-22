import type { OwnerRow } from "./types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function truncateId(id: string): string {
  return `u_${id.slice(0, 6)}`;
}

export function AnomalyRow({ anomalies }: { anomalies: OwnerRow[] }) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {anomalies.map((o, i) => (
        <div
          key={o.ownerId}
          className="rounded-xl bg-primary/5 ring-1 ring-primary/25 px-4 py-3 relative"
        >
          <div className="absolute top-2 right-3 text-xs font-medium text-primary/60 tabular-nums">
            #{i + 1}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{truncateId(o.ownerId)}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="text-2xl font-bold text-primary tabular-nums leading-none"
              style={{ fontFamily: "var(--font-syne, system-ui)" }}
            >
              +{formatBytes(o.storageDelta)}
            </span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              30d
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground tabular-nums">
            jetzt {formatBytes(o.storageBytes)}
          </div>
        </div>
      ))}
    </div>
  );
}
