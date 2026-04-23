import { describe, it, expect } from "vitest";

// Inlined from PublicPlanClient (pure function, no React deps)
function toISODate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getCalendarGrid(year: number, month: number): (string | null)[] {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (string | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(toISODate(year, month, d));
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

describe("getCalendarGrid", () => {
  it("grid length is always a multiple of 7", () => {
    for (let m = 0; m < 12; m++) {
      const grid = getCalendarGrid(2025, m);
      expect(grid.length % 7).toBe(0);
    }
  });

  it("April 2025 starts on Tuesday (index 1 is first null-free entry)", () => {
    // April 1 2025 is a Tuesday → Mon=0, Tue=1 → one leading null
    const grid = getCalendarGrid(2025, 3); // month=3 → April
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBe("2025-04-01");
  });

  it("January 2025 starts on Wednesday → two leading nulls", () => {
    // Jan 1 2025 is a Wednesday → Mon=0, Tue=1, Wed=2 → two leading nulls
    const grid = getCalendarGrid(2025, 0);
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBeNull();
    expect(grid[2]).toBe("2025-01-01");
  });

  it("contains correct number of real days", () => {
    const grid = getCalendarGrid(2025, 1); // February 2025 (28 days)
    const real = grid.filter(Boolean);
    expect(real.length).toBe(28);
  });

  it("last real entry is the last day of the month", () => {
    const grid = getCalendarGrid(2025, 3); // April = 30 days
    const real = grid.filter(Boolean) as string[];
    expect(real[real.length - 1]).toBe("2025-04-30");
  });

  it("Monday-first: day headers align (Mon slot = index % 7 === 0)", () => {
    // March 2025: March 1 is Saturday (JS day=6) → (6+6)%7=5 → 5 leading nulls
    const grid = getCalendarGrid(2025, 2);
    const leadingNulls = grid.findIndex((x) => x !== null);
    expect(leadingNulls).toBe(5);
    expect(grid[5]).toBe("2025-03-01");
  });
});
