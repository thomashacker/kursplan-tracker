"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
      <div
        className={`relative mt-0.5 shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? "bg-primary" : "bg-input"}`}
      >
        <span
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </div>
      <div>
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </button>
  );
}

export default function NeuVereinPage() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const slugError =
    slug.length > 0 && !/^[a-z0-9-]+$/.test(slug)
      ? "Nur Kleinbuchstaben, Ziffern und Bindestriche"
      : null;

  function handleNameChange(v: string) {
    setName(v);
    setSlug(toSlug(v));
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (slugError || !slug) return;
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Nicht angemeldet.");
      setLoading(false);
      return;
    }

    const { data: club, error } = await supabase
      .from("clubs")
      .insert({
        name,
        slug,
        description: (form.get("description") as string) || null,
        is_public: isPublic,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      toast.error(
        error.code === "23505"
          ? "Dieses URL-Kürzel ist bereits vergeben."
          : error.message
      );
      setLoading(false);
      return;
    }

    // Ensure creator has admin membership (DB trigger should handle this,
    // but insert here as a fallback so the member list is never empty)
    await supabase
      .from("club_memberships")
      .upsert(
        { club_id: club.id, user_id: user.id, role: "admin", status: "active" },
        { onConflict: "club_id,user_id" }
      );

    // Upload logo if selected (non-blocking — club exists regardless)
    if (logoFile && club) {
      const ext = logoFile.name.split(".").pop() ?? "jpg";
      const path = `${club.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(path, logoFile, { contentType: logoFile.type });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
        await supabase.from("clubs").update({ logo_url: urlData.publicUrl }).eq("id", club.id);
      }
    }

    toast.success("Verein erstellt!");
    router.push(`/dashboard/verein/${club.slug}/plan`);
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className="max-w-md"
    >
      {/* Back */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Zurück
      </button>

      {/* Heading */}
      <div className="mb-8">
        <h1
          className="font-bold tracking-tight mb-1"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(2rem, 8vw, 2.75rem)" }}
        >
          Neuen Verein.
        </h1>
        <p className="text-muted-foreground text-sm">
          Du wirst automatisch als Admin eingetragen.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Logo upload */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-dashed border-border hover:border-primary/50 transition-colors group"
          >
            {logoPreview ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoPreview} alt="Logo Vorschau" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-secondary gap-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                  className="text-muted-foreground group-hover:text-primary transition-colors">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="text-[10px] text-muted-foreground font-medium">Logo</span>
              </div>
            )}
          </button>
          {logoPreview && (
            <button
              type="button"
              onClick={() => { setLogoFile(null); setLogoPreview(null); if (logoInputRef.current) logoInputRef.current.value = ""; }}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Entfernen
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={handleLogoSelect}
          />
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Vereinsname
          </Label>
          <Input
            id="name"
            name="name"
            required
            placeholder="Viet Vo Dao Berlin"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="h-12 text-base rounded-xl"
          />
        </div>

        {/* Slug */}
        <div className="space-y-0">
          <Label htmlFor="slug" className="text-sm font-medium block mb-2">
            URL-Kürzel
          </Label>
          <div className="flex items-center rounded-xl border border-input bg-transparent overflow-hidden focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-all">
            <span className="pl-3 pr-1 text-sm text-muted-foreground shrink-0 select-none">
              /verein/
            </span>
            <input
              id="slug"
              name="slug"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="flex-1 h-12 pr-3 text-base bg-transparent outline-none"
              placeholder="viet-vo-dao-berlin"
            />
          </div>
          <AnimatePresence>
            {slugError && (
              <motion.p
                initial={{ opacity: 0, y: -4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.18 }}
                className="text-xs text-destructive mt-1.5"
              >
                {slugError}
              </motion.p>
            )}
          </AnimatePresence>
          {!slugError && slug && (
            <p className="text-xs text-muted-foreground mt-1.5">
              kurs.y/verein/<span className="text-foreground font-medium">{slug}</span>
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Beschreibung{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            placeholder="Kurze Beschreibung des Vereins…"
            className="rounded-xl text-base resize-none"
          />
        </div>

        {/* Public toggle */}
        <Toggle
          checked={isPublic}
          onChange={setIsPublic}
          label="Trainingsplan öffentlich"
          description="Jeder kann den Plan ohne Login einsehen."
        />

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={loading || !name || !slug || !!slugError}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={springSnap}
          className="w-full rounded-2xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-40 hover:opacity-90 transition-opacity"
          style={{ height: "58px" }}
        >
          {loading ? "Wird erstellt…" : "Verein erstellen"}
        </motion.button>
      </form>
    </motion.div>
  );
}
