"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  PieChart,
  Radar as RadarIcon,
} from "lucide-react";
import { getCachedPassword } from "@/lib/password-cache";
import { formatDuration } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";

// Hook for responsive radius that's SSR-safe
function useResponsiveRadius() {
  const [radius, setRadius] = useState(120); // Safe default for SSR

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateRadius = () => {
      setRadius(window.innerWidth < 640 ? 80 : 120);
    };

    // Set initial value
    updateRadius();

    // Add resize listener
    window.addEventListener("resize", updateRadius);

    // Cleanup
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  return radius;
}

import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

interface ShiftStats {
  period: string;
  startDate: string;
  endDate: string;
  stats: Record<string, { count: number; totalMinutes: number }>;
  totalMinutes: number;
  totalShifts: number;
  avgMinutesPerShift: number;
  avgShiftsPerDay: number;
  avgMinutesPerDay: number;
  minDuration: number;
  maxDuration: number;
  daysWithShifts: number;
  trendData: Array<{ date: string; count: number; totalMinutes: number }>;
}

interface ShiftStatsProps {
  calendarId: string | undefined;
  currentDate: Date;
  refreshTrigger?: number;
}

type ViewMode = "overview" | "pie" | "bar" | "radar";

const CHART_COLORS = [
  "#3b82f6", // primary blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // green
  "#06b6d4", // cyan
  "#f97316", // orange
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#a855f7", // violet
  "#ef4444", // red
  "#22c55e", // lime
];

export function ShiftStats({
  calendarId,
  currentDate,
  refreshTrigger,
}: ShiftStatsProps) {
  const t = useTranslations();
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const isInitialLoadRef = useRef(true);
  const outerRadius = useResponsiveRadius();

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

  const totalShifts = stats?.totalShifts || 0;
  const totalMinutes = stats?.totalMinutes || 0;

  // Prepare data for charts
  const pieData = stats
    ? Object.entries(stats.stats).map(([title, data]) => ({
        name: title,
        value: data.count,
        hours: Math.round((data.totalMinutes / 60) * 10) / 10,
      }))
    : [];

  const barData = stats
    ? Object.entries(stats.stats)
        .map(([title, data]) => ({
          name: title.length > 15 ? title.substring(0, 15) + "..." : title,
          fullName: title,
          shifts: data.count,
          hours: Math.round((data.totalMinutes / 60) * 10) / 10,
        }))
        .sort((a, b) => b.shifts - a.shifts)
    : [];

  // Prepare data for radar chart (top shift types by hours)
  const radarData = stats
    ? Object.entries(stats.stats)
        .sort(([, a], [, b]) => b.totalMinutes - a.totalMinutes)
        .slice(0, 6) // Top 6 shift types
        .map(([title, data]) => ({
          type: title.length > 12 ? title.substring(0, 12) + "..." : title,
          fullName: title,
          hours: Math.round((data.totalMinutes / 60) * 10) / 10,
          shifts: data.count,
          avgHours: data.count
            ? Math.round((data.totalMinutes / data.count / 60) * 10) / 10
            : 0,
        }))
    : [];

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{
      name: string;
      value: number;
      color: string;
      dataKey?: string;
      payload: { fullName?: string; name?: string };
    }>;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">
            {payload[0].payload.fullName || payload[0].name}
          </p>
          {payload.map((entry) => (
            <p key={entry.name} className="text-xs text-muted-foreground">
              <span style={{ color: entry.color }}>{entry.name}:</span>{" "}
              {entry.value}
              {entry.name === "hours" || entry.dataKey === "hours" ? "h" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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
          {/* Period Selector */}
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

          {/* View Mode Selector */}
          {stats && Object.keys(stats.stats).length > 0 && (
            <div className="grid grid-cols-2 sm:flex gap-2">
              <Button
                variant={viewMode === "overview" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("overview")}
                className="sm:flex-none h-8 text-xs transition-all"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                {t("stats.overview")}
              </Button>
              <Button
                variant={viewMode === "pie" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("pie")}
                className="sm:flex-none h-8 text-xs transition-all"
              >
                <PieChart className="h-3.5 w-3.5 mr-1.5" />
                {t("stats.distribution")}
              </Button>
              <Button
                variant={viewMode === "bar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("bar")}
                className="sm:flex-none h-8 text-xs transition-all"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
                {t("stats.comparison")}
              </Button>
              <Button
                variant={viewMode === "radar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("radar")}
                className="sm:flex-none h-8 text-xs transition-all"
              >
                <RadarIcon className="h-3.5 w-3.5 mr-1.5" />
                {t("stats.radar")}
              </Button>
            </div>
          )}

          {/* Stats Display */}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          ) : stats && Object.keys(stats.stats).length > 0 ? (
            <div className="space-y-3.5">
              {/* Overview Mode - Enhanced Cards */}
              {viewMode === "overview" && (
                <>
                  {/* Summary Statistics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                      <div className="text-[10px] text-muted-foreground font-medium mb-1">
                        {t("stats.totalShifts")}
                      </div>
                      <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        {totalShifts}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                      <div className="text-[10px] text-muted-foreground font-medium mb-1">
                        {t("stats.totalHours")}
                      </div>
                      <div className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                        {formatDuration(totalMinutes)}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-gradient-to-br from-card via-card/80 to-card/60 border border-border/40">
                      <div className="text-[10px] text-muted-foreground font-medium mb-1">
                        {t("stats.avgPerShift")}
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {formatDuration(stats.avgMinutesPerShift)}
                      </div>
                    </div>
                  </div>

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    {stats.minDuration > 0 && (
                      <div className="p-3 rounded-lg bg-gradient-to-br from-card via-card/80 to-card/60 border border-border/40">
                        <div className="text-[10px] text-muted-foreground font-medium mb-1">
                          {t("stats.shortestShift")}
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {formatDuration(stats.minDuration)}
                        </div>
                      </div>
                    )}
                    {stats.maxDuration > 0 && (
                      <div className="p-3 rounded-lg bg-gradient-to-br from-card via-card/80 to-card/60 border border-border/40">
                        <div className="text-[10px] text-muted-foreground font-medium mb-1">
                          {t("stats.longestShift")}
                        </div>
                        <div className="text-lg font-bold text-foreground">
                          {formatDuration(stats.maxDuration)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Individual Shift Types List */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t("stats.byType")}
                    </h4>
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
                              <div className="w-24 sm:w-32 h-2 bg-muted/50 rounded-full overflow-hidden border border-border/20 shadow-inner">
                                <div
                                  className="h-full bg-gradient-to-r from-primary via-primary/90 to-primary/80 transition-all duration-300 shadow-sm"
                                  style={{
                                    width: `${
                                      (data.count / totalShifts) * 100
                                    }%`,
                                  }}
                                />
                              </div>
                              <div className="min-w-[2.5rem] px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                                <span className="font-bold text-sm text-primary text-center block">
                                  {data.count}
                                </span>
                              </div>
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
                </>
              )}

              {/* Pie Chart Mode */}
              {viewMode === "pie" && (
                <div className="space-y-3">
                  <div className="h-[300px] sm:h-[400px] min-h-[300px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minHeight={300}
                    >
                      <RechartsPieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) =>
                            `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`
                          }
                          outerRadius={outerRadius}
                          fill="#8884d8"
                          dataKey="value"
                          animationBegin={0}
                          animationDuration={800}
                        >
                          {pieData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {pieData.map((entry, index) => (
                      <div
                        key={entry.name}
                        className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border/30 hover:bg-card/70 hover:border-primary/30 transition-all"
                      >
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor:
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {entry.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {entry.value} × {entry.hours}h
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bar Chart Mode */}
              {viewMode === "bar" && (
                <div className="h-[350px] sm:h-[450px] min-h-[350px]">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minHeight={350}
                  >
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar
                        dataKey="shifts"
                        fill={CHART_COLORS[0]}
                        name={t("common.shifts")}
                        radius={[4, 4, 0, 0]}
                        animationDuration={1000}
                      />
                      <Bar
                        dataKey="hours"
                        fill={CHART_COLORS[1]}
                        name={t("stats.hours")}
                        radius={[4, 4, 0, 0]}
                        animationDuration={1000}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Radar Chart - Performance metrics for top shift types */}
              {viewMode === "radar" && radarData.length > 0 && (
                <div className="space-y-3">
                  <div className="h-[350px] sm:h-[450px] min-h-[350px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minHeight={350}
                    >
                      <RadarChart data={radarData}>
                        <PolarGrid stroke={CHART_COLORS[0]} opacity={0.2} />
                        <PolarAngleAxis
                          dataKey="type"
                          tick={{ fontSize: 11, fill: "currentColor" }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, "auto"]}
                          tick={{ fontSize: 10 }}
                        />
                        <Radar
                          name={t("stats.totalHours")}
                          dataKey="hours"
                          stroke={CHART_COLORS[0]}
                          fill={CHART_COLORS[0]}
                          fillOpacity={0.6}
                          animationDuration={1000}
                        />
                        <Radar
                          name={t("stats.avgHoursPerShift")}
                          dataKey="avgHours"
                          stroke={CHART_COLORS[2]}
                          fill={CHART_COLORS[2]}
                          fillOpacity={0.4}
                          animationDuration={1000}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {radarData.map((entry) => (
                      <div
                        key={entry.fullName}
                        className="flex items-center gap-2 p-2 rounded-lg bg-card/50 border border-border/30"
                      >
                        <div
                          className="w-3 h-3 rounded-sm flex-shrink-0"
                          style={{
                            backgroundColor: CHART_COLORS[0],
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {entry.fullName}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {entry.shifts} × ⌀{entry.avgHours}h
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-xs text-muted-foreground text-center">
                      {t("stats.radarDescription")}
                    </p>
                  </div>
                </div>
              )}
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
