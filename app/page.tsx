"use client";

import { useState, useEffect, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { isSameDay, isSameMonth } from "date-fns";
import { toast } from "sonner";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";
import { useCalendars } from "@/hooks/useCalendars";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { useNotes } from "@/hooks/useNotes";
import { useCompareData } from "@/hooks/useCompareData";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useShiftActions } from "@/hooks/useShiftActions";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useDialogStates } from "@/hooks/useDialogStates";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { EmptyCalendarState } from "@/components/empty-calendar-state";
import { GuestEmptyState } from "@/components/guest-empty-state";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { CalendarCompareSheet } from "@/components/calendar-compare-sheet";
import { CompareWorkspace } from "@/components/compare-workspace";
import { CalendarWorkspace } from "@/components/calendar-workspace";
import { AppHeader } from "@/components/app-header";
import { DialogManager } from "@/components/dialog-manager";
import { ShiftFormData } from "@/components/shift-sheet";
import { getCalendarDays } from "@/lib/calendar-utils";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";
import { findNotesForDate } from "@/lib/event-utils";
import { DayLayoutOptions } from "@/lib/shift-display";
import { CalendarViewSettings } from "@/lib/view-settings";

function toDayLayout(view: CalendarViewSettings): DayLayoutOptions {
  return {
    maxShifts: view.shiftsPerDay ?? undefined,
    maxExternalShifts: view.externalShiftsPerDay ?? undefined,
    sortType: view.sortType,
    sortOrder: view.sortOrder,
    combinedSort: view.combinedSort,
  };
}

function toDate(date: Date | string): Date {
  return typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? parseLocalDate(date)
    : new Date(date);
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);

  const { isGuest } = useAuth();

  const {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    hasLoadedOnce,
    createCalendar: createCalendarHook,
    deleteCalendar: deleteCalendarHook,
  } = useCalendars(searchParams.get("id"));

  const {
    shifts,
    loading: shiftsLoading,
    hasLoadedOnce: shiftsLoadedOnce,
    createShift: createShiftHook,
    deleteShift: deleteShiftHook,
    updateShift: updateShiftHook,
    refetchShifts,
  } = useShifts(selectedCalendar);

  const {
    presets,
    loading: presetsLoading,
    hasLoadedOnce: presetsLoadedOnce,
  } = usePresets(selectedCalendar);

  const { canEdit } = useCalendarPermission(selectedCalendar);

  const [selectedPresetId, setSelectedPresetId] = useState<string | undefined>();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [compareNoteCalendarId, setCompareNoteCalendarId] = useState<
    string | undefined
  >();
  const [editingShift, setEditingShift] = useState<ShiftWithCalendar | undefined>();
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  // Selection is tied to the calendar it was made in; switching calendars falls back to today
  const [selection, setSelection] = useState<{ calendarId?: string; day: Date }>(
    () => ({ day: new Date() })
  );
  const selectedDay =
    selection.calendarId === selectedCalendar ? selection.day : new Date();
  const selectDay = useCallback(
    (day: Date) => setSelection({ calendarId: selectedCalendar, day }),
    [selectedCalendar]
  );

  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showCompareSelector, setShowCompareSelector] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  // Selection before the picker opened, restored on cancel
  const [compareSnapshot, setCompareSnapshot] = useState<string[]>([]);
  const [compareTogglingDates, setCompareTogglingDates] = useState<
    Map<string, Set<string>>
  >(new Map());

  const queryClient = useQueryClient();

  const compareData = useCompareData({
    calendarIds: selectedCompareIds,
    enabled: isCompareMode,
  });

  const {
    notes,
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
  } = useNotes(isCompareMode ? compareNoteCalendarId : selectedCalendar);
  const { externalSyncs, hasSyncErrors } = useExternalSync(selectedCalendar || null);

  const viewSettings = useViewSettings();
  const dialogStates = useDialogStates();

  const noteActions = useNoteActions({
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
  });

  const shiftActions = useShiftActions({
    shifts,
    presets,
    createShift: createShiftHook,
    deleteShift: deleteShiftHook,
  });

  const invalidateCompareNotes = () => {
    if (isCompareMode && compareNoteCalendarId) {
      compareData.invalidateNotes(compareNoteCalendarId);
    }
  };

  const handleNoteSubmit = async (
    noteText: string,
    type: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => {
    await noteActions.handleNoteSubmit(
      noteText,
      type,
      color,
      recurringPattern,
      recurringInterval
    );
    invalidateCompareNotes();
  };

  const handleNoteDelete = async () => {
    await noteActions.handleNoteDelete();
    invalidateCompareNotes();
  };

  const handleEditNoteFromList = (note: CalendarNote) => {
    dialogStates.setShowNotesListDialog(false);
    noteActions.openNoteDialog(dialogStates.selectedDayDate || new Date(), note);
  };

  const handleDeleteNoteFromList = async (noteId: string) => {
    const success = await deleteNoteHook(noteId);
    if (!success) return;
    const updatedNotes = dialogStates.selectedDayNotes.filter((n) => n.id !== noteId);
    dialogStates.setSelectedDayNotes(updatedNotes);
    if (updatedNotes.length === 0) {
      dialogStates.setShowNotesListDialog(false);
    }
    invalidateCompareNotes();
  };

  const handleAddNewNoteFromList = () => {
    noteActions.openNoteDialog(dialogStates.selectedDayDate || new Date(), undefined);
  };

  /** Right-click / long-press shortcut: list the day's notes, or start a new one. */
  const openNotesForDay = (dayNotes: CalendarNote[], date: Date) => {
    const allDayNotes = findNotesForDate(dayNotes, date);
    if (allDayNotes.length >= 1) {
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const openDayShifts = (date: Date, dayShifts: ShiftWithCalendar[]) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedDayShifts(dayShifts);
    dialogStates.setShowDayShiftsDialog(true);
  };

  // Load compare mode from URL on initial load
  useEffect(() => {
    const compareParam = searchParams.get("compare");
    if (compareParam && !isCompareMode) {
      const calendarIds = compareParam.split(",").filter((id) => id.trim());
      if (calendarIds.length >= 2 && calendarIds.length <= 3) {
        const validIds = calendarIds.filter((id) =>
          calendars.some((cal) => cal.id === id)
        );
        if (validIds.length >= 2) {
          setSelectedCompareIds(validIds);
          setIsCompareMode(true);
        }
      }
    } else if (!compareParam && isCompareMode) {
      setIsCompareMode(false);
      setSelectedCompareIds([]);
      setCompareTogglingDates(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, calendars]);

  useEffect(() => {
    if (isCompareMode && selectedCompareIds.length >= 2) {
      router.replace(`/?compare=${selectedCompareIds.join(",")}`, { scroll: false });
    } else if (selectedCalendar && !isCompareMode) {
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    }
  }, [selectedCalendar, isCompareMode, selectedCompareIds, router]);

  const handleDeleteCalendar = async () => {
    if (!selectedCalendar) return;
    await deleteCalendarHook(selectedCalendar);
    dialogStates.setShowCalendarSettingsDialog(false);
  };

  const handleSyncComplete = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.shifts.byCalendar(selectedCalendar!),
    });
    queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
  };

  const openShiftSheet = (date: Date, shift?: ShiftWithCalendar) => {
    setEditingShift(shift);
    setSelectedDate(date);
    dialogStates.setShowShiftDialog(true);
  };

  const handleEditShift = (shift: ShiftWithCalendar) => {
    openShiftSheet(shift.date as Date, shift);
  };

  const handleShiftDialogChange = (open: boolean) => {
    dialogStates.setShowShiftDialog(open);
    if (!open) setEditingShift(undefined);
  };

  const handleShiftSubmit = async (formData: ShiftFormData) => {
    if (editingShift) {
      await updateShiftHook(editingShift.id, formData);
      setEditingShift(undefined);
      refetchShifts();
    } else {
      await shiftActions.handleShiftSubmit(formData);
    }
  };

  const handleDeleteShiftFromDayDialog = async (shiftId: string) => {
    dialogStates.setShowDayShiftsDialog(false);
    await shiftActions.handleDeleteShift(shiftId);
    refetchShifts();
  };

  // Month navigation keeps the selection inside the visible month
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    if (!isSameMonth(selectedDay, date)) {
      selectDay(isSameMonth(new Date(), date) ? new Date() : new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const handleDayClick = (day: Date) => {
    selectDay(day);
    if (!isSameMonth(day, currentDate)) setCurrentDate(day);
    if (selectedPresetId) {
      shiftActions.handleAddShift(day, selectedPresetId);
    } else if (!desktop) {
      setDaySheetOpen(true);
    }
  };

  // Compare mode handlers
  const handleToggleCompareCalendar = (calendarId: string) => {
    setSelectedCompareIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleExitCompare = () => {
    setIsCompareMode(false);
    setSelectedCompareIds([]);
    setCompareTogglingDates(new Map());
    router.replace(selectedCalendar ? `/?id=${selectedCalendar}` : `/`, {
      scroll: false,
    });
  };

  const updateCompareToggling = (calendarId: string, dateKey: string, add: boolean) => {
    setCompareTogglingDates((prev) => {
      const updated = new Map(prev);
      const next = new Set(updated.get(calendarId) || []);
      if (add) next.add(dateKey);
      else next.delete(dateKey);
      updated.set(calendarId, next);
      return updated;
    });
  };

  const openComparePicker = () => {
    setCompareSnapshot(isCompareMode ? selectedCompareIds : []);
    setShowCompareSelector(true);
  };

  const handleCompareDayClick = async (calendarId: string, date: Date | string) => {
    const targetDate = toDate(date);
    selectDay(targetDate);
    if (!isSameMonth(targetDate, currentDate)) setCurrentDate(targetDate);
    if (!selectedPresetId) return;

    const calendarPresets = compareData.presetsMap.get(calendarId) || [];
    const calendarShifts = compareData.shiftsMap.get(calendarId) || [];
    const preset = calendarPresets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    const dateKey = formatDateToLocal(targetDate);
    if (compareTogglingDates.get(calendarId)?.has(dateKey)) return;
    updateCompareToggling(calendarId, dateKey, true);

    try {
      const existingShift = calendarShifts.find(
        (shift) =>
          shift.date &&
          isSameDay(shift.date as Date, targetDate) &&
          shift.title === preset.title &&
          shift.startTime === preset.startTime &&
          shift.endTime === preset.endTime
      );

      if (existingShift) {
        await compareData.deleteShift({ calendarId, shiftId: existingShift.id });
      } else {
        await compareData.createShift({
          calendarId,
          formData: {
            date: dateKey,
            startTime: preset.startTime,
            endTime: preset.endTime,
            title: preset.title,
            color: preset.color,
            notes: preset.notes || "",
            presetId: preset.id,
            isAllDay: preset.isAllDay || false,
          },
        });
      }
    } catch (error) {
      console.error("Failed to toggle shift:", error);
      toast.error(t("common.error"));
    } finally {
      updateCompareToggling(calendarId, dateKey, false);
    }
  };

  const openCompareNotes = (calendarId: string, date: Date) => {
    setCompareNoteCalendarId(calendarId);
    openNotesForDay(compareData.notesMap.get(calendarId) || [], date);
  };

  const dialogManager = (
    <DialogManager
      showCalendarDialog={dialogStates.showCalendarDialog}
      onCalendarDialogChange={dialogStates.setShowCalendarDialog}
      onCreateCalendar={createCalendarHook}
      showShiftDialog={dialogStates.showShiftDialog}
      onShiftDialogChange={handleShiftDialogChange}
      onShiftSubmit={handleShiftSubmit}
      selectedDate={selectedDate}
      selectedCalendar={selectedCalendar || null}
      editingShift={editingShift}
      showSettingsDialog={dialogStates.showCalendarSettingsDialog}
      onSettingsDialogChange={dialogStates.setShowCalendarSettingsDialog}
      onDeleteCalendar={handleDeleteCalendar}
      onSyncComplete={handleSyncComplete}
      showSyncNotificationDialog={dialogStates.showSyncNotificationDialog}
      onSyncNotificationDialogChange={dialogStates.setShowSyncNotificationDialog}
      showDayShiftsDialog={dialogStates.showDayShiftsDialog}
      onDayShiftsDialogChange={dialogStates.setShowDayShiftsDialog}
      selectedDayDate={dialogStates.selectedDayDate}
      selectedDayShifts={dialogStates.selectedDayShifts}
      // In compare mode the day list mixes calendars the shift hooks aren't bound to
      onDeleteShiftFromDayDialog={isCompareMode ? undefined : handleDeleteShiftFromDayDialog}
      onEditShiftFromDayDialog={isCompareMode ? undefined : handleEditShift}
      noteCalendarId={isCompareMode ? compareNoteCalendarId : undefined}
      showViewSettingsDialog={dialogStates.showViewSettingsDialog}
      onViewSettingsDialogChange={dialogStates.setShowViewSettingsDialog}
      viewSettings={viewSettings}
      showNoteDialog={noteActions.showNoteDialog}
      onNoteDialogChange={noteActions.handleNoteDialogChange}
      selectedNote={noteActions.selectedNote}
      selectedNoteDate={noteActions.selectedDate}
      onNoteSubmit={handleNoteSubmit}
      onNoteDelete={noteActions.selectedNote ? handleNoteDelete : undefined}
      showNotesListDialog={dialogStates.showNotesListDialog}
      onNotesListDialogChange={dialogStates.setShowNotesListDialog}
      selectedDayNotes={dialogStates.selectedDayNotes}
      onEditNoteFromList={handleEditNoteFromList}
      onDeleteNoteFromList={handleDeleteNoteFromList}
      onAddNewNote={handleAddNewNoteFromList}
      currentDate={currentDate}
      shifts={shifts}
      canEditShifts={canEdit}
      showMonthStatsDialog={dialogStates.showMonthStatsDialog}
      onMonthStatsDialogChange={dialogStates.setShowMonthStatsDialog}
      showMonthShiftsDialog={dialogStates.showMonthShiftsDialog}
      onMonthShiftsDialogChange={dialogStates.setShowMonthShiftsDialog}
      onDeleteShift={(shift) => shiftActions.handleDeleteShift(shift.id)}
      presets={presets}
      showPresetManageDialog={dialogStates.showPresetManageDialog}
      onPresetManageDialogChange={dialogStates.setShowPresetManageDialog}
    />
  );

  const comparePicker = (
    <CalendarCompareSheet
      open={showCompareSelector}
      calendars={calendars}
      selectedIds={selectedCompareIds}
      onToggleCalendar={handleToggleCompareCalendar}
      onStartCompare={() => {
        setShowCompareSelector(false);
        setIsCompareMode(true);
      }}
      onCancel={() => {
        setShowCompareSelector(false);
        setSelectedCompareIds(compareSnapshot);
      }}
    />
  );

  // Compare mode shares one grid, so it always uses the personal view
  const personalView = viewSettings.personal;
  const calendarView = viewSettings.forCalendar(
    calendars.find((c) => c.id === selectedCalendar)
  );

  if (
    (!hasLoadedOnce && loading) ||
    (!shiftsLoadedOnce && shiftsLoading) ||
    (!presetsLoadedOnce && presetsLoading) ||
    viewSettings.loading
  ) {
    return <FullscreenLoader message={t("common.loading")} />;
  }

  const calendarDays = getCalendarDays(currentDate);

  if (isCompareMode) {
    if (compareData.isLoading) {
      return <FullscreenLoader message={t("common.loading")} />;
    }

    const togglingDatesMap = new Map<string, Set<string>>();
    selectedCompareIds.forEach((id) => {
      togglingDatesMap.set(id, compareTogglingDates.get(id) || new Set());
    });

    return (
      <>
        <CompareWorkspace
          calendars={calendars.filter((c) => selectedCompareIds.includes(c.id))}
          calendarDays={calendarDays}
          currentDate={currentDate}
          onDateChange={handleDateChange}
          selectedDay={selectedDay}
          onSelectDay={selectDay}
          shiftsMap={compareData.shiftsMap}
          notesMap={compareData.notesMap}
          externalSyncsMap={compareData.externalSyncsMap}
          presetsMap={compareData.presetsMap}
          togglingDatesMap={togglingDatesMap}
          layout={toDayLayout(personalView)}
          showShiftNotes={personalView.showShiftNotes}
          highlightedWeekdays={personalView.highlightedWeekdays}
          highlightColor={personalView.highlightColor}
          selectedPresetId={selectedPresetId}
          onSelectPreset={setSelectedPresetId}
          onDayClick={handleCompareDayClick}
          onDayContextMenu={openCompareNotes}
          onOpenDayShifts={openDayShifts}
          onPresetsChange={(calendarId: string) => {
            compareData.invalidatePresets(calendarId);
            queryClient.invalidateQueries({
              queryKey: queryKeys.shifts.byCalendar(calendarId),
            });
          }}
          onAddCalendar={openComparePicker}
          onViewSettings={() => dialogStates.setShowViewSettingsDialog(true)}
          onExit={handleExitCompare}
        />
        {comparePicker}
        {dialogManager}
      </>
    );
  }

  if (calendars.length === 0) {
    if (isGuest) return <GuestEmptyState />;
    return (
      <>
        <EmptyCalendarState
          onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
          showUserMenu={true}
        />
        {dialogManager}
      </>
    );
  }

  const header = (
    <AppHeader
      calendars={calendars}
      selectedCalendar={selectedCalendar}
      currentDate={currentDate}
      hasSyncErrors={hasSyncErrors}
      onDateChange={handleDateChange}
      onSelectCalendar={setSelectedCalendar}
      onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
      onSettings={() => dialogStates.setShowCalendarSettingsDialog(true)}
      onSyncNotifications={() => dialogStates.setShowSyncNotificationDialog(true)}
      onCompare={openComparePicker}
      onViewSettings={() => dialogStates.setShowViewSettingsDialog(true)}
    />
  );

  return (
    <>
      {comparePicker}

      <CalendarWorkspace
        header={header}
        calendarId={selectedCalendar}
        calendarDays={calendarDays}
        currentDate={currentDate}
        onDateChange={handleDateChange}
        selectedDay={selectedDay}
        onDayClick={handleDayClick}
        onDayContextMenu={(date) => openNotesForDay(notes, date)}
        shifts={shifts}
        notes={notes}
        presets={presets}
        externalSyncs={externalSyncs}
        togglingDates={shiftActions.togglingDates}
        layout={toDayLayout(calendarView)}
        showShiftNotes={calendarView.showShiftNotes}
        highlightedWeekdays={calendarView.highlightedWeekdays}
        highlightColor={calendarView.highlightColor}
        canEdit={canEdit}
        showStampBar={calendarView.showStampBar}
        selectedPresetId={selectedPresetId}
        onSelectPreset={setSelectedPresetId}
        onManagePresets={() => dialogStates.setShowPresetManageDialog(true)}
        sheetOpen={daySheetOpen}
        onSheetOpenChange={setDaySheetOpen}
        actions={{
          onAddShift: () => openShiftSheet(selectedDay),
          onEditShift: handleEditShift,
          onDeleteShift: (shift) => shiftActions.handleDeleteShift(shift.id),
          onAddNote: () => noteActions.openNoteDialog(selectedDay, undefined),
          onOpenNote: (note) => noteActions.openNoteDialog(selectedDay, note),
          onOpenStats: () => dialogStates.setShowMonthStatsDialog(true),
          onOpenMonthShifts: () => dialogStates.setShowMonthShiftsDialog(true),
        }}
      />

      {dialogManager}
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<FullscreenLoader message="" />}>
      <HomeContent />
    </Suspense>
  );
}
