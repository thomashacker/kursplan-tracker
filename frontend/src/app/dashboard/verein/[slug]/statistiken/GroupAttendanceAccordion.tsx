"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type GroupStatItem = {
  id: string;
  name: string;
  color: string | null;
  rate: number;
  actual: number;
  excused: number;
  unexcused: number;
  expected: number;
  sessionCount: number;
};

type MemberStat = {
  id: string;
  name: string;
  present: number;
  excused: number;
  absent: number;
};

export function GroupAttendanceAccordion({
  groups,
  sessionIds,
}: {
  groups: GroupStatItem[];
  sessionIds: string[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<Record<string, MemberStat[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function toggleGroup(groupId: string) {
    if (expandedId === groupId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(groupId);

    if (memberData[groupId] !== undefined) return;

    setLoadingId(groupId);

    const supabase = createClient();

    const { data: members } = await supabase
      .from("teilnehmer_group_members")
      .select("teilnehmer_id, teilnehmer(id, name)")
      .eq("group_id", groupId);

    if (!members?.length) {
      setMemberData((prev) => ({ ...prev, [groupId]: [] }));
      setLoadingId(null);
      return;
    }

    const memberIds = members.map((m) => m.teilnehmer_id);

    // Narrow to only sessions where this group was expected within the window
    const { data: groupSessionRows } = sessionIds.length
      ? await supabase
          .from("session_expected_groups")
          .select("session_id")
          .eq("group_id", groupId)
          .in("session_id", sessionIds)
      : { data: [] };

    const groupSessionIds = (groupSessionRows ?? []).map((r) => r.session_id);

    const { data: attendance } = groupSessionIds.length
      ? await supabase
          .from("session_attendance")
          .select("teilnehmer_id, status")
          .in("status", ["present", "excused"])
          .in("session_id", groupSessionIds)
          .in("teilnehmer_id", memberIds)
      : { data: [] };

    const presentMap = new Map<string, number>();
    const excusedMap = new Map<string, number>();
    for (const a of attendance ?? []) {
      if (a.status === "present") {
        presentMap.set(a.teilnehmer_id, (presentMap.get(a.teilnehmer_id) ?? 0) + 1);
      } else if (a.status === "excused") {
        excusedMap.set(a.teilnehmer_id, (excusedMap.get(a.teilnehmer_id) ?? 0) + 1);
      }
    }

    const group = groups.find((g) => g.id === groupId)!;

    const stats: MemberStat[] = members
      .map((m) => {
        const t = (m as unknown as { teilnehmer: { id: string; name: string } | null }).teilnehmer;
        const present = presentMap.get(m.teilnehmer_id) ?? 0;
        const excused = excusedMap.get(m.teilnehmer_id) ?? 0;
        return {
          id: m.teilnehmer_id,
          name: t?.name ?? "Unbekannt",
          present,
          excused,
          absent: group.sessionCount - present - excused,
        };
      })
      .sort((a, b) => b.present - a.present || a.absent - b.absent);

    setMemberData((prev) => ({ ...prev, [groupId]: stats }));
    setLoadingId(null);
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
      {groups.map((g) => {
        const pct = Math.round(g.rate * 100);
        const isExpanded = expandedId === g.id;
        const members = memberData[g.id];
        const isLoading = loadingId === g.id;

        return (
          <div key={g.id}>
            <button
              onClick={() => toggleGroup(g.id)}
              className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-muted/40 transition-colors"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: g.color ?? "#94a3b8" }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{g.name}</p>
                <p className="text-xs text-muted-foreground">
                  {g.sessionCount} {g.sessionCount === 1 ? "Training" : "Trainings"}
                </p>
              </div>
              <div className="hidden sm:block w-36">
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: g.color ?? "hsl(var(--primary))",
                    }}
                  />
                </div>
              </div>
              <span
                className="text-lg font-bold w-12 text-right tabular-nums shrink-0"
                style={{ color: g.color ?? "hsl(var(--primary))" }}
              >
                {pct}%
              </span>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {isExpanded && (
              <div className="border-t border-border bg-muted/20">
                {isLoading ? (
                  <div className="px-6 py-3 space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-7 rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : members?.length ? (
                  <div className="overflow-y-auto max-h-56 divide-y divide-border/40">
                    {/* Header row */}
                    <div className="px-8 py-1.5 flex items-center gap-3 bg-muted/30">
                      <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Teilnehmer
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600 w-6 text-center">✓</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 w-6 text-center">~</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-500 w-6 text-center">✗</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-10 text-right">Quote</span>
                    </div>
                    {members.map((m) => {
                      const memberPct =
                        g.sessionCount > 0
                          ? Math.round((m.present / g.sessionCount) * 100)
                          : 0;
                      return (
                        <div key={m.id} className="px-8 py-2 flex items-center gap-3">
                          <span className="flex-1 text-sm truncate">{m.name}</span>
                          <span className="text-sm font-medium text-green-600 tabular-nums w-6 text-center">
                            {m.present}
                          </span>
                          <span className={`text-sm font-medium tabular-nums w-6 text-center ${m.excused > 0 ? "text-amber-500" : "text-muted-foreground/30"}`}>
                            {m.excused > 0 ? m.excused : "–"}
                          </span>
                          <span className={`text-sm font-medium tabular-nums w-6 text-center ${m.absent > 0 ? "text-red-500" : "text-muted-foreground/30"}`}>
                            {m.absent > 0 ? m.absent : "–"}
                          </span>
                          <span
                            className="text-sm font-semibold tabular-nums w-10 text-right"
                            style={{ color: g.color ?? "hsl(var(--primary))" }}
                          >
                            {memberPct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-8 py-4 text-sm text-muted-foreground">
                    Keine Teilnehmer gefunden.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
