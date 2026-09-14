"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelDialog } from "@/components/panel-dialog";
import { StatusBanner } from "@/components/status-banner";
import { PasswordFieldsGroup, usePasswordFields } from "@/components/admin/password-fields";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserPasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: (newPassword: string) => Promise<void>;
}

export function UserPasswordResetDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: UserPasswordResetDialogProps) {
  const t = useTranslations();
  const passwordFields = usePasswordFields();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!passwordFields.isValid) return;

    setIsSubmitting(true);
    try {
      await onConfirm(passwordFields.password);
      passwordFields.reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    passwordFields.reset();
    onOpenChange(false);
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.resetPassword")}
      description={t("admin.resetPasswordFor", { name: user.name || user.email })}
      width="sm"
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!passwordFields.isValid || isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {isSubmitting ? t("common.saving") : t("admin.setPassword")}
          </Button>
        </>
      }
    >
      <StatusBanner tone="warning" icon={TriangleAlert} title={t("admin.passwordResetWarning")}>
        {t("admin.passwordResetSecurityNote")}
      </StatusBanner>

      <PasswordFieldsGroup
        idPrefix="reset"
        passwordLabel={t("common.labels.newPassword")}
        fields={passwordFields}
      />
    </PanelDialog>
  );
}
