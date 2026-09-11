"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  cancelText?: string;
  confirmText?: string;
  confirmVariant?: "default" | "destructive";
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

// Long labels push the confirm button onto its own row instead of overflowing
const footerButton = "h-10 flex-[1_1_9rem] font-semibold";

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  cancelText,
  confirmText,
  confirmVariant = "default",
  confirmDisabled = false,
  children,
}: ConfirmationDialogProps) {
  const t = useTranslations();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-0 overflow-hidden rounded-2xl border-control p-0 shadow-window sm:max-w-[420px]">
        <div className="px-[22px] pb-4 pt-5">
          <AlertDialogTitle className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-fg-strong">
            {title || t("common.unsavedChanges")}
          </AlertDialogTitle>
          <AlertDialogDescription className="mt-1.5 text-[13.5px] leading-relaxed text-fg-secondary">
            {description || t("common.unsavedChangesDescription")}
          </AlertDialogDescription>
        </div>
        {children && <div className="px-[22px] pb-4">{children}</div>}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-line px-[22px] py-4">
          <AlertDialogCancel className={footerButton}>
            {cancelText || t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={cn(
              footerButton,
              confirmVariant === "destructive" &&
                "bg-destructive text-white hover:bg-destructive/90 dark:bg-destructive/60"
            )}
          >
            {confirmText || t("common.closeWithoutSaving")}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
