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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AdminCalendar } from "@/hooks/useAdminCalendars";

interface CalendarBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: AdminCalendar[];
  onConfirm: () => Promise<void>;
}

export function CalendarBulkDeleteDialog({
  open,
  onOpenChange,
  calendars,
  onConfirm,
}: CalendarBulkDeleteDialogProps) {
  const t = useTranslations();
  const [understood, setUnderstood] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!understood) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
      // Reset form
      setUnderstood(false);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setUnderstood(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("common.deleteSelected")}</DialogTitle>
          <DialogDescription>
            {t("admin.calendars.bulkDeleteConfirm", {
              count: calendars.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">
              {t("admin.calendars.bulkDeleteWarning")}
            </p>
          </div>

          {/* Calendar List (max 5 shown) */}
          <div className="space-y-2">
            <Label>{t("admin.calendars.calendarsToDelete")}:</Label>
            <div className="p-3 rounded-lg border bg-muted/20 max-h-[150px] overflow-y-auto">
              <ul className="space-y-1 text-sm">
                {calendars.slice(0, 5).map((calendar) => (
                  <li key={calendar.id} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: calendar.color }}
                    />
                    <span className="truncate">{calendar.name}</span>
                  </li>
                ))}
                {calendars.length > 5 && (
                  <li className="text-muted-foreground italic">
                    {t("admin.calendars.andMore", {
                      count: calendars.length - 5,
                    })}
                  </li>
                )}
              </ul>
            </div>
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
            disabled={!understood || isSubmitting}
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
