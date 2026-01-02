"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

/**
 * Calendar Owner Info
 */
export interface CalendarOwner {
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Extended Calendar Type with Admin-specific fields
 */
export interface AdminCalendar {
  id: string;
  name: string;
  color: string;
  guestPermission: "none" | "read" | "write";
  createdAt: Date;
  updatedAt: Date;
  owner: CalendarOwner | null;
  ownerId: string | null;
  shiftsCount: number;
  notesCount: number;
  presetsCount: number;
  sharesCount: number;
  externalSyncsCount: number;
}

/**
 * Calendar Details Type (for calendar details sheet)
 */
export interface CalendarDetails extends AdminCalendar {
  shares: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    userImage: string | null;
    permission: string;
  }>;
  shareTokens: Array<{
    id: string;
    name: string;
    permission: string;
    createdAt: Date;
  }>;
  externalSyncs: Array<{
    id: string;
    name: string;
    url: string;
    lastSyncedAt: Date | null;
  }>;
}

/**
 * Calendar Filters
 */
export interface CalendarFilters {
  search?: string;
  status?: "all" | "orphaned" | "with-owner";
}

/**
 * Calendar Sort Options
 */
export interface CalendarSort {
  field: "name" | "createdAt" | "owner" | "shiftsCount";
  direction: "asc" | "desc";
}

/**
 * Calendars List Response
 */
export interface CalendarsListResponse {
  calendars: AdminCalendar[];
  total: number;
  orphanedCount: number;
}

/**
 * Admin Calendars Management Hook
 *
 * Provides functions for managing calendars in the admin panel.
 *
 * Features:
 * - Fetch calendars with filtering and sorting
 * - Get calendar details
 * - Update calendar information
 * - Delete calendars (single and bulk)
 * - Transfer calendar ownership (single and bulk)
 * - Error handling with toast notifications
 *
 * @returns Object with calendar management functions and state
 */
export function useAdminCalendars() {
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Fetch calendars list with filters and sort
   */
  const fetchCalendars = useCallback(
    async (
      filters?: CalendarFilters,
      sort?: CalendarSort
    ): Promise<CalendarsListResponse | null> => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();

        // Add filters
        if (filters?.search) {
          params.set("search", filters.search);
        }
        if (filters?.status && filters.status !== "all") {
          params.set("status", filters.status);
        }

        // Add sort
        if (sort?.field) {
          params.set("sortBy", sort.field);
        }
        if (sort?.direction) {
          params.set("sortDirection", sort.direction);
        }

        const response = await fetch(`/api/admin/calendars?${params}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch calendars");
        }

        const data = await response.json();

        // Parse dates
        const calendars = data.calendars.map((cal: AdminCalendar) => ({
          ...cal,
          createdAt: new Date(cal.createdAt),
          updatedAt: new Date(cal.updatedAt),
        }));

        return {
          calendars,
          total: data.total,
          orphanedCount: data.orphanedCount,
        };
      } catch (error) {
        console.error("Failed to fetch calendars:", error);
        toast.error(
          t("common.fetchError", { item: t("common.labels.calendar") })
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Get calendar details by ID
   */
  const fetchCalendarDetails = useCallback(
    async (calendarId: string): Promise<CalendarDetails | null> => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/calendars/${calendarId}`);

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch calendar details");
        }

        const data = await response.json();

        // Parse dates
        return {
          ...data,
          createdAt: new Date(data.createdAt),
          updatedAt: new Date(data.updatedAt),
          externalSyncs: data.externalSyncs.map(
            (sync: CalendarDetails["externalSyncs"][number]) => ({
              ...sync,
              lastSyncedAt: sync.lastSyncedAt
                ? new Date(sync.lastSyncedAt)
                : null,
            })
          ),
        };
      } catch (error) {
        console.error("Failed to fetch calendar details:", error);
        toast.error(
          t("common.fetchError", { item: t("admin.calendars.calendarDetails") })
        );
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Update calendar
   */
  const updateCalendar = useCallback(
    async (
      calendarId: string,
      updates: { name?: string; color?: string; guestPermission?: string }
    ): Promise<boolean> => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/calendars/${calendarId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update calendar");
        }

        toast.success(
          t("common.updated", { item: t("common.labels.calendar") })
        );
        return true;
      } catch (error) {
        console.error("Failed to update calendar:", error);
        toast.error(
          t("common.updateError", { item: t("common.labels.calendar") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Delete calendar
   */
  const deleteCalendar = useCallback(
    async (calendarId: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/calendars/${calendarId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete calendar");
        }

        toast.success(
          t("common.deleted", { item: t("common.labels.calendar") })
        );
        return true;
      } catch (error) {
        console.error("Failed to delete calendar:", error);
        toast.error(
          t("common.deleteError", { item: t("common.labels.calendar") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Transfer calendar ownership
   */
  const transferCalendar = useCallback(
    async (calendarId: string, newOwnerId: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/admin/calendars/${calendarId}/transfer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newOwnerId }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to transfer calendar");
        }

        toast.success(
          t("common.transferred", { item: t("common.labels.calendar") })
        );
        return true;
      } catch (error) {
        console.error("Failed to transfer calendar:", error);
        toast.error(
          t("common.transferError", { item: t("common.labels.calendar") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Bulk delete calendars
   */
  const bulkDeleteCalendars = useCallback(
    async (calendarIds: string[]): Promise<boolean> => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/calendars/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarIds }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to delete calendars");
        }

        const data = await response.json();
        toast.success(
          t("admin.calendars.calendarsDeleted", { count: data.deletedCount })
        );
        return true;
      } catch (error) {
        console.error("Failed to bulk delete calendars:", error);
        toast.error(
          t("common.deleteError", { item: t("common.labels.calendar") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  /**
   * Bulk transfer calendars
   */
  const bulkTransferCalendars = useCallback(
    async (calendarIds: string[], newOwnerId: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/calendars/bulk-transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calendarIds, newOwnerId }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to transfer calendars");
        }

        const data = await response.json();
        toast.success(
          t("admin.calendars.calendarsTransferred", {
            count: data.transferredCount,
          })
        );
        return true;
      } catch (error) {
        console.error("Failed to bulk transfer calendars:", error);
        toast.error(
          t("common.transferError", { item: t("common.labels.calendar") })
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  return {
    fetchCalendars,
    fetchCalendarDetails,
    updateCalendar,
    deleteCalendar,
    transferCalendar,
    bulkDeleteCalendars,
    bulkTransferCalendars,
    isLoading,
  };
}
