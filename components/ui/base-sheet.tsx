"use client";

import { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
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
  hasUnsavedChanges?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

const maxWidthClasses = {
  sm: "sm:max-w-[480px]",
  md: "sm:max-w-[600px]",
  lg: "sm:max-w-[700px]",
  xl: "sm:max-w-[800px]",
};

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
  hasUnsavedChanges = false,
  maxWidth = "md",
}: BaseSheetProps) {
  const t = useTranslations();

  const {
    handleClose,
    showConfirmDialog,
    setShowConfirmDialog,
    handleConfirmClose,
  } = useDirtyState({
    open,
    onClose: onOpenChange,
    hasChanges: () => hasUnsavedChanges,
  });

  const handleSave = async () => {
    if (onSave) {
      await onSave();
    }
  };

  const handleCancelClick = () => {
    handleClose(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className={`w-full ${maxWidthClasses[maxWidth]} p-0 flex flex-col gap-0 border-l border-border/50 overflow-hidden`}
        >
          <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 space-y-1.5">
            <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {title}
            </SheetTitle>
            {description && (
              <SheetDescription className="text-sm text-muted-foreground">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

          {(footer || showSaveButton || showCancelButton) && (
            <SheetFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
              {footer ? (
                footer
              ) : (
                <div className="flex gap-2.5 w-full">
                  {showCancelButton && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelClick}
                      disabled={isSaving}
                      className="flex-1 h-11 border-border/50 hover:bg-muted/50"
                    >
                      {t("common.cancel")}
                    </Button>
                  )}
                  {showSaveButton && (
                    <Button
                      type="button"
                      onClick={handleSave}
                      disabled={saveDisabled || isSaving}
                      className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
                    >
                      {isSaving ? t("common.saving") : t("common.save")}
                    </Button>
                  )}
                </div>
              )}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}
