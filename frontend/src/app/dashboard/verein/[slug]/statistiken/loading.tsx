import { Skeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-2">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="h-8 w-16 rounded" />
      <Skeleton className="h-3 w-32 rounded" />
    </div>
  );
}

function BarChartSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Skeleton className="h-4 w-40 rounded mb-6" />
      <div className="flex items-end gap-2 h-32">
        {[60, 85, 45, 90, 70, 55, 80].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
          <Skeleton key={d} className="flex-1 h-3 rounded" />
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <Skeleton className="h-4 w-36 rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
            <Skeleton className="h-3 flex-1 max-w-[180px] rounded" />
          </div>
          <Skeleton className="h-3 w-12 rounded" />
          <Skeleton className="h-2 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export default function StatistikenLoading() {
  return (
    <div className="space-y-6">
      {/* Time window picker */}
      <div className="flex justify-end">
        <Skeleton className="h-9 w-64 rounded-xl" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      {/* Charts */}
      <div className="grid sm:grid-cols-2 gap-4">
        <BarChartSkeleton />
        <TableSkeleton rows={5} />
      </div>

      <TableSkeleton rows={3} />
    </div>
  );
}
