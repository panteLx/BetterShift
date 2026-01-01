"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserBanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: (reason: string, expiresAt?: Date) => Promise<void>;
}

export function UserBanDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: UserBanDialogProps) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const [isPermanent, setIsPermanent] = useState(true);
  const [expiresAt, setExpiresAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      const expirationDate =
        isPermanent || !expiresAt ? undefined : new Date(expiresAt);
      await onConfirm(reason.trim(), expirationDate);
      // Reset form
      setReason("");
      setIsPermanent(true);
      setExpiresAt("");
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setReason("");
    setIsPermanent(true);
    setExpiresAt("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("admin.banUser")}</DialogTitle>
          <DialogDescription>
            {t("admin.banUserConfirm", {
              name: user.name || user.email,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t("admin.banWarning")}
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              {t("admin.banReason")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("admin.banReasonPlaceholder")}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Permanent Ban Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="permanent"
              checked={isPermanent}
              onCheckedChange={(checked) => setIsPermanent(checked === true)}
            />
            <Label
              htmlFor="permanent"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {t("admin.permanentBan")}
            </Label>
          </div>

          {/* Expiration Date */}
          {!isPermanent && (
            <div className="space-y-2">
              <Label htmlFor="expires">{t("admin.banExpires")}</Label>
              <Input
                id="expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
          >
            {isSubmitting ? t("common.saving") : t("admin.confirmBan")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
