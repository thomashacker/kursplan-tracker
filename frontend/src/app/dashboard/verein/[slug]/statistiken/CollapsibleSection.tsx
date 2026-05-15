"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";

interface Props {
  title: string;
  count?: number | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Click-to-toggle wrapper for a group of related stats. The entire header
 * is a real <button>, so taps work on mobile without relying on hover.
 */
export function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center justify-between gap-3 py-1 -mx-1 px-1 rounded-md hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
            {title}
          </p>
          {typeof count === "number" && count > 0 && (
            <span className="text-[10px] font-semibold text-muted-foreground/60 tabular-nums">
              {count}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={
            reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 28 }
          }
          className="text-muted-foreground group-hover:text-foreground transition-colors inline-flex"
        >
          <ChevronDown size={15} strokeWidth={2.25} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={reduced ? { opacity: 1 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
            }
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
