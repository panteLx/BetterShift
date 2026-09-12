"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PanelDialog } from "@/components/panel-dialog";
import { Field, ToggleRow, inputClass } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserBanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: (reason: string, expiresAt?: Date) => Promise<void>;
}

export function UserBanDialog({ open, onOpenChange, user, onConfirm }: UserBanDialogProps) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const [isPermanent, setIsPermanent] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setReason("");
    setIsPermanent(true);
    setExpiresAt("");
  };

  const handleConfirm = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      const expirationDate = isPermanent || !expiresAt ? undefined : parseLocalDate(expiresAt);
      await onConfirm(reason.trim(), expirationDate);
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
      title={t("admin.banUser")}
      description={t("admin.banUserConfirm", { name: user.name || user.email })}
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
            disabled={!reason.trim() || isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {isSubmitting ? t("common.saving") : t("admin.confirmBan")}
          </Button>
        </>
      }
    >
      <StatusBanner tone="warning" icon={TriangleAlert}>
        {t("admin.banWarning")}
      </StatusBanner>

      <Field label={t("admin.banReason")} htmlFor="ban-reason">
        <Textarea
          id="ban-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("admin.banReasonPlaceholder")}
          rows={3}
          className="resize-none rounded-[9px] px-3 text-[14px]"
        />
      </Field>

      <ToggleRow
        id="ban-permanent"
        title={t("admin.permanentBan")}
        checked={isPermanent}
        onCheckedChange={setIsPermanent}
      />

      {!isPermanent && (
        <Field label={t("admin.banExpires")} htmlFor="ban-expires">
          <Input
            id="ban-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            min={formatDateToLocal(new Date())}
            className={inputClass}
          />
        </Field>
      )}
    </PanelDialog>
  );
}
