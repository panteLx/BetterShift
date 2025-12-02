import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { icloudSyncs, shifts } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import ICAL from "ical.js";

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

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const eventId = event.uid;
      processedEventIds.add(eventId);

      const startDate = event.startDate;
      const endDate = event.endDate;

      if (!startDate || !endDate) {
        continue; // Skip events without dates
      }

      const isAllDay = event.startDate.isDate;

      // Convert ICAL.Time to JavaScript Date
      const startJsDate = startDate.toJSDate();
      const endJsDate = endDate.toJSDate();

      let startTime = "00:00";
      let endTime = "23:59";

      if (!isAllDay) {
        // Use local time as iCal.js already handles timezone conversion
        const startHours = startJsDate.getHours().toString().padStart(2, "0");
        const startMinutes = startJsDate
          .getMinutes()
          .toString()
          .padStart(2, "0");
        startTime = `${startHours}:${startMinutes}`;

        const endHours = endJsDate.getHours().toString().padStart(2, "0");
        const endMinutes = endJsDate.getMinutes().toString().padStart(2, "0");
        endTime = `${endHours}:${endMinutes}`;
      }

      // Normalize date to midnight for consistent storage
      const normalizedDate = new Date(
        startJsDate.getFullYear(),
        startJsDate.getMonth(),
        startJsDate.getDate()
      );

      const shiftData = {
        calendarId: icloudSync.calendarId,
        date: normalizedDate,
        startTime,
        endTime,
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

    // Calculate which shifts to delete before transaction
    const shiftIdsToDelete = existingShifts
      .filter((s) => s.icloudEventId && !processedEventIds.has(s.icloudEventId))
      .map((s) => s.id);

    // Perform batch operations in a transaction for atomicity and better performance
    db.transaction((tx) => {
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
    });

    return NextResponse.json({
      success: true,
      stats: {
        created: shiftsToInsert.length,
        updated: shiftsToUpdate.length,
        deleted: shiftIdsToDelete.length,
        total: vevents.length,
      },
    });
  } catch (error) {
    console.error("Error syncing iCloud calendar:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
