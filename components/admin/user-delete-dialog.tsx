"use client";

import { useTranslations } from "next-intl";
import { ConfirmNameDeleteDialog } from "@/components/admin/confirm-name-delete-dialog";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: () => Promise<void>;
}

export function UserDeleteDialog({ open, onOpenChange, user, onConfirm }: UserDeleteDialogProps) {
  const t = useTranslations();

  return (
    <ConfirmNameDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      name={user.name}
      idPrefix="delete-user"
      title={t("admin.deleteUser")}
      description={t("admin.deleteUserConfirm", { name: user.name || user.email })}
      warning={t("admin.deleteWarning")}
      understoodLabel={t("admin.deleteUnderstood")}
      confirmationLabel={t("admin.deleteConfirmation", { name: user.name })}
      confirmationHint={t("admin.deleteConfirmationHint")}
      confirmLabel={t("admin.confirmDelete")}
      onConfirm={onConfirm}
    />
  );
}
