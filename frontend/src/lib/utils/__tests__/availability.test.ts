import { describe, it, expect } from "vitest";
import {
  dateInWindow,
  isoAddDays,
  findAbsenceOn,
  bucketWindows,
  shortDate,
  absenceSuffix,
  absencesOn,
} from "../availability";
import type { TrainerAvailability } from "@/types";

function mkWindow(overrides: Partial<TrainerAvailability> = {}): TrainerAvailability {
  return {
    id: "w-1",
    club_id: "c-1",
    user_id: "u-1",
    virtual_trainer_id: null,
    start_date: "2025-04-10",
    end_date: "2025-04-15",
    reason: "sick",
    note: null,
    created_by: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("dateInWindow", () => {
  const w = mkWindow();
  it("true for start boundary", () => expect(dateInWindow("2025-04-10", w)).toBe(true));
  it("true for end boundary",   () => expect(dateInWindow("2025-04-15", w)).toBe(true));
  it("true for interior day",   () => expect(dateInWindow("2025-04-12", w)).toBe(true));
  it("false before start",      () => expect(dateInWindow("2025-04-09", w)).toBe(false));
  it("false after end",         () => expect(dateInWindow("2025-04-16", w)).toBe(false));
});

describe("isoAddDays", () => {
  it("adds one day", () => expect(isoAddDays("2025-04-15", 1)).toBe("2025-04-16"));
  it("crosses month boundary", () => expect(isoAddDays("2025-04-30", 1)).toBe("2025-05-01"));
  it("crosses year boundary", () => expect(isoAddDays("2025-12-31", 1)).toBe("2026-01-01"));
  it("subtracts days", () => expect(isoAddDays("2025-04-01", -1)).toBe("2025-03-31"));
});

describe("findAbsenceOn", () => {
  const windows = [
    mkWindow({ id: "w-a", start_date: "2025-04-10", end_date: "2025-04-15", reason: "sick" }),
    mkWindow({ id: "w-b", start_date: "2025-05-01", end_date: "2025-05-14", reason: "vacation" }),
  ];

  it("returns null for empty list", () => {
    expect(findAbsenceOn([], "2025-04-12")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(findAbsenceOn(undefined, "2025-04-12")).toBeNull();
  });

  it("finds the covering window", () => {
    const hit = findAbsenceOn(windows, "2025-04-12");
    expect(hit?.window.id).toBe("w-a");
    expect(hit?.reasonLabel).toBe("Krank");
    expect(hit?.returnsOn).toBe("2025-04-16");
  });

  it("finds the second window", () => {
    const hit = findAbsenceOn(windows, "2025-05-08");
    expect(hit?.window.id).toBe("w-b");
    expect(hit?.reasonLabel).toBe("Urlaub");
    expect(hit?.returnsOn).toBe("2025-05-15");
  });

  it("returns null between windows", () => {
    expect(findAbsenceOn(windows, "2025-04-20")).toBeNull();
  });
});

describe("bucketWindows", () => {
  it("buckets by user_id and virtual_trainer_id", () => {
    const rows: TrainerAvailability[] = [
      mkWindow({ id: "1", user_id: "u1", virtual_trainer_id: null, start_date: "2025-05-01", end_date: "2025-05-05" }),
      mkWindow({ id: "2", user_id: "u1", virtual_trainer_id: null, start_date: "2025-04-01", end_date: "2025-04-05" }),
      mkWindow({ id: "3", user_id: null, virtual_trainer_id: "vt1", start_date: "2025-03-01", end_date: "2025-03-05" }),
    ];
    const bucketed = bucketWindows(rows);
    expect(Object.keys(bucketed).sort()).toEqual(["u1", "vt1"]);
    expect(bucketed.u1.map((w) => w.id)).toEqual(["2", "1"]); // sorted ascending
    expect(bucketed.vt1.map((w) => w.id)).toEqual(["3"]);
  });

  it("skips rows with neither id (defensive)", () => {
    const rows: TrainerAvailability[] = [
      mkWindow({ id: "x", user_id: null, virtual_trainer_id: null }),
    ];
    expect(bucketWindows(rows)).toEqual({});
  });
});

describe("shortDate + absenceSuffix", () => {
  it("formats short date", () => expect(shortDate("2025-04-05")).toBe("05.04."));
  it("builds picker suffix", () => {
    const hit = findAbsenceOn([mkWindow({ end_date: "2025-04-15", reason: "vacation" })], "2025-04-12")!;
    expect(absenceSuffix(hit)).toBe("Urlaub bis 15.04.");
  });
});

describe("absencesOn", () => {
  it("returns only trainers absent on the given date", () => {
    const bucketed = bucketWindows([
      mkWindow({ id: "1", user_id: "u1", start_date: "2025-04-10", end_date: "2025-04-15" }),
      mkWindow({ id: "2", user_id: "u2", start_date: "2025-04-20", end_date: "2025-04-25" }),
      mkWindow({ id: "3", user_id: null, virtual_trainer_id: "vt1", start_date: "2025-04-12", end_date: "2025-04-12" }),
    ]);
    const hits = absencesOn(bucketed, "2025-04-12");
    expect(Object.keys(hits).sort()).toEqual(["u1", "vt1"]);
    expect(hits.u1.window.id).toBe("1");
    expect(hits.vt1.window.id).toBe("3");
  });
});
