"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import type { Club } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function SaveButton({ loading, disabled }: { loading: boolean; disabled?: boolean }) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="submit"
      disabled={loading || disabled}
      whileTap={reduced ? {} : { scale: 0.97 }}
      transition={springSnap}
      className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
    >
      {loading ? "Wird gespeichert…" : "Speichern"}
    </motion.button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 w-full text-left"
    >
      <div className={`relative mt-0.5 shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-input"}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </div>
      <div>
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
    </button>
  );
}

export function ClubSettingsForm({ club }: { club: Club }) {
  const router = useRouter();
  const reduced = useReducedMotion();

  // ── Delete club ───────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteClub() {
    if (deleteConfirm !== club.name) return;
    setDeleting(true);
    const supabase = createClient();
    // Purge logo storage first (best-effort)
    const { data: files } = await supabase.storage.from("logos").list(club.id);
    if (files?.length) {
      await supabase.storage.from("logos").remove(files.map((f) => `${club.id}/${f.name}`));
    }
    const { error } = await supabase.from("clubs").delete().eq("id", club.id);
    if (error) {
      toast.error(error.message);
      setDeleting(false);
      return;
    }
    toast.success("Verein gelöscht.");
    router.push("/dashboard");
  }

  // ── Logo ──────────────────────────────────────────────────
  const [logoUrl, setLogoUrl] = useState<string | null>(club.logo_url);
  const [logoLoading, setLogoLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── General ───────────────────────────────────────────────
  const [isPublic, setIsPublic] = useState(club.is_public);
  const [showTrainersPublic, setShowTrainersPublic] = useState(
    (club.settings?.show_trainers_public as boolean | undefined) ?? true
  );
  const [saving, setSaving] = useState(false);

  async function purgeLogoFolder(supabase: ReturnType<typeof createClient>) {
    const { data: existing } = await supabase.storage.from("logos").list(club.id);
    if (existing?.length) {
      await supabase.storage
        .from("logos")
        .remove(existing.map((f) => `${club.id}/${f.name}`));
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoLoading(true);

    const supabase = createClient();
    await purgeLogoFolder(supabase);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${club.id}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      toast.error("Logo konnte nicht hochgeladen werden. Prüfe ob der 'logos' Storage-Bucket existiert.");
      setLogoLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await supabase.from("clubs").update({ logo_url: publicUrl }).eq("id", club.id);

    setLogoUrl(publicUrl);
    toast.success("Logo aktualisiert.");
    setLogoLoading(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  }

  async function handleRemoveLogo() {
    const supabase = createClient();
    await Promise.all([
      purgeLogoFolder(supabase),
      supabase.from("clubs").update({ logo_url: null }).eq("id", club.id),
    ]);
    setLogoUrl(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
    toast.success("Logo entfernt.");
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { error } = await supabase
      .from("clubs")
      .update({
        name: form.get("name") as string,
        description: (form.get("description") as string) || null,
        is_public: isPublic,
        settings: { ...club.settings, show_trainers_public: showTrainersPublic },
      })
      .eq("id", club.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Einstellungen gespeichert.");
      router.refresh();
    }
    setSaving(false);
  }

  const publicUrl = typeof window !== "undefined"
    ? `${window.location.origin}/verein/${club.slug}`
    : `/verein/${club.slug}`;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="divide-y divide-border"
    >
      {/* ── Logo ─────────────────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Vereinslogo</SectionTitle>
        <div className="flex items-center gap-5">
          <div className="relative group shrink-0">
            <div className="w-16 h-16 rounded-xl bg-primary/10 overflow-hidden flex items-center justify-center">
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt={club.name} className="w-full h-full object-cover" />
              ) : logoLoading ? (
                <span className="block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="font-bold text-primary text-lg" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                  {club.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Logo ändern"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="text-sm font-medium text-primary hover:opacity-70 transition-opacity text-left"
            >
              Logo hochladen
            </button>
            {logoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors text-left"
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={handleLogoUpload}
        />
      </section>

      {/* ── Allgemein ────────────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Allgemein</SectionTitle>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Vereinsname
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={club.name}
              required
              className="h-11 text-base rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">URL-Kürzel</Label>
            <Input
              value={`/verein/${club.slug}`}
              disabled
              className="h-11 text-base rounded-xl font-mono opacity-60"
            />
            <p className="text-xs text-muted-foreground">
              Das Kürzel kann nach der Erstellung nicht mehr geändert werden.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Beschreibung
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={club.description ?? ""}
              className="rounded-xl text-base resize-none"
            />
          </div>

          <Toggle
            checked={isPublic}
            onChange={setIsPublic}
            label="Trainingsplan öffentlich"
            description="Jeder kann den Plan ohne Login einsehen."
          />

          <Toggle
            checked={showTrainersPublic}
            onChange={setShowTrainersPublic}
            label="Trainer in öffentlicher Ansicht anzeigen"
            description="Wenn deaktiviert, werden Trainernamen auf der öffentlichen Seite ausgeblendet."
          />

          <SaveButton loading={saving} />
        </form>
      </section>

      {/* ── Öffentlicher Link ────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Öffentlicher Link</SectionTitle>
        <p className="text-sm text-muted-foreground mb-4">
          Teile diesen Link mit deinen Mitgliedern.
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={publicUrl}
            readOnly
            className="h-11 font-mono text-sm rounded-xl"
          />
          <motion.button
            type="button"
            whileTap={reduced ? {} : { scale: 0.95 }}
            transition={springSnap}
            onClick={() => {
              navigator.clipboard.writeText(publicUrl);
              toast.success("Link kopiert!");
            }}
            className="h-11 px-4 rounded-xl border border-border font-medium text-sm hover:bg-secondary transition-colors shrink-0"
          >
            Kopieren
          </motion.button>
        </div>
      </section>

      {/* ── Gefahrenzone ─────────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Gefahrenzone</SectionTitle>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Verein löschen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Alle Trainingswochen, Sitzungen, Mitgliedschaften und Einladungen werden unwiderruflich gelöscht.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 h-9 px-4 rounded-xl border border-destructive/40 text-destructive text-sm font-medium hover:bg-destructive hover:text-white transition-colors"
          >
            Löschen
          </button>
        </div>
      </section>

      {/* ── Delete confirmation dialog ────────────────────── */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setDeleteOpen(false); setDeleteConfirm(""); } }}>
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="w-full max-w-md bg-background rounded-2xl border border-border shadow-xl p-6"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="shrink-0 w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-base" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                  Verein wirklich löschen?
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten des Vereins werden dauerhaft gelöscht.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 mb-5">
              <Label className="text-xs font-medium text-muted-foreground">
                Bestätigung: Tippe{" "}
                <span className="font-semibold text-foreground font-mono">{club.name}</span>{" "}
                um fortzufahren
              </Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={club.name}
                className="h-10 rounded-xl text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirm === club.name) handleDeleteClub(); }}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
                className="flex-1 h-10 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleDeleteClub}
                disabled={deleteConfirm !== club.name || deleting}
                className="flex-1 h-10 rounded-xl bg-destructive text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {deleting ? "Wird gelöscht…" : "Endgültig löschen"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
