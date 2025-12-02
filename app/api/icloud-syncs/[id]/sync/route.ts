import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { icloudSyncs, shifts } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import ICAL from "ical.js";
import { expandRecurringEvents, splitMultiDayEvent } from "@/lib/icloud-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: syncId } = await params;

    // Get the iCloud sync configuration
    const [icloudSync] = await db
      .select()
      .from(icloudSyncs)
      .where(eq(icloudSyncs.id, syncId))
      .limit(1);

    if (!icloudSync) {
      return NextResponse.json(
        { error: "iCloud sync configuration not found" },
        { status: 404 }
      );
    }

    // Convert webcal:// to https:// for iCloud URLs
    const fetchUrl = icloudSync.icloudUrl.replace(/^webcal:\/\//i, "https://");

    // Fetch the calendar from the specified iCloud URL
    let icsData: string;
    try {
      const response = await fetch(fetchUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.statusText}`);
      }
      icsData = await response.text();
    } catch (error) {
      console.error("Error fetching iCloud calendar:", error);
      return NextResponse.json(
        { error: "Failed to fetch iCloud calendar. Please check the URL." },
        { status: 500 }
      );
    }

    // Parse the ICS data
    let jcalData;
    try {
      jcalData = ICAL.parse(icsData);
    } catch (error) {
      console.error("Error parsing ICS data:", error);
      return NextResponse.json(
        { error: "Failed to parse calendar data. Invalid ICS format." },
        { status: 500 }
      );
    }

    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    // Define sync window: 3 months back to 1 year forward
    const syncWindowStart = new Date();
    syncWindowStart.setMonth(syncWindowStart.getMonth() - 3);
    const syncWindowEnd = new Date();
    syncWindowEnd.setFullYear(syncWindowEnd.getFullYear() + 1);

    // Get existing iCloud synced shifts for this sync
    const existingShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.icloudSyncId, syncId));

    const existingEventIds = new Set(
      existingShifts
        .filter((s) => s.icloudEventId)
        .map((s) => s.icloudEventId as string)
    );

    const processedEventIds = new Set<string>();
    const shiftsToInsert: (typeof shifts.$inferInsert)[] = [];
    const shiftsToUpdate: Array<typeof shifts.$inferInsert & { id: string }> =
      [];

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
            calendarId: icloudSync.calendarId,
            date: dayEntry.date,
            startTime: dayEntry.startTime,
            endTime: dayEntry.endTime,
            title: event.summary || "Untitled Event",
            color: icloudSync.color,
            notes: event.description || null,
            isAllDay,
            isSecondary: false,
            icloudEventId: eventId,
            icloudSyncId: syncId,
            syncedFromIcloud: true,
            presetId: null,
          };

          // Check if this event already exists
          const existingShift = existingShifts.find(
            (s) => s.icloudEventId === eventId
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
      .filter((s) => s.icloudEventId && !processedEventIds.has(s.icloudEventId))
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

      // Delete shifts that are no longer in the iCloud calendar in one batch
      if (shiftIdsToDelete.length > 0) {
        tx.delete(shifts).where(inArray(shifts.id, shiftIdsToDelete)).run();
      }

      // Update last sync time
      tx.update(icloudSyncs)
        .set({
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(icloudSyncs.id, syncId))
        .run();

      // Return transaction stats
      return {
        created: shiftsToInsert.length,
        updated: shiftsToUpdate.length,
        deleted: shiftIdsToDelete.length,
        totalEvents: vevents.length,
        totalOccurrences: shiftsToInsert.length + shiftsToUpdate.length,
      };
    });

    return NextResponse.json({
      success: true,
      stats: transactionResult,
    });
  } catch (error) {
    console.error("Error syncing iCloud calendar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
