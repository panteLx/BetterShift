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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { AdminCalendar } from "@/hooks/useAdminCalendars";

interface CalendarDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar: AdminCalendar;
  onConfirm: () => Promise<void>;
}

export function CalendarDeleteDialog({
  open,
  onOpenChange,
  calendar,
  onConfirm,
}: CalendarDeleteDialogProps) {
  const t = useTranslations();
  const [confirmation, setConfirmation] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmed = confirmation === calendar.name && understood;

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
      // Reset form
      setConfirmation("");
      setUnderstood(false);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setConfirmation("");
    setUnderstood(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("admin.calendars.deleteCalendar")}</DialogTitle>
          <DialogDescription>
            {t("admin.calendars.deleteCalendarConfirm", {
              name: calendar.name,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">
              {t("admin.calendars.deleteWarning")}
            </p>
          </div>

          {/* Checkbox Confirmation */}
          <div className="flex items-start space-x-3">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(checked) => setUnderstood(checked === true)}
              className="mt-1"
            />
            <Label
              htmlFor="understood"
              className="text-sm font-medium leading-normal cursor-pointer"
            >
              {t("admin.calendars.deleteUnderstood")}
            </Label>
          </div>

          {/* Name Confirmation */}
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              {t("admin.calendars.deleteConfirmation", { name: calendar.name })}
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={calendar.name}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.calendars.deleteConfirmationHint")}
            </p>
          </div>
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
            disabled={!isConfirmed || isSubmitting}
          >
            {isSubmitting
              ? t("common.saving")
              : t("admin.calendars.confirmDelete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
