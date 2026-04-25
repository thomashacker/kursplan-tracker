"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type TimeWindow = "1w" | "1m" | "3m" | "6m" | "1y";

const OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "1w", label: "1 Woche" },
  { value: "1m", label: "1 Monat" },
  { value: "3m", label: "3 Monate" },
  { value: "6m", label: "6 Monate" },
  { value: "1y", label: "1 Jahr" },
];

export default function TimeWindowPicker({ current }: { current: TimeWindow }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(w: TimeWindow) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", w);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className={`flex gap-1 p-1 rounded-xl bg-secondary/50 border border-border transition-opacity ${isPending ? "opacity-50" : ""}`}>
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            current === opt.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
