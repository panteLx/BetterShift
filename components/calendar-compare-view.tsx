"use client";

import { useTranslations } from "next-intl";
import { CalendarWithCount, ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync, ShiftPreset } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { CalendarContent } from "@/components/calendar-content";
import { PresetSelector } from "@/components/preset-selector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { X, Link, Smartphone } from "lucide-react";
import { motion } from "motion/react";
import { Locale } from "date-fns";
import { toast } from "sonner";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

interface CalendarCompareViewProps {
  calendars: CalendarWithCount[];
  selectedIds: string[];
  allCalendars: CalendarWithCount[];
  calendarDays: Date[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  shiftsMap: Map<string, ShiftWithCalendar[]>;
  notesMap: Map<string, CalendarNote[]>;
  externalSyncsMap: Map<string, ExternalSync[]>;
  presetsMap: Map<string, ShiftPreset[]>;
  selectedPresetId?: string;
  onSelectPreset: (id: string | undefined) => void;
  togglingDatesMap: Map<string, Set<string>>;
  maxShiftsToShow?: number;
  maxExternalShiftsToShow?: number;
  showShiftNotes: boolean;
  showFullTitles: boolean;
  shiftSortType: "startTime" | "createdAt" | "title";
  shiftSortOrder: "asc" | "desc";
  combinedSortMode: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  statsRefreshTrigger: number;
  locale?: Locale;
  onDayClick: (calendarId: string, date: Date) => void;
  onDayRightClick?: (
    calendarId: string,
    e: React.MouseEvent,
    date: Date
  ) => void;
  onNoteIconClick?: (
    calendarId: string,
    e: React.MouseEvent,
    date: Date
  ) => void;
  onLongPress?: (calendarId: string, date: Date) => void;
  onShowAllShifts: (
    calendarId: string,
    date: Date,
    shifts: ShiftWithCalendar[]
  ) => void;
  onShowSyncedShifts: (
    calendarId: string,
    date: Date,
    shifts: ShiftWithCalendar[]
  ) => void;
  onDeleteShift?: (calendarId: string, id: string) => void;
  onViewSettingsClick: () => void;
  onExit: () => void;
  hidePresetHeader?: boolean;
  onHidePresetHeaderChange?: (hide: boolean) => void;
  onPresetsChange: (calendarId: string) => void;
  onShiftsChange?: () => void;
  onStatsRefresh?: () => void;
  presetsLoadingMap?: Map<string, boolean>;
}

export function CalendarCompareView(props: CalendarCompareViewProps) {
  const t = useTranslations();

  const selectedCalendars = props.calendars.filter((cal) =>
    props.selectedIds.includes(cal.id)
  );

  // Pre-calculate permissions for all selected calendars
  // We need to call hooks unconditionally, so we always get permissions for all selected calendars
  const permission0 = useCalendarPermission(selectedCalendars[0]?.id);
  const permission1 = useCalendarPermission(selectedCalendars[1]?.id);
  const permission2 = useCalendarPermission(selectedCalendars[2]?.id);

  // Map permissions by calendar ID
  const permissionsMap = new Map<
    string,
    ReturnType<typeof useCalendarPermission>
  >();
  if (selectedCalendars[0])
    permissionsMap.set(selectedCalendars[0].id, permission0);
  if (selectedCalendars[1])
    permissionsMap.set(selectedCalendars[1].id, permission1);
  if (selectedCalendars[2])
    permissionsMap.set(selectedCalendars[2].id, permission2);

  // Find which calendar owns the selected preset
  const selectedPresetCalendarId = props.selectedPresetId
    ? (() => {
        for (const [calendarId, presets] of props.presetsMap.entries()) {
          if (presets.some((p) => p.id === props.selectedPresetId)) {
            return calendarId;
          }
        }
        return null;
      })()
    : null;

  const handleShareLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("compare", props.selectedIds.join(","));

    navigator.clipboard
      .writeText(url.toString())
      .then(() => {
        toast.success(t("common.copied", { item: t("calendar.compareMode") }));
      })
      .catch(() => {
        toast.error(t("common.error"));
      });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="w-full px-3 sm:px-4 py-3 sm:py-4">
          <div className="space-y-3">
            {/* Title and Exit Button */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {t("calendar.compareMode")}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("calendar.compareSelected", {
                    count: selectedCalendars.length,
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleShareLink}
                  variant="outline"
                  className="gap-2"
                  title={t("calendar.shareLinkDescription")}
                >
                  <Link className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("calendar.shareLink")}
                  </span>
                </Button>
                <Button
                  onClick={props.onExit}
                  variant="outline"
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {t("calendar.exitCompare")}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Warning */}
      <div className="lg:hidden mx-3 mt-3 mb-1">
        <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <Smartphone className="h-4 w-4 text-amber-600 dark:text-amber-500" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            {t("calendar.mobileNotOptimized")}
          </AlertDescription>
        </Alert>
      </div>

      {/* Calendars Grid */}
      <div className="flex-1 w-full px-1 sm:px-4 py-4">
        <div
          className={`grid gap-4 ${
            selectedCalendars.length === 2
              ? "grid-cols-1 lg:grid-cols-2"
              : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {selectedCalendars.map((calendar) => {
            const shifts = props.shiftsMap.get(calendar.id) || [];
            const notes = props.notesMap.get(calendar.id) || [];
            const externalSyncs = props.externalSyncsMap.get(calendar.id) || [];
            const togglingDates =
              props.togglingDatesMap.get(calendar.id) || new Set();
            const calendarPresets = props.presetsMap.get(calendar.id) || [];
            const presetsLoading =
              props.presetsLoadingMap?.get(calendar.id) || false;

            // Get pre-calculated permission for this calendar
            const permission = permissionsMap.get(calendar.id)!;

            // Check if this calendar is disabled (preset from different calendar selected)
            const isDisabled =
              selectedPresetCalendarId !== null &&
              selectedPresetCalendarId !== calendar.id;

            return (
              <motion.div
                key={calendar.id}
                className="border border-border rounded-xl overflow-hidden bg-card shadow-sm"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Calendar Header */}
                <div
                  className="px-4 py-3 border-b border-border/50 space-y-3"
                  style={{
                    background: `linear-gradient(135deg, ${calendar.color}20 0%, ${calendar.color}10 50%, transparent 100%)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-5 h-5 rounded-full shrink-0 ring-2 ring-background"
                      style={{ backgroundColor: calendar.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-base">
                        {calendar.name}
                      </h3>
                    </div>
                  </div>

                  {/* Preset List for this calendar */}
                  <div className="-mx-2">
                    <PresetSelector
                      calendars={props.allCalendars}
                      presets={calendarPresets}
                      selectedPresetId={props.selectedPresetId}
                      onSelectPreset={props.onSelectPreset}
                      onPresetsChange={() => props.onPresetsChange(calendar.id)}
                      onShiftsChange={props.onShiftsChange}
                      onStatsRefresh={props.onStatsRefresh}
                      calendarId={calendar.id}
                      onViewSettingsClick={props.onViewSettingsClick}
                      loading={presetsLoading}
                      hidePresetHeader={props.hidePresetHeader}
                      onHidePresetHeaderChange={props.onHidePresetHeaderChange}
                      hideManageButton={true}
                    />
                  </div>
                </div>

                {/* Calendar Content */}
                <div className="p-2 sm:p-3">
                  {/* Hint when preset from different calendar is selected */}
                  {isDisabled && (
                    <div className="mb-3 p-3 bg-muted/50 border border-border/50 rounded-lg">
                      <p className="text-xs text-muted-foreground text-center">
                        {t("preset.cannotAddPresetHint")}
                      </p>
                    </div>
                  )}
                  <CalendarContent
                    calendarDays={props.calendarDays}
                    currentDate={props.currentDate}
                    onDateChange={props.onDateChange}
                    shifts={shifts}
                    notes={notes}
                    selectedPresetId={
                      isDisabled ? undefined : props.selectedPresetId
                    }
                    togglingDates={togglingDates}
                    externalSyncs={externalSyncs}
                    maxShiftsToShow={props.maxShiftsToShow}
                    maxExternalShiftsToShow={props.maxExternalShiftsToShow}
                    showShiftNotes={props.showShiftNotes}
                    showFullTitles={props.showFullTitles}
                    shiftSortType={props.shiftSortType}
                    shiftSortOrder={props.shiftSortOrder}
                    combinedSortMode={props.combinedSortMode}
                    highlightedWeekdays={props.highlightedWeekdays}
                    highlightColor={props.highlightColor}
                    selectedCalendar={calendar.id}
                    statsRefreshTrigger={props.statsRefreshTrigger}
                    locale={props.locale}
                    onDayClick={
                      isDisabled
                        ? () => {}
                        : (date) => props.onDayClick(calendar.id, date)
                    }
                    onDayRightClick={
                      props.onDayRightClick && permission.canEdit
                        ? (e, date) =>
                            props.onDayRightClick!(calendar.id, e, date)
                        : undefined
                    }
                    onNoteIconClick={
                      props.onNoteIconClick && permission.canEdit
                        ? (e, date) =>
                            props.onNoteIconClick!(calendar.id, e, date)
                        : undefined
                    }
                    onLongPress={
                      props.onLongPress && permission.canEdit
                        ? (date) => props.onLongPress!(calendar.id, date)
                        : undefined
                    }
                    onShowAllShifts={(date, dayShifts) =>
                      props.onShowAllShifts(calendar.id, date, dayShifts)
                    }
                    onShowSyncedShifts={(date, syncedShifts) =>
                      props.onShowSyncedShifts(calendar.id, date, syncedShifts)
                    }
                    onDeleteShift={
                      props.onDeleteShift && permission.canEdit
                        ? (id) => props.onDeleteShift!(calendar.id, id)
                        : undefined
                    }
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
