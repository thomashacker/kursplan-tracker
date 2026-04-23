"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Club, ClubMembership, Invitation, Role } from "@/types";
import { ROLE_LABELS } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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

    // Fetch memberships and invitations in parallel
    const [{ data: m }, { data: inv }] = await Promise.all([
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
    ]);

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
    </div>
  );
}
