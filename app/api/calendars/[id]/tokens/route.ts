import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarAccessTokens, calendars } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { checkPermission } from "@/lib/auth/permissions";
import { generateAccessToken } from "@/lib/auth/token-auth";
import { logAuditEvent } from "@/lib/audit-log";
import { rateLimit } from "@/lib/rate-limiter";

/**
 * GET /api/calendars/[id]/tokens
 * List all access tokens for a calendar
 * Only owner/admin can view tokens
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    // Check permissions (admin or owner only)
    const canManage =
      (await checkPermission(user?.id, calendarId, "admin")) ||
      (await checkPermission(user?.id, calendarId, "owner"));

    if (!canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Fetch all tokens for this calendar
    const tokens = await db
      .select({
        id: calendarAccessTokens.id,
        token: calendarAccessTokens.token,
        name: calendarAccessTokens.name,
        permission: calendarAccessTokens.permission,
        expiresAt: calendarAccessTokens.expiresAt,
        createdBy: calendarAccessTokens.createdBy,
        createdAt: calendarAccessTokens.createdAt,
        lastUsedAt: calendarAccessTokens.lastUsedAt,
        usageCount: calendarAccessTokens.usageCount,
        isActive: calendarAccessTokens.isActive,
      })
      .from(calendarAccessTokens)
      .where(eq(calendarAccessTokens.calendarId, calendarId))
      .orderBy(desc(calendarAccessTokens.createdAt));

    // Return partial tokens (first 6 chars) for security
    const sanitizedTokens = tokens.map((token) => ({
      ...token,
      tokenPreview: `${token.token.slice(0, 6)}...`,
      token: undefined, // Remove full token from response
    }));

    return NextResponse.json(sanitizedTokens);
  } catch (error) {
    console.error("[API] GET /api/calendars/[id]/tokens error:", error);
    return NextResponse.json(
      { error: "Failed to fetch access tokens" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendars/[id]/tokens
 * Create a new access token
 * Only owner/admin can create tokens
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: calendarId } = await params;
    const user = await getSessionUser(request.headers);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Rate limit: 10 tokens per hour per calendar
    const rateLimitResponse = rateLimit(
      request,
      user.id,
      "token-creation",
      calendarId
    );
    if (rateLimitResponse) return rateLimitResponse;

    // Check permissions (admin or owner only)
    const canManage =
      (await checkPermission(user.id, calendarId, "admin")) ||
      (await checkPermission(user.id, calendarId, "owner"));

    if (!canManage) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      permission = "read",
      expiresAt,
    }: {
      name?: string;
      permission?: "read" | "write";
      expiresAt?: string | null;
    } = body;

    // Validate permission
    if (permission !== "read" && permission !== "write") {
      return NextResponse.json(
        { error: "Permission must be 'read' or 'write'" },
        { status: 400 }
      );
    }

    // Validate expiration date (if provided)
    let expiresAtDate: Date | null = null;
    if (expiresAt) {
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

    // Generate secure token
    const token = generateAccessToken();

    // Get calendar name for audit log
    const [calendar] = await db
      .select({ name: calendars.name })
      .from(calendars)
      .where(eq(calendars.id, calendarId))
      .limit(1);

    // Create token
    const [newToken] = await db
      .insert(calendarAccessTokens)
      .values({
        calendarId,
        token,
        name: name || null,
        permission,
        expiresAt: expiresAtDate,
        createdBy: user.id,
      })
      .returning();

    // Audit log
    void logAuditEvent({
      userId: user.id,
      action: "calendar_token_created",
      resourceType: "calendar",
      resourceId: calendarId,
      metadata: {
        tokenId: newToken.id,
        tokenName: name || "Unnamed",
        calendarName: calendar?.name || "Unknown",
        permission,
        expiresAt: expiresAt || null,
      },
      request,
      severity: "info",
      isUserVisible: true,
    });

    // Return full token (only time it's shown!)
    return NextResponse.json(
      {
        ...newToken,
        token, // Full token returned ONLY on creation
        tokenPreview: `${token.slice(0, 6)}...`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API] POST /api/calendars/[id]/tokens error:", error);
    return NextResponse.json(
      { error: "Failed to create access token" },
      { status: 500 }
    );
  }
}
