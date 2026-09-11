"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { signIn } from "@/lib/auth/client";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import {
  AuthDivider,
  AuthShell,
  PasswordInput,
  authInputClass,
} from "@/components/auth-shell";
import {
  DiscordIcon,
  GitHubIcon,
  GoogleIcon,
} from "@/components/auth-provider-icons";
import { Field, InfoNote } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { Building2, Info, ShieldAlert, X } from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";
import {
  isRateLimitError,
  handleRateLimitError,
} from "@/lib/rate-limit-client";

type SocialProvider = "google" | "github" | "discord";

const SOCIAL_ICONS = {
  google: GoogleIcon,
  github: GitHubIcon,
  discord: DiscordIcon,
} as const;

const secondaryButtonClass =
  "h-10 rounded-[9px] text-[13.5px] font-medium text-fg-body";

const subscribeNoop = () => () => {};

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
  // False during SSR and hydration, true afterwards
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [banInfo, setBanInfo] = useState<{
    reason?: string;
    expiresAt?: string;
  } | null>(null);

  // Redirect authenticated users to home or returnUrl
  useEffect(() => {
    if (mounted && isAuthenticated) {
      const returnUrl = searchParams.get("returnUrl");
      router.replace(returnUrl || "/");
    }
  }, [mounted, isAuthenticated, searchParams, router]);

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
        // Better Auth reports bans as BANNED_USER
        if (
          result.error.code === "BANNED_USER" ||
          result.error.message?.toLowerCase().includes("banned")
        ) {
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
              setBanInfo({
                reason: result.error.message || t("auth.accountBanned"),
              });
            }
          } catch {
            setBanInfo({
              reason: result.error.message || t("auth.accountBanned"),
            });
          }
          return;
        }

        // Better Auth hides the 429 headers; a second request exposes them for the message
        if (result.error.status === 429) {
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
      // Redirect is handled by the effect once isAuthenticated updates
    } catch (error) {
      console.error("Login error:", error);
      toast.error(t("auth.loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: SocialProvider) => {
    setIsLoading(true);

    try {
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

  const socialProviders = (["google", "github", "discord"] as const).filter(
    (provider) => providers[provider]
  );
  const providerLabels: Record<SocialProvider, string> = {
    google: t("auth.provider.google"),
    github: t("auth.provider.github"),
    discord: t("auth.provider.discord"),
  };

  return (
    <AuthShell title={t("auth.login")} description={t("authPage.loginSubtitle")}>
      {banInfo && (
        <StatusBanner
          tone="danger"
          icon={ShieldAlert}
          title={t("auth.accountBanned")}
          action={
            <button
              type="button"
              onClick={() => setBanInfo(null)}
              aria-label={t("common.close")}
              className="flex size-7 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger-soft"
            >
              <X className="size-4" />
            </button>
          }
        >
          {banInfo.reason && <p>{banInfo.reason}</p>}
          <p className="mt-1 text-[12px]">
            {banInfo.expiresAt
              ? t("admin.bannedUntil", {
                  date: format(new Date(banInfo.expiresAt), "PPP", {
                    locale: dateLocale,
                  }),
                })
              : t("admin.bannedPermanently")}
          </p>
        </StatusBanner>
      )}

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
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

        <Field label={t("common.labels.password")} htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={t("auth.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
          />
        </Field>

        <Button
          type="submit"
          className="h-11 w-full rounded-[9px] text-[15px] font-semibold"
          disabled={isLoading}
        >
          {isLoading ? t("common.loading") : t("auth.login")}
        </Button>
      </form>

      {(socialProviders.length > 0 || oidc.enabled) && (
        <>
          <AuthDivider>{t("common.or")}</AuthDivider>

          <div className="flex flex-col gap-2">
            {socialProviders.length > 0 && (
              <div
                className={cn(
                  "grid gap-2",
                  socialProviders.length === 3 && "grid-cols-3",
                  socialProviders.length === 2 && "grid-cols-2"
                )}
              >
                {socialProviders.map((provider) => {
                  const Icon = SOCIAL_ICONS[provider];
                  return (
                    <Button
                      key={provider}
                      type="button"
                      variant="outline"
                      className={cn(secondaryButtonClass, "px-2")}
                      onClick={() => handleSocialLogin(provider)}
                      disabled={isLoading}
                    >
                      <Icon className="size-4" />
                      {providerLabels[provider]}
                    </Button>
                  );
                })}
              </div>
            )}

            {oidc.enabled && (
              <Button
                type="button"
                variant="outline"
                className={secondaryButtonClass}
                onClick={handleCustomOidcLogin}
                disabled={isLoading}
              >
                <Building2 className="size-4" />
                {t("authPage.signInWith", {
                  provider: oidc.name || t("auth.provider.customOidc"),
                })}
              </Button>
            )}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        {allowGuest && (
          <button
            type="button"
            className="flex h-10 items-center justify-center rounded-[9px] border border-dashed border-control text-[13.5px] font-medium text-fg-secondary transition-colors hover:bg-surface-panel disabled:pointer-events-none disabled:opacity-50"
            onClick={() => {
              const returnUrl = searchParams.get("returnUrl") || "/";
              // replace, not push, so Back does not loop into the login redirect
              router.replace(returnUrl);
            }}
            disabled={isLoading}
          >
            {t("auth.continueAsGuest")}
          </button>
        )}

        {allowRegistration ? (
          <p className="text-center text-[13.5px] text-fg-secondary">
            {t("auth.noAccountYet")}{" "}
            <Link
              href="/register"
              className="font-semibold text-brand-ink hover:underline"
            >
              {t("auth.register")}
            </Link>
          </p>
        ) : (
          <InfoNote icon={Info}>
            <div className="font-semibold text-fg-body">
              {t("auth.registrationDisabled")}
            </div>
            {t("auth.registrationDisabledDescription")}
          </InfoNote>
        )}
      </div>
    </AuthShell>
  );
}
