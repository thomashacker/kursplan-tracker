import { describe, it, expect } from "vitest";

// ── Mirror of group attendance rate computation in statistiken/page.tsx ───────
//
// Given:
//   groups:          { id: string; name: string; color: string | null }[]
//   groupMemberMap:  Map<groupId, Set<teilnehmerId>>
//   sessions:        { id: string }[]
//   sessionGroupMap: Map<sessionId, Set<groupId>>   (from session_expected_groups)
//   sessionPresent:  Map<sessionId, Set<teilnehmerId>>  (present attendance)
//
// Returns: { name, color, rate, actual, expected }[]  sorted by rate desc

interface GroupStat {
  name: string;
  color: string | null;
  rate: number;
  actual: number;
  expected: number;
}

function computeGroupAttendanceRates(
  groups: { id: string; name: string; color: string | null }[],
  groupMemberMap: Map<string, Set<string>>,
  sessions: { id: string }[],
  sessionGroupMap: Map<string, Set<string>>,
  sessionPresentMap: Map<string, Set<string>>,
): GroupStat[] {
  const stats: GroupStat[] = [];

  for (const g of groups) {
    const members = groupMemberMap.get(g.id) ?? new Set<string>();
    if (members.size === 0) continue;

    const expectedSessions = sessions.filter((s) => sessionGroupMap.get(s.id)?.has(g.id));
    if (expectedSessions.length === 0) continue;

    const expectedTotal = expectedSessions.length * members.size;
    let actualPresent = 0;
    for (const s of expectedSessions) {
      const presentSet = sessionPresentMap.get(s.id) ?? new Set<string>();
      for (const memberId of members) {
        if (presentSet.has(memberId)) actualPresent++;
      }
    }

    stats.push({
      name: g.name,
      color: g.color ?? null,
      rate: expectedTotal > 0 ? actualPresent / expectedTotal : 0,
      actual: actualPresent,
      expected: expectedTotal,
    });
  }

  return stats.sort((a, b) => b.rate - a.rate);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeGroupAttendanceRates", () => {
  it("returns empty array when no groups", () => {
    expect(computeGroupAttendanceRates([], new Map(), [], new Map(), new Map())).toEqual([]);
  });

  it("skips groups with no members", () => {
    const groups = [{ id: "g1", name: "Anfänger", color: null }];
    const result = computeGroupAttendanceRates(groups, new Map(), [{ id: "s1" }], new Map(), new Map());
    expect(result).toHaveLength(0);
  });

  it("skips groups not assigned to any session", () => {
    const groups = [{ id: "g1", name: "Fortgeschrittene", color: "#f00" }];
    const memberMap = new Map([["g1", new Set(["t1", "t2"])]]);
    // sessionGroupMap has s1, but g1 is not in it
    const sessionGroupMap = new Map([["s1", new Set(["g2"])]]);
    const result = computeGroupAttendanceRates(groups, memberMap, [{ id: "s1" }], sessionGroupMap, new Map());
    expect(result).toHaveLength(0);
  });

  it("computes 100% rate when all members present", () => {
    const groups = [{ id: "g1", name: "Gruppe A", color: "#00f" }];
    const memberMap = new Map([["g1", new Set(["t1", "t2"])]]);
    const sessionGroupMap = new Map([["s1", new Set(["g1"])]]);
    const sessionPresentMap = new Map([["s1", new Set(["t1", "t2"])]]);
    const [result] = computeGroupAttendanceRates(
      groups, memberMap, [{ id: "s1" }], sessionGroupMap, sessionPresentMap,
    );
    expect(result.rate).toBe(1);
    expect(result.actual).toBe(2);
    expect(result.expected).toBe(2);
  });

  it("computes partial rate correctly across multiple sessions", () => {
    // Group g1: 2 members (t1, t2), 3 sessions → expected = 6
    // s1: t1 present → +1
    // s2: t1, t2 present → +2
    // s3: nobody → +0
    // actual = 3, rate = 3/6 = 0.5
    const groups = [{ id: "g1", name: "Gruppe B", color: null }];
    const memberMap = new Map([["g1", new Set(["t1", "t2"])]]);
    const sessions = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
    const sessionGroupMap = new Map([
      ["s1", new Set(["g1"])],
      ["s2", new Set(["g1"])],
      ["s3", new Set(["g1"])],
    ]);
    const sessionPresentMap = new Map([
      ["s1", new Set(["t1"])],
      ["s2", new Set(["t1", "t2"])],
    ]);
    const [result] = computeGroupAttendanceRates(
      groups, memberMap, sessions, sessionGroupMap, sessionPresentMap,
    );
    expect(result.actual).toBe(3);
    expect(result.expected).toBe(6);
    expect(result.rate).toBeCloseTo(0.5);
  });

  it("sorts groups by rate descending", () => {
    const groups = [
      { id: "g1", name: "Low",  color: null },
      { id: "g2", name: "High", color: null },
    ];
    const memberMap = new Map([
      ["g1", new Set(["t1"])],
      ["g2", new Set(["t2"])],
    ]);
    const sessions = [{ id: "s1" }];
    const sessionGroupMap = new Map([["s1", new Set(["g1", "g2"])]]);
    // t2 present (g2 = 100%), t1 absent (g1 = 0%)
    const sessionPresentMap = new Map([["s1", new Set(["t2"])]]);
    const result = computeGroupAttendanceRates(
      groups, memberMap, sessions, sessionGroupMap, sessionPresentMap,
    );
    expect(result[0].name).toBe("High");
    expect(result[1].name).toBe("Low");
  });

  it("only counts members that belong to the specific group", () => {
    // g1 and g2 both expected in s1. g1 member (t1) present, g2 member (t2) absent.
    // g1 rate = 1/1 = 1, g2 rate = 0/1 = 0
    const groups = [
      { id: "g1", name: "A", color: null },
      { id: "g2", name: "B", color: null },
    ];
    const memberMap = new Map([
      ["g1", new Set(["t1"])],
      ["g2", new Set(["t2"])],
    ]);
    const sessions = [{ id: "s1" }];
    const sessionGroupMap = new Map([["s1", new Set(["g1", "g2"])]]);
    const sessionPresentMap = new Map([["s1", new Set(["t1"])]]);
    const result = computeGroupAttendanceRates(
      groups, memberMap, sessions, sessionGroupMap, sessionPresentMap,
    );
    const a = result.find((r) => r.name === "A")!;
    const b = result.find((r) => r.name === "B")!;
    expect(a.rate).toBe(1);
    expect(b.rate).toBe(0);
  });
});
