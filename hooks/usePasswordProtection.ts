import { useCallback } from "react";

interface UsePasswordProtectionOptions {
  calendarId: string;
  onPasswordRequired: (action: () => Promise<void>) => void;
}

export function usePasswordProtection({
  calendarId,
  onPasswordRequired,
}: UsePasswordProtectionOptions) {
  const verifyPassword = useCallback(async (): Promise<boolean> => {
    const password = localStorage.getItem(`calendar_password_${calendarId}`);

    try {
      const response = await fetch(
        `/api/calendars/${calendarId}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json();

      if (data.protected && !data.valid) {
        localStorage.removeItem(`calendar_password_${calendarId}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to verify password:", error);
      return false;
    }
  }, [calendarId]);

  const withPasswordCheck = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | null> => {
      const isValid = await verifyPassword();

      if (!isValid) {
        await onPasswordRequired(async () => {
          await action();
        });
        return null;
      }

      return await action();
    },
    [verifyPassword, onPasswordRequired]
  );

  const getPassword = useCallback(() => {
    return localStorage.getItem(`calendar_password_${calendarId}`);
  }, [calendarId]);

  return {
    verifyPassword,
    withPasswordCheck,
    getPassword,
  };
}
