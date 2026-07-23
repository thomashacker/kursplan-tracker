"use client";

import { useMemo, useState } from "react";
import type { PlanConfig } from "@/types";

// ── Row-size constants (measured against production data 2026-07) ──────
// Averages of pg_column_size across all rows in the live DB. If schema
// changes materially, re-measure.
const ROW_BYTES = {
  training_session:        283,
  session_attendance:      111,
  session_expected_groups: 56,
  session_trainer:         72,
  teilnehmer:              96,
} as const;

// Postgres typically adds 30-60% for indexes + heap overhead; 1.5× safe.
const INDEX_OVERHEAD = 1.5;

// Per-club overhead that doesn't scale with plan caps: training_weeks,
// club_topics/types, locations, memberships row for the owner, etc.
const STATIC_CLUB_OVERHEAD_BYTES = 100 * 1024;

// Supabase Free-Tier Postgres ceiling (as of 2026-07).
const FREE_POSTGRES_LIMIT = 500 * 1024 * 1024;

function formatBytes(n: number, precision = 1): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(precision)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(precision)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(precision + 1)} GB`;
}

interface Props {
  plans: PlanConfig[];
}

export function CapacityCalculator({ plans }: Props) {
  const freePlan = plans.find((p) => p.plan === "free");
  const [years, setYears] = useState<number>(1);

  const math = useMemo(() => {
    if (!freePlan) return null;
    const teiln  = freePlan.max_teilnehmer ?? 0;
    const sess   = freePlan.max_sessions_per_week ?? 0;

    // Bytes for ONE completed training: session row + attendance for
    // every teilnehmer + a couple of expected-group / trainer rows.
    // Multiplied by INDEX_OVERHEAD once at the end.
    const perTrainingRaw =
      ROW_BYTES.training_session +
      ROW_BYTES.session_attendance * teiln +
      ROW_BYTES.session_expected_groups * 2 +
      ROW_BYTES.session_trainer * 2;
    const perTraining = perTrainingRaw * INDEX_OVERHEAD;
    const perWeek     = perTraining * sess;
    const perYear     = perWeek * 52;

    // Total per Verein over the chosen years, plus static overhead
    // (teilnehmer-roster rows + week rows + club-level tables, mostly
    // fixed).
    const teilnRoster = ROW_BYTES.teilnehmer * teiln * INDEX_OVERHEAD;
    const perVerein   = perYear * years + teilnRoster + STATIC_CLUB_OVERHEAD_BYTES;

    const capacity = perVerein > 0
      ? Math.floor(FREE_POSTGRES_LIMIT / perVerein)
      : Infinity;

    return { perTraining, perWeek, perYear, perVerein, capacity, teiln, sess };
  }, [freePlan, years]);

  if (!freePlan || !math) return null;

  const { perTraining, perWeek, perYear, perVerein, capacity, teiln, sess } = math;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Kapazität · Supabase Free
        </p>
        <p
          className="mt-1 text-lg font-bold leading-tight"
          style={{ fontFamily: "var(--font-syne, system-ui)" }}
        >
          Wie viele Free-Vereine passen rein?
        </p>
      </div>

      {/* ── Calculation trail ─────────────────────────────────────── */}
      <div className="space-y-0 font-mono text-sm">
        <CalcRow
          label="Postgres-Grenze (Free-Tier)"
          value={formatBytes(FREE_POSTGRES_LIMIT, 0)}
          strong
        />

        <Divider />

        <CalcRow
          label="Pro Training"
          hint={`1 Session · Anwesenheit für ${teiln} Teilnehmer`}
          value={formatBytes(perTraining)}
        />
        <CalcRow
          label="Pro Woche"
          hint={`× ${sess} Trainings`}
          value={formatBytes(perWeek)}
        />
        <CalcRow
          label="Pro Jahr"
          hint="× 52 Wochen"
          value={formatBytes(perYear)}
        />
        <CalcRow
          label={`Pro Verein · ${years} ${years === 1 ? "Jahr" : "Jahre"}`}
          hint={`inkl. ${teiln} Teilnehmer-Kartei + Grundgerüst`}
          value={formatBytes(perVerein)}
          strong
        />

        <Divider />

        {/* Result */}
        <div className="pt-3 flex items-baseline gap-3 flex-wrap">
          <span className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground">
            = passt für
          </span>
          <span
            className="text-5xl sm:text-6xl font-bold tabular-nums leading-none text-primary"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            {isFinite(capacity) ? capacity.toLocaleString("de-DE") : "∞"}
          </span>
          <span className="font-sans text-sm text-muted-foreground">
            Free-Vereine
          </span>
        </div>
      </div>

      {/* ── Years slider ──────────────────────────────────────────── */}
      <div className="mt-6 pt-4 border-t border-border flex items-center gap-3">
        <span className="text-xs text-muted-foreground shrink-0">Simuliere:</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={years}
          onChange={(e) => setYears(parseInt(e.target.value, 10))}
          className="flex-1 accent-primary min-w-0"
        />
        <span className="tabular-nums font-semibold text-foreground text-xs shrink-0">
          {years} {years === 1 ? "Jahr" : "Jahre"}
        </span>
      </div>

      {freePlan.max_storage_bytes == null && (
        <p className="text-[11px] text-muted-foreground italic mt-4">
          Storage: nicht limitiert. Free-Vereine dürfen keine Dateien
          hochladen — nur externe Links (URLs).
        </p>
      )}

      <details className="mt-4 text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground select-none">
          Annahmen
        </summary>
        <ul className="list-disc list-inside space-y-1 mt-2 leading-relaxed">
          <li>Worst-case-Auslastung: jeder Free-Verein füllt seine Grenzen zu 100 % (alle Trainings finden statt, jeder Teilnehmer erscheint immer).</li>
          <li>Zeilenbreiten aus <code>pg_column_size</code> deiner echten DB (2026-07).</li>
          <li>Index-Overhead pauschal +50 % auf alle Rows.</li>
          <li>Bandwidth (5 GB/Monat) + Realtime nicht modelliert.</li>
        </ul>
      </details>
    </div>
  );
}

function CalcRow({
  label,
  hint,
  value,
  strong,
}: {
  label: string;
  hint?: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0 flex-1">
        <p
          className={`font-sans truncate ${
            strong ? "text-sm font-semibold text-foreground" : "text-sm text-foreground/85"
          }`}
        >
          {label}
        </p>
        {hint && (
          <p className="font-sans text-[10px] text-muted-foreground/80 truncate">
            {hint}
          </p>
        )}
      </div>
      <span
        className={`tabular-nums shrink-0 ${
          strong ? "text-base font-bold text-foreground" : "text-sm text-foreground/70"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-border/60 my-1" />;
}
