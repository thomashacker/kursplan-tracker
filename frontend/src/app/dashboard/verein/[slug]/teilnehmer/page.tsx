"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Teilnehmer, TeilnehmerGroup, TeilnehmerQRPayload } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

const QRCodeCanvas = dynamic(() => import("./QRCodeCanvas"), { ssr: false });
const QRScannerModal = dynamic(() => import("./QRScannerModal"), { ssr: false });

type Tab = "list" | "gruppen";

const GROUP_COLORS = [
  "#6366f1","#f59e0b","#22c55e","#ec4899","#f97316","#3b82f6","#a855f7","#14b8a6",
];

const spring = { type: "spring" as const, stiffness: 300, damping: 28 };

// ── Bottom-sheet modal (slides up on mobile, centered on desktop) ─────────────
function BottomSheet({
  open, onClose, title, children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40 p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl border border-border bg-card shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* drag handle for mobile */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:pt-5 border-b border-border">
                <h2
                  className="font-bold text-base"
                  style={{ fontFamily: "var(--font-syne, system-ui)" }}
                >
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground transition-colors"
                  aria-label="Schließen"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}
            <div className="p-5 pb-safe">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Confirm sheet ─────────────────────────────────────────────────────────────
function ConfirmSheet({
  open, onClose, onConfirm, title, description, confirmLabel = "Bestätigen", destructive = false,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; confirmLabel?: string; destructive?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-base" style={{ fontFamily: "var(--font-syne, system-ui)" }}>{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 h-11 rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 ${
              destructive
                ? "bg-destructive text-white"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── Small icon button ─────────────────────────────────────────────────────────
function IconBtn({
  onClick, title, danger = false, children,
}: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${
        danger
          ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80"
      }`}
    >
      {children}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TeilnehmerPage() {
  const { slug } = useParams<{ slug: string }>();
  const reduced = useReducedMotion();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("list");
  const [clubId, setClubId] = useState<string | null>(null);

  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [groups, setGroups] = useState<TeilnehmerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<{ group_id: string; teilnehmer_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [qrViewId, setQrViewId] = useState<string | null>(null);
  const [zipLoading, setZipLoading] = useState(false);

  // Confirm dialogs
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; name: string } | null>(null);

  // Groups
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupColor, setEditingGroupColor] = useState(GROUP_COLORS[0]);
  const [groupMenuId, setGroupMenuId] = useState<string | null>(null);
  const groupMenuRef = useRef<HTMLDivElement>(null);

  const [assignGroupId, setAssignGroupId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (cid: string) => {
    const [{ data: tn }, { data: grp }, { data: gm }] = await Promise.all([
      supabase.from("teilnehmer").select("*").eq("club_id", cid).order("name"),
      supabase.from("teilnehmer_groups").select("*").eq("club_id", cid).order("name"),
      supabase.from("teilnehmer_group_members").select("group_id, teilnehmer_id"),
    ]);
    setTeilnehmer(tn ?? []);
    setGroups(grp ?? []);
    setGroupMembers(gm ?? []);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: club } = await supabase.from("clubs").select("id").eq("slug", slug).single();
      if (!club) return;

      const { data: membership } = await supabase
        .from("club_memberships")
        .select("role")
        .eq("club_id", club.id)
        .eq("user_id", user?.id ?? "")
        .eq("status", "active")
        .single();

      if (membership?.role !== "admin") {
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      setClubId(club.id);
      await fetchAll(club.id);
      setLoading(false);
    }
    init();
  }, [slug, supabase, fetchAll]);

  // Close group menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setGroupMenuId(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  async function handleAddSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || !addName.trim()) return;
    setAddLoading(true);
    const { error } = await supabase.from("teilnehmer").insert({ club_id: clubId, name: addName.trim() });
    if (error) toast.error(error.message);
    else { toast.success(`${addName.trim()} hinzugefügt`); setAddName(""); await fetchAll(clubId); }
    setAddLoading(false);
  }

  async function handleScanAdd(payload: TeilnehmerQRPayload) {
    setScannerOpen(false);
    if (!clubId) return;
    const existing = teilnehmer.find((t) => t.id === payload.id);
    if (existing) { toast.info(`${existing.name} ist bereits in der Liste`); return; }
    const { error } = await supabase.from("teilnehmer").insert({ id: payload.id, club_id: clubId, name: payload.name });
    if (error) toast.error(error.message);
    else { toast.success(`${payload.name} via QR hinzugefügt`); await fetchAll(clubId); }
  }

  async function handleBulkImport() {
    if (!clubId || !bulkText.trim()) return;
    setBulkLoading(true);
    const names = bulkText.split(/[\n,]+/).map((n) => n.trim()).filter(Boolean);
    const rows = names.map((name) => ({ club_id: clubId, name }));
    const { error, data } = await supabase.from("teilnehmer").upsert(rows, { onConflict: "club_id,name", ignoreDuplicates: true }).select();
    if (error) toast.error(error.message);
    else {
      const added = data?.length ?? 0;
      toast.success(`${added} Teilnehmer importiert${added < names.length ? ` (${names.length - added} bereits vorhanden)` : ""}`);
      setBulkText(""); setBulkOpen(false); await fetchAll(clubId);
    }
    setBulkLoading(false);
  }

  async function handleDelete(id: string) {
    if (!clubId) return;
    const { error } = await supabase.from("teilnehmer").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await fetchAll(clubId);
  }

  async function handleBulkQRDownload() {
    if (teilnehmer.length === 0) return;
    setZipLoading(true);
    try {
      const [QRCode, JSZip] = await Promise.all([
        import("qrcode"),
        import("jszip").then((m) => m.default),
      ]);
      const zip = new JSZip();
      for (const t of teilnehmer) {
        const payload: TeilnehmerQRPayload = { id: t.id, name: t.name };
        const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), { width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
        zip.file(`${t.name.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "_")}.png`, dataUrl.split(",")[1], { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "teilnehmer-qr.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("ZIP-Download fehlgeschlagen"); }
    setZipLoading(false);
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || !newGroupName.trim()) return;
    setGroupLoading(true);
    const { error } = await supabase.from("teilnehmer_groups").insert({ club_id: clubId, name: newGroupName.trim(), color: newGroupColor });
    if (error) toast.error(error.message);
    else { setNewGroupName(""); await fetchAll(clubId); }
    setGroupLoading(false);
  }

  async function handleDeleteGroup(id: string) {
    if (!clubId) return;
    const { error } = await supabase.from("teilnehmer_groups").delete().eq("id", id);
    if (error) toast.error(error.message);
    else await fetchAll(clubId);
  }

  async function handleSaveGroup(id: string) {
    if (!editingGroupName.trim()) return;
    const { error } = await supabase
      .from("teilnehmer_groups")
      .update({ name: editingGroupName.trim(), color: editingGroupColor })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { setEditingGroupId(null); await fetchAll(clubId!); }
  }

  async function toggleGroupMember(groupId: string, teilnehmerId: string) {
    const isMember = groupMembers.some((gm) => gm.group_id === groupId && gm.teilnehmer_id === teilnehmerId);
    if (isMember) {
      await supabase.from("teilnehmer_group_members").delete().eq("group_id", groupId).eq("teilnehmer_id", teilnehmerId);
    } else {
      await supabase.from("teilnehmer_group_members").insert({ group_id: groupId, teilnehmer_id: teilnehmerId });
    }
    await fetchAll(clubId!);
  }

  function membersOfGroup(groupId: string) {
    const ids = groupMembers.filter((gm) => gm.group_id === groupId).map((gm) => gm.teilnehmer_id);
    return teilnehmer.filter((t) => ids.includes(t.id));
  }

  function groupsOfTeilnehmer(id: string) {
    const groupIds = groupMembers.filter((gm) => gm.teilnehmer_id === id).map((gm) => gm.group_id);
    return groups.filter((g) => groupIds.includes(g.id));
  }

  // ── Loading / access guard ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="h-4 w-28 rounded" />
                </div>
                <Skeleton className="h-6 w-12 rounded-full" />
              </div>
              <div className="space-y-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                    <Skeleton className="h-3 flex-1 max-w-[160px] rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20 rounded-2xl border border-dashed border-border">
        <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <p className="font-semibold text-sm mb-1">Kein Zugriff</p>
        <p className="text-sm text-muted-foreground">Nur Admins können Teilnehmer verwalten.</p>
      </div>
    );
  }

  const qrTarget = teilnehmer.find((x) => x.id === qrViewId);
  const assignGroup = groups.find((g) => g.id === assignGroupId);

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="font-bold tracking-tight"
            style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.5rem, 5vw, 2rem)" }}
          >
            Teilnehmer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {teilnehmer.length} {teilnehmer.length === 1 ? "Person" : "Personen"} · {groups.length} {groups.length === 1 ? "Gruppe" : "Gruppen"}
          </p>
        </div>
      </div>

      {/* ── Sub-tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-border">
        {(["list", "gruppen"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "list" ? "Liste" : "Gruppen"}
          </button>
        ))}
      </div>

      {/* ══ LIST TAB ════════════════════════════════════════════════════════ */}
      {tab === "list" && (
        <div className="space-y-5">

          {/* Action buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="flex items-center justify-center gap-2 h-10 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary active:bg-secondary/80 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Importieren</span>
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex items-center justify-center gap-2 h-10 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary active:bg-secondary/80 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
                <rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                <path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/>
                <path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>
                <path d="M12 21v-1"/>
              </svg>
              <span>Per QR-Code</span>
            </button>
            {teilnehmer.length > 0 && (
              <button
                type="button"
                onClick={handleBulkQRDownload}
                disabled={zipLoading}
                className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 h-10 px-3 rounded-xl border border-border text-sm font-medium hover:bg-secondary active:bg-secondary/80 transition-colors disabled:opacity-50"
              >
                {zipLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
                <span>Alle QR-Codes (.zip)</span>
              </button>
            )}
          </div>

          {/* Add single */}
          <form onSubmit={handleAddSingle} className="flex gap-2">
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Name eingeben…"
              className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!addName.trim() || addLoading}
              className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity flex items-center gap-2"
            >
              {addLoading ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
              Hinzufügen
            </button>
          </form>

          {/* Sort toggle + count */}
          {teilnehmer.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{teilnehmer.length} {teilnehmer.length === 1 ? "Person" : "Personen"}</p>
              <button
                type="button"
                onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
                className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {sortDir === "asc" ? (
                    <>
                      <path d="M3 6h8M3 12h5M3 18h2"/>
                      <path d="M16 4v16M16 20l-3-3M16 20l3-3"/>
                    </>
                  ) : (
                    <>
                      <path d="M3 6h2M3 12h5M3 18h8"/>
                      <path d="M16 4v16M16 4l-3 3M16 4l3 3"/>
                    </>
                  )}
                </svg>
                {sortDir === "asc" ? "A → Z" : "Z → A"}
              </button>
            </div>
          )}

          {/* List */}
          {teilnehmer.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-border">
              <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="font-semibold text-sm mb-1">Noch keine Teilnehmer</p>
              <p className="text-sm text-muted-foreground">Füge einzelne hinzu oder importiere eine Liste.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <AnimatePresence initial={false}>
                {[...teilnehmer].sort((a, b) => sortDir === "asc" ? a.name.localeCompare(b.name, "de") : b.name.localeCompare(a.name, "de")).map((t, i) => {
                  const myGroups = groupsOfTeilnehmer(t.id);
                  const initials = t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <motion.div
                      key={t.id}
                      initial={reduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ ...spring, delay: i < 20 ? i * 0.025 : 0 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors border-b border-border last:border-b-0"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {initials}
                      </div>

                      {/* Name + groups */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{t.name}</p>
                        {myGroups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {myGroups.map((g) => (
                              <span
                                key={g.id}
                                className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                                style={{ backgroundColor: `${g.color}20`, color: g.color ?? undefined, border: `1px solid ${g.color}40` }}
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Actions — always visible, touch-friendly */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        <IconBtn onClick={() => setQrViewId(t.id)} title="QR-Code anzeigen">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
                            <rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                            <path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                          </svg>
                        </IconBtn>
                        <IconBtn
                          onClick={() => setDeleteTarget({ id: t.id, name: t.name })}
                          title="Löschen"
                          danger
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </IconBtn>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ══ GRUPPEN TAB ═════════════════════════════════════════════════════ */}
      {tab === "gruppen" && (
        <div className="space-y-5">

          {/* Add group form */}
          <form onSubmit={handleAddGroup} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Neue Gruppe</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="z.B. Team A"
                className="flex-1 h-11 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!newGroupName.trim() || groupLoading}
                className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 active:opacity-80 transition-opacity flex items-center gap-2"
              >
                {groupLoading ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                )}
                <span className="hidden sm:inline">Erstellen</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Farbe:</span>
              <div className="flex gap-1.5 flex-wrap">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewGroupColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                    style={{ backgroundColor: c, borderColor: newGroupColor === c ? "oklch(0.22 0.010 40)" : "transparent" }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Groups list */}
          {groups.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-border">
              <div className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <p className="font-semibold text-sm mb-1">Noch keine Gruppen</p>
              <p className="text-sm text-muted-foreground">Erstelle Gruppen, um Teilnehmer zu organisieren.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {groups.map((g, i) => {
                const members = membersOfGroup(g.id);
                const isEditing = editingGroupId === g.id;
                const menuOpen = groupMenuId === g.id;
                return (
                  <motion.div
                    key={g.id}
                    initial={reduced ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ ...spring, delay: i * 0.04 }}
                    className="rounded-2xl border border-border"
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border-b border-border rounded-t-2xl">
                      <div
                        className="w-3 h-3 rounded-full shrink-0 transition-colors"
                        style={{ backgroundColor: isEditing ? editingGroupColor : (g.color ?? "#94a3b8") }}
                      />

                      <div className="flex items-baseline gap-2 flex-1 min-w-0">
                        <span className="text-sm font-semibold truncate">{g.name}</span>
                        {!isEditing && <span className="text-xs text-muted-foreground shrink-0">{members.length}</span>}
                      </div>

                      {/* Manage members button */}
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => setAssignGroupId(g.id)}
                          className="h-8 px-3 rounded-lg border border-border text-xs font-medium hover:bg-background active:bg-secondary transition-colors shrink-0"
                        >
                          Bearbeiten
                        </button>
                      )}

                      {/* ⋯ overflow menu */}
                      {!isEditing && (
                        <div className="relative shrink-0" ref={menuOpen ? groupMenuRef : null}>
                          <button
                            type="button"
                            onClick={() => setGroupMenuId(menuOpen ? null : g.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                            aria-label="Optionen"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                            </svg>
                          </button>
                          <AnimatePresence>
                            {menuOpen && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                transition={{ duration: 0.12 }}
                                className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-border bg-popover shadow-lg py-1"
                              >
                                <button
                                  type="button"
                                  onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); setEditingGroupColor(g.color ?? GROUP_COLORS[0]); setGroupMenuId(null); }}
                                  className="w-full text-left text-sm px-3 py-2 hover:bg-secondary transition-colors flex items-center gap-2"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                  </svg>
                                  Bearbeiten
                                </button>
                                <div className="h-px bg-border mx-2 my-1" />
                                <button
                                  type="button"
                                  onClick={() => { setDeleteGroupTarget({ id: g.id, name: g.name }); setGroupMenuId(null); }}
                                  className="w-full text-left text-sm px-3 py-2 text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  </svg>
                                  Löschen
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>

                    {/* Inline edit panel */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="border-b border-border overflow-hidden"
                        >
                          <div className="px-4 py-3 space-y-3 bg-background/60">
                            <input
                              type="text"
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              placeholder="Gruppenname"
                              className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveGroup(g.id);
                                if (e.key === "Escape") setEditingGroupId(null);
                              }}
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground shrink-0">Farbe:</span>
                              <div className="flex gap-1.5 flex-wrap">
                                {GROUP_COLORS.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() => setEditingGroupColor(c)}
                                    className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110 active:scale-95"
                                    style={{ backgroundColor: c, borderColor: editingGroupColor === c ? "oklch(0.22 0.010 40)" : "transparent" }}
                                    aria-label={c}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingGroupId(null)}
                                className="flex-1 h-8 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
                              >
                                Abbrechen
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveGroup(g.id)}
                                disabled={!editingGroupName.trim()}
                                className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
                              >
                                Speichern
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Members chips */}
                    {members.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setAssignGroupId(g.id)}
                        className="w-full px-4 py-3 text-xs text-muted-foreground italic hover:bg-secondary/20 transition-colors text-left rounded-b-2xl"
                      >
                        Keine Mitglieder — tippe zum Zuweisen
                      </button>
                    ) : (
                      <div className="px-4 py-3 flex flex-wrap gap-1.5 rounded-b-2xl">
                        {members.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: `${g.color}15`, color: g.color ?? undefined, border: `1px solid ${g.color}30` }}
                          >
                            {m.name}
                            <button
                              type="button"
                              onClick={() => toggleGroupMember(g.id, m.id)}
                              aria-label={`${m.name} entfernen`}
                              className="opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* ══ BULK IMPORT SHEET ═══════════════════════════════════════════════ */}
      <BottomSheet open={bulkOpen} onClose={() => { setBulkOpen(false); setBulkText(""); }} title="Mehrere importieren">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Namen eingeben — durch Komma oder Zeilenumbruch getrennt.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            placeholder={"John Doe\nJane Smith, Frank Müller\nAnna Schneider"}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setBulkOpen(false); setBulkText(""); }}
              className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleBulkImport}
              disabled={!bulkText.trim() || bulkLoading}
              className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              {bulkLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              Importieren
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ══ QR VIEW SHEET ═══════════════════════════════════════════════════ */}
      <BottomSheet
        open={!!qrViewId}
        onClose={() => setQrViewId(null)}
        title={qrTarget?.name}
      >
        {qrTarget && (() => {
          const payload: TeilnehmerQRPayload = { id: qrTarget.id, name: qrTarget.name };
          return (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-2xl overflow-hidden border border-border p-3 bg-white">
                  <QRCodeCanvas payload={payload} size={200} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-mono text-center break-all px-2">{qrTarget.id}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const QRCode = await import("qrcode");
                    const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), { width: 400, margin: 2 });
                    const a = document.createElement("a");
                    a.href = dataUrl;
                    a.download = `${qrTarget.name.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "_")}-qr.png`;
                    a.click();
                  }}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => setQrViewId(null)}
                  className="flex-1 h-11 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          );
        })()}
      </BottomSheet>

      {/* ══ ASSIGN GROUP MEMBERS SHEET ══════════════════════════════════════ */}
      <BottomSheet
        open={!!assignGroupId}
        onClose={() => setAssignGroupId(null)}
        title={assignGroup ? `${assignGroup.name} — Mitglieder` : undefined}
      >
        {assignGroup && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tippe auf einen Namen, um ihn zur Gruppe hinzuzufügen oder zu entfernen.
            </p>
            {teilnehmer.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">Noch keine Teilnehmer vorhanden</p>
            ) : (
              <div className="max-h-72 overflow-y-auto -mx-1 rounded-xl">
                {teilnehmer.map((t) => {
                  const isMember = groupMembers.some((gm) => gm.group_id === assignGroup.id && gm.teilnehmer_id === t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleGroupMember(assignGroup.id, t.id)}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/50 active:bg-secondary transition-colors text-left"
                    >
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isMember ? "border-primary bg-primary" : "border-border bg-background"
                        }`}
                      >
                        {isMember && (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{t.name}</span>
                      {isMember && (
                        <span
                          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: `${assignGroup.color}20`, color: assignGroup.color ?? undefined }}
                        >
                          Mitglied
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => setAssignGroupId(null)}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Fertig
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ══ CONFIRM: DELETE TEILNEHMER ══════════════════════════════════════ */}
      <ConfirmSheet
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        title="Teilnehmer löschen"
        description={`${deleteTarget?.name} wirklich löschen? Dies kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        destructive
      />

      {/* ══ CONFIRM: DELETE GROUP ════════════════════════════════════════════ */}
      <ConfirmSheet
        open={!!deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={() => deleteGroupTarget && handleDeleteGroup(deleteGroupTarget.id)}
        title="Gruppe löschen"
        description={`Gruppe „${deleteGroupTarget?.name}" wirklich löschen? Alle Mitgliedschaften in dieser Gruppe werden entfernt.`}
        confirmLabel="Löschen"
        destructive
      />

      {/* ══ QR SCANNER ══════════════════════════════════════════════════════ */}
      {scannerOpen && (
        <QRScannerModal onScan={handleScanAdd} onClose={() => setScannerOpen(false)} />
      )}
    </div>
  );
}
