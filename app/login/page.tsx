"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AuthHeader } from "@/components/auth-header";
import { AppFooter } from "@/components/app-footer";
import { AuthHeaderSkeleton } from "@/components/skeletons/header-skeleton";
import { AuthContentSkeleton } from "@/components/skeletons/auth-content-skeleton";
import { AppFooterSkeleton } from "@/components/skeletons/footer-skeleton";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import {
  isAuthEnabled,
  allowUserRegistration,
  allowGuestAccess,
  getEnabledProviders,
} from "@/lib/auth/feature-flags";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

/**
 * Login page with email/password and OIDC providers
 *
 * Features:
 * - Email/Password authentication
 * - Social login (Google, GitHub, Discord)
 * - Custom OIDC provider
 * - "Continue as Guest" for auth-disabled mode
 * - Dynamic provider list based on env config
 */
export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [justLoggedIn, setJustLoggedIn] = useState(false);
  const versionInfo = useVersionInfo();

  const authEnabled = isAuthEnabled();
  const registrationAllowed = allowUserRegistration();
  const guestAccessAllowed = allowGuestAccess();

  // Get available OAuth providers
  const enabledProviders = getEnabledProviders();
  const hasGoogle = enabledProviders.includes("google");
  const hasGitHub = enabledProviders.includes("github");
  const hasDiscord = enabledProviders.includes("discord");
  const hasCustomOidc = enabledProviders.includes("custom-oidc");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error(t("auth.emailRequired"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        // Check if the error indicates rate limiting (Better Auth wraps 429 errors)
        // The error might contain the fetch response status
        if (result.error.status === 429) {
          // Make a test request to get proper rate limit headers for user-friendly message
          try {
            const testResponse = await fetch("/api/auth/sign-in/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            if (isRateLimitError(testResponse)) {
              await handleRateLimitError(testResponse, t);
              return;
            }
          } catch (e) {
            // If test request fails, show generic rate limit message
            toast.error(t("rateLimit.title"), {
              description: t("rateLimit.fallback"),
            });
            return;
          }
        }

        toast.error(t("auth.loginError"));
        return;
      }

      toast.success(t("auth.loginSuccess"));
      // Mark that user just logged in to trigger navigation
      setJustLoggedIn(true);
    } catch (error) {
      console.error("Login error:", error);
      toast.error(t("auth.loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (
    provider: "google" | "github" | "discord"
  ) => {
    setIsLoading(true);

    try {
      // Get returnUrl from query params for OAuth callback
      const returnUrl = searchParams.get("returnUrl") || "/";
      await signIn.social({
        provider,
        callbackURL: returnUrl,
      });
    } catch (error) {
      console.error(`${provider} login error:`, error);
      toast.error(t("auth.loginError"));
      setIsLoading(false);
    }
  };

  const handleCustomOidcLogin = async () => {
    setIsLoading(true);

    try {
      // Get returnUrl from query params for OAuth callback
      const returnUrl = searchParams.get("returnUrl") || "/";
      await signIn.oauth2({
        providerId: "custom-oidc",
        callbackURL: returnUrl,
      });
    } catch (error) {
      console.error("Custom OIDC login error:", error);
      toast.error(t("auth.loginError"));
      setIsLoading(false);
    }
  };

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect authenticated users ONLY if:
  // 1. They just logged in, OR
  // 2. They have a returnUrl (came from a protected page)
  // This prevents auto-redirect after logout when guest access is enabled
  useEffect(() => {
    if (mounted && isAuthenticated) {
      const returnUrl = searchParams.get("returnUrl");
      if (justLoggedIn || returnUrl) {
        router.replace(returnUrl || "/");
        setJustLoggedIn(false);
      }
    }
  }, [mounted, isAuthenticated, justLoggedIn, searchParams, router]);

  // If auth is disabled, redirect to home
  useEffect(() => {
    if (!authEnabled) {
      router.replace("/");
    }
  }, [authEnabled, router]);

  if (!authEnabled) {
    return null;
  }

  // Prevent hydration mismatch by showing skeleton until mounted
  if (!mounted) {
    return (
      <div className="flex flex-col min-h-screen">
        <AuthHeaderSkeleton />
        <AuthContentSkeleton />
        <AppFooterSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AuthHeader />

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {t("auth.loginTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.loginDescription")}
            </p>
          </div>

          {/* Login Form */}
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 p-8 shadow-lg backdrop-blur-sm">
            <form onSubmit={handleEmailLogin} className="space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("common.loading") : t("auth.login")}
              </Button>
            </form>

            {/* OAuth Providers */}
            {(hasGoogle || hasGitHub || hasDiscord || hasCustomOidc) && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {t("common.or")}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {hasGoogle && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSocialLogin("google")}
                      disabled={isLoading}
                    >
                      {t("auth.continueWith", {
                        provider: t("auth.provider.google"),
                      })}
                    </Button>
                  )}

                  {hasGitHub && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSocialLogin("github")}
                      disabled={isLoading}
                    >
                      {t("auth.continueWith", {
                        provider: t("auth.provider.github"),
                      })}
                    </Button>
                  )}

                  {hasDiscord && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSocialLogin("discord")}
                      disabled={isLoading}
                    >
                      {t("auth.continueWith", {
                        provider: t("auth.provider.discord"),
                      })}
                    </Button>
                  )}

                  {hasCustomOidc && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleCustomOidcLogin}
                      disabled={isLoading}
                    >
                      {t("auth.continueWith", {
                        provider:
                          process.env.NEXT_PUBLIC_CUSTOM_OIDC_NAME ||
                          t("auth.provider.customOidc"),
                      })}
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Continue as Guest */}
            {guestAccessAllowed && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {t("common.or")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full border-2 border-dashed border-border/50 hover:border-primary/50 hover:bg-primary/5"
                  onClick={() => {
                    const returnUrl = searchParams.get("returnUrl") || "/";
                    // Use replace instead of push to avoid login redirect loop
                    router.replace(returnUrl);
                  }}
                  disabled={isLoading}
                >
                  {t("auth.continueAsGuest")}
                </Button>
              </>
            )}

            {/* Register Link */}
            {registrationAllowed && (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {t("auth.noAccountYet")}{" "}
                <Link
                  href="/register"
                  className="font-medium text-primary hover:underline"
                >
                  {t("auth.register")}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}
