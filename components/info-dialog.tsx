"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Coffee, Github, Heart } from "lucide-react";
import { PanelBody, PanelDialog } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { ChangelogPanel } from "@/components/changelog-dialog";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";

type InfoTab = "info" | "changelog";

const DONATE_LINKS = [
  { key: "buyMeACoffee", href: "https://www.buymeacoffee.com/pantel", icon: Coffee, tone: "text-warning" },
  { key: "githubSponsors", href: "https://github.com/sponsors/pantelx", icon: Heart, tone: "text-danger" },
] as const;

function InfoTabContent() {
  const t = useTranslations();
  const { versionInfo } = useVersionUpdateCheck();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-[11px] border border-line bg-surface-panel px-4 py-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-brand">
          <CalendarDays className="size-[18px] text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-fg-strong">{t("app.title")}</p>
          <p className="font-mono text-[12px] text-fg-tertiary">
            {versionInfo
              ? versionInfo.isDev
                ? t("info.devBuild")
                : `v${versionInfo.version}${versionInfo.commitHash ? ` · ${versionInfo.commitHash}` : ""}`
              : "…"}
          </p>
        </div>
        {versionInfo?.githubUrl && (
          <a
            href={versionInfo.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-tertiary transition-colors hover:bg-surface-sunken hover:text-fg-secondary"
          >
            <Github className="size-[18px]" />
          </a>
        )}
      </div>

      <div>
        <p className="text-[13.5px] font-semibold text-fg-strong">{t("info.supportTitle")}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fg-tertiary">
          {t("info.supportDescription")}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {DONATE_LINKS.map(({ key, href, icon: Icon, tone }) => (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[13.5px] font-semibold text-fg-strong transition-colors hover:bg-surface-panel"
            >
              <Icon className={`size-4 shrink-0 ${tone}`} />
              {t(`info.${key}`)}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

interface InfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  /** Which tab to land on when the dialog opens; defaults to "info". */
  defaultTab?: InfoTab;
}

/** App info, donation links and release notes — everything about the app in one place. */
export function InfoDialog({ open, onOpenChange, locale, defaultTab = "info" }: InfoDialogProps) {
  const t = useTranslations();
  const [tab, setTab] = useState<InfoTab>(defaultTab);

  // Land on the intended tab every time the dialog re-opens, even if the
  // previous session left it on the other one.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab(defaultTab);
  }

  return (
    <PanelDialog
      bare
      open={open}
      onOpenChange={onOpenChange}
      title={t("info.title")}
      description={t("info.description")}
      width="lg"
    >
      <div className="border-b border-line px-[22px] pb-3 pt-3">
        <SegmentedControl<InfoTab>
          label={t("info.title")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "info", label: t("info.tabInfo") },
            { value: "changelog", label: t("changelog.title") },
          ]}
        />
      </div>
      <PanelBody className={tab === "changelog" ? "py-0" : undefined}>
        {tab === "info" ? <InfoTabContent /> : <ChangelogPanel locale={locale} />}
      </PanelBody>
    </PanelDialog>
  );
}
