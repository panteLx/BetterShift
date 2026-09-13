"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { CalendarShareList } from "@/components/calendar-share-list";
import { AccessLinksPanel } from "@/components/calendar-token-list";
import { ToggleRow } from "@/components/form-kit";
import { GuestPermissionSelector } from "@/components/guest-permission-selector";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useAccessLinkForm } from "@/hooks/useAccessLinkForm";
import { useReportDirty } from "@/hooks/useDirtyState";

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
  const { allowGuest } = useAuthFeatures();
  const [tab, setTab] = useState<SharingTab>("people");
  const linkForm = useAccessLinkForm(calendarId);

  useReportDirty(linkForm.dirty, onDirtyChange);

  const [optimisticGuest, setOptimisticGuest] = useState<GuestPermission | null>(null);
  const [optimisticAllowSelfSignup, setOptimisticAllowSelfSignup] = useState<
    boolean | null
  >(null);
  const [optimisticSignupsEnabled, setOptimisticSignupsEnabled] = useState<
    boolean | null
  >(null);
  const [saving, setSaving] = useState(false);
  const calendar = calendars.find((c) => c.id === calendarId);
  // Provisional: the API dropped the guestPermission enum in Stufe 2 (Paket 2)
  // in favor of guestBundleId, and writing here is already inert server-side
  // — this whole panel is replaced by the real bundle-based guest picker in
  // Stufe 2 Paket 4. Until then, approximate from bundle presence only.
  const guestPermission: GuestPermission =
    optimisticGuest ?? (calendar?.guestBundleId ? "write" : "none");
  const allowSelfSignup =
    optimisticAllowSelfSignup ?? calendar?.allowSelfSignup ?? true;
  const signupsEnabled =
    optimisticSignupsEnabled ?? calendar?.signupsEnabled ?? true;

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

  const handleAllowSelfSignupChange = async (value: boolean) => {
    if (!canShare || value === allowSelfSignup) return;
    setOptimisticAllowSelfSignup(value);
    setSaving(true);
    try {
      await updateCalendar(calendarId, { allowSelfSignup: value });
    } catch {
      // updateCalendar already reported the error and rolled back the cache.
    } finally {
      setSaving(false);
      setOptimisticAllowSelfSignup(null);
    }
  };

  const handleSignupsEnabledChange = async (value: boolean) => {
    if (!canShare || value === signupsEnabled) return;
    setOptimisticSignupsEnabled(value);
    setSaving(true);
    try {
      await updateCalendar(calendarId, { signupsEnabled: value });
    } catch {
      // updateCalendar already reported the error and rolled back the cache.
    } finally {
      setSaving(false);
      setOptimisticSignupsEnabled(null);
    }
  };

  const tabs: { value: SharingTab; label: string }[] = [
    { value: "people", label: t("sharingSheet.tabPeople") },
    { value: "public", label: t("share.public") },
    // Access links are a pure guest-access mechanism, so they disappear once
    // ALLOW_GUEST_ACCESS is off — unlike public access, which remains useful
    // for signed-in users' calendar discovery regardless of that flag.
    ...(allowGuest ? [{ value: "links" as const, label: t("share.links") }] : []),
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
            {canShare && (
              <ToggleRow
                id="signups-enabled"
                title={t("sharingSheet.signupsEnabledLabel")}
                description={t("sharingSheet.signupsEnabledDesc")}
                checked={signupsEnabled}
                onCheckedChange={handleSignupsEnabledChange}
                disabled={saving}
              />
            )}
            {canShare && signupsEnabled && (
              <ToggleRow
                id="allow-self-signup"
                title={t("sharingSheet.allowSelfSignupLabel")}
                description={t("sharingSheet.allowSelfSignupDesc")}
                checked={allowSelfSignup}
                onCheckedChange={handleAllowSelfSignupChange}
                disabled={saving}
              />
            )}
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
