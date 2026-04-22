"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { ClubTopic, ClubSessionType, Location } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const spring = { type: "spring" as const, stiffness: 340, damping: 30 };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </p>
  );
}

// ── Reusable chip list (topics & session types share identical UX) ──

function ChipListSection({
  title,
  description,
  items,
  emptyText,
  placeholder,
  tableName,
  clubId,
}: {
  title: string;
  description: string;
  items: { id: string; name: string }[];
  emptyText: string;
  placeholder: string;
  tableName: "club_topics" | "club_session_types";
  clubId: string;
}) {
  const reduced = useReducedMotion();
  const [list, setList] = useState(items);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from(tableName)
      .insert({ club_id: clubId, name })
      .select()
      .single<{ id: string; name: string }>();
    if (error) {
      toast.error(error.code === "23505" ? "Eintrag existiert bereits." : error.message);
    } else {
      setList((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from(tableName).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setList((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <section className="py-7">
      <SectionTitle>{title}</SectionTitle>
      <p className="text-sm text-muted-foreground mb-5">{description}</p>

      <div className="flex flex-wrap gap-2 mb-5 min-h-[2rem]">
        <AnimatePresence>
          {list.map((t) => (
            <motion.span
              key={t.id}
              initial={reduced ? false : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={spring}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground"
            >
              {t.name}
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`${t.name} entfernen`}
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                  <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground/50">{emptyText}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-10 rounded-xl text-sm"
        />
        <button
          type="button"
          onClick={add}
          disabled={saving || !newName.trim()}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity shrink-0"
        >
          Hinzufügen
        </button>
      </div>
    </section>
  );
}

// ── Location card (edit inline) ───────────────────────────────

interface LocationCardProps {
  location: Location;
  onUpdate: (updated: Location) => void;
  onDelete: (id: string) => void;
}

function LocationCard({ location, onUpdate, onDelete }: LocationCardProps) {
  const reduced = useReducedMotion();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address ?? "");
  const [mapsUrl, setMapsUrl] = useState(location.maps_url ?? "");
  const [notes, setNotes] = useState(location.notes ?? "");

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("locations")
      .update({ name: name.trim(), address: address.trim() || null, maps_url: mapsUrl.trim() || null, notes: notes.trim() || null })
      .eq("id", location.id)
      .select()
      .single<Location>();
    if (error) { toast.error(error.message); setSaving(false); return; }
    onUpdate(data);
    setEditing(false);
    setSaving(false);
    toast.success("Ort aktualisiert.");
  }

  async function del() {
    if (!confirm(`"${location.name}" wirklich löschen?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("locations").delete().eq("id", location.id);
    if (error) { toast.error(error.message); return; }
    onDelete(location.id);
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{location.name}</p>
          {location.address && (
            <p className="text-xs text-muted-foreground mt-0.5">{location.address}</p>
          )}
          {location.maps_url && (
            <a
              href={location.maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:opacity-70 transition-opacity mt-1"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              Google Maps
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`h-7 px-2.5 rounded-lg text-xs font-medium border transition-colors ${editing ? "bg-secondary border-border" : "border-border hover:bg-secondary"}`}
          >
            {editing ? "Abbrechen" : "Bearbeiten"}
          </button>
          <button
            type="button"
            onClick={del}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/30 text-muted-foreground hover:text-destructive transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <motion.div
            key="edit"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Adresse</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Musterstraße 1, 10115 Berlin" className="h-9 rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Google Maps Link</Label>
                <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." type="url" className="h-9 rounded-xl text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notizen</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-xl text-sm resize-none" />
              </div>
              <button
                type="button"
                onClick={save}
                disabled={saving || !name.trim()}
                className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {saving ? "Speichern…" : "Speichern"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LocationsSection({ clubId, initialLocations }: { clubId: string; initialLocations: Location[] }) {
  const reduced = useReducedMotion();
  const [locations, setLocations] = useState<Location[]>(initialLocations);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newMapsUrl, setNewMapsUrl] = useState("");
  const [newNotes, setNewNotes] = useState("");

  async function addLocation() {
    if (!newName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("locations")
      .insert({ club_id: clubId, name: newName.trim(), address: newAddress.trim() || null, maps_url: newMapsUrl.trim() || null, notes: newNotes.trim() || null })
      .select()
      .single<Location>();
    if (error) { toast.error(error.message); setSaving(false); return; }
    setLocations((prev) => [...prev, data]);
    setNewName(""); setNewAddress(""); setNewMapsUrl(""); setNewNotes("");
    setShowAddForm(false);
    setSaving(false);
    toast.success("Ort hinzugefügt.");
  }

  return (
    <section className="py-7">
      <SectionTitle>Trainingsorte</SectionTitle>
      <p className="text-sm text-muted-foreground mb-5">
        Orte, die beim Erstellen einer Trainingseinheit ausgewählt werden können.
      </p>

      <div className="space-y-2 mb-4">
        <AnimatePresence>
          {locations.map((loc) => (
            <motion.div key={loc.id} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring}>
              <LocationCard location={loc} onUpdate={(u) => setLocations((p) => p.map((l) => l.id === u.id ? u : l))} onDelete={(id) => { setLocations((p) => p.filter((l) => l.id !== id)); toast.success("Ort gelöscht."); }} />
            </motion.div>
          ))}
        </AnimatePresence>
        {locations.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground/50 py-2">Noch keine Orte.</p>
        )}
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div key="add-form" initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring} className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3 mb-3">
            <p className="text-sm font-medium">Neuen Ort hinzufügen</p>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Name *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Dojo Tempelhof" className="h-9 rounded-xl text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Adresse</Label><Input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Musterstraße 1, 10115 Berlin" className="h-9 rounded-xl text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Google Maps Link</Label><Input value={newMapsUrl} onChange={(e) => setNewMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." type="url" className="h-9 rounded-xl text-sm" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Notizen</Label><Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} placeholder="z. B. Parkplätze, Schlüssel…" className="rounded-xl text-sm resize-none" /></div>
            <div className="flex gap-2">
              <button type="button" onClick={addLocation} disabled={saving || !newName.trim()} className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity">{saving ? "Hinzufügen…" : "Hinzufügen"}</button>
              <button type="button" onClick={() => setShowAddForm(false)} className="h-9 px-3 rounded-xl border border-border text-sm hover:bg-secondary transition-colors">Abbrechen</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAddForm && (
        <button type="button" onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:opacity-70 transition-opacity">
          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </span>
          Neuen Ort hinzufügen
        </button>
      )}
    </section>
  );
}

// ── Main export ───────────────────────────────────────────────

export function ThemenManager({
  clubId,
  initialTopics,
  initialSessionTypes,
  initialLocations,
}: {
  clubId: string;
  initialTopics: ClubTopic[];
  initialSessionTypes: ClubSessionType[];
  initialLocations: Location[];
}) {
  return (
    <div className="divide-y divide-border">
      <ChipListSection
        title="Trainingstypen"
        description="Kategorien für Trainingseinheiten (z. B. Kindertraining, Anfänger)."
        items={initialSessionTypes}
        emptyText="Noch keine Typen."
        placeholder="Neuer Typ, z. B. Kindertraining…"
        tableName="club_session_types"
        clubId={clubId}
      />
      <ChipListSection
        title="Trainingsthemen"
        description="Inhaltliche Themen für Trainingseinheiten (z. B. Tritt-Technik, Sparring)."
        items={initialTopics}
        emptyText="Noch keine Themen."
        placeholder="Neues Thema, z. B. Sparring…"
        tableName="club_topics"
        clubId={clubId}
      />
      <LocationsSection clubId={clubId} initialLocations={initialLocations} />
    </div>
  );
}
