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
 * - RATE_LIMIT_USER_SEARCH_REQUESTS - User directory search (per user)
 * - RATE_LIMIT_USER_SEARCH_WINDOW
 */

import { NextRequest, NextResponse } from "next/server";
import { logAuditEvent, type RateLimitHitMetadata } from "@/lib/audit-log";
import { getClientIp } from "@/lib/ip-utils";

// =============================================================================
// Configuration from Environment Variables
// =============================================================================

const config = {
  auth: {
    requests: parseInt(process.env.RATE_LIMIT_AUTH_REQUESTS || "5", 10),
    windowMs: parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || "60", 10) * 1000,
  },
  banInfo: {
    // Separate from "auth" on purpose: the login page calls this straight
    // after a BANNED_USER sign-in error, so sharing the auth bucket meant a
    // banned user spent two tokens per attempt and stopped being shown the
    // reason and expiry after the second try.
    requests: parseInt(process.env.RATE_LIMIT_BAN_INFO_REQUESTS || "10", 10),
    windowMs:
      parseInt(process.env.RATE_LIMIT_BAN_INFO_WINDOW || "60", 10) * 1000,
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
  exportIcs: {
    requests: parseInt(process.env.RATE_LIMIT_EXPORT_ICS_REQUESTS || "20", 10),
    windowMs:
      parseInt(process.env.RATE_LIMIT_EXPORT_ICS_WINDOW || "600", 10) * 1000, // 10 minutes
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
  // Directory search used by the calendar-share dialog. Keyed per user, and
  // generous enough for typing with the client-side debounce in place.
  userSearch: {
    requests: parseInt(process.env.RATE_LIMIT_USER_SEARCH_REQUESTS || "30", 10),
    windowMs:
      parseInt(process.env.RATE_LIMIT_USER_SEARCH_WINDOW || "60", 10) * 1000,
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

/**
 * Maps the endpoint type used by callers to its configuration. Also the single
 * source of truth for which types exist — `RateLimitType` is derived from it,
 * so adding an entry here is all it takes to add a new limit.
 */
const limitsByType = {
  auth: config.auth,
  "ban-info": config.banInfo,
  register: config.register,
  "password-change": config.passwordChange,
  "account-delete": config.accountDelete,
  "upload-avatar": config.uploadAvatar,
  "calendar-create": config.calendarCreate,
  "external-sync": config.externalSync,
  "export-pdf": config.exportPdf,
  "export-ics": config.exportIcs,
  "token-validation": config.tokenValidation,
  "token-creation": config.tokenCreation,
  "user-search": config.userSearch,
  "admin-user-mutations": config.adminUserMutations,
  "admin-password-reset": config.adminPasswordReset,
  "admin-bulk-operations": config.adminBulkOperations,
  "admin-calendar-mutations": config.adminCalendarMutations,
} as const;

export type RateLimitType = keyof typeof limitsByType;

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
 * Periodic sweep: drop every expired entry from `store`, not just the one
 * being looked up right now. Without this, a key that is only ever touched
 * once (e.g. a one-off spoofed IP) is never revisited by
 * `cleanupExpiredEntry` and would sit in memory forever, growing `store`
 * without bound.
 *
 * Guarded so importing this module in an environment without timers (e.g.
 * some test runners or edge-like sandboxes) doesn't throw, and `.unref()`d
 * so the interval never keeps the Node process alive on its own.
 */
const SWEEP_INTERVAL_MS = 60 * 1000;

function sweepExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

if (typeof setInterval === "function") {
  const sweepTimer = setInterval(sweepExpiredEntries, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

/**
 * Get client identifier from request
 * - Authenticated: User ID
 * - Unauthenticated: IP Address, via getClientIp() so this agrees with what
 *   the audit log records for the same request, and so that the bucket key is
 *   always a validated IP rather than a raw header value.
 *
 * getClientIp() never returns a client-controlled value: with
 * TRUSTED_PROXY_HEADER set only that header is read, and without it only the
 * last X-Forwarded-For entry, which the nearest proxy appends. Requests that
 * carry no usable address at all collapse into one shared "ip:unknown"
 * bucket, which is the conservative outcome. See lib/ip-utils.ts.
 */
function getClientIdentifier(req: NextRequest, userId?: string | null): string {
  if (userId) {
    return `user:${userId}`;
  }

  const ip = getClientIp(req) || "unknown";

  return `ip:${ip}`;
}

/**
 * Check rate limit for a request
 */
function checkRateLimit(
  identifier: string,
  options: RateLimitOptions,
  scope: RateLimitType
): RateLimitResult {
  const now = Date.now();
  // The scope has to be part of the key: two endpoint types that happen to
  // share a window length (auth and ban-info are both 60s) would otherwise
  // draw from one counter, which silently undoes their separate budgets.
  const key = `${scope}:${identifier}:${options.windowMs}`;

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
  type: RateLimitType = "auth",
  resourceId?: string
): NextResponse | null {
  // Special handling for resource-based limits (e.g., token-creation per calendar)
  let identifier: string;
  if (
    (type === "token-creation" || type === "external-sync") &&
    resourceId
  ) {
    identifier = `calendar:${resourceId}`;
  } else {
    identifier = getClientIdentifier(req, userId);
  }

  const options = limitsByType[type];

  const result = checkRateLimit(identifier, options, type);

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
  type: RateLimitType = "auth"
): RateLimitResult {
  const options = limitsByType[type];

  const now = Date.now();
  const key = `${type}:${identifier}:${options.windowMs}`;
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
