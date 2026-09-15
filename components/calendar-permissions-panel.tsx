"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { InfoNote, SectionLabel, ToggleRow } from "@/components/form-kit";
import { PermissionBundleEditor } from "@/components/permission-bundle-editor";
import { PermissionAssignments } from "@/components/permission-bundle-assignments";
import { AccessLinkCreated } from "@/components/calendar-token-form";
import { useBundleDisplayName } from "@/components/permission-bundle-picker";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { usePermissionLinkForm } from "@/hooks/usePermissionLinkForm";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useReportDirty } from "@/hooks/useDirtyState";

type PermissionsTab = "groups" | "assignments";

interface PermissionsPanelProps {
  calendarId: string;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

/** Central "Berechtigungen" surface: groups (incl. signups toggle) and assignments. */
export function PermissionsPanel({ calendarId, onClose, onDirtyChange }: PermissionsPanelProps) {
  const t = useTranslations();
  const { calendars, updateCalendar } = useCalendars();
  const { allowGuest } = useAuthFeatures();
  const { can } = useCalendarPermission(calendarId);
  const canManageSettings = can("manageCalendarSettings");
  const displayName = useBundleDisplayName();
  const [tab, setTab] = useState<PermissionsTab>("groups");
  const linkForm = usePermissionLinkForm(calendarId);

  useReportDirty(linkForm.dirty, onDirtyChange);

  const [optimisticSignupsEnabled, setOptimisticSignupsEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const calendar = calendars.find((c) => c.id === calendarId);
  const signupsEnabled = optimisticSignupsEnabled ?? calendar?.signupsEnabled ?? true;

  const handleSignupsEnabledChange = async (value: boolean) => {
    if (value === signupsEnabled) return;
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

  // A freshly created link takes over the whole panel body, same as the old
  // sharing sheet did — "Close" here resets the form, not the whole panel.
  if (linkForm.created) {
    const createdBundle = linkForm.guestEligibleBundles.find(
      (b) => b.id === linkForm.created!.bundleId
    );
    return (
      <>
        <PanelBody>
          <AccessLinkCreated
            created={linkForm.created}
            bundleName={displayName(createdBundle) ?? ""}
          />
        </PanelBody>
        <PanelFooter>
          <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={linkForm.reset}>
            {t("common.close")}
          </Button>
        </PanelFooter>
      </>
    );
  }

  const tabs: { value: PermissionsTab; label: string }[] = [
    { value: "groups", label: t("permissionBundles.tabGroups") },
    { value: "assignments", label: t("permissionBundles.tabAssignments") },
  ];

  return (
    <>
      <PanelBody className="flex flex-col gap-3.5">
        <SegmentedControl<PermissionsTab>
          label={t("permissionBundles.title")}
          size="lg"
          value={tab}
          onChange={setTab}
          options={tabs}
        />

        {tab === "groups" && (
          <>
            <PermissionBundleEditor calendarId={calendarId} />
            <section className="flex flex-col gap-3 border-t border-line pt-5">
              <SectionLabel className="mb-0">{t("permissionBundles.groups.signups")}</SectionLabel>
              <ToggleRow
                id="signups-enabled"
                title={t("sharingSheet.signupsEnabledLabel")}
                description={t("sharingSheet.signupsEnabledDesc")}
                checked={signupsEnabled}
                onCheckedChange={handleSignupsEnabledChange}
                disabled={saving || !canManageSettings}
              />
              {!canManageSettings && (
                <InfoNote icon={Lock}>{t("permissionBundles.signupsLocked")}</InfoNote>
              )}
              <InfoNote icon={Info}>{t("permissionBundles.signupsCapabilityHint")}</InfoNote>
            </section>
          </>
        )}

        {tab === "assignments" && (
          <PermissionAssignments
            calendarId={calendarId}
            allowGuest={allowGuest}
            linkForm={linkForm}
            calendar={calendar}
            updateCalendar={updateCalendar}
          />
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
