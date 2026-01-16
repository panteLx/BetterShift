"use client";

import { useMemo } from "react";
import { useQueries, useQueryClient, useMutation } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import { normalizeShift } from "@/hooks/useShifts";
import { normalizeNote } from "@/hooks/useNotes";
import { ShiftFormData } from "@/components/shift-sheet";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// API functions
async function fetchShiftsApi(
  calendarId: string
): Promise<ShiftWithCalendar[]> {
  const response = await fetch(`/api/shifts?calendarId=${calendarId}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.map(normalizeShift);
}

async function fetchNotesApi(calendarId: string): Promise<CalendarNote[]> {
  const response = await fetch(`/api/notes?calendarId=${calendarId}`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.map(normalizeNote);
}

async function fetchExternalSyncsApi(
  calendarId: string
): Promise<ExternalSync[]> {
  const response = await fetch(`/api/external-syncs?calendarId=${calendarId}`);
  if (!response.ok) return [];
  return await response.json();
}

async function fetchPresetsApi(calendarId: string): Promise<ShiftPreset[]> {
  const response = await fetch(`/api/presets?calendarId=${calendarId}`);
  if (!response.ok) return [];
  return await response.json();
}

async function createShiftApi(
  calendarId: string,
  formData: ShiftFormData
): Promise<ShiftWithCalendar> {
  const response = await fetch("/api/shifts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formData, calendarId }),
  });

  if (!response.ok) {
    throw new Error("Failed to create shift");
  }

  const data = await response.json();
  return normalizeShift(data);
}

async function deleteShiftApi(shiftId: string): Promise<void> {
  const response = await fetch(`/api/shifts/${shiftId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error("Failed to delete shift");
  }
}

interface UseCompareDataOptions {
  calendarIds: string[];
  enabled: boolean;
}

/**
 * Hook for loading and managing Compare Mode data using React Query.
 * Uses useQueries to fetch data for multiple calendars in parallel.
 * All data is cached and shared with single-calendar views.
 */
export function useCompareData({
  calendarIds,
  enabled,
}: UseCompareDataOptions) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Fetch shifts for all calendars
  const shiftsQueries = useQueries({
    queries: calendarIds.map((id) => ({
      queryKey: queryKeys.shifts.byCalendar(id),
      queryFn: () => fetchShiftsApi(id),
      enabled: enabled && !!id,
    })),
  });

  // Fetch notes for all calendars
  const notesQueries = useQueries({
    queries: calendarIds.map((id) => ({
      queryKey: queryKeys.notes.byCalendar(id),
      queryFn: () => fetchNotesApi(id),
      enabled: enabled && !!id,
    })),
  });

  // Fetch external syncs for all calendars
  const externalSyncsQueries = useQueries({
    queries: calendarIds.map((id) => ({
      queryKey: queryKeys.externalSyncs.byCalendar(id),
      queryFn: () => fetchExternalSyncsApi(id),
      enabled: enabled && !!id,
    })),
  });

  // Fetch presets for all calendars
  const presetsQueries = useQueries({
    queries: calendarIds.map((id) => ({
      queryKey: queryKeys.presets.byCalendar(id),
      queryFn: () => fetchPresetsApi(id),
      enabled: enabled && !!id,
    })),
  });

  // Build maps from query results
  // Extract data arrays to use as stable dependencies
  const shiftsDataArray = shiftsQueries.map((q) => q.data);
  const notesDataArray = notesQueries.map((q) => q.data);
  const externalSyncsDataArray = externalSyncsQueries.map((q) => q.data);
  const presetsDataArray = presetsQueries.map((q) => q.data);
  const presetsLoadingArray = presetsQueries.map((q) => q.isLoading);

  const shiftsMap = useMemo(() => {
    const map = new Map<string, ShiftWithCalendar[]>();
    calendarIds.forEach((id, index) => {
      map.set(id, shiftsDataArray[index] || []);
    });
    return map;
  }, [calendarIds, shiftsDataArray]);

  const notesMap = useMemo(() => {
    const map = new Map<string, CalendarNote[]>();
    calendarIds.forEach((id, index) => {
      map.set(id, notesDataArray[index] || []);
    });
    return map;
  }, [calendarIds, notesDataArray]);

  const externalSyncsMap = useMemo(() => {
    const map = new Map<string, ExternalSync[]>();
    calendarIds.forEach((id, index) => {
      map.set(id, externalSyncsDataArray[index] || []);
    });
    return map;
  }, [calendarIds, externalSyncsDataArray]);

  const presetsMap = useMemo(() => {
    const map = new Map<string, ShiftPreset[]>();
    calendarIds.forEach((id, index) => {
      map.set(id, presetsDataArray[index] || []);
    });
    return map;
  }, [calendarIds, presetsDataArray]);

  const presetsLoadingMap = useMemo(() => {
    const map = new Map<string, boolean>();
    calendarIds.forEach((id, index) => {
      map.set(id, presetsLoadingArray[index] || false);
    });
    return map;
  }, [calendarIds, presetsLoadingArray]);

  // Check if any data is still loading
  const isLoading =
    shiftsQueries.some((q) => q.isLoading) ||
    notesQueries.some((q) => q.isLoading) ||
    externalSyncsQueries.some((q) => q.isLoading) ||
    presetsQueries.some((q) => q.isLoading);

  // Create shift mutation (for toggle functionality)
  const createShiftMutation = useMutation({
    mutationFn: ({
      calendarId,
      formData,
    }: {
      calendarId: string;
      formData: ShiftFormData;
    }) => createShiftApi(calendarId, formData),
    onSuccess: (_, { calendarId }) => {
      toast.success(t("common.created", { item: t("shift.shift_one") }));
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId),
      });
    },
    onError: () => {
      toast.error(t("common.createError", { item: t("shift.shift_one") }));
    },
  });

  // Delete shift mutation (for toggle functionality)
  const deleteShiftMutation = useMutation({
    mutationFn: ({ shiftId }: { calendarId: string; shiftId: string }) =>
      deleteShiftApi(shiftId),
    onSuccess: (_, { calendarId }) => {
      toast.success(t("common.deleted", { item: t("shift.shift_one") }));
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId),
      });
    },
    onError: () => {
      toast.error(t("common.deleteError", { item: t("shift.shift_one") }));
    },
  });

  // Invalidate notes for a specific calendar (used after note mutations)
  const invalidateNotes = (calendarId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.notes.byCalendar(calendarId),
    });
  };

  // Invalidate presets for a specific calendar
  const invalidatePresets = (calendarId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.presets.byCalendar(calendarId),
    });
  };

  return {
    // Data maps
    shiftsMap,
    notesMap,
    externalSyncsMap,
    presetsMap,
    presetsLoadingMap,

    // Loading state
    isLoading,

    // Mutations
    createShift: createShiftMutation.mutateAsync,
    deleteShift: deleteShiftMutation.mutateAsync,

    // Invalidation helpers
    invalidateNotes,
    invalidatePresets,
  };
}
