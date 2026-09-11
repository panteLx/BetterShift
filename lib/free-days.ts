const DAY_MS = 24 * 60 * 60 * 1000;

interface StatsWindow {
  startDate: string;
  endDate: string;
  daysWithShifts: number;
}

/**
 * Days in the stats API's window without a stats-counted shift. `startDate`/`endDate` are
 * ISO instants of the server-local period bounds, so only their distance is used, never a calendar date.
 */
export function countFreeDays({ startDate, endDate, daysWithShifts }: StatsWindow): number | null {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  // The end is inclusive (23:59:59.999); rounding also absorbs 23h/25h DST days.
  const periodDays = Math.round((end - start) / DAY_MS);
  return Math.max(0, periodDays - daysWithShifts);
}
