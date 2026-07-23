"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bug, Lightbulb, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Feedback, FeedbackKind, FeedbackStatus } from "@/types";
import { FEEDBACK_KIND_LABELS } from "@/types";
import { FeedbackDetailModal } from "./FeedbackDetailModal";

const KIND_ICON: Record<FeedbackKind, React.ElementType> = {
  bug: Bug,
  idea: Lightbulb,
  other: MessageCircle,
};

const KIND_TINT: Record<FeedbackKind, string> = {
  bug:   "text-destructive bg-destructive/10",
  idea:  "text-amber-600 dark:text-amber-400 bg-amber-500/10",
  other: "text-muted-foreground bg-secondary",
};

const STATUS_TINT: Record<FeedbackStatus, string> = {
  open:     "bg-primary/10 text-primary ring-primary/25",
  solved:   "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/25",
  archived: "bg-muted text-muted-foreground ring-border",
};

function truncateId(id: string | null): string {
  if (!id) return "—";
  return `u_${id.slice(0, 6)}`;
}

function timeAgo(iso: string): string {
  const ms = new Date().getTime() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 1) {
    const hrs = Math.floor(ms / (60 * 60 * 1000));
    if (hrs < 1) return "gerade eben";
    return `vor ${hrs}h`;
  }
  if (days === 1) return "vor 1 Tag";
  if (days < 30) return `vor ${days} Tagen`;
  const months = Math.floor(days / 30);
  return `vor ${months} Monaten`;
}

export function FeedbackListClient({ initialItems }: { initialItems: Feedback[] }) {
  const [items, setItems] = useState<Feedback[]>(initialItems);
  const [open, setOpen] = useState<Feedback | null>(null);
  const [filter, setFilter] = useState<FeedbackStatus | "all">("open");

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((f) => f.status === filter)),
    [items, filter],
  );

  const counts = useMemo(() => {
    const c: Record<FeedbackStatus | "all", number> = {
      open: 0, solved: 0, archived: 0, all: items.length,
    };
    for (const f of items) c[f.status]++;
    return c;
  }, [items]);

  async function updateItem(id: string, patch: Partial<Feedback>) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const payload: Partial<Feedback> = { ...patch };
    if (patch.status === "solved") {
      payload.resolved_at = new Date().toISOString();
      payload.resolved_by = user?.id ?? null;
    } else if (patch.status === "open") {
      payload.resolved_at = null;
      payload.resolved_by = null;
    }
    const { data, error } = await supabase
      .from("feedback")
      .update(payload)
      .eq("id", id)
      .select()
      .single<Feedback>();
    if (error || !data) {
      toast.error(error?.message ?? "Update fehlgeschlagen");
      return;
    }
    setItems((prev) => prev.map((f) => (f.id === id ? data : f)));
    if (open?.id === id) setOpen(data);
    toast.success("Aktualisiert");
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center">
        <p className="font-semibold text-sm mb-1">Noch kein Feedback.</p>
        <p className="text-sm text-muted-foreground">
          Sobald jemand über den Hilfe-Button etwas sendet, taucht es hier auf.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 flex-wrap">
        {(["open", "solved", "archived", "all"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
              filter === k
                ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {k === "open" && "Offen"}
            {k === "solved" && "Gelöst"}
            {k === "archived" && "Archiv"}
            {k === "all" && "Alle"}
            <span className="tabular-nums opacity-70">{counts[k]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Keine Einträge in dieser Ansicht.
          </div>
        ) : (
          visible.map((f) => {
            const Icon = KIND_ICON[f.kind];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setOpen(f)}
                className="w-full text-left px-4 py-3 hover:bg-secondary/40 transition-colors flex items-start gap-3"
              >
                <span
                  className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center ${KIND_TINT[f.kind]}`}
                  title={FEEDBACK_KIND_LABELS[f.kind]}
                >
                  <Icon size={15} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground line-clamp-2 leading-snug">{f.message}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span
                      className={`inline-flex items-center h-5 px-2 rounded-full text-[9px] font-bold uppercase tracking-widest ring-1 ${STATUS_TINT[f.status]}`}
                    >
                      {f.status === "open" ? "Offen" : f.status === "solved" ? "Gelöst" : "Archiv"}
                    </span>
                    <span className="font-mono">{truncateId(f.user_id)}</span>
                    <span>·</span>
                    <span>{timeAgo(f.created_at)}</span>
                    {f.page_url && (
                      <>
                        <span>·</span>
                        <span className="font-mono truncate max-w-[16rem]" title={f.page_url}>
                          {f.page_url}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {open && (
        <FeedbackDetailModal
          feedback={open}
          onClose={() => setOpen(null)}
          onUpdate={(patch) => updateItem(open.id, patch)}
        />
      )}
    </div>
  );
}
