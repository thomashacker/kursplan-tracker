import { Skeleton } from "@/components/ui/skeleton";

function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-card">
          <Skeleton className="h-3.5 w-32 rounded" />
          <Skeleton className="h-6 w-6 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export default function ThemenLoading() {
  return (
    <div className="space-y-8">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          <ListSkeleton count={i === 0 ? 4 : 3} />
        </div>
      ))}
    </div>
  );
}
