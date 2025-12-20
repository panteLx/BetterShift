import { Skeleton } from "@/components/ui/skeleton";
import { PresetListSkeleton } from "@/components/preset-list-skeleton";

interface CalendarCompareSkeletonProps {
  count: number;
  hidePresetHeader?: boolean;
}

export function CalendarCompareSkeleton({
  count,
  hidePresetHeader = false,
}: CalendarCompareSkeletonProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
          <div className="space-y-3">
            {/* Title and Buttons */}
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Warning Skeleton */}
      <div className="lg:hidden mx-3 mt-3 mb-1">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>

      {/* Calendars Grid */}
      <div className="flex-1 w-full px-1 sm:px-4 py-4">
        <div
          className={`grid gap-4 ${
            count === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {Array.from({ length: count }).map((_, index) => (
            <div
              key={index}
              className="border border-border rounded-xl overflow-hidden bg-card shadow-sm"
            >
              {/* Calendar Header */}
              <div className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-5 h-5 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                </div>
              </div>

              {/* Calendar Content */}
              <div className="p-4 space-y-4">
                {/* Preset List Skeleton */}
                <PresetListSkeleton hidePresetHeader={hidePresetHeader} />

                {/* Calendar Grid Skeleton (compact version) */}
                <div className="grid grid-cols-7 gap-1 mt-4">
                  {/* Weekday headers */}
                  {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={`header-${index}-${i}`} className="h-5" />
                  ))}

                  {/* Calendar days (limited to 35 for performance) */}
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div
                      key={`day-${index}-${i}`}
                      className="min-h-20 border border-border/30 rounded-lg p-1.5 space-y-1"
                    >
                      <Skeleton className="h-4 w-5" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
