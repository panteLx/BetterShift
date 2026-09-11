"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format, getISOWeek } from "date-fns";
import { ChevronDown, ChevronRight, List, Plus, StickyNote } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/segmented-control";
import {
  NoteDetailCard,
  PeriodSummaryView,
  ShiftDetailRow,
} from "@/components/day-detail";
import { DayActions, DayViewModel, useDayLabels } from "@/components/day-inspector";
import { PeriodSummary, StatsPeriod } from "@/hooks/useDaySummary";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

export type SheetTab = "day" | "stats";

interface MobileDaySheetProps {
  model: DayViewModel;
  actions: DayActions;
  tab: SheetTab;
  onTabChange: (tab: SheetTab) => void;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
  periodSummary: PeriodSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Bottom bar under the phone grid: the visible month in figures and a button to add a shift. */
export function MobileDayFooter({
  summary,
  onOpenStats,
  onAddShift,
}: {
  summary: PeriodSummary;
  onOpenStats: () => void;
  /** Hidden when the calendar can't be edited */
  onAddShift?: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { stats, freeDays } = summary;
  const figures = [
    { label: t("calendarView.kpiShifts"), value: stats?.totalShifts ?? "–" },
    {
      label: t("calendarView.kpiHours"),
      value: stats
        ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(stats.totalMinutes / 60)
        : "–",
    },
    { label: t("calendarView.kpiFreeDays"), value: freeDays ?? "–" },
  ];

  return (
    <div className="flex items-center gap-2.5 border-t border-line bg-surface-panel px-3.5 pb-[max(9px,env(safe-area-inset-bottom))] pt-[9px]">
      <button
        type="button"
        onClick={onOpenStats}
        className="grid min-w-0 flex-1 grid-cols-3 gap-2 py-0.5 text-left"
      >
        {figures.map((figure) => (
          <span key={figure.label} className="min-w-0">
            <span className="block truncate font-mono text-[15px] font-medium leading-5 text-fg-strong">
              {figure.value}
            </span>
            <span className="block truncate text-[10.5px] leading-[14px] text-fg-tertiary">
              {figure.label}
            </span>
          </span>
        ))}
      </button>
      {onAddShift && (
        <button
          type="button"
          onClick={onAddShift}
          aria-label={t("calendarView.addShiftManually")}
          className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-brand text-white"
        >
          <Plus className="size-[19px]" />
        </button>
      )}
    </div>
  );
}

export function MobileDaySheet({
  model,
  actions,
  tab,
  onTabChange,
  period,
  onPeriodChange,
  periodSummary,
  open,
  onOpenChange,
}: MobileDaySheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [tall, setTall] = useState(false);
  const { selectedDay, currentDate, dayShifts, dayNotes, canEdit } = model;
  const labels = useDayLabels(selectedDay);
  const dateLocale = getDateLocale(locale);
  const monthName = format(currentDate, "LLLL", { locale: dateLocale });

  const periodHeading =
    period === "week"
      ? {
          eyebrow: t("calendarView.wholeWeek"),
          title: t("calendarView.calendarWeek", { week: getISOWeek(selectedDay) }),
        }
      : period === "year"
        ? { eyebrow: t("calendarView.wholeYear"), title: format(currentDate, "yyyy") }
        : {
            eyebrow: t("calendarView.wholeMonth"),
            title: format(currentDate, "LLLL yyyy", { locale: dateLocale }),
          };

  const heading =
    tab === "stats" ? periodHeading : { eyebrow: labels.eyebrow, title: labels.long };

  const close = () => onOpenChange(false);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setTall(false);
      }}
    >
      <DrawerContent
        className={cn(
          "rounded-t-[18px] border-line bg-background shadow-sheet transition-[height] duration-200 dark:bg-surface-panel [&>div:first-child]:hidden",
          "data-[vaul-drawer-direction=bottom]:max-h-[94dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[18px]",
          tall ? "h-[92dvh]" : "h-auto"
        )}
      >
        <button
          type="button"
          onClick={() => setTall((v) => !v)}
          aria-label={tall ? t("calendarView.sheetShrink") : t("calendarView.sheetExpand")}
          className="flex w-full justify-center pb-1 pt-2"
        >
          <span className="h-1 w-[34px] rounded-full bg-control" />
        </button>

        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1">
          <div className="min-w-0">
            <div
              className={cn(
                "eyebrow",
                tab !== "stats" && labels.isToday && "text-brand-ink"
              )}
            >
              {heading.eyebrow}
            </div>
            <DrawerTitle className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em] text-fg-strong">
              {heading.title}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("calendarView.sheetDescription")}
            </DrawerDescription>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="flex size-9 shrink-0 items-center justify-center rounded-[9px] border border-line text-fg-secondary"
          >
            <ChevronDown className="size-[18px]" />
          </button>
        </div>

        <div className="px-4 pb-3">
          <SegmentedControl<SheetTab>
            size="lg"
            label={t("calendarView.sheetTabs")}
            value={tab}
            onChange={onTabChange}
            options={[
              { value: "day", label: t("calendarView.tabDay") },
              { value: "stats", label: t("calendarView.tabStats") },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
          {tab === "day" && (
            <div className="flex flex-col gap-2">
              {dayShifts.map((shift) => (
                <ShiftDetailRow
                  key={shift.id}
                  shift={shift}
                  canEdit={canEdit}
                  actions="inline"
                  onEdit={(s) => {
                    close();
                    actions.onEditShift(s);
                  }}
                  onDelete={actions.onDeleteShift}
                />
              ))}
              {dayNotes.map((note) => (
                <NoteDetailCard
                  key={note.id}
                  note={note}
                  onOpen={canEdit ? (n) => { close(); actions.onOpenNote(n); } : undefined}
                />
              ))}
              {dayShifts.length === 0 && dayNotes.length === 0 && (
                <p className="py-3 text-center text-[13px] text-fg-tertiary">
                  {t("calendarView.dayEmpty")}
                </p>
              )}
            </div>
          )}

          {tab === "stats" && (
            <div className="flex flex-col gap-3">
              <SegmentedControl<StatsPeriod>
                label={t("calendarView.periodLabel")}
                value={period}
                onChange={onPeriodChange}
                options={[
                  { value: "week", label: t("stats.week") },
                  { value: "month", label: t("stats.month") },
                  { value: "year", label: t("stats.year") },
                ]}
              />
              <PeriodSummaryView summary={periodSummary} columns="cards" />
              {period === "month" && (
                <button
                  type="button"
                  onClick={run(actions.onOpenMonthShifts)}
                  className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-card px-3 py-3 text-left"
                >
                  <List className="size-4 text-fg-secondary" />
                  <span className="flex-1 text-[13.5px] font-semibold text-fg-strong">
                    {t("calendarView.allShiftsIn", { month: monthName })}
                  </span>
                  <ChevronRight className="size-4 text-fg-tertiary" />
                </button>
              )}
              <button
                type="button"
                onClick={run(actions.onOpenStats)}
                className="text-left text-[13px] font-semibold text-brand-ink"
              >
                {t("calendarView.openStats")}
              </button>
            </div>
          )}

        </div>

        {canEdit && tab === "day" && (
          <div className="flex gap-2 border-t border-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            <Button
              onClick={run(actions.onAddShift)}
              className="h-11 flex-1 gap-2 rounded-[10px] text-[14px] font-semibold"
            >
              <Plus className="size-[18px]" />
              {t("calendarView.shift")}
            </Button>
            <Button
              variant="outline"
              onClick={run(actions.onAddNote)}
              className="h-11 flex-1 gap-2 rounded-[10px] text-[14px] font-semibold"
            >
              <StickyNote className="size-[18px]" />
              {t("calendarView.note")}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
