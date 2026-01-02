"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";
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
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

/**
 * Registration page for new users
 *
 * Features:
 * - Email/Password registration
 * - Name field
 * - Password confirmation
 * - Validation
 * - Redirect to dashboard after success
 */
export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { isAuthEnabled, allowRegistration } = useAuthFeatures();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const versionInfo = useVersionInfo();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name) {
      toast.error(t("auth.nameRequired"));
      return;
    }

    if (!email) {
      toast.error(t("auth.emailRequired"));
      return;
    }

    if (!password) {
      toast.error(t("validation.passwordRequired"));
      return;
    }

    if (password.length < 8) {
      toast.error(t("validation.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("validation.passwordsNoMatch"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await signUp.email({
        email,
        password,
        name,
      });

      if (result.error) {
        // Check if the error indicates rate limiting
        if (result.error.status === 429) {
          // Make a test request to get proper rate limit headers
          try {
            const testResponse = await fetch("/api/auth/sign-up/email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password, name }),
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

        console.error("Registration error:", result.error);
        const errorMessage = result.error.message || "";
        if (errorMessage.includes("email")) {
          toast.error(t("auth.emailAlreadyExists"));
        } else {
          toast.error(t("auth.registerError"));
        }
        return;
      }

      // Better Auth automatically signs in the user after signup
      toast.success(t("auth.registerSuccess"));
      // Session update triggers automatic navigation via AuthProvider
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(t("auth.registerError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect authenticated users to home
  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace("/");
    }
  }, [mounted, isAuthenticated, router]);

  // Redirect if auth disabled or registration not allowed
  useEffect(() => {
    if (!isAuthEnabled) {
      router.replace("/");
    } else if (!allowRegistration) {
      router.replace("/login");
    }
  }, [isAuthEnabled, allowRegistration, router]);

  if (!isAuthEnabled || !allowRegistration) {
    return null;
  }

  // Prevent hydration mismatch by showing loader until mounted
  // Also show loader while redirecting authenticated users
  if (!mounted || isAuthenticated) {
    return <FullscreenLoader />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <AuthHeader />

      <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4 py-8">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
              {t("auth.registerTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("auth.registerDescription")}
            </p>
          </div>

          {/* Registration Form */}
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 p-8 shadow-lg backdrop-blur-sm">
            <form onSubmit={handleRegister} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">{t("common.labels.name")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={t("auth.namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>

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
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  {t("validation.passwordTooShort")}
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {t("common.labels.confirmPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("common.labels.confirmPassword")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  minLength={8}
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("common.loading") : t("auth.register")}
              </Button>
            </form>

            {/* Login Link */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.alreadyHaveAccount")}{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                {t("auth.login")}
              </Link>
            </p>
          </div>
        </div>
      </div>

      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}
