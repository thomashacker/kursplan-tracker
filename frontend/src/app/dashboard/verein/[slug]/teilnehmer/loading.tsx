import { Skeleton } from "@/components/ui/skeleton";

function GroupCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="w-3 h-3 rounded-full" />
          <Skeleton className="h-4 w-28 rounded" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <Skeleton className="h-3 flex-1 max-w-[160px] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeilnehmerLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-9 w-36 rounded-xl" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <GroupCardSkeleton />
        <GroupCardSkeleton />
        <GroupCardSkeleton />
      </div>
    </div>
  );
}
