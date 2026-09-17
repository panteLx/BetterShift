"use client";

import { useTranslations } from "next-intl";
import { PanelDialog } from "@/components/panel-dialog";
import { ShiftStats } from "@/components/shift-stats";

interface MonthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDate: Date;
}

export function MonthStatsDialog({
  open,
  onOpenChange,
  currentDate,
  calendarId,
}: MonthDialogProps & { calendarId: string | undefined }) {
  const t = useTranslations();
  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("stats.title")}
      width="lg"
      bodyClassName="px-3 py-3 sm:px-4"
    >
      <ShiftStats calendarId={calendarId} currentDate={currentDate} />
    </PanelDialog>
  );
}
