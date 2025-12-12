import { Skeleton } from "@/components/ui/skeleton";

export function PresetListSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-24 rounded-lg" />
      <Skeleton className="h-9 w-32 rounded-lg" />
      <Skeleton className="h-9 w-28 rounded-lg" />
      <Skeleton className="h-9 w-36 rounded-lg" />
      <Skeleton className="h-9 w-9 rounded-lg" />
    </div>
  );
}
