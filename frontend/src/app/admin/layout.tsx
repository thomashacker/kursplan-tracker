import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";

export const metadata = {
  title: "Ops · Kursplan",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (!isSuperadmin) notFound();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} isSuperadmin />
      <div className="border-b border-border bg-background/70">
        <nav className="max-w-7xl mx-auto px-4 py-2 flex gap-4 text-xs uppercase tracking-widest text-muted-foreground">
          <Link href="/admin" className="hover:text-foreground transition-colors">
            Übersicht
          </Link>
          <Link href="/admin/plans" className="hover:text-foreground transition-colors">
            Pläne
          </Link>
        </nav>
      </div>
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
