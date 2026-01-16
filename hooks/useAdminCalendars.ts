"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

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
 * Fetch calendars list from API
 */
async function fetchCalendarsApi(
  filters: CalendarFilters | undefined,
  sort: CalendarSort | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  t: ReturnType<typeof useTranslations>
): Promise<CalendarsListResponse> {
  const params = new URLSearchParams();

  if (filters?.search) {
    params.set("search", filters.search);
  }
  if (filters?.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

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
}

/**
 * Fetch calendar details from API
 */
async function fetchCalendarDetailsApi(
  calendarId: string
): Promise<CalendarDetails> {
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
        lastSyncedAt: sync.lastSyncedAt ? new Date(sync.lastSyncedAt) : null,
      })
    ),
  };
}

/**
 * Update calendar via API
 */
async function updateCalendarApi(
  calendarId: string,
  updates: { name?: string; color?: string; guestPermission?: string }
): Promise<void> {
  const response = await fetch(`/api/admin/calendars/${calendarId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update calendar");
  }
}

/**
 * Delete calendar via API
 */
async function deleteCalendarApi(calendarId: string): Promise<void> {
  const response = await fetch(`/api/admin/calendars/${calendarId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete calendar");
  }
}

/**
 * Transfer calendar ownership via API
 */
async function transferCalendarApi(
  calendarId: string,
  newOwnerId: string
): Promise<void> {
  const response = await fetch(`/api/admin/calendars/${calendarId}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newOwnerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to transfer calendar");
  }
}

/**
 * Bulk delete calendars via API
 */
async function bulkDeleteCalendarsApi(
  calendarIds: string[]
): Promise<{ deletedCount: number }> {
  const response = await fetch("/api/admin/calendars/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendarIds }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete calendars");
  }

  return await response.json();
}

/**
 * Bulk transfer calendars via API
 */
async function bulkTransferCalendarsApi(
  calendarIds: string[],
  newOwnerId: string
): Promise<{ transferredCount: number }> {
  const response = await fetch("/api/admin/calendars/bulk-transfer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendarIds, newOwnerId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to transfer calendars");
  }

  return await response.json();
}

/**
 * Admin Calendars Management Hook
 *
 * Provides functions for managing calendars in the admin panel.
 * Uses React Query for automatic polling and cache management.
 *
 * Features:
 * - Fetch calendars with filtering and sorting
 * - Get calendar details
 * - Update calendar information
 * - Delete calendars (single and bulk)
 * - Transfer calendar ownership (single and bulk)
 * - Optimistic updates for instant UI feedback
 * - Error handling with toast notifications
 * - Automatic cache invalidation
 *
 * @param filters - Calendar filters (search, status)
 * @param sort - Sort options (field, direction)
 * @returns Object with calendar data and management functions
 */
export function useAdminCalendars(
  filters?: CalendarFilters,
  sort?: CalendarSort
) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch calendars list with polling
  const {
    data: calendarsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: queryKeys.admin.calendars({ filters, sort }),
    queryFn: () => fetchCalendarsApi(filters, sort, t),
    refetchInterval: REFETCH_INTERVAL,
  });

  // Update calendar mutation
  const updateMutation = useMutation({
    mutationFn: ({
      calendarId,
      updates,
    }: {
      calendarId: string;
      updates: { name?: string; color?: string; guestPermission?: string };
    }) => updateCalendarApi(calendarId, updates),
    onMutate: async ({ calendarId, updates }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.calendars({ filters, sort }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.calendars({ filters, sort })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.calendars({ filters, sort }),
        (old: CalendarsListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            calendars: old.calendars.map((cal) =>
              cal.id === calendarId ? { ...cal, ...updates } : cal
            ),
          };
        }
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(
        queryKeys.admin.calendars({ filters, sort }),
        context?.previous
      );
      toast.error(
        t("common.updateError", { item: t("common.labels.calendar") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("common.labels.calendar") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "calendars"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Delete calendar mutation
  const deleteMutation = useMutation({
    mutationFn: (calendarId: string) => deleteCalendarApi(calendarId),
    onMutate: async (calendarId) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.calendars({ filters, sort }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.calendars({ filters, sort })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.calendars({ filters, sort }),
        (old: CalendarsListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            calendars: old.calendars.filter((cal) => cal.id !== calendarId),
            total: old.total - 1,
          };
        }
      );

      return { previous };
    },
    onError: (err, calendarId, context) => {
      queryClient.setQueryData(
        queryKeys.admin.calendars({ filters, sort }),
        context?.previous
      );
      toast.error(
        t("common.deleteError", { item: t("common.labels.calendar") })
      );
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("common.labels.calendar") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "calendars"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Transfer calendar mutation
  const transferMutation = useMutation({
    mutationFn: ({
      calendarId,
      newOwnerId,
    }: {
      calendarId: string;
      newOwnerId: string;
    }) => transferCalendarApi(calendarId, newOwnerId),
    onError: () => {
      toast.error(
        t("common.transferError", { item: t("common.labels.calendar") })
      );
    },
    onSuccess: () => {
      toast.success(
        t("common.transferred", { item: t("common.labels.calendar") })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "calendars"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: (calendarIds: string[]) => bulkDeleteCalendarsApi(calendarIds),
    onMutate: async (calendarIds) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.admin.calendars({ filters, sort }),
      });
      const previous = queryClient.getQueryData(
        queryKeys.admin.calendars({ filters, sort })
      );

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.admin.calendars({ filters, sort }),
        (old: CalendarsListResponse | undefined) => {
          if (!old) return old;
          return {
            ...old,
            calendars: old.calendars.filter(
              (cal) => !calendarIds.includes(cal.id)
            ),
            total: old.total - calendarIds.length,
          };
        }
      );

      return { previous };
    },
    onError: (err, calendarIds, context) => {
      queryClient.setQueryData(
        queryKeys.admin.calendars({ filters, sort }),
        context?.previous
      );
      toast.error(
        t("common.deleteError", { item: t("common.labels.calendar") })
      );
    },
    onSuccess: (data) => {
      toast.success(
        t("admin.calendars.calendarsDeleted", { count: data.deletedCount })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "calendars"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  // Bulk transfer mutation
  const bulkTransferMutation = useMutation({
    mutationFn: ({
      calendarIds,
      newOwnerId,
    }: {
      calendarIds: string[];
      newOwnerId: string;
    }) => bulkTransferCalendarsApi(calendarIds, newOwnerId),
    onError: () => {
      toast.error(
        t("common.transferError", { item: t("common.labels.calendar") })
      );
    },
    onSuccess: (data) => {
      toast.success(
        t("admin.calendars.calendarsTransferred", {
          count: data.transferredCount,
        })
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "calendars"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
    },
  });

  return {
    // Data
    calendars: calendarsData?.calendars || [],
    total: calendarsData?.total || 0,
    orphanedCount: calendarsData?.orphanedCount || 0,
    isLoading,
    error,

    // Functions
    refetch,
    fetchCalendarDetails: (calendarId: string) =>
      fetchCalendarDetailsApi(calendarId),
    updateCalendar: async (
      calendarId: string,
      updates: { name?: string; color?: string; guestPermission?: string }
    ): Promise<boolean> => {
      try {
        await updateMutation.mutateAsync({ calendarId, updates });
        return true;
      } catch {
        return false;
      }
    },
    deleteCalendar: async (calendarId: string): Promise<boolean> => {
      try {
        await deleteMutation.mutateAsync(calendarId);
        return true;
      } catch {
        return false;
      }
    },
    transferCalendar: async (
      calendarId: string,
      newOwnerId: string
    ): Promise<boolean> => {
      try {
        await transferMutation.mutateAsync({ calendarId, newOwnerId });
        return true;
      } catch {
        return false;
      }
    },
    bulkDeleteCalendars: async (calendarIds: string[]): Promise<boolean> => {
      try {
        await bulkDeleteMutation.mutateAsync(calendarIds);
        return true;
      } catch {
        return false;
      }
    },
    bulkTransferCalendars: async (
      calendarIds: string[],
      newOwnerId: string
    ): Promise<boolean> => {
      try {
        await bulkTransferMutation.mutateAsync({ calendarIds, newOwnerId });
        return true;
      } catch {
        return false;
      }
    },
  };
}
