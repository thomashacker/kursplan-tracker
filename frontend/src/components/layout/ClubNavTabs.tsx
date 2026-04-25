"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  adminOnly?: boolean;
  notMember?: boolean; // visible to admin + trainer but not regular member
}

const TABS: Tab[] = [
  { label: "Trainingsplan", href: "plan" },
  { label: "Mitglieder", href: "mitglieder" },
  { label: "Teilnehmer", href: "teilnehmer", notMember: true },
  { label: "Statistiken", href: "statistiken", notMember: true },
  { label: "Themen & Orte", href: "themen", adminOnly: true },
  { label: "Einstellungen", href: "einstellungen", adminOnly: true },
];

export function ClubNavTabs({
  slug,
  role,
}: {
  slug: string;
  role: "admin" | "trainer" | "member";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const tabs = TABS.filter((t) => {
    if (t.adminOnly) return role === "admin";
    if (t.notMember) return role === "admin" || role === "trainer";
    return true;
  });

  const activeTab = tabs.find((t) => pathname.startsWith(`/dashboard/verein/${slug}/${t.href}`));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <>
      {/* ── Mobile dropdown ─────────────────────────────────── */}
      <div className="sm:hidden" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm font-medium"
        >
          <span>{activeTab?.label ?? "Navigation"}</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={cn("transition-transform duration-200", open && "rotate-180")}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 mt-1.5 w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
            {tabs.map((tab) => {
              const href = `/dashboard/verein/${slug}/${tab.href}`;
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={tab.href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center px-4 py-3 text-sm transition-colors",
                    active
                      ? "bg-primary/5 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mr-2.5 shrink-0" />
                  )}
                  {!active && <span className="w-1.5 h-1.5 mr-2.5 shrink-0" />}
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Desktop tab bar ──────────────────────────────────── */}
      <div className="hidden sm:flex gap-1 border-b">
        {tabs.map((tab) => {
          const href = `/dashboard/verein/${slug}/${tab.href}`;
          const active = pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
