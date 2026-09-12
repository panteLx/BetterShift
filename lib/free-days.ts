import { differenceInCalendarDays } from "date-fns";
import { parseLocalDate } from "@/lib/date-utils";

interface StatsWindow {
  startDate: string;
  endDate: string;
  daysWithShifts: number;
}

/** Days in the stats API's inclusive `YYYY-MM-DD` window without a stats-counted shift. */
export function countFreeDays({ startDate, endDate, daysWithShifts }: StatsWindow): number | null {
  try {
    const periodDays =
      differenceInCalendarDays(parseLocalDate(endDate), parseLocalDate(startDate)) + 1;
    if (periodDays < 1) return null;
    return Math.max(0, periodDays - daysWithShifts);
  } catch {
    return null;
  }
}
