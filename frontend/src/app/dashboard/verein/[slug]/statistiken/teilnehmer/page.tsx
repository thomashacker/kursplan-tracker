import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import type { Club, ClubMembership } from "@/types";
import { getSessionDate, toISODate } from "@/lib/utils/date";
import TimeWindowPicker, {
  type TimeWindow,
} from "../TimeWindowPicker";
import {
  windowRange,
  mondayOnOrBefore,
  windowLongLabel,
} from "../dateRange";
import { TeilnehmerCompareView } from "./TeilnehmerCompareView";

const WINDOW_KEYS: TimeWindow[] = [
  "current_month",
  "last_month",
  "6m",
  "1y",
  "custom",
];

export default async function TeilnehmerStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ window?: string; from?: string; to?: string }>;
}) {
  const { slug } = await params;
  const {
    window: windowParam,
    from: fromParam,
    to: toParam,
  } = await searchParams;

  const activeWindow: TimeWindow =
    windowParam && (WINDOW_KEYS as string[]).includes(windowParam)
      ? (windowParam as TimeWindow)
      : "current_month";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("slug", slug)
    .single<Club>();
  if (!club) notFound();

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", club.id)
    .eq("user_id", user!.id)
    .eq("status", "active")
    .single<ClubMembership>();
  if (!membership || membership.role === "member") notFound();

  const { from, to } = windowRange(activeWindow, new Date(), fromParam, toParam);
  const fromMondayISO = mondayOnOrBefore(from);
  const toMondayISO = mondayOnOrBefore(to);
  const cutoffMs = to.getTime();
  const fromMs = from.getTime();

  // Sessions in the window — minimal payload for date mapping.
  const { data: pastWeeks } = await supabase
    .from("training_weeks")
    .select(
      "week_start, training_sessions(id, time_end, day_of_week, is_cancelled)",
    )
    .eq("club_id", club.id)
    .gte("week_start", fromMondayISO)
    .lte("week_start", toMondayISO);

  type SessionRow = {
    id: string;
    time_end: string;
    day_of_week: number;
    is_cancelled: boolean;
  };

  const sessions: { id: string; dateISO: string }[] = [];
  for (const week of pastWeeks ?? []) {
    const weekStart = week.week_start;
    for (const s of (week.training_sessions ?? []) as SessionRow[]) {
      if (s.is_cancelled) continue;
      const d = getSessionDate(weekStart, s.day_of_week);
      const [h, m] = s.time_end.split(":").map(Number);
      d.setHours(h, m, 0, 0);
      const t = d.getTime();
      if (t < fromMs || t > cutoffMs) continue;
      sessions.push({
        id: s.id,
        dateISO: toISODate(getSessionDate(weekStart, s.day_of_week)),
      });
    }
  }
  sessions.sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  // All teilnehmer + groups + group memberships for the sidebar.
  const [teilRes, groupRes, membershipRes] = await Promise.all([
    supabase
      .from("teilnehmer")
      .select("id, name")
      .eq("club_id", club.id)
      .order("name"),
    supabase
      .from("teilnehmer_groups")
      .select("id, name, color")
      .eq("club_id", club.id)
      .order("name"),
    supabase
      .from("teilnehmer_group_members")
      .select("teilnehmer_id, group_id"),
  ]);

  const teilnehmer = (teilRes.data ?? []) as {
    id: string;
    name: string;
  }[];
  const groups = (groupRes.data ?? []) as {
    id: string;
    name: string;
    color: string | null;
  }[];
  const memberships = (membershipRes.data ?? []) as {
    teilnehmer_id: string;
    group_id: string;
  }[];

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href={{
              pathname: `/dashboard/verein/${slug}/statistiken`,
              query: {
                window: activeWindow,
                ...(activeWindow === "custom" && fromParam ? { from: fromParam } : {}),
                ...(activeWindow === "custom" && toParam ? { to: toParam } : {}),
              },
            }}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground mb-2 py-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Zurück zu den Statistiken
          </Link>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            Teilnehmer-Verlauf
          </h1>
          <p className="text-sm text-muted-foreground">
            {club.name} — {windowLongLabel(activeWindow)}
          </p>
        </div>
        <Suspense>
          <TimeWindowPicker
            current={activeWindow}
            from={activeWindow === "custom" ? fromParam : undefined}
            to={activeWindow === "custom" ? toParam : undefined}
          />
        </Suspense>
      </div>

      <TeilnehmerCompareView
        teilnehmer={teilnehmer}
        groups={groups}
        memberships={memberships}
        sessions={sessions}
      />
    </div>
  );
}
