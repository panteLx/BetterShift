"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatLongDate } from "@/lib/date-utils";
import { format, getISOWeek, isToday, isTomorrow, isYesterday } from "date-fns";
import { ArrowUpRight, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";
import { getDateLocale } from "@/lib/locales";
import { formatHours } from "@/lib/shift-display";
import { PeriodSummary } from "@/hooks/useDaySummary";
import {
  Kpi,
  NoteDetailCard,
  PeriodSummaryView,
  ShiftDetailRow,
} from "@/components/day-detail";
import { cn } from "@/lib/utils";

export interface DayActions {
  onAddShift: () => void;
  onEditShift: (shift: ShiftWithCalendar) => void;
  onDeleteShift: (shift: ShiftWithCalendar) => void;
  onAddNote: () => void;
  onOpenNote: (note: CalendarNote) => void;
  onOpenStats: () => void;
  onOpenMonthShifts: () => void;
}

export interface DayViewModel {
  selectedDay: Date;
  currentDate: Date;
  dayShifts: ShiftWithCalendar[];
  dayNotes: CalendarNote[];
  totalMinutes: number;
  summary: PeriodSummary;
  /** createShift — gates the "add a new shift" affordance */
  canAddShift: boolean;
  /** manageOwnNotesEvents — creating a note/event only ever needs "own" */
  canAddNote: boolean;
  /** Per-shift own/any precision (editOwnShift/editAnyShift) */
  canEditShift: (shift: ShiftWithCalendar) => boolean;
  /** Per-shift own/any precision (deleteOwnShift/deleteAnyShift) — independent from canEditShift */
  canDeleteShift: (shift: ShiftWithCalendar) => boolean;
}

export function useDayLabels(day: Date) {
  const t = useTranslations();
  const locale = useLocale();
  const eyebrow = isToday(day)
    ? t("calendarView.today")
    : isTomorrow(day)
      ? t("calendarView.tomorrow")
      : isYesterday(day)
        ? t("calendarView.yesterday")
        : t("calendarView.calendarWeek", { week: getISOWeek(day) });
  const long = formatLongDate(day, locale);
  const short = formatLongDate(day, locale, { month: "short" });
  return { eyebrow, long, short, isToday: isToday(day) };
}

export function DayInspector({
  model,
  actions,
  canViewStats,
}: {
  model: DayViewModel;
  actions: DayActions;
  canViewStats: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const {
    selectedDay,
    currentDate,
    dayShifts,
    dayNotes,
    totalMinutes,
    summary,
    canAddShift,
    canAddNote,
    canEditShift,
    canDeleteShift,
  } = model;
  const labels = useDayLabels(selectedDay);
  const monthName = format(currentDate, "LLLL", { locale: getDateLocale(locale) });

  return (
    <aside className="flex w-[344px] shrink-0 flex-col border-l border-line bg-surface-panel">
      <div className="border-b border-line px-[18px] pb-3.5 pt-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div
              className={cn(
                "eyebrow",
                labels.isToday && "text-brand-ink dark:text-brand-ink"
              )}
            >
              {labels.eyebrow}
            </div>
            <h2 className="mt-[3px] truncate text-[19px] font-semibold tracking-[-0.01em] text-fg-strong">
              {labels.short}
            </h2>
          </div>
          {canAddShift && (
            <Button
              size="sm"
              onClick={actions.onAddShift}
              className="h-[30px] gap-1.5 rounded-lg px-[11px] text-[13px] font-semibold"
            >
              <Plus className="size-[15px]" />
              {t("calendarView.shift")}
            </Button>
          )}
        </div>
        <div className="mt-3 flex gap-4">
          <Kpi label={t("calendarView.kpiShifts")} value={dayShifts.length} />
          <Kpi label={t("calendarView.kpiHours")} value={formatHours(totalMinutes, locale)} />
          <Kpi label={t("calendarView.kpiNotes")} value={dayNotes.length} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-[18px] py-3.5">
        {dayShifts.map((shift) => (
          <ShiftDetailRow
            key={shift.id}
            shift={shift}
            canEdit={canEditShift(shift)}
            canDelete={canDeleteShift(shift)}
            actions="menu"
            onEdit={actions.onEditShift}
            onDelete={actions.onDeleteShift}
          />
        ))}
        {dayNotes.map((note) => (
          <NoteDetailCard
            key={note.id}
            note={note}
            onOpen={canAddNote ? actions.onOpenNote : undefined}
          />
        ))}
        {dayShifts.length === 0 && dayNotes.length === 0 && (
          <p className="px-1 py-2 text-[13px] text-fg-tertiary">
            {t("calendarView.dayEmpty")}
          </p>
        )}
        {canAddNote && (
          <button
            type="button"
            onClick={actions.onAddNote}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-control p-2.5 text-[13px] font-medium text-fg-secondary transition-colors hover:bg-surface-card"
          >
            <Plus className="size-[15px]" />
            {t("calendarView.addNoteOrEvent")}
          </button>
        )}
      </div>

      <div className="border-t border-line px-[18px] py-3.5">
        <div className={cn("flex items-center justify-between", canViewStats && "mb-2.5")}>
          <span className="eyebrow">
            {canViewStats
              ? t("calendarView.monthTotal", { month: monthName })
              : t("calendarView.allShiftsIn", { month: monthName })}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={actions.onOpenMonthShifts}
              title={t("calendarView.allShiftsIn", { month: monthName })}
              aria-label={t("calendarView.allShiftsIn", { month: monthName })}
              className="flex size-7 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken"
            >
              <List className="size-[15px]" />
            </button>
            {canViewStats && (
              <button
                type="button"
                onClick={actions.onOpenStats}
                title={t("calendarView.openStats")}
                aria-label={t("calendarView.openStats")}
                className="flex size-7 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-sunken"
              >
                <ArrowUpRight className="size-[15px]" />
              </button>
            )}
          </div>
        </div>
        {canViewStats && <PeriodSummaryView summary={summary} />}
      </div>
    </aside>
  );
}
