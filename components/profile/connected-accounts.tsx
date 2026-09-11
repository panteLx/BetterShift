"use client";

import { ComponentType } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { KeyRound, Link2, Mail } from "lucide-react";
import { ListRow, Pill } from "@/components/form-kit";
import { PanelBody } from "@/components/panel-dialog";
import { DiscordIcon, GitHubIcon, GoogleIcon } from "@/components/auth-provider-icons";
import { accountContentClass, SectionHeading } from "@/components/profile/account-layout";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import type { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

export type ConnectedAccount = ReturnType<typeof useConnectedAccounts>["accounts"][number];

type ProviderIcon = ComponentType<{ className?: string }>;

/** Display name and mark for a better-auth provider id. */
export function useProviderInfo() {
  const t = useTranslations();
  const { oidc } = useAuthFeatures();

  return (provider: string): { label: string; icon: ProviderIcon } => {
    switch (provider) {
      case "credential":
        return { label: t("auth.emailPasswordAuth"), icon: Mail };
      case "google":
        return { label: t("auth.provider.google"), icon: GoogleIcon };
      case "github":
        return { label: t("auth.provider.github"), icon: GitHubIcon };
      case "discord":
        return { label: t("auth.provider.discord"), icon: DiscordIcon };
      case "custom-oidc":
        return { label: oidc.name || t("auth.provider.customOidc"), icon: KeyRound };
      default:
        return { label: provider.charAt(0).toUpperCase() + provider.slice(1), icon: Link2 };
    }
  };
}

function ConnectedAccountRow({
  account,
  detailed = false,
}: {
  account: ConnectedAccount;
  detailed?: boolean;
}) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const { label, icon: Icon } = useProviderInfo()(account.provider);

  return (
    <ListRow className={cn(!detailed && "rounded-[10px] py-2.5")}>
      <Icon className="size-[17px] shrink-0 text-fg-secondary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-fg-strong">{label}</div>
        {detailed && account.createdAt && (
          <div className="mt-0.5 truncate font-mono text-[12px] text-fg-tertiary">
            {t("profile.connectedSince", {
              date: format(account.createdAt, "PP", { locale: dateLocale }),
            })}
          </div>
        )}
      </div>
      <Pill tone="success">{t("common.status.active")}</Pill>
    </ListRow>
  );
}

export function ConnectedAccountList({
  accounts,
  detailed,
}: {
  accounts: ConnectedAccount[];
  detailed?: boolean;
}) {
  const t = useTranslations();

  if (accounts.length === 0) {
    return (
      <p className="rounded-[11px] border border-dashed border-control px-3.5 py-3 text-center text-[13px] text-fg-tertiary">
        {t("auth.noConnectedAccounts")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {accounts.map((account) => (
        <ConnectedAccountRow key={account.id} account={account} detailed={detailed} />
      ))}
    </div>
  );
}

export function ConnectedAccountsSection({ accounts }: { accounts: ConnectedAccount[] }) {
  const t = useTranslations();

  return (
    <PanelBody>
      <div className={cn(accountContentClass, "flex flex-col gap-4")}>
        <SectionHeading title={t("profile.accountsTitle")} description={t("profile.accountsHint")} />
        <ConnectedAccountList accounts={accounts} detailed />
      </div>
    </PanelBody>
  );
}
