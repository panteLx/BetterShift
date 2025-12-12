"use client";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";

export function ShiftStatsSkeleton() {
  const t = useTranslations();

  return (
    <div className="border border-border/50 rounded-xl bg-gradient-to-b from-card/80 via-card/60 to-card/40 backdrop-blur-sm overflow-hidden shadow-lg">
      <div className="px-3 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("stats.title")}
          </h3>
        </div>
      </div>

      <div className="border-t border-border/30 bg-muted/20 p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>

        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
