"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Club, PlanConfig } from "@/types";

type UsageRow = {
  label: string;
  used: number;
  limit: number | null;
  format?: (n: number) => string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function Bar({ pct, danger }: { pct: number; danger: boolean }) {
  const capped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative h-2 rounded-full bg-secondary overflow-hidden">
      <div
        className={`h-full rounded-full ${danger ? "bg-destructive" : "bg-primary"}`}
        style={{ width: `${capped}%` }}
      />
    </div>
  );
}

function isoMonday(): string {
  const d = new Date();
  const dow = d.getDay(); // 0=Sunday
  const diff = (dow + 6) % 7; // days back to Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export function UsagePanel({ club }: { club: Club }) {
  const [rows, setRows] = useState<UsageRow[] | null>(null);
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);

  useEffect(() => {
    if (club.plan === "unlimited") {
      // Defer setState so the effect isn't updating state in the same tick
      // it fires (react-hooks/set-state-in-effect).
      const id = setTimeout(() => setRows([]), 0);
      return () => clearTimeout(id);
    }

    const supabase = createClient();

    async function load() {
      const [
        { data: config },
        { count: teilCount },
        { count: staffCount },
        latestSnapshot,
        currentWeek,
      ] = await Promise.all([
        supabase
          .from("plan_config")
          .select("*")
          .eq("plan", club.plan)
          .single<PlanConfig>(),
        supabase
          .from("teilnehmer")
          .select("id", { count: "exact", head: true })
          .eq("club_id", club.id)
          .is("left_on", null),
        supabase
          .from("club_memberships")
          .select("user_id", { count: "exact", head: true })
          .eq("club_id", club.id)
          .eq("status", "active")
          .in("role", ["admin", "trainer"]),
        supabase
          .from("usage_snapshots")
          .select("storage_bytes")
          .eq("club_id", club.id)
          .order("taken_at", { ascending: false })
          .limit(1),
        (async () => {
          const monday = isoMonday();
          const { data: week } = await supabase
            .from("training_weeks")
            .select("id")
            .eq("club_id", club.id)
            .eq("week_start", monday)
            .maybeSingle();
          if (!week) return { data: 0 as number };
          const { count } = await supabase
            .from("training_sessions")
            .select("id", { count: "exact", head: true })
            .eq("week_id", week.id)
            .eq("kind", "training");
          return { data: count ?? 0 };
        })(),
      ]);

      if (!config) return;

      setPlanConfig(config);
      const storageBytes = Number(latestSnapshot.data?.[0]?.storage_bytes ?? 0);
      const built: UsageRow[] = [
        // Storage row only appears if this plan has a numeric cap. Free
        // plans (post-migration 032) have max_storage_bytes = NULL because
        // uploads are disabled entirely — no bar to draw.
        ...(config.max_storage_bytes != null
          ? [
              {
                label: "Speicher (Fotos, PDFs)",
                used: storageBytes,
                limit: config.max_storage_bytes,
                format: formatBytes,
              },
            ]
          : []),
        {
          label: "Aktive Teilnehmer",
          used: teilCount ?? 0,
          limit: config.max_teilnehmer,
        },
        {
          label: "Trainer & Admins",
          used: staffCount ?? 0,
          limit: config.max_staff,
        },
        {
          label: "Trainings diese Woche",
          used: currentWeek.data as number,
          limit: config.max_sessions_per_week,
        },
      ];
      setRows(built);
    }

    load();
  }, [club.id, club.plan]);

  if (club.plan === "unlimited") {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Unlimited
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Dieser Verein hat keine Nutzungsgrenzen.
        </p>
      </div>
    );
  }

  if (rows === null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Nutzung wird geladen …</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="font-bold tracking-tight text-base"
          style={{ fontFamily: "var(--font-syne, system-ui)" }}
        >
          Nutzung
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {planConfig?.plan === "free" ? "Free-Tarif" : planConfig?.plan}
        </span>
      </div>
      <div className="space-y-4">
        {rows.map((r) => {
          const limit = r.limit;
          if (limit == null) return null;
          const pct = limit > 0 ? (r.used / limit) * 100 : 0;
          const danger = pct >= 80;
          const fmt = r.format ?? ((n: number) => n.toLocaleString("de-DE"));
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-sm text-foreground">{r.label}</span>
                <span
                  className={`text-xs tabular-nums font-medium ${danger ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {fmt(r.used)} / {fmt(limit)}
                </span>
              </div>
              <Bar pct={pct} danger={danger} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
