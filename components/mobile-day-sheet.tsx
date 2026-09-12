"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

const TALL = 0.92;
const LOW_MAX = 0.6;
// vaul's own snap transition, so the inner height moves with the sheet
const SNAP_EASE = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

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
        className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
      >
        <span className="grid min-w-0 flex-1 grid-cols-3 gap-2">
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
        </span>
        <ChevronUp className="size-4 shrink-0 text-fg-tertiary" />
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

/** Height of an element, kept current while it is mounted. */
function useElementHeight<T extends HTMLElement>() {
  const [height, setHeight] = useState(0);
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);

  return [useCallback((node: T | null) => setEl(node), []), el ? height : 0] as const;
}

function useWindowHeight() {
  const [height, setHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/** The tapped day: fits its content, and snaps between that height and nearly full screen. */
export function MobileDaySheet({
  model,
  actions,
  open,
  onOpenChange,
}: {
  model: DayViewModel;
  actions: DayActions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const [snapIndex, setSnapIndex] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  const pressY = useRef<number | null>(null);
  // Every opening starts low, however the sheet was closed before
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSnapIndex(0);
  }
  const { selectedDay, dayShifts, dayNotes, canEdit } = model;
  const labels = useDayLabels(selectedDay);

  const windowHeight = useWindowHeight();
  const [topRef, topHeight] = useElementHeight<HTMLDivElement>();
  const [listRef, listHeight] = useElementHeight<HTMLDivElement>();
  const [barRef, barHeight] = useElementHeight<HTMLDivElement>();

  const tall = Math.round(windowHeight * TALL);
  const natural = topHeight + listHeight + barHeight;
  const low = Math.min(natural > 0 ? natural : windowHeight / 2, Math.round(windowHeight * LOW_MAX));
  // vaul measures snap points from the window top, and the list only scrolls at the last point,
  // so the last point is the full sheet and the low one is shifted by the space the sheet leaves free
  const snapPoints: (string | number)[] = [`${Math.round(low + windowHeight - tall)}px`, 1];
  const expanded = snapIndex === 1;

  const close = () => onOpenChange(false);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={snapPoints[snapIndex]}
      setActiveSnapPoint={(point) => setSnapIndex(point === 1 ? 1 : 0)}
      fadeFromIndex={0}
      snapToSequentialPoint
    >
      <DrawerContent
        style={{ height: tall }}
        className="rounded-t-[18px] border-line bg-background shadow-sheet dark:bg-surface-panel [&>div:first-child]:hidden data-[vaul-drawer-direction=bottom]:max-h-none data-[vaul-drawer-direction=bottom]:rounded-t-[18px]"
      >
        <div
          style={{ height: expanded ? tall : low }}
          className={`flex flex-col overflow-hidden transition-[height] ${SNAP_EASE}`}
        >
          <div ref={topRef} className="shrink-0">
            <button
              type="button"
              onPointerDown={(e) => {
                pressY.current = e.clientY;
              }}
              onClick={(e) => {
                // vaul captures the pointer, so a drag that starts here also ends in a click
                if (pressY.current !== null && Math.abs(e.clientY - pressY.current) > 6) return;
                setSnapIndex(expanded ? 0 : 1);
              }}
              aria-label={expanded ? t("calendarView.sheetShrink") : t("calendarView.sheetExpand")}
              className="flex w-full justify-center pb-1 pt-2"
            >
              <span className="h-1 w-[34px] rounded-full bg-control" />
            </button>

            <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1">
              <div className="min-w-0">
                <div className={labels.isToday ? "eyebrow text-brand-ink" : "eyebrow"}>
                  {labels.eyebrow}
                </div>
                <DrawerTitle className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em] text-fg-strong">
                  {labels.long}
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
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <div ref={listRef} className="flex flex-col gap-2 pb-3">
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
          </div>

          {canEdit && (
            <div
              ref={barRef}
              className="flex shrink-0 gap-2 border-t border-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3"
            >
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Week, month or year in figures, opened from the footer. */
export function MobileStatsSheet({
  model,
  actions,
  period,
  onPeriodChange,
  summary,
  open,
  onOpenChange,
}: {
  model: DayViewModel;
  actions: DayActions;
  period: StatsPeriod;
  onPeriodChange: (period: StatsPeriod) => void;
  summary: PeriodSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { selectedDay, currentDate } = model;
  const dateLocale = getDateLocale(locale);
  const monthName = format(currentDate, "LLLL", { locale: dateLocale });

  const heading =
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

  const close = () => onOpenChange(false);
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[18px] border-line bg-background shadow-sheet dark:bg-surface-panel [&>div:first-child]:hidden data-[vaul-drawer-direction=bottom]:max-h-[92dvh] data-[vaul-drawer-direction=bottom]:rounded-t-[18px]">
        <div className="flex justify-center pb-1 pt-2">
          <span className="h-1 w-[34px] rounded-full bg-control" />
        </div>

        <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-1">
          <div className="min-w-0">
            <div className="eyebrow">{heading.eyebrow}</div>
            <DrawerTitle className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em] text-fg-strong">
              {heading.title}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("calendarView.statsSheetDescription")}
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

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
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
          <PeriodSummaryView summary={summary} columns="cards" />
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
      </DrawerContent>
    </Drawer>
  );
}
