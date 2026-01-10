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
 * Parses a YYYY-MM-DD date string as a local date (NOT UTC!)
 * This fixes the timezone bug where "2025-01-15" was interpreted as UTC midnight
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object representing local midnight on that date
 * @throws TypeError if dateString is not a valid YYYY-MM-DD format or represents an invalid date
 * @example
 * parseLocalDate("2025-01-15") // → Wed Jan 15 2025 00:00:00 (local timezone)
 * new Date("2025-01-15")       // → Tue Jan 14 2025 19:00:00 (UTC-5, WRONG!)
 */
export function parseLocalDate(dateString: string): Date {
  // 1. Ensure dateString is a non-empty string
  if (typeof dateString !== "string" || dateString.trim() === "") {
    throw new TypeError("Invalid date format: expected non-empty string");
  }

  // 2. Match strict YYYY-MM-DD pattern
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateString)) {
    throw new TypeError(
      `Invalid date format: expected YYYY-MM-DD, got "${dateString}"`
    );
  }

  // 3. Parse year/month/day as numbers
  const [year, month, day] = dateString.split("-").map(Number);

  // 4. Validate month is 1-12
  if (month < 1 || month > 12) {
    throw new TypeError(
      `Invalid date: month must be 1-12, got ${month} in "${dateString}"`
    );
  }

  // 5. Validate day is within valid range for that month (account for leap years)
  const daysInMonth = [
    31, // January
    isLeapYear(year) ? 29 : 28, // February
    31, // March
    30, // April
    31, // May
    30, // June
    31, // July
    31, // August
    30, // September
    31, // October
    30, // November
    31, // December
  ];

  const maxDay = daysInMonth[month - 1];
  if (day < 1 || day > maxDay) {
    throw new TypeError(
      `Invalid date: day must be 1-${maxDay} for month ${month}, got ${day} in "${dateString}"`
    );
  }

  // 6. Construct the Date and verify it's not NaN
  // month is 0-indexed in Date constructor
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) {
    throw new TypeError(`Invalid date: could not parse "${dateString}"`);
  }

  return date;
}

/**
 * Checks if a year is a leap year
 * @param year - The year to check
 * @returns true if the year is a leap year
 */
function isLeapYear(year: number): boolean {
  // A year is a leap year if:
  // - It's divisible by 4 AND
  // - Either not divisible by 100 OR divisible by 400
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
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
  // Validate time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
    console.error(
      `Invalid time format: startTime="${startTime}", endTime="${endTime}"`
    );
    return 0; // Return 0 for invalid formats
  }

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);

  // Additional validation for NaN values
  if (
    isNaN(startHour) ||
    isNaN(startMinute) ||
    isNaN(endHour) ||
    isNaN(endMinute)
  ) {
    console.error(
      `Invalid time values: startTime="${startTime}", endTime="${endTime}"`
    );
    return 0;
  }

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
 * @param minutes - Duration in minutes (must be non-negative)
 * @returns Formatted duration string (e.g., "8:30")
 */
export function formatDuration(minutes: number): string {
  // Handle negative values or invalid inputs
  if (minutes < 0 || isNaN(minutes)) {
    console.error(`Invalid duration: ${minutes} minutes`);
    return "0:00";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

/**
 * Gets the server timezone from environment variable or system default
 * Works in both Docker and non-Docker environments
 * @returns Timezone string (e.g., "Europe/Berlin", "America/New_York")
 */
export function getServerTimezone(): string {
  // Try to get from environment variable first (Docker or manual config)
  const envTimezone = process.env.TZ;
  if (envTimezone) {
    return envTimezone;
  }

  // Fallback: Try to detect system timezone
  // This works by checking the resolved timezone from Date
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      return timezone;
    }
  } catch (error) {
    console.warn("Could not detect system timezone:", error);
  }

  // Last fallback: UTC
  return "UTC";
}
