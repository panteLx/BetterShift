"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { AuthHeader } from "@/components/auth-header";
import { AppFooter } from "@/components/app-footer";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
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
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { isAuthEnabled, allowRegistration, allowGuest, providers, oidc } =
    useAuthFeatures();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [banInfo, setBanInfo] = useState<{
    reason?: string;
    expiresAt?: string;
  } | null>(null);
  const versionInfo = useVersionInfo();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect authenticated users to home or returnUrl
  useEffect(() => {
    if (mounted && isAuthenticated) {
      const returnUrl = searchParams.get("returnUrl");
      router.replace(returnUrl || "/");
    }
  }, [mounted, isAuthenticated, searchParams, router]);

  // If auth is disabled, redirect to home
  useEffect(() => {
    if (!isAuthEnabled) {
      router.replace("/");
    }
  }, [isAuthEnabled, router]);

  if (!isAuthEnabled) {
    return null;
  }

  // Prevent hydration mismatch by showing loader until mounted
  if (!mounted) {
    return <FullscreenLoader />;
  }

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
        // Check if user is banned (Better Auth returns BANNED_USER code)
        if (
          result.error.code === "BANNED_USER" ||
          result.error.message?.toLowerCase().includes("banned")
        ) {
          // Fetch ban details from our API
          try {
            const banResponse = await fetch("/api/auth/ban-info", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });

            if (banResponse.ok) {
              const banData = await banResponse.json();
              setBanInfo({
                reason: banData.banReason,
                expiresAt: banData.banExpires,
              });
            } else {
              // Fallback if API fails
              setBanInfo({
                reason: result.error.message || t("auth.accountBanned"),
              });
            }
          } catch {
            // Fallback if fetch fails
            setBanInfo({
              reason: result.error.message || t("auth.accountBanned"),
            });
          }
          return;
        }

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
          } catch {
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
      // Redirect will be handled by useEffect when isAuthenticated updates
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

  if (!isAuthEnabled) {
    return null;
  }

  // Prevent hydration mismatch by showing loader until mounted
  if (!mounted) {
    return <FullscreenLoader />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AuthHeader />

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* Ban Warning Banner */}
          {banInfo && (
            <div className="relative rounded-lg border-2 border-destructive bg-destructive/5 p-4 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500">
              <button
                onClick={() => setBanInfo(null)}
                className="absolute top-2 right-2 p-1 rounded-md hover:bg-destructive/10 transition-colors"
              >
                <X className="h-4 w-4 text-destructive" />
              </button>
              <div className="flex gap-3 pr-6">
                <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-destructive text-lg">
                    {t("auth.accountBanned")}
                  </h3>
                  {banInfo.reason && (
                    <p className="text-sm text-foreground">{banInfo.reason}</p>
                  )}
                  {banInfo.expiresAt ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("admin.bannedUntil", {
                        date: format(new Date(banInfo.expiresAt), "PPP", {
                          locale: dateLocale,
                        }),
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("admin.bannedPermanently")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Registration Disabled Info Banner */}
          {!allowRegistration && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">
                    {t("auth.registrationDisabled")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("auth.registrationDisabledDescription")}
                  </p>
                </div>
              </div>
            </div>
          )}

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
                <Label htmlFor="email">{t("common.labels.email")}</Label>
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
                <Label htmlFor="password">{t("common.labels.password")}</Label>
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
            {(providers.hasAny || oidc.enabled) && (
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
                  {providers.google && (
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

                  {providers.github && (
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

                  {providers.discord && (
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

                  {oidc.enabled && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleCustomOidcLogin}
                      disabled={isLoading}
                    >
                      {t("auth.continueWith", {
                        provider: oidc.name || t("auth.provider.customOidc"),
                      })}
                    </Button>
                  )}
                </div>
              </>
            )}

            {/* Continue as Guest */}
            {allowGuest && (
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
            {allowRegistration && (
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
