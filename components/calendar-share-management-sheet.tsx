"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { StatusBanner } from "@/components/status-banner";
import { CalendarShareList } from "@/components/calendar-share-list";
import { AccessLinksPanel } from "@/components/calendar-token-list";
import { GuestPermissionSelector } from "@/components/guest-permission-selector";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";

type GuestPermission = "none" | "read" | "write";
export type SharingTab = "people" | "public" | "links";

interface SharingPanelProps {
  calendarId: string;
  onClose: () => void;
  /** Defaults to the current user's share permission on the calendar */
  canManageShares?: boolean;
  /** Fallback until the calendar is in the query cache */
  calendarGuestPermission?: GuestPermission;
  /** Adds a "Links" segment rendering AccessLinksPanel (standalone sheet only) */
  showLinksTab?: boolean;
  tab?: SharingTab;
  onTabChange?: (tab: SharingTab) => void;
}

/** Sharing (screen 4d): people with access and public access. */
export function SharingPanel({
  calendarId,
  onClose,
  canManageShares: canManageSharesProp,
  calendarGuestPermission,
  showLinksTab = false,
  tab: tabProp,
  onTabChange,
}: SharingPanelProps) {
  const t = useTranslations();
  const { calendars, updateCalendar } = useCalendars();
  const { canShare } = useCalendarPermission(calendarId);
  const { isAuthEnabled } = useAuthFeatures();
  const canManageShares = canManageSharesProp ?? canShare;

  const [ownTab, setOwnTab] = useState<SharingTab>("people");
  const tab = tabProp ?? ownTab;
  const setTab = (next: SharingTab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };

  const [optimisticGuest, setOptimisticGuest] = useState<GuestPermission | null>(null);
  const [saving, setSaving] = useState(false);
  const calendar = calendars.find((c) => c.id === calendarId);
  const guestPermission =
    optimisticGuest ?? calendar?.guestPermission ?? calendarGuestPermission ?? "none";

  // guestPermission also governs signed-in users without a share, so it is offered whenever auth is on.
  const showPublicTab = isAuthEnabled;

  const handleGuestPermissionChange = async (value: GuestPermission) => {
    if (!canManageShares || value === guestPermission) return;
    setOptimisticGuest(value);
    setSaving(true);
    try {
      await updateCalendar(calendarId, { guestPermission: value });
    } catch {
      // updateCalendar already reported the error and rolled back the cache.
    } finally {
      setSaving(false);
      setOptimisticGuest(null);
    }
  };

  const tabs: { value: SharingTab; label: string }[] = [
    { value: "people", label: t("sharingSheet.tabPeople") },
    ...(showPublicTab ? [{ value: "public" as const, label: t("share.public") }] : []),
    ...(showLinksTab ? [{ value: "links" as const, label: t("share.links") }] : []),
  ];
  const activeTab = tabs.some((option) => option.value === tab) ? tab : "people";

  const switcher =
    tabs.length > 1 ? (
      <SegmentedControl<SharingTab>
        label={t("common.labels.shares")}
        size="lg"
        value={activeTab}
        onChange={setTab}
        options={tabs}
      />
    ) : null;

  if (activeTab === "links") {
    return <AccessLinksPanel calendarId={calendarId} onClose={onClose} leading={switcher} />;
  }

  return (
    <>
      <PanelBody className="flex flex-col gap-3.5">
        {switcher}

        {activeTab === "people" ? (
          <>
            <CalendarShareList calendarId={calendarId} canManageShares={canManageShares} />
            {showPublicTab &&
              (guestPermission === "none" ? (
                <StatusBanner tone="info" icon={Shield} title={t("sharingSheet.publicOffTitle")}>
                  {t("sharingSheet.publicOffBody")}
                </StatusBanner>
              ) : (
                <StatusBanner tone="info" icon={Globe} title={t("sharingSheet.publicOnTitle")}>
                  {guestPermission === "read"
                    ? t("share.publicPermissionReadDesc")
                    : t("share.publicPermissionWriteDesc")}
                </StatusBanner>
              ))}
          </>
        ) : (
          <>
            <p className="text-[13px] text-fg-secondary">{t("share.publicAccessDescription")}</p>
            <GuestPermissionSelector
              value={guestPermission}
              onChange={handleGuestPermissionChange}
              disabled={!canManageShares}
            />
            {saving && <p className="text-[12px] text-fg-tertiary">{t("common.saving")}</p>}
          </>
        )}
      </PanelBody>
      <PanelFooter>
        <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={onClose}>
          {t("common.close")}
        </Button>
      </PanelFooter>
    </>
  );
}

interface CalendarShareManagementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  calendarGuestPermission?: GuestPermission;
  canManageShares: boolean; // owner/admin permission
}

export function CalendarShareManagementSheet({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  calendarGuestPermission = "none",
  canManageShares,
}: CalendarShareManagementSheetProps) {
  const t = useTranslations();
  const [tab, setTab] = useState<SharingTab>("people");
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTab("people");
  }
  const links = tab === "links";

  return (
    <PanelDialog
      bare
      open={open}
      onOpenChange={onOpenChange}
      title={links ? t("token.accessLinks") : t("common.labels.shares")}
      description={
        links
          ? t("sharingSheet.linksDescription")
          : t("sharingSheet.description", { name: calendarName })
      }
    >
      <SharingPanel
        calendarId={calendarId}
        onClose={() => onOpenChange(false)}
        canManageShares={canManageShares}
        calendarGuestPermission={calendarGuestPermission}
        showLinksTab
        tab={tab}
        onTabChange={setTab}
      />
    </PanelDialog>
  );
}
