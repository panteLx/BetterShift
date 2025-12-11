/**
 * Converts a Date object to a local date string in YYYY-MM-DD format
 * without timezone conversion issues
 */
export function formatDateToLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculates the duration in minutes between two time strings
 * @param startTime - Time string in HH:MM format
 * @param endTime - Time string in HH:MM format
 * @returns Duration in minutes
 */
export function calculateShiftDuration(
  startTime: string,
  endTime: string
): number {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMinute;
  let endMinutes = endHour * 60 + endMinute;

  // Handle overnight shifts (end time is before start time)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }

  return endMinutes - startMinutes;
}

/**
 * Formats duration in minutes to HH:MM format
 * @param minutes - Duration in minutes
 * @returns Formatted duration string (e.g., "8:30")
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}
