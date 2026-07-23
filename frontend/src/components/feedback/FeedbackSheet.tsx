"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { Bug, Lightbulb, MessageCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { FeedbackKind } from "@/types";
import { FEEDBACK_MESSAGE_MAX } from "@/types";

type Tab = {
  kind: FeedbackKind;
  label: string;
  icon: React.ElementType;
  placeholder: string;
};

const TABS: Tab[] = [
  {
    kind: "bug",
    label: "Bug",
    icon: Bug,
    placeholder:
      "Was ist passiert? Was hast du gemacht, was hast du erwartet, was ist stattdessen passiert?",
  },
  {
    kind: "idea",
    label: "Idee",
    icon: Lightbulb,
    placeholder: "Was würde dir die App leichter machen?",
  },
  {
    kind: "other",
    label: "Sonstiges",
    icon: MessageCircle,
    placeholder: "Alles andere — Frage, Feedback, Hallo …",
  },
];

const springSnap = { type: "spring" as const, stiffness: 380, damping: 30 };

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const reduced = useReducedMotion();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    const trimmed = message.trim();
    if (trimmed.length < 3) {
      toast.error("Bitte gib eine kurze Beschreibung ein.");
      return;
    }
    setSending(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Nicht angemeldet.");
      setSending(false);
      return;
    }

    // Extract club_id from URL if we're inside a Verein — best-effort.
    // Pattern: /dashboard/verein/[slug]/... — we look up club by slug.
    let club_id: string | null = null;
    const match = window.location.pathname.match(
      /^\/(?:dashboard\/verein|verein)\/([^/]+)/,
    );
    if (match) {
      const { data } = await supabase
        .from("clubs")
        .select("id")
        .eq("slug", match[1])
        .maybeSingle();
      club_id = data?.id ?? null;
    }

    const { error } = await supabase.from("feedback").insert({
      kind,
      message: trimmed,
      user_id: user.id,
      club_id,
      page_url: window.location.pathname + window.location.search,
      user_agent: navigator.userAgent.slice(0, 500),
    });

    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Danke! Wir schauen uns das an.");
    onClose();
  }

  const active = TABS.find((t) => t.kind === kind)!;
  const charsLeft = FEEDBACK_MESSAGE_MAX - message.length;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 p-0 sm:p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={reduced ? { opacity: 0 } : { y: "100%", opacity: 0.9 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: "100%", opacity: 0 }}
          transition={springSnap}
          className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-border" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-border">
            <div>
              <h2
                className="font-bold text-lg leading-none"
                style={{ fontFamily: "var(--font-syne, system-ui)" }}
              >
                Feedback senden
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Wird direkt an den Betreiber weitergeleitet.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Schließen"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>

          {/* Kind tabs */}
          <div className="px-5 pt-4">
            <div className="inline-flex rounded-full p-0.5 bg-secondary">
              {TABS.map(({ kind: k, label, icon: Icon }) => {
                const activeTab = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKind(k)}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                      activeTab
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon size={13} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message */}
          <div className="px-5 pt-3 pb-4">
            <textarea
              value={message}
              onChange={(e) =>
                setMessage(e.target.value.slice(0, FEEDBACK_MESSAGE_MAX))
              }
              placeholder={active.placeholder}
              rows={5}
              className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-relaxed focus:border-ring focus:ring-3 focus:ring-ring/50 outline-none transition-all"
              autoFocus
            />
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/70 tabular-nums">
              <span>Enter zum Zeilenumbruch · Esc zum Schließen</span>
              <span className={charsLeft < 100 ? "text-amber-600" : ""}>
                {message.length} / {FEEDBACK_MESSAGE_MAX}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-3">
            <motion.button
              type="button"
              onClick={submit}
              disabled={sending || message.trim().length < 3}
              whileTap={reduced ? {} : { scale: 0.97 }}
              transition={springSnap}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {sending ? "Sende…" : "Senden"}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
