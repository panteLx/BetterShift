import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for calendar header section
 * Shows placeholder for calendar selector, preset buttons, and action buttons
 */
interface CalendarHeaderSkeletonProps {
  hidePresetHeader?: boolean;
}

export function CalendarHeaderSkeleton({
  hidePresetHeader = false,
}: CalendarHeaderSkeletonProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="container max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Top row with calendar selector and action buttons */}
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-10 w-48" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          </div>

          {/* Preset selector row */}
          {!hidePresetHeader && (
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-24 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-full" />
              <Skeleton className="h-9 w-28 rounded-full" />
              <Skeleton className="h-9 w-9 rounded-lg" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
