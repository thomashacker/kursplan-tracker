import { createClient } from "@/lib/supabase/server";
import { StatusTile } from "./StatusTile";
import { HeadroomBar } from "./HeadroomBar";
import { ManagersTable } from "./ManagersTable";
import { AnomalyRow } from "./AnomalyRow";
import type { UsageSnapshot, OwnerRow } from "./types";

// Supabase free tier ceilings (as of 2026-07).
const DB_LIMIT_BYTES = 500 * 1024 * 1024;      // 500 MB
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Capture "now" once so every derived timestamp/comparison in this render
  // sees the same moment (react-hooks/purity forbids Date.now / new Date in
  // component body — we anchor via a single value at the top).
  const nowMs = new Date().getTime();

  // Global counts (parallel).
  const [profilesRes, clubsRes, membershipsRes] = await Promise.all([
    supabase.from("profiles").select("id, created_at"),
    supabase.from("clubs").select("id, created_by, created_at, plan"),
    supabase
      .from("club_memberships")
      .select("club_id, user_id, role, joined_at, status")
      .eq("status", "active"),
  ]);

  const profiles = profilesRes.data ?? [];
  const clubs = clubsRes.data ?? [];
  const memberships = membershipsRes.data ?? [];

  const cutoff = new Date(nowMs - 30 * DAY_MS).toISOString();
  const { data: snapshotsRaw } = await supabase
    .from("usage_snapshots")
    .select("*")
    .gte("taken_at", cutoff)
    .order("taken_at", { ascending: true })
    .returns<UsageSnapshot[]>();
  const snapshots = snapshotsRaw ?? [];

  // Latest snapshot per club (snapshots come sorted ascending, so last wins).
  const latestByClub = new Map<string, UsageSnapshot>();
  for (const s of snapshots) latestByClub.set(s.club_id, s);

  // Snapshot ≥7 days old per club (for growth deltas). Look at the OLDEST
  // row we have — if the series is <7 days long we treat delta as 0.
  const oldestByClub = new Map<string, UsageSnapshot>();
  for (const s of snapshots) {
    if (!oldestByClub.has(s.club_id)) oldestByClub.set(s.club_id, s);
  }

  const totalDbBytes = [...latestByClub.values()].reduce((a, s) => a + Number(s.db_bytes), 0);
  const totalStorageBytes = [...latestByClub.values()].reduce((a, s) => a + Number(s.storage_bytes), 0);

  // Distinct owners.
  const ownerIds = new Set(clubs.map((c) => c.created_by));

  // Recent signups (last 7 days).
  const weekAgo = nowMs - 7 * DAY_MS;
  const recentSignups = profiles.filter((p) => new Date(p.created_at).getTime() > weekAgo).length;

  // Build owner rows.
  const owners: OwnerRow[] = [...ownerIds].map((ownerId) => {
    const ownerClubs = clubs.filter((c) => c.created_by === ownerId);
    const ownerSince = ownerClubs.reduce(
      (earliest, c) => (c.created_at < earliest ? c.created_at : earliest),
      ownerClubs[0]!.created_at
    );

    let dbBytes = 0;
    let storageBytes = 0;
    let storageBytesOld = 0;
    let sessionCount = 0;
    let teilnehmerCount = 0;
    let mediaCount = 0;
    let lastActivity: string | null = null;

    for (const c of ownerClubs) {
      const s = latestByClub.get(c.id);
      const old = oldestByClub.get(c.id);
      if (s) {
        dbBytes += Number(s.db_bytes);
        storageBytes += Number(s.storage_bytes);
        sessionCount += s.session_count;
        teilnehmerCount += s.teilnehmer_count;
        mediaCount += s.media_count;
        if (s.last_activity_at && (!lastActivity || s.last_activity_at > lastActivity)) {
          lastActivity = s.last_activity_at;
        }
      }
      if (old && old !== s) {
        storageBytesOld += Number(old.storage_bytes);
      }
    }

    // 7d storage delta uses the oldest snapshot in the 30-day window as the
    // baseline. If the window is <7 days, this understates — good enough as
    // "recent growth" signal for now.
    const storageDelta = storageBytesOld ? storageBytes - storageBytesOld : 0;

    const clubIdsOfOwner = new Set(ownerClubs.map((c) => c.id));
    const staffCount = memberships.filter(
      (m) => clubIdsOfOwner.has(m.club_id) && (m.role === "admin" || m.role === "trainer")
    ).length;

    // Owner's plan surface: unlimited wins if ANY of their clubs is unlimited.
    const plan: "free" | "unlimited" = ownerClubs.some((c) => c.plan === "unlimited")
      ? "unlimited"
      : "free";

    return {
      ownerId,
      ownerSince,
      clubCount: ownerClubs.length,
      dbBytes,
      storageBytes,
      storageDelta,
      sessionCount,
      teilnehmerCount,
      mediaCount,
      staffCount,
      lastActivity,
      plan,
    };
  }).sort((a, b) => (b.dbBytes + b.storageBytes) - (a.dbBytes + a.storageBytes));

  // Top 5 storage anomalies (highest 7d growth in bytes).
  const anomalies = [...owners]
    .filter((o) => o.storageDelta > 0)
    .sort((a, b) => b.storageDelta - a.storageDelta)
    .slice(0, 5);

  return (
    <div className="space-y-10">
      {/* ── Header ────────────────────────────────────────────── */}
      <header className="flex items-baseline justify-between">
        <h1
          className="text-3xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-syne, system-ui)" }}
        >
          Ops-Dashboard
        </h1>
        <p className="text-xs text-muted-foreground">
          Nur für Superadmins · Snapshot täglich um 03:00 UTC
        </p>
      </header>

      {/* ── Hero: top-line counters ───────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Übersicht
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatusTile
            label="Registrierte Accounts"
            value={profiles.length}
            delta={recentSignups > 0 ? `+${recentSignups} · 7t` : undefined}
          />
          <StatusTile
            label="Verein-Owner"
            value={ownerIds.size}
            hint={`${clubs.length} Vereine gesamt`}
          />
          <StatusTile
            label="Datenbank"
            value={formatBytes(totalDbBytes)}
            hint={`${((totalDbBytes / DB_LIMIT_BYTES) * 100).toFixed(2)}% des Free-Tiers`}
          />
          <StatusTile
            label="Storage"
            value={formatBytes(totalStorageBytes)}
            hint={`${((totalStorageBytes / STORAGE_LIMIT_BYTES) * 100).toFixed(2)}% des Free-Tiers`}
          />
        </div>
      </section>

      {/* ── Free-tier headroom ────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Free-Tier-Auslastung
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          <HeadroomBar
            label="Postgres"
            used={totalDbBytes}
            limit={DB_LIMIT_BYTES}
            series={sumSeries(snapshots, "db_bytes")}
          />
          <HeadroomBar
            label="Storage"
            used={totalStorageBytes}
            limit={STORAGE_LIMIT_BYTES}
            series={sumSeries(snapshots, "storage_bytes")}
          />
        </div>
      </section>

      {/* ── Verein managers ───────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Verein-Owner · {owners.length}
          </h2>
          <span className="text-xs text-muted-foreground/70">
            Sortiert nach Footprint
          </span>
        </div>
        <ManagersTable owners={owners} />
      </section>

      {/* ── Storage anomalies ─────────────────────────────────── */}
      {anomalies.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Storage-Anomalien · Top 5 (30d)
          </h2>
          <AnomalyRow anomalies={anomalies} />
        </section>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Roll snapshots up per-day (max over the day) into a chronological
 * series across all clubs — used by the headroom sparklines.
 */
function sumSeries(snapshots: UsageSnapshot[], field: "db_bytes" | "storage_bytes"): number[] {
  const byDay = new Map<string, Map<string, number>>();
  for (const s of snapshots) {
    const day = s.taken_at.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Map());
    const clubMap = byDay.get(day)!;
    const prev = clubMap.get(s.club_id) ?? 0;
    clubMap.set(s.club_id, Math.max(prev, Number(s[field])));
  }
  const days = [...byDay.keys()].sort();
  return days.map((d) => {
    const clubMap = byDay.get(d)!;
    let sum = 0;
    for (const v of clubMap.values()) sum += v;
    return sum;
  });
}
