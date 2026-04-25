import Link from "next/link";

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={`border-t bg-background ${className ?? ""}`}>
      <div className="container max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Kurs.Y</span>
        <nav className="flex items-center gap-4">
          <Link href="/nutzungsbedingungen" className="hover:text-foreground transition-colors">
            Nutzungsbedingungen
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            Datenschutz
          </Link>
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            Impressum
          </Link>
        </nav>
      </div>
    </footer>
  );
}
