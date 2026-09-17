"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { startOfMonth, startOfWeek } from "date-fns";
import { RefreshCw, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MonthArrows } from "@/components/app-header";
import { MonthGrid } from "@/components/month-grid";
import { WeekGrid } from "@/components/week-grid";
import { ListSort, ShiftListView } from "@/components/shift-list-view";
import { DayInspector, DayActions, DayViewModel } from "@/components/day-inspector";
import { MobileDayFooter, MobileDaySheet, MobileStatsSheet } from "@/components/mobile-day-sheet";
import { MobilePresetBar, StampDock, orderStampPresets } from "@/components/stamp-dock";
import { GuestBanner } from "@/components/guest-banner";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { StatusBanner } from "@/components/status-banner";
import { ViewModeSwitcher } from "@/components/view-mode-switcher";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import { DayLayoutOptions } from "@/lib/shift-display";
import { formatDateToLocal, formatPeriodCaption } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { useDayData, usePeriodSummary, StatsPeriod } from "@/hooks/useDaySummary";
import { useStampShortcuts } from "@/hooks/useStampShortcuts";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuth } from "@/hooks/useAuth";
import { CalendarViewMode } from "@/hooks/useCalendarViewMode";

interface CalendarWorkspaceProps {
  header: React.ReactNode;
  calendarId: string | undefined;
  calendarDays: Date[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  selectedDay: Date;
  onDayClick: (date: Date) => void;
  /** Pure navigation: shows the day's month and selects it, never stamps */
  onSelectDay: (day: Date) => void;
  onDayContextMenu: (date: Date) => void;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  presets: ShiftPreset[];
  externalSyncs: ExternalSync[];
  togglingDates: Set<string>;
  layout: DayLayoutOptions;
  /** List view only: the personal sort, plus whether a calendar-pinned view locks it */
  listSort: ListSort;
  showShiftNotes: boolean;
  highlightedWeekdays: number[];
  highlightColor: string;
  /** createShift — gates the manual "add a new shift" affordance only */
  canCreateShift: boolean;
  /** manageOwnNotesEvents — creating a note/event only ever needs "own" */
  canAddNote: boolean;
  /** Per-shift own/any precision (editOwnShift/editAnyShift) for the edit affordance */
  canEditShift: (shift: ShiftWithCalendar) => boolean;
  /** Per-shift own/any precision (deleteOwnShift/deleteAnyShift) for the delete affordance */
  canDeleteShift: (shift: ShiftWithCalendar) => boolean;
  showStampBar: boolean;
  /** Personal-only: hides the grid and day view down to shifts the current user is signed up for */
  onlyMyShifts: boolean;
  /** stampPreset OR createShift — mirrors the server's OR check for stamping a preset */
  canStampPreset: boolean;
  /** viewStats — hides the stats trigger entirely when absent, instead of failing on click */
  canViewStats: boolean;
  selectedPresetIds: string[];
  onSelectPreset: (id: string | undefined, multiSelect?: boolean) => void;
  onManagePresets: () => void;
  actions: DayActions;
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
}

export function CalendarWorkspace({
  header,
  calendarId,
  calendarDays,
  currentDate,
  onDateChange,
  viewMode,
  onViewModeChange,
  selectedDay,
  onDayClick,
  onSelectDay,
  onDayContextMenu,
  shifts,
  notes,
  presets,
  externalSyncs,
  togglingDates,
  layout,
  listSort,
  showShiftNotes,
  highlightedWeekdays,
  highlightColor,
  canCreateShift,
  canAddNote,
  canEditShift,
  canDeleteShift,
  showStampBar,
  onlyMyShifts,
  canStampPreset,
  canViewStats,
  selectedPresetIds,
  onSelectPreset,
  onManagePresets,
  actions,
  sheetOpen,
  onSheetOpenChange,
}: CalendarWorkspaceProps) {
  const t = useTranslations();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { isGuest, user } = useAuth();
  const { isOnline } = useConnectionStatus({ toasts: false });
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [statsOpen, setStatsOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<{ key: string; nonce: number } | null>(null);

  // Grid and day view only; stats stay on the full list so totals don't look broken
  const visibleShifts = useMemo(() => {
    if (!onlyMyShifts || !user) return shifts;
    return shifts.filter((shift) => shift.signups?.some((s) => s.id === user.id));
  }, [shifts, onlyMyShifts, user]);

  // Own shifts only: imported calendars (holidays, colleagues) are not "my next shift"
  const nextShift = useMemo(() => {
    if (viewMode !== "list" || desktop) return null;
    const now = new Date();
    const todayKey = formatDateToLocal(now);
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    let best: { shift: ShiftWithCalendar; sortKey: string } | null = null;
    for (const shift of visibleShifts) {
      if (!shift.date || shift.syncedFromExternal) continue;
      const dayKey = formatDateToLocal(shift.date as Date);
      if (dayKey < todayKey) continue;
      // Today's shifts that already ended are over; overnight ones (end < start) still count
      const ended =
        dayKey === todayKey &&
        !shift.isAllDay &&
        shift.endTime > shift.startTime &&
        shift.endTime.slice(0, 5) <= nowTime;
      if (ended) continue;
      const sortKey = `${dayKey} ${shift.isAllDay ? "00:00" : shift.startTime}`;
      if (!best || sortKey < best.sortKey) best = { shift, sortKey };
    }
    return best?.shift ?? null;
  }, [viewMode, visibleShifts, desktop]);

  // MobileStatsSheet is skip-mounted below when !canViewStats, so a lingering
  // `true` here would pop it open unbidden if the capability comes back later.
  // Adjusted during render (not an effect) per React's "adjusting state when a
  // prop changes" pattern, to avoid an extra commit.
  const [prevCanViewStats, setPrevCanViewStats] = useState(canViewStats);
  if (canViewStats !== prevCanViewStats) {
    setPrevCanViewStats(canViewStats);
    if (!canViewStats) setStatsOpen(false);
  }

  const dayData = useDayData({ selectedDay, shifts: visibleShifts, notes });
  // First-of-month, not the exact day, so stepping through the month reuses one cache entry
  const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
  const monthAnchor = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number);
    return startOfMonth(new Date(year, month, 1));
  }, [monthKey]);
  const monthSummary = usePeriodSummary({
    calendarId: canViewStats ? calendarId : undefined,
    anchorDate: monthAnchor,
    period: "month",
    shifts,
  });
  // Anchored on the week, not the day, so tapping around inside a week reuses one cache entry
  const sheetSummary = usePeriodSummary({
    calendarId: statsOpen && canViewStats ? calendarId : undefined,
    anchorDate: period === "week" ? startOfWeek(selectedDay, { weekStartsOn: 1 }) : monthAnchor,
    period,
    shifts,
  });

  const stampingEnabled = canStampPreset && isOnline && showStampBar;
  const step = viewMode === "week" ? "week" : "month";
  const stampPresetIds = useMemo(
    () => orderStampPresets(presets).map((p) => p.id),
    [presets]
  );
  useStampShortcuts({
    presetIds: stampPresetIds,
    selectedPresetIds,
    onSelectPreset,
    enabled: stampingEnabled && desktop,
  });

  const model: DayViewModel = {
    selectedDay,
    currentDate,
    ...dayData,
    summary: monthSummary,
    canAddShift: canCreateShift && isOnline,
    canAddNote: canAddNote && isOnline,
    canEditShift: (shift) => canEditShift(shift) && isOnline,
    canDeleteShift: (shift) => canDeleteShift(shift) && isOnline,
  };

  const banners = (
    <>
      {!isOnline && (
        <StatusBanner
          tone="danger"
          icon={WifiOff}
          title={t("calendarView.offlineTitle")}
        >
          {t("calendarView.offlineMessage")}
        </StatusBanner>
      )}
      {isGuest && <GuestBanner variant={desktop ? "default" : "compact"} />}
      {!canCreateShift && !isGuest && calendarId && (
        <ReadOnlyBanner
          title={t("calendarView.readOnlyTitle")}
          message={t("calendarView.readOnlyMessage")}
        />
      )}
    </>
  );
  const hasBanner = !isOnline || isGuest || (!canCreateShift && !!calendarId);

  const variant = desktop ? "desktop" : "phone";
  const surface =
    viewMode === "list" ? (
      // Search and filter are per calendar, so the key drops them on a switch
      <ShiftListView
        key={calendarId ?? "none"}
        variant={variant}
        days={calendarDays}
        selectedDay={selectedDay}
        shifts={visibleShifts}
        notes={notes}
        presets={presets}
        externalSyncs={externalSyncs}
        togglingDates={togglingDates}
        sort={listSort}
        combinedSort={layout.combinedSort ?? false}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        stampArmed={selectedPresetIds.length > 0}
        canEditShift={model.canEditShift}
        canDeleteShift={model.canDeleteShift}
        onEditShift={actions.onEditShift}
        onDeleteShift={actions.onDeleteShift}
        onDayClick={onDayClick}
        onSelectDay={onSelectDay}
        onDayContextMenu={canAddNote ? onDayContextMenu : undefined}
        scrollTarget={scrollTarget}
      />
    ) : viewMode === "week" ? (
      <WeekGrid
        variant={variant}
        days={calendarDays}
        selectedDay={selectedDay}
        shifts={visibleShifts}
        notes={notes}
        externalSyncs={externalSyncs}
        togglingDates={togglingDates}
        layout={layout}
        showShiftNotes={showShiftNotes}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        onDayClick={onDayClick}
        onDayContextMenu={canAddNote ? onDayContextMenu : undefined}
      />
    ) : (
      <MonthGrid
        variant={variant}
        calendarDays={calendarDays}
        currentDate={currentDate}
        selectedDay={selectedDay}
        shifts={visibleShifts}
        notes={notes}
        externalSyncs={externalSyncs}
        togglingDates={togglingDates}
        layout={layout}
        showShiftNotes={showShiftNotes}
        highlightedWeekdays={highlightedWeekdays}
        highlightColor={highlightColor}
        onDayClick={onDayClick}
        onDayContextMenu={canAddNote ? onDayContextMenu : undefined}
      />
    );

  if (desktop) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        {header}
        <div className="flex min-h-0 flex-1">
          <main className="relative flex min-w-0 flex-1 flex-col pb-[18px]">
            {hasBanner && <div className="flex flex-col gap-2 px-[18px] pt-3.5">{banners}</div>}
            <div className={isOnline ? "contents" : "contents [&>div]:opacity-60"}>{surface}</div>
            {stampingEnabled && (
              <StampDock
                presets={presets}
                selectedPresetIds={selectedPresetIds}
                onSelectPreset={onSelectPreset}
                onManage={onManagePresets}
              />
            )}
          </main>
          <DayInspector model={model} actions={actions} canViewStats={canViewStats} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      {header}
      {/* In list mode the list brings its own scroller, so <main> must not scroll too */}
      <main className={cn("flex min-h-0 flex-1 flex-col", viewMode !== "list" && "overflow-y-auto")}>
        {hasBanner && <div className="flex flex-col gap-2 px-3 pt-3">{banners}</div>}
        <div className="flex items-center gap-2 px-3.5 pb-[9px] pt-3">
          <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold tracking-[-0.015em] text-fg-strong">
            {formatPeriodCaption(currentDate, step, locale, { compact: true })}
          </h1>
          <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} variant="icon" />
          {isOnline ? (
            <MonthArrows currentDate={currentDate} onDateChange={onDateChange} step={step} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-2 font-semibold"
              onClick={() => queryClient.refetchQueries()}
            >
              <RefreshCw className="size-4" />
              {t("calendarView.retry")}
            </Button>
          )}
        </div>
        <div
          className={cn(
            "flex flex-1 flex-col pb-1",
            viewMode === "list" && "min-h-0",
            !isOnline && "opacity-60"
          )}
        >
          {surface}
        </div>
      </main>
      <div className="shrink-0">
        {stampingEnabled && (
          <MobilePresetBar
            presets={presets}
            selectedPresetIds={selectedPresetIds}
            onSelectPreset={onSelectPreset}
            onManage={onManagePresets}
          />
        )}
        <MobileDayFooter
          summary={monthSummary}
          currentDate={currentDate}
          canViewStats={canViewStats}
          onOpenStats={() => {
            // The footer shows the month, so the sheet opens on it
            setPeriod("month");
            setStatsOpen(true);
          }}
          onShowList={actions.onShowList}
          onAddShift={model.canAddShift ? actions.onAddShift : undefined}
          list={
            viewMode === "list"
              ? {
                  nextShift,
                  onJump: () => {
                    if (!nextShift?.date) return;
                    const day = nextShift.date as Date;
                    onSelectDay(day);
                    setScrollTarget((prev) => ({
                      key: formatDateToLocal(day),
                      nonce: (prev?.nonce ?? 0) + 1,
                    }));
                  },
                }
              : undefined
          }
        />
      </div>
      <MobileDaySheet
        model={model}
        actions={actions}
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
      />
      {canViewStats && (
        <MobileStatsSheet
          model={model}
          actions={actions}
          period={period}
          onPeriodChange={setPeriod}
          summary={sheetSummary}
          open={statsOpen}
          onOpenChange={setStatsOpen}
        />
      )}
    </div>
  );
}
