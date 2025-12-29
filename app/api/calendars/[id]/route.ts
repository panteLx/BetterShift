import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendars,
  shifts,
  shiftPresets,
  calendarNotes,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import {
  canViewCalendar,
  canManageCalendar,
  canDeleteCalendar,
} from "@/lib/auth/permissions";
import {
  logUserAction,
  type CalendarUpdatedMetadata,
  type CalendarDeletedMetadata,
  type CalendarGuestPermissionChangedMetadata,
} from "@/lib/audit-log";

// GET single calendar
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check read permission (works for both authenticated users and guests)
    const hasAccess = await canViewCalendar(user?.id, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const calendarShifts = await db
      .select()
      .from(shifts)
      .where(eq(shifts.calendarId, id))
      .orderBy(shifts.date);

    return NextResponse.json({ ...calendar, shifts: calendarShifts });
  } catch (error) {
    console.error("Failed to fetch calendar:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: 500 }
    );
  }
}

// PATCH update calendar (requires admin permission)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);
    const body = await request.json();
    const { name, color, guestPermission } = body;

    // Fetch current calendar
    const [existingCalendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!existingCalendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check admin permission (works for both authenticated users and guests)
    const hasAccess = await canManageCalendar(user?.id, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Admin access required." },
        { status: 403 }
      );
    }

    const updateData: Partial<typeof calendars.$inferInsert> = {};
    const changes: string[] = [];
    let guestPermissionChanged = false;
    let oldGuestPermission: string | undefined;

    if (name && name !== existingCalendar.name) {
      updateData.name = name;
      changes.push("name");
    }
    if (color && color !== existingCalendar.color) {
      updateData.color = color;
      changes.push("color");
    }
    if (
      guestPermission !== undefined &&
      guestPermission !== existingCalendar.guestPermission
    ) {
      // Validate guest permission value
      if (["none", "read", "write"].includes(guestPermission)) {
        updateData.guestPermission = guestPermission;
        changes.push("guestPermission");
        guestPermissionChanged = true;
        oldGuestPermission = existingCalendar.guestPermission;
      }
    }

    const [calendar] = await db
      .update(calendars)
      .set(updateData)
      .where(eq(calendars.id, id))
      .returning();

    // Log calendar update event if there were actual changes
    if (user && changes.length > 0) {
      await logUserAction<CalendarUpdatedMetadata>({
        action: "calendar.updated",
        userId: user.id,
        resourceType: "calendar",
        resourceId: calendar.id,
        metadata: {
          calendarName: calendar.name,
          changes,
        },
        request,
      });

      // Log separate event for guest permission changes
      if (guestPermissionChanged) {
        await logUserAction<CalendarGuestPermissionChangedMetadata>({
          action: "calendar.guest_permission.changed",
          userId: user.id,
          resourceType: "calendar",
          resourceId: calendar.id,
          metadata: {
            calendarName: calendar.name,
            oldPermission: (oldGuestPermission || "none") as
              | "none"
              | "read"
              | "write",
            newPermission: calendar.guestPermission as
              | "none"
              | "read"
              | "write",
          },
          request,
        });
      }
    }

    return NextResponse.json(calendar);
  } catch (error) {
    console.error("Failed to update calendar:", error);
    return NextResponse.json(
      { error: "Failed to update calendar" },
      { status: 500 }
    );
  }
}

// DELETE calendar (requires owner permission)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser(request.headers);

    // Fetch calendar
    const [calendar] = await db
      .select()
      .from(calendars)
      .where(eq(calendars.id, id));

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    // Check owner permission (works for both authenticated users and guests)
    const hasAccess = await canDeleteCalendar(user?.id, id);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Insufficient permissions. Owner access required." },
        { status: 403 }
      );
    }

    // Count related records before deletion
    const [{ shiftsCount, presetsCount, notesCount }] = await db
      .select({
        shiftsCount: sql<number>`(SELECT COUNT(*) FROM ${shifts} WHERE ${shifts.calendarId} = ${calendar.id})`,
        presetsCount: sql<number>`(SELECT COUNT(*) FROM ${shiftPresets} WHERE ${shiftPresets.calendarId} = ${calendar.id})`,
        notesCount: sql<number>`(SELECT COUNT(*) FROM ${calendarNotes} WHERE ${calendarNotes.calendarId} = ${calendar.id})`,
      })
      .from(calendars)
      .where(eq(calendars.id, id));

    // Delete calendar (cascade will delete related records)
    await db.delete(calendars).where(eq(calendars.id, id));

    // Log calendar deletion event
    if (user) {
      await logUserAction<CalendarDeletedMetadata>({
        action: "calendar.deleted",
        userId: user.id,
        resourceType: "calendar",
        resourceId: calendar.id,
        metadata: {
          calendarName: calendar.name,
          shiftsDeleted: shiftsCount,
          presetsDeleted: presetsCount,
          notesDeleted: notesCount,
        },
        request,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete calendar:", error);
    return NextResponse.json(
      { error: "Failed to delete calendar" },
      { status: 500 }
    );
  }
}
