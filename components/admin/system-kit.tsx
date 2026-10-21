"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Pill } from "@/components/form-kit";
import type { VersionInfo } from "@/hooks/useVersionUpdate";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

export function ScaleValue({ value }: { value: number | undefined }) {
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[17px] font-medium",
        !value ? "text-fg-faint" : "text-fg-strong"
      )}
    >
      {value ?? "–"}
    </span>
  );
}

export function SystemItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-[7px] whitespace-nowrap">
      <span className="text-[11.5px] text-fg-faint">{label}</span>
      {children}
    </div>
  );
}

/** Version, build date and commit rows; `pillHref` turns the version pill into a link. */
export function SystemInfoItems({
  versionInfo,
  pillHref,
  compact,
}: {
  versionInfo: VersionInfo | null;
  pillHref?: string;
  compact?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const valueSize = compact ? "text-[13px]" : "text-[14px]";

  const buildDate =
    versionInfo && versionInfo.buildDate !== "dev" && versionInfo.buildDate !== "unknown"
      ? format(new Date(versionInfo.buildDate), "PPp", { locale: getDateLocale(locale) })
      : t("admin.systemInfo.unknown");

  const hasUpdate = !!versionInfo?.hasUpdate && !versionInfo.isDev;
  const pill = versionInfo?.isDev ? (
    <Pill tone="warning" className="text-[11px]">{t("admin.systemInfo.development")}</Pill>
  ) : hasUpdate ? (
    <Pill tone="brand" className="text-[11px]">{t("admin.systemInfo.updateAvailable")}</Pill>
  ) : versionInfo ? (
    <Pill tone="success" className="text-[11px]">{t("admin.systemInfo.upToDate")}</Pill>
  ) : null;

  return (
    <>
      <SystemItem label={t("admin.systemInfo.version")}>
        <span className={cn("font-mono font-semibold text-fg-strong", valueSize)}>
          {versionInfo?.version ?? "–"}
        </span>
        {pill && pillHref ? <Link href={pillHref}>{pill}</Link> : pill}
      </SystemItem>
      <SystemItem label={t("admin.systemInfo.buildDate")}>
        <span className={cn("font-semibold text-fg-strong", valueSize)}>{versionInfo ? buildDate : "–"}</span>
      </SystemItem>
      <SystemItem label={t("admin.systemInfo.commitHash")}>
        <span className={cn("font-mono font-semibold text-fg-strong", valueSize)}>
          {versionInfo?.commitHash ?? "–"}
        </span>
        {versionInfo?.githubUrl && (
          <a
            href={versionInfo.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] font-semibold text-brand-ink hover:underline"
          >
            {t("admin.systemInfo.viewOnGitHub")}
          </a>
        )}
      </SystemItem>
    </>
  );
}
