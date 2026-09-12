"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatLongDate } from "@/lib/date-utils";
import { PanelDialog } from "@/components/panel-dialog";
import { ShiftDetailRow } from "@/components/day-detail";
import { ShiftWithCalendar } from "@/lib/types";
import { formatHours, getShiftMinutes } from "@/lib/shift-display";

interface ShiftsOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  shifts: ShiftWithCalendar[];
  onDeleteShift?: (shiftId: string) => void;
  onEditShift?: (shift: ShiftWithCalendar) => void;
  /** Viewer's edit permission on the calendar the shifts belong to */
  canEdit: boolean;
}

export function ShiftsOverviewDialog({
  open,
  onOpenChange,
  date,
  shifts,
  onDeleteShift,
  onEditShift,
  canEdit,
}: ShiftsOverviewDialogProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (!date) return null;

  const formattedDate = formatLongDate(date, locale, { year: true });
  const minutes = shifts.reduce((sum, s) => sum + getShiftMinutes(s), 0);

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={formattedDate}
      description={
        t("calendarView.shiftCount", { count: shifts.length }) +
        (minutes > 0 ? ` · ${formatHours(minutes, locale)}` : "")
      }
      width="md"
    >
      {shifts.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-fg-tertiary">
          {t("calendarView.dayEmpty")}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {shifts.map((shift) => (
            <ShiftDetailRow
              key={shift.id}
              shift={shift}
              canEdit={canEdit && !!onEditShift && !!onDeleteShift}
              actions="menu"
              onEdit={(s) => {
                onOpenChange(false);
                onEditShift?.(s);
              }}
              onDelete={(s) => onDeleteShift?.(s.id)}
            />
          ))}
        </div>
      )}
    </PanelDialog>
  );
}
