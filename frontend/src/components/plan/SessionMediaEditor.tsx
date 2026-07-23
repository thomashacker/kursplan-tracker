"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/utils/imageCompress";
import type { SessionMedia, SessionMediaKind } from "@/types";
import {
  SESSION_MEDIA_MAX,
  SESSION_MEDIA_IMAGE_MAX_MB,
  SESSION_MEDIA_PDF_MAX_MB,
} from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LimitBadge } from "@/components/ui/limit-badge";

interface Props {
  sessionId: string;
  clubId: string;
}

const BUCKET = "session-media";

function iconFor(kind: SessionMediaKind) {
  if (kind === "image") return "🖼";
  if (kind === "pdf") return "📄";
  return "🔗";
}

export function SessionMediaEditor({ sessionId, clubId }: Props) {
  const [rows, setRows] = useState<SessionMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCaption, setLinkCaption] = useState("");
  const [storageCap, setStorageCap] = useState<number | null>(null);
  const [storageUsed, setStorageUsed] = useState<number>(0);
  const [mediaCap, setMediaCap] = useState<number>(SESSION_MEDIA_MAX);
  const [canUploadFiles, setCanUploadFiles] = useState<boolean>(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    supabase
      .from("session_media")
      .select("*")
      .eq("session_id", sessionId)
      .order("sort_order", { ascending: true })
      .returns<SessionMedia[]>()
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, [sessionId, supabase]);

  // Storage-cap gate: load the club's plan cap + latest snapshot so we can
  // reject uploads that would push over the limit. NULL cap = unlimited,
  // in which case we skip all checks.
  // Load plan info for this club: media count cap, storage cap (only
  // meaningful for plans that CAN upload), and the can_upload_files flag
  // that decides whether image/pdf upload UI is shown at all.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [
        { data: storageCapData },
        { data: mediaCapData },
        { data: canUploadData },
        { data: snapData },
      ] = await Promise.all([
        supabase.rpc("plan_limit", { p_club_id: clubId, p_resource: "storage_bytes" }),
        supabase.rpc("plan_limit", { p_club_id: clubId, p_resource: "media_per_session" }),
        supabase.rpc("club_can_upload_files", { p_club_id: clubId }),
        supabase
          .from("usage_snapshots")
          .select("storage_bytes")
          .eq("club_id", clubId)
          .order("taken_at", { ascending: false })
          .limit(1),
      ]);
      if (cancelled) return;
      setStorageCap(storageCapData == null ? null : Number(storageCapData));
      setMediaCap(mediaCapData == null ? SESSION_MEDIA_MAX : Number(mediaCapData));
      setStorageUsed(Number(snapData?.[0]?.storage_bytes ?? 0));
      setCanUploadFiles(Boolean(canUploadData));
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, supabase]);

  const atCap = rows.length >= mediaCap;

  async function insertRow(kind: SessionMediaKind, url: string, caption: string | null) {
    const { data: { user } } = await supabase.auth.getUser();
    const sortOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) + 1 : 0;
    const { data, error } = await supabase
      .from("session_media")
      .insert({ session_id: sessionId, kind, url, caption, sort_order: sortOrder, created_by: user?.id ?? null })
      .select()
      .single<SessionMedia>();
    if (error || !data) {
      toast.error(error?.message ?? "Speichern fehlgeschlagen.");
      return;
    }
    setRows((prev) => [...prev, data]);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    if (!files.length) return;

    setUploading(true);
    for (const file of files) {
      if (rows.length + 1 > mediaCap) {
        toast.error(`Maximal ${mediaCap} Anhang${mediaCap === 1 ? "" : "änge"} pro Sitzung.`);
        break;
      }

      const isImage = file.type.startsWith("image/");
      const isPdf   = file.type === "application/pdf";
      if (!isImage && !isPdf) {
        toast.error(`Nicht unterstützt: ${file.name}`);
        continue;
      }

      const cap = isImage ? SESSION_MEDIA_IMAGE_MAX_MB : SESSION_MEDIA_PDF_MAX_MB;
      if (!isImage && file.size > cap * 1024 * 1024) {
        toast.error(`${file.name}: Datei zu groß (>${cap} MB).`);
        continue;
      }

      let uploadBlob: Blob = file;
      let ext = file.name.split(".").pop() ?? (isImage ? "jpg" : "pdf");
      if (isImage) {
        try {
          uploadBlob = await compressImage(file);
          ext = "jpg";
          if (uploadBlob.size > cap * 1024 * 1024) {
            toast.error(`${file.name}: Bild nach Komprimierung zu groß.`);
            continue;
          }
        } catch {
          toast.error(`${file.name}: Bildkomprimierung fehlgeschlagen.`);
          continue;
        }
      }

      // Storage-cap check: reject if this upload would push the club over
      // its plan storage limit. NULL cap = unlimited plan → skip.
      if (storageCap != null && storageUsed + uploadBlob.size > storageCap) {
        const usedMb = (storageUsed / (1024 * 1024)).toFixed(1);
        const capMb  = (storageCap  / (1024 * 1024)).toFixed(0);
        toast.error(`Speicher voll (${usedMb} / ${capMb} MB). Lösche zuerst ältere Anhänge.`);
        break;
      }

      const path = `${clubId}/${sessionId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, uploadBlob, { contentType: isImage ? "image/jpeg" : file.type, upsert: false });
      if (upErr) {
        toast.error(upErr.message);
        continue;
      }
      // Optimistically add to our running total so subsequent files in the
      // same batch also see the raised usage. Nightly snapshot will catch
      // up authoritatively.
      setStorageUsed((prev) => prev + uploadBlob.size);
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await insertRow(isImage ? "image" : "pdf", pub.publicUrl, null);
    }
    setUploading(false);
  }

  async function handleAddLink() {
    const url = linkUrl.trim();
    if (!url) return;
    if (rows.length >= mediaCap) {
      toast.error(`Maximal ${mediaCap} Anhang${mediaCap === 1 ? "" : "änge"} pro Sitzung.`);
      return;
    }
    await insertRow("link", url, linkCaption.trim() || null);
    setLinkUrl("");
    setLinkCaption("");
  }

  async function handleRemove(row: SessionMedia) {
    // Storage cleanup first for uploads; ignore failure (row deletion is what matters).
    if (row.kind !== "link") {
      const key = row.url.split(`${BUCKET}/`)[1];
      if (key) await supabase.storage.from(BUCKET).remove([key]);
    }
    const { error } = await supabase.from("session_media").delete().eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  }

  async function handleUpdateCaption(row: SessionMedia, caption: string) {
    const { error } = await supabase
      .from("session_media")
      .update({ caption: caption.trim() || null })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, caption: caption.trim() || null } : r)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Anhänge</Label>
        <LimitBadge used={rows.length} limit={mediaCap} compact />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl border border-input bg-background">
              <span className="text-base leading-none" aria-hidden>{iconFor(r.kind)}</span>
              <div className="flex-1 min-w-0">
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline truncate block">
                  {r.caption ?? (r.kind === "link" ? r.url : r.kind === "pdf" ? "PDF öffnen" : "Bild öffnen")}
                </a>
                <input
                  type="text"
                  defaultValue={r.caption ?? ""}
                  placeholder="Beschriftung (optional)"
                  onBlur={(e) => e.target.value !== (r.caption ?? "") && handleUpdateCaption(r, e.target.value)}
                  className="mt-1 w-full h-6 px-1.5 rounded-md border border-transparent hover:border-input focus:border-input bg-transparent text-[11px] text-muted-foreground"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemove(r)}
                className="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Entfernen"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {!atCap && canUploadFiles && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1 h-9 rounded-lg border border-dashed border-input text-xs font-medium hover:bg-secondary transition-colors disabled:opacity-50"
          >
            {uploading ? "Wird hochgeladen…" : "Bild / PDF hochladen"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="sr-only"
            onChange={handleUpload}
          />
        </div>
      )}

      {!atCap && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link hinzufügen (https://…)"
            className="h-9 rounded-lg text-xs"
          />
          <Input
            type="text"
            value={linkCaption}
            onChange={(e) => setLinkCaption(e.target.value)}
            placeholder="Beschriftung (optional)"
            className="h-9 rounded-lg text-xs w-full sm:w-40"
          />
          <button
            type="button"
            onClick={handleAddLink}
            disabled={!linkUrl.trim()}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Link
          </button>
        </div>
      )}
    </div>
  );
}
