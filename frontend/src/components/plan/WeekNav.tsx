"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { offsetWeek } from "@/lib/utils/date";

export function WeekNav({ weekStart }: { weekStart: string }) {
  const router = useRouter();

  function navigate(offset: number) {
    router.push(`?woche=${offsetWeek(weekStart, offset)}`);
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
        ← Vorwoche
      </Button>
      <Button variant="outline" size="sm" onClick={() => navigate(1)}>
        Nächste Woche →
      </Button>
    </div>
  );
}
