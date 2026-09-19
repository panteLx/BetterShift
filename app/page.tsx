"use client";

import { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { addDays, isSameMonth, isSameWeek, startOfWeek } from "date-fns";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";
import { useCalendars } from "@/hooks/useCalendars";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { useNotes } from "@/hooks/useNotes";
import { useCompareMode } from "@/hooks/useCompareMode";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useShiftActions } from "@/hooks/useShiftActions";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useDialogStates } from "@/hooks/useDialogStates";
import { useAuth } from "@/hooks/useAuth";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { CalendarViewMode, useCalendarViewMode } from "@/hooks/useCalendarViewMode";
import { EmptyCalendarState } from "@/components/empty-calendar-state";
import { GuestEmptyState } from "@/components/guest-empty-state";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { CalendarCompareSheet } from "@/components/calendar-compare-sheet";
import { CompareWorkspace } from "@/components/compare-workspace";
import { CalendarWorkspace } from "@/components/calendar-workspace";
import { AppHeader } from "@/components/app-header";
import { DialogManager } from "@/components/dialog-manager";
import { ShiftFormData } from "@/components/shift-sheet";
import { getCalendarDays, getMonthDays, getWeekDays } from "@/lib/calendar-utils";
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

  const { can, canOwned } = useCalendarPermission(selectedCalendar);
  // Own/Any precision (Paket 5b): a single calendar-wide boolean can't express who
  // may touch a specific shift, so callers needing per-shift precision get these closures
  // instead of a coarse canEdit — kept in sync with CalendarWorkspace/DialogManager below.
  // Edit and delete are independent capabilities (a bundle can grant one without the other).
  const canEditShift = (shift: ShiftWithCalendar) =>
    canOwned("editOwnShift", "editAnyShift", shift.createdBy ?? null);
  const canDeleteShift = (shift: ShiftWithCalendar) =>
    canOwned("deleteOwnShift", "deleteAnyShift", shift.createdBy ?? null);
  // Toasts are owned by CalendarWorkspace; this is only the stamping gate
  const { isOnline } = useConnectionStatus({ toasts: false });

  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>([]);
  const handlePresetSelection = useCallback(
    (presetId: string | undefined, multiSelect = false) => {
      if (!presetId) {
        setSelectedPresetIds([]);
        return;
      }
      setSelectedPresetIds((prev) => {
        if (multiSelect) {
          return prev.includes(presetId)
            ? prev.filter((id) => id !== presetId)
            : [...prev, presetId];
        }
        return prev.includes(presetId) ? [] : [presetId];
      });
    },
    []
  );
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [editingShift, setEditingShift] = useState<ShiftWithCalendar | undefined>();
  const [daySheetOpen, setDaySheetOpen] = useState(false);

  // Selection is tied to the calendar it was made in; switching calendars falls back to today
  const [selection, setSelection] = useState<{ calendarId?: string; day: Date }>(
    () => ({ day: new Date() })
  );
  // A fresh Date per render would invalidate every memo keyed on the selected day
  const todayKey = formatDateToLocal(new Date());
  const today = useMemo(() => parseLocalDate(todayKey), [todayKey]);
  const selectedDay =
    selection.calendarId === selectedCalendar ? selection.day : today;
  const selectDay = useCallback(
    (day: Date) => setSelection({ calendarId: selectedCalendar, day }),
    [selectedCalendar]
  );

  const queryClient = useQueryClient();

  const {
    isCompareMode,
    showCompareSelector,
    selectedCompareIds,
    compareTogglingDates,
    compareNoteCalendarId,
    setCompareNoteCalendarId,
    compareData,
    handleToggleCompareCalendar,
    handleExitCompare,
    openComparePicker,
    startCompare,
    cancelComparePicker,
    handleCompareDayClick,
  } = useCompareMode({
    calendars,
    hasLoadedOnce,
    selectedCalendar,
    currentDate,
    setCurrentDate,
    selectDay,
    selectedPresetIds,
  });

  const [storedViewMode, setViewMode] = useCalendarViewMode();
  // Compare mode shares one month grid, whatever this device last used
  const viewMode: CalendarViewMode = isCompareMode ? "month" : storedViewMode;

  const {
    notes,
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
  } = useNotes(isCompareMode ? compareNoteCalendarId : selectedCalendar);
  const { externalSyncs, hasSyncErrors } = useExternalSync(
    selectedCalendar || null
  );

  const viewSettings = useViewSettings();
  const dialogStates = useDialogStates();

  // Symmetric to CalendarWorkspace's mobile stats-sheet guard: close the
  // desktop stats dialog immediately if the capability disappears mid-session,
  // rather than leaving it open against a now-forbidden endpoint.
  const canViewStats = can("viewStats");
  const [prevCanViewStats, setPrevCanViewStats] = useState(canViewStats);
  if (canViewStats !== prevCanViewStats) {
    setPrevCanViewStats(canViewStats);
    if (!canViewStats && dialogStates.showMonthStatsDialog) {
      dialogStates.setShowMonthStatsDialog(false);
    }
  }

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

  const openCompareNotes = (calendarId: string, date: Date) => {
    setCompareNoteCalendarId(calendarId);
    openNotesForDay(compareData.notesMap.get(calendarId) || [], date);
  };

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

  // Navigation keeps the selection inside the visible period
  const handleDateChange = (date: Date) => {
    setCurrentDate(date);
    if (viewMode === "week") {
      if (!isSameWeek(selectedDay, date, { weekStartsOn: 1 })) {
        const now = new Date();
        selectDay(
          isSameWeek(now, date, { weekStartsOn: 1 })
            ? now
            : addDays(startOfWeek(date, { weekStartsOn: 1 }), (selectedDay.getDay() + 6) % 7)
        );
      }
      return;
    }
    if (!isSameMonth(selectedDay, date)) {
      selectDay(isSameMonth(new Date(), date) ? new Date() : new Date(date.getFullYear(), date.getMonth(), 1));
    }
  };

  const handleViewModeChange = (mode: CalendarViewMode) => {
    // Week anchors on the focused day; leaving week re-anchors on it when the two drifted apart
    if (!isSameMonth(selectedDay, currentDate) || mode === "week") setCurrentDate(selectedDay);
    setViewMode(mode);
  };

  // Compare mode shares one grid, so it always uses the personal view
  const personalView = viewSettings.personal;
  const calendarView = viewSettings.forCalendar(
    calendars.find((c) => c.id === selectedCalendar)
  );

  // Mirrors the server's OR check in app/api/shifts/route.ts — stamping only
  // needs one of the two capabilities, not specifically createShift.
  const canStampPreset = can("stampPreset") || can("createShift");

  // The armed presets are page state that outlives the stamp bar: it survives a
  // calendar switch, going offline and the personal toggle, none of which render
  // the dock. Derived here so a day click can never stamp without it on screen.
  const presetIdSet = new Set(presets.map((p) => p.id));
  const armedPresetIds =
    canStampPreset && isOnline && calendarView.showStampBar
      ? selectedPresetIds.filter((id) => presetIdSet.has(id))
      : [];

  const handleDayClick = (day: Date) => {
    selectDay(day);
    if (!isSameMonth(day, currentDate)) setCurrentDate(day);
    if (armedPresetIds.length > 0) {
      shiftActions.handleAddShift(day, armedPresetIds);
    } else if (!desktop) {
      setDaySheetOpen(true);
    }
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
      onNoteSubmit={noteActions.handleNoteSubmit}
      onNoteDelete={noteActions.selectedNote ? noteActions.handleNoteDelete : undefined}
      showNotesListDialog={dialogStates.showNotesListDialog}
      onNotesListDialogChange={dialogStates.setShowNotesListDialog}
      selectedDayNotes={dialogStates.selectedDayNotes}
      onEditNoteFromList={handleEditNoteFromList}
      onDeleteNoteFromList={handleDeleteNoteFromList}
      onAddNewNote={handleAddNewNoteFromList}
      currentDate={currentDate}
      canEditShift={canEditShift}
      canDeleteShift={canDeleteShift}
      showMonthStatsDialog={dialogStates.showMonthStatsDialog}
      onMonthStatsDialogChange={dialogStates.setShowMonthStatsDialog}
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
      onStartCompare={startCompare}
      onCancel={cancelComparePicker}
    />
  );

  const calendarDays = useMemo(
    () =>
      viewMode === "week"
        ? getWeekDays(currentDate)
        : viewMode === "list"
          ? getMonthDays(currentDate)
          : getCalendarDays(currentDate),
    [currentDate, viewMode]
  );

  if (
    (!hasLoadedOnce && loading) ||
    (!shiftsLoadedOnce && shiftsLoading) ||
    (!presetsLoadedOnce && presetsLoading) ||
    viewSettings.loading
  ) {
    return <FullscreenLoader message={t("common.loading")} />;
  }

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
          selectedPresetIds={selectedPresetIds}
          onSelectPreset={handlePresetSelection}
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
      canManageSync={can("manageExternalSync")}
      onDateChange={handleDateChange}
      onSelectCalendar={setSelectedCalendar}
      onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
      onSettings={() => dialogStates.setShowCalendarSettingsDialog(true)}
      onSyncNotifications={() => dialogStates.setShowSyncNotificationDialog(true)}
      onCompare={openComparePicker}
      onViewSettings={() => dialogStates.setShowViewSettingsDialog(true)}
      viewMode={viewMode}
      onViewModeChange={handleViewModeChange}
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
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        selectedDay={selectedDay}
        onDayClick={handleDayClick}
        onSelectDay={(day) => {
          // currentDate keys the month stats query, so only move it across months
          if (!isSameMonth(day, currentDate)) setCurrentDate(day);
          selectDay(day);
        }}
        onDayContextMenu={(date) => openNotesForDay(notes, date)}
        shifts={shifts}
        notes={notes}
        presets={presets}
        externalSyncs={externalSyncs}
        togglingDates={shiftActions.togglingDates}
        layout={toDayLayout(calendarView)}
        listSort={{
          type: calendarView.sortType,
          order: calendarView.sortOrder,
          // A calendar-pinned view replaces the personal one, so the personal sort is moot
          locked: !!calendars.find((c) => c.id === selectedCalendar)?.viewSettings,
          onChange: viewSettings.updatePersonal,
        }}
        showShiftNotes={calendarView.showShiftNotes}
        highlightedWeekdays={calendarView.highlightedWeekdays}
        highlightColor={calendarView.highlightColor}
        canCreateShift={can("createShift")}
        canAddNote={can("manageOwnNotesEvents")}
        canEditShift={canEditShift}
        canDeleteShift={canDeleteShift}
        showStampBar={calendarView.showStampBar}
        onlyMyShifts={calendarView.onlyMyShifts}
        canStampPreset={canStampPreset}
        canViewStats={canViewStats}
        selectedPresetIds={armedPresetIds}
        onSelectPreset={handlePresetSelection}
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
          onShowList:
            viewMode === "list"
              ? undefined
              : () => {
                  setDaySheetOpen(false);
                  handleViewModeChange("list");
                },
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
