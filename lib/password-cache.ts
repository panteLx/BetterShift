/**
 * Centralized password caching and verification utility
 * Ensures consistent password handling across all components
 */

/**
 * Get cached password from localStorage
 */
export function getCachedPassword(calendarId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`calendar_password_${calendarId}`);
}

/**
 * Cache password in localStorage
 */
export function setCachedPassword(calendarId: string, password: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(`calendar_password_${calendarId}`, password);
}

/**
 * Remove cached password from localStorage
 */
export function removeCachedPassword(calendarId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`calendar_password_${calendarId}`);
}

/**
 * Verify password with the server and cache if valid
 * Returns { valid: boolean, protected: boolean }
 */
export async function verifyAndCachePassword(
  calendarId: string,
  password: string | null
): Promise<{ valid: boolean; protected: boolean }> {
  try {
    const response = await fetch(
      `/api/calendars/${calendarId}/verify-password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }
    );

    if (!response.ok) {
      return { valid: false, protected: true };
    }

    const data = await response.json();

    // If calendar is protected and password is invalid, remove from cache
    if (data.protected && !data.valid) {
      removeCachedPassword(calendarId);
      return { valid: false, protected: true };
    }

    // If valid and password was provided, cache it
    if (data.valid && password) {
      setCachedPassword(calendarId, password);
    }

    return {
      valid: data.valid,
      protected: data.protected,
    };
  } catch (error) {
    console.error("Failed to verify password:", error);
    return { valid: false, protected: true };
  }
}

/**
 * Check if we have a valid cached password
 * This verifies the cached password with the server
 */
export async function hasValidCachedPassword(
  calendarId: string
): Promise<boolean> {
  const cachedPassword = getCachedPassword(calendarId);
  if (!cachedPassword) return false;

  const result = await verifyAndCachePassword(calendarId, cachedPassword);
  return result.valid;
}
