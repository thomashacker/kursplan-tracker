"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Teilnehmer, TeilnehmerGroup, TeilnehmerQRPayload } from "@/types";

// ── Lazy-loaded QR components (browser-only) ──────────────────────────────────
const QRCodeCanvas = dynamic(() => import("./QRCodeCanvas"), { ssr: false });
const QRScannerModal = dynamic(() => import("./QRScannerModal"), { ssr: false });

// ── Sub-tabs ──────────────────────────────────────────────────────────────────
type Tab = "list" | "gruppen";

// ── Colour palette for groups ────────────────────────────────────────────────
const GROUP_COLORS = [
  "#6366f1","#f59e0b","#22c55e","#ec4899","#f97316","#3b82f6","#a855f7","#14b8a6",
];

// ── Main page component ───────────────────────────────────────────────────────
export default function TeilnehmerPage() {
  const { slug } = useParams<{ slug: string }>();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("list");
  const [clubId, setClubId] = useState<string | null>(null);

  // Teilnehmer state
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [groups, setGroups] = useState<TeilnehmerGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<{ group_id: string; teilnehmer_id: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-single form
  const [addName, setAddName] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Bulk import
  const [bulkText, setBulkText] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // QR scanner (add by scan)
  const [scannerOpen, setScannerOpen] = useState(false);

  // QR viewer
  const [qrViewId, setQrViewId] = useState<string | null>(null);

  // ZIP download loading
  const [zipLoading, setZipLoading] = useState(false);

  // Groups form
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupColor, setNewGroupColor] = useState(GROUP_COLORS[0]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");

  // Group member assignment modal
  const [assignGroupId, setAssignGroupId] = useState<string | null>(null);

  // ── Fetch club + data ──────────────────────────────────────────────────────
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
      const { data: club } = await supabase.from("clubs").select("id").eq("slug", slug).single();
      if (!club) return;
      setClubId(club.id);
      await fetchAll(club.id);
      setLoading(false);
    }
    init();
  }, [slug, supabase, fetchAll]);

  // ── Add single Teilnehmer ─────────────────────────────────────────────────
  async function handleAddSingle(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || !addName.trim()) return;
    setAddLoading(true);
    const { error } = await supabase.from("teilnehmer").insert({ club_id: clubId, name: addName.trim() });
    if (error) { toast.error(error.message); }
    else { toast.success(`${addName.trim()} hinzugefügt`); setAddName(""); await fetchAll(clubId); }
    setAddLoading(false);
  }

  // ── Scan to add ───────────────────────────────────────────────────────────
  async function handleScanAdd(payload: TeilnehmerQRPayload) {
    setScannerOpen(false);
    if (!clubId) return;
    // If ID already exists in our list, just show a toast
    const existing = teilnehmer.find((t) => t.id === payload.id);
    if (existing) { toast.info(`${existing.name} ist bereits in der Liste`); return; }
    const { error } = await supabase.from("teilnehmer").insert({
      id: payload.id, club_id: clubId, name: payload.name,
    });
    if (error) { toast.error(error.message); }
    else { toast.success(`${payload.name} via QR hinzugefügt`); await fetchAll(clubId); }
  }

  // ── Bulk import ───────────────────────────────────────────────────────────
  async function handleBulkImport() {
    if (!clubId || !bulkText.trim()) return;
    setBulkLoading(true);
    const names = bulkText
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    const rows = names.map((name) => ({ club_id: clubId, name }));
    const { error, data } = await supabase.from("teilnehmer").upsert(rows, {
      onConflict: "club_id,name",
      ignoreDuplicates: true,
    }).select();
    if (error) { toast.error(error.message); }
    else {
      const added = data?.length ?? 0;
      toast.success(`${added} Teilnehmer importiert${added < names.length ? ` (${names.length - added} bereits vorhanden)` : ""}`);
      setBulkText(""); setBulkOpen(false);
      await fetchAll(clubId);
    }
    setBulkLoading(false);
  }

  // ── Delete Teilnehmer ─────────────────────────────────────────────────────
  async function handleDelete(id: string, name: string) {
    if (!clubId) return;
    if (!confirm(`${name} wirklich löschen?`)) return;
    const { error } = await supabase.from("teilnehmer").delete().eq("id", id);
    if (error) { toast.error(error.message); }
    else { await fetchAll(clubId); }
  }

  // ── Bulk ZIP QR download ──────────────────────────────────────────────────
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
        const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
          width: 400, margin: 2, color: { dark: "#000000", light: "#ffffff" },
        });
        const base64 = dataUrl.split(",")[1];
        zip.file(`${t.name.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "_")}.png`, base64, { base64: true });
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "teilnehmer-qr.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("ZIP-Download fehlgeschlagen");
      console.error(err);
    }
    setZipLoading(false);
  }

  // ── Group CRUD ────────────────────────────────────────────────────────────
  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!clubId || !newGroupName.trim()) return;
    setGroupLoading(true);
    const { error } = await supabase.from("teilnehmer_groups").insert({
      club_id: clubId, name: newGroupName.trim(), color: newGroupColor,
    });
    if (error) { toast.error(error.message); }
    else { setNewGroupName(""); await fetchAll(clubId); }
    setGroupLoading(false);
  }

  async function handleDeleteGroup(id: string, name: string) {
    if (!clubId) return;
    if (!confirm(`Gruppe "${name}" löschen?`)) return;
    const { error } = await supabase.from("teilnehmer_groups").delete().eq("id", id);
    if (error) { toast.error(error.message); }
    else { await fetchAll(clubId); }
  }

  async function handleSaveGroupName(id: string) {
    if (!editingGroupName.trim()) return;
    const { error } = await supabase.from("teilnehmer_groups").update({ name: editingGroupName.trim() }).eq("id", id);
    if (error) { toast.error(error.message); }
    else { setEditingGroupId(null); await fetchAll(clubId!); }
  }

  // ── Group member assignment ───────────────────────────────────────────────
  async function toggleGroupMember(groupId: string, teilnehmerId: string) {
    const isMember = groupMembers.some((gm) => gm.group_id === groupId && gm.teilnehmer_id === teilnehmerId);
    if (isMember) {
      await supabase.from("teilnehmer_group_members").delete()
        .eq("group_id", groupId).eq("teilnehmer_id", teilnehmerId);
    } else {
      await supabase.from("teilnehmer_group_members").insert({ group_id: groupId, teilnehmer_id: teilnehmerId });
    }
    await fetchAll(clubId!);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function membersOfGroup(groupId: string): Teilnehmer[] {
    const ids = groupMembers.filter((gm) => gm.group_id === groupId).map((gm) => gm.teilnehmer_id);
    return teilnehmer.filter((t) => ids.includes(t.id));
  }

  function groupsOfTeilnehmer(id: string): TeilnehmerGroup[] {
    const groupIds = groupMembers.filter((gm) => gm.teilnehmer_id === id).map((gm) => gm.group_id);
    return groups.filter((g) => groupIds.includes(g.id));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-3 text-muted-foreground py-12 justify-center">
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        Wird geladen…
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            Teilnehmer
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {teilnehmer.length} Teilnehmer · {groups.length} Gruppen
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {(["list", "gruppen"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "list" ? "Teilnehmer" : "Gruppen"}
          </button>
        ))}
      </div>

      {/* ── LIST TAB ──────────────────────────────────────────────────────── */}
      {tab === "list" && (
        <div className="space-y-6">
          {/* Action bar */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Mehrere importieren
            </button>
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
                <rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                <path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/>
                <path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/>
                <path d="M12 21v-1"/>
              </svg>
              Per QR hinzufügen
            </button>
            {teilnehmer.length > 0 && (
              <button
                type="button"
                onClick={handleBulkQRDownload}
                disabled={zipLoading}
                className="h-9 px-3 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {zipLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                )}
                Alle QR-Codes (.zip)
              </button>
            )}
          </div>

          {/* Add single form */}
          <form onSubmit={handleAddSingle} className="flex gap-2">
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="Name eingeben…"
              className="flex-1 h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={!addName.trim() || addLoading}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              {addLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
              Hinzufügen
            </button>
          </form>

          {/* Teilnehmer list */}
          {teilnehmer.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border border-dashed">
              <p className="font-semibold mb-1">Noch keine Teilnehmer</p>
              <p className="text-sm text-muted-foreground">Füge einzelne Teilnehmer hinzu oder importiere eine Liste.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {teilnehmer.map((t) => {
                  const myGroups = groupsOfTeilnehmer(t.id);
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors group">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                        {t.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      {/* Name + groups */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{t.name}</p>
                        {myGroups.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {myGroups.map((g) => (
                              <span
                                key={g.id}
                                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ backgroundColor: `${g.color}20`, color: g.color ?? undefined, border: `1px solid ${g.color}40` }}
                              >
                                {g.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setQrViewId(t.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="QR-Code anzeigen"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/>
                            <rect x="3" y="16" width="5" height="5" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                            <path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(t.id, t.name)}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Löschen"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GRUPPEN TAB ───────────────────────────────────────────────────── */}
      {tab === "gruppen" && (
        <div className="space-y-6">
          {/* Add group form */}
          <form onSubmit={handleAddGroup} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground block mb-1">Gruppenname</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="z.B. Team A"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Farbe</label>
              <div className="flex gap-1.5">
                {GROUP_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewGroupColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      borderColor: newGroupColor === c ? "#000" : "transparent",
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={!newGroupName.trim() || groupLoading}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5"
            >
              {groupLoading ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              )}
              Gruppe erstellen
            </button>
          </form>

          {/* Groups list */}
          {groups.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-border border-dashed">
              <p className="font-semibold mb-1">Noch keine Gruppen</p>
              <p className="text-sm text-muted-foreground">Erstelle Gruppen, um Teilnehmer zu organisieren.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => {
                const members = membersOfGroup(g.id);
                const isEditing = editingGroupId === g.id;
                return (
                  <div key={g.id} className="rounded-2xl border border-border overflow-hidden">
                    {/* Group header */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 border-b border-border">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color ?? "#94a3b8" }} />
                      {isEditing ? (
                        <div className="flex-1 flex gap-2">
                          <input
                            type="text"
                            value={editingGroupName}
                            onChange={(e) => setEditingGroupName(e.target.value)}
                            className="flex-1 h-7 px-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveGroupName(g.id); if (e.key === "Escape") setEditingGroupId(null); }}
                          />
                          <button type="button" onClick={() => handleSaveGroupName(g.id)} className="text-xs font-medium text-primary hover:underline">Speichern</button>
                          <button type="button" onClick={() => setEditingGroupId(null)} className="text-xs text-muted-foreground hover:underline">Abbrechen</button>
                        </div>
                      ) : (
                        <span className="flex-1 text-sm font-semibold">{g.name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{members.length} Mitglieder</span>
                      <button
                        type="button"
                        onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); }}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        title="Umbenennen"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignGroupId(g.id)}
                        className="h-6 px-2 rounded text-xs font-medium border border-border hover:bg-background transition-colors"
                      >
                        Mitglieder verwalten
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteGroup(g.id, g.name)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Gruppe löschen"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        </svg>
                      </button>
                    </div>
                    {/* Members */}
                    {members.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted-foreground italic">Keine Mitglieder</p>
                    ) : (
                      <div className="px-4 py-2 flex flex-wrap gap-1.5">
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BULK IMPORT MODAL ─────────────────────────────────────────────── */}
      {bulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
            <h2 className="font-bold text-lg" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
              Mehrere importieren
            </h2>
            <p className="text-sm text-muted-foreground">
              Namen eingeben — durch Komma oder Zeilenumbruch getrennt.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              placeholder={"John Doe\nJane Smith, Frank Müller\nAnna Schneider"}
              className="w-full rounded-lg border border-border bg-background p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setBulkOpen(false); setBulkText(""); }}
                className="h-9 px-4 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={!bulkText.trim() || bulkLoading}
                className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                {bulkLoading && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                Importieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QR VIEW MODAL ─────────────────────────────────────────────────── */}
      {qrViewId && (() => {
        const t = teilnehmer.find((x) => x.id === qrViewId);
        if (!t) return null;
        const payload: TeilnehmerQRPayload = { id: t.id, name: t.name };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-xs rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4 text-center">
              <h2 className="font-bold text-lg" style={{ fontFamily: "var(--font-syne, system-ui)" }}>{t.name}</h2>
              <div className="flex justify-center">
                <QRCodeCanvas payload={payload} size={220} />
              </div>
              <p className="text-xs text-muted-foreground font-mono break-all">{t.id}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const QRCode = await import("qrcode");
                    const dataUrl = await QRCode.toDataURL(JSON.stringify(payload), { width: 400, margin: 2 });
                    const a = document.createElement("a"); a.href = dataUrl;
                    a.download = `${t.name.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "_")}-qr.png`; a.click();
                  }}
                  className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setQrViewId(null)}
                  className="flex-1 h-9 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors"
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── QR SCANNER MODAL ──────────────────────────────────────────────── */}
      {scannerOpen && (
        <QRScannerModal
          onScan={handleScanAdd}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* ── ASSIGN GROUP MEMBERS MODAL ────────────────────────────────────── */}
      {assignGroupId && (() => {
        const group = groups.find((g) => g.id === assignGroupId);
        if (!group) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color ?? "#94a3b8" }} />
                <h2 className="font-bold text-lg" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
                  {group.name}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">Teilnehmer auswählen, die zu dieser Gruppe gehören:</p>
              {teilnehmer.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Keine Teilnehmer vorhanden</p>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {teilnehmer.map((t) => {
                    const isMember = groupMembers.some((gm) => gm.group_id === group.id && gm.teilnehmer_id === t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                        <div
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isMember ? "bg-primary border-primary" : "border-border bg-background"
                          }`}
                          onClick={() => toggleGroupMember(group.id, t.id)}
                        >
                          {isMember && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm">{t.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setAssignGroupId(null)}
                className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Fertig
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
