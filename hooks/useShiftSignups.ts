import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-error";
import { ShiftSignupUser, CalendarMember } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

async function fetchSignupsApi(shiftId: string): Promise<ShiftSignupUser[]> {
  const response = await fetch(`/api/shifts/${shiftId}/signups`);
  if (!response.ok) {
    throw new ApiError(`Failed to fetch signups: ${response.statusText}`, response.status);
  }
  return response.json();
}

async function addSignupApi(
  shiftId: string,
  userId?: string
): Promise<{ data: ShiftSignupUser[] } | { error: string; status: number }> {
  const response = await fetch(`/api/shifts/${shiftId}/signups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userId ? { userId } : {}),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return { error: errorData.error || "Failed to add signup", status: response.status };
  }
  return { data: await response.json() };
}

async function removeSignupApi(
  shiftId: string,
  userId: string
): Promise<{ error: string; status: number } | null> {
  const response = await fetch(`/api/shifts/${shiftId}/signups/${userId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return { error: errorData.error || "Failed to remove signup", status: response.status };
  }
  return null;
}

// Maps a server error to the closest shiftSignup.errors.* translation.
function addErrorMessage(
  t: ReturnType<typeof useTranslations>,
  error: string,
  status: number
): string {
  if (status === 409 && /capacity/i.test(error)) return t("shiftSignup.errors.full");
  if (status === 409) return t("shiftSignup.errors.alreadySignedUp");
  if (status === 400) return t("shiftSignup.errors.noAccess");
  return t("shiftSignup.errors.addFailed");
}

/**
 * Client-side mirror of getShiftSignupPermission() on the server. Only a real
 * account may hold a signup, even when a share/access-token grants "write" on
 * the calendar to a guest — useCalendarPermission alone can't tell the two
 * apart, so this is the single place that adds the missing `!!user` check.
 */
export function useShiftSignupPermission(calendarId: string | undefined) {
  const { user } = useAuth();
  const { calendars } = useCalendars();
  const calendarPermission = useCalendarPermission(calendarId);
  const calendar = calendars.find((c) => c.id === calendarId);
  const signupsEnabled = calendar?.signupsEnabled ?? true;
  const allowSelfSignup = calendar?.allowSelfSignup ?? true;

  if (!user || !signupsEnabled) {
    return { canManageOwn: false, canManageOthers: false, signupsEnabled };
  }

  return {
    canManageOwn:
      calendarPermission.canView &&
      (calendarPermission.canEdit || allowSelfSignup),
    canManageOthers: calendarPermission.canEdit,
    signupsEnabled,
  };
}

/** Fire-and-forget self-signup for shift lists that don't render the full sheet. */
export function useQuickSelfSignup() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (shiftId: string) => addSignupApi(shiftId),
    onSuccess: (result, shiftId) => {
      if ("data" in result) {
        queryClient.setQueryData(queryKeys.shiftSignups.byShift(shiftId), result.data);
      } else {
        toast.error(addErrorMessage(t, result.error, result.status));
      }
    },
    onError: () => {
      toast.error(t("shiftSignup.errors.addFailed"));
    },
    onSettled: (_data, _error, shiftId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shiftSignups.byShift(shiftId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
    },
  });

  return {
    signUpForShift: (shiftId: string) => mutation.mutateAsync(shiftId),
    isPending: mutation.isPending,
  };
}

export function useShiftSignups(shiftId: string | undefined) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.shiftSignups.byShift(shiftId!);

  const { data: signups = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSignupsApi(shiftId!),
    enabled: !!shiftId,
  });

  const addMutation = useMutation({
    mutationFn: (userId?: string) => addSignupApi(shiftId!, userId),
    onSuccess: (result) => {
      if ("data" in result) {
        queryClient.setQueryData(queryKey, result.data);
      } else {
        toast.error(addErrorMessage(t, result.error, result.status));
      }
    },
    onError: () => {
      toast.error(t("shiftSignup.errors.addFailed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeSignupApi(shiftId!, userId),
    onSuccess: (result, userId) => {
      if (!result) {
        queryClient.setQueryData<ShiftSignupUser[]>(queryKey, (old = []) =>
          old.filter((u) => u.id !== userId)
        );
      } else {
        toast.error(t("shiftSignup.errors.removeFailed"));
      }
    },
    onError: () => {
      toast.error(t("shiftSignup.errors.removeFailed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all });
    },
  });

  return {
    signups,
    loading: isLoading,
    signUp: (userId?: string) => addMutation.mutateAsync(userId),
    withdraw: (userId: string) => removeMutation.mutateAsync(userId),
    isMutating: addMutation.isPending || removeMutation.isPending,
  };
}

async function fetchCalendarMembersApi(calendarId: string): Promise<CalendarMember[]> {
  const response = await fetch(`/api/calendars/${calendarId}/members`);
  if (!response.ok) {
    throw new ApiError(`Failed to fetch calendar members: ${response.statusText}`, response.status);
  }
  return response.json();
}

/** Owner + shared members of a calendar, used to assign someone else to a shift. */
export function useCalendarMembers(calendarId: string | undefined, enabled: boolean) {
  const { data: members = [], isLoading } = useQuery({
    queryKey: queryKeys.calendarMembers.byCalendar(calendarId!),
    queryFn: () => fetchCalendarMembersApi(calendarId!),
    enabled: !!calendarId && enabled,
  });

  return { members, loading: isLoading };
}
