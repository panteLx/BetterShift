"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PanelDialog } from "@/components/panel-dialog";
import { SectionLabel } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import type { AdminCalendar } from "@/hooks/useAdminCalendars";

interface CalendarBulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendars: AdminCalendar[];
  onConfirm: () => Promise<void>;
}

const PREVIEW_LIMIT = 5;

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
      setUnderstood(false);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setUnderstood(false);
    onOpenChange(false);
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("common.deleteSelected")}
      description={t("admin.calendars.bulkDeleteConfirm", { count: calendars.length })}
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
            disabled={!understood || isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {isSubmitting ? t("common.saving") : t("admin.calendars.confirmDelete")}
          </Button>
        </>
      }
    >
      <StatusBanner tone="danger" icon={TriangleAlert}>
        {t("admin.calendars.bulkDeleteWarning")}
      </StatusBanner>

      <section>
        <SectionLabel>{t("admin.calendars.calendarsToDelete")}</SectionLabel>
        <ul className="flex flex-col divide-y divide-line-subtle rounded-[11px] border border-line bg-surface-card">
          {calendars.slice(0, PREVIEW_LIMIT).map((calendar) => (
            <li key={calendar.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
              <span
                className="shift-rail size-2.5 shrink-0 rounded-full"
                style={{ "--shift": calendar.color } as React.CSSProperties}
              />
              <span className="truncate text-[13.5px] font-semibold text-fg-strong">{calendar.name}</span>
            </li>
          ))}
          {calendars.length > PREVIEW_LIMIT && (
            <li className="px-3.5 py-2.5 text-[12.5px] text-fg-tertiary">
              {t("admin.calendars.andMore", { count: calendars.length - PREVIEW_LIMIT })}
            </li>
          )}
        </ul>
      </section>

      <div className="flex items-start gap-3">
        <Checkbox
          id="bulk-delete-understood"
          checked={understood}
          onCheckedChange={(checked) => setUnderstood(checked === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor="bulk-delete-understood"
          className="cursor-pointer text-[13.5px] font-medium leading-snug text-fg-body"
        >
          {t("admin.calendars.deleteUnderstood")}
        </Label>
      </div>
    </PanelDialog>
  );
}
