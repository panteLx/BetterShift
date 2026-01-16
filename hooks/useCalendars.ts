import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarWithCount } from "@/lib/types";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";
import { queryKeys } from "@/lib/query-keys";
import { REFETCH_INTERVAL } from "@/lib/query-client";

// API functions
async function fetchCalendarsApi(): Promise<CalendarWithCount[]> {
  const response = await fetch("/api/calendars");

  if (!response.ok) {
    throw new Error(`Failed to fetch calendars: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

// Custom error class for rate-limit errors
class RateLimitError extends Error {
  constructor(public response: Response) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

async function createCalendarApi(
  name: string,
  color: string
): Promise<CalendarWithCount> {
  const response = await fetch("/api/calendars", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      color,
      guestPermission: "none",
    }),
  });

  // Check for rate-limit error first
  if (isRateLimitError(response)) {
    throw new RateLimitError(response);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create calendar: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

async function updateCalendarApi(
  calendarId: string,
  updates: {
    name?: string;
    color?: string;
    guestPermission?: "none" | "read" | "write";
  }
): Promise<CalendarWithCount> {
  const response = await fetch(`/api/calendars/${calendarId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  // Check for rate-limit error first
  if (isRateLimitError(response)) {
    throw new RateLimitError(response);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to update calendar");
  }

  return response.json();
}

async function deleteCalendarApi(calendarId: string): Promise<void> {
  const response = await fetch(`/api/calendars/${calendarId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  // Check for rate-limit error first
  if (isRateLimitError(response)) {
    throw new RateLimitError(response);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete calendar: ${response.status} ${response.statusText} - ${errorText}`
    );
  }
}

// Context types for optimistic updates
interface CreateCalendarContext {
  previous: CalendarWithCount[] | undefined;
}

interface UpdateCalendarContext {
  previous: CalendarWithCount[] | undefined;
}

interface DeleteCalendarContext {
  previous: CalendarWithCount[] | undefined;
  previousSelected: string | undefined;
}

export function useCalendars(initialCalendarId?: string | null) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [selectedCalendar, setSelectedCalendar] = useState<
    string | undefined
  >();

  // Capture initialCalendarId on mount to prevent dependency changes
  const initialCalendarIdRef = useRef(initialCalendarId);

  // Data fetching with React Query
  const {
    data: calendars = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: queryKeys.calendars.all,
    queryFn: fetchCalendarsApi,
    refetchInterval: REFETCH_INTERVAL,
  });

  // Auto-select calendar when data loads
  useEffect(() => {
    if (calendars.length > 0 && !selectedCalendar) {
      const initial = initialCalendarIdRef.current;
      const found = calendars.find((c) => c.id === initial);
      const initialId = found?.id || calendars[0].id;
      queueMicrotask(() => setSelectedCalendar(initialId));
    }
  }, [calendars, selectedCalendar]);

  // Create mutation with optimistic update
  const createMutation = useMutation<
    CalendarWithCount,
    Error,
    { name: string; color: string },
    CreateCalendarContext
  >({
    mutationFn: ({ name, color }) => createCalendarApi(name, color),
    onMutate: async ({ name, color }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendars.all });

      const previous = queryClient.getQueryData<CalendarWithCount[]>(
        queryKeys.calendars.all
      );

      const optimisticCalendar: CalendarWithCount = {
        id: `temp-${Date.now()}`,
        name,
        color,
        guestPermission: "none",
        ownerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: 0,
      };

      queryClient.setQueryData<CalendarWithCount[]>(
        queryKeys.calendars.all,
        (old = []) => [...old, optimisticCalendar]
      );

      // Auto-select new calendar
      setSelectedCalendar(optimisticCalendar.id);

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.calendars.all, context.previous);
      }
      // Skip duplicate notifications for rate limit errors (already handled by wrapper)
      if (err instanceof RateLimitError) {
        return;
      }
      console.error("Failed to create calendar:", err);
      toast.error(t("common.createError", { item: t("calendar.title") }));
    },
    onSuccess: (newCalendar) => {
      // Update selection with real ID
      setSelectedCalendar(newCalendar.id);
      toast.success(t("common.created", { item: t("calendar.title") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
    },
  });

  // Update mutation with optimistic update
  const updateMutation = useMutation<
    CalendarWithCount,
    Error,
    {
      calendarId: string;
      updates: {
        name?: string;
        color?: string;
        guestPermission?: "none" | "read" | "write";
      };
    },
    UpdateCalendarContext
  >({
    mutationFn: ({ calendarId, updates }) =>
      updateCalendarApi(calendarId, updates),
    onMutate: async ({ calendarId, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendars.all });

      const previous = queryClient.getQueryData<CalendarWithCount[]>(
        queryKeys.calendars.all
      );

      queryClient.setQueryData<CalendarWithCount[]>(
        queryKeys.calendars.all,
        (old = []) =>
          old.map((cal) =>
            cal.id === calendarId ? { ...cal, ...updates } : cal
          )
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.calendars.all, context.previous);
      }
      // Skip duplicate notifications for rate limit errors (already handled by wrapper)
      if (err instanceof RateLimitError) {
        return;
      }
      console.error("Failed to update calendar:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("common.updateError", { item: t("calendar.title") });
      toast.error(errorMessage);
    },
    onSuccess: () => {
      toast.success(t("common.updated", { item: t("calendar.title") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
    },
  });

  // Delete mutation with optimistic update
  const deleteMutation = useMutation<
    void,
    Error,
    string,
    DeleteCalendarContext
  >({
    mutationFn: (calendarId) => deleteCalendarApi(calendarId),
    onMutate: async (calendarId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendars.all });

      const previous = queryClient.getQueryData<CalendarWithCount[]>(
        queryKeys.calendars.all
      );
      const previousSelected = selectedCalendar;

      queryClient.setQueryData<CalendarWithCount[]>(
        queryKeys.calendars.all,
        (old = []) => {
          const remaining = old.filter((c) => c.id !== calendarId);

          // Update selected calendar if deleted
          if (selectedCalendar === calendarId) {
            setSelectedCalendar(
              remaining.length > 0 ? remaining[0].id : undefined
            );
          }

          return remaining;
        }
      );

      return { previous, previousSelected };
    },
    onError: (err, calendarId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.calendars.all, context.previous);
      }
      if (context?.previousSelected) {
        setSelectedCalendar(context.previousSelected);
      }
      // Skip duplicate notifications for rate limit errors (already handled by wrapper)
      if (err instanceof RateLimitError) {
        return;
      }
      console.error("Failed to delete calendar:", err);
      toast.error(t("common.deleteError", { item: t("calendar.title") }));
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("calendar.title") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
    },
  });

  // Wrapper for createCalendar to handle rate limiting
  const createCalendar = async (name: string, color: string) => {
    try {
      // Call mutation once - it handles optimistic updates, toasts, and cache invalidation
      await createMutation.mutateAsync({ name, color });
    } catch (error) {
      // Handle rate-limit errors specifically
      if (error instanceof RateLimitError) {
        await handleRateLimitError(error.response, t);
      }
      // Other errors are already handled by createMutation's onError handler
    }
  };

  // Wrapper for updateCalendar to maintain original signature
  const updateCalendar = async (
    calendarId: string,
    updates: {
      name?: string;
      color?: string;
      guestPermission?: "none" | "read" | "write";
    }
  ) => {
    try {
      return await updateMutation.mutateAsync({ calendarId, updates });
    } catch (error) {
      // Handle rate-limit errors specifically
      if (error instanceof RateLimitError) {
        await handleRateLimitError(error.response, t);
      }
      throw error;
    }
  };

  // Wrapper for deleteCalendar to maintain original signature
  const deleteCalendar = async (calendarId: string) => {
    try {
      return await deleteMutation.mutateAsync(calendarId);
    } catch (error) {
      // Handle rate-limit errors specifically
      if (error instanceof RateLimitError) {
        await handleRateLimitError(error.response, t);
      }
      throw error;
    }
  };

  return {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading: isLoading,
    hasLoadedOnce: isFetched,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    refetchCalendars: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all }),
  };
}
