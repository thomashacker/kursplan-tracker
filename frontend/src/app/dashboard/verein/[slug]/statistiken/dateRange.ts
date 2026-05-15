import { toISODate } from "@/lib/utils/date";
import type { TimeWindow } from "./TimeWindowPicker";

/**
 * Calendar range for the selected time window.
 *
 * - `current_month` / `6m` / `1y`: `to` = `now`, so partially-elapsed periods
 *   end at the current moment.
 * - `last_month`: `to` = the last millisecond of the previous calendar month
 *   (uses `new Date(year, month, 0)`, where day 0 wraps to the prior month).
 *
 * `now` defaults to `new Date()` and is overridable for tests.
 */
export function windowRange(
  w: TimeWindow,
  now: Date = new Date(),
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
