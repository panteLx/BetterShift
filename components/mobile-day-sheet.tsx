"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format, getISOWeek } from "date-fns";
import { ChevronDown, ChevronRight, ChevronUp, List, Plus, StickyNote } from "lucide-react";
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
import { formatHours } from "@/lib/shift-display";
import { cn } from "@/lib/utils";

type SheetTab = "day" | "stats" | "notes";

interface MobileDaySheetProps {
  model: DayViewModel;
  actions: DayActions;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
  periodSummary: PeriodSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Collapsed one-line summary of the selected day that opens the sheet. */
export function MobileDayPeek({
  model,
  onOpen,
}: {
  model: DayViewModel;
  onOpen: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { selectedDay, dayShifts, totalMinutes, dayNotes } = model;
  const title = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(selectedDay);
  const parts = dayShifts.map((s) =>
    s.isAllDay ? s.title : `${s.title} ${s.startTime.slice(0, 5)}`
  );
  if (totalMinutes > 0) parts.push(formatHours(totalMinutes, locale));

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-t border-line bg-background px-4 py-2.5 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-fg-strong">{title}</span>
        <span className="block truncate font-mono text-[12px] text-fg-tertiary">
          {parts.length > 0
            ? parts.join(" · ")
            : dayNotes.length > 0
              ? t("calendarView.notesCount", { count: dayNotes.length })
              : t("calendarView.dayFree")}
        </span>
      </span>
      <ChevronUp className="size-[18px] shrink-0 text-fg-secondary" />
    </button>
  );
}

export function MobileDaySheet({
  model,
  actions,
  period,
  onPeriodChange,
  periodSummary,
  open,
  onOpenChange,
}: MobileDaySheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [tab, setTab] = useState<SheetTab>("day");
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
            onChange={setTab}
            options={[
              { value: "day", label: t("calendarView.tabDay") },
              { value: "stats", label: t("calendarView.tabStats") },
              {
                value: "notes",
                label: t("calendarView.tabNotes"),
                badge:
                  dayNotes.length > 0 ? (
                    <span className="rounded-full bg-line px-1.5 font-mono text-[11px] text-fg-secondary">
                      {dayNotes.length}
                    </span>
                  ) : undefined,
              },
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

          {tab === "notes" && (
            <div className="flex flex-col gap-2">
              {dayNotes.map((note) => (
                <NoteDetailCard
                  key={note.id}
                  note={note}
                  onOpen={canEdit ? (n) => { close(); actions.onOpenNote(n); } : undefined}
                />
              ))}
              {dayNotes.length === 0 && (
                <p className="py-3 text-center text-[13px] text-fg-tertiary">
                  {t("note.noEntries")}
                </p>
              )}
            </div>
          )}
        </div>

        {canEdit && tab !== "stats" && (
          <div className="flex gap-2 border-t border-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
            {tab === "day" && (
              <Button
                onClick={run(actions.onAddShift)}
                className="h-11 flex-1 gap-2 rounded-[10px] text-[14px] font-semibold"
              >
                <Plus className="size-[18px]" />
                {t("calendarView.shift")}
              </Button>
            )}
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
