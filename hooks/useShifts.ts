import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftFormData } from "@/components/shift-sheet";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { parseLocalDate } from "@/lib/date-utils";
import { queryKeys } from "@/lib/query-keys";

// Helper to convert API response timestamps to Date objects
export function normalizeShift(
  shift: Record<string, unknown>
): ShiftWithCalendar {
  const dateValue = shift.date as string | number | Date;
  const parsedDate =
    typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? parseLocalDate(dateValue)
      : new Date(dateValue);

  return {
    ...(shift as Omit<ShiftWithCalendar, "date" | "createdAt" | "updatedAt">),
    date: parsedDate,
    createdAt: new Date(shift.createdAt as string | number | Date),
    updatedAt: new Date(shift.updatedAt as string | number | Date),
  };
}

// API functions
async function fetchShiftsApi(
  calendarId: string
): Promise<ShiftWithCalendar[]> {
  const params = new URLSearchParams({ calendarId });
  const response = await fetch(`/api/shifts?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch shifts: ${response.statusText}`);
  }

  const data = await response.json();
  return data.map(normalizeShift);
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
    const errorText = await response.text();
    throw new Error(
      `Failed to create shift: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  return normalizeShift(data);
}

async function deleteShiftApi(id: string): Promise<void> {
  const response = await fetch(`/api/shifts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete shift: ${response.status} ${response.statusText} - ${errorText}`
    );
  }
}

// Context type for optimistic updates
interface CreateShiftContext {
  previous: ShiftWithCalendar[] | undefined;
}

interface DeleteShiftContext {
  previous: ShiftWithCalendar[] | undefined;
}

export function useShifts(calendarId: string | undefined) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Data fetching with React Query
  const {
    data: shifts = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: queryKeys.shifts.byCalendar(calendarId!),
    queryFn: () => fetchShiftsApi(calendarId!),
    enabled: !!calendarId,
  });

  // Create mutation with optimistic update
  const createMutation = useMutation<
    ShiftWithCalendar,
    Error,
    ShiftFormData,
    CreateShiftContext
  >({
    mutationFn: (formData) => createShiftApi(calendarId!, formData),
    onMutate: async (formData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId!),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<ShiftWithCalendar[]>(
        queryKeys.shifts.byCalendar(calendarId!)
      );

      // Create optimistic shift
      const optimisticShift: ShiftWithCalendar = {
        id: `temp-${Date.now()}`,
        date: parseLocalDate(formData.date),
        startTime: formData.startTime,
        endTime: formData.endTime,
        title: formData.title,
        color: formData.color || "#3b82f6",
        notes: formData.notes || null,
        isAllDay: formData.isAllDay || false,
        presetId: formData.presetId || null,
        calendarId: calendarId!,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Optimistically update cache
      queryClient.setQueryData<ShiftWithCalendar[]>(
        queryKeys.shifts.byCalendar(calendarId!),
        (old = []) => [...old, optimisticShift]
      );

      return { previous };
    },
    onError: (err, formData, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.shifts.byCalendar(calendarId!),
          context.previous
        );
      }
      console.error("Failed to create shift:", err);
      toast.error(t("common.createError", { item: t("shift.shift_one") }));
    },
    onSuccess: () => {
      toast.success(t("common.created", { item: t("shift.shift_one") }));
    },
    onSettled: () => {
      // Refetch to get real data from server
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId!),
      });
    },
  });

  // Delete mutation with optimistic update
  const deleteMutation = useMutation<void, Error, string, DeleteShiftContext>({
    mutationFn: (id) => deleteShiftApi(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId!),
      });

      const previous = queryClient.getQueryData<ShiftWithCalendar[]>(
        queryKeys.shifts.byCalendar(calendarId!)
      );

      // Optimistically remove
      queryClient.setQueryData<ShiftWithCalendar[]>(
        queryKeys.shifts.byCalendar(calendarId!),
        (old = []) => old.filter((s) => s.id !== id)
      );

      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.shifts.byCalendar(calendarId!),
          context.previous
        );
      }
      console.error("Failed to delete shift:", err);
      toast.error(t("common.deleteError", { item: t("shift.shift_one") }));
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("shift.shift_one") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId!),
      });
    },
  });

  // Return API-compatible interface
  return {
    shifts,
    setShifts: (
      newShifts:
        | ShiftWithCalendar[]
        | ((prev: ShiftWithCalendar[]) => ShiftWithCalendar[])
    ) => {
      if (!calendarId) return;
      queryClient.setQueryData(
        queryKeys.shifts.byCalendar(calendarId),
        newShifts
      );
    },
    loading: isLoading,
    hasLoadedOnce: isFetched,
    createShift: async (shift: ShiftFormData) => {
      if (!calendarId) {
        throw new Error("Calendar ID is required to create a shift");
      }
      return createMutation.mutateAsync(shift);
    },
    deleteShift: async (shiftId: string) => {
      if (!calendarId) {
        throw new Error("Calendar ID is required to delete a shift");
      }
      // Check if shift is externally synced (read-only)
      const cachedShifts = queryClient.getQueryData<ShiftWithCalendar[]>(
        queryKeys.shifts.byCalendar(calendarId)
      );
      const shift = cachedShifts?.find((s) => s.id === shiftId);
      if (shift?.syncedFromExternal) {
        throw new Error(
          t("common.deleteError", { item: t("shift.shift_one") })
        );
      }
      return deleteMutation.mutateAsync(shiftId);
    },
    refetchShifts: () => {
      if (!calendarId) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.byCalendar(calendarId),
      });
    },
  };
}
