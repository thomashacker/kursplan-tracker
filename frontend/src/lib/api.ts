/**
 * Typed helpers for calling the FastAPI backend.
 * The frontend passes the Supabase JWT in the Authorization header.
 */
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthHeaders(): Promise<HeadersInit> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Nicht angemeldet");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Serverfehler");
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { method: "DELETE", headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Serverfehler");
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Serverfehler");
  }
  return res.json();
}

// ──────────────────────────────────────────────────────────
// Invitation API
// ──────────────────────────────────────────────────────────

export function createInvitation(clubId: string, email: string, role: string) {
  return apiPost("/einladungen", { club_id: clubId, email, role });
}

export function getInvitation(token: string) {
  return fetch(`${API_URL}/einladungen/${token}`).then((r) => {
    if (!r.ok) throw new Error("Einladung nicht gefunden oder abgelaufen");
    return r.json();
  });
}

export function acceptInvitation(token: string) {
  return apiPost(`/einladungen/${token}/annehmen`, {});
}

// ──────────────────────────────────────────────────────────
// Plans API
// ──────────────────────────────────────────────────────────

export function copyWeek(sourceWeekId: string, targetWeekStart: string) {
  return apiPost(`/wochen/${sourceWeekId}/kopieren`, {
    source_week_id: sourceWeekId,
    target_week_start: targetWeekStart,
  });
}

// ──────────────────────────────────────────────────────────
// Account API
// ──────────────────────────────────────────────────────────

export function deleteAccount() {
  return apiDelete("/konto");
}
