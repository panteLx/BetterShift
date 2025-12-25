import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for AuthHeader component
 * Shows placeholder for logo, app name, and optional user menu
 */
interface AuthHeaderSkeletonProps {
  showUserMenu?: boolean;
}

export function AuthHeaderSkeleton({
  showUserMenu = false,
}: AuthHeaderSkeletonProps) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
      <div className="container max-w-4xl mx-auto p-3 sm:p-4">
        <div className="space-y-3 sm:space-y-4">
          {/* Header with Logo and optional User Menu */}
          <div className="flex items-center justify-between gap-4">
            {/* Logo Section Skeleton */}
            <div className="flex items-center gap-3">
              <Skeleton className="w-12 h-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>

            {/* User Menu Skeleton (optional) */}
            {showUserMenu && <Skeleton className="w-9 h-9 rounded-full" />}
          </div>
        </div>
      </div>
    </div>
  );
}
