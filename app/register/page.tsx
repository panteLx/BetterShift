"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";
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
import { isAuthEnabled, allowUserRegistration } from "@/lib/auth/feature-flags";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const versionInfo = useVersionInfo();

  const authEnabled = isAuthEnabled();
  const registrationAllowed = allowUserRegistration();

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
      toast.error(t("auth.passwordRequired"));
      return;
    }

    if (password.length < 8) {
      toast.error(t("auth.passwordTooShort"));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t("auth.passwordsNoMatch"));
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
    if (!authEnabled) {
      router.replace("/");
    } else if (!registrationAllowed) {
      router.replace("/login");
    }
  }, [authEnabled, registrationAllowed, router]);

  if (!authEnabled || !registrationAllowed) {
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
                <Label htmlFor="name">{t("auth.name")}</Label>
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
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  {t("auth.passwordTooShort")}
                </p>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {t("auth.confirmPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("auth.confirmPassword")}
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
