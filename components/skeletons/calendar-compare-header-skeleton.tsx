import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for calendar compare view header
 * Shows placeholder for compare mode title and action buttons
 */
export function CalendarCompareHeaderSkeleton() {
  return (
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
  );
}
