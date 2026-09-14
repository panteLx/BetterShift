import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarAccessTokens, calendars } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { getCalendarAccess, hasCapability } from "@/lib/auth/permissions";
import {
  assertBundleWithinCallerCapabilities,
  handleBundleServiceError,
  resolveGuestEligibleBundle,
} from "@/lib/auth/permission-bundles-service";
import { logAuditEvent } from "@/lib/audit-log";

/**
 * PATCH /api/calendars/[id]/tokens/[tokenId]
 * Update an access token
 * Only owner/admin can update tokens
 * Cannot change the token itself
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tokenId: string }> }
) {
  try {
    const { id: calendarId, tokenId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check permissions
    const access = await getCalendarAccess(user.id, calendarId);

    if (!access?.can("manageGuestAccess")) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get existing token
    const [existingToken] = await db
      .select()
      .from(calendarAccessTokens)
      .where(
        and(
          eq(calendarAccessTokens.id, tokenId),
          eq(calendarAccessTokens.calendarId, calendarId)
        )
      )
      .limit(1);

    if (!existingToken) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      bundleId,
      expiresAt,
      isActive,
    }: {
      name?: string;
      bundleId?: string;
      expiresAt?: string | null;
      isActive?: boolean;
    } = body;

    // Validate the new bundle if provided: must exist, belong to this
    // calendar, and be guest-eligible (E7) — a link is always a guest/link source.
    let newBundle: Awaited<ReturnType<typeof resolveGuestEligibleBundle>> | null =
      null;
    if (bundleId !== undefined) {
      if (typeof bundleId !== "string") {
        return NextResponse.json(
          { error: "Invalid bundle id" },
          { status: 400 }
        );
      }
      newBundle = await resolveGuestEligibleBundle(
        calendarId,
        bundleId,
        "Bundle contains capabilities that cannot be granted via a link"
      );
      if (newBundle instanceof NextResponse) return newBundle;
      // A non-owner manageGuestAccess holder may only assign a bundle whose
      // capabilities are a subset of their own — closes the self-escalation
      // path a fixed cap used to guard against pre-PR.
      assertBundleWithinCallerCapabilities(access, newBundle.capabilities);
    }

    // Validate expiration date if provided
    let expiresAtDate: Date | null | undefined = undefined;
    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        expiresAtDate = null; // Remove expiration
      } else {
        expiresAtDate = new Date(expiresAt);
        if (isNaN(expiresAtDate.getTime())) {
          return NextResponse.json(
            { error: "Invalid expiration date" },
            { status: 400 }
          );
        }
        if (expiresAtDate <= new Date()) {
          return NextResponse.json(
            { error: "Expiration date must be in the future" },
            { status: 400 }
          );
        }
      }
    }

    // Build update object
    const updates: Partial<typeof calendarAccessTokens.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (newBundle) updates.bundleId = newBundle.id;
    if (expiresAtDate !== undefined) updates.expiresAt = expiresAtDate;
    if (isActive !== undefined) updates.isActive = isActive;

    // Update token
    const [updatedToken] = await db
      .update(calendarAccessTokens)
      .set(updates)
      .where(eq(calendarAccessTokens.id, tokenId))
      .returning();

    // Get calendar name for audit log
    const [calendar] = await db
      .select({ name: calendars.name })
      .from(calendars)
      .where(eq(calendars.id, calendarId))
      .limit(1);

    // Audit log
    void logAuditEvent({
      userId: user.id,
      action: "calendar_token_updated",
      resourceType: "calendar",
      resourceId: calendarId,
      metadata: {
        tokenId,
        tokenName: updatedToken.name || "Unnamed",
        calendarName: calendar?.name || "Unknown",
        changes: updates,
      },
      request,
      severity: "info",
      isUserVisible: true,
    });

    // Resolve the token's bundle identity for the response — reuse the
    // already-validated bundle instead of re-fetching it when it was part
    // of this request.
    const updatedBundle = newBundle
      ? { id: newBundle.id, name: newBundle.name, seedKey: newBundle.seedKey }
      : await db.query.calendarPermissionBundles.findFirst({
          where: (b, { eq: eqOp }) => eqOp(b.id, updatedToken.bundleId),
          columns: { id: true, name: true, seedKey: true },
        });

    // Return sanitized token (no full token)
    return NextResponse.json({
      ...updatedToken,
      bundle: updatedBundle ?? null,
      tokenPreview: `${updatedToken.token.slice(0, 6)}...`,
      token: undefined,
    });
  } catch (error) {
    return handleBundleServiceError(error, "Failed to update access token");
  }
}

/**
 * DELETE /api/calendars/[id]/tokens/[tokenId]
 * Delete (revoke) an access token
 * Only owner/admin can delete tokens
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; tokenId: string }> }
) {
  try {
    const { id: calendarId, tokenId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Check permissions
    const canManage = await hasCapability(
      user.id,
      calendarId,
      "manageGuestAccess"
    );

    if (!canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get token details before deletion
    const [token] = await db
      .select()
      .from(calendarAccessTokens)
      .where(
        and(
          eq(calendarAccessTokens.id, tokenId),
          eq(calendarAccessTokens.calendarId, calendarId)
        )
      )
      .limit(1);

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    // Get calendar name for audit log
    const [calendar] = await db
      .select({ name: calendars.name })
      .from(calendars)
      .where(eq(calendars.id, calendarId))
      .limit(1);

    // Delete token
    await db
      .delete(calendarAccessTokens)
      .where(eq(calendarAccessTokens.id, tokenId));

    // Audit log
    void logAuditEvent({
      userId: user.id,
      action: "calendar_token_revoked",
      resourceType: "calendar",
      resourceId: calendarId,
      metadata: {
        tokenId,
        tokenName: token.name || "Unnamed",
        calendarName: calendar?.name || "Unknown",
        bundleId: token.bundleId,
        usageCount: token.usageCount,
      },
      request,
      severity: "info",
      isUserVisible: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "[API] DELETE /api/calendars/[id]/tokens/[tokenId] error:",
      error
    );
    return NextResponse.json(
      { error: "Failed to delete access token" },
      { status: 500 }
    );
  }
}
