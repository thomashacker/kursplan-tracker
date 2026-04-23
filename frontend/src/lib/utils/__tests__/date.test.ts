import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatTime,
  offsetWeek,
  getSessionDate,
  formatWeekRange,
  toISODate,
  getCurrentMonday,
} from "../date";

describe("formatDate", () => {
  it("formats ISO date to German format", () => {
    expect(formatDate("2025-04-14")).toBe("14.04.2025");
  });
  it("pads single-digit day and month", () => {
    expect(formatDate("2025-01-05")).toBe("05.01.2025");
  });
});

describe("formatTime", () => {
  it("strips seconds from HH:MM:SS", () => {
    expect(formatTime("18:00:00")).toBe("18:00");
  });
  it("returns HH:MM unchanged when no seconds", () => {
    expect(formatTime("09:30")).toBe("09:30");
  });
});

describe("toISODate", () => {
  it("returns YYYY-MM-DD", () => {
    expect(toISODate(new Date("2025-04-14T00:00:00"))).toBe("2025-04-14");
  });
  it("pads month and day", () => {
    expect(toISODate(new Date("2025-01-05T00:00:00"))).toBe("2025-01-05");
  });
});

describe("offsetWeek", () => {
  it("adds 1 week", () => {
    expect(offsetWeek("2025-04-14", 1)).toBe("2025-04-21");
  });
  it("subtracts weeks with negative offset", () => {
    expect(offsetWeek("2025-04-14", -1)).toBe("2025-04-07");
  });
  it("handles month boundary", () => {
    expect(offsetWeek("2025-04-28", 1)).toBe("2025-05-05");
  });
  it("zero offset returns same date", () => {
    expect(offsetWeek("2025-04-14", 0)).toBe("2025-04-14");
  });
  it("offsets by 9 weeks (used for public view range)", () => {
    expect(offsetWeek("2025-04-14", 9)).toBe("2025-06-16");
  });
});

describe("getSessionDate", () => {
  it("dayOfWeek 0 returns the Monday itself", () => {
    const d = getSessionDate("2025-04-14", 0);
    expect(toISODate(d)).toBe("2025-04-14");
  });
  it("dayOfWeek 4 returns Friday", () => {
    const d = getSessionDate("2025-04-14", 4);
    expect(toISODate(d)).toBe("2025-04-18");
  });
  it("dayOfWeek 6 returns Sunday", () => {
    const d = getSessionDate("2025-04-14", 6);
    expect(toISODate(d)).toBe("2025-04-20");
  });
});

describe("formatWeekRange", () => {
  it("formats a full week range", () => {
    expect(formatWeekRange("2025-04-14")).toBe("14.04. – 20.04.2025");
  });
  it("handles month-spanning weeks", () => {
    expect(formatWeekRange("2025-04-28")).toBe("28.04. – 04.05.2025");
  });
});

describe("getCurrentMonday", () => {
  it("always returns a Monday (getDay() === 1)", () => {
    const iso = getCurrentMonday();
    const d = new Date(iso + "T00:00:00");
    expect(d.getDay()).toBe(1);
  });
  it("returns a valid ISO date string", () => {
    const iso = getCurrentMonday();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
