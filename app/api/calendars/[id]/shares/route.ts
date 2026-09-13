import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  calendarShares,
  calendars,
  userCalendarSubscriptions,
} from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability, isCalendarOwner } from "@/lib/auth/permissions";
import {
  coarseLevelFromCapabilities,
  findSeededBundleId,
} from "@/lib/auth/legacy-permission-compat";
import { sanitizeCapabilities } from "@/lib/permission-bundles";
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
            capabilities: true,
          },
        },
      },
      orderBy: (shares, { desc }) => [desc(shares.createdAt)],
    });

    const sharesWithPermission = shares.map(({ bundle, ...share }) => ({
      ...share,
      permission: coarseLevelFromCapabilities(
        sanitizeCapabilities(bundle.capabilities)
      ),
    }));

    return NextResponse.json(sharesWithPermission);
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
    const hasPermission = await hasCapability(
      user.id,
      calendarId,
      "manageShares"
    );
    if (!hasPermission) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId: targetUserId, permission } = body;

    // Validate target user id
    if (!targetUserId || typeof targetUserId !== "string") {
      return NextResponse.json(
        { error: "Invalid user id" },
        { status: 400 }
      );
    }

    // Validate permission value. "owner" is intentionally excluded — ownership
    // transfer is not a share concept and only happens through admin routes.
    const validPermissions = ["admin", "write", "read"];
    if (!validPermissions.includes(permission)) {
      return NextResponse.json(
        { error: "Invalid permission value" },
        { status: 400 }
      );
    }

    // Only owner can grant admin permissions
    if (permission === "admin") {
      const isOwner = await isCalendarOwner(user.id, calendarId);
      if (!isOwner) {
        return NextResponse.json(
          { error: "Only the owner can grant admin permissions" },
          { status: 403 }
        );
      }
    }

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

    // Resolve the legacy enum value to this calendar's matching seeded bundle
    const bundleId = await findSeededBundleId(calendarId, permission);
    if (!bundleId) {
      return NextResponse.json(
        { error: "Calendar is missing its seeded permission bundles" },
        { status: 500 }
      );
    }

    // Create share
    const [newShare] = await db
      .insert(calendarShares)
      .values({
        id: crypto.randomUUID(),
        calendarId,
        userId: targetUserId,
        bundleId,
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

    return NextResponse.json(
      { ...shareWithUser, permission },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create calendar share:", error);
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500 }
    );
  }
}
