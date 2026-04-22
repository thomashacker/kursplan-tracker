"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  href: string;
  adminOnly?: boolean;
}

const TABS: Tab[] = [
  { label: "Trainingsplan", href: "plan" },
  { label: "Mitglieder", href: "mitglieder" },
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

  const tabs = TABS.filter((t) => !t.adminOnly || role === "admin");

  return (
    <div className="flex gap-1 border-b">
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
  );
}
