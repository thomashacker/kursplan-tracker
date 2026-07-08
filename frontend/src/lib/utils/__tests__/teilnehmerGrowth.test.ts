import { describe, it, expect } from "vitest";
import {
  wasActiveOn,
  totalAt,
  growthBetween,
  formatDelta,
  formatPct,
} from "../teilnehmerGrowth";

function mk(joined: string, left: string | null = null) {
  return { joined_on: joined, left_on: left };
}

describe("wasActiveOn", () => {
  const t = mk("2025-04-10", "2025-05-20");
  it("false before joined", () => expect(wasActiveOn(t, "2025-04-09")).toBe(false));
  it("true on join date", () => expect(wasActiveOn(t, "2025-04-10")).toBe(true));
  it("true mid-period", () => expect(wasActiveOn(t, "2025-05-01")).toBe(true));
  it("false on left date (already gone)", () => expect(wasActiveOn(t, "2025-05-20")).toBe(false));
  it("false after left", () => expect(wasActiveOn(t, "2025-06-01")).toBe(false));

  it("open-ended: still active with null left_on", () => {
    expect(wasActiveOn(mk("2025-01-01"), "2099-01-01")).toBe(true);
  });
});

describe("totalAt", () => {
  const roster = [
    mk("2025-01-01"),                 // active forever
    mk("2025-03-01", "2025-04-01"),   // gone
    mk("2025-05-01"),                 // future join
  ];
  it("counts everyone active on 2025-02-01", () => expect(totalAt(roster, "2025-02-01")).toBe(1));
  it("counts overlap on 2025-03-15", () => expect(totalAt(roster, "2025-03-15")).toBe(2));
  it("counts after mid-departure on 2025-04-15", () => expect(totalAt(roster, "2025-04-15")).toBe(1));
  it("counts after new join on 2025-06-01", () => expect(totalAt(roster, "2025-06-01")).toBe(2));
  it("empty roster returns 0", () => expect(totalAt([], "2025-01-01")).toBe(0));
});

describe("growthBetween", () => {
  it("no changes in period", () => {
    const r = [mk("2024-01-01")];
    expect(growthBetween(r, "2025-04-01", "2025-04-30")).toEqual({
      startCount: 1, endCount: 1, joined: 0, left: 0, net: 0, netPct: 0,
    });
  });

  it("only joins", () => {
    const r = [mk("2024-01-01"), mk("2025-04-10"), mk("2025-04-20")];
    const d = growthBetween(r, "2025-04-01", "2025-04-30");
    expect(d.joined).toBe(2);
    expect(d.left).toBe(0);
    expect(d.startCount).toBe(1);
    expect(d.endCount).toBe(3);
    expect(d.net).toBe(2);
    expect(d.netPct).toBe(200);
  });

  it("only leaves", () => {
    const r = [mk("2024-01-01", "2025-04-15"), mk("2024-02-01")];
    const d = growthBetween(r, "2025-04-01", "2025-04-30");
    expect(d.joined).toBe(0);
    expect(d.left).toBe(1);
    expect(d.net).toBe(-1);
    expect(d.netPct).toBe(-50);
  });

  it("mixed churn", () => {
    const r = [
      mk("2024-01-01"),               // baseline active
      mk("2024-06-01", "2025-04-05"), // left in period
      mk("2025-04-10"),               // joined in period
      mk("2025-04-15", "2025-04-20"), // joined & left in period (net 0 flow but +1 joined +1 left)
    ];
    const d = growthBetween(r, "2025-04-01", "2025-04-30");
    expect(d.joined).toBe(2);
    expect(d.left).toBe(2);
    expect(d.startCount).toBe(2);
    expect(d.endCount).toBe(2);
    expect(d.net).toBe(0);
    expect(d.netPct).toBe(0);
  });

  it("null netPct when starting from empty", () => {
    const r = [mk("2025-04-15")];
    const d = growthBetween(r, "2025-04-01", "2025-04-30");
    expect(d.startCount).toBe(0);
    expect(d.endCount).toBe(1);
    expect(d.netPct).toBeNull();
  });
});

describe("formatDelta", () => {
  it("zero", () => expect(formatDelta(0)).toBe("0"));
  it("positive", () => expect(formatDelta(3)).toBe("+3"));
  it("negative uses Unicode minus", () => expect(formatDelta(-2)).toBe("−2"));
});

describe("formatPct", () => {
  it("null", () => expect(formatPct(null)).toBe("—"));
  it("zero", () => expect(formatPct(0)).toBe("0 %"));
  it("positive rounds", () => expect(formatPct(4.6)).toBe("+5 %"));
  it("negative uses Unicode minus", () => expect(formatPct(-12.3)).toBe("−12 %"));
});
