"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { ClubMembership } from "@/types";
import { ROLE_LABELS } from "@/types";

const spring = { type: "spring" as const, stiffness: 280, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

function clubInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function ClubCard({ membership, index }: { membership: ClubMembership; index: number }) {
  const reduced = useReducedMotion();
  const club = membership.clubs!;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: index * 0.07 }}
    >
      <Link href={`/dashboard/verein/${club.slug}/plan`}>
        <motion.div
          whileTap={reduced ? {} : { scale: 0.98 }}
          transition={springSnap}
          className="group flex items-center gap-4 p-4 rounded-2xl bg-card border border-border hover:border-primary/25 hover:shadow-sm transition-all cursor-pointer"
        >
          {/* Logo or initials */}
          <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 overflow-hidden flex items-center justify-center">
            {club.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" />
            ) : (
              <span
                className="font-bold text-primary text-base"
                style={{ fontFamily: "var(--font-syne, system-ui)" }}
              >
                {clubInitials(club.name)}
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className="font-bold text-foreground leading-tight truncate"
              style={{ fontFamily: "var(--font-syne, system-ui)" }}
            >
              {club.name}
            </p>
            {club.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                {club.description}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {ROLE_LABELS[membership.role]}
              </span>
              {club.is_public && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-1 h-1 rounded-full bg-green-500" />
                  Öffentlich
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            className="shrink-0 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all"
          >
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </Link>
    </motion.div>
  );
}

export function ClubList({
  memberships,
  userName,
}: {
  memberships: ClubMembership[];
  userName: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0 }}
        className="flex items-start justify-between gap-4 mb-8"
      >
        <div>
          <h1
            className="font-bold tracking-tight leading-tight"
            style={{
              fontFamily: "var(--font-syne, system-ui)",
              fontSize: "clamp(1.75rem, 7vw, 2.5rem)",
            }}
          >
            Meine Vereine.
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Willkommen zurück{userName ? `, ${userName.split(" ")[0]}` : ""}!
          </p>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring, delay: 0.1 }}
        >
          <Link
            href="/dashboard/verein/neu"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Verein erstellen</span>
            <span className="sm:hidden">Neu</span>
          </Link>
        </motion.div>
      </motion.div>

      {/* Empty state */}
      {!memberships.length ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.1 }}
          className="relative rounded-2xl border border-dashed border-border bg-card overflow-hidden"
        >
          <div className="absolute inset-0 bg-dot-grid opacity-60 pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <p
              className="font-bold text-lg mb-1"
              style={{ fontFamily: "var(--font-syne, system-ui)" }}
            >
              Noch kein Verein.
            </p>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              Erstelle deinen ersten Verein und lade Trainer und Mitglieder ein.
            </p>
            <Link
              href="/dashboard/verein/neu"
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Ersten Verein erstellen
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-3">
          {memberships.map((m, i) => (
            <ClubCard key={m.id} membership={m} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
