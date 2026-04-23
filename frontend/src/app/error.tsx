"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Ein unerwarteter Fehler ist aufgetreten. Versuche es erneut oder lade die Seite neu.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Erneut versuchen
          </button>
          <a
            href="/dashboard"
            className="h-10 px-5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors inline-flex items-center"
          >
            Zur Startseite
          </a>
        </div>
      </div>
    </div>
  );
}
