"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { signUp } from "@/lib/auth/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import {
  AuthShell,
  PasswordInput,
  authInputClass,
} from "@/components/auth-shell";
import { Field } from "@/components/form-kit";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

const subscribeNoop = () => () => {};

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
  // False during SSR and hydration, true afterwards
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

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
        // Better Auth hides the 429 headers; a second request exposes them for the message
        if (result.error.status === 429) {
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

      // Better Auth signs the user in after sign-up; the session update navigates away
      toast.success(t("auth.registerSuccess"));
    } catch (error) {
      console.error("Registration error:", error);
      toast.error(t("auth.registerError"));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.replace("/");
    }
  }, [mounted, isAuthenticated, router]);

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

  // Also covers the moment between sign-up and the redirect
  if (!mounted || isAuthenticated) {
    return <FullscreenLoader />;
  }

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <AuthShell
      title={t("authPage.registerTitle")}
      description={t("authPage.registerSubtitle")}
    >
      <form onSubmit={handleRegister} className="flex flex-col gap-3">
        <Field label={t("common.labels.name")} htmlFor="name">
          <Input
            id="name"
            type="text"
            autoComplete="name"
            placeholder={t("auth.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLoading}
            required
            className={authInputClass}
          />
        </Field>

        <Field label={t("common.labels.email")} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            className={authInputClass}
          />
        </Field>

        <Field
          label={t("common.labels.password")}
          htmlFor="password"
          hint={t("authPage.passwordHint")}
        >
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            minLength={8}
          />
        </Field>

        <Field label={t("authPage.repeatPassword")} htmlFor="confirmPassword">
          <div className="relative">
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              minLength={8}
              className={cn(authInputClass, "pr-11")}
            />
            {passwordsMatch && (
              <span className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-success">
                <Check className="size-[17px]" aria-hidden="true" />
                <span className="sr-only">{t("authPage.passwordsMatch")}</span>
              </span>
            )}
          </div>
        </Field>

        <Button
          type="submit"
          className="h-11 w-full rounded-[9px] text-[15px] font-semibold"
          disabled={isLoading}
        >
          {isLoading ? t("common.loading") : t("authPage.registerTitle")}
        </Button>
      </form>

      <p className="border-t border-line pt-4 text-center text-[13.5px] text-fg-secondary">
        {t("authPage.haveAccount")}{" "}
        <Link href="/login" className="font-semibold text-brand-ink hover:underline">
          {t("auth.login")}
        </Link>
      </p>
    </AuthShell>
  );
}
