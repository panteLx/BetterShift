import { useState, useEffect, useCallback, useRef } from "react";
import { getCachedPassword } from "@/lib/password-cache";

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
  refreshTrigger?: number;
}

export function useShiftStats({
  calendarId,
  currentDate,
  period,
  refreshTrigger,
}: UseShiftStatsOptions) {
  const [stats, setStats] = useState<ShiftStatsData | null>(null);
  const [loading, setLoading] = useState(false);
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

  return {
    stats,
    loading,
    refetch: fetchStats,
  };
}
