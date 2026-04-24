import { describe, it, expect } from "vitest";
import type { PublicSession } from "../PublicPlanClient";

function makeSession(overrides: Partial<PublicSession> = {}): PublicSession {
  return {
    id: "test-id",
    dateKey: "2025-04-21",
    shortLabel: "Mo 21.04.",
    fullLabel: "Montag, 21. Apr",
    timeStart: "18:00",
    timeEnd: "20:00",
    isCancelled: false,
    sessionTypes: [],
    topics: [],
    description: null,
    location: null,
    trainerNames: [],
    trainers: [],
    color: null,
    ...overrides,
  };
}

function applyFilters(
  sessions: PublicSession[],
  activeTypes: Set<string>,
  activeTopics: Set<string>,
  activeTrainers: Set<string>,
  activeLocations: Set<string>
): PublicSession[] {
  const activeCount = activeTypes.size + activeTopics.size + activeTrainers.size + activeLocations.size;
  if (activeCount === 0) return sessions;
  return sessions.filter((s) => {
    if (activeTypes.size > 0    && !s.sessionTypes.some((t) => activeTypes.has(t)))    return false;
    if (activeTopics.size > 0   && !s.topics.some((t) => activeTopics.has(t)))         return false;
    if (activeTrainers.size > 0 && !s.trainerNames.some((t) => activeTrainers.has(t))) return false;
    if (activeLocations.size > 0 && !(s.location && activeLocations.has(s.location.name))) return false;
    return true;
  });
}

const sessions: PublicSession[] = [
  makeSession({ id: "1", sessionTypes: ["Kraft"], topics: ["Technik"], trainerNames: ["Max"], location: { name: "Halle A", mapsUrl: null } }),
  makeSession({ id: "2", sessionTypes: ["Kondition"], topics: ["Ausdauer"], trainerNames: ["Anna"], location: { name: "Halle B", mapsUrl: null } }),
  makeSession({ id: "3", sessionTypes: ["Kraft"], topics: ["Ausdauer"], trainerNames: ["Max"], location: null }),
];

describe("filter logic", () => {
  it("no filters returns all sessions", () => {
    const result = applyFilters(sessions, new Set(), new Set(), new Set(), new Set());
    expect(result).toHaveLength(3);
  });

  it("filters by single type (OR within type)", () => {
    const result = applyFilters(sessions, new Set(["Kraft"]), new Set(), new Set(), new Set());
    expect(result.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("filters by multiple types (OR within)", () => {
    const result = applyFilters(sessions, new Set(["Kraft", "Kondition"]), new Set(), new Set(), new Set());
    expect(result).toHaveLength(3);
  });

  it("filters by topic", () => {
    const result = applyFilters(sessions, new Set(), new Set(["Technik"]), new Set(), new Set());
    expect(result.map((s) => s.id)).toEqual(["1"]);
  });

  it("filters by trainer", () => {
    const result = applyFilters(sessions, new Set(), new Set(), new Set(["Anna"]), new Set());
    expect(result.map((s) => s.id)).toEqual(["2"]);
  });

  it("filters by location", () => {
    const result = applyFilters(sessions, new Set(), new Set(), new Set(), new Set(["Halle A"]));
    expect(result.map((s) => s.id)).toEqual(["1"]);
  });

  it("AND across categories — type + trainer must both match", () => {
    // Kraft AND Anna → no match (Anna only does Kondition)
    const result = applyFilters(sessions, new Set(["Kraft"]), new Set(), new Set(["Anna"]), new Set());
    expect(result).toHaveLength(0);
  });

  it("AND across categories — type + trainer with match", () => {
    // Kraft AND Max → sessions 1 and 3
    const result = applyFilters(sessions, new Set(["Kraft"]), new Set(), new Set(["Max"]), new Set());
    expect(result.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("session with no location is excluded when location filter active", () => {
    const result = applyFilters(sessions, new Set(), new Set(), new Set(), new Set(["Halle A"]));
    expect(result.find((s) => s.id === "3")).toBeUndefined();
  });
});
