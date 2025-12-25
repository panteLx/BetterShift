import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader for AppFooter component
 * Shows placeholder for language switcher, theme switcher, and links
 */
export function AppFooterSkeleton() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container max-w-4xl mx-auto p-3 sm:p-4">
        {/* Mobile: Two rows (language + links), Desktop: One row */}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:gap-4">
          {/* Language and theme switcher */}
          <div className="flex justify-center sm:justify-start items-center gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>

          {/* Links row - horizontal on all screen sizes */}
          <div className="flex flex-row items-center justify-center sm:justify-end gap-3 sm:gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </footer>
  );
}
