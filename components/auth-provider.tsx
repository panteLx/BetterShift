"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

/**
 * Auth Provider for client-side session management
 *
 * Features:
 * - Checks auth status on mount
 * - Redirects to login if not authenticated
 * - Handles loading states
 * - Respects auth feature flag
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Check auth enabled flag only on client side to avoid hydration mismatch
  const authEnabledFlag =
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_AUTH_ENABLED === "true";

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/register", "/forgot-password"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Skip auth check if auth is disabled
    if (!authEnabledFlag) {
      return;
    }

    // Skip redirect for public routes
    if (isPublicRoute) {
      return;
    }

    // Wait for loading to complete
    if (isLoading) {
      return;
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      const loginUrl = `/login?returnUrl=${encodeURIComponent(pathname)}`;
      router.push(loginUrl);
    }
  }, [
    mounted,
    isAuthenticated,
    isLoading,
    authEnabledFlag,
    isPublicRoute,
    pathname,
    router,
  ]);

  // Show nothing until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (authEnabledFlag && !isPublicRoute && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated
  if (authEnabledFlag && !isPublicRoute && !isAuthenticated && !isLoading) {
    return null;
  }

  return <>{children}</>;
}
