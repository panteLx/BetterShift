import { db } from "@/lib/db";
import { calendarAccessTokens, calendars } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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
  permission: "read" | "write";
}

/**
 * Validate an access token
 * Checks: exists, active, not expired
 *
 * @param token - The token string to validate
 * @param skipActiveCheck - If true, only checks expiration (for cookie cleanup)
 * @returns Token data if valid, null otherwise
 */
export async function validateAccessToken(
  token: string,
  skipActiveCheck = false
): Promise<{
  id: string;
  calendarId: string;
  permission: "read" | "write";
  calendarName: string;
} | null> {
  try {
    const [tokenData] = await db
      .select({
        id: calendarAccessTokens.id,
        calendarId: calendarAccessTokens.calendarId,
        permission: calendarAccessTokens.permission,
        expiresAt: calendarAccessTokens.expiresAt,
        isActive: calendarAccessTokens.isActive,
        calendarName: calendars.name,
      })
      .from(calendarAccessTokens)
      .innerJoin(calendars, eq(calendarAccessTokens.calendarId, calendars.id))
      .where(eq(calendarAccessTokens.token, token))
      .limit(1);

    if (!tokenData) {
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
      permission: tokenData.permission as "read" | "write",
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
 * @param permission - The permission level
 * @param response - The NextResponse to set the cookie on
 * @param request - Optional NextRequest to read existing tokens from
 */
export function storeTokenInCookie(
  token: string,
  calendarId: string,
  permission: "read" | "write",
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
        { token, calendarId, permission },
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
 * Also removes expired tokens from the cookie (but keeps inactive ones)
 *
 * @returns Array of token data
 */
export async function getTokensFromCookie(): Promise<TokenCookieData[]> {
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
        (t.permission === "read" || t.permission === "write")
    );

    // Validate each token against the database
    // Note: We skip the isActive check - only remove expired tokens
    // This allows owners to reactivate tokens without users losing access
    const validatedTokens: TokenCookieData[] = [];
    let hasExpiredTokens = false;

    for (const tokenData of validTokens) {
      // skipActiveCheck = true: Only check expiration, not isActive
      const validation = await validateAccessToken(tokenData.token, true);
      if (validation) {
        validatedTokens.push(tokenData);
      } else {
        // Token is expired or doesn't exist - remove from cookie
        hasExpiredTokens = true;
      }
    }

    // If we found expired tokens, update the cookie to remove them
    if (hasExpiredTokens && validatedTokens.length !== validTokens.length) {
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
        (t.permission === "read" || t.permission === "write")
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
        (t.permission === "read" || t.permission === "write")
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
 * Get calendar permission from access token
 * Used by permission checks to grant token-based access
 *
 * @param calendarId - The calendar ID to check
 * @returns Permission level or null if no token grants access
 */
export async function getTokenPermission(
  calendarId: string
): Promise<"read" | "write" | null> {
  try {
    const tokens = await getTokensFromCookie();

    // Find ALL tokens for this calendar
    const calendarTokens = tokens.filter((t) => t.calendarId === calendarId);

    if (calendarTokens.length === 0) {
      return null;
    }

    // Try to validate each token - use the first valid one
    // This handles the case where expired tokens are in the cookie
    for (const tokenData of calendarTokens) {
      const validation = await validateAccessToken(tokenData.token);

      if (validation && validation.calendarId === calendarId) {
        // Found a valid token - return its permission
        return validation.permission;
      }
    }

    // No valid tokens found
    return null;
  } catch (error) {
    console.error("[token-auth] getTokenPermission error:", error);
    return null;
  }
}
