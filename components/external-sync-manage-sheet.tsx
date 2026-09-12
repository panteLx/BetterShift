"use client";

import { useTranslations } from "next-intl";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelFooter } from "@/components/panel-dialog";
import { ExternalSyncRow } from "@/components/external-sync-list";
import { ExternalSyncForm } from "@/components/external-sync-form";
import { useExternalSyncPanel } from "@/hooks/useExternalSyncPanel";

interface ExternalSyncPanelProps {
  calendarId: string;
  onClose: () => void;
  onSyncComplete?: () => void;
  /** Lets the surrounding frame guard its close button against unsaved changes */
  onDirtyChange?: (dirty: boolean) => void;
}

export function ExternalSyncPanel({
  calendarId,
  onClose,
  onSyncComplete,
  onDirtyChange,
}: ExternalSyncPanelProps) {
  const t = useTranslations();
  const {
    syncs,
    syncErrors,
    editingSync,
    formOpen,
    values,
    setField,
    isSubmitting,
    isSyncing,
    isDeleting,
    busy,
    canSubmit,
    deleteTargetId,
    setDeleteTargetId,
    showList,
    startAdd,
    startEdit,
    guardUnsaved,
    confirmProps,
    handleSync,
    handleAdd,
    handleSave,
    confirmDelete,
  } = useExternalSyncPanel({ calendarId, onSyncComplete, onDirtyChange });

  return (
    <>
      <PanelBody>
        <div className="flex flex-col gap-3.5">
          {syncs.length === 0 && !formOpen && (
            <p className="rounded-[11px] border border-dashed border-control px-4 py-8 text-center text-[13px] text-fg-tertiary">
              {t("externalSync.noSyncs")}
            </p>
          )}

          {syncs.length > 0 && (
            <div className="flex flex-col gap-2">
              {syncs.map((sync) => (
                <ExternalSyncRow
                  key={sync.id}
                  sync={sync}
                  error={syncErrors[sync.id]}
                  selected={editingSync?.id === sync.id}
                  syncing={isSyncing === sync.id}
                  deleting={isDeleting === sync.id}
                  busy={busy}
                  onSelect={() =>
                    guardUnsaved(() =>
                      editingSync?.id === sync.id ? showList() : startEdit(sync)
                    )
                  }
                  onSync={() => handleSync(sync.id)}
                  onDelete={() =>
                    // Deleting the sync being edited closes the form; other rows leave it alone
                    editingSync?.id === sync.id
                      ? guardUnsaved(() => setDeleteTargetId(sync.id))
                      : setDeleteTargetId(sync.id)
                  }
                />
              ))}
            </div>
          )}

          {formOpen && (
            <>
              {syncs.length > 0 && <div className="h-px shrink-0 bg-line" />}
              <ExternalSyncForm
                key={editingSync?.id ?? "new"}
                values={values}
                setField={setField}
                mode={editingSync ? "edit" : "add"}
                isOneTimeImport={editingSync?.isOneTimeImport}
                disabled={isSubmitting}
              />
            </>
          )}
        </div>
      </PanelBody>

      <PanelFooter>
        {formOpen ? (
          <>
            <Button
              variant="outline"
              className="h-10 flex-1 font-semibold"
              onClick={showList}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button
              className="h-10 flex-1 font-semibold"
              onClick={editingSync ? handleSave : handleAdd}
              disabled={!canSubmit}
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              {isSubmitting
                ? t("common.saving")
                : editingSync
                  ? t("common.save")
                  : t("syncSheet.addSubscription")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button className="h-10 flex-1 font-semibold" onClick={startAdd} disabled={busy}>
              <Plus className="size-4" />
              {t("syncSheet.addSubscription")}
            </Button>
          </>
        )}
      </PanelFooter>

      <ConfirmationDialog {...confirmProps} />

      <ConfirmationDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        onConfirm={confirmDelete}
        title={t("externalSync.delete")}
        description={t("externalSync.deleteConfirm")}
        cancelText={t("common.cancel")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
      />
    </>
  );
}
