"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDate } from "@/lib/utils/date";

// ── types ────────────────────────────────────────────────────────────────────

type Teilnehmer = { id: string; name: string };
type Group = { id: string; name: string; color: string | null };
type Membership = { teilnehmer_id: string; group_id: string };
type SessionRef = { id: string; dateISO: string };

interface Props {
  teilnehmer: Teilnehmer[];
  groups: Group[];
  memberships: Membership[];
  sessions: SessionRef[];
}

// Color palette when many teilnehmer are selected across groups. Ordered so
// adjacent colours are visually distinct.
const LINE_PALETTE = [
  "#2563eb", // blue-600
  "#f59e0b", // amber-500
  "#22c55e", // green-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#f97316", // orange-500
  "#06b6d4", // cyan-500
  "#eab308", // yellow-500
  "#a855f7", // purple-500
  "#14b8a6", // teal-500
  "#ef4444", // red-500
  "#84cc16", // lime-500
];

// ── component ────────────────────────────────────────────────────────────────

export function TeilnehmerCompareView({
  teilnehmer,
  groups,
  memberships,
  sessions,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Lookup structures ────────────────────────────────────────────────────────
  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );
  const teilnehmerById = useMemo(
    () => new Map(teilnehmer.map((t) => [t.id, t])),
    [teilnehmer],
  );
  const groupsByTeilnehmer = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const row of memberships) {
      const arr = m.get(row.teilnehmer_id) ?? [];
      arr.push(row.group_id);
      m.set(row.teilnehmer_id, arr);
    }
    return m;
  }, [memberships]);
  const teilnehmerByGroup = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const row of memberships) {
      const arr = m.get(row.group_id) ?? [];
      arr.push(row.teilnehmer_id);
      m.set(row.group_id, arr);
    }
    return m;
  }, [memberships]);
  // Filtered list for the left column
  const visibleTeilnehmer = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teilnehmer.filter((t) => {
      if (groupFilter && !(groupsByTeilnehmer.get(t.id) ?? []).includes(groupFilter))
        return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [teilnehmer, groupFilter, search, groupsByTeilnehmer]);

  // Section headers per group (or a single ungrouped block when filtered).
  const listSections = useMemo(() => {
    if (groupFilter) {
      const g = groupById.get(groupFilter);
      return [
        {
          groupId: groupFilter,
          groupName: g?.name ?? "Gruppe",
          groupColor: g?.color ?? null,
          members: visibleTeilnehmer,
        },
      ];
    }
    // Show each group section that has at least one visible member, plus an
    // "ohne Gruppe" bucket for orphans.
    const bucket = new Map<string, Teilnehmer[]>();
    const orphans: Teilnehmer[] = [];
    for (const t of visibleTeilnehmer) {
      const gs = groupsByTeilnehmer.get(t.id) ?? [];
      if (gs.length === 0) {
        orphans.push(t);
        continue;
      }
      for (const gid of gs) {
        if (!bucket.has(gid)) bucket.set(gid, []);
        bucket.get(gid)!.push(t);
      }
    }
    const sections = groups
      .filter((g) => bucket.has(g.id))
      .map((g) => ({
        groupId: g.id,
        groupName: g.name,
        groupColor: g.color,
        members: bucket.get(g.id)!,
      }));
    if (orphans.length) {
      sections.push({
        groupId: "__none",
        groupName: "Ohne Gruppe",
        groupColor: null,
        members: orphans,
      });
    }
    return sections;
  }, [visibleTeilnehmer, groupFilter, groupById, groupsByTeilnehmer, groups]);

  // Attendance cache per teilnehmer: session_ids where status='present'.
  // Keyed implicitly by the current `sessions` window — we clear it whenever
  // the window changes so we don't count attendance against stale session IDs.
  const [attendanceCache, setAttendanceCache] = useState<
    Record<string, Set<string>>
  >({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const inflightRef = useRef<Set<string>>(new Set());

  // Signature of the current session window. When the time window picker
  // changes, the parent server component re-renders with a different set of
  // session IDs — any cached attendance is now filtered against the wrong IDs.
  const sessionsKey = useMemo(
    () => sessions.map((s) => s.id).join(","),
    [sessions],
  );

  useEffect(() => {
    // Reset cache + in-flight tracking on window change so the fetch effect
    // re-runs for every currently selected teilnehmer against the new IDs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttendanceCache({});
    inflightRef.current.clear();
    setLoadingIds(new Set());
  }, [sessionsKey]);

  useEffect(() => {
    const toFetch = [...selectedIds].filter(
      (id) => !(id in attendanceCache) && !inflightRef.current.has(id),
    );
    if (!toFetch.length) return;
    for (const id of toFetch) inflightRef.current.add(id);
    setLoadingIds((prev) => {
      const next = new Set(prev);
      for (const id of toFetch) next.add(id);
      return next;
    });

    (async () => {
      const supabase = createClient();
      const sessionIds = sessions.map((s) => s.id);

      const clearInflight = () => {
        for (const id of toFetch) inflightRef.current.delete(id);
        setLoadingIds((prev) => {
          const next = new Set(prev);
          for (const id of toFetch) next.delete(id);
          return next;
        });
      };

      if (!sessionIds.length) {
        setAttendanceCache((prev) => {
          const next = { ...prev };
          for (const id of toFetch) next[id] = new Set();
          return next;
        });
        clearInflight();
        return;
      }

      // Chunk session IDs to avoid URL-length limits: `.in("session_id", [...])`
      // becomes `?session_id=in.(uuid,uuid,...)` in the GET, and long windows
      // (200+ sessions × 36-char UUIDs) can exceed proxy/CDN limits, causing a
      // silent 4xx that poisons the cache with empty sets. Splitting keeps each
      // request comfortably under the limit.
      const CHUNK = 100;
      const chunks: string[][] = [];
      for (let i = 0; i < sessionIds.length; i += CHUNK) {
        chunks.push(sessionIds.slice(i, i + CHUNK));
      }

      const byTeilnehmer = new Map<string, Set<string>>();
      for (const id of toFetch) byTeilnehmer.set(id, new Set());

      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from("session_attendance")
          .select("teilnehmer_id, session_id")
          .eq("status", "present")
          .in("teilnehmer_id", toFetch)
          .in("session_id", chunk);

        if (error) {
          // Don't populate the cache on failure — leaving the IDs uncached
          // means a fresh selection (or window switch) will retry them.
          clearInflight();
          toast.error("Teilnehmer-Daten konnten nicht geladen werden");
          return;
        }
        for (const row of data ?? []) {
          byTeilnehmer.get(row.teilnehmer_id)?.add(row.session_id);
        }
      }

      setAttendanceCache((prev) => {
        const next = { ...prev };
        for (const [id, set] of byTeilnehmer) next[id] = set;
        return next;
      });
      clearInflight();
    })();
  }, [selectedIds, attendanceCache, sessions]);

  // Determine color assignment for each selected teilnehmer.
  const colorByTeilnehmer = useMemo(() => {
    const m = new Map<string, string>();
    let paletteIdx = 0;
    for (const id of selectedIds) {
      // If a group is filtered and every selection is in that group, favour the
      // group's colour for a single member, palette otherwise.
      const groupsForT = groupsByTeilnehmer.get(id) ?? [];
      const singleGroup =
        groupFilter && groupsForT.includes(groupFilter)
          ? groupById.get(groupFilter)?.color
          : null;
      if (selectedIds.size === 1 && singleGroup) {
        m.set(id, singleGroup);
      } else {
        m.set(id, LINE_PALETTE[paletteIdx % LINE_PALETTE.length]);
        paletteIdx++;
      }
    }
    return m;
  }, [selectedIds, groupFilter, groupById, groupsByTeilnehmer]);

  // Build cumulative timeline series.
  const timeline = useMemo(() => {
    if (selectedIds.size === 0) return null;

    // Unique sorted date list within the window.
    const dates = [...new Set(sessions.map((s) => s.dateISO))].sort();
    if (!dates.length) return null;

    // Per-teilnehmer present-set map (from cache, or empty)
    const seriesByT: Record<string, number[]> = {};
    for (const id of selectedIds) {
      const presentSet = attendanceCache[id] ?? new Set<string>();
      // Count present on each date by summing sessions on that date that are in presentSet
      const byDate = new Map<string, number>();
      for (const s of sessions) {
        if (presentSet.has(s.id)) {
          byDate.set(s.dateISO, (byDate.get(s.dateISO) ?? 0) + 1);
        }
      }
      let running = 0;
      seriesByT[id] = dates.map((d) => {
        running += byDate.get(d) ?? 0;
        return running;
      });
    }

    // Rows for Recharts: { dateISO, label, [tid]: cumulative, min, max, avg }
    const rows = dates.map((d, i) => {
      const [, mm, dd] = d.split("-");
      const row: Record<string, string | number> = {
        dateISO: d,
        label: `${dd}.${mm}`,
      };
      const values: number[] = [];
      for (const id of selectedIds) {
        const v = seriesByT[id][i];
        row[`t_${id}`] = v;
        values.push(v);
      }
      if (values.length >= 3) {
        row.__min = Math.min(...values);
        row.__max = Math.max(...values);
        row.__avg = values.reduce((a, b) => a + b, 0) / values.length;
      }
      return row;
    });

    return { rows, dates };
  }, [selectedIds, sessions, attendanceCache]);

  // Handlers ─────────────────────────────────────────────────────────────────
  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectGroupMembers(groupId: string) {
    const ids =
      groupId === "__none"
        ? teilnehmer
            .filter((t) => (groupsByTeilnehmer.get(t.id) ?? []).length === 0)
            .map((t) => t.id)
        : teilnehmerByGroup.get(groupId) ?? [];
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allIn = ids.every((id) => next.has(id));
      if (allIn) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }

  const anyLoading = loadingIds.size > 0;
  const hasSessions = sessions.length > 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:min-h-[calc(100vh-16rem)]">
      {/* ── Left column: filter + list ──────────────────────────────── */}
      <aside className="lg:w-80 shrink-0 flex flex-col gap-3">
        {/* Group filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={groupFilter === null}
            onClick={() => setGroupFilter(null)}
            label="Alle"
          />
          {groups.map((g) => (
            <FilterChip
              key={g.id}
              active={groupFilter === g.id}
              onClick={() => setGroupFilter(g.id === groupFilter ? null : g.id)}
              label={g.name}
              color={g.color}
            />
          ))}
        </div>

        {/* Search + selection summary */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Teilnehmer suchen…"
            className="w-full text-sm rounded-lg border border-border bg-background pl-8 pr-2 py-2 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} ausgewählt`
              : `${visibleTeilnehmer.length} Teilnehmer`}
          </span>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
              Leeren
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border max-h-[45vh] lg:max-h-none">
          {listSections.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Keine Teilnehmer gefunden.
            </p>
          ) : (
            listSections.map((section) => {
              const allIn = section.members.every((m) => selectedIds.has(m.id));
              const someIn =
                !allIn && section.members.some((m) => selectedIds.has(m.id));
              return (
                <div key={section.groupId}>
                  <div className="px-3 py-2 flex items-center gap-2 bg-muted/40">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: section.groupColor ?? "#94a3b8" }}
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1 truncate">
                      {section.groupName}{" "}
                      <span className="font-normal opacity-60">
                        · {section.members.length}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => selectGroupMembers(section.groupId)}
                      className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                        allIn
                          ? "text-primary"
                          : someIn
                            ? "text-primary/70 hover:text-primary"
                            : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {allIn ? "Alle abwählen" : "Alle wählen"}
                    </button>
                  </div>
                  {section.members.map((m) => {
                    const checked = selectedIds.has(m.id);
                    const isLoading = loadingIds.has(m.id);
                    return (
                      <label
                        key={`${section.groupId}-${m.id}`}
                        className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors ${
                          checked ? "bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(m.id)}
                          className="accent-primary w-3.5 h-3.5 shrink-0"
                        />
                        <span
                          className="flex-1 truncate"
                          style={{
                            color: checked
                              ? colorByTeilnehmer.get(m.id) ?? undefined
                              : undefined,
                            fontWeight: checked ? 600 : 400,
                          }}
                        >
                          {m.name}
                        </span>
                        {isLoading && (
                          <span className="w-3 h-3 rounded-full border-2 border-muted-foreground/40 border-t-transparent animate-spin shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right column: chart ──────────────────────────────────────── */}
      <section className="flex-1 min-w-0">
        {!hasSessions ? (
          <EmptyState
            title="Keine Trainings im gewählten Zeitraum"
            hint="Wähle einen anderen Zeitraum in der Auswahl oben rechts."
          />
        ) : selectedIds.size === 0 ? (
          <EmptyState
            title="Wähle Teilnehmer aus"
            hint="Markiere links einen oder mehrere Teilnehmer, um den Verlauf zu sehen. Wähle eine ganze Gruppe für einen Vergleich."
          />
        ) : timeline ? (
          <TimelineChart
            rows={timeline.rows}
            selectedIds={[...selectedIds]}
            colorByTeilnehmer={colorByTeilnehmer}
            teilnehmerById={teilnehmerById}
            loading={anyLoading && Object.keys(attendanceCache).length === 0}
          />
        ) : null}
      </section>
    </div>
  );
}

// ── UI subcomponents ─────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors border ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-secondary/50 text-muted-foreground hover:text-foreground border-border"
      }`}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="h-full min-h-[300px] rounded-2xl border border-dashed border-border bg-card/40 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p
          className="text-base font-semibold mb-1.5"
          style={{ fontFamily: "var(--font-syne, system-ui)" }}
        >
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

// ── Timeline chart ───────────────────────────────────────────────────────────

type TimelineRow = Record<string, string | number>;

function TimelineChart({
  rows,
  selectedIds,
  colorByTeilnehmer,
  teilnehmerById,
  loading,
}: {
  rows: TimelineRow[];
  selectedIds: string[];
  colorByTeilnehmer: Map<string, string>;
  teilnehmerById: Map<string, Teilnehmer>;
  loading: boolean;
}) {
  const showBand = selectedIds.length >= 3;

  const chartConfig: ChartConfig = {};
  for (const id of selectedIds) {
    chartConfig[`t_${id}`] = {
      label: teilnehmerById.get(id)?.name ?? "Teilnehmer",
      color: colorByTeilnehmer.get(id) ?? LINE_PALETTE[0],
    };
  }

  const N = rows.length;
  const maxValue = rows.length
    ? Math.max(
        1,
        ...rows.flatMap((r) =>
          selectedIds.map((id) => Number(r[`t_${id}`] ?? 0)),
        ),
      )
    : 1;

  const totals = selectedIds.map((id) => {
    const total = Number(rows[rows.length - 1]?.[`t_${id}`] ?? 0);
    return { id, name: teilnehmerById.get(id)?.name ?? "—", total };
  });
  const sortedTotals = [...totals].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      {/* Header line */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
          Kumulierte Check-ins
        </p>
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground/40 border-t-transparent animate-spin" />
            Lade Daten…
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <ChartContainer config={chartConfig} className="h-[280px] sm:h-[360px] w-full">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.4} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={10}
              interval={N > 40 ? Math.floor(N / 8) : N > 15 ? Math.floor(N / 6) : 0}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
              fontSize={10}
              domain={[0, Math.ceil(maxValue * 1.05)]}
            />
            <ChartTooltip content={<CompareTooltip teilnehmerById={teilnehmerById} colorByTeilnehmer={colorByTeilnehmer} />} />

            {showBand && (
              <Area
                type="monotone"
                dataKey="__max"
                stroke="none"
                fill="currentColor"
                fillOpacity={0.05}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            {showBand && (
              <Area
                type="monotone"
                dataKey="__min"
                stroke="none"
                fill="var(--card)"
                fillOpacity={1}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            {showBand && (
              <Line
                dataKey="__avg"
                type="monotone"
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {selectedIds.map((id) => (
              <Line
                key={id}
                dataKey={`t_${id}`}
                type="monotone"
                stroke={colorByTeilnehmer.get(id) ?? LINE_PALETTE[0]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ChartContainer>

        {showBand && (
          <p className="mt-3 text-[10px] text-muted-foreground">
            Gestrichelt: Durchschnitt · Schattierter Bereich: Min–Max
          </p>
        )}
      </div>

      {/* Ranking */}
      <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">
          Rangliste im Zeitraum
        </p>
        <ul className="space-y-1.5">
          {sortedTotals.map((row, i) => {
            const color = colorByTeilnehmer.get(row.id) ?? LINE_PALETTE[0];
            const pct = maxValue > 0 ? (row.total / maxValue) * 100 : 0;
            return (
              <li key={row.id} className="flex items-center gap-3">
                <span className="w-4 text-[11px] text-muted-foreground tabular-nums text-right shrink-0">
                  {i + 1}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="flex-1 min-w-0 truncate text-sm">
                  {row.name}
                </span>
                <div className="hidden sm:block w-36 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums w-8 text-right shrink-0">
                  {row.total}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Recharts payload shape is untyped; keep the surface narrow.
type CompareTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: Record<string, string | number>;
  }>;
};

function CompareTooltip({
  active,
  payload,
  teilnehmerById,
  colorByTeilnehmer,
}: CompareTooltipProps & {
  teilnehmerById: Map<string, Teilnehmer>;
  colorByTeilnehmer: Map<string, string>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  const dateISO = String(row.dateISO ?? "");

  // Reconstruct t_<id> keys and sort desc.
  const items = Object.entries(row)
    .filter(([k]) => k.startsWith("t_"))
    .map(([k, v]) => {
      const id = k.slice(2);
      return {
        id,
        name: teilnehmerById.get(id)?.name ?? id,
        value: Number(v),
        color: colorByTeilnehmer.get(id) ?? LINE_PALETTE[0],
      };
    })
    .sort((a, b) => b.value - a.value);

  return (
    <div className="rounded-xl border border-border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs min-w-[200px] max-w-[280px]">
      <p className="font-semibold mb-1.5">
        {dateISO ? formatDate(dateISO) : ""}
      </p>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: it.color }}
            />
            <span className="flex-1 min-w-0 truncate">{it.name}</span>
            <span className="tabular-nums font-medium shrink-0">
              {it.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

