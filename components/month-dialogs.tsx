"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { PanelDialog } from "@/components/panel-dialog";
import { ShiftStats } from "@/components/shift-stats";
import { ShiftDetailRow } from "@/components/day-detail";
import { ShiftWithCalendar } from "@/lib/types";
import { getDateLocale } from "@/lib/locales";
import { formatDateToLocal, formatLongDate } from "@/lib/date-utils";
import { formatHours, getShiftMinutes, sortShifts } from "@/lib/shift-display";

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

export function MonthShiftsDialog({
  open,
  onOpenChange,
  currentDate,
  shifts,
  canEdit,
  onEditShift,
  onDeleteShift,
}: MonthDialogProps & {
  shifts: ShiftWithCalendar[];
  canEdit: boolean;
  onEditShift: (shift: ShiftWithCalendar) => void;
  onDeleteShift: (shift: ShiftWithCalendar) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const days = useMemo(() => {
    const inMonth = shifts.filter((s) => {
      const d = s.date as Date | null;
      return (
        d &&
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear()
      );
    });
    const groups = new Map<string, { date: Date; shifts: ShiftWithCalendar[] }>();
    for (const shift of inMonth) {
      const date = shift.date as Date;
      const key = formatDateToLocal(date);
      const group = groups.get(key) ?? { date, shifts: [] };
      group.shifts.push(shift);
      groups.set(key, group);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, group]) => ({
        key,
        date: group.date,
        shifts: sortShifts(group.shifts, "startTime"),
      }));
  }, [shifts, currentDate]);

  const total = days.reduce((sum, d) => sum + d.shifts.length, 0);
  const monthLabel = format(currentDate, "LLLL yyyy", { locale: dateLocale });

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("calendarView.allShiftsIn", {
        month: format(currentDate, "LLLL", { locale: dateLocale }),
      })}
      description={`${monthLabel} · ${t("calendarView.shiftCount", { count: total })}`}
      width="md"
    >
      {days.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-fg-tertiary">
          {t("shift.noShiftsInMonth")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {days.map((day) => {
            const minutes = day.shifts.reduce((sum, s) => sum + getShiftMinutes(s), 0);
            return (
              <section key={day.key} className="flex flex-col gap-1.5">
                <h3 className="flex items-baseline gap-2 text-[13px] font-semibold text-fg-strong">
                  {formatLongDate(day.date, locale)}
                  <span className="font-mono text-[11.5px] font-normal text-fg-tertiary">
                    {t("calendarView.shiftCount", { count: day.shifts.length })}
                    {minutes > 0 && ` · ${formatHours(minutes, locale)}`}
                  </span>
                </h3>
                {day.shifts.map((shift) => (
                  <ShiftDetailRow
                    key={shift.id}
                    shift={shift}
                    canEdit={canEdit}
                    actions="menu"
                    onEdit={(s) => {
                      onOpenChange(false);
                      onEditShift(s);
                    }}
                    onDelete={onDeleteShift}
                  />
                ))}
              </section>
            );
          })}
        </div>
      )}
    </PanelDialog>
  );
}
