"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "hsl(0 0% 98%)" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ maxWidth: 360, textAlign: "center" }}>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Kritischer Fehler
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "2rem" }}>
              Die Anwendung konnte nicht geladen werden. Bitte lade die Seite neu.
            </p>
            <button
              onClick={reset}
              style={{ height: 40, padding: "0 1.25rem", borderRadius: 12, background: "hsl(221 83% 53%)", color: "#fff", fontSize: "0.875rem", fontWeight: 600, border: "none", cursor: "pointer" }}
            >
              Neu laden
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
