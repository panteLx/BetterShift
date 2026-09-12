"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AdminDetailPanel } from "@/components/admin/admin-detail-panel";
import { useDirtyState } from "@/hooks/useDirtyState";

interface AdminFormPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onSave: () => void | Promise<void>;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  hasUnsavedChanges?: boolean;
}

/** Admin side panel with a Cancel/Save footer and the unsaved-changes guard of BaseSheet. */
export function AdminFormPanel({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
  onSave,
  isSaving = false,
  saveDisabled = false,
  saveLabel,
  hasUnsavedChanges = false,
}: AdminFormPanelProps) {
  const t = useTranslations();
  const { handleClose, showConfirmDialog, setShowConfirmDialog, handleConfirmClose } =
    useDirtyState({ onClose: onOpenChange, hasChanges: () => hasUnsavedChanges });

  return (
    <>
      <AdminDetailPanel
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
        title={title}
        subtitle={subtitle}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose()}
              disabled={isSaving}
              className="h-10 flex-1 font-semibold"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => onSave()}
              disabled={saveDisabled || isSaving}
              className="h-10 flex-1 font-semibold"
            >
              {isSaving ? t("common.saving") : saveLabel || t("common.save")}
            </Button>
          </>
        }
      >
        {children}
      </AdminDetailPanel>

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}
