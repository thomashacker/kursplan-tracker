"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type {
  TrainingSession,
  Teilnehmer,
  TeilnehmerGroup,
  AttendanceStatus,
  TeilnehmerQRPayload,
} from "@/types";
import { DAY_NAMES } from "@/types";
import { formatTime } from "@/lib/utils/date";

// ── Dynamic scanner (camera) ──────────────────────────────────────────────────
const InlineQRScanner = dynamic(() => import("./InlineQRScanner"), { ssr: false });

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<AttendanceStatus, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
  present: {
    label: "Anwesend",
    bg: "bg-green-500/10 border-green-500/30",
    text: "text-green-600 dark:text-green-400",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    ),
  },
  excused: {
    label: "Entschuldigt",
    bg: "bg-amber-500/10 border-amber-500/30",
    text: "text-amber-600 dark:text-amber-400",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  absent: {
    label: "Abwesend",
    bg: "bg-destructive/10 border-destructive/30",
    text: "text-destructive",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  session: TrainingSession;
  clubId: string;
  canEdit: boolean;
  onClose: () => void;
  /**
   * Called right before this modal writes a column on `training_sessions`
   * (e.g. the Probetraining counter). The parent is expected to:
   *   1. suppress its realtime "changed by another user" toast for this echo, and
   *   2. optimistically apply the same patch to its local `week` state so
   *      session cards / re-open of the modal see the fresh value without a
   *      full refresh.
   */
  onLocalSessionPatch?: (patch: Partial<TrainingSession>) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AttendanceModal({ session, clubId, canEdit, onClose, onLocalSessionPatch }: Props) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completedAt, setCompletedAt] = useState<string | null>(session.completed_at ?? null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState<{ name: string; alreadyPresent: boolean } | null>(null);
  const [weitereOpen, setWeitereOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [probetraining, setProbetraining] = useState<number>(
    session.probetraining_count ?? 0,
  );
  const savedProbetrainingRef = useRef<number>(probetraining);

  // Data
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [groups, setGroups] = useState<TeilnehmerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<{ group_id: string; teilnehmer_id: string }[]>([]);
  const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
  const [expectedGroupIds, setExpectedGroupIds] = useState<string[]>([]);

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const [
      { data: tn },
      { data: grp },
      { data: gm },
      { data: att },
      { data: expGroups },
    ] = await Promise.all([
      supabase.from("teilnehmer").select("*").eq("club_id", clubId).order("name"),
      supabase.from("teilnehmer_groups").select("*").eq("club_id", clubId).order("name"),
      supabase.from("teilnehmer_group_members").select("group_id, teilnehmer_id"),
      supabase.from("session_attendance").select("*").eq("session_id", session.id),
      supabase.from("session_expected_groups").select("group_id").eq("session_id", session.id),
    ]);

    setTeilnehmer(tn ?? []);
    setGroups(grp ?? []);
    setGroupMembers(gm ?? []);

    const map = new Map<string, AttendanceStatus>();
    for (const a of att ?? []) map.set(a.teilnehmer_id, a.status as AttendanceStatus);
    setAttendance(map);

    setExpectedGroupIds((expGroups ?? []).map((eg: { group_id: string }) => eg.group_id));

    setLoading(false);
  }, [supabase, clubId, session.id]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { loadData(); }, [loadData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ── Expected participants (members of the session's expected groups) ──────────
  const hasExpectedGroups = expectedGroupIds.length > 0;
  const expectedTeilnehmer: Teilnehmer[] = (() => {
    if (!hasExpectedGroups) return [];
    const ids = groupMembers
      .filter((gm) => expectedGroupIds.includes(gm.group_id))
      .map((gm) => gm.teilnehmer_id);
    const unique = [...new Set(ids)];
    return teilnehmer.filter((t) => unique.includes(t.id));
  })();

  // ── Toggle attendance status ────────────────────────────────────────────────
  const STATUS_CYCLE: (AttendanceStatus | null)[] = ["present", "excused", "absent", null];

  async function toggleStatus(teilnehmerId: string, currentStatus: AttendanceStatus | undefined, method: "manual" | "qr" = "manual") {
    if (!canEdit) return;
    const { data: { user } } = await supabase.auth.getUser();

    if (method === "qr") {
      // QR scan only ever marks present — never removes (handled separately in handleQRScan)
      await applyStatus(teilnehmerId, "present", "qr", user?.id);
    } else {
      const idx = STATUS_CYCLE.indexOf(currentStatus ?? null);
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
      await applyStatus(teilnehmerId, next, "manual", user?.id);
    }
  }

  async function applyStatus(teilnehmerId: string, status: AttendanceStatus | null, method: "manual" | "qr", userId?: string) {
    setAttendance((prev) => {
      const next = new Map(prev);
      if (status === null) next.delete(teilnehmerId);
      else next.set(teilnehmerId, status);
      return next;
    });

    if (status === null) {
      await supabase.from("session_attendance").delete()
        .eq("session_id", session.id).eq("teilnehmer_id", teilnehmerId);
    } else {
      await supabase.from("session_attendance").upsert({
        session_id: session.id,
        teilnehmer_id: teilnehmerId,
        status,
        method,
        checked_in_by: userId ?? null,
        checked_in_at: new Date().toISOString(),
      }, { onConflict: "session_id,teilnehmer_id" });
    }
  }

  // ── Probetraining counter ──────────────────────────────────────────────────
  function adjustProbetraining(delta: number) {
    if (!canEdit) return;
    setProbetraining((cur) => Math.max(0, cur + delta));
  }

  // Persist debounced so rapid +/+/+ collapses into one write.
  useEffect(() => {
    if (probetraining === savedProbetrainingRef.current) return;
    const id = setTimeout(async () => {
      const target = probetraining;
      // Re-check inside the timeout — the parent may have re-rendered and
      // reset our callback identity between scheduling and firing. Without
      // this we could issue a duplicate write for the same value.
      if (target === savedProbetrainingRef.current) return;
      // Mark saved optimistically so subsequent effect runs converge fast.
      const prev = savedProbetrainingRef.current;
      savedProbetrainingRef.current = target;
      // Patch the parent's local session state so the badge on the plan card
      // updates immediately AND the parent's realtime subscription can
      // suppress the echo of this write.
      onLocalSessionPatch?.({ probetraining_count: target });
      const { error } = await supabase
        .from("training_sessions")
        .update({ probetraining_count: target })
        .eq("id", session.id);
      if (error) {
        savedProbetrainingRef.current = prev;
        toast.error("Probetraining konnte nicht gespeichert werden");
      }
    }, 400);
    return () => clearTimeout(id);
  }, [probetraining, session.id, supabase, onLocalSessionPatch]);

  // ── Training abschließen ────────────────────────────────────────────────
  // Explicit completion flag. Stats only count trainings with completed_at
  // set, so this is what turns a session from "existed" into "counts".
  async function completeSession() {
    if (!canEdit) return;
    setCompleting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("training_sessions")
      .update({ completed_at: nowIso, completed_by: user?.id ?? null })
      .eq("id", session.id);
    if (error) {
      toast.error("Konnte nicht abgeschlossen werden");
      setCompleting(false);
      return;
    }
    setCompletedAt(nowIso);
    onLocalSessionPatch?.({
      completed_at: nowIso,
      completed_by: user?.id ?? null,
    });
    setCompleting(false);
    toast.success("Training abgeschlossen");
    onClose();
  }

  async function uncompleteSession() {
    if (!canEdit) return;
    setCompleting(true);
    const { error } = await supabase
      .from("training_sessions")
      .update({ completed_at: null, completed_by: null })
      .eq("id", session.id);
    if (error) {
      toast.error("Konnte nicht aufgehoben werden");
      setCompleting(false);
      return;
    }
    setCompletedAt(null);
    onLocalSessionPatch?.({ completed_at: null, completed_by: null });
    setCompleting(false);
    toast.success("Abschluss aufgehoben");
  }

  // ── Mark all present ────────────────────────────────────────────────────────
  async function markAllPresent() {
    if (!canEdit) return;
    setSaving(true);
    // Mark expected group members if groups are set, otherwise all teilnehmer
    const targets = hasExpectedGroups ? expectedTeilnehmer : teilnehmer;
    const { data: { user } } = await supabase.auth.getUser();
    const rows = targets.map((t) => ({
      session_id: session.id,
      teilnehmer_id: t.id,
      status: "present" as const,
      method: "manual" as const,
      checked_in_by: user?.id ?? null,
      checked_in_at: new Date().toISOString(),
    }));
    if (rows.length > 0) {
      await supabase.from("session_attendance").upsert(rows, { onConflict: "session_id,teilnehmer_id" });
      const map = new Map(attendance);
      for (const t of targets) map.set(t.id, "present");
      setAttendance(map);
    }
    setSaving(false);
  }

  // ── QR scan check-in ───────────────────────────────────────────────────────
  async function handleQRScan(payload: TeilnehmerQRPayload) {
    const found = teilnehmer.find((t) => t.id === payload.id);
    setScannerOpen(false);

    if (!found) {
      setScanResult({ name: payload.name, alreadyPresent: false });
      setTimeout(() => setScanResult(null), 2500);
      toast.error(`Unbekannt: ${payload.name}`);
      return;
    }

    const alreadyPresent = attendance.get(found.id) === "present";

    if (!alreadyPresent) {
      await toggleStatus(found.id, undefined, "qr");
    }

    setScanResult({ name: found.name, alreadyPresent });
    setTimeout(() => setScanResult(null), 2000);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const presentCount  = [...attendance.values()].filter((s) => s === "present").length;
  const excusedCount  = [...attendance.values()].filter((s) => s === "excused").length;
  const absentCount   = [...attendance.values()].filter((s) => s === "absent").length;
  const total         = hasExpectedGroups ? expectedTeilnehmer.length : teilnehmer.length;

  // ── Groups of a teilnehmer (display) ──────────────────────────────────────
  function getGroupsForTeilnehmer(id: string): TeilnehmerGroup[] {
    const gids = groupMembers.filter((gm) => gm.teilnehmer_id === id).map((gm) => gm.group_id);
    return groups.filter((g) => gids.includes(g.id));
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <div className="relative w-full sm:max-w-lg max-h-[95svh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-card shadow-xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Anwesenheit — {DAY_NAMES[session.day_of_week]}
              </p>
              {completedAt && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 leading-none">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Abgeschlossen
                </span>
              )}
            </div>
            <p className="font-bold text-base leading-tight" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              {formatTime(session.time_start)} – {formatTime(session.time_end)}
            </p>
            {!loading && (
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-green-600 font-medium">{presentCount} anwesend</span>
                {excusedCount > 0 && <span className="text-amber-600 font-medium"> · {excusedCount} entschuldigt</span>}
                {absentCount > 0 && <span className="text-destructive font-medium"> · {absentCount} abwesend</span>}
                {total > 0 && <span> / {total} erwartet</span>}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ── Expected group badges (read-only, set in session editor) ── */}
            {hasExpectedGroups && groups.filter((g) => expectedGroupIds.includes(g.id)).length > 0 && (
              <div className="px-5 py-2.5 border-b border-border bg-secondary/20 shrink-0 flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mr-1">Gruppen:</span>
                {groups.filter((g) => expectedGroupIds.includes(g.id)).map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium border"
                    style={{ backgroundColor: `${g.color}20`, borderColor: `${g.color}50`, color: g.color ?? undefined }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: g.color ?? undefined }} />
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {/* ── Probetraining counter ──────────────────────── */}
            {(canEdit || probetraining > 0) && (
              <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="7" r="4" />
                      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="16" y1="11" x2="22" y2="11" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-none">Probetraining</p>
                    <p className="text-[10px] text-muted-foreground leading-none mt-1 truncate">
                      Externe Teilnehmer
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    aria-label="Probetraining verringern"
                    onClick={() => adjustProbetraining(-1)}
                    disabled={!canEdit || probetraining === 0}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg font-semibold hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <span
                    className="w-9 text-center text-lg font-bold tabular-nums leading-none"
                    style={{ fontFamily: "var(--font-syne, system-ui)" }}
                  >
                    {probetraining}
                  </span>
                  <button
                    type="button"
                    aria-label="Probetraining erhöhen"
                    onClick={() => adjustProbetraining(1)}
                    disabled={!canEdit}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg font-semibold hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* ── Action bar ─────────────────────────────────── */}
            {canEdit && (
              <div className="flex gap-2 px-5 py-2.5 border-b border-border bg-secondary/10 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={markAllPresent}
                  disabled={saving || teilnehmer.length === 0}
                  className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Alle anwesend
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen((o) => !o)}
                  className={`h-8 px-3 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    scannerOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-secondary"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
                    <rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                    <path d="M21 21v.01"/>
                  </svg>
                  QR-Scanner {scannerOpen ? "schließen" : "öffnen"}
                </button>
              </div>
            )}

            {/* ── QR Scanner ─────────────────────────────────── */}
            {scannerOpen && canEdit && (
              <div className="w-full border-b border-border shrink-0">
                <InlineQRScanner onScan={handleQRScan} />
              </div>
            )}

            {/* ── Search bar ────────────────────────────────── */}
            {teilnehmer.length > 0 && (
              <div className="px-5 py-2.5 border-b border-border bg-background shrink-0">
                <div className="relative">
                  <svg
                    width="13" height="13" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Teilnehmer suchen…"
                    className="w-full h-9 text-sm rounded-lg border border-border bg-secondary/30 pl-8 pr-8 placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-background"
                    autoComplete="off"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Suche leeren"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Teilnehmer list ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {teilnehmer.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                  <p className="font-semibold mb-1">Keine Teilnehmer</p>
                  <p className="text-sm text-muted-foreground">
                    Füge zuerst Teilnehmer unter dem Reiter &quot;Teilnehmer&quot; hinzu.
                  </p>
                </div>
              ) : (
                (() => {
                  const q = search.trim().toLowerCase();
                  const matches = (t: Teilnehmer) =>
                    !q || t.name.toLowerCase().includes(q);
                  const searching = q.length > 0;

                  const filteredExpected = expectedTeilnehmer.filter(matches);
                  const expectedIds = new Set(expectedTeilnehmer.map((t) => t.id));
                  const remaining = teilnehmer.filter((t) => !expectedIds.has(t.id));
                  const filteredRemaining = remaining.filter(matches);
                  const filteredFlat = teilnehmer.filter(matches);

                  const nothing =
                    hasExpectedGroups
                      ? filteredExpected.length === 0 && filteredRemaining.length === 0
                      : filteredFlat.length === 0;

                  if (searching && nothing) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                        <p className="text-sm text-muted-foreground">
                          Keine Treffer für &quot;{search}&quot;.
                        </p>
                      </div>
                    );
                  }

                  // Auto-expand "Weitere" when searching so hits in there aren't hidden.
                  const showRemaining = searching || weitereOpen;

                  return (
                    <div className="divide-y divide-border">
                      {hasExpectedGroups ? (
                        <>
                          {filteredExpected.length > 0 && (
                            <>
                              <div className="px-5 py-2 bg-secondary/30">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                  Erwartet ({filteredExpected.length}
                                  {searching && filteredExpected.length !== expectedTeilnehmer.length
                                    ? ` / ${expectedTeilnehmer.length}`
                                    : ""}
                                  )
                                </p>
                              </div>
                              {filteredExpected.map((t) => (
                                <TeilnehmerRow
                                  key={t.id}
                                  teilnehmer={t}
                                  status={attendance.get(t.id)}
                                  groups={getGroupsForTeilnehmer(t.id)}
                                  canEdit={canEdit}
                                  onToggle={() => toggleStatus(t.id, attendance.get(t.id))}
                                />
                              ))}
                            </>
                          )}

                          {filteredRemaining.length > 0 && (
                            <>
                              {searching ? (
                                <div className="px-5 py-2 bg-secondary/20">
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Weitere ({filteredRemaining.length} / {remaining.length})
                                  </p>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setWeitereOpen((o) => !o)}
                                  className="w-full flex items-center justify-between px-5 py-2.5 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                                >
                                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                    Weitere ({remaining.length})
                                  </p>
                                  <svg
                                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                    className={`text-muted-foreground transition-transform duration-200 ${weitereOpen ? "rotate-180" : ""}`}
                                  >
                                    <polyline points="6 9 12 15 18 9" />
                                  </svg>
                                </button>
                              )}
                              {showRemaining &&
                                filteredRemaining.map((t) => (
                                  <TeilnehmerRow
                                    key={t.id}
                                    teilnehmer={t}
                                    status={attendance.get(t.id)}
                                    groups={getGroupsForTeilnehmer(t.id)}
                                    canEdit={canEdit}
                                    onToggle={() => toggleStatus(t.id, attendance.get(t.id))}
                                  />
                                ))}
                            </>
                          )}
                        </>
                      ) : (
                        filteredFlat.map((t) => (
                          <TeilnehmerRow
                            key={t.id}
                            teilnehmer={t}
                            status={attendance.get(t.id)}
                            groups={getGroupsForTeilnehmer(t.id)}
                            canEdit={canEdit}
                            onToggle={() => toggleStatus(t.id, attendance.get(t.id))}
                          />
                        ))
                      )}
                    </div>
                  );
                })()
              )}
            </div>

            {/* ── Completion footer ────────────────────────────── */}
            {session.kind === "training" && canEdit && (
              <div className="border-t border-border bg-card px-5 py-3 shrink-0 flex items-center justify-between gap-3">
                {completedAt ? (
                  <>
                    <div className="text-xs text-muted-foreground min-w-0">
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        Abgeschlossen
                      </span>
                      <span className="ml-1">
                        · {new Date(completedAt).toLocaleDateString("de-DE", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={uncompleteSession}
                      disabled={completing}
                      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
                    >
                      Aufheben
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground truncate">
                      {presentCount === 0
                        ? "Noch keine Anwesenheit erfasst"
                        : `${presentCount} anwesend · bereit zum Abschließen`}
                    </div>
                    <button
                      type="button"
                      onClick={completeSession}
                      disabled={completing}
                      className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 shrink-0"
                    >
                      {completing ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      Training abschließen
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* ── QR scan result flash ────────────────────────────── */}
        {scanResult && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-t-2xl sm:rounded-2xl z-10 pointer-events-none">
            <div className={`flex flex-col items-center gap-3 px-8 py-6 rounded-2xl shadow-2xl border ${
              scanResult.alreadyPresent
                ? "bg-card border-border"
                : "bg-card border-green-500/40"
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                scanResult.alreadyPresent ? "bg-amber-500/15" : "bg-green-500/15"
              }`}>
                {scanResult.alreadyPresent ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
              <div className="text-center">
                <p className="font-bold text-base" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                  {scanResult.name}
                </p>
                <p className={`text-sm mt-0.5 ${scanResult.alreadyPresent ? "text-amber-600" : "text-green-600"}`}>
                  {scanResult.alreadyPresent ? "Bereits eingestempelt" : "Eingestempelt ✓"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Teilnehmer row ────────────────────────────────────────────────────────────

function TeilnehmerRow({
  teilnehmer,
  status,
  groups,
  canEdit,
  onToggle,
}: {
  teilnehmer: Teilnehmer;
  status: AttendanceStatus | undefined;
  groups: TeilnehmerGroup[];
  canEdit: boolean;
  onToggle: () => void;
}) {
  const cfg = status ? STATUS_CFG[status] : null;

  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/20 transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {teilnehmer.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
      </div>

      {/* Name + notes + groups */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{teilnehmer.name}</p>
        {teilnehmer.notes && (
          <p
            className="text-[11px] text-muted-foreground/90 italic leading-snug mt-0.5 line-clamp-1"
            title={teilnehmer.notes}
          >
            {teilnehmer.notes}
          </p>
        )}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {groups.map((g) => (
              <span
                key={g.id}
                className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${g.color}15`, color: g.color ?? undefined }}
              >
                {g.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status toggle */}
      {canEdit ? (
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-all ${
            cfg ? `${cfg.bg} ${cfg.text}` : "border-border text-muted-foreground hover:bg-secondary"
          }`}
          title={cfg ? cfg.label : "Status setzen"}
        >
          {cfg ? cfg.icon : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          )}
          <span className="hidden sm:inline">{cfg ? cfg.label : "—"}</span>
        </button>
      ) : (
        cfg ? (
          <span className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text}`}>
            {cfg.icon}
            <span className="hidden sm:inline">{cfg.label}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground/50">—</span>
        )
      )}
    </div>
  );
}
