"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isAuthEnabled, allowUserRegistration } from "@/lib/auth/feature-flags";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const authEnabled = isAuthEnabled();
  const registrationAllowed = allowUserRegistration();

  // Get available OAuth providers from env
  const hasGoogle = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const hasGitHub = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
  const hasDiscord = !!process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
  const hasCustomOidc = process.env.NEXT_PUBLIC_CUSTOM_OIDC_ENABLED === "true";

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
        toast.error(t("auth.loginError"));
        return;
      }

      toast.success(t("auth.loginSuccess"));
      router.push("/");
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
      await signIn.social({
        provider,
        callbackURL: "/",
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
      await signIn.oauth2({
        providerId: "custom-oidc",
        callbackURL: "/",
      });
    } catch (error) {
      console.error("Custom OIDC login error:", error);
      toast.error(t("auth.loginError"));
      setIsLoading(false);
    }
  };

  // If auth is disabled, redirect to home
  useEffect(() => {
    if (!authEnabled) {
      router.push("/");
    }
  }, [authEnabled, router]);

  if (!authEnabled) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t("auth.loginTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.loginDescription")}
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-lg border border-border/50 bg-card p-8 shadow-lg">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.password")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  {t("auth.forgotPassword")}
                </Link>
              </div>
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
  );
}
