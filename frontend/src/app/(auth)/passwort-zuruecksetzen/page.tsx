"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

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

export default function PasswortZuruecksetzenPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const reduced = useReducedMotion();

  const passwordOk = password.length >= 8;
  const passwordError = password.length > 0 && !passwordOk
    ? "Mindestens 8 Zeichen erforderlich"
    : null;

  const confirmOk = confirm.length > 0 && confirm === password && passwordOk;
  const confirmError = confirm.length > 0 && confirm !== password
    ? "Passwörter stimmen nicht überein"
    : null;

  const canSubmit = passwordOk && confirmOk;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Passwort erfolgreich geändert.");
    router.push("/anmelden");
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="space-y-8"
    >
      <div>
        <h1
          className="font-bold tracking-tight mb-2"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(2.25rem, 9vw, 3rem)" }}
        >
          Neues Passwort.
        </h1>
        <p className="text-muted-foreground text-[0.95rem]">
          Wähle ein sicheres Passwort für dein Konto.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-0">
          <Label htmlFor="password" className="text-sm font-medium block mb-2">
            Neues Passwort
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

        <div className="space-y-0">
          <Label htmlFor="confirm" className="text-sm font-medium block mb-2">
            Passwort bestätigen
          </Label>
          <Input
            id="confirm"
            name="confirm"
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
          {loading ? "Wird gespeichert…" : "Passwort speichern"}
        </motion.button>
      </form>
    </motion.div>
  );
}
