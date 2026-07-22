import { createClient } from "@/lib/supabase/server";
import type { PlanConfig } from "@/types";
import { PlanConfigEditor } from "./PlanConfigEditor";

export default async function AdminPlansPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("plan_config")
    .select("*")
    .order("plan")
    .returns<PlanConfig[]>();

  return (
    <div className="max-w-2xl">
      <h1
        className="font-bold tracking-tight mb-1"
        style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.75rem, 6vw, 2.25rem)" }}
      >
        Plan-Konfiguration
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Grenzen pro Plan. NULL = keine Grenze.
      </p>
      <PlanConfigEditor plans={data ?? []} />
    </div>
  );
}
