"use client";

import { useState, useEffect, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Loader2 } from "lucide-react";
import { useShiftStats } from "@/hooks/useShiftStats";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { SegmentedControl } from "@/components/segmented-control";
import { ChoiceChips } from "@/components/form-kit";
import { formatHours } from "@/lib/shift-display";
import { countFreeDays } from "@/lib/free-days";
import { cn } from "@/lib/utils";
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

// Hook for responsive radius that's SSR-safe
function useResponsiveRadius() {
  const [radius, setRadius] = useState(120); // Safe default for SSR

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateRadius = () => {
      setRadius(window.innerWidth < 640 ? 80 : 120);
    };

    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  return radius;
}

/** Mirrors the dark-mode lightening of `.shift-rail`, which SVG fills can't inherit. */
function lightenForDark(color: string): string {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const hex =
    match[1].length === 3
      ? match[1].split("").map((c) => c + c).join("")
      : match[1];
  const mix = (i: number) =>
    Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.72 + 255 * 0.28)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(0)}${mix(2)}${mix(4)}`;
}

const tick = { fontSize: 12, fill: "var(--fg-tertiary)" };

// CustomTooltip component - declared outside to avoid recreation on each render
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
      <div className="rounded-lg border border-line bg-surface-card px-3 py-2 shadow-md">
        <p className="mb-1 text-[12.5px] font-semibold text-fg-strong">
          {payload[0].payload.fullName || payload[0].name}
        </p>
        {payload.map((entry) => (
          <p key={entry.name} className="flex items-center gap-1.5 text-[12px] text-fg-secondary">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}:{" "}
            <span className="font-mono text-fg-strong">
              {entry.value}
              {entry.name === "hours" || entry.dataKey === "hours" ? "h" : ""}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function KpiTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface-card px-3 py-2.5">
      <div className="text-[11.5px] text-fg-tertiary">{label}</div>
      <div className="mt-1 font-mono text-[21px] font-medium text-fg-strong">{value}</div>
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
  );
}

interface ShiftStatsProps {
  calendarId: string | undefined;
  currentDate: Date;
}

type ViewMode = "overview" | "pie" | "bar" | "radar";
type Period = "week" | "month" | "year";

/** Period statistics with charts; the surrounding dialog provides the frame. */
export function ShiftStats({ calendarId, currentDate }: ShiftStatsProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { resolvedTheme } = useTheme();
  const [period, setPeriod] = useState<Period>("month");
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const outerRadius = useResponsiveRadius();

  const { stats, loading } = useShiftStats({
    calendarId,
    currentDate,
    period,
  });
  const { shifts } = useShifts(calendarId);
  const { presets } = usePresets(calendarId);

  // The stats API groups by title without colors, so borrow them from loaded shifts and presets
  const colorByTitle = useMemo(() => {
    const dark = resolvedTheme === "dark";
    const known = new Map<string, string>();
    for (const shift of shifts) {
      if (!known.has(shift.title)) known.set(shift.title, shift.color);
    }
    for (const preset of presets) {
      if (!known.has(preset.title)) known.set(preset.title, preset.color);
    }
    const colors = new Map<string, string>();
    Object.keys(stats?.stats ?? {}).forEach((title, index) => {
      const color = known.get(title);
      colors.set(
        title,
        color ? (dark ? lightenForDark(color) : color) : `var(--chart-${(index % 5) + 1})`
      );
    });
    return colors;
  }, [stats, shifts, presets, resolvedTheme]);

  if (!calendarId) return null;

  const colorFor = (title: string) => colorByTitle.get(title) ?? "var(--chart-1)";
  const totalShifts = stats?.totalShifts || 0;
  const totalMinutes = stats?.totalMinutes || 0;
  const hasData = !!stats && Object.keys(stats.stats).length > 0;
  const freeDays = stats ? countFreeDays(stats) : null;

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

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        value={period}
        onChange={setPeriod}
        label={t("stats.title")}
        options={[
          { value: "week", label: t("stats.week") },
          { value: "month", label: t("stats.month") },
          { value: "year", label: t("stats.year") },
        ]}
      />

      {hasData && (
        <ChoiceChips
          value={viewMode}
          onChange={setViewMode}
          label={t("stats.title")}
          options={[
            { value: "overview", label: t("stats.overview") },
            { value: "pie", label: t("stats.distribution") },
            { value: "bar", label: t("stats.comparison") },
            { value: "radar", label: t("stats.radar") },
          ]}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-fg-tertiary" />
        </div>
      ) : stats && hasData ? (
        <>
          {viewMode === "overview" && (
            <>
              {/* Without timed shifts only four tiles remain, so keep them on one row */}
              <div
                className={cn(
                  "grid grid-cols-2 gap-2",
                  stats.maxDuration > 0 ? "sm:grid-cols-3" : "sm:grid-cols-4"
                )}
              >
                <KpiTile label={t("stats.totalShifts")} value={totalShifts} />
                <KpiTile label={t("stats.totalHours")} value={formatHours(totalMinutes, locale)} />
                <KpiTile
                  label={t("stats.avgPerShift")}
                  value={formatHours(stats.avgMinutesPerShift, locale)}
                />
                <KpiTile label={t("calendarView.kpiFreeDays")} value={freeDays ?? "–"} />
                {stats.minDuration > 0 && (
                  <KpiTile
                    label={t("stats.shortestShift")}
                    value={formatHours(stats.minDuration, locale)}
                  />
                )}
                {stats.maxDuration > 0 && (
                  <KpiTile
                    label={t("stats.longestShift")}
                    value={formatHours(stats.maxDuration, locale)}
                  />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="eyebrow">{t("stats.byType")}</div>
                {Object.entries(stats.stats)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([title, data]) => (
                    <div key={title} className="flex items-center gap-[9px]">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colorFor(title) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-fg-body">
                        {title}
                      </span>
                      <span className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-line-grid sm:w-32">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            backgroundColor: colorFor(title),
                            width: `${totalShifts ? (data.count / totalShifts) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className="w-7 shrink-0 text-right font-mono text-[12px] text-fg-strong">
                        {data.count}
                      </span>
                      <span className="w-12 shrink-0 text-right font-mono text-[12px] text-fg-tertiary">
                        {data.totalMinutes > 0 ? formatHours(data.totalMinutes, locale) : "–"}
                      </span>
                    </div>
                  ))}
              </div>
            </>
          )}

          {viewMode === "pie" && (
            <div className="flex flex-col gap-3">
              <div className="h-[300px] min-h-[300px] sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
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
                      stroke="var(--background)"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={colorFor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {pieData.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface-card px-2.5 py-2"
                  >
                    <Swatch color={colorFor(entry.name)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-fg-body">
                        {entry.name}
                      </div>
                      <div className="font-mono text-[11px] text-fg-tertiary">
                        {entry.value} × {entry.hours}h
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === "bar" && (
            <div className="flex flex-col gap-2">
              <div className="h-[350px] min-h-[350px] sm:h-[420px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={tick}
                      tickLine={false}
                      axisLine={{ stroke: "var(--line)" }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis tick={tick} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--surface-sunken)" }} />
                    <Bar
                      dataKey="shifts"
                      name={t("common.shifts")}
                      radius={[4, 4, 0, 0]}
                      animationDuration={1000}
                    >
                      {barData.map((entry) => (
                        <Cell key={entry.fullName} fill={colorFor(entry.fullName)} />
                      ))}
                    </Bar>
                    <Bar
                      dataKey="hours"
                      name={t("stats.hours")}
                      radius={[4, 4, 0, 0]}
                      animationDuration={1000}
                    >
                      {barData.map((entry) => (
                        <Cell
                          key={entry.fullName}
                          fill={colorFor(entry.fullName)}
                          fillOpacity={0.4}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Bars take each type's color, so the legend explains solid vs. faded */}
              <div className="flex items-center justify-center gap-4 text-[12px] text-fg-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-fg-secondary" />
                  {t("common.shifts")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-fg-secondary/40" />
                  {t("stats.hours")}
                </span>
              </div>
            </div>
          )}

          {viewMode === "radar" && radarData.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="h-[350px] min-h-[350px] sm:h-[420px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--line)" />
                    <PolarAngleAxis
                      dataKey="type"
                      tick={{ fontSize: 11, fill: "var(--fg-secondary)" }}
                    />
                    <PolarRadiusAxis angle={90} domain={[0, "auto"]} tick={{ ...tick, fontSize: 10 }} />
                    <Radar
                      name={t("stats.totalHours")}
                      dataKey="hours"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.45}
                      animationDuration={1000}
                    />
                    <Radar
                      name={t("stats.avgHoursPerShift")}
                      dataKey="avgHours"
                      stroke="var(--chart-2)"
                      fill="var(--chart-2)"
                      fillOpacity={0.35}
                      animationDuration={1000}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {radarData.map((entry) => (
                  <div
                    key={entry.fullName}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface-card px-2.5 py-2"
                  >
                    <Swatch color={colorFor(entry.fullName)} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-fg-body">
                        {entry.fullName}
                      </div>
                      <div className="font-mono text-[11px] text-fg-tertiary">
                        {entry.shifts} × ⌀{entry.avgHours}h
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="rounded-[10px] border border-line bg-surface-panel px-3 py-2.5 text-center text-[12px] text-fg-secondary">
                {t("stats.radarDescription")}
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="py-10 text-center text-[13px] text-fg-tertiary">{t("stats.noData")}</p>
      )}
    </div>
  );
}
