"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { StatusBanner } from "@/components/status-banner";
import { CalendarShareList } from "@/components/calendar-share-list";
import { AccessLinksPanel } from "@/components/calendar-token-list";
import {
  GuestPermissionSelector,
  usePublicAccessNote,
} from "@/components/guest-permission-selector";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useAccessLinkForm } from "@/hooks/useAccessLinkForm";

type GuestPermission = "none" | "read" | "write";
type SharingTab = "people" | "public" | "links";

interface SharingPanelProps {
  calendarId: string;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** Sharing (screen 4d): people with access, public access and access links. */
export function SharingPanel({ calendarId, onClose, onDirtyChange }: SharingPanelProps) {
  const t = useTranslations();
  const { calendars, updateCalendar } = useCalendars();
  const { canShare } = useCalendarPermission(calendarId);
  const { isAuthEnabled, allowGuest } = useAuthFeatures();
  const publicAccessNote = usePublicAccessNote();
  const [tab, setTab] = useState<SharingTab>("people");
  const linkForm = useAccessLinkForm(calendarId);

  useEffect(() => {
    onDirtyChange?.(linkForm.dirty);
    return () => onDirtyChange?.(false);
  }, [linkForm.dirty, onDirtyChange]);

  const [optimisticGuest, setOptimisticGuest] = useState<GuestPermission | null>(null);
  const [saving, setSaving] = useState(false);
  const calendar = calendars.find((c) => c.id === calendarId);
  const guestPermission = optimisticGuest ?? calendar?.guestPermission ?? "none";

  // guestPermission also governs signed-in users without a share, so it is offered whenever auth is on.
  const showPublicTab = isAuthEnabled;

  const handleGuestPermissionChange = async (value: GuestPermission) => {
    if (!canShare || value === guestPermission) return;
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
    { value: "links", label: t("share.links") },
  ];
  const activeTab = tabs.some((option) => option.value === tab) ? tab : "people";

  const switcher = (
    <SegmentedControl<SharingTab>
      label={t("common.labels.shares")}
      size="lg"
      value={activeTab}
      onChange={setTab}
      options={tabs}
    />
  );

  if (activeTab === "links") {
    return (
      <AccessLinksPanel
        calendarId={calendarId}
        form={linkForm}
        onClose={onClose}
        leading={switcher}
      />
    );
  }

  return (
    <>
      <PanelBody className="flex flex-col gap-3.5">
        {switcher}

        {activeTab === "people" ? (
          <>
            <CalendarShareList calendarId={calendarId} canManageShares={canShare} />
            {showPublicTab &&
              (guestPermission === "none" ? (
                <StatusBanner tone="info" icon={Shield} title={t("sharingSheet.publicOffTitle")}>
                  {allowGuest
                    ? t("sharingSheet.publicOffBodyGuestsOn")
                    : t("sharingSheet.publicOffBodyGuestsOff")}
                </StatusBanner>
              ) : (
                <StatusBanner tone="info" icon={Globe} title={t("sharingSheet.publicOnTitle")}>
                  {publicAccessNote(guestPermission, allowGuest)}
                </StatusBanner>
              ))}
          </>
        ) : (
          <>
            <p className="text-[13px] text-fg-secondary">
              {allowGuest
                ? t("share.publicAccessDescriptionGuestsOn")
                : t("share.publicAccessDescriptionGuestsOff")}
            </p>
            <GuestPermissionSelector
              value={guestPermission}
              onChange={handleGuestPermissionChange}
              allowGuest={allowGuest}
              disabled={!canShare}
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
