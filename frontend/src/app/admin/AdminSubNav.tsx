"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Gauge, SlidersHorizontal, MessageSquareWarning } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ITEMS = [
  { href: "/admin",          label: "Übersicht", icon: Gauge },
  { href: "/admin/plans",    label: "Pläne",     icon: SlidersHorizontal },
  { href: "/admin/feedback", label: "Feedback",  icon: MessageSquareWarning },
];

export function AdminSubNav() {
  const pathname = usePathname();
  const [openCount, setOpenCount] = useState<number>(0);

  // Nudge count next to the "Feedback" pill so the operator knows there's
  // something waiting without having to click through. Cheap: one COUNT
  // query per admin page load, RLS scopes it to superadmin.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { count } = await supabase
        .from("feedback")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (!cancelled) setOpenCount(count ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="sticky top-14 z-30 border-b border-border/70 bg-background/70 backdrop-blur-md">
      <div className="max-w-[100rem] mx-auto px-4 sm:px-6 h-11 flex items-center gap-3">
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground shrink-0 hidden sm:inline">
          Ops
        </span>
        <span className="text-border shrink-0 hidden sm:inline">·</span>
        <nav className="flex items-center gap-1">
          {ITEMS.map(({ href, label, icon: Icon }) => {
            const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
            const showCount = href === "/admin/feedback" && openCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-medium transition-all ${
                  active
                    ? "bg-primary/10 text-primary ring-1 ring-primary/25 shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <Icon size={13} strokeWidth={2} />
                {label}
                {showCount && (
                  <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold tabular-nums bg-destructive/15 text-destructive">
                    {openCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
