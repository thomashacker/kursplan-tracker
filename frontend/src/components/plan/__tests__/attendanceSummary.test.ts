import { describe, it, expect } from "vitest";

// ── Mirror of the attendance summary computation in WeeklyPlanEditor ──────────
//
// Inputs:
//   sessionIds:     string[]
//   attendance:     { session_id: string; status: string }[]   (only "present" rows matter)
//   expectedGroups: { session_id: string; group_id: string }[]
//   members:        { group_id: string; teilnehmer_id: string }[]
//
// Returns: Map<sessionId, { present: number; expected: number | null }>
//   - Sessions with groups always included (even 0 present)
//   - Sessions without groups included only if present > 0
//   - expected = member count of the session's groups, or null if no groups

interface AttendanceSummary { present: number; expected: number | null }

function buildAttendanceSummary(
  sessionIds: string[],
  attendance: { session_id: string; status: string }[],
  expectedGroups: { session_id: string; group_id: string }[],
  members: { group_id: string; teilnehmer_id: string }[],
): Map<string, AttendanceSummary> {
  // Present count per session
  const presentCounts = new Map<string, number>();
  for (const a of attendance) {
    if (a.status === "present") {
      presentCounts.set(a.session_id, (presentCounts.get(a.session_id) ?? 0) + 1);
    }
  }

  // Group IDs per session
  const sessionGroupIds = new Map<string, string[]>();
  for (const eg of expectedGroups) {
    const prev = sessionGroupIds.get(eg.session_id) ?? [];
    sessionGroupIds.set(eg.session_id, [...prev, eg.group_id]);
  }

  // Unique member count per session (union of all group members)
  const allGroupIds = [...new Set(expectedGroups.map((eg) => eg.group_id))];
  const memberCounts = new Map<string, number>();
  if (allGroupIds.length > 0) {
    for (const sid of sessionIds) {
      const gids = sessionGroupIds.get(sid) ?? [];
      if (gids.length === 0) continue;
      const memberSet = new Set<string>();
      for (const m of members) {
        if (gids.includes(m.group_id)) memberSet.add(m.teilnehmer_id);
      }
      memberCounts.set(sid, memberSet.size);
    }
  }

  const summary = new Map<string, AttendanceSummary>();
  for (const sid of sessionIds) {
    const present = presentCounts.get(sid) ?? 0;
    const hasGroups = (sessionGroupIds.get(sid) ?? []).length > 0;
    const expected = hasGroups ? (memberCounts.get(sid) ?? 0) : null;
    if (hasGroups || present > 0) summary.set(sid, { present, expected });
  }
  return summary;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildAttendanceSummary", () => {
  it("returns empty map when no sessions", () => {
    const result = buildAttendanceSummary([], [], [], []);
    expect(result.size).toBe(0);
  });

  it("excludes sessions with zero attendance and no expected groups", () => {
    const result = buildAttendanceSummary(["s1"], [], [], []);
    expect(result.has("s1")).toBe(false);
  });

  it("includes session with present > 0 but no groups; expected = null", () => {
    const result = buildAttendanceSummary(
      ["s1"],
      [{ session_id: "s1", status: "present" }, { session_id: "s1", status: "present" }],
      [],
      [],
    );
    expect(result.get("s1")).toEqual({ present: 2, expected: null });
  });

  it("includes session with expected groups even if present = 0", () => {
    const result = buildAttendanceSummary(
      ["s1"],
      [],
      [{ session_id: "s1", group_id: "g1" }],
      [{ group_id: "g1", teilnehmer_id: "t1" }, { group_id: "g1", teilnehmer_id: "t2" }],
    );
    expect(result.get("s1")).toEqual({ present: 0, expected: 2 });
  });

  it("counts expected members as union across multiple groups", () => {
    // g1 has t1,t2; g2 has t2,t3 → union = t1,t2,t3 = 3
    const result = buildAttendanceSummary(
      ["s1"],
      [{ session_id: "s1", status: "present" }],
      [{ session_id: "s1", group_id: "g1" }, { session_id: "s1", group_id: "g2" }],
      [
        { group_id: "g1", teilnehmer_id: "t1" },
        { group_id: "g1", teilnehmer_id: "t2" },
        { group_id: "g2", teilnehmer_id: "t2" }, // overlap
        { group_id: "g2", teilnehmer_id: "t3" },
      ],
    );
    expect(result.get("s1")).toEqual({ present: 1, expected: 3 });
  });

  it("handles multiple sessions independently", () => {
    const result = buildAttendanceSummary(
      ["s1", "s2", "s3"],
      [
        { session_id: "s1", status: "present" },
        { session_id: "s1", status: "present" },
        { session_id: "s2", status: "present" },
        { session_id: "s2", status: "absent" }, // absent not counted
      ],
      [{ session_id: "s1", group_id: "g1" }],
      [{ group_id: "g1", teilnehmer_id: "t1" }, { group_id: "g1", teilnehmer_id: "t2" }],
    );
    expect(result.get("s1")).toEqual({ present: 2, expected: 2 }); // has groups
    expect(result.get("s2")).toEqual({ present: 1, expected: null }); // no groups, has present
    expect(result.has("s3")).toBe(false); // no groups, no present
  });

  it("ignores non-present status rows", () => {
    const result = buildAttendanceSummary(
      ["s1"],
      [
        { session_id: "s1", status: "absent" },
        { session_id: "s1", status: "excused" },
      ],
      [],
      [],
    );
    expect(result.has("s1")).toBe(false);
  });
});
