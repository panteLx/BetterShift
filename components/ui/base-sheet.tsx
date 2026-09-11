"use client";

import { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelDialog, PanelWidth } from "@/components/panel-dialog";
import { useDirtyState } from "@/hooks/useDirtyState";

interface BaseSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  showSaveButton?: boolean;
  showCancelButton?: boolean;
  onSave?: () => void | Promise<void>;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  hasUnsavedChanges?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl";
  headerLeading?: ReactNode;
}

const WIDTH_MAP: Record<NonNullable<BaseSheetProps["maxWidth"]>, PanelWidth> = {
  sm: "md",
  md: "md",
  lg: "lg",
  xl: "xl",
};

/** Form panel with cancel/save footer and an unsaved-changes guard. */
export function BaseSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  showSaveButton = false,
  showCancelButton = true,
  onSave,
  isSaving = false,
  saveDisabled = false,
  saveLabel,
  hasUnsavedChanges = false,
  maxWidth = "md",
  headerLeading,
}: BaseSheetProps) {
  const t = useTranslations();

  const { handleClose, showConfirmDialog, setShowConfirmDialog, handleConfirmClose } =
    useDirtyState({
      onClose: onOpenChange,
      hasChanges: () => hasUnsavedChanges,
    });

  const defaultFooter =
    showSaveButton || showCancelButton ? (
      <>
        {showCancelButton && (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleClose()}
            disabled={isSaving}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.cancel")}
          </Button>
        )}
        {showSaveButton && (
          <Button
            type="button"
            onClick={() => onSave?.()}
            disabled={saveDisabled || isSaving}
            className="h-10 flex-1 font-semibold"
          >
            {isSaving ? t("common.saving") : saveLabel || t("common.save")}
          </Button>
        )}
      </>
    ) : undefined;

  return (
    <>
      <PanelDialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
        title={title}
        description={description}
        headerLeading={headerLeading}
        width={WIDTH_MAP[maxWidth]}
        footer={footer ?? defaultFooter}
      >
        {children}
      </PanelDialog>

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}
