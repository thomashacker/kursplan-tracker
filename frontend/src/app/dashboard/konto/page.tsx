import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/types";
import { AccountSettingsForm } from "./AccountSettingsForm";

export const metadata = { title: "Konto – Kurs.Y" };

export default async function KontoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/anmelden");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  return (
    <div className="max-w-xl">
      <h1
        className="font-bold tracking-tight mb-8"
        style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.75rem, 6vw, 2.25rem)" }}
      >
        Konto
      </h1>
      <AccountSettingsForm user={user} profile={profile} />
    </div>
  );
}
