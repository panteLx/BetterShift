"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCalendars } from "@/hooks/useCalendars";
import { CalendarWithCount } from "@/lib/types";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import type { CalendarPermission } from "@/lib/auth/permissions";

/**
 * Hook to check calendar permissions client-side
 *
 * Returns permission helpers for the given calendar.
 * Takes into account:
 * - User authentication status
 * - Calendar ownership
 * - Guest permissions (if user is guest)
 *
 * Accepts either a calendar object or a calendar ID string.
 * If a string is provided, it will look up the calendar from the calendars list.
 *
 * @example
 * // With calendar object
 * const { canEdit, canView, canManage, isReadOnly } = useCalendarPermission(calendar);
 *
 * // With calendar ID
 * const { canEdit, canView, canManage, isReadOnly } = useCalendarPermission(calendarId);
 *
 * if (!canEdit) return <ReadOnlyBanner />;
 */
export function useCalendarPermission(
  calendarOrId?: CalendarWithCount | string | null
) {
  const { user, isGuest } = useAuth();
  const { calendars } = useCalendars();
  const { auth } = usePublicConfig();

  // Resolve calendar object if string ID was provided
  const calendar = useMemo(() => {
    if (!calendarOrId) return null;
    if (typeof calendarOrId === "string") {
      return calendars.find((cal) => cal.id === calendarOrId) || null;
    }
    return calendarOrId;
  }, [calendarOrId, calendars]);

  const permission = useMemo(() => {
    if (!calendar) {
      return {
        level: "none" as const,
        canView: false,
        canEdit: false,
        canManage: false,
        canDelete: false,
        canShare: false,
        isReadOnly: true,
        isOwner: false,
      };
    }

    // If auth is disabled, grant full owner access (backwards compatibility)
    if (!auth.enabled) {
      return {
        level: "owner" as const,
        canView: true,
        canEdit: true,
        canManage: true,
        canDelete: true,
        canShare: true,
        isReadOnly: false,
        isOwner: true,
      };
    }

    // If user is authenticated
    if (user) {
      // User is owner
      if (calendar.ownerId === user.id) {
        return {
          level: "owner" as const,
          canView: true,
          canEdit: true,
          canManage: true,
          canDelete: true,
          canShare: true,
          isReadOnly: false,
          isOwner: true,
        };
      }

      // Check if user has explicit share permission
      const sharePermission = (calendar as { sharePermission?: string })
        .sharePermission;
      if (sharePermission) {
        const isOwner = sharePermission === "owner";
        const isAdmin = sharePermission === "admin";
        const isWrite = sharePermission === "write";
        const isRead = sharePermission === "read";

        return {
          level: sharePermission,
          canView: true,
          canEdit: isOwner || isAdmin || isWrite,
          canManage: isOwner || isAdmin,
          canDelete: isOwner,
          canShare: isOwner || isAdmin,
          isReadOnly: isRead,
          isOwner: isOwner,
        };
      }

      // Check if user has token-based access
      const tokenPermission = (
        calendar as { tokenPermission?: "read" | "write" }
      ).tokenPermission;
      if (tokenPermission) {
        return {
          level: tokenPermission,
          canView: true,
          canEdit: tokenPermission === "write",
          canManage: false,
          canDelete: false,
          canShare: false,
          isReadOnly: tokenPermission === "read",
          isOwner: false,
        };
      }

      // Check if calendar is public (guest permission) and user is subscribed
      // In this case, user gets the guest permission level
      const isSubscribed = (calendar as { isSubscribed?: boolean })
        .isSubscribed;
      if (isSubscribed && calendar.guestPermission !== "none") {
        const guestPerm = calendar.guestPermission as CalendarPermission;
        return {
          level: guestPerm,
          canView: true,
          canEdit: guestPerm === "write",
          canManage: false,
          canDelete: false,
          canShare: false,
          isReadOnly: guestPerm === "read",
          isOwner: false,
        };
      }

      // User has no access to this calendar
      return {
        level: "none" as const,
        canView: false,
        canEdit: false,
        canManage: false,
        canDelete: false,
        canShare: false,
        isReadOnly: true,
        isOwner: false,
      };
    }

    // If user is guest (not authenticated)
    if (isGuest) {
      // Check for token-based access first (higher priority)
      const tokenPermission = (
        calendar as { tokenPermission?: "read" | "write" }
      ).tokenPermission;
      if (tokenPermission) {
        return {
          level: tokenPermission,
          canView: true,
          canEdit: tokenPermission === "write",
          canManage: false,
          canDelete: false,
          canShare: false,
          isReadOnly: tokenPermission === "read",
          isOwner: false,
        };
      }

      // Then check guest permission
      const guestPerm = calendar.guestPermission || "none";

      if (guestPerm === "write") {
        return {
          level: "write" as const,
          canView: true,
          canEdit: true,
          canManage: false,
          canDelete: false,
          canShare: false,
          isReadOnly: false,
          isOwner: false,
        };
      }

      if (guestPerm === "read") {
        return {
          level: "read" as const,
          canView: true,
          canEdit: false,
          canManage: false,
          canDelete: false,
          canShare: false,
          isReadOnly: true,
          isOwner: false,
        };
      }

      // guestPerm === "none"
      return {
        level: "none" as const,
        canView: false,
        canEdit: false,
        canManage: false,
        canDelete: false,
        canShare: false,
        isReadOnly: true,
        isOwner: false,
      };
    }

    // No user, no guest access
    return {
      level: "none" as const,
      canView: false,
      canEdit: false,
      canManage: false,
      canDelete: false,
      canShare: false,
      isReadOnly: true,
      isOwner: false,
    };
  }, [calendar, user, isGuest, auth.enabled]);

  return permission;
}
