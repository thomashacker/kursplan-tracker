import type { TrainerAvailability, AbsenceReason } from "@/types";
import { ABSENCE_REASON_LABELS } from "@/types";

/**
 * Trainer availability lookup — pure functions over ISO date strings.
 *
 * Windows are inclusive on both ends. String comparison works because
 * dates are always in YYYY-MM-DD format.
 */

export interface AbsenceHit {
  window: TrainerAvailability;
  reasonLabel: string;
  /** end_date + 1 day, ISO — the first day the trainer is back. */
  returnsOn: string;
}

/** True when `iso` (YYYY-MM-DD) is on or between the window's dates. */
export function dateInWindow(iso: string, w: TrainerAvailability): boolean {
  return iso >= w.start_date && iso <= w.end_date;
}

/** Add N days to an ISO date, returns ISO. TZ-safe (parses at midnight local). */
export function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Look up the trainer's active absence for a given date. */
export function findAbsenceOn(
  windows: TrainerAvailability[] | undefined,
  iso: string,
): AbsenceHit | null {
  if (!windows?.length) return null;
  const hit = windows.find((w) => dateInWindow(iso, w));
  if (!hit) return null;
  return {
    window: hit,
    reasonLabel: ABSENCE_REASON_LABELS[hit.reason],
    returnsOn: isoAddDays(hit.end_date, 1),
  };
}

/** Bucket a flat list of windows by target id (user_id OR virtual_trainer_id). */
export function bucketWindows(
  windows: TrainerAvailability[],
): Record<string, TrainerAvailability[]> {
  const out: Record<string, TrainerAvailability[]> = {};
  for (const w of windows) {
    const key = w.user_id ?? w.virtual_trainer_id;
    if (!key) continue;
    (out[key] ??= []).push(w);
  }
  // Sort each bucket by start_date so "current + next" ordering is stable.
  for (const arr of Object.values(out)) {
    arr.sort((a, b) => a.start_date.localeCompare(b.start_date));
  }
  return out;
}

/** Format "DD.MM." for a compact "bis TT.MM." UI hint. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

/** Compose the picker suffix, e.g. "Krank bis 12.03." */
export function absenceSuffix(hit: AbsenceHit): string {
  return `${hit.reasonLabel} bis ${shortDate(hit.window.end_date)}`;
}

/** All active absences for a given date, keyed by trainer id — useful in list views. */
export function absencesOn(
  bucketed: Record<string, TrainerAvailability[]>,
  iso: string,
): Record<string, AbsenceHit> {
  const out: Record<string, AbsenceHit> = {};
  for (const [id, windows] of Object.entries(bucketed)) {
    const hit = findAbsenceOn(windows, iso);
    if (hit) out[id] = hit;
  }
  return out;
}

/** Re-export for callers that only import from this module. */
export type { AbsenceReason };
