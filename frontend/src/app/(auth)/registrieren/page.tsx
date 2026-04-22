"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          key={message}
          initial={{ opacity: 0, y: -4, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.18 }}
          className="text-xs text-destructive mt-1.5 leading-snug"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default function RegistrierenPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const reduced = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Email: only check once "@" has been typed (feels less aggressive)
  const emailOk = EMAIL_RE.test(email);
  const emailError = email.includes("@") && !emailOk ? "Ungültige E-Mail-Adresse" : null;

  // Password: real-time length check
  const passwordOk = password.length >= 8;
  const passwordError = password.length > 0 && !passwordOk
    ? "Mindestens 8 Zeichen erforderlich"
    : null;

  // Confirm: show mismatch once they've started typing there
  const confirmOk = confirm.length > 0 && confirm === password && passwordOk;
  const confirmError = confirm.length > 0 && confirm !== password
    ? "Passwörter stimmen nicht überein"
    : null;

  const canSubmit = emailOk && passwordOk && confirmOk;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const fullName = form.get("full_name") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Konto erstellt! Bitte bestätige deine E-Mail-Adresse.");
    router.push("/anmelden");
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="space-y-7"
    >
      <div>
        <h1
          className="font-bold tracking-tight mb-2"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(2.25rem, 9vw, 3rem)" }}
        >
          Konto erstellen.
        </h1>
        <p className="text-muted-foreground text-[0.95rem]">
          Verwalte Trainingspläne für deinen Verein.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full name */}
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-sm font-medium">
            Vollständiger Name
          </Label>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            placeholder="Max Mustermann"
            className="h-12 text-base rounded-xl"
          />
        </div>

        {/* Email */}
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
          <FieldError message={emailError} />
        </div>

        {/* Password */}
        <div className="space-y-0">
          <Label htmlFor="password" className="text-sm font-medium block mb-2">
            Passwort
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!passwordError}
            className={
              passwordOk
                ? "h-12 text-base rounded-xl border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/25"
                : "h-12 text-base rounded-xl"
            }
          />
          <FieldError message={passwordError} />
        </div>

        {/* Confirm */}
        <div className="space-y-0">
          <Label htmlFor="password_confirm" className="text-sm font-medium block mb-2">
            Passwort bestätigen
          </Label>
          <Input
            id="password_confirm"
            name="password_confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!confirmError}
            className={
              confirmOk
                ? "h-12 text-base rounded-xl border-green-600 focus-visible:border-green-600 focus-visible:ring-green-600/25"
                : "h-12 text-base rounded-xl"
            }
          />
          <FieldError message={confirmError} />
        </div>

        <motion.button
          type="submit"
          disabled={loading || !canSubmit}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={springSnap}
          className="w-full rounded-2xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-40 hover:opacity-90 transition-opacity mt-1"
          style={{ height: "58px" }}
        >
          {loading ? "Wird erstellt…" : "Konto erstellen"}
        </motion.button>
      </form>

      <p className="text-sm text-center text-muted-foreground">
        Bereits ein Konto?{" "}
        <Link
          href="/anmelden"
          className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          Anmelden
        </Link>
      </p>
    </motion.div>
  );
}
