"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addMonths, format, isSameMonth, isToday, subMonths } from "date-fns";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Columns2,
  Info,
  Link2,
  Plus,
  Share,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "@/components/month-grid";
import { MonthStepper } from "@/components/app-header";
import { PresetManageSheet } from "@/components/preset-manage-sheet";
import { MorePresets, orderStampPresets, splitStampPresets } from "@/components/stamp-dock";
import { MAX_COMPARE_CALENDARS } from "@/components/calendar-compare-sheet";
import { useDayLabels } from "@/components/day-inspector";
import { CalendarWithCount, ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import {
  DayLayoutOptions,
  formatHours,
  getShiftCode,
  getShiftMinutes,
  getShiftsForDay,
  isSameLocalDay,
  sortShifts,
} from "@/lib/shift-display";
import { getDateLocale } from "@/lib/locales";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useStampShortcuts } from "@/hooks/useStampShortcuts";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

interface CompareWorkspaceProps {
  calendars: CalendarWithCount[];
  calendarDays: Date[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedDay: Date;
  onSelectDay: (date: Date) => void;
  shiftsMap: Map<string, ShiftWithCalendar[]>;
  notesMap: Map<string, CalendarNote[]>;
  externalSyncsMap: Map<string, ExternalSync[]>;
  presetsMap: Map<string, ShiftPreset[]>;
  togglingDatesMap: Map<string, Set<string>>;
  layout: DayLayoutOptions;
  showShiftNotes: boolean;
  showFullTitles: boolean;
  highlightedWeekdays: number[];
  highlightColor: string;
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string | undefined) => void;
  onDayClick: (calendarId: string, date: Date) => void;
  onDayContextMenu: (calendarId: string, date: Date) => void;
  onOpenDayShifts: (date: Date, shifts: ShiftWithCalendar[]) => void;
  onPresetsChange: (calendarId: string) => void;
  onAddCalendar: () => void;
  onViewSettings: () => void;
  onExit: () => void;
}

function monthTotals(shifts: ShiftWithCalendar[], month: Date) {
  const inMonth = shifts.filter((s) => s.date && isSameMonth(s.date as Date, month));
  return {
    count: inMonth.length,
    minutes: inMonth.reduce((sum, s) => sum + getShiftMinutes(s), 0),
  };
}

function useShareCompareLink(ids: string[]) {
  const t = useTranslations();
  return () => {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", ids.join(","));
    navigator.clipboard
      .writeText(url.toString())
      .then(() => toast.success(t("common.copied", { item: t("calendar.compareMode") })))
      .catch(() => toast.error(t("common.error")));
  };
}

export function CompareWorkspace(props: CompareWorkspaceProps) {
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const [manageCalendarId, setManageCalendarId] = useState<string | null>(null);

  const presetOwner = useMemo(() => {
    if (!props.selectedPresetId) return null;
    for (const [calendarId, presets] of props.presetsMap) {
      if (presets.some((p) => p.id === props.selectedPresetId)) return calendarId;
    }
    return null;
  }, [props.presetsMap, props.selectedPresetId]);

  const activeColumnId = presetOwner ?? props.calendars[0]?.id;
  const activePresets = orderStampPresets(props.presetsMap.get(activeColumnId ?? "") ?? []);

  useStampShortcuts({
    presetIds: activePresets.map((p) => p.id),
    selectedPresetId: props.selectedPresetId,
    onSelectPreset: props.onSelectPreset,
    enabled: desktop,
  });

  const managed = props.calendars.find((c) => c.id === manageCalendarId);

  return (
    <>
      {desktop ? (
        <CompareDesktop
          {...props}
          presetOwner={presetOwner}
          activeColumnId={activeColumnId}
          onManagePresets={setManageCalendarId}
        />
      ) : (
        <CompareMobile {...props} />
      )}
      {managed && (
        <PresetManageSheet
          open={!!manageCalendarId}
          onOpenChange={(open) => !open && setManageCalendarId(null)}
          calendarId={managed.id}
          presets={props.presetsMap.get(managed.id) ?? []}
          onPresetsChange={() => props.onPresetsChange(managed.id)}
        />
      )}
    </>
  );
}

function CompareDesktop({
  calendars,
  currentDate,
  onDateChange,
  onSelectDay,
  selectedDay,
  onAddCalendar,
  onViewSettings,
  onExit,
  shiftsMap,
  onOpenDayShifts,
  presetOwner,
  activeColumnId,
  onManagePresets,
  ...rest
}: CompareWorkspaceProps & {
  presetOwner: string | null;
  activeColumnId: string | undefined;
  onManagePresets: (calendarId: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const share = useShareCompareLink(calendars.map((c) => c.id));
  const labels = useDayLabels(selectedDay);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-[18px]">
        <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-brand">
          <Columns2 className="size-[15px] text-white" />
        </span>
        <h1 className="text-[15px] font-semibold text-fg-strong">{t("calendarCompare.title")}</h1>
        <div className="mx-1 h-6 w-px bg-line" />
        <MonthStepper currentDate={currentDate} onDateChange={onDateChange} />
        <Button
          variant="outline"
          size="sm"
          className="h-8 font-semibold"
          onClick={() => {
            onDateChange(new Date());
            onSelectDay(new Date());
          }}
        >
          {t("calendarView.today")}
        </Button>
        <div className="flex-1" />
        {calendars.length < MAX_COMPARE_CALENDARS && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 font-semibold" onClick={onAddCalendar}>
            <Plus className="size-4" />
            {t("calendarCompare.addCalendar")}
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 font-semibold" onClick={share}>
          <Link2 className="size-4" />
          {t("calendar.shareLink")}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={onViewSettings}
          aria-label={t("appMenu.viewSettings")}
        >
          <SlidersHorizontal className="size-4 text-fg-secondary" />
        </Button>
        <Button
          size="sm"
          onClick={onExit}
          className="h-8 gap-1.5 bg-fg-strong font-semibold text-background hover:bg-fg-strong/90"
        >
          <X className="size-4" />
          {t("calendarCompare.exit")}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 divide-x divide-line">
        {calendars.map((calendar) => (
          <CompareColumn
            key={calendar.id}
            calendar={calendar}
            currentDate={currentDate}
            selectedDay={selectedDay}
            shifts={shiftsMap.get(calendar.id) ?? []}
            stampActive={presetOwner === calendar.id}
            keysActive={activeColumnId === calendar.id}
            onManagePresets={() => onManagePresets(calendar.id)}
            {...rest}
          />
        ))}
      </div>

      <footer className="flex shrink-0 items-center gap-3 border-t border-line bg-surface-panel px-[18px] py-3">
        <div className="w-[150px] shrink-0">
          <div className={cn("eyebrow", labels.isToday && "text-brand-ink")}>{labels.eyebrow}</div>
          <div className="mt-0.5 truncate text-[15px] font-semibold text-fg-strong">
            {labels.short}
          </div>
        </div>
        {calendars.map((calendar) => {
          const dayShifts = sortShifts(
            getShiftsForDay(shiftsMap.get(calendar.id) ?? [], selectedDay),
            "startTime"
          );
          const minutes = dayShifts.reduce((sum, s) => sum + getShiftMinutes(s), 0);
          return (
            <button
              key={calendar.id}
              type="button"
              disabled={dayShifts.length === 0}
              onClick={() => onOpenDayShifts(selectedDay, dayShifts)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-[11px] border border-line bg-surface-card px-3 py-3 text-left transition-colors enabled:hover:bg-surface-panel"
            >
              <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: calendar.color }} />
              <span className="shrink-0 text-[13.5px] font-semibold text-fg-strong">{calendar.name}</span>
              <span className="h-5 w-px shrink-0 bg-line" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-secondary">
                {dayShifts.length
                  ? dayShifts.map((s) => s.title).join(", ")
                  : t("calendarView.dayFree")}
              </span>
              {minutes > 0 && (
                <span className="shrink-0 font-mono text-[13px] text-fg-secondary">
                  {formatHours(minutes, locale)}
                </span>
              )}
            </button>
          );
        })}
      </footer>
    </div>
  );
}

function CompareColumn({
  calendar,
  currentDate,
  selectedDay,
  shifts,
  stampActive,
  keysActive,
  onManagePresets,
  calendarDays,
  notesMap,
  externalSyncsMap,
  presetsMap,
  togglingDatesMap,
  layout,
  showShiftNotes,
  showFullTitles,
  highlightedWeekdays,
  highlightColor,
  selectedPresetId,
  onSelectPreset,
  onDayClick,
  onDayContextMenu,
}: Omit<
  CompareWorkspaceProps,
  | "calendars"
  | "onDateChange"
  | "onSelectDay"
  | "onAddCalendar"
  | "onViewSettings"
  | "onExit"
  | "shiftsMap"
  | "onOpenDayShifts"
  | "onPresetsChange"
> & {
  calendar: CalendarWithCount;
  shifts: ShiftWithCalendar[];
  stampActive: boolean;
  keysActive: boolean;
  onManagePresets: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { canEdit } = useCalendarPermission(calendar.id);
  const { primary, secondary } = splitStampPresets(presetsMap.get(calendar.id) ?? []);
  const totals = monthTotals(shifts, currentDate);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col pb-3">
      <div className="px-4 pt-3.5">
        <div className="flex items-center gap-2.5">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: calendar.color }} />
          <h2 className="truncate text-[15px] font-semibold text-fg-strong">{calendar.name}</h2>
          {stampActive && (
            <span className="rounded-full bg-brand-soft px-[7px] py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-brand-ink">
              {t("calendarCompare.stampActive")}
            </span>
          )}
          <span className="ml-auto shrink-0 font-mono text-[12px] text-fg-tertiary">
            {t("calendarView.shiftCount", { count: totals.count })} ·{" "}
            {formatHours(totals.minutes, locale)}
          </span>
        </div>
        {canEdit && (
          <div className="mt-2.5 flex h-8 items-center gap-1.5 overflow-hidden">
            <div className="flex min-w-0 items-center gap-1.5 overflow-hidden empty:hidden">
              {primary.map((preset, index) => {
                const active = preset.id === selectedPresetId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectPreset(active ? undefined : preset.id)}
                    className={cn(
                      "flex h-7 shrink-0 items-center gap-[7px] rounded-[7px] border px-2.5 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-brand bg-brand-soft text-brand-ink"
                        : "border-line bg-surface-card text-fg-body hover:bg-surface-panel"
                    )}
                  >
                    <span className="size-[7px] rounded-full" style={{ backgroundColor: preset.color }} />
                    {preset.title}
                    {keysActive && index < 9 && (
                      <kbd className="rounded-[4px] bg-surface-sunken px-1 font-mono text-[10px] font-normal text-fg-tertiary">
                        {index + 1}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
            <MorePresets
              variant="compare"
              presets={secondary}
              selectedPresetId={selectedPresetId}
              onSelectPreset={onSelectPreset}
            />
            <button
              type="button"
              onClick={onManagePresets}
              aria-label={t("calendarView.managePresets")}
              className="flex size-7 shrink-0 items-center justify-center rounded-[7px] text-fg-tertiary hover:bg-surface-sunken"
            >
              <SlidersHorizontal className="size-3.5" />
            </button>
            {!keysActive && primary.length + secondary.length > 0 && (
              <span className="min-w-0 flex-1 truncate pl-1 text-[12px] text-fg-tertiary">
                {t("calendarCompare.tapToMoveStamp")}
              </span>
            )}
          </div>
        )}
      </div>
      <MonthGrid
        variant="compare"
        calendarDays={calendarDays}
        currentDate={currentDate}
        selectedDay={selectedDay}
        shifts={shifts}
        notes={notesMap.get(calendar.id) ?? []}
        externalSyncs={externalSyncsMap.get(calendar.id) ?? []}
        togglingDates={togglingDatesMap.get(calendar.id) ?? new Set()}
        layout={layout}
        showShiftNotes={showShiftNotes}
        showFullTitles={showFullTitles}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        onDayClick={(date) => onDayClick(calendar.id, date)}
        onDayContextMenu={canEdit ? (date) => onDayContextMenu(calendar.id, date) : undefined}
      />
    </section>
  );
}

function CompareMobile({
  calendars,
  calendarDays,
  currentDate,
  onDateChange,
  selectedDay,
  onSelectDay,
  shiftsMap,
  presetsMap,
  onAddCalendar,
  onExit,
  onOpenDayShifts,
}: CompareWorkspaceProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const share = useShareCompareLink(calendars.map((c) => c.id));
  const labels = useDayLabels(selectedDay);

  // One legend entry per shift title across all compared calendars
  const legend = useMemo(() => {
    const seen = new Map<string, string>();
    for (const calendar of calendars) {
      const { primary, secondary } = splitStampPresets(presetsMap.get(calendar.id) ?? []);
      for (const preset of [...primary, ...secondary]) {
        if (!seen.has(preset.title)) seen.set(preset.title, preset.color);
      }
    }
    return [...seen.entries()];
  }, [calendars, presetsMap]);

  const laneHint =
    calendars.length === 2
      ? t("calendarCompare.laneHintTwo", { top: calendars[0].name, bottom: calendars[1].name })
      : t("calendarCompare.laneHintMany", { order: calendars.map((c) => c.name).join(", ") });

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
        <button
          type="button"
          onClick={onExit}
          aria-label={t("calendarCompare.exit")}
          className="flex size-9 items-center justify-center rounded-lg text-fg-secondary"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-semibold text-fg-strong">{t("calendarCompare.title")}</h1>
          <p className="truncate text-[12.5px] text-fg-tertiary">
            {t("calendarCompare.subtitle", { count: calendars.length })} ·{" "}
            {format(currentDate, "LLLL yyyy", { locale: dateLocale })}
          </p>
        </div>
        <button
          type="button"
          onClick={share}
          aria-label={t("calendar.shareLink")}
          className="flex size-9 items-center justify-center rounded-lg text-fg-secondary"
        >
          <Share className="size-5" />
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3">
          <div className="flex gap-2">
            {calendars.map((calendar) => (
              <span
                key={calendar.id}
                className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border-[1.5px] px-3 text-[13.5px] font-semibold"
                style={{
                  borderColor: calendar.color,
                  color: calendar.color,
                  backgroundColor: `color-mix(in oklch, ${calendar.color} 7%, var(--surface-card))`,
                }}
              >
                <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: calendar.color }} />
                <span className="truncate">{calendar.name}</span>
              </span>
            ))}
            {calendars.length < MAX_COMPARE_CALENDARS && (
              <button
                type="button"
                onClick={onAddCalendar}
                aria-label={t("calendarCompare.addCalendar")}
                className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-control text-fg-secondary"
              >
                <Plus className="size-4" />
              </button>
            )}
          </div>
          <p className="flex gap-2 text-[12px] leading-snug text-fg-secondary">
            <Info className="mt-px size-3.5 shrink-0" />
            {laneHint}
          </p>
          {legend.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {legend.map(([title, color]) => (
                <span key={title} className="flex items-center gap-1.5 text-[12px] text-fg-body">
                  <span
                    className="shift-solid flex size-[17px] items-center justify-center rounded-[4px] text-[10px] font-bold"
                    style={{ "--shift": color } as React.CSSProperties}
                  >
                    {getShiftCode(title)}
                  </span>
                  {title}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 pt-2">
          <div className="flex overflow-hidden rounded-[9px] border border-line">
            <button
              type="button"
              className="flex size-9 items-center justify-center text-fg-secondary"
              onClick={() => onDateChange(subMonths(currentDate, 1))}
              aria-label={t("calendarView.previousMonth")}
            >
              <ChevronLeft className="size-[18px]" />
            </button>
            <span className="w-px bg-line" />
            <button
              type="button"
              className="flex size-9 items-center justify-center text-fg-secondary"
              onClick={() => onDateChange(addMonths(currentDate, 1))}
              aria-label={t("calendarView.nextMonth")}
            >
              <ChevronRight className="size-[18px]" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 px-2 pt-2">
          {(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map(
            (key) => (
              <div
                key={key}
                className="pb-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-tertiary"
              >
                {t(`calendarView.weekdayShort.${key}`)}
              </div>
            )
          )}
        </div>
        <div className="mx-2 mb-3 grid grid-cols-7 gap-px bg-line-grid">
          {calendarDays.map((day) => {
            const inMonth = isSameMonth(day, currentDate);
            const weekend = day.getDay() === 0 || day.getDay() === 6;
            const today = isToday(day);
            const selected = isSameLocalDay(day, selectedDay);
            return (
              <button
                key={day.toISOString()}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  onSelectDay(day);
                  if (!inMonth) onDateChange(day);
                }}
                className={cn(
                  "flex min-w-0 flex-col items-center gap-1 px-1 pb-1.5 pt-[5px]",
                  today ? "bg-surface-today" : weekend ? "bg-surface-weekend" : "bg-surface-cell",
                  !inMonth && "opacity-45",
                  selected && "shadow-[inset_0_0_0_1.5px_var(--brand-dot)]"
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-[22px] items-center justify-center rounded-full font-mono text-[12.5px] font-medium",
                    today ? "bg-brand font-semibold text-white" : "text-fg-body"
                  )}
                >
                  {day.getDate()}
                </span>
                {calendars.map((calendar) => {
                  const dayShifts = inMonth
                    ? sortShifts(getShiftsForDay(shiftsMap.get(calendar.id) ?? [], day), "startTime")
                    : [];
                  const first = dayShifts[0];
                  return (
                    <span key={calendar.id} className="flex w-full items-center gap-[3px]">
                      <span
                        className="h-[18px] w-[3px] shrink-0 rounded-full"
                        style={{ backgroundColor: calendar.color, opacity: inMonth ? 1 : 0.5 }}
                      />
                      {first ? (
                        <span
                          className="shift-solid flex h-[18px] min-w-0 flex-1 items-center justify-center rounded-[4px] text-[10.5px] font-bold"
                          style={{ "--shift": first.color } as React.CSSProperties}
                        >
                          {getShiftCode(first.title)}
                          {dayShifts.length > 1 && (
                            <span className="ml-0.5 font-mono text-[9px] font-semibold opacity-85">
                              +{dayShifts.length - 1}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="h-[18px] min-w-0 flex-1 rounded-[4px] border border-dashed border-control" />
                      )}
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </main>

      <div className="shrink-0 border-t border-line bg-surface-panel px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn("eyebrow", labels.isToday && "text-brand-ink")}>{labels.eyebrow}</span>
          <span className="text-[14px] font-semibold text-fg-strong">{labels.long}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {calendars.map((calendar) => {
            const dayShifts = sortShifts(
              getShiftsForDay(shiftsMap.get(calendar.id) ?? [], selectedDay),
              "startTime"
            );
            return (
              <button
                key={calendar.id}
                type="button"
                disabled={dayShifts.length === 0}
                onClick={() => onOpenDayShifts(selectedDay, dayShifts)}
                className="flex items-center gap-2.5 rounded-[10px] border border-line bg-surface-card px-3 py-2.5 text-left"
              >
                <span className="h-5 w-1 shrink-0 rounded-full" style={{ backgroundColor: calendar.color }} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-fg-strong">
                  {calendar.name} ·{" "}
                  {dayShifts.length ? dayShifts.map((s) => s.title).join(", ") : t("calendarView.dayFree")}
                </span>
                {dayShifts[0] && !dayShifts[0].isAllDay && (
                  <span className="font-mono text-[13px] text-fg-tertiary">
                    {dayShifts[0].startTime.slice(0, 5)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
