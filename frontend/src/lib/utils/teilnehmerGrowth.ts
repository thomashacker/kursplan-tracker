import type { Teilnehmer } from "@/types";

/**
 * Growth math over the Teilnehmer roster. All pure — string dates in
 * YYYY-MM-DD compare lexicographically.
 */

/** Was this teilnehmer active *on* the given date? */
export function wasActiveOn(t: Pick<Teilnehmer, "joined_on" | "left_on">, iso: string): boolean {
  if (t.joined_on > iso) return false;
  if (t.left_on !== null && t.left_on <= iso) return false;
  return true;
}

/** Roster size on a given date. */
export function totalAt(roster: Pick<Teilnehmer, "joined_on" | "left_on">[], iso: string): number {
  let n = 0;
  for (const t of roster) if (wasActiveOn(t, iso)) n++;
  return n;
}

export interface GrowthDelta {
  /** Roster size at the start of the period (inclusive). */
  startCount: number;
  /** Roster size at the end of the period (inclusive). */
  endCount: number;
  /** Teilnehmer whose joined_on falls in [from, to]. */
  joined: number;
  /** Teilnehmer whose left_on falls in [from, to]. */
  left: number;
  /** endCount - startCount. */
  net: number;
  /**
   * Percent change vs startCount. NULL when startCount == 0 (avoids
   * misleading "∞%" jumps from an empty baseline).
   */
  netPct: number | null;
}

/** Growth between two dates. `from`/`to` are ISO YYYY-MM-DD, both inclusive. */
export function growthBetween(
  roster: Pick<Teilnehmer, "joined_on" | "left_on">[],
  from: string,
  to: string,
): GrowthDelta {
  let joined = 0;
  let left = 0;
  for (const t of roster) {
    if (t.joined_on >= from && t.joined_on <= to) joined++;
    if (t.left_on !== null && t.left_on >= from && t.left_on <= to) left++;
  }
  const startCount = totalAt(roster, from);
  const endCount = totalAt(roster, to);
  const net = endCount - startCount;
  const netPct = startCount === 0 ? null : (net / startCount) * 100;
  return { startCount, endCount, joined, left, net, netPct };
}

/** Format a signed delta with sign: 0 → "0", +3 → "+3", -2 → "−2" (Unicode minus). */
export function formatDelta(n: number): string {
  if (n === 0) return "0";
  if (n > 0) return `+${n}`;
  return `−${Math.abs(n)}`;
}

/** Format a percent with sign, rounded, "—" when null. */
export function formatPct(p: number | null): string {
  if (p === null) return "—";
  const rounded = Math.round(p);
  if (rounded === 0) return "0 %";
  if (rounded > 0) return `+${rounded} %`;
  return `−${Math.abs(rounded)} %`;
}
