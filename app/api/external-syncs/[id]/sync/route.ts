import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { externalSyncs, shifts } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import ICAL from "ical.js";
import {
  expandRecurringEvents,
  splitMultiDayEvent,
} from "@/lib/external-calendar-utils";

/**
 * Core sync logic extracted for reuse by both API route and auto-sync service
 */
export async function syncExternalCalendar(syncId: string) {
  // Get the external sync configuration
  const [externalSync] = await db
    .select()
    .from(externalSyncs)
    .where(eq(externalSyncs.id, syncId))
    .limit(1);

  if (!externalSync) {
    throw new Error("External sync configuration not found");
  }

  // Convert webcal:// to https:// for calendar URLs
  const fetchUrl = externalSync.calendarUrl.replace(
    /^webcal:\/\//i,
    "https://"
  );

  // Fetch the calendar from the specified URL with timeout protection
  let icsData: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
      }
      icsData = await response.text();
    } catch (fetchError) {
      clearTimeout(timeoutId);

      // Check if this was a timeout/abort error
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        throw new Error(
          "Request timed out after 10 seconds. Please try again."
        );
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Error fetching external calendar:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to fetch external calendar. Please check the URL."
    );
  }

  // Parse the ICS data
  let jcalData;
  try {
    jcalData = ICAL.parse(icsData);
  } catch (error) {
    console.error("Error parsing ICS data:", error);
    throw new Error("Failed to parse calendar data. Invalid ICS format.");
  }

  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  // Define sync window: 3 months back to 1 year forward
  const syncWindowStart = new Date();
  syncWindowStart.setMonth(syncWindowStart.getMonth() - 3);
  const syncWindowEnd = new Date();
  syncWindowEnd.setFullYear(syncWindowEnd.getFullYear() + 1);

  // Get existing synced shifts for this sync
  const existingShifts = await db
    .select()
    .from(shifts)
    .where(eq(shifts.externalSyncId, syncId));

  const processedEventIds = new Set<string>();
  const shiftsToInsert: (typeof shifts.$inferInsert)[] = [];
  const shiftsToUpdate: Array<typeof shifts.$inferInsert & { id: string }> = [];

  // Process each vevent, expanding recurring events
  for (const vevent of vevents) {
    const occurrences = expandRecurringEvents(
      vevent,
      syncWindowStart,
      syncWindowEnd
    );

    for (const occurrence of occurrences) {
      const { event, startDate, endDate, recurrenceId } = occurrence;

      // Create a unique ID for each occurrence
      // For recurring events, append the recurrence date to make it unique
      const baseEventId = recurrenceId
        ? `${event.uid}_${recurrenceId.toICALString()}`
        : event.uid;

      if (!startDate || !endDate) {
        continue; // Skip events without dates
      }

      const isAllDay = startDate.isDate;

      // Convert ICAL.Time to JavaScript Date
      const startJsDate = startDate.toJSDate();
      const endJsDate = endDate.toJSDate();

      // Split multi-day events into separate shifts for each day
      const dayEntries = splitMultiDayEvent(startJsDate, endJsDate, isAllDay);

      for (const dayEntry of dayEntries) {
        // Create unique event ID for multi-day events by appending day index
        const eventId =
          dayEntries.length > 1
            ? `${baseEventId}_day${dayEntry.dayIndex}`
            : baseEventId;

        processedEventIds.add(eventId);

        const shiftData = {
          calendarId: externalSync.calendarId,
          date: dayEntry.date,
          startTime: dayEntry.startTime,
          endTime: dayEntry.endTime,
          title: event.summary || "Untitled Event",
          color: externalSync.color,
          notes: event.description || null,
          isAllDay,
          isSecondary: false,
          externalEventId: eventId,
          externalSyncId: syncId,
          syncedFromExternal: true,
          presetId: null,
        };

        // Check if this event already exists
        const existingShift = existingShifts.find(
          (s) => s.externalEventId === eventId
        );

        if (existingShift) {
          // Collect for batch update
          shiftsToUpdate.push({
            id: existingShift.id,
            ...shiftData,
            updatedAt: new Date(),
          });
        } else {
          // Collect for batch insert
          shiftsToInsert.push({
            id: crypto.randomUUID(),
            ...shiftData,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }
  }

  // Calculate which shifts to delete before transaction
  const shiftIdsToDelete = existingShifts
    .filter(
      (s) => s.externalEventId && !processedEventIds.has(s.externalEventId)
    )
    .map((s) => s.id);

  // Perform batch operations in a transaction for atomicity and better performance
  const transactionResult = db.transaction((tx) => {
    // Insert new shifts in one batch
    if (shiftsToInsert.length > 0) {
      tx.insert(shifts).values(shiftsToInsert).run();
    }

    // Update existing shifts (SQLite doesn't support batch updates directly,
    // but doing them in a transaction improves performance)
    if (shiftsToUpdate.length > 0) {
      for (const shiftUpdate of shiftsToUpdate) {
        const { id, ...updateData } = shiftUpdate;
        tx.update(shifts).set(updateData).where(eq(shifts.id, id)).run();
      }
    }

    // Delete shifts that are no longer in the external calendar in one batch
    if (shiftIdsToDelete.length > 0) {
      tx.delete(shifts).where(inArray(shifts.id, shiftIdsToDelete)).run();
    }

    // Update last sync time
    tx.update(externalSyncs)
      .set({
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(externalSyncs.id, syncId))
      .run();

    // Return transaction stats
    return {
      created: shiftsToInsert.length,
      updated: shiftsToUpdate.length,
      deleted: shiftIdsToDelete.length,
      totalEvents: vevents.length,
      totalOccurrences: shiftsToInsert.length + shiftsToUpdate.length,
      calendarId: externalSync.calendarId,
      syncType: externalSync.syncType,
    };
  });

  return transactionResult;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: syncId } = await params;
    const stats = await syncExternalCalendar(syncId);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("Error syncing external calendar:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
