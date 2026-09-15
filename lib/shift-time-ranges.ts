import { db } from "@/lib/db";
import { shiftTimeSegments, presetTimeSegments } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { TimeRange } from "@/lib/time-ranges";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Replaces every extra segment for one shift (delete-then-insert), inside an existing transaction. */
export function replaceShiftSegments(tx: Tx, shiftId: string, ranges: TimeRange[]): void {
  tx.delete(shiftTimeSegments).where(eq(shiftTimeSegments.shiftId, shiftId)).run();
  if (ranges.length > 0) {
    tx.insert(shiftTimeSegments)
      .values(ranges.map((r) => ({ shiftId, startTime: r.startTime, endTime: r.endTime })))
      .run();
  }
}

/** Replaces every extra segment for one preset (delete-then-insert), inside an existing transaction. */
export function replacePresetSegments(tx: Tx, presetId: string, ranges: TimeRange[]): void {
  tx.delete(presetTimeSegments).where(eq(presetTimeSegments.presetId, presetId)).run();
  if (ranges.length > 0) {
    tx.insert(presetTimeSegments)
      .values(ranges.map((r) => ({ presetId, startTime: r.startTime, endTime: r.endTime })))
      .run();
  }
}

/** Attaches each shift's extra segments without N+1 queries. */
export async function withShiftSegments<T extends { id: string }>(
  rows: T[]
): Promise<(T & { segments: TimeRange[] })[]> {
  if (rows.length === 0) return [];

  const allSegments = await db.query.shiftTimeSegments.findMany({
    where: inArray(
      shiftTimeSegments.shiftId,
      rows.map((r) => r.id)
    ),
    orderBy: (segments, { asc }) => [asc(segments.startTime)],
  });

  const byShiftId = new Map<string, TimeRange[]>();
  for (const segment of allSegments) {
    const list = byShiftId.get(segment.shiftId) ?? [];
    list.push({ startTime: segment.startTime, endTime: segment.endTime });
    byShiftId.set(segment.shiftId, list);
  }

  return rows.map((row) => ({ ...row, segments: byShiftId.get(row.id) ?? [] }));
}

/** Attaches each preset's extra segments without N+1 queries. */
export async function withPresetSegments<T extends { id: string }>(
  rows: T[]
): Promise<(T & { segments: TimeRange[] })[]> {
  if (rows.length === 0) return [];

  const allSegments = await db.query.presetTimeSegments.findMany({
    where: inArray(
      presetTimeSegments.presetId,
      rows.map((r) => r.id)
    ),
    orderBy: (segments, { asc }) => [asc(segments.startTime)],
  });

  const byPresetId = new Map<string, TimeRange[]>();
  for (const segment of allSegments) {
    const list = byPresetId.get(segment.presetId) ?? [];
    list.push({ startTime: segment.startTime, endTime: segment.endTime });
    byPresetId.set(segment.presetId, list);
  }

  return rows.map((row) => ({ ...row, segments: byPresetId.get(row.id) ?? [] }));
}
