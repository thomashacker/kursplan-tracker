import { createClient } from "@/lib/supabase/server";
import type { Feedback } from "@/types";
import { FeedbackListClient } from "./FeedbackListClient";

export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feedback")
    .select("*")
    // Open rows first, then most-recent within each status.
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .returns<Feedback[]>();

  return (
    <div>
      <div className="mb-6">
        <h1
          className="font-bold tracking-tight leading-none"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.5rem, 4vw, 2rem)" }}
        >
          Feedback
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bug-Reports, Ideen und sonstiges. Direkt aus der App eingereicht.
        </p>
      </div>
      <FeedbackListClient initialItems={data ?? []} />
    </div>
  );
}
