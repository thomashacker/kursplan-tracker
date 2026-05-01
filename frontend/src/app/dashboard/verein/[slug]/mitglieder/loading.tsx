import { Skeleton } from "@/components/ui/skeleton";

function MemberRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <Skeleton className="h-3.5 w-32 rounded" />
        <Skeleton className="h-3 w-44 rounded" />
      </div>
      <Skeleton className="shrink-0 h-5 w-16 rounded-full" />
    </div>
  );
}

export default function MitgliederLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-28 rounded" />
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Member list */}
      <div className="space-y-2">
        <MemberRowSkeleton />
        <MemberRowSkeleton />
        <MemberRowSkeleton />
        <MemberRowSkeleton />
      </div>

      {/* Invites section */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-36 rounded" />
        <MemberRowSkeleton />
        <MemberRowSkeleton />
      </div>
    </div>
  );
}
