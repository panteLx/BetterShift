"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { getCachedPassword } from "@/lib/password-cache";

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
      ? Object.values(stats.stats).reduce((sum, count) => sum + count, 0)
      : 0;

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
            <div className="px-3 py-1.5 bg-primary/10 rounded-full">
              <span className="font-semibold text-primary text-xs sm:text-sm">
                {totalShifts}
              </span>
            </div>
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
            <p className="text-sm text-muted-foreground py-6 text-center">
              {t("common.loading")}
            </p>
          ) : stats && Object.keys(stats.stats).length > 0 ? (
            <div className="space-y-3.5">
              <div className="flex justify-between items-center pb-2.5 border-b border-border/50">
                <span className="font-semibold text-sm sm:text-base flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                  {t("stats.total")}
                </span>
                <span className="font-bold text-xl sm:text-2xl bg-gradient-to-r from-primary to-primary/70 bg-clip-text">
                  {totalShifts}
                </span>
              </div>
              {Object.entries(stats.stats)
                .sort(([, a], [, b]) => b - a)
                .map(([title, count]) => (
                  <div
                    key={title}
                    className="flex justify-between items-center gap-3 p-2.5 rounded-lg bg-muted/30 border border-border/30 hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm font-medium truncate flex-shrink min-w-0">
                      {title}
                    </span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <div className="w-20 sm:w-28 h-2.5 bg-muted rounded-full overflow-hidden border border-border/30">
                        <div
                          className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all shadow-sm"
                          style={{
                            width: `${(count / totalShifts) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="font-bold text-sm w-6 sm:w-8 text-right">
                        {count}
                      </span>
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
