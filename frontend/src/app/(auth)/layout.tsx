import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-background">
      {/* Dot-grid texture */}
      <div className="absolute inset-0 bg-dot-grid pointer-events-none" aria-hidden />

      {/* Accent glow — bottom left */}
      <div
        className="absolute bottom-0 left-0 w-96 h-96 pointer-events-none"
        style={{
          background: "radial-gradient(circle at bottom left, color-mix(in oklch, var(--color-primary) 7%, transparent) 0%, transparent 65%)",
          filter: "blur(30px)",
        }}
        aria-hidden
      />

      {/* Top wordmark nav */}
      <header className="relative z-10 px-6 pt-8 pb-4">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary transition-opacity group-hover:opacity-80">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="3" fill="white" />
              <circle cx="7" cy="7" r="6" stroke="white" strokeWidth="1.2" strokeDasharray="3 2" />
            </svg>
          </span>
          <span
            className="text-sm font-bold tracking-[0.18em] uppercase text-muted-foreground transition-opacity group-hover:opacity-70"
            style={{ fontFamily: "var(--font-syne, system-ui)" }}
          >
            Kurs.Y
          </span>
        </Link>
      </header>

      {/* Form area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
