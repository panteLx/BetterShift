"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";
import { formatDateToLocal } from "@/lib/date-utils";

export interface ShiftStatsData {
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

interface UseShiftStatsOptions {
  calendarId: string | undefined;
  currentDate: Date;
  period: "week" | "month" | "year";
}

/**
 * Fetch shift statistics from API
 */
async function fetchShiftStatsApi(
  calendarId: string,
  period: string,
  currentDate: Date
): Promise<ShiftStatsData> {
  const params = new URLSearchParams({
    calendarId,
    period,
    date: formatDateToLocal(currentDate),
  });

  const response = await fetch(`/api/shifts/stats?${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch shift statistics");
  }

  return await response.json();
}

/**
 * Shift Statistics Hook
 *
 * Provides shift statistics for a calendar with automatic polling.
 * Uses React Query for automatic cache management and live updates.
 *
 * Features:
 * - Automatic polling every 5 seconds
 * - Statistics by calendar, period, and date
 * - Manual refetch available if needed
 *
 * @param calendarId - Calendar ID to fetch stats for
 * @param currentDate - Current date for stats calculation
 * @param period - Time period (week, month, year)
 * @returns Object with stats data and loading state
 */
export function useShiftStats({
  calendarId,
  currentDate,
  period,
}: UseShiftStatsOptions) {
  const {
    data: stats = null,
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.stats.shifts(
      calendarId!,
      period,
      formatDateToLocal(currentDate)
    ),
    queryFn: () => fetchShiftStatsApi(calendarId!, period, currentDate),
    enabled: !!calendarId,
    refetchInterval: REFETCH_INTERVAL,
  });

  return {
    stats,
    loading,
    refetch,
  };
}
