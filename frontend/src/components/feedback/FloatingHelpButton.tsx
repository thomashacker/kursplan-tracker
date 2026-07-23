"use client";

import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { FeedbackSheet } from "./FeedbackSheet";

/**
 * Fixed help affordance in the bottom-right corner of every authenticated
 * screen. Opens the FeedbackSheet on click or via the `?` keyboard
 * shortcut (web convention for help). Deliberately understated — the
 * button shouldn't distract from primary flows.
 */
export function FloatingHelpButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Only fire when nothing is typed into an editable target.
      const t = e.target as HTMLElement | null;
      const editable =
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        (t?.isContentEditable ?? false);
      if (editable) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Hilfe & Feedback (Tastenkürzel: ?)"
        className="fixed bottom-4 right-4 z-40 h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-card border border-border shadow-lg hover:shadow-xl hover:border-primary/40 text-muted-foreground hover:text-primary transition-all flex items-center justify-center active:scale-95"
      >
        <HelpCircle size={20} strokeWidth={1.8} />
      </button>
      {open && <FeedbackSheet onClose={() => setOpen(false)} />}
    </>
  );
}
