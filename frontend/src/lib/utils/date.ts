/**
 * Date utilities for the weekly plan.
 */

/** Format "2024-01-15" → "15.01.2024" (German date format) */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

/** Format time "18:00:00" → "18:00" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Get the Monday of the current calendar week.
 * Returns ISO date string "YYYY-MM-DD".
 */
export function getCurrentMonday(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return toISODate(monday);
}

/** Offset a week Monday by N weeks */
export function offsetWeek(mondayIso: string, weeks: number): string {
  const d = new Date(mondayIso + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return toISODate(d);
}

/** Get date for a specific day within a week (0=Mon offset from week_start) */
export function getSessionDate(weekStart: string, dayOfWeek: number): Date {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + dayOfWeek);
  return d;
}

/** Format a week range: "14.04. – 20.04.2025" */
export function formatWeekRange(mondayIso: string): string {
  const monday = new Date(mondayIso + "T00:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
  return `${fmt(monday)} – ${fmt(sunday)}${sunday.getFullYear()}`;
}

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
