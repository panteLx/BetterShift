"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { isAuthEnabled, allowUserRegistration } from "@/lib/auth/feature-flags";

/**
 * Registration page for new users
 *
 * Features:
 * - Email/Password registration
 * - Name field
 * - Password confirmation
 * - Validation
 * - Redirect to login after success
 */
export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      toast.success(t("auth.registerSuccess"));
      router.push("/login");
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(t("auth.registerError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect if auth disabled or registration not allowed
  useEffect(() => {
    if (!authEnabled) {
      router.push("/");
    } else if (!registrationAllowed) {
      router.push("/login");
    }
  }, [authEnabled, registrationAllowed, router]);

  if (!authEnabled || !registrationAllowed) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {t("auth.registerTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.registerDescription")}
          </p>
        </div>

        {/* Registration Form */}
        <div className="rounded-lg border border-border/50 bg-card p-8 shadow-lg">
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
  );
}
