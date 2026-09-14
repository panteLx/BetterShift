"use client";

import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCalendars } from "@/hooks/useCalendars";
import { CalendarWithCount } from "@/lib/types";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { type Capability } from "@/lib/permission-bundles";

export interface CalendarPermission {
  isOwner: boolean;
  /** Whether the caller may perform a specific capability on the calendar — mirrors CalendarAccess.can() server-side. */
  can(capability: Capability): boolean;
  /** Whether the caller may act on a resource given its own/any capabilities and creator — mirrors CalendarAccess.canOwned() server-side (E1/E8). */
  canOwned(own: Capability, any: Capability, createdBy: string | null): boolean;
  /** Owner-only — deletion of the calendar itself, not a resource on it. */
  canDelete: boolean;
}

const NO_ACCESS: CalendarPermission = {
  isOwner: false,
  can: () => false,
  canOwned: () => false,
  canDelete: false,
};

/**
 * Hook to check calendar permissions client-side.
 *
 * Mirrors lib/auth/permissions.ts's getCalendarAccess() using the effective
 * `capabilities` the calendar list API already resolved for the caller
 * (share > token > subscribed guest bundle priority, ceiling-filtered) —
 * this hook does no permission resolution of its own.
 *
 * Accepts either a calendar object or a calendar ID string. If a string is
 * provided, it will look up the calendar from the calendars list.
 *
 * @example
 * const { can, canOwned } = useCalendarPermission(calendarId);
 * if (!canOwned("editOwnShift", "editAnyShift", shift.createdBy)) return;
 */
export function useCalendarPermission(
  calendarOrId?: CalendarWithCount | string | null
): CalendarPermission {
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

  return useMemo(() => {
    if (!calendar) return NO_ACCESS;
    // Auth disabled grants full owner access to everyone regardless of
    // user/isGuest, which otherwise both stay false in that mode.
    if (auth.enabled && !user && !isGuest) return NO_ACCESS;

    const isOwner = !auth.enabled || calendar.ownerId === user?.id;
    const capabilities = calendar.capabilities ?? [];
    const userId = user?.id ?? null;

    const can = (capability: Capability): boolean =>
      isOwner || capabilities.includes(capability);

    const canOwned = (
      own: Capability,
      any: Capability,
      createdBy: string | null
    ): boolean => {
      if (isOwner) return true;
      if (can(any)) return true;
      if (!can(own)) return false;
      return createdBy === null || createdBy === userId;
    };

    return {
      isOwner,
      can,
      canOwned,
      canDelete: isOwner,
    };
  }, [calendar, user, isGuest, auth.enabled]);
}
