"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import type { Invitation, Role } from "@/types";
import { ROLE_LABELS } from "@/types";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };

type State = "loading" | "ready" | "error" | "accepting" | "done";

export default function EinladungPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [state, setState] = useState<State>("loading");
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      setUserEmail(user?.email ?? null);

      const { data: rows, error } = await supabase
        .rpc("get_invitation_by_token", { p_token: params.token });
      const inv = rows?.[0] as Invitation | undefined ?? null;

      if (error || !inv || !rows?.length) {
        setErrorMsg("Einladung nicht gefunden oder abgelaufen.");
        setState("error");
        return;
      }

      if (new Date(inv.expires_at) < new Date()) {
        setErrorMsg("Diese Einladung ist abgelaufen.");
        setState("error");
        return;
      }

      if (inv.used_at) {
        setErrorMsg("Diese Einladung wurde bereits verwendet.");
        setState("error");
        return;
      }

      setInvitation(inv);
      setState("ready");
    }

    init();
  }, [params.token]);

  async function handleAccept() {
    if (!isLoggedIn) {
      router.push(`/anmelden?redirect=/einladung/${params.token}`);
      return;
    }
    setState("accepting");

    const supabase = createClient();
    const { data: clubId, error } = await supabase.rpc("accept_invitation", { p_token: params.token });

    if (error) {
      toast.error(error.message);
      setState("ready");
      return;
    }

    toast.success("Einladung angenommen! Willkommen im Verein.");
    setState("done");

    const { data: club } = await supabase.from("clubs").select("slug").eq("id", clubId).single();
    router.push(club ? `/dashboard/verein/${club.slug}/plan` : "/dashboard");
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Einladung wird geladen…
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="max-w-sm w-full text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1 className="font-bold text-xl mb-2" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            Einladung ungültig
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{errorMsg}</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="h-11 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            Zur Startseite
          </button>
        </motion.div>
      </div>
    );
  }

  const clubName = invitation?.clubs?.name ?? "einem Verein";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="max-w-sm w-full"
      >
        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Einladung
          </p>
          <h1 className="font-bold text-2xl tracking-tight mb-2" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
            {clubName}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Du wurdest als{" "}
            <span className="font-medium text-foreground">
              {ROLE_LABELS[invitation?.role as Role ?? "member"]}
            </span>{" "}
            eingeladen.
          </p>

          {isLoggedIn ? (
            <p className="text-xs text-muted-foreground mb-6 bg-secondary rounded-xl px-3 py-2">
              Angemeldet als <strong>{userEmail}</strong>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mb-6 bg-secondary rounded-xl px-3 py-2">
              Du musst angemeldet sein, um die Einladung anzunehmen.
            </p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={state === "accepting" || state === "done"}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {!isLoggedIn
                ? "Anmelden & beitreten"
                : state === "accepting"
                ? "Wird angenommen…"
                : "Einladung annehmen"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="w-full h-10 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
            >
              Ablehnen
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
