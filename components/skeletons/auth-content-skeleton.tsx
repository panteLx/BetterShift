import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for authentication form content
 * Shows placeholder for login/register form fields
 */
export function AuthContentSkeleton() {
  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <Skeleton className="h-10 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-5/6 mx-auto" />
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 p-8 shadow-lg backdrop-blur-sm">
          <div className="space-y-6">
            {/* Form Fields */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>

            {/* Submit Button */}
            <Skeleton className="h-10 w-full rounded-md" />
          </div>

          {/* Bottom Link */}
          <div className="mt-6 text-center">
            <Skeleton className="h-4 w-48 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}
