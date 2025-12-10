import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  getCachedPassword,
  verifyAndCachePassword,
} from "@/lib/password-cache";
import { Calendar } from "@/lib/db/schema";
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
  calendars: Calendar[]
) {
  const t = useTranslations();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const [isCalendarUnlocked, setIsCalendarUnlocked] = useState(true);
  const [isVerifyingCalendarPassword, setIsVerifyingCalendarPassword] =
    useState(false);
  const [passwordCacheTrigger, setPasswordCacheTrigger] = useState(0);

  const selectedCalendarData = useMemo(() => {
    return calendars.find((c) => c.id === selectedCalendar);
  }, [calendars, selectedCalendar]);

  const shouldHideUIElements = useMemo(() => {
    if (!selectedCalendar || !selectedCalendarData) return false;
    const requiresPassword = !!selectedCalendarData.passwordHash;
    const hasPassword = !!getCachedPassword(selectedCalendar);
    return requiresPassword && !hasPassword;
  }, [selectedCalendar, selectedCalendarData, passwordCacheTrigger]);

  const selectedCalendarIsLocked = useMemo(() => {
    if (!selectedCalendar) return false;
    const currentCalendar = calendars.find((c) => c.id === selectedCalendar);
    return currentCalendar?.isLocked ?? false;
  }, [selectedCalendar, calendars]);

  // Verify password when calendar changes
  useEffect(() => {
    if (!selectedCalendar) {
      setIsCalendarUnlocked(true);
      setIsVerifyingCalendarPassword(false);
      return;
    }

    if (selectedCalendarIsLocked) {
      const cachedPassword = getCachedPassword(selectedCalendar);

      if (cachedPassword) {
        setIsVerifyingCalendarPassword(true);
        setIsCalendarUnlocked(false);

        verifyAndCachePassword(selectedCalendar, cachedPassword)
          .then((result) => {
            setIsCalendarUnlocked(result.valid);
          })
          .catch(() => {
            setIsCalendarUnlocked(false);
          })
          .finally(() => {
            setIsVerifyingCalendarPassword(false);
          });
      } else {
        setIsCalendarUnlocked(false);
        setIsVerifyingCalendarPassword(false);
      }
    } else {
      setIsCalendarUnlocked(true);
      setIsVerifyingCalendarPassword(false);
    }
  }, [selectedCalendar, selectedCalendarIsLocked]);

  const handlePasswordSuccess = useCallback(() => {
    setPasswordCacheTrigger((prev) => prev + 1);
  }, []);

  const verifyPasswordForAction = useCallback(
    async (action: () => Promise<void>) => {
      if (!selectedCalendar) return false;

      const calendar = calendars.find((c) => c.id === selectedCalendar);
      if (!calendar) return false;

      if (calendar.passwordHash) {
        const cachedPassword = getCachedPassword(selectedCalendar);

        if (cachedPassword) {
          const result = await verifyAndCachePassword(
            selectedCalendar,
            cachedPassword
          );
          if (result.valid) {
            await action();
            return true;
          }
        }

        setPendingAction({ type: "edit", action });
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
