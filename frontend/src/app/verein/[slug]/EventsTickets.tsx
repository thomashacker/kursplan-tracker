"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { PublicSession } from "./PublicPlanClient";

interface Props {
  events: PublicSession[];
  onSelect?: (event: PublicSession) => void;
}

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function daysUntil(iso: string): number {
  const target = new Date(iso + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
function countdownLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0)  return "Vorbei";
  if (d === 0) return "Heute";
  if (d === 1) return "Morgen";
  if (d < 7)  return `in ${d} Tagen`;
  if (d < 14) return "nächste Woche";
  if (d < 30) {
    const w = Math.round(d / 7);
    return `in ${w} ${w === 1 ? "Woche" : "Wochen"}`;
  }
  const m = Math.round(d / 30);
  return `in ${m} ${m === 1 ? "Monat" : "Monaten"}`;
}

const IconSpark = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6z"/>
  </svg>
);
const IconClock = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>
  </svg>
);
const IconPin = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

/**
 * Subtle "sparks" — a handful of tiny amber twinkles at fixed positions that
 * fade in/out on staggered loops. Absolute-positioned so they don't affect
 * layout; pointer-events:none so they don't steal clicks.
 */
function Sparks({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  // Fixed positions + delays chosen for a random-looking twinkle without
  // needing Math.random (which would rerender differently on hydration).
  const sparks = [
    { top: "12%",  left: "6%",  size: 6,  delay: 0    },
    { top: "68%",  left: "3%",  size: 4,  delay: 1.6  },
    { top: "26%",  right: "8%", size: 5,  delay: 2.4  },
    { top: "78%",  right: "14%",size: 3.5,delay: 3.0  },
    { top: "48%",  right: "40%",size: 3,  delay: 0.8  },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          className="absolute text-amber-400/70"
          style={{ top: s.top, left: s.left, right: s.right, width: s.size, height: s.size }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{
            opacity: [0, 0.9, 0],
            scale: [0.6, 1, 0.6],
            rotate: [0, 15, 0],
          }}
          transition={{
            duration: 2.6,
            delay: s.delay,
            repeat: Infinity,
            repeatDelay: 2.2,
            ease: "easeInOut",
          }}
        >
          <IconSpark className="w-full h-full" />
        </motion.span>
      ))}
    </div>
  );
}

function Ticket({ event, onClick, index }: { event: PublicSession; onClick?: () => void; index: number }) {
  const reduced = useReducedMotion();
  const date = new Date(event.dateKey + "T00:00:00");
  const day = date.getDate();
  const weekday = WEEKDAYS_DE[date.getDay()];
  const countdown = countdownLabel(event.dateKey);
  const soon = daysUntil(event.dateKey) <= 3;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1], delay: index * 0.04 }}
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      className="group relative w-full text-left rounded-xl border border-amber-500/25 bg-card hover:border-amber-500/50 hover:shadow-[0_2px_16px_-8px_rgba(180,83,9,0.3)] transition-shadow overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
    >
      <Sparks enabled={!reduced} />

      <div className="relative flex items-center gap-3 p-2.5">
        {/* Date block */}
        <div className="shrink-0 w-11 h-11 rounded-lg bg-amber-500/12 border border-amber-500/25 flex flex-col items-center justify-center leading-none">
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">{weekday}</span>
          <span className="text-[16px] font-bold tabular-nums text-foreground mt-0.5">{day}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3
            className="text-[14px] font-bold leading-tight tracking-tight truncate text-foreground"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
            title={event.title ?? undefined}
          >
            {event.title || "Event"}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <IconClock className="w-2.5 h-2.5" />
              {event.timeStart.slice(0, 5)}
            </span>
            {event.location && (
              <span className="inline-flex items-center gap-0.5 min-w-0">
                <IconPin className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{event.location.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Countdown */}
        <span
          className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            soon
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
              : "bg-secondary text-muted-foreground"
          }`}
        >
          {soon && !reduced && <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />}
          {countdown}
        </span>
      </div>
    </motion.button>
  );
}

const IconChevron = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export function EventsTickets({ events, onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);
  const reduced = useReducedMotion();
  if (events.length === 0) return null;

  const [first, ...rest] = events;
  const restCount = rest.length;

  return (
    <section aria-labelledby="events-heading" className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-1.5">
          <IconSpark className="w-3 h-3 text-amber-500" />
          <h2
            id="events-heading"
            className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-400"
          >
            Nicht verpassen
          </h2>
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {events.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {/* Always show the next event */}
        <Ticket
          key={first.id}
          event={first}
          index={0}
          onClick={onSelect ? () => onSelect(first) : undefined}
        />

        {/* Collapse the rest behind an expand toggle */}
        <AnimatePresence initial={false}>
          {expanded && rest.map((ev, i) => (
            <motion.div
              key={ev.id}
              initial={reduced ? false : { opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 6 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <Ticket
                event={ev}
                index={i + 1}
                onClick={onSelect ? () => onSelect(ev) : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {restCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-lg text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {expanded
              ? "Weniger anzeigen"
              : `${restCount} weitere${restCount === 1 ? "s" : ""} ${restCount === 1 ? "Event" : "Events"}`}
            <IconChevron className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </section>
  );
}
