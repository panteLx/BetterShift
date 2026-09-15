import { calculateShiftDuration } from "@/lib/date-utils";

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export type TimeRangeError = "invalid_format" | "overnight_segment" | "overlap";

const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Reassembles the primary range plus any extra segments into one ordered-by-input list. */
export function toTimeRanges(entity: {
  startTime: string;
  endTime: string;
  segments?: TimeRange[];
}): TimeRange[] {
  return [
    { startTime: entity.startTime, endTime: entity.endTime },
    ...(entity.segments ?? []),
  ];
}

/**
 * Validates a full list of ranges for a shift/preset. A single range is
 * always valid here (including one that crosses midnight — unchanged
 * existing behavior); chronological order, non-overlap and same-day-only
 * are enforced only once there is more than one range.
 */
export function validateTimeRanges(ranges: TimeRange[]): TimeRangeError | null {
  for (const range of ranges) {
    if (!TIME_PATTERN.test(range.startTime) || !TIME_PATTERN.test(range.endTime)) {
      return "invalid_format";
    }
  }

  if (ranges.length <= 1) return null;

  for (const range of ranges) {
    if (toMinutes(range.endTime) <= toMinutes(range.startTime)) {
      return "overnight_segment";
    }
  }

  const sorted = [...ranges].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) {
      return "overlap";
    }
  }

  return null;
}

/** Total duration across all ranges, in minutes. */
export function sumRangeDurations(ranges: TimeRange[]): number {
  return ranges.reduce(
    (total, range) => total + calculateShiftDuration(range.startTime, range.endTime),
    0
  );
}

/**
 * Sorts a validated range list chronologically and splits it back into a
 * primary range plus segments, so the persisted primary is always the
 * earliest range regardless of the order ranges were submitted in.
 */
export function normalizeTimeRanges(
  ranges: TimeRange[]
): { startTime: string; endTime: string; segments: TimeRange[] } {
  const sorted = [...ranges].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
  const [primary, ...rest] = sorted;
  return { startTime: primary.startTime, endTime: primary.endTime, segments: rest };
}

/**
 * Seeds a new segment's time range starting 2h after the latest range's end,
 * so "add time range" never collides with the form's own current ranges.
 * Falls back to a fixed late-evening slot when there's no room left before midnight.
 */
export function suggestNextTimeRange(ranges: TimeRange[]): TimeRange {
  const FALLBACK: TimeRange = { startTime: "22:00", endTime: "23:59" };
  const END_OF_DAY = 24 * 60 - 1; // 23:59
  const GAP_MINUTES = 120;

  const toTime = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

  const lastEnd = ranges.reduce((max, r) => Math.max(max, toMinutes(r.endTime)), 0);
  const start = lastEnd + GAP_MINUTES;
  if (start >= END_OF_DAY) return FALLBACK;

  const end = Math.min(start + GAP_MINUTES, END_OF_DAY);
  return { startTime: toTime(start), endTime: toTime(end) };
}
