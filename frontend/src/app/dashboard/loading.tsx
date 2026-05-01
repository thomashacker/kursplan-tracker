import { Skeleton } from "@/components/ui/skeleton";

function ClubCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card">
      <Skeleton className="shrink-0 w-12 h-12 rounded-xl" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-2/5 rounded" />
        <Skeleton className="h-3 w-3/5 rounded" />
        <div className="flex gap-1.5 mt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </div>
      <Skeleton className="shrink-0 w-5 h-5 rounded" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <Skeleton className="shrink-0 h-10 w-36 rounded-xl" />
      </div>
      <div className="flex flex-col gap-3">
        <ClubCardSkeleton />
        <ClubCardSkeleton />
        <ClubCardSkeleton />
      </div>
    </div>
  );
}
