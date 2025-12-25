import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for profile page content
 * Shows placeholder for user info, password change, connected accounts
 */
export function ProfileContentSkeleton() {
  return (
    <div className="flex-1 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>

        <div className="space-y-6">
          {/* User Info Card */}
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-48" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-56" />
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-80" />
              </div>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
                <Skeleton className="h-10 w-40 rounded-md" />
              </div>
            </div>
          </div>

          {/* Connected Accounts Card */}
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-4 w-72" />
              </div>
              <div className="space-y-3 pt-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            </div>
          </div>

          <Skeleton className="h-px w-full" />

          {/* Danger Zone Card */}
          <div className="rounded-xl border border-destructive/30 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm">
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-4 w-80" />
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-10 w-24 rounded-md" />
                </div>
                <Skeleton className="h-px w-full" />
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-80" />
                  </div>
                  <Skeleton className="h-10 w-32 rounded-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
