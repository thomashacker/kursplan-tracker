import { toISODate } from "@/lib/utils/date";
import type { TimeWindow } from "./TimeWindowPicker";

/**
 * Calendar range for the selected time window.
 *
 * - `current_month` / `6m` / `1y`: `to` = `now`, so partially-elapsed periods
 *   end at the current moment.
 * - `last_month`: `to` = the last millisecond of the previous calendar month
 *   (uses `new Date(year, month, 0)`, where day 0 wraps to the prior month).
 * - `custom`: `from`/`to` come from URL params (YYYY-MM-DD). If either is
 *   missing or malformed, the function falls back to `current_month`.
 *
 * `now` defaults to `new Date()` and is overridable for tests.
 */
export function windowRange(
  w: TimeWindow,
  now: Date = new Date(),
  customFromISO?: string,
  customToISO?: string,
): { from: Date; to: Date } {
  switch (w) {
    case "current_month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { from, to: now };
    }
    case "last_month": {
      const from = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
        0,
        0,
        0,
        0,
      );
      const to = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );
      return { from, to };
    }
    case "6m": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 6);
      return { from, to: now };
    }
    case "1y": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from, to: now };
    }
    case "custom": {
      const from = parseISODateLocal(customFromISO);
      const to = parseISODateLocal(customToISO, /* endOfDay */ true);
      if (!from || !to || from > to) {
        // Malformed / inverted range → safe fallback.
        return windowRange("current_month", now);
      }
      return { from, to };
    }
  }
}

/** ISO date (YYYY-MM-DD) of the Monday on or before `d`. */
export function mondayOnOrBefore(d: Date): string {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const back = (day + 6) % 7; // days since the most recent Monday
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - back);
  return toISODate(m);
}

/** Parse a YYYY-MM-DD string in local time. Returns null on bad input. */
function parseISODateLocal(iso: string | undefined, endOfDay = false): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
}

const MONTH_NAMES_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Compact label for a time window — used as the button text in
 * `TimeWindowPicker`. For `current_month`/`last_month` this is just the month
 * name (with year appended only when it differs from the current year, so
 * "Dezember '25" appears in January 2026 but "Juni" in July 2026).
 */
export function windowShortLabel(
  w: TimeWindow,
  now: Date = new Date(),
): string {
  switch (w) {
    case "current_month":
      return MONTH_NAMES_DE[now.getMonth()];
    case "last_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const name = MONTH_NAMES_DE[d.getMonth()];
      return d.getFullYear() === now.getFullYear()
        ? name
        : `${name} '${String(d.getFullYear()).slice(-2)}`;
    }
    case "6m":
      return "6 Monate";
    case "1y":
      return "1 Jahr";
    case "custom":
      return "Individuell";
  }
}

/**
 * Descriptive label for the page subtitle. Same shape as `windowShortLabel`
 * for month-based windows but with fuller phrasing for ranges.
 */
export function windowLongLabel(
  w: TimeWindow,
  now: Date = new Date(),
): string {
  switch (w) {
    case "current_month":
    case "last_month":
      return windowShortLabel(w, now);
    case "6m":
      return "letzte 6 Monate";
    case "1y":
      return "letztes Jahr";
    case "custom":
      return "individuell";
  }
}
