"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function FieldError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.18 }}
          className="text-xs text-destructive mt-1.5"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

function SaveButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="submit"
      disabled={loading || disabled}
      whileTap={reduced ? {} : { scale: 0.97 }}
      transition={springSnap}
      className="h-10 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
    >
      {loading ? "Wird gespeichert…" : children}
    </motion.button>
  );
}

export function AccountSettingsForm({
  user,
  profile,
}: {
  user: User;
  profile: Profile | null;
}) {
  const router = useRouter();
  const reduced = useReducedMotion();

  // ── Profile ──────────────────────────────────────────────
  const [fullName, setFullName] = useState(
    (user.user_metadata?.full_name as string | undefined) ?? profile?.full_name ?? ""
  );
  const [profileLoading, setProfileLoading] = useState(false);

  // ── Avatar ───────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user.user_metadata?.avatar_url as string | undefined) ?? profile?.avatar_url ?? null
  );
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initials =
    fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

  // ── Password ─────────────────────────────────────────────
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const pwOk = newPw.length >= 8;
  const pwError = newPw.length > 0 && !pwOk ? "Mindestens 8 Zeichen erforderlich" : null;
  const confirmOk = confirmPw.length > 0 && confirmPw === newPw && pwOk;
  const confirmError =
    confirmPw.length > 0 && confirmPw !== newPw ? "Passwörter stimmen nicht überein" : null;

  // ── Delete ───────────────────────────────────────────────
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Handlers ─────────────────────────────────────────────

  async function purgeAvatarFolder(supabase: ReturnType<typeof createClient>) {
    const { data: existing } = await supabase.storage.from("avatars").list(user.id);
    if (existing?.length) {
      await supabase.storage
        .from("avatars")
        .remove(existing.map((f) => `${user.id}/${f.name}`));
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarLoading(true);

    const supabase = createClient();
    await purgeAvatarFolder(supabase);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      toast.error("Foto konnte nicht hochgeladen werden. Prüfe ob der 'avatars' Storage-Bucket in Supabase angelegt ist.");
      setAvatarLoading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await Promise.all([
      supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id),
      supabase.auth.updateUser({ data: { avatar_url: publicUrl } }),
    ]);

    setAvatarUrl(publicUrl);
    toast.success("Profilbild aktualisiert.");
    setAvatarLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveAvatar() {
    const supabase = createClient();
    await Promise.all([
      purgeAvatarFolder(supabase),
      supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id),
      supabase.auth.updateUser({ data: { avatar_url: null } }),
    ]);
    setAvatarUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    toast.success("Profilbild entfernt.");
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileLoading(true);

    const supabase = createClient();
    const [profileRes, userRes] = await Promise.all([
      supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id),
      supabase.auth.updateUser({ data: { full_name: fullName } }),
    ]);

    if (profileRes.error || userRes.error) {
      toast.error(profileRes.error?.message ?? userRes.error?.message ?? "Fehler beim Speichern.");
    } else {
      toast.success("Profil gespeichert.");
    }
    setProfileLoading(false);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!pwOk || !confirmOk) return;
    setPwLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Passwort erfolgreich geändert.");
      setNewPw("");
      setConfirmPw("");
    }
    setPwLoading(false);
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== "LÖSCHEN") return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/delete-account", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Konto konnte nicht gelöscht werden.");
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Konto konnte nicht gelöscht werden.");
      setDeleteLoading(false);
    }
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-0 divide-y divide-border"
    >
      {/* ── Avatar ─────────────────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Profilbild</SectionTitle>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar className="w-16 h-16 text-base">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {avatarLoading ? (
                  <span className="block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  initials
                )}
              </AvatarFallback>
            </Avatar>
            {/* hover overlay */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Foto ändern"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm font-medium text-primary hover:opacity-70 transition-opacity text-left"
            >
              Foto hochladen
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="text-sm text-muted-foreground hover:text-destructive transition-colors text-left"
              >
                Entfernen
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          onChange={handleAvatarUpload}
        />
      </section>

      {/* ── Persönliche Daten ───────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Persönliche Daten</SectionTitle>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-sm font-medium">
              Name
            </Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Max Mustermann"
              className="h-11 text-base rounded-xl"
            />
          </div>
<SaveButton loading={profileLoading}>Speichern</SaveButton>
        </form>
      </section>

      {/* ── Passwort ────────────────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Passwort ändern</SectionTitle>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-0">
            <Label htmlFor="new_pw" className="text-sm font-medium block mb-2">
              Neues Passwort
            </Label>
            <Input
              id="new_pw"
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              aria-invalid={!!pwError}
              className={
                pwOk && newPw.length > 0
                  ? "h-11 text-base rounded-xl border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/25"
                  : "h-11 text-base rounded-xl"
              }
            />
            <FieldError message={pwError} />
          </div>
          <div className="space-y-0">
            <Label htmlFor="confirm_pw" className="text-sm font-medium block mb-2">
              Passwort bestätigen
            </Label>
            <Input
              id="confirm_pw"
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              aria-invalid={!!confirmError}
              className={
                confirmOk
                  ? "h-11 text-base rounded-xl border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/25"
                  : "h-11 text-base rounded-xl"
              }
            />
            <FieldError message={confirmError} />
          </div>
          <SaveButton loading={pwLoading} disabled={!pwOk || !confirmOk || !newPw}>
            Passwort ändern
          </SaveButton>
        </form>
      </section>

      {/* ── Gefahrenzone ────────────────────────────────────── */}
      <section className="py-7">
        <SectionTitle>Gefahrenzone</SectionTitle>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="font-medium text-sm mb-1">Konto dauerhaft löschen</p>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Alle deine Daten — Mitgliedschaften, erstellte Inhalte und Einstellungen — werden
            unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
          </p>

          <motion.button
            type="button"
            onClick={() => setDeleteOpen(true)}
            whileTap={reduced ? {} : { scale: 0.97 }}
            transition={springSnap}
            className="h-10 px-5 rounded-xl border border-destructive text-destructive font-semibold text-sm hover:bg-destructive hover:text-white transition-colors"
          >
            Konto löschen
          </motion.button>

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>

            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center mb-1">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-destructive">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <DialogTitle className="text-base font-semibold">Konto wirklich löschen?</DialogTitle>
                <DialogDescription>
                  Tippe <span className="font-mono font-bold text-foreground">LÖSCHEN</span> um zu bestätigen.
                  Diese Aktion ist endgültig.
                </DialogDescription>
              </DialogHeader>

              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="LÖSCHEN"
                className="h-11 font-mono rounded-xl"
                autoComplete="off"
              />

              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => { setDeleteOpen(false); setDeleteConfirm(""); }}
                  className="flex-1 h-10 rounded-xl border border-border font-medium text-sm hover:bg-secondary transition-colors"
                >
                  Abbrechen
                </button>
                <motion.button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "LÖSCHEN" || deleteLoading}
                  whileTap={reduced ? {} : { scale: 0.97 }}
                  transition={springSnap}
                  className="flex-1 h-10 rounded-xl bg-destructive text-white font-semibold text-sm disabled:opacity-40 transition-opacity"
                >
                  {deleteLoading ? "Wird gelöscht…" : "Endgültig löschen"}
                </motion.button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </motion.div>
  );
}
