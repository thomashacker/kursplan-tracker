import { describe, it, expect } from "vitest";
import { windowRange, mondayOnOrBefore } from "../dateRange";

// Helper: build a local-time Date so tests behave the same regardless of TZ.
function d(y: number, m: number, day: number, h = 12): Date {
  return new Date(y, m - 1, day, h, 0, 0, 0);
}

describe("windowRange", () => {
  describe("current_month", () => {
    it("starts at the 1st of the current month and ends at now", () => {
      const now = d(2026, 5, 15, 10);
      const { from, to } = windowRange("current_month", now);
      expect(from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
      expect(to).toEqual(now);
    });

    it("handles the 1st of the month (zero-length range)", () => {
      const now = d(2026, 5, 1, 0);
      const { from, to } = windowRange("current_month", now);
      expect(from).toEqual(new Date(2026, 4, 1, 0, 0, 0, 0));
      expect(to).toEqual(now);
    });
  });

  describe("last_month", () => {
    it("spans the previous calendar month fully", () => {
      const now = d(2026, 5, 15);
      const { from, to } = windowRange("last_month", now);
      expect(from).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0));
      expect(to).toEqual(new Date(2026, 4, 0, 23, 59, 59, 999));
      // The "to" is April 30 23:59:59.999
      expect(to.getMonth()).toBe(3); // April
      expect(to.getDate()).toBe(30);
    });

    it("crosses year boundary in January", () => {
      const now = d(2026, 1, 10);
      const { from, to } = windowRange("last_month", now);
      // December 2025
      expect(from.getFullYear()).toBe(2025);
      expect(from.getMonth()).toBe(11);
      expect(from.getDate()).toBe(1);
      expect(to.getFullYear()).toBe(2025);
      expect(to.getMonth()).toBe(11);
      expect(to.getDate()).toBe(31);
    });

    it("handles February in a leap year", () => {
      const now = d(2024, 3, 5); // March 2024
      const { from, to } = windowRange("last_month", now);
      expect(from.getMonth()).toBe(1); // February
      expect(to.getMonth()).toBe(1);
      expect(to.getDate()).toBe(29); // leap day
    });
  });

  describe("6m", () => {
    it("goes back six months and ends at now", () => {
      const now = d(2026, 5, 15);
      const { from, to } = windowRange("6m", now);
      expect(from.getFullYear()).toBe(2025);
      expect(from.getMonth()).toBe(10); // November
      expect(from.getDate()).toBe(15);
      expect(to).toEqual(now);
    });
  });

  describe("1y", () => {
    it("goes back one year and ends at now", () => {
      const now = d(2026, 5, 15);
      const { from, to } = windowRange("1y", now);
      expect(from.getFullYear()).toBe(2025);
      expect(from.getMonth()).toBe(4);
      expect(from.getDate()).toBe(15);
      expect(to).toEqual(now);
    });
  });
});

describe("mondayOnOrBefore", () => {
  it("returns the same date when given a Monday", () => {
    // 2026-05-11 is a Monday
    expect(mondayOnOrBefore(d(2026, 5, 11))).toBe("2026-05-11");
  });

  it("returns the previous Monday for a Tuesday", () => {
    expect(mondayOnOrBefore(d(2026, 5, 12))).toBe("2026-05-11");
  });

  it("returns the previous Monday for a Sunday", () => {
    // 2026-05-17 is a Sunday → 6 days back
    expect(mondayOnOrBefore(d(2026, 5, 17))).toBe("2026-05-11");
  });

  it("returns the previous Monday for a Saturday", () => {
    // 2026-05-16 is a Saturday → 5 days back
    expect(mondayOnOrBefore(d(2026, 5, 16))).toBe("2026-05-11");
  });

  it("rolls back across a month boundary", () => {
    // 2026-06-02 is a Tuesday → 2026-06-01 (Monday)
    expect(mondayOnOrBefore(d(2026, 6, 2))).toBe("2026-06-01");
    // 2026-06-01 is a Monday — but 2026-05-31 (Sunday) should roll to 2026-05-25
    expect(mondayOnOrBefore(d(2026, 5, 31))).toBe("2026-05-25");
  });

  it("rolls back across a year boundary", () => {
    // 2026-01-01 is a Thursday → previous Monday is 2025-12-29
    expect(mondayOnOrBefore(d(2026, 1, 1))).toBe("2025-12-29");
  });

  it("ignores the time component", () => {
    expect(mondayOnOrBefore(d(2026, 5, 11, 0))).toBe("2026-05-11");
    expect(mondayOnOrBefore(d(2026, 5, 11, 23))).toBe("2026-05-11");
  });
});
