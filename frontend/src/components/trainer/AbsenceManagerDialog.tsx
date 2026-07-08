"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { TrainerAvailability, AbsenceReason } from "@/types";
import { ABSENCE_REASON_LABELS } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  clubId: string;
  /** Exactly one of these must be set. */
  userId?: string | null;
  virtualTrainerId?: string | null;
  trainerName: string;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AbsenceManagerDialog({
  open,
  onClose,
  clubId,
  userId,
  virtualTrainerId,
  trainerName,
}: Props) {
  const [rows, setRows] = useState<TrainerAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TrainerAvailability | null>(null);

  // New-window form
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState<AbsenceReason>("sick");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const supabase = createClient();
    const q = supabase
      .from("trainer_availability")
      .select("*")
      .eq("club_id", clubId)
      .order("start_date", { ascending: false });
    const query = userId ? q.eq("user_id", userId) : q.eq("virtual_trainer_id", virtualTrainerId!);
    query.returns<TrainerAvailability[]>().then(({ data, error }) => {
      if (error) {
        toast.error("Konnte Abwesenheiten nicht laden.");
      }
      setRows(data ?? []);
      setLoading(false);
    });
  }, [open, clubId, userId, virtualTrainerId]);

  async function handleAdd() {
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      toast.error("Enddatum liegt vor Startdatum.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("trainer_availability")
      .insert({
        club_id: clubId,
        user_id: userId ?? null,
        virtual_trainer_id: virtualTrainerId ?? null,
        start_date: startDate,
        end_date: endDate,
        reason,
        note: note.trim() || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single<TrainerAvailability>();

    if (error || !data) {
      toast.error(error?.message ?? "Speichern fehlgeschlagen.");
      setSaving(false);
      return;
    }
    setRows((prev) => [data, ...prev]);
    setStartDate(todayIso());
    setEndDate(todayIso());
    setReason("sick");
    setNote("");
    setSaving(false);
    toast.success("Abwesenheit gespeichert.");
  }

  async function handleDelete() {
    if (!removeTarget) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("trainer_availability")
      .delete()
      .eq("id", removeTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== removeTarget.id));
    setRemoveTarget(null);
    toast.success("Abwesenheit entfernt.");
  }

  const today = todayIso();

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              Abwesenheiten — {trainerName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* New window form */}
            <div className="rounded-xl border border-input p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Neue Abwesenheit</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ta-start" className="text-xs text-muted-foreground">Von</Label>
                  <Input id="ta-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ta-end" className="text-xs text-muted-foreground">Bis</Label>
                  <Input id="ta-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 rounded-lg text-sm" />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Grund</Label>
                <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
                  {(["sick", "vacation", "other"] as AbsenceReason[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        reason === r ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ABSENCE_REASON_LABELS[r]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="ta-note" className="text-xs text-muted-foreground">Notiz (optional)</Label>
                <Input id="ta-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z.B. Grippe, Familienurlaub…" className="h-9 rounded-lg text-sm" />
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !startDate || !endDate}
                className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? "Wird gespeichert…" : "Hinzufügen"}
              </button>
            </div>

            {/* Existing windows */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Geplant &amp; laufend</p>
              {loading ? (
                <p className="text-xs text-muted-foreground">Wird geladen…</p>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card py-6 text-center">
                  <p className="text-xs text-muted-foreground">Noch keine Abwesenheiten.</p>
                </div>
              ) : (
                rows.map((r) => {
                  const isCurrent = today >= r.start_date && today <= r.end_date;
                  const isPast = today > r.end_date;
                  return (
                    <div
                      key={r.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isCurrent
                          ? "border-amber-500/40 bg-amber-500/5"
                          : isPast
                          ? "border-border bg-card/50 opacity-60"
                          : "border-border bg-card"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">
                            {formatIso(r.start_date)} – {formatIso(r.end_date)}
                          </span>
                          <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                            r.reason === "sick" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" :
                            r.reason === "vacation" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                            "bg-secondary text-secondary-foreground"
                          }`}>
                            {ABSENCE_REASON_LABELS[r.reason]}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                              Aktuell
                            </span>
                          )}
                        </div>
                        {r.note && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(r)}
                        className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Entfernen"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Abwesenheit entfernen?"
        description={removeTarget ? `${formatIso(removeTarget.start_date)} – ${formatIso(removeTarget.end_date)} wirklich entfernen?` : ""}
        confirmLabel="Entfernen"
        destructive
        onConfirm={handleDelete}
        onClose={() => setRemoveTarget(null)}
      />
    </>
  );
}

function formatIso(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
