import { Skeleton } from "@/components/ui/skeleton";

interface PresetListSkeletonProps {
  hidePresetHeader?: boolean;
}

export function PresetListSkeleton({
  hidePresetHeader = false,
}: PresetListSkeletonProps) {
  return (
    <div className="space-y-2">
      {/* Preset Buttons Row */}
      {!hidePresetHeader && (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>
      )}

      {/* Control Buttons Row */}
      <div className="flex items-center gap-2">
        {!hidePresetHeader && <Skeleton className="h-9 w-9 rounded-lg" />}
        <div className="flex-1" />
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}
