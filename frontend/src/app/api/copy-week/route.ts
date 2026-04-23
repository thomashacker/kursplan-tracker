import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { source_week_id, target_week_start } = await req.json();
  if (!source_week_id || !target_week_start) {
    return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
  }

  // Fetch source week
  const { data: sourceWeek, error: weekErr } = await supabase
    .from("training_weeks").select("id, club_id").eq("id", source_week_id).single();
  if (weekErr || !sourceWeek) {
    return NextResponse.json({ error: "Quellwoche nicht gefunden" }, { status: 404 });
  }

  // Verify caller is admin or trainer
  const { data: membership } = await supabase
    .from("club_memberships").select("role")
    .eq("club_id", sourceWeek.club_id).eq("user_id", user.id).eq("status", "active").single();
  if (!membership || !["admin", "trainer"].includes(membership.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  // Find or create target week
  let targetWeekId: string;
  const { data: existing } = await supabase
    .from("training_weeks").select("id")
    .eq("club_id", sourceWeek.club_id).eq("week_start", target_week_start).single();

  if (existing) {
    targetWeekId = existing.id;
  } else {
    const { data: newWeek, error: insertErr } = await supabase
      .from("training_weeks")
      .insert({ club_id: sourceWeek.club_id, week_start: target_week_start, is_published: false, created_by: user.id })
      .select("id").single();
    if (insertErr || !newWeek) {
      return NextResponse.json({ error: "Zielwoche konnte nicht erstellt werden" }, { status: 500 });
    }
    targetWeekId = newWeek.id;
  }

  // Fetch source sessions + their trainers
  const { data: sessions } = await supabase
    .from("training_sessions")
    .select("*, session_trainers(user_id)")
    .eq("week_id", source_week_id);

  if (sessions && sessions.length > 0) {
    const { data: newSessions, error: sessErr } = await supabase
      .from("training_sessions")
      .insert(sessions.map((s) => ({
        week_id: targetWeekId,
        day_of_week: s.day_of_week,
        time_start: s.time_start,
        time_end: s.time_end,
        location_id: s.location_id,
        topics: s.topics ?? [],
        session_types: s.session_types ?? [],
        description: s.description,
        trainer_id: s.trainer_id,
        tags: s.tags ?? [],
        is_cancelled: false,
        template_id: s.template_id,
        is_modified: s.is_modified,
      })))
      .select("id");

    if (sessErr) {
      return NextResponse.json({ error: sessErr.message }, { status: 500 });
    }

    // Copy session_trainers
    const trainerRows = (newSessions ?? []).flatMap((newSess, i) => {
      const trainers = (sessions[i].session_trainers as { user_id: string }[]) ?? [];
      return trainers.map((t) => ({ session_id: newSess.id, user_id: t.user_id }));
    });
    if (trainerRows.length > 0) {
      await supabase.from("session_trainers").insert(trainerRows);
    }
  }

  return NextResponse.json({ week_id: targetWeekId, sessions_copied: sessions?.length ?? 0 });
}
