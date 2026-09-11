"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

interface DescribableLog {
  action: string;
  metadata?: unknown;
}

function field(metadata: unknown, key: string): unknown {
  return metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>)[key] : undefined;
}

function text(metadata: unknown, key: string): string {
  const value = field(metadata, key);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function count(metadata: unknown, key: string): number {
  const value = Number(field(metadata, key));
  return Number.isFinite(value) ? value : 0;
}

/**
 * Plain-language summary of an audit entry, built from its action and metadata.
 * Falls back to the raw action name when the metadata lacks what a sentence needs.
 */
export function useAuditDescription() {
  const t = useTranslations();

  return useCallback(
    (log: DescribableLog): string => {
      const m = log.metadata;
      const target = text(m, "targetUser") || text(m, "deletedUser");
      const calendar = text(m, "calendarName");
      const sync = text(m, "syncName");

      switch (log.action) {
        case "admin.user.ban":
          if (!target) break;
          return text(m, "expiresAt") === "permanent"
            ? t("adminAudit.describe.userBannedPermanently", { user: target })
            : t("adminAudit.describe.userBanned", { user: target });
        case "admin.user.unban":
          if (target) return t("adminAudit.describe.userUnbanned", { user: target });
          break;
        case "admin.user.password_reset":
          if (target) return t("adminAudit.describe.passwordReset", { user: target });
          break;
        case "admin.user.delete":
          if (target) return t("adminAudit.describe.userDeleted", { user: target });
          break;
        case "admin.user.update":
          if (target) return t("adminAudit.describe.userUpdated", { user: target });
          break;
        case "admin.calendar.transfer":
          if (calendar && text(m, "newOwnerEmail")) {
            return t("adminAudit.describe.calendarTransferred", {
              calendar,
              user: text(m, "newOwnerEmail"),
            });
          }
          break;
        case "admin.calendar.bulk_transfer":
          if (text(m, "newOwnerEmail")) {
            return t("adminAudit.describe.calendarsTransferred", {
              count: count(m, "count"),
              user: text(m, "newOwnerEmail"),
            });
          }
          break;
        case "admin.calendar.bulk_delete":
          return t("adminAudit.describe.calendarsDeleted", { count: count(m, "count") });
        case "admin.audit_log.delete_by_ids":
        case "admin.audit_log.delete_by_date":
          return t("adminAudit.describe.logsDeleted", { count: count(m, "deletedCount") });
        case "admin.calendar.update":
        case "calendar.updated":
          if (calendar) return t("adminAudit.describe.calendarUpdated", { calendar });
          break;
        case "admin.calendar.delete":
        case "calendar.deleted":
          if (calendar) return t("adminAudit.describe.calendarDeleted", { calendar });
          break;
        case "calendar.created":
          if (calendar) return t("adminAudit.describe.calendarCreated", { calendar });
          break;
        case "calendar.shared":
          if (calendar && text(m, "sharedWith")) {
            return t("adminAudit.describe.calendarShared", { calendar, user: text(m, "sharedWith") });
          }
          break;
        case "calendar.share.removed":
          if (calendar && text(m, "removedUser")) {
            return t("adminAudit.describe.shareRemoved", { calendar, user: text(m, "removedUser") });
          }
          break;
        case "calendar.permission.changed":
          if (calendar && text(m, "user")) {
            return t("adminAudit.describe.permissionChanged", { calendar, user: text(m, "user") });
          }
          break;
        case "calendar.guest_permission.changed":
          if (calendar) return t("adminAudit.describe.guestPermissionChanged", { calendar });
          break;
        case "sync.created":
          if (sync) return t("adminAudit.describe.syncCreated", { sync });
          break;
        case "sync.deleted":
          if (sync) return t("adminAudit.describe.syncDeleted", { sync });
          break;
        case "sync.orphaned.disabled":
          if (sync) return t("adminAudit.describe.syncDisabled", { sync });
          break;
        case "sync.executed":
          if (!sync) break;
          return field(m, "success") === false
            ? t("adminAudit.describe.syncFailed", { sync })
            : t("adminAudit.describe.syncExecuted", {
                sync,
                added: count(m, "shiftsAdded"),
                updated: count(m, "shiftsUpdated"),
                deleted: count(m, "shiftsDeleted"),
              });
        case "security.rate_limit.hit":
          if (text(m, "endpoint")) return t("adminAudit.describe.rateLimit", { endpoint: text(m, "endpoint") });
          break;
        case "auth.login.success":
          return text(m, "provider")
            ? t("adminAudit.describe.loginProvider", { provider: text(m, "provider") })
            : t("adminAudit.describe.loginEmail");
        case "auth.login.failed":
          if (text(m, "email")) return t("adminAudit.describe.loginFailed", { email: text(m, "email") });
          break;
        case "auth.user.registered":
          if (text(m, "email")) return t("adminAudit.describe.registered", { email: text(m, "email") });
          break;
        case "auth.profile.updated":
          return t("adminAudit.describe.profileUpdated");
        case "auth.password.changed":
          return t("adminAudit.describe.passwordChanged");
        case "auth.account.deleted":
          return t("adminAudit.describe.accountDeleted");
        case "auth.session.revoked":
          return t("adminAudit.describe.sessionsRevoked", { count: count(m, "count") || 1 });
      }
      return log.action;
    },
    [t]
  );
}
