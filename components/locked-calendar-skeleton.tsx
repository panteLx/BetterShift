import { Skeleton } from "@/components/ui/skeleton";
import { Calendar as CalendarIcon } from "lucide-react";

export function LockedCalendarSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl border border-border/50 rounded-2xl p-8">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 mx-auto">
            <CalendarIcon className="h-10 w-10 text-primary animate-pulse" />
          </div>

          {/* Title */}
          <Skeleton className="h-8 w-3/4 mx-auto mb-2" />

          {/* Description */}
          <Skeleton className="h-5 w-full mx-auto mb-8" />

          {/* Password Input */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-11 w-full" />
            </div>

            {/* Submit Button */}
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
