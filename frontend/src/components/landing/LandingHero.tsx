"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const spring = { type: "spring" as const, stiffness: 280, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 30 };

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.06 } },
};

const slideUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: spring },
};

const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } },
};

// ── Main component ────────────────────────────────────────────

export default function LandingHero() {
  const reduced = useReducedMotion();

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden bg-background">
      {/* Dot-grid texture */}
      <div className="absolute inset-0 bg-dot-grid pointer-events-none" aria-hidden />

      {/* Top accent glow */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, color-mix(in oklch, var(--color-primary) 8%, transparent) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
        aria-hidden
      />

      {/* ── Wordmark header ───────────────────────────────────── */}
      <motion.header
        className="relative z-10 px-6 pt-10"
        initial={reduced ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="3" fill="white" />
              <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.2" strokeDasharray="3 2" />
            </svg>
          </span>
          <span
            className="text-sm font-bold tracking-[0.18em] uppercase text-muted-foreground"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            Kurs.Y
          </span>
        </div>
      </motion.header>

      {/* Hero content */}
      <motion.div
        className="relative z-10 flex-1 flex flex-col justify-center px-6 pb-20 pt-12 md:items-center md:text-center"
        variants={stagger}
        initial={reduced ? false : "hidden"}
        animate="show"
      >
        {/* Pill tag */}
        <motion.div variants={fade} className="mb-7">
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-primary border border-primary/30 px-3.5 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Für Vereine & Teams
          </span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          variants={slideUp}
          className="text-foreground font-bold leading-[0.92] tracking-tight mb-7"
          style={{
            fontFamily: "var(--font-syne, system-ui)",
            fontSize: "clamp(3rem, 14vw, 6.5rem)",
          }}
        >
          Trainings-
          <br />
          <span className="text-primary">pläne.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={slideUp}
          className="text-base leading-relaxed max-w-[280px] mb-11 text-muted-foreground md:max-w-sm"
        >
          Koordiniere dein Team, verwalte Standorte und teile Trainingspläne – für jeden Verein.
        </motion.p>

        {/* CTA buttons */}
        <motion.div variants={slideUp} className="flex flex-col gap-3 w-full max-w-sm">
          <motion.div whileTap={reduced ? {} : { scale: 0.96 }} transition={springSnap}>
            <Link
              href="/registrieren"
              className="flex items-center justify-center gap-2 w-full rounded-2xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity"
              style={{ height: "58px" }}
            >
              Jetzt starten
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </motion.div>

          <motion.div whileTap={reduced ? {} : { scale: 0.96 }} transition={springSnap}>
            <Link
              href="/anmelden"
              className="flex items-center justify-center w-full rounded-2xl border border-border text-foreground font-medium text-base hover:bg-secondary transition-colors"
              style={{ height: "58px" }}
            >
              Anmelden
            </Link>
          </motion.div>
        </motion.div>

        {/* Divider with feature labels */}
        <motion.div
          variants={fade}
          className="mt-14 flex items-center gap-3 text-xs tracking-widest uppercase text-muted-foreground/60 w-full max-w-sm"
        >
          <span className="flex-1 h-px bg-border" />
          <span>Trainer · Zeiten · Standorte</span>
          <span className="flex-1 h-px bg-border" />
        </motion.div>
      </motion.div>

      {/* Bottom-right corner accent */}
      <div
        className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none"
        style={{
          background: "radial-gradient(circle at bottom right, color-mix(in oklch, var(--color-primary) 6%, transparent) 0%, transparent 70%)",
        }}
        aria-hidden
      />

      {/* Footer */}
      <div className="relative z-10 mt-auto flex items-center justify-center gap-5 pb-5 text-xs text-muted-foreground/50">
        <Link href="/nutzungsbedingungen" className="hover:text-muted-foreground transition-colors">
          Nutzungsbedingungen
        </Link>
        <span className="select-none">·</span>
        <Link href="/datenschutz" className="hover:text-muted-foreground transition-colors">
          Datenschutz
        </Link>
        <span className="select-none">·</span>
        <Link href="/impressum" className="hover:text-muted-foreground transition-colors">
          Impressum
        </Link>
      </div>
    </main>
  );
}
