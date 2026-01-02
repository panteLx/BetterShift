/**
 * Rate Limiter Implementation
 *
 * In-memory rate limiting using Fixed Window algorithm with LRU-like cleanup.
 * Tracks requests by IP address (unauthenticated) or User ID (authenticated).
 *
 * Configuration via Environment Variables:
 * - RATE_LIMIT_AUTH_REQUESTS - Auth endpoints (login)
 * - RATE_LIMIT_AUTH_WINDOW - Time window in seconds
 * - RATE_LIMIT_REGISTER_REQUESTS - Registration endpoint (stricter)
 * - RATE_LIMIT_REGISTER_WINDOW
 * - RATE_LIMIT_PASSWORD_CHANGE_REQUESTS - Password change endpoint
 * - RATE_LIMIT_PASSWORD_CHANGE_WINDOW
 * - RATE_LIMIT_ACCOUNT_DELETE_REQUESTS - Account deletion endpoint
 * - RATE_LIMIT_ACCOUNT_DELETE_WINDOW
 * - RATE_LIMIT_UPLOAD_AVATAR_REQUESTS - Avatar upload endpoint
 * - RATE_LIMIT_UPLOAD_AVATAR_WINDOW
 * - RATE_LIMIT_SSE_CONNECTIONS - SSE connection limit per user
 * - RATE_LIMIT_SSE_WINDOW
 * - RATE_LIMIT_CALENDAR_CREATE_REQUESTS - Calendar creation
 * - RATE_LIMIT_CALENDAR_CREATE_WINDOW
 * - RATE_LIMIT_EXTERNAL_SYNC_REQUESTS - External sync execution (per calendar)
 * - RATE_LIMIT_EXTERNAL_SYNC_WINDOW
 * - RATE_LIMIT_EXPORT_PDF_REQUESTS - PDF export
 * - RATE_LIMIT_EXPORT_PDF_WINDOW
 * - RATE_LIMIT_TOKEN_VALIDATION_REQUESTS - Token validation (per IP)
 * - RATE_LIMIT_TOKEN_VALIDATION_WINDOW
 * - RATE_LIMIT_TOKEN_CREATION_REQUESTS - Token creation (per calendar)
 * - RATE_LIMIT_TOKEN_CREATION_WINDOW
 */

import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent, type RateLimitHitMetadata } from "@/lib/audit-log";

// =============================================================================
// Configuration from Environment Variables
// =============================================================================

const config = {
  auth: {
    requests: parseInt(process.env.RATE_LIMIT_AUTH_REQUESTS || "5", 10),
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "60", 10) * 1000,
  },
  register: {
    requests: parseInt(process.env.RATE_LIMIT_REGISTER_REQUESTS || "3", 10),
    windowMs:
      parseInt(process.env.RATE_LIMIT_REGISTER_WINDOW || "600", 10) * 1000, // 10 minutes
  },
  passwordChange: {
    requests: parseInt(
      process.env.RATE_LIMIT_PASSWORD_CHANGE_REQUESTS || "3",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_PASSWORD_CHANGE_WINDOW || "3600", 10) *
      1000,
  },
  accountDelete: {
    requests: parseInt(
      process.env.RATE_LIMIT_ACCOUNT_DELETE_REQUESTS || "1",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_ACCOUNT_DELETE_WINDOW || "3600", 10) *
      1000,
  },
  uploadAvatar: {
    requests: parseInt(
      process.env.RATE_LIMIT_UPLOAD_AVATAR_REQUESTS || "5",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_UPLOAD_AVATAR_WINDOW || "300", 10) * 1000,
  },
  sseConnection: {
    requests: parseInt(process.env.RATE_LIMIT_SSE_CONNECTIONS || "10", 10),
    windowMs: parseInt(process.env.RATE_LIMIT_SSE_WINDOW || "10", 10) * 1000,
  },
  calendarCreate: {
    requests: parseInt(
      process.env.RATE_LIMIT_CALENDAR_CREATE_REQUESTS || "10",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_CALENDAR_CREATE_WINDOW || "3600", 10) *
      1000, // 1 hour
  },
  externalSync: {
    requests: parseInt(
      process.env.RATE_LIMIT_EXTERNAL_SYNC_REQUESTS || "5",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_EXTERNAL_SYNC_WINDOW || "300", 10) * 1000, // 5 minutes
  },
  exportPdf: {
    requests: parseInt(process.env.RATE_LIMIT_EXPORT_PDF_REQUESTS || "10", 10),
    windowMs:
      parseInt(process.env.RATE_LIMIT_EXPORT_PDF_WINDOW || "600", 10) * 1000, // 10 minutes
  },
  tokenValidation: {
    requests: parseInt(
      process.env.RATE_LIMIT_TOKEN_VALIDATION_REQUESTS || "10",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_TOKEN_VALIDATION_WINDOW || "60", 10) *
      1000, // 1 minute
  },
  tokenCreation: {
    requests: parseInt(
      process.env.RATE_LIMIT_TOKEN_CREATION_REQUESTS || "10",
      10
    ),
    windowMs:
      parseInt(process.env.RATE_LIMIT_TOKEN_CREATION_WINDOW || "3600", 10) *
      1000, // 1 hour
  },
  // Admin Panel
  adminUserMutations: {
    requests: parseInt(process.env.RATE_LIMIT_ADMIN_USER_MUTATIONS || "10", 10),
    windowMs:
      parseInt(process.env.RATE_LIMIT_ADMIN_USER_MUTATIONS_WINDOW || "60", 10) *
      1000, // 1 minute
  },
  adminPasswordReset: {
    requests: parseInt(process.env.RATE_LIMIT_ADMIN_PASSWORD_RESET || "5", 10),
    windowMs:
      parseInt(
        process.env.RATE_LIMIT_ADMIN_PASSWORD_RESET_WINDOW || "300",
        10
      ) * 1000, // 5 minutes
  },
  adminBulkOperations: {
    requests: parseInt(process.env.RATE_LIMIT_ADMIN_BULK_OPERATIONS || "3", 10),
    windowMs:
      parseInt(
        process.env.RATE_LIMIT_ADMIN_BULK_OPERATIONS_WINDOW || "300",
        10
      ) * 1000, // 5 minutes
  },
  adminCalendarMutations: {
    requests: parseInt(
      process.env.RATE_LIMIT_ADMIN_CALENDAR_MUTATIONS || "10",
      10
    ),
    windowMs:
      parseInt(
        process.env.RATE_LIMIT_ADMIN_CALENDAR_MUTATIONS_WINDOW || "60",
        10
      ) * 1000, // 1 minute
  },
};

// =============================================================================
// Types
// =============================================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  requests: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// =============================================================================
// In-Memory Storage
// =============================================================================

const store = new Map<string, RateLimitEntry>();

/**
 * Lazy cleanup: Remove expired entries when accessed
 */
function cleanupExpiredEntry(key: string, now: number): void {
  const entry = store.get(key);
  if (entry && entry.resetAt <= now) {
    store.delete(key);
  }
}

/**
 * Get client identifier from request
 * - Authenticated: User ID
 * - Unauthenticated: IP Address
 */
function getClientIdentifier(req: NextRequest, userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get real IP from headers (proxies)
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwarded?.split(",")[0].trim() || realIp || "unknown";

  return `ip:${ip}`;
}

/**
 * Check rate limit for a request
 */
function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const key = `${identifier}:${options.windowMs}`;

  // Clean up expired entry
  cleanupExpiredEntry(key, now);

  const entry = store.get(key);

  if (!entry) {
    // First request in window
    store.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return {
      success: true,
      limit: options.requests,
      remaining: options.requests - 1,
      resetAt: now + options.windowMs,
    };
  }

  // Check if within limit
  if (entry.count < options.requests) {
    entry.count++;
    store.set(key, entry);

    return {
      success: true,
      limit: options.requests,
      remaining: options.requests - entry.count,
      resetAt: entry.resetAt,
    };
  }

  // Rate limit exceeded
  const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

  return {
    success: false,
    limit: options.requests,
    remaining: 0,
    resetAt: entry.resetAt,
    retryAfter,
  };
}

/**
 * Add rate limit headers to response
 */
function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): void {
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set(
    "X-RateLimit-Reset",
    Math.floor(result.resetAt / 1000).toString()
  );

  if (result.retryAfter !== undefined) {
    response.headers.set("Retry-After", result.retryAfter.toString());
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Rate limit middleware for API routes
 *
 * @param req - Next.js request object
 * @param userId - Optional user ID for authenticated requests
 * @param type - Type of endpoint to determine limits
 * @param resourceId - Optional resource ID (e.g., calendarId for token-creation)
 * @returns NextResponse if rate limit exceeded, null otherwise
 *
 * @example
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const user = await getSessionUser(req.headers);
 *   const rateLimitResponse = await rateLimit(req, user?.id, "auth");
 *   if (rateLimitResponse) return rateLimitResponse;
 *
 *   // ... handle request
 * }
 * ```
 */
export function rateLimit(
  req: NextRequest,
  userId?: string | null,
  type:
    | "auth"
    | "register"
    | "password-change"
    | "account-delete"
    | "upload-avatar"
    | "sse"
    | "calendar-create"
    | "external-sync"
    | "export-pdf"
    | "token-validation"
    | "token-creation"
    | "admin-user-mutations"
    | "admin-password-reset"
    | "admin-bulk-operations"
    | "admin-calendar-mutations" = "auth",
  resourceId?: string
): NextResponse | null {
  // Special handling for resource-based limits (e.g., token-creation per calendar)
  let identifier: string;
  if (type === "token-creation" && resourceId) {
    identifier = `calendar:${resourceId}`;
  } else if (type === "external-sync" && resourceId) {
    identifier = `calendar:${resourceId}`;
  } else {
    identifier = getClientIdentifier(req, userId);
  }

  // Select config based on type
  let options: RateLimitOptions;
  switch (type) {
    case "auth":
      options = config.auth;
      break;
    case "register":
      options = config.register;
      break;
    case "password-change":
      options = config.passwordChange;
      break;
    case "account-delete":
      options = config.accountDelete;
      break;
    case "upload-avatar":
      options = config.uploadAvatar;
      break;
    case "sse":
      options = config.sseConnection;
      break;
    case "calendar-create":
      options = config.calendarCreate;
      break;
    case "external-sync":
      options = config.externalSync;
      break;
    case "export-pdf":
      options = config.exportPdf;
      break;
    case "token-validation":
      options = config.tokenValidation;
      break;
    case "token-creation":
      options = config.tokenCreation;
      break;
    case "admin-user-mutations":
      options = config.adminUserMutations;
      break;
    case "admin-password-reset":
      options = config.adminPasswordReset;
      break;
    case "admin-bulk-operations":
      options = config.adminBulkOperations;
      break;
    case "admin-calendar-mutations":
      options = config.adminCalendarMutations;
      break;
  }

  const result = checkRateLimit(identifier, options);

  if (!result.success) {
    // Rate limit exceeded
    console.warn(
      `[Rate Limit] ${type} - ${identifier} exceeded limit (${result.limit} requests per ${options.windowMs}ms)`
    );

    // Log rate limit event to audit logs (fire-and-forget)
    logAuditEvent<RateLimitHitMetadata>({
      action: "security.rate_limit.hit",
      userId: userId || null,
      resourceType: "rate_limit",
      metadata: {
        endpoint: type,
        limit: result.limit,
        resetTime: result.resetAt,
      },
      request: req,
      severity: "warning",
      isUserVisible: userId ? true : false, // Show in activity log only for authenticated users
    }).catch((err) => console.error("Failed to log rate limit event:", err));

    const response = NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: result.retryAfter,
      },
      { status: 429 }
    );

    addRateLimitHeaders(response, result);
    return response;
  }

  // Success - headers will be added by caller if needed
  return null;
}

/**
 * Get current rate limit status without incrementing counter
 * Useful for checking limits without consuming a request
 */
export function getRateLimitStatus(
  identifier: string,
  type:
    | "auth"
    | "register"
    | "password-change"
    | "account-delete"
    | "upload-avatar"
    | "sse"
    | "calendar-create"
    | "external-sync"
    | "export-pdf"
    | "token-validation"
    | "token-creation" = "auth"
): RateLimitResult {
  let options: RateLimitOptions;
  switch (type) {
    case "auth":
      options = config.auth;
      break;
    case "register":
      options = config.register;
      break;
    case "password-change":
      options = config.passwordChange;
      break;
    case "account-delete":
      options = config.accountDelete;
      break;
    case "upload-avatar":
      options = config.uploadAvatar;
      break;
    case "sse":
      options = config.sseConnection;
      break;
    case "calendar-create":
      options = config.calendarCreate;
      break;
    case "external-sync":
      options = config.externalSync;
      break;
    case "export-pdf":
      options = config.exportPdf;
      break;
    case "token-validation":
      options = config.tokenValidation;
      break;
    case "token-creation":
      options = config.tokenCreation;
      break;
  }

  const now = Date.now();
  const key = `${identifier}:${options.windowMs}`;
  cleanupExpiredEntry(key, now);

  const entry = store.get(key);

  if (!entry) {
    return {
      success: true,
      limit: options.requests,
      remaining: options.requests,
      resetAt: now + options.windowMs,
    };
  }

  const remaining = Math.max(0, options.requests - entry.count);

  return {
    success: remaining > 0,
    limit: options.requests,
    remaining,
    resetAt: entry.resetAt,
    retryAfter:
      remaining === 0 ? Math.ceil((entry.resetAt - now) / 1000) : undefined,
  };
}

/**
 * Manually reset rate limit for a specific identifier
 * Useful for testing or administrative purposes
 */
export function resetRateLimit(identifier: string): void {
  // Remove all entries matching the identifier prefix
  const keysToDelete: string[] = [];
  for (const key of store.keys()) {
    if (key.startsWith(identifier)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => store.delete(key));
}

/**
 * Get stats about the rate limiter (for monitoring/debugging)
 */
export function getRateLimiterStats(): {
  totalEntries: number;
  activeEntries: number;
  expiredEntries: number;
} {
  const now = Date.now();
  let activeEntries = 0;
  let expiredEntries = 0;

  for (const entry of store.values()) {
    if (entry.resetAt > now) {
      activeEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    totalEntries: store.size,
    activeEntries,
    expiredEntries,
  };
}
