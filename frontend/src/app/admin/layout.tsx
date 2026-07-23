import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { AdminSubNav } from "./AdminSubNav";
import { FloatingHelpButton } from "@/components/feedback/FloatingHelpButton";

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
      <AdminSubNav />
      <main className="flex-1 w-full max-w-[100rem] mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
      <SiteFooter />
      <FloatingHelpButton />
    </div>
  );
}
