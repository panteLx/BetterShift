import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarAccessTokens, calendars } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth/sessions";
import { hasCapability } from "@/lib/auth/permissions";
import { getBundleForCalendar } from "@/lib/auth/permission-bundles-service";
import { isGuestEligible } from "@/lib/permission-bundles";
import { generateAccessToken } from "@/lib/auth/token-auth";
import { logAuditEvent, type CalendarTokenCreatedMetadata } from "@/lib/audit-log";
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

    // Check permissions
    const canManage = await hasCapability(
      user?.id,
      calendarId,
      "manageGuestAccess"
    );

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
        bundleId: calendarAccessTokens.bundleId,
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

    // Resolve each token's bundleId to its identity for the response
    const distinctBundleIds = Array.from(
      new Set(tokens.map((token) => token.bundleId))
    );
    const bundles = distinctBundleIds.length
      ? await db.query.calendarPermissionBundles.findMany({
          where: (b, { inArray }) => inArray(b.id, distinctBundleIds),
          columns: { id: true, name: true, seedKey: true },
        })
      : [];
    const bundleById = new Map(bundles.map((bundle) => [bundle.id, bundle]));

    // Return partial tokens (first 6 chars) for security
    const sanitizedTokens = tokens.map((token) => ({
      ...token,
      bundle: bundleById.get(token.bundleId) ?? null,
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

    const body = await request.json();
    const {
      name,
      bundleId,
      expiresAt,
    }: {
      name?: string;
      bundleId?: string;
      expiresAt?: string | null;
    } = body;

    // Validate the bundle: must exist, belong to this calendar, and be
    // guest-eligible (E7) — a link is always a guest/link source.
    if (!bundleId || typeof bundleId !== "string") {
      return NextResponse.json({ error: "Invalid bundle id" }, { status: 400 });
    }
    const bundle = await getBundleForCalendar(calendarId, bundleId);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }
    if (!isGuestEligible(bundle.capabilities)) {
      return NextResponse.json(
        {
          error:
            "Bundle contains capabilities that cannot be granted via a link",
          forbiddenCapabilities: bundle.capabilities.filter(
            (c) => !isGuestEligible([c])
          ),
        },
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
        bundleId: bundle.id,
        expiresAt: expiresAtDate,
        createdBy: user.id,
      })
      .returning();

    // Audit log
    void logAuditEvent<CalendarTokenCreatedMetadata>({
      userId: user.id,
      action: "calendar_token_created",
      resourceType: "calendar",
      resourceId: calendarId,
      metadata: {
        tokenId: newToken.id,
        tokenName: name || "Unnamed",
        calendarName: calendar?.name || "Unknown",
        bundleId: bundle.id,
        bundleName: bundle.name,
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
        bundle: { id: bundle.id, name: bundle.name, seedKey: bundle.seedKey },
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
