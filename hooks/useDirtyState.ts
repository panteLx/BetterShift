import { useState } from "react";

interface UseDirtyStateOptions {
  open: boolean;
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
 *     open,
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
  open,
  onClose,
  hasChanges,
  onConfirm,
}: UseDirtyStateOptions) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleClose = (open: boolean) => {
    // If opening, just open it
    if (open) {
      onClose(open);
      return;
    }

    // If closing with unsaved changes, show confirmation
    if (hasChanges()) {
      setShowConfirmDialog(true);
      return;
    }

    // Otherwise close normally
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
