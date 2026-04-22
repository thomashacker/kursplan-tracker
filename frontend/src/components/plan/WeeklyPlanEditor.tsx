"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import type { Club, TrainingWeek, TrainingSession, Location, Profile, ClubTopic, ClubSessionType } from "@/types";
import { DAY_NAMES } from "@/types";
import { formatTime, formatWeekRange, offsetWeek, getCurrentMonday } from "@/lib/utils/date";
import { createClient } from "@/lib/supabase/client";
import { copyWeek, exportIcal } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";
import { SessionCard } from "./SessionCard";
import { SessionEditModal, type SessionSaveData } from "./SessionEditModal";

const spring = { type: "spring" as const, stiffness: 300, damping: 30 };

interface Props {
  club: Club;
  week: TrainingWeek | null;
  weekStart: string;
  canEdit: boolean;
  isAdmin: boolean;
  locations: Location[];
  trainers: Profile[];
  topics: ClubTopic[];
  sessionTypes: ClubSessionType[];
}

type View = "week" | "next";

// ── helpers ───────────────────────────────────────────────────

function todayDayIndexInWeek(weekStart: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const weekMonday = new Date(weekStart + "T00:00:00").getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - weekMonday) / msPerDay);
}

function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getCurrentMonday();
}

// ── Next Training view ────────────────────────────────────────

function NextTrainingView({
  sessions,
  trainers,
  weekStart,
}: {
  sessions: TrainingSession[];
  trainers: Profile[];
  weekStart: string;
}) {
  const todayIdx = todayDayIndexInWeek(weekStart);
  const nowTime = new Date().toTimeString().slice(0, 5); // "HH:MM"

  const sorted = [...sessions].sort(
    (a, b) => a.day_of_week - b.day_of_week || a.time_start.localeCompare(b.time_start)
  );

  const next = sorted.find(
    (s) =>
      s.day_of_week > todayIdx ||
      (s.day_of_week === todayIdx && s.time_start.slice(0, 5) >= nowTime)
  );

  if (!next) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <p className="font-semibold text-base mb-1" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          Kein bevorstehendes Training
        </p>
        <p className="text-sm text-muted-foreground">Diese Woche gibt es keine weiteren Trainingseinheiten.</p>
      </div>
    );
  }

  const trainerProfiles: Profile[] = next.session_trainers?.length
    ? next.session_trainers.map((st) => trainers.find((t) => t.id === st.user_id)).filter((t): t is Profile => Boolean(t))
    : trainers.filter((t) => t.id === next.trainer_id);

  const isToday = next.day_of_week === todayIdx;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="space-y-4"
    >
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">
          {isToday ? "Heute" : DAY_NAMES[next.day_of_week]}
        </p>
        <p
          className="font-bold text-2xl leading-tight mb-2"
          style={{ fontFamily: "var(--font-syne, system-ui)" }}
        >
          {next.session_types?.length > 0 ? next.session_types.join(" · ") : next.topics?.join(" · ") || "Training"}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="font-mono">
            {formatTime(next.time_start)} – {formatTime(next.time_end)}
          </span>
          {next.locations && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              {next.locations.name}
            </span>
          )}
          {trainerProfiles.length > 0 && (
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
              {trainerProfiles.map((t) => t.full_name).join(", ")}
            </span>
          )}
        </div>
        {next.description && (
          <p className="text-sm text-muted-foreground mt-3 italic">{next.description}</p>
        )}
      </div>

      {/* Remaining sessions this week */}
      {sorted.filter(
        (s) =>
          s.id !== next.id &&
          (s.day_of_week > todayIdx ||
            (s.day_of_week === todayIdx && s.time_start.slice(0, 5) >= nowTime))
      ).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Diese Woche noch
          </p>
          <div className="space-y-2">
            {sorted
              .filter(
                (s) =>
                  s.id !== next.id &&
                  (s.day_of_week > todayIdx ||
                    (s.day_of_week === todayIdx && s.time_start.slice(0, 5) >= nowTime))
              )
              .map((s) => {
                const sp: Profile[] = s.session_trainers?.length
                  ? s.session_trainers.map((st) => trainers.find((t) => t.id === st.user_id)).filter((t): t is Profile => Boolean(t))
                  : trainers.filter((t) => t.id === s.trainer_id);
                return (
                  <div key={s.id} className="flex items-start gap-4 p-3 rounded-xl border border-border bg-card">
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-muted-foreground">{DAY_NAMES[s.day_of_week].slice(0, 2)}</p>
                      <p className="text-xs font-mono text-muted-foreground">{formatTime(s.time_start)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{s.session_types?.length > 0 ? s.session_types.join(" · ") : s.topics?.join(" · ") || "Training"}</p>
                      {sp.length > 0 && <p className="text-xs text-muted-foreground">{sp.map((t) => t.full_name).join(", ")}</p>}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────

export function WeeklyPlanEditor({
  club,
  week: initialWeek,
  weekStart,
  canEdit,
  isAdmin,
  locations,
  trainers,
  topics,
  sessionTypes,
}: Props) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [week, setWeek] = useState(initialWeek);
  const [editingSession, setEditingSession] = useState<TrainingSession | null | "new">(null);
  const [newSessionDay, setNewSessionDay] = useState<number>(0);
  const [view, setView] = useState<View>("week");
  const [hasChanges, setHasChanges] = useState(false);
  const [, startTransition] = useTransition();

  // Sync local state when server data refreshes
  useEffect(() => {
    setWeek(initialWeek);
    setHasChanges(false);
  }, [initialWeek]);

  const sessions = week?.training_sessions ?? [];
  const todayIdx = todayDayIndexInWeek(weekStart);
  const currentWeek = isCurrentWeek(weekStart);

  function getSessionsForDay(day: number) {
    return sessions
      .filter((s) => s.day_of_week === day)
      .sort((a, b) => a.time_start.localeCompare(b.time_start));
  }

  function navigate(offset: number) {
    const newMonday = offsetWeek(weekStart, offset);
    router.push(`?woche=${newMonday}`);
  }

  function goToToday() {
    router.push(`?`);
  }

  async function ensureWeekExists(): Promise<string> {
    if (week?.id) return week.id;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("training_weeks")
      .insert({ club_id: club.id, week_start: weekStart, created_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setWeek({ ...data, training_sessions: [] });
    return data.id;
  }

  async function togglePublish() {
    if (!week) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("training_weeks")
      .update({ is_published: !week.is_published })
      .eq("id", week.id);
    if (error) {
      toast.error(error.message);
    } else {
      setWeek({ ...week, is_published: !week.is_published });
      toast.success(week.is_published ? "Plan unveröffentlicht." : "Plan veröffentlicht!");
    }
  }

  async function handleCopyFromLastWeek() {
    const prevMonday = offsetWeek(weekStart, -1);
    const supabase = createClient();
    const { data: prevWeek } = await supabase
      .from("training_weeks")
      .select("id")
      .eq("club_id", club.id)
      .eq("week_start", prevMonday)
      .single();

    if (!prevWeek) {
      toast.error("Keine Vorwoche gefunden.");
      return;
    }

    try {
      await copyWeek(prevWeek.id, weekStart);
      toast.success("Vorwoche kopiert!");
      startTransition(() => router.refresh());
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Kopieren");
    }
  }

  function handleDiscardChanges() {
    setWeek(initialWeek);
    setHasChanges(false);
    startTransition(() => router.refresh());
  }

  function openNewSession(day: number) {
    setNewSessionDay(day);
    setEditingSession("new");
  }

  async function handleSaveSession(data: SessionSaveData) {
    const weekId = await ensureWeekExists().catch((err) => {
      toast.error(err.message);
      return null;
    });
    if (!weekId) return;

    const supabase = createClient();
    const { trainer_ids, ...sessionData } = data;
    const sessionFields = {
      ...sessionData,
      trainer_id: trainer_ids[0] ?? null,
    };

    let sessionId: string;

    if (editingSession === "new" || !editingSession) {
      const { data: created, error } = await supabase
        .from("training_sessions")
        .insert({ ...sessionFields, week_id: weekId })
        .select("id")
        .single();
      if (error) { toast.error(error.message); return; }
      sessionId = created.id;
    } else {
      const { error } = await supabase
        .from("training_sessions")
        .update(sessionFields)
        .eq("id", editingSession.id);
      if (error) { toast.error(error.message); return; }
      sessionId = editingSession.id;
    }

    // Sync session_trainers junction table
    await supabase.from("session_trainers").delete().eq("session_id", sessionId);
    if (trainer_ids.length > 0) {
      await supabase
        .from("session_trainers")
        .insert(trainer_ids.map((uid) => ({ session_id: sessionId, user_id: uid })));
    }

    toast.success("Gespeichert.");
    setEditingSession(null);
    setHasChanges(true);
    startTransition(() => router.refresh());
  }

  async function handleDeleteSession(sessionId: string) {
    if (!confirm("Sitzung wirklich löschen?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("training_sessions").delete().eq("id", sessionId);
    if (error) { toast.error(error.message); return; }
    setWeek((w) =>
      w ? { ...w, training_sessions: (w.training_sessions ?? []).filter((s) => s.id !== sessionId) } : w
    );
    setHasChanges(true);
    toast.success("Sitzung gelöscht.");
  }

  return (
    <div>
      {/* ── Navigation header ─────────────────────────────── */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Week nav row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="h-9 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Vorwoche</span>
          </button>

          <div className="flex items-center gap-2 flex-1 justify-center">
            <div className="text-center">
              <p className="font-semibold text-sm sm:text-base leading-tight">
                {formatWeekRange(weekStart)}
              </p>
              {currentWeek && (
                <p className="text-xs text-primary font-medium">Aktuelle Woche</p>
              )}
            </div>
          </div>

          {!currentWeek && (
            <button
              onClick={goToToday}
              className="h-9 px-3 rounded-xl border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors"
            >
              Heute
            </button>
          )}

          <button
            onClick={() => navigate(1)}
            className="h-9 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1"
          >
            <span className="hidden sm:inline">Nächste Woche</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Actions row */}
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleCopyFromLastWeek}
              className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
            >
              Vorwoche kopieren
            </button>
            {week && (
              <>
                <a
                  href={exportIcal(week.id)}
                  download
                  className={buttonVariants({ variant: "outline", size: "sm" }) + " h-8 text-xs"}
                >
                  iCal
                </a>
                {isAdmin && (
                  <button
                    onClick={togglePublish}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                      week.is_published
                        ? "border border-border hover:bg-secondary"
                        : "bg-primary text-primary-foreground hover:opacity-90"
                    }`}
                  >
                    {week.is_published ? "Unveröffentlichen" : "Veröffentlichen"}
                  </button>
                )}
                {hasChanges && (
                  <button
                    onClick={handleDiscardChanges}
                    className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    Änderungen verwerfen
                  </button>
                )}
              </>
            )}
            {/* Publish badge */}
            {week && (
              <span
                className={`inline-flex items-center gap-1 self-center text-xs font-medium ${
                  week.is_published ? "text-green-600" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    week.is_published ? "bg-green-500" : "bg-muted-foreground/40"
                  }`}
                />
                {week.is_published ? "Veröffentlicht" : "Entwurf"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── View tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 border-b border-border">
        {(["week", "next"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`pb-2.5 px-1 mr-4 text-sm font-medium border-b-2 transition-colors -mb-px ${
              view === v
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v === "week" ? "Wochenplan" : "Nächstes Training"}
          </button>
        ))}
      </div>

      {/* ── Next Training view ─────────────────────────────── */}
      {view === "next" && (
        <NextTrainingView sessions={sessions} trainers={trainers} weekStart={weekStart} />
      )}

      {/* ── Week view ──────────────────────────────────────── */}
      {view === "week" && (
        <>
          {/* Mobile: vertical list */}
          <div className="flex flex-col gap-4 md:hidden">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const daySessions = getSessionsForDay(dayIndex);
              const isToday = dayIndex === todayIdx && currentWeek;
              if (!canEdit && daySessions.length === 0) return null;
              return (
                <motion.div
                  key={dayIndex}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: dayIndex * 0.03 }}
                >
                  <div
                    className={`rounded-xl border overflow-hidden ${
                      isToday ? "border-primary/30" : "border-border"
                    }`}
                  >
                    <div
                      className={`flex items-center justify-between px-3 py-2 ${
                        isToday ? "bg-primary/8" : "bg-secondary/40"
                      }`}
                    >
                      <span className={`text-xs font-semibold uppercase tracking-widest ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {dayName}
                        {isToday && <span className="ml-2 text-[10px] font-medium tracking-normal normal-case">Heute</span>}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => openNewSession(dayIndex)}
                          className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                        >
                          + Hinzufügen
                        </button>
                      )}
                    </div>
                    <div className="p-2 space-y-2">
                      {daySessions.length === 0 ? (
                        <p className="text-xs text-muted-foreground/50 py-1 px-1">Kein Training</p>
                      ) : (
                        daySessions.map((session) => (
                          <SessionCard
                            key={session.id}
                            session={session}
                            trainers={trainers}
                            canEdit={canEdit}
                            isToday={isToday}
                            onEdit={() => setEditingSession(session)}
                            onDelete={() => handleDeleteSession(session.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Desktop: 7-column grid */}
          <div className="hidden md:grid grid-cols-7 gap-2">
            {DAY_NAMES.map((dayName, dayIndex) => {
              const daySessions = getSessionsForDay(dayIndex);
              const isToday = dayIndex === todayIdx && currentWeek;
              return (
                <div key={dayIndex} className="min-h-[180px] flex flex-col">
                  {/* Day header */}
                  <div
                    className={`text-xs font-semibold text-center py-2 mb-2 rounded-lg uppercase tracking-widest ${
                      isToday
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {dayName.slice(0, 2)}
                    {isToday && <span className="block text-[9px] font-medium tracking-normal normal-case -mt-0.5">Heute</span>}
                  </div>
                  {/* Sessions */}
                  <div className="flex-1 space-y-2">
                    {daySessions.map((session) => (
                      <SessionCard
                        key={session.id}
                        session={session}
                        trainers={trainers}
                        canEdit={canEdit}
                        isToday={isToday}
                        onEdit={() => setEditingSession(session)}
                        onDelete={() => handleDeleteSession(session.id)}
                      />
                    ))}
                    {canEdit && (
                      <button
                        onClick={() => openNewSession(dayIndex)}
                        className="w-full text-xs text-muted-foreground/50 border border-dashed border-border rounded-xl py-2 hover:border-primary/40 hover:text-primary transition-colors"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {sessions.length === 0 && !canEdit && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="font-semibold text-base mb-1">Keine Trainingseinheiten</p>
              <p className="text-sm text-muted-foreground">Diese Woche ist noch kein Training geplant.</p>
            </div>
          )}
        </>
      )}

      {/* ── Edit Modal ─────────────────────────────────────── */}
      {editingSession !== null && (
        <SessionEditModal
          session={editingSession === "new" ? null : editingSession}
          defaultDay={editingSession === "new" ? newSessionDay : editingSession.day_of_week}
          locations={locations}
          trainers={trainers}
          topics={topics}
          sessionTypes={sessionTypes}
          onSave={handleSaveSession}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  );
}
