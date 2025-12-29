import { db } from "@/lib/db";
import { session } from "@/lib/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { UAParser } from "ua-parser-js";
import { auth } from "@/lib/auth";
import { isAuthEnabled } from "@/lib/auth/feature-flags";

// =====================================================
// Current Session Context (Request-scoped)
// =====================================================

/**
 * Get current user session from request headers
 * Returns null if auth is disabled or user is not authenticated
 */
export async function getSessionUser(
  headers: Headers
): Promise<{ id: string; email: string; name: string } | null> {
  // If auth is disabled, return null (single-user mode)
  if (!isAuthEnabled()) {
    return null;
  }

  try {
    const session = await auth.api.getSession({ headers });
    return session?.user || null;
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

/**
 * Check if user is authenticated
 * When auth is disabled, always returns true (backwards compatibility)
 */
export async function isAuthenticated(headers: Headers): Promise<boolean> {
  // If auth is disabled, always allow (single-user mode)
  if (!isAuthEnabled()) {
    return true;
  }

  const user = await getSessionUser(headers);
  return user !== null;
}

// =====================================================
// Session Management (Multi-device, User-scoped)
// =====================================================

/**
 * Parsed session information with device details
 */
export interface ParsedSession {
  id: string;
  deviceName: string; // e.g., "Chrome on Windows"
  browser: string; // e.g., "Chrome 120.0"
  os: string; // e.g., "Windows 10"
  deviceType: string; // "desktop" | "mobile" | "tablet" | "unknown"
  ipAddress: string | null;
  lastActive: Date;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * Parse user agent string into human-readable device information
 */
function parseUserAgent(userAgent: string | null): {
  browser: string;
  os: string;
  deviceType: string;
  deviceName: string;
} {
  if (!userAgent) {
    return {
      browser: "Unknown Browser",
      os: "Unknown OS",
      deviceType: "unknown",
      deviceName: "Unknown Device",
    };
  }

  const parser = new UAParser(userAgent);
  const browserData = parser.getBrowser();
  const osData = parser.getOS();
  const deviceData = parser.getDevice();

  const browser = browserData.name
    ? `${browserData.name}${
        browserData.version ? ` ${browserData.version.split(".")[0]}` : ""
      }`
    : "Unknown Browser";

  const os = osData.name
    ? `${osData.name}${osData.version ? ` ${osData.version}` : ""}`
    : "Unknown OS";

  const deviceType = deviceData.type || "desktop";

  const deviceName = `${browser} on ${os}`;

  return {
    browser,
    os,
    deviceType,
    deviceName,
  };
}

/**
 * Get all active sessions for a user with parsed device information
 */
export async function getUserSessions(
  userId: string
): Promise<ParsedSession[]> {
  const sessions = await db
    .select()
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(desc(session.updatedAt));

  return sessions.map((s) => {
    const parsed = parseUserAgent(s.userAgent);

    return {
      id: s.id,
      deviceName: parsed.deviceName,
      browser: parsed.browser,
      os: parsed.os,
      deviceType: parsed.deviceType,
      ipAddress: s.ipAddress,
      lastActive: new Date(s.updatedAt),
      createdAt: new Date(s.createdAt),
      expiresAt: new Date(s.expiresAt),
    };
  });
}

/**
 * Revoke all sessions for a user, optionally keeping the current session active
 */
export async function revokeAllSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  let result;

  if (exceptSessionId) {
    // Delete all sessions EXCEPT the specified one
    result = await db
      .delete(session)
      .where(and(eq(session.userId, userId), ne(session.id, exceptSessionId)))
      .returning();
  } else {
    // Delete all sessions
    result = await db
      .delete(session)
      .where(eq(session.userId, userId))
      .returning();
  }

  return result.length;
}
