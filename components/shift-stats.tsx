"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";

interface ShiftStats {
  period: string;
  startDate: string;
  endDate: string;
  stats: Record<string, number>;
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
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (calendarId) {
      fetchStats();
    }
  }, [calendarId, period, currentDate, refreshTrigger]);

  const fetchStats = async () => {
    if (!calendarId) return;

    const isInitialLoad = stats === null;
    if (isInitialLoad) {
      setLoading(true);
    }

    try {
      const response = await fetch(
        `/api/shifts/stats?calendarId=${calendarId}&period=${period}&date=${currentDate.toISOString()}`
      );
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch shift statistics:", error);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  if (!calendarId) return null;

  const totalShifts = stats
    ? Object.values(stats.stats).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="border rounded-lg bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          <h3 className="text-sm sm:text-base font-semibold">
            {t("stats.title")}
          </h3>
          {!isExpanded && stats && totalShifts > 0 && (
            <span className="text-xs sm:text-sm text-muted-foreground">
              ({totalShifts} {t("stats.shiftsTotal")})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3 border-t">
          {/* Period Selector - Mobile and Desktop when expanded */}
          <div className="flex gap-2 pt-3">
            <Button
              variant={period === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("week")}
              className="flex-1 sm:flex-none"
            >
              {t("stats.week")}
            </Button>
            <Button
              variant={period === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("month")}
              className="flex-1 sm:flex-none"
            >
              {t("stats.month")}
            </Button>
            <Button
              variant={period === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("year")}
              className="flex-1 sm:flex-none"
            >
              {t("stats.year")}
            </Button>
          </div>

          {/* Stats Display */}
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("common.loading")}
            </p>
          ) : stats && Object.keys(stats.stats).length > 0 ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="font-semibold text-sm sm:text-base">
                  {t("stats.total")}
                </span>
                <span className="font-bold text-lg sm:text-xl">
                  {totalShifts}
                </span>
              </div>
              {Object.entries(stats.stats)
                .sort(([, a], [, b]) => b - a)
                .map(([title, count]) => (
                  <div
                    key={title}
                    className="flex justify-between items-center gap-3"
                  >
                    <span className="text-sm truncate flex-shrink min-w-0">
                      {title}
                    </span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <div className="w-24 sm:w-32 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${(count / totalShifts) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-semibold text-sm w-6 sm:w-8 text-right">
                        {count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t("stats.noData")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
