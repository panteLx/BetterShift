import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";

interface UseDirtyStateOptions<T> {
  open: boolean;
  initialData: T | null;
  currentData: T;
  onClose: (open: boolean) => void;
}

export function useDirtyState<T>({
  open,
  initialData,
  currentData,
  onClose,
}: UseDirtyStateOptions<T>) {
  const t = useTranslations();

  // Store initial snapshot when sheet opens
  const [initialSnapshot, setInitialSnapshot] = useState<T | null>(null);

  // Update snapshot when sheet opens
  if (open && initialSnapshot === null && initialData !== null) {
    setInitialSnapshot(JSON.parse(JSON.stringify(initialData)));
  }

  // Reset snapshot when sheet closes
  if (!open && initialSnapshot !== null) {
    setInitialSnapshot(null);
  }

  // Compute isDirty from current vs initial snapshot
  const isDirty = useMemo(() => {
    if (!open || initialSnapshot === null) {
      return false;
    }
    return JSON.stringify(currentData) !== JSON.stringify(initialSnapshot);
  }, [open, initialSnapshot, currentData]);

  const handleClose = () => {
    if (isDirty) {
      const confirmed = confirm(t("common.unsavedChanges"));
      if (!confirmed) {
        return false;
      }
    }
    onClose(false);
    return true;
  };

  return {
    isDirty,
    handleClose,
    resetDirty: () => setInitialSnapshot(null),
  };
}
