"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";
import {
  AdminRequestError,
  toSearchParams,
  type AdminListResponse,
  type CalendarListCounts,
  type CalendarListParams,
} from "@/lib/admin-list";
import {
  patchListPages,
  restoreListPages,
  run,
  useAdminErrorToast,
} from "@/hooks/useAdminList";

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

export type CalendarsListResponse = AdminListResponse<AdminCalendar, CalendarListCounts>;

/** One page of calendars; omitted params fall back to the API defaults. */
async function fetchAdminCalendars(
  params: Partial<CalendarListParams>,
): Promise<CalendarsListResponse> {
  const response = await fetch(`/api/admin/calendars?${toSearchParams(params)}`);
  if (!response.ok) throw new AdminRequestError(response.status);

  const data = await response.json();
  return {
    ...data,
    items: data.items.map((cal: AdminCalendar) => ({
      ...cal,
      createdAt: new Date(cal.createdAt),
      updatedAt: new Date(cal.updatedAt),
    })),
  };
}

export async function fetchAdminCalendarDetails(
  calendarId: string,
): Promise<CalendarDetails> {
  const response = await fetch(`/api/admin/calendars/${calendarId}`);
  if (!response.ok) throw new AdminRequestError(response.status);

  const data = await response.json();

  return {
    ...data,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
    externalSyncs: data.externalSyncs.map(
      (sync: CalendarDetails["externalSyncs"][number]) => ({
        ...sync,
        lastSyncedAt: sync.lastSyncedAt ? new Date(sync.lastSyncedAt) : null,
      }),
    ),
  };
}

/**
 * Update calendar via API
 */
async function updateCalendarApi(
  calendarId: string,
  updates: { name?: string; color?: string; guestPermission?: AdminCalendar["guestPermission"] },
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
  newOwnerId: string,
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
  calendarIds: string[],
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
  newOwnerId: string,
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
 * One page of the admin calendar list, filtered, sorted and paginated by the API.
 * The previous page stays visible while the next one loads.
 */
export function useAdminCalendars(params: CalendarListParams) {
  const t = useTranslations();
  const { data, isLoading, isPlaceholderData, error } = useQuery({
    queryKey: queryKeys.admin.calendars.list(params),
    queryFn: () => fetchAdminCalendars(params),
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL,
  });

  useAdminErrorToast(
    error,
    "admin-calendars-error",
    t("common.fetchError", { item: t("admin.calendarsMenu") }),
  );

  return {
    calendars: data?.items ?? [],
    total: data?.total ?? 0,
    counts: data?.counts ?? null,
    // See useAdminUsers: the served page is only authoritative for the current request
    page: isPlaceholderData ? params.page : (data?.page ?? params.page),
    isLoading,
    isPlaceholderData,
  };
}

/**
 * Calendar mutations for the admin panel. Edits and deletions are applied
 * optimistically to every cached page of the calendar list.
 */
export function useAdminCalendarActions() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const patchCalendars = (patch: (calendars: AdminCalendar[]) => AdminCalendar[]) =>
    patchListPages<AdminCalendar>(queryClient, queryKeys.admin.calendars.lists, patch);

  const onSettled = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.calendars.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.stats });
  };

  const updateMutation = useMutation({
    mutationFn: ({
      calendarId,
      updates,
    }: {
      calendarId: string;
      updates: { name?: string; color?: string; guestPermission?: AdminCalendar["guestPermission"] };
    }) => updateCalendarApi(calendarId, updates),
    onMutate: async ({ calendarId, updates }) => ({
      snapshot: await patchCalendars((calendars) =>
        calendars.map((cal) => (cal.id === calendarId ? { ...cal, ...updates } : cal)),
      ),
    }),
    onError: (err, variables, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(t("common.updateError", { item: t("common.labels.calendar") }));
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("common.labels.calendar") }));
    },
    onSettled,
  });

  const deleteMutation = useMutation({
    mutationFn: (calendarId: string) => deleteCalendarApi(calendarId),
    onMutate: async (calendarId) => ({
      snapshot: await patchCalendars((calendars) =>
        calendars.filter((cal) => cal.id !== calendarId),
      ),
    }),
    onError: (err, calendarId, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(t("common.deleteError", { item: t("common.labels.calendar") }));
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("common.labels.calendar") }));
    },
    onSettled,
  });

  const transferMutation = useMutation({
    mutationFn: ({
      calendarId,
      newOwnerId,
    }: {
      calendarId: string;
      newOwnerId: string;
    }) => transferCalendarApi(calendarId, newOwnerId),
    onError: () => {
      toast.error(t("common.transferError", { item: t("common.labels.calendar") }));
    },
    onSuccess: () => {
      toast.success(t("common.transferred", { item: t("common.labels.calendar") }));
    },
    onSettled,
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (calendarIds: string[]) => bulkDeleteCalendarsApi(calendarIds),
    onMutate: async (calendarIds) => ({
      snapshot: await patchCalendars((calendars) =>
        calendars.filter((cal) => !calendarIds.includes(cal.id)),
      ),
    }),
    onError: (err, calendarIds, context) => {
      restoreListPages(queryClient, context?.snapshot);
      toast.error(t("common.deleteError", { item: t("common.labels.calendar") }));
    },
    onSuccess: (data) => {
      toast.success(t("admin.calendars.calendarsDeleted", { count: data.deletedCount }));
    },
    onSettled,
  });

  const bulkTransferMutation = useMutation({
    mutationFn: ({
      calendarIds,
      newOwnerId,
    }: {
      calendarIds: string[];
      newOwnerId: string;
    }) => bulkTransferCalendarsApi(calendarIds, newOwnerId),
    onError: () => {
      toast.error(t("common.transferError", { item: t("common.labels.calendar") }));
    },
    onSuccess: (data) => {
      toast.success(
        t("admin.calendars.calendarsTransferred", { count: data.transferredCount }),
      );
    },
    onSettled,
  });

  return {
    isUpdating: updateMutation.isPending,
    isTransferring: transferMutation.isPending || bulkTransferMutation.isPending,
    updateCalendar: (
      calendarId: string,
      updates: { name?: string; color?: string; guestPermission?: AdminCalendar["guestPermission"] },
    ) => run(updateMutation.mutateAsync, { calendarId, updates }),
    deleteCalendar: (calendarId: string) => run(deleteMutation.mutateAsync, calendarId),
    transferCalendar: (calendarId: string, newOwnerId: string) =>
      run(transferMutation.mutateAsync, { calendarId, newOwnerId }),
    bulkDeleteCalendars: (calendarIds: string[]) =>
      run(bulkDeleteMutation.mutateAsync, calendarIds),
    bulkTransferCalendars: (calendarIds: string[], newOwnerId: string) =>
      run(bulkTransferMutation.mutateAsync, { calendarIds, newOwnerId }),
  };
}
