import { describe, it, expect } from "vitest";
import { getDayLayout, type DayLayoutInput } from "../dayLayout";

function s(
  id: string,
  timeStart: string,
  timeEnd: string,
  sortOrder: number | null = null,
): DayLayoutInput {
  return { id, timeStart, timeEnd, sortOrder };
}

describe("getDayLayout (first-fit)", () => {
  it("returns an empty map for no sessions", () => {
    expect(getDayLayout([])).toEqual(new Map());
  });

  it("places a single session in lane 0 of 1", () => {
    const layout = getDayLayout([s("a", "10:00", "11:00")]);
    expect(layout.get("a")).toEqual({ lane: 0, totalLanes: 1 });
  });

  it("places back-to-back sessions in lane 0 of 1 (no overlap)", () => {
    const layout = getDayLayout([
      s("a", "10:00", "11:00"),
      s("b", "11:00", "12:00"),
    ]);
    expect(layout.get("a")).toEqual({ lane: 0, totalLanes: 1 });
    expect(layout.get("b")).toEqual({ lane: 0, totalLanes: 1 });
  });

  it("treats touching boundaries as non-overlapping", () => {
    const layout = getDayLayout([
      s("a", "10:00", "11:00"),
      s("b", "11:00", "12:00"),
    ]);
    expect(layout.get("a")!.lane).toBe(0);
    expect(layout.get("b")!.lane).toBe(0);
  });

  it("splits disjoint blocks so sparse regions stay wide", () => {
    const layout = getDayLayout([
      s("morning1", "09:00", "10:00"),
      s("morning2", "09:30", "10:30"),
      s("afternoon", "14:00", "15:00"),
    ]);
    expect(layout.get("morning1")).toEqual({ lane: 0, totalLanes: 2 });
    expect(layout.get("morning2")).toEqual({ lane: 1, totalLanes: 2 });
    expect(layout.get("afternoon")).toEqual({ lane: 0, totalLanes: 1 });
  });

  it("packs three concurrent sessions into three lanes", () => {
    const layout = getDayLayout([
      s("a", "10:00", "11:00"),
      s("b", "10:00", "11:00"),
      s("c", "10:00", "11:00"),
    ]);
    const lanes = ["a", "b", "c"].map((id) => layout.get(id)!.lane).sort();
    expect(lanes).toEqual([0, 1, 2]);
    for (const id of ["a", "b", "c"]) {
      expect(layout.get(id)!.totalLanes).toBe(3);
    }
  });

  it("never assigns two overlapping sessions to the same lane", () => {
    const inputs = [
      s("a", "10:00", "11:30"),
      s("b", "10:30", "12:00"),
      s("c", "11:00", "13:00"),
      s("d", "12:30", "14:00"),
      s("e", "13:30", "15:00"),
    ];
    const layout = getDayLayout(inputs);
    for (let i = 0; i < inputs.length; i++) {
      for (let j = i + 1; j < inputs.length; j++) {
        const overlap =
          inputs[i].timeStart < inputs[j].timeEnd &&
          inputs[i].timeEnd > inputs[j].timeStart;
        if (overlap) {
          expect(layout.get(inputs[i].id)!.lane).not.toBe(
            layout.get(inputs[j].id)!.lane,
          );
        }
      }
    }
  });

  it("honors a sortOrder when its lane is free", () => {
    const layout = getDayLayout([
      s("a", "10:00", "11:00"),
      s("b", "10:00", "11:00", 1),
    ]);
    expect(layout.get("b")!.lane).toBe(1);
    expect(layout.get("a")!.lane).toBe(0);
  });

  it("honors sortOrder=0 even when a non-pinned session would otherwise grab lane 0 first", () => {
    // Pinned sessions process first in time tiebreakers; both have the same
    // start/end so the pinned one wins lane 0.
    const layout = getDayLayout([
      s("a", "10:00", "11:00"),
      s("b", "10:00", "11:00", 0),
    ]);
    expect(layout.get("b")!.lane).toBe(0);
    expect(layout.get("a")!.lane).toBe(1);
  });

  it("strictly honors a sortOrder even when it conflicts with an earlier session (visual stack allowed)", () => {
    // `a` starts earlier and takes lane 0 via first-fit. `b` has sortOrder=0
    // and overlaps a → with strict pin honor, b is placed at lane 0 anyway.
    // The two cards visually stack from 10:30 to 11:30. This is intentional:
    // users are allowed to put overlapping trainings in the same column.
    const layout = getDayLayout([
      s("a", "10:00", "11:30"),
      s("b", "10:30", "12:00", 0),
    ]);
    expect(layout.get("a")!.lane).toBe(0);
    expect(layout.get("b")!.lane).toBe(0);
    expect(layout.get("a")!.totalLanes).toBe(2);
  });

  it("falls back gracefully on an out-of-bounds sortOrder", () => {
    // Pin to lane 99 in a 2-session-overlap block. The pin lane is free of
    // conflict so it would be honoured literally — but totalLanes only goes
    // up to max(peak, used+1), so the column would be wider than needed.
    // First-fit fallback by way of a negative pin handles this:
    const layout = getDayLayout([
      s("a", "10:00", "11:00"),
      s("b", "10:00", "11:00", -5),
    ]);
    expect(layout.get("b")!.lane).toBeGreaterThanOrEqual(0);
    expect(layout.get("b")!.lane).toBeLessThan(layout.get("b")!.totalLanes);
  });

  it("uses peak concurrency for totalLanes within a block", () => {
    // Long session overlaps with both a short pair AND a later pair. Every
    // session in the block must share the same totalLanes so widths match.
    const inputs = [
      s("gala", "16:30", "18:30"),
      s("tuju", "16:30", "18:30"),
      s("unique", "17:00", "19:00"),
      s("radwende", "18:30", "19:30"),
      s("tanztechnik", "18:30", "19:30"),
      s("mighty", "19:00", "21:15"),
      s("freie", "19:30", "20:30"),
    ];
    const layout = getDayLayout(inputs);
    const totals = new Set(inputs.map((i) => layout.get(i.id)!.totalLanes));
    expect(totals.size).toBe(1);
  });

  it("places sessions at their pinned lane when no conflict (no cascade)", () => {
    // Three overlapping sessions, each pinned to a distinct lane. The output
    // must exactly match the pins — no rearrangement.
    const layout = getDayLayout([
      s("a", "10:00", "11:00", 0),
      s("b", "10:00", "11:00", 1),
      s("c", "10:00", "11:00", 2),
    ]);
    expect(layout.get("a")!.lane).toBe(0);
    expect(layout.get("b")!.lane).toBe(1);
    expect(layout.get("c")!.lane).toBe(2);
  });

  it("is stable under input reordering", () => {
    const inputs = [
      s("a", "10:00", "11:30"),
      s("b", "10:30", "12:00"),
      s("c", "11:00", "13:00"),
    ];
    const layoutForward = getDayLayout(inputs);
    const layoutReversed = getDayLayout([...inputs].reverse());
    for (const id of ["a", "b", "c"]) {
      expect(layoutForward.get(id)).toEqual(layoutReversed.get(id));
    }
  });

  it("respects pins that swap two sessions in a 3-lane block (no cascade)", () => {
    // a, b, c all overlap. Pin a→1, b→0, c→2. Result must be exactly those
    // lanes, no cascading.
    const layout = getDayLayout([
      s("a", "10:00", "11:00", 1),
      s("b", "10:00", "11:00", 0),
      s("c", "10:00", "11:00", 2),
    ]);
    expect(layout.get("a")!.lane).toBe(1);
    expect(layout.get("b")!.lane).toBe(0);
    expect(layout.get("c")!.lane).toBe(2);
  });
});
