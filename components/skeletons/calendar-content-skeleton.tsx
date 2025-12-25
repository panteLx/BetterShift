import { Skeleton } from "@/components/ui/skeleton";

export function CalendarContentSkeleton({
  daysCount = 42,
}: {
  daysCount?: number;
}) {
  return (
    <div className="space-y-4">
      {/* Month Navigation Skeleton */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>

      {/* Calendar Grid Skeleton */}
      <div className="grid grid-cols-7 gap-0 sm:gap-1.5 mb-6">
        {/* Weekday headers */}
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-6 mx-1" />
        ))}

        {/* Calendar days */}
        {Array.from({ length: daysCount }).map((_, i) => (
          <div
            key={`day-${i}`}
            className="min-h-24 sm:min-h-28 border border-border/30 rounded-lg p-1.5 sm:p-2 space-y-1"
          >
            <Skeleton className="h-5 w-6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>

      {/* Stats and Shifts Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
