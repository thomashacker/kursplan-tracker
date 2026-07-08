import { describe, it, expect } from "vitest";
import { isEventOrPinned, timelineDate, keepIfEventOrMatches } from "../sessionTimeline";

describe("isEventOrPinned", () => {
  it("plain training", () => expect(isEventOrPinned({ kind: "training", is_pinned: false })).toBe(false));
  it("event", () => expect(isEventOrPinned({ kind: "event", is_pinned: false })).toBe(true));
  it("pinned training", () => expect(isEventOrPinned({ kind: "training", is_pinned: true })).toBe(true));
});

describe("timelineDate", () => {
  it("training uses week + dow", () => {
    expect(timelineDate({ kind: "training", event_date: null, day_of_week: 4 }, "2025-04-14")).toBe("2025-04-18");
  });
  it("event uses event_date and ignores week", () => {
    expect(timelineDate({ kind: "event", event_date: "2025-06-01", day_of_week: 0 }, "2025-04-14")).toBe("2025-06-01");
  });
  it("event without event_date falls back to week + dow (defensive)", () => {
    expect(timelineDate({ kind: "event", event_date: null, day_of_week: 0 }, "2025-04-14")).toBe("2025-04-14");
  });
});

describe("keepIfEventOrMatches", () => {
  const alwaysFalse = () => false;
  it("event keeps even if predicate rejects", () => {
    expect(keepIfEventOrMatches({ kind: "event", is_pinned: false }, alwaysFalse)).toBe(true);
  });
  it("pinned training keeps even if predicate rejects", () => {
    expect(keepIfEventOrMatches({ kind: "training", is_pinned: true }, alwaysFalse)).toBe(true);
  });
  it("plain training bows to predicate", () => {
    expect(keepIfEventOrMatches({ kind: "training", is_pinned: false }, alwaysFalse)).toBe(false);
  });
  it("plain training passes when predicate allows", () => {
    expect(keepIfEventOrMatches({ kind: "training", is_pinned: false }, () => true)).toBe(true);
  });
});
