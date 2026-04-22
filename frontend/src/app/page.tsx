import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingHero from "@/components/landing/LandingHero";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return <LandingHero />;
}
