"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Club, ClubMembership, Invitation, Role, VirtualTrainer } from "@/types";
import { ROLE_LABELS } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const spring = { type: "spring" as const, stiffness: 300, damping: 28 };

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Voller Zugriff inkl. Einstellungen" },
  { value: "trainer", label: "Trainer", description: "Kann Trainingseinheiten bearbeiten" },
  { value: "member", label: "Mitglied", description: "Nur Lesezugriff auf den Plan" },
];

function RoleBadge({ role }: { role: Role }) {
  const colors: Record<Role, string> = {
    admin: "bg-primary/10 text-primary",
    trainer: "bg-blue-500/10 text-blue-700",
    member: "bg-secondary text-secondary-foreground",
  };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${colors[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

export default function MitgliederPage() {
  const params = useParams<{ slug: string }>();
  const reduced = useReducedMotion();
  const [club, setClub] = useState<Club | null>(null);
  const [memberships, setMemberships] = useState<ClubMembership[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]);
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Virtual trainers
  const [virtualTrainers, setVirtualTrainers] = useState<VirtualTrainer[]>([]);
  const [trainerDialog, setTrainerDialog] = useState<{ mode: "add" | "edit"; trainer?: VirtualTrainer } | null>(null);
  const [trainerName, setTrainerName] = useState("");
  const [trainerAvatarUrl, setTrainerAvatarUrl] = useState<string | null>(null);
  const [trainerAvatarFile, setTrainerAvatarFile] = useState<File | null>(null);
  const [trainerAvatarPreview, setTrainerAvatarPreview] = useState<string | null>(null);
  const trainerAvatarInputRef = useRef<HTMLInputElement>(null);
  const [trainerNotes, setTrainerNotes] = useState("");
  const [trainerSaving, setTrainerSaving] = useState(false);
  const [removeTrainerTarget, setRemoveTrainerTarget] = useState<VirtualTrainer | null>(null);

  // Remove member confirm
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  // Open actions menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("trainer");
  const [inviteLoading, setInviteLoading] = useState(false);

  // ── data loading ──────────────────────────────────────────
  async function load() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyUserId(user.id);

    const { data: c } = await supabase.from("clubs").select("*").eq("slug", params.slug).single<Club>();
    setClub(c);
    if (!c) return;

    // Fetch memberships, invitations, and virtual trainers in parallel
    const [{ data: m }, { data: inv }, { data: vt }] = await Promise.all([
      supabase
        .from("club_memberships")
        .select("*")
        .eq("club_id", c.id)
        .neq("status", "suspended"),
      supabase
        .from("invitations")
        .select("*")
        .eq("club_id", c.id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .returns<Invitation[]>(),
      supabase.from("virtual_trainers").select("*").eq("club_id", c.id).order("name").returns<VirtualTrainer[]>(),
    ]);
    setVirtualTrainers(vt ?? []);

    const rawMemberships = (m ?? []) as ClubMembership[];
    const mine = rawMemberships.find((x) => x.user_id === user.id);
    setMyRole(mine?.role ?? null);

    if (mine?.role === "admin") {
      setPendingInvites(inv ?? []);
    }

    // Fetch profiles separately to avoid transitive FK join issues
    const userIds = rawMemberships.map((x) => x.user_id);
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds)
      : { data: [] };

    const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    const merged: ClubMembership[] = rawMemberships.map((mem) => ({
      ...mem,
      profiles: profileMap[mem.user_id] ?? null,
    }));

    setMemberships(merged);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [params.slug]);

  // ── invite ────────────────────────────────────────────────
  async function handleInvite() {
    if (!club) return;
    setInviteLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Token still required by schema; not surfaced to users
    const token = crypto.randomUUID();
    // 1 year expiry — person may register anytime
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from("invitations").insert({
      club_id: club.id,
      email: inviteEmail,
      role: inviteRole,
      token,
      created_by: user!.id,
      expires_at: expiresAt,
    });

    if (error) {
      toast.error(error.message);
      setInviteLoading(false);
      return;
    }

    toast.success(`${inviteEmail} hinzugefügt. Sie erhalten automatisch Zugriff bei der Registrierung.`);
    setInviteLoading(false);
    resetInviteDialog();
    load();
  }

  function resetInviteDialog() {
    setInviteEmail("");
    setInviteRole("trainer");
    setInviteOpen(false);
  }

  // ── role change ───────────────────────────────────────────
  async function updateRole(membershipId: string, newRole: Role) {
    const supabase = createClient();
    const { error } = await supabase
      .from("club_memberships")
      .update({ role: newRole })
      .eq("id", membershipId);
    if (error) { toast.error(error.message); return; }
    toast.success("Rolle geändert.");
    load();
  }

  // ── remove member ─────────────────────────────────────────
  async function confirmRemoveMember() {
    if (!removeTarget) return;
    const supabase = createClient();
    const { error } = await supabase.from("club_memberships").delete().eq("id", removeTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${removeTarget.name} entfernt.`);
    setRemoveTarget(null);
    load();
  }

  // ── revoke invite ─────────────────────────────────────────
  async function revokeInvite(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setPendingInvites((prev) => prev.filter((i) => i.id !== id));
    toast.success("Einladung widerrufen.");
  }

  // ── virtual trainer dialog helpers ───────────────────────────
  function openAddTrainer() {
    setTrainerName("");
    setTrainerAvatarUrl(null);
    setTrainerAvatarFile(null);
    setTrainerAvatarPreview(null);
    setTrainerNotes("");
    setTrainerDialog({ mode: "add" });
  }

  function openEditTrainer(vt: VirtualTrainer) {
    setTrainerName(vt.name);
    setTrainerAvatarUrl(vt.avatar_url ?? null);
    setTrainerAvatarFile(null);
    setTrainerAvatarPreview(vt.avatar_url ?? null);
    setTrainerNotes(vt.notes ?? "");
    setTrainerDialog({ mode: "edit", trainer: vt });
  }

  function handleTrainerAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setTrainerAvatarFile(file);
    setTrainerAvatarPreview(URL.createObjectURL(file));
  }

  async function uploadVirtualTrainerAvatar(supabase: ReturnType<typeof createClient>, id: string, file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `virtual_trainers/${id}/avatar.${ext}`;
    await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: true });
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
  }

  async function handleSaveTrainer() {
    if (!club || !trainerName.trim()) return;
    setTrainerSaving(true);
    const supabase = createClient();

    if (trainerDialog?.mode === "add") {
      const { data: newTrainer, error } = await supabase
        .from("virtual_trainers")
        .insert({ club_id: club.id, name: trainerName.trim(), avatar_url: null, notes: trainerNotes.trim() || null })
        .select()
        .single<VirtualTrainer>();
      if (error || !newTrainer) { toast.error(error?.message ?? "Fehler"); setTrainerSaving(false); return; }

      if (trainerAvatarFile) {
        const url = await uploadVirtualTrainerAvatar(supabase, newTrainer.id, trainerAvatarFile);
        await supabase.from("virtual_trainers").update({ avatar_url: url }).eq("id", newTrainer.id);
      }
      toast.success(`${trainerName.trim()} hinzugefügt.`);
    } else if (trainerDialog?.trainer) {
      const id = trainerDialog.trainer.id;
      let avatarUrl = trainerAvatarUrl;
      if (trainerAvatarFile) {
        avatarUrl = await uploadVirtualTrainerAvatar(supabase, id, trainerAvatarFile);
      }
      const { error } = await supabase.from("virtual_trainers").update({
        name: trainerName.trim(),
        avatar_url: avatarUrl,
        notes: trainerNotes.trim() || null,
      }).eq("id", id);
      if (error) { toast.error(error.message); setTrainerSaving(false); return; }
      toast.success("Trainer aktualisiert.");
    }
    setTrainerSaving(false);
    setTrainerDialog(null);
    load();
  }

  async function handleDeleteTrainer() {
    if (!removeTrainerTarget) return;
    const supabase = createClient();
    const { error } = await supabase.from("virtual_trainers").delete().eq("id", removeTrainerTarget.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`${removeTrainerTarget.name} entfernt.`);
    setRemoveTrainerTarget(null);
    load();
  }

  const isAdmin = myRole === "admin";

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <h1
          className="font-bold tracking-tight"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.5rem, 5vw, 2rem)" }}
        >
          Mitglieder
        </h1>
        {isAdmin && (
          <motion.button
            whileTap={reduced ? {} : { scale: 0.97 }}
            transition={spring}
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">Mitglied einladen</span>
            <span className="sm:hidden">Einladen</span>
          </motion.button>
        )}
      </div>

      {/* ── Members list ────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Registrierte Mitglieder
        </p>
        <div className="relative group/tip">
          <svg className="text-muted-foreground/50 hover:text-muted-foreground cursor-default transition-colors" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 hidden group-hover/tip:block w-64 p-3 rounded-xl border border-border bg-popover shadow-lg text-xs text-muted-foreground leading-relaxed pointer-events-none">
            Personen mit einem <span className="font-semibold text-foreground">aktiven Konto</span> in diesem Verein. Admins können Rollen ändern und Mitglieder entfernen. Neue Mitglieder werden über die Einladungsfunktion hinzugefügt.
          </div>
        </div>
      </div>
      <div className="space-y-2 mb-8">
        {memberships.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center">
            <p className="text-sm text-muted-foreground">Noch keine Mitglieder.</p>
          </div>
        )}
        <AnimatePresence>
          {memberships
            .sort((a, b) => {
              const order: Record<Role, number> = { admin: 0, trainer: 1, member: 2 };
              return order[a.role] - order[b.role];
            })
            .map((m, i) => {
              const isMe = m.user_id === myUserId;
              const name = m.profiles?.full_name ?? "Unbekannt";
              const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
              return (
                <motion.div
                  key={m.id}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                >
                  {/* Avatar */}
                  <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 overflow-hidden flex items-center justify-center">
                    {m.profiles?.avatar_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={m.profiles.avatar_url} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-bold text-primary text-xs" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                        {initials}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {name}
                      {isMe && <span className="ml-1.5 text-xs text-muted-foreground font-normal">(ich)</span>}
                    </p>
                  </div>

                  {/* Role */}
                  <RoleBadge role={m.role} />

                  {/* Actions — admin only, not on self */}
                  {isAdmin && !isMe && (
                    <div className="shrink-0 relative" ref={openMenuId === m.id ? menuRef : null}>
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === m.id ? null : m.id)}
                        className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                        aria-label="Optionen"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                        </svg>
                      </button>
                      {openMenuId === m.id && (
                        <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-border bg-popover shadow-lg">
                          <div className="p-1">
                            {(["admin", "trainer", "member"] as Role[]).map((r) => (
                              <button
                                key={r}
                                type="button"
                                disabled={m.role === r}
                                onClick={() => { updateRole(m.id, r); setOpenMenuId(null); }}
                                className="w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-default"
                              >
                                {ROLE_LABELS[r]}
                              </button>
                            ))}
                            <div className="h-px bg-border my-1" />
                            <button
                              type="button"
                              onClick={() => { setRemoveTarget({ id: m.id, name }); setOpenMenuId(null); }}
                              className="w-full text-left text-sm px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              Entfernen
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>

      {/* ── Feste Trainer ───────────────────────────────────── */}
      {(isAdmin || virtualTrainers.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Trainer
              </p>
              <div className="relative group/tip">
                <svg className="text-muted-foreground/50 hover:text-muted-foreground cursor-default transition-colors" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30 hidden group-hover/tip:block w-64 p-3 rounded-xl border border-border bg-popover shadow-lg text-xs text-muted-foreground leading-relaxed pointer-events-none">
                  Trainer hier müssen sich <span className="font-semibold text-foreground">nicht registrieren</span> — sie erscheinen einfach in der Trainerauswahl für Einheiten. Nützlich für externe Coaches, die regelmäßig dabei sind. Admins können sie hier verwalten.
                </div>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openAddTrainer}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
              >
                <svg width="10" height="10" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Trainer hinzufügen
              </button>
            )}
          </div>

          {virtualTrainers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card py-8 text-center">
              <p className="text-sm text-muted-foreground">Noch keine Trainer.</p>
              {isAdmin && (
                <button type="button" onClick={openAddTrainer} className="mt-2 text-xs text-primary hover:underline">
                  Ersten Trainer hinzufügen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {virtualTrainers.map((vt, i) => {
                const initials = vt.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <motion.div
                    key={vt.id}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring, delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                  >
                    {/* Avatar */}
                    <div className="shrink-0 w-10 h-10 rounded-full bg-indigo-500/10 overflow-hidden flex items-center justify-center">
                      {vt.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={vt.avatar_url} alt={vt.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 text-xs" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                          {initials}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vt.name}</p>
                      {vt.notes && <p className="text-xs text-muted-foreground truncate">{vt.notes}</p>}
                    </div>

                    {/* Badge */}
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shrink-0">
                      Trainer
                    </span>

                    {/* Actions — admin only */}
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditTrainer(vt)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                          aria-label="Bearbeiten"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveTrainerTarget(vt)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Entfernen"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Pending invites ──────────────────────────────────── */}
      {isAdmin && pendingInvites.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Ausstehende Einladungen
          </p>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Als {ROLE_LABELS[inv.role]} · Zugriff bei Registrierung
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeInvite(inv.id)}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  aria-label="Einladung entfernen"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Invite dialog ────────────────────────────────────── */}
      <Dialog open={inviteOpen} onOpenChange={(open: boolean) => { if (!open) resetInviteDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              Mitglied hinzufügen
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <p className="text-xs text-muted-foreground">
              Sobald sich diese Person mit der angegebenen E-Mail-Adresse registriert oder anmeldet, erhält sie automatisch Zugriff auf den Verein.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                E-Mail-Adresse
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="trainer@beispiel.de"
                className="h-10 rounded-xl text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && inviteEmail) handleInvite(); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rolle</Label>
              <div className="space-y-2">
                {ROLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      inviteRole === opt.value ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    <div className={`mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                      inviteRole === opt.value ? "border-primary" : "border-input"
                    }`}>
                      {inviteRole === opt.value && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <input
                      type="radio"
                      name="invite-role"
                      value={opt.value}
                      checked={inviteRole === opt.value}
                      onChange={() => setInviteRole(opt.value)}
                      className="sr-only"
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={resetInviteDialog}
                className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviteLoading || !inviteEmail}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {inviteLoading ? "Wird gespeichert…" : "Hinzufügen"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget !== null}
        title="Mitglied entfernen"
        description={`${removeTarget?.name} wirklich aus dem Verein entfernen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={confirmRemoveMember}
        onClose={() => setRemoveTarget(null)}
      />

      {/* ── Add / Edit virtual trainer dialog ───────────────── */}
      <Dialog open={trainerDialog !== null} onOpenChange={(open) => { if (!open) setTrainerDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              {trainerDialog?.mode === "add" ? "Trainer hinzufügen" : "Trainer bearbeiten"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="trainer-name" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="trainer-name"
                value={trainerName}
                onChange={(e) => setTrainerName(e.target.value)}
                placeholder="Max Mustermann"
                className="h-10 rounded-xl text-sm"
                onKeyDown={(e) => { if (e.key === "Enter" && trainerName.trim()) handleSaveTrainer(); }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Foto <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
              </Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => trainerAvatarInputRef.current?.click()}
                  className="relative shrink-0 w-14 h-14 rounded-full bg-indigo-500/10 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 overflow-hidden flex items-center justify-center transition-colors group"
                  title="Foto hochladen"
                >
                  {trainerAvatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={trainerAvatarPreview} alt="Vorschau" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="text-indigo-400 group-hover:text-indigo-600 transition-colors" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  )}
                </button>
                <input
                  ref={trainerAvatarInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleTrainerAvatarChange}
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => trainerAvatarInputRef.current?.click()}
                    className="text-xs text-primary hover:underline text-left"
                  >
                    {trainerAvatarPreview ? "Foto ändern" : "Foto hochladen"}
                  </button>
                  {trainerAvatarPreview && (
                    <button
                      type="button"
                      onClick={() => { setTrainerAvatarFile(null); setTrainerAvatarPreview(null); setTrainerAvatarUrl(null); if (trainerAvatarInputRef.current) trainerAvatarInputRef.current.value = ""; }}
                      className="text-xs text-muted-foreground hover:text-destructive text-left transition-colors"
                    >
                      Foto entfernen
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trainer-notes" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notiz <span className="text-muted-foreground/60 font-normal normal-case">(optional)</span>
              </Label>
              <Input
                id="trainer-notes"
                value={trainerNotes}
                onChange={(e) => setTrainerNotes(e.target.value)}
                placeholder="z.B. Kinder-Training, Fortgeschrittene…"
                className="h-10 rounded-xl text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setTrainerDialog(null)}
                className="h-10 px-4 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleSaveTrainer}
                disabled={trainerSaving || !trainerName.trim()}
                className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {trainerSaving ? "Wird gespeichert…" : "Speichern"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete virtual trainer confirm ───────────────────── */}
      <ConfirmDialog
        open={removeTrainerTarget !== null}
        title="Trainer entfernen"
        description={`${removeTrainerTarget?.name} wirklich entfernen? Bestehende Trainingszuweisungen werden ebenfalls gelöscht.`}
        confirmLabel="Entfernen"
        destructive
        onConfirm={handleDeleteTrainer}
        onClose={() => setRemoveTrainerTarget(null)}
      />
    </div>
  );
}
