"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addMonths, format, startOfMonth, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, RefreshCw, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { MonthGrid } from "@/components/month-grid";
import { DayInspector, DayActions, DayViewModel } from "@/components/day-inspector";
import { MobileDayFooter, MobileDaySheet } from "@/components/mobile-day-sheet";
import { MobilePresetBar, StampDock, orderStampPresets } from "@/components/stamp-dock";
import { GuestBanner } from "@/components/guest-banner";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { StatusBanner } from "@/components/status-banner";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import { DayLayoutOptions } from "@/lib/shift-display";
import { getDateLocale } from "@/lib/locales";
import { useDayData, usePeriodSummary, StatsPeriod } from "@/hooks/useDaySummary";
import { useStampShortcuts } from "@/hooks/useStampShortcuts";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useAuth } from "@/hooks/useAuth";

interface CalendarWorkspaceProps {
  header: React.ReactNode;
  calendarId: string | undefined;
  calendarDays: Date[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedDay: Date;
  onDayClick: (date: Date) => void;
  onDayContextMenu: (date: Date) => void;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  presets: ShiftPreset[];
  externalSyncs: ExternalSync[];
  togglingDates: Set<string>;
  layout: DayLayoutOptions;
  showShiftNotes: boolean;
  highlightedWeekdays: number[];
  highlightColor: string;
  canEdit: boolean;
  showStampBar: boolean;
  selectedPresetId: string | undefined;
  onSelectPreset: (id: string | undefined) => void;
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
  selectedDay,
  onDayClick,
  onDayContextMenu,
  shifts,
  notes,
  presets,
  externalSyncs,
  togglingDates,
  layout,
  showShiftNotes,
  highlightedWeekdays,
  highlightColor,
  canEdit,
  showStampBar,
  selectedPresetId,
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
  const { isGuest } = useAuth();
  const { isOnline } = useConnectionStatus({ toasts: false });
  const [period, setPeriod] = useState<StatsPeriod>("month");

  const dayData = useDayData({ selectedDay, shifts, notes });
  const monthSummary = usePeriodSummary({
    calendarId,
    anchorDate: startOfMonth(currentDate),
    period: "month",
    shifts,
  });
  const sheetSummary = usePeriodSummary({
    calendarId,
    anchorDate: period === "week" ? selectedDay : startOfMonth(currentDate),
    period,
    shifts,
  });

  const stampingEnabled = canEdit && isOnline && showStampBar;
  useStampShortcuts({
    presetIds: orderStampPresets(presets).map((p) => p.id),
    selectedPresetId,
    onSelectPreset,
    enabled: stampingEnabled && desktop,
  });

  const model: DayViewModel = {
    selectedDay,
    currentDate,
    ...dayData,
    summary: monthSummary,
    canEdit: canEdit && isOnline,
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
      {!canEdit && !isGuest && calendarId && (
        <ReadOnlyBanner
          title={t("calendarView.readOnlyTitle")}
          message={t("calendarView.readOnlyMessage")}
        />
      )}
    </>
  );
  const hasBanner = !isOnline || isGuest || (!canEdit && !!calendarId);

  const grid = (
    <MonthGrid
      variant={desktop ? "desktop" : "phone"}
      calendarDays={calendarDays}
      currentDate={currentDate}
      selectedDay={selectedDay}
      shifts={shifts}
      notes={notes}
      externalSyncs={externalSyncs}
      togglingDates={togglingDates}
      layout={layout}
      showShiftNotes={showShiftNotes}
      highlightedWeekdays={highlightedWeekdays}
      highlightColor={highlightColor}
      onDayClick={onDayClick}
      onDayContextMenu={canEdit ? onDayContextMenu : undefined}
    />
  );

  if (desktop) {
    return (
      <div className="flex h-dvh flex-col bg-background">
        {header}
        <div className="flex min-h-0 flex-1">
          <main className="relative flex min-w-0 flex-1 flex-col pb-[18px]">
            {hasBanner && <div className="flex flex-col gap-2 px-[18px] pt-3.5">{banners}</div>}
            <div className={isOnline ? "contents" : "contents [&>div]:opacity-60"}>{grid}</div>
            {stampingEnabled && (
              <StampDock
                presets={presets}
                selectedPresetId={selectedPresetId}
                onSelectPreset={onSelectPreset}
                onManage={onManagePresets}
              />
            )}
          </main>
          <DayInspector model={model} actions={actions} />
        </div>
      </div>
    );
  }

  const dateLocale = getDateLocale(locale);
  const stepClass =
    "flex size-9 items-center justify-center text-fg-secondary transition-colors hover:bg-surface-panel";

  return (
    <div className="flex h-dvh flex-col bg-background">
      {header}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {hasBanner && <div className="flex flex-col gap-2 px-3 pt-3">{banners}</div>}
        <div className="flex items-center justify-between gap-2 px-3.5 pb-[9px] pt-3">
          <h1 className="text-[19px] font-semibold tracking-[-0.015em] text-fg-strong">
            {format(currentDate, "LLLL yyyy", { locale: dateLocale })}
          </h1>
          {isOnline ? (
            <div className="flex overflow-hidden rounded-[9px] border border-line">
              <button
                type="button"
                className={stepClass}
                onClick={() => onDateChange(subMonths(currentDate, 1))}
                aria-label={t("calendarView.previousMonth")}
              >
                <ChevronLeft className="size-[18px]" />
              </button>
              <span className="w-px bg-line" />
              <button
                type="button"
                className={stepClass}
                onClick={() => onDateChange(addMonths(currentDate, 1))}
                aria-label={t("calendarView.nextMonth")}
              >
                <ChevronRight className="size-[18px]" />
              </button>
            </div>
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
        <div className={`flex flex-1 flex-col pb-1${isOnline ? "" : " opacity-60"}`}>{grid}</div>
      </main>
      <div className="shrink-0">
        {stampingEnabled && (
          <MobilePresetBar
            presets={presets}
            selectedPresetId={selectedPresetId}
            onSelectPreset={onSelectPreset}
            onManage={onManagePresets}
          />
        )}
        <MobileDayFooter
          model={model}
          onOpen={() => onSheetOpenChange(true)}
          onAddShift={model.canEdit ? actions.onAddShift : undefined}
        />
      </div>
      <MobileDaySheet
        model={model}
        actions={actions}
        period={period}
        onPeriodChange={setPeriod}
        periodSummary={sheetSummary}
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
      />
    </div>
  );
}
