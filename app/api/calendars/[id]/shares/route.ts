import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendarShares,
  calendars,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { getCalendarAccess, hasCapability } from "@/lib/auth/permissions";
import {
  assertBundleWithinCallerCapabilities,
  getBundleForCalendar,
  handleBundleServiceError,
} from "@/lib/auth/permission-bundles-service";
import { eq, and } from "drizzle-orm";
import { logAuditEvent, type CalendarSharedMetadata } from "@/lib/audit-log";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    // Check if user has admin/owner permission
    const hasPermission = await hasCapability(
      user?.id,
      calendarId,
      "manageShares"
    );
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
        bundle: {
          columns: {
            id: true,
            name: true,
            seedKey: true,
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
    const access = await getCalendarAccess(user.id, calendarId);
    if (!access?.can("manageShares")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId: targetUserId, bundleId } = body;

    // Validate target user id
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "Invalid user id" },
        { status: 400 }
      );
    }

    // Validate the bundle: must exist and belong to this calendar.
    if (!bundleId || typeof bundleId !== "string") {
      return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
    }
    const bundle = await getBundleForCalendar(calendarId, bundleId);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    // A non-owner manageShares holder may only grant a bundle whose
    // capabilities are a subset of their own — closes the self-escalation
    // path a fixed cap used to guard against pre-PR.
    assertBundleWithinCallerCapabilities(access, bundle.capabilities);

    // Ensure the target user actually exists
    const targetUserExists = await db.query.user.findFirst({
      where: (users, { eq }) => eq(users.id, targetUserId),
      columns: { id: true },
    });
    if (!targetUserExists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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
        bundleId: bundle.id,
        sharedBy: user.id,
        createdAt: new Date(),
      })
      .returning();

    // Log audit event
    await logAuditEvent<CalendarSharedMetadata>({
      userId: user.id,
      action: "calendar.shared",
      resourceType: "calendar",
      resourceId: calendarId,
      severity: "info",
      request,
      metadata: {
        calendarName: calendar?.name || "Unknown",
        sharedWith: targetUser?.email || targetUser?.name || targetUserId,
        bundleId: bundle.id,
        bundleName: bundle.name,
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
        bundle: {
          columns: { id: true, name: true, seedKey: true },
        },
      },
    });

    return NextResponse.json(shareWithUser, { status: 201 });
  } catch (error) {
    return handleBundleServiceError(error, "Failed to create share");
  }
}
