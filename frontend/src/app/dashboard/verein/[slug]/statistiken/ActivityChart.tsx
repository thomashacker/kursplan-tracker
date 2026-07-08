"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type DailyPoint = {
  dateISO: string;
  sessions: number;
  checkIns: number;
  probetraining: number;
};

export type WeekdayPoint = {
  dow: number; // 0=Mo … 6=So
  sessions: number;
  checkIns: number;
  probetraining: number;
};

const DAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function formatTickDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

const COLOR_BAR = "rgb(37 99 235)"; // blue-600
const COLOR_LINE = "rgb(34 197 94)"; // green-500
const COLOR_PROBE = "rgb(23 23 23)"; // near-black; softer in dark via currentColor fallback

interface Props {
  daily: DailyPoint[];
  weekday: WeekdayPoint[];
  /** Same-shape series filtered to a single group, keyed by group id. */
  dailyByGroup?: Record<string, DailyPoint[]>;
  weekdayByGroup?: Record<string, WeekdayPoint[]>;
  /** Group choices for the filter dropdown — only groups that had activity in the window. */
  groups?: { id: string; name: string; color: string | null }[];
  hasAttendance: boolean;
  hasProbetraining: boolean;
}

export function ActivityChart({
  daily,
  weekday,
  dailyByGroup,
  weekdayByGroup,
  groups = [],
  hasAttendance,
  hasProbetraining,
}: Props) {
  const [mode, setMode] = useState<"daily" | "weekday">("daily");
  const [selectedGroup, setSelectedGroup] = useState<"all" | string>("all");
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setGroupMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Pick the daily/weekday source based on the group filter. "all" always
  // uses the base series; a group id uses the per-group pre-computed one,
  // falling back to base when the map doesn't have it (defensive).
  const dailySrc = selectedGroup === "all" ? daily : dailyByGroup?.[selectedGroup] ?? daily;
  const weekdaySrc = selectedGroup === "all" ? weekday : weekdayByGroup?.[selectedGroup] ?? weekday;

  const activeGroup = groups.find((g) => g.id === selectedGroup);
  const groupLabel = activeGroup?.name ?? "Alle Gruppen";

  const rows =
    mode === "daily"
      ? dailySrc.map((p) => ({
          label: formatTickDate(p.dateISO),
          sessions: p.sessions,
          checkIns: p.checkIns,
          probetraining: p.probetraining,
        }))
      : weekdaySrc.map((p) => ({
          label: DAY_SHORT[p.dow] ?? "",
          sessions: p.sessions,
          checkIns: p.checkIns,
          probetraining: p.probetraining,
        }));

  const N = rows.length;
  const maxSessions = Math.max(0, ...rows.map((r) => r.sessions));
  const maxCheckIns = Math.max(0, ...rows.map((r) => r.checkIns));
  const maxProbe = Math.max(0, ...rows.map((r) => r.probetraining));
  const maxIdx =
    hasAttendance && maxCheckIns > 0
      ? rows.findIndex((r) => r.checkIns === maxCheckIns)
      : -1;

  const chartConfig: ChartConfig = {
    sessions: { label: "Trainings", color: COLOR_BAR },
    checkIns: { label: "Check-ins", color: COLOR_LINE },
    probetraining: { label: "Probetraining", color: COLOR_PROBE },
  };

  // Cap bar width so they don't get visually fat on weekday view (N=7).
  const barMaxSize = mode === "weekday" ? 56 : N > 60 ? 6 : 18;

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Aktivität
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Group filter — only shown when at least one group had activity */}
          {groups.length > 0 && (
            <div className="relative" ref={groupMenuRef}>
              <button
                type="button"
                onClick={() => setGroupMenuOpen((o) => !o)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  selectedGroup === "all"
                    ? "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    : "border-primary/40 bg-primary/5 text-primary"
                }`}
                aria-haspopup="listbox"
                aria-expanded={groupMenuOpen}
              >
                {activeGroup?.color && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeGroup.color }}
                  />
                )}
                <span className="truncate max-w-[8rem]">{groupLabel}</span>
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`shrink-0 transition-transform ${groupMenuOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {groupMenuOpen && (
                <div className="absolute right-0 top-9 z-20 w-52 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover shadow-lg py-1">
                  <button
                    type="button"
                    onClick={() => { setSelectedGroup("all"); setGroupMenuOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                      selectedGroup === "all" ? "bg-secondary/60 font-semibold" : "hover:bg-secondary"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0 border border-current opacity-40" />
                    Alle Gruppen
                  </button>
                  <div className="h-px bg-border my-1" />
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setSelectedGroup(g.id); setGroupMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                        selectedGroup === g.id ? "bg-secondary/60 font-semibold" : "hover:bg-secondary"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: g.color ?? "#94a3b8" }}
                      />
                      <span className="truncate">{g.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border">
            {(["daily", "weekday"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  mode === m
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "daily" ? "Pro Tag" : "Pro Wochentag"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        {/* Inline legend with max-value hints */}
        <div className="flex items-center gap-x-5 gap-y-1 mb-4 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: COLOR_BAR }}
            />
            <span className="text-muted-foreground">
              Trainings
              <span className="text-foreground font-semibold ml-1.5">
                · max {maxSessions}
              </span>
            </span>
          </div>
          {hasAttendance && (
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-0.5 rounded-full"
                style={{ backgroundColor: COLOR_LINE }}
              />
              <span className="text-muted-foreground">
                Check-ins
                <span className="text-foreground font-semibold ml-1.5">
                  · max {maxCheckIns}
                </span>
              </span>
            </div>
          )}
          {hasProbetraining && (
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-4 border-t-2 border-dotted"
                style={{ borderColor: COLOR_PROBE }}
              />
              <span className="text-muted-foreground">
                Probetraining
                <span className="text-foreground font-semibold ml-1.5">
                  · max {maxProbe}
                </span>
              </span>
            </div>
          )}
        </div>

        {N === 0 ? (
          <div className="h-28 sm:h-36 flex items-center justify-center text-xs text-muted-foreground">
            Keine Daten im Zeitraum.
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-32 sm:h-40 w-full"
          >
            <ComposedChart
              data={rows}
              margin={{ left: 0, right: 0, top: 16, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                stroke="currentColor"
                strokeOpacity={0.08}
              />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                interval="preserveStartEnd"
                minTickGap={mode === "daily" ? 24 : 0}
                tick={{ fontSize: 10, fill: "currentColor", opacity: 0.6 }}
              />
              <YAxis
                yAxisId="L"
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
                tick={{
                  fontSize: 10,
                  fill: COLOR_BAR,
                  fontWeight: 600,
                }}
              />
              {(hasAttendance || hasProbetraining) && (
                <YAxis
                  yAxisId="R"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                  tick={{
                    fontSize: 10,
                    fill: hasAttendance ? COLOR_LINE : "currentColor",
                    opacity: hasAttendance ? 1 : 0.6,
                    fontWeight: 600,
                  }}
                />
              )}
              <ChartTooltip
                cursor={{ fill: "currentColor", fillOpacity: 0.05 }}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Bar
                yAxisId="L"
                dataKey="sessions"
                fill="var(--color-sessions)"
                radius={[3, 3, 0, 0]}
                maxBarSize={barMaxSize}
              />
              {hasAttendance && (
                <Line
                  yAxisId="R"
                  type="monotone"
                  dataKey="checkIns"
                  stroke="var(--color-checkIns)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              )}
              {hasProbetraining && (
                <Line
                  yAxisId="R"
                  type="monotone"
                  dataKey="probetraining"
                  stroke="var(--color-probetraining)"
                  strokeWidth={1.75}
                  strokeDasharray="4 3"
                  dot={false}
                  activeDot={{
                    r: 3,
                    stroke: "var(--card)",
                    strokeWidth: 2,
                  }}
                  isAnimationActive={false}
                />
              )}
              {maxIdx !== -1 && (
                <ReferenceDot
                  yAxisId="R"
                  x={rows[maxIdx].label}
                  y={rows[maxIdx].checkIns}
                  r={4}
                  fill={COLOR_LINE}
                  stroke="var(--card)"
                  strokeWidth={2}
                  ifOverflow="visible"
                  label={{
                    value: maxCheckIns,
                    position: "top",
                    fontSize: 10,
                    fontWeight: 700,
                    fill: COLOR_LINE,
                  }}
                />
              )}
            </ComposedChart>
          </ChartContainer>
        )}
      </div>
    </section>
  );
}
