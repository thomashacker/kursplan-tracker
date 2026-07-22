import type { OwnerRow } from "./types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Show only the first 6 chars of the UUID — enough to disambiguate rows, hides identity. */
function truncateId(id: string): string {
  return `u_${id.slice(0, 6)}`;
}

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date().getTime() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "heute";
  if (days === 1) return "vor 1t";
  if (days < 30) return `vor ${days}t`;
  const months = Math.floor(days / 30);
  if (months < 12) return `vor ${months}mo`;
  return `vor ${Math.floor(months / 12)}j`;
}

export function ManagersTable({ owners }: { owners: OwnerRow[] }) {
  if (owners.length === 0) {
    return (
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 px-5 py-8 text-center text-sm text-muted-foreground">
        Noch keine Verein-Owner registriert.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card ring-1 ring-foreground/10 overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-3 font-medium">Owner</th>
            <th className="text-left px-3 py-3 font-medium">Seit</th>
            <th className="text-right px-3 py-3 font-medium">Vereine</th>
            <th className="text-right px-3 py-3 font-medium">Staff</th>
            <th className="text-right px-3 py-3 font-medium">Sessions</th>
            <th className="text-right px-3 py-3 font-medium">Teiln.</th>
            <th className="text-right px-3 py-3 font-medium">Media</th>
            <th className="text-right px-3 py-3 font-medium">DB</th>
            <th className="text-right px-3 py-3 font-medium">Storage</th>
            <th className="text-right px-3 py-3 font-medium">30d Δ</th>
            <th className="text-right px-4 py-3 font-medium">Zuletzt aktiv</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o) => (
            <tr
              key={o.ownerId}
              className="border-b border-border/60 last:border-b-0 hover:bg-secondary/40 transition-colors"
            >
              <td className="px-4 py-3 text-foreground font-mono text-xs">{truncateId(o.ownerId)}</td>
              <td className="px-3 py-3 text-muted-foreground">{formatDate(o.ownerSince)}</td>
              <td className="px-3 py-3 text-right text-foreground">{o.clubCount}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{o.staffCount}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{o.sessionCount}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{o.teilnehmerCount}</td>
              <td className="px-3 py-3 text-right text-muted-foreground">{o.mediaCount}</td>
              <td className="px-3 py-3 text-right text-foreground">{formatBytes(o.dbBytes)}</td>
              <td className="px-3 py-3 text-right text-foreground">
                {formatBytes(o.storageBytes)}
              </td>
              <td className="px-3 py-3 text-right">
                {o.storageDelta > 0 ? (
                  <span className="text-primary font-medium">+{formatBytes(o.storageDelta)}</span>
                ) : o.storageDelta < 0 ? (
                  <span className="text-emerald-600 font-medium">
                    −{formatBytes(-o.storageDelta)}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">{timeAgo(o.lastActivity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
