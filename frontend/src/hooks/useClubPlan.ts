"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClubPlan, PlanConfig } from "@/types";

/**
 * Single source of truth for the current club's plan limits on the client.
 * Reads `public.plan_config` (RLS: any authenticated user can SELECT) and
 * caches the row for the lifetime of the calling component.
 *
 * Pass the club's `plan` (already available on any fetched Club row) —
 * this avoids a redundant clubs-table lookup.
 */
export function useClubPlan(plan: ClubPlan | null | undefined): PlanConfig | null {
  const [cfg, setCfg] = useState<PlanConfig | null>(null);

  useEffect(() => {
    if (!plan) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("plan_config")
        .select("*")
        .eq("plan", plan)
        .single<PlanConfig>();
      if (!cancelled) setCfg(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  return cfg;
}
