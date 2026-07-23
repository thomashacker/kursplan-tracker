"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Bug, Lightbulb, MessageCircle, X, Check, Archive, RotateCcw } from "lucide-react";
import type { Feedback, FeedbackKind } from "@/types";
import { FEEDBACK_KIND_LABELS } from "@/types";

const KIND_ICON: Record<FeedbackKind, React.ElementType> = {
  bug: Bug,
  idea: Lightbulb,
  other: MessageCircle,
};

const springSnap = { type: "spring" as const, stiffness: 380, damping: 30 };

export function FeedbackDetailModal({
  feedback,
  onClose,
  onUpdate,
}: {
  feedback: Feedback;
  onClose: () => void;
  onUpdate: (patch: Partial<Feedback>) => void | Promise<void>;
}) {
  const reduced = useReducedMotion();
  const [note, setNote] = useState<string>(feedback.admin_note ?? "");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const Icon = KIND_ICON[feedback.kind];
  const isDirtyNote = (feedback.admin_note ?? "") !== note;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: 40, opacity: 0 }}
          transition={springSnap}
          className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                <Icon size={17} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {FEEDBACK_KIND_LABELS[feedback.kind]}
                </p>
                <p
                  className="font-bold text-base leading-tight"
                  style={{ fontFamily: "var(--font-syne, system-ui)" }}
                >
                  {new Date(feedback.created_at).toLocaleString("de-DE")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground shrink-0"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Message */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Nachricht
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {feedback.message}
              </p>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <MetaRow label="Autor (User-ID)" value={feedback.user_id ? `u_${feedback.user_id.slice(0, 8)}` : "—"} mono />
              <MetaRow label="Verein" value={feedback.club_id ? `${feedback.club_id.slice(0, 8)}…` : "—"} mono />
              <MetaRow label="Seite" value={feedback.page_url ?? "—"} mono full />
              <MetaRow label="Browser" value={feedback.user_agent ?? "—"} full />
            </div>

            {/* Admin note */}
            <div className="pt-2 border-t border-border">
              <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Notiz (privat)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="z. B. Repro-Steps, verwandte Issues, Entscheidung …"
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:ring-3 focus:ring-ring/50 outline-none"
              />
              {isDirtyNote && (
                <button
                  type="button"
                  onClick={() => onUpdate({ admin_note: note.trim() || null })}
                  className="mt-2 h-8 px-3 rounded-md border border-border text-xs font-medium hover:bg-secondary transition-colors"
                >
                  Notiz speichern
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-border px-5 py-3 flex items-center justify-end gap-2 shrink-0">
            {feedback.status === "open" && (
              <>
                <ActionBtn
                  onClick={() => onUpdate({ status: "archived" })}
                  icon={<Archive size={13} />}
                  label="Archivieren"
                />
                <ActionBtn
                  primary
                  onClick={() => onUpdate({ status: "solved" })}
                  icon={<Check size={13} />}
                  label="Als gelöst markieren"
                />
              </>
            )}
            {feedback.status !== "open" && (
              <ActionBtn
                onClick={() => onUpdate({ status: "open" })}
                icon={<RotateCcw size={13} />}
                label="Wieder öffnen"
              />
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function MetaRow({
  label,
  value,
  mono,
  full,
}: {
  label: string;
  value: string;
  mono?: boolean;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/80 mb-0.5">
        {label}
      </p>
      <p
        className={`text-xs text-foreground/85 break-all ${mono ? "font-mono" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function ActionBtn({
  onClick,
  icon,
  label,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border hover:bg-secondary"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
