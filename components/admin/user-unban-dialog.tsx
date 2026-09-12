"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { PanelDialog } from "@/components/panel-dialog";
import { SectionLabel } from "@/components/form-kit";
import { getDateLocale } from "@/lib/locales";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserUnbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: () => Promise<void>;
}

export function UserUnbanDialog({ open, onOpenChange, user, onConfirm }: UserUnbanDialogProps) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.unbanUser")}
      description={t("admin.unbanUserConfirm", { name: user.name || user.email })}
      width="sm"
      bodyClassName="flex flex-col gap-3"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="h-10 flex-1 font-semibold">
            {isSubmitting ? t("common.saving") : t("admin.confirmUnban")}
          </Button>
        </>
      }
    >
      {user.banReason && (
        <div>
          <SectionLabel>{t("admin.originalBanReason")}</SectionLabel>
          <div className="rounded-[10px] border border-line bg-surface-panel px-3 py-2.5 text-[13.5px] text-fg-body">
            {user.banReason}
          </div>
        </div>
      )}
      <p className="text-[12.5px] text-fg-tertiary">
        {user.banExpires
          ? t("admin.bannedUntil", { date: format(user.banExpires, "PPP", { locale: dateLocale }) })
          : t("admin.bannedPermanently")}
      </p>
    </PanelDialog>
  );
}
