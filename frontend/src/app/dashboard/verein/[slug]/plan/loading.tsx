import { Skeleton } from "@/components/ui/skeleton";

function SessionCardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-2.5 space-y-1.5 ${tall ? "h-24" : "h-16"}`}>
      <Skeleton className="h-3 w-2/3 rounded" />
      <Skeleton className="h-3 w-1/2 rounded" />
    </div>
  );
}

export default function PlanLoading() {
  return (
    <div>
      {/* Week nav bar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-6 w-40 rounded" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Day columns — desktop */}
      <div className="hidden sm:grid grid-cols-7 gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="space-y-2">
            {/* Day header */}
            <div className="text-center space-y-1 pb-1">
              <Skeleton className="h-3 w-6 mx-auto rounded" />
              <Skeleton className="h-5 w-7 mx-auto rounded-full" />
            </div>
            {/* Sessions */}
            {i % 2 === 0 && <SessionCardSkeleton tall />}
            {i % 3 !== 2 && <SessionCardSkeleton />}
          </div>
        ))}
      </div>

      {/* Mobile list */}
      <div className="sm:hidden space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-5 w-1/2 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
