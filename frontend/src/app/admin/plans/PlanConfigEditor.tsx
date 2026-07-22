"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { PlanConfig } from "@/types";

const FIELDS: {
  key: keyof PlanConfig;
  label: string;
  hint: string;
  parse: (v: string) => number | null;
  format: (n: number | null) => string;
}[] = [
  {
    key: "max_clubs_per_user",
    label: "Vereine pro User",
    hint: "leer = keine Grenze",
    parse: (v) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0)),
    format: (n) => (n == null ? "" : String(n)),
  },
  {
    key: "max_storage_bytes",
    label: "Speicher (MB)",
    hint: "Bytes werden hier als MB angezeigt",
    parse: (v) => (v.trim() === "" ? null : Math.max(0, parseFloat(v) * 1024 * 1024)),
    format: (n) => (n == null ? "" : String(Math.round(n / (1024 * 1024)))),
  },
  {
    key: "max_teilnehmer",
    label: "Teilnehmer aktiv",
    hint: "left_on IS NULL",
    parse: (v) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0)),
    format: (n) => (n == null ? "" : String(n)),
  },
  {
    key: "max_staff",
    label: "Trainer & Admins",
    hint: "aktive Rolle",
    parse: (v) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0)),
    format: (n) => (n == null ? "" : String(n)),
  },
  {
    key: "max_sessions_per_week",
    label: "Trainings / Woche",
    hint: "kind='training'",
    parse: (v) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0)),
    format: (n) => (n == null ? "" : String(n)),
  },
  {
    key: "max_media_per_session",
    label: "Medien / Session",
    hint: "clientseitig gecapped",
    parse: (v) => (v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0)),
    format: (n) => (n == null ? "" : String(n)),
  },
];

export function PlanConfigEditor({ plans }: { plans: PlanConfig[] }) {
  const supabase = createClient();
  const [rows, setRows] = useState<PlanConfig[]>(plans);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(plan: PlanConfig) {
    setSaving(plan.plan);
    const { error } = await supabase
      .from("plan_config")
      .update({
        max_clubs_per_user: plan.max_clubs_per_user,
        max_storage_bytes: plan.max_storage_bytes,
        max_teilnehmer: plan.max_teilnehmer,
        max_staff: plan.max_staff,
        max_sessions_per_week: plan.max_sessions_per_week,
        max_media_per_session: plan.max_media_per_session,
        updated_at: new Date().toISOString(),
      })
      .eq("plan", plan.plan);
    setSaving(null);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${plan.plan} gespeichert`);
    }
  }

  function updateField(planName: string, key: keyof PlanConfig, value: number | null) {
    setRows((rs) =>
      rs.map((r) => (r.plan === planName ? { ...r, [key]: value } : r)),
    );
  }

  return (
    <div className="space-y-6">
      {rows.map((row) => (
        <div key={row.plan} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="font-bold text-lg"
              style={{ fontFamily: "var(--font-syne, system-ui)" }}
            >
              {row.plan}
            </h2>
            <button
              type="button"
              onClick={() => save(row)}
              disabled={saving === row.plan}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving === row.plan ? "Speichert …" : "Speichern"}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key as string}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {f.label}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={f.format(row[f.key] as number | null)}
                  onChange={(e) =>
                    updateField(row.plan, f.key, f.parse(e.target.value))
                  }
                  placeholder={f.hint}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:border-ring focus:ring-3 focus:ring-ring/50 outline-none transition-all"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">{f.hint}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
