import { useEffect, useState } from "react";

interface UseDirtyStateOptions {
  onClose: (open: boolean) => void;
  hasChanges: () => boolean;
  onConfirm?: () => void;
}

/**
 * Hook for managing dirty state (unsaved changes) in sheets with ConfirmationDialog.
 *
 * @example
 * ```tsx
 * const { handleClose, showConfirmDialog, setShowConfirmDialog, handleConfirmClose } =
 *   useDirtyState({
 *     onClose,
 *     hasChanges: () => name !== initialName,
 *     onConfirm: () => resetForm()
 *   });
 *
 * return (
 *   <>
 *     <Sheet open={open} onOpenChange={handleClose}>
 *       {/* Sheet content *\/}
 *     </Sheet>
 *     <ConfirmationDialog
 *       open={showConfirmDialog}
 *       onOpenChange={setShowConfirmDialog}
 *       onConfirm={handleConfirmClose}
 *     />
 *   </>
 * );
 * ```
 */
export function useDirtyState({
  onClose,
  hasChanges,
  onConfirm,
}: UseDirtyStateOptions) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleClose = () => {
    if (hasChanges()) {
      setShowConfirmDialog(true);
      return;
    }

    onClose(false);
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onConfirm?.();
    onClose(false);
  };

  return {
    isDirty: hasChanges(),
    handleClose,
    showConfirmDialog,
    setShowConfirmDialog,
    handleConfirmClose,
  };
}

/** Reports a panel's unsaved input to the frame around it, and clears it on unmount. */
export function useReportDirty(
  dirty: boolean,
  onDirtyChange?: (dirty: boolean) => void
) {
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
}

/**
 * Defers an action behind a confirmation while there is unsaved input.
 * Spread `confirmProps` onto a ConfirmationDialog.
 */
export function useGuardedAction(dirty: boolean, onDiscard?: () => void) {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const guarded = (action: () => void) => {
    if (dirty) setPendingAction(() => action);
    else action();
  };

  const confirmProps = {
    open: pendingAction !== null,
    onOpenChange: (next: boolean) => {
      if (!next) setPendingAction(null);
    },
    onConfirm: () => {
      const action = pendingAction;
      setPendingAction(null);
      onDiscard?.();
      action?.();
    },
  };

  return { guarded, confirmProps };
}
