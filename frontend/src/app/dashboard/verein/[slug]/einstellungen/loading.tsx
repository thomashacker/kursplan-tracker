import { Skeleton } from "@/components/ui/skeleton";

function SectionSkeleton({ children }: { children: React.ReactNode }) {
  return <div className="py-7 space-y-5 border-b border-border">{children}</div>;
}

export default function EinstellungenLoading() {
  return (
    <div className="divide-y divide-border">
      {/* Logo */}
      <SectionSkeleton>
        <Skeleton className="h-3.5 w-24 rounded" />
        <div className="flex items-center gap-5">
          <Skeleton className="w-16 h-16 rounded-xl shrink-0" />
          <Skeleton className="h-3.5 w-28 rounded" />
        </div>
      </SectionSkeleton>

      {/* General form */}
      <SectionSkeleton>
        <Skeleton className="h-3.5 w-20 rounded" />
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </SectionSkeleton>

      {/* Public link */}
      <SectionSkeleton>
        <Skeleton className="h-3.5 w-32 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-24 rounded-xl shrink-0" />
        </div>
      </SectionSkeleton>
    </div>
  );
}
