export interface DayLayoutInput {
  id: string;
  timeStart: string;
  timeEnd: string;
  /**
   * Explicit lane number (0-indexed). When set and free of conflict, the
   * session lands at that lane. Otherwise the session is first-fit auto-placed.
   * `null` = no preference.
   */
  sortOrder: number | null;
}

export interface DayLayoutCell {
  lane: number;
  totalLanes: number;
}

/**
 * Pack overlapping day-view sessions into vertical lanes.
 *
 * 1. Sort by time_start, then time_end. Sessions with an explicit sortOrder
 *    process first (in time tiebreaker) so their preferred lanes win seats.
 * 2. Split into connected blocks (maximal runs of overlap).
 * 3. Per block, place each session in order:
 *    - If `sortOrder` is set and that lane has no time-conflict with an
 *      already-placed session in this block → place there.
 *    - Otherwise → first-fit: lowest lane index that doesn't conflict.
 * 4. `totalLanes` = max(peak concurrency, highest lane index used + 1).
 *
 * No backtracking, no soft/strict pin modes, no chain rearrangements.
 * A pinned session that conflicts with another pinned session loses
 * (whichever processes first wins). The loser falls back to first-fit.
 */
export function getDayLayout(sessions: DayLayoutInput[]): Map<string, DayLayoutCell> {
  const result = new Map<string, DayLayoutCell>();
  if (sessions.length === 0) return result;

  const sorted = [...sessions].sort((a, b) => {
    const byTime =
      a.timeStart.localeCompare(b.timeStart) ||
      a.timeEnd.localeCompare(b.timeEnd);
    if (byTime !== 0) return byTime;
    // Same time slot: pinned first so they get their preferred lane.
    const aPinned = a.sortOrder !== null;
    const bPinned = b.sortOrder !== null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    return 0;
  });

  // Connected-component split (interval-graph blocks).
  const blocks: DayLayoutInput[][] = [];
  let current: DayLayoutInput[] = [];
  let blockEnd = "";
  for (const s of sorted) {
    if (current.length === 0 || s.timeStart < blockEnd) {
      current.push(s);
      if (s.timeEnd > blockEnd) blockEnd = s.timeEnd;
    } else {
      blocks.push(current);
      current = [s];
      blockEnd = s.timeEnd;
    }
  }
  if (current.length > 0) blocks.push(current);

  for (const block of blocks) {
    const peak = peakConcurrency(block);
    const lanes: DayLayoutInput[][] = [];
    const placed = new Map<string, number>();

    function laneHasConflict(laneIdx: number, s: DayLayoutInput): boolean {
      const lane = lanes[laneIdx];
      if (!lane) return false;
      for (const o of lane) {
        if (o.timeStart < s.timeEnd && o.timeEnd > s.timeStart) return true;
      }
      return false;
    }

    function placeAt(laneIdx: number, s: DayLayoutInput) {
      if (!lanes[laneIdx]) lanes[laneIdx] = [];
      lanes[laneIdx].push(s);
      placed.set(s.id, laneIdx);
    }

    for (const s of block) {
      const pin = s.sortOrder;
      // Pinned sessions are placed at their lane unconditionally — even if
      // another session is already there at an overlapping time. The two
      // cards will visually stack. Pins out of range fall back to first-fit.
      if (pin !== null && pin >= 0 && pin < peak) {
        placeAt(pin, s);
        continue;
      }
      let lane = 0;
      while (laneHasConflict(lane, s)) lane++;
      placeAt(lane, s);
    }

    const totalLanes = Math.max(peak, lanes.length, 1);
    for (const s of block) {
      result.set(s.id, { lane: placed.get(s.id) ?? 0, totalLanes });
    }
  }

  return result;
}

/** Peak simultaneous-active count via a sweep over start/end events. */
function peakConcurrency(sessions: DayLayoutInput[]): number {
  const events: Array<[string, number]> = [];
  for (const s of sessions) {
    events.push([s.timeStart, 1]);
    events.push([s.timeEnd, -1]);
  }
  // At equal times, ends fire before starts: a session ending at 11:00 frees
  // its lane for one starting at 11:00.
  events.sort((a, b) => a[0].localeCompare(b[0]) || a[1] - b[1]);

  let count = 0;
  let max = 0;
  for (const [, delta] of events) {
    count += delta;
    if (count > max) max = count;
  }
  return Math.max(max, 1);
}
