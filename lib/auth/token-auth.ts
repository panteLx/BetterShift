import { db } from "@/lib/db";
import { calendarAccessTokens, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRequestWorkspace } from "@/lib/workspace";

/**
 * Cookie name for storing validated access tokens
 */
const TOKEN_COOKIE_NAME = "calendar_access_tokens";

/**
 * Cookie options for token storage
 */
const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 90, // 90 days
  path: "/",
};

/**
 * Type for token data stored in cookie
 */
export interface TokenCookieData {
  token: string;
  calendarId: string;
  bundleId: string;
}

/**
 * Validate an access token
 * Checks: exists, calendar lives in the given workspace, active, not expired
 *
 * @param token - The token string to validate
 * @param workspaceId - Workspace the token's calendar must belong to
 * @param skipActiveCheck - If true, only checks expiration (for cookie cleanup)
 * @returns Token data if valid, null otherwise
 */
export async function validateAccessToken(
  token: string,
  workspaceId: string,
  skipActiveCheck = false
): Promise<{
  id: string;
  calendarId: string;
  bundleId: string;
  calendarName: string;
} | null> {
  try {
    const [tokenData] = await db
      .select({
        id: calendarAccessTokens.id,
        calendarId: calendarAccessTokens.calendarId,
        bundleId: calendarAccessTokens.bundleId,
        expiresAt: calendarAccessTokens.expiresAt,
        isActive: calendarAccessTokens.isActive,
        calendarName: calendars.name,
        calendarWorkspaceId: calendars.workspaceId,
      })
      .from(calendarAccessTokens)
      .innerJoin(calendars, eq(calendarAccessTokens.calendarId, calendars.id))
      .where(eq(calendarAccessTokens.token, token))
      .limit(1);

    if (!tokenData) {
      return null;
    }

    // A foreign-workspace token must look exactly like an unknown one.
    if (tokenData.calendarWorkspaceId !== workspaceId) {
      return null;
    }

    // Check if token is expired (always check)
    if (tokenData.expiresAt && new Date(tokenData.expiresAt) < new Date()) {
      return null;
    }

    // Check if token is active (skip for cookie cleanup)
    if (!skipActiveCheck && !tokenData.isActive) {
      return null;
    }

    return {
      id: tokenData.id,
      calendarId: tokenData.calendarId,
      bundleId: tokenData.bundleId,
      calendarName: tokenData.calendarName,
    };
  } catch (error) {
    console.error("[token-auth] validateAccessToken error:", error);
    return null;
  }
}

/**
 * Update token usage statistics (non-blocking)
 * Updates lastUsedAt and increments usageCount
 *
 * @param tokenId - The token ID to update
 */
export async function updateTokenUsage(tokenId: string): Promise<void> {
  // Fire and forget - don't block the request
  void (async () => {
    try {
      // Fetch current usage count
      const [currentToken] = await db
        .select({ usageCount: calendarAccessTokens.usageCount })
        .from(calendarAccessTokens)
        .where(eq(calendarAccessTokens.id, tokenId))
        .limit(1);

      if (!currentToken) return;

      await db
        .update(calendarAccessTokens)
        .set({
          lastUsedAt: new Date(),
          usageCount: currentToken.usageCount + 1,
        })
        .where(eq(calendarAccessTokens.id, tokenId));
    } catch (error) {
      console.error("[token-auth] updateTokenUsage error:", error);
    }
  })();
}

/**
 * Store a validated token in a cookie
 *
 * @param token - The token string
 * @param calendarId - The calendar ID
 * @param bundleId - The permission bundle id
 * @param response - The NextResponse to set the cookie on
 * @param request - Optional NextRequest to read existing tokens from
 */
export function storeTokenInCookie(
  token: string,
  calendarId: string,
  bundleId: string,
  response: NextResponse,
  request?: NextRequest
): void {
  try {
    // Get existing tokens from request (if provided) or response
    const existingTokens = request
      ? getTokensFromRequest(request)
      : getTokensFromResponse(response);

    // Check if this token already exists
    const tokenExists = existingTokens.some((t) => t.token === token);

    if (!tokenExists) {
      // Add new token
      const newTokens: TokenCookieData[] = [
        ...existingTokens,
        { token, calendarId, bundleId },
      ];

      // Store in cookie
      response.cookies.set(
        TOKEN_COOKIE_NAME,
        JSON.stringify(newTokens),
        TOKEN_COOKIE_OPTIONS
      );
    }
  } catch (error) {
    console.error("[token-auth] storeTokenInCookie error:", error);
  }
}

/**
 * Get all validated tokens from cookie (for Server Components)
 * Prunes expired, unknown and foreign-workspace tokens from the cookie (keeps inactive ones)
 *
 * @param workspaceId - Defaults to the request workspace; tokens of other workspaces are dropped
 * @returns Array of token data
 */
export async function getTokensFromCookie(
  workspaceId?: string
): Promise<TokenCookieData[]> {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get(TOKEN_COOKIE_NAME);

    if (!tokenCookie?.value) {
      return [];
    }

    const tokens = JSON.parse(tokenCookie.value) as TokenCookieData[];

    // Validate structure
    if (!Array.isArray(tokens)) {
      return [];
    }

    const validTokens = tokens.filter(
      (t) =>
        typeof t.token === "string" &&
        typeof t.calendarId === "string" &&
        typeof t.bundleId === "string"
    );

    const wsId = workspaceId ?? (await getRequestWorkspace())?.id;
    if (!wsId) return [];

    // Validate each token against the database
    // isActive is skipped so owners can reactivate a token without users losing access
    const validatedTokens: TokenCookieData[] = [];
    let hasStaleTokens = false;

    for (const tokenData of validTokens) {
      const validation = await validateAccessToken(tokenData.token, wsId, true);
      if (validation) {
        validatedTokens.push(tokenData);
      } else {
        // Expired, unknown or another workspace's token
        hasStaleTokens = true;
      }
    }

    if (hasStaleTokens && validatedTokens.length !== validTokens.length) {
      cookieStore.set(
        TOKEN_COOKIE_NAME,
        JSON.stringify(validatedTokens),
        TOKEN_COOKIE_OPTIONS
      );
    }

    return validatedTokens;
  } catch (error) {
    console.error("[token-auth] getTokensFromCookie error:", error);
    return [];
  }
}

/**
 * Get tokens from a NextRequest (for middleware)
 *
 * @param request - The NextRequest object
 * @returns Array of token data
 */
export function getTokensFromRequest(request: NextRequest): TokenCookieData[] {
  try {
    const tokenCookie = request.cookies.get(TOKEN_COOKIE_NAME);

    if (!tokenCookie?.value) {
      return [];
    }

    const tokens = JSON.parse(tokenCookie.value) as TokenCookieData[];

    // Validate structure
    if (!Array.isArray(tokens)) {
      return [];
    }

    return tokens.filter(
      (t) =>
        typeof t.token === "string" &&
        typeof t.calendarId === "string" &&
        typeof t.bundleId === "string"
    );
  } catch (error) {
    console.error("[token-auth] getTokensFromRequest error:", error);
    return [];
  }
}

/**
 * Get tokens from a NextResponse (for middleware)
 *
 * @param response - The NextResponse object
 * @returns Array of token data
 */
function getTokensFromResponse(response: NextResponse): TokenCookieData[] {
  try {
    const tokenCookie = response.cookies.get(TOKEN_COOKIE_NAME);

    if (!tokenCookie?.value) {
      return [];
    }

    const tokens = JSON.parse(tokenCookie.value) as TokenCookieData[];

    // Validate structure
    if (!Array.isArray(tokens)) {
      return [];
    }

    return tokens.filter(
      (t) =>
        typeof t.token === "string" &&
        typeof t.calendarId === "string" &&
        typeof t.bundleId === "string"
    );
  } catch (error) {
    console.error("[token-auth] getTokensFromResponse error:", error);
    return [];
  }
}

/**
 * Generate a secure access token
 *
 * @returns A base64url encoded token (43 characters)
 */
export function generateAccessToken(): string {
  // Generate 32 random bytes (256 bits)
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  // Convert to base64url (URL-safe)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Get the permission bundle granted by an access token for a calendar.
 * Used by permission checks to grant token-based access.
 *
 * @param calendarId - The calendar ID to check
 * @param workspaceId - Defaults to the request workspace
 * @returns Bundle id or null if no token grants access
 */
export async function getTokenBundleId(
  calendarId: string,
  workspaceId?: string
): Promise<string | null> {
  try {
    const wsId = workspaceId ?? (await getRequestWorkspace())?.id;
    if (!wsId) return null;

    const tokens = await getTokensFromCookie(wsId);

    // Find ALL tokens for this calendar
    const calendarTokens = tokens.filter((t) => t.calendarId === calendarId);

    if (calendarTokens.length === 0) {
      return null;
    }

    // Try to validate each token - use the first valid one
    for (const tokenData of calendarTokens) {
      const validation = await validateAccessToken(tokenData.token, wsId);

      if (validation && validation.calendarId === calendarId) {
        // Found a valid token - return its bundle
        return validation.bundleId;
      }
    }

    // No valid tokens found
    return null;
  } catch (error) {
    console.error("[token-auth] getTokenBundleId error:", error);
    return null;
  }
}
