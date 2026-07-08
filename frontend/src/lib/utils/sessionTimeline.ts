import type { TrainingSession } from "@/types";

/**
 * Pure helpers that reason about session/event visibility and ordering.
 * All string dates are YYYY-MM-DD so lexicographic comparison works.
 */

/** True for events and pinned trainings — always visible in the public view. */
export function isEventOrPinned(s: Pick<TrainingSession, "kind" | "is_pinned">): boolean {
  return s.kind === "event" || s.is_pinned;
}

/**
 * The date the session appears on the timeline. Events use event_date;
 * trainings derive it from their week_start + day_of_week (0=Mon).
 */
export function timelineDate(
  s: Pick<TrainingSession, "kind" | "event_date" | "day_of_week">,
  weekStart: string,
): string {
  if (s.kind === "event" && s.event_date) return s.event_date;
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + (s.day_of_week ?? 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Public filter: applies `predicate` normally, but always keeps events and
 * pinned trainings — they must not vanish when filters are active.
 */
export function keepIfEventOrMatches<T extends Pick<TrainingSession, "kind" | "is_pinned">>(
  s: T,
  predicate: (s: T) => boolean,
): boolean {
  return isEventOrPinned(s) || predicate(s);
}
