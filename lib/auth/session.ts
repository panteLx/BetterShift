import { auth } from "@/lib/auth";
import { isAuthEnabled } from "@/lib/auth/feature-flags";

/**
 * Get current user session from request headers
 * Returns null if auth is disabled or user is not authenticated
 */
export async function getSessionUser(
  headers: Headers
): Promise<{ id: string; email: string; name: string } | null> {
  // If auth is disabled, return null (single-user mode)
  if (!isAuthEnabled()) {
    return null;
  }

  try {
    const session = await auth.api.getSession({ headers });
    return session?.user || null;
  } catch (error) {
    console.error("Failed to get session:", error);
    return null;
  }
}

/**
 * Check if user is authenticated
 * When auth is disabled, always returns true (backwards compatibility)
 */
export async function isAuthenticated(headers: Headers): Promise<boolean> {
  // If auth is disabled, always allow (single-user mode)
  if (!isAuthEnabled()) {
    return true;
  }

  const user = await getSessionUser(headers);
  return user !== null;
}
