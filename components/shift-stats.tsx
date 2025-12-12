"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { getCachedPassword } from "@/lib/password-cache";
import { formatDuration } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ShiftStats {
  period: string;
  startDate: string;
  endDate: string;
  stats: Record<string, { count: number; totalMinutes: number }>;
  totalMinutes: number;
}

interface ShiftStatsProps {
  calendarId: string | undefined;
  currentDate: Date;
  refreshTrigger?: number;
}

export function ShiftStats({
  calendarId,
  currentDate,
  refreshTrigger,
}: ShiftStatsProps) {
  const t = useTranslations();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const isInitialLoadRef = useRef(true);

  const fetchStats = useCallback(
    async (silent = false) => {
      if (!calendarId) return;

      if (!silent) {
        setLoading(true);
      }

      try {
        const password = getCachedPassword(calendarId);
        const params = new URLSearchParams({
          calendarId,
          period,
          date: currentDate.toISOString(),
        });
        if (password) {
          params.append("password", password);
        }

        const response = await fetch(`/api/shifts/stats?${params}`);
        if (!response.ok) {
          return; // Calendar is locked and no valid password
        }
        const data = await response.json();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch shift statistics:", error);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [calendarId, period, currentDate]
  );

  // Fetch stats when dependencies change
  useEffect(() => {
    if (calendarId) {
      fetchStats(!isInitialLoadRef.current);
      isInitialLoadRef.current = false;
    }
  }, [calendarId, refreshTrigger, fetchStats]);

  if (!calendarId) return null;

  const totalShifts =
    stats && stats.stats
      ? Object.values(stats.stats).reduce((sum, data) => sum + data.count, 0)
      : 0;

  const totalMinutes = stats?.totalMinutes || 0;

  return (
    <div className="border border-border/50 rounded-xl bg-gradient-to-b from-card/80 via-card/60 to-card/40 backdrop-blur-sm overflow-hidden shadow-lg">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between hover:bg-primary/5 transition-all"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("stats.title")}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && stats && totalShifts > 0 && (
            <>
              <div className="px-2.5 py-1 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg">
                <span className="font-bold text-primary text-xs sm:text-sm">
                  {totalShifts}
                </span>
              </div>
              {totalMinutes > 0 && (
                <div className="px-2.5 py-1 bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg">
                  <span className="font-bold text-primary text-xs sm:text-sm">
                    {formatDuration(totalMinutes)}
                  </span>
                </div>
              )}
            </>
          )}
          {!isExpanded && stats && totalShifts > 0 && (
            <div className="hidden sm:flex gap-1.5">
              <span
                className={`h-6 text-xs px-2 inline-flex items-center justify-center rounded-md font-medium transition-colors ${
                  period === "week"
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriod("week");
                }}
              >
                {t("stats.week")}
              </span>
              <span
                className={`h-6 text-xs px-2 inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer ${
                  period === "month"
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriod("month");
                }}
              >
                {t("stats.month")}
              </span>
              <span
                className={`h-6 text-xs px-2 inline-flex items-center justify-center rounded-md font-medium transition-colors cursor-pointer ${
                  period === "year"
                    ? "bg-primary text-primary-foreground"
                    : "border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPeriod("year");
                }}
              >
                {t("stats.year")}
              </span>
            </div>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-4 border-t border-border/30 bg-muted/20">
          {/* Period Selector - Mobile and Desktop when expanded */}
          <div className="flex gap-2 pt-4">
            <Button
              variant={period === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("week")}
              className="flex-1 sm:flex-none h-9 transition-all shadow-sm"
            >
              {t("stats.week")}
            </Button>
            <Button
              variant={period === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("month")}
              className="flex-1 sm:flex-none h-9 transition-all shadow-sm"
            >
              {t("stats.month")}
            </Button>
            <Button
              variant={period === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("year")}
              className="flex-1 sm:flex-none h-9 transition-all shadow-sm"
            >
              {t("stats.year")}
            </Button>
          </div>

          {/* Stats Display */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : stats && Object.keys(stats.stats).length > 0 ? (
            <div className="space-y-3.5">
              {/* Total Statistics Card */}
              <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-xs sm:text-sm flex items-center gap-2">
                    <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full shadow-sm shadow-primary/20"></div>
                    {t("stats.total")}
                  </span>
                  <div className="flex items-center gap-3">
                    {/* Shift Count */}
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground font-medium mb-0.5">
                        {t("common.shifts")}
                      </span>
                      <div className="px-2.5 py-1 rounded-md bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30">
                        <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                          {totalShifts}
                        </span>
                      </div>
                    </div>
                    {totalMinutes > 0 && (
                      <>
                        <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent"></div>
                        {/* Duration */}
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] text-muted-foreground font-medium mb-0.5">
                            {t("stats.hours")}
                          </span>
                          <div className="px-2.5 py-1 rounded-md bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30">
                            <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                              {formatDuration(totalMinutes)}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Individual Shift Types */}
              {Object.entries(stats.stats)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([title, data]) => (
                  <div
                    key={title}
                    className="group relative p-3 rounded-lg bg-gradient-to-br from-card via-card/80 to-card/60 border border-border/40 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                  >
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-sm font-semibold truncate flex-shrink min-w-0 group-hover:text-primary transition-colors">
                        {title}
                      </span>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Progress Bar */}
                        <div className="w-24 sm:w-32 h-2 bg-muted/50 rounded-full overflow-hidden border border-border/20 shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 transition-all duration-300 shadow-sm"
                            style={{
                              width: `${(data.count / totalShifts) * 100}%`,
                            }}
                          />
                        </div>
                        {/* Count Badge */}
                        <div className="min-w-[2.5rem] px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                          <span className="font-bold text-sm text-primary text-center block">
                            {data.count}
                          </span>
                        </div>
                        {/* Duration Badge */}
                        {data.totalMinutes > 0 && (
                          <div className="min-w-[3rem] sm:min-w-[3.5rem] px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                            <span className="font-semibold text-xs sm:text-sm text-primary text-center block">
                              {formatDuration(data.totalMinutes)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("stats.noData")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
