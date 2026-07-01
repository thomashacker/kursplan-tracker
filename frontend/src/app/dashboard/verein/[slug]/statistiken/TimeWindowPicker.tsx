"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { windowShortLabel } from "./dateRange";

export type TimeWindow =
  | "current_month"
  | "last_month"
  | "6m"
  | "1y"
  | "custom";

const WINDOW_VALUES: TimeWindow[] = [
  "current_month",
  "last_month",
  "6m",
  "1y",
  "custom",
];

export default function TimeWindowPicker({
  current,
  from,
  to,
}: {
  current: TimeWindow;
  /** ISO YYYY-MM-DD — only meaningful when current === "custom". */
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local mirror so the inputs feel snappy while the URL update transitions.
  const [localFrom, setLocalFrom] = useState<string>(from ?? "");
  const [localTo, setLocalTo] = useState<string>(to ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalFrom(from ?? "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalTo(to ?? "");
  }, [from, to]);

  function select(w: TimeWindow) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", w);
    if (w !== "custom") {
      params.delete("from");
      params.delete("to");
    } else {
      // Seed sensible defaults so the range isn't empty on first click.
      if (!params.get("from")) {
        const today = new Date();
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.set("from", toISODateLocal(monthAgo));
      }
      if (!params.get("to")) {
        params.set("to", toISODateLocal(new Date()));
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function updateRange(next: { from?: string; to?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("window", "custom");
    if (next.from !== undefined) params.set("from", next.from);
    if (next.to !== undefined) params.set("to", next.to);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const rangeInvalid =
    current === "custom" &&
    localFrom !== "" &&
    localTo !== "" &&
    localFrom > localTo;

  // Recompute once per mount — enough for month-name labels (they only change
  // when the calendar month rolls over, so mid-session drift is fine).
  const options = useMemo(() => {
    const now = new Date();
    return WINDOW_VALUES.map((value) => ({
      value,
      label: windowShortLabel(value, now),
    }));
  }, []);

  return (
    <div className="flex flex-col gap-2 items-stretch sm:items-end">
      <div
        className={`flex flex-wrap gap-1 p-1 rounded-xl bg-secondary/50 border border-border transition-opacity ${
          isPending ? "opacity-50" : ""
        }`}
      >
        {options.map((opt) => (
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

      {current === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span>Von</span>
            <input
              type="date"
              value={localFrom}
              max={localTo || undefined}
              onChange={(e) => {
                setLocalFrom(e.target.value);
                if (e.target.value) updateRange({ from: e.target.value });
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-foreground tabular-nums"
            />
          </label>
          <span className="text-muted-foreground/60">–</span>
          <label className="flex items-center gap-1.5 text-muted-foreground">
            <span>Bis</span>
            <input
              type="date"
              value={localTo}
              min={localFrom || undefined}
              onChange={(e) => {
                setLocalTo(e.target.value);
                if (e.target.value) updateRange({ to: e.target.value });
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-foreground tabular-nums"
            />
          </label>
          {rangeInvalid && (
            <span className="text-[11px] text-red-500">
              Bis muss nach Von liegen.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function toISODateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
