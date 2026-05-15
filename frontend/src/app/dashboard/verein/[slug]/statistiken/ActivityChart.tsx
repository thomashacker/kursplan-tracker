"use client";

import { useState } from "react";
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
};

export type WeekdayPoint = {
  dow: number; // 0=Mo … 6=So
  sessions: number;
  checkIns: number;
};

const DAY_SHORT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function formatTickDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

const COLOR_BAR = "rgb(37 99 235)"; // blue-600
const COLOR_LINE = "rgb(34 197 94)"; // green-500

interface Props {
  daily: DailyPoint[];
  weekday: WeekdayPoint[];
  hasAttendance: boolean;
}

export function ActivityChart({ daily, weekday, hasAttendance }: Props) {
  const [mode, setMode] = useState<"daily" | "weekday">("daily");

  const rows =
    mode === "daily"
      ? daily.map((p) => ({
          label: formatTickDate(p.dateISO),
          sessions: p.sessions,
          checkIns: p.checkIns,
        }))
      : weekday.map((p) => ({
          label: DAY_SHORT[p.dow] ?? "",
          sessions: p.sessions,
          checkIns: p.checkIns,
        }));

  const N = rows.length;
  const maxSessions = Math.max(0, ...rows.map((r) => r.sessions));
  const maxCheckIns = Math.max(0, ...rows.map((r) => r.checkIns));
  const maxIdx =
    hasAttendance && maxCheckIns > 0
      ? rows.findIndex((r) => r.checkIns === maxCheckIns)
      : -1;

  const chartConfig: ChartConfig = {
    sessions: { label: "Trainings", color: COLOR_BAR },
    checkIns: { label: "Check-ins", color: COLOR_LINE },
  };

  // Cap bar width so they don't get visually fat on weekday view (N=7).
  const barMaxSize = mode === "weekday" ? 56 : N > 60 ? 6 : 18;

  return (
    <section>
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Aktivität
        </p>
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
              {hasAttendance && (
                <YAxis
                  yAxisId="R"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                  tick={{
                    fontSize: 10,
                    fill: COLOR_LINE,
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
