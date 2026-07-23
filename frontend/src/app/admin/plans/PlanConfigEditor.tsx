"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { PlanConfig } from "@/types";
import { CapacityCalculator } from "./CapacityCalculator";

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
        can_upload_files: plan.can_upload_files,
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

  function updateBoolField(planName: string, key: keyof PlanConfig, value: boolean) {
    setRows((rs) =>
      rs.map((r) => (r.plan === planName ? { ...r, [key]: value } : r)),
    );
  }

  const freeRow = rows.find((r) => r.plan === "free");
  const unlimitedRow = rows.find((r) => r.plan === "unlimited");

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      {/* ── Free plan editor (dominant, left column on desktop) ─── */}
      {freeRow && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="font-bold text-lg leading-none"
                style={{ fontFamily: "var(--font-syne, system-ui)" }}
              >
                Free-Tarif
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Standard für neu registrierte Nutzer
              </p>
            </div>
            <button
              type="button"
              onClick={() => save(freeRow)}
              disabled={saving === freeRow.plan}
              className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
            >
              {saving === freeRow.plan ? "Speichert …" : "Speichern"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key as string}>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {f.label}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={f.format(freeRow[f.key] as number | null)}
                  onChange={(e) => updateField(freeRow.plan, f.key, f.parse(e.target.value))}
                  placeholder={f.hint}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:border-ring focus:ring-3 focus:ring-ring/50 outline-none transition-all"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1">{f.hint}</p>
              </div>
            ))}
          </div>

          {/* Boolean flag — datei uploads. Own row because it's the single
              biggest cost lever, distinct from numeric caps. */}
          <label className="mt-4 flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={freeRow.can_upload_files}
              onChange={(e) => updateBoolField(freeRow.plan, "can_upload_files", e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">
                Datei-Uploads erlauben
              </span>
              <span className="block text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Bilder + PDFs. Wenn aus: nur externe Links (URLs) sind erlaubt —
                Storage-Kosten bleiben bei 0.
              </span>
            </span>
          </label>

          {/* Unlimited plan lives here as a small collapsed detail —
              its values are all NULL and rarely need editing. */}
          {unlimitedRow && (
            <details className="mt-5 pt-4 border-t border-border">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                Unlimited-Tarif bearbeiten (alle NULL = kein Cap)
              </summary>
              <div className="grid grid-cols-2 gap-3 mt-4">
                {FIELDS.map((f) => (
                  <div key={f.key as string}>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      {f.label}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={f.format(unlimitedRow[f.key] as number | null)}
                      onChange={(e) => updateField(unlimitedRow.plan, f.key, f.parse(e.target.value))}
                      placeholder="leer = kein Cap"
                      className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm tabular-nums focus:border-ring focus:ring-3 focus:ring-ring/50 outline-none transition-all"
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => save(unlimitedRow)}
                disabled={saving === unlimitedRow.plan}
                className="mt-3 h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
              >
                {saving === unlimitedRow.plan ? "Speichert …" : "Unlimited speichern"}
              </button>
            </details>
          )}
        </div>
      )}

      {/* ── Calculator (right column on desktop, stacks on mobile) ─── */}
      <CapacityCalculator plans={rows} />
    </div>
  );
}
