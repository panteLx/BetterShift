import { useCallback } from "react";
import {
  getCachedPassword,
  verifyAndCachePassword,
} from "@/lib/password-cache";

interface UsePasswordProtectionOptions {
  calendarId: string;
  onPasswordRequired: (action: () => Promise<void>) => void;
}

export function usePasswordProtection({
  calendarId,
  onPasswordRequired,
}: UsePasswordProtectionOptions) {
  const verifyPassword = useCallback(async (): Promise<boolean> => {
    const password = getCachedPassword(calendarId);
    const result = await verifyAndCachePassword(calendarId, password);
    return result.valid;
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
    return getCachedPassword(calendarId);
  }, [calendarId]);

  return {
    verifyPassword,
    withPasswordCheck,
    getPassword,
  };
}
