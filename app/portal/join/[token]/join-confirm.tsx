"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import {
  WorkspaceApiError,
  useJoinLinkInfo,
  useRedeemJoinLink,
  useWorkspaceHref,
} from "@/hooks/useWorkspaces";
import { handleRateLimitError } from "@/lib/rate-limit-client";

const primaryButtonClass = "h-11 w-full rounded-[9px] text-[15px] font-semibold";

function BackToOverview() {
  const t = useTranslations();
  return (
    <Link
      href="/"
      className="flex items-center justify-center gap-1.5 border-t border-line pt-4 text-[13.5px] font-semibold text-brand-ink hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t("workspaces.backToOverview")}
    </Link>
  );
}

function errorStatus(error: unknown): number | null {
  return error instanceof WorkspaceApiError ? error.status : null;
}

export function JoinConfirm({ token }: { token: string }) {
  const t = useTranslations();
  const href = useWorkspaceHref();
  const info = useJoinLinkInfo(token);
  const redeem = useRedeemJoinLink(token);
  const [invalidated, setInvalidated] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const loginUrl = `/login?returnUrl=${encodeURIComponent(`/join/${token}`)}`;
  const handledError = useRef<unknown>(null);

  // The rate-limit toast reads the response body, so it must run once per error, not per render.
  useEffect(() => {
    const error = info.error;
    if (!error || error === handledError.current) return;
    handledError.current = error;
    if (error instanceof WorkspaceApiError && error.rateLimitResponse) {
      void handleRateLimitError(error.rateLimitResponse, t);
    }
  }, [info.error, t]);

  // A link, not an automatic redirect: /login bounces a still-valid page session straight back here.
  if (signedOut || (info.isError && errorStatus(info.error) === 401)) {
    return (
      <AuthShell title={t("common.error")} description={t("workspaces.joinSignedOut")}>
        <Button asChild className={primaryButtonClass}>
          <Link href={loginUrl}>{t("auth.login")}</Link>
        </Button>
      </AuthShell>
    );
  }

  // Only a 404 means the link itself is bad; anything else (429, 5xx, network) is retryable.
  if (invalidated || (info.isError && errorStatus(info.error) === 404)) {
    return (
      <AuthShell title={t("workspaces.linkInvalid")} description={t("workspaces.linkInvalidDescription")}>
        <BackToOverview />
      </AuthShell>
    );
  }

  if (info.isError) {
    return (
      <AuthShell title={t("common.error")} description={t("workspaces.joinLoadError")}>
        <Button
          type="button"
          className={primaryButtonClass}
          onClick={() => void info.refetch()}
          disabled={info.isFetching}
        >
          {info.isFetching ? t("common.loading") : t("calendarView.retry")}
        </Button>
        <BackToOverview />
      </AuthShell>
    );
  }

  if (info.isPending) {
    return (
      <AuthShell title={t("workspaces.joinTitle")}>
        <div role="status" aria-live="polite" className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-brand" aria-hidden />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      </AuthShell>
    );
  }

  const { workspace, alreadyMember } = info.data;

  // POST only from the click: a GET (e.g. a link preview) must never consume a use.
  const handleJoin = () => {
    redeem.mutate(undefined, {
      onSuccess: (result) => window.location.assign(href(result.workspace.slug)),
      onError: async (error) => {
        if (error instanceof WorkspaceApiError && error.rateLimitResponse) {
          await handleRateLimitError(error.rateLimitResponse, t);
          return;
        }
        if (error instanceof WorkspaceApiError && error.status === 404) {
          setInvalidated(true);
          return;
        }
        if (error instanceof WorkspaceApiError && error.status === 401) {
          setSignedOut(true);
          return;
        }
        toast.error(t("common.error"));
      },
    });
  };

  const isJoining = redeem.isPending || redeem.isSuccess;

  return (
    <AuthShell title={t("workspaces.joinTitle")}>
      <div className="flex items-center gap-3 rounded-[10px] border border-line bg-surface-card px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
          <Building2 className="size-[18px]" aria-hidden />
        </span>
        <p className="min-w-0 text-[14px] text-fg-body">
          {alreadyMember
            ? t("workspaces.alreadyMember", { workspace: workspace.name })
            : t("workspaces.joinDescription", { workspace: workspace.name })}
        </p>
      </div>

      {alreadyMember ? (
        <Button asChild className={primaryButtonClass}>
          <a href={href(workspace.slug)}>{t("workspaces.open")}</a>
        </Button>
      ) : (
        <Button type="button" className={primaryButtonClass} onClick={handleJoin} disabled={isJoining}>
          {isJoining ? t("common.loading") : t("workspaces.joinButton")}
        </Button>
      )}

      <BackToOverview />
    </AuthShell>
  );
}
