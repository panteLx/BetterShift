"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserUnbanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: () => Promise<void>;
}

export function UserUnbanDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: UserUnbanDialogProps) {
  const t = useTranslations();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{t("admin.unbanUser")}</DialogTitle>
          <DialogDescription>
            {t("admin.unbanUserConfirm", {
              name: user.name || user.email,
            })}
          </DialogDescription>
        </DialogHeader>

        {user.banReason && (
          <div className="py-4">
            <Label className="text-sm font-medium">
              {t("admin.originalBanReason")}
            </Label>
            <div className="mt-2 p-3 rounded-lg bg-muted text-sm">
              {user.banReason}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? t("common.saving") : t("admin.confirmUnban")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
