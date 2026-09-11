"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDistanceToNow } from "date-fns";
import { UAParser } from "ua-parser-js";
import { LogOut, Monitor, MonitorSmartphone, Smartphone, Tablet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ListRow, Pill } from "@/components/form-kit";
import { PanelBody } from "@/components/panel-dialog";
import { accountContentClass, SectionHeading } from "@/components/profile/account-layout";
import type { SessionWithDevice } from "@/hooks/useSessions";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

function parseUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return { browser: null, os: null, icon: MonitorSmartphone };

  const result = new UAParser(userAgent).getResult();
  const os = result.os.name
    ? `${result.os.name}${result.os.version ? ` ${result.os.version}` : ""}`
    : null;

  let icon = MonitorSmartphone;
  if (result.device.type === "mobile") icon = Smartphone;
  else if (result.device.type === "tablet") icon = Tablet;
  // Desktop browsers report no device type
  else if (result.device.type === undefined && result.os.name) icon = Monitor;

  return { browser: result.browser.name ?? null, os, icon };
}

function SessionRow({
  session,
  isCurrent,
  revoking,
  onRevoke,
}: {
  session: SessionWithDevice;
  isCurrent: boolean;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const device = parseUserAgent(session.userAgent);
  const Icon = device.icon;

  const lastActive = isCurrent
    ? t("profile.activeNow")
    : formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true, locale: dateLocale });
  const meta = [session.ipAddress, lastActive].filter(Boolean).join(" · ");

  return (
    <ListRow className="py-[11px]">
      <Icon className="size-[18px] shrink-0 text-fg-secondary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-fg-strong">
          {device.browser ?? t("profile.unknownBrowser")} · {device.os ?? t("profile.unknownOs")}
        </div>
        <div className="mt-0.5 truncate font-mono text-[12px] text-fg-tertiary">{meta}</div>
      </div>
      {isCurrent ? (
        <Pill tone="success">{t("profile.thisDevice")}</Pill>
      ) : (
        <button
          type="button"
          onClick={onRevoke}
          disabled={revoking}
          className="shrink-0 rounded-md px-2 py-1 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
        >
          {t("auth.logout")}
        </button>
      )}
    </ListRow>
  );
}

/** Screen 11c: signed-in devices, each revocable except the current one. */
export function SessionsSection({
  sessions,
  currentSessionId,
  revokeAllSessions,
  revokeSession,
}: {
  sessions: SessionWithDevice[];
  currentSessionId: string | undefined;
  revokeAllSessions: () => Promise<{ success: boolean; error?: string; revokedCount?: number }>;
  revokeSession: (token: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const t = useTranslations();
  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const sorted = [...sessions].sort((a, b) => {
    if (a.id === currentSessionId) return -1;
    if (b.id === currentSessionId) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    const result = await revokeAllSessions();
    setRevokingAll(false);

    if (result.success) {
      toast.success(t("auth.sessionsRevokedCount", { count: result.revokedCount || 0 }));
    } else {
      toast.error(result.error || t("common.error"));
    }
  };

  const handleRevoke = async (token: string) => {
    setRevokingToken(token);
    const result = await revokeSession(token);
    setRevokingToken(null);

    if (result.success) {
      toast.success(t("profile.sessionRevoked"));
    } else {
      toast.error(result.error || t("common.error"));
    }
  };

  return (
    <PanelBody>
      <div className={cn(accountContentClass, "flex flex-col gap-4")}>
        <SectionHeading
          title={t("profile.sessionsTitle")}
          description={t("profile.sessionsHint")}
          action={
            sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-[34px] font-semibold"
                disabled={revokingAll}
                onClick={handleRevokeAll}
              >
                <LogOut className="size-[15px]" />
                {t("profile.signOutOthers")}
              </Button>
            )
          }
        />
        {sorted.length === 0 ? (
          <p className="rounded-[11px] border border-dashed border-control px-3.5 py-3 text-center text-[13px] text-fg-tertiary">
            {t("auth.noActiveSessions")}
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sorted.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                isCurrent={session.id === currentSessionId}
                revoking={revokingToken === session.token}
                onRevoke={() => handleRevoke(session.token)}
              />
            ))}
          </div>
        )}
      </div>
    </PanelBody>
  );
}
