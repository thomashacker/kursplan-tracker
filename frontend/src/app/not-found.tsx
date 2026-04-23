import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-sm w-full text-center">
        <p className="text-8xl font-bold text-muted-foreground/20 mb-6" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          404
        </p>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-syne, system-ui)" }}>
          Seite nicht gefunden
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Die aufgerufene Seite existiert nicht oder du hast keinen Zugriff darauf.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-10 px-6 items-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
