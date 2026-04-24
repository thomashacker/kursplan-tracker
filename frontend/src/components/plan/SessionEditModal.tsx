"use client";

import { useState, useRef, useEffect } from "react";
import type { TrainingSession, Location, Profile, ClubTopic, ClubSessionType, SessionColor } from "@/types";
import { DAY_NAMES, SESSION_COLORS } from "@/types";
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
  guest_trainers: string[];
  is_cancelled: boolean;
  /** Only for new sessions: whether to generate recurring occurrences */
  is_recurring: boolean;
  /** Only when editing a templated session */
  edit_scope: "single" | "future";
  /** Whether the cron job should keep extending this template automatically */
  auto_extend: boolean;
  color: SessionColor | null;
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

// ── Multi-select tag dropdown ─────────────────────────────────

function MultiTagSelect({
  label,
  options,
  selected,
  onAdd,
  onRemove,
  placeholder,
  emptyText,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const available = options.filter((o) => !selected.includes(o.id));

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map((id) => {
            const opt = options.find((o) => o.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
              >
                {opt?.label ?? id}
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-primary/20 transition-colors"
                  aria-label={`${opt?.label ?? id} entfernen`}
                >
                  <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                    <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown trigger + menu */}
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {emptyText ?? "Keine Optionen verfügbar."}
        </p>
      ) : (
        <div ref={ref} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="w-full h-9 px-3 rounded-xl border border-input bg-background text-sm text-left flex items-center justify-between hover:border-ring transition-colors"
          >
            <span className="text-muted-foreground">
              {available.length === 0 ? "Alle ausgewählt" : (placeholder ?? "Auswählen…")}
            </span>
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && available.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-md overflow-hidden">
              {available.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => { onAdd(opt.id); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Guest trainer free-text input ────────────────────────────

function GuestTrainerInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const name = input.trim();
    if (!name || value.includes(name)) { setInput(""); return; }
    onChange([...value, name]);
    setInput("");
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Gasttrainer
      </Label>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25"
            >
              {name}
              <button
                type="button"
                onClick={() => onChange(value.filter((n) => n !== name))}
                className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-amber-500/20 transition-colors"
                aria-label={`${name} entfernen`}
              >
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Name eingeben, Enter zum Hinzufügen…"
          className="flex-1 h-9 px-3 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="h-9 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Scope toggle (single vs future) ──────────────────────────

function ScopePicker({
  value,
  onChange,
}: {
  value: "single" | "future";
  onChange: (v: "single" | "future") => void;
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Änderung anwenden auf
        </p>
        <div className="flex gap-1 p-1 rounded-lg bg-secondary/50">
          {(["single", "future"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                value === opt
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt === "single" ? "Nur diese Woche" : "Diese & alle zukünftigen"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Toggle switch helper ──────────────────────────────────────

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  destructive,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  destructive?: boolean;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-input px-3 py-2.5 cursor-pointer hover:bg-secondary/50 transition-colors">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 h-5 w-9 rounded-full border-2 transition-colors ${
          checked
            ? destructive
              ? "bg-destructive border-destructive"
              : "bg-primary border-primary"
            : "bg-input border-transparent"
        }`}
      >
        <span className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────

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
  const isNew      = session === null;
  const isRecurring = !isNew && Boolean(session?.template_id);

  const [saving, setSaving] = useState(false);
  const [pendingData, setPendingData] = useState<SessionSaveData | null>(null);
  const [dayOfWeek, setDayOfWeek] = useState<number>(session?.day_of_week ?? defaultDay);
  const [locationId, setLocationId] = useState<string>(session?.location_id ?? "none");

  const initTrainers: string[] = session?.session_trainers?.length
    ? session.session_trainers.map((st) => st.user_id)
    : session?.trainer_id ? [session.trainer_id] : [];
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<string[]>(initTrainers);
  const [guestTrainers, setGuestTrainers] = useState<string[]>(session?.guest_trainers ?? []);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(session?.topics ?? []);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(session?.session_types ?? []);
  const [isCancelled, setIsCancelled] = useState<boolean>(session?.is_cancelled ?? false);

  // New session only — recurring toggle
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [autoExtend, setAutoExtend] = useState(true);

  // Editing a recurring session — scope picker
  const [editScope, setEditScope] = useState<"single" | "future">("single");

  // Color picker
  const initColor = (session?.color ?? null) as SessionColor | null;
  const [selectedColor, setSelectedColor] = useState<SessionColor | null>(initColor);

  function add<T extends string>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: T) {
    setter((prev) => prev.includes(id) ? prev : [...prev, id]);
  }
  function remove<T extends string>(setter: React.Dispatch<React.SetStateAction<T[]>>, id: T) {
    setter((prev) => prev.filter((x) => x !== id));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);

    const data: SessionSaveData = {
      day_of_week: dayOfWeek,
      time_start: form.get("time_start") as string,
      time_end: form.get("time_end") as string,
      topics: selectedTopics,
      session_types: selectedTypes,
      description: ((form.get("description") as string) ?? "").trim() || null,
      location_id: locationId === "none" ? null : locationId,
      trainer_ids: selectedTrainerIds,
      guest_trainers: guestTrainers,
      is_cancelled: isCancelled,
      is_recurring: isNew ? makeRecurring : false,
      edit_scope: editScope,
      auto_extend: autoExtend,
      color: selectedColor,
    };

    // Require extra confirmation when overwriting all future recurring sessions
    if (isRecurring && editScope === "future") {
      setPendingData(data);
      return;
    }

    setSaving(true);
    await onSave(data);
    setSaving(false);
  }

  async function handleConfirmFuture() {
    if (!pendingData) return;
    setSaving(true);
    setPendingData(null);
    await onSave(pendingData);
    setSaving(false);
  }

  return (
    <>
    {/* ── Confirmation dialog for "apply to all future" ── */}
    {pendingData && (
      <Dialog open onOpenChange={(isOpen) => { if (!isOpen) setPendingData(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              Alle zukünftigen aktualisieren?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Diese Änderung wird auf <span className="font-semibold text-foreground">alle zukünftigen Wiederholungen</span> dieser Sitzung angewendet. Bereits individuell angepasste Einheiten werden überschrieben.
          </p>
          <DialogFooter className="pt-2">
            <button
              type="button"
              onClick={() => setPendingData(null)}
              className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmFuture}
              className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {saving ? "Speichern…" : "Ja, alle aktualisieren"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}

    <Dialog open onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            {isNew ? "Neue Sitzung" : "Sitzung bearbeiten"}
            {isRecurring && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Wiederkehrend
              </span>
            )}
            {!isNew && !isRecurring && session?.is_modified && (
              <span className="ml-2 inline-flex items-center text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                Individuell angepasst
              </span>
            )}
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

          {/* Typ */}
          <MultiTagSelect
            label="Typ"
            options={sessionTypes.map((t) => ({ id: t.name, label: t.name }))}
            selected={selectedTypes}
            onAdd={(id) => add(setSelectedTypes, id)}
            onRemove={(id) => remove(setSelectedTypes, id)}
            placeholder="Typ hinzufügen…"
            emptyText="Noch keine Typen – füge sie im Tab Themen & Orte hinzu."
          />

          {/* Themen */}
          <MultiTagSelect
            label="Themen"
            options={topics.map((t) => ({ id: t.name, label: t.name }))}
            selected={selectedTopics}
            onAdd={(id) => add(setSelectedTopics, id)}
            onRemove={(id) => remove(setSelectedTopics, id)}
            placeholder="Thema hinzufügen…"
            emptyText="Noch keine Themen – füge sie im Tab Themen & Orte hinzu."
          />

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

          {/* Trainer */}
          <MultiTagSelect
            label="Trainer"
            options={trainers.map((t) => ({ id: t.id, label: t.full_name }))}
            selected={selectedTrainerIds}
            onAdd={(id) => add(setSelectedTrainerIds, id)}
            onRemove={(id) => remove(setSelectedTrainerIds, id)}
            placeholder="Trainer hinzufügen…"
            emptyText="Keine Trainer oder Admins im Verein."
          />

          {/* Guest trainers */}
          <GuestTrainerInput value={guestTrainers} onChange={setGuestTrainers} />

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

          {/* Recurring toggle — new sessions only */}
          {isNew && (
            <div className="space-y-2">
              <ToggleRow
                title="Wöchentlich wiederholen"
                description="Erstellt diese Sitzung für die nächsten 8 Wochen."
                checked={makeRecurring}
                onChange={(v) => { setMakeRecurring(v); if (!v) setAutoExtend(false); }}
              />
              {makeRecurring && (
                <div className="rounded-xl border border-input px-3 py-2.5 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Automatisch verlängern</p>
                    <p className="text-xs text-muted-foreground">
                      Ein wöchentlicher Hintergrundjob verlängert automatisch um weitere 8 Wochen, bevor der Horizont endet.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={autoExtend}
                    onClick={() => setAutoExtend((v) => !v)}
                    className={`relative shrink-0 h-5 w-9 rounded-full border-2 transition-colors mt-0.5 ${autoExtend ? "bg-primary border-primary" : "bg-input border-transparent"}`}
                  >
                    <span className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoExtend ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Auto-extend toggle for existing recurring sessions — shown only when editing future */}
          {isRecurring && editScope === "future" && (
            <div className="rounded-xl border border-input px-3 py-2.5 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Automatisch verlängern</p>
                <p className="text-xs text-muted-foreground">
                  Hintergrundjob verlängert automatisch, bevor der Horizont endet.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoExtend}
                onClick={() => setAutoExtend((v) => !v)}
                className={`relative shrink-0 h-5 w-9 rounded-full border-2 transition-colors mt-0.5 ${autoExtend ? "bg-primary border-primary" : "bg-input border-transparent"}`}
              >
                <span className={`block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${autoExtend ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
          )}

          {/* Color picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block">
              Farbe
            </label>
            <div className="flex items-center gap-2">
              {(Object.entries(SESSION_COLORS) as [SessionColor, typeof SESSION_COLORS[SessionColor]][]).map(([key, cfg]) => {
                const active = (selectedColor ?? "neutral") === key;
                return (
                  <button
                    key={key}
                    type="button"
                    title={cfg.label}
                    onClick={() => setSelectedColor(key === "neutral" ? null : key)}
                    className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${
                      active ? "border-foreground scale-110" : "border-transparent hover:border-foreground/30 hover:scale-105"
                    }`}
                    style={{ backgroundColor: cfg.hex }}
                  >
                    {active && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cancelled toggle */}
          <ToggleRow
            title="Training abgesagt"
            description="Das Training wird als abgesagt markiert und rot angezeigt."
            checked={isCancelled}
            onChange={setIsCancelled}
            destructive
          />

          {/* Scope picker — only for editing a recurring session, lives near save button */}
          {isRecurring && (
            <ScopePicker value={editScope} onChange={setEditScope} />
          )}

          <DialogFooter className="pt-2">
            <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">
              {saving
                ? "Speichern…"
                : isNew && makeRecurring
                ? "Erstellen (8 Wochen)"
                : editScope === "future" && isRecurring
                ? "Alle zukünftigen aktualisieren"
                : "Speichern"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
