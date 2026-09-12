"use client";

import { useTranslations } from "next-intl";
import { ConfirmNameDeleteDialog } from "@/components/admin/confirm-name-delete-dialog";
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

  return (
    <ConfirmNameDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      name={calendar.name}
      idPrefix="delete-calendar"
      title={t("admin.calendars.deleteCalendar")}
      description={t("admin.calendars.deleteCalendarConfirm", { name: calendar.name })}
      warning={t("admin.calendars.deleteWarning")}
      understoodLabel={t("admin.calendars.deleteUnderstood")}
      confirmationLabel={t("admin.calendars.deleteConfirmation", { name: calendar.name })}
      confirmationHint={t("admin.calendars.deleteConfirmationHint")}
      confirmLabel={t("admin.calendars.confirmDelete")}
      onConfirm={onConfirm}
    />
  );
}
