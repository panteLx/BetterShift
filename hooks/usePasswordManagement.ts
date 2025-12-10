import { useState, useEffect, useMemo, useCallback } from "react";
import {
  getCachedPassword,
  verifyAndCachePassword,
} from "@/lib/password-cache";
import { CalendarWithCount } from "@/lib/types";
import { ShiftFormData } from "@/components/shift-dialog";

export interface PendingAction {
  type: "delete" | "edit" | "syncNotifications";
  shiftId?: string;
  formData?: ShiftFormData;
  presetAction?: () => Promise<void>;
  noteAction?: () => Promise<void>;
  action?: () => Promise<void>;
}

export function usePasswordManagement(
  selectedCalendar: string | null,
  calendars: CalendarWithCount[]
) {
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [isCalendarUnlocked, setIsCalendarUnlocked] = useState(true);
  const [isVerifyingCalendarPassword, setIsVerifyingCalendarPassword] =
    useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);

  const selectedCalendarData = useMemo(() => {
    return calendars.find((c) => c.id === selectedCalendar);
  }, [calendars, selectedCalendar]);

  const shouldHideUIElements = useMemo(() => {
    if (!selectedCalendar || !selectedCalendarData) return false;
    const requiresPassword = !!selectedCalendarData.passwordHash;
    const hasPassword = !!getCachedPassword(selectedCalendar);
    return requiresPassword && !hasPassword;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCalendar, selectedCalendarData, forceUpdate]);

  const selectedCalendarIsLocked = useMemo(() => {
    if (!selectedCalendar) return false;
    const currentCalendar = calendars.find((c) => c.id === selectedCalendar);
    return currentCalendar?.isLocked ?? false;
  }, [selectedCalendar, calendars]);

  // Verify password when calendar changes
  useEffect(() => {
    let cancelled = false;

    const verifyCalendar = async () => {
      if (!selectedCalendar) {
        if (!cancelled) {
          setIsCalendarUnlocked(true);
          setIsVerifyingCalendarPassword(false);
        }
        return;
      }

      if (selectedCalendarIsLocked) {
        const cachedPassword = getCachedPassword(selectedCalendar);

        if (cachedPassword) {
          if (!cancelled) {
            setIsVerifyingCalendarPassword(true);
            setIsCalendarUnlocked(false);
          }

          verifyAndCachePassword(selectedCalendar, cachedPassword)
            .then((result) => {
              if (!cancelled) {
                setIsCalendarUnlocked(result.valid);
              }
            })
            .catch(() => {
              if (!cancelled) {
                setIsCalendarUnlocked(false);
              }
            })
            .finally(() => {
              if (!cancelled) {
                setIsVerifyingCalendarPassword(false);
              }
            });
        } else {
          if (!cancelled) {
            setIsCalendarUnlocked(false);
            setIsVerifyingCalendarPassword(false);
          }
        }
      } else {
        if (!cancelled) {
          setIsCalendarUnlocked(true);
          setIsVerifyingCalendarPassword(false);
        }
      }
    };

    verifyCalendar();

    return () => {
      cancelled = true;
    };
  }, [selectedCalendar, selectedCalendarIsLocked]);

  const handlePasswordSuccess = useCallback(() => {
    // Password is now verified and cached - trigger re-render to update shouldHideUIElements
    setIsCalendarUnlocked(true);
    setForceUpdate((prev) => prev + 1);
  }, []);

  const verifyPasswordForAction = useCallback(
    async (
      action: () => Promise<void>,
      actionType: "delete" | "edit" | "syncNotifications" = "edit"
    ) => {
      if (!selectedCalendar) return false;

      const calendar = calendars.find((c) => c.id === selectedCalendar);
      if (!calendar) return false;

      if (calendar.passwordHash) {
        const cachedPassword = getCachedPassword(selectedCalendar);

        if (cachedPassword) {
          try {
            const result = await verifyAndCachePassword(
              selectedCalendar,
              cachedPassword
            );
            if (result.valid) {
              await action();
              return true;
            }
          } catch (error) {
            console.error("Failed to verify password:", error);
            // Continue to show password dialog on error
          }
        }

        setPendingAction({ type: actionType, action });
        return false;
      }

      await action();
      return true;
    },
    [selectedCalendar, calendars]
  );

  return {
    pendingAction,
    setPendingAction,
    isCalendarUnlocked,
    setIsCalendarUnlocked,
    isVerifyingCalendarPassword,
    shouldHideUIElements,
    selectedCalendarData,
    handlePasswordSuccess,
    verifyPasswordForAction,
  };
}
