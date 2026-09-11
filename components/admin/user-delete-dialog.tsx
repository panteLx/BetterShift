"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PanelDialog } from "@/components/panel-dialog";
import { Field, inputClass } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: () => Promise<void>;
}

export function UserDeleteDialog({ open, onOpenChange, user, onConfirm }: UserDeleteDialogProps) {
  const t = useTranslations();
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmed = confirmation === user.name && understood;

  const reset = () => {
    setConfirmation("");
    setUnderstood(false);
  };

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
      reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.deleteUser")}
      description={t("admin.deleteUserConfirm", { name: user.name || user.email })}
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
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {isSubmitting ? t("common.saving") : t("admin.confirmDelete")}
          </Button>
        </>
      }
    >
      <StatusBanner tone="danger" icon={TriangleAlert}>
        {t("admin.deleteWarning")}
      </StatusBanner>

      <div className="flex items-start gap-3">
        <Checkbox
          id="delete-user-understood"
          checked={understood}
          onCheckedChange={(checked) => setUnderstood(checked === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="delete-user-understood"
          className="cursor-pointer text-[13.5px] font-medium leading-snug text-fg-body"
        >
          {t("admin.deleteUnderstood")}
        </Label>
      </div>

      <Field
        label={t("admin.deleteConfirmation", { name: user.name })}
        htmlFor="delete-user-confirmation"
        hint={t("admin.deleteConfirmationHint")}
      >
        <Input
          id="delete-user-confirmation"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={user.name}
          autoComplete="off"
          className={cn(inputClass, "font-mono")}
        />
      </Field>
    </PanelDialog>
  );
}
