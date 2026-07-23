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
    <div>
      <div className="mb-6">
        <h1
          className="font-bold tracking-tight leading-none"
          style={{ fontFamily: "var(--font-syne, system-ui)", fontSize: "clamp(1.5rem, 4vw, 2rem)" }}
        >
          Plan-Konfiguration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Grenzen pro Plan. NULL = keine Grenze.
        </p>
      </div>
      <PlanConfigEditor plans={data ?? []} />
    </div>
  );
}
