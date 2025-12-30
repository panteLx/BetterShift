import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { getClientIp } from "@/lib/ip-utils";

// =====================================================
// Typed Metadata Interfaces
// =====================================================

export interface LoginFailedMetadata {
  email: string;
  reason: "invalid_password" | "user_not_found" | "rate_limited";
}

export interface LoginSuccessMetadata {
  email: string;
  newDevice: boolean;
  provider?: string; // OAuth/OIDC provider ID (e.g., "google", "custom-oidc")
  method: "email" | "oauth" | "oidc";
}

export interface UserRegisteredMetadata {
  email: string;
  name: string | null;
  registrationMethod:
    | "email"
    | "oauth_google"
    | "oauth_github"
    | "oauth_discord"
    | "oidc_custom";
  provider?: string; // OAuth/OIDC provider ID (e.g., "google", "custom-oidc")
}

export interface ProfileUpdatedMetadata {
  changes: string[]; // e.g., ["name", "email", "avatar"]
  oldValues?: {
    name?: string;
    email?: string;
  };
  newValues?: {
    name?: string;
    email?: string;
  };
}

export interface PasswordChangedMetadata {
  sessionsRevoked: number;
}

export interface AccountDeletedMetadata {
  calendarsDeleted: number;
}

export interface SessionRevokedMetadata {
  revokedBy: "user" | "password_change" | "admin";
  sessionId?: string; // For single session revocation
  count?: number; // For bulk revocation
}

export interface CalendarCreatedMetadata {
  calendarName: string;
  color: string;
}

export interface CalendarDeletedMetadata {
  calendarName: string;
  shiftsDeleted: number;
  presetsDeleted: number;
  notesDeleted: number;
}

export interface CalendarUpdatedMetadata {
  calendarName: string;
  changes: string[]; // e.g., ["name", "color", "guestPermission"]
}

export interface CalendarSharedMetadata {
  calendarName: string;
  sharedWith: string; // user email
  permission: "read" | "write" | "admin";
}

export interface CalendarShareRemovedMetadata {
  calendarName: string;
  removedUser: string;
  removedBy: "owner" | "admin" | "self";
}

export interface CalendarPermissionChangedMetadata {
  calendarName: string;
  user: string;
  oldPermission: string;
  newPermission: string;
}

export interface CalendarGuestPermissionChangedMetadata {
  calendarName: string;
  oldPermission: "none" | "read" | "write";
  newPermission: "none" | "read" | "write";
}

export interface SyncCreatedMetadata {
  calendarName: string;
  syncUrl: string;
  syncName: string;
}

export interface SyncDeletedMetadata {
  calendarName: string;
  syncUrl: string;
  syncName: string;
}

export interface SyncExecutedMetadata {
  calendarName: string;
  syncName: string;
  shiftsAdded: number;
  shiftsUpdated: number;
  shiftsDeleted: number;
  success: boolean;
  error?: string;
}

export interface RateLimitHitMetadata {
  endpoint: string;
  limit: number;
  resetTime: number;
}

export interface AdminUserDeleteMetadata {
  deletedUser: string;
  calendarsTransferred: number;
}

export interface AdminCalendarTransferMetadata {
  calendarName: string;
  fromUser: string;
  toUser: string;
}

export interface AdminPasswordResetMetadata {
  targetUser: string;
}

// Union type for all metadata
export type AuditLogMetadata =
  | LoginFailedMetadata
  | LoginSuccessMetadata
  | PasswordChangedMetadata
  | AccountDeletedMetadata
  | SessionRevokedMetadata
  | CalendarCreatedMetadata
  | CalendarDeletedMetadata
  | CalendarUpdatedMetadata
  | CalendarSharedMetadata
  | CalendarShareRemovedMetadata
  | CalendarPermissionChangedMetadata
  | SyncCreatedMetadata
  | SyncDeletedMetadata
  | SyncExecutedMetadata
  | RateLimitHitMetadata
  | AdminUserDeleteMetadata
  | AdminCalendarTransferMetadata
  | AdminPasswordResetMetadata;

// =====================================================
// Audit Log Types
// =====================================================

export type AuditLogSeverity = "info" | "warning" | "error" | "critical";

export interface LogAuditEventOptions<T = AuditLogMetadata> {
  action: string;
  userId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: T;
  request?: NextRequest | Request; // Support both types
  severity?: AuditLogSeverity;
  isUserVisible?: boolean;
}

// =====================================================
// Core Logging Function
// =====================================================

/**
 * Log an audit event to the database.
 * Uses fire-and-forget pattern (queueMicrotask) to avoid blocking requests.
 */
export async function logAuditEvent<T = AuditLogMetadata>(
  options: LogAuditEventOptions<T>
): Promise<void> {
  const {
    action,
    userId = null,
    resourceType = null,
    resourceId = null,
    metadata = undefined,
    request,
    severity = "info",
    isUserVisible = false,
  } = options;

  // Extract IP and user agent from request if provided
  const ipAddress = request ? getClientIp(request) : null;
  const userAgent = request ? request.headers.get("user-agent") : null;

  // Fire-and-forget: don't block the request
  queueMicrotask(async () => {
    try {
      await db.insert(auditLogs).values({
        userId,
        action,
        resourceType,
        resourceId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        ipAddress,
        userAgent,
        severity,
        isUserVisible,
        timestamp: new Date(),
      });
    } catch (error) {
      // Log error but don't throw (fire-and-forget)
      console.error("Failed to log audit event:", error);
    }
  });
}

// =====================================================
// Helper Functions for Common Use Cases
// =====================================================

/**
 * Log a security-related event (critical severity, user-visible)
 */
export async function logSecurityEvent<T = AuditLogMetadata>(
  options: Omit<LogAuditEventOptions<T>, "severity" | "isUserVisible">
): Promise<void> {
  return logAuditEvent({
    ...options,
    severity: "critical",
    isUserVisible: true,
  });
}

/**
 * Log a user action (info severity, user-visible)
 */
export async function logUserAction<T = AuditLogMetadata>(
  options: Omit<LogAuditEventOptions<T>, "severity" | "isUserVisible">
): Promise<void> {
  return logAuditEvent({
    ...options,
    severity: "info",
    isUserVisible: true,
  });
}

/**
 * Log an admin action (warning severity, NOT user-visible)
 */
export async function logAdminAction<T = AuditLogMetadata>(
  options: Omit<LogAuditEventOptions<T>, "severity" | "isUserVisible">
): Promise<void> {
  return logAuditEvent({
    ...options,
    severity: "warning",
    isUserVisible: false,
  });
}

/**
 * Log a system event (info severity, NOT user-visible)
 */
export async function logSystemEvent<T = AuditLogMetadata>(
  options: Omit<LogAuditEventOptions<T>, "severity" | "isUserVisible">
): Promise<void> {
  return logAuditEvent({
    ...options,
    severity: "info",
    isUserVisible: false,
  });
}
