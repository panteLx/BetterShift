"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { usePublicConfig } from "@/hooks/usePublicConfig";

/**
 * Auth Provider for client-side session management
 *
 * Features:
 * - Checks auth status on mount
 * - Redirects to login if not authenticated (unless guest access enabled)
 * - Handles loading states
 * - Respects auth and guest access feature flags
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { auth } = usePublicConfig();

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/register"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Set mounted after initial render to avoid hydration mismatch
  // This is a legitimate pattern for SSR hydration - calling setState in useLayoutEffect
  // is the recommended approach to avoid hydration mismatches in client components.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Skip auth check if auth is disabled
    if (!auth.enabled) {
      return;
    }

    // Wait for loading to complete
    if (isLoading) {
      return;
    }

    // Don't auto-redirect from login/register pages - let those pages handle their own navigation
    // This allows users to stay on login after logout when guest access is enabled
    if (isPublicRoute) {
      return;
    }

    // Redirect unauthenticated users from protected routes to login
    // ONLY if guest access is NOT allowed
    if (!isPublicRoute && !isAuthenticated && !auth.allowGuestAccess) {
      const loginUrl = `/login?returnUrl=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
    }
  }, [
    mounted,
    isAuthenticated,
    isLoading,
    auth.enabled,
    auth.allowGuestAccess,
    isPublicRoute,
    pathname,
    router,
  ]);

  // Show nothing until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (auth.enabled && !isPublicRoute && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated (unless guest access allowed)
  if (
    auth.enabled &&
    !isPublicRoute &&
    !isAuthenticated &&
    !isLoading &&
    !auth.allowGuestAccess
  ) {
    return null;
  }

  return <>{children}</>;
}
