"use client";

import { useState } from "react";
import type { TrainingSession, Location, Profile, ClubTopic, ClubSessionType } from "@/types";
import { DAY_NAMES } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

export interface SessionSaveData {
  day_of_week: number;
  time_start: string;
  time_end: string;
  topics: string[];
  session_types: string[];
  description: string | null;
  location_id: string | null;
  trainer_ids: string[];
}

interface Props {
  session: TrainingSession | null;
  defaultDay: number;
  locations: Location[];
  trainers: Profile[];
  topics: ClubTopic[];
  sessionTypes: ClubSessionType[];
  onSave: (data: SessionSaveData) => Promise<void>;
  onClose: () => void;
}

// ── small helpers ─────────────────────────────────────────────

function CheckList({
  items,
  selected,
  onToggle,
  label,
  emptyText,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  label: string;
  emptyText?: string;
}) {
  if (items.length === 0) return emptyText ? (
    <p className="text-sm text-muted-foreground">{emptyText}</p>
  ) : null;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="border border-input rounded-xl divide-y divide-border overflow-hidden">
        {items.map((item) => {
          const checked = selected.includes(item.id);
          return (
            <label
              key={item.id}
              className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors"
            >
              <div className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${checked ? "bg-primary border-primary" : "border-input bg-background"}`}>
                {checked && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => onToggle(item.id)} />
              <span className="text-sm">{item.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ChipToggle({
  value,
  selected,
  onToggle,
}: {
  value: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium border transition-colors ${
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background border-input text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {value}
    </button>
  );
}

// ── main component ────────────────────────────────────────────

export function SessionEditModal({
  session,
  defaultDay,
  locations,
  trainers,
  topics,
  sessionTypes,
  onSave,
  onClose,
}: Props) {
  const [saving, setSaving] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState<number>(session?.day_of_week ?? defaultDay);
  const [locationId, setLocationId] = useState<string>(session?.location_id ?? "none");

  // Multi-trainer
  const initTrainers: string[] = session?.session_trainers?.length
    ? session.session_trainers.map((st) => st.user_id)
    : session?.trainer_id ? [session.trainer_id] : [];
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>(initTrainers);

  // Multi-topic (from club_topics)
  const [selectedTopics, setSelectedTopics] = useState<string[]>(session?.topics ?? []);

  // Multi-type (from club_session_types)
  const [selectedTypes, setSelectedTypes] = useState<string[]>(session?.session_types ?? []);

  function toggleItem<T extends string>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: T) {
    setter((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.currentTarget);

    await onSave({
      day_of_week: dayOfWeek,
      time_start: form.get("time_start") as string,
      time_end: form.get("time_end") as string,
      topics: selectedTopics,
      session_types: selectedTypes,
      description: ((form.get("description") as string) ?? "").trim() || null,
      location_id: locationId === "none" ? null : locationId,
      trainer_ids: selectedTrainerIds,
    });

    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            {session ? "Sitzung bearbeiten" : "Neue Sitzung"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Row: Day + Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Wochentag</Label>
              <Select value={String(dayOfWeek)} onValueChange={(v) => v !== null && setDayOfWeek(Number(v))}>
                <SelectTrigger className="h-10 w-full rounded-xl">
                  <span className="flex-1 text-left text-sm truncate">{DAY_NAMES[dayOfWeek]}</span>
                </SelectTrigger>
                <SelectContent>
                  {DAY_NAMES.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time_start" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Von</Label>
              <Input id="time_start" name="time_start" type="time" required defaultValue={session?.time_start?.slice(0, 5) ?? "18:00"} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time_end" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bis</Label>
              <Input id="time_end" name="time_end" type="time" required defaultValue={session?.time_end?.slice(0, 5) ?? "19:30"} className="h-10 rounded-xl" />
            </div>
          </div>

          {/* Session types – chip toggles from club_session_types */}
          {sessionTypes.length > 0 ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Typ</Label>
              <div className="flex flex-wrap gap-2">
                {sessionTypes.map((t) => (
                  <ChipToggle
                    key={t.id}
                    value={t.name}
                    selected={selectedTypes.includes(t.name)}
                    onToggle={() => toggleItem(setSelectedTypes, t.name)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Typ</Label>
              <p className="text-xs text-muted-foreground">
                Noch keine Typen. Füge sie im Tab{" "}
                <span className="font-medium text-foreground">Themen & Orte</span> hinzu.
              </p>
            </div>
          )}

          {/* Topics – checkbox list from club_topics */}
          {topics.length > 0 ? (
            <CheckList
              label="Themen"
              items={topics.map((t) => ({ id: t.name, label: t.name }))}
              selected={selectedTopics}
              onToggle={(name) => toggleItem(setSelectedTopics, name)}
            />
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Themen</Label>
              <p className="text-xs text-muted-foreground">
                Noch keine Themen. Füge sie im Tab{" "}
                <span className="font-medium text-foreground">Themen & Orte</span> hinzu.
              </p>
            </div>
          )}

          {/* Location */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ort</Label>
            <Select value={locationId} onValueChange={(v) => v !== null && setLocationId(v)}>
              <SelectTrigger className="h-10 w-full rounded-xl">
                <span className="flex-1 text-left text-sm truncate">
                  {locationId === "none" ? "Kein Ort" : locations.find((l) => l.id === locationId)?.name ?? "Kein Ort"}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Ort</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trainers */}
          <CheckList
            label="Trainer"
            items={trainers.map((t) => ({ id: t.id, label: t.full_name }))}
            selected={selectedTrainerIds}
            onToggle={(id) => toggleItem(setSelectedTrainerIds, id)}
            emptyText="Keine Trainer oder Admins im Verein."
          />

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Beschreibung <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={session?.description ?? ""}
              placeholder="Weitere Details zur Trainingseinheit…"
              className="rounded-xl text-sm resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
