import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { FloatingHelpButton } from "@/components/feedback/FloatingHelpButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={user} isSuperadmin={isSuperadmin === true} />
      <main className="flex-1 container max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
      <SiteFooter />
      <FloatingHelpButton />
    </div>
  );
}
