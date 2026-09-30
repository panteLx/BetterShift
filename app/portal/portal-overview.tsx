"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, Building2, Loader2, Plus, Shield } from "lucide-react";
import { AuthDivider, AuthShell, authInputClass } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsAdmin } from "@/hooks/useAdminAccess";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useMyWorkspaces, useWorkspaceHref, type MyWorkspace } from "@/hooks/useWorkspaces";
import { SignOutButton } from "./sign-out-button";

const primaryButtonClass = "h-11 w-full rounded-[9px] text-[15px] font-semibold";

// Accepts a full invite URL (any host) or the bare 43-character token.
function extractJoinToken(value: string): string | null {
  const trimmed = value.trim();
  const match =
    trimmed.match(/\/join\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/) ??
    trimmed.match(/^([A-Za-z0-9_-]{43})$/);
  return match ? match[1] : null;
}

export function PortalOverview() {
  const t = useTranslations();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { data, isPending, isError } = useMyWorkspaces("portal");
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState(false);

  const limitReached = !!data && data.ownedCount >= data.maxOwned;

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractJoinToken(joinValue);
    if (!token) {
      setJoinError(true);
      return;
    }
    router.push(`/join/${token}`);
  };

  return (
    <AuthShell title={t("workspaces.portalTitle")} description={t("workspaces.portalDescription")}>
      {isPending ? (
        <div role="status" aria-live="polite" className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-brand" aria-hidden />
          <span className="sr-only">{t("common.loading")}</span>
        </div>
      ) : isError ? (
        <p className="text-[13.5px] text-danger">{t("common.error")}</p>
      ) : data.workspaces.length === 0 ? (
        <p className="rounded-[9px] border border-dashed border-control px-4 py-5 text-center text-[13.5px] text-fg-secondary">
          {t("workspaces.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.workspaces.map((workspace) => (
            <li key={workspace.id}>
              <WorkspaceCard workspace={workspace} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-1.5">
        {limitReached ? (
          <Button type="button" className={primaryButtonClass} disabled>
            <Plus className="size-4" />
            {t("workspaces.create")}
          </Button>
        ) : (
          <Button asChild className={primaryButtonClass}>
            <Link href="/new">
              <Plus className="size-4" />
              {t("workspaces.create")}
            </Link>
          </Button>
        )}
        {limitReached && (
          <p className="text-[12px] text-fg-tertiary">
            {t("workspaces.limitReached", { max: data.maxOwned })}
          </p>
        )}
      </div>

      <AuthDivider>{t("common.or")}</AuthDivider>

      <form onSubmit={handleJoin} className="flex flex-col gap-2" noValidate>
        <div className="flex gap-2">
          <Input
            aria-label={t("workspaces.joinLinkPlaceholder")}
            placeholder={t("workspaces.joinLinkPlaceholder")}
            value={joinValue}
            onChange={(e) => {
              setJoinValue(e.target.value);
              setJoinError(false);
            }}
            aria-invalid={joinError}
            className={authInputClass}
          />
          <Button
            type="submit"
            variant="outline"
            className="h-[42px] shrink-0 rounded-[9px] text-[13.5px] font-medium"
            disabled={!joinValue.trim()}
          >
            {t("workspaces.joinWithLink")}
          </Button>
        </div>
        {joinError && (
          <p role="alert" className="text-[12px] text-danger">
            {t("workspaces.joinLinkInvalidFormat")}
          </p>
        )}
      </form>

      <div className="flex flex-wrap justify-center gap-1 border-t border-line pt-4">
        {isAdmin && (
          <Button asChild variant="ghost" className="h-9 gap-2 rounded-[9px] text-[13.5px] font-medium text-fg-secondary">
            <Link href="/admin">
              <Shield className="size-4" />
              {t("admin.adminPanel")}
            </Link>
          </Button>
        )}
        <SignOutButton label={t("auth.logout")} />
      </div>
    </AuthShell>
  );
}

function WorkspaceCard({ workspace }: { workspace: MyWorkspace }) {
  const t = useTranslations();
  const href = useWorkspaceHref();
  const { tenantBaseDomain } = usePublicConfig();
  const role =
    workspace.role === "owner"
      ? t("workspaces.roleOwner")
      : workspace.role === "admin"
        ? t("workspaces.roleAdmin")
        : t("workspaces.roleMember");

  return (
    // Full navigation: the workspace lives on another origin.
    <a
      href={href(workspace.slug)}
      className="group flex items-center gap-3 rounded-[10px] border border-line bg-surface-card px-3.5 py-3 transition-colors hover:border-control hover:bg-surface-panel focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-ink">
        <Building2 className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14px] font-semibold text-fg-strong">{workspace.name}</span>
        <span className="truncate font-mono text-[11.5px] text-fg-tertiary">
          {workspace.slug}.{tenantBaseDomain}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[11.5px] font-medium text-fg-secondary">
        {role}
      </span>
      <span className="sr-only">{t("workspaces.open")}</span>
      <ArrowRight
        className="size-4 shrink-0 text-fg-tertiary transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </a>
  );
}
