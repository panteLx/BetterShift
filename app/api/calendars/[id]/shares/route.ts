import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendarShares,
  calendars,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { checkPermission } from "@/lib/auth/permissions";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    // Check if user has admin/owner permission
    const hasPermission = await checkPermission(user?.id, calendarId, "admin");
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch all shares for this calendar
    const shares = await db.query.calendarShares.findMany({
      where: eq(calendarShares.calendarId, calendarId),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sharedByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: (shares, { desc }) => [desc(shares.createdAt)],
    });

    return NextResponse.json(shares);
  } catch (error) {
    console.error("Failed to fetch calendar shares:", error);
    return NextResponse.json(
      { error: "Failed to fetch shares" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has admin/owner permission
    const hasPermission = await checkPermission(user.id, calendarId, "admin");
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId: targetUserId, permission } = body;

    // Validate permission value
    const validPermissions = ["owner", "admin", "write", "read"];
    if (!validPermissions.includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission value" },
        { status: 400 }
      );
    }

    // Only owner can grant admin permissions
    if (permission === "admin") {
      const isOwner = await checkPermission(user.id, calendarId, "owner");
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the owner can grant admin permissions" },
          { status: 403 }
        );
      }
    }

    // Check if share already exists
    const existingShare = await db.query.calendarShares.findFirst({
      where: and(
        eq(calendarShares.calendarId, calendarId),
        eq(calendarShares.userId, targetUserId)
      ),
    });

    if (existingShare) {
      return NextResponse.json(
        { error: "Calendar already shared with this user" },
        { status: 409 }
      );
    }

    // Fetch calendar name for audit log
    const calendar = await db.query.calendars.findFirst({
      where: eq(calendars.id, calendarId),
      columns: { name: true },
    });

    // Fetch target user info for audit log
    const targetUser = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, targetUserId),
      columns: { email: true, name: true },
    });

    // Check if user has an existing subscription (guest or dismissed)
    const existingSub = await db.query.userCalendarSubscriptions.findFirst({
      where: and(
        eq(userCalendarSubscriptions.userId, targetUserId),
        eq(userCalendarSubscriptions.calendarId, calendarId)
      ),
    });

    // If subscription exists, update it to "shared" source and "subscribed" status
    if (existingSub) {
      await db
        .update(userCalendarSubscriptions)
        .set({
          source: "shared",
          status: "subscribed",
        })
        .where(
          and(
            eq(userCalendarSubscriptions.userId, targetUserId),
            eq(userCalendarSubscriptions.calendarId, calendarId)
          )
        );
    } else {
      // Create new subscription entry
      await db.insert(userCalendarSubscriptions).values({
        userId: targetUserId,
        calendarId,
        source: "shared",
        status: "subscribed",
      });
    }

    // Create share
    const [newShare] = await db
      .insert(calendarShares)
      .values({
        id: crypto.randomUUID(),
        calendarId,
        userId: targetUserId,
        permission,
        sharedBy: user.id,
        createdAt: new Date(),
      })
      .returning();

    // Log audit event
    await logAuditEvent({
      userId: user.id,
      action: "calendar.shared",
      severity: "info",
      request,
      metadata: {
        calendarId,
        calendarName: calendar?.name || "Unknown",
        sharedWith: targetUser?.email || targetUser?.name || targetUserId,
        permission,
      },
    });

    // Fetch full share data with relations
    const shareWithUser = await db.query.calendarShares.findFirst({
      where: eq(calendarShares.id, newShare.id),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sharedByUser: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(shareWithUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create calendar share:", error);
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500 }
    );
  }
}
