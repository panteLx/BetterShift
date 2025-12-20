import { useState } from "react";

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
