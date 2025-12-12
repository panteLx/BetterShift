import { Skeleton } from "@/components/ui/skeleton";

export function CalendarSkeleton() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Skeleton */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Top row with calendar and theme switchers */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-10 w-48" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
            </div>

            {/* Preset selector row */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container max-w-4xl mx-auto px-1 py-3 sm:p-4 flex-1">
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
            {Array.from({ length: 35 }).map((_, i) => (
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
      </div>

      {/* Footer Skeleton */}
      <div className="border-t border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
