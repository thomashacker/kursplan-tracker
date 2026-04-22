"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, useReducedMotion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const spring = { type: "spring" as const, stiffness: 260, damping: 28 };
const springSnap = { type: "spring" as const, stiffness: 480, damping: 32 };

export default function AnmeldenPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const reduced = useReducedMotion();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={spring}
      className="space-y-8"
    >
      {/* Heading */}
      <div>
        <h1
          className="font-bold tracking-tight mb-2"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(2.25rem, 9vw, 3rem)" }}
        >
          Anmelden.
        </h1>
        <p className="text-muted-foreground text-[0.95rem]">
          Willkommen zurück.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            E-Mail
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="max@beispiel.de"
            className="h-12 text-base rounded-xl"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">
              Passwort
            </Label>
            <Link
              href="/passwort-vergessen"
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-4"
            >
              Vergessen?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="h-12 text-base rounded-xl"
          />
        </div>

        <motion.button
          type="submit"
          disabled={loading}
          whileTap={reduced ? {} : { scale: 0.97 }}
          transition={springSnap}
          className="w-full rounded-2xl bg-primary text-primary-foreground font-semibold text-base disabled:opacity-60 hover:opacity-90 transition-opacity mt-2"
          style={{ height: "58px" }}
        >
          {loading ? "Anmelden…" : "Anmelden"}
        </motion.button>
      </form>

      {/* Footer link */}
      <p className="text-sm text-center text-muted-foreground">
        Noch kein Konto?{" "}
        <Link
          href="/registrieren"
          className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          Registrieren
        </Link>
      </p>
    </motion.div>
  );
}
