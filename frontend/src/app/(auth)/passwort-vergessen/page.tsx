"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const reduced = useReducedMotion();

  const emailOk = EMAIL_RE.test(email);
  const emailError = email.includes("@") && !emailOk ? "Ungültige E-Mail-Adresse" : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!emailOk) return;
    setLoading(true);

    const supabase = createClient();
    // redirectTo points to the auth callback which exchanges the code,
    // then forwards to the new-password page.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/passwort-zuruecksetzen`,
    });

    // Always show success — avoids leaking whether the email exists.
    setLoading(false);
    setSent(true);
  }

  return (
    <AnimatePresence mode="wait">
      {sent ? (
        <motion.div
          key="sent"
          initial={reduced ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="space-y-6"
        >
          {/* Envelope icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              className="text-primary">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 7 10-7" />
            </svg>
          </div>

          <div>
            <h1
              className="font-bold tracking-tight mb-2"
              style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(2rem, 8vw, 2.75rem)" }}
            >
              E-Mail unterwegs.
            </h1>
            <p className="text-muted-foreground text-[0.95rem] leading-relaxed">
              Wir haben einen Link an{" "}
              <span className="font-medium text-foreground">{email}</span>{" "}
              geschickt. Prüfe auch deinen Spam-Ordner.
            </p>
          </div>

          <Link
            href="/anmelden"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-70 transition-opacity"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M13 8H3M7 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Zurück zum Login
          </Link>
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={spring}
          className="space-y-8"
        >
          <div>
            <h1
              className="font-bold tracking-tight mb-2"
              style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(2.25rem, 9vw, 3rem)" }}
            >
              Passwort zurück&shy;setzen.
            </h1>
            <p className="text-muted-foreground text-[0.95rem]">
              Wir schicken dir einen Link per E-Mail.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-0">
              <Label htmlFor="email" className="text-sm font-medium block mb-2">
                E-Mail
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="max@beispiel.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!emailError}
                className={
                  emailOk
                    ? "h-12 text-base rounded-xl border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/25"
                    : "h-12 text-base rounded-xl"
                }
              />
              <AnimatePresence>
                {emailError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -4, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="text-xs text-destructive mt-1.5"
                  >
                    {emailError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              type="submit"
              disabled={loading || !emailOk}
              whileTap={reduced ? {} : { scale: 0.97 }}
              transition={springSnap}
              className="w-full rounded-2xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-40 hover:opacity-90 transition-opacity"
              style={{ height: "58px" }}
            >
              {loading ? "Wird gesendet…" : "Link senden"}
            </motion.button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            <Link
              href="/anmelden"
              className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              Zurück zum Login
            </Link>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
