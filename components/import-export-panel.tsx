"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { ExportPanel } from "@/components/export-dialog";
import { ExternalSyncPanel } from "@/components/external-sync-manage-sheet";
import { SyncNotificationsPanel } from "@/components/sync-notification-dialog";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useGuardedAction, useReportDirty } from "@/hooks/useDirtyState";

type Tab = "export" | "import" | "log";

interface ImportExportPanelProps {
  calendarId: string;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSyncComplete: () => void;
}

/** Export for everyone who can see the calendar; import and sync log only with manageExternalSync. */
export function ImportExportPanel({
  calendarId,
  onClose,
  onDirtyChange,
  onSyncComplete,
}: ImportExportPanelProps) {
  const t = useTranslations();
  const canImport = useCalendarPermission(calendarId).can("manageExternalSync");
  const { hasSyncErrors } = useExternalSync(canImport ? calendarId : null);
  const [tab, setTab] = useState<Tab>("export");
  const [dirty, setDirty] = useState(false);

  useReportDirty(dirty, onDirtyChange);
  const { guarded, confirmProps } = useGuardedAction(dirty, () => setDirty(false));

  if (!canImport) return <ExportPanel calendarId={calendarId} onClose={onClose} />;

  return (
    <>
      <div className="shrink-0 px-[22px] pt-[18px]">
        <SegmentedControl<Tab>
          value={tab}
          onChange={(next) => guarded(() => setTab(next))}
          label={t("settings.importExport")}
          options={[
            { value: "export", label: t("settings.export") },
            { value: "import", label: t("settings.tabImport") },
            {
              value: "log",
              label: t("settings.tabLog"),
              badge: hasSyncErrors ? (
                <span role="img" className="size-1.5 rounded-full bg-danger" aria-label={t("common.error")} />
              ) : undefined,
            },
          ]}
        />
      </div>
      {tab === "export" && <ExportPanel calendarId={calendarId} onClose={onClose} />}
      {tab === "import" && (
        <ExternalSyncPanel
          calendarId={calendarId}
          onSyncComplete={onSyncComplete}
          onDirtyChange={setDirty}
        />
      )}
      {tab === "log" && <SyncNotificationsPanel calendarId={calendarId} onClose={onClose} />}
      <ConfirmationDialog {...confirmProps} />
    </>
  );
}
